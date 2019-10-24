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

import {Command, flags} from '@oclif/command'
import { forgetNamespace, fileSystemPersister } from 'deployer/login'

export default class AuthLogout extends Command {
  static description = 'Drop access to a Nimbella Namespace'

  static flags = {
    apihost: flags.string({ description: 'API host serving the namespace'})
  }

  static args = [{name: 'namespace', description: 'the namespace you are dropping', required: true}]

  async run() {
    const {args, flags} = this.parse(AuthLogout)

    const namespace = args.namespace
    const creds = await forgetNamespace(namespace, flags.apihost, fileSystemPersister).catch(err => this.error(err))
    this.log(`Successful logout from namespace '${namespace}' on API host '${creds.ow.apihost}'`)
  }
}
