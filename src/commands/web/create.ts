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
import { existsSync, lstatSync } from 'fs';
import { authPersister, NimBaseCommand, NimLogger } from '../../NimBaseCommand'
import { getWebStorageClient } from '../../storage/clients'

export default class WebContentCreate extends NimBaseCommand {
    static description = 'Adds Content to the Web Storage'

    static flags = {
        apihost: flags.string({ description: 'the API host of the namespace to add content to' }),
        ...NimBaseCommand.flags
    }

    static args = [
        { name: 'webContentPath', description: 'path to the content to be added', required: true },
        { name: 'namespace', description: 'the namespace to add content to (current namespace if omitted)', required: false }
    ]

    static aliases = ['web:add'];

    async runCommand(rawArgv: string[], argv: string[], args: any, flags: any, logger: NimLogger) {
        const { client } = await getWebStorageClient(args, flags, authPersister);
        if (!client) logger.handleError(`Couldn't get to the web storage, ensure it's enabled for the ${args.namespace || 'current'} namespace`);
        await this.uploadFile(args.webContentPath, client, logger).catch((err: Error) => logger.handleError('', err));
    }

    async uploadFile(webContentPath: string, client: Bucket, logger: NimLogger) {
        if (!existsSync(webContentPath)){
            logger.log(`${webContentPath} doesn't exist`)
            return
        }
        if (!lstatSync(webContentPath).isFile()) {
            logger.log(`${webContentPath} is not a valid file`)
            return
        }
        const loader = await spinner();
        const contentName = basename(webContentPath);
        loader.start(`adding ${contentName}`, 'uploading', {stdout: true})
        await client.upload(webContentPath, {
            gzip: true
        }).then(_ => loader.stop('done'));
    }
}
