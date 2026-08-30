# 📱 ReelShop — TikTok & Reels-Style Affiliate Storefront for Shopify

**ReelShop** transforms your Shopify store into a full-screen, vertical video shopping experience identical to **TikTok and Instagram Reels**. 

Instead of traditional checkout, customers tap high-converting CTA buttons (**Buy on Amazon ↗**, **Buy on Meesho ↗**, **Buy on Flipkart ↗**) that open your affiliate/referral links in a new tab.

Built on **Shopify Online Store 2.0 (Dawn engine)** with 100% lightweight vanilla JavaScript and CSS — zero app subscriptions, zero external databases, and instant load speeds.

---

## ✨ Features

- **Full-Screen Vertical Swipe Feed**: Each product is presented as a high-engagement vertical reel.
- **Smart Autoplay & Sound Toggle**: Videos autoplay smoothly with inline play/pause and unmuted sound toggle that remembers user preference.
- **Horizontal Media Carousel**: Swipe sideways on any reel to view additional product photos.
- **Multi-Platform Affiliate CTAs**: Dynamic branded buttons for Amazon, Meesho, Flipkart, or custom stores.
- **TikTok Gestures**: Double-tap for animated heart burst, single-tap to pause/play.
- **Saved Reels Drawer**: Built-in slide-up modal with a top bar counter badge (`🔖`) so customers can review and replay bookmarked items anytime.
- **Social Sharing**: Share any product link (`/products/handle`); recipients open directly on that reel and can continuously scroll through the entire catalog.
- **Instant Search & Category Chips**: Filter the feed in real-time by keyword or category tag (e.g. *Kitchen*, *Tech*, *Home Decor*).
- **Personalized Recommendation Algorithm**: Learns viewer preferences locally using `localStorage` (watch time, video completions, likes, saves, shares) with exploration randomness so the feed stays fresh.
- **First-Time Visitor Guidance**: Gentle onboarding hint that automatically fades out upon first swipe or tap.

---

## 🚀 Quick Setup Guide for New Shopify Stores

### Step 1: Install the Theme

1. Download the theme repository as a **ZIP file** (or connect your GitHub repository).
2. Go to **Shopify Admin → Online Store → Themes**.
3. Under **Theme library**, click **Add theme → Upload zip file**.
4. Click **Publish** to make ReelShop your active store theme.

---

### Step 2: Create Product Metafields (One-Time Setup)

To display affiliate buttons, custom prices, discounts, and video reels, create these 8 metafield definitions:

1. In Shopify Admin, go to **Settings (bottom-left) → Custom data → Products**.
2. Click **Add definition** for each row below and click **Save**:

| # | Name | Namespace and Key | Type | Description |
|---|---|---|---|---|
| 1 | **Affiliate URL** | `reelshop.affiliate_url` | **URL** | Your Amazon / Meesho / Flipkart referral link (*Required*) |
| 2 | **Reel Video URL** | `reelshop.video_url` | **URL** | Direct `.mp4` video URL (Autoplays) |
| 3 | **Platform** | `reelshop.platform` | **Single line text** | `amazon`, `meesho`, or `flipkart` |
| 4 | **Display Price** | `reelshop.price` | **Decimal** | Sale price shown to customers (e.g. `799`) |
| 5 | **Original Price** | `reelshop.original_price` | **Decimal** | Compare price for discount badge (e.g. `1499` → `-46% OFF`) |
| 6 | **Category** | `reelshop.category` | **Single line text** | e.g. `Kitchen`, `Tech`, `Home Decor` (Used for chips & algorithm) |
| 7 | **Rating** | `reelshop.rating` | **Decimal** | Star rating (e.g. `4.4`) |
| 8 | **Gallery Images** | `reelshop.gallery_images` | **List of files** | Extra photos for horizontal swipe carousel |

> 💡 **Tip**: All 8 fields will automatically pin to the bottom of every product edit page in your Shopify admin.

---

### Step 3: How to Add Products & Video Reels

#### 1. Upload Video (.mp4):
1. Go to **Shopify Admin → Content → Files**.
2. Click **Upload files** and select your vertical 9:16 video (`.mp4`).
3. Once uploaded, click the **Link icon (Copy link)** next to the file.

#### 2. Create the Product:
1. Go to **Products → Add product**.
2. Enter the **Title** (shown on the reel).
3. Add a short **Description** (caption text overlay).
4. Add **Media / Featured Image** (used as video poster and thumbnail in Saved drawer).
5. Scroll to the **Metafields** section at the bottom and fill in:
   - **Affiliate URL**: Paste your Amazon / Meesho / Flipkart link.
   - **Reel Video URL**: Paste the video link you copied in Step 1.
   - **Platform**: Type `amazon`, `meesho`, or `flipkart`.
   - **Display Price**: Enter `799`.
   - **Original Price**: Enter `1499` (theme auto-calculates discount percentage).
   - **Category**: Enter `Kitchen` or `Tech`.
   - **Rating**: Enter `4.5`.
6. Set Product status to **Active** and click **Save**.

Your new video product will instantly appear in your live Reels feed!

---

### Step 4: Theme Customization (Optional)

Go to **Online Store → Themes → Customize**:

- **Feed Title**: Change the top bar title (defaults to your store name).
- **Currency Symbol**: Change symbol (e.g. `₹`, `$`, `£`, `€`).
- **Accent Color**: Customize like button & badge colors (e.g. `#ff2d55`).
- **CTA Button Text**: Customize button format (default: `Buy on {{platform}} ↗`).
- **Enable Algorithm**: Toggle smart recommendation engine on/off.
- **Exploration Strength**: Control how often new or random products appear at the top.

---

## 📁 Repository Structure

```
├── layout/
│   └── theme.liquid               # Full-screen viewport container
├── sections/
│   ├── reels-feed.liquid          # Main reels feed + Saved drawer + search panel
│   └── main-favorites.liquid      # Standalone favorites page section
├── snippets/
│   ├── reel-slide.liquid          # Native product reel engine (video/image/metafields)
│   ├── reel-slide-sample.liquid   # Built-in demo sample reel renderer
│   └── action-rail.liquid         # Right-rail action buttons (like, save, share, chip)
├── assets/
│   ├── reelshop.css               # Mobile-first TikTok styling & glassmorphism
│   └── reelshop.js                # Feed controller, algorithm, gestures & persistence
├── templates/
│   ├── index.json                 # Homepage template (Reels Feed)
│   └── page.favorites.json        # Favorites page template
└── README.md                      # Merchant documentation
```

---

## 🎯 Tips for Maximizing Affiliate Conversions

1. **Short, Hook-Driven Videos**: Use 5–15 second videos showing the product in action within the first 2 seconds.
2. **Accurate Strikethrough Prices**: Fill in both **Display Price** and **Original Price** — discount badges (e.g. `-50% OFF`) significantly increase CTR.
3. **Category Tagging**: Use consistent categories (`Kitchen`, `Gadgets`, `Beauty`) so visitors can use category chips to binge specific types of products.
4. **Use High-Resolution Cover Photos**: Always set a featured image for every product so thumbnails load instantly in the Saved Reels drawer.

---

## 📄 License & Credits

- Built on Shopify Dawn OS 2.0.
- 100% Client-side privacy-friendly tracking (no cookies, no external servers).
- Created for high-speed mobile affiliate commerce.
