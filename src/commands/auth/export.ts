/*
 * Copyright (c) 2019 - present Nimbella Corp.
 *
 * This file is licensed to you under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License. You may obtain a copy
 * of the License at http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software distributed under
 * the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR REPRESENTATIONS
 * OF ANY KIND, either express or implied. See the License for the specific language
 * governing permissions and limitations under the License.
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
