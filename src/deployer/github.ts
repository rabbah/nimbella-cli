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

// Adjunct to the project-reader when a project is defined as a set of github coordinates.

import * as Path from 'path'
import * as fs from 'fs'
import * as Octokit from '@octokit/rest'
import * as rimrafOrig from 'rimraf'
import { promisify } from 'util'
import * as makeDebug from 'debug'
import { authPersister } from '../NimBaseCommand'

const rimraf = promisify(rimrafOrig)
const debug = makeDebug('nim:deployer:github')

const TEMP = process.platform == 'win32' ? process.env['TEMP'] : '/tmp'
const CACHE_DIR = "deployer-git-cache"
function cacheDir() {
    return Path.join(TEMP, CACHE_DIR)
}

const prefixes = [ 'github:', 'https://github.com/', 'git@github.com:' ]

// Github coordinate definition structure
export interface GithubDef {
    repoPath: string
    owner: string
    repo: string
    path: string
    auth?: string
    ref?: string
}

// Test whether a project path is a github ref
export function isGithubRef(projectPath: string): boolean {
    for (const prefix of prefixes) {
        if (projectPath.startsWith(prefix)) {
            return true
        }
    }
    return false
}

// Parse a project path that claims to be a github ref into a GithubDef.  Throws on ill-formed
export function parseGithubRef(projectPath: string): GithubDef {
    let toParse: string = undefined
    let repoPath: string = undefined
    for (const prefix of prefixes) {
        if (projectPath.startsWith(prefix)) {
            repoPath = prefix
            toParse = projectPath.replace(prefix, '')
            break
        }
    }
    if (!toParse) {
        throw new Error('internal error: parseGithubRef should not have been called')
    }
    while (toParse.startsWith('/')) {
        toParse = toParse.slice(1)
        repoPath += '/'
    }
    const hashSplit = toParse.split('#')
    let ref: string = undefined
    if (hashSplit.length > 2) {
        throw new Error('too many # characters in github reference')
    } else if (hashSplit.length == 2) {
        ref = hashSplit[1]
        toParse = hashSplit[0]
    }
    const slashSplit = toParse.split('/')
    if (slashSplit.length < 2) {
        throw new Error('too few / characters in github reference; at least <owner>/<repo> is required')
    }
    const owner = slashSplit[0]
    let repo = slashSplit[1]
    if (repo.endsWith('.git')) {
        repo = repo.slice(0, repo.length - 4)
    }
    repoPath = Path.join(repoPath, owner, repo)
    const path = slashSplit.slice(2).join('/')
    const store = authPersister.loadCredentialStoreIfPresent()
    let auth = undefined
    if (store && store.github && store.currentGithub) {
        auth = store.github[store.currentGithub]
    }
    return { repoPath, owner, repo, path, auth, ref}
}

// Fetch a project into the cache, returning a path to its location
export async function fetchProject(def: GithubDef, userAgent: string): Promise<string> {
    if (!fs.existsSync(cacheDir())) {
        fs.mkdirSync(cacheDir())
    }
    const cachedir = `${def.owner}_${def.repo}_${def.path.split('/').join('_')}`
    const location = Path.join(cacheDir(), cachedir)
    await rimraf(location)
    fs.mkdirSync(location)
    debug('fetching project %O', def)
    await fetchDir(makeClient(def, userAgent), def, def.path, location, true)
    return location
}

// Make a github client
export function makeClient(def: GithubDef, userAgent: string): Octokit {
    return new Octokit({ auth: def.auth, userAgent })
}

// Get contents from a github repo at specific coordinates (path and ref).  All but the path
// are taken from a GithubDef.  The path is specified as an argument.
export async function readContents(client: Octokit, def: GithubDef, path: string) {
    debug('reading %O at %s', def, path)
    const {owner, repo, ref} = def
    const contents = await client.repos.getContents(ref ? {owner, repo, path, ref} : { owner, repo, path })
    if (contents.status !== 200) {
        throw new Error(`Reading path '${path}' from ${def.owner}/${def.repo}' failed with status code ${contents.status}`)
    }
    if (!contents.data) {
        throw new Error(`Reading path '${path}' from ${def.owner}/${def.repo}' succeeded but provided no data`)
    }
    return contents.data
}

// Test whether the 'data' array of a repo read response implies that the contents are a project
export function seemsToBeProject(data: Octokit.ReposGetContentsResponse): boolean {
    if (Array.isArray(data)) {
        const items = data as Octokit.ReposGetContentsResponseItem[]
        for (const item of items) {
            if (item.name == 'project.yml' && item.type == 'file') return true
            if (['packages', 'actions'].includes(item.name) && item.type == 'dir') return true
        }
    }
    return false
}

// Fetch a directory into a cache location.
async function fetchDir(client: Octokit, def: GithubDef, path: string, location: string, validate: boolean) {
    const contents = await readContents(client, def, path)
    if (!Array.isArray(contents)) {
        console.dir(contents, { depth: null })
        throw new Error(`Path '${path} should be a directory but is not`)
    }
    if (validate && !seemsToBeProject(contents)) {
        throw new Error(`Github location does not contain a 'nim' project`)
    }
    let promise: Promise<any> = Promise.resolve(undefined)
    for (const item of contents as Octokit.ReposGetContentsResponseItem[]) {
        const target = Path.join(location, item.name)
        if (item.type == 'dir') {
            fs.mkdirSync(target)
            promise = promise.then(() => fetchDir(client, def, item.path, target, false))
        } else {
            promise = promise.then(() => fetchFile(client, def, item.path, target))
        }
    }
    await promise
}

// Fetch a file into a cache location.   The 'def' argument is used to supply owner,
// repo and ref.   The auth member is already encoded in the client.  The path is taken from the path argument
async function fetchFile(client: Octokit, def: GithubDef, path: string, location: string) {
    const data = await readContents(client, def, path)
    // Careful with the following: we want to support empty files but the empty string is falsey.
    if (typeof data['content'] !== 'string'  || !data['encoding']) {
        console.dir(data, { depth: null })
        throw new Error(`Response from 'fetchFile' was not interpretable`)
    }
    const toWrite = Buffer.from(data['content'], data['encoding'])
    let mode = 0o666
    if (location.endsWith('.sh') || location.endsWith('.cmd')) {
        mode = 0o777
    }
    fs.writeFileSync(location, toWrite, { mode })
}
