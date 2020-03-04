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

import { Dict, Client, Limits } from 'openwhisk'
import { Bucket } from '@google-cloud/storage'

// Contains the primary type definition for the deployer structure.
// The structure consists of the contents of a 'project' (its file and folder structure) along
// with the contents of a distinguished config file in the root of the project, if present.

// The substructure for a web resource.
export interface WebResource {
    // The name of the resource relative to the web directory.  Used as a key when merging a WebResource in the config
    // with one constructed from the project contents.  For action-wrapping, the simpleName must be simple (no slashes).
    // For bucket deployment all valid path names are accepted.
    simpleName: string
    // The complete path to the resource within the project, for reading and deployment.  This is computed from the
    // simpleName once the project location is known and should not be specified in the config.
    filePath?: string
    // The mime-type of the resource (generally inferred from its extension but can be specified explicitly in the config)
    // The mime-type is only required when action-wrapping.
    mimeType?: string
    // Build information (not specifiable in the config)
    build?: string
}

// Describes one package containing zero or more actions
export interface PackageSpec {
    name: string  // The 'default' package is used to hold actions with no package.  Only the 'actions' member is processed then.
    actions?: ActionSpec[]
    shared: boolean // Indicates that the package is intended to be shared (public)
    annotations?: Dict // package annotations
    parameters?: Dict // Bound parameters for all actions in the package, passed in the usual way
    environment?: Dict // Bound parameters for all actions in the package, destined to go in the environment of each action
    clean?: boolean   // Indicates that the package is to be deleted (with its contained actions) before deployment
    web?: any // like 'web' on an action but affects all actions of the package that don't redeclare the flag
}

// Describes one action
export interface ActionSpec {
    name: string // The name of the action
    // The following are used to assemble 'exec'.  Currently, you can't specify exec directly
    file?: string // The path to the file comprising the action (possibly a zip file)
    displayFile?: string // The file path but in github when applicable, otherwise undefined
    code?: string  // The code of the action (bypasses file reading; used internally; not specifiable in the config)
    runtime?: string // The runtime to use for the action
    main?: string // The 'main' directive if needed
    binary?: boolean // Indicates the need for base64 encoding
    zipped?: boolean // (Ignored unless binary) indicates that the binary object is a zip archive
    // End of 'exec' properties
    web?: any // like --web on the CLI; expands to multiple annotations.  Project reader assigns true unless overridden.
    webSecure?: any // like --web-secure on the CLI.  False unless overridden
    annotations?: Dict // 'web' and 'webSecure' are merged with what's here iff present
    parameters?: Dict // Bound parameters for the action passed in the usual way
    environment?: Dict // Bound parameters for the action destined to go in the environment
    limits?: Limits    // Action limits (time, memory, logs)
    clean?: boolean // Indicates that an old copy of the action should be removed before deployment
    // Build information (not specifiable in the config)
    build?: string
    wrapping?: string
}

// Information of various kinds typically specified on the command line
export interface Flags {
    verboseBuild: boolean
    verboseZip: boolean
    production: boolean
    incremental: boolean
    yarn: boolean
    env: string|undefined
    webLocal: string|undefined
    include: string|undefined
    exclude: string|undefined
}

// Provides the status of a shared build
export interface BuildStatus {
    pending: ((arg0: Error)=>void)[]
    built: boolean
    error: Error
}

// Map from shared build directories (absolute paths) to Promise chains representing steps dependent on those builds
export interface BuildTable {
    [ key: string]: BuildStatus
}

// The top-level deploy structure.  Nothing is required.  If the structure is vacuous, nothing is deployed.   This interface
// describes the syntax of project.yml and also the structure of a project on disk (where 'web' and 'packages') are
// subdirectories of the project).   The two sources of information are merged.
export  interface DeployStructure {
    web?: WebResource[]              // Resources found in the web directory
    packages?: PackageSpec[]         // The packages found in the package directory
    targetNamespace?: string         // The namespace to which we are deploying (from config)
    cleanNamespace?: boolean         // Clears entire namespace prior to deploying
    bucket?:  BucketSpec             // Information guiding deployment of web resources into an s3 (or s3-like) object store bucket
    actionWrapPackage?: string       // The name of a package into which web resources will be action-wrapped.
    parameters?: Dict                // Parameters to apply to all packages in the project
    // If actionWrapPackage is absent, object store deployment will occur even if 'bucket' is absent.
    // The following fields are not permitted in project.yml but are filled in internally
    credentials?: Credentials         // The full credentials for the deployment (consistent with targetNamespace if one was specified)
    flags? : Flags                   // options typically specified on the command line
    webBuild?: string                // Type of build (build.sh or package.json) to apply to the web directory
    sharedBuilds?: BuildTable        // The build table for this project, populated as shared builds are initiated
    strays?: string[]                // files or directories found in the project that don't fit the model, not necessarily an error
    filePath?: string                // The location of the project on disk
    githubPath?: string              // The original github path specified, if deploying from github
    owClient?: Client                // The openwhisk client for deploying actions and packages
    bucketClient?: Bucket            // The gcloud storage client for deploying to a bucket
    includer?: Includer              // The 'includer' for deciding which packages, actions, web are included in the deploy
    reader?: ProjectReader           // The project reader to use
    versions?: VersionEntry          // The VersionEntry for credentials.namespace on the selected API host if available
}

// The specification of information guiding bucket deployment of web resources if that feature is to be employed
export interface BucketSpec {
    prefixPath?: string      // A directory prefix used in front of every resource when deploying (if absent, / is assumed)
    strip?: number           // The number of path segments to strip from every resource when deploying (before adding prefix path, if any)
    mainPageSuffix?: string  // The suffix to append to any directory URL (including the bucket root) to form the URL of a web page (defaults to 'index.html')
    notFoundPage?: string    // The name of a page (relative to the root) to show on 404 errors.
    clean?: boolean          // Deletes from the at prefixPath or root before deploying new content
 }

 // Types used in the DeployResponse
export interface VersionInfo {
    version: string
    digest: string
}
export interface VersionMap {
    [key: string]: VersionInfo
}

export type DeployKind = "web" | "action"

export interface DeploySuccess {
    name: string
    kind: DeployKind
    skipped: boolean
    wrapping?: string
}

// Contains the responses from an actual deployment
export interface DeployResponse {
    successes: DeploySuccess[]
    failures: Error[]
    ignored: string[]
    namespace: string
    packageVersions: VersionMap
    actionVersions: VersionMap
    apihost?: string
    webHashes?: { [key: string]: string }
}

// The version file entry for a given deployment
export interface VersionEntry {
    apihost: string
    namespace: string
    packageVersions: VersionMap
    actionVersions: VersionMap
    webHashes: { [key: string]: string }
}

// The annotation placed in every action and package deployed by the deployer
export interface DeployerAnnotation {
    repository?: string
    commit?: string
    digest: string
    projectPath: string
    user: string
    zipped?: boolean
}

// Grouping for OW Options that can be specified on the command line or by caller; also part of credential lookup response
export interface OWOptions {
    apihost?: string
    api_key?: string
    ignore_certs?: boolean
}

// Format of the JSON file containing credential information, persisted in ~/.nimbella/credentials.json
export interface CredentialStore {
    currentHost: string
    currentNamespace: string
    credentials: CredentialHostMap
    currentGithub?: string
    github?: {[ key: string ]: string}
}

export interface CredentialHostMap {
    [ key: string ]: CredentialNSMap  // Keyed by API host
}

// Part of CredentialStore for a single API host
export interface CredentialNSMap {
    [ key: string ]: CredentialEntry // keyed by namespace relative to API host
}

// Part of CredentialStore for a single namespace relative to an API host.
// It describes the credentials owned by the user who owns ~/.
// While different subjects in couchdb can have different credentials to a shared namespace,
// we assume that a user keeps only one credential set for that namespace.
export interface CredentialEntry {
    api_key: string
    storageKey: CredentialStorageEntry
    redis: boolean
}

// Part of CredentialStore for the storage credentials.  THese are organized for convenience in initializing a Storage
// object.
export interface CredentialStorageEntry {
    project_id: string
    credentials: { client_email: string, private_key: string }
}

// The Result of a credential lookup
export interface Credentials {
    namespace: string|undefined
    ow: OWOptions
    storageKey: CredentialStorageEntry|undefined
    redis: boolean
}

// Compact and less complete information about a Credential suitable for listing and tabular display
export interface CredentialRow {
    namespace: string
    current: boolean
    storage: boolean
    redis: boolean
    apihost: string
}

 // The Includer object is used during project reading and deployment to screen web, packages, and actions to be included
 export interface Includer {
    isWebIncluded: boolean
    isPackageIncluded: (pkg: string) => boolean
    isActionIncluded: (pkg: string, action: string) => boolean
    isIncludingEverything: () => boolean
 }

// Defines the general ProjectReader interface

// A simplified fs.Dirent that just distinguishes files and directories (all we really have when using github)
export type PathKind = { name: string, isDirectory: boolean, isFile: boolean, mode: number }

// The method reperotoire for reading projects.
// Path names passed to these methods may, in the most general case, be either absolute or relative to the
// project root.  After canonicalizing `..` directives in such paths, they may point inside or outside the project.
// For the file system, we accept absolute paths and allow a relative path to land anywhere in the file system.
// For github we reject absolute paths ane require a relative path to land within the github repo that contains the project.
export interface ProjectReader {
    // Read the contents of a directory (non-recursively)
    readdir: (path: string) => Promise<PathKind[]>
    // Find all the file path names under a directory (recursive)
    readAllFiles: (dir: string) => Promise<string[]>
    // Read the contents of a file (e.g. config, code, .include ...)
    readFileContents: (path: string) => Promise<Buffer>
    // Test whether a file exists
    isExistingFile: (path: string) => Promise<boolean>
    // Get the PathKind of a path
    getPathKind: (path: string) => Promise<PathKind>
    // Get the location of the project in a real file system (throws for github)
    getFSLocation: () => string
}
