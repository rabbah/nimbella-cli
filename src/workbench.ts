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

import { NimLogger } from './NimBaseCommand'
import { open } from './ui'
const workbenchURL = 'https://apigcp.nimbella.io/wb'
const previewURL = 'https://preview-apigcp.nimbella.io/workbench'

// Utility to open the workbench with or without an initial command.
// Used by both "workbench:run" and "workbench:login".
// Not expected to be used in the browser.

export function openWorkbench(command: string, preview: boolean, logger: NimLogger) {
    let query = ''
    if (command) {
        query = '?command=' + encodeURIComponent(command)
    }
    const url = (preview ? previewURL : workbenchURL) + query
    open(url)
}
