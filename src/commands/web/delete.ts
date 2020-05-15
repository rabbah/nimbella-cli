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
import { getWebStorageClient } from '../../storage/clients'

export default class WebContentDelete extends NimBaseCommand {
    static description = 'Deletes Content from the Web Storage'

    static flags = {
        apihost: flags.string({ description: 'the API host of the namespace to delete web content from' }),
        ...NimBaseCommand.flags
    }

    static args = [
        { name: 'webContentName', description: 'the web content to be deleted', required: true },
        { name: 'namespace', description: 'the namespace to delete content from (current namespace if omitted)', required: false }
    ]

    async runCommand(rawArgv: string[], argv: string[], args: any, flags: any, logger: NimLogger) {
        const { client } = await getWebStorageClient(args, flags, authPersister);
        if (!client) logger.handleError(`Couldn't get to the web storage, ensure it's enabled for the ${args.namespace || 'current'} namespace`);
        await this.deleteFile(args.webContentName, client, logger).catch((err: Error) => logger.handleError('', err));
    }

    async deleteFile(webContentName: string, client: Bucket, logger: NimLogger) {
        const loader = await spinner();
        loader.start(`searching ${webContentName}`, 'deleting', { stdout: true })
        await client.file(webContentName).delete().then(_ => loader.stop('done'));
    }
}
