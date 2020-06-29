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

# Modifies package.json for testing an AIO change.

set -e

# Parse
if [ "$1" == "--reset" ]; then
		RESET=true
elif [ -n "$1" ]; then
		echo "Illegal argument '$1'"
		exit 1
fi

# Orient
SELFDIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd $SELFDIR

# Sort out existence of a saved copy of package.json and whether or not reset is requested
if [ -f saved-package.json ]; then
		if [ -n "$RESET" ]; then
				# Normal reset case
				mv saved-package.json package.json
				echo "Restored 'package.json'"
				exit 0
    else
				# Possible duplicate execution
				echo "There is already a 'saved-package.json' file.  Did you already execute this command?  Doing nothing."
				exit 1
		fi
elif [ -n "$RESET" ]; then
		# Improper or vacuous reset
		echo "File 'saved-package.json' does not exist.  Nothing to reset."
		exit 1
else
		# Correct non-reset execution
		cp package.json saved-package.json
		jq -r '.dependencies."@adobe/aio-cli-plugin-runtime" = "../aio-cli-plugin-runtime"' < saved-package.json > package.json
fi
