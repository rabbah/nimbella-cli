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
# This script runs makeAioPacks.sh surrounded by checks for consistency and commits the result
# With the --dummy-oclif flag it uses the dummy oclif as aio's @oclif/command dependency and
#  commits the result under a special name.

if [ "$1" == "--dummy-oclif" ] && [ -n "$2" ]; then
		DUMMY_OCLIF="$2"
elif [ -n "$1" ]; then
		echo "Incorrect argument(s)"
		exit 1
fi

set -e
SELFDIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd $SELFDIR
MAINDIR=$SELFDIR/../main

# Check that aio-cli-plugin-runtime is on the dev branch with no uncommitted changes.
pushd ../aio-cli-plugin-runtime
DIRTY=$(git status --porcelain)
BR=$(git symbolic-ref HEAD --short)
if [ -n "$DIRTY" ]; then
		echo "aio-cli-plugin-runtime has uncommitted changes"
		popd
		exit 1
fi
if [ "$BR" != "dev" ]; then
		echo "aio-cli-plugin-runtime is not on the 'dev' branch"
		popd
		exit 1
fi

# If requested, temp-edit the package.json for the aio pack build to use dummy oclif
if [ -n "$DUMMY_OCLIF" ]; then
		URL="https://nimaio-apigcp.nimbella.io/$DUMMY_OCLIF"
		jq -r '.dependencies."@oclif/command" = "'$URL'"' < package.json > tmp.json
		mv tmp.json package.json
fi

# Run the aio pack build
popd
./makeAioPacks.sh

# Clean up from modified package.json
pushd ../aio-cli-plugin-runtime
git checkout package.json
popd

# When not making the dummy version, record then retrieve the aio hash and generate tarball name using it
# For the dummy version, the aio that includes the dummy oclif has a name generated from the dummy oclif name
if [ -z "$DUMMY_OCLIF" ]; then
		./aioUpToDate.sh record
		HASH=$(cat aio.hash)
		TARBALL_NAME="adobe-aio-cli-plugin-runtime-$HASH.tgz"
else
		TARBALL_NAME="aio-with-$DUMMY_OCLIF"
fi

# Upload the tarball
gsutil cp adobe-aio-cli-plugin-runtime.tgz gs://nimaio-apigcp.nimbella.io/$TARBALL_NAME

# Edit package.json so that the correct dependency is declared there
URL="https://nimaio-apigcp.nimbella.io/$TARBALL_NAME"
jq -r '.dependencies."@adobe/aio-cli-plugin-runtime" = "'$URL'"' < package.json > tmp.json
mv tmp.json package.json
