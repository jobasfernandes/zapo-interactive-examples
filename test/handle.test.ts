import { createHash } from 'node:crypto'

import { describe, expect, it } from 'vitest'
import { proto, type WaIncomingAddonEvent, type WaIncomingMessageEvent } from 'zapo-js'

import { AI_USAGE, chatContext, decide, decideVote, GROUP_STATUS_USAGE, groupStatusFailureReply, isStale, responseReply } from '../src/bot/handle.js'
import { groupStatusExample } from '../src/examples/group-status.js'
import { COMMANDS, EXAMPLES, findExample } from '../src/examples/index.js'
import { buildMenu, buildPollMenu, HELP_TEXT } from '../src/examples/menu.js'
import type { Example } from '../src/examples/types.js'
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

    it('answers form answers and button replies from an allowed contact', () => {
        const formAnswer = event({
            interactiveResponseMessage: { nativeFlowResponseMessage: { name: 'form_message', paramsJson: '{"service":"good"}' } }
        })
        expect(decide(formAnswer, allowed, config, new Set())).toEqual({
            kind: 'response',
            name: 'form_message',
            paramsJson: '{"service":"good"}',
            echo: true
        })
        const legacyReply = event({ buttonsResponseMessage: { selectedButtonId: 'legacy_yes' } })
        expect(decide(legacyReply, allowed, config, new Set())).toEqual({
            kind: 'response',
            name: 'selection',
            paramsJson: '{"id":"legacy_yes"}',
            echo: true
        })
    })

    it('only logs the owner tapping outside the self-chat, where the tap is on someone else\'s message', () => {
        // A bank or a shop sent the buttons: the bot must not speak for the owner in that conversation.
        const quickReply = event({
            interactiveResponseMessage: { nativeFlowResponseMessage: { name: 'quick_reply', paramsJson: '{"display_text":"Yes","id":"yes"}' } }
        })
        expect(decide(quickReply, owner, config, new Set())).toMatchObject({ kind: 'response', name: 'quick_reply', echo: false })
        const legacyReply = event({ buttonsResponseMessage: { selectedButtonId: 'legacy_yes' } })
        expect(decide(legacyReply, owner, config, new Set())).toMatchObject({ kind: 'response', name: 'selection', echo: false })
    })

    it('answers the owner tapping in the self-chat', () => {
        const selfChat: ChatContext = { ...owner, chatJid: '111111111111111@lid' }
        const quickReply = event({
            interactiveResponseMessage: { nativeFlowResponseMessage: { name: 'quick_reply', paramsJson: '{"display_text":"Yes","id":"yes"}' } }
        })
        expect(decide(quickReply, selfChat, config, new Set())).toMatchObject({ kind: 'response', echo: true })
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

describe('decide /poll', () => {
    it('opens the poll for the owner', () => {
        expect(decide(event(text('/poll')), owner, config, new Set())).toEqual({ kind: 'poll' })
    })

    it('reports /poll from people who are not allowed', () => {
        expect(decide(event(text('/poll')), stranger, config, new Set())).toEqual({ kind: 'denied' })
    })

    it('keeps /poll out of the send CLI, which could not receive its votes', () => {
        expect(findExample('poll')).toBeUndefined()
    })
})

describe('decide /ai', () => {
    const group: ChatContext = { chatJid: '120363000000000000@g.us', isGroup: true, fromMe: false, senderPn: '5511999999999@s.whatsapp.net', selfJids }
    const groupConfig = parseConfig({ ALLOWED_NUMBERS: '5511999999999', ALLOWED_GROUPS: '120363000000000000@g.us' })

    it('hands the raw question to the bot, line breaks kept, for the owner and allowed contacts', () => {
        expect(decide(event(text('/ai what is\na webhook?')), allowed, config, new Set())).toEqual({ kind: 'ai', question: 'what is\na webhook?' })
        expect(decide(event(text('/AI hello')), owner, config, new Set())).toEqual({ kind: 'ai', question: 'hello' })
    })

    it('answers an empty question with the usage', () => {
        expect(AI_USAGE).toBe('Usage: /ai <question>, e.g. /ai what is a webhook?')
        expect(decide(event(text('/ai')), owner, config, new Set())).toEqual({ kind: 'reply', text: AI_USAGE })
        expect(decide(event(text('/ai   ')), allowed, config, new Set())).toEqual({ kind: 'reply', text: AI_USAGE })
    })

    it('follows the allowlist rules', () => {
        expect(decide(event(text('/ai hi')), stranger, config, new Set())).toEqual({ kind: 'denied' })
        expect(decide(event(text('/ai hi')), group, groupConfig, new Set())).toEqual({ kind: 'ai', question: 'hi' })
        expect(decide(event(text('/ai hi')), group, config, new Set())).toEqual({ kind: 'denied' })
    })

    it('ignores the echo of an answer the bot sent, even when it starts with /ai', () => {
        expect(decide(event(text('/ai is a command'), 'BOT2'), owner, config, new Set(['BOT2']))).toEqual({ kind: 'ignore' })
    })

    it('is a bot action, not an example', () => {
        expect(findExample('ai')).toBeUndefined()
        expect(COMMANDS.some((example) => example.command === 'ai')).toBe(false)
    })

    it('is listed in the help text', () => {
        expect(HELP_TEXT(EXAMPLES).split('\n')).toContain('• /ai <question>: asks Meta AI; a chat keeps its conversation for 30 minutes of idleness')
    })
})

describe('decideVote', () => {
    // A vote on a poll the bot sent, as the live test showed it: WhatsApp sends the SHA-256 of each chosen option name,
    // and zapo cannot turn it back into a name because it does not store the polls it sends (selectedOptionNames is null).
    const sha256 = (name: string) => new Uint8Array(createHash('sha256').update(name).digest())
    function voteEvent(names: readonly string[] | undefined, pollId = 'POLL1'): WaIncomingAddonEvent {
        return {
            key: { id: 'VOTE1', remoteJid: '333333333333333@lid', fromMe: false, isGroup: false },
            kind: 'poll_vote',
            targetMessageId: pollId,
            decrypted: { kind: 'poll_vote', pollVote: { selectedOptions: names?.map(sha256) }, selectedOptionNames: null }
        } as unknown as WaIncomingAddonEvent
    }
    // The ids of the messages the bot sent: a poll left in the chat stays a live menu for as long as the bot runs.
    const sentWith = (...ids: string[]) => new Set(ids)

    it('runs the example whose title was voted, though zapo cannot name the option of a poll the bot sent', () => {
        const action = decideVote(voteEvent(['Buttons']), allowed, config, sentWith('POLL1'))
        expect(action).toEqual({ kind: 'poll-vote', example: expect.objectContaining({ command: 'buttons' }) })
    })

    it('lets the owner vote', () => {
        const action = decideVote(voteEvent(['Webview']), owner, config, sentWith('POLL1'))
        expect(action).toEqual({ kind: 'poll-vote', example: expect.objectContaining({ command: 'webview' }) })
    })

    it('runs the example again on every vote, so a changed vote picks another one', () => {
        const sent = sentWith('POLL1')
        const first = decideVote(voteEvent(['Buttons']), allowed, config, sent)
        const changed = decideVote(voteEvent(['Carousel']), allowed, config, sent)
        expect(first.kind === 'poll-vote' && first.example.command).toBe('buttons')
        expect(changed.kind === 'poll-vote' && changed.example.command).toBe('carousel')
    })

    it('ignores a vote on a poll the bot did not send, whoever votes', () => {
        expect(decideVote(voteEvent(['Buttons']), allowed, config, sentWith())).toEqual({ kind: 'ignore' })
        expect(decideVote(voteEvent(['Buttons']), allowed, config, sentWith('OTHER'))).toEqual({ kind: 'ignore' })
        expect(decideVote(voteEvent(['Buttons']), stranger, config, sentWith('OTHER'))).toEqual({ kind: 'ignore' })
    })

    it('reports a voter who is not allowed', () => {
        expect(decideVote(voteEvent(['Buttons']), stranger, config, sentWith('POLL1'))).toEqual({ kind: 'denied' })
    })

    it.each([
        ['a removed vote', []],
        ['a vote without options', undefined],
        ['an option that matches no example', ['No such title']]
    ])('ignores %s', (_label, names) => {
        expect(decideVote(voteEvent(names), allowed, config, sentWith('POLL1'))).toEqual({ kind: 'ignore' })
    })

    it('ignores other addons on the poll id', () => {
        const reaction = {
            ...voteEvent(['Buttons']),
            kind: 'reaction',
            decrypted: { kind: 'reaction', reaction: {} }
        } as unknown as WaIncomingAddonEvent
        expect(decideVote(reaction, allowed, config, sentWith('POLL1'))).toEqual({ kind: 'ignore' })
    })

    it('takes the first option when several names arrive', () => {
        const action = decideVote(voteEvent(['Carousel', 'Buttons']), allowed, config, sentWith('POLL1'))
        expect(action.kind === 'poll-vote' && action.example.command).toBe('carousel')
    })
})

describe('responseReply', () => {
    it.each([
        ['quick_reply', '{"display_text":"Yes","id":"yes"}', '• Tapped "Yes" (yes)'],
        ['quick_reply', '{"display_text":"Yes"}', '• Tapped "Yes"'],
        ['selection', '{"id":"legacy_yes"}', '• Selected legacy_yes'],
        ['form_message', '{"service":"good"}', '• form_message: {"service":"good"}'],
        ['form_message', 'not json', '• form_message: not json'],
        ['form_message', '', '• form_message']
    ])('describes %s answer %j as %j', (name, paramsJson, expected) => {
        expect(responseReply(name, paramsJson)).toBe(expected)
    })

    it('cuts a long reply at 300 characters and keeps shorter ones whole', () => {
        // "• x: " is 5 characters, so 295 more fill the limit exactly.
        expect(responseReply('x', 'a'.repeat(295))).toBe(`• x: ${'a'.repeat(295)}`)
        const cut = responseReply('x', 'a'.repeat(296))
        expect(cut).toBe(`• x: ${'a'.repeat(292)}...`)
        expect(cut).toHaveLength(300)
        expect(responseReply('form_message', JSON.stringify({ notes: 'y'.repeat(1000) }))).toHaveLength(300)
    })

    it('never starts like a command, whatever the answer says', () => {
        for (const [name, paramsJson] of [
            ['/menu', '{"id":"/menu"}'],
            ['/menu', '/catalog'],
            ['quick_reply', '{"display_text":"/form","id":"/form"}']
        ]) {
            const reply = responseReply(name, paramsJson)
            expect(reply.startsWith('• ')).toBe(true)
            expect(parseCommand(reply)).toBeNull()
        }
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

describe('buildPollMenu', () => {
    const fake = (title: string): Example => ({
        command: title.toLowerCase(),
        title,
        description: `${title} example`,
        requiresCatalog: false,
        send: async () => []
    })

    it('is a single-choice poll whose options are the example titles, in menu order', () => {
        expect(buildPollMenu([fake('Alpha'), fake('Beta')])).toEqual({
            type: 'poll',
            name: 'Pick an example to run',
            options: ['Alpha', 'Beta'],
            selectableCount: 1
        })
    })

    it('stays inside WhatsApp poll limits with no duplicate option', () => {
        const { options } = buildPollMenu(EXAMPLES) as { options: string[] }
        expect(options.length).toBeLessThanOrEqual(12)
        expect(new Set(options).size).toBe(options.length)
        expect(options.every((option) => option.length > 0 && option.length <= 100)).toBe(true)
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

    it('documents /poll', () => {
        expect(HELP_TEXT(EXAMPLES)).toContain('/poll')
    })
})
