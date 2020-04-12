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
import { getCredentials, getCredentialsForNamespace } from '../deployer/login';
import { Credentials } from '../deployer/deploy-struct';

const openwhisk = require('openwhisk');
const systemNamespace = 'nimbella';

export async function queryKVStore(query: string, args: any, flags: any, authPersister: any) {
    let namespace = args.namespace;
    let creds: Credentials = undefined;
    if (!namespace) {
        creds = await getCredentials(authPersister);
        namespace = creds.namespace;
    }
    else {
        creds = await getCredentialsForNamespace(namespace, flags.apihost, authPersister);
    }
    if (!creds) { return; }
    if (!creds.redis) { throw new Error('Key-Value Store not enabled for namespace: ' + namespace); }
    const ow = openwhisk(creds.ow);
    return ow.actions.invoke({ actionName: `/${systemNamespace}/${query}`, blocking: true, result: true, params: args });
}
