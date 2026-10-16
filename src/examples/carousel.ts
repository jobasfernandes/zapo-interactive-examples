import type { proto } from 'zapo-js'

import { MIXED_BIZ_OPTIONS } from '../lib/biz.js'
import { uploadImageFromUrl } from '../lib/media.js'
import type { Example, SendContent } from './types.js'

const CARDS = 3

function carousel(image: proto.Message.IImageMessage, ctaUrl: string): SendContent {
    return {
        interactiveMessage: {
            body: { text: 'Generic carousel' },
            footer: { text: 'sent with zapo-js' },
            carouselMessage: {
                messageVersion: 1,
                cards: Array.from({ length: CARDS }, (_, index) => {
                    const n = index + 1
                    return {
                        // One upload reused by every card.
                        header: { title: `Card ${n}`, hasMediaAttachment: true, imageMessage: image },
                        body: { text: `This is card number ${n}` },
                        nativeFlowMessage: {
                            messageVersion: 1,
                            buttons: [
                                { name: 'quick_reply', buttonParamsJson: JSON.stringify({ display_text: `Pick ${n}`, id: `card_${n}` }) },
                                { name: 'cta_url', buttonParamsJson: JSON.stringify({ display_text: 'Details', url: ctaUrl }) }
                            ]
                        }
                    }
                })
            }
        }
    } as unknown as SendContent
}

export const carouselExample: Example = {
    command: 'carousel',
    title: 'Carousel',
    description: `${CARDS} image cards with a quick reply and a link each`,
    requiresCatalog: false,
    async send(ctx) {
        const { client } = ctx.runtime
        const image = await uploadImageFromUrl(client, ctx.config.imageUrl)
        const result = await client.message.send(ctx.chatJid, carousel(image, ctx.config.ctaUrl), MIXED_BIZ_OPTIONS)
        ctx.log(`SENT carousel id=${result.id}${result.ack?.error ? ` ackError=${result.ack.error}` : ''}`)
        return [result.id]
    }
}
