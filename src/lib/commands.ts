import type { proto } from 'zapo-js'

/** `rest` is the text after the name as typed: `args` loses the line breaks, which a pasted question needs. */
export type ParsedCommand = { name: string; args: string[]; rest: string }

export function parseCommand(text: string | null | undefined): ParsedCommand | null {
    const trimmed = text?.trim()
    if (!trimmed?.startsWith('/')) return null
    const [head, ...args] = trimmed.slice(1).split(/\s+/)
    if (!head) return null
    return { name: head.toLowerCase(), args, rest: trimmed.slice(1 + head.length).trim() }
}

export function unwrap(message: proto.IMessage | null | undefined): proto.IMessage | null | undefined {
    let current = message
    for (;;) {
        const inner =
            current?.ephemeralMessage?.message ??
            current?.viewOnceMessage?.message ??
            current?.viewOnceMessageV2?.message ??
            current?.documentWithCaptionMessage?.message ??
            current?.deviceSentMessage?.message
        if (!inner) return current
        current = inner
    }
}

/** The caption of a photo. Only photos: the caption of a video or a document is never read as a command. */
export function extractImageCaption(message: proto.IMessage | null | undefined): string | null {
    return unwrap(message)?.imageMessage?.caption ?? null
}

export function extractText(message: proto.IMessage | null | undefined): string | null {
    const inner = unwrap(message)
    return inner?.conversation ?? inner?.extendedTextMessage?.text ?? null
}

function idFromParams(paramsJson: string | null | undefined): string | null {
    if (!paramsJson) return null
    try {
        const params: unknown = JSON.parse(paramsJson)
        if (params && typeof params === 'object' && 'id' in params && typeof params.id === 'string') return params.id
    } catch {
        // a malformed paramsJson is just not a selection
    }
    return null
}

/** The id picked in an interactive menu or a reply button, whatever envelope the client used. */
export function extractSelection(message: proto.IMessage | null | undefined): string | null {
    const inner = unwrap(message)
    return (
        idFromParams(inner?.interactiveResponseMessage?.nativeFlowResponseMessage?.paramsJson) ??
        inner?.buttonsResponseMessage?.selectedButtonId ??
        inner?.listResponseMessage?.singleSelectReply?.selectedRowId ??
        inner?.templateButtonReplyMessage?.selectedId ??
        null
    )
}
