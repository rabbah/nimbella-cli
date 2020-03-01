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
import { GithubDef, makeClient } from './github';

// Defines the github version of the ProjectReader
export function makeGithubReader(def: GithubDef, userAgent: string): ProjectReader {
    const client = makeClient(def, userAgent)
    return { readdir, readAllFiles, readFileContents, isExistingFile }
}

// Github implementation of readdir.
function readdir(path: string): Promise<{ name: string, isDirectory: boolean }[]> {

}

// Github implementation of readAllFiles
function readAllFiles(dir: string): Promise<string[]> {

}
// Github implementation of readFileContents
function readFileContents(path: string): Promise<Buffer> {

}

// Github implementation of isExistingFile
function isExistingFile(path: string): Promise<boolean> {

}
