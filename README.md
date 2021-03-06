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

This is the _private_ `nimbella-cli` repo.  It contains

- all the build scripts and other metadata for building and releasing `nim` as part of the Nimbella stack
- the documentation source

There is also a _public_ (open source) `nimbella-cli` repo at [https://github.com/nimbella/nimbella-cli](https://github.com/nimbella/nimbella-cli).  It contains

- the TypeScript source code of `nimbella-cli`
- some documents to support OSS contributions
- alternate `package.json` files providing a simplified build process

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

- **public/nimbella-cli** should be a sibling
  * the file `public.hash` contains the commit of the public repo that goes with the present commit of this repo
  * if the public repo is not present, the build in this repo will clone it for you
  * if the public repo is present and has no local modifications, or if it was just cloned automatically, the build in this repo will check it out to the correct commit
  * if the public repo is present and already checked out to the correct commit, its contents will be used even if locally modified (to support testing)
  * if the public repo is at the wrong commit and also locally modified, the build will abort.  This case must be corrected manually.
  * the public repo need not be built itself
     - unless you are using an IDE to modify its contents
     - in which case you might want to build it according to its own procedures to support IDE navigation, compile on save, etc.
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

### Staging to the preview site

We maintain a preview site at [https://preview-apigcp.nimbella.io](https://preview-apigcp.nimbella.io).  This site is primarily for internal use.  It is updated nightly with the latest committed Nimbella CLI code.

After an important change, instead of waiting for the nightly job, you can "publish" that change for internal teams

1.  Make sure that this repo and the public `nimbella-cli` repo are in sync and fully committed.
2. In the root of this repo, issue

```
./build.sh --preview
```

### Publishing to the 'beta' channel of the 'nim' update site

It is sometimes useful to expose customers to upcoming changes or to let a customer test a fix you have just committed.  We used to use the preview site for this, but that is no longer recommended.  Instead, we maintain a `beta` update channel.

#### Posting a new pre-release to the beta channel

You will be unable to do this unless you have at least editor rights to `nimgcp`.  If you do not, request that this be done by someone who is an editor or owner.

1.  Make sure that this repo and the public `nimbella-cli` repo are in sync and fully committed.
2. In the `main` repo, make sure it is at `master head`.
3. In the `main` repo, make sure `nimadmin` is built (`./build.sh nimadmin`).
4. In the `main` repo, make sure the content is staged (`./build.sh content nimgcp`).
5. In this repo, issue `./build.sh --channel beta`
6. In the `main` repo, issue

```
nimadmin project set nimgcp
nimadmin nginx upload downloads/nim/channels
```

#### Instructing customers on the use of the beta channel

A customer can switch from the stable update channel to the beta channel using

```
nim update beta
```

and back to the stable channel with

```
nim update stable
```

If the channel is not specified on `nim update`, the channel currently in use is remembered and the customer stays on that channel.  The channel is visible in the version string shown in `nim --help`, `nim version`, and `nim info`.

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

Due to recent increases in complexity this is more manual than I'd like but it is better to document it clearly than not and it will be more automated eventually to the extent that I can.

##### (1) Decide whether the new stable version is a major, minor or patch release.
- This choice should be followed consistently for every `npm version` command you issue in the following (there are several).
- The file `doc/changes.md` should be updated accordingly before you proceed further.  That is a manual process involving looking at what has been committed and what issues have been stacked since the last stable release.

##### (2) In this repo (not the public one)

```
cd deployer && npm version [ major | minor | patch ]
```

##### (3) In the root of this repo
```
./build.sh --pre-stable
```

This uploads the new deployer so it can be used by `commander-cli`.

##### (4) In the `commander-cli` repo
- Change the dependency in `package-json` to reflect the new deployer semver created by in the earlier steps.
- This must be committed and pushed on `master` before proceeding with the rest of the stable build.
- If this requires a PR and merge, allow time for that.

##### (5) In the root of this repo

```
./commitCommanderPacks.sh
```

This ensures that the latest commander with the updated dependency is included in the stable version build.

##### (6) In `public/nimbella-cli`

```
cd deployer && npm version [ major | minor | patch ]
```

##### (7) Commit the previous change

##### (8) In the root `public/nimbella-cli`

```
npm version [ major | minor | patch ]
```

This is self-committing due to a script in `package.json` and it also makes a tag.

##### (9) In the root of this repo

```
./publicUpToDate.sh record
```

This records a new hash for the public repo, which you just changed

##### (10) Commit everything to date in this repo (covers several earlier steps)

##### (11) In the root of this repo

```
npm version [ major | minor | patch ]
```

##### (12) The actual build (Driven mostly from `main`)

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
