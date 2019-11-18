#!/bin/bash

# This script installs current linux self-contained tarball on a target system
# It should be run under sudo as in
#   curl https://<URL-of-this-script> | sudo bash

# URL of the tarball to install (generated during build)
URL=

# Download and unpack the tarball
set -e
echo Downloading the standalone 'nim' distribution for Linux from $URL
curl $URL > /tmp/nim-install.tgz
echo Unpacking the distribution
pushd /tmp
tar xzf nim-install.tgz
popd

# Swap in the new version
echo Removing old installation, if any, and swapping in the new
rm -fr /usr/local/lib/nimbella-cli
mv /tmp/nim /usr/local/lib/nimbella-cli

# Swap in the new symlink
echo Removing old symlink, if any, from /usr/local/bin and establishing the new
rm -f /usr/local/bin/nim
ln -s /usr/local/lib/nimbella-cli/bin/nim /usr/local/bin
echo Installation complete
