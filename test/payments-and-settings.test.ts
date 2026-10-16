import { describe, expect, it } from 'vitest'

import { buildPixCard, buildPixCharge, parseChargeAmount, parsePixAmount } from '../src/examples/pix.js'

const pix = { merchantName: 'Example Store', key: 'pix@example.com', keyType: 'EMAIL' as const }

type Params = {
    currency: string
    total_amount: { value: number; offset: number }
    payment_settings: { type: string; pix_static_code: unknown }[]
    native_payment_methods?: unknown
    share_payment_status?: unknown
    is_soft_deleted?: unknown
    order: { status: string; items: { amount: unknown; quantity: number }[] }
}

function button(content: unknown): { name: string; params: Params } {
    const first = (content as { interactiveMessage: { nativeFlowMessage: { buttons: { name: string; buttonParamsJson: string }[] } } })
        .interactiveMessage.nativeFlowMessage.buttons[0]
    return { name: first.name, params: JSON.parse(first.buttonParamsJson) as Params }
}

const pixSettings = [
    { type: 'pix_static_code', pix_static_code: { merchant_name: 'Example Store', key: 'pix@example.com', key_type: 'EMAIL' } }
]

describe('PIX key card (/pix)', () => {
    it('is a payment_info card with the static PIX key and no amount', () => {
        const { name, params } = button(buildPixCard(pix))
        expect(name).toBe('payment_info')
        expect(params.currency).toBe('BRL')
        expect(params.total_amount).toEqual({ value: 0, offset: 100 })
        expect(params.payment_settings).toEqual(pixSettings)
    })
})

describe('PIX charge (/charge)', () => {
    it('is a review_and_pay card showing the amount, paid with the PIX key', () => {
        const { name, params } = button(buildPixCharge(pix, 1050))
        expect(name).toBe('review_and_pay')
        expect(params.total_amount).toEqual({ value: 1050, offset: 100 })
        expect(params.payment_settings).toEqual(pixSettings)
        expect(params.order.status).toBe('payment_requested')
        expect(params.order.items[0]).toMatchObject({ amount: { value: 1050, offset: 100 }, quantity: 1 })
    })

    it('carries the fields the WhatsApp Business app sends with a charge', () => {
        const { params } = button(buildPixCharge(pix, 1))
        expect(params.native_payment_methods).toEqual([])
        expect(params.share_payment_status).toBe(false)
        expect(params.is_soft_deleted).toBe(false)
    })

    it('defaults to R$ 0,01 and rejects an invalid amount', () => {
        expect(parseChargeAmount(undefined)).toBe(1)
        expect(parseChargeAmount('10,50')).toBe(1050)
        expect(parseChargeAmount('abc')).toBeUndefined()
    })
})

describe('parsePixAmount', () => {
    it('parses amounts written with comma or dot', () => {
        expect(parsePixAmount('10,50')).toBe(1050)
        expect(parsePixAmount('10.5')).toBe(1050)
        expect(parsePixAmount('7')).toBe(700)
        expect(parsePixAmount('abc')).toBeUndefined()
        expect(parsePixAmount('-3')).toBeUndefined()
        expect(parsePixAmount(undefined)).toBeUndefined()
    })
})
