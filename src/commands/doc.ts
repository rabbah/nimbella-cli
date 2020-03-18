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

import { NimBaseCommand, NimLogger, inBrowser } from '../NimBaseCommand'
import { open } from '../ui'
const PUBLIC_DOC = 'https://nimbella.io/downloads/nim/nim.html'

export default class Doc extends NimBaseCommand {
  static description = "display the full documentation of this CLI"

  static flags = { ...NimBaseCommand.flags }

  static args = []

  static aliases = [ 'docs' ]

  async runCommand(rawArgv: string[], argv: string[], args: any, flags: any, logger: NimLogger) {
    try {
      if (inBrowser) {
        logger.log('This displays the Nimbella CLI documentation')
        logger.log('Much of the Nimbella CLI command set also works in the workbench')
        logger.log('Type "menu" for some more orientation to the workbench')
        await open(PUBLIC_DOC)
      } else {
        const html = require.resolve('../../doc/nim.html')
        await open(html)
      }
    } catch (err) {
      logger.displayError(err.message, err)
      logger.log("Packaging error: cannot locate documentation")
    }
 }
}
