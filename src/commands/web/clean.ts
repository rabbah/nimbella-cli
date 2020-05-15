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
import { prompt } from '../../ui'
import { restore404Page } from '../../deployer/deploy-to-bucket'
import { OWOptions } from '../../deployer/deploy-struct'

export default class WebContentClean extends NimBaseCommand {
    static description = 'Deletes all Content from Web Storage'

    static flags = {
        apihost: flags.string({ description: 'the API host of the namespace to delete content from' }),
        force: flags.boolean({ char: 'f', description: 'just do it, omitting confirmatory prompt' }),
        ...NimBaseCommand.flags
    }

    static args = [
        { name: 'namespace', description: 'the namespace to delete web content from (current namespace if omitted)', required: false }
    ]

    async runCommand(rawArgv: string[], argv: string[], args: any, flags: any, logger: NimLogger) {
        if (!flags.force) {
            const ans = await prompt(`Type 'yes' to remove all content from web storage`);
            if (ans !== 'yes') {
                logger.log('Doing nothing.');
                return;
            }
        }
        const { client, ow } = await getWebStorageClient(args, flags, authPersister);
        if (!client) logger.handleError(`Couldn't get to the web storage, ensure it's enabled for the ${args.namespace || 'current'} namespace`);
        await this.cleanup(client, ow, logger).catch((err: Error) => logger.handleError('', err));
    }

    async cleanup(client: Bucket, ow: OWOptions, logger: NimLogger) {
        const loader = await spinner();
        loader.start(`deleting web content`, '', { stdout: true })
        await client.deleteFiles().then(_ => restore404Page(ow)).then(_ => loader.stop('done')).catch(e => logger.handleError('', e));
    }
}
