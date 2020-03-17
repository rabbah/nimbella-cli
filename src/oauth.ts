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
import { createServer} from 'http'
import * as getPort from 'get-port'
import { NimLogger } from './NimBaseCommand'

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
    id?: IdProvider
}

// The response can be either
export type OAuthResponse = FullCredentials | IdProvider

// Differentiate
export function isFullCredentials(toTest: OAuthResponse): toTest is FullCredentials {
  return 'status' in toTest && toTest.status === 'success'
}

export function isGithubProvider(toTest: OAuthResponse): toTest is IdProvider {
  return 'provider' in toTest && toTest.provider === 'github'
}

function providerFromResponse(response: OAuthResponse): string {
  if (isFullCredentials(response)) {
    return response.id.provider
  } else {
    return response['provider']
  }
}

// Do an interactive token flow, either to establish an Nimella account or to add a github account
export async function doOAuthFlow(logger: NimLogger, githubOnly: boolean): Promise<OAuthResponse> {
  const port = await getPort({ port: 3000 })
  let deferredResolve: (response: OAuthResponse) => void
  let deferredReject
  const deferredPromise = new Promise<OAuthResponse>(function(resolve, reject) {
    deferredResolve = resolve
    deferredReject = reject
  })

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

  const webUI = 'https://preview-apigcp.nimbella.io/api'

  const url =
    webUI +
    '/user/login?' +
    querystring.stringify({
      redirect: true,
      port: port,
      provider: githubOnly ? 'github' : undefined
    })

  try {
    // Using require here instead of import at module scope because open will break in a browser; if we put it at module scope
    // it may keep workbench from running at all, depending on how webpack groups things.  As it is, the code will fail in a
    // browser.   TODO get it working in a browser
    await require('open')(url)
  } catch (err) {
    logger.handleError('Nimbella CLI could not open the browser for you.' +
      ' Please visit this URL in a browser on this device: ' + url,
      err)
  }

  return await deferredPromise
}
