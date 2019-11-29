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

import { NimBaseCommand } from '../../NimBaseCommand'
import { getCredentialList, fileSystemPersister } from '../../deployer/login'
import { CredentialRow } from '../../deployer/deploy-struct'

// Constants used in formatting the credential list
const LIST_HEADER = 'Namespace            Current Storage   Redis API Host'
const NS_LEN = 21
const YES = '   yes  '
const NO = '    no  '
const MAYBE = '   -?-  '

export default class AuthList extends NimBaseCommand {
  static description = 'List all your Nimbella Namespaces'

  static flags = {
    ...NimBaseCommand.flags
  }

  static args = []

  async run() {
    const list = getCredentialList(fileSystemPersister)
    await this.formatCredentialList(list)
  }

  async formatCredentialList(credentialPromise: Promise<CredentialRow[]>) {
    //console.log("formatting credentials")
    return credentialPromise.then(credentialList => {
        this.log(LIST_HEADER)
        for (const row of credentialList) {
            let ns = row.namespace
            let pad = ''
            if (ns.length < NS_LEN) {
              pad = ' '.repeat(NS_LEN - ns.length)
            } else {
              ns = ns.slice(0, NS_LEN - 3) + '...'
            }
            const curr = row.current ? YES : NO
            const stor = row.storage ? YES : NO
            const redis = row.redis ? YES : row.redis === false ? NO : MAYBE
            this.log(ns + pad + curr + stor + redis + row.apihost)
        }
    }).catch((err: Error) => this.handleError(err.message, err))
  }
}
