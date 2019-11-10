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

# Builds the 'nim' CLI (temporarily called 'nimb')

# Orient
set -e
SELFDIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd $SELFDIR

# Check repo synchronization
UPTODATE=$(./aioUpToDate.sh)
if [ "$UPTODATE" == "false" ]; then
    echo "Incompatible releases for 'aio-cli-plugin-runtime' and 'nimbella-cli'.  Bring both repos up to date, then run './makeAioPacks.sh' in nimbella-cli."
    exit -1
elif [ "$UPTODATE" != 'true' ]; then
    echo $UPTODATE
    exit -1
fi
TARBALL=$(grep -e '@adobe/aio-cli-plugin-runtime' package.json | sed -e 's/^.*file://' | sed 's/".*$//')
if [ ! -f "$TARBALL" ]; then
		echo "The required AIO  tarball is not present. './makeAioPacks.sh' needs to be run first."
		exit -1
fi

# Store version info (TODO: currently this is done in the deployer directory as well; eventually it should only be done in one place)
HASH=$(git rev-parse HEAD)
DIRTY=$(git status --porcelain)
if [ -n "$DIRTY" ]; then
    DIRTY="++"
fi
BUILDINFO=${HASH:0:8}${DIRTY}
VERSION=$(jq -r .version package.json)
echo '{ "version": "'$VERSION '('$BUILDINFO')" }' | jq . > version.json

# Build the deployer
deployer/build.sh

# Build the HTML form of the documentation
pandoc -o nim.html -f markdown -s -t html < doc/nim.md

# Install
npm install
npm install deployer.tgz

# Fix nit in the help command description
TOFIX="node_modules/@oclif/plugin-help/oclif.manifest.json"
FIXJSON=$(sed -e 's/display help/Display help/' < "$TOFIX")
echo "$FIXJSON" > "$TOFIX"

# Build
npx tsc
npm link
