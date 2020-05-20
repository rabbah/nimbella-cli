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

import { NimBaseCommand, NimLogger, inBrowser } from '../../NimBaseCommand'
import { createOrUpdateProject, seemsToBeProject } from '../../generator/project'
import { default as ProjectCreate } from './create';

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
    if (!args.project && !flags.source) {
      this.doHelp()
    }
    if (inBrowser) {
      logger.handleError(`'project update' needs local file access. Use the 'nim' CLI on your local machine`)
    }
    if (!seemsToBeProject(args.project)) {
      logger.handleError(`A directory or file '${args.project}' does not appear to be a project`)
    }
    if (flags.source) {
      const params = [flags.id, flags.key, flags.language];
      if (flags.overwrite) { params.push('-o'); }
      if (flags.updateSource) { params.push('-u'); }
      if (flags.clientCode) { params.push('-c'); }
      const pluginCommands = this.config.commands.filter(c => c.pluginName === flags.source);
      if (pluginCommands.length) {
        await pluginCommands[0].load().run([...params])
      }
      else {
        logger.handleError(`the ${flags.source} plugin is not installed. try 'nim plugins add ${flags.source}'`);
      }
    }
    else {
      await createOrUpdateProject(true, args, flags, logger)
    }
  }
}
