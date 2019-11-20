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
import { NimBaseCommand } from '../../NimBaseCommand'
import { doLogin, fileSystemPersister, addCredentialAndSave } from '../../deployer/login'
import { Credentials } from '../../deployer/deploy-struct'

export default class AuthLogin extends NimBaseCommand {
  static description = 'Gain access to a Nimbella namespace'

  static flags = {
    apihost: flags.string({ description: 'API host to use for authentication'}),
    auth: flags.string({ char: 'u', description: 'API key to use for authentication' }),
    ...NimBaseCommand.flags
  }

  static args = [{name: 'token', description: 'string provided by Nimbella Corp', required: false}]

  async run() {
    const {args, flags} = this.parse(AuthLogin)
    let credentials: Credentials
    let apihost: string
    if (flags.auth && flags.apihost && !args.token) {
      apihost = this.parseAPIHost(flags.apihost)
      credentials = await addCredentialAndSave(apihost, flags.auth, undefined, fileSystemPersister)
        .catch((err: Error) => this.handleError(err.message, err))
    } else if (args.token) {
      apihost = this.parseAPIHost(flags.apihost) || 'https://apigcp.nimbella.io'
      credentials = await doLogin(args.token, fileSystemPersister, apihost).catch((err: Error) => this.handleError(err.message, err))
    } else {
      this.handleError("A login token is required unless both --auth and --apihost are specified")
    }
    this.log(`Successful login to namespace '${credentials.namespace}' on host '${apihost}'`)
  }
}
