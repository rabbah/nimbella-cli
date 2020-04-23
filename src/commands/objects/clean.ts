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
import { prompt } from '../../ui'

export default class ObjectClean extends NimBaseCommand {
    static description = 'Deletes all objects from the Object Store'

    static flags = {
        apihost: flags.string({ description: 'the API host of the namespace to delete objects from' }),
        force: flags.boolean({ char: 'f', description: 'just do it, omitting confirmatory prompt' }),
        ...NimBaseCommand.flags
    }

    static args = [
        { name: 'namespace', description: 'the namespace to delete objects from (current namespace if omitted)', required: false }
    ]

    async runCommand(rawArgv: string[], argv: string[], args: any, flags: any, logger: NimLogger) {
        if (!flags.force) {
            const ans = await prompt(`Type yes to remove all objects from Object Store`);
            if (ans !== 'yes') {
                logger.log('doing nothing');
                return;
            }
        }
        const { client } = await getObjectStorageClient(args, flags, authPersister);
        if (!client) logger.handleError(`Couldn't get to the object store, ensure it's enabled for the ${args.namespace || 'current'} namespace`);
        await this.cleanup(client, logger).catch((err: Error) => logger.handleError('', err));
    }

    async cleanup(client: Bucket, logger: NimLogger) {
        const loader = await spinner();
        loader.start(`deleting objects`, '', { stdout: true })
        await client.deleteFiles().then(_ => loader.stop('done'));
    }
}
