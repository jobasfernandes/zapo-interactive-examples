# Delivery matrix

What each format does on an Android phone and on WhatsApp Web, sent from a linked device with zapo-js 1.10.0 by a WhatsApp Business account. Results observed on 2026-10-16 unless noted. "Renders" means the message shows; "works" means its buttons do what they say.

## Buttons

| Format | Phone | Web | Notes |
|---|---|---|---|
| Legacy `buttonsMessage` inside `documentWithCaptionMessage` | renders | renders | `/buttons` message 1 |
| Native flow `quick_reply` (3 buttons) | renders | renders | answer comes back as `nativeFlowResponseMessage` |
| `cta_url` + `cta_call` + `cta_copy` | renders | renders | actions run on the device, nothing comes back |

## Carousel

| Format | Phone | Web | Notes |
|---|---|---|---|
| Generic cards (image header) + `quick_reply` + `cta_url` | works | works | needs the manual `<biz>` `mixed` node |
| Cards with a product header (`header.productMessage`) | works | "Use your phone" | observed 2026-10-14 |

## Form and webview

| Format | Phone | Web | Notes |
|---|---|---|---|
| A2UI `form_message`, stanza `<native_flow name="mixed">` (zapo default) | "not supported" | works | |
| A2UI `form_message`, stanza `<native_flow name="form_message">` | works | works | phone shows a send button and answers quoting the form |
| `cta_url` with `webview_interaction: true` | opens inside WhatsApp | opens a browser tab | Web has no in-app webview |

## Catalog

| Format | Phone | Web | Notes |
|---|---|---|---|
| `productMessage` (re-uploaded image) | works | works | |
| `productMessage` reusing the stored media reference | dropped silently | dropped silently | observed 2026-10-14 |
| Carousel: generic card + `cta_url` + `cta_catalog` with `catalog_product_id` | works | works | `/catalog` |
| Carousel: generic card + `cta_url` + `cta_catalog` without product id | works | works | `/catalog all`, opens the whole catalog |
| Carousel: product and catalog buttons alternating per card | works | works | `/catalog mixed` |
| Carousel with only `cta_catalog` buttons | dropped | works | observed 2026-10-14 |
| Carousel with `quick_reply` + `cta_catalog` | renders, cards vanish after leaving an item | works | observed 2026-10-14 |
| `cta_catalog` alone (no carousel) | dropped | works | observed 2026-10-14 |
| `wa.me/c/<phone>` link preview (what the app sends) | works | works | `/catalog-link` |
| `catalog_message` without `business_phone_number` | button does nothing | button opens a browser tab | |
| `catalog_message` with `business_phone_number` | works | works, opens the catalog panel | `/catalog-message` |
| `catalog_message` with a product header | works | works, body text shown twice | `/catalog-message product` |
| `review_and_pay` order cards quoting the cart | works | works | bot reaction to a cart |

## Payments (PIX)

| Format | Phone | Web | Notes |
|---|---|---|---|
| `payment_info` with `pix_static_code` | works, "copy PIX key" | works, "copy PIX key" | never shows an amount, even when `total_amount` is set (`/pix`) |
| `review_and_pay` with `pix_static_code`, line without `isCustomItem` | works, opens the native payment flow | card and "copy PIX code" work; the details panel keeps loading | see gotcha 9b |
| `review_and_pay` with `pix_static_code`, line with `isCustomItem: true` | works, opens the native payment flow | works, opens "charge details" | `/charge` |
| `review_and_pay` without a PIX setting (charge made in the Business app) | works | works, opens "charge details" | for comparison |

## Bot menu

| Format | Phone | Web | Notes |
|---|---|---|---|
| Native flow `single_select` list | renders | "Use your phone" | the recipient's pick showed as "update WhatsApp" |
| Native flow `quick_reply` buttons (up to 10) | works | works | |
| Classic `listMessage` inside `documentWithCaptionMessage` | works | works | used by `/menu` |

## Poll

Sent by the bot (a WhatsApp Business account) to a personal account and to an allowed group. Results observed on 2026-10-17 by the owner on the phone and on Web, with the bot log showing each vote.

| Format | Phone | Web | Notes |
|---|---|---|---|
| `pollCreationMessageV3`, single choice, one option per example (`/poll`) | works | works | the vote arrives as a `message_addon` with `selectedOptionNames: null`, see gotcha 14 |
| A changed vote runs the newly picked example | works | works | every vote runs its example; removing the vote does nothing |
| Poll left in the chat after the vote | works | works | no "message deleted" notice; it keeps working as a menu until the bot restarts |
| Same, in an allowed group | works | works | the example is sent to the group |
| Poll revoked by the bot (first version of the command) | shows "message deleted" | not recorded | why the revoke was dropped |
| Button and form answers echoed by the bot | works | works | `• Selected <id>` or `• Tapped "<text>" (<id>)`, quoting the tap; the owner's own taps outside the self-chat are only logged |

## Meta AI

`/ai` sends the question to Meta AI from the paired account. Observed on 2026-10-17 with the bot (a WhatsApp Business account) writing to a personal account and to a group of two members. The first sightings came from a client that looks like WhatsApp Web. On 2026-10-18 the owner saw the label and the notice on both the phone and WhatsApp Web, so those two phone cells are filled; the other cells of the phone column stay "not recorded". The group was watched from the other member's session.

| Format | Phone | Web | Notes |
|---|---|---|---|
| "Thinking…" quoting the question, edited into the answer | not recorded | works | the bubble gets the "Edited" tag and keeps the quote, because the edit repeats `quote`; `editKey: { id }` is enough |
| AI label: `<bot biz_bot="1"/>` on the placeholder, private chat | shows the "IA" mark in the bubble | shows "IA" with a sparkle next to the time | stays after the edit; a node only on the edit does nothing |
| System notice after the first labeled message | WhatsApp adds the notice | WhatsApp adds one line once ("A IA da Meta recebe as mensagens da conversa e pode usá-las para melhorar a própria qualidade e para gerar mensagens para esta empresa") | the client's own text for business AI chats, in the account's language |
| `/ai` in a private chat with `META_HOSTED_BANNER=true`, the first message the bot writes to that chat in the run | works as expected, and the Meta-hosted banner shows | works as expected, and the Meta-hosted banner shows | observed 2026-10-18 on the owner's account: the 👋 goes first without the label, then the "Thinking…" carries the label and the hosted stamp; the edit and any fallback go out untouched, and the prompt to Meta AI is not stamped |
| The same node in a group | refused | refused | the server answers NACK 479, not retryable; the same message without the node is delivered |
| Edit of the placeholder in a group | not checked | arrives as a type 14 message that targets the placeholder id | `editKey: { id }` alone; adding `participant` changed nothing |
| Prompt sent over a stale Signal session with Meta AI | single tick in the Meta AI chat, never answered | n/a | the prompt is acked, no chunk comes, and Meta AI asks for retries that zapo rejects; dropping the stored session fixes it (gotcha 21) |
| The answer stream | n/a | n/a | the first chunk comes 0.7 to 1.7 s after the send ack with the first words, then 3 to 5 edit chunks that each hold the whole text so far, about 3 s for 120 words; two prompts in flight at once each got their own answer, but the bot sends one at a time (README, Meta AI) |

## Disappearing after reading

Messages sent with `contextInfo.afterReadDuration` (plus `disappearingMode` and `ephemeralSettingTimestamp`) vanish after being read, with no "message deleted" notice. It is an experiment, not a feature of the examples: it switches the recipient's chat to disappearing messages, see gotcha 16. Observed on 2026-10-17 from the Business account to a personal account, with `afterReadDuration` 20.

| Format | Phone | Web | Notes |
|---|---|---|---|
| Text | vanishes | vanishes | |
| List menu, buttons (legacy, quick reply, CTA), carousel, A2UI form, webview, PIX key, PIX charge | vanish | vanish | the phone took longer than 20 s |
| Poll, raw `pollCreationMessageV3.contextInfo` | vanishes | vanishes | on the phone one poll seemed to vanish only when the sender disconnected; the next run did not repeat it |
| Poll, `contextInfo` in the send options | vanishes | vanishes | |
| Poll, typed `{ type: 'poll', contextInfo }` | stays | stays | zapo 1.10 drops the content-level `contextInfo` of a poll, see gotcha 15 |
| Side effect on the recipient | chat switched to disappearing messages (20 s) | same | the owner turned it off by hand; each new batch turned it on again, and each change left a system notice ("The duration of disappearing messages was updated ...") that stays in the chat |
| `expirationSeconds: 60` on a single message | stays | stays | the per-message expiration did nothing |

## Business privacy mode

| Format | Phone | Web | Notes |
|---|---|---|---|
| `<biz actual_actors="2" host_storage="2" privacy_mode_ts>` on the list menu only, chat that already existed | not checked | shows "This business is now using a secure service from Meta..." once | first test |
| Same attrs on every bot message, chat that already existed (messages cleared) | shows the banner once | no new banner | Web had stored the mode with a newer timestamp |
| Same attrs on every bot message, chat deleted and opened again from the phone | no banner | banner three times | each Web re-sync with the server cleared the stored mode (gotcha 12) |
| Same attrs on every bot message, chat deleted and opened again from Web | shows the banner | shows the banner | |
| Meta attrs on the first message per chat only, chat deleted on both sides and opened from Web | shows the banner once | shows the banner once | later unstamped messages (buttons, PIX): no repeat |
| Same, after a bot restart, chat opened from Web while the phone still had the Meta mode | no banner | shows the banner once | the phone keeps the mode after the chat is deleted |
| 👋 stamped end-to-end, then the first message stamped as hosted by Meta (current `META_HOSTED_BANNER`), chat opened from the phone that still had the Meta mode | shows the banner once, with "end-to-end encrypted" notices around it (three in total) | not recorded | the last notice came after the first unstamped reply, then no more |
| Same, after a bot restart, chat opened from Web | shows the banner once, no repeats | shows the banner once, no repeats | several commands exchanged after it |

## Group status

Sent to the group jid inside `groupStatusMessageV2`, with `<meta is_group_status="true" origin="group_status">` in the stanza; the server ack carried `is_group_status="true"` both times. Web was checked by reading its status list (`StatusCollection.getValidStatus`), the phone by eye.

| Format | Phone | Web | Notes |
|---|---|---|---|
| Text status: `extendedTextMessage` with `backgroundArgb`, `textArgb` and `font: 6` | shows on the group's status | listed under the group in Status, text and color kept | test send, not a bot command; stanza `type="text"` |
| Image status: the 1080x1920 banner with caption and thumbnail (`/group-status`) | shows on the group's status | listed under the group in Status, with caption and thumbnail | stanza `type="media"`, `<enc mediatype="image">` |

## Groups

| Format | Result | Notes |
|---|---|---|
| `/buttons` in an allowed group | all 3 messages delivered | the third send logged an ack timeout (10 s) even though it arrived |
| List message in a group | delivered | zapo 1.10 sends the group stanza shape (`type=media`, `mediatype=list`) |
