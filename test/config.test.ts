import { describe, expect, it } from 'vitest'

import { parseConfig, parseGroupList, parseNumberList } from '../src/lib/config.js'

describe('parseConfig', () => {
    it('applies the documented defaults', () => {
        expect(parseConfig({})).toEqual({
            authPath: '.auth/session.sqlite',
            sessionId: 'default',
            allowedNumbers: [],
            allowedGroups: [],
            logLevel: 'warn',
            ctaUrl: 'https://github.com/vinikjkkj/zapo',
            webviewUrl: 'https://github.com/vinikjkkj/zapo',
            imageUrl: 'https://placehold.co/640x640/png',
            ctaCallNumber: undefined
        })
    })

    it('normalizes messy number lists to digits', () => {
        expect(parseNumberList('+55 11 99999-9999, ,5511888888888,')).toEqual(['5511999999999', '5511888888888'])
        expect(parseNumberList('')).toEqual([])
        expect(parseNumberList(undefined)).toEqual([])
    })

    it('keeps group jids and appends @g.us when missing', () => {
        expect(parseGroupList('120363000000000000@g.us, 120363000000000001')).toEqual([
            '120363000000000000@g.us',
            '120363000000000001@g.us'
        ])
    })

    it('rejects an unknown LOG_LEVEL', () => {
        expect(() => parseConfig({ LOG_LEVEL: 'loud' })).toThrow(/LOG_LEVEL/)
    })
})
