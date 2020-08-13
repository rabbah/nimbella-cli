# Programmatic use of Nimbella CLI Features

This document is currently intended for Nimbella-internal teams.  Because we are going to release the `nim` code as open-source, we will probably make a version of this document public.  But it is not public yet.

There are two distinct API categories documented here.

1. The _command invocation API_ allows invocation of any `nim` command without forking a separate process and with convenient output capture.  It is based on `oclif` mechanisms but goes beyond `oclif` by exploiting some `nim`-specific capabilities.
2. The _deployer API_ provides fine-grained programmatic control over the functionality of project deployment and auth management.

All examples are TypeScript.  Using the API from JavaScript should be mostly a matter of omitting types and using `require` instead of `import`.

## Dependencies and Importing

### When using _just_ the deployer API

If you are using _just_ the deployer API, you should have one of the following dependencies in `package.json`

```
"nimbella-deployer": "https://preview-apigcp.nimbella.io/nimbella-deployer.tgz"
```
or

```
"nimbella-deployer": "https://preview-apigcp.nimbella.io/nimbella-deployer-<semver>.tgz"
```
e.g.

```
"nimbella-deployer": "https://preview-apigcp.nimbella.io/nimbella-deployer-1.6.1.tgz"
```

The first form (with no version in path) gives you the latest version, usually pre-release.   The second form refers to specific stable versions of `nimbella-cli` and should be used when the consuming code is itself intended for a public release.

You import functions, objects and types like this.

```
import { initializeAPI, Flags, deployProject, ... } from 'nimbella-deployer'
```

### When using the command invocation API _or both APIs_

If you are using the command invocation API, or both APIs, the dependency should be declared like this.

```
"nimbella-cli": "https://preview-apigcp.nimbella.io/nimbella-cli.tgz"
```
(for pre-release) and

```
"nimbella-cli": "https://apigcp.nimbella.io/downloads/nim/nimbella-cli.tgz"
```
(for the current stable release).  There is no way to depend on stable releases other than the current one.

You import the command invocation API like this.

```
import { runNimCommand, CaptureLogger } from 'nimbella-cli'
```
And you import the deployer API like this.

```
import { initializeAPI, Flags, deployProject, ... } from 'nimbella-cli/deployer'
```

## The Command Invocation API

### Types

#### CaptureLogger

Objects of this type are returned from command invocation.

```
interface CaptureLogger {
    table: object[] // The output table (array of entity) if any
    captured: string[] = [] // Captured line by line output
    entity: object     // A single output entity if any
}
```

Which of these fields are present depends on the command invoked.

- `captured` is always present but may be empty.  It contains the line-by-line output of the command that doesn't fit the other categories
- `table` contains tabular output of commands that list OpenWhisk entities (e.g. `action list`, `activation list` ...).  Each `object` is the raw entity as returned from the backend (pre-formatted).  It is absent otherwise.
- `entity` contains a single OpenWhisk entity as returned by commands that fetch such entities in JSON format (e.g. `action get` or `namespace get --json`).  The `object` is a JavaScript object, however, not a JSON string.  It is absent otherwise.

### Functions

#### runNimCommand

This is used to run a single `nim` command.

```
function runNimCommand(command: string, args: string[]): Promise<CaptureLogger>
```

The `command` string must be in the form `topic/command` if the command is in a topic or just `command` if not.  Note the slash separator (not blank or colon).

The `args` are exactly the arguments you would pass on the command line (including flags, if any, using their external syntax).

Note that what is returned is a promise.  The result must be thened or awaited to obtain the filled-in `CaptureLogger` with the result.

## The Deployer API

### Types

#### Credentials

You may either retrieve this type from the credential store using one of several methods or construct it manually.

```
// The Result of a credential lookup
export interface Credentials {
    namespace: string|undefined
    ow: OWOptions
    storageKey: CredentialStorageEntry|undefined
    redis: boolean
    commander?: object
}
```
The `commander` member is an example of an optional extension.  The deployer will define what extensions are legal but not concern itself with their contents.  Currently, `commander` is the only such extension.

#### DeployResponse

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

#### DeployStructure

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
    includer?: Includer              // The 'includer' for deciding which packages, actions, web are included in the deploy
    reader?: ProjectReader           // The project reader to use
    versions?: VersionEntry          // The VersionEntry for credentials.namespace on the selected API host if available
    feedback?: Feedback              // The object to use for immediate communication to the user (e.g. for warnings and progress reports)
}
```

Many types used in this structure are not yet documented.   Those that may be usefully inspected will eventually be documented.

#### DeploySuccess

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

#### Feedback

```
// Object to provide feedback (warnings and progress reports) in real time during execution.
// Not used for debugging, for normal communiation, or for errors, all of
//   which use other mechanisms.
export interface Feedback {
    warn(message?: any, ...optionalParams: any[]): void
    progress(message?: any, ...optionalParams: any[]): void
}
```

#### Flags

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

#### OWOptions

Contains "low level" authentication for the OpenWhisk stack, usually supplied as part of `Credentials`.

```
export interface OWOptions {
    apihost?: string
    api_key?: string
    ignore_certs?: boolean
}
```

#### Persister

An interface type with the necessary methods to read and write the credential store from stable storage.  The details are not part of the API.  There are only two instances, `browserPersister` and `fileSystemPersister` which are themselves exported.

### Objects

#### browserPersister

A well-known instance of `Persister` for saving the credential store in browser local storage

#### fileSystemPersister

A well-known instance of `Persister` for saving the credential store in the local file system.

### Functions

#### initializeAPI

Always call this before using other API functions.

```
initializeAPI(userAgent: string): {[key: string]: string}
```

- **userAgent** the value that should be sent in `user-agent` headers when invoking remote services.  This value
    1. Must use only characters that are legal in http headers as specified by RFC 7230.
    2. Should begin with a field of the form `<product-name>/version` where the product name is something meaningful to identify the body of code that is using the API and version corresponds to the current version of that code
    3. May contain additional fields with additional information as desired

The function prepares the process environment for other API calls by

1.  Removing all existing `__OW_*` environment variables.  These can cause unexpected results when using the openwhisk NodeJS client.
2.  Storing the **userAgent** value in `__OW_USER_AGENT` in the environment.
3.  Returning a map consisting of the environment variables that were deleted from the environment in the event that you need to restore them.

#### addGithubAccount

Adds information about a github account for later use by the deployer when deploying from github.

```
addGithubAccount(name: string, token: string, persister: Persister):
 Promise<any>
```

The `token` argument must a valid access token for github (preferably one that will not expire).   The `name` argument provides the account name under which the token is recorded.   It is highly recommended that this name match the actual github username that the `token` belongs to.  This is not checked by the API but an incorrect name can cause confusion later, as more accounts are added.

#### addCommmanderData

Adds or replaces the `commander` member of a credential entry.

```
addCommanderData(apihost: string, namespace: string, data: object,
 persister: Persister): Promise<boolean> {
```

The entry must already exist and is identified by the combination of `apihost` and `namespace`.  A `false` return indicates that the entry was not found.  A `true` return indicates success.

#### buildProject

Performs the third of four steps (read, prepare, build, deploy) needed to deploy a project.

```
buildProject(project: DeployStructure): Promise<DeployStructure>
```

The input `DeployStructure` represents a project that has been read and prepared for building but not yet built.  One obtains this using `readAndPrepare`.  The output `DeployStructure` represents a project that has been built.

#### deploy

Performs the final step of `deployProject` but can be invoked explicitly after obtaining a `DeployStructure` from `readPrepareAndBuild` or another function that produces a `DeployStructure`.  Do not create your own `DeployStructure`.

```
deploy(todeploy: DeployStructure): Promise<DeployResponse>
```

#### deployProject

The highest level API for deploying a project.  It actually performs four steps (read, prepare, build, deploy) each of which is covered by a lower level function in the API.  There are also convenience methods to perform the first two steps (`readAndPrepare`) or the first three (`readPrepareAndBuild`).

```
deployProject(path: string,
              owOptions: OWOptions,
              credentials: Credentials|undefined,
              persister: Persister,
              flags: Flags,
              userAgent?: string,
              feedback?: Feedback): Promise<DeployResponse>
```
- **path**: the project path as it would appear on the command line (github or local)
- **owOptions**: used when `credentials` is omitted (see below)
- **credentials**: the `Credentials` object to use as Nimbella authentication
- **persister**:  one of `fileSystemPersister` or `browserPersister` to be used if `credentials` is omitted
- **flags**: contains flags normally specified on the command line
- **userAgent**: a placeholder, optional, and always ignored.  Will be removed soon
- **feedback**: an optional object of type `Feedback`, used to feedback progress reports and warnings during the deployment.  If this is not provided, progress reports and warnings will print via the global `console` object.

Credentials processing is a bit complicated because there are a number of cases to be supported.  _In general_ supply a `Credentials` object with at least the `ow` field initialized.

However, the credentials argument may be omitted if a valid `persister` is supplied and at least the `apihost` field of `owOptions` is filled in.  In that case,

- if the project config specifies a `targetNamespace`, the credentials for that namespace (on the provided `apihost`) will be used.
- Otherwise, the current namespace will be used if there is one (and it's an error if there isn't one).

#### getCredentials

Gets the credentials for the current namespace.

```
getCredentials(persister: Persister): Promise<Credentials>
```

#### getCredentialsForNamespace

Gets the credentials for a specific namespace assumed to be in the credential store.

```
getCredentialsForNamespace(namespace: string,
                           apihost: string,
                           persister: Persister): Promise<Credentials>
```

The `apihost` may be falsey, in which case the function will find the entry by name alone; however, an error will be thrown in that case if the namespace exists on more than one host in the credential store.

#### prepareToDeploy

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

#### readAndPrepare

Performs the first two of the four steps (read, prepare, build, deploy) in deploying a project.

```
readAndPrepare(path: string,
               owOptions: OWOptions,
               credentials: Credentials,
               persister: Persister,
               flags: Flags,
               userAgent?: string,
               feedback?: Feedback): Promise<DeployStructure>
}
```

For an explanation of the arguments, see `deployProject`.

#### readPrepareAndBuild

Performs the first three of the four steps (read, prepare, build, deploy) in deploying a project.

```
readPrepareAndBuild(path: string,
                    owOptions: OWOptions,
                    credentials: Credentials,
                    persister: Persister,
                    flags: Flags,
                    userAgent?: string,
                    feedback?: Feedback): Promise<DeployStructure>
```

For an explanation of the arguments, see `deployProject`.

#### readProject

Performs the first of the four steps (read, prepare, build, deploy) in deploying a project.  Produces a basic `DeployStructure` for the project but does not merge in credentials and flags (that is done in the prepare step).

```
function readProject(projectPath: string,
                     envPath: string,
                     includer: Includer,
                     feedback?: Feedback): Promise<DeployStructure>
```

- **projectPath**: the project path as it would appear on the command line (github or local)
- **envPath**: what would appear in the `env` member of `Flags` of `deployProject`
- **includer**: a parsed form of what would appear in the `include` and `exclude` members of `Flags` of `deployProject`
- **feedback**: see `deployProject`


