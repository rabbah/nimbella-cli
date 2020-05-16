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

 import { initializeAPI } from './deployer/api'

// List of plural commands to be replaced by singular equivalents before being delegated to aio runtime plugin
const pluralCommands = ['actions', 'activations', 'packages', 'routes', 'rules', 'triggers', 'objects', 'projects']

// Aliases that don't follow the plurals model.  Plugins doesn't because we get the name from a plugin and don't control it directly
const topicAliases = {'key-value':'kv', 'workbench':'wb', 'namespace':'ns', 'plugins':'plugin'}


// A screening function called at top level (before the real oclif dispatching begins).  Does various fixups.
export async function run() {
    // Get info from package.jsoh
    const pj = require('../package.json')
    const topics = Object.keys(pj.oclif.topics)
    // Compute user agent
    const userAgent = 'nimbella-cli/' + pj.version
    // Initialize the API environment
    initializeAPI(userAgent)
    // Split an initial colon-separated topic:command token if found
    decolonize(topics)
    // Apply simple "plurals" fix
    const cmd = process.argv[2]
    if (pluralCommands.includes(cmd)) {
        process.argv[2] = cmd.slice(0, -1)
    }
    // Apply alias fix till https://github.com/oclif/oclif/issues/237
    const alias = Object.keys(topicAliases).filter((key) => {
        return topicAliases[key] === cmd
    })
    if (alias.length) {
        process.argv[2] = alias[0]
    }
    // Insert a colon between the first two tokens (may have been split earlier or not)
    colonize(topics)
    // Run the command
    await require('@oclif/command').run()
}

// Split the first non-flag token on a colon if present and if the leading part is a topic
function decolonize(topics: string[]) {
    let argvbase = process.argv.slice(0, 2)
    const oldargv = process.argv.slice(2)
    const cmdTokens: string[] = []
    for (const arg of oldargv) {
        if (cmdTokens.length < 2 && !isFlag(arg)) {
            const parts = arg.split(':')
            if (topics.includes(parts[0])) {
                cmdTokens.push(...parts)
            } else {
                cmdTokens.push(arg)
            }
        } else {
            cmdTokens.push(arg)
        }
    }
    process.argv = argvbase.concat(cmdTokens)
}

// Check whether a token is a flag
function isFlag(token: string): boolean {
    return token.startsWith('-')
}

// Heuristically combine the first two consecutive non-flag non-help arguments in process.argv using a colon separator,
// starting at index position 2, iff the first such argument is a known topic.  This will be useful to the extent
// that the topic space has a limited depth (there are no commands requiring more than one colon separator).
// This is true at present and can be easily adjusted in the future).
function colonize(topics: string[]) {
    const args = process.argv
    let index = 2
    while (index < args.length && (isFlag(args[index]) || args[index] === 'help')) {
        index++
    }
    if (index > args.length - 2 || isFlag(args[index + 1]) || args[index] === 'help') {
        return
    }
    if (!topics.includes(args[index])) {
        return
    }
    const combined = args[index] + ':' + args[index + 1]
    const prefix = args.slice(0, index)
    const suffix = args.slice(index + 2)
    process.argv = prefix.concat([combined]).concat(suffix)
}
