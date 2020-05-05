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

import { flags } from '@oclif/command'
import { NimBaseCommand, NimLogger, authPersister, parseAPIHost } from '../../NimBaseCommand'
import { getCredentialsForNamespace, getCredentials } from '../../deployer/login'
import { wipeNamespace } from '../../deployer/api'
import { computeBucketStorageName, cleanBucket } from '../../deployer/deploy-to-bucket'
import { Credentials } from '../../deployer/deploy-struct'
import { Storage } from '@google-cloud/storage'
import { prompt } from '../../ui'

export default class NamespaceClean extends NimBaseCommand {
     static description = 'Remove content from a namespace'

     static flags = {
        justwhisk: flags.boolean({ description: 'Remove only OpenWhisk entities, leaving other content'}),
        force: flags.boolean({ description: 'just do it, omitting confirmatory prompt'}),
        apihost: flags.string({ description: 'the API host of the namespace to be cleaned'}),
        auth: flags.string({char: 'u', description: 'the API key for the namespace to be cleaned'}),
        ...NimBaseCommand.flags
     }

     static args = [{name: 'namespace', description: 'the namespace to clean (current namespace if omitted)', required: false}]

    async runCommand(rawArgv: string[], argv: string[], args: any, flags: any, logger: NimLogger) {
        let namespace = args.namespace
        let creds: Credentials = undefined
        if (!namespace) {
            creds = await getCredentials(authPersister).catch(err => logger.handleError('', err))
            namespace = creds.namespace
        }
        if (!flags.force) {
            const ow = flags.justwhisk ? " openwhisk" : ""
            const ans = await prompt(`Type '${namespace}' to remove all${ow} content from namespace '${namespace}'`)
            if (ans !== namespace) {
                logger.log('Doing nothing.')
                return
            }
        }
        let auth: string
        let apihost: string
        let storageKey: {}
        if (flags.auth && flags.apihost) {
            // Bypass credential fetching (used by `nimadmin` when cleaning up a namespace)
            auth = flags.auth
            apihost = parseAPIHost(flags.apihost)
            storageKey = undefined
        } else {
            if (!creds) {
                creds = await getCredentialsForNamespace(namespace, parseAPIHost(flags.apihost), authPersister)
                    .catch(err => logger.handleError('', err))
            }
            auth = creds.ow.api_key
            apihost = creds.ow.apihost
            storageKey = creds.storageKey
        }
        await wipeNamespace(apihost, auth)
        logger.log(`OpenWhisk entities removed from namespace '${namespace}' on host '${apihost}'`)
        if (flags.justwhisk || !storageKey) {
            return
        }
        const bucketName = computeBucketStorageName(apihost, namespace)
        const storage = new Storage(storageKey)
        const client = storage.bucket(bucketName)
        const msg = await cleanBucket(client, undefined)
        if (msg) {
            logger.log(msg)
        }
        logger.log(`Web content removed from https://${bucketName}`)
     }
}
