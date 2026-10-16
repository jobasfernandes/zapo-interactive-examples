import { randomBytes } from 'node:crypto'

import type { WaClient } from 'zapo-js'

/**
 * Workaround for https://github.com/vinikjkkj/zapo/issues/317.
 *
 * The Android client takes the native flow name from the stanza companion node
 * `<biz><interactive type="native_flow"><native_flow name="..."/></interactive></biz>`,
 * not from the button inside the encrypted proto. zapo always sends `name="mixed"`
 * for native flows, so Android never runs its A2UI parser and shows the
 * `form_message` as "not supported" (WhatsApp Web reads the proto button and works).
 * zapo builds that node inside its dispatch with no override, so we rewrite it on
 * the way out. Delete this module once zapo names the flow after the button.
 */

export type StanzaNode = { tag: string; attrs: Readonly<Record<string, string>>; content?: unknown }

type MessageClientInternals = { query: (node: StanzaNode, timeoutMs: number) => Promise<StanzaNode> }

const WRAPPER_TAGS = new Set(['message', 'biz', 'interactive'])

export function rewriteNativeFlow(node: StanzaNode, attrs: Record<string, string>): StanzaNode {
    if (node.tag === 'native_flow') return { ...node, attrs }
    if (!WRAPPER_TAGS.has(node.tag) || !Array.isArray(node.content)) return node
    return { ...node, content: (node.content as StanzaNode[]).map((child) => rewriteNativeFlow(child, attrs)) }
}

/**
 * Patches the client's outgoing query once. Only a `message` stanza whose id was
 * armed gets rewritten, so other native flows (buttons, CTAs) keep `mixed`.
 */
export function installNativeFlowRewrite(client: WaClient): (messageId: string, attrs: Record<string, string>) => void {
    // `deps` is private in zapo's typings; it is the only seam to the outgoing stanza.
    const messageClient = (client as unknown as { deps: { messageClient: MessageClientInternals } }).deps.messageClient
    const armed = new Map<string, Record<string, string>>()
    const query = messageClient.query.bind(messageClient)
    messageClient.query = (node, timeoutMs) => {
        const attrs = node.tag === 'message' && node.attrs.id ? armed.get(node.attrs.id) : undefined
        if (!attrs) return query(node, timeoutMs)
        armed.delete(node.attrs.id)
        return query(rewriteNativeFlow(node, attrs), timeoutMs)
    }
    return (messageId, attrs) => {
        armed.set(messageId, attrs)
    }
}

export function newMessageId(): string {
    return `3EB0${randomBytes(9).toString('hex').toUpperCase()}`
}
