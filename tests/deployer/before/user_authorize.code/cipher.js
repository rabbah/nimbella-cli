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

const crypto = require('crypto'),
      SEPARATOR = ':'

function randomString(len) {
  return crypto.randomBytes(len).toString('hex').slice(0, len)
}

/**
 * Returns a function to encrypt or decrypt a given message
 * (provided as string or JSON object/array). When decrypting
 * the result is a string or undefined in case of error.
 */
function cipherFactory(key) {

  // create a 256 bit function specific hash with a secret key and the function source path
  const key256 = crypto.createHmac('sha256', key).digest()
  const saltLength = 8

  let encrypt = (subject, namespace) => {
    // a random 128 bit (16 byte) initialization vector, it ends up 32 hex chars of the encrypted value
    const iv128 = crypto.randomBytes(16)
    const cipher = crypto.createCipheriv('aes-256-cbc', key256, iv128)
    const salt = randomString(saltLength)
    let msg = `${salt}_${subject}`
    if (namespace !== undefined) {
      msg += SEPARATOR + namespace
    }

    let res = cipher.update(msg, 'utf8', 'hex') + cipher.final('hex')
    return `${iv128.toString('hex')}-${res}`
  }

  let decrypt = txt => new Promise((resolve, reject) => {
    if (typeof txt == 'string') {
      let parts = txt.split('-')

      if (parts.length == 2) {
        try {
          const iv128 = Buffer.from(parts[0], 'hex')
          const decipher = crypto.createDecipheriv('aes-256-cbc', key256, iv128)

          let res = decipher.update(parts[1], 'hex', 'utf8') + decipher.final('utf8')
          let msg = res.substring(res.indexOf('_') + 1)
          let [subject, namespace] = msg.split(SEPARATOR)
          if (namespace !== undefined) {
            return resolve({subject, namespace})
          } else {
            return resolve({subject})
          }
        } catch (e) {
          console.error(e)
        }
      }
    }

    console.error('failed to decrypt cipher text:', txt)
    reject('invalid argument')
  })

  return {
      encode: encrypt,
      decode: decrypt
  }
}

module.exports.cipherFactory = cipherFactory

if (process.env.TEST) {
  const key = process.argv[2]
  const mode = process.argv[3]

  const { encode, decode } = cipherFactory(key)

  if (mode === '-e' || mode === '--encode') {
    const subject = process.argv[4]
    const namespace = process.argv[5] // optional
    console.log(`login ${encode(subject, namespace)}`)
  } else if (mode === '-d' || mode === '--decode') {
    const txt = process.argv[4]
    decode(txt).then(console.log).catch(console.log)
  } else {
     console.error('Invalid mode, must be -e or -d.')
  }
}
