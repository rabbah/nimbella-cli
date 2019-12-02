#!/usr/bin/env node

import { fileSystemPersister } from './deployer/login';

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

// List of plural commands to be replaced by singular equivalentsdelegated to aio runtime plugin
const pluralCommands = ['actions', 'activations', 'packages', 'routes', 'rules', 'triggers' ]

// A screening function called at top level (before the real oclif dispatching begins).  Does various fixups.
export async function run() {
    // Remove __OW stuff from environment
    cleanEnvironment()
    // Make the argv array canonical by splitting on colons
    makeCanonical()
    // Apply simple "plurals" fix
    const cmd = process.argv[2]
    if (pluralCommands.includes(cmd)) {
        process.argv[2] = cmd.slice(0, -1)
    }
    fixAioCredentials()
    colonize()
    await require('@oclif/command').run()
}

// Purge the process environment of entries that match __OW_*.   These are not attempting to influence 'nim' because
// we specifically document that that doesn't work.  If they are there at all they are strays from some other usage but
// they can do mischief.
function cleanEnvironment() {
    for (const item in process.env) {
        if (item.startsWith('__OW_')) {
            delete process.env[item]
        }
    }
}

// Change the user's presented command into a canonical form:
// 1.  Colon-seperated commands are split into tokens as if blank-separated
// 2.  If a flag requesting help is present, remove it, note it, and add `--help` at the end.
function makeCanonical() {
    let argvbase = process.argv.slice(0, 2)
    const oldargv = process.argv.slice(2)
    const cmdTokens: string[] = []
    let haveHelp = false
    const lowerAlpha = /^[a-z]+$/
    for (const arg of oldargv) {
        if (isHelpToken(arg)) {
            haveHelp = true
        } else {
            const parts = arg.split(':')
            let split = true
            for (const part of parts) {
                if (!part.match(lowerAlpha)) {
                    split = false
                }
            }
            if (split) {
                cmdTokens.push(...parts)
            } else {
                cmdTokens.push(arg)
            }
        }
    }
    if (haveHelp) {
        cmdTokens.push('--help')
    }
    process.argv = argvbase.concat(cmdTokens)
}

// Stuff the current namespace, API host, and AUTH key into the environment so that AIO does not look in .wskprops when invoked by nim
function fixAioCredentials() {
    let store = fileSystemPersister.loadCredentialStoreIfPresent()
    let currentHost: string
    let currentNamespace: string
    let currentAuth: string
    if (store) {
        currentHost = store.currentHost
        currentNamespace = store.currentNamespace
    } else {
        // No credential store (brand new user who's never done a login?).   Not much we can do, other than using our default API host in place of AIO's
        currentHost = 'https://apigcp.nimbella.io'
    }
    if (store && currentHost && currentNamespace) {
        const creds = store.credentials[currentHost][currentNamespace]
        if (creds) {
            currentAuth = creds.api_key
        } else {
            console.log(`Error retrieving credentials for '${currentNamespace}' on host '${currentHost}'`)
        }
    }
    process.env.AIO_RUNTIME_APIHOST = currentHost
    process.env.AIO_RUNTIME_AUTH = currentAuth
    process.env.AIO_RUNTIME_NAMESPACE = currentNamespace
}

// Check whether a token is a flag
function isFlag(token: string): boolean {
    return token.startsWith('-')
}

// Heuristically combine the first two consecutive non-flag arguments in process.argv using a colon separator,
// starting at index position 2.  This will be useful to the extent that the topic space has a limited depth
// (there are no commands requiring more than one colon separator).  This is true at present and can be
// easily adjusted in the future).
function colonize() {
    const args = process.argv
    let index = 2
    while (index < args.length && isFlag(args[index])) {
        index++
    }
    if (index > args.length - 2 || isFlag(args[index + 1])) {
        return
    }
    const combined = args[index] + ':' + args[index + 1]
    const prefix = args.slice(0, index)
    const suffix = args.slice(index + 2)
    process.argv = prefix.concat([combined]).concat(suffix)
}

// Test whether a command line token is a help verb or flag
function isHelpToken(arg: string): boolean {
    return arg === 'help' || arg === '--help' || arg === '-h'
}
