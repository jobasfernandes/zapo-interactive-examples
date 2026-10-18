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
| `src/bot/handle.ts` (`decideVote`), `/poll` | 14, 15 |
| any message with `afterReadDuration` or `disappearingMode` in its `contextInfo` | 16 |
| `src/lib/meta-ai.ts`, `/ai` | 17 |
| `src/bot/ai-reply.ts`, the AI label (`<bot biz_bot="1"/>`) | 18, 19, 20 |
| `forgetBotSession`, the Meta AI session | 21 |
| `AI_SYSTEM_PROMPT`, who may use `/ai` | 22 |

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

## 14. Poll vote arrives and nothing happens

- **Symptom:** a `message_addon` with `kind: 'poll_vote'` is delivered for a poll the bot sent, but nothing runs. With a revoke timer, the poll just disappears after the timeout.
- **Cause:** zapo 1.10 keeps the *secret* of a poll it sends, not the poll itself (the store has no `from_me` rows), so it cannot map the vote back to option names: `decrypted.selectedOptionNames` is `null`. The vote still carries `decrypted.pollVote.selectedOptions`, the SHA-256 of each chosen option text.
- **Fix:** match those hashes against the SHA-256 of the options you sent. `decideVote` does it with the example titles.

## 15. Poll sent with `contextInfo` goes out without it

- **Symptom:** `{ type: 'poll', ..., contextInfo }` reaches the recipient with none of the context info (no mentions, expiration or after-read fields).
- **Cause:** zapo 1.10 reads a content-level `contextInfo` only for text and media (`pickContentContextInfo`). The poll builder ignores it, although the type declares it.
- **Fix:** pass `contextInfo` in the send options (`send(jid, content, { contextInfo })`), which zapo applies to the poll body, or send the raw `pollCreationMessageV3` with its own `contextInfo`.

## 16. A message that vanishes after reading also turns on disappearing messages in the chat

- **Symptom:** a message sent with `contextInfo.afterReadDuration` (plus `disappearingMode` and `ephemeralSettingTimestamp`, the trick from Baileys examples) vanishes after being read with no "message deleted" notice, but the recipient's chat then shows disappearing messages on (20 s in the test), on the phone and on Web, until they turn it off. Each time the client takes the setting in, it also adds a system notice to the chat ("The duration of disappearing messages was updated. New messages will disappear from this chat 20 seconds after sending ..."). The notices are not disappearing messages, so they stay (four piled up in the test).
- **Cause:** the receiving client applies those fields as the chat's disappearing-messages setting, not as a property of that one message, and every new batch turned it on again. Text, the list menu, the buttons, the carousel, the A2UI form, the webview, the PIX and charge cards and polls (raw, or through the send options) all vanished this way. `expirationSeconds` on a single message did nothing.
- **Fix:** none that is safe to ship. Do not send these fields to a real chat; the recipient switches it off in the contact's "Disappearing messages". A revoke is the only per-message removal, and it leaves the "message deleted" notice.

## 17. Meta AI answer comes out repeated or garbled when the chunks are joined

- **Symptom:** the answer to a prompt sent with `client.bot.sendPrompt` has its text repeated, or each growing prefix glued to the next one.
- **Cause:** zapo's doc comment on `tryDecryptChunk` says to concatenate the `message_bot_chunk` events. They are not pieces: the `first` chunk holds the start of the answer, and every later one (`inner`, `last`) is a type 14 edit whose `editedMessage.richResponseMessage` holds the whole text so far. The last snapshot is usually repeated by one or two extra `inner` chunks.
- **Fix:** keep only the latest snapshot and end at `last` or `full`, as `src/lib/meta-ai.ts` does. Match chunks to prompts by `targetMessageId`, and register the wait before sending: a chunk can arrive before `sendPrompt` resolves.

## 18. A send with the AI label node fails in a group

- **Symptom:** `MessagePublishNackError: negative publish ack ... error=479` (`retryable: false`), in about 120 ms, when a message with `<bot biz_bot="1"/>` goes to a group. The same message without the node is delivered.
- **Cause:** the server accepts the node in private chats only and refuses the stanza in groups.
- **Fix:** never send the node to a `@g.us` chat (`src/bot/ai-reply.ts` decides by `ChatContext.isGroup`). If a private chat rejects it too, send the message again without it.

## 19. The AI label is missing after the message was edited

- **Symptom:** a message that was edited shows no "IA" mark when the `<bot>` node was only on the edit stanza, while the same message with the node on its first stanza keeps the mark through the edit.
- **Cause:** the mark belongs to the first stanza of a message; an edit neither adds nor removes it.
- **Fix:** put the node on the first message (the "Thinking…" placeholder, or the new message when the edit failed) and leave the edit plain.

## 20. WhatsApp adds a Meta AI notice to the chat after the first labeled message

- **Symptom:** the contact's chat gets a system line right before the first message with the AI label ("A IA da Meta recebe as mensagens da conversa e pode usá-las para melhorar a própria qualidade e para gerar mensagens para esta empresa. Clique para saber mais." in Portuguese).
- **Cause:** it is the client's own text for chats with a business AI. It says more than the bot does: only the `/ai` question goes to Meta AI, not the conversation.
- **Fix:** none; it appears once per chat. Warn the people you test with, because the label is on for every private chat in which `/ai` answers.

## 21. Meta AI never answers: the prompt is acked and no chunk comes

- **Symptom:** `client.bot.sendPrompt` resolves with an ack, no `message_bot_chunk` ever arrives (`/ai` ends in "did not answer in time"), and in the Meta AI chat of the paired phone the bot's prompt shows a single tick, so it never reached Meta AI. With `LOG_LEVEL=debug` the log has, right after the send, `retry request rejected: missing compatible session` with `requester: '867051314767696@bot'`.
- **Cause:** Meta AI lost its side of the Signal session with the account (a few hours after the last prompt, on a personal and a Business account at once). Our stored session is stale: the prompts are encrypted with it, Meta AI cannot read them and asks for a retry, zapo cannot serve that retry, and the stale session stays. Restarting the bot does not help.
- **Fix:** drop the stored session with `867051314767696@bot` (the `signal_session` row; the identity can stay) so zapo builds a new one on the next send, which then answers in about 1 s. `src/lib/meta-ai.ts` does it through the store (`forgetBotSession`) before the first prompt of every new thread; a chat whose question got no chunk at all starts a new thread, so its next question resets again (another chat with a live thread can still lose one question on the stale session first). The bot sends one prompt at a time, so the reset never cuts an answer that is still streaming; only one the bot had already given up on after 35 s can lose its tail.

## 22. A contact reads what another chat told /ai

- **Symptom:** asking `/ai` in one chat what code word or fact someone told it earlier returns what another chat said, in the same run and also after a restart. "What do you remember about me?" lists facts from other chats.
- **Cause:** Meta AI ties its memory to the paired account, not to `aiThreadId`: a thread per chat keeps the follow-ups of one chat together, but it is no wall between chats. Measured with code words planted in one chat and asked for in another; without a guardrail the word came back in every run.
- **Fix:** none in code. Asking the model in `AI_SYSTEM_PROMPT` to keep conversations apart did not work: a generic sentence let the word through; "start fresh and keep nothing" blocked it but makes the model say something false; an honest "I cannot share anything from other conversations" blocked it but also refused a follow-up in the same chat; and a version that allowed the current conversation leaked again and refused the person's own data. So treat the allowlist as one circle of trust, never put a secret in `AI_SYSTEM_PROMPT`, and give the bot a number of its own, because the account's memory also holds whatever its owner told Meta AI.
