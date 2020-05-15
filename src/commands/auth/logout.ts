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
import { getCredentials, forgetNamespace } from '../../deployer/credentials'
import { disambiguateNamespace } from '../project/deploy'
import { prompt } from '../../ui'

export default class AuthLogout extends NimBaseCommand {
  static description = 'Drop access to a Nimbella namespace'

  static flags = {
    apihost: flags.string({ description: 'API host serving the namespace'}),
    ...NimBaseCommand.flags
  }

  static args = [{name: 'namespace', description: 'the namespace you are dropping', required: false}]

  async runCommand(rawArgv: string[], argv: string[], args: any, flags: any, logger: NimLogger) {
    let host = parseAPIHost(flags.apihost)
    if (host && args.namespace === undefined) {
      // what does it mean to logout from current namespace while specifying the api host? reject this.
      logger.handleError(`Cannot specify an API host without also specifying the namespace.`)
      return
    }

    if (!args.namespace) {
      const creds = await getCredentials(authPersister).catch(err => logger.handleError('', err))
      const ans = await prompt(`Type 'yes' to logout '${creds.namespace}' namespace on API host '${creds.ow.apihost}'`)
      if (ans !== 'yes') {
        logger.log('Doing nothing.')
        return;
      } else {
        host = creds.ow.apihost
        args.namespace = creds.namespace
      }
    }

    const namespace = await disambiguateNamespace(args.namespace, host).catch(err => logger.handleError('', err))
    const creds = await forgetNamespace(namespace, host, authPersister, new NimFeedback(logger)).catch(err => logger.handleError('', err))
    logger.log(`Ok.  Removed the namespace '${namespace}' on host '${creds.ow.apihost}' from the credential store`)
    logger.log(`Successful logout from namespace '${namespace}' on API host '${creds.ow.apihost}'`)
  }
}
