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

const queryCommand = 'redis/getMany'

export default class GetMany extends NimBaseCommand {
    static description = 'Gets values for given Keys'

    static flags = {
        apihost: flags.string({ description: 'API host of the namespace to list keys from' }),
        ...NimBaseCommand.flags
    }

    static args = [
        { name: 'keyPrefix', description: 'The key for which value is to be retrieved' },
        { name: 'startIndex', description: 'The index to start at' },
        { name: 'count', description: 'The count to run to from start' }
    ];

    static aliases = ['kv:getMany', 'kv:getmany']

    async runCommand(rawArgv: string[], argv: string[], args: any, flags: any, logger: NimLogger) {
        await queryKVStore(queryCommand, args, flags, authPersister)
            .then(res => {
                res.value.forEach(element => {
                    logger.log(element);
                });
            })
            .catch(err => logger.handleError(err.error, err));
    }
}
