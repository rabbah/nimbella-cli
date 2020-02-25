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
import { queryKVStore } from '../../storage/key-value'

const queryCommand = 'redis/get'

export default class Get extends NimBaseCommand {
    static description = 'Get Value for a Key'

    static flags = {
        apihost: flags.string({ description: 'the API host of the namespace to list keys from' }),
        key: flags.string({ char: 'k', description: 'the key for which value is to be retrieved' }),
        ...NimBaseCommand.flags
    }

    static args = [{ name: 'namespace', description: 'the namespace to perform operation in (current namespace if omitted)', required: false }]

    static aliases = ['kv:get']

    async runCommand(rawArgv: string[], argv: string[], args: any, flags: any, logger: NimLogger) {
        if (!flags.key) {
            logger.log('Please specify a non-empty key')
            return;
        }
        await queryKVStore(queryCommand, args, flags, authPersister)
            .then(res => logger.log(res.payload))
            .catch(err => logger.handleError(err.message,err));
    }
}
