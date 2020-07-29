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
# This script fixes up the github ref in package.json for the commander plugin.  TEMPORARY until the commander-cli repo is public.

set -e
SELFDIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd $SELFDIR

# Retrieve commander hash and calculate the fixed-up github ref including the value of $GITPAT
HASH=$(cat commander.hash)
REF="https://nimbella-bot:$GITPAT@github.com/nimbella-corp/commander-cli.git#$HASH"

# Edit package.json so that the correct dependency is declared there
jq -r '.dependencies."commander" = "'$REF'"' < package.json > tmp.json
mv tmp.json package.json
