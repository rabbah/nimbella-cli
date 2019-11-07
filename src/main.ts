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

// List of commands to be delegated to aio runtime plugin
const aioCommands = ['action', 'actions', 'activation', 'activations', 'namespace',
    'package', 'packages', 'route', 'routes', 'rule', 'rules', 'trigger', 'triggers' ]

// A screening function called at top level (before the real oclif dispatching begins).  Decides whether to call our own oclif multi command
// stack or delegate to Apache I/O.  Note that we declare dependency on the entire Apache I/O in order to get clean dispatching but we only
// use the "runtime" branch.   We shadow the aio runtime tree to a small extent in order to give correct help.
export async function run() {
    const isHelp = makeCanonical() || process.argv.length < 4
    // Examine command to classify it as aio or not and apply 'plurals relaxation'
    const cmd = process.argv[2]
    let aioCmd = aioCommands.includes(cmd)
    // Apply simple "plurals" fix
    if (aioCmd && cmd.endsWith('s')) {
        process.argv[2] = cmd.slice(0, -1)
    }
    // Even if it's an aio command we don't delegate if it's an explicit or implicit help request
    if (aioCmd && !isHelp) {
        // A non-help aio command
        // console.log('delegating to aio')
        await require('@adobe/aio-cli/src').run(['runtime'].concat(process.argv.slice(2)))
        return
    }
    // console.log("not delegating")
    colonize()
    await require('@oclif/command').run()
}

// Change the user's presented command into a canonical form:
// 1.  Colon-seperated commands are split into tokens as if blank-separated
// 2.  If a flag requesting help is present, remove it, note it, and add `--help` at the end.
function makeCanonical(): boolean {
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
    return haveHelp
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
