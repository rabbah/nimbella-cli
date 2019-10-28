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

import * as fs from 'fs'
import { DeployStructure, DeployResponse, ActionSpec, PackageSpec, WebResource, BucketSpec, DeployerAnnotation, VersionEntry } from './deploy-struct'
import { combineResponses, wrapMessage, wrapError, keyVal, emptyResponse,
    getDeployerAnnotation, straysToResponse, wipe, makeDict, generateSecret, digestPackage, digestAction, loadVersions } from './util'
import * as openwhisk from 'openwhisk'
import { Bucket } from '@google-cloud/storage'
import { deployToBucket, cleanBucket } from './deploy-to-bucket'

//
// Main deploy logic, excluding that assigned to more specialized files
//

// Clean resources as requested unless the 'incremental' flag is specified.  If incremental, cleaning is skipped but the versions
// information is loaded (including hashes) to support incremental deploy.
export async function cleanOrLoadVersions(todeploy: DeployStructure): Promise<DeployStructure> {
    if (todeploy.flags.incremental) {
        await (todeploy.versions = loadVersions(todeploy.filePath, todeploy.credentials.namespace, todeploy.credentials.ow.apihost))
    } else {
        if (todeploy.bucketClient && (todeploy.cleanNamespace || todeploy.bucket && todeploy.bucket.clean)) {
            await cleanBucket(todeploy.bucketClient, todeploy.bucket)
        }
        if (todeploy.cleanNamespace) {
            await wipe(todeploy.owClient)
        } else {
            await cleanActionsAndPackages(todeploy)
        }
    }
    return Promise.resolve(todeploy)
}

// Do the actual deployment (after testing the target namespace and cleaning)
export function doDeploy(todeploy: DeployStructure): Promise<DeployResponse> {
    const webPromises = todeploy.web.map(res => deployWebResource(res, todeploy.actionWrapPackage, todeploy.bucket, todeploy.bucketClient,
            todeploy.flags.incremental ? todeploy.versions : undefined))
    return getDeployerAnnotation(todeploy.filePath).then(deployerAnnot => {
        const actionPromises = todeploy.packages.map(pkg => deployPackage(pkg, todeploy.owClient, deployerAnnot, todeploy.parameters,
            todeploy.cleanNamespace, todeploy.flags.incremental ? todeploy.versions : undefined))
        const strays = straysToResponse(todeploy.strays)
        return Promise.all(webPromises.concat(actionPromises)).then(responses => {
            responses.push(strays)
            const response = combineResponses(responses)
            response.apihost = todeploy.credentials.ow.apihost
            return response
        })
    })
}

// Look for 'clean' flags in the actions and packages and perform the cleaning.
function cleanActionsAndPackages(todeploy: DeployStructure): Promise<DeployStructure> {
    if (!todeploy.packages) {
        return Promise.resolve(todeploy)
    }
    const promises: Promise<any>[] = []
    for (const pkg of todeploy.packages) {
        const defaultPkg = pkg.name == 'default'
        if (pkg.clean && !defaultPkg) {
            // We should have headed off 'clean' of the default package already, but just in case
            promises.push(cleanPackage(todeploy.owClient, pkg.name, todeploy.versions))
        } else if (pkg.actions) {
            const prefix = defaultPkg ? "" : pkg.name + '/'
            for (const action of pkg.actions) {
                if (action.clean) {
                    delete todeploy.versions.actionVersions[action.name]
                    promises.push(todeploy.owClient.actions.delete(prefix + action.name).catch(() => undefined))
                }
            }
        }
    }
    return Promise.all(promises).then(() => todeploy)
}

// Clean a package by first deleting its contents then deleting the package itself
async function cleanPackage(client: openwhisk.Client, name: string, versions: VersionEntry): Promise<any> {
    // console.log("Cleaning package", name)
    while (true) {
        const pkg = await client.packages.get({ name })
        if (!pkg.actions || pkg.actions.length == 0) {
            // console.log("No more actions, removing package")
            delete versions.packageVersions[name]
            return client.packages.delete({ name })
        }
        for (const action of pkg.actions) {
            // console.log("deleting action", action.name)
            delete versions.actionVersions[action.name]
            await client.actions.delete({ name: name + '/' + action.name })
        }
    }
}

// Deploy a web resource.  Exactly one of actionWrapPackage or bucketClient will be defined, (other cases should have been thrown
// out as errors earlier).  If actionWrapPackage is provided, this step is a no-op since the actual action
// wrapping will have been done in the prepareToDeploy step and the fact of action wrapping will be part of the final status message
// for deploying the action.
export function deployWebResource(res: WebResource, actionWrapPackage: string, spec: BucketSpec,
        bucketClient: Bucket, versions: VersionEntry): Promise<DeployResponse> {
    // We can rely on the fact that prepareToDeploy would have rejected the deployment if action wrapping failed.
    if (actionWrapPackage) {
        return Promise.resolve(emptyResponse())
    } else if (bucketClient) {
        return deployToBucket(res, bucketClient, spec, versions)
    } else {
        return Promise.resolve(wrapError(new Error(`No bucket client and/or bucket spec for '${res.simpleName}'`), 'web resources'))
    }
}

// Wrap a web resource in an action.   Returns a promise of the resulting ActionSpec
export function actionWrap(res: WebResource): Promise<ActionSpec> {
    return new Promise(function(resolve, reject) {
        fs.readFile(res.filePath, (err, data) => {
            if (err) {
                reject(err)
            } else {
                let contents = String(data)
                contents = contents.split('\\').join('\\\\').split('`').join('\\`')
                let code = `
const body = \`${contents}\`

function main() {
    return {
       statusCode: 200,
       headers: { 'Content-Type': '${res.mimeType}' },
       body: body
    }
}`
                const name = res.simpleName.endsWith('.html') ? res.simpleName.replace('.html', '') : res.simpleName
                resolve({ name, file: res.filePath, runtime: "nodejs:default", binary: false, web: true, code, wrapping: res.filePath })
            }
        })
    })
}

// Deploy a package, then deploy everything in it (currently just actions)
export async function deployPackage(pkg: PackageSpec, wsk: openwhisk.Client,
        deployerAnnot: DeployerAnnotation, projectParams: openwhisk.Dict, namespaceIsClean: boolean, versions: VersionEntry): Promise<DeployResponse> {
    if (pkg.name == 'default') {
        return Promise.all(pkg.actions.map(action => deployAction(action, wsk, "", deployerAnnot, namespaceIsClean, versions))).then(combineResponses)
    }
    // Check whether the package metadata needs to be deployed; if so, deploy it.  If not, make a vacuous response with the existing package
    // VersionInfo.   That is needed so that the new versions.json will have the information in it.
    let pkgResponse: DeployResponse
    const digest = digestPackage(pkg)
    if (versions && versions.packageVersions && versions.packageVersions[pkg.name] && digest === versions.packageVersions[pkg.name].digest) {
            const packageVersions = {}
            packageVersions[pkg.name] = versions.packageVersions[pkg.name]
            pkgResponse = { successes: [], failures: [], packageVersions, actionVersions: {}, namespace: undefined }
    } else {
        let former: openwhisk.Package = undefined
        if (!pkg.clean && !namespaceIsClean) {
            former = await wsk.packages.get({ name: pkg.name }).catch(() => undefined)
        }
        const oldAnnots = former && former.annotations ? makeDict(former.annotations) : {}
        delete oldAnnots['deployerAnnot'] // remove unwanted legacy from undetected earlier error
        const deployer = deployerAnnot
        deployer.digest = digest.substring(0, 8)
        const annotDict = Object.assign({}, oldAnnots, pkg.annotations, { deployer })
        const annotations = keyVal(annotDict)
        const mergedParams = Object.assign({}, projectParams, pkg.parameters)
        const owPkg: openwhisk.Package = { parameters: keyVal(mergedParams), annotations, publish: pkg.shared }
        await wsk.packages.update({name: pkg.name, package: owPkg}).then(result => {
            const packageVersions = {}
            packageVersions[pkg.name] = { version: result.version, digest }
            pkgResponse = { successes: [], failures: [], packageVersions, actionVersions: {}, namespace: result.namespace }
        }).catch(err => {
            pkgResponse = wrapError(err, `package '${pkg.name}'`)
        })
    }
    // Now deploy (or skip) the actions of the package
    const prefix = pkg.name + '/'
    const promises = pkg.actions.map(action => deployAction(action, wsk, prefix, deployerAnnot, pkg.clean || namespaceIsClean, versions))
        .concat(Promise.resolve(pkgResponse))
    return Promise.all(promises).then(responses => combineResponses(responses))
}

// Deploy an action
function  deployAction(action: ActionSpec, wsk: openwhisk.Client, prefix: string, deplAnnot: DeployerAnnotation,
        actionIsClean: boolean, versions: VersionEntry): Promise<DeployResponse> {
    if (action.code) {
        return deployActionFromCode(action, prefix, action.code, wsk, deplAnnot, actionIsClean, versions)
    }
    const codeFile = action.file
    return new Promise(function(resolve, reject) {
        fs.readFile(codeFile, (err, data) => {
           if (err) {
                reject(err)
           } else {
                const code = action.binary ? data.toString('base64') : String(data)
                resolve(code)
           }
        })
    }).then((code: string) => deployActionFromCode(action, prefix, code, wsk, deplAnnot, actionIsClean, versions))
    .catch(err => Promise.resolve(wrapError(err, `action '${prefix}${action.name}'`)))
}

 // Deploy an action when the code has already been read from a file or constructed programmatically.  The code and file members
 // of the ActionSpec are ignored but the rest of the ActionSpec is intepreted here.
 async function deployActionFromCode(action: ActionSpec, prefix: string, code: string, wsk: openwhisk.Client, deployerAnnot: DeployerAnnotation,
        actionIsClean: boolean, versions: VersionEntry): Promise<DeployResponse> {
    const name = prefix + action.name
    let runtime = action.runtime
    if (!runtime) {
        return Promise.resolve(wrapError(new Error(`Action '${name}' not deployed: runtime type could not be determined`), `action ${name}`))
    }
    // Check whether the action needs to be deployed; if so, deploy it.  If not, make a vacuous response with the existing package
    // VersionInfo.   That is needed so that the new versions.json will have the information in it.
    const digest = digestAction(action, code)
    if (versions && versions.actionVersions && versions.actionVersions[name] && digest === versions.actionVersions[name].digest) {
        // Skipping deployment
        const actionVersions = {}
        actionVersions[name] = versions.actionVersions[name]
        return Promise.resolve(wrapMessage(`Action ${name} was unchanged since last deployment (not re-deployed)`, actionVersions, undefined))
    }
    // Will be deployed
    // Compute the annotations that we will definitely be adding
    const annotations = action.annotations || {}
    const deployer = deployerAnnot
    deployer.digest = digest.substring(0, 8)
    deployer.zipped = action.zipped
    annotations['deployer'] = deployer
    if (action.web == true) {
        annotations['web-export'] = true
        annotations['final'] = true
        annotations['raw-http'] = false
    } else if (action.web === "raw") {
        annotations['web-export'] = true
        annotations['final'] = true
        annotations['raw-http'] = true
    }
    // Get the former annotations of the action if any
    let former: openwhisk.Action = undefined
    if (!action.clean && !actionIsClean) {
        const options = { name, code: false }
        former = await wsk.actions.get(options).catch(() => undefined)
    }
    const oldAnnots = former && former.annotations ? makeDict(former.annotations) : {}
    // Merge the annotations
    const annotDict = Object.assign({}, oldAnnots, annotations)
    // Now process the webSecure annotation, which requires that the old annotations be available
    if (typeof action.webSecure == 'string') {
        annotDict['require-whisk-auth'] = action.webSecure
    } else if (action.webSecure === true && !annotDict['require-whisk-auth']) {
        // The webSecure=true case is only operative if there is not already a require-whisk-auth value
        annotDict['require-whisk-auth'] = generateSecret()
    } else if (action.webSecure === false) {
        delete annotDict['require-whisk-auth']
    }
    // Compute the complete Action value for the call
    const exec = { code, binary: action.binary,  kind: runtime, main: action.main } // Actually legal but openwhisk.Exec doesn't think so
    const actionBody: openwhisk.Action = { annotations: keyVal(annotDict), parameters: keyVal(action.parameters), exec: exec as openwhisk.Exec }
    if (action.limits) {
        actionBody.limits = action.limits
    }
    const deployParams = { name, action: actionBody }
    return wsk.actions.update(deployParams).then(response => {
        const map = {}
        map[name] = { version: response.version, digest }
        const namespace = response.namespace.split('/')[0]
        let wrapmsg = ""
        if (action.wrapping) {
            wrapmsg = ` (wrapping ${action.wrapping})`
        }
        return Promise.resolve(wrapMessage(`Action ${name} deployed${wrapmsg}`, map, namespace))
    }).catch(err => {
        return Promise.resolve(wrapError(err, `action '${name}'`))
    })
 }
