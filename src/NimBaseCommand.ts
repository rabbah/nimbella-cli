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

const debug = createDebug('nimbella-cli')

export abstract class NimBaseCommand extends Command {
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

  handleError (msg: string, err?: any) {
    this.parse(this.constructor as typeof NimBaseCommand)

    if (err && err.name === 'OpenWhiskError' && err.error && err.error.error) {
        msg = "[OpenWhisk] " + err.error.error
    }
    debug(err)
    msg = msg + '\n specify --verbose flag for more information'
    return this.error(msg, { exit: 1 })
  }

  displayError (msg: string, err?: any) {
    this.parse(this.constructor as typeof NimBaseCommand)

    if (err && err.name === 'OpenWhiskError' && err.error && err.error.error) {
        msg = "[OpenWhisk] " + err.error.error
    }
    debug(err)
    return this.error(msg, { exit: false })
  }

static flags = {
    debug: flags.string({ description: 'Debug level output' }),
    verbose: flags.boolean({ char: 'v', description: 'Verbose output' }),
    help: flags.boolean({ description: 'Show help' })
  }
}
