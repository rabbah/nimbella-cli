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

# nimbella-cli

A comprehensive CLI for the Nimbella stack

### Prerequisites
##### For Local Builds
 - **node**
   * version 10 or later is required
 - **npm**
 - **pandoc**
   * on mac you can use `brew install pandoc`.
   * for other platforms, [look here](https://pandoc.org/installing.html)
 - **jq**
   * on mac you can use `brew install jq`.
   * for other platforms, [look here](https://stedolan.github.io/jq/download/)
 - **permissions in /usr/local**
   * you will require write permission to at least `bin` and `lib` and the directories under them.
   * Set up group membership and permissions to make this possible on your machine without the need to use `sudo` routinely.

##### For stable builds (must be on mac)
You also need

 - **p7zip**
   * needed for windows packager only
   * on mac you can use `brew install p7zip`
 - **makensis**
   * needed for windows packager only
   * on mac you can use `brew install makensis`
 - **xcode 11 or later**
   * specifically need `altool`, `pkgbuild` and `spctl` in your path.  At least the first of these requires a full Xcode install
 - **Apple Developer ID**
   * consult Rodric Rabbah, who is our account owner in the Apple Developer program
 - **a certificate of type 'Developer ID Installer' and a private key for same**
   * consult Rodric or Josh Auerbach

### Co-requisite repositories
##### For Local Builds

- **public/nimbella-cli** should be a sibling.
  * it should be cloned from `nimbella/nimbella-cli`
  * if it is not present, the build in this repo will clone it for you but once it is present you must keep it up to date
  * it need not be built
- **main** should be a sibling and should be up-to-date.  It need not be built.

##### For Stable Builds or when modifying `aio` or `commander-cli` dependencies

You also need

- **aio-cli-plugin-runtime**

  * This is a fork of an Adobe open source project.   It should be checked out on the `dev` branch.

- **commander-cli**

  * This is our own repo, maintained by the commander team.  It should be checked out on the `master` branch.

- **workbench**

  * Need not be built.  It is where the stable versions are stored.


### Routine Building

The following suffices to build the current `nim` using the current version of our Adobe I/O and commander dependencies and the current public source.

```
./build.sh
```
in this repo, or

```
./build.sh nimcli
```
in `main`.  In either case, the command `nim` should now be in your path.

### Building the Adobe I/O dependency for testing

For this, you do need the `aio-cli-plugin-runtime` repo to be a sibling of this one.

  - Clone it from `nimbella-corp` (a fork), not directly from Adobe.
  - Checkout its `dev` branch rather than `master` (scripts will check this)
  - It need not be pre-built (scripts will build it)


Prior to testing, issue

```
./testaio.sh
```

This changes `package.json` so that a local relative file system reference is used for the `aio` dependency, rather than the github reference that is normally used.

Once this has been done, use the normal build procedure for testing.

When finished with testing, issue

```
./testaio.sh --reset
```

This restores `package.json` from a backup.

** Note **: although the `commander-cli` dependency bears similarities to the `aio` dependency in other ways, this testing procedure does not apply to it.  Testing there can be done with `nim plugin link <path-to-commander-cli>`.

### Committing a new (tested) version of the Adobe I/O dependency or the commander-cli dependency

- First _commit_ the change in `aio-cli-plugin-runtime` or `commander-cli` respectively and _push_ that commit to the remote repo.  This enables github references to the commit.
- Then, in this repo, run `./commitAioPacks.sh` or `./commitCommanderPacks.sh`
- Then, in this repo, commit `aio.hash` and `package.json`, which will have changed as a result
- (Push this repo when ready).

### Stable Versions

Building a stable version requires `aio-cli-plugin-runtime` and `commander-cli` to be present (for checking; they are not rebuilt).   It also requires the `workbench` repo as a peer because that is where stable versions are kept.

###### Decide whether the new stable version is a major, minor or patch release.
- This choice should be followed consistently for every `npm version` command you issue in the following (there are several).
- The file `doc/changes.md` should be updated accordingly before you proceed further.  That is a manual process involving looking at what has been committed and what issues have been stacked since the last stable release.

###### In this repo (not the public one)

```
cd deployer && npm version [ major | minor | patch ]
```

###### In the root of this repo
```
./build.sh --pre-stable
```

This uploads the new deployer so it can be used by `commander-cli`.

###### In the `commander-cli` repo
- Change the dependency in `package-json` to reflect the new deployer semver created by in the earlier steps.
- This must be committed and pushed on `master` before proceeding with the rest of the stable build.
- If this requires a PR and merge, allow time for that.

###### In the root of this repo

```
./commitCommanderPacks.sh
```

This ensures that the latest commander with the updated dependency is included in the stable version build.

###### In `public/nimbella-cli`

```
cd deployer && npm version [ major | minor | patch ]
```

###### Commit the previous change

###### In the root `public/nimbella-cli`

```
npm version [ major | minor | patch ]
```

This is self-committing due to a lifecycle script and it also makes a tag.

###### In the root of this repo

```
./publicUpToDate.sh record
```

This records a new hash for the public repo, which you just changed

###### Commit everything to date in this repo (covers several earlier steps)

###### In the root of this repo

```
npm version [ major | minor | patch ]
```

###### The actual build

1. Enter your Apple Developer Id and password in the environment variables `APPLE_ID` and `APPLE_PWD`
   * You can use a keychain reference for the password if you don't want to put it directly in the environment
2. In the `main` repo issue `./build.sh newstablecli`
3. The script will attempt to sign the MacOS installer and submit it to Apple for notarization.
   * If that fails, you may be able to restart at that point by directly calling the sub-script `signAndNotarize.sh`
   * If the sign and submit process succeeds, you will still have to wait for an email from Apple telling you whether notarization was successful.
4. Once notarization has succeeded, check that the MacOS installer is fully acceptable by switching to this repo (`nimbella-cli`, not `main`) and issuing `./build.sh --check-stable`

The script will check that you did the first three steps and will also check that the repos are in synch with each other.  The new stable version will be in `workbench/stable`

### Usage

`nim`

To get started.

### Running without `tsc` build (for local development only)

The following command is handy for quick testing of new features.
It will run the CLI without compiling typescript code explicitly.

First run `npm install` then you can run the CLI as follows.
`./node_modules/.bin/ts-node bin/run`
