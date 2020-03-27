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

import * as path from 'path'
import { DeployStructure, PackageSpec, ActionSpec, WebResource, Includer, ProjectReader, PathKind, Feedback } from './deploy-struct'
import { emptyStructure, actionFileToParts, filterFiles, convertToResources, promiseFilesAndFilterFiles, loadProjectConfig } from './util'
import { getBuildForAction, getBuildForWeb } from  './finder-builder'
import { isGithubRef, parseGithubRef, fetchProject } from './github'
import * as makeDebug from 'debug'
const debug = makeDebug('nim:deployer:project-reader')
import { makeFileReader } from './file-reader';
import { makeGithubReader } from './github-reader';

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
    githubPath: string
    includer: Includer
    reader: ProjectReader
    feedback: Feedback
}
export async function readTopLevel(filePath: string, env: string, userAgent: string, includer: Includer,
        mustBeLocal: boolean, feedback: Feedback): Promise<TopLevel> {
    // The mustBeLocal arg is only important if the filePath denotes a github location.  In that case, a true value for
    // mustBeLocal causes the github contents to be fetched to a local cache and a FileReader is used.  A false value
    // causes a GithubReader to be used.
    debug("readTopLevel with filePath:'%s' and mustBeLocal:'%s'", filePath, String(mustBeLocal))
    debug("feedback is %O", feedback)
    let githubPath: string = undefined
    let reader = makeFileReader(filePath) // Only useful iff it turns out filePath != github
    if (isGithubRef(filePath)) {
        const github = parseGithubRef(filePath)
        if (!github.auth) {
            feedback.warn('Warning: access to github will be un-authenticated; rate will be severely limited')
        }
        githubPath = filePath
        if (mustBeLocal) {
            filePath = await fetchProject(github, userAgent)
            reader = makeFileReader(filePath)
        } else {
            reader = makeGithubReader(github, userAgent)
        }
    }
    const webDir = 'web', pkgDir = 'packages'
    return reader.readdir('').then(items => {
        items = filterFiles(items)
        let web: string
        let config: string
        let notconfig: string
        let legacyConfig: string
        let packages: string
        const strays: string[] = []
        for (const item of items) {
            if (item.isDirectory) {
                switch(item.name) {
                    case webDir:
                        if (includer.isWebIncluded)
                            web = webDir
                        break
                    case pkgDir:
                        packages = pkgDir
                        break
                    case '.nimbella':
                        break
                    default:
                        strays.push(item.name)
                }
            } else if (!item.isDirectory && item.name == CONFIG_FILE) {
                config = item.name
            } else if (!item.isDirectory && item.name == LEGACY_CONFIG_FILE) {
                legacyConfig = item.name
            } else if (!item.isDirectory && (item.name.endsWith(".yml") || item.name.endsWith(".yaml"))) {
                notconfig = item.name
            } else if (!env && !item.isDirectory && item.name == ENV_FILE) {
                // Env file reading will not go through the reader so use a path that includes a path to the project
                env = path.join(filePath, item.name)
            } else {
                strays.push(item.name)
            }
        }
        if (legacyConfig && !config) {
            config = legacyConfig
            feedback.warn(`Warning: the name '${LEGACY_CONFIG_FILE}' is deprecated; please rename to '${CONFIG_FILE}' soon`)
        }
        if (notconfig && !config) {
            feedback.warn("Warning: found", notconfig, "but no", CONFIG_FILE)
        }
        if (githubPath) {
            debug('githhub path was %s', githubPath)
            debug('filePath is %s', filePath)
        }
        const ans = { web, packages, config, strays, filePath, env, githubPath, includer, reader, feedback }
        debug('readTopLevel returning %O', ans)
        return ans
    })
}

// Probe the top level structure to obtain the major parts of the final config.  Spawn builders for those parts and
// assemble a "Promise.all" for the combined work
export function buildStructureParts(topLevel: TopLevel): Promise<DeployStructure[]> {
    const { web, packages, config, strays, filePath, env, githubPath, includer, reader, feedback } = topLevel
    let packagesGithub = packages
    if (githubPath) {
        if (packages) {
            packagesGithub = path.join(githubPath, packages)
        }
    }
    debug('display path for actions is %O', packagesGithub)
    return new Promise(function(resolve) {
        const webPart = getBuildForWeb(web, reader).then(build => buildWebPart(web, build, reader))
        const actionsPart = buildActionsPart(packages, packagesGithub, includer, reader)
        const configPart = readConfig(config, env, filePath, strays, githubPath, includer, reader, feedback)
        resolve(Promise.all([webPart, actionsPart, configPart]))
    })
}

// Assemble a complete initial structure containing all file system information and config.  May be deployed as is or adjusted
// before deployment.  Input is the resolved output of buildStructureParts.  At this point, the web part may have names that
// are only suitable for bucket deploy so we check for that problem here.
export function assembleInitialStructure(parts: DeployStructure[]): DeployStructure {
    debug("Assembling structure from parts")
    const [ webPart, actionsPart, configPart ] = parts
    const strays = (actionsPart.strays || []).concat(configPart.strays || [])
    configPart.strays = strays
    configPart.web = (webPart.web && configPart.web) ? mergeWeb(webPart.web, configPart.web) :
        webPart.web ? webPart.web : configPart.web ? configPart.web : []
    configPart.packages = (actionsPart.packages && configPart.packages) ? mergePackages(actionsPart.packages, configPart.packages) :
        actionsPart.packages ? actionsPart.packages : configPart.packages ? configPart.packages : []
    adjustWebExportFlags(configPart.packages)
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

// Adjust the web export value for the actions of the project.  For each action that already has this property set, leave it alone.
// Otherwise, if its package specifies a web export value use it.   Otherwise, apply the default of 'true'.   Must test explicitly
// for 'undefined' type since false is a real value but is falsey.
function adjustWebExportFlags(pkgs: PackageSpec[]) {
    pkgs.forEach(pkg => {
        if (pkg.actions) {
            pkg.actions.forEach(action => {
                if (typeof action.web === 'undefined') {
                    action.web = (typeof pkg.web === 'undefined') ? true : pkg.web
                }
            })
        }
    })
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
    debug("Action from filesystem: %O", fs)
    debug("Action from config: %O", config)
    const result = Object.assign({}, fs, config)
    debug("Result of merge: %O", result)
    return result
}

// Probe the web directory.  We find all files even under subdirectories (no strays here).  However, if we turn out to be
// action-wrapping (which is not known at this point), file names with slashes will cause an error later.
function buildWebPart(webdir: string, build: string, reader: ProjectReader): Promise<DeployStructure> {
    if (!webdir) {
        return Promise.resolve(emptyStructure())
    } else {
        return readWebResources(webdir, reader).then(resources => {
            return { web: resources, webBuild: build, packages: [], strays: [] }
        })
    }
}

// Read the resources of the web directory
function readWebResources(webdir: string, reader: ProjectReader): Promise<WebResource[]> {
    debug('readWebResources for %s', webdir)
    return promiseFilesAndFilterFiles(webdir, reader).then((items: string[]) => {
        return convertToResources(items, webdir.length + 1)
    })
}

// Probe the packages directory
function buildActionsPart(pkgsdir: string, displayPath: string, includer: Includer, reader: ProjectReader): Promise<DeployStructure> {
    if (!pkgsdir) {
        return Promise.resolve(emptyStructure())
    } else {
        return buildPkgArray(pkgsdir, displayPath, includer, reader).then((values) => {
            const [ strays, pkgs] = values
            return { web: [], packages: pkgs, strays: strays }
        })
    }
}

// Accumulate the arrays of PackageSpecs and Strays in the 'packages' directory
function buildPkgArray(pkgsDir: string, displayPath: string, includer: Includer, reader: ProjectReader): Promise<any> {
    debug("Building package array")
    return reader.readdir(pkgsDir).then((items: PathKind[]) => {
        items = filterFiles(items)
        const strays = items.filter(dirent => !dirent.isDirectory).map(dirent => dirent.name)
        const pkgNames = items.filter(dirent => dirent.isDirectory).map(dirent => dirent.name)
        const rdrs: Promise<PackageSpec>[] = []
        for (const name of pkgNames) {
            if (includer.isPackageIncluded(name)) {
                const pkgPath = path.join(pkgsDir, name)
                rdrs.push(readPackage(pkgPath, path.join(displayPath, name), name, includer, reader))
            }
        }
        return Promise.all([Promise.resolve(strays), Promise.all(rdrs)])
    })
}

// Read the contents of a directory defining a package.  By convention, actions not requiring a build step are stored directly in the
// package directory.  Those requiring a build are stored in a subdirectory.  The name of each action is the single file name (sans suffix)
// or the name of the subdirectory.
function readPackage(pkgPath: string, displayPath: string, pkgName: string, includer: Includer, reader: ProjectReader): Promise<PackageSpec> {
    debug("reading information for package '%s' with display path '%s'", pkgPath, displayPath)
    return reader.readdir(pkgPath).then((items: PathKind[]) => {
        items = filterFiles(items)
        const promises: Promise<ActionSpec>[] = []
        const seen = {}
        for (const item of items) {
            const file = path.join(pkgPath, item.name)
            const displayFile = path.join(displayPath, item.name)
            debug('item %s has display path %s', item.name, displayFile)
            if (!item.isDirectory) {
                // Directly deployable action not requiring a build.
                const { name, runtime, binary, zipped } = actionFileToParts(item.name)
                if (!includer.isActionIncluded(pkgName, name)) continue
                const before = seen[name]
                if (before) {
                    throw duplicateName(name, before, runtime)
                }
                seen[name] = runtime
                promises.push(Promise.resolve({ name, file, displayFile, runtime, binary, zipped }))
            } else if (item.isDirectory) {
                // Build-dependent action or renamed action
                if (!includer.isActionIncluded(pkgName, item.name)) continue
                const before = seen[item.name]
                if (before) {
                    throw duplicateName(item.name, before, "*")
                }
                seen[item.name] = "*"
                promises.push(getBuildForAction(file, reader).then(build => {
                    return { name: item.name, file, displayFile, build }
                }))
            }
        }
        return Promise.all(promises)
    }).then((actions: ActionSpec[]) => {
        return { name: pkgName, actions: actions, shared: false }
    })
}

// Build an error indicating o duplicate action name.  This can happen if, e.g. you have both eval.js and eval.swift
// or if you have eval.js and an action directory called eval.
function duplicateName(actionName: string, formerUse: string, newUse: string) {
    const former = formerUse === "*" ? "as a directory" : `with runtime '${formerUse}'`
    const present = newUse === "*" ? "as a directory" : `with runtime '${newUse}'`
    return new Error(`The action name '${actionName}' appears twice, once ${former} and once ${present}`)
}

// Read the config file if present.  For convenience, the extra information not merged from elsewhere is tacked on here
function readConfig(configFile: string, envPath: string, filePath: string, strays: string[], githubPath: string,
        includer: Includer, reader: ProjectReader, feedback: Feedback): Promise<DeployStructure> {
    const alwaysIncluded = { strays, filePath, githubPath, includer, reader, feedback }
    if (!configFile) {
        debug("No config file found")
        const ans = Object.assign({}, emptyStructure(), alwaysIncluded)
        return Promise.resolve(ans)
    }
    debug("Reading config file")
    return loadProjectConfig(configFile, envPath, filePath, reader).then(config => trimConfigWithIncluder(config, includer))
        .then(config => Object.assign({}, config, alwaysIncluded))
}

// Given a DeployStructure with web and package sections, trim those sections according to the rules of an Includer
function trimConfigWithIncluder(config: DeployStructure, includer: Includer): DeployStructure {
    if (!includer.isWebIncluded) {
        config.web = []
        config.bucket = undefined
        config.actionWrapPackage = ''
    }
    if (config.packages) {
        const newPkgs: PackageSpec[] = []
        for (const pkg of config.packages) {
            if (includer.isPackageIncluded(pkg.name)) {
                if (pkg.actions) {
                    pkg.actions = pkg.actions.filter(action => includer.isActionIncluded(pkg.name, action.name))
                }
                newPkgs.push(pkg)
            }
        }
        config.packages = newPkgs
    }
    return config
}
