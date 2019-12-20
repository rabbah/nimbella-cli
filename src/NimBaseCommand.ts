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

// Some behavior of this class was initially populated from RuntimeBaseCommand.js in
// aio-cli-plugin-runtime (translated to TypeScript), govened by the following license:

/*
Copyright 2019 Adobe Inc. All rights reserved.
This file is licensed to you under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License. You may obtain a copy
of the License at http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software distributed under
the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR REPRESENTATIONS
OF ANY KIND, either express or implied. See the License for the specific language
governing permissions and limitations under the License.
*/

import { Command, flags } from '@oclif/command'
import { IArg } from '@oclif/parser/lib/args'
import * as Errors from '@oclif/errors'
import { RuntimeBaseCommand } from '@adobe/aio-cli-plugin-runtime'
import * as createDebug  from 'debug'
import { format } from 'util'
import { fileSystemPersister, browserPersister } from './deployer/login';

const debug = createDebug('nimbella-cli')

// Flag indicating running in browser
export const inBrowser = (typeof process === 'undefined') || (!process.release) || (process.release.name !== 'node')
// The persister to use for all auth code
export const authPersister = inBrowser ? browserPersister : fileSystemPersister

// Common behavior expected by runCommand implementations ... abstracts some features of
// oclif.Command.  The NimBaseCommand class implements this interface using its own
// methods
export interface NimLogger {
  log: (msg: string, ...args: any[]) => void
  handleError: (msg: string, err?: Error) => never
  exit: (code: number) => void  // don't use 'never' here because 'exit' doesn't always exit
  displayError: (msg: string, err?: Error) => void
}

// Print function type
type LinePrinter = (s:any) => any
type TableHandler = (data: object[], columns: object, options?: object) => void

// An alternative NimLogger when not using the oclif stack
class CaptureLogger implements NimLogger {
    captured: string[] = []
    log(msg = '', ...args: any[]) {
      this.captured.push(format(msg, ...args))
    }
    handleError(msg: string, err?: Error): never {
      if (err) throw err
      msg = improveErrorMsg(msg, err)
      throw new Error(msg)
    }
    displayError(msg: string, err?: Error) {
      msg = improveErrorMsg(msg, err)
      Errors.error(msg, { exit: false })
    }
    exit(code: number) {
      // a no-op here
    }
}

// The base for all our commands, including the ones that delegate to aio.  There are methods designed to be called from the
// kui repl as well as ones that implement the oclif command model.
export abstract class NimBaseCommand extends Command  implements NimLogger {
  // Superclass must implement for dual invocation by kui and oclif
  abstract runCommand(argv: string[], args: any, flags: any, logger: NimLogger): Promise<any>

  // Generic oclif run() implementation.   Parses and then invokes the abstract runCommand method
  async run() {
    const { argv, args, flags } = this.parse(this.constructor as typeof NimBaseCommand)
    await this.runCommand(argv, args, flags, this)
  }

  // Helper used in the runCommand methods of aio shim classes to modify logger behavior and fix up credentials prior
  // to invoking an aio-sourced command.  Not used by Nimbella-sourced command classes.
  // When running under node / normal oclif, the 'logger' is the class itself, so the change to table should
  // have no effect.   Storing the parsed arguments will also have no effect (because the real oclif parse method
  // will parse all over again).   When running under kui / dummy oclif, the 'logger' will be a capture logger and
  // the dummy command class has an implementation of parse that returns the already parsed material.
  async runAio(argv: string[], args: any, flags: any, logger: NimLogger, aioClass: typeof RuntimeBaseCommand) {
    fixAioCredentials()
    const cmd = new aioClass([], {})
    cmd.table = this.tableHandler(cmd.table, this.makePrinter(logger))
    cmd.parsed = { argv, args, flags }
    await cmd.run()
  }

  // Replacement for RuntimeBaseCommand.table, which is just a funnel-point for calls to cli.table in cli-ux
  // Uses a logger for output
  tableHandler = (table: TableHandler, printLine: LinePrinter) => (data: object[], columns: object, options: object = {}) => {
    const modOptions = Object.assign({}, options, { printLine })
    table(data, columns, modOptions)
  }

  // Initialization helper for tableHandler
  makePrinter = (logger: NimLogger) => (r: any) => logger.log(String(r))

  // Generic kui runner.  Unlike run(), this gets partly pre-parsed input and doesn't do a full oclif parse.
  // It also uses the CaptureLogger so it can return the output as an array of text lines.   The 'argTemplates'
  // argument is the static args member of the concrete subclass of this class that is being dispatched to.
  // It is passed in as a convenience since it is clearer code to grab it at the call site where the class
  // identity is manifest
  async dispatch(argv: string[], argTemplates: IArg<string>[], flags: any): Promise<string[]> {
    // Duplicate oclif's args parsing conventions.  The flags have already been parsed in kui
    if (!argTemplates) {
      argTemplates = []
    }
    const args = {} as any
    for (let i = 0; i < argv.length; i++) {
      args[argTemplates[i].name] = argv[i]
    }
    // Make a capture logger and run the command
    const logger = new CaptureLogger()
    await this.runCommand(argv, args, flags, logger)
    debug('captured result: %O', logger.captured)
    return logger.captured
  }

  // Do oclif initialization (only used when invoked via the oclif dispatcher)
  async init () {
    const { flags } = this.parse(this.constructor as typeof NimBaseCommand)

    // See https://www.npmjs.com/package/debug for usage in commands
    if (flags.verbose) {
      // verbose just sets the debug filter to everything (*)
      createDebug.enable('*')
    } else if (flags.debug) {
      createDebug.enable(flags.debug)
    }
  }

  // Error handling.  This is for oclif; the CaptureLogger has a more generic implementation suitable for kui inclusion
  handleError (msg: string, err?: any) {
    this.parse(this.constructor as typeof NimBaseCommand)
    msg = improveErrorMsg(msg, err)
    debug(err)
    msg = msg + '\n specify --verbose flag for more information'
    return this.error(msg, { exit: 1 })
  }

  // For non-terminal errors.  The CaptureLogger has a simpler equivalent.
  displayError (msg: string, err?: any) {
    this.parse(this.constructor as typeof NimBaseCommand)
    msg = improveErrorMsg(msg, err)
    debug(err)
    return this.error(msg, { exit: false })
  }

  static args = []
  static flags = {
    debug: flags.string({ description: 'Debug level output' }),
    verbose: flags.boolean({ char: 'v', description: 'Verbose output' }),
    help: flags.boolean({ description: 'Show help' })
  }
}

// Improves an error message based on analyzing the accompanying Error object (based on similar code in RuntimeBaseCommand)
function improveErrorMsg(msg: string, err?: any): string {
    if (err && err.name === 'OpenWhiskError' && err.error && err.error.error) {
        msg = "[OpenWhisk] " + err.error.error
    }
    return msg
}

// Utility to parse the value of an --apihost flag, permitting certain abbreviations
export function parseAPIHost (host: string|undefined): string|undefined {
  if (!host) {
    return undefined
  }
  if (host.includes(':')) {
    return host
  }
  if (host.includes('.')) {
    return 'https://' + host
  }
  if (!host.startsWith('api')) {
    host = 'api' + host
  }
  return 'https://' + host + ".nimbella.io"
}


// Purge the process environment of entries that match __OW_*.   These are not attempting to influence 'nim' because
// we specifically document that that doesn't work.  If they are there at all they are strays from some other usage but
// they can do mischief via their effect on the node client.
export function cleanEnvironment() {
    for (const item in process.env) {
        if (item.startsWith('__OW_')) {
            delete process.env[item]
        }
    }
}

// Stuff the current namespace, API host, and AUTH key into the environment so that AIO does not look in .wskprops when invoked by nim
export function fixAioCredentials() {
    let store = authPersister.loadCredentialStoreIfPresent()
    let currentHost: string
    let currentNamespace: string
    let currentAuth: string
    if (store) {
        currentHost = store.currentHost
        currentNamespace = store.currentNamespace
    } else {
        // No credential store (brand new user who's never done a login?).   Not much we can do, other than using our default API host in place of AIO's
        currentHost = 'https://apigcp.nimbella.io'
    }
    if (store && currentHost && currentNamespace) {
        const creds = store.credentials[currentHost][currentNamespace]
        if (creds) {
            currentAuth = creds.api_key
        } else {
            debug(`Error retrieving credentials for '${currentNamespace}' on host '${currentHost}'`)
        }
    }
    process.env.AIO_RUNTIME_APIHOST = currentHost
    process.env.AIO_RUNTIME_AUTH = currentAuth
    process.env.AIO_RUNTIME_NAMESPACE = currentNamespace
}
