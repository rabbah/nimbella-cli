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

import { NimBaseCommand, NimLogger, authPersister } from '../../NimBaseCommand'
import { RuntimeBaseCommand } from '@adobe/aio-cli-plugin-runtime'
import { flags } from '@oclif/command'
const AioCommand: typeof RuntimeBaseCommand = require('@adobe/aio-cli-plugin-runtime/src/commands/runtime/package/delete')
import { getCredentials, wipePackage } from '../../deployer'

export default class PackageDelete extends NimBaseCommand {
  async runCommand(rawArgv: string[], argv: string[], args: any, flags: any, logger: NimLogger) {
    // Don't delegate the recursive case.  We handle it specially here
    if (flags.recursive) {
      this.debug('invoking recursive delete')
      await this.recursiveDelete(args, flags, logger)
    } else {
      // Usual delegation
      this.debug('usual delegation to aio')
      await this.runAio(rawArgv, argv, args, flags, logger, AioCommand)
    }
  }

  static args = AioCommand.args

  static flags = {
    recursive: flags.boolean({ description: 'delete the contained actions', char: 'r' }),
    // For some reason, aio's 'project delete' does not incorporate host and auth as is the usual practice with other commands
    apihost: flags.string({ description: 'whisk API host' }),
    auth: flags.string({ char: 'u', description: 'whisk auth' }),
   ...AioCommand.flags
  }

  static description = AioCommand.description

  // Recursive deletion
  async recursiveDelete(args: any, flags: any, logger: NimLogger) {
    const creds = await getCredentials(authPersister).catch(err => logger.handleError('', err))
    const auth = flags.auth || (creds ? creds.ow.api_key : undefined)
    const apihost = flags.apihost || (creds ? creds.ow.apihost : undefined)
    if (!auth || !apihost) {
      logger.handleError(`You must either have current namespace or else provide --auth and --apihost`)
    }
    const result = await wipePackage(args.packageName, apihost, auth)
    if (flags.json) {
      AioCommand.logJSON('', result)
    }
  }
}
