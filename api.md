# The Deployer API

The project deployment and auth management aspects of `nim` use an internal component called the deployer (not a separate package,
but with a well-defined interface) to do all the work.  For project deployment and auth management, the CLI simply wraps a usable command syntax around the deployer API.

This is currently a rough document for use by Nimbella-internal teams.  It is not yet decided when or whether to document this for external customers.

All examples are TypeScript.  Using the API from JavaScript should be mostly a matter of omitting types and using `require` instead of `import`.

## Importing

You import from the API like this

```
import { Flags, Credentials, deployProject, ... } from 'nimbella-cli/deployer'
```

The types, objects, and functions that you _may_ import with some expectation of support are covered in the following sections.

- There are more types and functions importable from `nimbella-cli/deployer` than are documented here.
- Do not import from deeper in the file structure of the deployer.
- The types and functions that are not currently documented should be assumed to be non-supported but can be promoted to supported status if a clear need is identified.

## Types

### Credentials

You may either retrieve this type from the credential store using one of several methods or construct it manually.

```
// The Result of a credential lookup
export interface Credentials {
    namespace: string|undefined
    ow: OWOptions
    storageKey: CredentialStorageEntry|undefined
    redis: boolean
}
```

### DeployResponse

Both `deployProject` and `deploy` return promises of this type.   It describes the outcome of a deployment.

```
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
```

### DeployStructure

The internal representation of a project.

- We do not support creating your own `DeployStructure`.
- It is the output of `readProject`, `readAndPrepare`, `readPrepareAndBuild`, `prepareToDeploy`, or `buildProject`.
- It is the sole or primary input to `prepareToDeploy`, `buildProject`, and `deploy`.

The intent is that the `DeployStructure` may be inspected after creation and before use in the next step in order to find user errors or obtain more information about what is specified in the project.

```
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
    versions?: VersionEntry          // The VersionEntry for credentials.namespace on the selected API host if available
}
```

Many types used in this structure are not yet documented.   Those that may be usefully inspected will eventually be documented.

### DeploySuccess

Part of a `DeployResponse` indicating a successful deployment of an element of the project.

```
export type DeployKind = "web" | "action"

export interface DeploySuccess {
    name: string
    kind: DeployKind
    skipped: boolean
    wrapping?: string
}
```

### Flags

Captures the miscellaneous command line flags for passing into one of the top level API calls (`deployProject` or `prepareToDeploy`).

```
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
```

### OWOptions

Contains "low level" authentication for the OpenWhisk stack, usually supplied as part of `Credentials`.

```
export interface OWOptions {
    apihost?: string
    api_key?: string
    ignore_certs?: boolean
}
```

### Persister

An interface type with the necessary methods to read and write the credential store from stable storage.  The details are not part of the API.  There are only two instances, `browserPersister` and `fileSystemPersister` which are themselves exported.

## Objects

### browserPersister

A well-known instance of `Persister` for saving the credential store in browser local storage

### fileSystemPersister

A well-known instance of `Persister` for saving the credential store in the local file system.

## Functions

### buildProject

Performs the third of four steps (read, prepare, build, deploy) needed to deploy a project.

```
buildProject(project: DeployStructure): Promise<DeployStructure>
```

The input `DeployStructure` represents a project that has been read and prepared for building but not yet built.  One obtains this using `readAndPrepare`.  The output `DeployStructure` represents a project that has been built.

### deploy

Performs the final step of `deployProject` but can be invoked explicitly after obtaining a `DeployStructure` from `readPrepareAndBuild` or another function that produces a `DeployStructure`.  Do not create your own `DeployStructure`.

```
deploy(todeploy: DeployStructure): Promise<DeployResponse>
```

### deployProject

The highest level API for deploying a project.  It actually performs four steps (read, prepare, build, deploy) each of which is covered by a lower level function in the API.  There are also convenience methods to perform the first two steps (`readAndPrepare`) or the first three (`readPrepareAndBuild`).

```
deployProject(path: string,
              owOptions: OWOptions,
              credentials: Credentials,
              persister: Persister,
              flags: Flags,
              userAgent: string): Promise<DeployResponse>
```
- **path**: the project path as it would appear on the command line (github or local)
- **owOptions**: used when `credentials` is omitted (see below)
- **credentials**: the `Credentials` object to use as Nimbella authentication
- **persister**:  one of `fileSystemPersister` or `browserPersister` to be used if `credentials` is omitted
- **flags**: contains flags normally specified on the command line
- **userAgent**: a string to use as a user agent in the request header when contacting github (the user agent for contacting Nimbella is determined differently at present and is not controlled here ... this is likely to change).

Credentials processing is a bit complicated because there are a number of cases to be supported.  _In general_ supply a `Credentials` object with at least the `ow` field initialized.

However, the credentials argument may be omitted if a valid `persister` is supplied and at least the `apihost` field of `owOptions` is filled in.  In that case,

- if the project config specifies a `targetNamespace`, the credentials for that namespace (on the provided `apihost`) will be used.
- Otherwise, the current namespace will be used if there is one (and it's an error if there isn't one).

### getCredentials

Gets the credentials for the current namespace.

```
getCredentials(persister: Persister): Promise<Credentials>
```

### getCredentialsForNamespace

Gets the credentials for a specific namespace assumed to be in the credential store.

```
getCredentialsForNamespace(namespace: string,
                           apihost: string,
                           persister: Persister): Promise<Credentials>
```

The `apihost` may be omitted, in which case the function will find the entry by name alone; however, an error will be thrown in that case if the namespace exists on more than one host in the credential store.

### prepareToDeploy

Performs the second of four steps (read, prepare, build, deploy) in deploying a project.  Typically done for you as part of `readAndPrepare`, `readPrepareAndBuild`, or `deployProject`.

```
prepareToDeploy(inputSpec: DeployStructure,
                owOptions: OWOptions,
                credentials: Credentials,
                persister: Persister,
                flags: Flags): Promise<DeployStructure>
```

- **inputSpec**: a representation of the project (typically provided by `readProject`)

For the remaining arguments, see `deployProject`.

### readAndPrepare

Performs the first two of the four steps (read, prepare, build, deploy) in deploying a project.

```
readAndPrepare(path: string,
               owOptions: OWOptions,
               credentials: Credentials,
               persister: Persister,
               flags: Flags,
               userAgent: string): Promise<DeployStructure>
```

For an explanation of the arguments, see `deployProject`.

### readPrepareAndBuild

Performs the first three of the four steps (read, prepare, build, deploy) in deploying a project.

```
readPrepareAndBuild(path: string,
                    owOptions: OWOptions,
                    credentials: Credentials,
                    persister: Persister,
                    flags: Flags,
                    userAgent: string): Promise<DeployStructure>
```

For an explanation of the arguments, see `deployProject`.

### readProject

Performs the first of the four steps (read, prepare, build, deploy) in deploying a project.  Produces a basic `DeployStructure` for the project but does not merge in credentials and flags (that is done in the prepare step).

```
readProject(projectPath: string,
            envPath: string,
            userAgent: string,
            includer: Includer): Promise<DeployStructure> {
```

- **projectPath**: the project path as it would appear on the command line (github or local)
- **envPath**: what would appear in the `env` member of `Flags` of `deployProject`
- **userAgent**: see `deployProject`
- **includer**: a parsed form of what would appear in the `include` and `exclude` members of `Flags` of `deployProject`


