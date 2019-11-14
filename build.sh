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

# Builds the 'nim' CLI

set -e

# Parse
if [ "$1" == "--pack" ]; then
		PKG=true
elif [ "$1" == "--stable" ]; then
		STABLE=true
		PKG=true
elif [ -n "$1" ]; then
		echo "Illegal argument '$1'"
		exit 1
fi


# Orient
SELFDIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
STABLEDIR=$SELFDIR/../workbench/stable
cd $SELFDIR

# Check prereqs for --stable
if [ -n "$STABLE" ]; then
    DIRTY=$(git status --porcelain)
    if [ -n "$DIRTY" ]; then
        echo "The nimbella-cli repo is not fully committed: a stable version cannot be declared"
        exit 1
    fi
    LAST_VERSION=$(jq -r .nimcli < ../workbench/stable/versions.json)
    NEW_VERSION=$(jq -r .version < package.json)
    if [ "$LAST_VERSION" == "$NEW_VERSION" ]; then
        echo "The nim CLI version number was not changed: a new stable version cannot be declared"
        exit 1
    fi
fi

# Check repo synchronization
UPTODATE=$(./aioUpToDate.sh)
if [ "$UPTODATE" == "false" ]; then
    echo "Incompatible releases for 'aio-cli-plugin-runtime' and 'nimbella-cli'.  Bring both repos up to date, then run './makeAioPacks.sh' in nimbella-cli."
    exit -1
elif [ "$UPTODATE" != 'true' ]; then
    echo $UPTODATE
    exit -1
fi

# Store version info
HASH=$(git rev-parse HEAD)
DIRTY=$(git status --porcelain)
if [ -n "$DIRTY" ]; then
    DIRTY="++"
fi
BUILDINFO=${HASH:0:8}${DIRTY}
VERSION=$(jq -r .version package.json)
echo '{ "version": "'$VERSION '('$BUILDINFO')" }' | jq . > version.json

# Copy in the latest runtimes.json and productionProjects.json
cp $SELFDIR/../main/config/runtimes.json .
cp $SELFDIR/../main/config/productionProjects.json .

# Build the HTML form of the documentation
pandoc -o nim.html -f markdown -s -t html < doc/nim.md

# Install
npm install

# Build
npx tsc
npm link

# Optionally package
if [ -n "$PKG" ]; then
		rm -fr dist tmp nim-cli.tgz
		mv README.md devREADME.md
		mv userREADME.md README.md
		npx oclif-dev pack -t linux-x64,win32-x64,darwin-x64
		npx oclif-dev pack:macos
		npx oclif-dev pack:win
		mv README.md userREADME.md
		mv devREADME.md README.md
		pushd dist
		rm -f win/*x86*
		tar czf ../nim-cli.tgz *
		popd
fi

# Optionally make stable version
if [ -n "$STABLE" ]; then
    mv nim-cli.tgz $STABLEDIR
    cd $STABLEDIR/..
    ./setStableVersions.sh
fi
