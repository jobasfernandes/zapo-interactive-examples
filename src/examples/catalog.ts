import type { proto } from 'zapo-js'

import { MIXED_BIZ_OPTIONS } from '../lib/biz.js'
import { findSentProducts, NO_PRODUCTS_TEXT, ownerPhone, type StoredProduct } from '../lib/catalog-history.js'
import { reuploadImage } from '../lib/media.js'
import type { Example, SendContent } from './types.js'

export type CatalogMode = 'product' | 'all' | 'mixed'

const MAX_CARDS = 10

function price(product: StoredProduct): string {
    const amount = (product.salePriceAmount1000 ?? product.priceAmount1000) / 1000
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: product.currencyCode }).format(amount)
}

/**
 * Native catalog CTA: the client builds the wa.me/p link itself. With
 * `catalog_product_id` it opens the product, without it the whole catalog.
 */
function catalogButton(phone: string, productId?: string): { name: string; buttonParamsJson: string } {
    const params: Record<string, string> = { business_phone_number: phone }
    if (productId) params.catalog_product_id = productId
    return { name: 'cta_catalog', buttonParamsJson: JSON.stringify(params) }
}

/**
 * Generic cards (image + title + description/price) with an external `cta_url` and a
 * `cta_catalog`. This is the combination validated on phone and Web: a carousel with
 * only `cta_catalog` is dropped by the phone, and a product card header
 * (`header.productMessage`) does not load on Web.
 */
export function buildCatalogCarousel(
    products: readonly StoredProduct[],
    images: readonly proto.Message.IImageMessage[],
    phones: readonly string[],
    mode: CatalogMode,
    ctaUrl: string
): SendContent {
    const cards = products.slice(0, MAX_CARDS).map((product, index) => {
        const productId = mode === 'product' || (mode === 'mixed' && index % 2 === 0) ? product.productId : undefined
        return {
            header: { title: product.title, hasMediaAttachment: true, imageMessage: images[index] },
            body: { text: `${product.description}\n${price(product)}`.trim() },
            nativeFlowMessage: {
                messageVersion: 1,
                buttons: [
                    { name: 'cta_url', buttonParamsJson: JSON.stringify({ display_text: 'Learn more', url: ctaUrl, merchant_url: ctaUrl }) },
                    catalogButton(phones[index], productId)
                ]
            }
        }
    })
    return {
        interactiveMessage: {
            body: { text: 'Fresh from the catalog:' },
            footer: { text: 'sent with zapo-js' },
            carouselMessage: { messageVersion: 1, cards }
        }
    } as unknown as SendContent
}

function parseMode(arg: string | undefined): CatalogMode {
    return arg === 'all' || arg === 'mixed' ? arg : 'product'
}

export const catalogExample: Example = {
    command: 'catalog',
    title: 'Catalog carousel',
    description: 'carousel of catalog products; add "all" or "mixed" to change the catalog button',
    requiresCatalog: true,
    async send(ctx, args) {
        const { client } = ctx.runtime
        const products = (await findSentProducts(ctx.runtime)).slice(0, MAX_CARDS)
        if (products.length === 0) {
            const notice = await client.message.send(ctx.chatJid, NO_PRODUCTS_TEXT)
            ctx.log(`SENT catalog: no products in history, notice id=${notice.id}`)
            return [notice.id]
        }
        const images: proto.Message.IImageMessage[] = []
        const phones: string[] = []
        for (const product of products) {
            const image = product.payload.product?.productImage
            if (!image) throw new Error(`product ${product.productId} has no image`)
            images.push(await reuploadImage(client, image))
            phones.push(await ownerPhone(ctx.runtime, product))
        }
        const mode = parseMode(args[0])
        const content = buildCatalogCarousel(products, images, phones, mode, ctx.config.ctaUrl)
        const result = await client.message.send(ctx.chatJid, content, MIXED_BIZ_OPTIONS)
        ctx.log(`SENT catalog (${mode}) cards=${products.length} id=${result.id}${result.ack?.error ? ` ackError=${result.ack.error}` : ''}`)
        return [result.id]
    }
}
