import { mkdir } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { dirname, resolve } from 'node:path'

import {
    createSqliteStore,
    openSqliteConnection,
    type WaSqliteConnection,
    type WaSqliteStoreResult
} from '@zapo-js/store-sqlite'
import { ConsoleLogger, createStore, delay, toUserJid, WaClient } from 'zapo-js'

import type { Config } from './config.js'
import { installNativeFlowRewrite } from './native-flow-name.js'

const require = createRequire(import.meta.url)
const qrcode = require('qrcode-terminal') as { generate: (text: string, opts: { small: boolean }) => void }

const MAX_RECONNECT_ATTEMPTS = 10

export type Runtime = {
    client: WaClient
    sqlite: WaSqliteStoreResult
    /** Same connection the stores use; for read-only queries the store API does not offer. */
    connection: WaSqliteConnection
    sessionId: string
    armNativeFlow: (messageId: string, attrs: Record<string, string>) => void
}

export async function createRuntime(config: Config): Promise<Runtime> {
    const authPath = resolve(process.cwd(), config.authPath)
    await mkdir(dirname(authPath), { recursive: true })
    const connection = await openSqliteConnection({ path: authPath, driver: 'auto', sessionId: config.sessionId })
    const sqlite = createSqliteStore({ connection })
    const store = createStore({
        backends: { sqlite },
        providers: {
            auth: 'sqlite',
            signal: 'sqlite',
            preKey: 'sqlite',
            session: 'sqlite',
            identity: 'sqlite',
            senderKey: 'sqlite',
            appState: 'sqlite',
            privacyToken: 'sqlite',
            messages: 'sqlite',
            threads: 'sqlite',
            contacts: 'sqlite'
        }
    })
    const client = new WaClient({ store, sessionId: config.sessionId }, new ConsoleLogger(config.logLevel))
    return { client, sqlite, connection, sessionId: config.sessionId, armNativeFlow: installNativeFlowRewrite(client) }
}

/** Connects (showing the pairing QR when needed) and resolves on the first open connection. */
export function connectAndWait(runtime: Runtime): Promise<void> {
    const { client } = runtime
    let attempt = 0
    let opened = false

    return new Promise((resolveOpen, rejectOpen) => {
        async function reconnect(): Promise<void> {
            if (attempt >= MAX_RECONNECT_ATTEMPTS) {
                const error = new Error(`giving up after ${attempt} reconnect attempts`)
                if (!opened) rejectOpen(error)
                else console.error(`[connection] ${error.message}`)
                return
            }
            const waitMs = Math.min(30_000, 1_000 * 2 ** attempt)
            attempt += 1
            console.log(`[connection] reconnect ${attempt} in ${waitMs}ms`)
            await delay(waitMs)
            client.connect().catch(() => void reconnect())
        }

        client.on('auth_qr', ({ qr, ttlMs }) => {
            console.log(`\n[pairing] scan within ${Math.round(ttlMs / 1000)}s (WhatsApp > Linked devices):\n`)
            qrcode.generate(qr, { small: true })
        })
        client.on('connection', (event) => {
            if (event.status === 'open') {
                attempt = 0
                if (!opened) {
                    opened = true
                    resolveOpen()
                }
                return
            }
            if (event.isLogout) {
                const error = new Error('device unlinked; delete the session file in AUTH_PATH and pair again')
                if (!opened) rejectOpen(error)
                else console.error(`[connection] ${error.message}`)
                return
            }
            console.log(`[connection] closed: ${event.reason} (code=${event.code})`)
            // Our own disconnect() (CLI exit, shutdown) must not bring the socket back.
            if (event.reason === 'client_disconnected') return
            void reconnect()
        })
        client.connect().catch(rejectOpen)
    })
}

/** The paired account's own user jids, without the `:device` suffix. */
export function ownJids(runtime: Runtime): { pn?: string; lid?: string } {
    const credentials = runtime.client.getCredentials()
    return {
        pn: credentials?.meJid ? toUserJid(credentials.meJid) : undefined,
        lid: credentials?.meLid ? toUserJid(credentials.meLid) : undefined
    }
}
