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

import { Bucket } from '@google-cloud/storage'
import { NimLogger } from '../NimBaseCommand'

// Constants used in formatting the file list
const SIZE_LEN = 10
const LIST_SHORT_HEADER = `Name`
const LIST_LONG_HEADER = `Size${' '.repeat(SIZE_LEN - 4)} Updated${' '.repeat(17)} Name`
const MAYBE = '-?-'


export async function fileMetaShort(files: any, client: Bucket, logger: NimLogger) {
    logger.log(LIST_SHORT_HEADER)
    for (const file of files) {
        logger.log(`${file.name}`);
    }
}

export async function fileMetaLong(files: any, client: Bucket, logger: NimLogger) {
    logger.log(LIST_LONG_HEADER);
    for (const file of files) {
        await client.file(file.name).getMetadata().then(function (data) {
            const meta = data[0];
            let fileName = meta.name;
            let sizePad = '';
            const size = humanFileSize(meta.size);
            if (size.length < SIZE_LEN) {
                sizePad = ' '.repeat(SIZE_LEN - size.length)
            }
            const updated = meta.updated || MAYBE
            logger.log(`${size}${sizePad} ${updated} ${fileName}`)
        });
    }
}

export function humanFileSize(bytes: number | undefined, si: boolean | undefined = undefined) {
    if (!bytes) return;
    var thresh = si ? 1000 : 1024;
    if (Math.abs(bytes) < thresh) {
        return bytes + ' B';
    }
    var units = si
        ? ['kB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB']
        : ['KiB', 'MiB', 'GiB', 'TiB', 'PiB', 'EiB', 'ZiB', 'YiB'];
    var u = -1;
    do {
        bytes /= thresh;
        ++u;
    } while (Math.abs(bytes) >= thresh && u < units.length - 1);
    return bytes.toFixed(1) + ' ' + units[u];
}
