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
import { Credentials, WebResource, DeployResponse, DeploySuccess, BucketSpec, VersionEntry } from './deploy-struct'
import { wrapSuccess, wrapError } from './util';

import * as path from 'path'
import * as fs from 'fs'
import * as crypto from 'crypto'
import * as URL from 'url-parse'

// Open a "bucket client" (object of type Bucket) to use in deploying web resources to the bucket associated with the
// InitOptions.  The InitOptions should have been checked for sufficient information already.
export function openBucketClient(credentials: Credentials, bucketSpec: BucketSpec): Promise<Bucket> {
    //console.log("bucket client open")
    const bucketName = computeBucketName(credentials.ow.apihost, credentials.namespace)
    //console.log("computed bucket name")
    return makeClient(bucketName, credentials.storageKey).then(bucket => addWebMeta(bucket, bucketSpec))
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
    //console.log("Setting mainPageSuffix to", mainPageSuffix, "and notFoundPage to", notFoundPage)
    const website = { mainPageSuffix, notFoundPage }
    return bucket.setMetadata({ website }).then(() => bucket)
}

// Make a Bucket (client to access a bucket)
function makeClient(bucketName: string, options: {}): Promise<Bucket> {
        //console.log("entered makeClient")
        const storage = new Storage(options)
        //console.log("made Storage handle")
        const bucket = storage.bucket(bucketName)
        //console.log("made Bucket handle")
        return bucket.exists().then(() => bucket)
}

// Deploy a single resource to the bucket
export function deployToBucket(resource: WebResource, client: Bucket, spec: BucketSpec, versions: VersionEntry): Promise<DeployResponse> {
    // Determine if something will be uploaded or if that will be avoided due to a digest match in incremental mode
    // The 'versions' argument is only defined in incremental mode
    const data = fs.readFileSync(resource.filePath)
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
    //console.log('original destination', destination)
    destination = destination.replace(/\\/g, '/') // windows conventions don't work on the bucket
    //console.log('fixed up destination', destination)
    // Upload
    return client.upload(resource.filePath, { destination }).then(() => {
        const item = `https://${client.name}/${destination}`
        const response = wrapSuccess(item, "web", false, undefined, {}, undefined)
        response.webHashes = {}
        response.webHashes[resource.filePath] = digest
        return response
    }).catch(err => {
        return wrapError(err, `web resource '${resource.simpleName}'`)
    })
}

// Compute the bucket name by adjoining the namespace to the host name portion of apiHost, separated by a dash.
// The namespace is obtained from the OW credentials by querying the controller.
export function computeBucketName(apiHost: string, namespace: string): string {
    const url = URL(apiHost)
    return namespace + '-' + url.hostname
}

// Clean the resources from a bucket starting at the root or at the prefixPath.
// Note: we use 'force' to make sure deletion is attempted for every file
// Note: we don't throw errors since cleaning the bucket is a "best effort" feature.
export async function cleanBucket(client: Bucket, spec: BucketSpec) {
   let prefix = spec ? spec.prefixPath : undefined
   if (prefix && !prefix.endsWith('/')) {
       prefix += '/'
   }
   //console.log("Cleaning up old web content")
   const old404 = prefix ? undefined : await get404Page(client)
   const options = prefix ? { force: true, prefix } : { force: true }
   await client.deleteFiles(options).catch(() => {
       console.log("Note: one or more old web resources could not be deleted")
       return Promise.resolve(undefined)
   })
   if (old404) {
       return restore404Page(client, old404)
   }
}

// Read the 404.html page from the bucket prior to clearing at the root so it can be restored
function get404Page(client: Bucket): Promise<Buffer[]> {
    return client.file('404.html').download()
}

// Restore the 404.html page after wiping the bucket
function restore404Page(client: Bucket, old404: Buffer[]) {
    return client.file('404.html').save(old404[0])
}
