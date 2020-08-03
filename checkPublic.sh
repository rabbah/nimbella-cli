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

# Checks for the public repo and makes sure the src folders match.  Exits non-zero
# iff the public repo is there and has different src.
# TODO we should soon require the public repo to be cloned in the expected place.
# We can auto-clone it as a convenience (since it's public, that should work using
# just https).  The src in this repo should then be copied from the public one.

# Orient
SELFDIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd $SELFDIR
PUBLIC_SRC="../public/nimbella-cli/src"

if [ -d "$PUBLIC_SRC" ]; then
	 diff -rub src "$PUBLIC_SRC"
   if [ $? -ne 0 ]; then
	 		echo "Public src does not match private src"
			exit 1
   fi
fi
