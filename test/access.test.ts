import { describe, expect, it } from 'vitest'

import { isAllowed, shouldHandle, type ChatContext } from '../src/lib/access.js'

const config = { allowedNumbers: ['5511999999999'], allowedGroups: ['120363000000000000@g.us'] }
const selfJids = ['5511000000000@s.whatsapp.net', '111111111111111@lid']
const allowedPn = '5511999999999@s.whatsapp.net'
const strangerPn = '5511777777777@s.whatsapp.net'

function privateChat(overrides: Partial<ChatContext>): ChatContext {
    return { chatJid: '222222222222222@lid', isGroup: false, fromMe: false, selfJids, ...overrides }
}

function groupChat(overrides: Partial<ChatContext>): ChatContext {
    return { chatJid: '120363000000000000@g.us', isGroup: true, fromMe: false, selfJids, ...overrides }
}

describe('isAllowed', () => {
    it('lets the owner command from any private chat', () => {
        expect(isAllowed(privateChat({ fromMe: true }), config)).toBe(true)
    })

    it('always allows the self-chat', () => {
        expect(isAllowed(privateChat({ chatJid: '111111111111111@lid', fromMe: false }), config)).toBe(true)
    })

    it('matches an allowed number when the chat is addressed by LID and the PN comes from the alt field', () => {
        expect(isAllowed(privateChat({ senderLid: '123456789012345@lid', senderPn: allowedPn }), config)).toBe(true)
    })

    it('matches an allowed number that carries a device suffix', () => {
        expect(isAllowed(privateChat({ senderPn: '5511999999999:12@s.whatsapp.net' }), config)).toBe(true)
    })

    it('ignores strangers in private', () => {
        expect(isAllowed(privateChat({ senderPn: strangerPn }), config)).toBe(false)
        expect(isAllowed(privateChat({ senderLid: '123456789012345@lid' }), config)).toBe(false)
    })

    it('needs an allowed group AND an allowed sender in groups', () => {
        expect(isAllowed(groupChat({ senderPn: allowedPn }), config)).toBe(true)
        expect(isAllowed(groupChat({ senderPn: strangerPn }), config)).toBe(false)
        expect(isAllowed(groupChat({ chatJid: '120363000000000009@g.us', senderPn: allowedPn }), config)).toBe(false)
        expect(isAllowed(groupChat({ chatJid: '120363000000000009@g.us', fromMe: true }), config)).toBe(false)
        expect(isAllowed(groupChat({ fromMe: true }), config)).toBe(true)
    })

    it('with empty lists only the owner and the self-chat pass', () => {
        const empty = { allowedNumbers: [], allowedGroups: [] }
        expect(isAllowed(privateChat({ fromMe: true }), empty)).toBe(true)
        expect(isAllowed(privateChat({ chatJid: '5511000000000@s.whatsapp.net' }), empty)).toBe(true)
        expect(isAllowed(privateChat({ senderPn: allowedPn }), empty)).toBe(false)
        expect(isAllowed(groupChat({ fromMe: true }), empty)).toBe(false)
    })
})

describe('shouldHandle', () => {
    it('skips messages the bot sent itself', () => {
        expect(shouldHandle('ABC', new Set(['ABC']))).toBe(false)
        expect(shouldHandle('XYZ', new Set(['ABC']))).toBe(true)
    })
})
