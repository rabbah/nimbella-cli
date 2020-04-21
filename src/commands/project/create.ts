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

import { flags } from '@oclif/command'
import { NimBaseCommand, NimLogger, inBrowser } from '../../NimBaseCommand'
import * as fs from 'fs'
import * as path from 'path'
import { extFromRuntime } from '../../deployer/util'
import * as yaml from 'js-yaml'
import { DeployStructure, PackageSpec, ActionSpec } from '../../deployer/deploy-struct'

export default class ProjectCreate extends NimBaseCommand {
  static description = 'Create a Nimbella Project'

  static flags = {
    target: flags.string({ description: 'target namespace for the project' }),
    clean: flags.boolean({ description: 'clean the namespace before every deploy', allowNo: true }),
    sample: flags.boolean({ description: 'start off with hello world (default language javascript)' }),
    language: flags.string({ description: 'language for the sample (implies --sample' }),
    config: flags.boolean({ description: 'generate template config file' }),
    ...NimBaseCommand.flags
  }

  static args = [ { name: 'project', description: 'project path in the file system'} ]

  async runCommand(rawArgv: string[], argv: string[], args: any, flags: any, logger: NimLogger) {
    if (!args.project) {
        this.doHelp()
    }
    await createOrUpdateProject(false, args, flags, logger)
  }
}

// Working function used by both create and update
export async function createOrUpdateProject(updating: boolean, args: any, flags: any, logger: NimLogger) {
    const { target, clean, sample, config } = flags
    if (updating) {
        logger.handleError(`Current restriction: 'project update' is not yet working (it should have been hidden)`)
    }
    if (inBrowser) {
        // TODO tweak this text once we have 'project update'
        logger.handleError(`'project create' needs local file access. Use the 'nim' CLI on your local machine`)
    }
    const { kind, sampleText } = sample && !flags.language ? defaultSample : languageToKindAndSample(flags.language, logger)
    let projectConfig: DeployStructure = config ? configTemplate() : (target || clean) ? {} : undefined
    const configFile = path.join(args.project, 'project.yml')
    const defaultPackage = path.join(args.project, 'packages', 'default')
    if (fs.existsSync(args.project)) {
        if (updating) {
            // TODO this code is not being exercised due to test above.  When it is re-enabled it will require change
            if (seemsToBeProject(args.project)) {
                if (fs.existsSync(configFile)) {
                    const configContents = String(fs.readFileSync(configFile))
                    if (configContents.includes('${')) {
                        // TODO address how this can also work if the file contains symbolic substitutions.  At present there is no safe way of
                        // auto-modifying such a file because symbols will not survive a load/store cycle as symbols (they will either break or be
                        // resolved).
                        logger.handleError('Current restriction: project update does not work if there are symbolic subsitutions in the configuration')
                    }
                    projectConfig = yaml.safeLoad(configContents)
                }
                if (kind && !fs.existsSync(defaultPackage)) {
                    fs.mkdirSync(defaultPackage, { recursive: true })
                }
            } else {
                logger.handleError(`A directory or file '${args.project}' already exists in the file system and does not appear to be a project`)
            }
        } else {
            logger.handleError(`Cannot create project because '${args.project}' already exists in the file system`)
        }
    } else {
        // Create the project from scratch
        fs.mkdirSync(defaultPackage, { recursive: true })
        const web = path.join(args.project, 'web')
        fs.mkdirSync(web)
    }
    // Add material to the project.
    if (target) {
        // To remove a target, user specifies '' as the target
        projectConfig.targetNamespace = target
    }
    if (typeof clean === 'boolean') {
        // TODO does oclif actually distinguish absent from negated in this way?  Moot until we re-enable update
        projectConfig.cleanNamespace = clean
    }
    if (kind) {
        generateSample(kind, config ? projectConfig : undefined, sampleText, defaultPackage)
    }
    // (Re)write the config.  TODO: in the update case, in addition to the problem with symbols, rewriting the config will lose the comments
    if (projectConfig) {
        const data = yaml.safeDump(projectConfig)
        fs.writeFileSync(configFile, data)
    }
}

// Make a more fully populated config (with defaults filled in and comments)
// TODO we don't have an internal representation of comments, so we punt on that for the moment.
function configTemplate(): DeployStructure {
    const config: DeployStructure = { targetNamespace: '', cleanNamespace: false, bucket: {}, parameters: {}, packages: []  }
    const defPkg: PackageSpec = { name: 'default', shared: false, clean: false, environment: {}, parameters: {}, annotations: {}, actions: [] }
    config.packages.push(defPkg)
    return config
}

// Convert a user-specified language name to a runtime kind plus a sample.
// Handle the error case of user requesting an unsupported language.
function languageToKindAndSample(language: string, logger: NimLogger): { kind: string, sampleText: string } {
    if (!language) {
        return { kind: undefined, sampleText: undefined } // normal flow: user did not request a sample
    } else {
        language = language.toLowerCase()
    }
    // TODO the following should be coordinated with the runtime table and some common source of samples used by playground,
    // cloud editor, and this code
    if (language === 'javascript')
        return defaultSample
    if (['java', 'python', 'php', 'swift', 'go', 'typescript'].includes(language))
        return { kind: language + ':default', sampleText: samples[language] }
    logger.handleError(`${language} is not a supported language`)
}

// Generate a sample.   The sample is called 'hello'.   When we support update we will need to elaborate this when there are
// pre-existing actions called 'hello'
function generateSample(kind: string, config: DeployStructure|undefined, sampleText: string, defaultPackage: string) {
    const suffix = extFromRuntime(kind, false)
    const file = path.join(defaultPackage, `hello.${suffix}`)
    fs.writeFileSync(file, sampleText)
    if (config) {
        // Here we assume if we are given a config it is a full template already containing a default package
        const defPkg = config.packages.find(pkg => pkg.name === 'default')
        const action: ActionSpec = { name: 'hello', clean: false, binary: false, main: '', runtime: kind, web: true, webSecure: false,
            parameters: {}, environment: {}, annotations: {}, limits: {} }
        defPkg.actions.push(action)
    }
}

// Test whether a path in the file system is a project based on some simple heuristics.  The path is known to exist.
function seemsToBeProject(path: string): boolean {
    if (fs.lstatSync(path).isDirectory()) {
        const contents = fs.readdirSync(path, { withFileTypes: true })
        for (const entry of contents) {
            if (entry.name === 'project.yml' && entry.isFile())
                return true
            if (entry.name === 'packages' && entry.isDirectory())
                return true
            if (entry.name === 'web' && entry.isDirectory())
                return true
        }
    }
    return false
}

//
//  Samples
//  TODO: these should be in common between here, the playground, and the cloud editor.
//  As it stands
//    - the playground has its own table although its samples are textually the same as these
//    - the cloud editor has its own table (in placeholders.ts).  It samples are a subset of these (lacking java and go)
//

const javascript = `function main(args) {
  let name = args.name || 'stranger'
  let greeting = 'Hello ' + name + '!'
  console.log(greeting)
  return {"greeting": greeting}
}
`

const typescript = `export function main(args: {}): {} {
  let name: string = args['name'] || 'stranger'
  let greeting: string = 'Hello ' + name + '!'
  console.log(greeting)
  return { greeting }
}
`

const python = `def main(args):
    name = args.get("name", "stranger")
    greeting = "Hello " + name + "!"
    print(greeting)
    return {"greeting": greeting}
`

const swift = `func main(args: [String:Any]) -> [String:Any] {
    if let name = args["name"] as? String {
        let greeting = "Hello \(name)!"
        print(greeting)
        return [ "greeting" : greeting ]
    } else {
        let greeting = "Hello stranger!"
        print(greeting)
        return [ "greeting" : greeting ]
    }
}
`

const php = `<?php
function main(array $args) : array
{
    $name = $args["name"] ?? "stranger";
    $greeting = "Hello $name!";
    echo $greeting;
    return ["greeting" => $greeting];
}
`

const java = `import com.google.gson.JsonObject;

public class Main {
    public static JsonObject main(JsonObject args) {
        String name = "stranger";
        if (args.has("name"))
            name = args.getAsJsonPrimitive("name").getAsString();
        String greeting = "Hello " + name + "!";
        JsonObject response = new JsonObject();
        response.addProperty("body", greeting);
        return response;
    }
}
`

const go = `package main

func Main(args map[string]interface{}) map[string]interface{} {
  name, ok := args["name"].(string)
  if !ok {
    name = "stranger"
  }
  msg := make(map[string]interface{})
  msg["body"] = "Hello, " + name + "!"
  return msg
}
`

const samples = { javascript, python, php, swift, java, go, typescript }
const defaultSample = { kind: 'nodejs:default', sampleText: javascript }
