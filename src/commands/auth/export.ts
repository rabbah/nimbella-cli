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

import { NimBaseCommand, NimLogger, authPersister, parseAPIHost, disambiguateNamespace } from '../../NimBaseCommand'
import { flags } from '@oclif/command'
import { getCredentials, getCredentialsForNamespace } from '../../deployer/credentials'
import { getCredentialsToken } from '../../oauth'

export default class AuthExport extends NimBaseCommand {
  static description = 'Make a token for switching to another machine or web browser'

  static flags = {
    apihost: flags.string({ description: 'API host serving the namespace'}),
    ...NimBaseCommand.flags
  }

  static args = [ { name: 'namespace', description: 'The namespace to export (omit for current namespace)', required: false } ]



  async runCommand(rawArgv: string[], argv: string[], args: any, flags: any, logger: NimLogger) {
    const host = parseAPIHost(flags.apihost)
    let namespace: string
    if (args.namespace) {
        namespace = await disambiguateNamespace(args.namespace, host).catch(err => logger.handleError('', err))
    }
    const creds = await (namespace ? getCredentialsForNamespace(namespace, host, authPersister) :
        getCredentials(authPersister)).catch(err => logger.handleError('', err))
    const token = await getCredentialsToken(creds.ow, logger)
    logger.log(`The following token encodes credentials for namespace '${creds.namespace}' on host '${creds.ow.apihost}'`)
    logger.log('It may be used with `nim auth login` within the next five minutes')
    logger.log(token)
  }
}
