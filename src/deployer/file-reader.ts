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
import { promisify } from 'util'
import { inBrowser } from '../NimBaseCommand'

// Guard with inBrowser in order to safely declare as module constants.  If used correctly
// the functions will never be called in a browser.
const fs_readdir = inBrowser ? (() => undefined) : promisify(fs.readdir)
const fs_readfile = inBrowser ? (() => undefined) : promisify(fs.readFile)
const fs_lstat = inBrowser ? (() => undefined) : promisify(fs.lstat)

// Defines the general ProjectReader interface and contains the file system implementation for it

export interface ProjectReader {
    readdir: (path: string) => Promise<{ name: string, isDirectory: boolean }[]>
    readAllFiles: (dir: string) => Promise<string[]>
    readFileContents: (path: string) => Promise<Buffer>
    isExistingFile: (path: string) => Promise<boolean>
}

// The file system implementation
export const fileSystemProjectReader: ProjectReader = {
    readdir, readAllFiles: promiseFiles, readFileContents: fs_readfile, isExistingFile
}

// File system implementation of readdir.
function readdir(path: string): Promise<{ name: string, isDirectory: boolean }[]> {
    return fs_readdir(path).then((entries: fs.Dirent[]) => entries.map(entry => {
        return  { name: entry.name, isDirectory: entry.isDirectory() }
    }))
}

// File system implementation of isExistingFile
function isExistingFile(path: string): Promise<boolean> {
    return fs_lstat(path).then((stats: fs.Stats) => stats.isFile()).catch(() => false)
}
