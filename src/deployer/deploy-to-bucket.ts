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
import { Credentials, WebResource, DeployResponse, DeploySuccess, BucketSpec, VersionEntry, ProjectReader } from './deploy-struct'
import { wrapSuccess, wrapError } from './util';

import * as path from 'path'
import * as crypto from 'crypto'
import * as URL from 'url-parse'
import * as makeDebug from 'debug'
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
        reader: ProjectReader): Promise<DeployResponse> {
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
    // Upload.  We _deliberately_ do this in two steps (yes, I know there is a one-step way).  The reason is that the
    // one-step way fails mysteriously when run in the cloud.
    const remoteFile = client.file(destination)
    debug(`bucket save operation for %s with data of length %d and metadata %O`, resource.simpleName, data.length, metadata)
    // Specify resumable explicitly to avoid spurious fs call to retrieve config when running in the cloud
    await remoteFile.save(data, { resumable: false }).catch(err => {
        debug('error during bucket save operation: %O', err)
        return wrapError(err, `storing web resource '${resource.simpleName}'`)
    })
    debug('save operation for %s was successful', resource.simpleName)
    await remoteFile.setMetadata(metadata).catch(err => {
        debug('error during bucket setMetadata operation: %O', err)
        return wrapError(err, `setting web resource metadata for '${resource.simpleName}'`)
    })
    debug('setMetaData operation for %s was successful', resource.simpleName)
    const item = `https://${client.name}/${destination}`
    const response = wrapSuccess(item, "web", false, undefined, {}, undefined)
    response.webHashes = {}
    response.webHashes[resource.filePath] = digest
    debug('returning response %O', response)
    return response
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
export async function cleanBucket(client: Bucket, spec: BucketSpec): Promise<string> {
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
       return restore404Page(client)
   } else {
       return ''
   }
}

// Restore the 404.html page after wiping the bucket
async function restore404Page(client: Bucket): Promise<string> {
    const our404 = require.resolve('../../404.html')
    await client.upload(our404, { destination: '404.html'}).catch(() => {
        return Promise.resolve("Standard 404.html page could not be restored")
    })
    return ''
}
