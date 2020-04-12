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

const queryCommand = 'redis/llen'

export default class LLen extends NimBaseCommand {
    static description = 'Returns the length of the list stored at key.\
 If a key does not exist, it is interpreted as an empty list and 0 is returned.\
 An error is returned when the value stored at key is not a list.'

    static flags = {
        apihost: flags.string({ description: 'the API host of the namespace' }),
        ...NimBaseCommand.flags
    }

    static args = [{ name: 'key', description: 'the key to be queried for length', required: true}];

    static aliases = ['kv:llen']

    async runCommand(rawArgv: string[], argv: string[], args: any, flags: any, logger: NimLogger) {
        await  queryKVStore(queryCommand, args, flags, authPersister)
            .then(res => logger.log(res.value))
            .catch(err => logger.handleError(err.error,err));
    }
}
