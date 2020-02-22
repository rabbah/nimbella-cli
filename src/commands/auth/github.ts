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
import * as Octokit from '@octokit/rest'

let cli

export default class AuthGithub extends NimBaseCommand {
  static description = 'manage github accounts'

  static flags = {
    add: flags.string({ description: 'the user name of a github account to be added'}),
    list: flags.boolean({ description: 'list previously added github accounts'}),
    switch: flags.string({ description: 'switch to using a particular previously added github account'}),
    delete: flags.string({ description: 'forget a previously added github account'}),
    ...NimBaseCommand.flags
  }

  static args = []

  async runCommand(rawArgv: string[], argv: string[], args: any, flags: any, logger: NimLogger) {
    const flagCount = [ flags.add, flags.switch, flags.list, flags.delete ].filter(Boolean).length
    if (flagCount > 1) {
        logger.handleError(`only one of '--add', '--list', '--switch', or '--delete' may be specified`)
    }
    if (flags.switch) {
        await this.doSwitch(flags.switch, logger)
    } else if (flags.list) {
        await this.doList(logger)
    } else if (flags.add) {
        await this.doAdd(flags.add, logger)
    } else if (flags.delete) {
        await this.doDelete(flags.delete, logger)
    } else {
        this._help()
    }
  }

  async doAdd(name: string, logger: NimLogger) {
    const store = await authPersister.loadCredentialStore()
    if (!store.github) {
        store.github = {}
    }
    if (store.github[name]) {
        if (!cli) {
            cli = require('cli-ux').cli
        }
        const ans = await cli.prompt(`${name} is already registered.  Type 'yes' to re-do the registration'`)
        if (ans !== 'yes') {
            logger.log('Doing nothing')
            return
        }
    }
    const token = await getGitHubToken(name, this.config.userAgent, logger)
    store.github[name] = token
    store.currentGithub = name
    authPersister.saveCredentialStore(store)
    logger.log(`the github account of user name '${name}' was added and is now current`)
  }

  async doSwitch(name: string, logger: NimLogger) {
    const store = await authPersister.loadCredentialStore()
    if (store.github && store.github[name]) {
        store.currentGithub = name
        authPersister.saveCredentialStore(store)
        logger.log(`the github account of user name '${name}' is now current`)
    } else {
        logger.handleError(`${name} is not a previously added github account`)
    }
  }

  async doList(logger: NimLogger) {
    const store = await authPersister.loadCredentialStore()
    if (store.github) {
        const list = Object.keys(store.github).join(', ')
        logger.log(`previously added github accounts: ${list}`)
    } else {
        logger.log(`no previously added github accounts`)
    }
  }

  async doDelete(name: string, logger: NimLogger) {
    const store = await authPersister.loadCredentialStore()
    if (store.github && store.github[name]) {
        delete store.github[name]
        if (name == store.currentGithub) {
            store.currentGithub = undefined
        }
        authPersister.saveCredentialStore(store)
        logger.log(`the github account of user name '${name}' is removed from the credential store`)
        if (!store.currentGithub) {
            logger.log(`'${name}' was the current account; use 'nim auth github [ --add | --switch ] to establish a new one`)
        }
    } else {
        logger.handleError(`${name} does not denote a previously added github account`)
    }
  }
}

async function getGitHubToken(username: string, userAgent: string, logger: NimLogger) {
  const opts = {
      userAgent,
      note: 'nimbella-cli-gh-auth',
      scopes: [ 'repo' ]
  }

  async function promptForOTP() {
    return await cli.prompt(`Enter the GitHub OTP/2FA Code for username '${username}'`, { type: 'hide' })
  }

  if (!cli) {
      cli = require('cli-ux').cli
  }

  const password = await cli.prompt(`Enter the GitHub password for username '${username}'`)

  const octokit = new Octokit({
    auth: {
      username,
      password,
      async on2fa() {
        return promptForOTP()
      }
    },
    log: {
        debug: () => {},
        info: () => {},
        warn: () => {},
        error: logger.handleError
    }
  })

  let response = await octokit.oauthAuthorizations.createAuthorization({
    note: opts.note + ' (' + new Date().toJSON() + ')',
    note_url: 'https://nimbella.io',
    scopes: opts.scopes,
    headers: {
      'User-Agent': opts.userAgent
    }
  })

  if (response.data.token) {
    return response.data.token
  } else {
    const error = new Error('Github authentication failed')
    error['response'] = response
    logger.handleError(error.message, error)
  }
}

