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

# Ensure that the public repo is cloned in the expected place and at the right commit.
# Then replace 'src' and 'deployer/src' on this repo (which are derived folders) with the
# designated public ones.  The package.json files are not copied (they differ slightly
# between public and private).
#
# If the public repo is not there at all, this script actively clones it.  If the repo
# is there and at the right commit, it accepts that whether it is dirty or not.
# If it is there, clean, and at the wrong commit it does a checkout to correct that.
# If it is there, dirty, and at the wrong commit, it aborts.
# These behaviors are designed to accommodate (1) Jenkins, which will get a fresh clone
# (2) most developers, for whom repeated clones are unnecessary but the commit should be
# automatically adjusted, and (3) Active nimbella-cli developers, who might have changes
# under test in the public repo but should at least be starting with matched commits.

# Orient
SELFDIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
PARENT=$(dirname $SELFDIR)
PUBLIC="$PARENT/public"
PUBLIC_CLI="$PUBLIC/nimbella-cli"
cd $SELFDIR

set -e

# Ensure presence of public clone
if [ ! -d "$PUBLIC_CLI" ]; then
		if [ ! -d $PUBLIC ]; then
				mkdir "$PUBLIC"
		fi
		pushd $PUBLIC
		git clone https://github.com/nimbella/nimbella-cli.git
		popd
fi

# Probe public repo to obtain its githash and whether it's dirty
pushd "$PUBLIC_CLI" > /dev/null
HASH=$(git rev-parse HEAD)
DIRTY=$(git status --porcelain)
popd > /dev/null

# Obtain the expected commit
EXPECTED=$(cat public.hash)

# Handle cases where the commit of public is wrong
if [ "$HASH" != "$EXPECTED" ]; then
		if [ -n "$DIRTY" ]; then
				# If dirty, don't mutate and don't proceed
				echo "The public repo is at the wrong commit and dirty (aborting)"
				exit 1
    fi
		# If clean, assume it's ok to change the checked out commit
		pushd "$PUBLIC_CLI" > /dev/null
		git checkout $EXPECTED
		popd > /dev/null
fi

# Copy src from public to here
rm -fr src deployer/src
cp -r $PUBLIC_CLI/src .
cp -r $PUBLIC_CLI/deployer/src deployer
