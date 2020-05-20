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
import { spinner } from '../../ui'
import { basename } from 'path';
import { existsSync } from 'fs';
import { authPersister, NimBaseCommand, NimLogger } from '../../NimBaseCommand'
import { getObjectStorageClient } from '../../storage/clients'

export default class ObjectCreate extends NimBaseCommand {
    static description = 'Adds Object to the Object Store'

    static flags = {
        apihost: flags.string({ description: 'API host of the namespace to add object to' }),
        ...NimBaseCommand.flags
    }

    static args = [
        { name: 'objectPath', description: 'The object to be added', required: true },
        { name: 'namespace', description: 'The namespace to add object to (current namespace if omitted)', required: false }
    ]

    static aliases = ['objects:add'];

    async runCommand(rawArgv: string[], argv: string[], args: any, flags: any, logger: NimLogger) {
        const { client } = await getObjectStorageClient(args, flags, authPersister);
        if (!client) logger.handleError(`Couldn't get to the object store, ensure it's enabled for the ${args.namespace || 'current'} namespace`);
        await this.uploadFile(args.objectPath, client, logger).catch((err: Error) => logger.handleError('', err));
    }

    async uploadFile(objectPath: string, client: Bucket, logger: NimLogger) {
        if (!existsSync(objectPath)){
            logger.log(`${objectPath} doesn't exist`)
            return
        }
        const loader = await spinner();
        const objectName = basename(objectPath);
        loader.start(`adding ${objectName}`, 'uploading', {stdout: true})
        await client.upload(objectPath, {
            gzip: true
        }).then(_ => loader.stop('done'));
    }
}
