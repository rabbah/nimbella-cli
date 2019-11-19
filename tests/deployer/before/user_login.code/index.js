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

const nim = require('nim'),
      Auth0 = require('./common')

const redis = nim.redis()

function verifierAndChallenge() {
    let v = Auth0.verifier
    let c = Auth0.challenge(v)

    return {
        code_verifier: v,
        code_challenge: c
    }
}

function getAuthorizationCode({auth0tenant, client_id, redirect_uri, code_challenge, state}) {
    let options = {
        url: `https://${auth0tenant}.auth0.com/authorize`,
        qs: {
            response_type: 'code',
            code_challenge_method: 'S256',
            scope: 'openid email profile',
            client_id,
            redirect_uri,
            code_challenge,
            state
        }
    }

    let qs = Object
            .keys(options.qs)
            .map(k => `${k}=${options.qs[k]}`)
            .join('&')

    return `${options.url}?${qs}`
}

function login(auth0, args) {
    const state = process.env.__OW_ACTIVATION_ID
    const {code_verifier, code_challenge} = verifierAndChallenge()

    console.log(state, code_verifier, code_challenge)

    return redis
        .setAsync(state, code_verifier)
        .then(_ => {
            let url = getAuthorizationCode({
                ...auth0.config,
                state,
                code_challenge
            })

            return {
                statusCode: 302,
                headers: {
                    location: url
                }
            }
        })
}

module.exports.main = (() => {
    // cache the configuration
    let auth0 = new Auth0()
    return args => login(auth0, args)
})()
