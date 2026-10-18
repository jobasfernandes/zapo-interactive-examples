<p align="center">
  <img alt="zapo-interactive-examples" src="docs/assets/banner.png" width="100%">
</p>

<h1 align="center">zapo-interactive-examples</h1>

<p align="center">
  <strong>Real, tested WhatsApp interactive messages with zapo-js: buttons, carousels, A2UI forms, webview, catalog products, catalog messages and order replies, plus a test bot that sends any of them to your phone.</strong>
</p>

<p align="center">
  <sub>Community examples, not an official <a href="https://github.com/vinikjkkj/zapo">zapo</a> project.</sub>
</p>

<p align="center">
  <a href="https://github.com/jobasfernandes/zapo-interactive-examples/actions/workflows/ci.yml"><picture><source media="(prefers-color-scheme: dark)" srcset="https://www.shieldcn.dev/github/ci/jobasfernandes/zapo-interactive-examples.svg?workflow=ci.yml&amp;branch=main&amp;variant=secondary&amp;size=sm&amp;mode=dark"><img alt="CI" src="https://www.shieldcn.dev/github/ci/jobasfernandes/zapo-interactive-examples.svg?workflow=ci.yml&amp;branch=main&amp;variant=secondary&amp;size=sm&amp;mode=light"></picture></a>
  <a href="LICENSE"><picture><source media="(prefers-color-scheme: dark)" srcset="https://www.shieldcn.dev/github/license/jobasfernandes/zapo-interactive-examples.svg?variant=ghost&amp;size=sm&amp;mode=dark"><img alt="License" src="https://www.shieldcn.dev/github/license/jobasfernandes/zapo-interactive-examples.svg?variant=ghost&amp;size=sm&amp;mode=light"></picture></a>
  <a href="https://github.com/jobasfernandes/zapo-interactive-examples/commits/main"><picture><source media="(prefers-color-scheme: dark)" srcset="https://www.shieldcn.dev/github/last-commit/jobasfernandes/zapo-interactive-examples.svg?variant=secondary&amp;size=sm&amp;mode=dark"><img alt="Last commit" src="https://www.shieldcn.dev/github/last-commit/jobasfernandes/zapo-interactive-examples.svg?variant=secondary&amp;size=sm&amp;mode=light"></picture></a>
  <a href="https://github.com/jobasfernandes/zapo-interactive-examples/stargazers"><picture><source media="(prefers-color-scheme: dark)" srcset="https://www.shieldcn.dev/github/stars/jobasfernandes/zapo-interactive-examples.svg?variant=secondary&amp;size=sm&amp;mode=dark"><img alt="GitHub Stars" src="https://www.shieldcn.dev/github/stars/jobasfernandes/zapo-interactive-examples.svg?variant=secondary&amp;size=sm&amp;mode=light"></picture></a>
</p>

<p align="center">
  <a href="https://www.typescriptlang.org/"><picture><source media="(prefers-color-scheme: dark)" srcset="https://www.shieldcn.dev/badge/Language-TypeScript-3178C6.svg?logo=typescript&amp;variant=branded&amp;size=sm&amp;mode=dark"><img alt="Language · TypeScript" src="https://www.shieldcn.dev/badge/Language-TypeScript-3178C6.svg?logo=typescript&amp;variant=branded&amp;size=sm&amp;mode=light"></picture></a>
  <a href="https://nodejs.org/"><picture><source media="(prefers-color-scheme: dark)" srcset="https://www.shieldcn.dev/badge/Runtime-Node.js_20.12+-5FA04E.svg?logo=nodedotjs&amp;variant=branded&amp;size=sm&amp;mode=dark"><img alt="Runtime · Node.js 20.12+" src="https://www.shieldcn.dev/badge/Runtime-Node.js_20.12+-5FA04E.svg?logo=nodedotjs&amp;variant=branded&amp;size=sm&amp;mode=light"></picture></a>
  <a href="https://github.com/vinikjkkj/zapo"><picture><source media="(prefers-color-scheme: dark)" srcset="https://www.shieldcn.dev/badge/WhatsApp-zapo--js_1.10-25D366.svg?logo=whatsapp&amp;variant=branded&amp;size=sm&amp;mode=dark"><img alt="WhatsApp · zapo-js 1.10" src="https://www.shieldcn.dev/badge/WhatsApp-zapo--js_1.10-25D366.svg?logo=whatsapp&amp;variant=branded&amp;size=sm&amp;mode=light"></picture></a>
  <a href="https://vitest.dev/"><picture><source media="(prefers-color-scheme: dark)" srcset="https://www.shieldcn.dev/badge/Tests-Vitest-6E9F18.svg?logo=vitest&amp;variant=branded&amp;size=sm&amp;mode=dark"><img alt="Tests · Vitest" src="https://www.shieldcn.dev/badge/Tests-Vitest-6E9F18.svg?logo=vitest&amp;variant=branded&amp;size=sm&amp;mode=light"></picture></a>
</p>

---

### Table of Contents

- [Overview](#overview)
- [Key Features](#key-features)
- [Quick Start](#quick-start)
- [Who Can Use the Bot](#who-can-use-the-bot)
- [Commands](#commands)
- [Send One Example Without the Bot](#send-one-example-without-the-bot)
- [Configuration](#configuration)
- [Meta-Hosted Banner](#meta-hosted-banner)
- [Group Status](#group-status)
- [Meta AI](#meta-ai)
- [Project Structure](#project-structure)
- [Known Limitations](#known-limitations)
- [Documentation](#documentation)
- [Development](#development)
- [Contributing](#contributing)
- [License](#license)

### Overview

This repository is for developers who use [zapo-js](https://github.com/vinikjkkj/zapo) and want **working** examples of WhatsApp interactive messages. Each message type lives in one short file you can read and copy, and a small test bot sends any of them to the chat you ask from.

Every example here was checked on an Android phone and on WhatsApp Web. What renders where, and the protocol details that make the difference (like the stanza name Android needs to open an A2UI form), are in [docs/delivery-matrix.md](docs/delivery-matrix.md) and [docs/gotchas.md](docs/gotchas.md).

### Key Features

- **Buttons** -- legacy `buttonsMessage`, native flow quick replies and CTA buttons (link, call, copy)
- **Carousel** -- image cards with a quick reply and a link each
- **A2UI form** -- multi-step `form_message` that opens on the phone and on Web
- **Webview** -- link button that opens a page inside WhatsApp on the phone
- **Catalog** -- product cards, product carousels with native catalog buttons, the `wa.me/c` catalog share and the interactive `catalog_message`
- **Orders** -- the seller's `review_and_pay` cards, sent as a reaction to a buyer's cart
- **PIX** -- the static PIX key card and a PIX charge that opens the native payment flow on the phone
- **Poll menu** -- the examples as a poll: each vote is decrypted and runs the example it picks, and the poll stays in the chat as a menu
- **Meta AI** -- `/ai <question>` relays the question to Meta AI through the paired account; a "Thinking…" message is edited into the answer, with the AI label in private chats; a photo with `/ai` as its caption is sent along
- **Group status** -- the repo banner posted as a status of a group (`groupStatusMessageV2`), from the bot or the CLI
- **Test bot** -- `/commands` and a list menu, access limited to allowed numbers and groups
- **Send CLI** -- one example to one chat, no bot needed

### Quick Start

Requirements:

- Node.js 20.12 or newer
- A WhatsApp account to pair as a linked device (it is the bot's identity)
- For the catalog examples only: a **WhatsApp Business** account with a catalog that has already shared its products at least once from the app (open any chat, attach > Catalog, send the products and the catalog). zapo has no catalog API yet, so the examples read the products from the messages the account already sent (see [docs/catalog-api-research.md](docs/catalog-api-research.md)).

```bash
npm install
cp .env.example .env   # optional, every variable has a default
npm start
```

On the first run a QR code shows up in the terminal: scan it in WhatsApp > Linked devices. The session is kept in `.auth/` (gitignored), so later runs connect straight away.

Then, from the phone of the paired account, open your own chat ("Message yourself") and type `/menu`. Typing it in a contact's chat works too, but the examples are then sent to that contact.

Run one process per session: the bot and the send CLI cannot share the same `AUTH_PATH` and `SESSION_ID` at the same time (WhatsApp drops the older connection).

### Who Can Use the Bot

Commands always start with `/`; plain text never triggers the bot.

| Where | Who is answered |
|---|---|
| Your own chat ("Message yourself") | always |
| Any private chat, typed by you (the paired account) | always |
| Private chat with someone else | numbers listed in `ALLOWED_NUMBERS` |
| Group | only groups in `ALLOWED_GROUPS`, and only when the sender is in `ALLOWED_NUMBERS` (or is you) |

Everyone else is ignored; their commands are logged to `logs/bot.log` as `DENIED` so you can check the allowlists. Write numbers the way WhatsApp stores them (in Brazil that is often without the extra ninth digit). Type `/groups` in your own chat to get the id of a group for `ALLOWED_GROUPS`.

A vote on a `/poll` follows the same rules as a command: the voter must be allowed, and a vote from anyone else is logged as `DENIED` and does nothing.

`/group-status` follows the same rules for who may ask, and it only posts to groups in `ALLOWED_GROUPS`, whoever asks.

`/ai` follows the same rules as a command, and whatever it asks is sent to Meta AI from the paired account (see [Meta AI](#meta-ai)).

### Commands

| Command | Sends | Needs a catalog |
|---|---|---|
| `/menu` | a list with every example; picking a row runs it | no |
| `/poll` | a poll with every example; every vote runs the example it picks, and the poll stays in the chat | no |
| `/ai <question>` | the answer from Meta AI: a "Thinking…" message quoting the question is edited into it; follow-ups in the chat keep the context for 30 minutes; as the caption of a photo it asks about the photo (see [Meta AI](#meta-ai)) | no |
| `/help` | the command list as text | no |
| `/buttons` | legacy buttons, quick reply buttons, CTA buttons (link, call, copy) | no |
| `/carousel` | generic carousel: image cards with a quick reply and a link | no |
| `/form` | A2UI multi-step form (`form_message`) | no |
| `/webview` | link button that opens a page inside WhatsApp on the phone | no |
| `/pix` | PIX key card (`payment_info`) with a "copy PIX key" button | no (Business) |
| `/charge [amount]` | charge card (`review_and_pay`) paid with PIX; R$ 0,01 by default | no (Business) |
| `/product` | catalog product cards | yes |
| `/catalog [product\|all\|mixed]` | carousel of catalog products; the card button opens the product, the whole catalog, or alternates | yes |
| `/catalog-link` | the catalog share the WhatsApp app sends (`wa.me/c` link preview) | yes |
| `/catalog-message [product]` | interactive `catalog_message`: one button that opens the catalog | yes |
| `/group-status <group-jid>` | the portrait banner posted as a status of that group, which must be in `ALLOWED_GROUPS` (see [Group Status](#group-status)) | no |
| `/groups` | the account's groups and their ids (only in your own chat) | no |

The bot also **reacts to carts**: when an allowed contact sends a cart from your catalog, it answers with the two order cards a seller sends (accept and decline), quoting the cart. Button and form answers are echoed in the chat (quoting the answer) and written to `logs/bot.log`.

### Send One Example Without the Bot

```bash
npm run send -- <command> <phone-digits | group-jid> [args...] [--label "text"]
npm run send -- carousel 5511999999999
npm run send -- catalog 120363000000000000@g.us mixed
npm run send -- group-status 120363000000000000@g.us
```

`--label` sends a plain text first, handy to number a batch of manual tests. `group-status` needs a group jid ending in `@g.us`.

### Configuration

All variables are optional; see [.env.example](.env.example). A `.env` file in the project root is read on start, and variables already set in the shell win.

| Variable | Default | Meaning |
|---|---|---|
| `AUTH_PATH` | `.auth/session.sqlite` | SQLite file with the paired session |
| `SESSION_ID` | `default` | session id inside that file |
| `ALLOWED_NUMBERS` | empty | phone numbers (digits with country code, comma separated) |
| `ALLOWED_GROUPS` | empty | group ids (comma separated); also the only groups `/group-status` posts to |
| `LOG_LEVEL` | `warn` | zapo-js log level |
| `CTA_URL` | `https://github.com/vinikjkkj/zapo` | link of `cta_url` buttons |
| `WEBVIEW_URL` | `https://github.com/vinikjkkj/zapo` | page opened by `/webview` |
| `IMAGE_URL` | `https://placehold.co/640x640/png` | image of the generic carousel cards |
| `CTA_CALL_NUMBER` | the paired number | number dialed by the `cta_call` button |
| `PIX_KEY` | `+5511982905991` | PIX key shown by `/pix` and `/charge` (the default is the zapo author's, shared with his permission: tips welcome) |
| `PIX_KEY_TYPE` | `PHONE` | `EVP`, `EMAIL`, `PHONE`, `CPF` or `CNPJ` |
| `PIX_MERCHANT_NAME` | `vinikjkkj (zapo)` | name shown as "requested by" |
| `META_HOSTED_BANNER` | `false` | experimental: `true` marks the first message to each private chat as hosted by Meta, with a 👋 before it; read [Meta-Hosted Banner](#meta-hosted-banner) first |
| `AI_SYSTEM_PROMPT` | empty | text put before the first `/ai` question of each conversation; wrap it in double quotes to span several lines; Meta AI has no system prompt field, so it is a plain instruction in the prompt |

### Meta-Hosted Banner

Experimental and off by default. With `META_HOSTED_BANNER=true`, the first time the bot or the send CLI writes to a private chat in a run, it sends a 👋 stamped end-to-end (`<biz actual_actors="1" host_storage="1" privacy_mode_ts="...">`) and then the real message stamped with the privacy mode of a business hosted by Meta (`actual_actors="2" host_storage="2"`, one second newer). The contact's WhatsApp then shows this system message in that chat:

> This business is now using a secure service from Meta to manage this chat.

Observed on WhatsApp Web and on the phone on 2026-10-16 (in Portuguese: "Esta empresa agora usa um serviço seguro da Meta para gerenciar esta conversa"). Groups, status, channels and your own chat are never stamped.

Before turning it on:

- **It is not true for this bot.** A linked-device session is not hosted by Meta. Use it only with your own test chats.
- **It changes state on the contact's device.** WhatsApp Web records the account as an API business, stops treating the chat as end-to-end encrypted and swaps the encryption line in the contact info for the Meta text, until it re-syncs the business with WhatsApp's servers. Turning the flag off sends nothing to undo it; going back on purpose takes a newer `privacy_mode_ts` with `actual_actors="1" host_storage="1"`, which shows its own "now end-to-end encrypted" message.
- **Why the 👋 first.** Each of the contact's devices shows the banner only when the mode it stored for the business changes. A phone keeps the Meta mode even after the chat is deleted, so the Meta stamp alone showed nothing there the second time; switching to end-to-end first turns it into a change on every device. A device that still had the Meta mode shows "now end-to-end encrypted" right before the banner.
- **Only the first message per chat, per run.** Later messages go out untouched: with every message stamped, WhatsApp Web showed the banner again each time it re-synced the business with the servers, which know this account is not hosted (three times in a new chat). Restart the bot to run the switch again. See entry 12 in [docs/gotchas.md](docs/gotchas.md).

### Group Status

`/group-status <group-jid>` posts the repo banner (a 1080x1920 portrait in Portuguese, with a caption that links this repo) as a **group status**: the status a member posts to a group. Members see it on the group's status for 24 hours (the ring around the group photo and the Updates tab on the phone, Status on WhatsApp Web), and it never enters the chat timeline. Ask from any chat the bot answers, typically your private chat with it: the bot posts only to groups in `ALLOWED_GROUPS` and replies in the chat that asked. Without the bot: `npm run send -- group-status 120363000000000000@g.us`.

On the wire it is an ordinary group message (sender key) with the content wrapped:

```ts
{
    messageContextInfo: { messageSecret }, // 32 random bytes, on the outer message only
    groupStatusMessageV2: {
        message: { imageMessage: { ...upload, caption, width, height, jpegThumbnail, contextInfo: { isGroupStatus: true } } }
    }
}
```

It goes out with `customNodes: [<meta is_group_status="true" origin="group_status"/>]`, the node the Android app attaches (zapo does not), and `disableGroupEphemeralAutoInject: true`. zapo 1.10 already sends the wrapped image as `type="media"` with `mediatype="image"`, and the server acks with `is_group_status="true"`. Observed on 2026-10-16 on an Android phone and on WhatsApp Web ([docs/delivery-matrix.md](docs/delivery-matrix.md#group-status)); what makes it vanish silently is entry 13 in [docs/gotchas.md](docs/gotchas.md).

Where it does not show:

- WhatsApp Web hides group statuses of archived or locked chats, and of groups it does not trust: you are not the owner, and neither the owner, whoever added you, nor any admin is in your contacts.
- A phone where WhatsApp has not turned group statuses on shows "Someone shared a group status. Update to the latest version of WhatsApp" in the group chat instead (read in the decompiled Android app, not observed).

### Meta AI

`/ai <question>` sends the question to Meta AI from the paired account (zapo's `client.bot`) and posts the answer in the chat that asked.

- **One bubble.** The bot first sends "Thinking…" quoting the question, then edits that message into the answer, so WhatsApp shows the "Edited" tag on it. Meta AI streams its answer as edits of one message; the bot waits for the last snapshot (about 1 to 3 s) and posts it once. If the placeholder cannot be sent or edited, the answer goes out as a new message.
- **Photos.** Send a photo with `/ai <question>` as its caption and Meta AI looks at it: it read the chat name and the text of a screenshot and described a photo in the tests. A caption of only `/ai` asks it to describe the photo. The photo stays in the conversation, so the next `/ai` in the chat can ask about it. Only a photo and only its own caption count: a reply to a photo, a video, a document or a sticker is not read, and `/menu`, `/pix` and the other commands do nothing as a caption. The photo goes to Meta AI from the paired account like the question does. Checked on the phone and on Web.
- **Conversations.** Each chat has its own Meta AI thread, so a follow-up keeps the context. A chat that asks nothing for 30 minutes starts a new thread, and in a group everyone shares one. Threads live in memory and start over after a restart. The threads do not wall the chats off from each other: see **Memory is shared** below.
- **Memory is shared.** Meta AI ties what it remembers to the paired account, not to the thread: a code word told in one chat came back when another chat asked what someone had told it, in the same run and after a restart. Anyone who may use `/ai` can therefore read what the others told it, and what the account itself told Meta AI. Treat the allowlist as one circle of trust, never put a secret in `AI_SYSTEM_PROMPT`, and prefer a number used only for the bot. Asking the model in the prompt to keep conversations apart did not work: the wordings that blocked the leak also broke follow-ups in the same chat.
- **System prompt.** `AI_SYSTEM_PROMPT` is put before the first question of each thread, because Meta AI has no system prompt field. It can be as long as you like (a name for the assistant, what the bot does, its commands): wrap it in double quotes to write it on several lines. The bot adds nothing about itself, so what the assistant knows about the bot is only what this text says.
- **What shows up.** Text as it comes (WhatsApp formatting kept), a table as a monospace block, code as a fenced block. A part the bot cannot show (an image, for instance) is dropped and the answer ends with a note. Image generation is not supported.
- **One at a time.** The bot sends one prompt to Meta AI at a time, for all chats, first come first served. The others keep their "Thinking…" on screen until their turn, and the 35 seconds below count from the moment a prompt is sent, not from the wait.
- **Failures** are written into the placeholder: no answer within 35 seconds (an answer that had started is posted as it was, with a note that it was cut short), "There was a technical problem with Meta AI. Try again later." when the server refuses Meta AI for the account (error 488), the prompt could not be sent for another reason, or an answer with nothing the bot can show.
- **Self-healing.** Meta AI now and then loses its side of the encrypted session with the paired account and silently stops answering. Before the first question of each new conversation the bot drops its stored session with Meta AI, and a chat whose question got no reply at all starts a new conversation, so its next question drops the session again. A stale session can still cost one question in another chat that has a live conversation before that chat gets its own reset. See entry 21 in [docs/gotchas.md](docs/gotchas.md).
- **Where it shows.** The question and the answer also appear in the "Meta AI" chat on the phone of the paired account.
- **Language.** Without a system prompt Meta AI picks the answer language itself: it mostly followed the account's language, but the same English question came back in English and in Portuguese. Pin it with `AI_SYSTEM_PROMPT`. In the tests `Reply in the same language the question is written in, even if your default language is different: an English question gets an English answer and a Portuguese question gets a Portuguese answer.` was right 7 times out of 7, and `Always answer in Brazilian Portuguese.` 3 out of 3; the shorter `Always answer in the same language as the question.` missed 1 of 3. The prompt travels only with the first question of a conversation, and a conversation that alternates languages weakens it: in an 8-question test that switched between English and Portuguese the answer had the right language 5 and 6 times out of 8 in two runs (it missed on a first message that was a statement, not a question, and on English questions that followed Portuguese ones), because Meta AI tends to follow the language of the recent messages. Repeating a short reminder in every question did not help (5 out of 8), so the bot does not.

**AI label.** In private chats the bot sends the placeholder (and the new message, when an edit fails) with the stanza child WhatsApp uses to mark the replies of a business AI, `<bot biz_bot="1"/>`, so the contact sees "IA" next to the time. It is always on, with no switch, and it comes with caveats:

- **Private chats only.** The server refuses the node in groups (NACK 479), so groups never get it. It also applies when you type `/ai` in a chat with someone who is not in `ALLOWED_NUMBERS`.
- **Only the first stanza counts.** The mark sits on the placeholder and survives the edit; a node on the edit alone does nothing.
- **With the Meta-hosted banner.** `META_HOSTED_BANNER=true` works together with `/ai`: in a private chat the bot had not written to yet in that run, the 👋 goes out first without the label, then the "Thinking…" carries both the label and the hosted stamp, and the edit and any fallback message go out untouched. The prompt to Meta AI does not pass through that stamping. Seen on the phone and on Web, where the banner showed as well.
- **WhatsApp adds a notice, once.** The first labeled message in a chat makes the contact's WhatsApp insert a system line saying that Meta AI receives the messages of the conversation and may use them to improve itself and to generate messages for the business (seen in Portuguese: "A IA da Meta recebe as mensagens da conversa ..."). It says more than the bot does: only the `/ai` question goes to Meta AI.
- **It is a stamp WhatsApp did not authorize for ordinary accounts.** The server passes it today; the effect on the account in the long run was not measured and WhatsApp may stop passing it in any release. If the server rejects a labeled send, the bot sends it again without the label. See entries 18 to 20 in [docs/gotchas.md](docs/gotchas.md).

### Project Structure

| File | What to copy from it |
|---|---|
| [src/examples/buttons.ts](src/examples/buttons.ts) | `buttonsMessage`, `quick_reply`, `cta_url` / `cta_call` / `cta_copy` |
| [src/examples/carousel.ts](src/examples/carousel.ts) | `carouselMessage` cards and the `<biz>` node carousels need |
| [src/examples/form.ts](src/examples/form.ts) | A2UI `form_message` payload |
| [src/lib/native-flow-name.ts](src/lib/native-flow-name.ts) | why and how the `form_message` stanza is renamed so Android opens it |
| [src/lib/biz-privacy.ts](src/lib/biz-privacy.ts) | the `<biz>` privacy attrs behind the Meta-hosted banner (`META_HOSTED_BANNER`) |
| [src/examples/webview.ts](src/examples/webview.ts) | `cta_url` with `webview_interaction` |
| [src/examples/product.ts](src/examples/product.ts) | `productMessage` with a re-uploaded image |
| [src/examples/catalog.ts](src/examples/catalog.ts) | carousel with `cta_url` + `cta_catalog` |
| [src/examples/catalog-solo.ts](src/examples/catalog-solo.ts) | `wa.me/c` link preview and `catalog_message` |
| [src/examples/order.ts](src/examples/order.ts) | `review_and_pay` order cards |
| [src/examples/pix.ts](src/examples/pix.ts) | `payment_info` PIX key card and `review_and_pay` PIX charge |
| [src/examples/group-status.ts](src/examples/group-status.ts) | `groupStatusMessageV2` with the `<meta is_group_status>` node (`/group-status`) |
| [assets/](assets/) | the banner and thumbnail `/group-status` posts |
| [src/examples/menu.ts](src/examples/menu.ts) | classic `listMessage` that also renders on WhatsApp Web, and the same menu as a poll (`/poll`) |
| [src/lib/meta-ai.ts](src/lib/meta-ai.ts) | `client.bot.sendPrompt` and the streamed answer: one question at a time for the whole bot, threads per chat, the system prompt, chunks matched by prompt id, dropping the stale session with Meta AI (`/ai`) |
| [src/lib/meta-ai-render.ts](src/lib/meta-ai-render.ts) | Meta AI's rich answer (text, table, code) as WhatsApp text |
| [src/bot/ai-reply.ts](src/bot/ai-reply.ts) | the `/ai` flow: "Thinking…" edited into the answer, the photo it loads first, and the AI label node |
| [src/lib/incoming-image.ts](src/lib/incoming-image.ts) | downloads and decrypts the photo of a message, for `/ai` with a photo |
| [src/bot/](src/bot/) | the bot: access rules, command routing, cart reaction |
| [src/cli/send.ts](src/cli/send.ts) | the send CLI |
| [test/](test/) | unit tests for the pure parts (config, access, commands, payload builders) |

### Known Limitations

- The A2UI form opens on Android only because the bot renames the stanza's `<native_flow>` to `form_message`; zapo sends `mixed` for every native flow ([vinikjkkj/zapo#317](https://github.com/vinikjkkj/zapo/issues/317)). The same applies to `catalog_message`.
- A form answered on the phone shows as "Use your phone" on that person's WhatsApp Web: Android always answers with `version: 3`, which Web rejects. The bot receives both answers fine.
- The buyer's cart only carries the item count and the total, so the order cards list your catalog products cycled up to that count: an approximation until the real order details can be fetched.
- Catalog examples need products already shared from the app (no catalog API yet).
- When a recipient's device asks for a message again (retry receipt), zapo rebuilds it without any `<biz>` node: that copy loses the list menu's `<list>` node and the Meta-hosted stamp. It also loses the group status `<meta>` node, though it keeps the wrapper, which is what receivers read (read in WhatsApp Web's code, not observed).
- The bot recognizes a `/poll` only while it keeps running (it remembers in memory the ids of what it sent): after a restart, an old poll stays in the chat and its votes do nothing.
- `/ai` conversations and the queue of questions live in memory: after a restart the conversations start over, and a question that was in flight or waiting in the queue keeps its "Thinking…" message forever.
- `/ai` has no wall between chats on the Meta AI side: what one chat told it can come back in another (see **Memory is shared** under [Meta AI](#meta-ai)).
- `/ai` shows no images: Meta AI's image generation never delivered a picture in the tests, so an answer made only of an image is reported as something the bot cannot show. It reads photos, it does not draw them.
- `/ai` with a photo reads only the caption of a photo. Quoting a photo with `/ai` does nothing, the bot never looks at the image of the message it replies to.
- The questions of `/ai` go to Meta AI from the paired account and stay in that account's "Meta AI" chat on the phone; without an `AI_SYSTEM_PROMPT` the answer language is Meta AI's choice and varies.

### Documentation

- [docs/delivery-matrix.md](docs/delivery-matrix.md) -- what each format does on the phone and on Web
- [docs/gotchas.md](docs/gotchas.md) -- silent failures, as symptom and cause
- [docs/catalog-api-research.md](docs/catalog-api-research.md) -- what was tried to list a catalog through the API, and next steps

### Development

```bash
npm run typecheck
npm test
```

CI runs both on every push and pull request.

### Contributing

Issues and pull requests are welcome, especially new message types and results from other clients (iPhone, Desktop). Keep each example in its own file, add the observed result to [docs/delivery-matrix.md](docs/delivery-matrix.md), and never commit real phone numbers, LIDs or group ids: use placeholders like `5511999999999` and `120363000000000000@g.us`.

### License

[The Unlicense](LICENSE): public domain, use it however you like.
