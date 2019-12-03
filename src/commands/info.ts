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
import { NimBaseCommand, NimLogger } from '../NimBaseCommand'
import * as open from 'open'

export default class Info extends NimBaseCommand {
  static description = "show information about this version of 'nim'"

  static flags = {
    license: flags.boolean({ description: 'Display the license'}),
    ...NimBaseCommand.flags
  }

  static args = []

  async runCommand(argv: string[], args: any, flags: any, logger: NimLogger) {
    if (flags.license) {
      try {
        const html = require.resolve('../../license.html')
        await open(html)
      } catch (err) {
        logger.displayError(err.message, err)
        logger.log("Packaging error: cannot locate license")
      }
    } else {
      const cli = require('../../version.json')
      const aio = require('@adobe/aio-cli/package.json')
      logger.log(`nim command version: ${cli.version}`)
      logger.log(`Adobe I/O version:   ${aio.version}`)
      logger.log("'nim info --license' to display the license")
    }
  }
}
