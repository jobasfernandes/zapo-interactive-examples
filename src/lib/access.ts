import type { Config } from './config.js'

/**
 * Who sent a message and where. `senderPn`/`senderLid` come from the message key:
 * `remoteJid`/`remoteJidAlt` in private chats, `participant`/`participantAlt` in groups
 * (WhatsApp addresses users by LID or by phone number, and the other form is in the alt field).
 */
export type ChatContext = {
    chatJid: string
    isGroup: boolean
    fromMe: boolean
    senderPn?: string
    senderLid?: string
    /** The paired account's own user jids (PN and LID), used to recognize the self-chat. */
    selfJids: readonly string[]
}

type AccessConfig = Pick<Config, 'allowedNumbers' | 'allowedGroups'>

function phoneDigits(jid: string | undefined): string | undefined {
    if (!jid || !jid.endsWith('@s.whatsapp.net')) return undefined
    return jid.split('@')[0].split(':')[0].replace(/\D/g, '')
}

function isAllowedNumber(jid: string | undefined, allowedNumbers: readonly string[]): boolean {
    const digits = phoneDigits(jid)
    return digits !== undefined && allowedNumbers.includes(digits)
}

export function isAllowed(ctx: ChatContext, config: AccessConfig): boolean {
    if (!ctx.isGroup && ctx.selfJids.includes(ctx.chatJid)) return true
    const senderAllowed = ctx.fromMe || isAllowedNumber(ctx.senderPn, config.allowedNumbers)
    if (ctx.isGroup) return config.allowedGroups.includes(ctx.chatJid) && senderAllowed
    return senderAllowed
}

/** The bot's own sends come back as `fromMe` events; replying to them would loop. */
export function shouldHandle(messageId: string, sentByBot: ReadonlySet<string>): boolean {
    return !sentByBot.has(messageId)
}
