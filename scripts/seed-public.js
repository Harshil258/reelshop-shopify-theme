(async () => {
  const V = '2025-07';
  const csrf = (window.Shopify && window.Shopify.csrfToken) || '';
  async function gql(query, variables) {
    const r = await fetch('/admin/api/' + V + '/graphql.json', {
      method: 'POST',
      credentials: 'include',
      headers: Object.assign({ 'Content-Type': 'application/json' }, csrf ? { 'X-CSRF-Token': csrf } : {}),
      body: JSON.stringify({ query: query, variables: variables })
    });
    if (!r.ok) throw new Error('HTTP ' + r.status);
    return r.json();
  }
  const errs = [];

  const defs = [
    ['affiliate_url', 'url', 'Affiliate link (REQUIRED)'],
    ['video_url', 'url', 'Promo video mp4'],
    ['platform', 'single_line_text', 'amazon | flipkart | meesho'],
    ['price', 'number_decimal', 'Display price'],
    ['original_price', 'number_decimal', 'Strikethrough price'],
    ['currency_symbol', 'single_line_text', 'e.g. Rs'],
    ['category', 'single_line_text', 'Algorithm category'],
    ['tags_extra', 'list.single_line_text', 'Algorithm tags'],
    ['gallery_images', 'list.url', 'Carousel images'],
    ['rating', 'number_decimal', '0-5 stars']
  ];
  let defsOk = 0;
  for (const d of defs) {
    try {
      const res = await gql('mutation($d: MetafieldDefinitionInput!){ metafieldDefinitionCreate(definition:$d){ metafieldDefinition{ id } userErrors{ field message } } }',
        { d: { name: 'ReelShop ' + d[0], namespace: 'reelshop', key: d[0], type: d[1], ownerType: 'PRODUCT', description: d[2] } });
      const ue = (res.data && res.data.metafieldDefinitionCreate && res.data.metafieldDefinitionCreate.userErrors) || [];
      if (ue.length && !/already exists/i.test(ue[0].message)) errs.push('def:' + d[0] + ':' + ue[0].message);
      else defsOk++;
    } catch (e) { errs.push('def:' + d[0] + ':' + e.message); }
  }

  const P = [
    { t: 'Portable Mini Juicer Blender 380ml', pl: 'amazon', pr: '799', op: '1499', cat: 'Kitchen', tags: ['kitchen', 'gadgets', 'juicer'], r: '4.3',
      desc: 'USB rechargeable mini blender for juices, shakes and baby food. 380ml BPA-free bottle, 6 stainless blades. Sample listing to demo the reels feed.',
      aff: 'https://www.amazon.in/dp/B0RSSAMPLE1',
      img: ['https://picsum.photos/seed/rsblender1/900/1200', 'https://picsum.photos/seed/rsblender2/900/1200'],
      vid: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4' },
    { t: 'RGB LED Strip Lights 5m with Remote', pl: 'meesho', pr: '349', op: '999', cat: 'Home Decor', tags: ['lights', 'room', 'decor'], r: '4.1',
      desc: 'Colour-changing LED strip with remote and adhesive back. 16 colours, cuttable, perfect for bedrooms and TV backlight. Sample listing.',
      aff: 'https://www.meesho.com/sample-led-strip/RS2',
      img: ['https://picsum.photos/seed/rsled1/900/1200', 'https://picsum.photos/seed/rsled2/900/1200'], vid: '' },
    { t: 'TWS Wireless Earbuds with Charging Case', pl: 'amazon', pr: '1299', op: '2999', cat: 'Audio', tags: ['earbuds', 'bluetooth', 'music'], r: '4.4',
      desc: 'Bluetooth 5.3 earbuds, 30h playtime with case, touch controls, ENC mic for calls. Sample listing to demo the reels feed.',
      aff: 'https://www.amazon.in/dp/B0RSSAMPLE3',
      img: ['https://picsum.photos/seed/rsearbuds1/900/1200', 'https://picsum.photos/seed/rsearbuds2/900/1200'],
      vid: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerJoyrides.mp4' },
    { t: 'Magnetic Car Phone Holder 360°', pl: 'meesho', pr: '199', op: '599', cat: 'Auto Accessories', tags: ['car', 'phone', 'holder'], r: '4.0',
      desc: 'Strong-magnet dashboard phone mount with 360 degree rotation. Fits all phones. Sample listing.',
      aff: 'https://www.meesho.com/sample-car-holder/RS4',
      img: ['https://picsum.photos/seed/rsholder1/900/1200', 'https://picsum.photos/seed/rsholder2/900/1200'], vid: '' },
    { t: 'Stainless Steel Water Bottle 1L', pl: 'amazon', pr: '449', op: '899', cat: 'Kitchen', tags: ['bottle', 'gym', 'steel'], r: '4.5',
      desc: 'Double-wall insulated steel bottle, keeps drinks cold 24h / hot 12h. Leak-proof cap. Sample listing.',
      aff: 'https://www.amazon.in/dp/B0RSSAMPLE5',
      img: ['https://picsum.photos/seed/rsbottle1/900/1200', 'https://picsum.photos/seed/rsbottle2/900/1200'], vid: '' },
    { t: 'Warm White Fairy String Lights 10m', pl: 'meesho', pr: '249', op: '699', cat: 'Home Decor', tags: ['lights', 'festive', 'decor'], r: '4.2',
      desc: '100-LED warm white string lights with 8 modes. For diwali, birthdays and room decor. Sample listing.',
      aff: 'https://www.meesho.com/sample-fairy-lights/RS6',
      img: ['https://picsum.photos/seed/rsfairy1/900/1200', 'https://picsum.photos/seed/rsfairy2/900/1200'], vid: '' }
  ];
  let prodOk = 0;
  for (const p of P) {
    try {
      const c = await gql('mutation($i: ProductInput!){ productCreate(input:$i){ product{ id } userErrors{ field message } } }',
        { i: { title: p.t, descriptionHtml: '<p>' + p.desc + '</p>', status: 'ACTIVE' } });
      const ue = (c.data && c.data.productCreate && c.data.productCreate.userErrors) || [];
      if (ue.length || !c.data.productCreate.product) { errs.push('prod:' + p.t + ':' + (ue[0] ? ue[0].message : 'no product')); continue; }
      const pid = c.data.productCreate.product.id;
      const mf = [
        ['affiliate_url', 'url', p.aff],
        ['platform', 'single_line_text', p.pl],
        ['price', 'number_decimal', p.pr],
        ['original_price', 'number_decimal', p.op],
        ['category', 'single_line_text', p.cat],
        ['tags_extra', 'list.single_line_text', JSON.stringify(p.tags)],
        ['rating', 'number_decimal', p.r],
        ['gallery_images', 'list.url', JSON.stringify(p.img.slice(1))]
      ];
      if (p.vid) mf.push(['video_url', 'url', p.vid]);
      const m = await gql('mutation($m: [MetafieldsSetInput!]!){ metafieldsSet(metafields:$m){ metafields{ id } userErrors{ field message } } }',
        { m: mf.map(x => ({ ownerId: pid, namespace: 'reelshop', key: x[0], type: x[1], value: x[2] })) });
      const mue = (m.data && m.data.metafieldsSet && m.data.metafieldsSet.userErrors) || [];
      if (mue.length) errs.push('mf:' + p.t + ':' + mue[0].message);
      const media = await gql('mutation($pid: ID!, $media: [CreateMediaInput!]!){ productCreateMedia(media:$media, productId:$pid){ media{ id } mediaUserErrors{ field message } } }',
        { pid: pid, media: p.img.map((u, i) => ({ originalSource: u, mediaContentType: 'IMAGE', alt: p.t + ' photo ' + (i + 1) })) });
      const me = (media.data && media.data.productCreateMedia && media.data.productCreateMedia.mediaUserErrors) || [];
      if (me.length) errs.push('img:' + p.t + ':' + me[0].message);
      prodOk++;
    } catch (e) { errs.push('prod:' + p.t + ':' + e.message); }
  }
  document.title = 'RS-DONE defs=' + defsOk + ' prods=' + prodOk + (errs.length ? ' ERR=' + errs.slice(0, 4).join('|') : ' CLEAN');
})();
