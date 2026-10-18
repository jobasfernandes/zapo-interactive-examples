import { downloadMediaMessage, type WaIncomingMessageEvent } from 'zapo-js'

import { unwrap } from './commands.js'
import type { MetaAiImage } from './meta-ai.js'

type Download = (source: WaIncomingMessageEvent) => Promise<AsyncIterable<Uint8Array>>

/** The photo of a message: fetched from WhatsApp's CDN and decrypted with the keys the message itself carries. */
export async function readIncomingImage(event: WaIncomingMessageEvent, download: Download = downloadMediaMessage): Promise<MetaAiImage> {
    const photo = unwrap(event.message)?.imageMessage
    if (!photo) throw new Error('the message has no photo')
    const parts: Uint8Array[] = []
    for await (const part of await download(event)) parts.push(part)
    return { data: Buffer.concat(parts), mimetype: photo.mimetype ?? 'image/jpeg' }
}
