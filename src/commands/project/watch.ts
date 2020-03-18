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
import { ProjectDeploy, processCredentials, doDeploy } from './deploy'
import { Flags, Credentials, OWOptions } from '../../deployer/deploy-struct'
import * as fs from 'fs'
import * as path from 'path'
import { isGithubRef } from '../../deployer';

export default class ProjectWatch extends NimBaseCommand {
  static description = 'Watch Nimbella projects, deploying incrementally on change'

  static flags = {
    target: ProjectDeploy.flags.target,
    env: ProjectDeploy.flags.env,
    apihost: ProjectDeploy.flags.apihost,
    auth: ProjectDeploy.flags.auth,
    insecure: ProjectDeploy.flags.insecure,
    'verbose-build': ProjectDeploy.flags['verbose-build'],
    'verbose-zip': ProjectDeploy.flags['verbose-zip'],
    yarn: ProjectDeploy.flags.yarn,
    'web-local': ProjectDeploy.flags['web-local'],
    include: ProjectDeploy.flags.include,
    exclude: ProjectDeploy.flags.exclude,
    ...NimBaseCommand.flags
  }

  static args = ProjectDeploy.args
  static strict = false

  async runCommand(rawArgv: string[], argv: string[], args: any, flags: any, logger: NimLogger) {
     // If no projects specified, display help
    if (argv.length == 0) {
      this.doHelp()
    }
    // Otherwise ...
    const { target, env, apihost, auth, insecure, yarn, include, exclude } = flags
    const cmdFlags: Flags = { verboseBuild: flags['verbose-build'], verboseZip: flags['verboseZip'], production: false,
        incremental: true, env, yarn, webLocal: flags['web-local'], include, exclude }
    this.debug('cmdFlags', cmdFlags)
    const { creds, owOptions } = await processCredentials(insecure, apihost, auth, target, logger)
    argv.forEach(project => watch(project, cmdFlags, creds, owOptions, logger, this.config.userAgent))
  }
}

// Validate a project and start watching it if it actually looks like a project
function watch(project: string, cmdFlags: Flags, creds: Credentials|undefined, owOptions: OWOptions,
        logger: NimLogger, userAgent: string) {
    const msg = validateProject(project)
    if (msg) {
        logger.handleError(msg, new Error(msg))
    }
    logger.log(`Watching '${project}' [use Control-C to terminate]`)
    let watcher: fs.FSWatcher|undefined = undefined
    const reset = () => {
        if (watcher) {
            // logger.log("Closing watcher")
            watcher.close()
        }
    }
    const watch = () => {
        // logger.log("Opening new watcher")
        watcher = fs.watch(project, { recursive: true, persistent: true}, async (_, filename) =>
            await fireDeploy(project, filename, cmdFlags, creds, owOptions, logger, userAgent, reset, watch))
    }
    watch()
}

// Fire a deploy cycle.  Suspends the watcher so that mods made to the project by the deployer won't cause a spurious re-trigger.
// Displays an informative message before deploying.
async function fireDeploy(project: string, filename: string, cmdFlags: Flags, creds: Credentials|undefined, owOptions: OWOptions,
        logger: NimLogger, userAgent: string, reset: ()=>void, watch: ()=>void) {
    if (excluded(filename)) {
        return
    }
    reset()
    logger.log(`\nDeploying '${project}' due to change in '${filename}'`)
    let error = false
    await doDeploy(project, cmdFlags, creds, owOptions, true, logger, userAgent).catch(err => {
        logger.displayError(err.message, err)
        error = true
    })
    if (error)
        return
    logger.log("Deployment complete.  Resuming watch.\n")
    await delay().then(() => watch())
}

// Decide if a file name should be excluded from consideration when firing a deploy.
// TODO Someday this might be based on a list of patterns but the number of rules right now are small enough to
// not bother with that.
function excluded(filename: string): boolean {
    return filename.split('/').includes('.nimbella')
        || filename.endsWith('~')
        || filename.includes('_tmp_')
        || filename.endsWith('.swx')
        || filename.includes('.#')
}

// Validate a project argument to ensure that it denotes an actual directory that "looks like a project".
// Returns an error message when there is a problem, undefined otherwise
function validateProject(project: string): string|undefined {
    if (isGithubRef(project)) {
        return `'${project}' is not in the local file system; we do not support watching github projects`
    }
    if (!fs.existsSync(project)) {
        return `${project} does not exist`
    }
    const stat = fs.lstatSync(project)
    if (!stat.isDirectory()) {
        return `${project} is not a directory`
    }
    if (isTypicalProject(project, 'project.yml', true) || isTypicalProject(project, 'packages', false)
            || isTypicalProject(project, 'web', false)) {
        return undefined
    }
    return `${project} is a directory but it doesn't appear to contain a project`
}

// Introduce small delay
function delay(): Promise<undefined> {
    return new Promise(function (resolve) {
        setTimeout(() => resolve(undefined), 200)
    })
}

// Check for typical things found in a project (part of validating that a directory is a project)
function isTypicalProject(project: string, item: string, shouldBeFile: boolean): boolean {
    item = path.join(project, item)
    if (fs.existsSync(item)) {
        const stat = fs.lstatSync(item)
        if (shouldBeFile && stat.isFile() || !shouldBeFile && stat.isDirectory()) {
            return true
        }
    }
    return false
}
