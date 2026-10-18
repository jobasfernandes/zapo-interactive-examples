import { afterEach, describe, expect, it, vi } from 'vitest'
import { createStore, type proto } from 'zapo-js'
import { parseSignalAddressFromJid, WA_BOT_KNOWN_JIDS } from 'zapo-js/protocol'

import {
    ANSWER_TIMEOUT_MS,
    createMetaAi,
    forgetBotSession,
    THREAD_IDLE_MS,
    type BotChunk,
    type MetaAiClient,
    type MetaAiOptions
} from '../src/lib/meta-ai.js'

type Sent = { to: string; content: Parameters<MetaAiClient['bot']['sendPrompt']>[1]; options: { aiThreadId: string; id: string } }

const snapshot = (text: string) => ({ richResponseMessage: { messageType: 1, submessages: [{ messageType: 2, messageText: text }] } }) as proto.IMessage
const edit = (text: string) => ({ protocolMessage: { type: 14, editedMessage: snapshot(text) } }) as proto.IMessage
const chunk = (target: string, editType: BotChunk['editType'], message: proto.IMessage): BotChunk => ({ targetMessageId: target, editType, message })
const flush = () => new Promise<void>((resolve) => setImmediate(resolve))

const WRAPPER = (systemPrompt: string, question: string) => `[Instructions for this whole conversation]\n${systemPrompt}\n[End of instructions]\n\n${question}`

/**
 * A `sendPrompt` that records the call, runs `onSend` (which may emit chunks or throw) and answers with the prompt id.
 * Meta AI only answers a prompt after it left, so a chunk emitted for one still waiting its turn is held until the send.
 */
function setup(options: MetaAiOptions = {}, onSend?: (sent: Sent) => void | Promise<void>) {
    const sent: Sent[] = []
    const held = new Map<string, BotChunk[]>()
    let listener: ((event: BotChunk) => void) | undefined
    const client: MetaAiClient = {
        bot: {
            sendPrompt: async (to, content, promptOptions) => {
                const record = { to, content, options: promptOptions }
                sent.push(record)
                for (const event of held.get(promptOptions.id) ?? []) listener?.(event)
                held.delete(promptOptions.id)
                await onSend?.(record)
                return { id: promptOptions.id }
            }
        },
        on: (_event, next) => {
            listener = next
        }
    }
    const emit = (event: BotChunk) => {
        if (sent.some((item) => item.options.id === event.targetMessageId)) listener?.(event)
        else held.set(event.targetMessageId, [...(held.get(event.targetMessageId) ?? []), event])
    }
    let threads = 0
    let prompts = 0
    const ai = createMetaAi(client, { newThreadId: () => `thread-${++threads}`, newPromptId: () => `PROMPT-${++prompts}`, ...options })
    // Reaches the router at once, like the chunks zapo emits for prompts typed on the phone, which this client never sent.
    const deliver = (event: BotChunk) => listener?.(event)
    return { ai, sent, emit, deliver }
}

afterEach(() => {
    vi.useRealTimers()
})

describe('createMetaAi', () => {
    it('sends the bare question with the thread and prompt ids and resolves with the last snapshot', async () => {
        const { ai, sent, emit } = setup()
        const pending = ai.ask('chat-a', 'capital of France?')
        emit(chunk('PROMPT-1', 'first', snapshot('Par')))
        emit(chunk('PROMPT-1', 'inner', edit('Paris is')))
        emit(chunk('PROMPT-1', 'last', edit('Paris is the capital.')))

        expect(await pending).toEqual({ ok: true, text: 'Paris is the capital.', complete: true, chunks: 3, threadNew: true })
        expect(sent[0]).toEqual({
            to: WA_BOT_KNOWN_JIDS.META_AI_FBID,
            content: 'capital of France?',
            options: { aiThreadId: 'thread-1', id: 'PROMPT-1' }
        })
    })

    it('puts the system prompt before the first question of a thread only', async () => {
        const { ai, sent, emit } = setup({ systemPrompt: 'Be brief.' })
        const first = ai.ask('chat-a', 'q1')
        emit(chunk('PROMPT-1', 'last', snapshot('a1')))
        await first
        const second = ai.ask('chat-a', 'q2')
        emit(chunk('PROMPT-2', 'last', snapshot('a2')))

        expect(await second).toMatchObject({ ok: true, threadNew: false })
        expect(sent.map((item) => item.content)).toEqual([WRAPPER('Be brief.', 'q1'), 'q2'])
        expect(sent[1]?.options.aiThreadId).toBe(sent[0]?.options.aiThreadId)
    })

    it('starts a new thread once a chat was idle for 30 minutes', async () => {
        let clock = 0
        const reuse = setup({ now: () => clock })
        const ask = async (target: ReturnType<typeof setup>, n: number) => {
            const pending = target.ai.ask('chat-a', 'q')
            target.emit(chunk(`PROMPT-${n}`, 'last', snapshot('a')))
            return pending
        }
        await ask(reuse, 1)
        clock = THREAD_IDLE_MS - 1
        await ask(reuse, 2)
        expect(reuse.sent[1]?.options.aiThreadId).toBe('thread-1')

        clock = 0
        const expire = setup({ now: () => clock, systemPrompt: 'Be brief.' })
        await ask(expire, 1)
        clock = THREAD_IDLE_MS
        expect(await ask(expire, 2)).toMatchObject({ ok: true, threadNew: true })
        expect(expire.sent[1]).toMatchObject({ content: WRAPPER('Be brief.', 'q'), options: { aiThreadId: 'thread-2' } })
    })

    it('measures the idle time from the last question, not from the first', async () => {
        let clock = 0
        const { ai, sent, emit } = setup({ now: () => clock })
        const ask = async (n: number) => {
            const pending = ai.ask('chat-a', 'q')
            emit(chunk(`PROMPT-${n}`, 'last', snapshot('a')))
            return pending
        }
        await ask(1)
        clock = THREAD_IDLE_MS - 1
        await ask(2)
        clock = 2 * THREAD_IDLE_MS - 2

        expect(await ask(3)).toMatchObject({ ok: true, threadNew: false })
        expect(sent.map((item) => item.options.aiThreadId)).toEqual(['thread-1', 'thread-1', 'thread-1'])
    })

    it('keeps one thread per chat', async () => {
        const { ai, sent, emit } = setup()
        const a = ai.ask('chat-a', 'qa')
        emit(chunk('PROMPT-1', 'last', snapshot('a')))
        await a
        const b = ai.ask('chat-b', 'qb')
        emit(chunk('PROMPT-2', 'last', snapshot('b')))
        await b

        expect(sent.map((item) => item.options.aiThreadId)).toEqual(['thread-1', 'thread-2'])
    })

    describe('with a photo', () => {
        const photo = { data: new Uint8Array([1, 2, 3]), mimetype: 'image/jpeg' }
        const captionOf = (content: Sent['content']) => (typeof content === 'string' ? content : content.caption)

        it('sends the photo with the question as its caption', async () => {
            const { ai, sent, emit } = setup()
            const pending = ai.ask('chat-a', 'what is this?', photo)
            emit(chunk('PROMPT-1', 'last', snapshot('a cat')))

            expect(await pending).toMatchObject({ ok: true, text: 'a cat' })
            expect(sent[0]?.content).toEqual({ type: 'image', media: photo.data, mimetype: 'image/jpeg', caption: 'what is this?' })
            expect(sent[0]?.options).toEqual({ aiThreadId: 'thread-1', id: 'PROMPT-1' })
        })

        it('puts the system prompt in the caption of the first question of a thread, and not of a follow-up', async () => {
            const { ai, sent, emit } = setup({ systemPrompt: 'Be brief.' })
            const first = ai.ask('chat-a', 'q1', photo)
            emit(chunk('PROMPT-1', 'last', snapshot('a1')))
            await first
            const second = ai.ask('chat-a', 'q2', photo)
            emit(chunk('PROMPT-2', 'last', snapshot('a2')))
            await second

            expect(sent.map((item) => captionOf(item.content))).toEqual([WRAPPER('Be brief.', 'q1'), 'q2'])
        })

        it('sends a text follow-up as a plain string on the same thread', async () => {
            const { ai, sent, emit } = setup()
            const first = ai.ask('chat-a', 'what is this?', photo)
            emit(chunk('PROMPT-1', 'last', snapshot('a cat')))
            await first
            const second = ai.ask('chat-a', 'and its color?')
            emit(chunk('PROMPT-2', 'last', snapshot('orange')))
            await second

            expect(sent[1]?.content).toBe('and its color?')
            expect(sent[1]?.options.aiThreadId).toBe(sent[0]?.options.aiThreadId)
        })

        it('reports a photo that cannot be sent like any failed send, and drops the thread', async () => {
            let calls = 0
            const { ai, emit } = setup({ systemPrompt: 'Be brief.' }, () => {
                calls += 1
                if (calls === 1) throw new Error('upload failed')
            })
            expect(await ai.ask('chat-a', 'q1', photo)).toEqual({ ok: false, reason: 'send-failed', detail: 'upload failed' })

            const next = ai.ask('chat-a', 'q2')
            emit(chunk('PROMPT-2', 'last', snapshot('a2')))
            expect(await next).toMatchObject({ ok: true, threadNew: true })
        })
    })

    it('ignores chunks of prompts it did not send', async () => {
        const { ai, emit, deliver } = setup()
        const pending = ai.ask('chat-a', 'q')
        let settled = false
        void pending.then(() => {
            settled = true
        })
        await flush()
        deliver(chunk('OTHER', 'last', snapshot('not mine')))
        await flush()
        expect(settled).toBe(false)

        emit(chunk('PROMPT-1', 'last', snapshot('mine')))
        expect(await pending).toMatchObject({ ok: true, text: 'mine' })
    })

    it('never lets a late chunk of a prompt it gave up on into the next answer', async () => {
        vi.useFakeTimers()
        const { ai, deliver } = setup()
        const silent = ai.ask('chat-a', 'q1')
        await vi.advanceTimersByTimeAsync(0)
        await vi.advanceTimersByTimeAsync(ANSWER_TIMEOUT_MS)
        expect(await silent).toEqual({ ok: false, reason: 'no-answer' })

        const next = ai.ask('chat-b', 'q2')
        await vi.advanceTimersByTimeAsync(0)
        deliver(chunk('PROMPT-1', 'last', snapshot('late answer to q1')))
        deliver(chunk('PROMPT-2', 'last', snapshot('answer to q2')))

        expect(await next).toEqual({ ok: true, text: 'answer to q2', complete: true, chunks: 1, threadNew: true })
    })

    it('keeps a chunk that arrives before sendPrompt resolves', async () => {
        let deliver: (event: BotChunk) => void = () => undefined
        const { ai, emit } = setup({}, () => {
            deliver(chunk('PROMPT-1', 'first', snapshot('Par')))
            deliver(chunk('PROMPT-1', 'last', snapshot('Paris')))
        })
        deliver = emit

        expect(await ai.ask('chat-a', 'q')).toEqual({ ok: true, text: 'Paris', complete: true, chunks: 2, threadNew: true })
    })

    it('sends the next question only after the previous one was answered, whatever the chat', async () => {
        const { ai, sent, emit } = setup()
        const a = ai.ask('chat-a', 'qa')
        const b = ai.ask('chat-b', 'qb')
        await flush()
        expect(sent.map((item) => item.content)).toEqual(['qa'])

        emit(chunk('PROMPT-1', 'first', snapshot('A1')))
        emit(chunk('PROMPT-1', 'last', edit('A12')))
        expect(await a).toEqual({ ok: true, text: 'A12', complete: true, chunks: 2, threadNew: true })
        await flush()
        expect(sent.map((item) => item.content)).toEqual(['qa', 'qb'])

        emit(chunk('PROMPT-2', 'last', snapshot('B1')))
        expect(await b).toEqual({ ok: true, text: 'B1', complete: true, chunks: 1, threadNew: true })
    })

    it('answers the questions in the order they arrived', async () => {
        const { ai, sent, emit } = setup()
        const answered: string[] = []
        const questions = ['q1', 'q2', 'q3'].map((question, index) =>
            ai.ask(`chat-${index}`, question).then(() => {
                answered.push(question)
            })
        )
        for (const n of [1, 2, 3]) {
            await flush()
            expect(sent).toHaveLength(n)
            emit(chunk(`PROMPT-${n}`, 'last', snapshot(`a${n}`)))
        }
        await Promise.all(questions)

        expect(answered).toEqual(['q1', 'q2', 'q3'])
        expect(sent.map((item) => item.content)).toEqual(['q1', 'q2', 'q3'])
    })

    it('does not count the wait in the queue against the timeout', async () => {
        vi.useFakeTimers()
        const { ai, emit } = setup({ timeoutMs: 1000 })
        const a = ai.ask('chat-a', 'qa')
        const b = ai.ask('chat-b', 'qb')
        await vi.advanceTimersByTimeAsync(900)
        emit(chunk('PROMPT-1', 'last', snapshot('A')))
        await a
        await vi.advanceTimersByTimeAsync(900)
        emit(chunk('PROMPT-2', 'last', snapshot('B')))

        expect(await b).toMatchObject({ ok: true, text: 'B' })
    })

    it('does not let a question that failed block the next one', async () => {
        let calls = 0
        const { ai, emit } = setup({}, () => {
            calls += 1
            if (calls === 1) throw new Error('boom')
        })
        const a = ai.ask('chat-a', 'qa')
        const b = ai.ask('chat-b', 'qb')
        expect(await a).toEqual({ ok: false, reason: 'send-failed', detail: 'boom' })
        await flush()
        emit(chunk('PROMPT-2', 'last', snapshot('B')))

        expect(await b).toMatchObject({ ok: true, text: 'B' })
    })

    it('reports unavailable for an error 488 and drops the thread', async () => {
        let calls = 0
        const { ai, emit } = setup({ systemPrompt: 'Be brief.' }, () => {
            calls += 1
            if (calls === 1) throw new Error('negative publish ack: tag=ack id=3EB0AAAA class=message error=488')
        })
        expect(await ai.ask('chat-a', 'q1')).toEqual({ ok: false, reason: 'unavailable' })

        const next = ai.ask('chat-a', 'q2')
        emit(chunk('PROMPT-2', 'last', snapshot('a2')))
        expect(await next).toMatchObject({ ok: true, threadNew: true })
    })

    it('keeps the raw detail for any other refusal', async () => {
        const nack = 'negative publish ack: tag=ack id=3EB0488AAA class=message error=479'
        const { ai } = setup({}, () => {
            throw new Error(nack)
        })

        expect(await ai.ask('chat-a', 'q')).toEqual({ ok: false, reason: 'send-failed', detail: nack })
    })

    it('keeps serving the others when one question blows up unexpectedly', async () => {
        let calls = 0
        const { ai, emit } = setup({
            newPromptId: () => {
                calls += 1
                if (calls === 1) throw new Error('boom')
                return 'PROMPT-2'
            }
        })
        const broken = ai.ask('chat-a', 'q1')
        const next = ai.ask('chat-b', 'q2')
        await expect(broken).rejects.toThrow('boom')
        emit(chunk('PROMPT-2', 'last', snapshot('B')))

        expect(await next).toMatchObject({ ok: true, text: 'B' })
    })

    it('gives up on a silent prompt after 35 seconds', async () => {
        vi.useFakeTimers()
        const { ai } = setup()
        let settled = false
        const pending = ai.ask('chat-a', 'q').then((answer) => {
            settled = true
            return answer
        })
        await vi.advanceTimersByTimeAsync(0)
        await vi.advanceTimersByTimeAsync(34_999)
        expect(settled).toBe(false)
        await vi.advanceTimersByTimeAsync(1)

        expect(await pending).toEqual({ ok: false, reason: 'no-answer' })
    })

    it('starts the new thread at its turn for a question queued behind a silent one of the same chat', async () => {
        vi.useFakeTimers()
        const events: string[] = []
        const { ai, sent, emit } = setup(
            {
                systemPrompt: 'Be brief.',
                resetSession: async () => {
                    events.push('reset')
                }
            },
            () => {
                events.push('send')
            }
        )
        const silent = ai.ask('chat-a', 'q1')
        const retyped = ai.ask('chat-a', 'q1 again')
        await vi.advanceTimersByTimeAsync(0)
        await vi.advanceTimersByTimeAsync(ANSWER_TIMEOUT_MS)
        expect(await silent).toEqual({ ok: false, reason: 'no-answer' })
        await vi.advanceTimersByTimeAsync(0)
        emit(chunk('PROMPT-2', 'last', snapshot('a')))

        expect(await retyped).toMatchObject({ ok: true, threadNew: true })
        expect(sent[1]).toMatchObject({ content: WRAPPER('Be brief.', 'q1 again'), options: { aiThreadId: 'thread-2' } })
        expect(events).toEqual(['reset', 'send', 'reset', 'send'])
    })

    it('carries the system prompt for a question queued behind a failed send of the same chat', async () => {
        let calls = 0
        const { ai, sent, emit } = setup({ systemPrompt: 'Be brief.' }, () => {
            calls += 1
            if (calls === 1) throw new Error('boom')
        })
        const failed = ai.ask('chat-a', 'q1')
        const queued = ai.ask('chat-a', 'q2')
        expect(await failed).toMatchObject({ ok: false, reason: 'send-failed' })
        await flush()
        emit(chunk('PROMPT-2', 'last', snapshot('a2')))

        expect(await queued).toMatchObject({ ok: true, threadNew: true })
        expect(sent[1]?.content).toBe(WRAPPER('Be brief.', 'q2'))
    })

    it('delivers the partial snapshot with a note when the last chunk never comes', async () => {
        vi.useFakeTimers()
        const { ai, emit } = setup()
        const normal = ai.ask('chat-a', 'q0')
        emit(chunk('PROMPT-1', 'last', snapshot('done')))
        await normal
        expect(vi.getTimerCount()).toBe(0)

        const pending = ai.ask('chat-b', 'q')
        emit(chunk('PROMPT-2', 'first', snapshot('Par')))
        emit(chunk('PROMPT-2', 'inner', edit('Paris is')))
        await vi.advanceTimersByTimeAsync(0)
        await vi.advanceTimersByTimeAsync(ANSWER_TIMEOUT_MS)

        expect(await pending).toEqual({
            ok: true,
            text: 'Paris is\n\n(The answer was cut short: Meta AI stopped before finishing.)',
            complete: false,
            chunks: 2,
            threadNew: true
        })
        expect(vi.getTimerCount()).toBe(0)
    })

    it('starts the answer clock when the send resolves, not before', async () => {
        vi.useFakeTimers()
        let release: () => void = () => undefined
        const gate = new Promise<void>((resolve) => {
            release = resolve
        })
        const { ai, emit } = setup({}, () => gate)
        const pending = ai.ask('chat-a', 'q')
        await vi.advanceTimersByTimeAsync(ANSWER_TIMEOUT_MS)
        release()
        await vi.advanceTimersByTimeAsync(0)
        emit(chunk('PROMPT-1', 'last', snapshot('Paris')))

        expect(await pending).toEqual({ ok: true, text: 'Paris', complete: true, chunks: 1, threadNew: true })
    })

    it('reports no answer when nothing arrives in time', async () => {
        vi.useFakeTimers()
        const { ai, emit } = setup()
        const pending = ai.ask('chat-a', 'q')
        await vi.advanceTimersByTimeAsync(0)
        await vi.advanceTimersByTimeAsync(ANSWER_TIMEOUT_MS)

        expect(await pending).toEqual({ ok: false, reason: 'no-answer' })
        expect(vi.getTimerCount()).toBe(0)
        expect(() => emit(chunk('PROMPT-1', 'last', snapshot('too late')))).not.toThrow()
    })

    it('reports no answer, not unsupported, when it times out holding only parts it cannot show', async () => {
        vi.useFakeTimers()
        const { ai, emit } = setup()
        const pending = ai.ask('chat-a', 'q')
        emit(chunk('PROMPT-1', 'first', { richResponseMessage: { messageType: 1, submessages: [{ messageType: 3 }] } } as proto.IMessage))
        await vi.advanceTimersByTimeAsync(0)
        await vi.advanceTimersByTimeAsync(ANSWER_TIMEOUT_MS)

        expect(await pending).toEqual({ ok: false, reason: 'no-answer' })
    })

    it('keeps the thread after a timeout whose chunks held nothing it can show', async () => {
        vi.useFakeTimers()
        const { ai, emit } = setup()
        const first = ai.ask('chat-a', 'q1')
        emit(chunk('PROMPT-1', 'first', { richResponseMessage: { messageType: 1, submessages: [{ messageType: 3 }] } } as proto.IMessage))
        await vi.advanceTimersByTimeAsync(0)
        await vi.advanceTimersByTimeAsync(ANSWER_TIMEOUT_MS)
        expect(await first).toEqual({ ok: false, reason: 'no-answer' })

        const next = ai.ask('chat-a', 'q2')
        emit(chunk('PROMPT-2', 'last', snapshot('a2')))

        expect(await next).toMatchObject({ ok: true, threadNew: false })
    })

    it('treats a full chunk as the whole answer', async () => {
        const { ai, emit } = setup()
        const pending = ai.ask('chat-a', 'q')
        emit(chunk('PROMPT-1', 'full', snapshot('Whole answer.')))

        expect(await pending).toEqual({ ok: true, text: 'Whole answer.', complete: true, chunks: 1, threadNew: true })
    })

    it('adds the skipped note, or reports unsupported when nothing else is left', async () => {
        const withImage = {
            richResponseMessage: { messageType: 1, submessages: [{ messageType: 2, messageText: 'Here:' }, { messageType: 3 }] }
        } as proto.IMessage
        const onlyImage = { richResponseMessage: { messageType: 1, submessages: [{ messageType: 3 }] } } as proto.IMessage
        const { ai, emit } = setup()
        const mixed = ai.ask('chat-a', 'q')
        emit(chunk('PROMPT-1', 'last', withImage))
        expect(await mixed).toEqual({ ok: true, text: 'Here:\n\n(Some parts of the answer cannot be shown here.)', complete: true, chunks: 1, threadNew: true })

        const bare = ai.ask('chat-b', 'q')
        emit(chunk('PROMPT-2', 'last', onlyImage))
        expect(await bare).toEqual({ ok: false, reason: 'unsupported' })
    })

    it('counts an answer with nothing to show and nothing skipped as no answer', async () => {
        const { ai, emit } = setup()
        const pending = ai.ask('chat-a', 'q')
        emit(chunk('PROMPT-1', 'last', snapshot('')))

        expect(await pending).toEqual({ ok: false, reason: 'no-answer' })
    })

    it('reports a failed send and drops the thread', async () => {
        let calls = 0
        const { ai, sent, emit } = setup({ systemPrompt: 'Be brief.' }, () => {
            calls += 1
            if (calls === 1) throw new Error('boom')
        })
        expect(await ai.ask('chat-a', 'q1')).toEqual({ ok: false, reason: 'send-failed', detail: 'boom' })

        const next = ai.ask('chat-a', 'q2')
        emit(chunk('PROMPT-2', 'last', snapshot('a2')))
        expect(await next).toMatchObject({ ok: true, threadNew: true })
        expect(sent[1]).toMatchObject({ content: WRAPPER('Be brief.', 'q2'), options: { aiThreadId: 'thread-2' } })
    })

    it('with two first questions at once only the first carries the system prompt', async () => {
        const { ai, sent, emit } = setup({ systemPrompt: 'Be brief.' })
        const first = ai.ask('chat-a', 'q1')
        const second = ai.ask('chat-a', 'q2')
        emit(chunk('PROMPT-1', 'last', snapshot('a1')))
        await first
        await flush()
        emit(chunk('PROMPT-2', 'last', snapshot('a2')))
        await second

        expect(sent.map((item) => item.content)).toEqual([WRAPPER('Be brief.', 'q1'), 'q2'])
        expect(sent[1]?.options.aiThreadId).toBe(sent[0]?.options.aiThreadId)
    })

    it('ignores a repeated last chunk after the answer was delivered', async () => {
        const { ai, emit } = setup()
        const pending = ai.ask('chat-a', 'q')
        emit(chunk('PROMPT-1', 'last', snapshot('Paris')))
        const answer = await pending

        expect(() => emit(chunk('PROMPT-1', 'last', snapshot('Paris again')))).not.toThrow()
        expect(answer).toEqual({ ok: true, text: 'Paris', complete: true, chunks: 1, threadNew: true })
    })
})

// Meta AI loses its side of the Signal session now and then; our stale copy then encrypts prompts it cannot read and
// nothing ever answers (docs/gotchas.md #21). A new thread starts on a fresh session.
describe('the session with Meta AI', () => {
    it('is forgotten before the first prompt of a new thread', async () => {
        const events: string[] = []
        const { ai, emit } = setup(
            {
                resetSession: async () => {
                    events.push('reset')
                }
            },
            () => {
                events.push('send')
            }
        )
        const pending = ai.ask('chat-a', 'q')
        emit(chunk('PROMPT-1', 'last', snapshot('a')))
        await pending

        expect(events).toEqual(['reset', 'send'])
    })

    it('is kept for a follow-up in a live thread', async () => {
        let resets = 0
        const { ai, emit } = setup({
            resetSession: async () => {
                resets += 1
            }
        })
        const first = ai.ask('chat-a', 'q1')
        emit(chunk('PROMPT-1', 'last', snapshot('a1')))
        await first
        const second = ai.ask('chat-a', 'q2')
        emit(chunk('PROMPT-2', 'last', snapshot('a2')))
        await second

        expect(resets).toBe(1)
    })

    it('is forgotten again when the thread of a chat expired after 30 idle minutes', async () => {
        let clock = 0
        const events: string[] = []
        const { ai, emit } = setup(
            {
                now: () => clock,
                resetSession: async () => {
                    events.push('reset')
                }
            },
            () => {
                events.push('send')
            }
        )
        const first = ai.ask('chat-a', 'q1')
        await flush()
        emit(chunk('PROMPT-1', 'last', snapshot('a1')))
        await first
        clock = THREAD_IDLE_MS
        const second = ai.ask('chat-a', 'q2')
        await flush()
        emit(chunk('PROMPT-2', 'last', snapshot('a2')))

        expect(await second).toMatchObject({ ok: true, threadNew: true })
        expect(events).toEqual(['reset', 'send', 'reset', 'send'])
    })

    it('is forgotten for each new thread, never while an answer is streaming', async () => {
        const events: string[] = []
        const { ai, emit } = setup(
            {
                resetSession: async () => {
                    events.push('reset')
                }
            },
            () => {
                events.push('send')
            }
        )
        const a = ai.ask('chat-a', 'qa')
        const b = ai.ask('chat-b', 'qb')
        await flush()
        expect(events).toEqual(['reset', 'send'])

        emit(chunk('PROMPT-1', 'last', snapshot('a')))
        await a
        await flush()
        emit(chunk('PROMPT-2', 'last', snapshot('b')))
        await b

        expect(events).toEqual(['reset', 'send', 'reset', 'send'])
    })

    it('holds the prompt until the reset is done', async () => {
        let release: () => void = () => undefined
        const gate = new Promise<void>((resolve) => {
            release = resolve
        })
        const { ai, sent, emit } = setup({
            resetSession: async () => {
                await gate
            }
        })
        const pending = ai.ask('chat-a', 'q1')
        await flush()
        expect(sent).toHaveLength(0)

        release()
        emit(chunk('PROMPT-1', 'last', snapshot('a1')))

        expect(await pending).toMatchObject({ ok: true })
        expect(sent.map((item) => item.content)).toEqual(['q1'])
    })

    it('starts over after a timeout that brought no chunk', async () => {
        vi.useFakeTimers()
        let resets = 0
        const { ai, sent, emit } = setup({
            systemPrompt: 'Be brief.',
            resetSession: async () => {
                resets += 1
            }
        })
        const silent = ai.ask('chat-a', 'q1')
        await vi.advanceTimersByTimeAsync(0)
        await vi.advanceTimersByTimeAsync(ANSWER_TIMEOUT_MS)
        expect(await silent).toEqual({ ok: false, reason: 'no-answer' })

        const retry = ai.ask('chat-a', 'q2')
        emit(chunk('PROMPT-2', 'last', snapshot('a2')))

        expect(await retry).toMatchObject({ ok: true, threadNew: true })
        expect(sent[1]).toMatchObject({ content: WRAPPER('Be brief.', 'q2'), options: { aiThreadId: 'thread-2' } })
        expect(resets).toBe(2)
    })

    it('keeps the thread after a timeout that brought some chunks', async () => {
        vi.useFakeTimers()
        const { ai, emit } = setup()
        const partial = ai.ask('chat-a', 'q1')
        emit(chunk('PROMPT-1', 'first', snapshot('Par')))
        await vi.advanceTimersByTimeAsync(0)
        await vi.advanceTimersByTimeAsync(ANSWER_TIMEOUT_MS)
        expect(await partial).toMatchObject({ ok: true, complete: false })

        const next = ai.ask('chat-a', 'q2')
        emit(chunk('PROMPT-2', 'last', snapshot('a2')))

        expect(await next).toMatchObject({ ok: true, threadNew: false })
    })

    it('does not stop the question when the reset fails', async () => {
        const { ai, emit } = setup({
            resetSession: async () => {
                throw new Error('database is locked')
            }
        })
        const pending = ai.ask('chat-a', 'q')
        emit(chunk('PROMPT-1', 'last', snapshot('Paris')))

        expect(await pending).toMatchObject({ ok: true, text: 'Paris' })
    })

    it('tells the caller when the reset fails, and still sends the prompt', async () => {
        const failure = new Error('database is locked')
        const reported: unknown[] = []
        const { ai, sent, emit } = setup({
            resetSession: async () => {
                throw failure
            },
            onResetError: (error) => {
                reported.push(error)
            }
        })
        const pending = ai.ask('chat-a', 'q')
        emit(chunk('PROMPT-1', 'last', snapshot('Paris')))

        expect(await pending).toMatchObject({ ok: true, text: 'Paris' })
        expect(reported).toEqual([failure])
        expect(sent).toHaveLength(1)
    })

    it('tells the caller when the reset throws before returning a promise', async () => {
        const failure = new Error('no such session store')
        const reported: unknown[] = []
        const { ai, emit } = setup({
            resetSession: () => {
                throw failure
            },
            onResetError: (error) => {
                reported.push(error)
            }
        })
        const pending = ai.ask('chat-a', 'q')
        emit(chunk('PROMPT-1', 'last', snapshot('Paris')))

        expect(await pending).toMatchObject({ ok: true, text: 'Paris' })
        expect(reported).toEqual([failure])
    })
})

describe('forgetBotSession', () => {
    it('drops the session with Meta AI and no other', async () => {
        const store = createStore({})
        const { session } = store.session('test')
        const bot = parseSignalAddressFromJid(WA_BOT_KNOWN_JIDS.META_AI_FBID)
        const friend = { user: '5511999999999', server: 's.whatsapp.net', device: 0 }
        // The memory store keeps whatever record it is given, which is all this test needs.
        await session.setSession(bot, { stub: true } as never)
        await session.setSession(friend, { stub: true } as never)

        await forgetBotSession(store, 'test')

        expect(await session.hasSession(bot)).toBe(false)
        expect(await session.hasSession(friend)).toBe(true)
        await store.destroy()
    })
})
