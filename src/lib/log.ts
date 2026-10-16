import { appendFileSync, mkdirSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'

export type RunLogger = { log: (msg: string) => void; file: string }

/** Echoes to the console and keeps a clean per-run file at logs/<name>.log (truncated on start). */
export function createLogger(name: string): RunLogger {
    const dir = resolve(process.cwd(), 'logs')
    mkdirSync(dir, { recursive: true })
    const file = resolve(dir, `${name}.log`)
    writeFileSync(file, `# ${name} started ${new Date().toISOString()}\n`)

    const log = (msg: string): void => {
        console.log(msg)
        try {
            appendFileSync(file, `[${new Date().toISOString()}] ${msg}\n`)
        } catch {
            // a log write failure must not take the bot down
        }
    }

    return { log, file }
}

/** One line for a button/form answer (nativeFlowResponseMessage). */
export function formatResponse(
    chatJid: string,
    participant: string | null | undefined,
    name: string | null | undefined,
    paramsJson: string | null | undefined
): string {
    const who = participant ? ` participant=${participant}` : ''
    let params = paramsJson ?? ''
    try {
        params = JSON.stringify(JSON.parse(paramsJson ?? '{}'))
    } catch {
        // keep the raw text when it is not JSON
    }
    return `RESPONSE ${chatJid}${who} name=${name} params=${params}`
}
