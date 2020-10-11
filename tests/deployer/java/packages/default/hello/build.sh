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

# This build will just send source to the actionloop when run locally but will compile to binary and deploy the result if run remotely
if [ -n "$OW_COMPILER" ]; then
    $OW_COMPILER Main . .
    if [ -f exec ]; then
        echo exec > .include
    fi
else
    echo hello.java > .include
fi

