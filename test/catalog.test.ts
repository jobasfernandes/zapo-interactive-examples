import { describe, expect, it } from 'vitest'
import type { proto } from 'zapo-js'

import { buildCatalogCarousel } from '../src/examples/catalog.js'
import { buildReviewAndPayCard, deriveOrderItems, planOrderReply } from '../src/examples/order.js'
import { NO_PRODUCTS_TEXT, type StoredProduct } from '../src/lib/catalog-history.js'

function product(productId: string, title: string): StoredProduct {
    return {
        productId,
        title,
        description: `${title} description`,
        priceAmount1000: 20000,
        salePriceAmount1000: 15000,
        currencyCode: 'BRL',
        payload: { businessOwnerJid: '123456789012345@lid', product: { productId, title } }
    }
}

const p1 = product('1000000000000001', 'Item 1')
const p2 = product('1000000000000002', 'Item 2')
const order: proto.Message.IOrderMessage = {
    orderId: '900000000000001',
    itemCount: 3,
    totalAmount1000: 45000,
    totalCurrencyCode: 'BRL',
    token: 'token'
}

type Card = { nativeFlowMessage: { buttons: { name: string; buttonParamsJson: string }[] } }

function cardsOf(content: unknown): Card[] {
    return (content as { interactiveMessage: { carouselMessage: { cards: Card[] } } }).interactiveMessage.carouselMessage.cards
}

function params(card: Card, index: number): Record<string, unknown> {
    return JSON.parse(card.nativeFlowMessage.buttons[index].buttonParamsJson) as Record<string, unknown>
}

describe('deriveOrderItems', () => {
    it('cycles the stored products up to the order item count using the sale price', () => {
        const items = deriveOrderItems(order, [p1, p2])
        expect(items.map((item) => item.id)).toEqual([p1.productId, p2.productId, p1.productId])
        expect(items.every((item) => item.amount === 15000 && item.quantity === 1)).toBe(true)
    })

    it('returns no items without products', () => {
        expect(deriveOrderItems(order, [])).toEqual([])
    })
})

describe('buildReviewAndPayCard', () => {
    it('builds a review_and_pay card with the order status and total', () => {
        const content = buildReviewAndPayCard(order, deriveOrderItems(order, [p1]), 'payment_requested', 'Order received') as {
            interactiveMessage: { nativeFlowMessage: { buttons: { name: string; buttonParamsJson: string }[] } }
        }
        const [button] = content.interactiveMessage.nativeFlowMessage.buttons
        expect(button.name).toBe('review_and_pay')
        const parsed = JSON.parse(button.buttonParamsJson) as {
            reference_id: string
            total_amount: unknown
            order: { status: string }
        }
        expect(parsed.reference_id).toBe(order.orderId)
        expect(parsed.total_amount).toEqual({ value: 45000, offset: 1000 })
        expect(parsed.order.status).toBe('payment_requested')
    })
})

describe('planOrderReply', () => {
    it('answers with the prerequisite text when there are no products', () => {
        expect(planOrderReply(order, [])).toEqual([NO_PRODUCTS_TEXT])
    })

    it('answers with an accept card and a decline card', () => {
        const replies = planOrderReply(order, [p1, p2]) as { interactiveMessage: { nativeFlowMessage: { buttons: { buttonParamsJson: string }[] } } }[]
        const statuses = replies.map(
            (reply) => (JSON.parse(reply.interactiveMessage.nativeFlowMessage.buttons[0].buttonParamsJson) as { order: { status: string } }).order.status
        )
        expect(statuses).toEqual(['payment_requested', 'canceled'])
    })
})

describe('buildCatalogCarousel', () => {
    const many = Array.from({ length: 12 }, (_, i) => product(String(1000000000000010 + i), `Item ${i}`))
    const images = many.map(() => ({ url: 'https://example.invalid/image' }))
    const phones = many.map(() => '5511999999999')

    it('caps at 10 cards and alternates product/catalog in mixed mode', () => {
        const cards = cardsOf(buildCatalogCarousel(many, images, phones, 'mixed', 'https://github.com/vinikjkkj/zapo'))
        expect(cards).toHaveLength(10)
        expect(cards[0].nativeFlowMessage.buttons.map((b) => b.name)).toEqual(['cta_url', 'cta_catalog'])
        expect(params(cards[0], 1).catalog_product_id).toBe(many[0].productId)
        expect(params(cards[1], 1).catalog_product_id).toBeUndefined()
        expect(params(cards[0], 1).business_phone_number).toBe('5511999999999')
    })

    it('points every card to the whole catalog in all mode and to the product in product mode', () => {
        const all = cardsOf(buildCatalogCarousel(many, images, phones, 'all', 'https://github.com/vinikjkkj/zapo'))
        expect(all.every((card) => params(card, 1).catalog_product_id === undefined)).toBe(true)
        const single = cardsOf(buildCatalogCarousel(many, images, phones, 'product', 'https://github.com/vinikjkkj/zapo'))
        expect(single.every((card, i) => params(card, 1).catalog_product_id === many[i].productId)).toBe(true)
    })
})
