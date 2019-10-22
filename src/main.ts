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

export async function run() {
    // console.log("argv:", argv)
    const cmd = process.argv[2]
    if (aioCommands.includes(cmd)) {
        if (cmd.endsWith('s')) {
            process.argv[2] = cmd.slice(0, -1)
        }
        if (process.argv.length > 3) {
            // console.log("delgating to aio")
            await require('@adobe/aio-cli/src').run(['runtime'].concat(process.argv.slice(2)))
            return
        }
    }
    // console.log("not delegating", cmd)
    await require('@oclif/command').run()
}
