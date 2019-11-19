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

const { exec, execSync } = require('child_process')

function runcmd(cmdline) {
    return new Promise((resolve, reject) => {
        exec(cmdline, {timeout: 5000}, (error, stdout, stderr) => {
            let result = {stdout: stdout, stderr: stderr, error: error}
            if (error) {
                console.error('command errored')
                reject(result)
            } else {
                console.log('command successful')
                resolve(result)
            }
        })
    })
}

function init() {
    const fs = require('fs')
    const path = require('path')

    const configDir = './config'
    const configName = 'login'
    const configFile = `config-${configName}.json`

    const config = {
        project: configName,
        adminhost: process.env.DB_HOST,
        secrets: {
            adminUser: process.env.DB_USERNAME,
            adminPassword: process.env.DB_PASSWORD
        }
    }

    fs.mkdirSync(configDir, { recursive: true })
    fs.writeFileSync(path.join(configDir, configFile), JSON.stringify(config))
    fs.writeFileSync(path.join(configDir, 'productionProjects.json'), JSON.stringify([]))

    delete process.env.DB_HOST
    delete process.env.DB_USERNAME
    delete process.env.DB_PASSWORD

    execSync(`./nimadmin --config ${configDir} project set ${configName}`)
    return configDir
}

function validate(name, description, allowEmpty) {
    if (typeof name === 'string' || (allowEmpty && name === undefined)) {
        name = (name || '').trim()
        if (name == '' && !allowEmpty) {
            return Promise.reject({ error: `invalid ${description}` })
        } else {
            return Promise.resolve(name)
        }
    } else {
        return Promise.reject({ error: `invalid ${description}` })
    }
}

function userAddOrGet(apihost, configPath, command, flags, {subject, namespace}) {
    return Promise
        .all([
            validate(subject, 'user name'),
            validate(namespace, 'user namespace', true)
        ])
        .then(([user, ns]) => {
            let cmdline = `./nimadmin --config ${configPath} user ${command} ${user} ${ns} ${flags.join(' ')}`
            console.log(`executing: ${cmdline}`)

            return runcmd(cmdline)
                .then(output => {
                    try {
                        let value = JSON.parse(output.stdout.trim())
                        if (typeof value == 'object' && value.uuid && value.key) {
                            return {
                                status: command === 'add' ? 'created' : 'success',
                                apihost: apihost,
                                uuid: value.uuid,
                                key: value.key,
                                storage: value.storage,
                                namespace: value.namespace
                            }
                        } else {
                            return { error: 'account is not configured correctly' }
                        }
                    } catch (e) {
                        console.error(e, output)
                        return { error: 'account is not configured correctly' }
                    }
                })
                .catch(error => {
                    console.error(error)
                    return { error: 'account does not exist or could not be created' }
                })
        })
        .catch(error => {
            console.error(error)
            return error
        })
}

module.exports = (() => {
    let conf = init() // may throw an error, bubble it up
    let apihost = process.env.__OW_API_HOST

    return {
        adduser: args => userAddOrGet(apihost, conf, 'add', ['--terse'], args),
        getuser: args => userAddOrGet(apihost, conf, 'get', [], args)
    }
})()
