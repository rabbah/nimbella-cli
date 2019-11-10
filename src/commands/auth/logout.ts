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
import { forgetNamespace, fileSystemPersister } from 'deployer/login'
import { disambiguateNamespace } from '../project/deploy'

export default class AuthLogout extends NimBaseCommand {
  static description = 'Drop access to a Nimbella Namespace'

  static flags = {
    apihost: flags.string({ description: 'API host serving the namespace'}),
    ...NimBaseCommand.flags
  }

  static args = [{name: 'namespace', description: 'the namespace you are dropping', required: true}]

  async run() {
    const {args, flags} = this.parse(AuthLogout)

    const namespace = await disambiguateNamespace(args.namespace, flags.apihost)
    const creds = await forgetNamespace(namespace, flags.apihost, fileSystemPersister).catch(err => this.handleError(err.message, err))
    this.log(`Successful logout from namespace '${namespace}' on API host '${creds.ow.apihost}'`)
  }
}
