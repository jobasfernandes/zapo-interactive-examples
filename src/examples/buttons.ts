import { delay, proto } from 'zapo-js'

import { ownJids } from '../lib/client.js'
import type { Example, ExampleContext } from './types.js'

type NativeFlowButton = { name: string; buttonParamsJson: string }

const button = (name: string, params: Record<string, unknown>): NativeFlowButton => ({
    name,
    buttonParamsJson: JSON.stringify(params)
})

/** Old style: `buttonsMessage` wrapped in `documentWithCaptionMessage`, one empty `nativeFlowInfo` per button. */
function legacyButtons(): proto.IMessage {
    const RESPONSE = proto.Message.ButtonsMessage.Button.Type.RESPONSE
    const reply = (buttonId: string, displayText: string): proto.Message.ButtonsMessage.IButton => ({
        buttonId,
        buttonText: { displayText },
        type: RESPONSE,
        nativeFlowInfo: {}
    })
    return {
        documentWithCaptionMessage: {
            message: {
                buttonsMessage: {
                    contentText: 'Legacy buttons: pick one',
                    footerText: 'sent with zapo-js',
                    headerType: proto.Message.ButtonsMessage.HeaderType.EMPTY,
                    buttons: [reply('legacy_yes', 'Yes'), reply('legacy_no', 'No'), reply('legacy_maybe', 'Maybe')]
                }
            }
        }
    }
}

/** Current style: `interactiveMessage` + `nativeFlowMessage` with `quick_reply` buttons. */
function quickReplies(): proto.IMessage {
    return {
        interactiveMessage: {
            body: { text: 'Quick reply buttons: pick one' },
            footer: { text: 'sent with zapo-js' },
            nativeFlowMessage: {
                messageVersion: 1,
                buttons: [
                    button('quick_reply', { display_text: 'Yes', id: 'quick_yes' }),
                    button('quick_reply', { display_text: 'No', id: 'quick_no' }),
                    button('quick_reply', { display_text: 'Maybe', id: 'quick_maybe' })
                ]
            }
        }
    }
}

/** CTA buttons run on the device (open link, dial, copy) and send nothing back. */
function ctaButtons(url: string, phoneNumber: string): proto.IMessage {
    return {
        interactiveMessage: {
            body: { text: 'CTA buttons: open a link, call or copy a code' },
            footer: { text: 'sent with zapo-js' },
            nativeFlowMessage: {
                messageVersion: 1,
                buttons: [
                    button('cta_url', { display_text: 'Open link', url, merchant_url: url }),
                    button('cta_call', { display_text: 'Call', phone_number: phoneNumber }),
                    button('cta_copy', { display_text: 'Copy code', copy_code: 'ZAPO-123456' })
                ]
            }
        }
    }
}

function callNumber(ctx: ExampleContext): string {
    if (ctx.config.ctaCallNumber) return ctx.config.ctaCallNumber
    const pn = ownJids(ctx.runtime).pn
    if (!pn) throw new Error('no CTA_CALL_NUMBER set and the session has no phone number')
    return `+${pn.split('@')[0]}`
}

export const buttonsExample: Example = {
    command: 'buttons',
    title: 'Buttons',
    description: 'legacy buttons, quick replies and CTA (link, call, copy)',
    requiresCatalog: false,
    async send(ctx) {
        const { client } = ctx.runtime
        const messages = [legacyButtons(), quickReplies(), ctaButtons(ctx.config.ctaUrl, callNumber(ctx))]
        const ids: string[] = []
        for (const [index, message] of messages.entries()) {
            if (index > 0) await delay(2_000)
            const result = await client.message.send(ctx.chatJid, message)
            ctx.log(`SENT buttons#${index + 1} id=${result.id}${result.ack?.error ? ` ackError=${result.ack.error}` : ''}`)
            ids.push(result.id)
        }
        return ids
    }
}
