import type { proto } from 'zapo-js'

import type { Example } from './types.js'

/**
 * `cta_url` with `webview_interaction: true` opens the page inside WhatsApp on the phone
 * (without it the link goes to the external browser). `webview_presentation` alone does
 * not trigger the in-app webview. WhatsApp Web has no in-app webview and opens a browser tab.
 */
function webviewMessage(url: string): proto.IMessage {
    return {
        interactiveMessage: {
            body: { text: 'Tap to open the page inside WhatsApp 👇' },
            footer: { text: 'sent with zapo-js' },
            nativeFlowMessage: {
                messageVersion: 1,
                buttons: [
                    {
                        name: 'cta_url',
                        buttonParamsJson: JSON.stringify({
                            display_text: 'Open',
                            url,
                            merchant_url: url,
                            webview_presentation: 'full',
                            webview_interaction: true
                        })
                    }
                ]
            }
        }
    }
}

export const webviewExample: Example = {
    command: 'webview',
    title: 'Webview',
    description: 'link button that opens a page inside WhatsApp on the phone',
    requiresCatalog: false,
    async send(ctx) {
        const result = await ctx.runtime.client.message.send(ctx.chatJid, webviewMessage(ctx.config.webviewUrl))
        ctx.log(`SENT webview id=${result.id}${result.ack?.error ? ` ackError=${result.ack.error}` : ''}`)
        return [result.id]
    }
}
