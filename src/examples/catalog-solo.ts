import type { proto } from 'zapo-js'

import { ownJids } from '../lib/client.js'
import {
    findCatalogLinkPreview,
    findSentProducts,
    NO_PRODUCTS_TEXT,
    stripUnknowns,
    type CatalogLinkPreview,
    type StoredProduct
} from '../lib/catalog-history.js'
import { reuploadImage } from '../lib/media.js'
import { newMessageId } from '../lib/native-flow-name.js'
import type { Example, ExampleContext, SendContent } from './types.js'

/**
 * What the WhatsApp app sends when you share your catalog: not an interactive message
 * but a text with a `wa.me/c/<phone>` link preview (business name + thumbnail), which
 * the clients render as a catalog card.
 */
export function buildCatalogLink(phone: string, preview: CatalogLinkPreview | undefined): SendContent {
    const url = `https://wa.me/c/${phone}`
    return {
        extendedTextMessage: {
            text: `Check out our catalog on WhatsApp: ${url}`,
            matchedText: url,
            title: preview?.title,
            jpegThumbnail: preview?.jpegThumbnail,
            previewType: 0
        }
    } as unknown as SendContent
}

export type CatalogMessageHeader = { product: StoredProduct; image: proto.Message.IImageMessage }

/**
 * Interactive `catalog_message` (the Cloud API "catalog message"): one native flow
 * button that opens the whole catalog, optionally with a product as header thumbnail.
 * WhatsApp Web handles it like `cta_catalog` and builds the link from
 * `business_phone_number`; without it the button opens `wa.me/c/undefined` in a tab.
 */
export function buildCatalogMessage(phone: string, header: CatalogMessageHeader | undefined): SendContent {
    const params: Record<string, string> = { business_phone_number: phone }
    if (header) params.thumbnail_product_retailer_id = header.product.productId
    return {
        interactiveMessage: {
            header: header
                ? {
                      hasMediaAttachment: true,
                      productMessage: {
                          businessOwnerJid: header.product.payload.businessOwnerJid,
                          product: { ...stripUnknowns(header.product.payload.product), productImage: header.image }
                      }
                  }
                : undefined,
            body: { text: 'Browse our catalog 👇' },
            footer: { text: 'sent with zapo-js' },
            nativeFlowMessage: {
                messageVersion: 1,
                buttons: [{ name: 'catalog_message', buttonParamsJson: JSON.stringify(params) }]
            }
        }
    } as unknown as SendContent
}

function ownPhone(ctx: ExampleContext): string {
    const pn = ownJids(ctx.runtime).pn
    if (!pn) throw new Error('the session has no phone number')
    return pn.split('@')[0]
}

export const catalogLinkExample: Example = {
    command: 'catalog-link',
    title: 'Catalog link',
    description: 'the catalog share the WhatsApp app sends (wa.me/c link preview)',
    requiresCatalog: true,
    async send(ctx) {
        const preview = await findCatalogLinkPreview(ctx.runtime)
        const result = await ctx.runtime.client.message.send(ctx.chatJid, buildCatalogLink(ownPhone(ctx), preview))
        ctx.log(`SENT catalog-link preview=${preview ? 'stored' : 'none'} id=${result.id}${result.ack?.error ? ` ackError=${result.ack.error}` : ''}`)
        return [result.id]
    }
}

export const catalogMessageExample: Example = {
    command: 'catalog-message',
    title: 'Catalog message',
    description: 'interactive catalog_message: one button that opens the whole catalog; add "product" for a product header',
    requiresCatalog: true,
    async send(ctx, args) {
        const { client, armNativeFlow } = ctx.runtime
        // The product header works, but WhatsApp Web then renders the body text twice.
        let header: CatalogMessageHeader | undefined
        if (args[0] === 'product') {
            const [product] = await findSentProducts(ctx.runtime)
            if (!product) {
                const notice = await client.message.send(ctx.chatJid, NO_PRODUCTS_TEXT)
                ctx.log(`SENT catalog-message: no products in history, notice id=${notice.id}`)
                return [notice.id]
            }
            const image = product.payload.product?.productImage
            if (!image) throw new Error(`product ${product.productId} has no image`)
            header = { product, image: await reuploadImage(client, image) }
        }
        // Android picks the parser from the stanza's <native_flow name>, like form_message.
        const id = newMessageId()
        armNativeFlow(id, { name: 'catalog_message' })
        const result = await client.message.send(ctx.chatJid, buildCatalogMessage(ownPhone(ctx), header), { id })
        ctx.log(`SENT catalog-message id=${result.id}${result.ack?.error ? ` ackError=${result.ack.error}` : ''}`)
        return [result.id]
    }
}
