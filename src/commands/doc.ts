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

import { NimBaseCommand, NimLogger } from '../NimBaseCommand'

let open

export default class Doc extends NimBaseCommand {
  static description = "display the full documentation of this CLI"

  static flags = { ...NimBaseCommand.flags }

  static args = []

  static aliases = [ 'docs' ]

  async runCommand(argv: string[], args: any, flags: any, logger: NimLogger) {
    try {
      const html = require.resolve('../../nim.html')
      if (!open) {
        open = require('open')
      }
      await open(html)
    } catch (err) {
      logger.displayError(err.message, err)
      logger.log("Packaging error: cannot locate documentation")
    }
 }
}
