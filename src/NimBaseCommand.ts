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

// A simplified version of RuntimeBaseCommand.js from aio-cli-plugin-runtime (translated to TypeScript)
// The aio plugins are covered by the following copyright:

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
import * as createDebug  from 'debug'
import { format } from 'util'

const debug = createDebug('nimbella-cli')

// Common behavior expected by runCommand implementations ... abstracts some features of
// oclif.Command.
export interface NimLogger {
  log: (msg: string, args?: any[]) => void
  handleError: (msg: string, err?: Error) => never
  exit: (code: number) => void  // don't use never here because exit doesn't exit under kui
  displayError: (msg: string, err?: Error) => void
}

// An alternative NimLogger when not using the oclif stack
class CaptureLogger implements NimLogger {
    captured: string[] = []
    log(msg: string, args?: any[]) {
      this.captured.push(format(msg, ...args))
    }
    handleError(msg: string, err?: Error): never {
      if (err) throw err
      throw new Error(msg)
    }
    displayError(msg: string, err?: Error) {
      // TODO: should we do better than this?
      this.log(msg)
    }
    exit(code: number) {
      // a no-op
    }
}

// The base for all our commands, including the ones that delegate to aio.  There are methods designed to be called from the
// kui repl as well as ones that implement the oclif command model.
export abstract class NimBaseCommand extends Command  implements NimLogger {
  // Superclass must implement for dual invocation by kui and oclif
  abstract runCommand(argv: string[], args: any, flags: any, logger: NimLogger)

  // Generic oclif run() implementation.   Parses and then invokes the abstract runCommand method
  async run() {
    const { argv, args, flags } = this.parse(this.constructor as typeof NimBaseCommand)
    this.runCommand(argv, args, flags, this)
  }

  // Generic kui runner.   Accepts args and flags, instantiates the command, and captures the output
  static dispatch(this, argv: string[], args: any, flags: any): string[] {
    const instance = new this(args, {})
    const logger = new CaptureLogger()
    instance.runCommand(argv, args, flags, logger)
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

    if (err && err.name === 'OpenWhiskError' && err.error && err.error.error) {
        msg = "[OpenWhisk] " + err.error.error
    }
    debug(err)
    msg = msg + '\n specify --verbose flag for more information'
    return this.error(msg, { exit: 1 })
  }

  // For non-terminal errors.  The CaptureLogger has a simpler equivalent.
  displayError (msg: string, err?: any) {
    this.parse(this.constructor as typeof NimBaseCommand)

    if (err && err.name === 'OpenWhiskError' && err.error && err.error.error) {
        msg = "[OpenWhisk] " + err.error.error
    }
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
