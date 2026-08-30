/**
 * ReelShop — client-side engine (vanilla JS, no dependencies, no external calls)
 *
 * Responsibilities:
 *   1. Engagement algorithm — re-orders the Liquid-rendered feed using
 *      localStorage signals (views, dwell time, likes, favorites, shares,
 *      CTA clicks, category/tag affinity).
 *   2. Reels UX — active-slide detection, video autoplay/pause, tap and
 *      double-tap gestures, carousel dots, lazy loading.
 *   3. Persistence — likes, favorites, sound, onboarding, telemetry.
 *   4. Utilities — share (Web Share API + clipboard fallback), search and
 *      category filter, deep linking (?product=<handle>), sample fallback.
 *
 * Also powers the Favorites page (mode "favorites").
 */
(function () {
  'use strict';

  /* ======================================================================
   * TUNABLE ALGORITHM CONSTANTS — adjust these to change recommendations
   * ==================================================================== */
  var ALGO = {
    AFFINITY: 1.0,             // weight of category/tag affinity
    ENGAGEMENT: 0.5,           // weight of past engagement with this product
    FRESHNESS: 0.9,            // weight of "never/long seen" freshness
    RANDOM_NOISE: 0.5,         // always-on randomness so order varies per session
    REPEAT_PENALTY: 8.0,       // heavy penalty for very recently viewed items
    REPEAT_WINDOW_MINUTES: 15, // "recently viewed" window for the penalty
    FRESHNESS_HALF_LIFE_HOURS: 48, // how fast freshness recovers after a view
    MAX_ENGAGEMENT: 6.0        // cap so one product cannot dominate forever
  };

  // How much each interaction raises category/tag affinity.
  var EVENT_WEIGHTS = {
    view: 0.2,
    complete: 1.0,     // watched video to >= 90%
    like: 2.0,
    favorite: 2.0,
    share: 1.5,
    cta: 2.5,          // clicked the affiliate "Buy" button
    dwellPer10s: 0.5   // per 10s on slide, capped (x3)
  };

  var STORAGE_KEY = 'reelshop.v1';
  var DWELL_SAVE_MIN_SECONDS = 1; // ignore sub-second dwell noise

  /* ----------------------------------------------------------------------
   * localStorage wrapper — everything degrades gracefully if unavailable
   * -------------------------------------------------------------------- */
  var Store = {
    ok: false,
    data: null,

    init: function () {
      try {
        localStorage.setItem('__reelshop_test', '1');
        localStorage.removeItem('__reelshop_test');
        this.ok = true;
      } catch (e) {
        this.ok = false;
      }

      var stored = null;
      if (this.ok) {
        try { stored = JSON.parse(localStorage.getItem(STORAGE_KEY)); } catch (e) { stored = null; }
      }
      this.data = (stored && stored.v === 1) ? stored : this.defaults();
      // Guarantee shape even if an older/partial blob survived.
      var d = this.defaults();
      for (var k in d) { if (this.data[k] === undefined) this.data[k] = d[k]; }
    },

    defaults: function () {
      return {
        v: 1,
        sound: false,
        onboarded: false,
        likes: {},
        favorites: {},
        products: {},
        categories: {},
        tags: {},
        recent: []
      };
    },

    save: function () {
      if (!this.ok) return;
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify(this.data)); } catch (e) { /* quota/private mode */ }
    }
  };

  /* ----------------------------------------------------------------------
   * Helpers
   * -------------------------------------------------------------------- */
  var REDUCED_MOTION = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var CFG = {};

  function $(sel, ctx) { return (ctx || document).querySelector(sel); }
  function $all(sel, ctx) { return Array.prototype.slice.call((ctx || document).querySelectorAll(sel)); }

  function esc(str) {
    return String(str == null ? '' : str).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function debounce(fn, wait) {
    var t;
    return function () {
      var args = arguments, ctx = this;
      clearTimeout(t);
      t = setTimeout(function () { fn.apply(ctx, args); }, wait);
    };
  }

  function copyText(text) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      return navigator.clipboard.writeText(text).catch(function () { legacyCopy(text); });
    }
    legacyCopy(text);
    return Promise.resolve();
  }

  function legacyCopy(text) {
    var ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    try { document.execCommand('copy'); } catch (e) { /* noop */ }
    document.body.removeChild(ta);
  }

  /* ======================================================================
   * FEED MODE
   * ==================================================================== */
  function initFeed(root) {
    var feed = $('.reel-feed', root);
    var toastEl = $('.reel-toast', root);
    var onboardEl = $('.reel-onboard', root);
    var emptyStateEl = $('.reel-state--empty', root);
    var slides = $all('.reel-slide', root).map(buildSlide);
    var currentSlide = null;
    var dwellStart = 0;
    var completedThisView = false;
    var toastTimer = null;

    if (!slides.length) slides = injectSampleSlides(feed);

    /* ---------- slide factory ---------- */
    function buildSlide(el) {
      var dataEl = $('.reel-json', el);
      var data = {};
      if (dataEl) { try { data = JSON.parse(dataEl.textContent); } catch (e) { data = {}; } }
      var slide = {
        el: el,
        data: data,
        track: $('.reel-track', el),
        dotsEl: $('.reel-dots', el),
        video: $('video', el),
        dots: [],
        loaded: false,
        mediaCount: $all('.reel-media', el).length
      };
      wireSlide(slide);
      return slide;
    }

    function wireSlide(slide) {
      // Carousel dots (built in JS so Liquid and samples share one path).
      if (slide.dotsEl && slide.mediaCount > 1) {
        for (var i = 0; i < slide.mediaCount; i++) {
          var dot = document.createElement('span');
          dot.className = 'reel-dot' + (i === 0 ? ' is-active' : '');
          slide.dotsEl.appendChild(dot);
          slide.dots.push(dot);
        }
        if (slide.track) {
          slide.track.addEventListener('scroll', function () {
            requestAnimationFrame(function () { updateDots(slide); });
          }, { passive: true });
        }
      }

      // Tap / double-tap on the media area.
      var downX = 0, downY = 0, downTime = 0, lastTapAt = 0, tapTimer = null;
      var mediaArea = slide.track || slide.el;

      mediaArea.addEventListener('pointerdown', function (e) {
        downX = e.clientX; downY = e.clientY; downTime = Date.now();
      }, { passive: true });

      mediaArea.addEventListener('pointerup', function (e) {
        var dx = Math.abs(e.clientX - downX);
        var dy = Math.abs(e.clientY - downY);
        if (dx > 12 || dy > 12 || Date.now() - downTime > 600) return; // swipe, not tap

        var now = Date.now();
        if (now - lastTapAt < 300) {
          clearTimeout(tapTimer);
          lastTapAt = 0;
          onDoubleTap(slide, e);
        } else {
          lastTapAt = now;
          tapTimer = setTimeout(function () { onSingleTap(slide); }, 300);
        }
      }, { passive: true });

      // Action rail.
      var likeBtn = $('[data-action="like"]', slide.el);
      var favBtn = $('[data-action="favorite"]', slide.el);
      var shareBtn = $('[data-action="share"]', slide.el);

      if (likeBtn) likeBtn.addEventListener('click', function () { toggleLike(slide); });
      if (favBtn) favBtn.addEventListener('click', function () { toggleFavorite(slide); });
      if (shareBtn) shareBtn.addEventListener('click', function () { shareSlide(slide); });

      // Category chip on the rail filters the feed by that category.
      var chipBtn = $('[data-action="filter-category"]', slide.el);
      if (chipBtn) {
        chipBtn.addEventListener('click', function () {
          if (searchPanel) searchPanel.classList.add('is-open');
          setActiveCategory(slide.data.category);
        });
      }

      // Affiliate CTA telemetry (the link itself opens normally in a new tab).
      var cta = $('.reel-cta', slide.el);
      if (cta && cta.tagName === 'A') {
        cta.addEventListener('click', function () {
          var stat = prodStat(slide.data.id);
          stat.cta = (stat.cta || 0) + 1;
          bumpAffinity(slide.data, EVENT_WEIGHTS.cta);
          Store.save();
        });
      }

      // Video completion tracking.
      if (slide.video) {
        slide.video.addEventListener('timeupdate', function () {
          var v = slide.video;
          if (!completedThisView && v.duration && v.currentTime / v.duration >= 0.9) {
            completedThisView = true;
            var stat = prodStat(slide.data.id);
            stat.completes = (stat.completes || 0) + 1;
            bumpAffinity(slide.data, EVENT_WEIGHTS.complete);
            Store.save();
          }
        }, { passive: true });
      }

      // Description "more" toggle.
      var moreBtn = $('.reel-info__more', slide.el);
      if (moreBtn) {
        moreBtn.addEventListener('click', function () {
          var desc = $('.reel-info__desc', slide.el);
          var expanded = desc.classList.toggle('is-expanded');
          moreBtn.textContent = expanded ? 'less' : 'more';
        });
      }

      syncActionButtons(slide);
    }

    function updateDots(slide) {
      if (!slide.track || !slide.dots.length) return;
      var idx = Math.round(slide.track.scrollLeft / Math.max(1, slide.track.clientWidth));
      idx = Math.max(0, Math.min(idx, slide.dots.length - 1));
      slide.dots.forEach(function (d, i) { d.classList.toggle('is-active', i === idx); });
    }

    /* ---------- lazy loading ---------- */
    function ensureMediaLoaded(slide) {
      if (!slide || slide.loaded) return;
      slide.loaded = true;
      $all('[data-src]', slide.el).forEach(function (node) {
        var src = node.getAttribute('data-src');
        if (!src) return;
        node.src = src;
        node.removeAttribute('data-src');
        if (node.tagName === 'VIDEO') {
          node.defaultMuted = true;
          node.muted = !Store.data.sound;
          node.setAttribute('muted', '');
          node.setAttribute('playsinline', '');
          node.setAttribute('webkit-playsinline', '');
          try { node.load(); } catch (e) {}
        }
      });
    }

    function loadNeighbors(index) {
      for (var i = index - 1; i <= index + 2; i++) {
        if (slides[i]) ensureMediaLoaded(slides[i]);
      }
    }

    /* ---------- active slide management ---------- */
    function activate(slide) {
      if (slide === currentSlide) return;
      deactivateCurrent();

      currentSlide = slide;
      dwellStart = performance.now();
      completedThisView = false;

      var index = slides.indexOf(slide);
      loadNeighbors(index);

      var stat = prodStat(slide.data.id);
      stat.views = (stat.views || 0) + 1;
      stat.last = Date.now();
      pushRecent(slide.data.id);
      bumpAffinity(slide.data, EVENT_WEIGHTS.view);

      if (slide.video) {
        if (!REDUCED_MOTION) playVideo(slide);
        else pauseVideo(slide);
      }
    }

    function deactivateCurrent() {
      if (!currentSlide) return;
      flushDwell(currentSlide);
      if (currentSlide.video) pauseVideo(currentSlide);
      currentSlide = null;
    }

    function flushDwell(slide) {
      if (!dwellStart) return;
      var secs = (performance.now() - dwellStart) / 1000;
      dwellStart = 0;
      if (secs < DWELL_SAVE_MIN_SECONDS) return;
      var stat = prodStat(slide.data.id);
      stat.dwell = (stat.dwell || 0) + secs;
      bumpAffinity(slide.data, Math.min(3, secs / 10) * EVENT_WEIGHTS.dwellPer10s);
      Store.save();
    }

    function playVideo(slide) {
      var v = slide.video;
      if (!v) return;
      v.defaultMuted = true;
      v.muted = !Store.data.sound;
      var cell = v.closest('.reel-media');
      if (cell) cell.classList.remove('is-paused');
      var p = v.play();
      if (p && p.catch) {
        p.catch(function () {
          // If unmuted autoplay fails, try muted playback
          if (!v.muted) {
            v.muted = true;
            v.play().catch(function () {});
          }
        });
      }
    }

    function pauseVideo(slide) {
      var v = slide.video;
      if (!v) return;
      v.pause();
      var cell = v.closest('.reel-media');
      if (cell && !v.ended) cell.classList.add('is-paused');
    }

    /* ---------- gestures ---------- */
    function onSingleTap(slide) {
      if (slide !== currentSlide || !slide.video) return;
      var cell = slide.video.closest('.reel-media');
      if (slide.video.paused) {
        slide.video.play().then(function () {
          if (cell) cell.classList.remove('is-paused');
        }).catch(function () {});
      } else {
        slide.video.pause();
        if (cell) cell.classList.add('is-paused');
      }
    }

    function onDoubleTap(slide, e) {
      if (!Store.data.likes[slide.data.id]) toggleLike(slide, true);
      // Heart burst at tap position.
      var cell = e.target.closest ? e.target.closest('.reel-media') : null;
      cell = cell || slide.track;
      var rect = cell.getBoundingClientRect();
      var heart = document.createElement('span');
      heart.className = 'rs-heart';
      heart.style.left = (e.clientX - rect.left) + 'px';
      heart.style.top = (e.clientY - rect.top) + 'px';
      heart.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 21s-7.5-4.7-10-9.3C.4 8.4 2.4 4.5 6 4.5c2.2 0 3.6 1.2 4.4 2.4h3.2c.8-1.2 2.2-2.4 4.4-2.4 3.6 0 5.6 3.9 4 7.2C19.5 16.3 12 21 12 21z"/></svg>';
      cell.appendChild(heart);
      setTimeout(function () { heart.remove(); }, 850);
    }

    /* ---------- keyboard navigation (desktop) ---------- */
    function scrollToSlide(index) {
      if (!slides[index]) return;
      feed.scrollTo({
        top: slides[index].el.offsetTop,
        behavior: REDUCED_MOTION ? 'auto' : 'smooth'
      });
    }

    document.addEventListener('keydown', function (e) {
      if (e.target && /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName)) return;
      var idx = currentSlide ? slides.indexOf(currentSlide) : 0;
      switch (e.key) {
        case 'ArrowDown':
        case 'j':
          e.preventDefault(); scrollToSlide(idx + 1); break;
        case 'ArrowUp':
        case 'k':
          e.preventDefault(); scrollToSlide(idx - 1); break;
        case 'm':
          toggleSound(); break;
      }
    });

    /* ---------- engagement tracking ---------- */
    function prodStat(id) {
      if (id == null) return {};
      var map = Store.data.products;
      return map[id] || (map[id] = { views: 0, dwell: 0, completes: 0, cta: 0, shares: 0, last: 0 });
    }

    function pushRecent(id) {
      var list = Store.data.recent;
      var at = list.indexOf(id);
      if (at > -1) list.splice(at, 1);
      list.push(id);
      if (list.length > 24) list.shift();
    }

    function bumpAffinity(data, amount) {
      if (!data || !amount) return;
      if (data.category) {
        Store.data.categories[data.category] = (Store.data.categories[data.category] || 0) + amount;
      }
      (data.tags || []).forEach(function (t) {
        Store.data.tags[t] = (Store.data.tags[t] || 0) + amount * 0.6;
      });
    }

    /* ---------- the algorithm ---------- */
    function scoreSlide(slide) {
      var d = slide.data;
      var st = Store.data;
      var p = (d.id != null && st.products[d.id]) || {};

      // Category + tag affinity (log-scaled so hot categories saturate).
      var catAff = (d.category && st.categories[d.category]) || 0;
      var tagAff = 0;
      if (d.tags && d.tags.length) {
        var sum = 0;
        d.tags.forEach(function (t) { sum += st.tags[t] || 0; });
        tagAff = sum / d.tags.length;
      }
      var affinity = Math.log(1 + catAff) / Math.LN2 + 0.6 * (Math.log(1 + tagAff) / Math.LN2);

      // Past engagement with this exact product.
      var engagement = Math.min(ALGO.MAX_ENGAGEMENT,
        (p.views || 0) * 0.15 +
        (p.completes || 0) * 0.9 +
        (p.cta || 0) * 1.2 +
        (st.likes[d.id] ? 1 : 0) +
        (st.favorites[d.id] ? 1 : 0));

      // Freshness: 1 if never seen, recovers with time since last view.
      var freshness = 1;
      if (p.last) {
        var hoursSince = (Date.now() - p.last) / 3.6e6;
        freshness = 1 - Math.exp(-hoursSince / ALGO.FRESHNESS_HALF_LIFE_HOURS);
      }

      var score =
        ALGO.AFFINITY * affinity +
        ALGO.ENGAGEMENT * engagement +
        ALGO.FRESHNESS * freshness +
        ALGO.RANDOM_NOISE * Math.random();

      // Avoid immediate repeats of something just viewed.
      if (p.last && Date.now() - p.last < ALGO.REPEAT_WINDOW_MINUTES * 60000) {
        score -= ALGO.REPEAT_PENALTY;
      }
      return score;
    }

    function reorderFeed() {
      if (!CFG.algorithm) return; // theme editor turned the algorithm off
      if (!Store.ok && !CFG.forceReorder) {
        // localStorage disabled: keep the default Liquid order.
        return;
      }

      var arr = slides.slice().sort(function (a, b) { return scoreSlide(b) - scoreSlide(a); });

      // Epsilon-greedy exploration: with probability `exploration`, swap a
      // slot with a random later item so new products get a chance.
      var epsilon = Math.max(0, Math.min(0.85, Number(CFG.exploration) || 0));
      for (var i = 0; i < arr.length - 1; i++) {
        if (Math.random() < epsilon) {
          var j = i + 1 + Math.floor(Math.random() * (arr.length - i - 1));
          var tmp = arr[i]; arr[i] = arr[j]; arr[j] = tmp;
        }
      }
      slides = arr;
      slides.forEach(function (s) { feed.appendChild(s.el); });
    }

    function moveToFront(slide) {
      var at = slides.indexOf(slide);
      if (at > 0) {
        slides.splice(at, 1);
        slides.unshift(slide);
        slides.forEach(function (s) { feed.appendChild(s.el); });
      }
      feed.scrollTop = 0;
      ensureMediaLoaded(slide);
    }

    /* ---------- likes / favorites ---------- */
    function syncActionButtons(slide) {
      var likeBtn = $('[data-action="like"]', slide.el);
      var favBtn = $('[data-action="favorite"]', slide.el);
      if (likeBtn) {
        var liked = !!Store.data.likes[slide.data.id];
        likeBtn.classList.toggle('is-on', liked);
        likeBtn.setAttribute('aria-pressed', String(liked));
      }
      if (favBtn) {
        var fav = !!Store.data.favorites[slide.data.id];
        favBtn.classList.toggle('is-on', fav);
        favBtn.setAttribute('aria-pressed', String(fav));
      }
    }

    function toggleLike(slide, silent) {
      var id = slide.data.id;
      var on = !Store.data.likes[id];
      if (on) Store.data.likes[id] = Date.now();
      else delete Store.data.likes[id];
      if (on) bumpAffinity(slide.data, EVENT_WEIGHTS.like);
      syncActionButtons(slide);
      Store.save();
      if (!silent) toast(on ? 'Liked' : 'Like removed');
    }

    function toggleFavorite(slide) {
      var id = slide.data.id;
      var on = !Store.data.favorites[id];
      if (on) Store.data.favorites[id] = Date.now();
      else delete Store.data.favorites[id];
      if (on) bumpAffinity(slide.data, EVENT_WEIGHTS.favorite);
      syncActionButtons(slide);
      Store.save();
      toast(on ? 'Saved to favorites' : 'Removed from favorites');
    }

    /* ---------- share ---------- */
    function shareSlide(slide) {
      var d = slide.data;
      var url = d.shareUrl || (location.origin + '/?product=' + d.handle);

      var record = function () {
        var stat = prodStat(d.id);
        stat.shares = (stat.shares || 0) + 1;
        bumpAffinity(d, EVENT_WEIGHTS.share);
        Store.save();
      };

      if (navigator.share) {
        navigator.share({ title: d.title, text: d.title, url: url })
          .then(function () { record(); })
          .catch(function (err) {
            if (err && err.name === 'AbortError') return; // user cancelled
            copyText(url).then(function () { toast('Link copied'); record(); });
          });
      } else {
        copyText(url).then(function () { toast('Link copied'); record(); });
      }
    }

    /* ---------- toast & onboarding ---------- */
    var onboardEl = $('.reel-onboard', root);
    var onboardDismissed = false;

    function dismissOnboarding() {
      if (!onboardEl || onboardDismissed) return;
      onboardDismissed = true;
      onboardEl.classList.add('is-dismissed');
      setTimeout(function () {
        if (onboardEl) {
          onboardEl.hidden = true;
          onboardEl.style.display = 'none';
        }
      }, 400);
      Store.data.onboarded = true;
      Store.save();
    }

    if (onboardEl) {
      if (Store.data.onboarded) {
        onboardEl.hidden = true;
        onboardEl.style.display = 'none';
        onboardEl.classList.add('is-dismissed');
      } else {
        onboardEl.hidden = false;
        onboardEl.removeAttribute('hidden');
        onboardEl.style.display = 'flex';
        onboardEl.classList.remove('is-dismissed');
        setTimeout(function () {
          ['pointerdown', 'touchstart', 'wheel', 'keydown'].forEach(function (evt) {
            window.addEventListener(evt, dismissOnboarding, { passive: true, once: true });
          });
          if (feed) {
            feed.addEventListener('scroll', function onFirstScroll() {
              if (feed.scrollTop > 20) {
                dismissOnboarding();
                feed.removeEventListener('scroll', onFirstScroll);
              }
            }, { passive: true });
          }
        }, 1200);
        setTimeout(dismissOnboarding, 6000);
      }
    }

    function toast(msg) {
      if (!toastEl) return;
      toastEl.textContent = msg;
      toastEl.classList.add('is-visible');
      clearTimeout(toastTimer);
      toastTimer = setTimeout(function () { toastEl.classList.remove('is-visible'); }, 1800);
    }

    /* ---------- sound ---------- */
    var soundBtn = $('[data-action="sound"]', root);
    function paintSound() {
      if (!soundBtn) return;
      var on = Store.data.sound;
      soundBtn.setAttribute('aria-pressed', String(on));
      soundBtn.setAttribute('aria-label', on ? 'Mute sound' : 'Unmute sound');
      var wave = $('.rs-sound-wave', soundBtn);
      var slash = $('.rs-sound-slash', soundBtn);
      if (wave) wave.style.display = on ? '' : 'none';
      if (slash) slash.style.display = on ? 'none' : '';
    }
    function toggleSound() {
      Store.data.sound = !Store.data.sound;
      $all('video', root).forEach(function (v) { v.muted = !Store.data.sound; });
      if (Store.data.sound && currentSlide && currentSlide.video) playVideo(currentSlide);
      paintSound();
      Store.save();
      toast(Store.data.sound ? 'Sound on' : 'Sound off');
    }
    if (soundBtn) soundBtn.addEventListener('click', toggleSound);
    paintSound();

    /* ---------- search + category filter ---------- */
    var searchPanel = $('.reel-searchpanel', root);
    var searchToggle = $('[data-action="search"]', root);
    var searchInput = searchPanel ? $('input[type="search"]', searchPanel) : null;
    var chipsWrap = $('.reel-chips', root);
    var activeCategory = '';

    function setActiveCategory(cat) {
      activeCategory = cat || '';
      if (chipsWrap) {
        $all('.reel-chip', chipsWrap).forEach(function (c) {
          var on = (c.getAttribute('data-cat') || '') === activeCategory;
          c.classList.toggle('is-active', on);
          c.setAttribute('aria-pressed', String(on));
        });
      }
      applyFilter();
    }

    function buildChips() {
      if (!chipsWrap) return;
      var counts = {};
      slides.forEach(function (s) {
        var c = s.data.category;
        if (c) counts[c] = (counts[c] || 0) + 1;
      });
      var cats = Object.keys(counts).sort(function (a, b) { return counts[b] - counts[a]; }).slice(0, 12);

      var html = '<button class="reel-chip is-active" data-cat="" aria-pressed="true">All</button>';
      cats.forEach(function (c) {
        html += '<button class="reel-chip" data-cat="' + esc(c) + '" aria-pressed="false">' + esc(c) + '</button>';
      });
      chipsWrap.innerHTML = html;

      chipsWrap.addEventListener('click', function (e) {
        var chip = e.target.closest('.reel-chip');
        if (!chip) return;
        setActiveCategory(chip.getAttribute('data-cat'));
      });
    }

    function applyFilter() {
      var q = searchInput ? searchInput.value.trim().toLowerCase() : '';
      var visible = 0;
      slides.forEach(function (s) {
        var d = s.data;
        var matchesCat = !activeCategory || d.category === activeCategory;
        var haystack = ((d.title || '') + ' ' + (d.category || '') + ' ' + (d.tags || []).join(' ')).toLowerCase();
        var matchesQ = !q || haystack.indexOf(q) > -1;
        var show = matchesCat && matchesQ;
        s.el.classList.toggle('rs-hidden', !show);
        if (show) visible++;
      });
      if (emptyStateEl) emptyStateEl.hidden = visible > 0;
      feed.scrollTop = 0;
      // Re-detect the active slide after filtering.
      var firstVisible = slides.filter(function (s) { return !s.el.classList.contains('rs-hidden'); })[0];
      if (firstVisible) activate(firstVisible);
    }

    if (searchToggle && searchPanel) {
      searchToggle.addEventListener('click', function () {
        var open = searchPanel.classList.toggle('is-open');
        searchToggle.setAttribute('aria-expanded', String(open));
        if (open && searchInput) searchInput.focus();
      });
      var closeBtn = $('[data-action="close-search"]', searchPanel);
      if (closeBtn) closeBtn.addEventListener('click', function () {
        searchPanel.classList.remove('is-open');
        searchToggle.setAttribute('aria-expanded', 'false');
      });
    }
    if (searchInput) searchInput.addEventListener('input', debounce(applyFilter, 220));
    buildChips();

    /* ---------- sample products (feed renders before real data exists) ---------- */
    function injectSampleSlides(container) {
      var samples = [
        {
          id: 'demo-blender', handle: 'demo-mini-blender', title: 'Portable Mini Juicer Blender', emoji: '🥤',
          description: 'USB rechargeable 380ml blender for juices, shakes & baby food. 6 stainless blades, one-touch operation.',
          category: 'Kitchen', tags: ['kitchen', 'gadgets'], platform: 'amazon', platformLabel: 'Amazon',
          aff: 'https://www.amazon.in/s?k=portable+mini+blender',
          priceDisplay: '₹799', originalPriceDisplay: '₹1,499', discountPct: 47, rating: 4.3
        },
        {
          id: 'demo-led-strip', handle: 'demo-led-strip', title: 'RGB LED Strip Lights 5m', emoji: '💡',
          description: 'Colour-changing strip with remote & app control. 16 colours, cuttable, sticky back — bedroom favourite.',
          category: 'Home Decor', tags: ['lights', 'room'], platform: 'meesho', platformLabel: 'Meesho',
          aff: 'https://www.meesho.com/search?q=rgb+led+strip+lights',
          priceDisplay: '₹349', originalPriceDisplay: '₹999', discountPct: 65, rating: 4.1
        },
        {
          id: 'demo-earbuds', handle: 'demo-earbuds', title: 'TWS Wireless Earbuds', emoji: '🎧',
          description: 'Bluetooth 5.3, 30h playtime with case, touch controls & ENC mic for clear calls.',
          category: 'Audio', tags: ['earbuds', 'bluetooth'], platform: 'amazon', platformLabel: 'Amazon',
          aff: 'https://www.amazon.in/s?k=tws+wireless+earbuds',
          priceDisplay: '₹1,299', originalPriceDisplay: '₹2,999', discountPct: 57, rating: 4.4
        },
        {
          id: 'demo-holder', handle: 'demo-car-holder', title: 'Magnetic Car Phone Holder', emoji: '🚗',
          description: 'Strong magnet, 360° rotation, fits any phone. Dashboard & air-vent mount.',
          category: 'Auto', tags: ['car', 'phone'], platform: 'meesho', platformLabel: 'Meesho',
          aff: 'https://www.meesho.com/search?q=magnetic+car+phone+holder',
          priceDisplay: '₹199', originalPriceDisplay: '₹599', discountPct: 67, rating: 4.0
        },
        {
          id: 'demo-bottle', handle: 'demo-steel-bottle', title: 'Stainless Steel Bottle 1L', emoji: '🍶',
          description: 'Double-wall insulated — cold 24h, hot 12h. Leak-proof, gym & office ready.',
          category: 'Kitchen', tags: ['bottle', 'gym'], platform: 'amazon', platformLabel: 'Amazon',
          aff: 'https://www.amazon.in/s?k=stainless+steel+water+bottle+1l',
          priceDisplay: '₹449', originalPriceDisplay: '₹899', discountPct: 50, rating: 4.5
        },
        {
          id: 'demo-fairy', handle: 'demo-fairy-lights', title: 'Warm White Fairy Lights 10m', emoji: '✨',
          description: '100 LEDs, 8 modes, perfect for festivals, birthdays & room makeovers.',
          category: 'Home Decor', tags: ['lights', 'festive'], platform: 'meesho', platformLabel: 'Meesho',
          aff: 'https://www.meesho.com/search?q=fairy+string+lights',
          priceDisplay: '₹249', originalPriceDisplay: '₹699', discountPct: 64, rating: 4.2
        },
        {
          id: 'demo-band', handle: 'demo-fitness-band', title: 'Smart Fitness Band', emoji: '⌚',
          description: 'Heart-rate, SpO2, sleep tracking & 14-day battery. Calls & message alerts.',
          category: 'Fitness', tags: ['fitness', 'smart'], platform: 'flipkart', platformLabel: 'Flipkart',
          aff: 'https://www.flipkart.com/search?q=smart+fitness+band',
          priceDisplay: '₹999', originalPriceDisplay: '₹1,999', discountPct: 50, rating: 4.0
        },
        {
          id: 'demo-kadai', handle: 'demo-kadai-set', title: 'Non-stick Kadai with Lid', emoji: '🍳',
          description: 'Induction-friendly 5-layer coating, 2.5L — everyday cooking without sticking.',
          category: 'Kitchen', tags: ['kitchen', 'cookware'], platform: 'meesho', platformLabel: 'Meesho',
          aff: 'https://www.meesho.com/search?q=non+stick+kadai',
          priceDisplay: '₹649', originalPriceDisplay: '₹1,299', discountPct: 50, rating: 4.3
        }
      ];

      return samples.map(function (d, i) {
        var hue = (i * 67 + 200) % 360;
        var mediaHtml = '';
        for (var m = 0; m < 3; m++) {
          mediaHtml +=
            '<div class="reel-media reel-media--placeholder" style="background:linear-gradient(' + (160 + m * 40) + 'deg,hsl(' + ((hue + m * 40) % 360) + ',45%,' + (26 - m * 5) + '%),hsl(' + ((hue + 100 + m * 40) % 360) + ',50%,10%))">' +
              '<span class="rs-emoji" aria-hidden="true">' + d.emoji + '</span>' +
            '</div>';
        }
        var article = document.createElement('article');
        article.className = 'reel-slide';
        article.setAttribute('aria-label', d.title);
        article.innerHTML =
          '<span class="rs-sample-badge">DEMO</span>' +
          '<div class="reel-track">' + mediaHtml + '</div>' +
          '<div class="reel-scrim"></div><div class="reel-scrim reel-scrim--top"></div>' +
          '<div class="reel-info">' +
            '<span class="reel-info__platform">' + esc(d.platformLabel) + '</span>' +
            '<h2 class="reel-info__title">' + esc(d.title) + '</h2>' +
            '<span class="reel-info__rating">★ ' + d.rating + '</span>' +
            '<p class="reel-info__desc">' + esc(d.description) + '</p>' +
            '<div class="reel-price"><span class="reel-price__current">' + esc(d.priceDisplay) + '</span>' +
              (d.originalPriceDisplay ? '<s class="reel-price__original">' + esc(d.originalPriceDisplay) + '</s><span class="reel-price__badge">-' + d.discountPct + '%</span>' : '') +
            '</div>' +
            '<a class="reel-cta" href="' + esc(d.aff) + '" target="_blank" rel="nofollow sponsored noopener"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 17L17 7M17 7H8M17 7v9"/></svg>Buy on ' + esc(d.platformLabel) + '</a>' +
          '</div>' +
          '<div class="reel-rail">' +
            '<button class="reel-rail__btn" data-action="like" aria-pressed="false" aria-label="Like"><span class="reel-rail__icon"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 20.7C7.3 17.6 3.5 14.2 2.4 10.9 1.3 7.4 3.4 4.5 6.4 4.5c1.9 0 3.2 1 4.1 2.3l1.5 2.1 1.5-2.1c.9-1.3 2.2-2.3 4.1-2.3 3 0 5.1 2.9 4 6.4-1.1 3.3-4.9 6.7-9.6 9.8z"/></svg></span><span class="reel-rail__label">Like</span></button>' +
            '<button class="reel-rail__btn" data-action="favorite" aria-pressed="false" aria-label="Save to favorites"><span class="reel-rail__icon"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 3h12v18l-6-4.2L6 21z"/></svg></span><span class="reel-rail__label">Save</span></button>' +
            '<button class="reel-rail__btn" data-action="share" aria-label="Share"><span class="reel-rail__icon"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="6" cy="12" r="2.6"/><circle cx="17.5" cy="5.5" r="2.6"/><circle cx="17.5" cy="18.5" r="2.6"/><path d="M8.4 10.8l6.8-4M8.4 13.2l6.8 4"/></svg></span><span class="reel-rail__label">Share</span></button>' +
            '<span class="reel-rail__chip">' + esc(d.category) + '</span>' +
          '</div>' +
          '<div class="reel-dots"></div>' +
          '<script type="application/json" class="reel-json">' + JSON.stringify({
            id: d.id, handle: d.handle, title: d.title, category: d.category, tags: d.tags,
            platform: d.platform, platformLabel: d.platformLabel, affiliateUrl: d.aff,
            videoUrl: '', images: [], rating: d.rating, shareUrl: ''
          }) + '<\/script>';
        container.appendChild(article);
        return buildSlide(article);
      });
    }

    /* ---------- boot ---------- */
    var params = new URLSearchParams(location.search);
    var targetHandle = params.get('product') || params.get('reel') || params.get('id');
    var isProductPage = window.location.pathname.indexOf('/products/') > -1;

    // Preserve the shared product at the top while letting user scroll other reels
    if (!isProductPage && !targetHandle) {
      reorderFeed();
    }

    if (targetHandle) {
      var target = slides.filter(function (s) {
        return s.data.handle === targetHandle || String(s.data.id) === targetHandle;
      })[0];
      if (target) moveToFront(target);
    }

    // IntersectionObserver drives active-slide detection + lazy preload.
    if ('IntersectionObserver' in window) {
      var io = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
          if (entry.intersectionRatio >= 0.5) {
            var slide = slides.filter(function (s) { return s.el === entry.target; })[0];
            if (slide) activate(slide);
          }
        });
      }, { root: feed, threshold: [0.5] });
      slides.forEach(function (s) { io.observe(s.el); });

      var preload = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
          if (!entry.isIntersecting) return;
          var slide = slides.filter(function (s) { return s.el === entry.target; })[0];
          var idx = slides.indexOf(slide);
          if (idx > -1) loadNeighbors(idx);
        });
      }, { root: feed, rootMargin: '150% 0px 150% 0px', threshold: 0 });
      slides.forEach(function (s) { preload.observe(s.el); });
    }

    // Activate the first slide immediately on boot
    if (slides.length > 0) {
      activate(slides[0]);
    }

    // Flush telemetry when leaving / hiding the tab.
    document.addEventListener('visibilitychange', function () {
      if (document.hidden) {
        if (currentSlide) { flushDwell(currentSlide); if (currentSlide.video) currentSlide.video.pause(); }
        Store.save();
      } else if (currentSlide) {
        dwellStart = performance.now();
        if (currentSlide.video && !REDUCED_MOTION) playVideo(currentSlide);
      }
    });
    window.addEventListener('pagehide', function () {
      if (currentSlide) flushDwell(currentSlide);
      Store.save();
    });
  }

  /* ======================================================================
   * FAVORITES PAGE MODE
   * ==================================================================== */
  function initFavorites(root) {
    var dataEl = $('.reel-favdata', root);
    var grid = $('.reel-favgrid', root);
    var emptyEl = $('.reel-favempty', root);
    var catalog = [];
    if (dataEl) { try { catalog = JSON.parse(dataEl.textContent); } catch (e) { catalog = []; } }

    function favoriteItems() {
      return catalog.filter(function (p) { return !!Store.data.favorites[String(p.id)]; });
    }

    function render() {
      var items = favoriteItems();
      if (grid) grid.hidden = items.length === 0;
      if (emptyEl) emptyEl.hidden = items.length > 0;
      if (!grid) return;

      grid.innerHTML = items.map(function (p) {
        return (
          '<article class="reel-favcard" data-id="' + esc(p.id) + '">' +
            '<a class="reel-favcard__media" href="' + esc(p.feedUrl) + '" aria-label="Watch ' + esc(p.title) + ' in the reels feed">' +
              (p.image ? '<img src="' + esc(p.image) + '" alt="' + esc(p.title) + '" loading="lazy">' : '') +
            '</a>' +
            '<div class="reel-favcard__body">' +
              '<h3 class="reel-favcard__title"><a href="' + esc(p.feedUrl) + '">' + esc(p.title) + '</a></h3>' +
              '<div class="reel-favcard__price">' +
                '<span>' + esc(p.priceDisplay) + '</span>' +
                (p.originalPriceDisplay ? '<s class="reel-price__original">' + esc(p.originalPriceDisplay) + '</s>' : '') +
              '</div>' +
              '<div class="reel-favcard__actions">' +
                (p.affiliateUrl
                  ? '<a class="reel-cta" href="' + esc(p.affiliateUrl) + '" target="_blank" rel="nofollow sponsored noopener">Buy on ' + esc(p.platformLabel || 'store') + '</a>'
                  : '<a class="reel-cta" href="' + esc(p.feedUrl) + '">Watch reel</a>') +
                '<button class="reel-favcard__remove" data-remove="' + esc(p.id) + '" aria-label="Remove from favorites">' +
                  '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M9 7V4h6v3m-8 0l1 14h8l1-14"/></svg>' +
                '</button>' +
              '</div>' +
            '</div>' +
          '</article>'
        );
      }).join('');
    }

    if (grid) {
      grid.addEventListener('click', function (e) {
        var btn = e.target.closest('[data-remove]');
        if (!btn) return;
        delete Store.data.favorites[btn.getAttribute('data-remove')];
        Store.save();
        render();
      });
    }

    render();
  }

  /* ======================================================================
   * BOOT
   * ==================================================================== */
  function boot() {
    var root = document.querySelector('[data-reelshop-mode]');
    if (!root) return;

    var cfgEl = document.getElementById('ReelShopConfig');
    if (cfgEl) { try { CFG = JSON.parse(cfgEl.textContent); } catch (e) { CFG = {}; } }

    Store.init();

    var mode = root.getAttribute('data-reelshop-mode');
    if (mode === 'feed') initFeed(root);
    else if (mode === 'favorites') initFavorites(root);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
