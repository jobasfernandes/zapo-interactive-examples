# Gotchas

Silent failures found while building these examples, as symptom and cause. Read the matching entry before changing the related code.

| Before touching | Read |
|---|---|
| `src/lib/native-flow-name.ts`, `src/examples/form.ts`, `src/examples/catalog-solo.ts` | 1, 2, 7 |
| `src/lib/media.ts`, product and catalog examples | 3 |
| `src/lib/biz.ts`, carousels | 4, 5, 5b |
| `src/examples/menu.ts` | 6 |
| `src/lib/catalog-history.ts` | 8, 9 |
| `src/lib/client.ts` | 10 |
| `src/lib/biz-privacy.ts`, `META_HOSTED_BANNER` | 12 |
| `src/examples/group-status.ts`, `/group-status` | 3, 13 |

## 1. A2UI form shows "not supported" on Android

- **Symptom:** the `form_message` opens on WhatsApp Web but the phone says the message is not supported.
- **Cause:** Android picks the native flow parser from the stanza companion node `<biz><interactive type="native_flow"><native_flow name="..."/>`, not from the button in the encrypted proto. zapo always sends `name="mixed"`. Only `form_message` (and `catalog_message`) runs the right parser. Android has a fallback that reads the proto button, but only for bot senders.
- **Fix:** rename the node to `<native_flow name="form_message"/>` for that message id (`installNativeFlowRewrite`). Reported upstream: [vinikjkkj/zapo#317](https://github.com/vinikjkkj/zapo/issues/317).

## 2. Form answered on the phone shows "Use your phone" on Web

- **Symptom:** the answer bubble is fine on the phone but unreadable on the same person's WhatsApp Web.
- **Cause:** Android always answers a form with `nativeFlowResponseMessage.version: 3` (and quotes the form); Web rejects any version above 1. Web's own answer uses `version: 1`.
- **Fix:** none on the sender side; the bot reads both.

## 3. Product sent but nobody sees it

- **Symptom:** the server acks the `productMessage`, the receipt stays at delivered, and nothing shows on any client.
- **Cause:** the image reused the media reference stored with an old message.
- **Fix:** download the bytes and upload them again before every send (`reuploadImage`).

## 4. Carousel dropped

- **Symptom:** a carousel never arrives.
- **Cause:** zapo only attaches the `<biz>` native flow node when the top-level message has a `nativeFlowMessage`; carousel buttons live inside the cards.
- **Fix:** pass the `mixed` node yourself (`MIXED_BIZ_OPTIONS`). Other envelopes, like a named `cta_catalog` node or `quality_control`, are rejected with ack 473.

## 5. `cta_catalog` carousel missing on the phone

- **Symptom:** a carousel whose only buttons are `cta_catalog`, or a lone `cta_catalog` message, is dropped by the phone and only shows on Web.
- **Fix:** add a `cta_url` button to every card. With `quick_reply` + `cta_catalog` the phone renders the carousel but the cards vanish after you open an item and come back.

## 5b. Product carousel shows "Use your phone" on Web

- **Symptom:** a carousel whose cards use a product header (`header.productMessage`) works on the phone, but WhatsApp Web shows "Use your phone to view it" for the whole message.
- **Fix:** use generic cards (image header with the product photo, title and price in the body) plus `cta_url` + `cta_catalog` buttons, as `src/examples/catalog.ts` does.

## 6. List menu blank on Web

- **Symptom:** a list opens on the phone but Web shows "Use your phone".
- **Cause:** Web does not render a native flow `single_select`, nor a bare `listMessage`.
- **Fix:** send the classic `listMessage` wrapped in `documentWithCaptionMessage`.

## 7. `catalog_message` button opens a browser tab or does nothing

- **Symptom:** on Web the button opens `wa.me/c/undefined` in a new tab; on the phone it does nothing.
- **Cause:** Web handles `catalog_message` like `cta_catalog` and builds the link from `business_phone_number`.
- **Fix:** always send `business_phone_number` (the phone number, never the LID: a LID in a catalog link gives a 404).

## 8. No products found although the account sent them

- **Symptom:** catalog examples say there are no products.
- **Cause:** the thread store only knows chats synced from the app state, while messages are filed under the jid they arrived with (often a LID).
- **Fix:** list chats from the messages table itself (`messageThreadJids`).

## 9. `value.toNumber is not a function` when downloading a stored image

- **Cause:** int64 fields of a decoded proto are `Long` objects; deep-copying them into plain objects breaks zapo's media download.
- **Fix:** keep the decoded payload as is and only strip `$unknowns` from what you are about to send.

## 9b. Charge details keep loading on WhatsApp Web

- **Symptom:** a `review_and_pay` charge renders on Web, but clicking it opens a details panel that keeps loading forever. The phone works, including the native payment flow.
- **Cause:** Web looks every order line up in the seller's catalog (`useWAWebOrderDetailItems` -> `CatalogCollection.findProduct` inside a `Promise.all`) unless the line is a custom item. A line that is not a catalog product (like "Charge") makes the lookup fail, and the panel never leaves its loading state.
- **Fix:** send `isCustomItem: true` (and `isQuantitySet: true`) on lines that are not catalog products; real products keep `retailer_id` / `product_id`. Also note that `payment_info` never shows an amount: use a charge when the amount matters.

## 10. Bot and CLI keep disconnecting each other

- **Symptom:** the bot and `npm run send` run at the same time and one of them stops with `stream_error_replaced`.
- **Cause:** both use the same session; WhatsApp keeps only the newest connection of a linked device.
- **Fix:** run one process per session, or point the CLI to another paired session (`AUTH_PATH` / `SESSION_ID`). The runtime stops instead of reconnecting in a loop.

## 11. Ack timeout on group sends that were delivered

- **Symptom:** `query timeout ... after 10000ms` on a group send, yet the message arrived.
- **Cause:** the server ack for a large group fanout can take longer than zapo's default 10 s.
- **Fix:** none needed for the examples; pass a larger `ackTimeoutMs` in the send options if your app depends on the result.

## 12. Meta-hosted banner shows again, or flips to "now end-to-end encrypted"

- **Symptom:** with `META_HOSTED_BANNER=true`, the contact sees "This business is now using a secure service from Meta to manage this chat" more than once, or a "now end-to-end encrypted" message after it.
- **Cause:** each of the contact's devices stores the business privacy mode on its own and adds a system message only when that mode changes and the received `privacy_mode_ts` is strictly newer than the stored one (WhatsApp Web: `WAWebHandlePrivacyModeUpdateMsgAction`, `WAWebBizCreateBizStateChangeNotificationMsgsAction`). WhatsApp Web also re-syncs the business with the server (`updateVerifiedInfo`, on a new chat and later on its own), and for an SMB account the server has no privacy mode, so the stored mode quietly goes back to end-to-end and the next stamped message shows the banner again. Observed 2026-10-16 with every message stamped: three banners in a new chat on Web, with its `verified-business-name` record back to `isSmb: true, privacyMode: null`. Which device opened the chat also changes what each device shows: WhatsApp Web copies the business mode it has stored into the `<biz>` of every message it sends to that business (`WAWebSendMsgCreateFanoutStanza`), and that copy also reaches the contact's phone, while Android does this only for API businesses. A phone keeps the Meta mode after the chat is deleted (it is stored per business), and in a new chat Android shows the end-to-end notice for an SMB account, so a second Meta stamp shows nothing there. On Android, a business message without the attrs can reset the chat to end-to-end (read in the decompiled app, not observed). A copy zapo resends after a retry receipt carries no `<biz>` node at all.
- **Fix:** send the first message per chat in two steps: a 👋 stamped end-to-end, then the message stamped as hosted by Meta with a newer timestamp, which is a mode change on every device; leave later messages unstamped. `installHostedPrivacyMode` keeps this per process (a restart runs the switch again) and keys the stamps by stanza id, so zapo's retries keep them. Nothing reverts the contact's stored mode on purpose except a newer timestamp with another mode, and that shows its own system message.

## 13. Group status acked but never shows

- **Symptom:** the server acks a group status (`groupStatusMessageV2` sent to the group jid), but the members never see it.
- **Cause:** read in zapo's code and changelog while building `/group-status`, none of them hit by the final code:
  - zapo before 1.8 sent the wrapped image as `type="media"` with no `mediatype`, a pair the server acks and drops. zapo 1.8 unwraps `groupStatusMessageV2` to pick both; overriding `type` through `additionalAttributes` brings the bad pair back.
  - zapo normalizes an id without `@g.us` (and without a hyphen) to `@s.whatsapp.net`, a private chat.
  - `font` written as a string (`'SYSTEM_BOLD'`, as in whatsmeow's JSON dumps) is encoded as 0: zapo's encoder only takes enum numbers (`SYSTEM_BOLD` is 6).
  - `contextInfo`, `mentions` or `quote` passed in the send options land on the wrapper or on `messageContextInfo`, not on the inner message, and are dropped on encode.
  - On the receiving side, WhatsApp Web hides it when the chat is archived or locked or the group is not trusted, and a phone without the feature shows an "update WhatsApp" bubble instead.
- **Fix:** what `src/examples/group-status.ts` does: `contextInfo.isGroupStatus` written inside the inner message, the 32-byte secret on the outer one, the `<meta is_group_status="true" origin="group_status">` node, and the bot command adds `@g.us`. Upload the image again for every post (entry 3).
