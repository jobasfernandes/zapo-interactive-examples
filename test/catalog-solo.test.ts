import { createSqliteStore, openSqliteConnection } from '@zapo-js/store-sqlite'
import { describe, expect, it } from 'vitest'
import { proto } from 'zapo-js'

import { buildCatalogLink, buildCatalogMessage } from '../src/examples/catalog-solo.js'
import { findCatalogLinkPreview, type StoredProduct } from '../src/lib/catalog-history.js'

const product: StoredProduct = {
    productId: '1000000000000001',
    title: 'Item 1',
    description: 'Item 1 description',
    priceAmount1000: 20000,
    salePriceAmount1000: 15000,
    currencyCode: 'BRL',
    payload: { businessOwnerJid: '123456789012345@lid', product: { productId: '1000000000000001', title: 'Item 1' } }
}

describe('buildCatalogLink', () => {
    it('replicates the app catalog share: text with the wa.me/c link, matchedText, title and thumbnail', () => {
        const thumbnail = new Uint8Array([0xff, 0xd8])
        const content = buildCatalogLink('5511999999999', { title: 'My Shop', jpegThumbnail: thumbnail }) as {
            extendedTextMessage: { text: string; matchedText: string; title: string; jpegThumbnail: Uint8Array }
        }
        expect(content.extendedTextMessage.matchedText).toBe('https://wa.me/c/5511999999999')
        expect(content.extendedTextMessage.text).toContain('https://wa.me/c/5511999999999')
        expect(content.extendedTextMessage.title).toBe('My Shop')
        expect(content.extendedTextMessage.jpegThumbnail).toBe(thumbnail)
    })

    it('still sends the link without a stored preview', () => {
        const content = buildCatalogLink('5511999999999', undefined) as { extendedTextMessage: { matchedText: string; jpegThumbnail?: unknown } }
        expect(content.extendedTextMessage.matchedText).toBe('https://wa.me/c/5511999999999')
        expect(content.extendedTextMessage.jpegThumbnail).toBeUndefined()
    })
})

type CatalogMessage = {
    interactiveMessage: {
        header?: { productMessage?: { product: { productId: string } } }
        nativeFlowMessage: { buttons: { name: string; buttonParamsJson: string }[] }
    }
}

describe('buildCatalogMessage', () => {
    it('carries the business phone, which Web needs to open the catalog sheet instead of a browser tab', () => {
        const content = buildCatalogMessage('5511999999999', { product, image: { url: 'https://example.invalid/image' } }) as CatalogMessage
        const [button] = content.interactiveMessage.nativeFlowMessage.buttons
        expect(button.name).toBe('catalog_message')
        expect(JSON.parse(button.buttonParamsJson)).toEqual({
            business_phone_number: '5511999999999',
            thumbnail_product_retailer_id: '1000000000000001'
        })
        expect(content.interactiveMessage.header?.productMessage?.product.productId).toBe('1000000000000001')
    })

    it('can be sent without the product header', () => {
        const content = buildCatalogMessage('5511999999999', undefined) as CatalogMessage
        expect(content.interactiveMessage.header).toBeUndefined()
        expect(JSON.parse(content.interactiveMessage.nativeFlowMessage.buttons[0].buttonParamsJson)).toEqual({
            business_phone_number: '5511999999999'
        })
    })
})

describe('findCatalogLinkPreview', () => {
    it('reuses title and thumbnail from a catalog link the account sent from the app', async () => {
        const connection = await openSqliteConnection({ path: ':memory:', driver: 'auto', sessionId: 'catalog-link' })
        const store = { connection, sqlite: createSqliteStore({ connection }), sessionId: 'catalog-link' }
        await store.sqlite.stores.messages(store.sessionId).upsert({
            id: 'LINK1',
            threadJid: '222222222222222@lid',
            fromMe: true,
            timestampMs: 1_000,
            messageBytes: proto.Message.encode({
                extendedTextMessage: {
                    text: 'See our catalog: https://wa.me/c/5511999999999',
                    matchedText: 'https://wa.me/c/5511999999999',
                    title: 'My Shop',
                    jpegThumbnail: new Uint8Array([0xff, 0xd8, 0xff])
                }
            }).finish()
        })

        const preview = await findCatalogLinkPreview(store)

        expect(preview?.title).toBe('My Shop')
        expect(preview?.jpegThumbnail).toEqual(new Uint8Array([0xff, 0xd8, 0xff]))
    })
})
