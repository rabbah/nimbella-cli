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
import { authPersister, NimBaseCommand, NimLogger } from '../../NimBaseCommand'
import { getObjectStorageClient } from '../../storage/clients'

export default class ObjectDelete extends NimBaseCommand {
    static description = 'Deletes Object from the Object Store'

    static flags = {
        apihost: flags.string({ description: 'API host of the namespace to delete object from' }),
        ...NimBaseCommand.flags
    }

    static args = [
        { name: 'objectName', description: 'The object to be deleted', required: true },
        { name: 'namespace', description: 'The namespace to delete object from (current namespace if omitted)', required: false }
    ]

    async runCommand(rawArgv: string[], argv: string[], args: any, flags: any, logger: NimLogger) {
        const { client } = await getObjectStorageClient(args, flags, authPersister);
        if (!client) logger.handleError(`Couldn't get to the object store, ensure it's enabled for the ${args.namespace || 'current'} namespace`);
        await this.deleteFile(args.objectName, client, logger).catch((err: Error) => logger.handleError('', err));
    }

    async deleteFile(objectName: string, client: Bucket, logger: NimLogger) {
        const loader = await spinner();
        loader.start(`searching ${objectName}`, 'deleting', { stdout: true })
        await client.file(objectName).delete().then(_ => loader.stop('done'));
    }
}
