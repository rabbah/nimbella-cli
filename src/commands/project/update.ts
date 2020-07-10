/*
 * Copyright (c) 2019 - present Nimbella Corp.
 *
 * This file is licensed to you under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License. You may obtain a copy
 * of the License at http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software distributed under
 * the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR REPRESENTATIONS
 * OF ANY KIND, either express or implied. See the License for the specific language
 * governing permissions and limitations under the License.
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
