import { randomUUID } from 'node:crypto'

import type { WaIncomingBotChunkEvent, WaStore } from 'zapo-js'
import { parseSignalAddressFromJid, WA_BOT_KNOWN_JIDS } from 'zapo-js/protocol'

import { renderAnswer, type RenderedAnswer } from './meta-ai-render.js'
import { newMessageId } from './native-flow-name.js'

export const THREAD_IDLE_MS = 30 * 60 * 1000
export const ANSWER_TIMEOUT_MS = 35_000
export const SKIPPED_NOTE = '(Some parts of the answer cannot be shown here.)'
export const CUT_SHORT_NOTE = '(The answer was cut short: Meta AI stopped before finishing.)'

export type BotChunk = Pick<WaIncomingBotChunkEvent, 'targetMessageId' | 'editType' | 'message'>

/** The two pieces of `WaClient` the router uses, so tests can stand in for it. */
/** A photo that goes along with the question, as the caption of the prompt. */
export type MetaAiImage = { data: Uint8Array; mimetype: string }

export type MetaAiClient = {
    bot: {
        sendPrompt: (
            to: string,
            content: string | { type: 'image'; media: Uint8Array; mimetype: string; caption: string },
            options: { aiThreadId: string; id: string }
        ) => Promise<{ id: string }>
    }
    on: (event: 'message_bot_chunk', listener: (event: BotChunk) => void) => unknown
}

export type MetaAiAnswer =
    | { ok: true; text: string; complete: boolean; chunks: number; threadNew: boolean }
    | { ok: false; reason: 'no-answer' | 'unsupported' | 'unavailable' }
    | { ok: false; reason: 'send-failed'; detail: string }

export type MetaAiOptions = {
    systemPrompt?: string
    now?: () => number
    newThreadId?: () => string
    newPromptId?: () => string
    timeoutMs?: number
    /**
     * Forgets the Signal session with Meta AI. Meta AI loses its side of it now and then; our stale copy then keeps
     * encrypting prompts it cannot read, it asks for a retry that zapo cannot serve, and nothing ever answers
     * (docs/gotchas.md #21). A new thread starts on a fresh session.
     */
    resetSession?: () => Promise<void>
    /** A reset that fails never stops the question; this is where the caller hears about it, since the self-healing then stops silently. */
    onResetError?: (error: unknown) => void
}

/** Drops the Signal session with Meta AI, so the next prompt builds a new one. */
export function forgetBotSession(store: WaStore, sessionId: string): Promise<void> {
    return store.session(sessionId).session.deleteSession(parseSignalAddressFromJid(WA_BOT_KNOWN_JIDS.META_AI_FBID))
}

type Thread = { id: string; lastUsedAt: number }

type Pending = {
    latest: RenderedAnswer
    chunks: number
    finished: boolean
    done: Promise<void>
    finish: () => void
}

function createPending(): Pending {
    let finish: () => void = () => undefined
    const done = new Promise<void>((resolve) => {
        finish = resolve
    })
    return { latest: { text: '', skipped: false }, chunks: 0, finished: false, done, finish }
}

// Meta AI has no system field, so the instructions travel as the start of the first question.
function withSystemPrompt(systemPrompt: string, question: string): string {
    return `[Instructions for this whole conversation]\n${systemPrompt}\n[End of instructions]\n\n${question}`
}

function toAnswer(pending: Pending, complete: boolean, threadNew: boolean): MetaAiAnswer {
    const { text, skipped } = pending.latest
    if (!text) return complete && skipped ? { ok: false, reason: 'unsupported' } : { ok: false, reason: 'no-answer' }
    const notes = [skipped ? SKIPPED_NOTE : undefined, complete ? undefined : CUT_SHORT_NOTE]
    const full = [text, ...notes].filter((part): part is string => part !== undefined).join('\n\n')
    return { ok: true, text: full, complete, chunks: pending.chunks, threadNew }
}

/**
 * Relays questions to Meta AI and puts the streamed answer back together. One conversation (thread) per
 * chat, dropped after THREAD_IDLE_MS without questions. One question at a time for the whole bot, first come
 * first served, as whatsrook does: the next prompt goes out only once the previous one was answered or gave up.
 */
export function createMetaAi(
    client: MetaAiClient,
    options: MetaAiOptions = {}
): { ask: (chatJid: string, question: string, image?: MetaAiImage) => Promise<MetaAiAnswer> } {
    const { systemPrompt, now = Date.now, newThreadId = randomUUID, newPromptId = newMessageId, timeoutMs = ANSWER_TIMEOUT_MS, resetSession, onResetError } = options
    const threads = new Map<string, Thread>()
    // Keyed by prompt id: every chunk of an answer carries it as its target, so a late chunk of a prompt already given up on finds nothing.
    const pending = new Map<string, Pending>()
    let queue: Promise<unknown> = Promise.resolve()

    client.on('message_bot_chunk', (event) => {
        const entry = pending.get(event.targetMessageId)
        if (!entry || entry.finished) return
        // Every chunk after the first is a snapshot of the whole answer so far, not a piece to append.
        entry.latest = renderAnswer(event.message)
        entry.chunks += 1
        if (event.editType === 'last' || event.editType === 'full') {
            entry.finished = true
            entry.finish()
        }
    })

    async function run(chatJid: string, question: string, image?: MetaAiImage): Promise<MetaAiAnswer> {
        const at = now()
        const known = threads.get(chatJid)
        const reused = known !== undefined && at - known.lastUsedAt < THREAD_IDLE_MS ? known : undefined
        const thread = reused ?? { id: newThreadId(), lastUsedAt: at }
        thread.lastUsedAt = at
        threads.set(chatJid, thread)
        const threadNew = reused === undefined
        const text = threadNew && systemPrompt ? withSystemPrompt(systemPrompt, question) : question
        const content = image ? { type: 'image' as const, media: image.data, mimetype: image.mimetype, caption: text } : text

        // Registered before the send: a chunk can arrive before sendPrompt resolves.
        const promptId = newPromptId()
        const entry = createPending()
        pending.set(promptId, entry)
        try {
            if (threadNew && resetSession) {
                await Promise.resolve()
                    .then(resetSession)
                    .catch((error: unknown) => onResetError?.(error))
            }
            await client.bot.sendPrompt(WA_BOT_KNOWN_JIDS.META_AI_FBID, content, { aiThreadId: thread.id, id: promptId })
        } catch (error) {
            pending.delete(promptId)
            // A thread that never got its first prompt must not count as started: the system prompt would be lost.
            threads.delete(chatJid)
            const detail = error instanceof Error ? error.message : String(error)
            // 488 is the server saying this account cannot use Meta AI; the raw ack means nothing to whoever asked.
            return /\berror=488\b/.test(detail) ? { ok: false, reason: 'unavailable' } : { ok: false, reason: 'send-failed', detail }
        }

        let timer: ReturnType<typeof setTimeout> | undefined
        const timedOut = new Promise<false>((resolve) => {
            timer = setTimeout(() => resolve(false), timeoutMs)
        })
        try {
            const complete = await Promise.race([entry.done.then(() => true as const), timedOut])
            const answer = toAnswer(entry, complete, threadNew)
            // Not one chunk came back, so the session is probably stale again: the next question starts a new thread.
            if (entry.chunks === 0) threads.delete(chatJid)
            return answer
        } finally {
            clearTimeout(timer)
            pending.delete(promptId)
        }
    }

    function ask(chatJid: string, question: string, image?: MetaAiImage): Promise<MetaAiAnswer> {
        const turn = queue.then(() => run(chatJid, question, image))
        // One chain serves the whole bot: a question that blows up must not stop the ones behind it.
        queue = turn.catch(() => undefined)
        return turn
    }

    return { ask }
}
