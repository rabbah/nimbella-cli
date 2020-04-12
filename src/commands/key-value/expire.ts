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

const queryCommand = 'redis/expire'

export default class Expire extends NimBaseCommand {
    static description = 'Sets the specified ttl value for the specified key'

    static flags = {
        apihost: flags.string({ description: 'the API host of the namespace' }),
        ...NimBaseCommand.flags
    }

    static args = [
        { name: 'key', description: 'the key to be added at', required: true },
        { name: 'ttl', description: 'the ttl value to be set', required: true }
    ];

    static aliases = ['kv:expire'];

    async runCommand(rawArgv: string[], argv: string[], args: any, flags: any, logger: NimLogger) {
        if (isNaN(args.ttl)) {
            logger.log('Please specify a numeric value for ttl');
            return;
        }
        await queryKVStore(queryCommand, args, flags, authPersister)
            .then(res => logger.log(res.value))
            .catch(err => logger.handleError(err.error, err));
    }
}
