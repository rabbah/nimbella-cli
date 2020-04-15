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
import { NimBaseCommand, NimLogger } from '../../NimBaseCommand'
import { openWorkbench } from '../../workbench'

// Command to open the workbench from the CLI or switch between preview and production workbench for the purpose of running a command
export default class WorkbenchRun extends NimBaseCommand {
  static description = "open the Nimbella Workbench and run a command there"

  static flags = { ...NimBaseCommand.flags,
    preview: flags.boolean({ description: 'open preview workbench', char: 'p' })
  }

  static args = [{ name: 'command', description: 'the command to run' }]
  static strict = false

  static aliases = [ 'wb:run' ]

  async runCommand(rawArgv: string[], argv: string[], args: any, flags: any, logger: NimLogger) {
    if (argv.length == 0) {
      this.doHelp()
    } else {
      const command = argv.join(' ')
      openWorkbench(command, !!flags.preview, logger)
    }
  }
}
