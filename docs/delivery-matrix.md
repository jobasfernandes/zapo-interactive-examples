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

## Groups

| Format | Result | Notes |
|---|---|---|
| `/buttons` in an allowed group | all 3 messages delivered | the third send logged an ack timeout (10 s) even though it arrived |
| List message in a group | delivered | zapo 1.10 sends the group stanza shape (`type=media`, `mediatype=list`) |
