import type { WaClient } from 'zapo-js'

import type { Runtime } from '../lib/client.js'
import type { Config } from '../lib/config.js'

export type SendContent = Parameters<WaClient['message']['send']>[1]

export type ExampleContext = {
    runtime: Runtime
    config: Config
    /** Chat the example is sent to (private or group). */
    chatJid: string
    log: (msg: string) => void
}

export type Example = {
    /** Command name without the slash, e.g. `buttons` for `/buttons`. */
    command: string
    title: string
    description: string
    /** Needs a WhatsApp Business account whose catalog products are in the store history. */
    requiresCatalog: boolean
    /** Sends the example to `ctx.chatJid` and returns the ids of the messages it sent. */
    send: (ctx: ExampleContext, args: readonly string[]) => Promise<readonly string[]>
}
