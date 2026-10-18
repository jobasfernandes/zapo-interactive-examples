import { Readable } from 'node:stream'

import { describe, expect, it } from 'vitest'
import type { WaIncomingMessageEvent } from 'zapo-js'

import { readIncomingImage } from '../src/lib/incoming-image.js'

const eventWith = (message: object) => ({ key: { id: 'IMG' }, message }) as unknown as WaIncomingMessageEvent
const stream = (...parts: number[][]) => Readable.from(parts.map((part) => Uint8Array.from(part)))

describe('readIncomingImage', () => {
    it('collects the downloaded bytes and keeps the declared mimetype', async () => {
        const event = eventWith({ imageMessage: { mimetype: 'image/png', caption: '/ai' } })

        const image = await readIncomingImage(event, async () => stream([1, 2], [3]))

        expect([...image.data]).toEqual([1, 2, 3])
        expect(image.mimetype).toBe('image/png')
    })

    it('asks zapo to download the event itself', async () => {
        const event = eventWith({ imageMessage: { mimetype: 'image/jpeg' } })
        let source: unknown

        await readIncomingImage(event, async (received) => {
            source = received
            return stream([1])
        })

        expect(source).toBe(event)
    })

    it('says image/jpeg when the message declares no mimetype', async () => {
        const image = await readIncomingImage(eventWith({ imageMessage: {} }), async () => stream([1]))

        expect(image.mimetype).toBe('image/jpeg')
    })

    it('finds the photo inside a wrapper', async () => {
        const event = eventWith({ ephemeralMessage: { message: { imageMessage: { mimetype: 'image/webp' } } } })

        const image = await readIncomingImage(event, async () => stream([7]))

        expect([...image.data]).toEqual([7])
        expect(image.mimetype).toBe('image/webp')
    })

    it('throws without downloading when the message has no photo', async () => {
        let downloads = 0
        const download = async () => {
            downloads += 1
            return stream([1])
        }

        await expect(readIncomingImage(eventWith({ conversation: '/ai hi' }), download)).rejects.toThrow('no photo')
        await expect(readIncomingImage(eventWith({ videoMessage: {} }), download)).rejects.toThrow('no photo')
        expect(downloads).toBe(0)
    })

    it('passes on a download failure', async () => {
        const event = eventWith({ imageMessage: { mimetype: 'image/jpeg' } })

        await expect(
            readIncomingImage(event, async () => {
                throw new Error('media gone')
            })
        ).rejects.toThrow('media gone')
    })
})
