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

// The login subcommands

import * as fs from 'fs'
import * as path from 'path'
import { CredentialStore, CredentialStorageEntry, CredentialEntry, CredentialHostMap, Credentials,
    CredentialRow, Feedback } from './deploy-struct'
import { FullCredentials } from '../oauth'
import * as createDebug from 'debug'
import { wskRequest } from './util'
const debug = createDebug('nimbella.cli')

// Local types

// The expected response from the authorize action
// If status is success then apihost, uuid, and key, and will be present.
//   Storage will be present and non-empty iff the user has a bucket.
// If status is failed then only error will be present.
type Status = "created" | "success" | "failed"
interface ExpectedResponse {
    status: Status,
    apihost?: string,
    error?: string,
    uuid?: string,
    key?: string,
    storage?: string
    redis?: boolean
    namespace?: string
}

// Format of input piped to stdin from `nim user get`
interface NimUserData {
    namespace?: string,
    uuid?: string,
    key?: string,
    storage?: string
    redis?: string
}

// Non-exported constants
const CREDENTIAL_STORE_KEY = 'wb.credential-store'
const HOME = process.env[(process.platform == 'win32') ? 'USERPROFILE' : 'HOME'];
const AUTHORIZE_URL_PATH = '/api/v1/web/nimbella/user/authorize.json'
const NAMESPACE_URL_PATH = '/api/v1/namespaces'
const DEFAULT_API_HOST = 'https://apigcp.nimbella.io'
const NIMBELLA_DIR = '.nimbella'
const WSK_PROPS = 'wskprops'
const CREDENTIAL_STORE = 'credentials.json'
// Function indirection needed for webpack
export function nimbellaDir() {
    const fromEnv = process.env['NIMBELLA_DIR']
    if (fromEnv && fromEnv.length > 0) {
        return fromEnv
    }
    return path.join(HOME, NIMBELLA_DIR)
}
function wskProps() {
    return path.join(nimbellaDir(), WSK_PROPS)
}
function credentialStore() {
    return path.join(nimbellaDir(), CREDENTIAL_STORE)
}

// Exports

// The type of a persistance manager, which will differ between cloud and local
export interface Persister {
    loadCredentialStoreIfPresent: () => CredentialStore
    loadCredentialStore: () => Promise<CredentialStore>
    saveCredentialStore: (store: CredentialStore) => void
    saveLegacyInfo: (apihost: string, auth: string) => void
}

// The persister to use when local storage is accessible (deployer CLI or non-cloud workbench)
export const fileSystemPersister: Persister = { loadCredentialStoreIfPresent, loadCredentialStore, saveCredentialStore, saveLegacyInfo }
// The persister to use when running in a browser (cloud workbench). Kept here for dependnecy management
// convenience inside the workbench
export const browserPersister: Persister = { loadCredentialStoreIfPresent: browserLoadCredentialStoreIfPresent,
    loadCredentialStore: browserLoadCredentialStore, saveCredentialStore: browserSaveCredentialStore,
    saveLegacyInfo: browserSaveLegacyInfo}

// Login with token.  Handles interaction with the Nimbella authorize action via the whisk REST API.
// Requires a function to store the results so that the same logic can be used by both the deployer and the workbench
// Optional third parameter provide the API host to use (defaults to the usual customer host)
export async function doLogin(token: string, persister: Persister, host: string = DEFAULT_API_HOST): Promise<Credentials> {
    const fullURL = host + AUTHORIZE_URL_PATH + '?token=' + token
    const rawResponse = await wskRequest(fullURL)
    if (rawResponse.statusCode >= 400) {
        throw new Error("The provided token is invalid")
    }
    const response: ExpectedResponse = rawResponse.body ? rawResponse.body : { error: "unexpected response"}
    if (!response.status) {
        throw new Error("The response from the Nimbella service was ill-formed")
    } else if (response.status == "failed")  {
        throw new Error("The Nimbella Service responded '" + (response.error || "unknown failure") + "'")
    } else {
        debug('authorize response: %O', response)
        const auth = response.uuid + ':' + response.key
        const credentials = await addCredentialAndSave(response.apihost, auth, response.storage, response.redis, persister, response.namespace, true)
        persister.saveLegacyInfo(response.apihost, auth)
        return credentials
    }
}

// Login using a JSON structure provided by `nim user set` (the same as the one returned by `nim user get`).
// This is designed to be run as a subprocess of `nim user set`, which feeds most of the information via
// stdin but passes the apihost on the command line.
export function doAdminLogin(apihost: string): Promise<Credentials> {
   return new Promise(function (resolve, reject) {
        process.stdin.setEncoding('utf8');
        let input = ""
        process.stdin.on('readable', () => {
            let chunk = process.stdin.read()
            while (chunk != null) {
                input += chunk
                chunk = process.stdin.read()
            }
        });
        process.stdin.on('end', async () => {
            const nimInput: NimUserData = JSON.parse(input)
            if (!nimInput.namespace || !nimInput.key || !nimInput.uuid) {
                reject(new Error(`Improper administrative login.  Expected valid user info but got '${input}'`))
            }
            const auth = nimInput.uuid + ':' + nimInput.key
            const creds = await addCredentialAndSave(apihost, auth, nimInput.storage, !!nimInput.redis, fileSystemPersister, nimInput.namespace, true)
            saveLegacyInfo(apihost, auth)
            resolve(creds)
        })
        process.stdin.on('error', reject)
    })
}

// Login using the result of a oauth flow (full interactive login using Auth0, either gmail or github)
// This function is called with the _result_ of the flow after testing for success.
export async function doInteractiveLogin(newCreds: FullCredentials, persister: Persister): Promise<Credentials> {
    const { apihost, namespace, uuid, key, redis, storage, externalId  } = newCreds
    const auth = uuid + ':' + key
    const credStore = await persister.loadCredentialStore()
    const credentials = addCredential(credStore, apihost, namespace, auth, storage, redis)
    if (externalId && externalId.name && externalId.key) {
        credStore.github[externalId.name] = externalId.key
        credStore.currentGithub = externalId.name
    }
    persister.saveCredentialStore(credStore)
    return credentials
}

// Add credential to credential store and make it the default.  Does not persist the result
export function addCredential(store: CredentialStore, apihost: string, namespace: string, api_key: string, storage: string,
        redis: boolean): Credentials {
    debug("Adding credential to credential store")
    let nsMap = store.credentials[apihost]
    if (!nsMap) {
        nsMap = {}
        store.credentials[apihost] = nsMap
    }
    const storageKey: CredentialStorageEntry = storage ? parseStorageString(storage, namespace) : undefined
    nsMap[namespace] = { api_key, storageKey, redis }
    store.currentHost = apihost
    store.currentNamespace = namespace
    return { namespace, ow: { apihost, api_key}, storageKey, redis }
}

// Remove a namespace from the credential store
export async function forgetNamespace(namespace: string, apihost: string|undefined, persister: Persister, feedback: Feedback): Promise<Credentials> {
    const store = await persister.loadCredentialStore()
    const creds = getUniqueCredentials(namespace, apihost, store)
    const host = apihost || creds.ow.apihost
    const hostMap = store.credentials[host]
    let undefinedWarning = false
    if (hostMap && hostMap[namespace]) {
        delete hostMap[namespace]
        if (host == store.currentHost && store.currentNamespace == namespace) {
            store.currentNamespace = undefined
            undefinedWarning = true
            try {
                fs.unlinkSync(wskProps())
            } catch {}
        }
        persister.saveCredentialStore(store)
        if (undefinedWarning) {
            feedback.warn(`'${namespace}' was the current namespace`)
            feedback.warn('A new namespace target must be specified on or before the next project deployment')
        }
    } else {
        feedback.warn(`There is no credential entry for namespace '${namespace}' on API host '${host}'`)
    }
    return creds
}

// Switch the active namespace in the credential store.  The namespace argument is required.
// All occurences of the namespace across all API hosts are collected.
// If there is an explicit 'apihost' argument this collection must include an entry with that API host
// Otherwise,
//   - if there is just one occurence, the switch is to that namespace on that API host
//   - otherwise, no switch occurs and the thrown Error either states that no credentials exist for that namespace
//     or that the --apihost flag is required to indicate which one is intended
export async function switchNamespace(namespace: string, apihost: string|undefined, persister: Persister): Promise<Credentials> {
    const store = await persister.loadCredentialStore()
    const answer = getUniqueCredentials(namespace, apihost, store)
    const newHost = answer.ow.apihost
    if (store.currentHost == newHost && store.currentNamespace == namespace) {
        debug('not an actual change')
        return answer
    }
    store.currentHost = newHost
    store.currentNamespace = namespace
    persister.saveCredentialStore(store)
    persister.saveLegacyInfo(newHost, answer.ow.api_key)
    debug(`Switched target namespace to '${namespace}' on API host '${newHost}'`)
    return answer
}

// Get the credentials for a namespace.  Similar logic to switchNamespace but does not change which
// namespace is considered current.
export async function getCredentialsForNamespace(namespace: string, apihost: string|undefined, persister: Persister): Promise<Credentials> {
    const store = await persister.loadCredentialStore()
    return getUniqueCredentials(namespace, apihost, store)
}

// Get the current credentials.  This will succeed iff the user has a credential store.
// Otherwise, we throw an error.
export async function getCredentials(persister: Persister): Promise<Credentials> {
    const store = await persister.loadCredentialStore()
    if (!store.currentHost || !store.currentNamespace) {
        throw new Error("You do not have a current namespace.  Use 'nim auth login' to create a new one or 'nim auth switch' to use an existing one")
    }
    const entry = store.credentials[store.currentHost][store.currentNamespace]
    const { storageKey, api_key, redis } = entry
    return { namespace: store.currentNamespace, ow: { apihost: store.currentHost, api_key }, storageKey, redis }
}

// Convenience function to load, add, save a new credential.  Includes check for whether an entry would be replaced.
export async function addCredentialAndSave(apihost: string, auth: string, storage: string, redis: boolean,
        persister: Persister, namespace: string, allowReplacement: boolean): Promise<Credentials> {
    const credStore = await persister.loadCredentialStore()
    const nsPromise = namespace ? Promise.resolve(namespace) : getNamespace(apihost, auth)
    return nsPromise.then(namespace => {
        if (!allowReplacement && wouldReplace(credStore, apihost, namespace, auth)) {
            throw new Error(`Existing credentials for namespace '${namespace}' cannot be replaced using '--auth'.  To replace it, logout first, or login without '--auth'`)
        }
        const credentials = addCredential(credStore, apihost, namespace, auth, storage, redis)
        persister.saveCredentialStore(credStore)
        return credentials
    })
}

// Provide contents of the CredentialStore in a summary style suitable for listing and tabular presentation
export async function getCredentialList(persister: Persister): Promise<CredentialRow[]> {
    const store = await persister.loadCredentialStore()
    let result: CredentialRow[] = []
    for (const apihost in store.credentials) {
        for (const namespace in store.credentials[apihost]) {
            const current = apihost == store.currentHost && namespace == store.currentNamespace
            const storage = !!store.credentials[apihost][namespace].storageKey
            const redis = store.credentials[apihost][namespace].redis
            result.push({namespace, current, storage, apihost, redis })
        }
    }
    result = result.sort((a,b) => a.namespace.localeCompare(b.namespace))
    return result
}

// Get the namespace associated with an auth on a specific host
export function getNamespace(host: string, auth: string): Promise<string> {
    debug("getting current namespace")
    const url = host + NAMESPACE_URL_PATH
    return wskRequest(url, auth).then(list => list[0])
}

// fileSystemPersister functions (indirectly exported)

function saveCredentialStore(store: CredentialStore) {
    const toWrite = JSON.stringify(store, null, 2)
    debug("writing credential store")
    fs.writeFileSync(credentialStore(), toWrite)
}

function saveLegacyInfo(apihost: string, auth: string) {
    saveWskProps(apihost, auth)
    debug("stored .wskprops with API host %s", apihost)
}

function loadCredentialStore(): Promise<CredentialStore> {
    // Returns a promise for historical reasons.  Could be tweaked since
    // the promise is no longer needed.
    if (!fs.existsSync(credentialStore())) {
        return Promise.resolve(initialCredentialStore())
    }
    const contents = fs.readFileSync(credentialStore())
    return Promise.resolve(JSON.parse(String(contents)))
}

function loadCredentialStoreIfPresent(): CredentialStore {
    if (!fs.existsSync(credentialStore())) {
        return undefined
    }
    const contents = fs.readFileSync(credentialStore())
    return JSON.parse(String(contents))
}

// browserPersister functions (indirectly exported)

function browserLoadCredentialStoreIfPresent(): CredentialStore {
    const store = window.localStorage.getItem(CREDENTIAL_STORE_KEY)
    if (!store || store === "") {
        const currentHost = window.location.origin
        const currentNamespace = undefined
        const credentials: CredentialHostMap = {}
        credentials[currentHost] = {}
        return { currentHost, currentNamespace, credentials }
    } else {
        return JSON.parse(store)
    }
}

function browserLoadCredentialStore(): Promise<CredentialStore> {
    return Promise.resolve(browserLoadCredentialStoreIfPresent())
}

function browserSaveCredentialStore(store: CredentialStore) {
    const storeString = JSON.stringify(store)
    window.localStorage.setItem(CREDENTIAL_STORE_KEY, storeString)
}

function browserSaveLegacyInfo(apihost: string, auth: string) {
}

// Utility functions (not exported)

// Make the initial credential store when none exists.  It always starts out empty.  This also makes
// the parent directory prepartory to the first write.  It does not actually write the credential store.
function initialCredentialStore(): CredentialStore {
    if (!fs.existsSync(nimbellaDir())) {
        fs.mkdirSync(nimbellaDir())
    }
    return { currentHost: undefined, currentNamespace: undefined, credentials: {}}
}

// Determine if a new namespace/auth pair would replace an entry with the same pair that has storage or redis.
// This is allowed for "high level" logins where the information is presumably coming via a token or oauth flow or via
// `nimadmin user set`.   This checking function is not called in those cases.
// However, "low level" logins by customers are given an informational message and the entry is not replaced.
// This is to guard against surprising lossage of storage or redis information since a low level login with
// --auth does not have that information.   A customer can still replace the entry for a namespace if he
// provides a _different_ auth.  There's still a possibility of error, then, but the "error" would be
// explainable and not surprising.  We allow this case because our own test projects routinely change the
// key of 'nimbella' which is first set with a low-level login.
function wouldReplace(store: CredentialStore, apihost: string, namespace: string, auth: string): boolean {
    const existing = store.credentials[apihost] ? store.credentials[apihost][namespace] : undefined
    if (!existing || !existing.storageKey && !existing.redis) {
        return false
    }
    return auth == existing.api_key
}

// Write ~/.nimbella/wskprops.  Used when the default api host or api key change (TODO: this never saves the 'insecure' flag; that should
// probably be correlated with the api host)
function saveWskProps(apihost: string, auth: string) {
    const wskPropsContents = `APIHOST=${apihost}\nAUTH=${auth}\n`
    fs.writeFileSync(wskProps(), wskPropsContents)
}

// Given a namespace and _optionally_ an apihost, return the credentials, throwing errors based on the
// number of matches.  Used in cases where the credentials are expected to exist but the client may or
// may not have provided an API host
function getUniqueCredentials(namespace: string, apihost: string|undefined, store: CredentialStore): Credentials {
    const possibles: {[key: string]: CredentialEntry} = {}
    let credentialEntry: CredentialEntry
    let newHost: string
    for (const host in store.credentials) {
        const entry = store.credentials[host][namespace]
        if (entry) {
            possibles[host] = entry
        }
    }
    if (apihost) {
        if (possibles[apihost]) {
            credentialEntry = possibles[apihost]
            newHost = apihost
        } else {
            throw new Error(`No credentials found for namespace '${namespace}' on API host '${apihost}'`)
        }
    } else {
        const pairs = Object.entries(possibles)
        if (pairs.length == 1) {
            [newHost, credentialEntry] = pairs[0]
        } else if (pairs.length == 0) {
            throw new Error(`No credentials found for namespace '${namespace}' on any API host`)
        } else {
            throw new Error(`The namespace '${namespace}' exists on more than one API host.  An '--apihost' argument is required`)
        }
    }
    const { storageKey, api_key, redis } = credentialEntry
    debug('have authkey: %s', api_key)
    return { namespace, ow: { apihost: newHost, api_key }, storageKey, redis }
}

// Turn a raw storage string into the form used internally.
function parseStorageString(storage: string, namespace: string): CredentialStorageEntry {
    let parsedStorage: { client_email: string; project_id: string; private_key: string; }
    try {
        parsedStorage = JSON.parse(storage)
    } catch {
        throw new Error(`Corrupt storage string for namespace '${namespace}'`)
    }
    const { client_email, project_id, private_key } = parsedStorage
    return { project_id, credentials: { client_email, private_key }}
}
