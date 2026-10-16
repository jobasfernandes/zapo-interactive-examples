import type { PixConfig } from '../lib/config.js'
import type { Example, SendContent } from './types.js'

/** "10,50", "10.5" or "7" (reais) to cents. */
export function parsePixAmount(arg: string | undefined): number | undefined {
    if (arg === undefined || !/^\d+([.,]\d{1,2})?$/.test(arg)) return undefined
    return Math.round(Number(arg.replace(',', '.')) * 100)
}

/** /charge amount in cents: R$ 0,01 when omitted, undefined when it is not a valid amount. */
export function parseChargeAmount(arg: string | undefined): number | undefined {
    return arg === undefined ? 1 : parsePixAmount(arg)
}

function pixSettings(pix: PixConfig) {
    return [{ type: 'pix_static_code', pix_static_code: { merchant_name: pix.merchantName, key: pix.key, key_type: pix.keyType } }]
}

/**
 * PIX key card (`payment_info`): the WhatsApp Business card with a static PIX key and a
 * "copy PIX key" button. It never shows an amount, on phone or Web; use the charge for that.
 * zapo names the stanza `payment_info` by itself.
 */
export function buildPixCard(pix: PixConfig): SendContent {
    const zero = { value: 0, offset: 100 }
    const params = {
        currency: 'BRL',
        total_amount: zero,
        reference_id: `PIX${Date.now()}`,
        type: 'physical-goods',
        order: {
            status: 'pending',
            subtotal: zero,
            order_type: 'ORDER',
            items: [{ name: '', amount: zero, quantity: 0, sale_amount: zero }]
        },
        payment_settings: pixSettings(pix),
        share_payment_status: false,
        is_soft_deleted: false,
        referral: 'chat_attachment'
    }
    return {
        interactiveMessage: {
            nativeFlowMessage: {
                messageVersion: 1,
                buttons: [{ name: 'payment_info', buttonParamsJson: JSON.stringify(params) }]
            }
        }
    } as unknown as SendContent
}

/**
 * Charge card (`review_and_pay` with a PIX payment setting): reference number, items, total
 * and how to pay; on the phone it opens the native payment flow. Amounts are integer cents
 * with `offset: 100` (1050 shows R$ 10,50). The trailing fields mirror what the WhatsApp
 * Business app sends with a charge; the app can also cancel this charge like its own.
 */
export function buildPixCharge(pix: PixConfig, amountCents: number): SendContent {
    const amount = { value: amountCents, offset: 100 }
    const params = {
        currency: 'BRL',
        reference_id: `PIX${Date.now()}`,
        type: 'physical-goods',
        total_amount: amount,
        payment_settings: pixSettings(pix),
        order: {
            status: 'payment_requested',
            subtotal: amount,
            order_type: 'ORDER',
            items: [{ name: 'Charge', amount, quantity: 1 }]
        },
        native_payment_methods: [],
        share_payment_status: false,
        is_soft_deleted: false
    }
    return {
        interactiveMessage: {
            body: { text: 'Your charge is ready.' },
            footer: { text: 'If you already paid, please ignore this message.' },
            nativeFlowMessage: {
                messageVersion: 1,
                buttons: [{ name: 'review_and_pay', buttonParamsJson: JSON.stringify(params) }]
            }
        }
    } as unknown as SendContent
}

export const pixExample: Example = {
    command: 'pix',
    title: 'PIX key',
    description: 'WhatsApp Business PIX key card (payment_info) with a copy button',
    requiresCatalog: false,
    async send(ctx) {
        const result = await ctx.runtime.client.message.send(ctx.chatJid, buildPixCard(ctx.config.pix))
        ctx.log(`SENT pix id=${result.id}${result.ack?.error ? ` ackError=${result.ack.error}` : ''}`)
        return [result.id]
    }
}

export const chargeExample: Example = {
    command: 'charge',
    title: 'PIX charge',
    description: 'review_and_pay charge paid with PIX; R$ 0,01 by default, or add an amount like 10,50',
    requiresCatalog: false,
    async send(ctx, args) {
        const { client } = ctx.runtime
        const amount = parseChargeAmount(args[0])
        const content = amount === undefined ? 'Usage: /charge [amount], e.g. /charge 10,50' : buildPixCharge(ctx.config.pix, amount)
        const result = await client.message.send(ctx.chatJid, content)
        ctx.log(`SENT charge ${amount ?? 'usage'} id=${result.id}${result.ack?.error ? ` ackError=${result.ack.error}` : ''}`)
        return [result.id]
    }
}
