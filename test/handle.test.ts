import { describe, expect, it } from 'vitest'
import type { proto, WaIncomingMessageEvent } from 'zapo-js'

import { decide, isStale } from '../src/bot/handle.js'
import { EXAMPLES } from '../src/examples/index.js'
import { HELP_TEXT } from '../src/examples/menu.js'
import type { ChatContext } from '../src/lib/access.js'
import { parseConfig } from '../src/lib/config.js'

const config = parseConfig({ ALLOWED_NUMBERS: '5511999999999' })
const selfJids = ['5511000000000@s.whatsapp.net', '111111111111111@lid']

const owner: ChatContext = { chatJid: '222222222222222@lid', isGroup: false, fromMe: true, selfJids }
const allowed: ChatContext = {
    chatJid: '333333333333333@lid',
    isGroup: false,
    fromMe: false,
    senderLid: '333333333333333@lid',
    senderPn: '5511999999999@s.whatsapp.net',
    selfJids
}
const stranger: ChatContext = { ...allowed, senderPn: '5511777777777@s.whatsapp.net' }

function event(message: proto.IMessage, id = 'MSG', timestampSeconds = 2_000_000_000): WaIncomingMessageEvent {
    return { key: { id, remoteJid: '222222222222222@lid', fromMe: false }, timestampSeconds, message } as unknown as WaIncomingMessageEvent
}

const text = (value: string): proto.IMessage => ({ conversation: value })

describe('decide', () => {
    it('opens the menu for the owner', () => {
        expect(decide(event(text('/menu')), owner, config, new Set())).toEqual({ kind: 'menu' })
    })

    it('runs the example picked in the menu', () => {
        const picked = event({
            interactiveResponseMessage: { nativeFlowResponseMessage: { name: 'single_select', paramsJson: '{"id":"/carousel"}' } }
        })
        const action = decide(picked, allowed, config, new Set())
        expect(action.kind).toBe('example')
        expect(action.kind === 'example' && action.example.command).toBe('carousel')
    })

    it('passes command arguments to the example', () => {
        const action = decide(event(text('/catalog mixed')), owner, config, new Set())
        expect(action.kind === 'example' && action.args).toEqual(['mixed'])
    })

    it('ignores strangers and text without a slash', () => {
        expect(decide(event(text('/form')), stranger, config, new Set())).toEqual({ kind: 'ignore' })
        expect(decide(event(text('menu')), owner, config, new Set())).toEqual({ kind: 'ignore' })
    })

    it('ignores the echo of a message the bot sent', () => {
        expect(decide(event(text('/help'), 'BOT1'), owner, config, new Set(['BOT1']))).toEqual({ kind: 'ignore' })
    })

    it('reacts to a cart from an allowed number', () => {
        const order = { orderId: '900000000000001', itemCount: 1, token: 'token' }
        expect(decide(event({ orderMessage: order }), allowed, config, new Set())).toEqual({ kind: 'order', order })
    })

    it('answers unknown commands with help and routes groups', () => {
        expect(decide(event(text('/nope')), owner, config, new Set())).toEqual({ kind: 'help' })
        expect(decide(event(text('/groups')), owner, config, new Set())).toEqual({ kind: 'groups' })
    })

    it('logs form answers and button replies', () => {
        const formAnswer = event({
            interactiveResponseMessage: { nativeFlowResponseMessage: { name: 'form_message', paramsJson: '{"service":"good"}' } }
        })
        expect(decide(formAnswer, allowed, config, new Set())).toEqual({
            kind: 'response',
            name: 'form_message',
            paramsJson: '{"service":"good"}'
        })
        const legacyReply = event({ buttonsResponseMessage: { selectedButtonId: 'legacy_yes' } })
        expect(decide(legacyReply, allowed, config, new Set())).toEqual({
            kind: 'response',
            name: 'selection',
            paramsJson: '{"id":"legacy_yes"}'
        })
    })
})

describe('isStale', () => {
    it('flags messages older than the bot start (offline backlog)', () => {
        expect(isStale(event(text('/form'), 'OLD', 1_000), 2_000)).toBe(true)
        expect(isStale(event(text('/form'), 'NEW', 2_001), 2_000)).toBe(false)
    })
})

describe('HELP_TEXT', () => {
    it('never starts a line with a slash, so its echo cannot trigger a command', () => {
        const help = HELP_TEXT(EXAMPLES)
        expect(help).toContain('/buttons')
        expect(help.split('\n').every((line) => !line.trimStart().startsWith('/'))).toBe(true)
    })
})
