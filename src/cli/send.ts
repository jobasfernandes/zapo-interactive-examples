/**
 * Sends one example without the bot:
 *   npm run send -- <command> <phone-digits | group-jid> [args...] [--label "text"]
 * `--label` first sends that plain text, handy to number a batch of test sends.
 */
import { delay, parsePhoneJid } from 'zapo-js'

import { EXAMPLES, findExample } from '../examples/index.js'
import { connectAndWait, createRuntime } from '../lib/client.js'
import { loadConfig } from '../lib/config.js'
import { createLogger } from '../lib/log.js'

function usage(problem: string): never {
    console.error(`${problem}\n\nusage: npm run send -- <command> <phone-digits | group-jid> [args...] [--label "text"]\n`)
    console.error('commands:')
    for (const example of EXAMPLES) console.error(`  ${example.command.padEnd(10)} ${example.description}`)
    process.exit(1)
}

function parseArgs(argv: readonly string[]): { command: string; target: string; args: string[]; label?: string } {
    const rest = [...argv]
    let label: string | undefined
    const labelAt = rest.indexOf('--label')
    if (labelAt >= 0) {
        label = rest[labelAt + 1]
        if (!label) usage('--label needs a text')
        rest.splice(labelAt, 2)
    }
    const [command, target, ...args] = rest
    if (!command) usage('missing command')
    if (!target) usage('missing target')
    return { command, target, args, label }
}

function toJid(target: string): string {
    return target.includes('@') ? target : parsePhoneJid(target.replace(/\D/g, ''))
}

async function main(): Promise<void> {
    const { command, target, args, label } = parseArgs(process.argv.slice(2))
    const example = findExample(command)
    if (!example) usage(`unknown command "${command}"`)

    const config = loadConfig()
    const runtime = await createRuntime(config)
    const { log } = createLogger('send')
    await connectAndWait(runtime)

    const chatJid = toJid(target)
    if (label) {
        const result = await runtime.client.message.send(chatJid, label)
        log(`SENT label "${label}" id=${result.id}`)
    }
    await example.send({ runtime, config, chatJid, log }, args)

    // Gives receipts a moment before closing the socket.
    await delay(4_000)
    await runtime.client.disconnect().catch(() => undefined)
    process.exit(0)
}

main().catch((error: unknown) => {
    console.error(error)
    process.exit(1)
})
