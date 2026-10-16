import { afterEach, describe, expect, it, vi } from 'vitest'
import type { WaClient } from 'zapo-js'

import { installHostedPrivacyMode, privacyMode, stampPrivacyMode, SWITCH_TEXT } from '../src/lib/biz-privacy.js'
import { installNativeFlowRewrite } from '../src/lib/native-flow-name.js'

type Node = { tag: string; attrs: Readonly<Record<string, string>>; content?: unknown }
type Query = (node: Node, timeoutMs: number) => Promise<Node>
type Send = (to: string, content: unknown, options?: { id?: string }) => Promise<{ id: string }>

const NOW = 1_800_000_000
const CONTACT = '333333333333333@lid'
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
    return { tag: 'message', attrs: { id: 'A', to: CONTACT, type: 'text', ...attrs }, content: children }
}

function child(node: Node, tag: string): Node | undefined {
    return (node.content as Node[]).find((candidate) => candidate.tag === tag)
}

/**
 * Only what the stamp touches: `message.send`, which builds a stanza with the given id the way
 * zapo does and hands it to the private outgoing query, and the paired credentials.
 */
function fakeClient(build: (id: string, to: string) => Node = (id, to) => privateMessage([participants], { id, to })) {
    const query = vi.fn(async (node: Node) => node)
    const messageClient: { query: Query } = { query }
    let auto = 0
    const send = vi.fn<Send>(async (to, _content, options) => {
        auto += 1
        const id = options?.id ?? `AUTO${auto}`
        await messageClient.query(build(id, to), 1000)
        return { id }
    })
    const client = {
        deps: { messageClient },
        message: { send },
        getCredentials: () => ({ meJid: '5511000000000:7@s.whatsapp.net', meLid: '111111111111111:7@lid' })
    } as unknown as WaClient
    const sendAs = (to: string, content: unknown, options?: { id?: string }) =>
        (client as unknown as { message: { send: Send } }).message.send(to, content, options)
    return { client, query, send, sendAs, messageClient }
}

afterEach(() => {
    vi.useRealTimers()
})

describe('privacyMode', () => {
    it('is end-to-end with 1/1 and hosted by Meta with 2/2, timestamp in seconds', () => {
        expect(privacyMode(false, NOW)).toEqual({ actual_actors: '1', host_storage: '1', privacy_mode_ts: '1800000000' })
        expect(privacyMode(true, NOW + 1)).toEqual({ actual_actors: '2', host_storage: '2', privacy_mode_ts: '1800000001' })
    })
})

describe('stampPrivacyMode', () => {
    const hosted = privacyMode(true, NOW)

    it('merges the mode into the existing <biz> and keeps its children', () => {
        const input = privateMessage([participants, { tag: 'biz', attrs: {}, content: [list] }, reporting])
        const output = stampPrivacyMode(input, hosted)
        expect(child(output, 'biz')?.attrs).toEqual(hosted)
        expect((child(output, 'biz')?.content as Node[])[0]).toBe(list)
        expect(child(input, 'biz')?.attrs).toEqual({})
    })

    it('inserts <biz> after participants and device-identity when the message has none', () => {
        const output = stampPrivacyMode(privateMessage([participants, deviceIdentity, reporting]), hosted)
        expect((output.content as Node[]).map((node) => node.tag)).toEqual(['participants', 'device-identity', 'biz', 'reporting'])
        expect(child(output, 'biz')?.attrs).toEqual(hosted)
    })
})

describe('installHostedPrivacyMode', () => {
    it('switches a chat to end-to-end and then to Meta on the first message, and leaves later ones alone', async () => {
        vi.useFakeTimers()
        vi.setSystemTime(NOW * 1000)
        const { client, query, send, sendAs } = fakeClient()
        installHostedPrivacyMode(client)
        await sendAs(CONTACT, 'menu')
        await sendAs(CONTACT, 'help')

        expect(send.mock.calls.map(([to, content]) => [to, content])).toEqual([
            [CONTACT, SWITCH_TEXT],
            [CONTACT, 'menu'],
            [CONTACT, 'help']
        ])
        const sent = query.mock.calls.map(([node]) => node)
        expect(child(sent[0], 'biz')?.attrs).toEqual(privacyMode(false, NOW))
        expect(child(sent[1], 'biz')?.attrs).toEqual(privacyMode(true, NOW + 1))
        expect(child(sent[2], 'biz')).toBeUndefined()
    })

    it('switches each private chat once and never groups, status, channels or the own chat', async () => {
        const { client, query, send, sendAs } = fakeClient()
        installHostedPrivacyMode(client)
        for (const to of ['120363000000000000@g.us', 'status@broadcast', '120363000000000000@newsletter', '111111111111111@lid', '5511000000000@s.whatsapp.net']) {
            await sendAs(to, 'x')
        }
        await sendAs('444444444444444@lid', 'x')
        await sendAs('444444444444444@lid', 'y')

        expect(send.mock.calls.filter(([, content]) => content === SWITCH_TEXT).map(([to]) => to)).toEqual(['444444444444444@lid'])
        expect(query.mock.calls.filter(([node]) => child(node, 'biz') !== undefined)).toHaveLength(2)
    })

    it('keeps the caller id and stamps a retried send of that message', async () => {
        const { client, query, sendAs, messageClient } = fakeClient()
        installHostedPrivacyMode(client)
        await sendAs(CONTACT, 'menu', { id: 'MENU' })
        await messageClient.query(privateMessage([participants], { id: 'MENU' }), 1000)

        const menus = query.mock.calls.map(([node]) => node).filter((node) => node.attrs.id === 'MENU')
        expect(menus).toHaveLength(2)
        for (const menu of menus) expect(child(menu, 'biz')?.attrs.actual_actors).toBe('2')
    })

    it('lands the form_message rename (zapo#317) and the Meta stamp on the same stanza', async () => {
        const nativeFlow: Node = { tag: 'native_flow', attrs: { v: '9', name: 'mixed' } }
        const interactive: Node = { tag: 'interactive', attrs: { type: 'native_flow', v: '1' }, content: [nativeFlow] }
        const { client, query, sendAs } = fakeClient((id, to) => privateMessage([participants, { tag: 'biz', attrs: {}, content: [interactive] }], { id, to }))
        const arm = installNativeFlowRewrite(client)
        installHostedPrivacyMode(client)
        arm('FORM', { name: 'form_message' })
        await sendAs(CONTACT, 'form', { id: 'FORM' })

        const form = query.mock.calls.map(([node]) => node).find((node) => node.attrs.id === 'FORM') as Node
        const biz = child(form, 'biz') as Node
        expect(biz.attrs.actual_actors).toBe('2')
        const sentInteractive = (biz.content as Node[])[0]
        expect((sentInteractive.content as Node[])[0].attrs).toEqual({ name: 'form_message' })
    })
})
