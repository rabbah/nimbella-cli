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

# This script checks (or records) the HEAD githash of the aio-cli-plugin-runtime repo (branch 'dev')
# and can be used to detect whether it was changed since it was last recorded
# Syntax:
#   ./aioUpToDate
# or
#   ./aioUpToDate record
# Exit status is always 0.  Output is
#   'true' if all sanity checks pass, a check was requested, and it passed
#   'false' if all sanity checks pass, a check was requested, and it failed
#   something other than 'true' or 'false' (explanatory message) if a sanity check fails
#   no output if 'record' was requested

# Command line
if [ "$1" == "record" ]; then
    RECORDING=yes
elif [ ! -z "$1" ];then
    echo "unrecognized argument(s)"
    exit 0
fi

# Probe companion repo
if [ ! -d ../aio-cli-plugin-runtime ]; then
    echo "aio-cli-plugin-runtime is not a peer of nimbella-cli or nimbella-cli is not the current directory"
    exit 0
fi
pushd ../aio-cli-plugin-runtime > /dev/null
BR=$(git symbolic-ref HEAD --short)
HASH=$(git rev-parse HEAD)
popd > /dev/null
if [ "$BR" != "dev" ]; then
		echo "aio-cli-plugin-runtime is not on the 'dev' branch"
		exit 0
fi

# Record if requested
if [ ! -z "$RECORDING" ]; then
    echo "$HASH" > aio.hash
    exit 0
fi

# Check hash against local file.  If the file doesn't exist, that's a failed check, not a sanity check failure
if [ ! -f aio.hash ]; then
    echo 'false'
    exit 0
fi
CHECK=$(cat aio.hash)
if [ "$HASH" == "$CHECK" ]; then
    echo 'true'
else
    echo 'false'
fi
