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

import { WebResource, BucketSpec, VersionEntry, DeployResponse } from './deploy-struct';
import { wrapSuccess, wrapError } from './util'
import * as fs from 'fs'
import * as path from 'path'

export function ensureWebLocal(webLocal: string): string {
    if (fs.existsSync(webLocal)) {
        if (fs.lstatSync(webLocal).isDirectory()) {
            return webLocal
        } else {
            throw new Error(`'${webLocal}' exists and is not a directory`)
        }
    }
    fs.mkdirSync(webLocal, { recursive: true })
    return webLocal
}

export function deployToWebLocal(resource: WebResource, webLocal: string, spec: BucketSpec): Promise<DeployResponse> {
    let destination = resource.simpleName
    // Do stripping
    if (spec && spec.strip) {
        let parts = destination.split(path.sep)
        if (parts.length > spec.strip) {
            parts = parts.slice(spec.strip)
            destination = parts.join(path.sep)
        }
    }
    // Do prefixing
    destination = (spec && spec.prefixPath) ? path.join(spec.prefixPath, destination) : destination
    // Make relative to the webLocal directory
    destination = path.resolve(webLocal, destination)
    // Make sure that parent directories exist
    const parent = path.dirname(destination)
    if (!fs.existsSync(parent)) {
        fs.mkdirSync(parent, { recursive: true })
    }
    // Copy
    try {
        fs.copyFileSync(resource.filePath, destination)
        const response = wrapSuccess(destination, "web", false, undefined, {}, undefined)
         return Promise.resolve(response)
    } catch (err) {
        return Promise.resolve(wrapError(err, `web resource '${resource.simpleName}'`))
    }
}
