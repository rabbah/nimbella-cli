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

 // Read JSON.   Write it back out with "key value" arrays converted to dictionaries (and sorted),
 //   members sorted, and certain volatile members removed.  Tends to make 'wsk action get' results
 //   easier to compare for correctness.

 const fs = require('fs')

 if (process.argv.length != 3) {
     console.error("wrong number of arguments")
     process.exit()
 }
const file  = process.argv[2]
const inputText = fs.readFileSync(file)
const inputJSON = JSON.parse(inputText)
const outputJSON = {}
const members = []
for (member in inputJSON) {
    if (member == 'version') continue
    members.push(member)
}
//console.log("found members")
//console.dir(members, { depth: null })
for (const member of members.sort()) {
    let value = inputJSON[member]
    //console.log("member is", member)
    if (Array.isArray(value)) {
        value = convertAndSortDictionary(value)
    } else if (member == 'limits') {
        // console.log("have limits member, sorting")
        value = sortDictionary(inputJSON[member])
    }
    //console.log("adding", member, "with value", value)
    outputJSON[member] = value
}
fs.writeFileSync(file, JSON.stringify(outputJSON, null, 2))

// Convert a key value array into a more convenient dictionary form while sorting by key
function convertAndSortDictionary(keyVal) {
    //console.log("examining array")
    //console.dir(keyVal, { depth: null })
    const unsorted = {}
    for (let member of keyVal) {
        if (!('key' in member) || !('value' in member)) {
            //console.log("found non-key-value")
            return keyVal
        }
        if (member['key'] === 'deployer') {
            if (member['value']['zipped']) {
                member = { key: 'zipped', value: true }
            } else {
                continue
            }
        } else if (member['key'] == 'DB_HOST') {
            continue
        }
        unsorted[member['key']] = member['value']
    }
    return sortDictionary(unsorted)
}

// Sort a dictionary
function sortDictionary (unsorted) {
    const ans = {}
    for (key of Object.keys(unsorted).sort()) {
        // console.log("sorting key", key)
        ans[key] = unsorted[key]
    }
    return ans
}
