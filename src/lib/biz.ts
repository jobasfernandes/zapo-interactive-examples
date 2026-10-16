import type { WaSendMessageOptions } from 'zapo-js'

/**
 * zapo attaches the `<biz>` native flow companion only when the top-level message has a
 * `nativeFlowMessage`. A carousel keeps its buttons inside the cards, so the companion
 * has to be passed by hand, or the server drops the message. `mixed` is the only name
 * the server accepts here (alternative envelopes come back with ack 473).
 */
export const MIXED_BIZ_OPTIONS = {
    customNodes: [
        {
            tag: 'biz',
            attrs: {},
            content: [
                {
                    tag: 'interactive',
                    attrs: { type: 'native_flow', v: '1' },
                    content: [{ tag: 'native_flow', attrs: { v: '9', name: 'mixed' }, content: undefined }]
                }
            ]
        }
    ]
} as unknown as WaSendMessageOptions
