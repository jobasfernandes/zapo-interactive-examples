import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

import { loadConfig, parseConfig, parseGroupList, parseNumberList } from '../src/lib/config.js'

describe('loadConfig', () => {
    it('reads a .env file when it exists', () => {
        const dir = mkdtempSync(join(tmpdir(), 'zapo-examples-'))
        const file = join(dir, '.env')
        writeFileSync(file, 'ALLOWED_GROUPS=120363000000000000@g.us\n')
        try {
            expect(loadConfig(file).allowedGroups).toEqual(['120363000000000000@g.us'])
        } finally {
            delete process.env.ALLOWED_GROUPS
            rmSync(dir, { recursive: true, force: true })
        }
    })

    it('works without a .env file', () => {
        expect(loadConfig(join(tmpdir(), 'missing-zapo-examples.env')).sessionId).toBeTypeOf('string')
    })
})

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
            ctaCallNumber: undefined,
            pix: { merchantName: 'vinikjkkj (zapo)', key: '+5511982905991', keyType: 'PHONE' },
            metaHostedBanner: false
        })
    })

    it('reads AI_SYSTEM_PROMPT and treats an empty or blank value as none', () => {
        expect(parseConfig({ AI_SYSTEM_PROMPT: '  Answer in two sentences.  ' }).aiSystemPrompt).toBe('Answer in two sentences.')
        expect(parseConfig({ AI_SYSTEM_PROMPT: '   ' }).aiSystemPrompt).toBeUndefined()
        expect(parseConfig({}).aiSystemPrompt).toBeUndefined()
    })

    it('rejects an unknown PIX_KEY_TYPE', () => {
        expect(() => parseConfig({ PIX_KEY_TYPE: 'IBAN' })).toThrow(/PIX_KEY_TYPE/)
        expect(parseConfig({ PIX_KEY: '+5511999999999', PIX_KEY_TYPE: 'phone' }).pix.keyType).toBe('PHONE')
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

    it('reads META_HOSTED_BANNER as a strict boolean', () => {
        expect(parseConfig({ META_HOSTED_BANNER: 'true' }).metaHostedBanner).toBe(true)
        expect(parseConfig({ META_HOSTED_BANNER: ' TRUE ' }).metaHostedBanner).toBe(true)
        expect(parseConfig({ META_HOSTED_BANNER: 'false' }).metaHostedBanner).toBe(false)
        expect(parseConfig({ META_HOSTED_BANNER: '' }).metaHostedBanner).toBe(false)
        expect(() => parseConfig({ META_HOSTED_BANNER: 'yes' })).toThrow(/META_HOSTED_BANNER/)
        expect(() => parseConfig({ META_HOSTED_BANNER: '1' })).toThrow(/META_HOSTED_BANNER/)
    })
})
