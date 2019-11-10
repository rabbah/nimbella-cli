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
# This script makes the tarball(s) from aio that are used in the nimbella-cli build.
# It also installs the tarballs as dependencies and maintains the aio.hash file.
#

set -e
SELFDIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd $SELFDIR

# First run a clean build in aio
pushd ../aio-cli-plugin-runtime
git clean -fdx
npm install
popd

# Generate the package tarball
npm pack ../aio-cli-plugin-runtime

# Install the tarball as an npm package
TARBALL=$(echo adobe-aio-cli-plugin-runtime*)
npm install --save $TARBALL

# Record that nimbella-cli is now up to date with aio-cli-plugin-runtime
./aioUpToDate.sh record
