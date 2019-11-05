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

# Builds a minified copy of the deployer.   Optionally makes into a new stable version

SELFDIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
STABLEDIR=$SELFDIR/../../workbench/stable
cd $SELFDIR

PD=$(type -t pandoc)
set -e
if [ -z "$PD" ]; then
		echo "Cannot build an external distribution: pandoc is not installed"
		exit 1
fi

# If --stable requested, check preconditions and note it for later
if [ "$1" == "--stable" ]; then
    DIRTY=$(git status --porcelain)
    if [ -n "$DIRTY" ]; then
        echo "The nimbella-cli repo is not fully committed: a stable version cannot be declared"
        exit 1
    fi
    LAST_VERSION=$(jq -r .deployer < $STABLEDIR/versions.json)
    NEW_VERSION=$(jq -r .version < package.json)
    if [ "$LAST_VERSION" == "$NEW_VERSION" ]; then
        echo "The deployer version number was not changed: a new stable version cannot be declared"
        exit 1
    fi
    STABLE=yes
fi

# Build the deployer in the usual way
./build.sh

# Make the directory in which to hold the minified deployer
mkdir minified minified/deployer

# Stage needed material
cp userREADME.md minified/deployer/README.md
cp deployer.html package.json version.json runtimes.json *.js minified/deployer

# Minify the js files
cd minified/deployer
npm install
for i in *.js; do
		npx minify $i > minified
		mv minified $i
done
chmod +x main.js

# Make the tarball
cd ..
npm pack ./deployer/
FILENAME=$(echo deployer-*.tgz)

# If --stable was requested, move the file to stable and record new version, else simply save result it in the repo root
if [ -n "$STABLE" ]; then
    mv $FILENAME $STABLEDIR/deployer.tgz
    cd $STABLEDIR/..
    ./setStableVersions.sh
else
    mv $FILENAME ../../min$FILENAME
fi
