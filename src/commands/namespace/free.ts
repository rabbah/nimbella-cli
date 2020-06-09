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
import { NimBaseCommand, NimLogger, authPersister, disambiguateNamespace, parseAPIHost } from '../../NimBaseCommand'
import { recordNamespaceOwnership, getCredentials, getCredentialDict, getCredentialList } from '../../deployer/credentials'
import { CredentialRow } from '../../deployer/deploy-struct'

// 'Free' a namespace entry in the credential store by removing any ownership information
export default class NamespaceFree extends NimBaseCommand {
    static description = 'Remove project ownership restrictions from namespaces'

    static flags = {
        apihost: flags.string({ description: 'API host serving the namespace(s)'}),
        all: flags.boolean({ description: 'free all namespaces (or, all on the given API host)'}),
        ...NimBaseCommand.flags
    }

    static args = [{name: 'namespace', description: 'The namespace(s) you are freeing (current if omitted)', required: false}]
    static strict = false

    async runCommand(rawArgv: string[], argv: string[], args: any, flags: any, logger: NimLogger) {
        if (flags.all && argv.length > 0) {
        logger.handleError(`Cannot combine the '--all' flag with explicit namespace names`)
        }
        let host = parseAPIHost(flags.apihost)
        if (host && argv.length === 0 && !flags.all) {
            logger.handleError(`Cannot specify an API host without also specifying the namespace or the '--all' flag.`)
        }

        // Process the --all case
        if (flags.all) {
            return this.freeAll(host, logger)
        }

        // Free just the current namespace (with prompt)
        if (argv.length === 0) {
            const creds = await getCredentials(authPersister).catch(err => logger.handleError('', err))
            return await this.doFree(creds.namespace, creds.ow.apihost, logger)
        }

        // Free one or more namespaces by name
        for (const ns of argv) {
            const namespace = await disambiguateNamespace(ns, host).catch(err => logger.handleError('', err))
            await this.doFree(namespace, host, logger)
        }
    }

    async freeAll(host: string, logger: NimLogger) {
        let all: CredentialRow[]
        if (host) {
            const dict = await getCredentialDict(authPersister)
            all = dict[host]
        } else {
            all = await getCredentialList(authPersister)
        }
        for (const row of all) {
            await this.doFree(row.namespace, row.apihost, logger)
        }
    }

    async doFree(namespace: string, host: string, logger: NimLogger) {
        const success = await recordNamespaceOwnership(undefined, namespace, host, undefined, authPersister)
        if (success) {
            logger.log(`Removed ownership from namespace '${namespace}'`)
        } else {
            logger.handleError(`Namespace '${namespace}' was not found`)
        }
    }
}
