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

import { Bucket } from '@google-cloud/storage'
import { flags } from '@oclif/command'
import { authPersister, NimBaseCommand, NimLogger } from '../../NimBaseCommand'
import { getObjectStorageClient } from '../../storage/clients'
import { existsSync } from 'fs';
import { join } from 'path';
import { spinner } from '../../ui'

export default class ObjectGet extends NimBaseCommand {
    static description = 'Gets Object from the Object Store'

    static flags = {
        apihost: flags.string({ description: 'the API host of the namespace to get object from' }),
        ...NimBaseCommand.flags
    }

    static args = [
        { name: 'objectName', description: 'the object to get', required: true },
        { name: 'destination', description: 'the location to write object at', required: true, default: './' },
        { name: 'namespace', description: 'the namespace to get object from (current namespace if omitted)', required: false }
    ]

    async runCommand(rawArgv: string[], argv: string[], args: any, flags: any, logger: NimLogger) {
        const { client } = await getObjectStorageClient(args, flags, authPersister);
        if (!client) logger.handleError(`Couldn't get to the object store, ensure it's enabled for the ${args.namespace || 'current'} namespace`);
        await this.downloadFile(args.objectName, args.destination, client, logger).catch((err: Error) => logger.handleError('', err));
    }

    async downloadFile(objectName: string, destination: string, client: Bucket, logger: NimLogger) {
        if (!existsSync(destination)) {
            logger.log(`${destination} doesn't exist`)
            return
        }
        const loader = await spinner();
        loader.start(`getting ${objectName}`, 'downloading', { stdout: true })
        await client.file(objectName).download({ destination: join(destination, objectName) }).then(_ => { loader.stop('done') });
    }
}
