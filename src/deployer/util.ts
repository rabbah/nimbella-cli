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

import { DeployStructure, DeployResponse, DeploySuccess, DeployKind, ActionSpec, PackageSpec,
    DeployerAnnotation, WebResource, VersionMap, VersionEntry } from './deploy-struct'
import * as openwhisk from 'openwhisk'
import * as fs from 'fs'
import * as os from 'os'
import * as path from 'path'
import * as simplegit from 'simple-git/promise'
import * as mime from 'mime-types'
import * as randomstring from 'randomstring'
import * as crypto from 'crypto'
import { promiseFiles } from 'node-dir'
import * as yaml  from 'js-yaml'

// List of files to skip as actions inside packages, or from auto-zipping
export const FILES_TO_SKIP = [ '.gitignore', '.DS_Store' ]

//
// General utilities
//

// Read the project config file, with validation
export function loadProjectConfig(configFile: string, envPath: string, filePath: string): Promise<object> {
    return new Promise(function(resolve, reject) {
        fs.readFile(configFile, (err, data) => {
            if (err) {
                reject(err)
            } else {
                try {
                    const content = substituteFromEnvAndFiles(String(data), envPath, filePath)
                    let config: {}
                    if (configFile.endsWith(".json")) {
                        config = JSON.parse(content)
                    } else {
                        if (content.includes('\t')) {
                            reject(new Error("YAML configuration may not contain tabs"))
                            return
                        } else {
                            config = yaml.safeLoad(content)
                        }
                    }
                    const configError = validateDeployConfig(config)
                    if (configError) {
                        reject(new Error(configError))
                    } else {
                        resolve(config)
                    }
                } catch (error) {
                    if (error.message) {
                        // Attempt to remove crufty overhead from js-yaml
                        error = new Error(error.message)
                    }
                    reject(error)
                }
            }
        })
    })
}

// Validation for DeployStructure read from disk.  Note: this may be any valid DeployStructure except that the strays member
// is not expected in this context.  TODO return a list of errors not just the first error.
export function validateDeployConfig(arg: any): string {
    let haveActionWrap = false, haveBucket = false
    for (const item in arg) {
        switch (item) {
        case 'cleanNamespace':
            if (!(typeof(arg[item] == 'boolean'))) {
                return `${item} must be a boolean`
            }
            break
        case 'targetNamespace':
        case 'pkgDir':
        case 'webDir': {
            if (!(typeof(arg[item]) == 'string')) {
                return `${item} must be a string`
            }
            break
        }
        case 'web': {
            if (!Array.isArray(arg[item])) {
                return "web member must be an array"
            }
            for (const subitem of arg[item]) {
                const webError = validateWebResource(subitem)
                if (webError) {
                    return webError
                }
            }
            break
        }
        case 'packages': {
            if (!Array.isArray(arg[item])) {
                return "packages member must be an array"
            }
            for (const subitem of arg[item]) {
                const pkgError = validatePackageSpec(subitem)
                if (pkgError) {
                    return pkgError
                }
            }
            break
        }
        case 'initOptions': {
            const optionsError = validateInitOptions(arg[item])
            if (optionsError) {
                return optionsError
            }
            break
        }
        case 'actionWrapPackage': {
            haveActionWrap = true
            if (!(typeof arg[item] == 'string')) {
                return `${item} member must be a string`
            }
            break
        }
        case 'bucket': {
            haveBucket = true
            const optionsError = validateBucketSpec(arg[item])
            if (optionsError) {
                return optionsError
            }
            break
        }
        case 'parameters': // no meaningful validation for this
            break
        default:
            return `Invalid key '${item}' found in project.yml`
        }
    }
    if (haveActionWrap && haveBucket) {
        return "At most one of actionWrapPackage and bucket may be specified (config specifies both)"
    }
    return undefined
}

// Validator for BucketSpec
function validateBucketSpec(arg: {}): string {
    for (const item in arg) {
        switch(item) {
            case "prefixPath":
            case "mainPageSuffix":
            case "notFoundPage":
                if (!(typeof arg[item] == 'string')) {
                    return `'${item}' member of 'bucket' must be a string`
                }
                break
            case "strip":
                if (!(typeof arg[item] == 'number')) {
                    return `'${item}' member of 'bucket' must be a number`
                }
                break
            case "clean":
                if (!(typeof arg[item] == 'boolean')) {
                    return `'${item}' member of 'bucket' must be a boolean`
                }
                break
            default:
                return `Invalid key '${item}' found in 'bucket' in project.yml`
        }
    }
    return undefined
}

// Validator for a WebResource
function validateWebResource(arg: {}): string {
    for (const item in arg) {
        switch (item) {
            case "simpleName":
            case "mimeType":
                break;
            default:
                return `Invalid key '${item}' found in 'web' in project.yml`
        }
        if (!(typeof arg[item] == 'string')) {
            return `'${item}' member of a 'web' must be a string`
        }
    }
    return undefined
}

// Validator for a PackageSpec
function validatePackageSpec(arg: {}): string {
    const isDefault = arg['name'] === 'default'
    for (const item in arg) {
        if (item == 'name') {
            if (!(typeof arg[item] == 'string')) {
                return `'${item}' member of a 'package' must be a string`
            }
        } else if (item == 'actions') {
            if (!Array.isArray(arg[item])) {
                return "actions member of a 'package' must be an array"
            }
            for (const subitem of arg[item]) {
                const actionError = validateActionSpec(subitem)
                if (actionError) {
                    return actionError
                }
            }
        } else if (item == 'shared' || item == 'clean') {
            if (!(typeof arg[item] == 'boolean')) {
                return `'${item}' member of a 'package' must be a boolean`
            } else if (isDefault) {
                return `'${item}' may not be used in the default package`
            }
        } else if (item != 'parameters' && item != 'annotations') { // Can't meaningfully validate parameters or annotations
            return `Invalid key '${item}' found in 'package' in project.yml`
        } else if (isDefault) {
            return `'${item}' may not be used in the default package`
        }
    }
    return undefined
}

// Validator for ActionSpec
function validateActionSpec(arg: {}): string {
    for (const item in arg) {
        switch (item) {
            case 'name':
            case 'file':
            case 'runtime':
            case 'main':
                if (!(typeof arg[item] == 'string')) {
                    return `'${item}' member of an 'action' must be a string`
                }
                break
            case 'binary':
            case 'clean':
                if (!(typeof arg[item] == 'boolean')) {
                    return `'${item}' member of an 'action' must be a boolean`
                }
                break
            case 'web':
                if (!(typeof arg[item] == 'boolean' || arg[item] === 'raw')) {
                    return `${item} member of an 'action' must be a boolean or the string 'raw'`
                }
                break
            case 'webSecure':
                if (!(typeof arg[item] == 'boolean' || typeof arg[item] == 'string')) {
                    return `'${item}' member of an 'action' must be a boolean or a string`
                }
                break
            case 'annotations':
            case 'parameters':
                // No meaningful validation for these
                break
            case 'limits':
                const limitsError = validateLimits(arg[item])
                if (limitsError) {
                    return limitsError
                }
                break
            default:
                return `Invalid key '${item}' found in 'action' clause in project.yml`
        }
    }
    return undefined
}

// Validator for the limits clause
function validateLimits(arg: any): string {
    for (const item in arg) {
        const value = arg[item]
        switch (item) {
            case 'timeout':
            case 'memory':
            case 'logs':
                if (typeof value != 'number') {
                    return `'${item}' member of a 'limits' clause must be a number`
                }
                break
            default:
                return `Invalid key '${item}' found in 'limits' clause in project.yml`
        }
    }
    return undefined
}

// Validator for InitialOptions
export function validateInitOptions(arg: any): string {
    for (const item in arg) {
        const value = arg[item]
        switch(item) {
            case 'api':
            case 'api_key':
            case 'apihost':
            case 'apigw_token':
            case 'apigw_space_guid':
            case 'bucketCredentialPath':
                if (!(typeof value == 'string')) {
                    return `'${item}' must be a string`
                }
                break
            case 'ignore_certs':
                if (!(typeof value == 'boolean')) {
                    return "'ignore_certs' must be a boolean"
                }
            break
            default:
                return `Invalid key '${item}' found in 'initOptions' in project.yml`
        }
    }
    return undefined
}

// Convert convenient "Dict" to the less convenient "KeyVal[]" required in an action object
export function keyVal(from: openwhisk.Dict): openwhisk.KeyVal[] {
    if (!from) {
        return undefined
    }
    return Object.keys(from).map(key => ({key, value: from[key]}))
}

// Make an openwhisk KeyVal into an openwhisk Dict (the former appears in Action and Package, the latter in ActionSpec and PackageSpec)
export function makeDict(keyVal: openwhisk.KeyVal[]): openwhisk.Dict {
    const ans: openwhisk.Dict = {}
    keyVal.forEach(pair => {
        ans[pair.key] = pair.value
    })
    return ans
}

// Provide an empty DeployStructure with all array and object members defined but empty
export function emptyStructure(): DeployStructure {
    return { web: [], packages: [], strays: [], actionWrapPackage: undefined, bucket: undefined }
}

// Provide an empty DeployResponse with all required members defined but empty
export function emptyResponse(): DeployResponse {
    return { successes:[], failures:[], ignored: [], namespace: undefined, packageVersions: {}, actionVersions: {} }
}

// Combine multiple DeployResponses into a single DeployResponse
export function combineResponses(responses: DeployResponse[]): DeployResponse {
    if (responses.length == 0) {
        return emptyResponse()
    }
    const combinedSuccesses: DeploySuccess[][] = responses.map(response => response.successes)
    const successes = combinedSuccesses.reduce((prev, curr) => prev.concat(curr), [])
    const combinedFailures: Error[][] = responses.map(response => response.failures)
    const failures = combinedFailures.reduce((prev, curr) => prev.concat(curr), [])
    const combinedIgnored: string[][] = responses.map(response => response.ignored)
    const ignored = combinedIgnored.reduce((prev, curr) => prev.concat(curr))
    const packageVersions = responses.reduce((prev, curr) => Object.assign(prev, curr.packageVersions), {})
    const actionVersions = responses.reduce((prev, curr) => Object.assign(prev, curr.actionVersions), {})
    const webHashes = responses.reduce((prev, curr) => Object.assign(prev, curr.webHashes || {}), {})
    const namespace = responses.map(r => r.namespace).reduce((prev, curr) => prev || curr)
    return { successes, failures, ignored, packageVersions, actionVersions, webHashes, namespace}
}

// Turn the strays from a DeployStructure into a response indicating that they were skipped
export function straysToResponse(strays: string[]): DeployResponse {
    return { successes: [], ignored: strays, failures: [], packageVersions: {}, actionVersions: {},
        namespace: undefined }
}

// Wrap a single success as a DeployResponse
export function wrapSuccess(name: string, kind: DeployKind, skipped: boolean, wrapping: string, actionVersions: VersionMap,
        namespace: string): DeployResponse {
    const success: DeploySuccess = { name, kind, skipped, wrapping }
    return { successes:[ success ], failures:[], ignored: [], namespace, packageVersions: {}, actionVersions }
}

// Wrap a single error as a DeployResponse
export function wrapError(err: Error, context: string): DeployResponse {
    //console.log("wrapping an error")
    //console.dir(err, { depth: null })
    if (typeof err == 'object') {
        err['context'] = context
    }
    const result = { successes: [], failures: [ err ] , ignored: [], packageVersions: {}, actionVersions: {}, namespace: undefined }
    //console.log("wrapped error")
    //console.dir(result, { depth: null })
    return result
}

// Check whether the namespace for an OW client's current auth matches a desired target
export function isTargetNamespaceValid(client: openwhisk.Client, namespace: string): Promise<boolean> {
    return getTargetNamespace(client).then(ns => {
        if (ns == namespace) {
            return Promise.resolve(true)
        } else {
            throw new Error(`Supplied credentials do not match target namespace '${namespace}'; deployment aborted`)
        }
    })
}

// Get the target namespace
export function getTargetNamespace(client: openwhisk.Client): Promise<string> {
    return client.namespaces.list().then(ns => ns[0])
}

// Process an action file name, producing 'name', 'binary', 'zipped' and 'runtime' parts
export function actionFileToParts(fileName: string): { name: string, binary: boolean, zipped: boolean, runtime: string } {
    let runtime: string = undefined
    let binary: boolean = undefined
    let zipped: boolean = undefined
    let name = fileName
    let split = fileName.indexOf(".")
    if (split > 0) {
        const parts = fileName.split('.')
        const ext = parts[parts.length - 1]
        let mid: string = undefined
        if (parts.length == 2)  {
            name = parts[0]
        } else if (ext == 'zip') {
            mid = parts[parts.length - 2]
            name = parts.slice(0, parts.length - 2).join('.')
        } else {
            name = parts.slice(0, parts.length - 1).join('.')
        }
        runtime = mid ? runtimeFromZipMid(mid) : runtimeFromExt(ext)
        binary = binaryFromExt(ext)
        zipped = ext == 'zip'
    }
    // const z = zipped ? "" : "not "
    // console.log(`action ${name} is ${z}zipped`)
    return { name, binary, zipped, runtime }
}

// The following tables are populated (once) by reading a copy of runtimes.json

// Table of extensions, providing the unqualified runtime 'kind' for each extension
type ExtensionToRuntime = { [ key: string]: string }
const extTable: ExtensionToRuntime = { }

// Table of extensions, saying whether the extension implies binary or not
type ExtensionToBinary = { [ key: string]: boolean }
const extBinaryTable: ExtensionToBinary = {
    zip: true
}

// A map from actual runtime names, full colon-separated syntax, to lists of possible extensions
type RuntimeToExtensions = { [ key: string]: string[] }
const validRuntimes: RuntimeToExtensions = { }

// Provide information from runtimes.json, reading it at most once
let runtimesRead = false
type ExtensionDetail = { binary: boolean }
type ExtensionEntry = { [ key: string]: ExtensionDetail }
type RuntimeEntry = { kind: string, default: boolean, extensions: ExtensionEntry }
type RuntimeTable = { [ key: string ]: RuntimeEntry[] }
function initRuntimes() {
    if (!runtimesRead) {
        runtimesRead = true
        const runtimes: RuntimeTable = require('../../runtimes.json').runtimes
        for (const runtime in runtimes) {
            const runtimeEntries: RuntimeEntry[] = runtimes[runtime]
            for (const entry of runtimeEntries) {
                const extensionNames = Object.keys(entry.extensions)
                validRuntimes[entry.kind] = extensionNames
                if (entry.default) {
                    // TODO we do not yet support per-kind extensions but assume that the extension of a default kind applies to the entire
                    // runtime class
                    validRuntimes[runtime + ':default'] = extensionNames
                    for (const ext of extensionNames) {
                        extTable[ext] = runtime
                        extBinaryTable[ext] = entry.extensions[ext].binary
                    }
                }
            }
        }
        // TEMP debugging:
        // console.log("Extension table")
        // console.dir(extTable, { depth: null })
        // console.log("Extension binary table")
        // console.dir(extBinaryTable, { depth: null })
        // console.log("Valid runtimes table")
        // console.dir(validRuntimes, { depth: null })
    }
}

// Compute the runtime from the file extension.
function runtimeFromExt(ext: string): string {
    initRuntimes()
    if (extTable[ext]) {
        return extTable[ext] + ":default"
    }
    return undefined
}

// Compute a runtime kind from the 'mid string' of a file name of the form name.runtime.zip
function runtimeFromZipMid(mid: string): string {
    if (mid.includes('-')) {
        return validateRuntime(mid.replace('-', ':'))
    } else {
        return validateRuntime(mid + ":default")
    }
}

// Compute the file extension from a runtime name.  It is a non-fatal exception for the caller to request a binary extension for
// a runtime that has only non-binary ones (or vice versa).  However, the runtime name should not depend on user-provided
// data and should always be valid.
export function extFromRuntime(runtime: string, binary: boolean): string {
    initRuntimes()
    if (validRuntimes[runtime]) {
        const extArray = validRuntimes[runtime]
        for (const ext of extArray) {
            const binaryExt = binaryFromExt(ext)
            if (binaryExt === binary) {
                return ext
            }
        }
        return undefined
    }
    throw new Error(`Invalid runtime ${runtime} encountered`)
}

// Validate that a colon separated string actually IS a valid runtime.  Returns the string if so and undefined if not.
function validateRuntime(kind: string): string {
    initRuntimes()
    if (kind in validRuntimes) {
        return kind
    }
    return undefined
}

// Determine whether a given extension implies binary data
function binaryFromExt(ext: string): boolean {
    return !!extBinaryTable[ext] // turn undefined into false
}

// Filters temp files from an array of Dirent structures
export function filterFiles(entries: fs.Dirent[]): fs.Dirent[] {
    return entries.filter(entry => {
        if (entry.isFile()) {
            return !entry.name.endsWith('~') && FILES_TO_SKIP.every(_ => entry.name !== _)
        } else {
            return entry
        }
    })
}

// Combines promiseFiles (from node-dir) with the equivalent of filterFiles
export function promiseFilesAndFilterFiles(root: string): Promise<string[]> {
    return promiseFiles(root).then((items: string[]) => items.filter((item: string) => !item.endsWith('~')))
}

// Substitute from the environment and from files.  Variable references look like template variables: ${FOO} reads the
// contents of variable FOO.  Variables may be found in the process environment (higher precedence) or in the property file
// located at 'envPath' (lower precedence, and only if 'envPath is defined).
// ${<path} reads the contents of a file at the given path relative to the project root.
// The semantics of variable substitution are purely textual (whatever is in the variable is substituted).
// The semantics of file substitution are richer (see getSubstituteFromFile)
export function substituteFromEnvAndFiles(input: string, envPath: string, projectPath: string): string {
    // console.log("before:")
    // console.log(input)
    let result = ""  // Will accumulate the result
    const badVars: string[] = [] // Will accumulate failures to resolve
    const props = envPath ? getPropsFromFile(envPath) : {}
    let nextBreak = input.indexOf("${")
    while (nextBreak >= 0) {
        const before = input.substr(0, nextBreak)
        const after = input.substr(nextBreak + 2)
        const endVar = after.indexOf("}")
        if (endVar < 0) {
            throw new Error("Runaway variable name or path directive in project.yml")
        }
        let subst: string
        const envar = after.substr(0, endVar)
        if (envar.startsWith('<')) {
            const fileSubst = path.join(projectPath, envar.slice(1))
            subst = getSubstituteFromFile(fileSubst)
        } else {
            subst = process.env[envar] || props[envar]
         }
           if (!subst) {
            badVars.push(envar)
            subst=""
        }
        result = result + before + subst
        input = after.substr(endVar + 1)
        nextBreak = input.indexOf("${")
    }
    if (badVars.length > 0) {
        const formatted = "'" + badVars.join("', '") + "'"
        throw new Error("The following substitutions could not be resolved: " + formatted)
    }
    return result + input
}

// Get a substitution JSON string from a file.  The file is read and, if it is valid JSON, it is simply used as is.
// Otherwise, it is reparsed as a properties file and the result is converted to JSON.  If the file is neither a valid JSON
// file nor a valid properties file, that is an error.
function getSubstituteFromFile(path: string): string {
    if (!fs.existsSync(path) || !fs.lstatSync(path).isFile()) {
        return undefined
    }
    const props = getPropsFromFile(path)
    const answer = JSON.stringify(props)
    return answer === '{}' ? undefined : answer
}

// Get properties from a file, which may be a properties file or JSON
function getPropsFromFile(filePath: string): object {
    if (!fs.existsSync(filePath)) {
        return {}
    }
    const contents = String(fs.readFileSync(filePath))
    try {
        return JSON.parse(contents)
    } catch {}
    // It's not JSON, so see if it's a properties file
    const propParser = require('dotenv')
    // The dotenv parser doesn't throw but returns the empty object if malformed
    return propParser.parse(contents)
}

// Convert an array of names to an array of WebResources.
export function convertToResources(names: string[], dropInitial: number): WebResource[] {
    return names.map(filePath => {
        let simpleName = filePath.substring(dropInitial)
        const mimeType = mime.lookup(simpleName) || undefined
        return { filePath, simpleName, mimeType }
    })
}

// Convert an array of pairs with old and new names to an array of WebResources, where the new name is (in general) a truncation of the old name
export function convertPairsToResources(pairs: string[][]): WebResource[] {
    return pairs.map(pair => {
        const [filePath, simpleName] = pair
        const mimeType = mime.lookup(simpleName) || undefined
        return { filePath, simpleName, mimeType }
    })
}

// Types for the map versions of the PackageSpec and ActionSpec types
export interface PackageMap {
    [ key: string]: PackageSpec
}
export interface ActionMap {
    [ key: string]: ActionSpec
}

// Turn a PackageSpec array into a PackageMap
export function mapPackages(packages: PackageSpec[]): PackageMap {
    const ans: PackageMap = {}
    for (const pkg of packages) {
        ans[pkg.name] = pkg
    }
    return ans
}

// Turn an ActionSpec array into an ActionMap
export function mapActions(actions: ActionSpec[]): ActionMap {
    const ans: ActionMap = {}
    for (const action of actions) {
        ans[action.name] = action
    }
    return ans
}

// Calculate the 'deployer' annotation for inclusion in package and action annotations.  This won't change
// in the course of a deploy run so can be calculated once for inclusion in everything that is deployed.
export async function getDeployerAnnotation(project: string): Promise<DeployerAnnotation> {
    const digest = undefined
    try {
        const git = simplegit().silent(true)
        const root = await git.revparse(['--show-toplevel'])
        const repo = await git.raw(['config', '--get', 'remote.origin.url'])
        const user = await git.raw(['config', '--get', 'user.email'])
        const projectPath = path.relative(root, path.resolve(project))
        let commit = await git.revparse(['head'])
        commit = commit.substring(0, 8)
        const status = await git.status()
        if (!status.isClean()) {
            commit += '++'
        }
        return { user, repository: repo.trim(), projectPath, commit, digest }
    } catch {
        const user = os.userInfo().username
        const projectPath = path.resolve(project)
        return { user, projectPath, digest }
    }
}

// Wipe all the entities from the namespace referred to by an OW client handle
export async function wipe(client: openwhisk.Client) {
    await wipeAll(client.actions, "Action")
    //console.log("Actions wiped")
    await wipeAll(client.rules, "Rule")
    //console.log("Rules wiped")
    await wipeAll(client.triggers, "Trigger")
    //console.log("Triggers wiped")
    await wipeAll(client.packages, "Package")
    //console.log("Packages wiped")
}

// Repeatedly wipe an entity (action, rule, trigger, or package) from the namespace denoted by the OW client until none are left
// Note that the list function can only return 200 entities at a time)
async function wipeAll(handle: any, kind: string) {
    while (true) {
        const entities = await handle.list({ limit: 200 })
        if (entities.length == 0) {
            return
        }
        for (const entity of entities) {
            let name = entity.name
            const nsparts = entity.namespace.split('/')
            if (nsparts.length > 1) {
                name = nsparts[1] + '/' + name
            }
            await handle.delete(name)
            //console.log(kind, name, "deleted")
        }
    }
}

// Generate a secret in the form of a random alphameric string (TODO what form(s) do we actually support)
export function generateSecret(): string {
    return randomstring.generate()
}

// Guard against accidental deployment to a sensitive namespace on a production host
// Not called if the --production flag was set.
// 'nim install actions' will set this flag.
// The workbench 'project deploy' command will never set this flag
// Developers using the deployProject CLI may set this flag but presumably will only do so by intention.
export function saveUsFromOurselves(namespace: string, apihost: string) {
    let sensitiveNamespaces : string[]
    let productionProjects : string[]
    try {
        sensitiveNamespaces = require('../../sensitiveNamespaces.json')
        productionProjects = require('../../productionProjects.json')
    } catch (_) {
        // Customers don't need a --production flag ... their auth token defines what they can and can't do
        return
    }
    if (sensitiveNamespaces.includes(namespace) && isProductionProject(apihost, productionProjects)) {
        throw new Error(`To deploy to namespace '${namespace}' on host '${apihost}' you must specifiy the '--production' flag`)
    }
}

// Determine whether an apihost (given as a string URL) denotes any of a list of projects
function isProductionProject(apihost: string, productionProjects: string[]): boolean {
    const url = new URL(apihost)
    const domain = url.hostname.split('.')[0]
    if (domain == 'api') {
        return true
    }
    const project = domain.replace('api', 'nim')
    return productionProjects.includes(project)
}

// Compute the digest of a PackageSpec
export function digestPackage(pkg: PackageSpec): string {
    const hash = crypto.createHash("sha256")
    digestBoolean(hash, pkg.shared)
    digestBoolean(hash, pkg.clean)
    digestDictionary(hash, pkg.annotations)
    digestDictionary(hash, pkg.parameters)
    for (const action of pkg.actions || []) {
        hash.update(action.name)
    }
    return String(hash.digest('hex'))
}

function digestBoolean(hash: crypto.Hash, toDigest: boolean) {
    hash.update(String(!!toDigest))
}

function digestDictionary(hash: crypto.Hash, toDigest: {}) {
    if (toDigest) {
        const keys = Object.keys(toDigest).sort()
        for (const key of keys) {
            hash.update(key)
            const value = toDigest[key]
            switch (typeof value) {
                case 'string':
                    hash.update(value)
                    break
                case 'boolean':
                    digestBoolean(hash, value)
                    break
                case 'object':
                    digestDictionary(hash, value)
                    break
                default: // number, bigint ... and some exotic cases  TODO: need we do better?
                    hash.update(String(value))
                    break
            }
        }
    }
}

// Compute the digest of an ActionSpec.  Code is provided as a separate argument (code member of the ActionSpec will either be identical or undefined)
export function digestAction(action: ActionSpec, code: string): string {
    const hash = crypto.createHash("sha256")
    digestBoolean(hash, action.clean)
    digestBoolean(hash, action.binary)
    digestBoolean(hash, action.zipped)
    hash.update(String(action.web))
    hash.update(String(action.webSecure))
    digestDictionary(hash, action.annotations)
    digestDictionary(hash, action.parameters)
    digestDictionary(hash, action.limits)
    hash.update(code)
    if (action.main) {
        hash.update(action.main)
    }
    hash.update(action.runtime)
    return String(hash.digest('hex'))
}

// Called after a deploy step to record important information from the DeployResponse into the project.
// Essentially a dual of loadVersions but not quite symmetrical since its argument is a DeployResponse
export function writeProjectStatus(project: string, results: DeployResponse) {
    const { apihost, namespace, packageVersions, actionVersions, webHashes } = results
    if (Object.keys(actionVersions).length == 0 && Object.keys(packageVersions).length == 0) {
        return
    }
    const statusDir = path.join(project, ".nimbella")
    if (!fs.existsSync(statusDir)) {
        fs.mkdirSync(statusDir)
        console.log(`Deployment status recorded in '${statusDir}'`)
    }
    let versionList: VersionEntry[] = []
    const versionFile = path.join(statusDir, "versions.json")
    if (fs.existsSync(versionFile)) {
        const old = JSON.parse(String(fs.readFileSync(versionFile)))
        if (Array.isArray(old)) {
            versionList = old
        } // Otherwise (not array) it is the legacy format and cannot be added to so we just overwrite
    }
    const versionInfo: VersionEntry = { apihost, namespace, packageVersions, actionVersions, webHashes }
    let newEntry = true
    for (let i = 0; i < versionList.length; i++) {
        if (versionList[i].apihost == apihost && versionList[i].namespace == namespace) {
            versionList[i] = versionInfo
            newEntry = false
            break
        }
    }
    if (newEntry) {
        versionList.push(versionInfo)
    }
    fs.writeFileSync(versionFile, JSON.stringify(versionList, null, 2))
}

// Load the version information of a project for a namespace and apihost.  Return an appropriately empty structure if not found.
export function loadVersions(projectPath: string, namespace: string, apihost: string): VersionEntry {
    const versionFile = path.join(projectPath, ".nimbella", "versions.json")
    if (fs.existsSync(versionFile)) {
        const allEntries = JSON.parse(String(fs.readFileSync(versionFile)))
        for (const entry of allEntries) {
            if (namespace == entry.namespace && apihost == entry.apihost) {
                return entry
            }
        }
    }
    return { namespace, apihost, packageVersions: {}, actionVersions: {}, webHashes: {} }
}