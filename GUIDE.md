# ReelShop Owner Guide (reelsguru.myshopify.com)

Your store is a TikTok/Reels-style affiliate storefront. Visitors swipe
vertically through products; every "Buy on Amazon/Meesho" button opens YOUR
affiliate link in a new tab — that is where you earn. There is no Shopify
checkout by design.

Live theme: **reelshop-shopify-theme** (connected to GitHub — every `git push`
to `main` automatically updates the store. Check Online Store → Themes →
"View logs" if a sync ever fails).

---

## 0. Let visitors in (one time)

Your store currently shows a password page to visitors.

1. **Admin → Settings → Store details → Store address** — add your business
   address and Save. (Shopify keeps the password switch locked until an
   address is on file.)
2. **Admin → Online Store → Preferences → "Password protection" → turn OFF
   "Restrict access to visitors with the password" → Save.**

After this, https://reelsguru.myshopify.com/ opens straight into the reels feed.

## 1. The reels feed (what you see)

- **Swipe up / down** (or mouse wheel / arrow keys) = next / previous product.
- **Swipe left / right on a slide** = that product's own photos/video carousel.
- **Tap video** = play/pause. **Double-tap** = like (heart burst).
- **Heart** = like, **Bookmark** = save to favorites, **Share** = shares your
  store link for that product (not the affiliate link).
- **Sound icon (top right)** = unmute; remembered on the device.
- **Search icon (top left)** = search + category chips.
- Feed order personalizes per visitor (watch time, likes, saves, clicks) using
  their browser storage only.

## 2. Adding a REAL product (step by step)

1. **Admin → Products → Add product.**
2. **Title** = the headline on the reel. **Description** = the small text
   (long text gets a "more" button automatically).
3. **Media**: add 2–6 images — they become the swipe-sideways carousel.
4. Scroll to the **Metafields** panel at the bottom and fill:
   - `affiliate_url` — **REQUIRED** — your Amazon/Flipkart/Meesho referral link.
   - `platform` — `amazon`, `flipkart` or `meesho` (controls badge + button text).
   - `price` — display price, e.g. `799`.
   - `original_price` — higher number → shows strikethrough + % OFF badge.
   - `category` — e.g. `Kitchen` (used by filter chips + algorithm).
   - `rating` — optional, e.g. `4.5` shows stars.
   - `tags_extra` — optional extra keywords for the algorithm.
5. **Save** — the product appears in the feed immediately (it's in the "All
   products" collection the feed reads).

The metafield definitions were created automatically by the setup script.
Full reference list: `metafields.json` in the repo.

### Videos

1. **Admin → Content → Files → Upload files** → upload your MP4 (keep it short
   and compressed, vertical 9:16 looks best).
2. Copy the file URL, paste it into the product's `video_url` metafield.
3. The video autoplays muted on its slide; images after it form the carousel.

(Any hosted .mp4 URL works too, e.g. a CDN link.)

### Extra carousel images

Paste image URLs into the `gallery_images` metafield (list), or just use the
normal product images — both work.

## 3. Favorites page

1. **Admin → Online Store → Pages → Add page**, title "Favorites".
2. In the **Theme template** selector (bottom right), choose
   **page.favorites** → Save.
3. **Online Store → Themes → Customize → Reels feed section →
   "Favorites page link"** → pick that page. The bookmark icon in the feed's
   top bar now opens it.

## 4. Look & behaviour settings

**Themes → Customize → Reels feed section:**
feed title, source collection, products per load (max 50), accent colour,
background colour, currency symbol (default ₹), default platform,
CTA text (`Buy on {{platform}}`), show ratings, enable/disable the algorithm,
exploration randomness (higher = more variety).

Algorithm weights live at the top of `assets/reelshop.js`
(`ALGO.*` and `EVENT_WEIGHTS`) if you ever want to tune recommendations.

## 5. Publishing code changes

The theme folder is a git repo connected to
`github.com/Harshil258/reelshop-shopify-theme`.

```
git add -A && git commit -m "describe change" && git push
```

Shopify pulls `main` automatically (Themes page shows the GitHub branch).
Keep `metafields.json`, `README.md`, `GUIDE.md` in the repo — Shopify ignores
non-theme files.

## 6. Troubleshooting

| Symptom | Fix |
|---|---|
| Visitors see a password page | Step 0 above. |
| Password switch is greyed out | Add a business address first: Settings → Store details → Store address → Save, then come back to Preferences. |
| "You need permission to view this feature" in admin | Your staff account is restricted — ask the store owner (Webunity Infotech org) for Apps/Settings access, or use the owner login. |
| Want dummy products fast | On the store's page, open DevTools console (View → Developer → JavaScript Console) and paste: `fetch('https://raw.githubusercontent.com/Harshil258/reelshop-shopify-theme/main/scripts/seed-public.js').then(r=>r.text()).then(t=>eval(t))` — the tab title becomes `RS-DONE …`. Creates the metafield definitions + 6 sample Amazon/Meesho products. |
| Homepage 404 / blank | A Liquid error broke the feed. Themes → View logs, or open the theme editor — it shows the file + line. Usually a typo in a recently edited section/snippet. |
| Feed shows "SAMPLE DATA" slides | No live products yet — add products (section 2). |
| Product missing from feed | Not ACTIVE, or not in the source collection (default: all products), or "products per load" limit reached. |
| Buy button says "Set the affiliate link metafield" | Fill `affiliate_url` on that product. |
| Video won't autoplay with sound | Browsers force muted autoplay; use the sound icon. |

## 7. Dummy data

Six sample products (3 Amazon-style, 3 Meesho-style) were added to preview the
feed. They use placeholder images and obviously-fake affiliate URLs — edit or
delete them when you add real products. The script that created them (and the
metafield definitions) is `scripts/seed-public.js` in the repo.
