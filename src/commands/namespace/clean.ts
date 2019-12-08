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
import { NimBaseCommand } from '../../NimBaseCommand'
import { cli } from 'cli-ux'
import { getCredentialsForNamespace, fileSystemPersister } from '../../deployer/login'
import { wipeNamespace } from '../../deployer/api'
import { computeBucketName, cleanBucket } from '../../deployer/deploy-to-bucket'
import { Storage } from '@google-cloud/storage'

export default class NamespaceClean extends NimBaseCommand {
     static description = 'Remove content from a namespace'

     static flags = {
        justwhisk: flags.boolean({ description: 'Remove only OpenWhisk entitities, leaving other content'}),
        force: flags.boolean({ description: 'just do it, omitting confirmatory prompt'}),
        apihost: flags.string({ description: 'the API host of the namespace to be cleaned'}),
        auth: flags.string({char: 'u', description: 'the API key for the namespace to be cleaned'}),
        ...NimBaseCommand.flags
     }

     static args = [{name: 'namespace', description: 'the namespace to clean', required: true}]

     async run() {
        const { args, flags } = this.parse(NamespaceClean)
        if (!flags.force) {
            const ow = flags.justwhisk ? " openwhisk" : ""
            const ans = await cli.prompt(`Type 'yes' to remove all${ow} content from namespace '${args.namespace}'`)
            if (ans !== 'yes') {
                this.log('Doing nothing')
                return
            }
        }
        let auth: string
        let apihost: string
        let storageKey: {}
        if (flags.auth && flags.apihost) {
            // Bypass credential fetching (used by `nimadmin` when cleaning up a namespace)
            auth = flags.auth
            apihost = flags.apihost
            storageKey = undefined
        } else {
            const creds = await getCredentialsForNamespace(args.namespace, flags.apihost, fileSystemPersister)
            auth = creds.ow.api_key
            apihost = creds.ow.apihost
            storageKey = creds.storageKey
        }
        await wipeNamespace(apihost, auth)
        this.log(`OpenWhisk entities removed from namespace '${args.namespace}' on host '${apihost}'`)
        if (flags.justwhisk || !storageKey) {
            return
        }
        const bucketName = computeBucketName(apihost, args.namespace)
        const storage = new Storage(storageKey)
        const client = storage.bucket(bucketName)
        await cleanBucket(client, undefined)
        this.log(`Web content removed from https://${bucketName}`)
     }
}
