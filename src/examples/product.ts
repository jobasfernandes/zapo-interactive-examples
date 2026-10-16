import { findSentProducts, NO_PRODUCTS_TEXT, stripUnknowns } from '../lib/catalog-history.js'
import { reuploadImage } from '../lib/media.js'
import type { Example, SendContent } from './types.js'

const MAX_PRODUCTS = 3

export const productExample: Example = {
    command: 'product',
    title: 'Product',
    description: `catalog product cards (up to ${MAX_PRODUCTS})`,
    requiresCatalog: true,
    async send(ctx) {
        const { client } = ctx.runtime
        const products = (await findSentProducts(ctx.runtime)).slice(0, MAX_PRODUCTS)
        if (products.length === 0) {
            const notice = await client.message.send(ctx.chatJid, NO_PRODUCTS_TEXT)
            ctx.log(`SENT product: no products in history, notice id=${notice.id}`)
            return [notice.id]
        }
        const ids: string[] = []
        for (const product of products) {
            const image = product.payload.product?.productImage
            if (!image) throw new Error(`product ${product.productId} has no image`)
            // Same product identity, fresh media upload (an old media reference is dropped silently).
            const content = {
                productMessage: {
                    businessOwnerJid: product.payload.businessOwnerJid,
                    body: product.payload.body ?? undefined,
                    footer: product.payload.footer ?? undefined,
                    product: { ...stripUnknowns(product.payload.product), productImage: await reuploadImage(client, image) }
                }
            } as unknown as SendContent
            const result = await client.message.send(ctx.chatJid, content)
            ctx.log(`SENT product ${product.productId} id=${result.id}${result.ack?.error ? ` ackError=${result.ack.error}` : ''}`)
            ids.push(result.id)
        }
        return ids
    }
}
