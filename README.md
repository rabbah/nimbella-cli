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
  - **workbench** is needed only if you are building the stable deployer

### Building

```
./build.sh
```
in this repo.  The command `nimb` should now be in your path.  For now, `deployProject` will also be in your path.

### Usage

`nimb`

To get started.
