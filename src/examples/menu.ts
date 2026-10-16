import { proto } from 'zapo-js'

import type { Example, SendContent } from './types.js'

/** WhatsApp caps a list at 10 rows across all sections. */
const MAX_ROWS = 10

/**
 * Classic single-select `listMessage`, wrapped in `documentWithCaptionMessage`
 * (FutureProofMessage): WhatsApp Web only renders a list through this wrapper. A bare
 * `listMessage` or a native flow `single_select` opens on the phone but not on Web.
 * zapo attaches the `<biz><list>` companion node (and the group stanza shape) itself.
 * Row ids are the commands, so a pick (`listResponseMessage.singleSelectReply.selectedRowId`)
 * runs exactly like typing it.
 */
export function buildMenu(examples: readonly Example[]): SendContent {
    const row = (example: Example) => ({ rowId: `/${example.command}`, title: example.title, description: example.description })
    const listed = examples.slice(0, MAX_ROWS)
    const sections = [
        { title: 'Messages', rows: listed.filter((example) => !example.requiresCatalog).map(row) },
        { title: 'Catalog (Business)', rows: listed.filter((example) => example.requiresCatalog).map(row) }
    ].filter((section) => section.rows.length > 0)
    return {
        documentWithCaptionMessage: {
            message: {
                listMessage: {
                    title: 'zapo-interactive-examples',
                    description: 'Pick an example and it will be sent to this chat 👇',
                    buttonText: 'Examples',
                    footerText: '/help lists every command',
                    listType: proto.Message.ListMessage.ListType.SINGLE_SELECT,
                    sections
                }
            }
        }
    } as unknown as SendContent
}

/** Every line starts with a bullet: the bot's own echo of this text must not look like a command. */
export function HELP_TEXT(examples: readonly Example[]): string {
    return [
        'zapo-interactive-examples commands:',
        '• /menu: interactive list of the examples',
        ...examples.map((example) => `• /${example.command}: ${example.description}`),
        "• /groups: this account's groups and their ids, for ALLOWED_GROUPS (only in your own chat)",
        '• /help: this list'
    ].join('\n')
}
