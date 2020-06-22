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
import { authPersister, NimBaseCommand, NimLogger } from '../../NimBaseCommand'
import { getObjectStorageClient } from '../../storage/clients'
import { errorHandler } from '../../storage/util'

export default class ObjectUrl extends NimBaseCommand {
    static description = 'Generates Signed URL for an Object in the Object Store'

    static flags = {
        apihost: flags.string({ description: 'API host of the namespace to get object URL from' }),
        permission: flags.string({ char: 'p', description: 'Permission applicable on the URL', options: ['read', 'write'], default: 'read' }),
        ttl: flags.integer({ char: 't', description: 'Expiration time of the URL (in Minutes)', default: 15 }),
        ...NimBaseCommand.flags
    }

    static args = [
        { name: 'objectName', description: 'The object to get URL for', required: true },
        { name: 'namespace', description: 'The namespace to get object from (current namespace if omitted)', required: false }
    ]

    async runCommand(rawArgv: string[], argv: string[], args: any, flags: any, logger: NimLogger) {
        const { client } = await getObjectStorageClient(args, flags, authPersister);
        if (!client) logger.handleError(`Couldn't get to the object store, ensure it's enabled for the ${args.namespace || 'current'} namespace`);

        try {
            const file = await client.file(args.objectName)
            const expiration = flags.ttl * 60 * 1000
            const options = {
                version: 'v4',
                action: flags.permission,
                expires: Date.now() + expiration
            }
            if (flags.permission === 'write')
                options['contentType'] = 'application/octet-stream'
            const [url] = await file.getSignedUrl(options)
            logger.log(url)
            return
        } catch (e) {
            errorHandler(e, logger, args.objectName)
        }
    }
}
