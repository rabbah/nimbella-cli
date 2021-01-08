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

async function main(args) {
  try {
    const nim = require('@nimbella/sdk');
    const bucket = await nim.storage();
    console.log(`Using bucket ${bucket.name}`);
    return await writeToBucket(args.filename || 'test.txt', bucket);
  } catch (err) {
    return {error: err.message}
  }
}

async function writeToBucket(filename, bucket) {
  const file = bucket.file(filename);
  const contents = `Expected ${filename} contents`;
  await file.save(contents);
  return {body: 'ok'};
}

exports.main = main

