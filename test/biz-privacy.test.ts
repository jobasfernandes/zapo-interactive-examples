import { describe, expect, it, vi } from 'vitest'
import type { WaClient } from 'zapo-js'

import { HOSTED_PRIVACY_MODE, installHostedPrivacyMode, stampHostedPrivacyMode } from '../src/lib/biz-privacy.js'
import { installNativeFlowRewrite } from '../src/lib/native-flow-name.js'

type Node = { tag: string; attrs: Readonly<Record<string, string>>; content?: unknown }
type Query = (node: Node, timeoutMs: number) => Promise<Node>

const SELF = ['5511000000000@s.whatsapp.net', '111111111111111@lid']
const list: Node = { tag: 'list', attrs: { type: 'product_list', v: '2' } }
const participants: Node = {
    tag: 'participants',
    attrs: {},
    content: [
        {
            tag: 'to',
            attrs: { jid: '333333333333333:1@lid' },
            content: [{ tag: 'enc', attrs: { v: '2', type: 'msg' }, content: new Uint8Array([1]) }]
        }
    ]
}
const deviceIdentity: Node = { tag: 'device-identity', attrs: {}, content: new Uint8Array([2]) }
const reporting: Node = { tag: 'reporting', attrs: {} }

function privateMessage(children: Node[], attrs: Record<string, string> = {}): Node {
    return { tag: 'message', attrs: { id: 'A', to: '333333333333333@lid', type: 'text', ...attrs }, content: children }
}

function child(node: Node, tag: string): Node | undefined {
    return (node.content as Node[]).find((candidate) => candidate.tag === tag)
}

/** Only what the stamp touches: zapo's private outgoing query and the paired credentials. */
function fakeClient() {
    const query = vi.fn(async (node: Node) => node)
    const client = {
        deps: { messageClient: { query } },
        getCredentials: () => ({ meJid: '5511000000000:7@s.whatsapp.net', meLid: '111111111111111:7@lid' })
    } as unknown as WaClient
    const send = (node: Node) => (client as unknown as { deps: { messageClient: { query: Query } } }).deps.messageClient.query(node, 1000)
    return { client, query, send }
}

describe('stampHostedPrivacyMode', () => {
    it('merges the hosted mode into the existing <biz> and keeps its children', () => {
        const input = privateMessage([participants, { tag: 'biz', attrs: {}, content: [list] }, reporting])
        const output = stampHostedPrivacyMode(input, SELF)
        expect(child(output, 'biz')?.attrs).toEqual(HOSTED_PRIVACY_MODE)
        expect((child(output, 'biz')?.content as Node[])[0]).toBe(list)
        expect(child(input, 'biz')?.attrs).toEqual({})
    })

    it('inserts <biz> after participants and device-identity when the message has none', () => {
        const output = stampHostedPrivacyMode(privateMessage([participants, deviceIdentity, reporting]), SELF)
        expect((output.content as Node[]).map((node) => node.tag)).toEqual(['participants', 'device-identity', 'biz', 'reporting'])
        expect(child(output, 'biz')?.attrs).toEqual(HOSTED_PRIVACY_MODE)
    })

    it('leaves groups, status, newsletters, peer messages, the own chat and other stanzas untouched', () => {
        const untouched: Node[] = [
            privateMessage([participants], { to: '120363000000000000@g.us' }),
            privateMessage([participants], { to: 'status@broadcast' }),
            privateMessage([participants], { to: '120363000000000000@newsletter' }),
            privateMessage([participants], { category: 'peer' }),
            privateMessage([participants], { to: '111111111111111@lid' }),
            { tag: 'iq', attrs: { id: 'A', to: '333333333333333@lid' } }
        ]
        for (const node of untouched) expect(stampHostedPrivacyMode(node, SELF)).toBe(node)
    })

    it('marks the account as hosted by Meta with a fixed timestamp in seconds', () => {
        expect(HOSTED_PRIVACY_MODE).toEqual({ actual_actors: '2', host_storage: '2', privacy_mode_ts: '1792108800' })
    })
})

describe('installHostedPrivacyMode', () => {
    it('stamps only the first message to each chat, retries of that message included, and never the own chat', async () => {
        const { client, query, send } = fakeClient()
        installHostedPrivacyMode(client)
        const first = privateMessage([participants])
        await send(first)
        await send(first)
        await send(privateMessage([participants], { id: 'B' }))
        await send(privateMessage([participants], { id: 'C', to: '444444444444444@lid' }))
        await send(privateMessage([participants], { id: 'D', to: '111111111111111@lid' }))

        const sent = query.mock.calls.map(([stanza]) => stanza)
        expect(child(sent[0], 'biz')?.attrs).toEqual(HOSTED_PRIVACY_MODE)
        expect(child(sent[1], 'biz')?.attrs).toEqual(HOSTED_PRIVACY_MODE)
        expect(child(sent[2], 'biz')).toBeUndefined()
        expect(child(sent[3], 'biz')?.attrs).toEqual(HOSTED_PRIVACY_MODE)
        expect(child(sent[4], 'biz')).toBeUndefined()
    })

    it('composes with the form_message rename on the same stanza', async () => {
        const { client, query, send } = fakeClient()
        const arm = installNativeFlowRewrite(client)
        installHostedPrivacyMode(client)
        arm('A', { name: 'form_message' })
        const nativeFlow: Node = { tag: 'native_flow', attrs: { v: '9', name: 'mixed' } }
        const interactive: Node = { tag: 'interactive', attrs: { type: 'native_flow', v: '1' }, content: [nativeFlow] }
        await send(privateMessage([participants, { tag: 'biz', attrs: {}, content: [interactive] }]))

        const biz = child(query.mock.calls[0][0], 'biz')
        expect(biz?.attrs).toEqual(HOSTED_PRIVACY_MODE)
        const sentInteractive = (biz?.content as Node[])[0]
        expect((sentInteractive.content as Node[])[0].attrs).toEqual({ name: 'form_message' })
    })
})
