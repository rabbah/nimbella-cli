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
import { getCredentialList, fileSystemPersister } from 'deployer/login'
import { CredentialRow } from 'deployer/deploy-struct'

// Constants used in formatting the credential list
const LIST_HEADER = 'Namespace            Current Storage API Host'
const NS_LEN = 21
const YES = '   yes  '
const NO = '    no  '

export default class AuthList extends Command {
  static description = 'List all your Nimbella Namespaces'

  static flags = {
  }

  static args = []

  async run() {
    const list = getCredentialList(fileSystemPersister)
    await this.formatCredentialList(list)
  }

  async formatCredentialList(credentialPromise: Promise<CredentialRow[]>) {
    //console.log("formatting credentials")
    return credentialPromise.then(credentialList => {
        console.log(LIST_HEADER)
        for (const row of credentialList) {
            const pad = ' '.repeat(NS_LEN - row.namespace.length)
            const curr = row.current ? YES : NO
            const stor = row.storage ? YES : NO
            this.log(row.namespace + pad + curr + stor + row.apihost)
        }
    })
  }
}
