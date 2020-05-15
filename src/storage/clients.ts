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

import { Storage } from '@google-cloud/storage'
import { getCredentials, getCredentialsForNamespace } from '../deployer/credentials';
import { computeBucketStorageName } from '../deployer/deploy-to-bucket';
import { Credentials } from '../deployer/deploy-struct';


async function getStorageClient(args: any, flags: any, authPersister: any, bucketPrefix: string = '') {
    let namespace = args.namespace
    let creds: Credentials = undefined
    let apiHost: string = flags.apihost;
    let storageKey: {} = undefined;
    if (!namespace) {
        creds = await getCredentials(authPersister);
        namespace = creds.namespace
    }
    else {
        creds = await getCredentialsForNamespace(namespace, flags.apihost, authPersister);
    }
    apiHost = creds.ow.apihost;
    storageKey = creds.storageKey;
    const bucketName = computeBucketStorageName(apiHost, namespace);
    if (!storageKey) {
        return { bucketName, storage: undefined, client: undefined };
    }
    const storage = new Storage(storageKey);
    const client = storage.bucket(bucketPrefix + bucketName);
    const ow = creds.ow;
    return { bucketName, storage, client, ow };
}

export async function getWebStorageClient(args: any, flags: any, authPersister: any) {
    return await getStorageClient(args, flags, authPersister);
}

export async function getObjectStorageClient(args: any, flags: any, authPersister: any) {
    return await getStorageClient(args, flags, authPersister, 'data-');
}
