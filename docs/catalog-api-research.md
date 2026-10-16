# Catalog API research (pending)

The catalog examples read products from messages the account already sent because zapo-js (1.10.0) has no catalog API. These are the attempts made on 2026-10-16 to list a catalog directly, as a starting point for whoever picks this up.

## What was tried

| Attempt | Result |
|---|---|
| IQ `xmlns="w:biz:catalog"` with `<product_catalog jid allow_shop_source="true">` and `limit` / `width` / `height` (the shape Baileys uses) | no answer, the query times out |
| GraphQL over `w:mex` with the Web persisted query `WAWebQueryCatalogQuery` (`30445081048424116`) | `400 Bad Request` |
| Same with the Android query (`9524738300898788`) and the id known to zapo (`9916553288394782`), jid as LID and as phone number, body as zapo builds it and as Web builds it (`{"variables": ...}` in bytes) | `400 Bad Request` every time, also against another account |

## What the clients do

- WhatsApp Web's IQ path now needs a `smax_id` attribute; the full catalog listing no longer exists there, only `CatalogGetProductList` (smax id 21), which fetches products by id.
- To list its **own** catalog, Web does not use WhatsApp at all: `WAWebBizCatalogManagementFetchCatalog` calls Facebook's GraphQL (`xfb_whatsapp_catalog`) with an ad account token (`WAWebFetchAdAccountToken`).
- To list **another** business catalog, Web uses `WAWebQueryCatalog` (GraphQL, `request.product_catalog` with `jid`, `allow_shop_source: "ALLOWSHOPSOURCE_TRUE"`, `width`, `height`, `limit`, `after`). Android uses the same idea with `allow_shop_source: true`.

## Next steps

1. Query the catalog of **another** Business account that has one, to tell a wrong variable shape apart from "the consumer route refuses your own catalog".
2. Reproduce the owner route (ad account token, then Facebook GraphQL) if listing your own catalog is required.
3. Order details: the buyer's cart carries an order id and a token; fetching the real items with them would replace the approximation in `src/examples/order.ts`.
