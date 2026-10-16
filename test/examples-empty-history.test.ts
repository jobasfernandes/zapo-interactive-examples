import { createSqliteStore, openSqliteConnection } from '@zapo-js/store-sqlite'
import { describe, expect, it, vi } from 'vitest'

import { catalogMessageExample } from '../src/examples/catalog-solo.js'
import { catalogExample } from '../src/examples/catalog.js'
import { productExample } from '../src/examples/product.js'
import type { Example, ExampleContext } from '../src/examples/types.js'
import { NO_PRODUCTS_TEXT } from '../src/lib/catalog-history.js'
import type { Runtime } from '../src/lib/client.js'
import { parseConfig } from '../src/lib/config.js'

async function emptyContext(sessionId: string) {
    const connection = await openSqliteConnection({ path: ':memory:', driver: 'auto', sessionId })
    const send = vi.fn(async () => ({ id: 'SENT1' }))
    const runtime = {
        client: { message: { send } },
        sqlite: createSqliteStore({ connection }),
        connection,
        sessionId,
        armNativeFlow: vi.fn()
    } as unknown as Runtime
    const ctx: ExampleContext = { runtime, config: parseConfig({}), chatJid: '5511999999999@s.whatsapp.net', log: () => undefined }
    return { ctx, send }
}

const cases: [string, Example, string[]][] = [
    ['product', productExample, []],
    ['catalog', catalogExample, []],
    ['catalog-message product', catalogMessageExample, ['product']]
]

describe('catalog examples with no products in history', () => {
    it.each(cases)('%s answers with the prerequisite text', async (name, example, args) => {
        const { ctx, send } = await emptyContext(`empty-${name.replace(/\s/g, '-')}`)

        const ids = await example.send(ctx, args)

        expect(send).toHaveBeenCalledWith('5511999999999@s.whatsapp.net', NO_PRODUCTS_TEXT)
        expect(ids).toEqual(['SENT1'])
    })
})
