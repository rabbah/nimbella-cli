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
      Auth0 = require('./common'),
      jwksrsa = require('jwks-rsa'),
      { adduser, getuser } = require('./user'),
      { cipherFactory } = require('./cipher')

const redis = nim.redis()

function getSigningKey(jwksClient, header, callback) {
    jwksClient.getSigningKey(header.kid, function (err, key) {
        let signingKey = key.publicKey || key.rsaPublicKey
        callback(null, signingKey)
    })
}

function decodeToken(jwtClient, token) {
    const jwt = require('jsonwebtoken')
    const getKey = (header, callback) => getSigningKey(jwtClient, header, callback)

    return new Promise((resolve, reject) => {
        jwt.verify(token, getKey, function (error, decoded) {
            if (!error) {
                resolve(decoded)
            } else {
                console.error(error)
                reject('token verification failed')
            }
        })
    })
}

function wrap(result, code) {
    if (result.error === undefined) {
        let code = result.status === 'created' ? 201 : 200
        result.status === result.status || 'success'
        return {
            statusCode: code,
            body: result
        }
    } else {
        return {
            statusCode: code || 401,
            body: { ...result, status: 'failed' }
        }
    }
}

function badRequest(info) {
    code = typeof info === 'number' ? info : undefined
    msg  = typeof info === 'string' ? info : 'bad request'
    return wrap({ error: msg }, code)
}

function addOrGetUser(profile) {
    console.log(profile)

    if (profile && profile.email) {
        let user = { subject: profile.email, namespace: profile.namespace }
        return getuser(user)
            .then(result => {
                if (result.error === undefined) {
                    return result
                } else {
                    // return adduser(user)
                    return Promise.reject('could not authenticate user')
                }
            })
            .catch(error => {
                console.error(error)
                return Promise.reject('could not authenticate user')
            })
    } else {
        return Promise.reject('could not authenticate user (profile is incomplete)')
    }
}

function getToken({auth0tenant, client_id, redirect_uri, authorization_code, code_verifier}) {
    const request = require('needle')
    let url = `https://${auth0tenant}.auth0.com/oauth/token`
    let form = {
        client_id,
        redirect_uri,
        grant_type: 'authorization_code',
        code: authorization_code,
        code_verifier
    }

    return request('post', url, form)
        .then(response => {
            if (response.statusCode == 200) {
                return response.body.id_token
            } else {
                console.error(response)
                return Promise.reject('bad response')
            }
        })
        .catch(error => {
            console.error(error)
            return Promise.reject('failed to fetch token')
        })
}

function authorize(auth0, decode, args) {
    const state = args.state
    const authorization_code = args.code
    const bearer = args.token

    console.log(state, authorization_code)

    if (state) {
        return redis
            .getAsync(state)
            .then(code_verifier => {
                if (code_verifier && args.error !== 'unauthorized') {
                    console.log(code_verifier)
                    return getToken({
                        ...auth0.config,
                        authorization_code,
                        code_verifier
                    }).then(id_token => {
                        return decodeToken(auth0.jwksClient, id_token)
                            .then(_ => addOrGetUser(_).then(wrap))
                            .catch(e => {
                                console.error('jwt verification failed')
                                return badRequest()
                            })
                    }).catch(error => {
                        console.error(error)
                        return badRequest(501)
                    })
                } if (args.error) {
                    console.error(args.error, args.error_description)
                    return badRequest(args.error_description)
                } else {
                    console.error('bad verifier')
                    return badRequest()
                }
            })
            .catch(error => {
                console.error('bad state:', error)
                return badRequest()
            })
    } else if (bearer && typeof bearer === 'string') {
        return decode(bearer)
            .then(token => addOrGetUser({email: token.subject, namespace: token.namespace}).then(wrap))
            .catch(e => {
                console.error('decoding bearer token failed')
                return badRequest()
            })
    } else {
        console.error('No state or invalid bearer token')
        return badRequest()
    }
}

module.exports.main = (() => {
    // cache the configuration
    let auth0 = new Auth0()

    auth0.jwksClient = jwksrsa({
        cache: true,
        cacheMaxEntries: 5,
        rateLimit: true,
        jwksRequestsPerMinute: 10,
        jwksUri: `https://${auth0.config.auth0tenant}.auth0.com/.well-known/jwks.json`
    })

    let { decode } = cipherFactory(process.env.CIPHER_KEY)
    return args => authorize(auth0, decode, args)
})()
