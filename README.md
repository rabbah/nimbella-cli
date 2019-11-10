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
 - **permissions in /usr/local**
   * you will require write permission to at least `bin` and `lib` and the directories under them.
   * Set up group membership and permissions to make this possible on your machine without the need to use `sudo` routinely.

### Co-requisite repositories
- **main** should be a sibling and should be up-to-date.
  - It need not be built.
- **aio-cli-plugin-runtime** should be a sibling and should be up-to-date
  - Clone this from `nimbella-corp` (a fork), not directly from Adobe.
  - Checkout its `dev` branch rather than `master` (the setup will check this)
  - It need not be pre-built but will build as part of setup.

**workbench** is needed only if you are building the stable deployer

### Setup

The following should be done initially and then periodically if `aio-cli-plugin-runtime` changes.  The build will check and warn when `aio-cli-plugin-runtime` needs to be pulled.

```
./makeAioPacks.sh
```
(in this repo).

### Routine Building

The following suffices when there have been no changes to `aio-cli-plugin-runtime`.

```
./build.sh
```
in this repo.  The command `nimb` should now be in your path.  For now, `deployProject` will also be in your path.

### If you make a change to `aio-cli-plugin-runtime`

(as opposed to just pulling a chnage made by someone else).  Actually, you only need to do this for changes on the `dev` branch since the `master` branch should just be tracking the upstream repo and is not used by this build.  Of course, a _rebase_ of the `dev` branch counts as a change.

- First _commit_ the change in `aio-cli-plugin-runtime` (it need not be pushed yet)
- Then, in this repo, run `./makeAioPacks.sh`
- Then, in this repo, commit `aio.hash` and `package.json` (if it has changed)
- Push at will

### Usage

`nimb`

To get started.
