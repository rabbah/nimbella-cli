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

import { Command } from '@oclif/command'

export default class Info extends Command {
  static description = "Show information about this version of 'nimb'"

  static flags = {}

  static args = []

  async run() {
    const deployer = require('deployer/version.json')
    const cli = require('../../version.json')
    const aio = require('@adobe/aio-cli/package.json')
    this.log(`nimb command version: ${cli.version}`)
    this.log(`Deployer version:     ${deployer.version}`)
    this.log(`Adobe I/O version:    ${aio.version}`)
  }
}
