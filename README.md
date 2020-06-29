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
- **main** should be a sibling and should be up-to-date.  It need not be built.

##### For Stable Builds or when modifying the `aio runtime` dependency
You also need

- **aio-cli-plugin-runtime**

  * This is a fork of an Adobe open source project.   It should be checked out on the `dev` branch.

- **workbench**

  * Need not be built.  It is where the stable versions are stored.


### Routine Building

The following suffices to build the current `nim` using the current version of our Adobe I/O dependency.

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

### Committing a new (tested) version of the Adobe I/O dependency

- First _commit_ the change in `aio-cli-plugin-runtime` and _push_ that commit to the remote repo.  This enables github references to the commit.
- Then, in this repo, run `./commitAioPacks.sh`
- Then, in this repo, commit `aio.hash` and `package.json`, which will have changed as a result
- Push this repo.

### Stable Versions

Building a stable version requires `aio-cli-plugin-runtime` (for checking; it is not rebuilt).   It also requires the `workbench` repo as a peer because that is where stable versions are kept.

1. Commit this repo (there can be no uncommitted changes).
2. Issue `npm version patch`
3. Enter your Apple Developer Id and password in the environment variables `APPLE_ID` and `APPLE_PWD`
   * You can use a keychain reference for the password if you don't want to put it directly in the environment
4. In the `main` repo issue `./build.sh newstablecli`
5. The script will attempt to sign the MacOS installer and submit it to Apple for notarization.
   * If that fails, you may be able to restart at that point by directly calling the sub-script `signAndNotarize.sh`
   * If the sign and submit process succeeds, you will still have to wait for an email from Apple telling you whether notarization was successful.
6. Once notarization has succeeded, check that the MacOS installer is fully acceptable by switching to this repo (`nimbella-cli`, not `main`) and issuing `./build.sh --check-stable`

The script will check that you did the first three steps and will also check that the repos are in synch with each other.  The new stable version will be in `workbench/stable`

### Usage

`nim`

To get started.
