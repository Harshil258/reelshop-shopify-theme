# ReelShop — TikTok/Reels-style Affiliate Storefront (Shopify Theme)

ReelShop turns a Shopify store into a full-screen, mobile-first vertical reels feed
(TikTok / Instagram Reels style) that earns through **external affiliate links**
(Amazon / Flipkart / Meesho). No checkout, no backend — everything runs in
Liquid + vanilla JS + CSS + product metafields, with a client-side
recommendation "algorithm" powered by `localStorage`.

Built on top of Shopify Dawn (OS 2.0).

## How it works

- **Vertical swipe / scroll** = next product (each slide fills the screen).
- **Horizontal swipe** = that product's own media carousel (video + photos).
- **Double-tap** = like, **bookmark** = favorite, **Share** = Web Share API with
  clipboard fallback, **Buy on \<Platform\>** = opens your affiliate link in a
  new tab (`rel="nofollow sponsored noopener"`).
- Videos autoplay muted on the active slide; tap to play/pause; sound toggle
  persists across sessions.
- The feed re-orders itself per visitor using tracked signals (watch time,
  video completion, likes, favorites, shares, CTA clicks, category/tag affinity)
  with an exploration factor so it never feels stale.
- Search + category chips filter the feed; `?product=<handle>` deep-links open
  the feed on a specific product; favorites live on a dedicated page.

## Repository structure (ReelShop additions)

```
sections/reels-feed.liquid      main feed section (schema: colors, currency, algorithm, CTA text…)
sections/main-favorites.liquid  favorites page section
snippets/reel-slide.liquid      one product slide (metafields with native fallbacks)
snippets/action-rail.liquid     like / save / share / category chip rail
snippets/price-block.liquid     price + strikethrough + discount badge
assets/reelshop.css             feed UI (mobile-first, desktop phone-frame)
assets/reelshop.js              algorithm + gestures + autoplay + lazy-load + persistence
templates/index.json            homepage = reels feed
templates/index.classic.json    original Dawn homepage kept as an alternate template
templates/page.favorites.json   favorites page template
metafields.json                 metafield definition reference for setup
```

## Setup

### 1. Create product metafields (one time)

Shopify admin → **Settings → Custom data → Products → Add definition**.
Namespace `reelshop` (see `metafields.json` for the full reference):

| Key | Type | Notes |
|---|---|---|
| `affiliate_url` | url | **Required** — your referral link |
| `video_url` | url | promo .mp4 (Content → Files) |
| `platform` | single line text | `amazon` / `flipkart` / `meesho` |
| `price` | number | display price |
| `original_price` | number | enables strikethrough + % badge |
| `currency_symbol` | single line text | e.g. `₹` |
| `category` | single line text | algorithm + filter chips |
| `tags_extra` | list.single_line_text | algorithm affinity |
| `gallery_images` | list.file_reference / list.url | carousel photos |
| `rating` | number | 0–5 stars |

### 2. Add products

Products → add/edit: title + description (overlay text), images (carousel
fallback), then fill the metafields. `affiliate_url` is the only required field;
everything else falls back to native product data.

### 3. Theme editor

Homepage uses the **Reels feed** section. Settings: feed title, source
collection, products per load, accent/background color, currency symbol,
default platform, CTA text (`Buy on {{platform}}`), show ratings,
enable algorithm, exploration randomness, favorites page link.

Create a page with the **Favorites** template and link it in the section to
show the bookmark icon.

## Tuning the algorithm

Top of `assets/reelshop.js`:

- `ALGO.AFFINITY / ENGAGEMENT / FRESHNESS / RANDOM_NOISE` — scoring weights.
- `ALGO.REPEAT_PENALTY` + `REPEAT_WINDOW_MINUTES` — anti-repeat guard.
- `EVENT_WEIGHTS` — affinity gained per interaction (view, complete, like,
  favorite, share, cta, dwell).
- Theme editor **Exploration randomness** — epsilon-greedy shuffle strength.

All tracking is first-party `localStorage` only; if storage is unavailable the
feed keeps the default Liquid order.

## Notes

- No backend, no external JS/CSS used by ReelShop itself (vanilla, works in
  sandboxed previews). Pre-existing Dawn customizations (product-page slider)
  still use jQuery/Slick, now loaded non-blocking and safely skipped offline.
- Commission reporting happens on Amazon/Flipkart/Meesho dashboards; the theme
  only counts local clicks/engagement.
- Keep videos short and compressed; host via Shopify Files or any CDN.
