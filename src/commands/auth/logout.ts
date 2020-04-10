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
import { NimBaseCommand, NimLogger, NimFeedback, parseAPIHost, authPersister } from '../../NimBaseCommand'
import { forgetNamespace } from '../../deployer/login'
import { disambiguateNamespace } from '../project/deploy'

export default class AuthLogout extends NimBaseCommand {
  static description = 'Drop access to a Nimbella namespace'

  static flags = {
    apihost: flags.string({ description: 'API host serving the namespace'}),
    ...NimBaseCommand.flags
  }

  static args = [{name: 'namespace', description: 'the namespace you are dropping', required: true}]

  async runCommand(rawArgv: string[], argv: string[], args: any, flags: any, logger: NimLogger) {
    const host = parseAPIHost(flags.apihost)
    const namespace = await disambiguateNamespace(args.namespace, host).catch(err => logger.handleError('', err))
    const creds = await forgetNamespace(namespace, host, authPersister, new NimFeedback(logger)).catch(err => logger.handleError('', err))
    logger.log(`Ok.  Removed the namespace '${namespace}' on host '${host}' from the credential store`)
    logger.log(`Successful logout from namespace '${namespace}' on API host '${creds.ow.apihost}'`)
  }
}
