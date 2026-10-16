import { describe, expect, it, vi } from 'vitest'
import type { WaClient } from 'zapo-js'

import {
    installNativeFlowRewrite,
    newMessageId,
    rewriteNativeFlow,
    type StanzaNode
} from '../src/lib/native-flow-name.js'

const enc = new Uint8Array([1])

function messageStanza(id: string): StanzaNode {
    return {
        tag: 'message',
        attrs: { id, to: '5511999999999@s.whatsapp.net', type: 'text' },
        content: [
            {
                tag: 'biz',
                attrs: {},
                content: [
                    {
                        tag: 'interactive',
                        attrs: { type: 'native_flow', v: '1' },
                        content: [{ tag: 'native_flow', attrs: { v: '9', name: 'mixed' } }]
                    }
                ]
            },
            { tag: 'enc', attrs: {}, content: enc }
        ]
    }
}

function nativeFlowAttrs(node: StanzaNode): unknown {
    const biz = (node.content as StanzaNode[])[0]
    const interactive = (biz.content as StanzaNode[])[0]
    return (interactive.content as StanzaNode[])[0].attrs
}

function fakeClient() {
    const query = vi.fn(async (node: StanzaNode) => node)
    const client = { deps: { messageClient: { query } } } as unknown as WaClient
    return { client, query }
}

describe('rewriteNativeFlow', () => {
    it('replaces the native_flow attrs and leaves everything else as it was', () => {
        const input = messageStanza('A')
        const output = rewriteNativeFlow(input, { name: 'form_message' })
        expect(nativeFlowAttrs(output)).toEqual({ name: 'form_message' })
        expect((output.content as StanzaNode[])[1].content).toBe(enc)
        expect(nativeFlowAttrs(input)).toEqual({ v: '9', name: 'mixed' })
    })
})

describe('installNativeFlowRewrite', () => {
    it('rewrites only the armed message, once', async () => {
        const { client, query } = fakeClient()
        const arm = installNativeFlowRewrite(client)
        const messageClient = (client as unknown as { deps: { messageClient: { query: (n: StanzaNode, t: number) => Promise<StanzaNode> } } }).deps.messageClient
        arm('A', { name: 'form_message' })

        await messageClient.query(messageStanza('A'), 1000)
        await messageClient.query(messageStanza('B'), 1000)
        await messageClient.query(messageStanza('A'), 1000)
        const iq: StanzaNode = { tag: 'iq', attrs: { id: 'A' } }
        await messageClient.query(iq, 1000)

        const sent = query.mock.calls.map(([node]) => node)
        expect(nativeFlowAttrs(sent[0])).toEqual({ name: 'form_message' })
        expect(nativeFlowAttrs(sent[1])).toEqual({ v: '9', name: 'mixed' })
        expect(nativeFlowAttrs(sent[2])).toEqual({ v: '9', name: 'mixed' })
        expect(sent[3]).toBe(iq)
    })
})

describe('newMessageId', () => {
    it('looks like a WhatsApp Web message id', () => {
        expect(newMessageId()).toMatch(/^3EB0[0-9A-F]{18}$/)
    })
})
