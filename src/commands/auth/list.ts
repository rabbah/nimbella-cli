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
import { getCredentialDict } from '../../deployer/credentials'
import { CredentialRow } from '../../deployer/deploy-struct'

// Constants used in formatting the credential list
const LIST_HEADER = '  Namespace            Current Storage   Redis Production Project'
const NS_LEN = 21
const YES = '   yes  '
const NO = '    no  '
const MAYBE = '   -?-  '

export default class AuthList extends NimBaseCommand {
  static description = 'List all your Nimbella namespaces'

  static flags = {
    ...NimBaseCommand.flags
  }

  static args = []

  async runCommand(rawArgv: string[], argv: string[], args: any, flags: any, logger: NimLogger) {
    const dict = await getCredentialDict(authPersister)
    if (Object.keys(dict).length === 1) {
      await this.formatCredentialList(Object.values(dict)[0], logger)
    } else {
      for (const host in dict) {
        const rows = dict[host]
        if (rows.length === 0) continue
        logger.log(`On API host ${host}:`)
        await this.formatCredentialList(dict[host], logger)
      }
    }
  }

  async formatCredentialList(credentialList: CredentialRow[], logger: NimLogger) {
    logger.log(LIST_HEADER)
    for (const row of credentialList) {
        let ns = row.namespace
        let pad = ''
        if (ns.length < NS_LEN) {
          pad = ' '.repeat(NS_LEN - ns.length)
        } else {
          ns = ns.slice(0, NS_LEN - 3) + '...'
        }
        const check = row.current ? (process && 'win32' === process.platform ? '\u221A ' : '\u2713 ') : '  '
        const curr = row.current ? YES : NO
        const stor = row.storage ? YES : NO
        const redis = row.redis ? YES : row.redis === false ? NO : MAYBE
        const production = row.production ? YES : NO
        const owner = row.project || '<any>'
        logger.log(check + ns + pad + curr + stor + redis + production + '   ' + owner)
    }
  }
}
