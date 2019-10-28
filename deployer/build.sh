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

# Builds just the deployer

set -e
SELFDIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd $SELFDIR

# Ensure there is no left over minified area
rm -fr minified

# Update the .version file
HASH=$(git rev-parse HEAD)
DIRTY=$(git status --porcelain)
if [ -n "$DIRTY" ]; then
    DIRTY="++"
fi
BUILDINFO=${HASH:0:8}${DIRTY}
VERSION=$(jq -r .version package.json)
echo '{ "version": "'$VERSION '('$BUILDINFO')" }' | jq . > version.json

# Copy in the latest runtimes.json and productionProjects.json
cp $SELFDIR/../../main/config/runtimes.json .
cp $SELFDIR/../../main/config/productionProjects.json .

# If pandoc is in the path, build the HTML form of the documentation.  If not, just give an informational message
set +e
PD=$(type -t pandoc)
set -e
if [ -z "$PD" ]; then
		echo "Building for local use.  End-user document not included"
else
		pandoc -o deployer.html -f markdown -s -H deployer.css -t html < deployer.md
fi

# Build it
npm install
npx tsc
npm link
cd ..
rm -f deployer-*.tgz
npm pack ./deployer
mv deployer-*.tgz deployer.tgz
