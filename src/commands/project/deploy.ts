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
import { NimBaseCommand } from '../../NimBaseCommand'
import { deployProject } from '../../deployer/api'
import { Flags, OWOptions, DeployResponse, Credentials } from '../../deployer/deploy-struct'
import { getCredentialList, switchNamespace, fileSystemPersister } from '../../deployer/login'
import { computeBucketName } from '../../deployer/deploy-to-bucket'
import * as path from 'path'

export class ProjectDeploy extends NimBaseCommand {
  static description = 'Deploy Nimbella projects'

  static flags = {
    target: flags.string({ description: 'the target namespace'}),
    env: flags.string({ description: 'path to environment file' }),
    apihost: flags.string({ description: 'API host to use' }),
    auth: flags.string({ description: 'OpenWhisk auth token to use' }),
    insecure: flags.boolean({ description: 'Ignore SSL Certificates', default: false }),
    "verbose-build": flags.boolean({ description: 'Display build details' }),
    production: flags.boolean({ hidden: true }),
    yarn: flags.boolean({ description: 'Use yarn instead of npm for node builds' }),
    incremental: flags.boolean({ description: 'Deploy only changes since last deploy' }),
    ...NimBaseCommand.flags
  }

  static args = [ { name: 'projects', description: 'one or more paths to projects'} ]
  static strict = false

  async run() {
    const {argv, flags} = this.parse(ProjectDeploy)
    const { target, env, apihost, auth, insecure, production, yarn, incremental } = flags
    const cmdFlags: Flags = { verboseBuild: flags['verbose-build'], production, incremental, env, yarn }
    this.debug('cmdFlags', cmdFlags)
    const { creds, owOptions } = await processCredentials(insecure, apihost, auth, target, this)
    this.debug('creds', creds)

    // If no projects specified, display help
    if (argv.length == 0) {
      this._help()
    }

    // Deploy each project
    let success = true
    for (const project of argv) {
      success = success && await doDeploy(project, cmdFlags, creds, owOptions, this)
    }
    if (!success) {
      this.exit(1)
    }
  }
}

// Functions also used by 'project watch'

// Process credentials, possibly switch namespace
export async function processCredentials(ignore_certs: boolean, apihost: string|undefined, auth: string|undefined, target: string|undefined,
    logger: NimBaseCommand): Promise<{ creds: Credentials|undefined, owOptions: OWOptions }> {
  const owOptions: OWOptions = { ignore_certs }  // No explicit undefined
  if (apihost) {
    owOptions.apihost = logger.parseAPIHost(apihost)
  }
  if (auth) {
    owOptions.api_key = auth
  }
  // Iff a namespace switch was requested, perform it.  It might fail if there are no credentials for the target
  let creds: Credentials|undefined = undefined
  if (target) {
    target = await disambiguateNamespace(target, owOptions.apihost).catch((err: Error) => logger.handleError(err.message, err))
    creds = await switchNamespace(target, owOptions.apihost, fileSystemPersister).catch((err: Error) => logger.handleError(err.message, err))
  } else if (apihost && auth) {
    // For backward compatibility with `wsk`, we accept the absence of target when both apihost and auth are
    // provided on the command line.  We synthesize credentials with (as yet) unknown namespace; if it later
    // turns out that the creds conflict with a targetNamespace in the config, an error will be indicated then.
    creds = { namespace: undefined, ow: owOptions, storageKey: undefined, redis: false }
  } /* else undefined creds; this isn't necessarily an error since the config might supply a namespace via targetNamespace */
  return { creds, owOptions }
}

// Deploy one project
export async function doDeploy(project: string, cmdFlags: Flags, creds: Credentials|undefined, owOptions: OWOptions, logger: NimBaseCommand): Promise<boolean> {
  return deployProject(project, owOptions, creds, fileSystemPersister, cmdFlags)
    .then((result: DeployResponse) => displayResult(result, project, logger))
    .catch((err: Error) => {
      logger.displayError(err.message, err)
      return false
  })
}

// Disambiguate a namespace name when the user ends the name with a '-' character
// If the namespace does not end with '-' just return it
// If the match is unique up to the apihost, return the unique match (possibly still ambiguous if apihost not provided)
// If there is no match, return the provided string sans '-'
// If the match is not unique up to the apihost, throw error
export async function disambiguateNamespace(namespace: string, apihost: string|undefined): Promise<string> {
    if (namespace.endsWith('-')) {
      const allCreds = await getCredentialList(fileSystemPersister)
      namespace = namespace.slice(0, -1)
      let matches = allCreds.filter(cred => cred.namespace.startsWith(namespace))
      if (apihost) {
        matches = matches.filter(match => match.apihost === apihost)
      }
      if (matches.length > 0) {
        if (matches.every(cred => cred.namespace === matches[0].namespace)) {
          return matches[0].namespace
        } else {
          throw new Error(`Prefix '${namespace}' matches multiple namespaces`)
        }
      }
    }
    // No match or no '-' to begin with
    return namespace
}

// Display the result of a successful run
function displayResult(result: DeployResponse, project: string, logger: NimBaseCommand): boolean {
  let namespaceClause = ""
  if (result.namespace) {
      namespaceClause = `\n  to namespace '${result.namespace}'`
  }
  let hostClause = ""
  if (result.apihost) {
      hostClause = `\n  on host '${result.apihost}'`
  }
  logger.log(`\nResult of deploying project '${path.resolve(project)}'${namespaceClause}${hostClause}`)
  let success = true
  if (result.successes.length == 0 && result.failures.length == 0) {
      logger.log("Nothing deployed")
  } else {
      const actions: string[] = []
      let deployedWeb = 0
      let skippedActions = 0
      let skippedWeb = 0
      for (const success of result.successes) {
          if (success.kind === 'web') {
              if (success.skipped) {
                  skippedWeb++
              } else {
                  deployedWeb++
              }
          } else if (success.kind == "action") {
              if (success.skipped) {
                  skippedActions++
              } else {
                  let name = success.name
                  if (success.wrapping) {
                      name += ` (wrapping ${success.wrapping})`
                  }
                  actions.push(name)
              }
          }
      }
      if (deployedWeb > 0) {
          let bucketClause = ""
          if (result.apihost) {
              bucketClause = ` to\n  https://${computeBucketName(result.apihost, result.namespace)}`
          }
          logger.log(`Deployed ${deployedWeb} web content items${bucketClause}`)
      }
      if (skippedWeb > 0) {
          logger.log(`Skipped ${skippedWeb} unchanged web resources`)
      }
      if (actions.length > 0) {
          logger.log('Deployed actions:')
          for (const action of actions) {
              logger.log(`  - ${action}`)
          }
      }
      if (skippedActions > 0) {
          logger.log(`Skipped ${skippedActions} unchanged actions`)
      }
      if (result.failures.length > 0) {
          success = false
          console.error('Failures:')
          for (const err of result.failures) {
              success = false
              const context = (err as any)['context']
              if (context) {
                  logger.displayError(`While deploying ${context}:`, err)
              }
              logger.displayError(err.message, err)
          }
      }
  }
  return success
}

export default ProjectDeploy
