import type { proto, WaIncomingMessageEvent } from 'zapo-js'

import { findExample } from '../examples/index.js'
import type { Example } from '../examples/types.js'
import { isAllowed, shouldHandle, type ChatContext } from '../lib/access.js'
import { extractSelection, extractText, parseCommand, unwrap } from '../lib/commands.js'
import type { Config } from '../lib/config.js'

export type Action =
    | { kind: 'ignore' }
    /** A command, menu pick or cart from someone who is not allowed: only logged locally. */
    | { kind: 'denied' }
    | { kind: 'help' }
    | { kind: 'menu' }
    | { kind: 'groups' }
    | { kind: 'example'; example: Example; args: string[] }
    | { kind: 'order'; order: proto.Message.IOrderMessage }
    | { kind: 'response'; name: string; paramsJson: string }

/**
 * Who sent the message and where. WhatsApp addresses users by LID or by phone number and
 * puts the other form in the alt field: the sender is the participant in a group and the
 * chat itself in a private conversation.
 */
export function chatContext(key: WaIncomingMessageEvent['key'], own: { pn?: string; lid?: string }): ChatContext {
    const sender = key.isGroup ? [key.participant, key.participantAlt] : [key.remoteJid, key.remoteJidAlt]
    return {
        chatJid: key.remoteJid ?? '',
        isGroup: key.isGroup,
        fromMe: key.fromMe ?? false,
        senderPn: sender.find((jid) => jid?.endsWith('@s.whatsapp.net')) ?? undefined,
        senderLid: sender.find((jid) => jid?.endsWith('@lid')) ?? undefined,
        selfJids: [own.pn, own.lid].filter((jid): jid is string => jid !== undefined)
    }
}

/** Messages that arrived while the bot was offline are delivered on connect; they must not run. */
export function isStale(event: WaIncomingMessageEvent, startedAtSeconds: number): boolean {
    return event.timestampSeconds !== undefined && event.timestampSeconds < startedAtSeconds
}

function commandAction(name: string, args: string[], ctx: ChatContext): Action {
    if (name === 'menu') return { kind: 'menu' }
    if (name === 'help') return { kind: 'help' }
    // The group list is the owner's setup data: never post it to a contact or a group.
    if (name === 'groups') return ctx.fromMe && !ctx.isGroup && ctx.selfJids.includes(ctx.chatJid) ? { kind: 'groups' } : { kind: 'ignore' }
    const example = findExample(name)
    return example ? { kind: 'example', example, args } : { kind: 'help' }
}

export function decide(
    event: WaIncomingMessageEvent,
    ctx: ChatContext,
    config: Config,
    sentByBot: ReadonlySet<string>
): Action {
    if (!event.key.id || !shouldHandle(event.key.id, sentByBot)) return { kind: 'ignore' }

    const message = unwrap(event.message)
    const selection = extractSelection(message)
    const command = parseCommand(selection) ?? parseCommand(extractText(message))

    if (!isAllowed(ctx, config)) return command || message?.orderMessage ? { kind: 'denied' } : { kind: 'ignore' }

    // A cart the owner sends is a purchase from another business, not one to answer.
    if (message?.orderMessage) return ctx.fromMe ? { kind: 'ignore' } : { kind: 'order', order: message.orderMessage }
    if (command) return commandAction(command.name, command.args, ctx)

    const nativeFlow = message?.interactiveResponseMessage?.nativeFlowResponseMessage
    if (nativeFlow?.name) return { kind: 'response', name: nativeFlow.name, paramsJson: nativeFlow.paramsJson ?? '' }
    if (selection) return { kind: 'response', name: 'selection', paramsJson: JSON.stringify({ id: selection }) }
    return { kind: 'ignore' }
}
