#!/bin/bash
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

# Builds the deployer component of the 'nim' CLI.
# Always produces two identical tarballs, one with a standard name (includes semver)
# and one with a "generic" name (no semver).
# In a test build, a file reference to the generic tarball will be installed in 'nim' package.json.
# In a preview build, the generic tarball will be uploaded to preview.
# In a stable build, both tarballs will be uploaded to preview.
# TODO we put production tarballs for the deployer in the preview site for now.
# We need to sort out where production tarballs should go.

set -e

# Orient
SELFDIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd $SELFDIR
MAINDIR=../../main

# Copy in the latest runtimes.json, productionProjects.json, and 404.html
cp $MAINDIR/config/runtimes.json .
cp $MAINDIR//config/productionProjects.json .
cp $MAINDIR/deploy/embed/404_html.html 404.html

# Ensure no old tarball with a different version to complicate later step
rm -f nimbella-deployer-*.tgz

# Install and pack
npm install
npm pack

# Copy the one tarball with a semver in its name to one without.  This could
# be a symlink but that gains nothing because there are no symlinks once we
# upload to a bucket.
cp nimbella-deployer-*.tgz nimbella-deployer.tgz
