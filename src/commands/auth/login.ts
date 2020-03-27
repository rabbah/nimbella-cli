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
import { NimBaseCommand, NimLogger, parseAPIHost, authPersister } from '../../NimBaseCommand'
import { doLogin, doAdminLogin, doInteractiveLogin, addCredentialAndSave } from '../../deployer/login'
import { doOAuthFlow, isFullCredentials } from '../../oauth'
import { Credentials } from '../../deployer/deploy-struct'

export default class AuthLogin extends NimBaseCommand {
  static description = 'Gain access to a Nimbella namespace'

  static flags = {
    apihost: flags.string({ description: 'API host to use for authentication'}),
    auth: flags.string({ char: 'u', description: 'API key to use for authentication' }),
    admin: flags.boolean({ hidden: true }),
    namespace: flags.string({ hidden: true }),
    ...NimBaseCommand.flags
  }

  static args = [{name: 'token', description: 'string provided by Nimbella Corp', required: false}]

  async runCommand(rawArgv: string[], argv: string[], args: any, flags: any, logger: NimLogger) {
    let credentials: Credentials
    const apihost = parseAPIHost(flags.apihost) || (flags.admin ? undefined : 'https://apigcp.nimbella.io')
    if (args.token) {
      if (flags.auth) {
        logger.handleError('You cannot specify both a login token and an auth key.  Use one or the other')
      }
      if (flags.admin || flags.namespace) {
        logger.handleError("Internal error: incorrect use of administrative flags")
      }
      credentials = await doLogin(args.token, authPersister, apihost).catch((err: Error) => this.handleError(err.message, err))
    } else if (flags.admin) {
      if (flags.auth || flags.namespace || !apihost) {
        logger.handleError("Internal error: incorrect use of administrative flags")
      }
      credentials = await doAdminLogin(apihost).catch(err => this.handleError(err.message, err))
    } else if (flags.auth) {
      // Low level login: set 'allowReplace' to false to guard against an overwrite that loses storage or redis.  An exception to this
      // is when the (hidden) namespace flag is provided.  This is to enable low level logins by nimadmin when doing a deploy.
      credentials = await addCredentialAndSave(apihost, flags.auth, undefined, false, authPersister, flags.namespace, !!flags.namespace)
        .catch((err: Error) => logger.handleError(err.message, err))
      logger.log(`Stored a credential set for namespace '${credentials.namespace}' and API host '${credentials.ow.apihost}'`)
      authPersister.saveLegacyInfo(apihost, flags.auth)
    } else if (flags.apihost) {
      logger.handleError("The --apihost flag can only be used in conjunction with --auth or a login token")
    } else {
      const response = await doOAuthFlow(logger, false).catch(err => logger.handleError(err.message, err))
      if (isFullCredentials(response)) {
        credentials = await doInteractiveLogin(response, authPersister).catch(err => logger.handleError(err.message, err))
      } else {
        logger.handleError(`Login failed.  Response was '${response}'`)
      }
    }
    logger.log(`Stored a credential set for namespace '${credentials.namespace}' on host '${apihost}'`)
  }
}
