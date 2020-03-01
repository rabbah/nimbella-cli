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

import { ProjectReader } from './file-reader'
import { GithubDef, makeClient, readContents, seemsToBeProject } from './github';
import * as Octokit from '@octokit/rest'
import { posix as Path } from 'path'

// Defines the github version of the ProjectReader
// Currently, paths passed to the reader functions are absolutized to the original project path argument
// This generally needs to be compensated before invoking the github API
export function makeGithubReader(def: GithubDef, userAgent: string): ProjectReader {
    const client = makeClient(def, userAgent)
    return new GithubProjectReader(client, def)
}

class GithubProjectReader implements ProjectReader {
    client: Octokit
    def: GithubDef

    constructor(client: Octokit, def: GithubDef) {
        this.client = client
        this.def = def
    }

    // Implement readdir for github
    async readdir(path: string): Promise<{ name: string, isDirectory: boolean }[]> {
        const effectivePath = Path.relative(this.def.repoPath, path) // computes path relative to the repo root
        const contents = await readContents(this.client, this.def, effectivePath)
        if (!Array.isArray(contents)) {
            console.dir(contents, { depth: null })
            throw new Error(`Path '${effectivePath} should be a directory but is not`)
        }
        if (path === this.def.repoPath && !seemsToBeProject(contents))     {
            throw new Error(`Github location does not contain a 'nim' project`)
        }
        return contents.map(item => { return { name: item.name, isDirectory: item.type === 'dir' } })
    }

    // Implement readAllFiles for github
    async readAllFiles(dir: string): Promise<string[]> {
        const ans: string[] = []
        await this.readFilesRecursively(dir, ans)
        return ans
    }

    // Working subroutine of readAllFiles
    private async readFilesRecursively(dir: string, ans: string[]) {
        const items = await this.readdir(dir)
        items.forEach(async item => {
            const itemPath = Path.join(dir, item.name)
            if (item.isDirectory) {
                await this.readFilesRecursively(itemPath, ans)
            } else {
                ans.push(itemPath)
            }
        })
    }

    // Implement readFileContents for github
    async readFileContents(path: string): Promise<Buffer> {
        const effectivePath = Path.relative(this.def.repoPath, path) // computes path relative to the repo root
        const contents = await readContents(this.client, this.def, effectivePath)
        // Careful with the following: we want to support empty files but the empty string is falsey.
        if (typeof contents['content'] !== 'string'  || !contents['encoding']) {
            console.dir(contents, { depth: null })
            throw new Error(`Contents of file at '${path}' was not interpretable`)
        }
        return Buffer.from(contents['content'], contents['encoding'])
    }

    // Implement isExistingFile for github
    async isExistingFile(path: string): Promise<boolean> {
        if (path === this.def.repoPath) {
            return false // the repo root can't be a file
        }
        const parent = Path.dirname(path)
        const name = Path.basename(path)
        const candidates = await this.readdir(parent)
        for (const item of candidates) {
            if (item.name === name && !item.isDirectory) {
                return true
            }
        }
        return false
    }
}
