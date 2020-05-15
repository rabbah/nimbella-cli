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

import { Storage, Bucket } from '@google-cloud/storage'
import { Credentials, WebResource, DeployResponse, DeploySuccess, BucketSpec, VersionEntry, ProjectReader, OWOptions } from './deploy-struct'
import { wrapSuccess, wrapError } from './util'
import axios from 'axios'
import * as openwhisk from 'openwhisk'
import * as path from 'path'
import * as fs from 'fs'
import * as crypto from 'crypto'
import * as URL from 'url-parse'
import * as makeDebug from 'debug'
import { inBrowser } from '../NimBaseCommand'
const debug = makeDebug('nim:deployer:deploy-to-bucket')

// Open a "bucket client" (object of type Bucket) to use in deploying web resources to the bucket associated with the
// InitOptions.  The InitOptions should have been checked for sufficient information already.
export async function openBucketClient(credentials: Credentials, bucketSpec: BucketSpec): Promise<Bucket> {
    debug("bucket client open")
    let bucketName = computeBucketStorageName(credentials.ow.apihost, credentials.namespace)
    debug("computed bucket name %s", bucketName)
    let bucket = await makeClient(bucketName, credentials.storageKey)
    await addWebMeta(bucket, bucketSpec)
    return bucket
}

// Add web metadata after Bucket created but before returning it
function addWebMeta(bucket: Bucket, bucketSpec: BucketSpec): Promise<Bucket> {
    let mainPageSuffix = 'index.html'
    let notFoundPage = '404.html'
    if (bucketSpec) {
        if (bucketSpec.mainPageSuffix) {
            mainPageSuffix = bucketSpec.mainPageSuffix
        }
        if (bucketSpec.notFoundPage) {
            notFoundPage = bucketSpec.notFoundPage
        }
    }
    debug("Setting mainPageSuffix to %s and notFoundPage to %s", mainPageSuffix, notFoundPage)
    const website = { mainPageSuffix, notFoundPage }
    return bucket.setMetadata({ website }).then(() => bucket)
}

// Make a Bucket (client to access a bucket)
async function makeClient(bucketName: string, options: {}): Promise<Bucket> {
    debug("entered makeClient")
    const storage = new Storage(options)
    debug("made Storage handle")
    return storage.bucket(bucketName)
}

// Deploy a single resource to the bucket
export async function deployToBucket(resource: WebResource, client: Bucket, spec: BucketSpec, versions: VersionEntry,
        reader: ProjectReader, owOptions: OWOptions): Promise<DeployResponse> {
    // Determine if something will be uploaded or if that will be avoided due to a digest match in incremental mode
    // The 'versions' argument is always defined in incremental mode.
    const data = await reader.readFileContents(resource.filePath)
    const hash = crypto.createHash("sha256")
    hash.update(data)
    const digest = String(hash.digest('hex'))
    if (versions && versions.webHashes && versions.webHashes[resource.filePath] && versions.webHashes[resource.filePath] === digest) {
        const webHashes = {}
        webHashes[resource.filePath] = versions.webHashes[resource.filePath]
        const success: DeploySuccess = {name: resource.filePath, kind: "web", skipped: true }
        const response = { successes: [ success ], failures: [], ignored: [], actionVersions: {}, packageVersions: {}, webHashes, namespace: undefined }
        return Promise.resolve(response)
    } // else not incremental or no digest exists for this resource or digest does not match
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
    debug('original destination: %s', destination)
    destination = destination.replace(/\\/g, '/') // windows conventions don't work on the bucket
    debug('fixed up destination: %s', destination)
    // Setup parameters for the upload
    const metadata = { contentType: resource.mimeType }
    if (!spec || !spec.useCache) {
        metadata['cacheControl'] = 'no-cache'
    }
    // Upload.
    debug(`bucket save operation for %s with data of length %d and metadata %O`, resource.simpleName, data.length, metadata)
    // Get signed URL for the upload (the more direct file.save() doesn't work in a browser, nor does calling file.getSignedUrl()
    // directly.  We use an assistive action to acquire the signed URL.
    let phaseTracker: string[] = []
    try {
        await doUpload(owOptions, destination, data, phaseTracker)
        debug('save operation for %s was successful', resource.simpleName)
        phaseTracker[0] = 'setting metadata'
        const remoteFile = client.file(destination)
        await remoteFile.setMetadata(metadata)
        debug('metadata saving operation for %s was successful', resource.simpleName)
    } catch (err) {
        debug('an error occured: %O', err)
        return wrapError(err, `web resource '${resource.simpleName}' (${phaseTracker[0]})`)
    }
    const item = `https://${client.name}/${destination}`
    const response = wrapSuccess(item, "web", false, undefined, {}, undefined)
    response.webHashes = {}
    response.webHashes[resource.filePath] = digest
    debug('returning response %O', response)
    return response
}

// Subroutine to upload some data to a destination
async function doUpload(owOptions: OWOptions, destination: string, data: Buffer, phaseTracker: string[]) {
    phaseTracker[0] = 'getting signed URL'
    const owClient = openwhisk(owOptions)
    const urlResponse = await owClient.actions.invoke({
        name: '/nimbella/websupport/getSignedUrl',
        params: { fileName: destination },
        blocking: true,
        result: true
    })
    phaseTracker[0] = 'putting data to signed URL'
    const url = urlResponse.url
    if (!url) {
        throw new Error(`Response from getSignedUrl was not a URL: ${urlResponse}`)
    }
    const putres = await axios.put(url, data)
    if (putres.status !== 200) {
        throw new Error(`Bad response [$putres.status}] from storage server`)
    }
}

// Compute the actual name of a bucket as viewed by google storage
export function computeBucketStorageName(apiHost: string, namespace: string): string {
    return computeBucketDomainName(apiHost, namespace).split('.').join('-')
}

// Compute the external domain name corresponding to a web bucket
export function computeBucketDomainName(apiHost: string, namespace: string): string {
    const url = URL(apiHost)
    return namespace + '-' + url.hostname
}

// Clean the resources from a bucket starting at the root or at the prefixPath.
// Note: we use 'force' to make sure deletion is attempted for every file
// Note: we don't throw errors since cleaning the bucket is a "best effort" feature.
// Return (promise of) empty string on success, warning message if problems.
export async function cleanBucket(client: Bucket, spec: BucketSpec, owOptions: OWOptions): Promise<string> {
   let prefix = spec ? spec.prefixPath : undefined
   if (prefix && !prefix.endsWith('/')) {
       prefix += '/'
   }
   debug("Cleaning up old web content")
   const options = prefix ? { force: true, prefix } : { force: true }
   await client.deleteFiles(options).catch(() => {
       return Promise.resolve("Note: one or more old web resources could not be deleted")
   })
   if (!prefix) {
       return restore404Page(owOptions)
   } else {
       return ''
   }
}

// Restore the 404.html page after wiping the bucket
export async function restore404Page(owOptions: OWOptions): Promise<string> {
    let our404
    if (inBrowser) {
        our404 = require('../../404.html')
    } else {
        const file404 = require.resolve('../../404.html')
        our404 = fs.readFileSync(file404)
    }
    let phaseTracker: string[] = []
    try {
        await doUpload(owOptions, '404.html', our404, phaseTracker)
        return ''
    } catch (err) {
        debug(`while ${phaseTracker[0]}, got error ${err}`)
        return "Standard 404.html page could not be restored"
    }
}
