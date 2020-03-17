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
import { isGithubProvider, doOAuthFlow } from '../../oauth'

let cli

export default class AuthGithub extends NimBaseCommand {
  static description = 'manage github accounts'

  static flags = {
    add: flags.boolean({ char: 'a', description: 'add another github account with a different user name' }),
    delete: flags.string({ char: 'd', description: 'forget a previously added github account' }),
    initial: flags.boolean({ char: 'i', description: "add your github account if you didn't specify it earlier" }),
    list: flags.boolean({ char: 'l', description: 'list previously added github accounts'}),
    show: flags.string({ description: 'show the access token currently associated with a username' }),
    switch: flags.string({ char: 's', description: 'switch to using a particular previously added github account' }),
    token: flags.string({ description: 'the github token for adding an account', hidden: true }),
    username: flags.string({ description: 'the github username for adding an account', hidden: true }),
    ...NimBaseCommand.flags
  }

  static args = []
  static strict = false

  async runCommand(rawArgv: string[], argv: string[], args: any, flags: any, logger: NimLogger) {
    const flagCount = [ flags.add, flags.initial, flags.switch, flags.list, flags.delete, flags.show ].filter(Boolean).length
    if (flagCount > 1) {
      logger.handleError(`only one of '--add', '--initial', '--list', '--switch', '--delete', or '--show' may be specified`)
    } else if (flagCount == 1 && flags.token || flags.username) {
      logger.handleError(`--token and --username may not be combined with other flags`)
    } else if (flags.token && ! flags.username || flags.username && !flags.token) {
      logger.handleError(`--token and --username must both be specified if either one is specified`)
    }
    if (flags.switch) {
      await this.doSwitch(flags.switch, logger)
    } else if (flags.list) {
      await this.doList(logger)
    } else if (flags.add || flags.initial) {
      await this.doAdd(logger, flags.initial, undefined, undefined)
    } else if (flags.token && flags.username) {
      await this.doAdd(logger, false, flags.username, flags.token)
    } else if (flags.delete) {
        await this.doDelete(flags.delete, logger)
    } else if (flags.show) {
        await this.doShow(flags.show, logger)
    } else {
        this._help()
    }
  }

  // Add a github credential.  Called for --add, --initial, and the combination --username + --token
  async doAdd(logger: NimLogger, isInitial: boolean, name: string, token: string) {
    const store = await authPersister.loadCredentialStore()
    if (!store.github) {
        store.github = {}
    }
    if (name && token) {
      store.github[name] = token
      store.currentGithub = name
    } else if (isInitial && Object.keys(store.github).length > 0) {
      const list = Object.keys(store.github).join(', ')
      logger.log(`you already have github credentials: ${list}`)
      logger.log("Doing nothing.  Use '--add' if you really want to add more accounts")
      return
    } else {
      const authResponse = await doOAuthFlow(logger, true)
      if (isGithubProvider(authResponse)) {
        const warn = !isInitial && !!store.github[authResponse.name]
        name = authResponse.name
        store.github[name] = authResponse.key
        store.currentGithub = name
        if (warn) {
          logger.log(`You already had an entry for username '${authResponse.name}'.  It was replaced`)
        }
      } else {
        logger.handleError(`github authentication failed, response was '${authResponse}'`)
      }
    }
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

  async doShow(name: string, logger: NimLogger) {
    const store = await authPersister.loadCredentialStore()
    if (store.github && store.github[name]) {
        logger.log(store.github[name])
    } else {
        logger.handleError(`${name} is not a previously added github account`)
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
