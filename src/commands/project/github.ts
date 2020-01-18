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

 // Register or de-register a project that resides in a github repo

import { NimBaseCommand, NimLogger, inBrowser } from '../../NimBaseCommand'
import { flags } from '@oclif/command'
import { GithubDef, storeGithubDef, removeGithubDef, getGithubDef,
  getAllGithubDefs, validateRepo, fetchProject } from '../../deployer/github'

export default class ProjectGithub extends NimBaseCommand {
  static description = 'Register or unregister github-resident projects'

  static flags = {
    remove: flags.boolean({ description: 'Unregisters the designated project'}),
    replace: flags.boolean({ description: 'Allow replacement of an existing registration'}),
    auth: flags.string({ description: 'Authentication string to pass to github'}),
    ref: flags.string({ description: 'The branch, tag, or commit to use (defaults to master)'}),
    fetch: flags.boolean({ hidden: true}), // for testing project fetch into cache
    ...NimBaseCommand.flags
  }

  static args = [
    { name: 'name', description: 'the name given to the project locally', required: false},
    { name: 'location', description: `the coordinates in github, in the form 'owner/repo/path'`, required: false}
  ]

  async runCommand(rawArgv: string[], argv: string[], args: any, flags: any, logger: NimLogger) {
    const { name, location } = args
    const { remove, replace, auth, ref, fetch } = flags
    if (name && fetch) {
      const def = getGithubDef(name, inBrowser)
      await fetchProject(def)
    } else if (name && remove) {
        if (!removeGithubDef(name, inBrowser)) {
          logger.handleError(`No entry exists for '${name}'`)
        }
        return
    } else if ((!name || !location) && (replace || !!auth || !!ref)) {
      logger.handleError(`a name and location are required if '--replace' is are specified`)
    } else if (!name) {
      listProjects(logger)
    } else if (!location) {
      showProject(name, logger)
    } else {
      const parts = location.split('/')
      if (parts.length < 2) {
        logger.handleError(`'${location}' is not a valid github repository location`)
      }
      let path = undefined
      if (parts.length > 3) {
        path = parts.slice(2).join('/')
      } else if (parts.length == 3) {
        path = parts[2]
      }
      const [ owner, repo ] = parts
      const def: GithubDef = { name, owner, repo, path, auth, ref }
      await validateRepo(def).catch((err: Error) => logger.handleError(err.message, err))
      if (!storeGithubDef(def, inBrowser, replace)) {
        logger.handleError(`'${name}' is in use and --replace was not specified`)
      }
      displayProject(def, logger)
    }
  }
}

// Funtion to list all the projects in the map
function listProjects(logger: NimLogger) {
  const projects = getAllGithubDefs(inBrowser)
  if (projects.length == 0) {
    logger.log(`No github projects are currently registered`)
  }
  for (const project of projects) {
    displayProject(project, logger)
  }
}

// Function to display the contents of one project map entry (by name)
function showProject(name: string, logger: NimLogger) {
  const project = getGithubDef(name, inBrowser)
  if (!project) {
    logger.handleError(`${name} does not denote a github project`)
  }
  displayProject(project, logger)
}

// Function to display the contents of one project map entry (by entry)
function displayProject(project: GithubDef, logger: NimLogger) {
  let { name, owner, repo, path, auth, ref } = project
  const location = owner + '/' + repo + '/' + (path || '')
  if (name.length < 12) {
    name += ' '.repeat(12 - name.length)
  }
  logger.log(`${name} ${location}, auth=${auth || 'none'}, ref=${ref || 'master'}`)
}
