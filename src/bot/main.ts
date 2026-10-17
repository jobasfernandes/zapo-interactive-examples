/**
 * The test bot: `npm start`, pair with the QR on first run, then send `/menu` or
 * `/help` from an allowed chat. Every example is sent back to the chat the command
 * came from. See README.md for the access rules.
 */
import type { WaIncomingMessageEvent } from 'zapo-js'

import { groupStatusExample } from '../examples/group-status.js'
import { EXAMPLES } from '../examples/index.js'
import { buildMenu, HELP_TEXT } from '../examples/menu.js'
import { replyToOrder } from '../examples/order.js'
import type { ExampleContext, SendContent } from '../examples/types.js'
import { connectAndWait, createRuntime, ownJids } from '../lib/client.js'
import { loadConfig } from '../lib/config.js'
import { createLogger, formatResponse } from '../lib/log.js'
import { chatContext, decide, groupStatusFailureReply, isStale } from './handle.js'

const config = loadConfig()
const runtime = await createRuntime(config)
const { log } = createLogger('bot')
const sentByBot = new Set<string>()

async function reply(chatJid: string, content: SendContent): Promise<void> {
    const result = await runtime.client.message.send(chatJid, content)
    sentByBot.add(result.id)
}

async function handle(event: WaIncomingMessageEvent, startedAtSeconds: number): Promise<void> {
    if (isStale(event, startedAtSeconds)) return
    const ctx = chatContext(event.key, ownJids(runtime))
    const action = decide(event, ctx, config, sentByBot)
    if (action.kind === 'ignore') return
    log(`${action.kind.toUpperCase()} chat=${ctx.chatJid} from=${ctx.fromMe ? 'owner' : (ctx.senderPn ?? ctx.senderLid)}`)
    // Not allowed: logged above (check ALLOWED_NUMBERS / ALLOWED_GROUPS), never answered.
    if (action.kind === 'denied') return

    const exampleContext: ExampleContext = { runtime, config, chatJid: ctx.chatJid, log }
    switch (action.kind) {
        case 'menu':
            return reply(ctx.chatJid, buildMenu(EXAMPLES))
        case 'help':
            return reply(ctx.chatJid, HELP_TEXT(EXAMPLES))
        case 'groups': {
            const groups = await runtime.client.group.queryAllGroups()
            const lines = groups.map((group) => `• ${group.subject}: ${group.jid}`)
            return reply(ctx.chatJid, lines.length > 0 ? lines.join('\n') : 'This account is in no groups.')
        }
        case 'example': {
            const ids = await action.example.send(exampleContext, action.args)
            ids.forEach((id) => sentByBot.add(id))
            return
        }
        case 'order': {
            const ids = await replyToOrder(exampleContext, action.order, { id: event.key.id ?? '', remoteJid: ctx.chatJid })
            ids.forEach((id) => sentByBot.add(id))
            return
        }
        case 'response':
            log(formatResponse(ctx.chatJid, event.key.participant, action.name, action.paramsJson))
            return
        case 'reply':
            return reply(ctx.chatJid, action.text)
        case 'group-status': {
            // The status lands in another chat, so the one that asked always gets an answer.
            try {
                const ids = await groupStatusExample.send({ ...exampleContext, chatJid: action.groupJid }, [])
                ids.forEach((id) => sentByBot.add(id))
                return reply(ctx.chatJid, `Group status posted to ${action.groupJid}.`)
            } catch (error) {
                log(`ERROR group-status ${action.groupJid}: ${error instanceof Error ? error.message : String(error)}`)
                return reply(ctx.chatJid, groupStatusFailureReply(action.groupJid, error))
            }
        }
    }
}

const startedAtSeconds = Math.floor(Date.now() / 1000)
runtime.client.on('message', (event) => {
    handle(event, startedAtSeconds).catch((error: unknown) => {
        log(`ERROR handling ${event.key.id}: ${error instanceof Error ? error.message : String(error)}`)
    })
})

process.on('SIGINT', () => {
    void runtime.client
        .disconnect()
        .catch(() => undefined)
        .then(() => process.exit(0))
})

await connectAndWait(runtime)
const banner = config.metaHostedBanner ? ', META_HOSTED_BANNER on' : ''
log(`ready: send /menu or /help (allowed numbers: ${config.allowedNumbers.length}, allowed groups: ${config.allowedGroups.length}${banner})`)
