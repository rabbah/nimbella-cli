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

set -e
SELFDIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd $SELFDIR
MAINDIR=$SELFDIR/../main

# Check that aio-cli-plugin-runtime is on the dev branch with no uncommitted changes.
pushd ../aio-cli-plugin-runtime
DIRTY=$(git status --porcelain)
BR=$(git symbolic-ref HEAD --short)
popd
if [ -n "$DIRTY" ]; then
		echo "aio-cli-plugin-runtime has uncommitted changes"
		exit 1
fi
if [ "$BR" != "dev" ]; then
		echo "aio-cli-plugin-runtime is not on the 'dev' branch"
		exit 1
fi

# Run the aio pack build
./makeAioPacks.sh

# Record, then retrieve, the aio hash
./aioUpToDate.sh record
HASH=$(cat aio.hash)
TARBALL_NAME="adobe-aio-cli-plugin-runtime-$HASH.tgz"

# Upload the tarball
gsutil cp adobe-aio-cli-plugin-runtime.tgz gs://nimaio-apigcp-nimbella-io/$TARBALL_NAME

# Edit package.json so that the correct dependency is declared there
URL="https://nimaio-apigcp.nimbella.io/$TARBALL_NAME"
jq -r '.dependencies."@adobe/aio-cli-plugin-runtime" = "'$URL'"' < package.json > tmp.json
mv tmp.json package.json
