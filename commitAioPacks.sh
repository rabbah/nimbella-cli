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
# This script updates package.json and aio.hash to reflect the latest commit in aio

set -e
SELFDIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd $SELFDIR

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

# Record, then retrieve, the aio hash
./aioUpToDate.sh record
HASH=$(cat aio.hash)
REF="nimbella/aio-cli-plugin-runtime#$HASH"

# Edit package.json so that the correct dependency is declared there
jq -r '.dependencies."@adobe/aio-cli-plugin-runtime" = "'$REF'"' < package.json > tmp.json
mv tmp.json package.json

# Replay the same edit in the public repo
jq -r '.dependencies."@adobe/aio-cli-plugin-runtime" = "'$REF'"' < ../public/nimbella-cli/package.json > tmp.json
mv tmp.json ../public/nimbella-cli/package.json

