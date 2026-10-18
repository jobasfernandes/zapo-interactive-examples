import { describe, expect, it } from 'vitest'
import type { WaIncomingMessageEvent, WaSendMessageOptions } from 'zapo-js'

import { answerWithAi, THINKING_TEXT } from '../src/bot/ai-reply.js'
import type { MetaAiAnswer } from '../src/lib/meta-ai.js'

const LABEL = { tag: 'bot', attrs: { biz_bot: '1' }, content: undefined }
const quote = { key: { id: 'Q1' } } as unknown as WaIncomingMessageEvent
const ok = (text: string): MetaAiAnswer => ({ ok: true, text, complete: true, chunks: 3, threadNew: true })
const flush = () => new Promise<void>((resolve) => setImmediate(resolve))

type Options = {
    isGroup?: boolean
    question?: string
    answer?: MetaAiAnswer
    /** 1-based numbers of the `send` calls that throw; failed calls count too. */
    failSends?: readonly number[]
    holdFirstSend?: Promise<void>
}

/** Runs the flow against fakes. `send` answers `M<call number>` and records every call, failed ones included. */
function run(options: Options = {}) {
    const sends: { text: string; options: WaSendMessageOptions }[] = []
    const events: string[] = []
    const asked: string[] = []
    const logs: string[] = []
    const failing = new Set(options.failSends ?? [])
    const done = answerWithAi(
        {
            send: async (text, sendOptions) => {
                sends.push({ text, options: sendOptions })
                const number = sends.length
                events.push(`send ${number}`)
                if (number === 1) await options.holdFirstSend
                if (failing.has(number)) throw new Error(`send ${number} failed`)
                return `M${number}`
            },
            ask: async (question) => {
                events.push('ask')
                asked.push(question)
                return options.answer ?? ok('The answer')
            },
            log: (message) => {
                logs.push(message)
            }
        },
        { question: options.question ?? 'q', quote, isGroup: options.isGroup ?? false }
    )
    return { done, sends, events, asked, logs }
}

describe('answerWithAi', () => {
    it('edits the labeled placeholder into the answer in a private chat', async () => {
        const flow = run()
        await flow.done

        expect(THINKING_TEXT).toBe('Thinking…')
        expect(flow.sends).toEqual([
            { text: 'Thinking…', options: { quote, customNodes: [LABEL] } },
            { text: 'The answer', options: { quote, editKey: { id: 'M1' } } }
        ])
        expect(flow.events).toEqual(['send 1', 'ask', 'send 2'])
        expect(flow.asked).toEqual(['q'])
    })

    it('sends no label in a group', async () => {
        const flow = run({ isGroup: true })
        await flow.done

        expect(flow.sends).toEqual([
            { text: 'Thinking…', options: { quote } },
            { text: 'The answer', options: { quote, editKey: { id: 'M1' } } }
        ])
    })

    it('asks only after the placeholder was sent', async () => {
        let release: () => void = () => undefined
        const gate = new Promise<void>((resolve) => {
            release = resolve
        })
        const flow = run({ holdFirstSend: gate })
        await flush()
        expect(flow.asked).toEqual([])

        release()
        await flow.done
        expect(flow.asked).toEqual(['q'])
    })

    it('resends the placeholder without the label when the labeled send is rejected', async () => {
        const flow = run({ failSends: [1] })
        await flow.done

        expect(flow.sends).toEqual([
            { text: 'Thinking…', options: { quote, customNodes: [LABEL] } },
            { text: 'Thinking…', options: { quote } },
            { text: 'The answer', options: { quote, editKey: { id: 'M2' } } }
        ])
        expect(flow.logs.some((line) => /label/i.test(line))).toBe(true)
    })

    it('sends the answer as a new message when the edit fails', async () => {
        const privateChat = run({ failSends: [2] })
        await privateChat.done
        expect(privateChat.sends[2]).toEqual({ text: 'The answer', options: { quote, customNodes: [LABEL] } })
        expect(privateChat.logs.some((line) => /edit/i.test(line))).toBe(true)

        const group = run({ failSends: [2], isGroup: true })
        await group.done
        expect(group.sends[2]).toEqual({ text: 'The answer', options: { quote } })
    })

    it('edits the placeholder with the failure text', async () => {
        const cases: { answer: MetaAiAnswer; text: string; log: string }[] = [
            { answer: { ok: false, reason: 'no-answer' }, text: 'Meta AI did not answer in time. Try again.', log: 'AI failed: no-answer' },
            {
                answer: { ok: false, reason: 'unsupported' },
                text: 'Meta AI answered with something this bot cannot show (for example an image).',
                log: 'AI failed: unsupported'
            },
            { answer: { ok: false, reason: 'send-failed', detail: 'boom' }, text: 'Could not reach Meta AI: boom.', log: 'AI failed: send-failed' },
            { answer: { ok: false, reason: 'unavailable' }, text: 'There was a technical problem with Meta AI. Try again later.', log: 'AI failed: unavailable' }
        ]
        for (const item of cases) {
            const flow = run({ answer: item.answer })
            await flow.done
            expect(flow.sends[1]).toEqual({ text: item.text, options: { quote, editKey: { id: 'M1' } } })
            expect(flow.logs).toContain(item.log)
        }
    })

    it('still answers when the placeholder cannot be sent', async () => {
        const answered = run({ failSends: [1, 2] })
        await answered.done
        expect(answered.asked).toEqual(['q'])
        expect(answered.sends[2]).toEqual({ text: 'The answer', options: { quote, customNodes: [LABEL] } })

        const failed = run({ failSends: [1, 2], answer: { ok: false, reason: 'no-answer' } })
        await failed.done
        expect(failed.sends[2]).toEqual({ text: 'Meta AI did not answer in time. Try again.', options: { quote } })
    })

    it('never logs the question or the answer', async () => {
        const flow = run({ question: 'secret question', answer: ok('secret answer') })
        await flow.done
        const log = flow.logs.join('\n')

        expect(log).not.toContain('secret question')
        expect(log).not.toContain('secret answer')
        expect(flow.logs.some((line) => /^AI answered in \d+\.\d s \(3 chunks, 13 chars, thread new\)$/.test(line))).toBe(true)

        const cut = run({ answer: { ok: true, text: 'cut', complete: false, chunks: 2, threadNew: false } })
        await cut.done
        expect(cut.logs.some((line) => /\(2 chunks, 3 chars, thread reused, cut short\)$/.test(line))).toBe(true)
    })
})
