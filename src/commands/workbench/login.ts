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

import * as WorkbenchRun from './run'
import { NimBaseCommand, NimLogger, authPersister } from '../../NimBaseCommand'
import { openWorkbench } from '../../workbench'
import { getCredentials } from '../../deployer'
import { getCredentialsToken } from '../../oauth'

// Command to open the workbench from the CLI or switch between preview and production workbench for the purpose of transferring credentials
export default class WorkbenchLogin extends NimBaseCommand {
  static description = "open the Nimbella Workbench, logging in with current credentials"

  static flags = WorkbenchRun.default.flags

  static args = []

  static aliases = [ 'wb:login' ]

  async runCommand(rawArgv: string[], argv: string[], args: any, flags: any, logger: NimLogger) {
    const creds = await getCredentials(authPersister)
    const token = await getCredentialsToken(creds.ow, logger)
    const command = `auth login ${token}`
    openWorkbench(command, !!flags.preview, logger)
  }
}
