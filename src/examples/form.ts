import type { proto } from 'zapo-js'

import { newMessageId } from '../lib/native-flow-name.js'
import type { Example } from './types.js'

/**
 * A2UI multi-step form (`form_message`). Web parses `version: "2"` with
 * `payload.type: "a2ui_form"`; a `form` component lists the steps (up to 3 on Web)
 * and each step is a `ChoicePicker` (up to 5 options on Web). The answer comes back as
 * `interactiveResponseMessage.nativeFlowResponseMessage` keyed by component id.
 */
function a2uiForm(): string {
    return JSON.stringify({
        version: '2',
        payload: {
            type: 'a2ui_form',
            data: {
                root: 'form',
                components: [
                    { id: 'form', component: 'form', children: ['service', 'channel', 'improvements'] },
                    {
                        id: 'service',
                        component: 'ChoicePicker',
                        variant: 'mutuallyExclusive',
                        label: 'How would you rate our service?',
                        allow_custom_answer: false,
                        options: [
                            { id: 'excellent', title: 'Excellent' },
                            { id: 'good', title: 'Good' },
                            { id: 'fair', title: 'Fair' },
                            { id: 'poor', title: 'Poor' }
                        ]
                    },
                    {
                        id: 'channel',
                        component: 'ChoicePicker',
                        variant: 'mutuallyExclusive',
                        label: 'Which channel do you prefer?',
                        allow_custom_answer: true,
                        options: [
                            { id: 'whatsapp', title: 'WhatsApp' },
                            { id: 'phone', title: 'Phone' },
                            { id: 'email', title: 'E-mail' },
                            { id: 'in_person', title: 'In person' }
                        ]
                    },
                    {
                        id: 'improvements',
                        component: 'ChoicePicker',
                        variant: 'multipleSelection',
                        label: 'What could we improve?',
                        allow_custom_answer: true,
                        options: [
                            { id: 'speed', title: 'Speed' },
                            { id: 'clarity', title: 'Clarity' },
                            { id: 'price', title: 'Price' },
                            { id: 'support', title: 'Support' }
                        ]
                    }
                ]
            }
        }
    })
}

function formMessage(): proto.IMessage {
    return {
        interactiveMessage: {
            header: { title: 'Quick survey', hasMediaAttachment: false },
            body: { text: 'Answer in a few steps 👇' },
            footer: { text: 'sent with zapo-js' },
            nativeFlowMessage: {
                buttons: [{ name: 'form_message', buttonParamsJson: '' }],
                messageParamsJson: a2uiForm()
            }
        }
    }
}

export const formExample: Example = {
    command: 'form',
    title: 'A2UI form',
    description: 'multi-step form (form_message) that opens on phone and Web',
    requiresCatalog: false,
    async send(ctx) {
        const { client, armNativeFlow } = ctx.runtime
        // Android only treats it as a form when the stanza names the flow (see lib/native-flow-name.ts).
        const id = newMessageId()
        armNativeFlow(id, { name: 'form_message' })
        const result = await client.message.send(ctx.chatJid, formMessage(), { id })
        ctx.log(`SENT form id=${result.id}${result.ack?.error ? ` ackError=${result.ack.error}` : ''}`)
        return [result.id]
    }
}
