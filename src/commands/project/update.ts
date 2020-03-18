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

import { NimBaseCommand, NimLogger } from '../../NimBaseCommand'
import { default as ProjectCreate, createOrUpdateProject } from './create';

export default class ProjectUpdate extends NimBaseCommand {
  static description = 'Update a Nimbella Project'

  static flags = {
    ...ProjectCreate.flags,
    ...NimBaseCommand.flags
  }

  static args = ProjectCreate.args

  // For now:
  static hidden = true

  async runCommand(rawArgv: string[], argv: string[], args: any, flags: any, logger: NimLogger) {
    if (!args.project) {
      this.doHelp()
    }
    await createOrUpdateProject(true, args, flags, logger)
  }
}
