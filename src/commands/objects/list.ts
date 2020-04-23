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
import { fileMetaLong, fileMetaShort } from '../../storage/util'

export default class ObjectsList extends NimBaseCommand {
    static description = 'Lists Objects from Object Store'

    static flags = {
        apihost: flags.string({ description: 'the API host of the namespace to list web content from' }),
        long: flags.boolean({ char: 'l', description: 'displays additional object info such as last update, owner and md5hash' }),
        ...NimBaseCommand.flags
    }

    static args = [
        { name: 'prefix', description: 'prefix to match objects against', required: false, default: '' },
        { name: 'namespace', description: 'the namespace to list objects from (current namespace if omitted)', required: false }
    ]

    async runCommand(rawArgv: string[], argv: string[], args: any, flags: any, logger: NimLogger) {
        const { client } = await getObjectStorageClient(args, flags, authPersister);
        if (!client) logger.handleError(`Couldn't get to the object store, ensure it's enabled for the ${args.namespace || 'current'} namespace`);
        await this.listFiles(client, logger, flags.long, args.prefix).catch((err: Error) => logger.handleError('', err));
    }

    async listFiles(client: Bucket, logger: NimLogger, isLongFormat: boolean, prefix: string): Promise<void> {
        const [files] = await client.getFiles({
            prefix: prefix,
        });
        if (files.length === 0) { return logger.log(`No object available ${prefix ? `matching prefix '${prefix}'` : ''}`); }
        if (isLongFormat) {
            await fileMetaLong(files, client, logger).catch(err => logger.handleError(err))
        }
        else {
            await fileMetaShort(files, client, logger).catch(err => logger.handleError(err))
        }
    }
}
