/*
 * Nimbella CONFIDENTIAL
 * ---------------------
 *
 *   2018 - present Nimbella Corp
 *   All Rights Reserved.
 *
 * NOTICE:
 *
 * All information contained herein is, and remains the property of
 * Nimbella Corp and its suppliers, if any.  The intellectual and technical
 * concepts contained herein are proprietary to Nimbella Corp and its
 * suppliers and may be covered by U.S. and Foreign Patents, patents
 * in process, and are protected by trade secret or copyright law.
 *
 * Dissemination of this information or reproduction of this material
 * is strictly forbidden unless prior written permission is obtained
 * from Nimbella Corp.
 */

import { cleanOrLoadVersions, doDeploy, actionWrap } from './deploy'
import { DeployStructure, DeployResponse, PackageSpec, OWOptions, WebResource, Credentials, Flags } from './deploy-struct'
import { readTopLevel, buildStructureParts, assembleInitialStructure } from './project-reader'
import { isTargetNamespaceValid, wrapError, wipe, saveUsFromOurselves, writeProjectStatus, getTargetNamespace } from './util'
import { openBucketClient } from './deploy-to-bucket'
import { buildAllActions, buildWeb } from './finder-builder'
import * as openwhisk from 'openwhisk'
import * as path from 'path'
import { switchNamespace, getCredentials, Persister } from './login';

// Contains the main public (library) API of the deployer (some exports in 'util' may also be used externally but are incidental)

// Deploy a disk-resident project given its path and options to pass to openwhisk.  The options are merged
// with those in the config; the result must include api or apihost, and must include api_key.
export function deployProject(path: string, owOptions: OWOptions, credentials: Credentials|undefined, persister: Persister,
        flags: Flags): Promise<DeployResponse> {
    //console.log("deployProject invoked with incremental", flags.incremental)
    return readPrepareAndBuild(path, owOptions, credentials, persister, flags).then(deploy).catch((err) => {
        //console.log("An error was caught")
        //console.dir(err, { depth: null })
        return Promise.resolve(wrapError(err, undefined))
    })
}

// Combines the read, prepare, and build phases but does not deploy
export function readPrepareAndBuild(path: string, owOptions: OWOptions, credentials: Credentials, persister: Persister,
        flags: Flags): Promise<DeployStructure> {
    return readAndPrepare(path, owOptions, credentials, persister, flags).then((spec) => buildProject(spec))
}

// Combines the read and prepare phases but does not build or deploy
export function readAndPrepare(path: string, owOptions: OWOptions, credentials: Credentials, persister: Persister,
        flags: Flags): Promise<DeployStructure> {
    return readProject(path, flags.env).then((spec) => prepareToDeploy(spec, owOptions, credentials, persister, flags))
}

// Perform deployment from a deploy structure.  The 'cleanOrLoadVersions' step is currently folded into this step
export function deploy(todeploy: DeployStructure): Promise<DeployResponse> {
    //console.log("Starting deploy")
    return cleanOrLoadVersions(todeploy).then(doDeploy).then(results => {
        writeProjectStatus(todeploy.filePath, results)
        return results
    })
}

// Read the information contained in the project, initializing the DeployStructure
export function readProject(projectPath: string, envPath: string): Promise<DeployStructure> {
    //console.log("Starting readProject")
    return readTopLevel(projectPath, envPath).then(buildStructureParts).then(assembleInitialStructure).catch((err) => {
        return Promise.reject(err)
    })
}

// 'Build' the project by running the "finder builder" steps in each action-as-directory and in the web directory
export function buildProject(project: DeployStructure): Promise<DeployStructure> {
    //console.log("Starting buildProject")
    let webPromise: Promise<WebResource[]> = undefined
    project.sharedBuilds = { }
    if (project.webBuild) {
        webPromise = buildWeb(project.webBuild, project.sharedBuilds, path.join(project.filePath, 'web'), project.flags)
    }
    const actionPromise: Promise<PackageSpec[]> = buildAllActions(project.packages, project.sharedBuilds, project.flags)
    if (webPromise) {
        if (actionPromise) {
            return Promise.all([webPromise, actionPromise]).then(result => {
                const [ web, packages] = result
                project.web = web
                project.packages = packages
                return project
            })
        } else {
            return webPromise.then(web => {
                project.web = web
                return project
            })
        }
    } else if (actionPromise) {
        return actionPromise.then(packages => {
            project.packages = packages
            return project
        })
    } else {
        return Promise.resolve(project)
    }
}

// Prepare a DeployStruct for deployment.
// 1.  Ensure that we are using the right credentials
// 2.  Merge credentials and user-specified OWOptions that were not necessarily part of the credentials.
// 3.  Open the OW and bucket client handles to ensure they are valid before the (possibly extensive) build step is performed.
//    Validation includes the optional check on the target namespace; even if it came from the credentials it might no longer be valid.
// 4.  Do action wrapping of web resources.  This creates additional actions in the final deployment.  The original web resources
//    are not deleted but are not deployed as such.
export async function prepareToDeploy(inputSpec: DeployStructure, owOptions: OWOptions, credentials: Credentials, persister: Persister,
        flags: Flags): Promise<DeployStructure> {
    //console.log("Starting prepare")
    // 1.  Acquire credentials if not already present
    if (!credentials) {
        if (inputSpec.targetNamespace) {
            // The config specified a target namespace so attempt to switch to it.
            credentials = await switchNamespace(inputSpec.targetNamespace, owOptions.apihost, persister)
        } else {
            // There is no target namespace so get credentials for the current one
            credentials = await getCredentials(persister)
        }
    }
    //console.log('owOptions', owOptions)
    //console.log('credentials.ow', credentials.ow)
    const wskoptions = Object.assign({}, credentials.ow, owOptions || {})
    //console.log('wskoptions', wskoptions)
    inputSpec.credentials = credentials
    //console.log("prepareToDeploy merging flags", flags)
    inputSpec.flags = flags
    //console.log("Options merged")
    // 3.  Open handles
    const needsBucket = inputSpec.web && inputSpec.web.length > 0 && !inputSpec.actionWrapPackage
    if (needsBucket && !credentials.storageKey) {
        return Promise.reject(new Error(
            `Deployment of web content to namespace '${credentials.namespace}' requires a storage key but none is present`
        ))
    }
    //console.log("Auth sufficiency established")
    inputSpec.owClient = openwhisk(wskoptions)
    if (!credentials.namespace) {
        credentials.namespace = await getTargetNamespace(inputSpec.owClient)
    } else {
        await isTargetNamespaceValid(inputSpec.owClient, credentials.namespace)
    }
    //console.log("Target namespace validated")
    if (!flags.production) {
        saveUsFromOurselves(credentials.namespace, credentials.ow.apihost)
    }
    //console.log("Sensitive project/namespace guard passed")
    if (needsBucket) {
        inputSpec.bucketClient = await openBucketClient(credentials, inputSpec.bucket)
            .catch(() => Promise.reject(new Error('Could not access object storage using the supplied credentials')))
    }
    //console.log("Bucket client created")
    // 4.  Action wrapping
    const { web, packages } = inputSpec
    if (web && web.length > 0 && inputSpec.actionWrapPackage) {
        const wrapping = web.map(res => {
            if (!res.mimeType) {
                throw new Error(`Could not deploy web resource ${res.filePath}; mime type cannot be determined`)
            }
            return actionWrap(res)
        })
        const wrapPackage = inputSpec.actionWrapPackage
        return Promise.all(wrapping).then(wrapped => {
            // If wrapPackage is already in the inputSpec, add the new actions to it.  Otherwise, make a new PackageSpec
            const existing: PackageSpec[] = packages.filter(pkg => pkg.name == wrapPackage)
            if (existing.length == 0) {
                packages.push({name: wrapPackage, actions: wrapped, shared: false } )
            } else {
                const modified = existing[0].actions.concat(wrapped)
                existing[0].actions = modified
            }
            return inputSpec
        })
    } else {
        return Promise.resolve(inputSpec)
    }
}

// Utility to convert errors into useful messages.   Usually, this just means getting the message field from the error but there
// is logic to recognize the particular error pattern used by OW
export function getMessageFromError(err: any): string {
    // Althought we attempt to say that all errors have type Error, in the loosy-goosy untyped world of Javascript this is easily violated.
    // Sometimes 'err' is just a string
    if (typeof err == 'string') {
        return err
    }
    // Pattern match against the OW error pattern
    if (err.error && err.error.error && err.error.code) {
        return "[OpenWhisk] " + err.error.error
    }
    // Default case
    return err.message
}

// Undocumented function to wipe a namespace of everything except its activations (the activations cannot be wiped via the public API)
export async function wipeNamespace(host: string, auth: string) {
    console.log("Requested wipe-namespace function with host", host, "and auth", auth)
    const init: OWOptions = { apihost: host, api_key: auth}
    const client = openwhisk(init)
    console.log("Client opened")
    return wipe(client)
}