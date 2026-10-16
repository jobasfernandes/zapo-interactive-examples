import type { Example, SendContent } from './types.js'

/** WhatsApp Web shows up to 10 native flow buttons when the first one is a quick reply. */
const MAX_MENU_BUTTONS = 10

/**
 * Quick reply buttons, one per example; the button id is the command, so a tap runs
 * exactly like typing it (`nativeFlowResponseMessage.paramsJson = {"id": "/carousel"}`).
 * A `single_select` list would look tidier, but WhatsApp Web does not render it
 * ("Use your phone") and the answer shows as "update WhatsApp" on some phones.
 */
export function buildMenu(examples: readonly Example[]): SendContent {
    return {
        interactiveMessage: {
            body: { text: 'Pick an example and it will be sent to this chat 👇' },
            footer: { text: 'zapo-interactive-examples · /help lists every command' },
            nativeFlowMessage: {
                messageVersion: 1,
                buttons: examples.slice(0, MAX_MENU_BUTTONS).map((example) => ({
                    name: 'quick_reply',
                    buttonParamsJson: JSON.stringify({ display_text: example.title, id: `/${example.command}` })
                }))
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
        '• /groups: list this account groups and their ids (for ALLOWED_GROUPS)',
        '• /help: this list'
    ].join('\n')
}
