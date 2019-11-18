#!/bin/bash

# This script installs current linux self-contained tarball on a target system
# It should be run under sudo as in
#   curl https://<URL-of-this-script> | sudo bash

# URL of the tarball to install (generated during build)
URL=

# Download and unpack the tarball
set -e
curl -s $URL > /tmp/nim-install.tgz
tar xzf /tmp/nim-install.tgz

# Swap in the new version
rm -fr /usr/local/lib/nimbella-cli
mv /tmp/nim /usr/local/lib/nimbella-cli

# Swap in the new symlink
rm /usr/local/bin/nim
ln -s /usr/local/lib/nimbella-cli/bin/nim /usr/local/bin
