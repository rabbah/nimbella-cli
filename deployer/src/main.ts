#!/usr/bin/env node
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

 // The deployer CLI

import  { deployProject, readProject, readAndPrepare, readPrepareAndBuild, wipeNamespace, getMessageFromError } from './api'
import  { DeployStructure, DeployResponse, Flags, OWOptions, Credentials, CredentialRow } from './deploy-struct'
import { doLogin, doAdminLogin, fileSystemPersister, forgetNamespace, switchNamespace, getCredentialList } from './login'
import  * as optionsParser from 'yargs-parser'
import * as open from 'open'

// Semi-secret token to enable the 'wipe' function.   TODO this needn't be so obscure; it could even be documented.
// A reason not to document it is that it is low level (uses auth rather than namespace).  But that isn't a reason
// to make the syntax so inconvenient, since it is useful test scripts, etc.
const NIM_TOKEN = 'c541c576'

// Constants used in formatting the credential list
const LIST_HEADER = 'Namespace            Current Storage API Host'
const NS_LEN = 21
const YES = '   yes  '
const NO = '    no  '

// Quick processing for no args, --help, --version, and --doc, and --credentials
if (process.argv.length < 3 || process.argv.length == 3 && process.argv[2] == '--help') {
    console.log("Usage deployProject --login <token> [ --apihost <api host> ]")
    console.log("      deployProject --target <namespace> [ --apihost <api host> ]")
    console.log("      deployProject --forget <namespace> [ --apihost <api host> ]")
    console.log("      deployProject [ --version | --help | --doc | --credentials ]")
    console.log("      deployProject <paths-to-projects>... [ <deploy-options> ]")
    console.log("")
    console.log("    where <deploy-options> are")
    console.log("       --target <namespace>, --env <path>, --incremental")
    console.log("       --apihost <api host>, --auth <api key>, --insecure,")
    console.log("       --verbose-build, --verbose-errors, --yarn")
 } else if (process.argv.length == 3 && process.argv[2] == '--version') {
    const version = require('./version.json')
    console.log(version.version)
 } else if (process.argv.length == 3 && process.argv[2] == '--doc') {
    doc()
 } else {
    // Otherwise, parse entire cmdline
    const parsed = optionsParser(process.argv.slice(2), { boolean: ['insecure', 'verbose-build', 'verbose-errors',
        'production', 'incremental', 'credentials', 'yarn'] })
    deploy(parsed)
}

// Main working function
async function deploy(parsed: optionsParser.Arguments) {
    let host: string, auth: string, projects: string[], stopAfter: string, insecure: boolean,
        verboseBuild: boolean, verboseErrors: boolean, target: string, production: boolean,
        incremental: boolean, env: string, login: string, forget: string, credentials: boolean, yarn: boolean
    for (const key in parsed) {
        if (key == 'apihost') {
            host = parsed[key]
        } else if (key == 'auth') {
            auth = parsed[key]
        } else if (key == 'stop-after' || key == 'stopAfter') {
            const value = parsed[key]
            switch (value) {
                case 'read':
                case 'prepare':
                case 'build':
                    stopAfter = value
                    break
                default:
                    console.log("Unrecognized 'stop-after' value:", value)
                    process.exit(1)
            }
        } else if (key == 'insecure') {
            insecure = true
        } else if (key == 'target' || key == 'target-namespace' || key == 'targetNamespace') {
            target = parsed[key]
        } else if (key == 'forget') {
            forget = parsed[key]
        } else if (key == 'env') {
            env = parsed[key]
        } else if (key == 'verbose-errors' || key == 'verboseErrors') {
            verboseErrors = true
        } else if (key == 'verbose-build' || key == 'verboseBuild') {
            verboseBuild = true
        } else if (key == 'production') {
            production = true
        } else if (key == 'incremental') {
            incremental = true
        } else if (key == 'login') {
            login = parsed[key]
        } else if (key == 'credentials') {
            credentials = parsed[key]
        } else if (key == 'yarn') {
            yarn = parsed[key]
        } else if (key == '_') {
            projects = parsed[key]
        } else {
            console.log("Unrecognized option:", key)
            process.exit(1)
        }
    }

    // Rule out illogical combinations
    if (projects && projects.length > 0) {
        if (login || forget || credentials) {
            console.error("Projects may not be specified on the same command line as '--login', '--credentials' or '--forget'")
            process.exit(1)
        }
    } else if (!login && !forget && !target && !credentials) {
        console.error("No project(s) specified")
        process.exit(1)
    }

    // If host, auth, or insecure is provided, the provided value overrides what's in the credential store (in the case of host, it
    // can designate an apihost clause in the credential store for other purposes)

    // Overriding config
    let owOptions: OWOptions = {}
    if (host) {
        owOptions.apihost = host
    }
    if (auth) {
        owOptions.api_key = auth
    }
    if (insecure) {
        owOptions.ignore_certs = true
    }

    // Some special cases.  Note: target switch can precede deployment or be standalone,
    // so we don't treat it as a special case even when it's standalone
    if (login === 'administrative') {
        // Admin login using information provided by `nim get user`
        await doAdminLogin(owOptions.apihost).catch(err => {
            console.error("Error!", getMessageFromError(err))
            process.exit(1)
        })
        process.exit(0)
    } else if (login) {
        // Normal customer login
        await doLogin(login, fileSystemPersister, owOptions.apihost).catch(err => {
            console.error("Error!", getMessageFromError(err))
            process.exit(1)
        })
        process.exit(0)
    } else if (forget) {
        // Dropping a namespace from the credential store
        await forgetNamespace(forget, owOptions.apihost, fileSystemPersister).catch(err => {
            console.error("Error!", getMessageFromError(err))
            process.exit(1)
        })
        process.exit(0)
    } else if (credentials) {
        // List all credentials
        const list = getCredentialList(fileSystemPersister)
        await formatCredentialList(list)
        process.exit(0)
    } else if (projects[0] === NIM_TOKEN && projects.length == 3) {
        // Special 'wipe' directive from `nim delete user`
        await wipeNamespace(projects[1], projects[2])
        process.exit(0)
    }

    // Iff a namespace switch was requested, perform it.  It might fail if there are no credentials for the target
    let creds: Credentials = undefined
    if (target) {
        creds = await switchNamespace(target, owOptions.apihost, fileSystemPersister).catch(err => {
            console.error("Error!", getMessageFromError(err))
            process.exit(1)
            return undefined // not reached, satisfies type checker
        })
    } else if (host && auth) {
        // Else if both apihost and auth were provided on the command line, synthesize credentials with (as yet)
        // unknown namespace; if the creds don't match a targetNamespace in the config that error will be found
        // later
        creds = { namespace: undefined, ow: { apihost: host, api_key: auth }, storageKey: undefined}
    } /* else undefined creds; this isn't necessarily an error since the config might supply a namespace that
        will be found in the credential store */

    // Do project deployment
    let success = true
    const flags: Flags = { verboseBuild, production, incremental, env, yarn }
    for (const project of projects) {
        const status = await processProject(project, creds, flags, stopAfter, env, owOptions, verboseErrors)
        if (!status) {
            success = false
        }
    }
    if (success) {
        process.exit(0)
    } else {
        process.exit(1)
    }
}

// Process one project
function processProject(project: string, credentials: Credentials, flags: Flags, stopAfter: string, env: string, owOptions: OWOptions,
        verboseErrors: boolean): Promise<boolean> {
    if (stopAfter) {
        let promise: Promise<DeployStructure>
        let error: any = undefined
        switch (stopAfter) {
            case 'read':
                promise = readProject(project, env).catch(err => { error = err; return {} })
                break
            case 'prepare':
                promise = readAndPrepare(project, owOptions, credentials, fileSystemPersister, flags).catch(err => { error = err; return {} })
                break
            case 'build':
                promise = readPrepareAndBuild(project, owOptions, credentials, fileSystemPersister, flags)
                    .catch(err => { error = err; return {} })
                break
        }
        return promise.then(structure => {
            if (error) {
                console.error(error)
                return false
            }
            console.log(`Result after '${stopAfter}' phase in project '${project}':`)
            console.dir(structure, { depth: null} )
            return true
        })
    } else {
        return deployProject(project, owOptions, credentials, fileSystemPersister, flags).then(result => displayResult(result, project, verboseErrors))
            .catch(err => {
                console.error(err)
                return false
            })
    }
}

// Display doc
async function doc() {
    // Internal URL in case HTML not present (temporary measure; this should only happen during development)
    let html = "https://github.com/nimbella-corp/workbench/blob/master/deployer/deployer.md"
    try {
        // Get the normal HTML; will be present in deployer as distributed
        html = require.resolve('./deployer.html')
    } catch {}
    await open(html)
}

// Display the credential list
function formatCredentialList(credentialPromise: Promise<CredentialRow[]>) {
    //console.log("formatting credentials")
    return credentialPromise.then(credentialList => {
        console.log(LIST_HEADER)
        for (const row of credentialList) {
            const pad = ' '.repeat(NS_LEN - row.namespace.length)
            const curr = row.current ? YES : NO
            const stor = row.storage ? YES : NO
            console.log(row.namespace + pad + curr + stor + row.apihost)
        }
    })
}


// Display the result of a successful run
function displayResult(result: DeployResponse, project: string, verboseErrors: boolean): boolean {
    let namespaceClause = ""
    if (result.namespace) {
        namespaceClause = ` to namespace '${result.namespace}'`
    }
    let hostClause = ""
    if (result.apihost) {
        hostClause = ` on host '${result.apihost}'`
    }
    console.log(`\nResult of deploying project '${project}'${namespaceClause}${hostClause}`)
    let success = true
    if (result.successes.length == 0 && result.failures.length == 0) {
        console.log("Nothing deployed")
    } else {
        for (const msg of result.successes) {
            console.log(msg)
        }
        for (const err of result.failures) {
            success = false
            const context = err['context']
            if (context) {
                console.error(`While deploying ${context}:`)
            }
            console.error("Error!", getMessageFromError(err))
            if (verboseErrors && err.stack) {
                console.log(err.stack)
            }
        }
    }
    return success
}
