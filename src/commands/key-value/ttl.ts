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

const queryCommand = 'redis/ttl'

export default class Ttl extends NimBaseCommand {
    static description = 'Get ttl value for a Key';

    static flags = {
        apihost: flags.string({ description: 'the API host of the namespace to list keys from' }),
        ...NimBaseCommand.flags
    }

    static args = [{ name: 'key', description: 'the key for which ttl value is to be retrieved', required: true}];

    static aliases = ['kv:ttl'];

    async runCommand(rawArgv: string[], argv: string[], args: any, flags: any, logger: NimLogger) {
        await queryKVStore(queryCommand, args, flags, authPersister)
            .then(res => logger.log(res.value))
            .catch(err => logger.handleError(err.error,err));
    }
}
