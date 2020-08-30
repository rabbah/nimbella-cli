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

# Check that the public repo is cloned in the expected place.  If it is not
# there, clone it.  Then check that its githash matches one stored in public.hash.
# If we can't get that far, abort.
# Otherwise, replace 'src' and 'deployer/src' on this repo with public ones.
# For now, some metadata files (e.g. package.json) are maintained in both places and not copied.

# Orient
SELFDIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
PARENT=$(dirname $SELFDIR)
PUBLIC="$PARENT/public"
PUBLIC_CLI="$PUBLIC/nimbella-cli"
cd $SELFDIR

# Ensure presence of public clone
if [ ! -d "$PUBLIC_CLI" ]; then
		if [ ! -d $PUBLIC ]; then
				mkdir "$PUBLIC"
		fi
		pushd $PUBLIC
		git clone https://github.com/nimbella/nimbella-cli.git
		popd
fi

# Check whether public repo is at the expected commit unless check is suppressed (for testing)
if [ -z "$NO_CHECK" ]; then
		UPTODATE=$(./publicUpToDate.sh)
		if [ "$UPTODATE" == "false" ]; then
				echo "Incompatible releases for 'public/nimbella-cli' and 'nimbella-cli'."
				exit -1
		elif [ "$UPTODATE" != 'true' ]; then
				echo $UPTODATE
				exit -1
		fi
fi

# Copy src from public to here
rm -fr src deployer/src
cp -r $PUBLIC_CLI/src .
cp -r $PUBLIC_CLI/deployer/src deployer
