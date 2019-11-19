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

const crypto = require('crypto')

class Auth0Common {
    /**
     * Initializes the auth0 configuration.
     */
    constructor() {
        this.config = {
            auth0tenant: process.env.AUTH0_TENANT,
            client_id: process.env.AUTH0_CLIENT_ID,
            redirect_uri: `${process.env.__OW_API_HOST}/api/v1/web/nimbella/user/authorize`
        }

        delete process.env.AUTH0_TENANT
        delete process.env.AUTH0_CLIENT_ID
    }

    static get verifier() {
        return Auth0Common.base64URLEncode(crypto.randomBytes(32))
    }

    static challenge(str) {
        return Auth0Common.base64URLEncode(Auth0Common.sha256(str))
    }

    static base64URLEncode(str) {
        return str
            .toString('base64')
            .replace(/\+/g, '-')
            .replace(/\//g, '_')
            .replace(/=/g, '')
    }

    static sha256(buffer) {
        return crypto
            .createHash('sha256')
            .update(buffer)
            .digest()
    }
}

module.exports = Auth0Common
