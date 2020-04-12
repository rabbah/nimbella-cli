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

const queryCommand = 'redis/del'

export default class DeleteKey extends NimBaseCommand {
    static description = 'Removes the specified keys and returns number of keys that were removed. A key is ignored if it does not exist.'
    static flags = {
        apihost: flags.string({ description: 'the API host of the namespace' }),
        ...NimBaseCommand.flags
    }

    static args = [{ name: 'key', description: 'the key to be deleted', required: true }]

    static aliases = ['kv:del']

    async runCommand(rawArgv: string[], argv: string[], args: any, flags: any, logger: NimLogger) {
        await queryKVStore(queryCommand, args, flags, authPersister)
            .then(res => logger.log(res.value))
            .catch(err => logger.handleError(err.error,err));
    }
}
