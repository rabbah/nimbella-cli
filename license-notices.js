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

const fs = require('fs'),
      path = require('path')

const PREAMBLE = `## Third Party Libraries.

The software includes third party libraries which are subject
to their own license terms. These terms accompany each of the
libraries included with the software. If you do not agree to
abide by the applicable license terms for the third party
libraries, then you may not install them and cannot use the
software.

The list below groups the third party libraries by their license terms.
`

// exclude some node modules because they are ours
const EXCLUDES = [ 'nimbella-cli', 'deployer' ]

const ALTERNATIVES = {
    'APACHE 2.0': 'APACHE 2.0',
    'Apache License': 'APACHE 2.0',
    'Apache-2': 'APACHE 2.0',
    'Apache 2.0': 'APACHE 2.0',
    'Apache-2.0': 'APACHE 2.0',
    '(BSD-3-Clause OR GPL-2.0)': 'BSD-3-Clause', // free to choose more compatible one
    '(MIT OR CC0-1.0)': 'MIT', // free to choose more compatible one
    '(MIT OR Apache-2.0)': 'MIT', // free to choose more compatible one
    '(BSD-2-Clause OR MIT OR Apache-2.0)': 'MIT', // free to choose more compatible one
    'BSD': 'BSD-2-Clause' // only one package 'expand-home-dir' uses BSD but does not include license or specify which version
}

const LINKS = {
    'AFLv2.1': 'http://www.copyleftlicense.com/licenses/academic-free-license-(afl)-version-21/view.txt',
    'APACHE 2.0': 'https://opensource.org/licenses/apache2.0',
    'BSD-2-Clause': 'https://opensource.org/licenses/BSD-2-Clause',
    'BSD-3-Clause': 'https://opensource.org/licenses/BSD-3-Clause',
    'CC0-1.0': 'https://creativecommons.org/publicdomain/zero/1.0/legalcode',
    'CC-BY-3.0': 'https://creativecommons.org/licenses/by/3.0/legalcode',
    'CC-BY-4.0': 'https://creativecommons.org/licenses/by/4.0/legalcode',
    'ISC': 'https://opensource.org/licenses/isc',
    'MIT': 'https://opensource.org/licenses/MIT',
    'Unlicense': 'https://unlicense.org',
    'WTFPL': 'http://www.wtfpl.net/about',
    '(MIT AND Zlib)': 'https://opensource.org/licenses/MIT, https://opensource.org/licenses/Zlib',
    '(MIT AND BSD-3-Clause)': 'https://opensource.org/licenses/MIT, https://opensource.org/licenses/BSD-3-Clause'
}

// helper to debug/log
const debug = process.env.DEBUG ? console.log : () => {}

// global object to map licenses to packages
const LICENSES = {}

// given a license (from a package.json file), normalize its name or
// select a version when a choice exists, and then record it for the
// corresponding package name
function addLicense(license, pkgname, pkgroot) {
    let altLicense = ALTERNATIVES[license]
    if (altLicense !== undefined) {
        license = altLicense
    }

    if (LICENSES[license] === undefined) {
        LICENSES[license] = new Set()
    }

    LICENSES[license].add(pkgname)
}

function checkForLicense(pkgroot) {
    if (pkgroot == '') return

    let pkgfile = path.join(pkgroot, 'package.json')

    if (fs.existsSync(pkgfile)) {
        let pkg = require(pkgfile)
        let metadata = pkg.license || pkg.licenses
        if (metadata) {
            let name = pkg.name
            if (name === undefined || name === '') {
                throw new Error(`${pkgfile} has no name property.`)
            } else if (EXCLUDES.includes(name)) {
                return
            }

            if (typeof metadata === 'string') {
                addLicense(metadata, name, pkgroot)
            } else if (typeof metadata.type === 'string') {
                addLicense(metadata.type, name, pkgroot)
            } else if (Array.isArray(metadata)) {
                metadata.forEach(_ => {
                    if (typeof _.type === 'string') {
                        addLicense(_.type, name, pkgroot)
                    } else {
                        throw new Error(`${pkgroot} has an invalid license field`)
                    }
                })
            } else {
                throw new Error(`${pkgroot} has an invalid license field`)
            }
        } else {
            throw new Error(`${pkgroot} has an incomplete package.json`)
        }
    } else {
        throw new Error(`${pkgroot} is missing package.json`)
    }
}

function toJson(licenses) {
    Object.entries(licenses).forEach(([k,v]) => {
        licenses[k] = Array.from(v)
    })
    console.log(JSON.stringify(licenses))
}

function nodeList(root) {
    const { exec } = require('child_process')
    return new Promise((resolve, reject) => {
        exec('npm list --parseable --depth 1000', (err, stdout, stderr) => {
            debug(stdout)
            debug(stderr)
            resolve(stdout.split('\n'))
        })
    })
}

const root = process.argv[2]

nodeList(root)
    .then(pkgs => {
        pkgs.forEach(pkg => {
            checkForLicense(pkg)
        })
    })
    .then(_ => {
        console.log(PREAMBLE)
        Object.entries(LICENSES).forEach(([license, pkgs]) => {
            console.log()
            console.log(`### ${license} licensed libraries`)
            console.log(`- A reference copy of the ${license} license is available at [${LINKS[license]}](${LINKS[license]})\n`)
            pkgs.forEach(p => console.log(`    - [${p}](https://npmjs.org/${p})`))
        })
    })
    .catch(console.error)