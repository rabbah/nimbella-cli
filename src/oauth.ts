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

import  * as querystring from 'querystring'
import { NimLogger, inBrowser } from './NimBaseCommand'
import { OWOptions } from './deployer/deploy-struct'
import { open } from './ui'
import { wskRequest } from './deployer/util'

import * as makeDebug from 'debug'
const debug = makeDebug('nim:oauth')

const DEFAULT_APIHOST = 'https://apigcp.nimbella.io'
const NAMESPACE = 'nimbella'
const TOKENIZER = '/user/tokenizer'
const LOGIN = '/user/login'

// Contains support for the oauth flows underlying interactive login and `nim auth github`.  Also support for
// the tokenizer used to pass credentials between workbenches and CLI.

// These types duplicate declarations in main/deployable/login, except that Credentials is renamed to FullCredentials
// to avoid confusing it with the Credentials type used throught nim.
export type IdProvider = {
    provider: string,
    name: string,
    key: string
}

export type FullCredentials = {
    status: string,
    apihost: string,
    namespace: string,
    uuid: string,
    key: string,
    redis: boolean,
    storage?: string,
    externalId?: IdProvider
}

// The response can be either
export type OAuthResponse = FullCredentials | IdProvider | true

// Differentiate responses
export function isFullCredentials(toTest: OAuthResponse): toTest is FullCredentials {
  return toTest !== true && 'status' in toTest && toTest.status === 'success'
}

export function isGithubProvider(toTest: OAuthResponse): toTest is IdProvider {
  return toTest != true && 'provider' in toTest && toTest.provider === 'github'
}

function providerFromResponse(response: OAuthResponse): string {
  if (response === true) {
    return ''
  } else if (isFullCredentials(response)) {
    return response.externalId.provider
  } else {
    return response['provider']
  }
}

// Compute the API url for a given namespace on a given host.   To this result, one typically appends
// /pkg/action in order to invoke a (web) action.  The form of URL used here goes through the bucket ingress,
// not directly to the api ingress
function getAPIUrl(namespace: string, apihost: string): string {
  const hostURL = new URL(apihost)
  return `https://${namespace}-${hostURL.hostname}/api`
}

// Calculate the reentry point for redirects from the Auth0 flows back to the workbench
function wbReentry(): string {
  const { host, protocol, pathname } = window.location
  return `${protocol}//${host}${pathname}`
}

// Do an interactive token flow, either to establish an Nimella account or to add a github account.
// The behavior in the browser is quite different from the CLI.  In a CLI, this function returns a
// Promise, which, when resolved, provides the information needed to store the credentials.
// In a browser, it just returns a Promise<true> which can be discarded; the return flow with the
// real information happens by a redirect in the browser causing the workbench to be invoked again.
export async function doOAuthFlow(logger: NimLogger, githubOnly: boolean, apihost: string): Promise<OAuthResponse> {
  // Common setup
  let deferredResolve: (response: OAuthResponse) => void
  let deferredReject
  const deferredPromise = new Promise<OAuthResponse>(function(resolve, reject) {
    deferredResolve = resolve
    deferredReject = reject
  })
  const query = {
      provider: githubOnly ? 'github' : undefined,
      redirect: inBrowser ? wbReentry() : true
  }

  // Non-browser setup
  if (!inBrowser) {
    const createServer = require('http').createServer
    const getPort = require('get-port')
    const port = await getPort({ port: 3000 })
    query['port'] = port

    const server = createServer(function(req, res) {
      const parameters = querystring.parse(req.url.slice(req.url.indexOf('?') + 1))
      if (parameters.token) {
        let response: OAuthResponse
        try {
          const buffer = Buffer.from(parameters.token as string, 'base64')
          response = JSON.parse(buffer.toString('ascii'))
          deferredResolve(response)
        } catch (e) {
          deferredReject(e)
        }

        res.end(
          "<html><head><style>html{font-family:sans-serif;background:#0e1e25}body{overflow:hidden;position:relative;display:flex;flex-direction:column;align-items:center;justify-content:center;height:100vh;width:100vw;}h3{margin:0}.card{position:relative;display:flex;flex-direction:column;width:75%;max-width:364px;padding:24px;background:white;color:rgb(14,30,37);border-radius:8px;box-shadow:0 2px 4px 0 rgba(14,30,37,.16);}</style></head>" +
            "<body><div class=card><h3>Logged In</h3><p>You're now logged into Nimbella CLI with your " +
            providerFromResponse(response) +
            ' credentials. Please close this window.</p></div>'
        )
        server.close()
        return
      }
      res.end('BAD PARAMETERS')
      server.close()
      deferredReject(new Error('Got invalid parameters for CLI login'))
    })

    await new Promise(function(resolve, reject) {
      server.on('error', reject)
      server.listen(port, resolve)
    })
  } else {
    // for browser, we will just return Promise<true> because the real callback will be in a separate flow altogether
    deferredResolve(true)
    query['tokenize'] = true
  }

  // Common code
  const url = getAPIUrl(NAMESPACE, apihost || DEFAULT_APIHOST) + LOGIN + '?' + querystring.stringify(query)
  debug("computed url: %s", url)

  try {
    if (inBrowser) {
      window.location.href = url
    } else {
      await open(url)
    }
  } catch (err) {
    logger.handleError('Nimbella CLI could not open the browser for you.' +
      ' Please visit this URL in a browser on this device: ' + url,
      err)
  }

  return await deferredPromise
}

// Invoke the tokenizer given low level OW credentials (auth and apihost), getting back a bearer token to full credentials
export async function getCredentialsToken(ow: OWOptions, logger: NimLogger): Promise<string> {
    debug('getCredentialsToken with input %O', ow)
    const url = getAPIUrl(NAMESPACE, ow.apihost) + TOKENIZER
    let response
    try {
      response = await wskRequest(url, ow.api_key)
    } catch (err) {
      logger.handleError('', err)
    }
    debug('response from tokenizer: %O', response)
    return response.token
}
