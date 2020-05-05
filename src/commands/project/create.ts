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
import { NimBaseCommand, NimLogger, inBrowser } from '../../NimBaseCommand'
import { createOrUpdateProject } from '../../generator/project'

const plugins = ['postman', 'openapi']
export default class ProjectCreate extends NimBaseCommand {
    static description = 'Create a Nimbella Project'

    static flags = {
        target: flags.string({ description: 'Target namespace for the project' }),
        clean: flags.boolean({ description: 'Clean the namespace before every deploy', allowNo: true }),
        sample: flags.boolean({ description: 'Start off with hello world (default language javascript)' }),
        config: flags.boolean({ description: 'Generate template config file' }),

        source: flags.string({
            char: 's', description: 'API specs source',
            options: plugins
        }),
        id: flags.string({ char: 'i', description: 'API specs id/name/path' }),
        key: flags.string({ char: 'k', dependsOn: ['source'], description: 'key to access the source API' }),
        language: flags.string({
            char: 'l', description: 'Language for the project (implies sample unless source is specified)', default: 'javascript',
            options: ['go', 'javascript', 'python', 'java', 'swift', 'php']
        }),
        overwrite: flags.boolean({ char: 'o', description: 'Overwrites the existing nimbella project directory if it exists', }),
        updateSource: flags.boolean({ char: 'u', description: 'Sync updated API specs back to source' }),
        clientCode: flags.boolean({ char: 'c', description: 'Generates client code', default: true }),

        ...NimBaseCommand.flags
    }

    static args = [{ name: 'project', description: 'project path in the file system', required: false }]

    async runCommand(rawArgv: string[], argv: string[], args: any, flags: any, logger: NimLogger) {
        if (!args.project && !flags.source) {
            this.doHelp()
        }
        if (inBrowser) {
            logger.handleError(`'project create' needs local file access. Use the 'nim' CLI on your local machine`)
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
            await createOrUpdateProject(false, args, flags, logger)
        }
    }
}
