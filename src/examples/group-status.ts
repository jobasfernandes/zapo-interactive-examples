import { randomBytes } from 'node:crypto'
import { readFileSync } from 'node:fs'

import type { proto, WaSendMessageOptions } from 'zapo-js'

import { uploadImage } from '../lib/media.js'
import type { Example, SendContent } from './types.js'

/**
 * A group status is the status a member posts to a group: members see it on the group's
 * status (Updates tab on the phone, Status on WhatsApp Web) for 24 h, outside the chat
 * timeline. On the wire it is an ordinary group message whose content is wrapped in
 * `groupStatusMessageV2`; receivers recognize it by that wrapper.
 */

/** Portrait 9:16 fills the status viewer. The JPEGs are what gets sent; the source HTML is not in the repo. */
const BANNER = new URL('../../assets/group-status.jpg', import.meta.url)
const THUMBNAIL = new URL('../../assets/group-status-thumb.jpg', import.meta.url)
const BANNER_WIDTH = 1080
const BANNER_HEIGHT = 1920

export const GROUP_STATUS_CAPTION =
    'Exemplos interativos de WhatsApp com zapo-js: botões, carrossel, formulário, catálogo e PIX, testados no celular e no WhatsApp Web.\n\nhttps://github.com/jobasfernandes/zapo-interactive-examples'

/**
 * The `<meta>` node is what the Android app attaches when it posts a group status, and zapo
 * does not add it; the server then acks with `is_group_status="true"`. zapo would also write
 * the group's disappearing-messages settings onto the wrapper, where they are dropped, so that
 * inject is turned off. A big group can take longer than the default 10 s to ack (docs/gotchas.md #11).
 */
export const GROUP_STATUS_OPTIONS = {
    customNodes: [{ tag: 'meta', attrs: { is_group_status: 'true', origin: 'group_status' }, content: undefined }],
    disableGroupEphemeralAutoInject: true,
    ackTimeoutMs: 30_000
} as unknown as WaSendMessageOptions

/** The secret stays on the outer message only, the shape the Android app sends. */
export function buildGroupStatus(image: proto.Message.IImageMessage, messageSecret: Uint8Array = randomBytes(32)): SendContent {
    return {
        messageContextInfo: { messageSecret },
        groupStatusMessageV2: { message: { imageMessage: { ...image, contextInfo: { isGroupStatus: true } } } }
    } as SendContent
}

export const groupStatusExample: Example = {
    command: 'group-status',
    title: 'Group status',
    description: 'the repo banner posted as a status of the group (Updates tab, 24 h)',
    requiresCatalog: false,
    async send(ctx) {
        // zapo turns an id without @g.us into a private chat: never post a status payload there.
        if (!ctx.chatJid.endsWith('@g.us')) throw new Error(`group-status posts to a group: pass its jid ending in @g.us, got ${ctx.chatJid}`)
        const { client } = ctx.runtime
        // A fresh upload every time: a reused media reference is dropped silently (docs/gotchas.md #3).
        const image = await uploadImage(client, readFileSync(BANNER), 'image/jpeg')
        const status = buildGroupStatus({
            ...image,
            width: BANNER_WIDTH,
            height: BANNER_HEIGHT,
            caption: GROUP_STATUS_CAPTION,
            jpegThumbnail: readFileSync(THUMBNAIL)
        })
        const result = await client.message.send(ctx.chatJid, status, GROUP_STATUS_OPTIONS)
        ctx.log(`SENT group-status id=${result.id} to=${ctx.chatJid}${result.ack?.error ? ` ackError=${result.ack.error}` : ''}`)
        return [result.id]
    }
}
