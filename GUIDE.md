# ReelShop — Master Product & New Store Setup Guide

Your store is a high-performance, full-screen **TikTok & Instagram Reels storefront** for affiliate commerce. Visitors swipe vertically through products, and every "Buy on Amazon / Meesho / Flipkart" button opens YOUR affiliate referral link in a new browser tab. There is no Shopify checkout, cart, or payment processing by design.

---

## 📹 1. Adding Video Products (Your Main Focus)

The Reels feed prioritizes **vertical promo videos** (9:16 aspect ratio, `.mp4`).

### Method A: Uploading Video Directly in Product Media (Recommended)
1. In **Shopify Admin → Products → Add product** (or edit an existing product).
2. Enter the **Title** and **Description**.
3. In the **Media** section:
   - Drag and drop your vertical `.mp4` video (or click **Upload new**).
   - Also upload 2–6 photos of the product (these form the horizontal swipe carousel).
4. Scroll to **Metafields** at the bottom:
   - **Affiliate URL** (`reelshop.affiliate_url`): Paste your Amazon/Meesho/Flipkart referral link.
   - **Platform** (`reelshop.platform`): Type `amazon`, `meesho`, or `flipkart`.
   - **Display Price** (`reelshop.price`): e.g. `499`.
   - **Original Price** (`reelshop.original_price`): e.g. `999` (creates the strikethrough + `-50%` discount pill).
5. Set Product status to **Active** and click **Save**.

The theme will **automatically detect the video in product media and autoplay it** as the primary reel background!

---

### Method B: Using Hosted Video URL (`video_url` Metafield)
If you host your videos on Shopify Content Files or an external CDN:
1. Upload your `.mp4` file to **Shopify Admin → Content → Files** and copy the link.
2. In the product edit page, scroll to **Metafields** at the bottom.
3. Paste the URL into **Reel Video URL** (`reelshop.video_url`).
4. Click **Save**.

---

## 🛍️ 2. Metafields Setup (Create Once Per Store)

To show custom deal prices, affiliate links, and platform badges, create these definitions once in **Settings → Custom data → Products → Add definition**:

| Name | Namespace and Key | Type | Description |
| :--- | :--- | :--- | :--- |
| **Affiliate URL** *(Required)* | `reelshop.affiliate_url` | **URL** | Your Amazon / Flipkart / Meesho referral link. |
| **Reel Video URL** | `reelshop.video_url` | **URL** or **File (Video)** | Direct `.mp4` video link or uploaded file. |
| **Platform** | `reelshop.platform` | **Single line text** | `amazon`, `flipkart`, or `meesho`. |
| **Display Price** | `reelshop.price` | **Number (Decimal)** | Sale price shown to customers (e.g. `799`). |
| **Original Price** | `reelshop.original_price` | **Number (Decimal)** | Strikethrough price for discount % badge (e.g. `1499`). |
| **Category** | `reelshop.category` | **Single line text** | e.g. `Kitchen`, `Tech`, `Decor` (for algorithm & filter chips). |
| **Rating** | `reelshop.rating` | **Number (Decimal)** | Star score from `0.0` to `5.0` (e.g. `4.5`). |
| **Gallery Images** | `reelshop.gallery_images` | **List of Files** | Extra photos for horizontal swipe. |

---

## 🚀 3. Installing ReelShop on a New Shopify Account

To set up this exact theme on another Shopify account:

### Option 1: Via GitHub (Recommended)
1. Log in to the new Shopify Admin.
2. Go to **Online Store → Themes**.
3. Under **Theme library**, click **Add theme → Connect from GitHub**.
4. Select your GitHub repository: `Harshil258/reelshop-shopify-theme` (Branch: `main`).
5. Click **Publish**.

### Option 2: Via ZIP Upload
1. ZIP the contents of this theme repository (excluding `.git`).
2. In the new Shopify Admin, go to **Online Store → Themes**.
3. Click **Add theme → Upload zip file**.
4. Click **Publish**.

### New Store Checklist:
- [ ] **Unlock Storefront**: In **Online Store → Preferences**, uncheck **"Restrict access to visitors with the password"** (requires a store address under **Settings → Store details**).
- [ ] **Create Metafields**: Add the definitions above under **Settings → Custom data → Products**.
- [ ] **Add Video Products**: Add products with vertical MP4 videos and your referral URLs.
- [ ] **Create Favorites Page**:
  1. Go to **Online Store → Pages → Add page**, title "Favorites".
  2. In **Theme template** on the bottom right, select **page.favorites** and Save.
  3. In **Themes → Customize → Reels feed section**, set **"Favorites page link"** to your new Favorites page.

---

## 📱 4. Gesture & Controls Quick Reference

- **Vertical Swipe (Up/Down)**: Next / Previous product reel.
- **Horizontal Swipe (Left/Right)**: That product's own video and photo gallery.
- **Tap Video**: Toggle play/pause (with centered play indicator).
- **Double-Tap Anywhere**: Instant Like + TikTok heart explosion animation.
- **Bookmark Icon (Right rail)**: Saves product to local favorites.
- **Share Icon (Right rail)**: Opens native share sheet or copies store link with animated toast.
- **Top Bar**:
  - Search icon opens sliding search drawer with live search and category chips.
  - Sound icon toggles unmuted audio across all reels.
  - Bookmark icon opens the Favorites page.

---

## 🧠 5. Tuning the Retention Algorithm

The recommendation engine runs client-side in browser `localStorage`.
To adjust how strongly categories, likes, or freshness influence the feed order, edit the constants at the top of `assets/reelshop.js`:

```javascript
var ALGO = {
  AFFINITY: 1.0,             // Weight of category/tag affinity
  ENGAGEMENT: 0.5,           // Weight of past views & interactions
  FRESHNESS: 0.9,            // Boosts new / long-unseen products
  RANDOM_NOISE: 0.5,         // Session randomness
  REPEAT_PENALTY: 8.0,       // Prevents showing recent products too soon
  REPEAT_WINDOW_MINUTES: 15,
  FRESHNESS_HALF_LIFE_HOURS: 48,
  MAX_ENGAGEMENT: 6.0
};
```

