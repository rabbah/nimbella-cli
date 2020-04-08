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
import { RuntimeBaseCommand } from '@adobe/aio-cli-plugin-runtime'
const AioCommand: typeof RuntimeBaseCommand = require('@adobe/aio-cli-plugin-runtime/src/commands/runtime/action/invoke')

export default class ActionInvoke extends NimBaseCommand {
  async runCommand(rawArgv: string[], argv: string[], args: any, flags: any, logger: NimLogger) {
    // Ensure correct results in the workbench
    if (inBrowser) {
      this.debug('flags: %O', flags)
      // Impose oclif convention that boolean flags are really boolean, since action invoke logic depends on this.
      // Perhaps this should be done earlier since it represents a difference between kui and oclif.  Kui also
      // handles the '--no-' prefix differently: --no-wait will set --wait to false, not --no-wait to true.  On the
      // other hand, the abbreviation -n will indeed set --no-wait to true.
      flags.result == !!flags.result
      flags['no-wait'] = flags['no-wait'] || flags.wait === false
      // Also impose a different default (--full, rather than --result).
      flags.full = !flags.result && !flags['no-wait']
      this.debug('adjusted flags: %O', flags)
    }
    await this.runAio(rawArgv, argv, args, flags, logger, AioCommand)
  }

  static args = AioCommand.args

  // The template for parsing the flags is not changed for the browser because it is only used by oclif parsing
  // The browser inverts the flags by a special case in the usage model generator.
  static flags = AioCommand.flags

  static description = AioCommand.description
}
