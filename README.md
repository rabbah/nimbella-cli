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
 - **node**
   * version 10 or later is required
 - **npm**
 - **pandoc**
   * on mac you can use `brew install pandoc`.
   * for other platforms, [look here](https://pandoc.org/installing.html)
 - **jq**
   * on mac you can use `brew install jq`.
   * for other platforms, [look here](https://stedolan.github.io/jq/download/)
 - **p7zip**
   * needed for windows packager only
   * on mac you can use `brew install p7zip`
 - **makensis**
   * needed for windows packager only
   * on mac you can use `brew install makensis`
 - **permissions in /usr/local**
   * you will require write permission to at least `bin` and `lib` and the directories under them.
   * Set up group membership and permissions to make this possible on your machine without the need to use `sudo` routinely.

### Co-requisite repositories
**main** should be a sibling and should be up-to-date.  It need not be built.

**aio-cli-plugin-runtime** contains our modifications to a major dependency which we get from Adobe I/O.  It does _not_ need to be present just to build the current version of `nim` for internal use.  However, it _does_ need to be present if making further modifications to that dependency or if creating a stable version of `nim'.

**workbench** is needed only if you are building a stable version of `nim`.


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

Build it with

```
./makeAioPacks.sh
```
in this repo.  The result should be a tarball in the root of this repo.

Test it with

```
./build.sh --testaio
```

The `--testaio` flag causes the local tarball to be used for the dependency, rather than the deployed version that is normally used.

### Committing a new (tested) version of the Adobe I/O dependency

- First _commit_ the change in `aio-cli-plugin-runtime` (it need not be pushed yet)
- Then, in this repo, run `./commitAioPacks.sh`
- Then, in this repo, commit `aio.hash` and `package.json`, which will have changed as a result
- Push both repos at will

### Stable Versions

Building a stable version requires `aio-cli-plugin-runtime` (for checking; it is not rebuilt).   It also requires the `workbench` repo as a peer because that is where stable versions are kept.

1. Commit this repo (there can be no uncommitted changes).
2. Issue `npm version patch`
3. In the `main` repo issue `./build.sh newstablecli`

The script will check that you did the first two steps and will also check that the two repos are in synch with each other.  The new stable version will be in `workbench/stable`

### Usage

`nim`

To get started.
