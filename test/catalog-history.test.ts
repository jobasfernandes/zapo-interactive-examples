import { createSqliteStore, openSqliteConnection } from '@zapo-js/store-sqlite'
import { describe, expect, it } from 'vitest'
import { proto } from 'zapo-js'

import { findSentProducts } from '../src/lib/catalog-history.js'

// ':memory:' connections end up sharing data, so each test gets its own session id.
async function memoryStore(sessionId: string) {
    const connection = await openSqliteConnection({ path: ':memory:', driver: 'auto', sessionId })
    const sqlite = createSqliteStore({ connection })
    return { connection, sqlite, sessionId }
}

function productBytes(productId: string, title: string): Uint8Array {
    return proto.Message.encode({
        productMessage: {
            businessOwnerJid: '123456789012345@lid',
            product: {
                productId,
                title,
                currencyCode: 'BRL',
                priceAmount1000: 20000,
                productImage: { mimetype: 'image/jpeg', fileLength: 8836, mediaKeyTimestamp: 1791947773 }
            }
        }
    }).finish()
}

describe('findSentProducts', () => {
    it('finds products sent in a chat that is missing from the thread list', async () => {
        const store = await memoryStore('missing-thread')
        await store.sqlite.stores.threads(store.sessionId).upsert({ jid: '5511888888888@s.whatsapp.net' })
        await store.sqlite.stores.messages(store.sessionId).upsert({
            id: 'MSG1',
            threadJid: '222222222222222@lid',
            fromMe: true,
            timestampMs: 1_000,
            messageBytes: productBytes('1000000000000001', 'Item 1')
        })

        const products = await findSentProducts(store)

        expect(products.map((product) => product.productId)).toEqual(['1000000000000001'])
        expect(products[0].priceAmount1000).toBe(20000)
    })

    it('reads int64 prices above 2^31 (high-denomination currencies)', async () => {
        const store = await memoryStore('big-price')
        await store.sqlite.stores.messages(store.sessionId).upsert({
            id: 'MSG4',
            threadJid: '222222222222222@lid',
            fromMe: true,
            timestampMs: 1_000,
            messageBytes: proto.Message.encode({
                productMessage: { product: { productId: '1000000000000004', title: 'Item 4', currencyCode: 'IDR', priceAmount1000: 3_000_000_000 } }
            }).finish()
        })

        const [product] = await findSentProducts(store)

        expect(product.priceAmount1000).toBe(3_000_000_000)
    })

    it('keeps the stored image untouched so zapo can download it (int64 fields stay Long)', async () => {
        const store = await memoryStore('image-longs')
        await store.sqlite.stores.messages(store.sessionId).upsert({
            id: 'MSG3',
            threadJid: '222222222222222@lid',
            fromMe: true,
            timestampMs: 1_000,
            messageBytes: productBytes('1000000000000003', 'Item 3')
        })

        const [product] = await findSentProducts(store)
        const fileLength = product.payload.product?.productImage?.fileLength as unknown

        expect(typeof fileLength === 'number' || typeof (fileLength as { toNumber?: unknown }).toNumber === 'function').toBe(true)
    })

    it('ignores products received from someone else', async () => {
        const store = await memoryStore('received')
        await store.sqlite.stores.messages(store.sessionId).upsert({
            id: 'MSG2',
            threadJid: '222222222222222@lid',
            fromMe: false,
            timestampMs: 1_000,
            messageBytes: productBytes('1000000000000002', 'Item 2')
        })

        expect(await findSentProducts(store)).toEqual([])
    })
})
