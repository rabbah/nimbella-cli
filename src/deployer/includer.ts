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

import { Includer } from './deploy-struct';
import * as makeDebug from 'debug'
const debug = makeDebug('nimbella-cli/includer')

// Make an includer
export function makeIncluder(include: string, exclude: string): Includer {
    const includes = include ? include.split(',') : undefined
    const excludes = exclude ? exclude.split(',') : undefined
    const ans = new IncluderImpl(includes, excludes)
    debug("constructed includer: %O", ans)
    return ans
 }

 // The implementation behind the Includer interface
class IncluderImpl implements Includer {
    isWebIncluded: boolean = false
    startWithAllIncluded: boolean = false
    includedPackages: Set<string> = new Set()
    excludedPackages: Set<string> = new Set()
    includedActions: Map<string,Set<string>> = new Map()
    excludedActions: Map<string,Set<string>> = new Map()

    // Construct
    constructor(includes: string[], excludes: string[]) {
        if (!includes) {
            this.isWebIncluded = true
            this.startWithAllIncluded = true
        } else {
            for (let token of includes) {
                if (token == 'web') {
                    this.isWebIncluded = true
                    continue
                }
                if (token.endsWith('/')) {
                    token = token.slice(0, -1)
                }
                const [ pkg, action ] = token.split('/')
                if (action) {
                    this.addToMap(pkg, action, this.includedActions)
                } else {
                    this.includedPackages.add(pkg)
                }
            }
        }
        if (excludes) {
            for (let token of excludes) {
                if (token == 'web') {
                    this.isWebIncluded = false
                    continue
                }
                if (token.endsWith('/')) {
                    token = token.slice(0, -1)
                }
                const [ pkg, action ] = token.split('/')
                if (action) {
                    this.addToMap(pkg, action, this.excludedActions)
                } else {
                    this.excludedPackages.add(pkg)
                }
            }
        }
    }

    // Implement isPackageIncluded
    isPackageIncluded = (pkg: string) => {
        const ans = (this.startWithAllIncluded || this.includedPackages.has(pkg)) && !this.excludedPackages.has(pkg)
        debug('isPackageIncluded(%s)=%s', pkg, String(ans))
        return ans
    }

    // Implement isActionIncluded
    isActionIncluded = (pkg: string, action: string) => {
        if (this.isActionInMap(pkg, action, this.includedActions)) {
            return true // explicitly included
        }
        if (this.excludedPackages.has(pkg) || this.isActionInMap(pkg, action, this.excludedActions)) {
            return false // excluded, either explicitly or at package level
        }
        // So far, the action is not excluded but was not explicitly included either so the result depends on package inclusion
        return this.startWithAllIncluded || this.includedPackages.has(pkg)
    }

    // Implement isIncludingEverything
    isIncludingEverything = () => {
        return this.startWithAllIncluded && this.includedActions.size == 0 && this.includedPackages.size == 0
    }

    // Utility to add an action to an action map
    addToMap(pkg: string, action: string, map: Map<string,Set<string>>) {
        let set = map.get(pkg)
        if (!set) {
            set = new Set()
            map.set(pkg, set)
        }
        set.add(action)
    }

    // Utility to interrogate whether an action is in an action map
    isActionInMap(pkg: string, action: string, map: Map<string,Set<string>>): boolean {
        const set = map.get(pkg)
        if (!set) {
            return false
        }
        return set.has(action)
    }
}