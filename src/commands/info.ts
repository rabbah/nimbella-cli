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
import { NimBaseCommand, NimLogger, inBrowser, parseAPIHost } from '../NimBaseCommand'
import { open } from '../ui'
import { wskRequest, RuntimeTable, RuntimeEntry } from '../deployer/util'

export default class Info extends NimBaseCommand {
  static description = "show information about this version of 'nim'"

  static flags = {
    license: flags.boolean({ description: 'Display the license', hidden: inBrowser }),
    changes: flags.boolean({ description: 'Display the change history', hidden: inBrowser }),
    runtimes: flags.boolean({ description: 'List the supported runtimes' }),
    limits: flags.boolean({ description: 'List the applicable Nimbella system limits' }),
    apihost: flags.string({ description: 'API host to query for runtimes and limits (ignored otherwise)', hidden: true }),
    ...NimBaseCommand.flags
  }

  static args = []

  async runCommand(rawArgv: string[], argv: string[], args: any, flags: any, logger: NimLogger) {
    if (flags.license && !inBrowser) {
      await this.displayAncillary('license', logger)
    } else if (flags.changes && !inBrowser) {
      await this.displayAncillary('changes', logger)
    } else if (flags.runtimes || flags.limits) {
      const sysinfo = await this.getSystemInfo(flags.apihost, logger)
      if (flags.runtimes) {
        this.displayRuntimes(sysinfo, logger)
      } else {
        this.displayLimits(sysinfo, logger)
      }
    } else {
      const cli = require('../../version.json')
      const aio = require('@adobe/aio-cli-plugin-runtime/package.json')
      logger.log(`Nimbella CLI version: ${cli.version}`)
      logger.log(`Adobe I/O version:    ${aio.version}`)
      if (!inBrowser) {
        logger.log("'nim info --license' to display the license")
        logger.log("'nim info --changes' to display the change history")
      }
      logger.log("'nim info --runtimes' to display the supported runtimes")
      logger.log("'nim info --limits' to display the limits")
    }
  }

  // Display an HTML file in the default browser (these commands are disabled in the workbench, not because they couldn't work there but
  // because the information they display is either available in another form ('license') or is misleading ('changes'))
  async displayAncillary(topic: string, logger: NimLogger) {
      try {
        const html = require.resolve(`../../${topic}.html`)
        await open(html)
      } catch (err) {
        logger.displayError('', err)
        logger.log(`Packaging error: cannot locate ${topic}`)
      }
  }

  // Display the runtimes in a vaguely tabular format
  async displayRuntimes(sysinfo: object, logger: NimLogger) {
    // Organize the information for display
    const rawDisplay: string[][] = []
    const runtimes = sysinfo['runtimes'] as RuntimeTable
    for (const language in runtimes) {
      for (const entry of runtimes[language]) {
        rawDisplay.push([language, entry.kind, entry.default ? '(default)' : ''])
      }
    }
    // Format for display
    let maxLanguage: number = rawDisplay.reduce((prev, curr) => curr[0].length > prev ? curr[0].length : prev, 0)
    let maxKind = rawDisplay.reduce((prev, curr) => curr[1].length > prev ? curr[1].length: prev, 0)
    const display: string[] = rawDisplay.map(entry => entry[0].padEnd(maxLanguage + 1, ' ') +
      entry[1].padEnd(maxKind + 1, ' ') + entry[2])
    // Display
    logger.log('Language'.padEnd(maxLanguage + 1, ' ') + 'Kind'.padEnd(maxKind + 1), ' ')
    for (const line of display.sort()) {
      logger.log(line)
    }
  }

  // Display the limits with a heuristic for units (works for the moment)
  async displayLimits(sysinfo: object, logger: NimLogger) {
    const limits = sysinfo['limits']
    for (const limit in limits) {
      logger.log(`${limit}: ${this.formatUnits(limit, limits[limit])}`)
    }
  }

  // Convert a limit value into a more readable form using units inferred from the limit name
  formatUnits(limitName: string, limitValue: number): string {
    if (limitName.includes('duration')) {
      if (limitValue > 1000) {
        return (limitValue/1000) + ' seconds'
      } else {
        return limitValue + ' ms'
      }
    } else if (limitName.includes('memory')) {
        return (limitValue/(1024*1024)) + ' mb'
    } else {
      return String(limitValue)
    }
  }

  async getSystemInfo(apihost: string, logger: NimLogger) {
    if (apihost) {
      apihost = parseAPIHost(apihost)
    } else {
      apihost = 'https://apigcp.nimbella.io'
    }
    const url = apihost + '/api/v1'
    return await wskRequest(url, undefined).catch(err => logger.handleError('', err))
  }
}
