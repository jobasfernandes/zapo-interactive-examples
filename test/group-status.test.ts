import { readFileSync } from 'node:fs'

import { describe, expect, it, vi } from 'vitest'
import type { proto } from 'zapo-js'

import {
    buildGroupStatus,
    GROUP_STATUS_CAPTION,
    GROUP_STATUS_OPTIONS,
    groupStatusExample
} from '../src/examples/group-status.js'
import type { ExampleContext } from '../src/examples/types.js'
import type { Runtime } from '../src/lib/client.js'
import { parseConfig } from '../src/lib/config.js'

const GROUP = '120363000000000000@g.us'
const JPEG_MAGIC = [0xff, 0xd8, 0xff]

/** Width and height from the first SOF0/SOF2 marker of a baseline or progressive JPEG. */
function jpegSize(bytes: Uint8Array): { width: number; height: number } {
    let at = 2
    while (at < bytes.length) {
        const marker = bytes[at + 1]
        const length = (bytes[at + 2] << 8) | bytes[at + 3]
        if (marker === 0xc0 || marker === 0xc2) {
            return { height: (bytes[at + 5] << 8) | bytes[at + 6], width: (bytes[at + 7] << 8) | bytes[at + 8] }
        }
        at += 2 + length
    }
    throw new Error('no SOF marker')
}

function startsWithJpegMagic(bytes: Uint8Array | null | undefined): boolean {
    return JPEG_MAGIC.every((byte, index) => bytes?.[index] === byte)
}

function fakeContext(chatJid: string) {
    const upload = vi.fn(async () => ({
        url: 'https://mmg.whatsapp.net/x',
        directPath: '/x',
        mediaKey: new Uint8Array(32),
        fileSha256: new Uint8Array(32),
        fileEncSha256: new Uint8Array(32),
        fileLength: 1,
        mediaKeyTimestamp: 1,
        mimetype: 'image/jpeg'
    }))
    const send = vi.fn(async () => ({ id: 'SENT1' }))
    const runtime = { client: { message: { upload, send } } } as unknown as Runtime
    const ctx: ExampleContext = { runtime, config: parseConfig({}), chatJid, log: () => undefined }
    return { ctx, upload, send }
}

describe('buildGroupStatus', () => {
    it('wraps the image in groupStatusMessageV2 with isGroupStatus on the inner message', () => {
        const content = buildGroupStatus({ url: 'https://mmg.whatsapp.net/x', mimetype: 'image/jpeg' }, new Uint8Array(32).fill(7)) as proto.IMessage
        expect(content.groupStatusMessageV2?.message?.imageMessage).toMatchObject({
            url: 'https://mmg.whatsapp.net/x',
            contextInfo: { isGroupStatus: true }
        })
    })

    it('keeps the 32-byte message secret on the outer message only', () => {
        const secret = new Uint8Array(32).fill(7)
        const content = buildGroupStatus({ mimetype: 'image/jpeg' }, secret) as proto.IMessage
        expect(content.messageContextInfo?.messageSecret).toEqual(secret)
        expect(content.groupStatusMessageV2?.message?.messageContextInfo).toBeUndefined()

        const generated = buildGroupStatus({ mimetype: 'image/jpeg' }) as proto.IMessage
        expect(generated.messageContextInfo?.messageSecret?.length).toBe(32)
    })
})

describe('GROUP_STATUS_OPTIONS', () => {
    it('sends the <meta> node the Android app attaches, skips the disappearing-messages inject and waits longer for the ack', () => {
        expect(GROUP_STATUS_OPTIONS).toEqual({
            customNodes: [{ tag: 'meta', attrs: { is_group_status: 'true', origin: 'group_status' }, content: undefined }],
            disableGroupEphemeralAutoInject: true,
            ackTimeoutMs: 30_000
        })
    })
})

describe('groupStatusExample', () => {
    it('refuses a chat that is not a group, before uploading anything', async () => {
        const { ctx, upload, send } = fakeContext('5511999999999@s.whatsapp.net')

        await expect(groupStatusExample.send(ctx, [])).rejects.toThrow('@g.us')
        expect(upload).not.toHaveBeenCalled()
        expect(send).not.toHaveBeenCalled()
    })

    it('posts the banner as a group status with caption, size and thumbnail', async () => {
        const { ctx, upload, send } = fakeContext(GROUP)

        const ids = await groupStatusExample.send(ctx, [])

        expect(ids).toEqual(['SENT1'])
        expect(upload).toHaveBeenCalledTimes(1)
        const [bytes, uploadOptions] = upload.mock.calls[0] as unknown as [Uint8Array, unknown]
        expect(startsWithJpegMagic(bytes)).toBe(true)
        expect(uploadOptions).toEqual({ type: 'image', mimetype: 'image/jpeg' })

        const [to, content, options] = send.mock.calls[0] as unknown as [string, proto.IMessage, unknown]
        expect(to).toBe(GROUP)
        expect(options).toBe(GROUP_STATUS_OPTIONS)
        const image = content.groupStatusMessageV2?.message?.imageMessage
        expect(image).toMatchObject({
            url: 'https://mmg.whatsapp.net/x',
            mimetype: 'image/jpeg',
            caption: GROUP_STATUS_CAPTION,
            width: 1080,
            height: 1920,
            contextInfo: { isGroupStatus: true }
        })
        expect(startsWithJpegMagic(image?.jpegThumbnail)).toBe(true)
    })
})

describe('banner assets', () => {
    it('ships a 1080x1920 JPEG banner and a portrait JPEG thumbnail no larger than 100 px', () => {
        expect(jpegSize(readFileSync('assets/group-status.jpg'))).toEqual({ width: 1080, height: 1920 })
        const thumb = jpegSize(readFileSync('assets/group-status-thumb.jpg'))
        expect(Math.max(thumb.width, thumb.height)).toBeLessThanOrEqual(100)
        expect(thumb.height).toBeGreaterThan(thumb.width)
    })

    it('links the repo in the caption', () => {
        expect(GROUP_STATUS_CAPTION).toContain('https://github.com/jobasfernandes/zapo-interactive-examples')
    })
})
