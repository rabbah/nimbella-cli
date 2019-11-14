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

import * as fs from 'fs'
import * as path from 'path'
import { DeployStructure, PackageSpec, ActionSpec, WebResource } from './deploy-struct'
import { emptyStructure, actionFileToParts, filterFiles, convertToResources, promiseFilesAndFilterFiles, loadProjectConfig } from './util'
import { getBuildForAction, getBuildForWeb } from  './finder-builder'
const CONFIG_FILE = 'project.yml'
const LEGACY_CONFIG_FILE = 'projectConfig.yml'
const ENV_FILE = '.env'

// Read the top level files and dirs of the project.  Only one file and two dirs are legal at this level; everything else is a 'stray'
interface TopLevel {
    web: string
    packages: string
    config?: string
    env?: string
    strays: string[]
    filePath: string
}
export function readTopLevel(filePath: string, env: string): Promise<TopLevel> {
    // If the 'env' argument is defined it takes precedence over .env found in the project
    const webDir = 'web', pkgDir = 'packages'
    return new Promise(function(resolve, reject) {
       fs.readdir(filePath, {withFileTypes: true}, (err, items: fs.Dirent[]) => {
            if (err) {
                reject(err)
            } else {
                items = filterFiles(items)
                let web: string
                let config: string
                let notconfig: string
                let legacyConfig: string
                let packages: string
                const strays: string[] = []
                for (const item of items) {
                    if (item.isDirectory()) {
                        switch(item.name) {
                            case webDir:
                                web = path.join(filePath, webDir)
                                break
                            case pkgDir:
                                packages = path.join(filePath, pkgDir)
                                break
                            case '.nimbella':
                                break
                            default:
                                strays.push(item.name)
                        }
                    } else if (item.isFile() && item.name == CONFIG_FILE) {
                        config = path.join(filePath, item.name)
                    } else if (item.isFile() && item.name == LEGACY_CONFIG_FILE) {
                        legacyConfig = path.join(filePath, item.name)
                    } else if (item.isFile() && (item.name.endsWith(".yml") || item.name.endsWith(".yaml"))) {
                        notconfig = item.name
                    } else if (!env && item.isFile() && item.name == ENV_FILE) {
                        env = path.join(filePath, item.name)
                    } else {
                        strays.push(item.name)
                    }
                }
                if (legacyConfig && !config) {
                    config = legacyConfig
                    console.log(`Warning: the name '${LEGACY_CONFIG_FILE}' is deprecated; please rename to '${CONFIG_FILE}' soon`)
                }
                if (notconfig && !config) {
                    console.log("Warning: found", notconfig, "but no", CONFIG_FILE)
                }
                resolve({ web, packages, config, strays, filePath, env })
            }
        })
    })
}

// Probe the top level structure to obtain the major parts of the final config.  Spawn builders for those parts and
// assemble a "Promise.all" for the combined work
export function buildStructureParts(topLevel: TopLevel): Promise<DeployStructure[]> {
    const { web, packages, config, strays, filePath, env } = topLevel
    return new Promise(function(resolve) {
        const webPart = getBuildForWeb(web).then(build => buildWebPart(web, build))
        const actionsPart = buildActionsPart(packages)
        const configPart = readConfig(config, env, filePath, strays)
        resolve(Promise.all([webPart, actionsPart, configPart]))
    })
}

// Assemble a complete initial structure containing all file system information and config.  May be deployed as is or adjusted
// before deployment.  Input is the resolved output of buildStructureParts.  At this point, the web part may have names that
// are only suitable for bucket deploy so we check for that problem here.
export function assembleInitialStructure(parts: DeployStructure[]): DeployStructure {
    // console.log("Assembling structure from parts")
    const [ webPart, actionsPart, configPart ] = parts
    const strays = (actionsPart.strays || []).concat(configPart.strays || [])
    configPart.strays = strays
    configPart.web = (webPart.web && configPart.web) ? mergeWeb(webPart.web, configPart.web) :
        webPart.web ? webPart.web : configPart.web ? configPart.web : []
    configPart.packages = (actionsPart.packages && configPart.packages) ? mergePackages(actionsPart.packages, configPart.packages) :
        actionsPart.packages ? actionsPart.packages : configPart.packages ? configPart.packages : []
    configPart.webBuild = webPart.webBuild
    if (configPart.actionWrapPackage) {
        configPart.web.forEach(res => {
            if (res.simpleName.includes('/')) {
                throw new Error(`Web resource ${res.simpleName} cannot be deployed with action-wrapping (has nested structure)`)
            }
        })
    }
    return configPart
}

// Merge 'web' portion of config, if any, into the 'web' array read from the file system.  The merge key is the
// simple name.
function mergeWeb(fs: WebResource[], config: WebResource[]): WebResource[] {
    const merge = {}
    fs.forEach(resource => {
        merge[resource.simpleName] = resource
    })
    config.forEach(resource => {
        const already = merge[resource.simpleName]
        merge[resource.simpleName] = already ? mergeWebResource(already, resource) : resource
    })
    const ans: WebResource[] = []
    for (const name in merge) {
        ans.push(merge[name])
    }
    return ans
}

// Merge a single WebResource: the file system and config contributions have the same simpleName.  Exactly one must specify
// the filePath or an error is indicated.  For other properties, information in the config takes precedence.
function mergeWebResource(fs: WebResource, config: WebResource): WebResource {
    if (fs.filePath && config.filePath) {
        throw new Error("Config may not specify filePath for WebResource that already has a filePath")
    }
   const ans = Object.assign({}, fs, config)
   if (!ans.filePath) {
        throw new Error(`WebResource ${fs.simpleName} has no filePath`)
   }
   return ans
}

// Merge 'packages' portion of config, if any, into the 'packages' array read from the file system.
// The merge key is the package name.
function mergePackages(fs: PackageSpec[], config: PackageSpec[]): PackageSpec[] {
    const merge = {}
    fs.forEach(pkg => {
        merge[pkg.name] = pkg
    })
    config.forEach(pkg => {
        const already = merge[pkg.name]
        if (already) {
            merge[pkg.name] = mergePackage(already, pkg)
        } else {
            // For now, a package cannot be declared _only_ in the config
            throw new Error(`Package '${pkg.name}' is named in the config but does not exist in the project`)
        }
    })
    const ans: PackageSpec[] = []
    for (const name in merge) {
        ans.push(merge[name])
    }
    return ans
}

// Merge a single PackageSpec: the file system and config contributions have the same name.  The actions are merged.
// Other attributes are preferentially taken from the config.
function mergePackage(fs: PackageSpec, config: PackageSpec): PackageSpec {
    const fsActions = fs.actions
    const cfgActions = config.actions
    const ans = Object.assign({}, fs, config)
    if (fsActions && fsActions.length > 0) {
        if (cfgActions && cfgActions.length > 0) {
            ans.actions = mergeActions(fsActions, cfgActions)
        } else {
            ans.actions = fsActions
        }
    } else {
        ans.actions = cfgActions
    }
    return ans
}

// Merge the actions portion of a PackageSpec in config, if any, into the corresponding PackageSpec actions read from the file system.
// The merge key is the action name.
function mergeActions(fs: ActionSpec[], config: ActionSpec[]): ActionSpec[] {
    const merge = {}
    fs.forEach(action => {
        merge[action.name] = action
    })
    config.forEach(action => {
        const already = merge[action.name]
        if (already) {
            merge[action.name] = mergeAction(already, action)
        } else {
            // For now, an action cannot be declared _only_ in the config
            throw new Error(`Action '${action.name}' is named in the config but does not exist in the project`)
        }
    })
    const ans: ActionSpec[] = []
    for (const name in merge) {
        ans.push(merge[name])
    }
    return ans
}

// Merge a single ActionSpec: the file system and config contributions have the same name.  The config contributions
// take precedence
function mergeAction(fs: ActionSpec, config: ActionSpec): ActionSpec {
    // console.log("Action from filesystem")
    // console.dir(fs, { depth: null} )
    // console.log("Action from config")
    // console.dir(config, { depth: null })
    const result = Object.assign({}, fs, config)
    // console.log("Result of merge")
    // console.dir(result, { depth: null })
    return result
}

// Probe the web directory.  We find all files even under subdirectories (no strays here).  However, if we turn out to be
// action-wrapping (which is not known at this point), file names with slashes will cause an error later.
function buildWebPart(webdir: string, build: string): Promise<DeployStructure> {
    if (!webdir) {
        return Promise.resolve(emptyStructure())
    } else {
        return readWebResources(webdir).then(resources => {
            return { web: resources, webBuild: build, packages: [], strays: [] }
        })
    }
}

// Read the resources of the web directory
function readWebResources(webdir: string): Promise<WebResource[]> {
    return promiseFilesAndFilterFiles(webdir).then((items: string[]) => {
        return convertToResources(items, webdir.length + 1)
    })
}

// Probe the packages directory
function buildActionsPart(pkgsdir: string): Promise<DeployStructure> {
    if (!pkgsdir) {
        return Promise.resolve(emptyStructure())
    } else {
        return buildPkgArray(pkgsdir).then((values) => {
            const [ strays, pkgs] = values
            return { web: [], packages: pkgs, strays: strays }
        })
    }
}

// Accumulate the arrays of PackageSpecs and Strays in the 'packages' directory
function buildPkgArray(pkgsDir): Promise<any> {
    // console.log("Building package array")
    return new Promise(function(resolve, reject) {
       fs.readdir(pkgsDir, {withFileTypes: true}, (err, items: fs.Dirent[]) => {
            if (err) {
                reject(err)
            } else {
                items = filterFiles(items)
                const strays = items.filter(dirent => !dirent.isDirectory()).map(dirent => dirent.name)
                const pkgNames = items.filter(dirent => dirent.isDirectory()).map(dirent => dirent.name)
                const rdrs: Promise<PackageSpec>[] = []
                for (const name of pkgNames) {
                    const pkgPath = path.join(pkgsDir, name)
                    rdrs.push(readPackage(pkgPath, name))
                }
                resolve(Promise.all([Promise.resolve(strays), Promise.all(rdrs)]))
            }
        })
    })
}

// Read the contents of a directory defining a package.  By convention, actions not requiring a build step are stored directly in the
// package directory.  Those requiring a build are stored in a subdirectory.  The name of each action is the single file name (sans suffix)
// or the name of the subdirectory.
function readPackage(pkgPath: string, name: string): Promise<PackageSpec> {
    // console.log("reading information for package", pkgPath)
    return new Promise(function(resolve, reject) {
       fs.readdir(pkgPath, {withFileTypes: true}, (err, items: fs.Dirent[]) => {
            if (err) {
                reject(err)
            } else {
                items = filterFiles(items)
                const promises: Promise<ActionSpec>[] = []
                const seen = {}
                for (const item of items) {
                    const filepath = path.join(pkgPath, item.name)
                    if (item.isFile()) {
                        // Directly deployable action not requiring a build.
                        const { name, runtime, binary, zipped } = actionFileToParts(item.name)
                        const before = seen[name]
                        if (before) {
                            reject(duplicateName(name, before, runtime))
                        }
                        seen[name] = runtime
                        promises.push(Promise.resolve({ name, file: filepath, runtime, binary, zipped, web: true}))
                    } else if (item.isDirectory()) {
                        // Build-dependent action or renamed action
                        const before = seen[item.name]
                        if (before) {
                            reject(duplicateName(item.name, before, "*"))
                        }
                        seen[item.name] = "*"
                        promises.push(getBuildForAction(filepath).then(build => {
                            return { name: item.name, file: filepath, build }
                        }))
                    }
                }
                resolve(Promise.all(promises))
            }
        })
    }).then((actions: ActionSpec[]) => {
        return { name: name, actions: actions, shared: false }
    })
}

// Build an error indicating o duplicate action name.  This can happen if, e.g. you have both eval.js and eval.swift
// or if you have eval.js and an action directory called eval.
function duplicateName(actionName: string, formerUse: string, newUse: string) {
    const former = formerUse === "*" ? "as a directory" : `with runtime '${formerUse}'`
    const present = newUse === "*" ? "as a directory" : `with runtime '${newUse}'`
    return new Error(`The action name '${actionName}' appears twice, once ${former} and once ${present}`)
}

// Read the config file if present.  For convenience, the extra information not provide elsewhere is tacked on here
function readConfig(configFile: string, envPath: string, filePath: string, strays: string[]): Promise<DeployStructure> {
    if (!configFile) {
        // console.log("No config file found")
        const ans = Object.assign({}, emptyStructure(), { strays, filePath })
        return Promise.resolve(ans)
    }
    // console.log("Reading config file")
    return loadProjectConfig(configFile, envPath, filePath).then(config => Object.assign({strays, filePath}, config))
}
