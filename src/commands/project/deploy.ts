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
import { deployProject } from 'deployer/api'
import { Flags, OWOptions, DeployResponse, Credentials } from 'deployer/deploy-struct'
import { switchNamespace, fileSystemPersister } from 'deployer/login'

export default class ProjectDeploy extends NimBaseCommand {
  static description = 'Deploy a Nimbella project'

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
    this.debug('argv', argv)
    //this.log('flags', flags)
    const { target, env, apihost, auth, insecure, production, yarn, incremental } = flags
    const cmdFlags: Flags = { verboseBuild: flags['verbose-build'], production, incremental, env, yarn }
    this.debug('cmdFlags', cmdFlags)
    const owOptions: OWOptions = { ignore_certs: insecure }  // No explicit undefined
    if (apihost) {
      owOptions.apihost = apihost
    }
    if (auth) {
      owOptions.api_key = auth
    }
    this.debug('owOptions', owOptions)
    // Iff a namespace switch was requested, perform it.  It might fail if there are no credentials for the target
    let creds: Credentials|undefined = undefined
    if (target) {
      creds = await switchNamespace(target, owOptions.apihost, fileSystemPersister).catch((err: Error) => this.handleError(err.message, err))
    } else if (apihost && auth) {
      // For backward compatibility with `wsk`, we accept the absence of target when both apihost and auth are
      // provided on the command line.  We synthesize credentials with (as yet) unknown namespace; if it later
      // turns out that the creds conflict with a targetNamespace in the config, an error will be indicated then.
      creds = { namespace: undefined, ow: owOptions, storageKey: undefined}
    } /* else undefined creds; this isn't necessarily an error since the config might supply a namespace via
        targetNamespace */
    this.debug('creds', creds)

    // If no projects specified, display help
    if (argv.length == 0) {
      this._help()
    }

    // Deploy each project
    let success = true
    for (const project of argv) {
      success = success && await this.doDeploy(project, cmdFlags, creds, owOptions)
    }
    if (!success) {
      this.exit(1)
    }
  }

  async doDeploy(project: string, cmdFlags: Flags, creds: Credentials|undefined, owOptions: OWOptions): Promise<boolean> {
    return deployProject(project, owOptions, creds, fileSystemPersister, cmdFlags)
      .then((result: DeployResponse) => this.displayResult(result, project))
      .catch((err: Error) => {
        this.displayError(err.message, err)
        return false
      })
   }

  // Display the result of a successful run
  displayResult(result: DeployResponse, project: string): boolean {
    let namespaceClause = ""
    if (result.namespace) {
        namespaceClause = ` to namespace '${result.namespace}'`
    }
    let hostClause = ""
    if (result.apihost) {
        hostClause = ` on host '${result.apihost}'`
    }
    this.log(`\nResult of deploying project '${project}'${namespaceClause}${hostClause}`)
    let success = true
    if (result.successes.length == 0 && result.failures.length == 0) {
        this.log("Nothing deployed")
    } else {
        for (const msg of result.successes) {
            this.log(msg)
        }
        for (const err of result.failures) {
            success = false
            const context = (err as any)['context']
            if (context) {
                this.displayError(`While deploying ${context}:`, err)
            }
            this.displayError(err.message, err)
          }
    }
    return success
  }
}
