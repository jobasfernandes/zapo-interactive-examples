import { existsSync } from 'node:fs'

const LOG_LEVELS = ['trace', 'debug', 'info', 'warn', 'error'] as const

export type LogLevel = (typeof LOG_LEVELS)[number]

const PIX_KEY_TYPES = ['EVP', 'EMAIL', 'PHONE', 'CPF', 'CNPJ'] as const

export type PixKeyType = (typeof PIX_KEY_TYPES)[number]

export type PixConfig = { merchantName: string; key: string; keyType: PixKeyType }

export type Config = {
    authPath: string
    sessionId: string
    allowedNumbers: readonly string[]
    allowedGroups: readonly string[]
    logLevel: LogLevel
    ctaUrl: string
    webviewUrl: string
    imageUrl: string
    ctaCallNumber?: string
    /** Static PIX key shown by /pix (Brazilian instant payments). */
    pix: PixConfig
}

type Env = Record<string, string | undefined>

const DEFAULT_URL = 'https://github.com/vinikjkkj/zapo'

function splitList(raw: string | undefined): string[] {
    return (raw ?? '')
        .split(',')
        .map((item) => item.trim())
        .filter((item) => item.length > 0)
}

/** Phone numbers are compared by digits only, so "+55 11 9999-9999" and "551199999999" match. */
export function parseNumberList(raw: string | undefined): string[] {
    return splitList(raw)
        .map((item) => item.replace(/\D/g, ''))
        .filter((item) => item.length > 0)
}

export function parseGroupList(raw: string | undefined): string[] {
    return splitList(raw).map((item) => (item.includes('@') ? item : `${item}@g.us`))
}

function parseLogLevel(raw: string | undefined): LogLevel {
    const level = (raw ?? 'warn').trim().toLowerCase()
    const known = LOG_LEVELS.find((candidate) => candidate === level)
    if (!known) {
        throw new Error(`LOG_LEVEL must be one of ${LOG_LEVELS.join(', ')}, got "${raw}"`)
    }
    return known
}

function parsePixKeyType(raw: string | undefined): PixKeyType {
    const value = (raw ?? 'PHONE').trim().toUpperCase()
    const known = PIX_KEY_TYPES.find((candidate) => candidate === value)
    if (!known) {
        throw new Error(`PIX_KEY_TYPE must be one of ${PIX_KEY_TYPES.join(', ')}, got "${raw}"`)
    }
    return known
}

function nonEmpty(raw: string | undefined): string | undefined {
    const value = raw?.trim()
    return value ? value : undefined
}

export function parseConfig(env: Env): Config {
    return {
        authPath: nonEmpty(env.AUTH_PATH) ?? '.auth/session.sqlite',
        sessionId: nonEmpty(env.SESSION_ID) ?? 'default',
        allowedNumbers: parseNumberList(env.ALLOWED_NUMBERS),
        allowedGroups: parseGroupList(env.ALLOWED_GROUPS),
        logLevel: parseLogLevel(env.LOG_LEVEL),
        ctaUrl: nonEmpty(env.CTA_URL) ?? DEFAULT_URL,
        webviewUrl: nonEmpty(env.WEBVIEW_URL) ?? DEFAULT_URL,
        imageUrl: nonEmpty(env.IMAGE_URL) ?? 'https://placehold.co/640x640/png',
        ctaCallNumber: nonEmpty(env.CTA_CALL_NUMBER),
        pix: {
            merchantName: nonEmpty(env.PIX_MERCHANT_NAME) ?? 'vinikjkkj (zapo)',
            key: nonEmpty(env.PIX_KEY) ?? '+5511982905991',
            keyType: parsePixKeyType(env.PIX_KEY_TYPE)
        }
    }
}

/** Reads `.env` (when present) into process.env, then parses it. Real env vars win. */
export function loadConfig(envFile = '.env'): Config {
    if (existsSync(envFile)) process.loadEnvFile(envFile)
    return parseConfig(process.env)
}
