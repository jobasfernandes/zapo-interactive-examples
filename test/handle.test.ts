import { describe, expect, it } from 'vitest'
import { proto, type WaIncomingMessageEvent } from 'zapo-js'

import { chatContext, decide, GROUP_STATUS_USAGE, groupStatusFailureReply, isStale } from '../src/bot/handle.js'
import { groupStatusExample } from '../src/examples/group-status.js'
import { COMMANDS, EXAMPLES, findExample } from '../src/examples/index.js'
import { buildMenu, HELP_TEXT } from '../src/examples/menu.js'
import { isAllowed, type ChatContext } from '../src/lib/access.js'
import { parseCommand } from '../src/lib/commands.js'
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

    it('reports commands from people who are not allowed, and ignores their plain text', () => {
        expect(decide(event(text('/form')), stranger, config, new Set())).toEqual({ kind: 'denied' })
        expect(decide(event({ orderMessage: { orderId: '1' } }), stranger, config, new Set())).toEqual({ kind: 'denied' })
        expect(decide(event(text('hello')), stranger, config, new Set())).toEqual({ kind: 'ignore' })
        expect(decide(event(text('menu')), owner, config, new Set())).toEqual({ kind: 'ignore' })
    })

    it('does not answer a cart the owner sends to another business', () => {
        expect(decide(event({ orderMessage: { orderId: '1', itemCount: 1 } }), owner, config, new Set())).toEqual({ kind: 'ignore' })
    })

    it('lists groups only to the owner in the self-chat', () => {
        const selfChat: ChatContext = { ...owner, chatJid: '111111111111111@lid' }
        expect(decide(event(text('/groups')), selfChat, config, new Set())).toEqual({ kind: 'groups' })
        expect(decide(event(text('/groups')), owner, config, new Set())).toEqual({ kind: 'ignore' })
        expect(decide(event(text('/groups')), allowed, config, new Set())).toEqual({ kind: 'ignore' })
    })

    it('never treats its own help text or menu as a command, even without the sent-id guard', () => {
        expect(decide(event(text(HELP_TEXT(EXAMPLES))), owner, config, new Set())).toEqual({ kind: 'ignore' })
        expect(decide(event(buildMenu(EXAMPLES) as proto.IMessage), owner, config, new Set())).toEqual({ kind: 'ignore' })
    })

    it('ignores the echo of a message the bot sent', () => {
        expect(decide(event(text('/help'), 'BOT1'), owner, config, new Set(['BOT1']))).toEqual({ kind: 'ignore' })
    })

    it('reacts to a cart from an allowed number', () => {
        const order = { orderId: '900000000000001', itemCount: 1, token: 'token' }
        expect(decide(event({ orderMessage: order }), allowed, config, new Set())).toEqual({ kind: 'order', order })
    })

    it('answers unknown commands with help', () => {
        expect(decide(event(text('/nope')), owner, config, new Set())).toEqual({ kind: 'help' })
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

describe('decide /group-status', () => {
    const groupConfig = parseConfig({ ALLOWED_NUMBERS: '5511999999999', ALLOWED_GROUPS: '120363000000000000@g.us' })
    const refusal = 'No group status was posted: 120363999999999999@g.us is not in ALLOWED_GROUPS.'

    it('posts to an allowed group, asked from a private chat', () => {
        expect(decide(event(text('/group-status 120363000000000000@g.us')), allowed, groupConfig, new Set())).toEqual({
            kind: 'group-status',
            groupJid: '120363000000000000@g.us'
        })
    })

    it('adds @g.us to a bare group id', () => {
        expect(decide(event(text('/group-status 120363000000000000')), allowed, groupConfig, new Set())).toEqual({
            kind: 'group-status',
            groupJid: '120363000000000000@g.us'
        })
    })

    it('refuses a group that is not in ALLOWED_GROUPS', () => {
        expect(decide(event(text('/group-status 120363999999999999@g.us')), allowed, groupConfig, new Set())).toEqual({
            kind: 'reply',
            text: refusal
        })
        expect(decide(event(text('/group-status 120363999999999999@g.us')), owner, config, new Set())).toEqual({
            kind: 'reply',
            text: refusal
        })
    })

    it('answers with the usage when the group id is missing', () => {
        expect(decide(event(text('/group-status')), owner, groupConfig, new Set())).toEqual({ kind: 'reply', text: GROUP_STATUS_USAGE })
    })

    it('never replies with text its own echo would run as a command', () => {
        expect(parseCommand(GROUP_STATUS_USAGE)).toBeNull()
        expect(parseCommand(refusal)).toBeNull()
    })

    it('keeps the refusal safe when the argument itself starts with a slash', () => {
        const action = decide(event(text('/group-status /menu')), owner, groupConfig, new Set())
        expect(action.kind).toBe('reply')
        expect(action.kind === 'reply' && parseCommand(action.text)).toBeNull()
    })

    it('still ignores people who are not allowed', () => {
        expect(decide(event(text('/group-status 120363000000000000@g.us')), stranger, groupConfig, new Set())).toEqual({ kind: 'denied' })
    })
})

describe('groupStatusFailureReply', () => {
    it('does not call an unconfirmed post a failure, so the owner does not post it twice', () => {
        const reply = groupStatusFailureReply('120363000000000000@g.us', new Error('query timeout for message 3EB0 after 30000ms'))
        expect(reply).toBe(
            'The server did not confirm the group status to 120363000000000000@g.us in time. It may still show up: check the group before asking again.'
        )
    })

    it('reports any other error as a failure', () => {
        const reply = groupStatusFailureReply('120363000000000000@g.us', new Error('negative publish ack: error=403'))
        expect(reply).toBe('Could not post the group status to 120363000000000000@g.us: negative publish ack: error=403')
        expect(parseCommand(reply)).toBeNull()
    })
})

describe('chatContext', () => {
    const own = { pn: '5511000000000@s.whatsapp.net', lid: '111111111111111@lid' }

    it('takes the sender PN from remoteJidAlt when a private chat is addressed by LID', () => {
        const key = { remoteJid: '333333333333333@lid', remoteJidAlt: '5511999999999@s.whatsapp.net', fromMe: false, isGroup: false }
        const ctx = chatContext(key as unknown as WaIncomingMessageEvent['key'], own)
        expect(ctx).toMatchObject({
            chatJid: '333333333333333@lid',
            isGroup: false,
            senderPn: '5511999999999@s.whatsapp.net',
            senderLid: '333333333333333@lid',
            selfJids: [own.pn, own.lid]
        })
        expect(isAllowed(ctx, config)).toBe(true)
    })

    it('takes the sender PN from participantAlt in a group', () => {
        const key = {
            remoteJid: '120363000000000000@g.us',
            participant: '333333333333333@lid',
            participantAlt: '5511999999999@s.whatsapp.net',
            fromMe: false,
            isGroup: true
        }
        expect(chatContext(key as unknown as WaIncomingMessageEvent['key'], own)).toMatchObject({
            chatJid: '120363000000000000@g.us',
            isGroup: true,
            senderPn: '5511999999999@s.whatsapp.net',
            senderLid: '333333333333333@lid'
        })
    })
})

describe('isStale', () => {
    it('flags messages older than the bot start (offline backlog)', () => {
        expect(isStale(event(text('/form'), 'OLD', 1_000), 2_000)).toBe(true)
        expect(isStale(event(text('/form'), 'NEW', 2_001), 2_000)).toBe(false)
    })
})

describe('buildMenu', () => {
    it('is a classic single-select listMessage wrapped in documentWithCaptionMessage, rows ids = commands', () => {
        const menu = buildMenu(EXAMPLES) as {
            documentWithCaptionMessage: {
                message: {
                    listMessage: {
                        listType: number
                        buttonText: string
                        sections: { title: string; rows: { rowId: string; title: string; description: string }[] }[]
                    }
                }
            }
        }
        const list = menu.documentWithCaptionMessage.message.listMessage
        expect(list.listType).toBe(proto.Message.ListMessage.ListType.SINGLE_SELECT)
        const rows = list.sections.flatMap((section) => section.rows)
        expect(rows.length).toBeLessThanOrEqual(10)
        expect(rows.map((row) => row.rowId)).toEqual(EXAMPLES.map((example) => `/${example.command}`))
        expect(rows[0]).toEqual({ rowId: `/${EXAMPLES[0].command}`, title: EXAMPLES[0].title, description: EXAMPLES[0].description })
    })

    it('leaves /group-status out of the menu, which is at the 10-row cap, but the CLI finds it', () => {
        expect(EXAMPLES.map((example) => example.command)).not.toContain('group-status')
        expect(COMMANDS).toContain(groupStatusExample)
        expect(findExample('group-status')).toBe(groupStatusExample)
    })
})

describe('HELP_TEXT', () => {
    it('never starts a line with a slash, so its echo cannot trigger a command', () => {
        const help = HELP_TEXT(EXAMPLES)
        expect(help).toContain('/buttons')
        expect(help.split('\n').every((line) => !line.trimStart().startsWith('/'))).toBe(true)
    })

    it('documents /group-status with its argument', () => {
        expect(HELP_TEXT(EXAMPLES)).toContain('/group-status <group-jid>')
    })
})
