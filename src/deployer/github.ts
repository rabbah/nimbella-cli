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
// There are two levels of information store
// 1.  a mapping of project names to GithubProject structures
//    - can be stored in the file system or in localStorage so it can be maintained in a browser
//    - the goal would be to read this info in a browser and send the GithubProject to a cloud service to do the rest
// 2.  an area in the file system where projects are staged after being retrieved from github.
//    - the retrieval and subsequent steps cannot be run in a browser
//    - it would be run in the nim command locally (now) or in the the remote service used by nim in the browser (future)

import * as Path from 'path'
import * as fs from 'fs'
import * as Octokit from '@octokit/rest'
import * as rimrafOrig from 'rimraf'
import { promisify } from 'util'
import { nimbellaDir } from './login'

const rimraf = promisify(rimrafOrig)

const TEMP = process.platform == 'win32' ? process.env['TEMP'] : '/tmp'
const CACHE_DIR = "deployer-git-cache"
const PROJECT_MAP_KEY = 'wb.project_map'
const PROJECT_MAP_FILE = 'gitProjectMap.json'
const userAgent = 'nimbella-cli v1.0.0'  // TODO get the version dynamically
function cacheDir() {
    return Path.join(TEMP, CACHE_DIR)
}
function projectMapFile() {
    return Path.join(nimbellaDir(), PROJECT_MAP_FILE)
}

// Project definition structure
export interface GithubDef {
    name: string
    owner: string
    repo: string
    path: string
    auth?: string
    ref?: string
}

// Project map structure
type ProjectMap = { [key: string]: GithubDef }

 // Find project definition in the PROJECT_MAP
export function getGithubDef(projectName: string, inBrowser: boolean): GithubDef {
    const map = readProjectMap(inBrowser)
    return map[projectName]
}

// Get all the github defs
export function getAllGithubDefs(inBrowser: boolean): GithubDef[] {
    const map = readProjectMap(inBrowser)
    return Object.values(map)
}

// Write a project definition into the project map
export function storeGithubDef(def: GithubDef, inBrowser: boolean, replace: boolean): boolean {
    const map = readProjectMap(inBrowser)
    if (map[def.name] && !replace) {
        return false
    }
    map[def.name] = def
    storeProjectMap(map, inBrowser)
    return true
}

// Remove a project definition from the map
export function removeGithubDef(name: string, inBrowser: boolean): boolean {
    const map = readProjectMap(inBrowser)
    const entry = map[name]
    if (!entry) {
        return false
    }
    delete map[name]
    storeProjectMap(map, inBrowser)
    return true
}

// Validate a def (test existence of the repo and path and whether auth permits retrieval; also whether the path superficially appears to be a project)
export async function validateRepo(def: GithubDef) {
    const contents = await readContents(makeClient(def), def, def.path)
     if (!seemsToBeProject(contents)) {
        throw new Error(`Although '${def.name}' denotes a valid github location, that location does not contain a 'nim' project`)
    }
}

// Fetch a project into the cache, returning a path to its location
export async function fetchProject(def: GithubDef): Promise<string> {
    if (!fs.existsSync(cacheDir())) {
        fs.mkdirSync(cacheDir())
    }
    const location = Path.join(cacheDir(), def.name)
    await rimraf(location)
    fs.mkdirSync(location)
    await fetchDir(makeClient(def), def, def.path, location)
    return location
}

// Make a github client
function makeClient(def: GithubDef): Octokit {
    return new Octokit({ auth: def.auth, userAgent })
}

// Get contents from a github repo at specific coordinates (path and ref).  All but the path
// are taken from a GithubDef.  The path is specified as an argument.
async function readContents(client: Octokit, def: GithubDef, path: string) {
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
function seemsToBeProject(data: Octokit.ReposGetContentsResponse): boolean {
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
async function fetchDir(client: Octokit, def: GithubDef, path: string, location: string) {
    const contents = await readContents(client, def, path)
    if (!Array.isArray(contents)) {
        console.dir(contents, { depth: null })
        throw new Error(`Path '${path} should be a directory but is not`)
    }
    const promises: Promise<any>[] = []
    for (const item of contents as Octokit.ReposGetContentsResponseItem[]) {
        const target = Path.join(location, item.name)
        if (item.type == 'dir') {
            fs.mkdirSync(target)
            promises.push(fetchDir(client, def, item.path, target))
        } else {
            promises.push(fetchFile(client, def, item.path, target))
        }
    }
    await Promise.all(promises)
}

// Fetch a file into a cache location.   The 'def' argument is used to supply owner,
// repo and ref.   The auth member is already encoded in the client.  The path is taken from the path argument
async function fetchFile(client: Octokit, def: GithubDef, path: string, location: string) {
    const data = await readContents(client, def, path)
    if (!data['content'] || !data['encoding']) {
        console.dir(data, { depth: null })
        throw new Error(`Response from 'fetchFile' was not interpretable`)
    }
    const toWrite = Buffer.from(data['content'], data['encoding'])
    fs.writeFileSync(location, toWrite)
}

// Read the project map
function readProjectMap(inBrowser: boolean): ProjectMap {
    let json: string
    if (inBrowser) {
        json = window.localStorage.getItem(PROJECT_MAP_KEY)
        if (!json) {
            return {}
        }
    }  else {
        if (!fs.existsSync(projectMapFile())) {
           return {}
        }
        json = String(fs.readFileSync(projectMapFile()))
    }
    return JSON.parse(json)
}

// Store the project map
function storeProjectMap(map: ProjectMap, inBrowser: boolean) {
    const toStore = JSON.stringify(map, undefined, 2)
    if (inBrowser) {
        window.localStorage.setItem(PROJECT_MAP_KEY, toStore)
    }  else {
        if (!fs.existsSync(nimbellaDir())) {
           fs.mkdirSync(nimbellaDir())
        }
        fs.writeFileSync(projectMapFile(), toStore)
    }
}
