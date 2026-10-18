import { proto } from 'zapo-js'

export type RenderedAnswer = {
    /** The parts the chat can show, joined by a blank line. */
    text: string
    /** Some part had no text, table or code (an image, for instance), so it is missing from `text`. */
    skipped: boolean
}

type Rich = NonNullable<proto.IMessage['richResponseMessage']>
type Table = NonNullable<NonNullable<NonNullable<Rich['submessages']>[number]['tableMetadata']>['rows']>
type CodeBlocks = NonNullable<NonNullable<NonNullable<Rich['submessages']>[number]['codeMetadata']>['codeBlocks']>

const FENCE = '```'
// The decoder gives null, not '', for a text part whose text is absent on the wire, so the part type says it is text.
const TEXT_PART = proto.AIRichResponseSubMessageType.AI_RICH_RESPONSE_TEXT
// Written as a code point so the invisible character stays visible in the source.
const ZERO_WIDTH_SPACE = String.fromCodePoint(0x200b)

/** A run of three backticks or more would close the fence the block sits in. */
function neutralize(content: string): string {
    return content.replace(/`{3,}/g, (run) => run.split('').join(ZERO_WIDTH_SPACE))
}

function fenced(content: string): string {
    return `${FENCE}\n${content}\n${FENCE}`
}

function renderTable(rows: Table): string {
    const cells = rows.map((row) => (row.items ?? []).map((cell) => neutralize(cell.replace(/\r?\n/g, ' '))))
    const columns = Math.max(0, ...cells.map((row) => row.length))
    const widths = Array.from({ length: columns }, (_, column) => Math.max(...cells.map((row) => (row[column] ?? '').length)))
    const line = (row: readonly string[]) =>
        widths
            .map((width, column) => (row[column] ?? '').padEnd(width))
            .join(' | ')
            .trimEnd()

    const lines: string[] = []
    cells.forEach((row, index) => {
        lines.push(line(row))
        if (rows[index]?.isHeading) lines.push(widths.map((width) => '-'.repeat(width)).join('-+-'))
    })
    return fenced(lines.join('\n'))
}

function renderCode(blocks: CodeBlocks): string {
    // The blocks are the highlighted tokens of the code, so they join with nothing between them.
    const code = blocks.map((block) => block.codeContent ?? '').join('')
    return fenced(neutralize(code).replace(/\n+$/, ''))
}

/**
 * Turns one Meta AI answer (the first chunk, or the snapshot an edit chunk carries) into text for a chat.
 * The language tag of code is dropped: WhatsApp would print it as the first line of the block.
 */
export function renderAnswer(message: proto.IMessage | null | undefined): RenderedAnswer {
    const body = message?.protocolMessage?.editedMessage ?? message
    const submessages = body?.richResponseMessage?.submessages
    if (!submessages) return { text: body?.conversation ?? body?.extendedTextMessage?.text ?? '', skipped: false }

    const parts: string[] = []
    let skipped = false
    for (const submessage of submessages) {
        if (submessage.messageType === TEXT_PART || typeof submessage.messageText === 'string') {
            if (submessage.messageText) parts.push(submessage.messageText)
        } else if (submessage.tableMetadata) {
            parts.push(renderTable(submessage.tableMetadata.rows ?? []))
        } else if (submessage.codeMetadata) {
            parts.push(renderCode(submessage.codeMetadata.codeBlocks ?? []))
        } else {
            skipped = true
        }
    }
    return { text: parts.join('\n\n'), skipped }
}
