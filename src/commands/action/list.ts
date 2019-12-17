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

import { NimBaseCommand, NimLogger } from '../../NimBaseCommand'
import { RuntimeBaseCommand } from '@adobe/aio-cli-plugin-runtime'
const AioCommand: typeof RuntimeBaseCommand = require('@adobe/aio-cli-plugin-runtime/src/commands/runtime/action/list')

export default class ActionList extends NimBaseCommand {
  async runCommand(argv: string[], args: any, flags: any, logger: NimLogger) {
    await this.runAio(argv, args, flags, logger, AioCommand)
  }

  static args = AioCommand.args

  static flags = AioCommand.flags

  static description = AioCommand.description
}
