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
import { flags } from '@oclif/command'
import { getCredentials } from '../../deployer/credentials'
import { computeBucketDomainName } from '../../deployer/deploy-to-bucket'

export default class AuthInspect extends NimBaseCommand {
  static description = 'Get current namespace with optional details'

  static flags = {
    name: flags.boolean({ description: 'Show namespace name' }),
    apihost: flags.boolean({ description: 'Show API host' }),
    auth: flags.boolean({ description: 'Show API key' }),
    web: flags.boolean({ description: 'Show web domain (if available)' }),
    storage: flags.boolean({ description: 'Show storage status' }),
    redis: flags.boolean({ description: 'Show redis status' }),
    project: flags.boolean({ description: 'Show owning project' }),
    production: flags.boolean({ description: 'Show production status' }),
    all: flags.boolean({ description: 'Show all fields' }),
    ...NimBaseCommand.flags
  }

  static args = [ ]

  async runCommand(rawArgv: string[], argv: string[], args: any, flags: any, logger: NimLogger) {
    let { all, name, apihost, auth, web, storage, redis, project , production } = flags
    if (all) {
        name = apihost = auth = web = storage = redis = project  = production = true
    } else if (!apihost && !auth && !web && !storage && !redis && !project  && !production) {
        name = true
    }
    const creds = await getCredentials(authPersister).catch(err => logger.handleError('', err))
    const ans: { name?: string, apihost?: string, auth?: string, web?: string, storage?: boolean, redis?: boolean, project?: string, production?: boolean } = {}
    if (name) {
        ans.name = creds.namespace
    }
    if (apihost) {
        ans.apihost = creds.ow.apihost
    }
    if (auth) {
        ans.auth = creds.ow.api_key
    }
    if (web) {
        if (!!creds.storageKey) {
            ans.web = `https://${computeBucketDomainName(creds.ow.apihost, creds.namespace)}`
        } else {
            ans.web = 'Not available, upgrade your account.'
        }
    }
    if (storage) {
        ans.storage = !!creds.storageKey
    }
    if (redis) {
        ans.redis = creds.redis
    }
    if (project) {
        ans.project = creds.project
    }
    if (production) {
        ans.production = creds.production
    }
    if (Object.keys(ans).length == 1) {
        logger.log(String(Object.values(ans)[0]))
    } else {
        logger.log(JSON.stringify(ans, null, 2))
    }
  }
}
