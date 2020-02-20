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
import { NimBaseCommand, NimLogger, authPersister } from '../../NimBaseCommand'

let cli

export default class AuthGithub extends NimBaseCommand {
  static description = 'manage github access tokens'

  static flags = {
    name: flags.string({ description: `the name for a new token (defaults to 'default')`}),
    list: flags.boolean({ description: 'list the available tokens'}),
    switch: flags.string({ description: 'switch to using a particular token by name'}),
    ...NimBaseCommand.flags
  }

  static args = [{name: 'token', description: 'a github personal access token', required: false}]

  async runCommand(rawArgv: string[], argv: string[], args: any, flags: any, logger: NimLogger) {
    if (flags.name && flags.switch || flags.name && flags.list || flags.switch && flags.list) {
        logger.handleError(`only one of '--name', '--switch', or '--list' may be specified`)
    }
    if (flags.name && !args.token) {
        logger.handleError('no token value was specified')
    }
    if (args.token && (flags.switch || flags.list)) {
        logger.handleError(`a token value cannot accompany '--list' or '--switch'`)
    }
    if (args.token) {
        await this.doAdd(args.token, flags.name || 'default', logger)
    } else if (flags.switch) {
        await this.doSwitch(flags.switch, logger)
    } else if (flags.list) {
        await this.doList(logger)
    } else {
        this._help()
    }
  }

  async doAdd(token: string, name: string, logger: NimLogger) {
    const store = await authPersister.loadCredentialStore()
    if (!store.github) {
        store.github = {}
    }
    if (store.github[name]) {
        if (!cli) {
            cli = require('cli-ux').cli
        }
        const ans = await cli.prompt(`${name} is already in use.  Type 'yes' to confirm replacement'`)
        if (ans !== 'yes') {
            logger.log('Doing nothing')
            return
        }
    }
    store.github[name] = token
    store.currentGithub = name
    authPersister.saveCredentialStore(store)
    logger.log(`a github token was added for name '${name}' and is now current`)
  }

  async doSwitch(name: string, logger: NimLogger) {
    const store = await authPersister.loadCredentialStore()
    if (store.github && store.github[name]) {
        store.currentGithub = name
        authPersister.saveCredentialStore(store)
        logger.log(`the github token with name '${name}' is now current`)
    } else {
        logger.handleError(`${name} does not denote a known github token`)
    }
  }

  async doList(logger: NimLogger) {
    const store = await authPersister.loadCredentialStore()
    if (store.github) {
        const list = Object.keys(store.github).join(', ')
        logger.log(`registered github tokens: ${list}`)
    } else {
        logger.log(`no registered github tokens`)
    }
  }
}

