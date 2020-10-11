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

# This build invokes the default ActionLoop build for single source.  It does nothing locally.
# TODO generalize to multiple sources.  Note that in this simple form we need to know the name of the source
if [ -n "$OW_COMPILER" ]; then
		cp hello.swift /swiftAction/exec
		pushd /swiftAction
    $OW_COMPILER main . .
		popd
    cp /swiftAction/exec .
    echo exec > .include
fi

