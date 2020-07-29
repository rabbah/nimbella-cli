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
# This script updates package.json and commander.hash to reflect the latest commit in commander-cli

set -e
SELFDIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd $SELFDIR

# Check that commander-cli is on the master branch with no uncommitted changes.
pushd ../commander-cli
DIRTY=$(git status --porcelain)
BR=$(git symbolic-ref HEAD --short)
if [ -n "$DIRTY" ]; then
		echo "commander-cli has uncommitted changes"
		exit 1
fi
if [ "$BR" != "master" ]; then
		echo "commander-cli is not on the 'master' branch"
		exit 1
fi
popd

# Record, then retrieve, the commander hash
./commanderUpToDate.sh record
HASH=$(cat commander.hash)
REF="nimbella/commander-cli#$HASH"

# Edit package.json so that the correct dependency is declared there
jq -r '.dependencies."commander" = "'$REF'"' < package.json > tmp.json
mv tmp.json package.json
