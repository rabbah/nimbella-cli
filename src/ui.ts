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

// Utilities for UI, versioned for CLI and workbench.   Interaction with the user has to be done differently
// (in general) in the two cases.

import { inBrowser } from './NimBaseCommand'

let kuiPrompt: (msg: string) => Promise<string>
let cli;

// Open a URL in 'the' browser or the system default browser
// Note: this is reliable for http[s] absolute URLs.  It won't work on file URLs in the browser.
// Whether or not it works on relative URLs in the browser depends on how the files are packaged by webpack.
// If the files are buried in webpack bundles this function will not work for them.
export function open(url: string) {
    if (inBrowser) {
        return window.open(url)
    } else {
        return require('open')(url)
    }
}

// Allow the cloud-workbench to install a kui-friendly prompter
export function setKuiPrompter(prompter: (msg: string) => Promise<string>) {
    kuiPrompt = prompter
}

// Prompt the user
export async function prompt(msg: string): Promise<string> {
    if (inBrowser) {
        if (!kuiPrompt) {
            throw new Error('Running in browser and there is no prompt support installed, cannot proceed')
        }
        return await kuiPrompt(msg)
    } else {
        if (!cli) { cli = require('cli-ux').cli }
        return await cli.prompt(msg)
    }
}

export async function spinner(): Promise<any> {
    if (inBrowser) {
        return Promise.resolve({
            start: _ => { },
            stop: _ => { }
        })
    }
    else {
        if (!cli) { cli = require('cli-ux').cli }
        return await cli.action;
    }
}
