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
import { XMLHttpRequest } from 'xmlhttprequest'
import { CredentialStore, CredentialStorageEntry, CredentialEntry, CredentialHostMap, CredentialNSMap, Credentials,
    CredentialRow, OWOptions } from './deploy-struct'
import * as createDebug from 'debug'
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
const WSK_PROPS = '.wskprops'
const CREDENTIAL_STORE = 'credentials.json'
const STORAGE_CREDENTIALS = '.objectstorecreds'
// Function indirection needed for webpack
function nimbellaDir() {
    return path.join(HOME, NIMBELLA_DIR)
}
function wskProps() {
    return path.join(HOME, WSK_PROPS)
}
function credentialStore() {
    return path.join(nimbellaDir(), CREDENTIAL_STORE)
}
function storageCredentials() {
    return path.join(HOME, STORAGE_CREDENTIALS)
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
        const credentials = await addCredentialAndSave(response.apihost, auth, response.storage, response.redis, persister, response.namespace)
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
            const auth = nimInput.uuid + ':' + nimInput.key
            const creds = await addCredentialAndSave(apihost, auth, nimInput.storage, !!nimInput.redis, fileSystemPersister, nimInput.namespace)
            saveLegacyInfo(apihost, auth)
            resolve(creds)
        })
        process.stdin.on('error', reject)
    })
}

// Add credential to credential store and make it the default.  Does not persist the result
export function addCredential(store: CredentialStore, apihost: string, namespace: string, api_key: string, storage: string,
        redis: boolean): Credentials {
    //console.log("Adding credential to credential store")
    let nsMap = store.credentials[apihost]
    if (!nsMap) {
        nsMap = {}
        store.credentials[apihost] = nsMap
    }
    const storageKey: CredentialStorageEntry = storage ? parseStorageString(storage, undefined, undefined) : undefined
    nsMap[namespace] = { api_key, storageKey, redis }
    store.currentHost = apihost
    store.currentNamespace = namespace
    return { namespace, ow: { apihost, api_key}, storageKey, redis }
}

// Remove a namespace from the credential store
export async function forgetNamespace(namespace: string, apihost: string|undefined, persister: Persister): Promise<Credentials> {
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
        await persister.saveCredentialStore(store)
        console.log(`Ok.  Removed the namespace '${namespace}' on host '${host}' from the credential store`)
        if (undefinedWarning) {
            console.log(`'${namespace}' was the current namespace`)
            console.log('A new namespace target must be specified on or before the next project deployment')
        }
    } else {
        console.error(`There is no credential entry for namespace '${namespace}' on API host '${host}'`)
    }
    return creds
}

// Switch the active namespace in the credential store.  The namespace argument is required.
// All occurances of the namespace across all API hosts are collected.
// If there is an explicit 'apihost' argument this collection must include an entry with that API host
// Otherwise,
//   - if there is just one occurance, the switch is to that namespace on that API host
//   - otherwise, no switch occurs and the thrown Error either states that no credentials exist for that namespace
//     or that the --apihost flag is required to indicate which one is intended
export async function switchNamespace(namespace: string, apihost: string|undefined, persister: Persister): Promise<Credentials> {
    const store = await persister.loadCredentialStore()
    const answer = getUniqueCredentials(namespace, apihost, store)
    const newHost = answer.ow.apihost
    if (store.currentHost == newHost && store.currentNamespace == namespace) {
        // console.log('not an actual change')
        return answer
    }
    store.currentHost = newHost
    store.currentNamespace = namespace
    persister.saveCredentialStore(store)
    persister.saveLegacyInfo(newHost, answer.ow.api_key)
    //console.log(`Switched target namespace to '${namespace}' on API host '${newHost}'`)
    return answer
}

// Get the credentials for a namespace.  Similar logic to switchNamespace but does not change which
// namespace is considered current.
export async function getCredentialsForNamespace(namespace: string, apihost: string|undefined, persister: Persister): Promise<Credentials> {
    const store = await persister.loadCredentialStore()
    return getUniqueCredentials(namespace, apihost, store)
}

// Get the current credentials.  This will succeed iff the user has a credential store
// or there was enough information in .wskprops / .objectstorecreds to bootstrap one.
// Otherwise, we throw an error.
export async function getCredentials(persister: Persister): Promise<Credentials> {
    const store = await persister.loadCredentialStore()
    if (!store.currentHost || !store.currentNamespace) {
        throw new Error("There are no credentials for any namespace")
    }
    const entry = store.credentials[store.currentHost][store.currentNamespace]
    const { storageKey, api_key, redis } = entry
    return { namespace: store.currentNamespace, ow: { apihost: store.currentHost, api_key }, storageKey, redis }
}

// Convenience function to load, add, save a new credential
export async function addCredentialAndSave(apihost: string, auth: string, storage: string, redis: boolean,
        persister: Persister, namespace: string): Promise<Credentials> {
    const credStore = await persister.loadCredentialStore()
    const nsPromise = namespace ? Promise.resolve(namespace) : getNamespace(apihost, auth)
    return nsPromise.then(namespace => {
        const credentials = addCredential(credStore, apihost, namespace, auth, storage, redis)
        persister.saveCredentialStore(credStore)
        console.log(`Stored a credential set for namespace '${namespace}' and API host '${apihost}'`)
        return Promise.resolve(credentials)
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
    //console.log("getting current namespace")
    const url = host + NAMESPACE_URL_PATH
    return wskRequest(url, auth).then(list => list[0])
}

// fileSystemPersister functions (indirectly exported)

function saveCredentialStore(store: CredentialStore) {
    const toWrite = JSON.stringify(store, null, 2)
    //console.log("writing credential store")
    fs.writeFileSync(credentialStore(), toWrite)
}

function saveLegacyInfo(apihost: string, auth: string) {
    saveWskProps(apihost, auth)
    //console.log("stored .wskprops with API host", apihost)
}

function loadCredentialStore(): Promise<CredentialStore> {
    if (!fs.existsSync(credentialStore())) {
        return initialCredentialStore()
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

// Make the initial credential store when none exists.  We first ensure that the NIMBELLA_DIR exists.
// Then we check for the existence of ~/.wskprops.  If it exists, we make an initial CredentialStore from it,
// retrieving the namespace name from the host.  If ~/.objectstorecreds also exists, we add information from it.
// If ~/.wskprops does not exist, we return a vacuous CredentialStore
async function initialCredentialStore(): Promise<CredentialStore> {
    if (!fs.existsSync(nimbellaDir())) {
        fs.mkdirSync(nimbellaDir())
    }
    //console.log("Reading wskprops")
    const { apihost, api_key } = readWskProps()
    if (apihost && api_key) {
        //console.log("Have valid wskprops")
        let storage = undefined
        if (fs.existsSync(storageCredentials())) {
            //console.log("Reading storage credentials")
            storage = fs.readFileSync(storageCredentials())
        }
        //console.log("converting storage credentials")
        const currentNamespace = await getNamespace(apihost, api_key)
        let storageKey: CredentialStorageEntry = storage ? parseStorageString(storage, currentNamespace, apihost) : undefined
        const credentials: CredentialHostMap = {}
        const nsMap: CredentialNSMap = {}
        nsMap[currentNamespace] = { api_key, storageKey, redis: false }
        credentials[apihost] = nsMap
        const ans = { currentHost: apihost, currentNamespace, credentials }
        //console.log("returning initialzed credential store", ans)
        return ans
    }
    //console.log("returning vacuous credential store")
    return { currentHost: undefined, currentNamespace: undefined, credentials: {}}
}

// Read ~/.wskprops if present.  Used when initializing the CredentialStore
function readWskProps(): OWOptions {
    const wskpropsFile = wskProps()
    if (!fs.existsSync(wskpropsFile)) {
        return {}
    }
    const propertiesParser = require('properties-parser')
    const wskpropsContents = propertiesParser.read(wskpropsFile)
    const options: OWOptions = {}
    if (wskpropsContents && wskpropsContents.AUTH) {
        options.api_key = wskpropsContents.AUTH
    }
    if (wskpropsContents && wskpropsContents.APIHOST) {
        options.apihost = wskpropsContents.APIHOST
    }
    return options
}

// Write ~/.wskprops.  Used when the default api host or api key change (TODO: this never saves the 'insecure' flag; that should
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
    //console.log('have authkey', api_key)
    return { namespace, ow: { apihost: newHost, api_key }, storageKey, redis }
}

// Turn a raw storage string into the form used internally.  Also optionally checks for mismatch with the expected namespace and apihost
// because our older practices can have left dangling .objectstorecreds that don't match the current wsk credentials.   We ignore
// corrupt (unparsable) storage strings
function parseStorageString(storage: string, namespace: string, apihost: string): CredentialStorageEntry {
    let parsedStorage: { client_email: string; project_id: string; private_key: string; }
    try {
        parsedStorage = JSON.parse(storage)
    } catch {
        return undefined
    }
    const { client_email, project_id, private_key } = parsedStorage
    if (namespace && apihost) {
        if (!client_email.startsWith(namespace)) {
            //console.log(`rejecting .objectstorecreds: '${client_email} does not match expected namespace '${namespace}'`)
            return undefined
        }
        const expectedProject = apihost.replace("https://", "").replace(".nimbella.io", "").replace("api", "nim")
        if (expectedProject != project_id) {
            //console.log(`rejecting .objectstorecreds: '${project_id} does not match expected apihost '${apihost}'`)
            return undefined
        }
    }
    return { project_id, credentials: { client_email, private_key }}
}

// Subroutine to invoke OW with a GET and return the response
function wskRequest(url: string, auth: string = undefined): Promise<any> {
    //console.log("Request to", url)
    return new Promise(function (resolve, reject) {
        const xhr = new XMLHttpRequest()
        xhr.open('GET', url)
        xhr.onload = function () {
            if (this.status >= 200 && this.status < 300) {
                //console.log("useful response")
                resolve(JSON.parse(xhr.responseText))
            } else {
                //console.log("Error from OW", xhr.status, xhr.responseText)
                reject(new Error(xhr.responseText))
            }
        }
        xhr.onerror = function () {
            //console.log("network error")
            reject({statusText: "Network error"})
        }
        if (auth) {
            //console.log("Setting basic authorization header")
            xhr.setRequestHeader('Authorization', 'Basic ' + Buffer.from(auth).toString('base64'))
        }
        xhr.send()
    })
}
