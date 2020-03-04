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

import { promiseFiles } from 'node-dir'
import * as fs from 'fs'
import * as Path from 'path'
import { promisify } from 'util'
import { inBrowser } from '../NimBaseCommand'
import { ProjectReader, PathKind } from './deploy-struct'
import * as makeDebug from 'debug'
const debug = makeDebug('nimbella-cli/file-reader')

// Guard with inBrowser in order to safely declare as module constants.  If used correctly
// the functions will never be called in a browser.
const fs_readdir = inBrowser ? (() => undefined) : promisify(fs.readdir)
const fs_readfile = inBrowser ? (() => undefined) : promisify(fs.readFile)
const fs_lstat = inBrowser ? (() => undefined) : promisify(fs.lstat)

// The file system implementation of ProjectReader
// The file system implementation accepts absolute paths and relative paths landing anywhere in the filesystem.
// At 'make' time, the path of the project (within the file system is provided)

// Make
export function makeFileReader(basepath: string): ProjectReader {
    debug("making file reader on basepath '%s'", basepath)
    return new FileProjectReader(basepath)
}

// Implementing class
class FileProjectReader implements ProjectReader {
    // Project location in the file system
    basepath: string

    constructor(basepath: string) {
        this.basepath = basepath
    }

    // Retrieve the basepath
    getFSLocation(): string {
        return this.basepath
    }

    // File system implementation of readdir.
    readdir(path: string): Promise<PathKind[]> {
        debug("request to read directory '%s'", path)
        path = Path.resolve(this.basepath, path)
        debug("resolved to directory '%s", path)
        return fs_readdir(path, { withFileTypes: true }).then((entries: fs.Dirent[]) => entries.map(entry => {
            return  { name: entry.name, isDirectory: entry.isDirectory(), isFile: entry.isFile() }
        }))
    }

    // File system implementation of readAllFiles
    readAllFiles(dir: string): Promise<string[]> {
        dir = Path.resolve(this.basepath, dir)
        return promiseFiles(dir)
    }

    // File system implementation of readFileContents
    readFileContents(path: string): Promise<Buffer> {
        path = Path.resolve(this.basepath, path)
        return fs_readfile(path)
    }

    // File system implementation of isExistingFile
    isExistingFile(path: string): Promise<boolean> {
        debug("testing existence for file '%s'", path)
        path = Path.resolve(this.basepath, path)
        debug("resolved to file '%s", path)
        return fs_lstat(path).then((stats: fs.Stats) => {
            if (stats.isFile()) {
                debug("file exists")
                return true
            }
            debug("path exists but is not a file")
            return false
        }).catch(() => {
            debug("lstat failed for path %s", path)
            return false
        })
    }

    // File system implementation  of getPathKind
    getPathKind(path: string): Promise<PathKind> {
        path = Path.resolve(this.basepath, path)
        return fs_lstat(path).then((stats: fs.Stats) => {
            return { name: Path.basename(path), isFile: stats.isFile(), isDirectory: stats.isDirectory(), mode: stats.mode }
        })
    }
}
