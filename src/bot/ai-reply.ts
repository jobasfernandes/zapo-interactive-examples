import type { WaIncomingMessageEvent, WaSendMessageOptions } from 'zapo-js'

import type { MetaAiAnswer } from '../lib/meta-ai.js'

export const THINKING_TEXT = 'Thinking…'

// This stanza child makes WhatsApp show "IA" next to the time. Only the first stanza of a message counts (an edit
// cannot add it), and the server refuses it in groups with NACK 479 (docs/gotchas.md #18, #19).
const LABEL: Pick<WaSendMessageOptions, 'customNodes'> = { customNodes: [{ tag: 'bot', attrs: { biz_bot: '1' } }] }

export type AiReplyDeps = {
    /** Sends `text` to the chat the question came from and returns the id of the message it sent. */
    send: (text: string, options: WaSendMessageOptions) => Promise<string>
    ask: (question: string) => Promise<MetaAiAnswer>
    log: (message: string) => void
}

export type AiReplyInput = { question: string; quote: WaIncomingMessageEvent; isGroup: boolean }

export function failureText(answer: Extract<MetaAiAnswer, { ok: false }>): string {
    switch (answer.reason) {
        case 'no-answer':
            return 'Meta AI did not answer in time. Try again.'
        case 'unsupported':
            return 'Meta AI answered with something this bot cannot show (for example an image).'
        case 'unavailable':
            return 'There was a technical problem with Meta AI. Try again later.'
        case 'send-failed':
            return `Could not reach Meta AI: ${answer.detail}.`
    }
}

function describe(error: unknown): string {
    return error instanceof Error ? error.message : String(error)
}

/**
 * A "Thinking…" message that quotes the question, edited into the answer once Meta AI is done. Both the
 * placeholder and the label are best effort: neither may stop the answer from reaching the chat.
 */
export async function answerWithAi(deps: AiReplyDeps, input: AiReplyInput): Promise<void> {
    const { send, ask, log } = deps
    const { question, quote, isGroup } = input

    // The label is cosmetic, so a send the server rejects with it goes out again without it.
    async function sendLabeled(text: string): Promise<string> {
        if (isGroup) return send(text, { quote })
        try {
            return await send(text, { quote, ...LABEL })
        } catch (error) {
            log(`AI label rejected, resent without it: ${describe(error)}`)
            return send(text, { quote })
        }
    }

    let placeholderId: string | undefined
    try {
        placeholderId = await sendLabeled(THINKING_TEXT)
    } catch (error) {
        log(`AI placeholder not sent: ${describe(error)}`)
    }

    const startedAt = Date.now()
    const answer = await ask(question)
    if (answer.ok) {
        const seconds = ((Date.now() - startedAt) / 1000).toFixed(1)
        const thread = answer.threadNew ? 'new' : 'reused'
        log(`AI answered in ${seconds} s (${answer.chunks} chunks, ${answer.text.length} chars, thread ${thread}${answer.complete ? '' : ', cut short'})`)
    } else {
        log(`AI failed: ${answer.reason}`)
    }
    const text = answer.ok ? answer.text : failureText(answer)

    if (placeholderId !== undefined) {
        try {
            await send(text, { quote, editKey: { id: placeholderId } })
            return
        } catch (error) {
            log(`AI edit failed, sent as a new message: ${describe(error)}`)
        }
    }
    // A new message is a first stanza again, so it can carry the label, but only an AI answer deserves it.
    if (answer.ok) await sendLabeled(text)
    else await send(text, { quote })
}
