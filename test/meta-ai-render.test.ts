import { describe, expect, it } from 'vitest'
import { proto } from 'zapo-js'

import { renderAnswer } from '../src/lib/meta-ai-render.js'

const rich = (...submessages: unknown[]) => ({ richResponseMessage: { messageType: 1, submessages } }) as proto.IMessage

// Built from the code point so the invisible character stays visible in the source.
const ZW = String.fromCodePoint(0x200b)

describe('renderAnswer', () => {
    it('returns a text part as it is', () => {
        expect(renderAnswer(rich({ messageType: 2, messageText: 'It is *Paris*.' }))).toEqual({ text: 'It is *Paris*.', skipped: false })
    })

    it('renders the snapshot inside an edit', () => {
        const edit = { protocolMessage: { type: 14, editedMessage: rich({ messageType: 2, messageText: 'Full text' }) } } as proto.IMessage
        expect(renderAnswer(edit)).toEqual({ text: 'Full text', skipped: false })
    })

    it('renders a table as a padded monospace block with a line under the heading', () => {
        const table = {
            messageType: 4,
            tableMetadata: { rows: [{ isHeading: true, items: ['Name', 'Role'] }, { items: ['Ada', 'Engineer'] }, { items: ['Linus', 'Maintainer'] }] }
        }
        expect(renderAnswer(rich(table)).text).toBe('```\nName  | Role\n------+-----------\nAda   | Engineer\nLinus | Maintainer\n```')
    })

    it('pads ragged rows, flattens line breaks and adds no line when no row is a heading', () => {
        const table = { messageType: 4, tableMetadata: { rows: [{ items: ['A', 'B'] }, { items: ['x'] }, { items: ['y\nz', 'w'] }] } }
        expect(renderAnswer(rich(table)).text).toBe('```\nA   | B\nx   |\ny z | w\n```')
    })

    it('renders code without the language tag', () => {
        const code = {
            messageType: 5,
            codeMetadata: {
                codeLanguage: 'typescript',
                codeBlocks: [{ codeContent: 'console.log(' }, { highlightType: 3, codeContent: "'Hello, World!'" }, { codeContent: ');\n' }]
            }
        }
        expect(renderAnswer(rich(code)).text).toBe("```\nconsole.log('Hello, World!');\n```")
    })

    it('neutralizes runs of backticks inside code and table cells', () => {
        const code = { messageType: 5, codeMetadata: { codeBlocks: [{ codeContent: 'a ```b``` c' }] } }
        const neutralizedCode = ['```', 'a `' + ZW + '`' + ZW + '`b`' + ZW + '`' + ZW + '` c', '```'].join('\n')
        expect(renderAnswer(rich(code)).text).toBe(neutralizedCode)

        const table = { messageType: 4, tableMetadata: { rows: [{ items: ['`````'] }] } }
        const neutralizedCell = ['```', '`' + ZW + '`' + ZW + '`' + ZW + '`' + ZW + '`', '```'].join('\n')
        expect(renderAnswer(rich(table)).text).toBe(neutralizedCell)
    })

    it('joins the parts with a blank line', () => {
        const answer = renderAnswer(rich({ messageType: 2, messageText: 'Intro' }, { messageType: 5, codeMetadata: { codeBlocks: [{ codeContent: 'x' }] } }))
        expect(answer.text).toBe('Intro\n\n```\nx\n```')
    })

    it('skips parts it cannot show and says so', () => {
        expect(renderAnswer(rich({ messageType: 2, messageText: 'Here:' }, { messageType: 3 }))).toEqual({ text: 'Here:', skipped: true })
        expect(renderAnswer(rich({ messageType: 3 }))).toEqual({ text: '', skipped: true })
    })

    it('ignores an empty text part without calling it skipped', () => {
        expect(renderAnswer(rich({ messageType: 2, messageText: '' }))).toEqual({ text: '', skipped: false })
    })

    it('treats a text part without text as empty, not as a part it cannot show', () => {
        expect(renderAnswer(rich({ messageType: 2, messageText: null }))).toEqual({ text: '', skipped: false })
        expect(renderAnswer(rich({ messageType: 2 }))).toEqual({ text: '', skipped: false })
    })

    it('renders what the real decoder gives, where an absent text is null', () => {
        const wire = proto.Message.encode({ richResponseMessage: { messageType: 1, submessages: [{ messageType: 2 }, { messageType: 2, messageText: 'Hi' }] } }).finish()

        expect(renderAnswer(proto.Message.decode(wire))).toEqual({ text: 'Hi', skipped: false })
    })

    it('falls back to a plain message and survives nothing', () => {
        expect(renderAnswer({ conversation: 'Hi' })).toEqual({ text: 'Hi', skipped: false })
        expect(renderAnswer({ extendedTextMessage: { text: 'Hi' } })).toEqual({ text: 'Hi', skipped: false })
        expect(renderAnswer(undefined)).toEqual({ text: '', skipped: false })
    })
})
