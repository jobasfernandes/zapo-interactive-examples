import { toUserJid, type WaClient } from 'zapo-js'

/**
 * Experimental, off unless META_HOSTED_BANNER=true. The first private-chat `<message>` the bot
 * sends to each chat carries `<biz actual_actors="2" host_storage="2" privacy_mode_ts="...">`,
 * the privacy mode of a business hosted by Meta (Cloud API). The contact's WhatsApp stores it
 * per business and shows "This business is now using a secure service from Meta to manage this
 * chat" when the stored mode changes and the received ts is strictly newer.
 *
 * Only the first message is stamped: the contact's WhatsApp re-syncs the business with the
 * server, which has no privacy mode for an SMB account, so the stored mode quietly goes back to
 * end-to-end and every later stamped message would show the banner again (WhatsApp Web did it
 * three times in a new chat on 2026-10-16). The ts is fixed, like the stored value official
 * clients echo. The claim is not true for a linked-device session: use it only with your own
 * test chats. Kept apart from native-flow-name.ts, which goes away with zapo#317. More in
 * docs/gotchas.md #12.
 */

type StanzaNode = { tag: string; attrs: Readonly<Record<string, string>>; content?: unknown }

type MessageClientInternals = { query: (node: StanzaNode, timeoutMs: number) => Promise<StanzaNode> }

/** actual_actors 2 = run by a business solution provider, host_storage 2 = on Meta's servers; ts = 2026-10-16. */
export const HOSTED_PRIVACY_MODE: Readonly<Record<'actual_actors' | 'host_storage' | 'privacy_mode_ts', string>> = {
    actual_actors: '2',
    host_storage: '2',
    privacy_mode_ts: '1792108800'
}

const PRIVATE_CHAT = /@(s\.whatsapp\.net|lid)$/

/** WhatsApp Web puts `<biz>` right after these, ahead of `<meta>`, `<reporting>` and `<tctoken>`. */
const BODY_TAGS = new Set(['participants', 'enc', 'device-identity'])

/**
 * Stamps a private-chat message and returns every other stanza as is: groups, status,
 * newsletters, protocol messages between the account's own devices (`category="peer"`) and the
 * account's own chat are not chats with a business.
 */
export function stampHostedPrivacyMode(node: StanzaNode, selfJids: readonly string[]): StanzaNode {
    const to = node.attrs.to ?? ''
    if (node.tag !== 'message' || !PRIVATE_CHAT.test(to) || node.attrs.category === 'peer' || selfJids.includes(to)) return node
    if (!Array.isArray(node.content)) return node
    const children = node.content as StanzaNode[]
    // zapo already sends its own `<biz>` for lists and native flows; the clients read only the first one.
    if (children.some((child) => child.tag === 'biz')) {
        const stamped = children.map((child) => (child.tag === 'biz' ? { ...child, attrs: { ...child.attrs, ...HOSTED_PRIVACY_MODE } } : child))
        return { ...node, content: stamped }
    }
    const at = children.reduce((last, child, index) => (BODY_TAGS.has(child.tag) ? index + 1 : last), 0)
    return { ...node, content: [...children.slice(0, at), { tag: 'biz', attrs: { ...HOSTED_PRIVACY_MODE } }, ...children.slice(at)] }
}

/**
 * Patches the client's outgoing query once and stamps the first message to each chat in this
 * process. zapo retries a send with the same stanza id, so those retries stay stamped.
 */
export function installHostedPrivacyMode(client: WaClient): void {
    // `deps` is private in zapo's typings; it is the only seam to the outgoing stanza.
    const messageClient = (client as unknown as { deps: { messageClient: MessageClientInternals } }).deps.messageClient
    const query = messageClient.query.bind(messageClient)
    const firstMessageIds = new Map<string, string>()
    messageClient.query = (node, timeoutMs) => {
        const stamped = stampHostedPrivacyMode(node, selfJids(client))
        if (stamped === node) return query(node, timeoutMs)
        const first = firstMessageIds.get(node.attrs.to)
        if (first === undefined) firstMessageIds.set(node.attrs.to, node.attrs.id)
        return query(first === undefined || first === node.attrs.id ? stamped : node, timeoutMs)
    }
}

function selfJids(client: WaClient): string[] {
    const credentials = client.getCredentials()
    return [credentials?.meJid, credentials?.meLid].flatMap((jid) => (jid ? [toUserJid(jid)] : []))
}
