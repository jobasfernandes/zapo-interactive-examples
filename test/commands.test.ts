import { describe, expect, it } from 'vitest'

import { extractSelection, extractText, parseCommand } from '../src/lib/commands.js'

describe('parseCommand', () => {
    it('parses a slash command with surrounding spaces and mixed case', () => {
        expect(parseCommand('  /Form  ')).toEqual({ name: 'form', args: [], rest: '' })
    })

    it('splits arguments on whitespace', () => {
        expect(parseCommand('/catalog all')).toEqual({ name: 'catalog', args: ['all'], rest: 'all' })
    })

    it('keeps the raw text after the name, line breaks included', () => {
        expect(parseCommand('/ai what is\na webhook?')).toEqual({ name: 'ai', args: ['what', 'is', 'a', 'webhook?'], rest: 'what is\na webhook?' })
    })

    it('has an empty rest when nothing follows the name', () => {
        expect(parseCommand('/ai')).toEqual({ name: 'ai', args: [], rest: '' })
        expect(parseCommand('  /AI   ')).toEqual({ name: 'ai', args: [], rest: '' })
    })

    it('trims the rest at both ends and keeps the spacing inside', () => {
        expect(parseCommand('/ai   a   b  ')?.rest).toBe('a   b')
    })

    it('ignores text without a leading slash', () => {
        expect(parseCommand('menu')).toBeNull()
        expect(parseCommand('see /form later')).toBeNull()
        expect(parseCommand('/')).toBeNull()
        expect(parseCommand(null)).toBeNull()
    })
})

describe('extractText', () => {
    it('unwraps ephemeral and device-sent messages', () => {
        expect(extractText({ ephemeralMessage: { message: { extendedTextMessage: { text: '/menu' } } } })).toBe('/menu')
        expect(extractText({ deviceSentMessage: { message: { conversation: '/help' } } })).toBe('/help')
    })

    it('returns null for non-text messages', () => {
        expect(extractText({ imageMessage: {} })).toBeNull()
        expect(extractText(undefined)).toBeNull()
    })
})

describe('extractSelection', () => {
    it('reads the id picked in a native flow menu', () => {
        expect(
            extractSelection({
                interactiveResponseMessage: {
                    nativeFlowResponseMessage: { name: 'single_select', paramsJson: '{"id":"/buttons"}' }
                }
            })
        ).toBe('/buttons')
    })

    it('reads legacy button and list replies', () => {
        expect(extractSelection({ buttonsResponseMessage: { selectedButtonId: '/carousel' } })).toBe('/carousel')
        expect(extractSelection({ listResponseMessage: { singleSelectReply: { selectedRowId: '/form' } } })).toBe('/form')
    })

    it('returns null for a form answer without an id', () => {
        expect(
            extractSelection({
                interactiveResponseMessage: {
                    nativeFlowResponseMessage: { name: 'form_message', paramsJson: '{"atendimento":"otimo"}' }
                }
            })
        ).toBeNull()
    })
})
