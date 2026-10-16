import { afterEach, describe, expect, it, vi } from 'vitest'

import { connectAndWait, type Runtime } from '../src/lib/client.js'

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
