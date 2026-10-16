import { randomBytes } from 'node:crypto'

import { toUserJid, type WaClient } from 'zapo-js'

/**
 * Experimental, off unless META_HOSTED_BANNER=true. Makes the contact's WhatsApp show "This
 * business is now using a secure service from Meta to manage this chat" once per chat per run.
 *
 * Each of the contact's devices stores a privacy mode per business, read from the `<biz>` attrs
 * `actual_actors`, `host_storage` and `privacy_mode_ts` of incoming messages, and shows that banner
 * only when the stored mode changes and the ts is strictly newer. A phone that already stored the
 * Meta mode stays silent, even after the chat is deleted, while WhatsApp Web re-syncs with the
 * server (no privacy mode for an SMB account) and forgets it. So the first message to each chat
 * goes out in two steps: a short text stamped end-to-end, then the message itself stamped as hosted
 * by Meta with a newer ts, which is a mode change on every device. Later messages go out untouched:
 * stamping them made WhatsApp Web show the banner again after each re-sync. A device that already
 * had the Meta mode also shows "now end-to-end encrypted" right before the banner.
 *
 * The claim is not true for a linked-device session: use it only with your own test chats. Kept
 * apart from native-flow-name.ts, which goes away with zapo#317. Limits: docs/gotchas.md #12.
 */

type StanzaNode = { tag: string; attrs: Readonly<Record<string, string>>; content?: unknown }

type MessageClientInternals = { query: (node: StanzaNode, timeoutMs: number) => Promise<StanzaNode> }

export type PrivacyAttrs = Readonly<Record<'actual_actors' | 'host_storage' | 'privacy_mode_ts', string>>

/** The extra message that carries the end-to-end mode right before the first real one. */
export const SWITCH_TEXT = '👋'

/** 1/1: run by the business on its own servers (end-to-end). 2/2: a provider on Meta's servers. */
export function privacyMode(hosted: boolean, timestampSeconds: number): PrivacyAttrs {
    const actors = hosted ? '2' : '1'
    return { actual_actors: actors, host_storage: actors, privacy_mode_ts: String(timestampSeconds) }
}

const PRIVATE_CHAT = /@(s\.whatsapp\.net|lid)$/

/** WhatsApp Web puts `<biz>` right after these, ahead of `<meta>`, `<reporting>` and `<tctoken>`. */
const BODY_TAGS = new Set(['participants', 'enc', 'device-identity'])

/** zapo already sends its own `<biz>` for lists and native flows, and WhatsApp Web rejects a second one. */
export function stampPrivacyMode(node: StanzaNode, attrs: PrivacyAttrs): StanzaNode {
    const children = node.content as StanzaNode[]
    if (children.some((child) => child.tag === 'biz')) {
        return { ...node, content: children.map((child) => (child.tag === 'biz' ? { ...child, attrs: { ...child.attrs, ...attrs } } : child)) }
    }
    const at = children.reduce((last, child, index) => (BODY_TAGS.has(child.tag) ? index + 1 : last), 0)
    return { ...node, content: [...children.slice(0, at), { tag: 'biz', attrs: { ...attrs } }, ...children.slice(at)] }
}

/**
 * Wraps the public `client.message.send` to decide what gets stamped, and the client's private
 * outgoing query to stamp it. Stamps stay keyed by stanza id, so zapo's own retries carry them too.
 */
export function installHostedPrivacyMode(client: WaClient): void {
    const armed = new Map<string, PrivacyAttrs>()
    // `deps` is private in zapo's typings; it is the only seam to the outgoing stanza.
    const messageClient = (client as unknown as { deps: { messageClient: MessageClientInternals } }).deps.messageClient
    const query = messageClient.query.bind(messageClient)
    messageClient.query = (node, timeoutMs) => {
        const attrs = armed.get(node.attrs.id)
        return query(attrs ? stampPrivacyMode(node, attrs) : node, timeoutMs)
    }

    const switched = new Set<string>()
    const send = client.message.send.bind(client.message)
    client.message.send = async (to, content, options) => {
        if (!PRIVATE_CHAT.test(to) || switched.has(to) || selfJids(client).includes(to)) return send(to, content, options)
        switched.add(to)
        const now = Math.floor(Date.now() / 1000)
        const switchId = newMessageId()
        armed.set(switchId, privacyMode(false, now))
        await send(to, SWITCH_TEXT, { id: switchId })
        // The caller's id is kept: the form_message rename (zapo#317) is armed on it.
        const id = options?.id ?? newMessageId()
        armed.set(id, privacyMode(true, now + 1))
        return send(to, content, { ...options, id })
    }
}

function newMessageId(): string {
    return `3EB0${randomBytes(9).toString('hex').toUpperCase()}`
}

function selfJids(client: WaClient): string[] {
    const credentials = client.getCredentials()
    return [credentials?.meJid, credentials?.meLid].flatMap((jid) => (jid ? [toUserJid(jid)] : []))
}
