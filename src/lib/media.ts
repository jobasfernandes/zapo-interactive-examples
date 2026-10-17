import type { proto, WaClient } from 'zapo-js'

type UploadResult = Awaited<ReturnType<WaClient['message']['upload']>>

function toImageMessage(media: UploadResult, mimetype: string): proto.Message.IImageMessage {
    return {
        url: media.url,
        directPath: media.directPath,
        mediaKey: media.mediaKey,
        fileSha256: media.fileSha256,
        fileEncSha256: media.fileEncSha256,
        fileLength: media.fileLength,
        mediaKeyTimestamp: media.mediaKeyTimestamp,
        mimetype: media.mimetype ?? mimetype
    }
}

export async function uploadImage(client: WaClient, bytes: Uint8Array, mimetype: string): Promise<proto.Message.IImageMessage> {
    return toImageMessage(await client.message.upload(bytes, { type: 'image', mimetype }), mimetype)
}

export async function uploadImageFromUrl(client: WaClient, url: string): Promise<proto.Message.IImageMessage> {
    const response = await fetch(url)
    if (!response.ok) throw new Error(`image download failed: HTTP ${response.status} for ${url}`)
    const mimetype = response.headers.get('content-type')?.split(';')[0] ?? 'image/jpeg'
    return uploadImage(client, new Uint8Array(await response.arrayBuffer()), mimetype)
}

/**
 * Downloads and uploads an image again. Re-sending a media reference taken from
 * the store makes the recipient's client drop the message silently.
 */
export async function reuploadImage(
    client: WaClient,
    image: proto.Message.IImageMessage
): Promise<proto.Message.IImageMessage> {
    const mimetype = image.mimetype ?? 'image/jpeg'
    const bytes = await client.message.downloadBytes({ imageMessage: image })
    const fresh = toImageMessage(await client.message.upload(bytes, { type: 'image', mimetype }), mimetype)
    return { ...fresh, width: image.width ?? undefined, height: image.height ?? undefined }
}
