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

import { ProjectReader, PathKind } from './deploy-struct'
import { GithubDef, makeClient, readContents, seemsToBeProject } from './github';
import * as Octokit from '@octokit/rest'
import { posix as Path } from 'path'
import * as makeDebug from 'debug'
const debug = makeDebug('nimbella-cli/github-reader')

// Defines the github version of the ProjectReader
// In general files passed to a ProjectReader are relative to the project path, which includes the path portion of
// the def.   To invoke github APIs, we need to make paths relative to the github repo root, so that means joining
// def.path with the argument and normalizing the result.  We don't want to use path.resolve because this isn't
// a real file system and the current working directory is irrelevant.  After normalizing, the result must fall
// within the repo

// Make
export function makeGithubReader(def: GithubDef, userAgent: string): ProjectReader {
    const client = makeClient(def, userAgent)
    return new GithubProjectReader(client, def)
}

// The implementing class
class GithubProjectReader implements ProjectReader {
    client: Octokit
    def: GithubDef
    cache: Map<string, Octokit.ReposGetContentsResponse>

    constructor(client: Octokit, def: GithubDef) {
        debug('new github-reader for %O', def)
        this.client = client
        this.def = def
        this.cache = new Map()
    }

    // Implement getFSLocation for github (always returns null)
    getFSLocation(): string|null {
        return null
    }

    // Implement readdir for github
    async readdir(path: string): Promise<PathKind[]> {
        debug('reading directory %s', path)
        if (Path.isAbsolute(path)) {
            throw new Error(`Deploying from github does not support absolute paths`)
        }
        const contents = await this.retrieve(path)
        if (!Array.isArray(contents)) {
            console.dir(contents, { depth: null })
            throw new Error(`Path '${path} should be a directory but is not`)
        }
        if (path === this.def.path && !seemsToBeProject(contents))     {
            throw new Error(`Github location does not contain a 'nim' project`)
        }
        return contents.map(this.toPathKind)
    }

    // Subroutine used by readdir; may have other uses
    toPathKind(item: Octokit.ReposGetContentsResponseItem): PathKind {
        let mode = 0o666
        if (item.type === 'file' && (item.name.endsWith('.sh') || item.name.endsWith('.cmd'))) {
            mode = 0o777
        }
        return { name: item.name, isDirectory: item.type === 'dir', isFile: item.type === 'file', mode }
    }

    // Implement readFileContents for github
    async readFileContents(path: string): Promise<Buffer> {
        debug('reading file %s', path)
        const contents = await this.retrieve(path)
        // Careful with the following: we want to support empty files but the empty string is falsey.
        if (typeof contents['content'] !== 'string'  || !contents['encoding']) {
            console.dir(contents, { depth: null })
            throw new Error(`Contents of file at '${path}' was not interpretable`)
        }
        return Buffer.from(contents['content'], contents['encoding'])
    }

    // Implement isExistingFile for github
    async isExistingFile(path: string): Promise<boolean> {
        debug('checking file existence: %s', path)
        const kind = await this.getPathKind(path)
        return kind && kind.isFile
    }

    // Implement getPathKind for github
    async getPathKind(path: string): Promise<PathKind> {
        debug('getting path type: %s', path)
        if (path === '' || path === '/' || path === undefined) {
            return { name: '', isFile: false, isDirectory: true, mode: 0x777}
        }
        const name = Path.basename(path)
        const parent = Path.dirname(path)
        const candidates = await this.readdir(parent)
        for (const item of candidates) {
            if (item.name === name) {
                return item
            }
        }
        return Promise.resolve(undefined)
    }

    // Basic retrieval function with cache.  Cache is dead simple since we never modify anything
    async retrieve(path: string): Promise<Octokit.ReposGetContentsResponse> {
        const effectivePath = Path.normalize(Path.join(this.def.path, path))
        let contents = this.cache.get(effectivePath)
        if (!contents) {
            debug("going to github for '%s'", path)
            contents = await readContents(this.client, this.def, effectivePath)
            this.cache.set(effectivePath, contents)
        } else {
            debug("'%s' found in cache", path)
        }
        return contents
    }
}
