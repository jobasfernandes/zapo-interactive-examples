import type { proto } from 'zapo-js'

import { findSentProducts, NO_PRODUCTS_TEXT, toNumber, type StoredProduct } from '../lib/catalog-history.js'
import type { ExampleContext, SendContent } from './types.js'

export type OrderItem = { id: string; name: string; amount: number; quantity: number }
export type OrderStatus = 'payment_requested' | 'canceled'

/**
 * The buyer's `orderMessage` only carries the item count and the total, not the items.
 * The card lists stored catalog products (sale price first) cycled up to the item count:
 * an approximation, documented as such, until the real order details can be fetched.
 */
export function deriveOrderItems(order: proto.Message.IOrderMessage, products: readonly StoredProduct[]): OrderItem[] {
    if (products.length === 0) return []
    const count = Math.max(1, toNumber(order.itemCount) || 1)
    return Array.from({ length: count }, (_, index) => {
        const product = products[index % products.length]
        return {
            id: product.productId,
            name: product.title,
            amount: product.salePriceAmount1000 ?? product.priceAmount1000,
            quantity: 1
        }
    })
}

/**
 * What WhatsApp Business sends when the seller answers a cart: a native flow
 * `review_and_pay` card (not an `orderMessage` with a status).
 */
export function buildReviewAndPayCard(
    order: proto.Message.IOrderMessage,
    items: readonly OrderItem[],
    status: OrderStatus,
    text: string
): SendContent {
    const subtotal = items.reduce((sum, item) => sum + item.amount * item.quantity, 0)
    const total = toNumber(order.totalAmount1000) || subtotal
    const params = {
        reference_id: order.orderId,
        type: 'physical-goods',
        payment_configuration: 'merchant_categorization_code',
        currency: order.totalCurrencyCode ?? 'BRL',
        total_amount: { value: total, offset: 1000 },
        order_type: 'ORDER',
        order: {
            status,
            items: items.map((item) => ({
                retailer_id: item.id,
                name: item.name,
                amount: { value: item.amount, offset: 1000 },
                quantity: item.quantity,
                isCustomItem: false,
                isQuantitySet: true
            })),
            subtotal: { value: subtotal || total, offset: 1000 },
            tax: null
        }
    }
    return {
        interactiveMessage: {
            header: { hasMediaAttachment: false, jpegThumbnail: order.thumbnail ?? undefined },
            body: { text },
            nativeFlowMessage: {
                buttons: [{ name: 'review_and_pay', buttonParamsJson: JSON.stringify(params) }],
                messageVersion: 1
            }
        }
    } as unknown as SendContent
}

/** Replies to a cart: the accept and the decline card (demo), or the prerequisite text. */
export function planOrderReply(order: proto.Message.IOrderMessage, products: readonly StoredProduct[]): SendContent[] {
    const items = deriveOrderItems(order, products)
    if (items.length === 0) return [NO_PRODUCTS_TEXT]
    return [
        buildReviewAndPayCard(order, items, 'payment_requested', 'Order received'),
        buildReviewAndPayCard(order, items, 'canceled', 'Order declined')
    ]
}

export async function replyToOrder(
    ctx: ExampleContext,
    order: proto.Message.IOrderMessage,
    quote: { id: string; remoteJid: string }
): Promise<readonly string[]> {
    const { client } = ctx.runtime
    const ids: string[] = []
    for (const content of planOrderReply(order, await findSentProducts(ctx.runtime))) {
        const result = await client.message.send(ctx.chatJid, content, { quote })
        ctx.log(`SENT order reply ${order.orderId} id=${result.id}${result.ack?.error ? ` ackError=${result.ack.error}` : ''}`)
        ids.push(result.id)
    }
    return ids
}
