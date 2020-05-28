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
import { getCredentials, forgetNamespace, getCredentialList } from '../../deployer/credentials'
import { disambiguateNamespace } from '../project/deploy'
import { prompt } from '../../ui'

export default class AuthLogout extends NimBaseCommand {
  static description = 'Drop access to a Nimbella namespace'

  static flags = {
    apihost: flags.string({ description: 'API host serving the namespace(s)'}),
    all: flags.boolean({ description: 'log out of all namespaces (or, all on the given API host)'}),
    ...NimBaseCommand.flags
  }

  static args = [{name: 'namespace', description: 'The namespace(s) you are dropping', required: false}]
  static strict = false

  static aliases = ['logout']

  async runCommand(rawArgv: string[], argv: string[], args: any, flags: any, logger: NimLogger) {
    if (flags.all && argv.length > 0) {
      logger.handleError(`Cannot combine the '--all' flag with explicit namespace names`)
    }
    let host = parseAPIHost(flags.apihost)
    if (host && argv.length === 0 && !flags.all) {
      // what does it mean to logout from current namespace while specifying the api host? reject this.
      logger.handleError(`Cannot specify an API host without also specifying the namespace or the '--all' flag.`)
    }

    // Process the --all case
    if (flags.all) {
      return this.logoutAll(host, logger)
    }

    // Process logout from current namespace (with prompt)
    if (argv.length === 0) {
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

    // Individual logout for one or more namespaces by name
    for (const ns of argv) {
      const namespace = await disambiguateNamespace(ns, host).catch(err => logger.handleError('', err))
      await this.doLogout(namespace, host, logger)
    }
  }

  // Do logout of a namespace, with messages.  Note: the messages seem redundent but this is mostly to avoid breaking some existing tests.  We can
  // clean it up but then expect to have to fix the tests.
  async doLogout(namespace: string, host: string, logger: NimLogger) {
      const creds = await forgetNamespace(namespace, host, authPersister, new NimFeedback(logger)).catch(err => logger.handleError('', err))
      logger.log(`Ok.  Removed the namespace '${namespace}' on host '${creds.ow.apihost}' from the credential store`)
      logger.log(`Successful logout from namespace '${namespace}' on API host '${creds.ow.apihost}'`)
  }

  // Logout of 'all' namespaces (possibly qualified by API host)
  async logoutAll(host: string, logger: NimLogger) {
    // Issue prompt, being especially dire if API host is not specified
    const context = host ? `all namespaces on API host ${host}` : `all namespaces, leaving you with no namespaces`
    const ans = await prompt(`Type 'yes' to logout ${context}`)
    if (ans !== 'yes') {
        logger.log('Doing nothing.')
        return;
    }
    let all = await getCredentialList(authPersister)
    if (host) {
      all = all.filter(row => row.apihost === host)
    }
    for (const row of all) {
      await this.doLogout(row.namespace, row.apihost, logger)
    }
  }
}
