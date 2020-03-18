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
import { prompt } from '../../ui'

const queryCommand = 'redis/flush'
export default class Flush extends NimBaseCommand {
  static description = 'Clears the Key Value Store, be cautious!'

  static flags = {
    apihost: flags.string({ description: 'the API host of the namespace' }),
    force: flags.boolean({ char:'f', description: 'just do it, omitting confirmatory prompt' }),
    ...NimBaseCommand.flags
  }


  static args = [{ name: 'namespace', description: 'the namespace to perform operation in (current namespace if omitted)', required: false }]

  static aliases = ['kv:flush']

  async runCommand(rawArgv: string[], argv: string[], args: any, flags: any, logger: NimLogger) {

    if (!flags.force) {
      const ans = await prompt(`Type yes to remove all content from Key-Value Store`)
      if (ans !== 'yes') {
        logger.log('Doing nothing')
        return
      }
    }
    await queryKVStore(queryCommand, args, flags, authPersister)
      .then(res => logger.log(res.value))
      .catch(err => logger.handleError(err.error, err));
  }
}
