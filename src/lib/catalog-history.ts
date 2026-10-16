import { proto, toUserJid } from 'zapo-js'

import { ownJids, type Runtime } from './client.js'

export type StoredProduct = {
    productId: string
    title: string
    description: string
    priceAmount1000: number
    salePriceAmount1000?: number
    currencyCode: string
    payload: proto.Message.IProductMessage
}

export const NO_PRODUCTS_TEXT =
    "No catalog products found in this session's history. This example needs a WhatsApp Business account with a catalog that has already sent its products at least once (open a chat, attach > Catalog, send them)."

/**
 * int64 proto fields decode as Long or number depending on the value. `Long.low` alone
 * overflows above 2^31, which a price in IDR or VND reaches quickly.
 */
export function toNumber(value: unknown): number {
    if (typeof value === 'number') return value
    if (value && typeof value === 'object' && typeof (value as { toNumber?: unknown }).toNumber === 'function') {
        return (value as { toNumber: () => number }).toNumber()
    }
    return Number(value ?? 0)
}

/**
 * Drops what the decoder kept on the side so the payload encodes back cleanly. Use it
 * only on what is about to be sent: it turns Long values into plain objects.
 */
export function stripUnknowns<T>(value: T): T {
    if (Array.isArray(value)) return value.map((item) => stripUnknowns(item)) as unknown as T
    if (value && typeof value === 'object' && !(value instanceof Uint8Array)) {
        const out: Record<string, unknown> = {}
        for (const [key, inner] of Object.entries(value as Record<string, unknown>)) {
            if (key !== '$unknowns') out[key] = stripUnknowns(inner)
        }
        return out as T
    }
    return value
}

export type CatalogStore = Pick<Runtime, 'sqlite' | 'connection' | 'sessionId'>

/**
 * Every chat that has stored messages. The thread store cannot be used for this: it
 * only knows chats synced from the app state, while messages are filed under the jid
 * they arrived with (often a LID), so most message threads are missing from it.
 */
async function messageThreadJids(store: CatalogStore): Promise<string[]> {
    // Touching the store first runs its lazy migration, so the table exists on a fresh session.
    await store.sqlite.stores.messages(store.sessionId).getById('')
    return store.connection
        .all<{ thread_jid: string }>('SELECT DISTINCT thread_jid FROM mailbox_messages WHERE session_id = ?', [store.sessionId])
        .map((row) => row.thread_jid)
}

/**
 * zapo has no catalog API yet (see docs/catalog-api-research.md), so the products
 * come from `productMessage`s this account already sent, in any chat.
 */
export async function findSentProducts(store: CatalogStore, scanPerThread = 200): Promise<StoredProduct[]> {
    const messages = store.sqlite.stores.messages(store.sessionId)
    const newest = new Map<string, { product: StoredProduct; timestampMs: number }>()

    for (const threadJid of await messageThreadJids(store)) {
        for (const record of await messages.listByThread(threadJid, scanPerThread)) {
            if (!record.fromMe || !record.messageBytes) continue
            let decoded: proto.IMessage
            try {
                const outer = proto.Message.decode(record.messageBytes)
                decoded = outer.deviceSentMessage?.message ?? outer
            } catch {
                continue
            }
            const payload = decoded.productMessage
            const spec = payload?.product
            if (!payload || !spec?.productId) continue
            const timestampMs = record.timestampMs ?? 0
            const current = newest.get(spec.productId)
            if (current && current.timestampMs >= timestampMs) continue
            newest.set(spec.productId, {
                timestampMs,
                product: {
                    productId: spec.productId,
                    title: spec.title ?? '(untitled)',
                    description: spec.description ?? '',
                    priceAmount1000: toNumber(spec.priceAmount1000),
                    salePriceAmount1000: spec.salePriceAmount1000 == null ? undefined : toNumber(spec.salePriceAmount1000),
                    currencyCode: spec.currencyCode ?? 'BRL',
                    // Kept as decoded: zapo needs the Long int64 fields to download the image.
                    payload
                }
            })
        }
    }
    return [...newest.values()].sort((a, b) => b.timestampMs - a.timestampMs).map((entry) => entry.product)
}

export type CatalogLinkPreview = { title?: string; jpegThumbnail?: Uint8Array }

/**
 * When the app shares the catalog it sends a link preview (`wa.me/c/<phone>`) with the
 * business name and a thumbnail. Reusing the newest one keeps the same look; the
 * thumbnail is inline bytes, not a media reference, so reusing it is safe.
 */
export async function findCatalogLinkPreview(store: CatalogStore, scanPerThread = 200): Promise<CatalogLinkPreview | undefined> {
    const messages = store.sqlite.stores.messages(store.sessionId)
    let newest: { preview: CatalogLinkPreview; timestampMs: number } | undefined
    for (const threadJid of await messageThreadJids(store)) {
        for (const record of await messages.listByThread(threadJid, scanPerThread)) {
            if (!record.fromMe || !record.messageBytes) continue
            let decoded: proto.IMessage
            try {
                const outer = proto.Message.decode(record.messageBytes)
                decoded = outer.deviceSentMessage?.message ?? outer
            } catch {
                continue
            }
            const link = decoded.extendedTextMessage
            if (!link?.matchedText?.startsWith('https://wa.me/c/')) continue
            const timestampMs = record.timestampMs ?? 0
            if (newest && newest.timestampMs >= timestampMs) continue
            newest = {
                timestampMs,
                preview: { title: link.title ?? undefined, jpegThumbnail: link.jpegThumbnail ?? undefined }
            }
        }
    }
    return newest?.preview
}

/**
 * Digits of the catalog owner's phone. `cta_catalog` and `wa.me/p` links need the
 * phone number: with the LID the client builds a link that 404s.
 */
export async function ownerPhone(runtime: Runtime, product: StoredProduct): Promise<string> {
    const owner = product.payload.businessOwnerJid ?? ''
    if (owner.endsWith('@s.whatsapp.net')) return toUserJid(owner).split('@')[0]
    const contact = owner ? await runtime.sqlite.stores.contacts(runtime.sessionId).getByJid(owner) : null
    if (contact?.phoneNumber) return contact.phoneNumber.split('@')[0]
    const pn = ownJids(runtime).pn
    if (pn) return pn.split('@')[0]
    throw new Error(`no phone number for catalog owner ${owner}`)
}
