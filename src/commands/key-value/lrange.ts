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

const queryCommand = 'redis/lrange'

export default class LRange extends NimBaseCommand {
    static description = 'Returns the specified elements of the list stored at key.\
 The offsets start and stop are zero-based indexes, with 0 being the first element of the list,\
 1 being the next element and so on.'

    static flags = {
        apihost: flags.string({ description: 'the API host of the namespace to list keys from' }),
        key: flags.string({ char: 'k', description: 'the key to be queried' }),
        start: flags.string({ char: 's', description: 'the index to start' }),
        end: flags.string({ char: 'e', description: 'the index to stop' }),
        ...NimBaseCommand.flags
    }

    static args = [{ name: 'namespace', description: 'the namespace to perform operation in (current namespace if omitted)', required: false }]

    static aliases = ['kv:lrange']

    async runCommand(rawArgv: string[], argv: string[], args: any, flags: any, logger: NimLogger) {
        if (!flags.key || !Number.isInteger(flags.start) || !Number.isInteger(flags.end)) {
            logger.log('Please specify a non-empty key, numeric start and end')
            return;
        }
        await  queryKVStore(queryCommand, args, flags, authPersister)
            .then(res => {
                res.payload.forEach(element => {
                    logger.log(element);
                });
            })
            .catch(err => logger.handleError(err.message,err));
    }
}
