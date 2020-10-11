#!/usr/bin/env node
/*
 * Nimbella CONFIDENTIAL
 * ---------------------
 *
 *   2018 - present Nimbella Corp
 *   All Rights Reserved.
 *
 * NOTICE:
 *
 * All information contained herein is, and remains the property of
 * Nimbella Corp and its suppliers, if any.  The intellectual and technical
 * concepts contained herein are proprietary to Nimbella Corp and its
 * suppliers and may be covered by U.S. and Foreign Patents, patents
 * in process, and are protected by trade secret or copyright law.
 *
 * Dissemination of this information or reproduction of this material
 * is strictly forbidden unless prior written permission is obtained
 * from Nimbella Corp.
 */

// Variant on the remote action for building that runs from cmdline
const { deployProject, authPersister } = require('nimbella-cli/lib/deployer')

async function main ({ toBuild }) {
  if (!toBuild) {
    return { error: 'No build slice name provided' }
  }
  return await deployProject('slice:' + toBuild, undefined, undefined, authPersister, {})
}

const args = { toBuild: process.argv[2] }
main(args).then(result => console.log(result))
