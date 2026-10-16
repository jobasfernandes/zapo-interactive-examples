import type { Example, SendContent } from './types.js'

/**
 * Native flow `single_select`: a button that opens a list. The picked row comes back as
 * `nativeFlowResponseMessage.paramsJson = {"id": "<row id>"}`; row ids are the commands
 * themselves, so a pick runs exactly like typing it.
 */
export function buildMenu(examples: readonly Example[]): SendContent {
    const rows = examples.map((example) => ({
        id: `/${example.command}`,
        title: example.title,
        description: example.description
    }))
    return {
        interactiveMessage: {
            body: { text: 'Pick an example and it will be sent to this chat 👇' },
            footer: { text: 'zapo-interactive-examples' },
            nativeFlowMessage: {
                messageVersion: 1,
                buttons: [
                    {
                        name: 'single_select',
                        buttonParamsJson: JSON.stringify({
                            title: 'Examples',
                            sections: [{ title: 'Interactive messages', rows }]
                        })
                    }
                ]
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
