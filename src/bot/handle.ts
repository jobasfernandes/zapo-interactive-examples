import type { proto, WaIncomingMessageEvent } from 'zapo-js'

import { findExample } from '../examples/index.js'
import type { Example } from '../examples/types.js'
import { isAllowed, shouldHandle, type ChatContext } from '../lib/access.js'
import { extractSelection, extractText, parseCommand, unwrap } from '../lib/commands.js'
import type { Config } from '../lib/config.js'

export type Action =
    | { kind: 'ignore' }
    | { kind: 'help' }
    | { kind: 'menu' }
    | { kind: 'groups' }
    | { kind: 'example'; example: Example; args: string[] }
    | { kind: 'order'; order: proto.Message.IOrderMessage }
    | { kind: 'response'; name: string; paramsJson: string }

/** Messages that arrived while the bot was offline are delivered on connect; they must not run. */
export function isStale(event: WaIncomingMessageEvent, startedAtSeconds: number): boolean {
    return event.timestampSeconds !== undefined && event.timestampSeconds < startedAtSeconds
}

function commandAction(name: string, args: string[]): Action {
    if (name === 'menu') return { kind: 'menu' }
    if (name === 'help') return { kind: 'help' }
    if (name === 'groups') return { kind: 'groups' }
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
    if (!isAllowed(ctx, config)) return { kind: 'ignore' }

    const message = unwrap(event.message)
    if (message?.orderMessage) return { kind: 'order', order: message.orderMessage }

    const selection = extractSelection(message)
    const command = parseCommand(selection) ?? parseCommand(extractText(message))
    if (command) return commandAction(command.name, command.args)

    const nativeFlow = message?.interactiveResponseMessage?.nativeFlowResponseMessage
    if (nativeFlow?.name) return { kind: 'response', name: nativeFlow.name, paramsJson: nativeFlow.paramsJson ?? '' }
    if (selection) return { kind: 'response', name: 'selection', paramsJson: JSON.stringify({ id: selection }) }
    return { kind: 'ignore' }
}
