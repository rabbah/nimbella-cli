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
import { NimBaseCommand, NimLogger, NimFeedback, authPersister, parseAPIHost, inBrowser } from '../../NimBaseCommand'
import { readAndPrepare, buildProject, deploy } from '../../deployer/api'
import { Flags, OWOptions, DeployResponse, Credentials } from '../../deployer/deploy-struct'
import { getCredentialList, getCredentialsForNamespace } from '../../deployer/login'
import { computeBucketDomainName } from '../../deployer/deploy-to-bucket'
import { isGithubRef } from '../../deployer/github';
import * as path from 'path'

export class ProjectDeploy extends NimBaseCommand {
  static description = 'Deploy Nimbella projects'

  static flags = {
    target: flags.string({ description: 'the target namespace'}),
    env: flags.string({ description: 'path to environment file' }),
    apihost: flags.string({ description: 'API host to use' }),
    auth: flags.string({ description: 'OpenWhisk auth token to use' }),
    insecure: flags.boolean({ description: 'Ignore SSL Certificates', default: false }),
    'verbose-build': flags.boolean({ description: 'Display build details' }),
    'verbose-zip': flags.boolean({ description: 'Display start/end of zipping phase for each action'}),
    production: flags.boolean({ hidden: true }),
    yarn: flags.boolean({ description: 'Use yarn instead of npm for node builds' }),
    'web-local': flags.string({ description: 'a local directory to receive web deploy, instead of uploading'}),
    include: flags.string({ description: 'project portions to include' }),
    exclude: flags.string({ description: 'project portions to exclude' }),
    incremental: flags.boolean({ description: 'Deploy only changes since last deploy' }),
    ...NimBaseCommand.flags
  }

  static args = [ { name: 'projects', description: 'one or more paths to projects'} ]
  static strict = false

  async runCommand(rawArgv: string[], argv: string[], args: any, flags: any, logger: NimLogger) {
    // If no projects specified, display help
    if (argv.length == 0) {
      this.doHelp()
    }
    // Otherwise ...
    const { target, env, apihost, auth, insecure, production, yarn, incremental, include, exclude } = flags
    if (incremental && argv.some(project => isGithubRef(project))) {
      this.handleError(`'--incremental' may not be used with github projects`)
    }
    if (inBrowser && argv.some(project => !isGithubRef(project))) {
      logger.handleError(`only github projects are deployable from the cloud`)
    }
    const cmdFlags: Flags = { verboseBuild: flags['verbose-build'], verboseZip: flags['verbose-zip'], production, incremental, env, yarn,
      webLocal: flags['web-local'], include, exclude }
    this.debug('cmdFlags', cmdFlags)
    const { creds, owOptions } = await processCredentials(insecure, apihost, auth, target, logger)
    this.debug('creds', creds)

    // Deploy each project
    let success = true
    for (const project of argv) {
      success = success && await doDeploy(project, cmdFlags, creds, owOptions, false, logger)
    }
    if (!success) {
      logger.exit(1)
    }
  }
}

// Functions also used by 'project watch'

// Process credentials, possibly select non-current namespace
export async function processCredentials(ignore_certs: boolean, apihost: string|undefined, auth: string|undefined,
    target: string|undefined, logger: NimLogger): Promise<{ creds: Credentials|undefined, owOptions: OWOptions }> {
  const owOptions: OWOptions = { ignore_certs }  // No explicit undefined
  if (apihost) {
    owOptions.apihost = parseAPIHost(apihost)
  }
  if (auth) {
    owOptions.api_key = auth
  }
  // Iff a namespace switch was requested, perform it.  It might fail if there are no credentials for the target
  let creds: Credentials|undefined = undefined
  if (target) {
    target = await disambiguateNamespace(target, owOptions.apihost).catch((err: Error) => logger.handleError('', err))
    creds = await getCredentialsForNamespace(target, owOptions.apihost, authPersister).catch((err: Error) => logger.handleError('', err))
  } else if (apihost && auth) {
    // For backward compatibility with `wsk`, we accept the absence of target when both apihost and auth are
    // provided on the command line.  We synthesize credentials with (as yet) unknown namespace; if it later
    // turns out that the creds conflict with a targetNamespace in the config, an error will be indicated then.
    creds = { namespace: undefined, ow: owOptions, storageKey: undefined, redis: false }
  } /* else undefined creds; this isn't necessarily an error since the config might supply a namespace via targetNamespace */
  return { creds, owOptions }
}

// Deploy one project
export async function doDeploy(project: string, cmdFlags: Flags, creds: Credentials|undefined, owOptions: OWOptions, watching: boolean,
    logger: NimLogger): Promise<boolean> {
  let todeploy = await readAndPrepare(project, owOptions, creds, authPersister, cmdFlags, undefined, new NimFeedback(logger))
   if (!todeploy) {
    return false
  } else if (todeploy.error) {
      logger.displayError('', todeploy.error)
      return false
  }
  if (!watching) {
    displayHeader(project, todeploy.credentials, logger)
  }
  todeploy = await buildProject(todeploy)
  if (todeploy.error) {
      logger.displayError('', todeploy.error)
      return false
  }
  const result: DeployResponse = await deploy(todeploy)
  return displayResult(result, watching, cmdFlags.webLocal, logger)
}

// Disambiguate a namespace name when the user ends the name with a '-' character
// If the namespace does not end with '-' just return it
// If the match is unique up to the apihost, return the unique match (possibly still ambiguous if apihost not provided)
// If there is no match, return the provided string sans '-'
// If the match is not unique up to the apihost, throw error
export async function disambiguateNamespace(namespace: string, apihost: string|undefined): Promise<string> {
    if (namespace.endsWith('-')) {
      const allCreds = await getCredentialList(authPersister)
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

// Display the deployment "header" (what we are about to deploy)
function displayHeader(project: string, creds: Credentials, logger: NimLogger) {
  let namespaceClause = ""
  if (creds && creds.namespace) {
      namespaceClause = `\n  to namespace '${creds.namespace}'`
  }
  let hostClause = ""
  if (creds && creds.ow.apihost) {
      hostClause = `\n  on host '${creds.ow.apihost}'`
  }
  const projectPath = isGithubRef(project) ? project : path.resolve(project)
  logger.log(`Deploying project '${projectPath}'${namespaceClause}${hostClause}`)
}

// Display the result of a successful run
function displayResult(result: DeployResponse, watching: boolean, webLocal: string, logger: NimLogger): boolean {
  let success = true
  if (result.successes.length == 0 && result.failures.length == 0) {
      logger.log("\nNothing deployed")
  } else {
      logger.log('')
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
          if (webLocal) {
            bucketClause = ` to ${webLocal}`
          } else if (result.apihost) {
              bucketClause = ` to\n  https://${computeBucketDomainName(result.apihost, result.namespace)}`
          }
          logger.log(`Deployed ${deployedWeb} web content items${bucketClause}`)
      }
      if (skippedWeb > 0) {
          let bucketClause = ""
          if (watching && result.apihost) {
              bucketClause = ` on\n  https://${computeBucketDomainName(result.apihost, result.namespace)}`
          }
          logger.log(`Skipped ${skippedWeb} unchanged web resources${bucketClause}`)
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
          logger.displayError('Failures:')
          for (const err of result.failures) {
              success = false
              const context = (err as any)['context']
              if (context) {
                  logger.displayError(`While deploying ${context}:`, err)
              }
              logger.displayError('', err)
          }
      }
  }
  return success
}

export default ProjectDeploy
