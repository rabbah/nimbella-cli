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

# Builds the 'nim' CLI
#
# By default, it builds the deployer from source and installs it locally, not uploading it, then builds nim and
#    installs it locally
# With --no-install, the result is the same as a default build but no global install is done (primarily for Jenkins)
# With --link, the result is like the default build except an 'npm link' is done lieu of 'npm install' (allows builds
#    to be bypassed for subsequent changes until a full install is done)
# With --preview, it builds both the deployer and 'nim' and uploads both to the preview site
# With --stable, it builds deployer and 'nim' and uploads the deployer to the preview site, labelled by stable version.
#    The stable version in 'workbench/stable' is updated, but not committed or uploaded.
# With --pack, most of the work of --stable is done but nothing is uploaded, 'workbench/stable' is not modified and
#    Apple notarization is skipped.   Results are left in 'dist'.
# With --check-stable, there is no building and the mac installer in 'dist' is checked for successful notarization

set -e

# Parse
if [ "$1" == "--pack" ]; then
    PKG=true
elif [ "$1" == "--preview" ]; then
    PREVIEW=true
    # Calculate preview site name and URL, being careful to avoid double slashes in names
    if [ -n "$2" ]; then
        PREVIEW_SITE="gs://preview-apigcp-nimbella-io/$2"
        PREVIEW_URL="https://preview-apigcp.nimbella.io/$2"
    else
        PREVIEW_SITE="gs://preview-apigcp-nimbella-io"
        PREVIEW_URL="https://preview-apigcp.nimbella.io"
    fi
elif [ "$1" == "--stable" ]; then
    STABLE=true
    PKG=true
		# PREVIEW SITE is always the public one for stable, no second argument
    PREVIEW_SITE="gs://preview-apigcp-nimbella-io"
    PREVIEW_URL="https://preview-apigcp.nimbella.io"
elif [ "$1" == "--link" ]; then
    USE_LINK=true
elif [ "$1" == "--no-install" ]; then
    NOINSTALL=true
elif [ "$1" == "--check-stable" ]; then
    CHECK_STABLE=true
elif [ -n "$1" ]; then
    echo "Illegal argument '$1'"
    exit 1
fi

# Orient
SELFDIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
STABLEDIR=$SELFDIR/../workbench/stable
cd $SELFDIR

# Check public source and abort on mismatch
#./checkPublic.sh

# Check a signed and notarized stable release installer (for macos)
if [ -n "$CHECK_STABLE" ]; then
    spctl -a -vvv --type install dist/macos/nim.pkg
    exit 0
fi

DIRTY=$(git status --porcelain)

# Check prereqs for --preview
if [ -n "$PREVIEW" ] && [ -z "$2" ] && [ -n "$DIRTY" ]; then
    echo "The nimbella-cli repo is not fully committed: a preview cannot be created"
    exit 1
fi

# Check prereqs for --stable
if [ -n "$STABLE" ]; then
    if [ -n "$DIRTY" ]; then
        echo "The nimbella-cli repo is not fully committed: a stable version cannot be declared"
        exit 1
    fi
    UPTODATE=$(./aioUpToDate.sh)
    if [ "$UPTODATE" == "false" ]; then
        echo "Incompatible releases for 'aio-cli-plugin-runtime' and 'nimbella-cli'.  Bring both repos up to date, then run './commitAioPacks.sh' in nimbella-cli."
        exit -1
    elif [ "$UPTODATE" != 'true' ]; then
        echo $UPTODATE
        exit -1
    fi
    UPTODATE=$(./commanderUpToDate.sh)
    if [ "$UPTODATE" == "false" ]; then
        echo "Incompatible releases for 'commander-cli' and 'nimbella-cli'.  Bring both repos up to date, then run './commitCommanderPacks.sh' in nimbella-cli."
        exit -1
    elif [ "$UPTODATE" != 'true' ]; then
        echo $UPTODATE
        exit -1
    fi
    LAST_VERSION=$(jq -r .nimcli < ../workbench/stable/versions.json)
    NEW_VERSION=$(jq -r .version < package.json)
    if [ "$LAST_VERSION" == "$NEW_VERSION" ]; then
        echo "The nim CLI version number was not changed: a new stable version cannot be declared"
        exit 1
    fi
    if [ -z "$APPLE_ID" ]; then
        echo "You did not specify the APPLE_ID environment variable with your Apple developer id"
        exit 1
    fi
    if [ -z "$APPLE_PWD" ]; then
        echo "You did not specify the APPLE_PWD environment variable with your Apple developer account password"
        exit 1
    fi
fi

# Store version info
HASH=$(git rev-parse HEAD)
if [ -n "$DIRTY" ]; then
    DIRTY="++"
fi
BUILDINFO=${HASH:0:8}${DIRTY}
VERSION=$(jq -r .version package.json)
if [ -n "$PREVIEW" ]; then
    VERSION="$VERSION-patch"
fi
FULLVERSION="$VERSION ($BUILDINFO)"
echo '{ "version": "'$FULLVERSION'" }' | jq . > version.json

# Run the deployer build
deployer/build.sh

# Install the result of the deployer build.  That may involve uploading if the reference isn't going to be local.
if [ -n "$PREVIEW" ]; then
    gsutil cp deployer/nimbella-deployer.tgz $PREVIEW_SITE
    gsutil setmeta -h "Cache-Control:no-cache" "$PREVIEW_SITE/nimbella-deployer.tgz"
    npm install $PREVIEW_URL/nimbella-deployer.tgz
    # Will dirty package.json; clean up at the end
elif [ -n "$STABLE" ]; then
    echo gsutil cp deployer/nimbella-deployer*.tgz $PREVIEW_SITE
    gsutil cp deployer/nimbella-deployer*.tgz $PREVIEW_SITE
    echo gsutil setmeta -h "Cache-Control:no-cache" "$PREVIEW_SITE/nimbella-deployer*.tgz"
    gsutil setmeta -h "Cache-Control:no-cache" "$PREVIEW_SITE/nimbella-deployer*.tgz"
    npm install $PREVIEW_URL/nimbella-deployer-$VERSION.tgz
    # Will dirty package.json; clean up at the end
else
    # just do a local install, no upload
    npm install "$SELFDIR/deployer/nimbella-deployer.tgz"
fi

# Generate the license-notices.md file.  Note: to avoid unnecessary entries
# this step requires a clean production install.  We do a full install later.
# Failures of this step are terminal when building a stable version but are
# considered "warnings" otherwise.
rm -fr node_modules
npm install --production --no-optional
if [ -z "$STABLE" ]; then
  set +e
fi
node license-notices.js > thirdparty-licenses.md
# Error check here will only happen in the non-stable case
if [ $? -ne 0 ]; then
    echo "!!!"
    echo "!!! License issues must be resolved in time for the next stable version"
    echo "!!!"
fi
set -e

# Build the HTML forms of the documentation, LICENSE, and changes
cp doc/pandoc-header /tmp/nim.md
tail -n +2 < doc/README.md >> /tmp/nim.md
pandoc -o /tmp/nim.html -f markdown -s --css ./globalStyles.css -H ./doc/header.html -t html --toc --toc-depth=5 < /tmp/nim.md
sed -e '/doc-toc/a\
<div id="menuToggle"><input type="checkbox" /><span></span><span></span><span></span>' -e '/<\/nav>/i\
</div>' < /tmp/nim.html > doc/nim.html
cp doc/change-header /tmp/changes.md
tail -n +2 < doc/changes.md >> /tmp/changes.md
pandoc -o changes.html -f markdown -s -t html < /tmp/changes.md
cp doc/license-header /tmp/license.md
tail -n +4 < LICENSE >> /tmp/license.md
pandoc -o license.html -f markdown-smart -s -H ./doc/tracker.html --html-q-tags -t html < /tmp/license.md
pandoc -o thirdparty-licenses.html -f markdown_strict -t html < thirdparty-licenses.md

# Full install
npm install --no-optional

# Build and pack
if [ -n "$USE_LINK" ]; then
   npx tsc
   npm link
   exit 0
fi
# else explicit tsc not needed since pack will do it
npm pack
mv nimbella-cli-*.tgz nimbella-cli.tgz

# Unless told not to, do a global install of the result
if [ -z "$NOINSTALL" ]; then
    if [ -f saved-package.json ]; then
        echo "Using 'npm link' for AIO testing"
        npm link
    else
        npm install -g nimbella-cli.tgz
    fi
else
    ln -sf $SELFDIR/bin/run bin/nim
fi

# Optionally release as a preview (if $2 is specified it is used as a subfolder, which must exist)
if [ -n "$PREVIEW" ]; then
    # Rename READMEs so the customer gets an appropriate one (not our internal one)
    mv README.md devREADME.md
    mv userREADME.md README.md
    # Create preview tarball.  This is not identical to our internal use one, though close.
    npm pack
    mv nimbella-cli-*.tgz nimbella-cli.tgz
    # Undo renames
    git checkout userREADME.md
    mv devREADME.md README.md
    # Upload the result
    gsutil -m cp nimbella-cli.tgz doc/*.html doc/*.svg doc/*.css $PREVIEW_SITE
    echo "$FULLVERSION" | gsutil cp - $PREVIEW_SITE/nim-version.txt
    gsutil cp changes.html $PREVIEW_SITE/nim-changes.html
    # Clean up package.json
    git checkout package.json
fi

# Optionally package
if [ -n "$PKG" ]; then
    # Clean up old material
    rm -fr dist tmp nim-cli.tgz

    # Rename READMEs so the customer gets an appropriate one (not our internal one)
    mv README.md devREADME.md
    mv userREADME.md README.md

    # Create the standalone tarballs
    npx oclif-dev pack -t linux-x64,win32-x64,darwin-x64

    # Create installers for macos and win (keep x64 only) and provide consistent naming
    npx oclif-dev pack:macos
    MACOS=dist/macos/*.pkg
    mv $MACOS dist/macos/nim.pkg
    npx oclif-dev pack:win
    rm -f dist/win/*x86*
    WIN=dist/win/*x64.exe
    mv $WIN dist/win/nim-x64.exe

    # Add the linux install script
    URL=$(jq -r .gz dist/linux-x64)
    sed -e 's+URL=+URL='$URL'+' < nim-install-linux.sh > dist/nim-install-linux.sh

    # Create a minimal tarball for dependent installs.  This is not identical to our internal use one, though close.
    npm pack
    mv nimbella-cli-*.tgz dist/nimbella-cli.tgz

    # Add documentation and licenses
    cp doc/nim.html doc/*.svg doc/*.css license.html thirdparty-licenses.html dist

    # Clean up
    git checkout userREADME.md
    mv devREADME.md README.md
fi

# Optionally make stable version
if [ -n "$STABLE" ]; then
    # Sign and notarize the macos installer
    set +e
    ./signAndNotarize.sh ./tmp ./dist/macos/nim.pkg $VERSION FU8M787PV7 $APPLE_ID $APPLE_PWD
    if [ $? -ne 0 ]; then
        echo "Something went wrong with the sign/notarize step.  Do not commit this stable version until that is corrected."
        exit 1
    fi
    set -e
    # Wrap into a single tarball for subsequent deployment
    pushd dist
    tar czf ../nim-cli.tgz *
    popd
    # Move to stable
    mv nim-cli.tgz $STABLEDIR
    cd $STABLEDIR/..
    ./setStableVersions.sh
    echo "The new stable version is built and ready.  Wait for an email from Apple stating that the notarization succeeded.  Then do"
    echo "   ./build.sh --check-stable"
    echo "to make sure the installer is 'accepted' before committing."
    # Clean up package.json
    git checkout package.json
fi
