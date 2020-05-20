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

import { NimBaseCommand, NimLogger, inBrowser } from '../../NimBaseCommand'
import { flags } from '@oclif/command'
import { RuntimeBaseCommand } from '@adobe/aio-cli-plugin-runtime'
const AioCommand: typeof RuntimeBaseCommand = require('@adobe/aio-cli-plugin-runtime/src/commands/runtime/action/create')

export default class ActionCreate extends NimBaseCommand {
  async runCommand(rawArgv: string[], argv: string[], args: any, flags: any, logger: NimLogger) {
    screenLegal(!!args.actionPath, flags, logger)
    await this.runAio(rawArgv, argv, args, flags, logger, AioCommand)
  }

  static args = AioCommand.args

  // Change description from what is in aio: log size limit is KB, not MB, and defaults should not be specified statically
  static flags = Object.assign({}, AioCommand.flags, {
    timeout: flags.integer({
     char: 't',
      description: 'Timeout LIMIT in milliseconds after which the Action is terminated'
    }),
    memory: flags.integer({
      char: 'm',
      description: 'Maximum memory LIMIT in MB for the Action'
    }),
    logsize: flags.integer({
      char: 'l',
      description: 'Maximum log size LIMIT in KB for the Action'
    })
  })

  static description = AioCommand.description
}

// Screen legality when running in the cloud
export function screenLegal(hasActionPath: boolean, flags: any, logger: NimLogger) {
  if (inBrowser && (hasActionPath || flags['annotation-file'] || flags['env-file'] || flags['param-file'])) {
    logger.handleError('command contains file system references and cannot run in the cloud')
  }
}
