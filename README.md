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

This is a new effort and these instructions are subject to change.

### Co-requisite repositories
The following repositories must be cloned to have a common parent with this one.

- `workbench`
- `main`

Neither needs to be built ahead of the following.

### Building

1. Build the deployer by issuing `./build.sh deploycmd` in the `main` repo.
2. Then build the CLI by issuing `./build.sh` in this repo.

The command `nimb` should now be in your path.

### Usage

`nimb`

To get started.
