<!--
#
# Nimbella CONFIDENTIAL
# ---------------------
#
#   2018 - present Nimbella Corp
#   All Rights Reserved.
#
# NOTICE:
#
# All information contained herein is, and remains the property of
# Nimbella Corp and its suppliers, if any.  The intellectual and technical
# concepts contained herein are proprietary to Nimbella Corp and its
# suppliers and may be covered by U.S. and Foreign Patents, patents
# in process, and are protected by trade secret or copyright law.
#
# Dissemination of this information or reproduction of this material
# is strictly forbidden unless prior written permission is obtained
# from Nimbella Corp.
#
-->

# Deployer

`deployer` is the project deployment engine for Nimbella customers.

The code is hosted in the `workbench` repo but it is an independent npm package.

- It exports interfaces and functions for use in Typescript or Javascript consumers that declare it as a dependency (e.g. the workbench).
- It provides a simple CLI (`deployProject`) that can be used in scripts.

## Dependencies
  - `node.js` at version 10 or greater
  - `pandoc` (for building documentation).  You only need this when building a deployer for distribution to customers.  If it is absent, you can still build the deployer for local use.   To install it
  	- (on mac) use `brew install pandoc`
  	- for other platforms [look here](https://pandoc.org/installing.html)

## Building
 - The deployer can be built for internal use using `build.sh` in the `deployer` directory.
 - In the `main` repo, `build.sh deploycmd` will invoke the deployer build.
 - All workbench `build*.sh` scripts build the deployer as a side-effect.
 - To build a deployer for external distribution, use `buildMinified.sh`.
 	- How to deploy the result on the landing page and save it as a stable version is beyond the scope of this README.
 	- This _requires_ `pandoc` to be installed


## Embodiments
- In lieu of publication, the deployer is available as an npm-installable tarball in the root of the workbench repo.
- When the deployer is built, an `npm link` is also issued that should have these effects:
   * The `deployProject` command is symlinked to a directory that is likely to be in your PATH (/usr/local/bin on mac).
   * The 'deployer' package can, if you like, be declared as a dependency using `npm link deployer`.   Note that this produces a symlink in `node_modules`
     and is only reliable for local development.  The workbench does not do this, it declares a file path to the tarball.

## CLI Usage Instructions

These are to be found by executing `deployProject --doc`.  This displays the file `deployer.html` which is build from `deployer.md`.

## The exported library functions

```
deployProject(path: string, overridingOptions: InitOptions, defaultOptions: InitOptions,
        targetNamespace: string, verboseBuild: boolean): Promise<DeployResponse>
```
This is the highest level interface, the one used by both the workbench and the CLI.  The type `DeployResponse` is declared in `deploy-struct.ts`.   The type `InitOptions` is also declared there and corresponds to the `initOptions` member of the config file.  The "overriding" options take precedence over those in the config, while the "default" ones are used only if not otherwise specified.  Things like `.wskprops` would go in the default options.  It is the caller's responsibility to read .wskprops (or similar files), however.  It is also the caller's responsibility to augment the process environment for use in substitution variables, if that is to be done.   The `verboseBuild` flag has the effect ascribed to the `--verbose-build` command line flag.  The `targetNamespace` flag has the effect ascribed to the `--targetNamespace` command line flag.

```
deploy(todeploy: DeployStructure): Promise<DeployResponse>
```
This is a lower level interface that assumes the project contents have been read from disk and organized into a `DeployStructure` (declared in `deploy-struct.ts`).

```
readProject(projectPath: string): Promise<DeployStructure>
```

This is the function that reads a project structure from disk (including `projectConfig.json`, if present) and organizes it into a `DeployStructure`.   It screens various errors, but otherwise reflects the project as specified.  It does not perform action wrapping, merging of `initOptions` or running the "find and build" capability on action or web subdirectories.

```
prepareToDeploy(inputSpec: DeployStructure, overridingOptions: InitOptions, defaultOptions: InitOptions,
        targetNamespace: string): Promise<DeployStructure>
```

This function transforms the project by performing action wrapping and merging the `initOptions` and `targetNamespace`.  Neither of these activities modify what is on the disk (only the representation of the project in memory).

```
function buildProject(project: DeployStructure, verboseBuild: boolean): Promise<DeployStructure>
```

This function runs the "find and build" capabilities on every eligible subdirectory that requires building.  This includes effects called for by `.source`, `build.sh`, and `package.json` files and also the "auto-zip" capability for action subdirectories containing more than one source file.  This does modify the contents of the disk in the case of explicit build actions (`build.sh`, `package.json`, and auto-zip) but not in the case of `.source` directives.
