#!/bin/bash
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
#
# This script makes the tarball from aio-cli-plugin-runtime that is used in the nimbella-cli build.
# When called directly, there are minimal checks and the result is suitable for testing.
# When called by commitAioPacks.sh there are numerous checks and the result is committed to a public location

set -e
SELFDIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd $SELFDIR
MAINDIR=$SELFDIR/../main

# First run a clean build in aio
pushd ../aio-cli-plugin-runtime
git clean -fdx
npm install
popd

# Generate the package tarball
npm pack ../aio-cli-plugin-runtime
pushd ../aio-cli-plugin-runtime
git checkout README.md
popd

# Give the tarball a stable name
TARBALL=$(echo adobe-aio-cli-plugin-runtime-*.tgz)
mv $TARBALL adobe-aio-cli-plugin-runtime.tgz
npm install adobe-aio-cli-plugin-runtime.tgz
