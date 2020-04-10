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
import { NimBaseCommand, NimLogger, inBrowser } from '../NimBaseCommand'
import { open } from '../ui'

export default class Info extends NimBaseCommand {
  static description = "show information about this version of 'nim'"

  static flags = {
    license: flags.boolean({ description: 'Display the license', hidden: inBrowser }),
    changes: flags.boolean({ description: 'Display the change history', hidden: inBrowser }),
    ...NimBaseCommand.flags
  }

  static args = []

  async runCommand(rawArgv: string[], argv: string[], args: any, flags: any, logger: NimLogger) {
    if (flags.license && !inBrowser) {
      await this.displayAncillary('license', logger)
     } else if (flags.changes && !inBrowser) {
      await this.displayAncillary('changes', logger)
    } else {
      const cli = require('../../version.json')
      const aio = require('@adobe/aio-cli-plugin-runtime/package.json')
      logger.log(`Nimbella CLI version: ${cli.version}`)
      logger.log(`Adobe I/O version:    ${aio.version}`)
      if (!inBrowser) {
        logger.log("'nim info --license' to display the license")
        logger.log("'nim info --changes' to display the change history")
      }
    }
  }

  async displayAncillary(topic: string, logger: NimLogger) {
      try {
        const html = require.resolve(`../../${topic}.html`)
        await open(html)
      } catch (err) {
        logger.displayError('', err)
        logger.log(`Packaging error: cannot locate ${topic}`)
      }
  }
}
