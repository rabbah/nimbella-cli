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

// Test that we can create an entry in the credential store with a commander segment

const { addCommanderData, addCredentialAndSave, getCredentialsForNamespace, getCredentials,
    fileSystemPersister, forgetNamespace, DefaultFeedback, switchNamespace } = require('nimbella-deployer')

async function main() {
    try {
        await forgetNamespace('myNamespace', 'myHost', fileSystemPersister, DefaultFeedback)
    } catch {}
    const current = await getCredentials(fileSystemPersister)
    await addCredentialAndSave('myHost', 'myAuth', undefined, false, fileSystemPersister, 'myNamespace')
    const data = { foo: 'bar', name: 'me'}
    await addCommanderData('myHost', 'myNamespace', data, fileSystemPersister)
    const creds = await getCredentialsForNamespace('myNamespace', 'myHost', fileSystemPersister)
    await switchNamespace(current.namespace, current.ow.apihost, fileSystemPersister)
    await forgetNamespace('myNamespace', 'myHost', fileSystemPersister, DefaultFeedback)
    const output = JSON.stringify(creds, null, 2)
    console.log(output)
}

main()
