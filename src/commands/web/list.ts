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
import { NimBaseCommand, NimLogger, authPersister } from '../../NimBaseCommand'
import { getWebStorageClient } from '../../storage/clients'
import { Bucket } from '@google-cloud/storage'


// Constants used in formatting the file list
const LIST_HEADER = 'Name                                Generation     '
const FN_LEN = 35
const MAYBE = '    -?-         '

export default class WebList extends NimBaseCommand {
    static description = 'Lists Web Content'

    static flags = {
        apihost: flags.string({ description: 'the API host of the namespace to list web content from' }),
        ...NimBaseCommand.flags
    }

    static args = [{ name: 'namespace', description: 'the namespace to list web content from (current namespace if omitted)', required: false }]

    async runCommand(rawArgv: string[], argv: string[], args: any, flags: any, logger: NimLogger) {
        const { bucketName, client } = await getWebStorageClient(args, flags, authPersister);
        await this.listFiles(client, logger).catch((err: Error) => logger.handleError(err.message, err));
        logger.log(`Web content listed from ${bucketName}`);
    }

    async listFiles(client: Bucket, logger: NimLogger): Promise<void> {
        const [files] = await client.getFiles();

        logger.log(LIST_HEADER)
        for (const file of files) {
            let fn = file.name;
            let pad = ''
            if (fn.length < FN_LEN) {
                pad = ' '.repeat(FN_LEN - fn.length)
            } else {
                fn = fn.slice(0, FN_LEN - 3) + '...'
            }
            const generation = file.generation ? file.generation : MAYBE
            logger.log(fn + pad + generation );
        }
    }
}
