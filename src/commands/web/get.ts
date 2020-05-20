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
import { getWebStorageClient } from '../../storage/clients'
import { existsSync } from 'fs';
import { join, basename } from 'path';
import { spinner } from '../../ui'
import { errorHandler } from '../../storage/util';

export default class WebContentGet extends NimBaseCommand {
    static description = 'Gets Content from the Web Storage'

    static flags = {
        apihost: flags.string({ description: 'API host of the namespace to get web content from' }),
        save: flags.boolean({ char: 's', description: 'Saves content on file system' }),
        saveAs: flags.string({ description: 'Saves content on file system with the given name' }),
        ...NimBaseCommand.flags
    }

    static args = [
        { name: 'webContentName', description: 'The web content to get', required: true },
        { name: 'destination', description: 'The location to write at', required: true, default: './' },
        { name: 'namespace', description: 'The namespace to get content from (current namespace if omitted)', required: false }
    ]

    async runCommand(rawArgv: string[], argv: string[], args: any, flags: any, logger: NimLogger) {
        const { client } = await getWebStorageClient(args, flags, authPersister);
        if (!client) logger.handleError(`Couldn't get to the web storage, ensure it's enabled for the ${args.namespace || 'current'} namespace`);
        await this.downloadFile(args.webContentName, args.destination, client, logger, flags.saveAs, flags.save).catch((err: Error) => logger.handleError('', err));
    }

    async downloadFile(webContentName: string, destination: string, client: Bucket, logger: NimLogger, saveAs: string, save: boolean = false) {
        if (!existsSync(destination)) {
            logger.log(`${destination} doesn't exist`)
            return
        }
        const loader = await spinner();
        loader.start(`getting ${webContentName}`, 'downloading', { stdout: true })
        if (save || saveAs) {
            const fileName = basename(webContentName)
            await client.file(webContentName).download({ destination: join(destination, (saveAs ? saveAs : fileName)) }).then(_ => loader.stop('done'));
        }
        else {
            client.file(webContentName).download(function (err, contents) {
                if (err) {
                    loader.stop(`couldn't print content`)
                    errorHandler(err, logger, webContentName);
                }
                else {
                    loader.stop()
                    logger.log('\n')
                    logger.log(String.fromCharCode.apply(null, contents))
                }
            });
        }
    }
}
