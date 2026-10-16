import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { afterEach, describe, expect, it, vi } from 'vitest'

import { installHostedPrivacyMode } from '../src/lib/biz-privacy.js'
import { connectAndWait, createRuntime, type Runtime } from '../src/lib/client.js'
import { parseConfig } from '../src/lib/config.js'

vi.mock('../src/lib/biz-privacy.js', () => ({ installHostedPrivacyMode: vi.fn() }))

type Handler = (event: Record<string, unknown>) => void

function fakeRuntime() {
    const handlers = new Map<string, Handler>()
    const connect = vi.fn(async () => undefined)
    const client = { on: (event: string, handler: Handler) => handlers.set(event, handler), connect }
    return { runtime: { client } as unknown as Runtime, handlers, connect }
}

afterEach(() => {
    vi.useRealTimers()
})

describe('connectAndWait', () => {
    it('does not reconnect after an intentional disconnect', async () => {
        vi.useFakeTimers()
        const { runtime, handlers, connect } = fakeRuntime()
        const opened = connectAndWait(runtime)
        handlers.get('connection')?.({ status: 'open' })
        await opened

        handlers.get('connection')?.({ status: 'close', reason: 'client_disconnected', code: null, isLogout: false })
        await vi.advanceTimersByTimeAsync(5_000)

        expect(connect).toHaveBeenCalledTimes(1)
    })

    it('stops instead of fighting another process that took over the session', async () => {
        vi.useFakeTimers()
        const { runtime, handlers, connect } = fakeRuntime()
        const opened = connectAndWait(runtime)
        handlers.get('connection')?.({ status: 'open' })
        await opened

        handlers.get('connection')?.({ status: 'close', reason: 'stream_error_replaced', code: null, isLogout: false })
        await vi.advanceTimersByTimeAsync(5_000)

        expect(connect).toHaveBeenCalledTimes(1)
    })

    it('reconnects after an unexpected close', async () => {
        vi.useFakeTimers()
        const { runtime, handlers, connect } = fakeRuntime()
        const opened = connectAndWait(runtime)
        handlers.get('connection')?.({ status: 'open' })
        await opened

        handlers.get('connection')?.({ status: 'close', reason: 'stream_error', code: 503, isLogout: false })
        await vi.advanceTimersByTimeAsync(5_000)

        expect(connect).toHaveBeenCalledTimes(2)
    })
})

describe('createRuntime', () => {
    async function createAndClose(env: Record<string, string>): Promise<void> {
        const dir = mkdtempSync(join(tmpdir(), 'zapo-examples-'))
        try {
            const runtime = await createRuntime(parseConfig({ AUTH_PATH: join(dir, 'session.sqlite'), ...env }))
            runtime.connection.close()
        } finally {
            rmSync(dir, { recursive: true, force: true })
        }
    }

    // The banner changes state on the contact's device for good, so off must really mean off.
    it('stamps the Meta-hosted privacy mode only when META_HOSTED_BANNER is true', async () => {
        await createAndClose({})
        expect(installHostedPrivacyMode).not.toHaveBeenCalled()

        await createAndClose({ META_HOSTED_BANNER: 'true' })
        expect(installHostedPrivacyMode).toHaveBeenCalledTimes(1)
    })
})
