import type { proto, WaIncomingMessageEvent } from 'zapo-js'

import { groupStatusExample } from '../examples/group-status.js'
import { findExample } from '../examples/index.js'
import type { Example } from '../examples/types.js'
import { isAllowed, shouldHandle, type ChatContext } from '../lib/access.js'
import { extractSelection, extractText, parseCommand, unwrap } from '../lib/commands.js'
import { parseGroupList, type Config } from '../lib/config.js'

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
    /** Post the group status to `groupJid`, an allowed group, then confirm in the chat that asked. */
    | { kind: 'group-status'; groupJid: string }
    | { kind: 'reply'; text: string }

export const GROUP_STATUS_USAGE =
    'Usage: /group-status <group-jid>, e.g. /group-status 120363000000000000@g.us (only groups in ALLOWED_GROUPS).'

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

/** Anyone allowed may ask, but only ALLOWED_GROUPS can receive it: posting is visible to the whole group. */
function groupStatusAction(rawGroup: string | undefined, config: Pick<Config, 'allowedGroups'>): Action {
    // parseGroupList adds the @g.us that zapo needs; a bare id would be sent as a private chat.
    const [groupJid] = parseGroupList(rawGroup)
    if (!groupJid) return { kind: 'reply', text: GROUP_STATUS_USAGE }
    if (!config.allowedGroups.includes(groupJid)) {
        // The id comes from the user, so it never opens the reply: "/menu" would echo back as a command.
        return { kind: 'reply', text: `No group status was posted: ${groupJid} is not in ALLOWED_GROUPS.` }
    }
    return { kind: 'group-status', groupJid }
}

/**
 * A big group can take longer than the ack timeout even though the status went out
 * (docs/gotchas.md #11): calling that a failure would make the owner post it twice.
 */
export function groupStatusFailureReply(groupJid: string, error: unknown): string {
    const message = error instanceof Error ? error.message : String(error)
    if (/timeout/i.test(message)) {
        return `The server did not confirm the group status to ${groupJid} in time. It may still show up: check the group before asking again.`
    }
    return `Could not post the group status to ${groupJid}: ${message}`
}

function commandAction(name: string, args: string[], ctx: ChatContext, config: Config): Action {
    if (name === 'menu') return { kind: 'menu' }
    if (name === 'help') return { kind: 'help' }
    // The group list is the owner's setup data: never post it to a contact or a group.
    if (name === 'groups') return ctx.fromMe && !ctx.isGroup && ctx.selfJids.includes(ctx.chatJid) ? { kind: 'groups' } : { kind: 'ignore' }
    // Before findExample: run as an example it would post to the chat the command came from.
    if (name === groupStatusExample.command) return groupStatusAction(args[0], config)
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
    if (command) return commandAction(command.name, command.args, ctx, config)

    const nativeFlow = message?.interactiveResponseMessage?.nativeFlowResponseMessage
    if (nativeFlow?.name) return { kind: 'response', name: nativeFlow.name, paramsJson: nativeFlow.paramsJson ?? '' }
    if (selection) return { kind: 'response', name: 'selection', paramsJson: JSON.stringify({ id: selection }) }
    return { kind: 'ignore' }
}
