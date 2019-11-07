#!/usr/bin/env node
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

 import { Hook, IConfig } from '@oclif/config'
 type Options = { Command: any; argv: string[]; } & { config: IConfig; }
 import * as createDebug from 'debug'

const debug = createDebug('nimbella-prerun')

 const hook: Hook.Prerun = async function (opts: Options) {
    debug('Prerun: %O', opts)
}

export default hook
