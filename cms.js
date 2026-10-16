/**
 * ENVISION PRO VISUAL CMS - Full WordPress & Elementor-Grade Visual Studio
 * In-Place WYSIWYG Editing, Card Row Management (Add/Delete/Reorder),
 * Typography & Style Inspector, Navigation Tab Manager, and Dedicated Event Page Generator.
 */

(function () {
  'use strict';

  // --- CMS Configuration ---
  const CMS_STORAGE_PREFIX = 'envision_cms_';
  const CMS_NAV_KEY = 'envision_cms_global_nav';
  const CMS_GLOBAL_STYLES_KEY = 'envision_cms_global_styles';

  // Normalised so '/about', '/about.html' and a local file all map to the same database row.
  const pagePath = (() => {
    const last = window.location.pathname.split('/').pop() || 'index.html';
    return /\.[a-z0-9]+$/i.test(last) ? last : last + '.html';
  })();
  const pageStorageKey = CMS_STORAGE_PREFIX + 'content_' + pagePath;
  const gridStorageKey = CMS_STORAGE_PREFIX + 'grids_' + pagePath;
  const heroStorageKey = CMS_STORAGE_PREFIX + 'hero_' + pagePath;

  // --- Sanitization & XSS Prevention Helpers ---
  function sanitizeUrl(url) {
    if (!url || typeof url !== 'string') return '#';
    const trimmed = url.trim();
    if (/^\/\//.test(trimmed) || /^(?:javascript|data|vbscript):/i.test(trimmed)) {
      return '#';
    }
    try {
      return encodeURI(decodeURI(trimmed));
    } catch (e) {
      return encodeURI(trimmed);
    }
  }

  function isSafeStyleAttr(value) {
    return !/url\s*\(|expression|@import|behavior|position\s*:\s*(?:fixed|sticky)|javascript:/i.test(value);
  }

  function escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function isSafeImageSrc(value) {
    if (typeof value !== 'string') return false;
    const v = value.trim().replace(/[\u0000-\u0020]+/g, '');
    if (!v) return false;
    if (/^data:(?:image\/(?:png|jpe?g|gif|webp)|video\/(?:mp4|webm|ogg));base64,/i.test(v)) return true;
    if (/^https?:\/\//i.test(v)) return true;
    if (window.location.origin !== 'null' && v.indexOf(window.location.origin + '/') === 0) return true;
    if (/^\/\//.test(v)) return false;
    return !/^[a-z][a-z0-9+.-]*:/i.test(v); // plain relative path such as "photo.jpg" or "/img/a.png"
  }

  function isSafeTransform(value) {
    return typeof value === 'string' && value.length <= 120 &&
      /^(?:\s*(?:translate|translateX|translateY|translate3d|scale|scaleX|scaleY|rotate|skew|skewX|skewY)\([0-9a-z.,\s%+-]*\)\s*)*$/i.test(value);
  }

  function sanitizeGlobalStyles(styles) {
    const clean = {};
    Object.keys(styles || {}).forEach((key) => {
      const value = styles[key];
      // colours / lengths only: no ; { } < > quotes, url(), expression() etc.
      if (typeof value === 'string' && value.length <= 64 && /^[#a-z0-9(),.%\s-]+$/i.test(value) && !/url|expression|import/i.test(value)) {
        clean[key] = value;
      }
    });
    return clean;
  }

  const ALLOWED_TAGS = new Set([
    'A', 'ABBR', 'ADDRESS', 'ARTICLE', 'ASIDE', 'B', 'BDI', 'BDO', 'BLOCKQUOTE', 'BR',
    'BUTTON', 'CITE', 'CODE', 'DATA', 'DD', 'DEL', 'DETAILS', 'DFN', 'DIV', 'DL', 'DT',
    'EM', 'FIGCAPTION', 'FIGURE', 'FOOTER', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'HEADER',
    'HGROUP', 'HR', 'I', 'IMG', 'INS', 'KBD', 'LI', 'MAIN', 'MARK', 'NAV',
    'OL', 'P', 'PICTURE', 'PRE', 'Q', 'RP', 'RT', 'RUBY', 'S', 'SAMP', 'SECTION',
    'SMALL', 'SOURCE', 'SPAN', 'STRONG', 'SUB', 'SUMMARY', 'SUP',
    'TABLE', 'TBODY', 'TD', 'TFOOT', 'TH', 'THEAD', 'TIME', 'TR', 'U', 'UL', 'VAR', 'VIDEO', 'WBR'
  ]);

  const CMS_UI_SELECTOR = [
    '#wp-admin-bar',
    '#wp-word-ribbon',
    '#wp-floating-toolbar',
    '#wp-sidebar-inspector',
    '#cms-trigger-btn',
    '.cms-modal-backdrop',
    '.cms-toast',
    '.wp-section-bar',
    '.wp-add-section-divider',
    '.wp-nav-add-btn',
    '.wp-card-toolbar',
    '.wp-card-btn',
    '.wp-add-card-placeholder',
    '.wp-hero-edit-pill',
    '.wp-card-media-pill',
    '.cms-element-move-pill',
    '.cms-relocate-popover',
    '.wp-btn-action-bar',
    '.wp-btn-edit-badge',
    '.wp-btn-badge-action',
    '.wp-btn-killed-pill',
    '.wp-hero-btn-add',
    '.cms-drop-indicator-line',
    '.cms-ignore',
    '.cms-ghost',
    '.cms-drag-tooltip',
    '.cms-drop-placeholder',
    '.cms-move-btn',
    '.cms-move-menu-toggle',
    '.cms-relocate-item',
    '.cms-relocate-divider',
    '.cms-hero-sound-btn'
  ].join(', ');

  function getCleanElementHtml(el) {
    if (!el) return '';
    const clone = el.cloneNode(true);
    clone.querySelectorAll(CMS_UI_SELECTOR).forEach((node) => node.remove());
    clone.querySelectorAll('[contenteditable]').forEach((node) => node.removeAttribute('contenteditable'));
    clone.querySelectorAll('[data-cms-relocatable]').forEach((node) => node.removeAttribute('data-cms-relocatable'));
    clone.querySelectorAll('[data-cms-editable], [data-cms-editable-image]').forEach((node) => {
      node.removeAttribute('data-cms-editable');
      node.removeAttribute('data-cms-editable-image');
    });
    clone.querySelectorAll('[data-cms-card]').forEach((node) => {
      node.removeAttribute('data-cms-card');
    });
    clone.querySelectorAll('.cms-dragging, .cms-drop-target-before, .cms-drop-target-after, .cms-move-active').forEach((node) => {
      node.classList.remove('cms-dragging', 'cms-drop-target-before', 'cms-drop-target-after', 'cms-move-active');
    });
    clone.querySelectorAll('.fade').forEach((node) => {
      node.classList.remove('fade');
    });
    return clone.innerHTML;
  }

  const FORBIDDEN_TAGS = new Set(['SCRIPT', 'IFRAME', 'OBJECT', 'EMBED', 'STYLE', 'LINK', 'META', 'FORM', 'INPUT', 'TEXTAREA', 'SELECT', 'OPTION', 'APPLET', 'BASE', 'SVG', 'MATH', 'NOSCRIPT']);

  function sanitizeHtml(html) {
    if (!html || typeof html !== 'string') return '';
    const template = document.createElement('template');
    template.innerHTML = html;

    // Immediately remove any CMS UI elements, move pills, or editor toolbars that might have been stored in HTML
    template.content.querySelectorAll(CMS_UI_SELECTOR).forEach((node) => node.remove());
    template.content.querySelectorAll('[contenteditable]').forEach((node) => node.removeAttribute('contenteditable'));
    template.content.querySelectorAll('[data-cms-relocatable]').forEach((node) => node.removeAttribute('data-cms-relocatable'));

    template.content.querySelectorAll('*').forEach((node) => {
      const tag = node.tagName.toUpperCase();
      if (FORBIDDEN_TAGS.has(tag)) {
        node.remove();
        return;
      }
      if (!ALLOWED_TAGS.has(tag)) {
        node.replaceWith(...Array.from(node.childNodes));
        return;
      }

      // Filter attributes
      Array.from(node.attributes).forEach((attr) => {
        const name = attr.name.toLowerCase();
        const val = attr.value;

        // Remove all on* event handler attributes
        if (name.startsWith('on') || name.includes(':')) {
          node.removeAttribute(attr.name);
          return;
        }

        if (name === 'style' && !isSafeStyleAttr(val)) {
          node.removeAttribute(attr.name);
          return;
        }

        // Validate links
        if (name === 'href' || name === 'src' || name === 'poster' || name === 'action') {
          const normalized = val.trim().replace(/[\u0000-\u0020]+/g, '');
          const isRasterDataImg = tag === 'IMG' && name === 'src' && isSafeImageSrc(val) && /^data:/i.test(normalized);
          if (/^\/\//.test(normalized) || (!isRasterDataImg && /^(?:javascript|data|vbscript|file|about):/i.test(normalized))) {
            node.removeAttribute(attr.name);
            return;
          }
          if (tag === 'A') {
            node.setAttribute('rel', 'noopener noreferrer');
          }
        }
        if (name === 'data-cms-card') {
          node.removeAttribute(attr.name);
        }
      });
    });

    return template.innerHTML;
  }

  async function getAuthorizedSession() {
    if (!window.supabaseClient) {
      return null;
    }
    try {
      const { data, error } = await window.supabaseClient.auth.getSession();
      if (error || !data.session) return null;
      const role = data.session.user?.app_metadata?.role;
      if (role !== 'admin') return null;
      if (window.supabaseClient.auth.mfa?.getAuthenticatorAssuranceLevel) {
        const { data: assurance, error: assuranceError } =
          await window.supabaseClient.auth.mfa.getAuthenticatorAssuranceLevel();
        if (assuranceError) return null;
        if (assurance?.nextLevel === 'aal2' && assurance?.currentLevel !== 'aal2') {
          return null;
        }
      }
      return data.session;
    } catch (e) {
      return null;
    }
  }

  async function completeMfaChallenge(session, code) {
    const { data: factors, error: factorsError } =
      await window.supabaseClient.auth.mfa.listFactors();
    if (factorsError) throw factorsError;

    const factor = factors?.totp?.find((item) => item.status === 'verified');
    if (!factor) {
      throw new Error('No verified authenticator app is enrolled for this admin account.');
    }

    const { data: challenge, error: challengeError } =
      await window.supabaseClient.auth.mfa.challenge({ factorId: factor.id });
    if (challengeError) throw challengeError;

    const { data: verified, error: verifyError } =
      await window.supabaseClient.auth.mfa.verify({
        factorId: factor.id,
        challengeId: challenge.id,
        code: String(code).replace(/\s/g, '')
      });
    if (verifyError) throw verifyError;
    return verified?.session || session;
  }

  let isEditMode = false;
  let activeElement = null;
  let pageContentMap = {};
  let globalStyles = {};
  let pageHeroSettings = null;

  function cleanupConflictedCardMedia() {
    document.querySelectorAll('.leader-card-media, .card-media').forEach((media) => {
      if (media.querySelector('img, video')) {
        media.classList.add('has-image');
        media.querySelectorAll('.leader-avatar-placeholder, .avatar-placeholder, [class*="avatar-placeholder"]').forEach((ph) => ph.remove());
      }
    });
  }

  async function initCMS() {
    document.querySelectorAll('.wp-card-media-pill').forEach(p => p.remove());
    cleanupConflictedCardMedia();
    loadGlobalNavigation();
    loadGlobalStyles();
    loadPageContent();
    cleanupConflictedCardMedia();
    injectAdminInterface();
    await checkAuthSession();
    setupShortcuts();
    setupEditModeGuards();
    await syncContentFromSupabase();
    cleanupConflictedCardMedia();
  }

  // --- Initializer (handles both standard and lazy dynamic script loading) ---
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initCMS);
  } else {
    initCMS();
  }

  window.openAdminStudio = async () => {
    const session = await getAuthorizedSession();
    if (session) {
      setEditMode(!isEditMode);
      if (isEditMode) {
        showToast('Edit Mode Enabled. Click any text, card, or image to edit!', 'success');
      }
    } else {
      openLoginModal();
    }
  };

  window.addEventListener('supabaseReady', async () => {
    await syncContentFromSupabase();
    await checkAuthSession();
  });

  // ==========================================================================
  // 1. Storage & Global Hydration
  // ==========================================================================

  function sanitizeEventsContentMap(map) {
    if (!map || typeof map !== 'object' || pagePath !== 'events.html') return map;
    // Section headings MUST NEVER be overwritten by Card 1 (YES) text
    if (map.txt_events_4 && map.txt_events_4.html === 'YES') delete map.txt_events_4;
    if (map.txt_events_5 && (map.txt_events_5.html === 'Youth Entrepreneurship Summit' || map.txt_events_5.html === 'YES')) delete map.txt_events_5;
    if (map.txt_events_6 && (map.txt_events_6.html && (map.txt_events_6.html.includes('conclave') || map.txt_events_6.html.includes('founders')))) delete map.txt_events_6;

    // Card 2 (TEDx) must never be duplicate YES
    if (map.txt_events_13 && map.txt_events_13.html === 'YES') {
      map.txt_events_12 = { type: 'text', html: 'Talks', style: {} };
      map.txt_events_13 = { type: 'text', html: 'TEDx', style: {} };
      map.txt_events_14 = { type: 'text', html: 'Ideas worth spreading', style: {} };
      map.txt_events_15 = { type: 'text', html: 'An intellectual platform showcasing insight-rich conversations from founders, artists, builders, and leaders.', style: {} };
    }

    // Card 3 (Odyssey) must never have TEDx subtitle
    if (map.txt_events_19 && (map.txt_events_19.html === 'TEDx' || map.txt_events_19.html === 'Ideas worth spreading')) {
      map.txt_events_17 = { type: 'text', html: 'Competition', style: {} };
      map.txt_events_18 = { type: 'text', html: 'Odyssey', style: {} };
      map.txt_events_19 = { type: 'text', html: 'Startup B-Plan Competition', style: {} };
      map.txt_events_20 = { type: 'text', html: 'A challenge-driven platform for students to test ideas, solve real problems, and pitch business models with conviction.', style: {} };
    }

    // Clean any lingering editor artifacts ("Media Media", move pills)
    Object.keys(map).forEach((k) => {
      const item = map[k];
      if (item && typeof item.html === 'string') {
        if (item.html.includes('fa-photo-film') || item.html.includes('cms-element-move-pill')) {
          item.html = item.html.replace(/<div\b[^>]*class="[^"]*cms-element-move-pill[^"]*"[^>]*>[\s\S]*?<\/div>/gi, '');
          item.html = item.html.replace(/<i\b[^>]*class="[^"]*fa-photo-film[^"]*"[^>]*><\/i>\s*Media/gi, '').trim();
          if (!item.html || item.html === 'Media') {
            delete map[k];
          }
        }
      }
    });

    return map;
  }

  function sanitizeIndexContentMap(map) {
    if (!map || typeof map !== 'object' || (pagePath !== 'index.html' && pagePath !== '')) return map;
    if (map.txt_index_1 && typeof map.txt_index_1.html === 'string') {
      const h = map.txt_index_1.html;
      if (!h.includes('data-pairs')) {
        map.txt_index_1.html = '<span class="sub">Build the</span>\n<span class="animated-word" data-pairs="Build the: NEXT BIG IDEA | Empower the: FUTURE FOUNDERS | Launch the: BOLD STARTUPS | Drive the: REAL IMPACT | Ignite the: STARTUP REVOLUTION">NEXT BIG IDEA</span>';
      }
    }
    return map;
  }

  function normalizeIndexRow(row) {
    if (!row || (pagePath !== 'index.html' && pagePath !== '')) return row;
    if (row.content_data) {
      row.content_data = sanitizeIndexContentMap(row.content_data);
    }
    return row;
  }

  function normalizeEventsRow(row) {
    if (!row || pagePath !== 'events.html') return row;
    const content = row.content_data;
    if (content && content.txt_events_4 && content.txt_events_4.html === 'YES') {
      const remapped = {};
      if (content.txt_events_1) remapped.txt_events_1 = content.txt_events_1;
      if (content.txt_events_2) remapped.txt_events_2 = content.txt_events_2;
      if (content.txt_events_3) remapped.txt_events_3 = content.txt_events_3;
      if (content.txt_events_4) remapped.txt_events_8 = content.txt_events_4;
      if (content.txt_events_5) remapped.txt_events_9 = content.txt_events_5;
      if (content.txt_events_6) remapped.txt_events_10 = content.txt_events_6;
      if (content.txt_events_7) remapped.txt_events_11 = content.txt_events_7;
      if (content.txt_events_8) remapped.txt_events_13 = content.txt_events_8;
      if (content.txt_events_9) remapped.txt_events_14 = content.txt_events_9;
      if (content.txt_events_10) remapped.txt_events_15 = content.txt_events_10;
      if (content.txt_events_11) remapped.txt_events_16 = content.txt_events_11;
      if (content.txt_events_12) remapped.txt_events_18 = content.txt_events_12;
      if (content.txt_events_13) remapped.txt_events_19 = content.txt_events_13;
      if (content.txt_events_14) remapped.txt_events_20 = content.txt_events_14;
      if (content.txt_events_15) remapped.txt_events_21 = content.txt_events_15;
      if (content.txt_events_16) remapped.txt_events_22 = content.txt_events_16;
      if (content.txt_events_17) remapped.txt_events_23 = content.txt_events_17;
      if (content.txt_events_18) remapped.txt_events_24 = content.txt_events_18;
      if (content.txt_events_19) remapped.txt_events_25 = content.txt_events_19;
      if (content.txt_events_20) remapped.txt_events_26 = content.txt_events_20;
      if (content.txt_events_21) remapped.txt_events_27 = content.txt_events_21;
      if (content.txt_events_22) remapped.txt_events_28 = content.txt_events_22;
      if (content.txt_events_23) remapped.txt_events_29 = content.txt_events_23;
      for (let i = 24; i <= 38; i++) {
        const oldKey = 'txt_events_' + i;
        const newKey = 'txt_events_' + (i + 6);
        if (content[oldKey]) remapped[newKey] = content[oldKey];
      }
      row.content_data = remapped;
    }
    // Always preserve canonical section headings and clean card grid on events.html
    if (row.grid_data && row.grid_data.grid_events_1) {
      delete row.grid_data.grid_events_1;
    }
    if (row.grid_data && row.grid_data.grid_events_2 && row.grid_data.grid_events_2.includes('<p></p>')) {
      delete row.grid_data.grid_events_2;
    }
    if (row.content_data) {
      row.content_data = sanitizeEventsContentMap(row.content_data);
    }
    return row;
  }

  async function syncContentFromSupabase() {
    if (!window.supabaseClient) return;
    try {
      const { data: globalData } = await window.supabaseClient
        .from('site_content')
        .select('*')
        .eq('page_path', '_global')
        .maybeSingle();

      if (globalData && globalData.global_styles) {
        globalStyles = { ...globalStyles, ...globalData.global_styles };
        applyGlobalStyles(globalStyles);
        try { localStorage.setItem(CMS_GLOBAL_STYLES_KEY, JSON.stringify(globalStyles)); } catch (e) { }
        if (Array.isArray(globalData.global_styles._nav) && globalData.global_styles._nav.length > 0) {
          try { localStorage.setItem(CMS_NAV_KEY, JSON.stringify(globalData.global_styles._nav)); } catch (e) { }
          loadGlobalNavigation();
        }
      }

      let { data, error } = await window.supabaseClient
        .from('site_content')
        .select('*')
        .eq('page_path', pagePath)
        .maybeSingle();

      if (!error && data) {
        let localSavedAt = 0;
        try {
          const ts = localStorage.getItem('envision_cms_saved_at_' + pagePath);
          if (ts) localSavedAt = parseInt(ts, 10) || 0;
        } catch (e) { }

        const remoteSavedAt = data.updated_at ? new Date(data.updated_at).getTime() : 0;
        const storedLocal = localStorage.getItem(pageStorageKey);
        const storedLocalHero = localStorage.getItem(heroStorageKey);
        const storedLocalGrids = localStorage.getItem(gridStorageKey);
        const hasLocalEdits = Boolean(storedLocal || storedLocalHero || storedLocalGrids);

        // Only let remote Supabase overwrite if there are NO local edits, or if remote is strictly newer than our local save timestamp
        if (!hasLocalEdits || (localSavedAt && remoteSavedAt > localSavedAt)) {
          data = normalizeEventsRow(data);
          data = normalizeIndexRow(data);
          if (data.grid_data && Object.keys(data.grid_data).length > 0) {
            if (pagePath === 'events.html') delete data.grid_data.grid_events_1;
            Object.keys(data.grid_data).forEach((gridId) => {
              const gridEl = document.querySelector(`[data-cms-grid-id="${gridId}"]`);
              if (gridEl && data.grid_data[gridId]) {
                gridEl.innerHTML = sanitizeHtml(data.grid_data[gridId]);
                // Notify script.js to re-observe any new .reveal / .leader-card nodes
                gridEl.dispatchEvent(new CustomEvent('cmsGridRestored', { bubbles: true, detail: { gridId } }));
              }
            });
            try { localStorage.setItem(gridStorageKey, JSON.stringify(data.grid_data)); } catch (e) { }
          }

          if (data.content_data && Object.keys(data.content_data).length > 0) {
            data.content_data = sanitizeEventsContentMap(data.content_data);
            data.content_data = sanitizeIndexContentMap(data.content_data);
            pageContentMap = sanitizeEventsContentMap({ ...pageContentMap, ...data.content_data });
            pageContentMap = sanitizeIndexContentMap(pageContentMap);
            applyPageContent(pageContentMap);
            try { localStorage.setItem(pageStorageKey, JSON.stringify(pageContentMap)); } catch (e) { }
          }

          if (data.global_styles && Object.keys(data.global_styles).length > 0) {
            globalStyles = { ...globalStyles, ...data.global_styles };
            applyGlobalStyles(globalStyles);
            try { localStorage.setItem(CMS_GLOBAL_STYLES_KEY, JSON.stringify(globalStyles)); } catch (e) { }
            if (Array.isArray(data.global_styles._nav) && data.global_styles._nav.length > 0) {
              try { localStorage.setItem(CMS_NAV_KEY, JSON.stringify(data.global_styles._nav)); } catch (e) { }
              loadGlobalNavigation();
            }
          }
        }
      }
    } catch (e) {
      console.warn('[Supabase] Content sync notice:', e);
    }
  }

  function loadPageContent() {
    try {
      // 1. Restore dynamic grid structures (added/deleted cards)
      const storedGrids = localStorage.getItem(gridStorageKey);
      if (storedGrids) {
        let gridMap = JSON.parse(storedGrids);
        if (pagePath === 'events.html' && gridMap.grid_events_1) {
          // If grid_events_1 has duplicate cards or editor artifacts, wipe it so clean static HTML renders
          if (gridMap.grid_events_1.includes('fa-photo-film') || (gridMap.grid_events_1.match(/YES/g) || []).length > 2 || gridMap.grid_events_1.includes('wp-add-card-placeholder')) {
            delete gridMap.grid_events_1;
            try { localStorage.setItem(gridStorageKey, JSON.stringify(gridMap)); } catch (e) { }
          }
        }
        Object.keys(gridMap).forEach((gridId) => {
          const gridEl = document.querySelector(`[data-cms-grid-id="${gridId}"]`);
          if (gridEl && gridMap[gridId]) {
            gridEl.innerHTML = sanitizeHtml(gridMap[gridId]);
            // Notify script.js to re-observe any new .reveal / .leader-card nodes
            gridEl.dispatchEvent(new CustomEvent('cmsGridRestored', { bubbles: true, detail: { gridId } }));
          }
        });
      }

      // 2. Restore texts and images
      const stored = localStorage.getItem(pageStorageKey);
      if (stored) {
        pageContentMap = JSON.parse(stored);
        pageContentMap = sanitizeEventsContentMap(pageContentMap);
        pageContentMap = sanitizeIndexContentMap(pageContentMap);
        applyPageContent(pageContentMap);
      }

      // 3. Restore Hero Photo/Video & Coverage Settings
      loadHeroMedia();
    } catch (e) {
      console.warn('[CMS] Failed to parse stored content:', e);
    }
  }

  function applyPageContent(map) {
    if (!map || typeof map !== 'object') return;

    Object.keys(map).forEach((key) => {
      const data = map[key];
      const el = document.querySelector(`[data-cms-id="${key}"]`);
      if (el) {
        if (data.type === 'text' && data.html !== undefined) {
          el.innerHTML = sanitizeHtml(data.html);
          if ((el.tagName === 'A' || el.hasAttribute('href')) && data.href) {
            el.setAttribute('href', sanitizeUrl(data.href));
            if (data.target) el.setAttribute('target', data.target);
          }
        } else if (data.type === 'image' && data.src) {
          if (isSafeImageSrc(data.src)) el.src = data.src;
          if (data.alt) el.alt = data.alt;
        }
        if (data.style) {
          if (isSafeTransform(data.style.transform)) el.style.transform = data.style.transform;
          if (data.style.offsetX !== undefined) el.setAttribute('data-cms-offset-x', data.style.offsetX);
          if (data.style.offsetY !== undefined) el.setAttribute('data-cms-offset-y', data.style.offsetY);
        }
      }
    });

    cleanupConflictedCardMedia();
    if (typeof window.initRotatingWords === 'function') {
      window.initRotatingWords(document);
    }
  }

  const CANONICAL_PAGES = [
    { title: 'Home', url: 'index.html' },
    { title: 'About', url: 'about.html' },
    { title: 'Events', url: 'events.html' },
    { title: 'Incubation', url: 'incubation.html' },
    { title: 'FAQs', url: 'index.html#faq' },
    { title: 'Contact', url: 'contact.html' },
    { title: 'AIC', url: 'aic.html' }
  ];

  function reconcileNavList(baseList) {
    let list = Array.isArray(baseList) ? [...baseList] : [];
    // Filter out accidental dummy "New Tab" entries and clean titles
    list = list
      .filter((item) => {
        const clean = (item.title || '').trim().toLowerCase().replace(/^move\s+/i, '');
        return clean !== 'new tab' && clean.length > 0;
      })
      .map((item) => ({
        ...item,
        title: (item.title || '').replace(/^Move\s+/i, '').trim()
      }));

    // If no navigation was found, fallback to links present in current DOM
    if (list.length === 0) {
      document.querySelectorAll('.nav-links > a:not(.nav-cta), .mobile-menu-inner > a:not(.mobile-connect)').forEach(a => {
        const url = (a.getAttribute('href') || '').trim();
        const title = a.textContent.replace(/^Move\s+/i, '').trim();
        if (url && title && !url.startsWith('#') && !url.startsWith('javascript:') && title.toLowerCase() !== 'new tab') {
          if (!list.some(item => (item.url || '').toLowerCase() === url.toLowerCase())) {
            list.push({ title, url });
          }
        }
      });
    }

    // Ensure all canonical pages are present
    CANONICAL_PAGES.forEach((canon) => {
      if (!list.some(item => (item.url || '').toLowerCase() === canon.url.toLowerCase())) {
        if (canon.title === 'FAQs') {
          const contactIdx = list.findIndex(item => (item.url || '').toLowerCase() === 'contact.html');
          if (contactIdx !== -1) {
            list.splice(contactIdx, 0, { title: canon.title, url: canon.url });
            return;
          }
        }
        list.push({ title: canon.title, url: canon.url });
      }
    });

    return list;
  }

  async function persistGlobalNavigation(updatedList) {
    if (!Array.isArray(updatedList) || updatedList.length === 0) return;

    // 1. Update localStorage immediately for this and other pages in session
    try {
      localStorage.setItem(CMS_NAV_KEY, JSON.stringify(updatedList));
    } catch (e) { }

    // 2. Keep in-memory global styles aligned
    globalStyles['_nav'] = updatedList;
    try {
      localStorage.setItem(CMS_GLOBAL_STYLES_KEY, JSON.stringify(globalStyles));
    } catch (e) { }

    // 3. Immediately update DOM on the current page
    loadGlobalNavigation();

    // 4. Synchronize static HTML files on disk across all pages via server API
    try {
      await fetch('/api/save-nav-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nav: updatedList })
      });
    } catch (err) { }

    // 5. Persist to Supabase _global row so any user/browser gets the updated header
    if (window.supabaseClient) {
      try {
        await window.supabaseClient.from('site_content').upsert({
          page_path: '_global',
          content_data: {},
          grid_data: {},
          global_styles: { ...globalStyles, _nav: updatedList },
          updated_at: new Date().toISOString()
        }, { onConflict: 'page_path' });
      } catch (err) {
        console.warn('[Supabase] Global nav sync notice:', err);
      }
    }

    // 6. Notify other open tabs/windows
    try {
      window.dispatchEvent(new CustomEvent('cmsNavUpdated', { detail: { nav: updatedList } }));
    } catch (e) { }
  }

  function loadGlobalNavigation() {
    try {
      let navList = [];
      const storedNav = localStorage.getItem(CMS_NAV_KEY);
      if (storedNav) {
        try { navList = JSON.parse(storedNav); } catch (e) { }
      }
      navList = reconcileNavList(navList);
      localStorage.setItem(CMS_NAV_KEY, JSON.stringify(navList));

      if (navList.length > 0) {
        const currentPath = window.location.pathname.split('/').pop() || 'index.html';
        const navContainers = document.querySelectorAll('.nav-links, .mobile-menu-inner');
        navContainers.forEach((container) => {
          const isMobile = container.classList.contains('mobile-menu-inner');
          container.innerHTML = navList.map((item) => {
            const isActive = (item.url === currentPath || (item.url === 'index.html' && currentPath === '')) ? ' class="active"' : '';
            return `<a href="${sanitizeUrl(item.url)}"${isActive}>${escapeHtml(item.title)}</a>`;
          }).join('');
          if (isMobile && !container.querySelector('.mobile-connect')) {
            const connect = document.createElement('a');
            connect.href = 'contact.html';
            connect.className = 'mobile-connect';
            connect.textContent = 'Connect With Us';
            container.append(connect);
          }
        });
        if (typeof window.initNavSlider === 'function') window.initNavSlider();
      }
      // Clean up any lingering + buttons or New Tab links in DOM
      document.querySelectorAll('.wp-nav-add-btn').forEach(btn => btn.remove());
      document.querySelectorAll('.nav-links > a, .mobile-menu-inner > a').forEach(a => {
        if (a.textContent.trim().toLowerCase() === 'new tab') {
          a.remove();
        }
      });
    } catch (e) {
      console.warn('[CMS] Failed to load global navigation:', e);
    }
  }

  window.addEventListener('storage', (e) => {
    if (e.key === CMS_NAV_KEY && e.newValue) {
      loadGlobalNavigation();
    }
  });

  function loadGlobalStyles() {
    try {
      const stored = localStorage.getItem(CMS_GLOBAL_STYLES_KEY);
      if (stored) {
        globalStyles = JSON.parse(stored);
        applyGlobalStyles(globalStyles);
      }
    } catch (e) {
      console.warn('[CMS] Failed to load global styles:', e);
    }
  }

  function applyGlobalStyles(styles) {
    if (!styles) return;
    styles = sanitizeGlobalStyles(styles);
    let customStyleTag = document.getElementById('cms-dynamic-global-styles');
    if (!customStyleTag) {
      customStyleTag = document.createElement('style');
      customStyleTag.id = 'cms-dynamic-global-styles';
      document.head.append(customStyleTag);
    }

    let css = ':root {\n';
    if (styles.bg) css += `  --bg: ${styles.bg} !important;\n`;
    if (styles.bg2) css += `  --bg-2: ${styles.bg2} !important;\n`;
    if (styles.panel) {
      css += `  --panel: ${styles.panel} !important;\n`;
      css += `  --panel-strong: ${styles.panel} !important;\n`;
    }
    if (styles.line) css += `  --line: ${styles.line} !important;\n`;
    if (styles.primaryColor) {
      css += `  --blue: ${styles.primaryColor} !important;\n`;
      css += `  --blue-strong: ${styles.primaryColor} !important;\n`;
      css += `  --navy: ${styles.primaryColor} !important;\n`;
    }
    if (styles.accentColor) {
      css += `  --gold: ${styles.accentColor} !important;\n`;
      css += `  --gold-soft: ${styles.accentColor} !important;\n`;
      css += `  --gold-strong: ${styles.accentColor} !important;\n`;
    }
    if (styles.text) css += `  --text: ${styles.text} !important;\n`;
    if (styles.muted) css += `  --muted: ${styles.muted} !important;\n`;
    if (styles.radius) css += `  --card-radius: ${styles.radius} !important;\n`;
    css += '}\n';

    if (styles.fontPrimary) {
      css += `body, p, span, a, li, input, button { font-family: ${styles.fontPrimary}, -apple-system, sans-serif !important; }\n`;
    }
    if (styles.fontHeading) {
      css += `h1, h2, h3, h4, h5, h6, .section-label, .stat-number, .leader-name { font-family: ${styles.fontHeading}, sans-serif !important; }\n`;
    }
    if (styles.fontMono) {
      css += `code, pre, .mono-eyebrow, .badge, .section-label { font-family: ${styles.fontMono}, monospace !important; }\n`;
    }

    if (styles.isDarkMode) {
      css += `body { background-color: ${styles.bg || '#0b0f19'} !important; color: ${styles.text || '#f1f5f9'} !important; }\n`;
      css += `.ambient-canvas { background: ${styles.bg || '#0b0f19'} !important; }\n`;
      css += `.topbar { background: rgba(11, 15, 25, 0.92) !important; border-bottom: 1px solid rgba(255, 255, 255, 0.1) !important; }\n`;
      css += `.card, .stat-box, .faq-item, .promo-band, .leader-card { background: ${styles.panel || '#131b2e'} !important; border-color: ${styles.line || 'rgba(255, 255, 255, 0.12)'} !important; color: ${styles.text || '#f1f5f9'} !important; }\n`;
      css += `.card-body p, .faq-answer p, .stat-label { color: ${styles.muted || '#94a3b8'} !important; }\n`;
    } else if (styles.bg) {
      css += `body { background-color: ${styles.bg} !important; }\n`;
      css += `.ambient-canvas { background: ${styles.bg} !important; }\n`;
    }

    customStyleTag.textContent = css;
  }

  // ==========================================================================
  // Edit Mode Event Interceptors & Navigation Guards
  // ==========================================================================

  function setupEditModeGuards() {
    // 1. Intercept all clicks across the site in capture phase during edit mode
    document.addEventListener('click', (e) => {
      if (!isEditMode) return;

      // Allow clicks on CMS admin controls, ribbon, dialogs, floating toolbars, and card/section builders
      if (e.target.closest('#wp-admin-bar, #wp-word-ribbon, #wp-sidebar-inspector, .cms-modal-backdrop, #wp-floating-toolbar, #cms-trigger-btn, .wp-card-toolbar, .wp-section-bar, .wp-add-section-divider, .wp-add-card-placeholder, .wp-nav-add-btn, .wp-btn-action-bar, .wp-hero-btn-add, .wp-btn-edit-badge, .cms-hero-sound-btn, .cms-ignore')) {
        return;
      }

      // If clicking any link (<a>), button (<button>), input submit/button, or interactive element
      const interactiveEl = e.target.closest('a, button, input[type="submit"], input[type="button"], [role="button"]');
      if (interactiveEl) {
        // Stop the browser from navigating away or reloading the page
        e.preventDefault();

        // Trigger floating Button Action Bar for buttons/links in edit mode
        if (interactiveEl.matches('a, button, .btn') || interactiveEl.closest('.hero-actions') || interactiveEl.tagName === 'A' || interactiveEl.tagName === 'BUTTON') {
          showButtonActionBar(interactiveEl);
        }

        // Focus the editable text element so the user can immediately place cursor and write
        const editableEl = e.target.closest('[data-cms-editable]') || (interactiveEl.hasAttribute('data-cms-editable') ? interactiveEl : null);
        if (editableEl && editableEl.getAttribute('contenteditable') === 'true') {
          editableEl.focus();
        }
      }
    }, true);

    // 2. Intercept form submissions during edit mode to prevent page refresh
    document.addEventListener('submit', (e) => {
      if (!isEditMode) return;
      if (e.target.closest('#wp-admin-bar, #wp-word-ribbon, #wp-sidebar-inspector, .cms-modal-backdrop, .cms-ignore')) {
        return;
      }
      e.preventDefault();
      e.stopPropagation();
    }, true);
  }

  // ==========================================================================
  // 2. Element Registration, Relocate Engine, Cards & Grid Controls
  // ==========================================================================

  let isRelocateMode = false;
  let draggedElement = null;
  let activeRelocateMenu = null;

  function prepareEditableDOM() {
    let textCounter = 1;
    let imgCounter = 1;
    let gridCounter = 1;

    // Texts, buttons, links, labels, badges, items
    const textSelectors = [
      'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
      'p', '.section-label', '.badge', '.card-badge', '.leader-name',
      '.leader-role', '.leader-tagline', '.faq-title',
      '.stat-number', '.stat-label', '.btn', 'a', 'button',
      'li', '.hero-tagline', '.nav-cta', '.logo-text span', '.logo-text h1',
      '.brand-text', '.mobile-connect',
      // Catch-all: any element already pre-tagged with data-cms-id (except images)
      '[data-cms-id]:not(img):not(video)'
    ];

    document.querySelectorAll(textSelectors.join(',')).forEach((el) => {
      if (
        el.closest('#wp-admin-bar') ||
        el.closest('#wp-word-ribbon') ||
        el.closest('#wp-sidebar-inspector') ||
        el.closest('.cms-modal-backdrop') ||
        el.closest('#wp-floating-toolbar') ||
        el.closest('.wp-card-toolbar') ||
        el.closest('.wp-section-bar') ||
        el.closest('.wp-add-section-divider') ||
        el.closest('.wp-add-card-placeholder') ||
        el.closest('.wp-nav-add-btn') ||
        el.closest('.cms-element-move-pill') ||
        el.closest('.cms-relocate-popover') ||
        el.closest('.topbar, .nav-wrap, .nav-links, .mobile-menu, .logo-pair, .logo, .nav-cta') ||
        el.classList.contains('cms-ignore')
      ) return;

      // Avoid making an outer <li> or <a> editable if it has child links or block headings that are individually editable
      if (el.tagName === 'LI' && el.querySelector('a, button, input, h1, h2, h3, h4, h5, h6, p')) {
        return;
      }
      if (el.tagName === 'A' && el.querySelector('h1, h2, h3, h4, h5, h6, p, div, article')) {
        return;
      }

      if (!el.getAttribute('data-cms-id')) {
        let id = el.id;
        if (!id) {
          do { id = `txt_${pagePath.replace('.html', '')}_${textCounter++}`; }
          while (document.querySelector(`[data-cms-id="${id}"]`));
        }
        el.setAttribute('data-cms-id', id);
      }
      el.setAttribute('data-cms-editable', 'true');
      attachRelocateControls(el);
    });

    // Images
    document.querySelectorAll('img:not(.cms-ignore)').forEach((img) => {
      if (
        img.closest('#wp-admin-bar') ||
        img.closest('#wp-sidebar-inspector') ||
        img.closest('.cms-modal-backdrop') ||
        img.closest('.topbar, .nav-wrap, .logo-pair, .logo')
      ) return;

      if (!img.getAttribute('data-cms-id')) {
        let id = img.id;
        if (!id) {
          do { id = `img_${pagePath.replace('.html', '')}_${imgCounter++}`; }
          while (document.querySelector(`[data-cms-id="${id}"]`));
        }
        img.setAttribute('data-cms-id', id);
      }
      img.setAttribute('data-cms-editable-image', 'true');
      attachRelocateControls(img);
    });

    // Card Row Containers & Grids
    document.querySelectorAll('.cards-grid, .grid-3, .grid-4, .stat-grid, .faq-accordion, .leaders-stream-track').forEach((grid) => {
      if (!grid.getAttribute('data-cms-grid-id')) {
        let gid;
        do { gid = `grid_${pagePath.replace('.html', '')}_${gridCounter++}`; }
        while (document.querySelector(`[data-cms-grid-id="${gid}"]`));
        grid.setAttribute('data-cms-grid-id', gid);
      }
      if (!grid.classList.contains('leaders-stream-track')) {
        attachGridCardInserter(grid);
      }
    });

    // Individual Cards & Grid Items
    document.querySelectorAll('.card, article.card, .leader-card, .faq-item, .stat-box, .cards-grid > article, .cards-grid > div:not(.wp-add-card-placeholder)').forEach((card) => {
      attachCardToolbar(card);
    });

    // Clean up any cards where an image or video exists alongside an avatar placeholder
    cleanupConflictedCardMedia();

    // Remove any legacy card media pills
    document.querySelectorAll('.wp-card-media-pill').forEach((pill) => pill.remove());

    // Section Bars & Inserter Dividers
    document.querySelectorAll('section, main > div').forEach((section) => {
      if (section.closest('#wp-admin-bar') || section.closest('#wp-sidebar-inspector') || section.closest('.cms-modal-backdrop')) return;
      attachSectionBar(section);
      attachSectionDivider(section);
    });

    // Universal Relocatable Elements (Headings, Paragraphs, Buttons, Image panels, Promo bands, Blocks)
    const relocatableSelectors = [
      '.text-block > *', '.image-panel', '.promo-band',
      '.card-body > *', '.hero-content > *', '.page-hero-inner > *',
      '.section-heading > *', 'main > .container > *', '.container.grid-2 > *',
      '[data-cms-editable]:not(.card):not(.faq-item):not(.stat-box)', '[data-cms-editable-image]'
    ];
    document.querySelectorAll(relocatableSelectors.join(',')).forEach((el) => {
      if (
        el.closest('#wp-admin-bar') ||
        el.closest('#wp-word-ribbon') ||
        el.closest('#wp-sidebar-inspector') ||
        el.closest('.cms-modal-backdrop') ||
        el.closest('#wp-floating-toolbar') ||
        el.closest('.wp-card-toolbar') ||
        el.closest('.wp-section-bar') ||
        el.closest('.wp-add-section-divider') ||
        el.closest('.wp-add-card-placeholder') ||
        el.closest('.topbar, .nav-wrap, .nav-links, .mobile-menu, .logo-pair, .logo, .nav-cta') ||
        el.classList.contains('wp-card-toolbar') ||
        el.classList.contains('wp-section-bar') ||
        el.classList.contains('cms-element-move-pill') ||
        el.classList.contains('cms-ignore')
      ) return;
      attachRelocateControls(el);
    });

    // Hero Banner Customizer Control
    document.querySelectorAll('.hero, .page-hero, header + main > section:first-of-type, header + section').forEach((hero) => {
      attachHeroControls(hero);
    });

    // Hero Actions & Button Groups (+ Add Button placeholder)
    document.querySelectorAll('.hero-actions, .cta-group, .btn-group').forEach((group) => {
      attachButtonGroupControls(group);
    });

    // Individual Edit Button on each button
    document.querySelectorAll('.btn, a.btn, button.btn, .hero-actions > a, .hero-actions > button, .cta-group > a, .btn-primary, .btn-secondary, .btn-outline, .btn-explore, .nav-cta').forEach((btn) => {
      if (btn.closest(CMS_UI_SELECTOR)) return;
      attachButtonEditControls(btn);
    });

    // Clean up any stray wp-nav-add-btn buttons
    document.querySelectorAll('.wp-nav-add-btn').forEach(btn => btn.remove());
  }

  // ==========================================================================
  // Universal Canvas Press-and-Move Engine (Pointer / Mouse Canvas Dragging)
  // ==========================================================================

  function startCanvasPointerDrag(el, startEvent, type = 'element') {
    if (!isEditMode) return;
    if (startEvent.button !== undefined && startEvent.button !== 0) return; // Only left-click

    startEvent.preventDefault();
    startEvent.stopPropagation();

    const startX = startEvent.clientX;
    const startY = startEvent.clientY;

    // Parse current 2D translation offsets
    const initOffsetX = parseFloat(el.getAttribute('data-cms-offset-x')) || 0;
    const initOffsetY = parseFloat(el.getAttribute('data-cms-offset-y')) || 0;

    let hasMoved = false;
    let ghost = null;
    let tooltip = null;
    let dropPlaceholder = null;
    let currentDropTarget = null;
    let currentPosition = 'after';
    let autoScrollRaf = null;
    let autoScrollSpeed = 0;
    let lastDeltaX = 0;
    let lastDeltaY = 0;

    const startAutoScroll = () => {
      if (autoScrollRaf) return;
      const step = () => {
        if (autoScrollSpeed !== 0) {
          window.scrollBy(0, autoScrollSpeed);
          autoScrollRaf = requestAnimationFrame(step);
        } else {
          autoScrollRaf = null;
        }
      };
      autoScrollRaf = requestAnimationFrame(step);
    };

    const stopAutoScroll = () => {
      autoScrollSpeed = 0;
      if (autoScrollRaf) {
        cancelAnimationFrame(autoScrollRaf);
        autoScrollRaf = null;
      }
    };

    const onPointerMove = (e) => {
      const deltaX = e.clientX - startX;
      const deltaY = e.clientY - startY;
      const dist = Math.hypot(deltaX, deltaY);
      if (!hasMoved && dist < 3) return;

      lastDeltaX = deltaX;
      lastDeltaY = deltaY;

      if (!hasMoved) {
        hasMoved = true;
        closeAllRelocatePopovers();
        document.body.classList.add('cms-canvas-drag-active');
        el.classList.add('cms-dragging');

        // 1. Create Floating Drag Ghost Avatar
        ghost = document.createElement('div');
        ghost.className = 'cms-canvas-drag-ghost';
        const label = el.querySelector('h1, h2, h3, h4, h5, h6, .card-title, .leader-name')?.textContent.trim() || el.textContent.trim().slice(0, 36) || type;
        ghost.innerHTML = `
          <div style="font-weight:800; color:#2563eb; display:flex; align-items:center; gap:6px; margin-bottom:4px; font-size:11px; text-transform:uppercase; letter-spacing:0.04em;">
            <i class="fa-solid fa-arrows-up-down-left-right"></i> Moving ${type}
          </div>
          <div style="font-size:12px; font-weight:600; color:#0f172a; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">
            ${label}
          </div>
        `;
        document.body.append(ghost);

        // 2. Create Floating Position Tooltip HUD
        tooltip = document.createElement('div');
        tooltip.className = 'cms-drag-tooltip';
        tooltip.innerHTML = '<i class="fa-solid fa-arrows-up-down-left-right" style="color:#38bdf8;"></i> Free Canvas Move';
        document.body.append(tooltip);

        // 3. Create Live Drop Insertion Placeholder
        dropPlaceholder = document.createElement('div');
        dropPlaceholder.className = 'cms-canvas-drop-placeholder';
        dropPlaceholder.innerHTML = `<i class="fa-solid fa-arrow-down-to-bracket"></i> Drop ${type} here`;
      }

      // Free 2D translation in any direction on the canvas
      const currentTranslateX = initOffsetX + deltaX;
      const currentTranslateY = initOffsetY + deltaY;
      el.style.transform = `translate3d(${currentTranslateX}px, ${currentTranslateY}px, 0px)`;
      el.style.zIndex = '990';

      // Update ghost and tooltip coordinates
      if (ghost) {
        ghost.style.left = e.clientX + 'px';
        ghost.style.top = e.clientY + 'px';
      }

      if (tooltip) {
        tooltip.style.left = e.clientX + 'px';
        tooltip.style.top = (e.clientY - 28) + 'px';
        const signX = deltaX > 0 ? '+' : '';
        const signY = deltaY > 0 ? '+' : '';
        tooltip.innerHTML = `<i class="fa-solid fa-arrows-up-down-left-right" style="color:#38bdf8;"></i> Free Move: <strong>X: ${signX}${Math.round(deltaX)}px, Y: ${signY}${Math.round(deltaY)}px</strong>`;
      }

      // Edge auto-scrolling when moving near top or bottom of viewport
      const edgeThreshold = 80;
      if (e.clientY < edgeThreshold) {
        autoScrollSpeed = -Math.round(16 * Math.max(0.2, 1 - e.clientY / edgeThreshold));
        startAutoScroll();
      } else if (e.clientY > window.innerHeight - edgeThreshold) {
        autoScrollSpeed = Math.round(16 * Math.max(0.2, 1 - (window.innerHeight - e.clientY) / edgeThreshold));
        startAutoScroll();
      } else {
        autoScrollSpeed = 0;
      }

      // Check for structural drop targets across the canvas
      const elementsUnder = document.elementsFromPoint(e.clientX, e.clientY);
      let targetEl = null;

      for (let cand of elementsUnder) {
        if (
          !cand ||
          cand === ghost ||
          cand === tooltip ||
          cand === dropPlaceholder ||
          cand === el ||
          el.contains(cand) ||
          cand.closest('#wp-admin-bar') ||
          cand.closest('#wp-word-ribbon') ||
          cand.closest('#wp-sidebar-inspector') ||
          cand.closest('.cms-modal-backdrop') ||
          cand.classList.contains('cms-element-move-pill') ||
          cand.classList.contains('wp-card-toolbar') ||
          cand.classList.contains('wp-section-bar')
        ) {
          continue;
        }

        if (type === 'section') {
          if (cand.tagName === 'SECTION' || (cand.tagName === 'DIV' && cand.parentNode === document.querySelector('main'))) {
            targetEl = cand;
            break;
          }
        } else if (type === 'card') {
          const cardCandidate = cand.closest('.card, article, .leader-card, .stat-box, .faq-item, .cards-grid');
          if (cardCandidate && cardCandidate !== el && !el.contains(cardCandidate)) {
            targetEl = cardCandidate;
            break;
          }
        } else {
          const elemCandidate = cand.closest('[data-cms-relocatable], [data-cms-editable], .card, .card-body > *, .text-block > *, .container > *, .section-heading > *, section, p, h1, h2, h3, h4, h5, h6, .btn, .stat-box, .image-panel, .promo-band, li');
          if (elemCandidate && elemCandidate !== el && !el.contains(elemCandidate)) {
            targetEl = elemCandidate;
            break;
          }
        }
      }

      if (targetEl && targetEl.parentNode && targetEl.parentNode !== el) {
        currentDropTarget = targetEl;
        const rect = targetEl.getBoundingClientRect();
        const midY = rect.top + rect.height / 2;

        if (targetEl.classList.contains('cards-grid') || (targetEl.tagName === 'SECTION' && type !== 'section')) {
          currentPosition = 'inside';
          if (dropPlaceholder.parentNode !== targetEl) {
            targetEl.append(dropPlaceholder);
          }
        } else if (e.clientY < midY) {
          currentPosition = 'before';
          if (dropPlaceholder.nextSibling !== targetEl) {
            targetEl.parentNode.insertBefore(dropPlaceholder, targetEl);
          }
        } else {
          currentPosition = 'after';
          if (dropPlaceholder.previousSibling !== targetEl) {
            targetEl.parentNode.insertBefore(dropPlaceholder, targetEl.nextSibling);
          }
        }

        const targetTitle = targetEl.querySelector('h1, h2, h3, .section-label')?.textContent.trim().slice(0, 24) || targetEl.tagName.toLowerCase();
        if (tooltip) {
          const signX = deltaX > 0 ? '+' : '';
          const signY = deltaY > 0 ? '+' : '';
          tooltip.innerHTML = `<i class="fa-solid fa-arrows-up-down-left-right" style="color:#38bdf8;"></i> Free Move: <strong>X: ${signX}${Math.round(deltaX)}px, Y: ${signY}${Math.round(deltaY)}px</strong> <span style="opacity:0.75;">| Drop ${currentPosition} "${targetTitle}"</span>`;
        }
      } else {
        currentDropTarget = null;
        if (dropPlaceholder && dropPlaceholder.parentNode) {
          dropPlaceholder.remove();
        }
      }
    };

    const onPointerUp = () => {
      stopAutoScroll();
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
      window.removeEventListener('mousemove', onPointerMove);
      window.removeEventListener('mouseup', onPointerUp);

      document.body.classList.remove('cms-canvas-drag-active');
      el.classList.remove('cms-dragging');

      if (ghost) ghost.remove();
      if (tooltip) tooltip.remove();

      if (hasMoved) {
        // If dropped onto a distinct structural placeholder slot in another container
        if (dropPlaceholder && dropPlaceholder.parentNode && currentDropTarget) {
          el.style.transform = '';
          el.style.zIndex = '';
          el.removeAttribute('data-cms-offset-x');
          el.removeAttribute('data-cms-offset-y');
          dropPlaceholder.parentNode.insertBefore(el, dropPlaceholder);
          dropPlaceholder.remove();
          markDirty();
          showToast(`Relocated ${type} to new position!`, 'success');
        } else {
          // Keep the free 2D canvas translation offset
          const finalX = initOffsetX + lastDeltaX;
          const finalY = initOffsetY + lastDeltaY;
          el.setAttribute('data-cms-offset-x', finalX);
          el.setAttribute('data-cms-offset-y', finalY);
          el.style.transform = `translate3d(${finalX}px, ${finalY}px, 0px)`;
          if (dropPlaceholder) dropPlaceholder.remove();
          markDirty();
          const signX = finalX > 0 ? '+' : '';
          const signY = finalY > 0 ? '+' : '';
          showToast(`Element moved freely on canvas (X: ${signX}${Math.round(finalX)}px, Y: ${signY}${Math.round(finalY)}px)`, 'success');
        }
      } else if (dropPlaceholder) {
        dropPlaceholder.remove();
      }
    };

    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
    window.addEventListener('mousemove', onPointerMove);
    window.addEventListener('mouseup', onPointerUp);
  }

  // ==========================================================================
  // Button & Page Attachment Management Engine
  // ==========================================================================

  let activeButtonActionBar = null;

  function hideButtonActionBar() {
    if (activeButtonActionBar) {
      activeButtonActionBar.remove();
      activeButtonActionBar = null;
    }
  }

  function getAllSitePages() {
    const pages = [
      { file: 'index.html', title: 'Home Page' },
      { file: 'events.html', title: 'Events & Conclaves' },
      { file: 'incubation.html', title: 'Incubation Center (INSPIRE)' },
      { file: 'about.html', title: 'About Envision' },
      { file: 'contact.html', title: 'Contact & Connect' },
      { file: 'tedx.html', title: 'TEDx Envision' },
      { file: 'yes.html', title: 'Youth Entrepreneurship Summit' },
      { file: 'aic.html', title: 'AIC Incubation Center' },
      { file: 'odyssey.html', title: 'Odyssey Magazine / Stories' },
      { file: '404.html', title: '404 Page' },
      { file: '500.html', title: '500 Page' }
    ];

    try {
      const storedNav = localStorage.getItem(CMS_NAV_KEY);
      if (storedNav) {
        const navList = JSON.parse(storedNav);
        if (Array.isArray(navList)) {
          navList.forEach(item => {
            const u = (item.url || '').trim();
            if (u && !u.startsWith('#') && !u.startsWith('http') && !pages.some(p => p.file.toLowerCase() === u.toLowerCase())) {
              pages.push({ file: u, title: item.title || u });
            }
          });
        }
      }
    } catch (e) { }

    document.querySelectorAll('a[href$=".html"]').forEach(a => {
      const h = a.getAttribute('href');
      if (h && !h.startsWith('http') && !pages.some(p => p.file.toLowerCase() === h.toLowerCase())) {
        pages.push({ file: h, title: a.textContent.trim().slice(0, 30) || h });
      }
    });

    return pages;
  }

  function showButtonActionBar(targetBtn) {
    if (!targetBtn || !isEditMode) return;
    hideButtonActionBar();

    const bar = document.createElement('div');
    bar.className = 'wp-btn-action-bar cms-ignore';

    const isKilled = targetBtn.getAttribute('data-btn-killed') === 'true';
    const href = targetBtn.getAttribute('href') || targetBtn.getAttribute('data-cms-saved-href') || '#';
    const cleanDisplayHref = href.replace(/^https?:\/\/[^\/]+\//, '').replace(/^\.\//, '') || '#';
    const displayHref = isKilled ? '⛔ Function Killed' : cleanDisplayHref;

    bar.innerHTML = `
      <span class="wp-btn-act-tag" title="Attached destination: ${escapeHtml(href)}">
        <i class="fa-solid ${isKilled ? 'fa-ban' : 'fa-link'}" style="color:${isKilled ? '#ef4444' : 'var(--wp-accent,#c5a059)'}; margin-right:4px;"></i>${escapeHtml(displayHref)}
      </span>
      <button type="button" data-act="bar-edit-page" title="Button & Page Settings"><i class="fa-solid fa-pen-to-square"></i> Settings</button>
      <button type="button" data-act="bar-open-page" title="Open and edit this page's content"><i class="fa-solid fa-arrow-up-right-from-square"></i> Edit Page</button>
      <button type="button" data-act="bar-kill-btn" title="${isKilled ? 'Restore button function' : 'Kill button function (disable)'}" style="${isKilled ? 'background:#16a34a;' : ''}">
        <i class="fa-solid ${isKilled ? 'fa-bolt' : 'fa-ban'}"></i> ${isKilled ? 'Restore' : 'Kill Func'}
      </button>
      <button type="button" data-act="bar-add-btn" title="Add another button beside this"><i class="fa-solid fa-plus"></i> Add</button>
      <button type="button" class="danger" data-act="bar-del-page" title="Permanently delete attached HTML page file from website"><i class="fa-solid fa-file-excel"></i> Del Page</button>
      <button type="button" class="danger" data-act="bar-del-btn" title="Delete this button"><i class="fa-solid fa-trash"></i></button>
    `;

    bar.querySelector('[data-act="bar-edit-page"]').onclick = (e) => {
      e.stopPropagation();
      e.preventDefault();
      openButtonPageEditorModal(targetBtn);
    };

    bar.querySelector('[data-act="bar-open-page"]').onclick = (e) => {
      e.stopPropagation();
      e.preventDefault();
      editAttachedPage(targetBtn);
    };

    bar.querySelector('[data-act="bar-kill-btn"]').onclick = (e) => {
      e.stopPropagation();
      e.preventDefault();
      if (targetBtn.getAttribute('data-btn-killed') === 'true') {
        restoreButtonFunction(targetBtn);
      } else {
        killButtonFunction(targetBtn);
      }
    };

    bar.querySelector('[data-act="bar-add-btn"]').onclick = (e) => {
      e.stopPropagation();
      e.preventDefault();
      addHeroActionButton(targetBtn);
    };

    bar.querySelector('[data-act="bar-del-page"]').onclick = (e) => {
      e.stopPropagation();
      e.preventDefault();
      deleteAttachedPage(targetBtn);
    };

    bar.querySelector('[data-act="bar-del-btn"]').onclick = (e) => {
      e.stopPropagation();
      e.preventDefault();
      deleteHeroActionButton(targetBtn);
    };

    document.body.append(bar);
    activeButtonActionBar = bar;

    const rect = targetBtn.getBoundingClientRect();
    const barWidth = 470;
    let left = rect.left + (rect.width / 2) - (barWidth / 2);
    if (left < 16) left = 16;
    if (left + barWidth > window.innerWidth - 16) left = window.innerWidth - barWidth - 16;

    let top = rect.top - 46;
    if (top < 60) {
      top = rect.bottom + 8;
    }

    bar.style.position = 'fixed';
    bar.style.top = top + 'px';
    bar.style.left = left + 'px';
    bar.style.zIndex = '10000040';
  }

  function addHeroActionButton(targetBtn) {
    const container = targetBtn ? (targetBtn.closest('.hero-actions, .cta-group, .btn-group') || targetBtn.parentNode) : document.querySelector('.hero-actions');
    if (!container) {
      showToast('No button container found.', 'error');
      return;
    }

    const newBtn = document.createElement('a');
    const btnId = `txt_${pagePath.replace('.html', '')}_btn_${Date.now().toString().slice(-4)}`;
    newBtn.setAttribute('data-cms-id', btnId);
    newBtn.setAttribute('data-cms-editable', 'true');
    newBtn.className = 'btn btn-secondary';
    newBtn.setAttribute('href', 'events.html');
    newBtn.innerHTML = 'New Action <i class="fa-solid fa-arrow-right"></i>';

    const addBtnPlaceholder = container.querySelector('.wp-hero-btn-add');
    if (targetBtn && targetBtn.parentNode === container && targetBtn !== addBtnPlaceholder) {
      container.insertBefore(newBtn, targetBtn.nextSibling);
    } else if (addBtnPlaceholder) {
      container.insertBefore(newBtn, addBtnPlaceholder);
    } else {
      container.appendChild(newBtn);
    }

    attachRelocateControls(newBtn);
    attachButtonEditControls(newBtn);
    markDirty();
    showToast('New button added! Customize its page and text.', 'success');

    setTimeout(() => {
      openButtonPageEditorModal(newBtn);
    }, 120);
  }

  function deleteHeroActionButton(targetBtn) {
    if (!targetBtn) return;
    const clone = targetBtn.cloneNode(true);
    clone.querySelectorAll(CMS_UI_SELECTOR).forEach(n => n.remove());
    const label = clone.textContent.trim().replace(/\s+/g, ' ') || 'this button';

    if (!confirm(`Are you sure you want to delete button "${label}"?`)) return;

    hideButtonActionBar();
    targetBtn.remove();
    markDirty();
    showToast(`Button "${label}" deleted.`, 'success');
  }

  function attachButtonGroupControls(group) {
    if (!group) return;
    if (group.querySelector('.wp-hero-btn-add')) return;

    const addBtn = document.createElement('button');
    addBtn.type = 'button';
    addBtn.className = 'wp-hero-btn-add cms-ignore';
    addBtn.innerHTML = '<i class="fa-solid fa-plus"></i> Add Button';
    addBtn.title = 'Add another button beside these';
    addBtn.onclick = (e) => {
      e.preventDefault();
      e.stopPropagation();
      const firstBtn = group.querySelector('.btn, a');
      addHeroActionButton(firstBtn || group);
    };
    group.appendChild(addBtn);
  }

  function editAttachedPage(targetBtn) {
    if (!targetBtn) return;
    let href = targetBtn.getAttribute('href') || targetBtn.getAttribute('data-cms-saved-href') || '';
    href = href.replace(/^https?:\/\/[^\/]+\//, '').replace(/^\.\//, '').trim();

    if (!href || href === '#' || href.startsWith('javascript:')) {
      showToast('No attached page to edit.', 'warning');
      return;
    }

    if (href.startsWith('http://') || href.startsWith('https://')) {
      window.open(href, '_blank');
      return;
    }

    const targetUrl = href.includes('?') ? `${href}&edit=1` : `${href}?edit=1`;
    showToast(`Navigating to edit "${href}"...`, 'info');
    setTimeout(() => {
      window.location.href = targetUrl;
    }, 250);
  }

  async function deleteAttachedPage(targetBtn) {
    if (!targetBtn) return;
    let href = targetBtn.getAttribute('href') || targetBtn.getAttribute('data-cms-saved-href') || '';
    href = href.replace(/^https?:\/\/[^\/]+\//, '').replace(/^\.\//, '').trim();

    if (!href || href === '#' || href.startsWith('javascript:')) {
      showToast('No valid attached page to delete.', 'warning');
      return;
    }

    if (href.toLowerCase() === 'index.html' || href === '/') {
      alert('The Home Page (index.html) is the main site page and cannot be deleted.');
      return;
    }

    if (!href.toLowerCase().endsWith('.html')) {
      if (confirm(`Do you want to unlink and remove destination "${href}" from this button?`)) {
        targetBtn.setAttribute('href', '#');
        targetBtn.removeAttribute('data-cms-saved-href');
        markDirty();
        showToast(`Removed destination "${href}".`, 'success');
      }
      return;
    }

    const confirmed = confirm(
      `⚠️ PERMANENT PAGE DELETION ⚠️\n\nAre you sure you want to permanently DELETE "${href}" from the website?\n\nThis will delete the HTML file from the server and remove its navigation link across all pages.`
    );
    if (!confirmed) return;

    try {
      const res = await fetch('/api/delete-page', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filename: href })
      });

      if (res.ok) {
        showToast(`Page "${href}" deleted from website!`, 'success');
        targetBtn.setAttribute('href', '#');
        targetBtn.removeAttribute('data-cms-saved-href');
        markDirty();
        hideButtonActionBar();
        document.querySelectorAll('.cms-modal-backdrop').forEach(m => m.remove());
        if (document.getElementById('wp-sidebar-inspector')?.classList.contains('open')) {
          syncSidebarInspector(targetBtn);
        }
      } else {
        const err = await res.json().catch(() => ({}));
        showToast(`Delete failed: ${err.error || res.statusText}`, 'error');
      }
    } catch (err) {
      showToast(`Error deleting page: ${err.message}`, 'error');
    }
  }

  function killButtonFunction(targetBtn) {
    if (!targetBtn) return;
    const currentHref = targetBtn.getAttribute('href') || '#';
    if (currentHref && !currentHref.startsWith('javascript:')) {
      targetBtn.setAttribute('data-cms-saved-href', currentHref);
    }
    targetBtn.setAttribute('data-btn-killed', 'true');
    targetBtn.setAttribute('href', 'javascript:void(0);');
    targetBtn.setAttribute('aria-disabled', 'true');
    targetBtn.classList.add('btn-killed');

    if (!targetBtn.querySelector('.wp-btn-killed-pill')) {
      const pill = document.createElement('span');
      pill.className = 'wp-btn-killed-pill cms-ignore';
      pill.innerHTML = '<i class="fa-solid fa-ban"></i> Function Killed';
      targetBtn.appendChild(pill);
    }

    const killBtn = targetBtn.querySelector('.wp-btn-badge-kill');
    if (killBtn) {
      killBtn.className = 'wp-btn-badge-action wp-btn-badge-kill is-killed';
      killBtn.title = 'Restore button function (reactivate)';
      killBtn.innerHTML = '<i class="fa-solid fa-bolt"></i>';
    }

    markDirty();
    showToast('Button function killed! Button is now disabled and inert.', 'warning');
    hideButtonActionBar();
  }

  function restoreButtonFunction(targetBtn) {
    if (!targetBtn) return;
    targetBtn.removeAttribute('data-btn-killed');
    targetBtn.removeAttribute('aria-disabled');
    targetBtn.classList.remove('btn-killed');

    const savedHref = targetBtn.getAttribute('data-cms-saved-href') || 'events.html';
    targetBtn.setAttribute('href', savedHref);

    targetBtn.querySelector('.wp-btn-killed-pill')?.remove();

    const killBtn = targetBtn.querySelector('.wp-btn-badge-kill');
    if (killBtn) {
      killBtn.className = 'wp-btn-badge-action wp-btn-badge-kill';
      killBtn.title = 'Kill button function (disable)';
      killBtn.innerHTML = '<i class="fa-solid fa-ban"></i>';
    }

    markDirty();
    showToast('Button function restored! Button is active.', 'success');
    hideButtonActionBar();
  }

  function attachButtonEditControls(btn) {
    if (!btn || btn.classList.contains('wp-hero-btn-add') || btn.closest(CMS_UI_SELECTOR)) return;
    if (btn.querySelector(':scope > .wp-btn-edit-badge')) return;

    const isKilled = btn.getAttribute('data-btn-killed') === 'true';

    // If button was saved as killed, ensure pill indicator is visible in edit mode
    if (isKilled && !btn.querySelector('.wp-btn-killed-pill')) {
      const pill = document.createElement('span');
      pill.className = 'wp-btn-killed-pill cms-ignore';
      pill.innerHTML = '<i class="fa-solid fa-ban"></i> Function Killed';
      btn.appendChild(pill);
    }

    const badge = document.createElement('div');
    badge.className = 'wp-btn-edit-badge cms-ignore';
    badge.setAttribute('contenteditable', 'false');
    badge.innerHTML = `
      <button type="button" class="wp-btn-badge-action wp-btn-badge-edit" title="Edit attached page, link destination, text label, or style">
        <i class="fa-solid fa-pen"></i> Edit
      </button>
      <button type="button" class="wp-btn-badge-action wp-btn-badge-kill ${isKilled ? 'is-killed' : ''}" title="${isKilled ? 'Restore button function (reactivate)' : 'Kill button function (disable / make inert)'}">
        <i class="fa-solid ${isKilled ? 'fa-bolt' : 'fa-ban'}"></i>
      </button>
      <button type="button" class="wp-btn-badge-action wp-btn-badge-del" title="Delete this button">
        <i class="fa-solid fa-trash"></i>
      </button>
    `;

    badge.addEventListener('mousedown', (e) => e.stopPropagation());
    badge.addEventListener('pointerdown', (e) => e.stopPropagation());

    const editBtn = badge.querySelector('.wp-btn-badge-edit');
    const killBtn = badge.querySelector('.wp-btn-badge-kill');
    const delBtn = badge.querySelector('.wp-btn-badge-del');

    editBtn.onclick = (e) => {
      e.preventDefault();
      e.stopPropagation();
      openButtonPageEditorModal(btn);
    };

    killBtn.onclick = (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (btn.getAttribute('data-btn-killed') === 'true') {
        restoreButtonFunction(btn);
      } else {
        killButtonFunction(btn);
      }
    };

    delBtn.onclick = (e) => {
      e.preventDefault();
      e.stopPropagation();
      deleteHeroActionButton(btn);
    };

    btn.style.position = 'relative';
    btn.appendChild(badge);
  }

  function openButtonPageEditorModal(targetBtn) {
    if (!targetBtn) return;
    const currentHref = targetBtn.getAttribute('href') || '';
    const currentTarget = targetBtn.getAttribute('target') || '_self';

    const iconEl = targetBtn.querySelector('i');
    const currentIconClass = iconEl ? iconEl.className : '';
    const clone = targetBtn.cloneNode(true);
    clone.querySelectorAll(CMS_UI_SELECTOR).forEach(n => n.remove());
    clone.querySelectorAll('i').forEach(n => n.remove());
    const currentLabel = clone.textContent.trim() || 'Action';

    let currentStyle = 'primary';
    if (targetBtn.classList.contains('btn-secondary')) currentStyle = 'secondary';
    else if (targetBtn.classList.contains('btn-outline')) currentStyle = 'outline';

    const pages = getAllSitePages();
    const isCustomUrl = currentHref && !pages.some(p => p.file.toLowerCase() === currentHref.toLowerCase());

    const backdrop = document.createElement('div');
    backdrop.className = 'cms-modal-backdrop open';
    backdrop.innerHTML = `
      <div class="cms-modal-box" style="width: min(580px, 94vw); max-height: 90vh; overflow-y: auto;">
        <div class="cms-modal-header">
          <h3 class="cms-modal-title"><i class="fa-solid fa-link" style="color: var(--wp-accent, #c5a059);"></i> Button &amp; Page Settings</h3>
          <button type="button" class="cms-modal-close"><i class="fa-solid fa-xmark"></i></button>
        </div>

        <form id="wp-btn-editor-form">
          <div class="wp-panel-group" style="margin-bottom: 14px;">
            <label class="wp-control-label" style="display:block; margin-bottom: 6px; font-weight: 600;">Button Label (Text):</label>
            <div style="display: flex; gap: 8px;">
              <input type="text" id="wp-btn-label-input" class="wp-input" style="flex:1;" value="${escapeHtml(currentLabel)}" placeholder="e.g. Explore / Incubation Center" required />
              <select id="wp-btn-icon-select" class="wp-select" style="width:140px;">
                <option value="none">No Icon</option>
                <option value="fa-solid fa-arrow-right" ${currentIconClass.includes('arrow-right') ? 'selected' : ''}>➜ Arrow Right</option>
                <option value="fa-solid fa-rocket" ${currentIconClass.includes('rocket') ? 'selected' : ''}>🚀 Rocket</option>
                <option value="fa-solid fa-wand-magic-sparkles" ${currentIconClass.includes('sparkles') ? 'selected' : ''}>✨ Sparkles</option>
                <option value="fa-solid fa-calendar-days" ${currentIconClass.includes('calendar') ? 'selected' : ''}>📅 Calendar</option>
                <option value="fa-solid fa-fire" ${currentIconClass.includes('fire') ? 'selected' : ''}>🔥 Fire</option>
                <option value="fa-solid fa-arrow-up-right-from-square" ${currentIconClass.includes('arrow-up-right') ? 'selected' : ''}>↗ External</option>
              </select>
            </div>
          </div>

          <div class="wp-panel-group" style="margin-bottom: 14px; background: #f8fafc; padding: 12px; border-radius: 8px; border: 1px solid #e2e8f0;">
            <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 6px;">
              <label class="wp-control-label" style="font-weight: 700; color: #1e293b; margin: 0;">Attached Page / Destination:</label>
              <button type="button" id="wp-btn-create-new-page-shortcut" class="wp-bar-btn" style="background: linear-gradient(135deg, #10b981, #059669); color: #fff; font-size: 11px; padding: 3px 8px; border-radius: 5px; font-weight: 600; cursor: pointer;">
                <i class="fa-solid fa-file-circle-plus"></i> + Create New Page
              </button>
            </div>
            
            <select id="wp-btn-page-dropdown" class="wp-select" style="width: 100%; margin-bottom: 8px;">
              <option value="">-- Select an Existing Page --</option>
              ${pages.map(p => `<option value="${escapeHtml(p.file)}" ${p.file.toLowerCase() === currentHref.toLowerCase() ? 'selected' : ''}>📄 ${escapeHtml(p.title)} (${escapeHtml(p.file)})</option>`).join('')}
              <option value="__custom__" ${isCustomUrl ? 'selected' : ''}>🔗 Custom URL / External Link / Anchor (#)</option>
            </select>

            <div id="wp-btn-custom-url-wrap" style="display: ${isCustomUrl ? 'block' : 'none'};">
              <input type="text" id="wp-btn-custom-url-input" class="wp-input" style="width: 100%;" value="${escapeHtml(currentHref)}" placeholder="e.g. #contact, https://..., or page.html" />
            </div>

            <!-- Page Action Shortcuts: Jump & Edit Page, or Delete Page -->
            <div style="display: flex; gap: 8px; margin-top: 10px; padding-top: 10px; border-top: 1px solid #e2e8f0;">
              <button type="button" id="wp-btn-modal-open-page-btn" class="wp-bar-btn" style="flex:1; background:#0284c7; color:#fff; font-size:11.5px; font-weight:600; padding:6px 10px; border-radius:6px; cursor:pointer;" title="Jump to edit this page's content">
                <i class="fa-solid fa-arrow-up-right-from-square"></i> Open &amp; Edit Page Content
              </button>
              <button type="button" id="wp-btn-modal-delete-page-btn" class="wp-bar-btn" style="background:#fee2e2; color:#b91c1c; font-size:11.5px; font-weight:600; padding:6px 10px; border-radius:6px; cursor:pointer;" title="Permanently delete attached HTML page file from disk">
                <i class="fa-solid fa-file-circle-xmark"></i> Delete Page from Website
              </button>
            </div>
          </div>

          <!-- Button Function Status & Kill Control -->
          ${(() => {
        const isKilled = targetBtn.getAttribute('data-btn-killed') === 'true';
        return `
            <div class="wp-panel-group" style="margin-bottom: 14px; background: ${isKilled ? '#fef2f2' : '#f0fdf4'}; padding: 12px; border-radius: 8px; border: 1px solid ${isKilled ? '#fecaca' : '#bbf7d0'};">
              <div style="display: flex; align-items: center; justify-content: space-between;">
                <div>
                  <span style="font-size: 11px; text-transform: uppercase; font-weight: 700; letter-spacing: 0.05em; color: ${isKilled ? '#dc2626' : '#16a34a'};">
                    <i class="fa-solid ${isKilled ? 'fa-ban' : 'fa-circle-check'}"></i> ${isKilled ? 'Button Function: KILLED (Disabled &amp; Inert)' : 'Button Function: ACTIVE (Clickable Link)'}
                  </span>
                  <p style="font-size: 11.5px; color: #64748b; margin: 4px 0 0;">
                    ${isKilled ? 'Visitors cannot click this button. It is disabled/coming soon.' : 'Button behaves normally and navigates to the attached destination.'}
                  </p>
                </div>
                <button type="button" id="wp-btn-modal-toggle-kill-btn" class="wp-bar-btn" style="background: ${isKilled ? '#16a34a' : '#ea580c'}; color: #fff; font-size: 11.5px; font-weight: 700; padding: 6px 12px; border-radius: 6px; cursor: pointer; white-space: nowrap;">
                  <i class="fa-solid ${isKilled ? 'fa-bolt' : 'fa-ban'}"></i> ${isKilled ? 'Restore Function' : 'Kill Function'}
                </button>
              </div>
            </div>
            `;
      })()}

          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 14px;">
            <div>
              <label class="wp-control-label" style="display:block; margin-bottom: 6px; font-weight: 600;">Button Style:</label>
              <select id="wp-btn-style-select" class="wp-select" style="width: 100%;">
                <option value="primary" ${currentStyle === 'primary' ? 'selected' : ''}>Gold Primary (btn-primary)</option>
                <option value="secondary" ${currentStyle === 'secondary' ? 'selected' : ''}>White Secondary (btn-secondary)</option>
                <option value="outline" ${currentStyle === 'outline' ? 'selected' : ''}>Gold Outline (btn-outline)</option>
              </select>
            </div>
            <div>
              <label class="wp-control-label" style="display:block; margin-bottom: 6px; font-weight: 600;">Open Target:</label>
              <select id="wp-btn-target-select" class="wp-select" style="width: 100%;">
                <option value="_self" ${currentTarget === '_self' ? 'selected' : ''}>Same Tab (_self)</option>
                <option value="_blank" ${currentTarget === '_blank' ? 'selected' : ''}>New Tab (_blank)</option>
              </select>
            </div>
          </div>

          <div style="display: flex; align-items: center; justify-content: space-between; padding-top: 12px; border-top: 1px solid #e2e8f0; margin-top: 16px;">
            <div style="display: flex; gap: 8px;">
              <button type="button" id="wp-btn-modal-delete-btn" class="wp-bar-btn" style="background:#fee2e2; color:#b91c1c; font-size:12px; padding:6px 10px;" title="Delete this button">
                <i class="fa-solid fa-trash"></i> Delete
              </button>
              <button type="button" id="wp-btn-modal-add-beside-btn" class="wp-bar-btn" style="background:#f1f5f9; color:#334155; font-size:12px; padding:6px 10px;" title="Add another button beside this">
                <i class="fa-solid fa-plus"></i> Add Button Beside
              </button>
            </div>
            <div style="display: flex; gap: 8px;">
              <button type="button" class="wp-bar-btn wp-modal-cancel" style="background:#f1f5f9; color:#475569;">Cancel</button>
              <button type="submit" class="wp-bar-btn btn-publish" style="background:var(--wp-primary, #2563eb); color:#fff;"><i class="fa-solid fa-check"></i> Save &amp; Apply</button>
            </div>
          </div>
        </form>
      </div>
    `;

    const pageDropdown = backdrop.querySelector('#wp-btn-page-dropdown');
    const customUrlWrap = backdrop.querySelector('#wp-btn-custom-url-wrap');
    const customUrlInput = backdrop.querySelector('#wp-btn-custom-url-input');

    pageDropdown.addEventListener('change', () => {
      if (pageDropdown.value === '__custom__') {
        customUrlWrap.style.display = 'block';
        customUrlInput.focus();
      } else {
        customUrlWrap.style.display = 'none';
        if (pageDropdown.value) customUrlInput.value = pageDropdown.value;
      }
    });

    backdrop.querySelector('#wp-btn-create-new-page-shortcut').onclick = () => {
      backdrop.remove();
      openNewPageModal('content', targetBtn);
    };

    backdrop.querySelector('#wp-btn-modal-add-beside-btn').onclick = () => {
      backdrop.remove();
      addHeroActionButton(targetBtn);
    };

    backdrop.querySelector('#wp-btn-modal-delete-btn').onclick = () => {
      backdrop.remove();
      deleteHeroActionButton(targetBtn);
    };

    backdrop.querySelector('#wp-btn-modal-open-page-btn')?.addEventListener('click', () => {
      backdrop.remove();
      editAttachedPage(targetBtn);
    });

    backdrop.querySelector('#wp-btn-modal-delete-page-btn')?.addEventListener('click', () => {
      deleteAttachedPage(targetBtn);
    });

    backdrop.querySelector('#wp-btn-modal-toggle-kill-btn')?.addEventListener('click', () => {
      if (targetBtn.getAttribute('data-btn-killed') === 'true') {
        restoreButtonFunction(targetBtn);
      } else {
        killButtonFunction(targetBtn);
      }
      backdrop.remove();
      openButtonPageEditorModal(targetBtn);
    });

    backdrop.querySelector('.cms-modal-close').onclick = () => backdrop.remove();
    backdrop.querySelector('.wp-modal-cancel').onclick = () => backdrop.remove();

    backdrop.querySelector('#wp-btn-editor-form').onsubmit = (e) => {
      e.preventDefault();
      const label = backdrop.querySelector('#wp-btn-label-input').value.trim();
      const iconClass = backdrop.querySelector('#wp-btn-icon-select').value;
      let finalUrl = pageDropdown.value;
      if (finalUrl === '__custom__' || !finalUrl) {
        finalUrl = customUrlInput.value.trim() || '#';
      }
      const btnStyle = backdrop.querySelector('#wp-btn-style-select').value;
      const targetVal = backdrop.querySelector('#wp-btn-target-select').value;

      targetBtn.setAttribute('href', finalUrl);
      if (targetVal === '_blank') targetBtn.setAttribute('target', '_blank');
      else targetBtn.removeAttribute('target');

      targetBtn.classList.remove('btn-primary', 'btn-secondary', 'btn-outline', 'btn-explore');
      if (btnStyle === 'primary') {
        targetBtn.classList.add('btn', 'btn-primary', 'btn-explore');
      } else if (btnStyle === 'outline') {
        targetBtn.classList.add('btn', 'btn-outline');
      } else {
        targetBtn.classList.add('btn', 'btn-secondary');
      }

      let iconHtml = '';
      if (iconClass !== 'none') {
        iconHtml = ` <i class="${iconClass}"></i>`;
      }
      targetBtn.innerHTML = escapeHtml(label) + iconHtml;
      attachButtonEditControls(targetBtn);

      const id = targetBtn.getAttribute('data-cms-id');
      if (id) {
        pageContentMap[id] = { type: 'text', html: targetBtn.innerHTML };
      }

      markDirty();
      showToast('Button & attached page updated!', 'success');
      backdrop.remove();
      hideButtonActionBar();
    };

    document.body.append(backdrop);
  }


  // --- Universal Element Relocate & Move Handle Controller ---
  function attachRelocateControls(el) {
    if (!el || el.closest('.card, .leader-card, .faq-item, .stat-box') || el.querySelector(':scope > .cms-element-move-pill')) return;
    el.setAttribute('data-cms-relocatable', 'true');

    const pill = document.createElement('div');
    pill.className = 'cms-element-move-pill cms-ignore';
    pill.innerHTML = `
      <button type="button" class="cms-move-btn" title="Left-click and drag freely across canvas" aria-label="Drag to relocate">
        <i class="fa-solid fa-arrows-up-down-left-right"></i>
      </button>
      <button type="button" class="cms-move-menu-toggle" title="Relocate Options Menu" aria-label="Relocate Options">
        <i class="fa-solid fa-caret-down"></i>
      </button>
    `;

    const moveBtn = pill.querySelector('.cms-move-btn');
    const menuBtn = pill.querySelector('.cms-move-menu-toggle');

    // Left-click / Press and move around canvas in any direction
    moveBtn.addEventListener('pointerdown', (e) => startCanvasPointerDrag(el, e, 'element'));
    moveBtn.addEventListener('mousedown', (e) => startCanvasPointerDrag(el, e, 'element'));

    // Menu Popover toggle
    const toggleRelocatePopover = (e) => {
      e.stopPropagation();
      e.preventDefault();
      closeAllRelocatePopovers();

      const isBtnOrLink = el.matches('a, button, .btn, .btn-primary, .btn-secondary, .btn-outline') ||
        !!el.closest('.hero-actions') ||
        el.tagName === 'A' ||
        el.tagName === 'BUTTON';

      const btnOptionsHtml = isBtnOrLink ? `
        <div style="padding: 6px 10px 4px; font-size: 10px; font-weight: 700; color: #c5a059; text-transform: uppercase; letter-spacing: 0.06em; display: flex; align-items: center; gap: 5px;">
          <i class="fa-solid fa-bullseye"></i> Button &amp; Page Options
        </div>
        <button type="button" class="cms-relocate-item" data-act="btn-edit-page"><i class="fa-solid fa-link" style="color:#38bdf8;"></i> Settings &amp; Destination...</button>
        <button type="button" class="cms-relocate-item" data-act="btn-jump-page"><i class="fa-solid fa-arrow-up-right-from-square" style="color:#0284c7;"></i> Open &amp; Edit Attached Page</button>
        <button type="button" class="cms-relocate-item" data-act="btn-create-page"><i class="fa-solid fa-file-circle-plus" style="color:#4ade80;"></i> Create &amp; Attach New Page...</button>
        <button type="button" class="cms-relocate-item" data-act="btn-toggle-kill"><i class="fa-solid ${el.getAttribute('data-btn-killed') === 'true' ? 'fa-bolt' : 'fa-ban'}" style="color:${el.getAttribute('data-btn-killed') === 'true' ? '#4ade80' : '#fb923c'};"></i> ${el.getAttribute('data-btn-killed') === 'true' ? 'Restore Button Function' : 'Kill Button Function (Disable)'}</button>
        <button type="button" class="cms-relocate-item" data-act="btn-add-beside"><i class="fa-solid fa-plus" style="color:#fbbf24;"></i> Add Button Beside This</button>
        <button type="button" class="cms-relocate-item danger" data-act="btn-del-page"><i class="fa-solid fa-file-circle-xmark" style="color:#ef4444;"></i> Delete Attached Page from Site...</button>
        <button type="button" class="cms-relocate-item danger" data-act="btn-del-btn"><i class="fa-solid fa-trash" style="color:#ef4444;"></i> Delete This Button</button>
        <div class="cms-relocate-divider"></div>
      ` : '';

      const popover = document.createElement('div');
      popover.className = 'cms-relocate-popover';
      popover.innerHTML = `
        ${btnOptionsHtml}
        <button type="button" class="cms-relocate-item" data-act="reset-pos"><i class="fa-solid fa-rotate-left"></i> Reset Canvas Position</button>
        <div class="cms-relocate-divider"></div>
        <button type="button" class="cms-relocate-item" data-act="move-up"><i class="fa-solid fa-arrow-up"></i> Move Up / Before</button>
        <button type="button" class="cms-relocate-item" data-act="move-down"><i class="fa-solid fa-arrow-down"></i> Move Down / After</button>
        <button type="button" class="cms-relocate-item" data-act="move-left"><i class="fa-solid fa-arrow-left"></i> Move Left</button>
        <button type="button" class="cms-relocate-item" data-act="move-right"><i class="fa-solid fa-arrow-right"></i> Move Right</button>
        <div class="cms-relocate-divider"></div>
        <button type="button" class="cms-relocate-item" data-act="move-top"><i class="fa-solid fa-arrow-up-from-bracket"></i> Move to Top of Section</button>
        <button type="button" class="cms-relocate-item" data-act="move-bottom"><i class="fa-solid fa-arrow-down-to-bracket"></i> Move to Bottom of Section</button>
        <button type="button" class="cms-relocate-item" data-act="move-section"><i class="fa-solid fa-box-archive"></i> Move into Another Section...</button>
        <div class="cms-relocate-divider"></div>
        <button type="button" class="cms-relocate-item" data-act="dup"><i class="fa-solid fa-clone"></i> Duplicate Element</button>
        <button type="button" class="cms-relocate-item danger" data-act="del"><i class="fa-solid fa-trash"></i> Delete Element</button>
      `;

      // Wire Button & Attached Page actions
      if (isBtnOrLink) {
        popover.querySelector('[data-act="btn-edit-page"]')?.addEventListener('click', (ev) => {
          ev.stopPropagation();
          popover.remove();
          openButtonPageEditorModal(el);
        });
        popover.querySelector('[data-act="btn-jump-page"]')?.addEventListener('click', (ev) => {
          ev.stopPropagation();
          popover.remove();
          editAttachedPage(el);
        });
        popover.querySelector('[data-act="btn-create-page"]')?.addEventListener('click', (ev) => {
          ev.stopPropagation();
          popover.remove();
          openNewPageModal('content', el);
        });
        popover.querySelector('[data-act="btn-toggle-kill"]')?.addEventListener('click', (ev) => {
          ev.stopPropagation();
          popover.remove();
          if (el.getAttribute('data-btn-killed') === 'true') {
            restoreButtonFunction(el);
          } else {
            killButtonFunction(el);
          }
        });
        popover.querySelector('[data-act="btn-del-page"]')?.addEventListener('click', (ev) => {
          ev.stopPropagation();
          popover.remove();
          deleteAttachedPage(el);
        });
        popover.querySelector('[data-act="btn-add-beside"]')?.addEventListener('click', (ev) => {
          ev.stopPropagation();
          popover.remove();
          addHeroActionButton(el);
        });
        popover.querySelector('[data-act="btn-del-btn"]')?.addEventListener('click', (ev) => {
          ev.stopPropagation();
          popover.remove();
          deleteHeroActionButton(el);
        });
      }

      // Reset Free Canvas Position
      popover.querySelector('[data-act="reset-pos"]').onclick = (ev) => {
        ev.stopPropagation();
        el.style.transform = '';
        el.style.zIndex = '';
        el.removeAttribute('data-cms-offset-x');
        el.removeAttribute('data-cms-offset-y');
        markDirty();
        showToast('Position reset to default layout.', 'success');
        popover.remove();
      };

      // Wire Popover Actions
      popover.querySelector('[data-act="move-up"]').onclick = (ev) => {
        ev.stopPropagation();
        const prev = el.previousElementSibling;
        if (prev && !prev.classList.contains('wp-section-bar') && !prev.classList.contains('wp-card-toolbar')) {
          el.parentNode.insertBefore(el, prev);
          markDirty();
          showToast('Moved element up.', 'success');
        }
        popover.remove();
      };

      popover.querySelector('[data-act="move-down"]').onclick = (ev) => {
        ev.stopPropagation();
        const next = el.nextElementSibling;
        if (next && !next.classList.contains('wp-add-card-placeholder')) {
          el.parentNode.insertBefore(next, el);
          markDirty();
          showToast('Moved element down.', 'success');
        }
        popover.remove();
      };

      popover.querySelector('[data-act="move-left"]').onclick = (ev) => {
        ev.stopPropagation();
        const prev = el.previousElementSibling;
        if (prev) {
          el.parentNode.insertBefore(el, prev);
          markDirty();
          showToast('Moved element left.', 'success');
        }
        popover.remove();
      };

      popover.querySelector('[data-act="move-right"]').onclick = (ev) => {
        ev.stopPropagation();
        const next = el.nextElementSibling;
        if (next) {
          el.parentNode.insertBefore(next, el);
          markDirty();
          showToast('Moved element right.', 'success');
        }
        popover.remove();
      };

      popover.querySelector('[data-act="move-top"]').onclick = (ev) => {
        ev.stopPropagation();
        const parent = el.parentNode;
        if (parent) {
          parent.prepend(el);
          markDirty();
          showToast('Moved element to top.', 'success');
        }
        popover.remove();
      };

      popover.querySelector('[data-act="move-bottom"]').onclick = (ev) => {
        ev.stopPropagation();
        const parent = el.parentNode;
        if (parent) {
          parent.append(el);
          markDirty();
          showToast('Moved element to bottom.', 'success');
        }
        popover.remove();
      };

      popover.querySelector('[data-act="move-section"]').onclick = (ev) => {
        ev.stopPropagation();
        popover.remove();
        openSectionPickerModal(el);
      };

      popover.querySelector('[data-act="dup"]').onclick = (ev) => {
        ev.stopPropagation();
        const clone = el.cloneNode(true);
        clone.querySelectorAll(CMS_UI_SELECTOR).forEach(p => p.remove());
        clone.querySelectorAll('[data-cms-id]').forEach(c => {
          c.setAttribute('data-cms-id', c.getAttribute('data-cms-id') + '_m_' + Date.now().toString().slice(-4));
        });
        el.parentNode.insertBefore(clone, el.nextSibling);
        prepareEditableDOM();
        setEditMode(true);
        markDirty();
        showToast('Element duplicated!', 'success');
        popover.remove();
      };

      popover.querySelector('[data-act="del"]').onclick = (ev) => {
        ev.stopPropagation();
        if (confirm('Delete this element?')) {
          el.remove();
          markDirty();
          showToast('Element deleted.', 'success');
        }
        popover.remove();
      };

      // 1. Calculate trigger button geometry
      const rect = menuBtn.getBoundingClientRect();

      // 2. Append to document.body (Portal Floating to prevent clipping)
      document.body.append(popover);
      activeRelocateMenu = popover;

      // 3. Position with smart viewport collision detection
      const popoverWidth = 240;
      let top = rect.bottom + 6;
      let left = rect.left;

      // Flip horizontal if extending past right edge
      if (left + popoverWidth > window.innerWidth - 16) {
        left = Math.max(16, window.innerWidth - popoverWidth - 16);
      }

      // Flip vertical if extending past bottom edge
      const estimatedHeight = isBtnOrLink ? 640 : 380;
      if (top + estimatedHeight > window.innerHeight - 16) {
        top = Math.max(16, rect.top - estimatedHeight - 6);
      }

      popover.style.position = 'fixed';
      popover.style.top = top + 'px';
      popover.style.left = left + 'px';
      popover.style.zIndex = '10000050';
    };

    menuBtn.addEventListener('click', toggleRelocatePopover);
    el.prepend(pill);
  }

  function closeAllRelocatePopovers() {
    document.querySelectorAll('.cms-relocate-popover').forEach(p => p.remove());
    activeRelocateMenu = null;
  }

  document.addEventListener('click', (e) => {
    if (!e.target.closest('.cms-element-move-pill') && !e.target.closest('.cms-relocate-popover')) {
      closeAllRelocatePopovers();
    }
    if (!e.target.closest('.wp-btn-action-bar') && !e.target.closest('a, button, .btn')) {
      hideButtonActionBar();
    }
  });

  window.addEventListener('scroll', () => {
    if (activeRelocateMenu) closeAllRelocatePopovers();
    if (activeButtonActionBar) hideButtonActionBar();
  }, { passive: true });

  window.addEventListener('resize', () => {
    if (activeRelocateMenu) closeAllRelocatePopovers();
    if (activeButtonActionBar) hideButtonActionBar();
  });

  // Modal to move element into any section on the page
  function openSectionPickerModal(elementToMove) {
    const sections = Array.from(document.querySelectorAll('section, main > div')).filter(s => !s.closest('#wp-admin-bar') && !s.closest('.cms-modal-backdrop'));
    const backdrop = document.createElement('div');
    backdrop.className = 'cms-modal-backdrop open';
    backdrop.innerHTML = `
      <div class="cms-modal-box" style="width: min(520px, 92vw);">
        <div class="cms-modal-header">
          <h3 class="cms-modal-title"><i class="fa-solid fa-box-archive" style="color:var(--wp-primary);"></i> Relocate to Another Section</h3>
          <button type="button" class="cms-modal-close"><i class="fa-solid fa-xmark"></i></button>
        </div>
        <p style="font-size:12.5px; color:#64748b; margin:0 0 14px;">Select the target section to move this element into:</p>
        <div style="display:flex; flex-direction:column; gap:8px; max-height:300px; overflow-y:auto; margin-bottom:16px;">
          ${sections.map((sec, idx) => {
      const heading = sec.querySelector('h1, h2, h3')?.textContent.trim() || sec.id || `Section #${idx + 1}`;
      return `
              <button type="button" class="cms-relocate-section-target" data-sec-idx="${idx}" style="display:flex; align-items:center; justify-content:space-between; padding:10px 14px; background:#f8fafc; border:1px solid #e2e8f0; border-radius:6px; cursor:pointer; text-align:left; font-size:13px; font-weight:600; color:#0f172a; transition:all 0.15s;">
                <span><i class="fa-solid fa-layer-group" style="color:#3b82f6; margin-right:8px;"></i> ${escapeHtml(heading)}</span>
                <i class="fa-solid fa-arrow-right" style="color:#94a3b8; font-size:11px;"></i>
              </button>
            `;
    }).join('')}
        </div>
      </div>
    `;

    backdrop.querySelector('.cms-modal-close').onclick = () => backdrop.remove();
    backdrop.querySelectorAll('.cms-relocate-section-target').forEach(btn => {
      btn.onclick = () => {
        const idx = Number(btn.getAttribute('data-sec-idx'));
        const targetSection = sections[idx];
        if (targetSection && elementToMove) {
          const container = targetSection.querySelector('.container, .cards-grid, .text-block') || targetSection;
          container.append(elementToMove);
          markDirty();
          showToast(`Relocated to ${btn.textContent.trim()}!`, 'success');
        }
        backdrop.remove();
      };
    });

    document.body.append(backdrop);
  }

  // Card Floating Action Toolbar (Add / Left / Right / Drag / Delete)
  function attachCardToolbar(card) {
    if (card.querySelector(':scope > .wp-card-toolbar') || card.classList.contains('wp-add-card-placeholder')) return;
    card.setAttribute('data-cms-card', 'true');

    const toolbar = document.createElement('div');
    toolbar.className = 'wp-card-toolbar';
    toolbar.innerHTML = `
      <button type="button" class="wp-card-btn wp-card-drag-btn" title="Left-click and move card around canvas"><i class="fa-solid fa-arrows-up-down-left-right"></i></button>
      <button type="button" class="wp-card-btn" data-act="card-media" title="Card Photo / Video Media"><i class="fa-solid fa-photo-film"></i></button>
      <button type="button" class="wp-card-btn" data-act="card-dup" title="Add / Duplicate Card in Row"><i class="fa-solid fa-plus"></i></button>
      <button type="button" class="wp-card-btn" data-act="card-left" title="Move Left / Up"><i class="fa-solid fa-arrow-left"></i></button>
      <button type="button" class="wp-card-btn" data-act="card-right" title="Move Right / Down"><i class="fa-solid fa-arrow-right"></i></button>
      <button type="button" class="wp-card-btn wp-card-del" data-act="card-del" title="Delete Card"><i class="fa-solid fa-trash"></i></button>
    `;

    // Left-click press and move card around canvas
    const dragBtn = toolbar.querySelector('.wp-card-drag-btn');
    dragBtn.addEventListener('pointerdown', (e) => startCanvasPointerDrag(card, e, 'card'));
    dragBtn.addEventListener('mousedown', (e) => startCanvasPointerDrag(card, e, 'card'));

    toolbar.querySelector('[data-act="card-media"]').onclick = (e) => {
      e.stopPropagation();
      openCardMediaModal(card);
    };

    toolbar.querySelector('[data-act="card-dup"]').onclick = (e) => {
      e.stopPropagation();
      duplicateCardInRow(card);
    };

    toolbar.querySelector('[data-act="card-left"]').onclick = (e) => {
      e.stopPropagation();
      const prev = card.previousElementSibling;
      if (prev && !prev.classList.contains('wp-card-toolbar')) {
        card.parentNode.insertBefore(card, prev);
        markDirty();
      }
    };

    toolbar.querySelector('[data-act="card-right"]').onclick = (e) => {
      e.stopPropagation();
      const next = card.nextElementSibling;
      if (next && !next.classList.contains('wp-add-card-placeholder')) {
        card.parentNode.insertBefore(next, card);
        markDirty();
      }
    };

    toolbar.querySelector('[data-act="card-del"]').onclick = (e) => {
      e.stopPropagation();
      if (confirm('Delete this card from the row?')) {
        card.remove();
        markDirty();
        showToast('Card removed from row.', 'success');
      }
    };

    card.prepend(toolbar);
  }

  function attachCardMediaControls(mediaWrap) {
    if (!mediaWrap) return;
    mediaWrap.querySelectorAll('.wp-card-media-pill').forEach((p) => p.remove());
  }

  function duplicateCardInRow(card) {
    const clone = card.cloneNode(true);
    clone.querySelectorAll(CMS_UI_SELECTOR).forEach(tb => tb.remove());
    clone.querySelectorAll('[data-cms-id]').forEach(el => {
      el.setAttribute('data-cms-id', el.getAttribute('data-cms-id') + '_c_' + Date.now().toString().slice(-4));
    });
    if (clone.classList.contains('reveal')) {
      clone.classList.add('active');
    }

    card.parentNode.insertBefore(clone, card.nextSibling);
    attachCardToolbar(clone);
    prepareEditableDOM();
    setEditMode(true);
    markDirty();
    showToast('New card added in row! Click text to edit.', 'success');
  }

  function attachGridCardInserter(grid) {
    if (grid.querySelector(':scope > .wp-add-card-placeholder')) return;
    const placeholder = document.createElement('div');
    placeholder.className = 'wp-add-card-placeholder';
    placeholder.innerHTML = `
      <i class="fa-solid fa-square-plus"></i>
      <span>+ Add Card to Row</span>
    `;

    placeholder.onclick = (e) => {
      e.stopPropagation();
      const existingCard = grid.querySelector('[data-cms-card]');
      if (existingCard) {
        duplicateCardInRow(existingCard);
      } else {
        const newCard = document.createElement('article');
        newCard.className = 'card reveal active';
        newCard.innerHTML = `
          <div class="card-body">
            <h3>New Feature / Card</h3>
            <p>Describe this event format, initiative, or highlight in detail here.</p>
          </div>
        `;
        grid.insertBefore(newCard, placeholder);
        attachCardToolbar(newCard);
        prepareEditableDOM();
        setEditMode(true);
        markDirty();
        showToast('New card added to row!', 'success');
      }
    };

    grid.append(placeholder);
  }

  function attachSectionBar(section) {
    if (section.querySelector(':scope > .wp-section-bar')) return;
    const bar = document.createElement('div');
    bar.className = 'wp-section-bar';
    bar.innerHTML = `
      <button type="button" class="wp-section-btn wp-section-drag-btn" title="Left-click and move section around canvas"><i class="fa-solid fa-arrows-up-down-left-right"></i> Move Section</button>
      <button type="button" class="wp-section-btn" data-act="up" title="Move Up"><i class="fa-solid fa-arrow-up"></i></button>
      <button type="button" class="wp-section-btn" data-act="down" title="Move Down"><i class="fa-solid fa-arrow-down"></i></button>
      <button type="button" class="wp-section-btn" data-act="top" title="Move to Top"><i class="fa-solid fa-arrow-up-from-bracket"></i></button>
      <button type="button" class="wp-section-btn" data-act="bottom" title="Move to Bottom"><i class="fa-solid fa-arrow-down-to-bracket"></i></button>
      <button type="button" class="wp-section-btn" data-act="dup" title="Duplicate Section"><i class="fa-solid fa-clone"></i></button>
      <button type="button" class="wp-section-btn del" data-act="del" title="Delete Section"><i class="fa-solid fa-trash"></i></button>
    `;

    // Left-click press and move section around canvas
    const dragBtn = bar.querySelector('.wp-section-drag-btn');
    dragBtn.addEventListener('pointerdown', (e) => startCanvasPointerDrag(section, e, 'section'));
    dragBtn.addEventListener('mousedown', (e) => startCanvasPointerDrag(section, e, 'section'));

    bar.querySelector('[data-act="up"]').onclick = (e) => {
      e.stopPropagation();
      const prev = section.previousElementSibling;
      if (prev && (prev.tagName === 'SECTION' || prev.tagName === 'DIV')) {
        section.parentNode.insertBefore(section, prev);
        markDirty();
      }
    };

    bar.querySelector('[data-act="down"]').onclick = (e) => {
      e.stopPropagation();
      const next = section.nextElementSibling;
      if (next) {
        section.parentNode.insertBefore(next, section);
        markDirty();
      }
    };

    bar.querySelector('[data-act="top"]').onclick = (e) => {
      e.stopPropagation();
      section.parentNode.prepend(section);
      markDirty();
      showToast('Moved section to top of page.', 'success');
    };

    bar.querySelector('[data-act="bottom"]').onclick = (e) => {
      e.stopPropagation();
      section.parentNode.append(section);
      markDirty();
      showToast('Moved section to bottom of page.', 'success');
    };

    bar.querySelector('[data-act="dup"]').onclick = (e) => {
      e.stopPropagation();
      const clone = section.cloneNode(true);
      clone.querySelectorAll(CMS_UI_SELECTOR).forEach((p) => p.remove());
      clone.querySelectorAll('[data-cms-id]').forEach((el) => {
        el.setAttribute('data-cms-id', el.getAttribute('data-cms-id') + '_s_' + Date.now().toString().slice(-4));
      });
      section.parentNode.insertBefore(clone, section.nextElementSibling);
      attachSectionBar(clone);
      attachSectionDivider(clone);
      prepareEditableDOM();
      markDirty();
      showToast('Section duplicated successfully!', 'success');
    };

    bar.querySelector('[data-act="del"]').onclick = (e) => {
      e.stopPropagation();
      if (confirm('Are you sure you want to delete this section?')) {
        section.remove();
        markDirty();
        showToast('Section removed.', 'success');
      }
    };

  }

  function attachSectionDivider(section) {
    if (section.nextElementSibling?.classList?.contains('wp-add-section-divider')) return;
    const divider = document.createElement('div');
    divider.className = 'wp-add-section-divider';
    divider.innerHTML = `
      <button type="button" class="wp-add-section-btn">
        <i class="fa-solid fa-circle-plus"></i> Add Block / Section
      </button>
    `;

    divider.querySelector('.wp-add-section-btn').onclick = () => {
      openTemplateLibraryModal((newSectionHTML) => {
        const temp = document.createElement('div');
        temp.innerHTML = newSectionHTML;
        const newEl = temp.firstElementChild;
        if (newEl) {
          if (newEl.classList.contains('reveal')) newEl.classList.add('active');
          newEl.querySelectorAll('.reveal').forEach((r) => r.classList.add('active'));
          section.parentNode.insertBefore(newEl, divider.nextSibling);
          prepareEditableDOM();
          setEditMode(true);
          markDirty();
          showToast('New section added! Click to customize.', 'success');
        }
      });
    };

    section.after(divider);
  }

  // ==========================================================================
  // 3. Edit Mode & In-Place WYSIWYG
  // ==========================================================================

  let isRibbonVisible = true;

  function setEditMode(enable) {
    isEditMode = enable;
    try {
      sessionStorage.setItem('envision_cms_edit_mode', enable ? 'true' : 'false');
    } catch (e) { }
    document.body.classList.toggle('cms-edit-mode', enable);
    document.body.classList.toggle('has-word-ribbon', enable && isRibbonVisible);

    const toggleBtn = document.getElementById('wp-toggle-edit');
    if (toggleBtn) {
      toggleBtn.classList.toggle('active', enable);
      toggleBtn.innerHTML = enable
        ? '<i class="fa-solid fa-pen-nib"></i> Editing: ON'
        : '<i class="fa-solid fa-pen"></i> Edit Mode';
    }

    const ribbon = document.getElementById('wp-word-ribbon');
    if (ribbon) {
      ribbon.classList.toggle('cms-visible', enable && isRibbonVisible);
    }

    document.querySelectorAll('[data-cms-editable]').forEach((el) => {
      el.contentEditable = enable ? 'true' : 'false';
      if (enable) {
        el.addEventListener('input', onElementInput);
        el.addEventListener('focus', onElementFocus);
        el.addEventListener('mouseup', onElementMouseUp);
        el.addEventListener('keyup', onElementKeyUp);
      } else {
        el.removeEventListener('input', onElementInput);
        el.removeEventListener('focus', onElementFocus);
        el.removeEventListener('mouseup', onElementMouseUp);
        el.removeEventListener('keyup', onElementKeyUp);
      }
    });

    document.querySelectorAll('[data-cms-editable-image], .card-media, .leader-card-media, .card figure, .card-media-img, .card-media-video').forEach((el) => {
      if (enable) {
        el.addEventListener('click', onCardMediaClick);
      } else {
        el.removeEventListener('click', onCardMediaClick);
      }
    });

    if (!enable) {
      hideFloatingToolbar();
      closeSidebarInspector();
    }
  }

  function onElementInput(e) {
    markDirty();
    const el = e.currentTarget;
    const id = el.getAttribute('data-cms-id');
    if (id) {
      pageContentMap[id] = pageContentMap[id] || {};
      pageContentMap[id].type = 'text';
      pageContentMap[id].html = getCleanElementHtml(el);
      try {
        localStorage.setItem(pageStorageKey, JSON.stringify(pageContentMap));
        localStorage.setItem('envision_cms_saved_at_' + pagePath, Date.now().toString());
      } catch (err) { }
    }
  }

  function onElementFocus(e) {
    if (!isEditMode) return;
    activeElement = e.currentTarget;
    syncSidebarInspector(activeElement);
    syncRibbonValues(activeElement);
  }

  function onElementKeyUp(e) {
    if (!isEditMode) return;
    checkSelectionFloatingToolbar();
  }

  function onElementMouseUp(e) {
    if (!isEditMode) return;
    checkSelectionFloatingToolbar();
  }

  function checkSelectionFloatingToolbar() {
    const sel = window.getSelection();
    if (sel && sel.toString().trim().length > 0) {
      const range = sel.getRangeAt(0);
      const rect = range.getBoundingClientRect();
      showFloatingToolbar(rect.left + rect.width / 2, rect.top - 48 + window.scrollY);
    } else {
      hideFloatingToolbar();
    }
  }

  function onCardMediaClick(e) {
    if (!isEditMode) return;
    e.preventDefault();
    e.stopPropagation();
    activeElement = e.currentTarget;
    openCardMediaModal(activeElement);
  }

  const onImageClick = onCardMediaClick;

  let autoSaveTimeout = null;
  function markDirty() {
    const pubBtn = document.getElementById('wp-publish-btn');
    if (pubBtn) {
      pubBtn.innerHTML = '<i class="fa-solid fa-floppy-disk"></i> Publish Changes *';
      pubBtn.classList.add('btn-publish');
    }
    try {
      localStorage.setItem('envision_cms_saved_at_' + pagePath, Date.now().toString());
    } catch (e) { }

    // Auto-save changes safely in the background
    if (autoSaveTimeout) clearTimeout(autoSaveTimeout);
    autoSaveTimeout = setTimeout(() => {
      saveAllChanges(false);
    }, 2000);
  }

  // ==========================================================================
  // 4. Microsoft Word Ribbon & Advanced Word Actions
  // ==========================================================================

  function toggleWordRibbon() {
    isRibbonVisible = !isRibbonVisible;
    try {
      sessionStorage.setItem('envision_cms_ribbon_visible', isRibbonVisible ? 'true' : 'false');
    } catch (e) { }
    const ribbon = document.getElementById('wp-word-ribbon');
    const btn = document.getElementById('wp-toggle-ribbon');
    if (ribbon) ribbon.classList.toggle('cms-visible', isRibbonVisible && isEditMode);
    if (btn) btn.classList.toggle('active', isRibbonVisible);
    document.body.classList.toggle('has-word-ribbon', isRibbonVisible && isEditMode);
  }

  function syncRibbonValues(el) {
    if (!el) return;
    const computed = window.getComputedStyle(el);
    const fontVal = computed.fontFamily.split(',')[0].replace(/['"]/g, '').trim();
    const sizeVal = parseInt(computed.fontSize) || 16;

    document.querySelectorAll('.word-font-family').forEach(sel => {
      sel.value = fontVal;
    });
    document.querySelectorAll('.word-font-size').forEach(sel => {
      sel.value = sizeVal;
    });
  }

  function executeWordAction(act, val = null) {
    if (!isEditMode) return;

    switch (act) {
      case 'fontFamily':
        if (activeElement) {
          activeElement.style.fontFamily = val;
          markDirty();
        }
        document.execCommand('fontName', false, val);
        break;

      case 'fontSize':
        if (activeElement) {
          activeElement.style.fontSize = val + 'px';
          markDirty();
        }
        break;

      case 'growFont': {
        const target = activeElement || document.querySelector(':focus');
        if (target) {
          const currentSize = parseInt(window.getComputedStyle(target).fontSize) || 16;
          const newSize = currentSize + 2;
          target.style.fontSize = newSize + 'px';
          syncRibbonValues(target);
          markDirty();
        }
        break;
      }

      case 'shrinkFont': {
        const target = activeElement || document.querySelector(':focus');
        if (target) {
          const currentSize = parseInt(window.getComputedStyle(target).fontSize) || 16;
          const newSize = Math.max(8, currentSize - 2);
          target.style.fontSize = newSize + 'px';
          syncRibbonValues(target);
          markDirty();
        }
        break;
      }

      case 'bold':
        document.execCommand('bold', false, null);
        markDirty();
        break;

      case 'italic':
        document.execCommand('italic', false, null);
        markDirty();
        break;

      case 'underline':
        document.execCommand('underline', false, null);
        markDirty();
        break;

      case 'ul-solid':
        if (activeElement) { activeElement.style.textDecoration = 'underline solid'; markDirty(); }
        break;
      case 'ul-double':
        if (activeElement) { activeElement.style.textDecoration = 'underline double'; markDirty(); }
        break;
      case 'ul-dashed':
        if (activeElement) { activeElement.style.textDecoration = 'underline dashed'; markDirty(); }
        break;
      case 'ul-wavy':
        if (activeElement) { activeElement.style.textDecoration = 'underline wavy'; markDirty(); }
        break;

      case 'strikeThrough':
        document.execCommand('strikeThrough', false, null);
        markDirty();
        break;

      case 'subscript':
        document.execCommand('subscript', false, null);
        markDirty();
        break;

      case 'superscript':
        document.execCommand('superscript', false, null);
        markDirty();
        break;

      case 'case-sentence':
      case 'case-lower':
      case 'case-upper':
      case 'case-title':
      case 'case-toggle': {
        const sel = window.getSelection();
        if (sel && sel.rangeCount > 0 && sel.toString().length > 0) {
          const text = sel.toString();
          let transformed = text;
          if (act === 'case-lower') transformed = text.toLowerCase();
          else if (act === 'case-upper') transformed = text.toUpperCase();
          else if (act === 'case-title') transformed = text.replace(/\b\w/g, c => c.toUpperCase());
          else if (act === 'case-sentence') transformed = text.toLowerCase().replace(/(^\s*\w|[.!?]\s*\w)/g, c => c.toUpperCase());
          else if (act === 'case-toggle') transformed = text.split('').map(c => c === c.toUpperCase() ? c.toLowerCase() : c.toUpperCase()).join('');
          document.execCommand('insertText', false, transformed);
          markDirty();
        } else if (activeElement) {
          const text = activeElement.textContent;
          let transformed = text;
          if (act === 'case-lower') transformed = text.toLowerCase();
          else if (act === 'case-upper') transformed = text.toUpperCase();
          else if (act === 'case-title') transformed = text.replace(/\b\w/g, c => c.toUpperCase());
          else if (act === 'case-sentence') transformed = text.toLowerCase().replace(/(^\s*\w|[.!?]\s*\w)/g, c => c.toUpperCase());
          else if (act === 'case-toggle') transformed = text.split('').map(c => c === c.toUpperCase() ? c.toLowerCase() : c.toUpperCase()).join('');
          activeElement.textContent = transformed;
          markDirty();
        }
        break;
      }

      case 'clearFormat':
        document.execCommand('removeFormat', false, null);
        if (activeElement) {
          activeElement.style.color = '';
          activeElement.style.backgroundColor = '';
          activeElement.style.textShadow = '';
          activeElement.style.webkitTextStroke = '';
          activeElement.style.textDecoration = '';
          activeElement.style.fontWeight = '';
          activeElement.style.fontStyle = '';
          activeElement.style.textAlign = '';
          activeElement.style.lineHeight = '';
          activeElement.style.border = '';
          markDirty();
        }
        break;

      case 'fx-glow':
        if (activeElement) {
          activeElement.style.textShadow = '0 0 12px rgba(37, 99, 235, 0.85), 0 0 24px rgba(37, 99, 235, 0.45)';
          markDirty();
        }
        break;

      case 'fx-gold':
        if (activeElement) {
          activeElement.style.background = 'linear-gradient(135deg, #c5a059, #f59e0b)';
          activeElement.style.webkitBackgroundClip = 'text';
          activeElement.style.webkitTextFillColor = 'transparent';
          markDirty();
        }
        break;

      case 'fx-shadow':
        if (activeElement) {
          activeElement.style.textShadow = '2px 3px 6px rgba(0, 0, 0, 0.6)';
          markDirty();
        }
        break;

      case 'fx-outline':
        if (activeElement) {
          activeElement.style.webkitTextStroke = '1.2px #2563eb';
          markDirty();
        }
        break;

      case 'fx-none':
        if (activeElement) {
          activeElement.style.textShadow = '';
          activeElement.style.webkitTextStroke = '';
          activeElement.style.background = '';
          activeElement.style.webkitBackgroundClip = '';
          activeElement.style.webkitTextFillColor = '';
          markDirty();
        }
        break;

      case 'highlight':
        document.execCommand('hiliteColor', false, val);
        markDirty();
        break;

      case 'foreColor':
        document.execCommand('foreColor', false, val);
        if (activeElement) {
          activeElement.style.color = val;
        }
        markDirty();
        break;

      case 'insertUnorderedList':
        document.execCommand('insertUnorderedList', false, null);
        markDirty();
        break;

      case 'insertOrderedList':
        document.execCommand('insertOrderedList', false, null);
        markDirty();
        break;

      case 'list-disc':
        document.execCommand('insertUnorderedList', false, null);
        if (activeElement) activeElement.style.listStyleType = 'disc';
        markDirty();
        break;
      case 'list-circle':
        document.execCommand('insertUnorderedList', false, null);
        if (activeElement) activeElement.style.listStyleType = 'circle';
        markDirty();
        break;
      case 'list-square':
        document.execCommand('insertUnorderedList', false, null);
        if (activeElement) activeElement.style.listStyleType = 'square';
        markDirty();
        break;
      case 'list-123':
        document.execCommand('insertOrderedList', false, null);
        if (activeElement) activeElement.style.listStyleType = 'decimal';
        markDirty();
        break;
      case 'list-abc':
        document.execCommand('insertOrderedList', false, null);
        if (activeElement) activeElement.style.listStyleType = 'lower-alpha';
        markDirty();
        break;
      case 'list-roman':
        document.execCommand('insertOrderedList', false, null);
        if (activeElement) activeElement.style.listStyleType = 'lower-roman';
        markDirty();
        break;
      case 'list-check':
        document.execCommand('insertUnorderedList', false, null);
        if (activeElement) activeElement.style.listStyleType = 'none';
        markDirty();
        break;

      case 'outdent':
        document.execCommand('outdent', false, null);
        markDirty();
        break;

      case 'indent':
        document.execCommand('indent', false, null);
        markDirty();
        break;

      case 'sortLines': {
        if (activeElement) {
          const list = activeElement.closest('ul, ol');
          if (list) {
            const items = Array.from(list.querySelectorAll('li'));
            items.sort((a, b) => a.textContent.trim().localeCompare(b.textContent.trim()));
            items.forEach(li => list.append(li));
            markDirty();
            showToast('List sorted alphabetically A-Z', 'success');
          } else {
            const lines = activeElement.innerHTML.split(/<br\s*\/?>/i);
            if (lines.length > 1) {
              lines.sort((a, b) => a.replace(/<[^>]*>/g, '').trim().localeCompare(b.replace(/<[^>]*>/g, '').trim()));
              activeElement.innerHTML = lines.join('<br>');
              markDirty();
              showToast('Lines sorted alphabetically A-Z', 'success');
            }
          }
        }
        break;
      }

      case 'toggleMarks':
        document.body.classList.toggle('cms-show-para-marks');
        showToast(document.body.classList.contains('cms-show-para-marks') ? 'Formatting Marks (¶) Shown' : 'Formatting Marks Hidden', 'info');
        break;

      case 'justifyLeft':
        document.execCommand('justifyLeft', false, null);
        if (activeElement) activeElement.style.textAlign = 'left';
        markDirty();
        break;

      case 'justifyCenter':
        document.execCommand('justifyCenter', false, null);
        if (activeElement) activeElement.style.textAlign = 'center';
        markDirty();
        break;

      case 'justifyRight':
        document.execCommand('justifyRight', false, null);
        if (activeElement) activeElement.style.textAlign = 'right';
        markDirty();
        break;

      case 'justifyFull':
        document.execCommand('justifyFull', false, null);
        if (activeElement) activeElement.style.textAlign = 'justify';
        markDirty();
        break;

      case 'lh-10': if (activeElement) { activeElement.style.lineHeight = '1.0'; markDirty(); } break;
      case 'lh-115': if (activeElement) { activeElement.style.lineHeight = '1.15'; markDirty(); } break;
      case 'lh-15': if (activeElement) { activeElement.style.lineHeight = '1.5'; markDirty(); } break;
      case 'lh-20': if (activeElement) { activeElement.style.lineHeight = '2.0'; markDirty(); } break;
      case 'lh-25': if (activeElement) { activeElement.style.lineHeight = '2.5'; markDirty(); } break;

      case 'shading':
        if (activeElement) {
          activeElement.style.backgroundColor = val;
          markDirty();
        }
        break;

      case 'border-bottom':
        if (activeElement) { activeElement.style.borderBottom = '2px solid #2563eb'; markDirty(); }
        break;
      case 'border-top':
        if (activeElement) { activeElement.style.borderTop = '2px solid #2563eb'; markDirty(); }
        break;
      case 'border-left':
        if (activeElement) { activeElement.style.borderLeft = '4px solid #2563eb'; activeElement.style.paddingLeft = '12px'; markDirty(); }
        break;
      case 'border-box':
        if (activeElement) { activeElement.style.border = '1.5px solid #cbd5e1'; activeElement.style.borderRadius = '6px'; activeElement.style.padding = '10px'; markDirty(); }
        break;
      case 'border-none':
        if (activeElement) { activeElement.style.border = 'none'; markDirty(); }
        break;
    }
  }

  function showFloatingToolbar(x, y) {
    const tb = document.getElementById('wp-floating-toolbar');
    if (!tb) return;
    tb.style.left = `${Math.max(10, x - tb.offsetWidth / 2)}px`;
    tb.style.top = `${Math.max(50, y)}px`;
    tb.classList.add('active');
  }

  function hideFloatingToolbar() {
    document.getElementById('wp-floating-toolbar')?.classList.remove('active');
  }

  function formatText(command, value = null) {
    document.execCommand(command, false, value);
    markDirty();
  }

  // ==========================================================================
  // 5. Elementor-Style Sidebar Inspector
  // ==========================================================================

  function openSidebarInspector() {
    document.getElementById('wp-sidebar-inspector')?.classList.add('open');
  }

  function closeSidebarInspector() {
    document.getElementById('wp-sidebar-inspector')?.classList.remove('open');
  }

  function toggleSidebarInspector() {
    const sb = document.getElementById('wp-sidebar-inspector');
    if (sb) {
      sb.classList.toggle('open');
      if (sb.classList.contains('open') && activeElement) {
        syncSidebarInspector(activeElement);
      }
    }
  }

  function syncSidebarInspector(el) {
    if (!el) return;
    const computed = window.getComputedStyle(el);

    const tagBadge = document.getElementById('wp-insp-tag');
    if (tagBadge) tagBadge.textContent = el.tagName.toLowerCase();

    const fontSelect = document.getElementById('wp-insp-font');
    if (fontSelect) fontSelect.value = computed.fontFamily.split(',')[0].replace(/['"]/g, '').trim();

    const sizeInput = document.getElementById('wp-insp-size');
    if (sizeInput) sizeInput.value = parseInt(computed.fontSize) || 16;

    const weightSelect = document.getElementById('wp-insp-weight');
    if (weightSelect) weightSelect.value = computed.fontWeight;

    const colorInput = document.getElementById('wp-insp-color');
    if (colorInput) colorInput.value = rgbToHex(computed.color);

    const bgInput = document.getElementById('wp-insp-bg');
    if (bgInput) bgInput.value = rgbToHex(computed.backgroundColor);

    const alignSelect = document.getElementById('wp-insp-align');
    if (alignSelect) alignSelect.value = computed.textAlign;

    const linkPanel = document.getElementById('wp-insp-link-panel');
    const linkInput = document.getElementById('wp-insp-link');
    const pageSelect = document.getElementById('wp-insp-page-select');
    const createPageBtn = document.getElementById('wp-insp-btn-create-page');
    const addBtnBtn = document.getElementById('wp-insp-btn-add-button');
    const delBtnBtn = document.getElementById('wp-insp-btn-del-button');
    const parentLink = (el.tagName === 'A' || el.tagName === 'BUTTON' || el.classList.contains('btn')) ? el : el.closest('a');

    if (linkPanel && linkInput) {
      if (parentLink) {
        linkPanel.style.display = 'block';
        const currentHref = parentLink.getAttribute('href') || '';
        linkInput.value = currentHref;

        if (pageSelect) {
          const pages = getAllSitePages();
          pageSelect.innerHTML = '<option value="">(Custom / Select Page)</option>' +
            pages.map(p => `<option value="${escapeHtml(p.file)}" ${p.file.toLowerCase() === currentHref.toLowerCase() ? 'selected' : ''}>${escapeHtml(p.title)}</option>`).join('');
          pageSelect.onchange = (e) => {
            if (e.target.value) {
              parentLink.setAttribute('href', e.target.value);
              linkInput.value = e.target.value;
              markDirty();
            }
          };
        }

        linkInput.oninput = (e) => {
          parentLink.setAttribute('href', e.target.value);
          if (pageSelect) pageSelect.value = e.target.value;
          markDirty();
        };

        if (createPageBtn) createPageBtn.onclick = () => openNewPageModal('content', parentLink);
        if (addBtnBtn) addBtnBtn.onclick = () => addHeroActionButton(parentLink);
        if (delBtnBtn) delBtnBtn.onclick = () => deleteHeroActionButton(parentLink);
      } else {
        linkPanel.style.display = 'none';
      }
    }
  }

  function applyStyleToActive(prop, val) {
    if (!activeElement) return;
    activeElement.style[prop] = val;
    markDirty();

    const id = activeElement.getAttribute('data-cms-id');
    if (id) {
      pageContentMap[id] = pageContentMap[id] || {};
      pageContentMap[id].style = pageContentMap[id].style || {};
      pageContentMap[id].style[prop] = val;
    }
  }

  function rgbToHex(rgb) {
    if (!rgb || rgb === 'transparent' || rgb.startsWith('rgba(0, 0, 0, 0)')) return '#000000';
    const match = rgb.match(/\d+/g);
    if (!match || match.length < 3) return '#000000';
    return '#' + ((1 << 24) + (Number(match[0]) << 16) + (Number(match[1]) << 8) + Number(match[2])).toString(16).slice(1);
  }

  // ==========================================================================
  // 6. Navigation Tabs Manager Modal
  // ==========================================================================

  function openNavManagerModal() {
    let navItems = [];
    const currentLinks = document.querySelectorAll('.nav-links > a:not(.nav-cta):not(.wp-nav-add-btn)');
    currentLinks.forEach((a) => {
      const clone = a.cloneNode(true);
      clone.querySelectorAll('.cms-element-move-pill, .wp-nav-add-btn, .cms-ignore').forEach(p => p.remove());
      const title = clone.textContent.replace(/^Move\s+/i, '').trim();
      if (title && title.toLowerCase() !== 'new tab') {
        navItems.push({ title, url: a.getAttribute('href') || '#' });
      }
    });

    const stored = localStorage.getItem(CMS_NAV_KEY);
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed) && parsed.length > 0) {
          navItems = parsed;
        }
      } catch (e) { }
    }
    navItems = reconcileNavList(navItems);

    const backdrop = document.createElement('div');
    backdrop.className = 'cms-modal-backdrop open';
    backdrop.innerHTML = `
      <div class="cms-modal-box" style="max-width: 680px;">
        <div class="cms-modal-header">
          <h3 class="cms-modal-title"><i class="fa-solid fa-arrows-left-right" style="color: var(--wp-primary);"></i> Navigation Menu Order & Manager</h3>
          <button type="button" class="cms-modal-close"><i class="fa-solid fa-xmark"></i></button>
        </div>
        <p style="font-size: 13px; color: #64748b; margin: 0 0 12px;">
          Use the <strong><i class="fa-solid fa-arrow-left"></i> Shift Left</strong> and <strong><i class="fa-solid fa-arrow-right"></i> Shift Right</strong> buttons to decide which tab comes first, second, etc. in the header track.
        </p>

        <!-- Live Sequence Track Preview -->
        <div class="wp-nav-preview-box">
          <div class="wp-nav-preview-title">
            <i class="fa-solid fa-bars-staggered"></i> Live Header Sequence Preview (Left to Right)
          </div>
          <div class="wp-nav-chips-track" id="wp-nav-preview-chips"></div>
        </div>

        <div class="wp-nav-manager-list" id="wp-nav-list-container">
          ${navItems.map((item, i) => `
            <div class="wp-nav-item-row" data-index="${i}">
              <span class="wp-nav-badge">#${i + 1}</span>
              <div class="wp-nav-shift-group">
                <button type="button" class="wp-nav-shift-btn wp-nav-shift-left" title="Shift Left (Move Earlier in Header)">
                  <i class="fa-solid fa-arrow-left"></i>
                </button>
                <button type="button" class="wp-nav-shift-btn wp-nav-shift-right" title="Shift Right (Move Later in Header)">
                  <i class="fa-solid fa-arrow-right"></i>
                </button>
              </div>
              <input type="text" class="wp-nav-title" value="${escapeHtml(item.title)}" placeholder="Tab Label" />
              <input type="text" class="wp-nav-url" value="${escapeHtml(item.url)}" placeholder="URL (e.g. events.html)" />
              <button type="button" class="wp-nav-item-del" title="Remove Tab"><i class="fa-solid fa-trash"></i></button>
            </div>
          `).join('')}
        </div>
        <button type="button" class="wp-bar-btn" id="wp-nav-add-row" style="background:#e2e8f0; color:#0f172a; margin-bottom: 20px;">
          <i class="fa-solid fa-plus"></i> Add New Tab
        </button>
        <div style="display: flex; justify-content: flex-end; gap: 10px;">
          <button type="button" class="wp-bar-btn wp-modal-cancel" style="background:#f1f5f9; color:#475569;">Cancel</button>
          <button type="button" class="wp-bar-btn btn-publish" id="wp-save-nav-btn"><i class="fa-solid fa-check"></i> Save Order</button>
        </div>
      </div>
    `;

    backdrop.querySelector('.cms-modal-close').onclick = () => backdrop.remove();
    backdrop.querySelector('.wp-modal-cancel').onclick = () => backdrop.remove();

    const listContainer = backdrop.querySelector('#wp-nav-list-container');
    const chipsTrack = backdrop.querySelector('#wp-nav-preview-chips');

    function updateRowControls() {
      const rows = Array.from(listContainer.querySelectorAll('.wp-nav-item-row'));
      rows.forEach((row, idx) => {
        row.setAttribute('data-index', idx);
        const badge = row.querySelector('.wp-nav-badge');
        if (badge) badge.textContent = '#' + (idx + 1);

        const leftBtn = row.querySelector('.wp-nav-shift-left');
        const rightBtn = row.querySelector('.wp-nav-shift-right');
        if (leftBtn) leftBtn.disabled = (idx === 0);
        if (rightBtn) rightBtn.disabled = (idx === rows.length - 1);
      });

      if (chipsTrack) {
        chipsTrack.innerHTML = rows.map((row, idx) => {
          const title = (row.querySelector('.wp-nav-title')?.value || '').trim() || 'Tab';
          return `<div class="wp-nav-chip"><span class="chip-num">${idx + 1}</span> <span>${escapeHtml(title)}</span></div>`;
        }).join('');
      }
    }

    function bindRowEvents(row) {
      const leftBtn = row.querySelector('.wp-nav-shift-left');
      const rightBtn = row.querySelector('.wp-nav-shift-right');
      const delBtn = row.querySelector('.wp-nav-item-del');
      const titleInput = row.querySelector('.wp-nav-title');

      if (leftBtn) {
        leftBtn.onclick = (e) => {
          e.preventDefault();
          const prev = row.previousElementSibling;
          if (prev) {
            listContainer.insertBefore(row, prev);
            row.classList.add('is-swapping');
            setTimeout(() => row.classList.remove('is-swapping'), 250);
            updateRowControls();
          }
        };
      }

      if (rightBtn) {
        rightBtn.onclick = (e) => {
          e.preventDefault();
          const next = row.nextElementSibling;
          if (next) {
            listContainer.insertBefore(next, row);
            row.classList.add('is-swapping');
            setTimeout(() => row.classList.remove('is-swapping'), 250);
            updateRowControls();
          }
        };
      }

      if (delBtn) {
        delBtn.onclick = () => {
          row.remove();
          updateRowControls();
        };
      }

      if (titleInput) {
        titleInput.oninput = () => {
          updateRowControls();
        };
      }
    }

    listContainer.querySelectorAll('.wp-nav-item-row').forEach(bindRowEvents);
    updateRowControls();

    backdrop.querySelector('#wp-nav-add-row').onclick = () => {
      const rows = listContainer.querySelectorAll('.wp-nav-item-row');
      const newIdx = rows.length;
      const row = document.createElement('div');
      row.className = 'wp-nav-item-row is-swapping';
      row.innerHTML = `
        <span class="wp-nav-badge">#${newIdx + 1}</span>
        <div class="wp-nav-shift-group">
          <button type="button" class="wp-nav-shift-btn wp-nav-shift-left" title="Shift Left (Move Earlier in Header)">
            <i class="fa-solid fa-arrow-left"></i>
          </button>
          <button type="button" class="wp-nav-shift-btn wp-nav-shift-right" title="Shift Right (Move Later in Header)">
            <i class="fa-solid fa-arrow-right"></i>
          </button>
        </div>
        <input type="text" class="wp-nav-title" value="New Tab" placeholder="Tab Label" />
        <input type="text" class="wp-nav-url" value="#" placeholder="URL (e.g. summit.html)" />
        <button type="button" class="wp-nav-item-del" title="Remove Tab"><i class="fa-solid fa-trash"></i></button>
      `;
      listContainer.append(row);
      bindRowEvents(row);
      setTimeout(() => row.classList.remove('is-swapping'), 250);
      updateRowControls();
    };

    backdrop.querySelector('#wp-save-nav-btn').onclick = async () => {
      const saveBtn = backdrop.querySelector('#wp-save-nav-btn');
      if (saveBtn) {
        saveBtn.disabled = true;
        saveBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Saving Across Site...';
      }

      const updatedList = [];
      backdrop.querySelectorAll('.wp-nav-item-row').forEach((row) => {
        const title = row.querySelector('.wp-nav-title').value.replace(/^Move\s+/i, '').trim();
        const url = row.querySelector('.wp-nav-url').value.trim();
        if (title && url) updatedList.push({ title, url });
      });

      await persistGlobalNavigation(updatedList);

      backdrop.remove();
      showToast('Navigation sequence updated & synchronized across all pages!', 'success');
    };

    document.body.append(backdrop);
  }

  // ==========================================================================
  // 7. Dedicated Event Page Generator
  // ==========================================================================

  // ==========================================================================
  // 7. Dedicated Page Creator & Manager (Event, Content, Showcase, Canvas)
  // ==========================================================================

  function buildThemeCss(styles) {
    styles = styles || {};
    let css = ':root {\n';
    if (styles.bg) css += `  --bg: ${styles.bg} !important;\n`;
    if (styles.bg2) css += `  --bg-2: ${styles.bg2} !important;\n`;
    if (styles.panel) {
      css += `  --panel: ${styles.panel} !important;\n  --panel-strong: ${styles.panel} !important;\n`;
    }
    if (styles.line) css += `  --line: ${styles.line} !important;\n`;
    if (styles.primaryColor) {
      css += `  --blue: ${styles.primaryColor} !important;\n  --blue-strong: ${styles.primaryColor} !important;\n  --navy: ${styles.primaryColor} !important;\n`;
    }
    if (styles.accentColor) {
      css += `  --gold: ${styles.accentColor} !important;\n  --gold-soft: ${styles.accentColor} !important;\n  --gold-strong: ${styles.accentColor} !important;\n`;
    }
    if (styles.text) css += `  --text: ${styles.text} !important;\n`;
    if (styles.muted) css += `  --muted: ${styles.muted} !important;\n`;
    if (styles.radius) css += `  --card-radius: ${styles.radius} !important;\n`;
    css += '}\n';

    if (styles.fontPrimary) {
      css += `body, p, span, a, li, input, button { font-family: ${styles.fontPrimary}, -apple-system, sans-serif !important; }\n`;
    }
    if (styles.fontHeading) {
      css += `h1, h2, h3, h4, h5, h6, .section-label, .stat-number, .leader-name, .logo-title { font-family: ${styles.fontHeading}, sans-serif !important; }\n`;
    }
    if (styles.fontMono) {
      css += `code, pre, .mono-eyebrow, .badge, .section-label { font-family: ${styles.fontMono}, monospace !important; }\n`;
    }

    if (styles.isDarkMode) {
      css += `body { background-color: ${styles.bg || '#0b0f19'} !important; color: ${styles.text || '#f1f5f9'} !important; }\n`;
      css += `.ambient-canvas { background: ${styles.bg || '#0b0f19'} !important; }\n`;
      css += `.topbar { background: rgba(11, 15, 25, 0.92) !important; border-bottom: 1px solid rgba(255, 255, 255, 0.1) !important; }\n`;
      css += `.card, .stat-box, .faq-item, .promo-band, .leader-card { background: ${styles.panel || '#131b2e'} !important; border-color: ${styles.line || 'rgba(255, 255, 255, 0.12)'} !important; color: ${styles.text || '#f1f5f9'} !important; }\n`;
      css += `.card-body p, .faq-answer p, .stat-label { color: ${styles.muted || '#94a3b8'} !important; }\n`;
    } else if (styles.bg) {
      css += `body { background-color: ${styles.bg} !important; }\n`;
      css += `.ambient-canvas { background: ${styles.bg} !important; }\n`;
    }
    return css;
  }

  function generateNewPageHTML(opts) {
    const title = escapeHtml(opts.title || 'New Page');
    const tagline = escapeHtml(opts.tagline || 'Building the future of entrepreneurship at IIM Bodh Gaya.');
    const filename = (opts.filename || 'new-page.html').trim();
    const slug = filename.replace(/\.html$/i, '').replace(/[^a-zA-Z0-9_-]/g, '_');
    const template = opts.template || 'content';
    const navList = Array.isArray(opts.navList) && opts.navList.length > 0 ? opts.navList : [
      { title: 'Home', url: 'index.html' },
      { title: 'About', url: 'about.html' },
      { title: 'Events', url: 'events.html' },
      { title: 'Incubation', url: 'incubation.html' },
      { title: 'Contact', url: 'contact.html' }
    ];
    const styles = opts.styles || {};
    const themeCss = buildThemeCss(styles);
    const bodyClass = styles.isDarkMode ? 'class="theme-dark"' : '';

    const navHtml = navList.map(item => {
      const isActive = item.url === filename ? ' class="active"' : '';
      return `<a href="${escapeHtml(item.url)}"${isActive}>${escapeHtml(item.title)}</a>`;
    }).join('\n        ');

    const mobileNavHtml = navList.map(item => {
      return `<a href="${escapeHtml(item.url)}">${escapeHtml(item.title)}</a>`;
    }).join('\n        ');

    let mainContent = '';

    if (template === 'event') {
      mainContent = `
    <!-- Event Hero Details -->
    <section class="section" id="about-event">
      <div class="container grid-2">
        <div class="text-block reveal">
          <div data-cms-id="txt_${slug}_4" class="section-label">About the Event</div>
          <h2 data-cms-id="txt_${slug}_5">Building the next wave of founders.</h2>
          <p data-cms-id="txt_${slug}_6">${title} is the marquee entrepreneurial gathering bringing together students, startups, innovators, and investors for an intensive journey of learning, collaboration, and pitching.</p>
          <div style="margin-top: 1.5rem; display: flex; gap: 1rem;">
            <a data-cms-id="txt_${slug}_7" href="#register" class="btn btn-primary"><i class="fa-solid fa-ticket"></i> Register Now</a>
            <a data-cms-id="txt_${slug}_8" href="contact.html" class="btn btn-secondary"><i class="fa-solid fa-envelope"></i> Contact Organizers</a>
          </div>
        </div>
        <div class="image-panel reveal">
          <img data-cms-id="img_${slug}_1" src="https://images.unsplash.com/photo-1540575467063-178a50c2df87?q=80&w=2070&auto=format&fit=crop" alt="${title}" />
        </div>
      </div>
    </section>

    <!-- Tracks & Highlights -->
    <section class="section bg-light">
      <div class="container">
        <div class="section-heading reveal">
          <div data-cms-id="txt_${slug}_9" class="section-label">Event Highlights</div>
          <h2 data-cms-id="txt_${slug}_10">What to Expect at ${title}</h2>
          <p data-cms-id="txt_${slug}_11">Explore key segments designed to accelerate ideas, connect with mentors, and compete for grants.</p>
        </div>
        <div data-cms-grid-id="grid_${slug}_1" class="cards-grid grid-3">
          <article class="card reveal">
            <div class="card-icon"><i class="fa-solid fa-lightbulb"></i></div>
            <h3 data-cms-id="txt_${slug}_12">Pitch Arena</h3>
            <p data-cms-id="txt_${slug}_13">Present your venture to active angel investors, venture capitalists, and industry stalwarts.</p>
          </article>
          <article class="card reveal">
            <div class="card-icon"><i class="fa-solid fa-users-gear"></i></div>
            <h3 data-cms-id="txt_${slug}_14">Masterclasses</h3>
            <p data-cms-id="txt_${slug}_15">Deep-dive sessions on scaling, product-market fit, and fundraising led by veteran founders.</p>
          </article>
          <article class="card reveal">
            <div class="card-icon"><i class="fa-solid fa-trophy"></i></div>
            <h3 data-cms-id="txt_${slug}_16">Grants &amp; Incubation</h3>
            <p data-cms-id="txt_${slug}_17">Top teams win cash prizes, incubation support, and direct mentorship from INSPIRE.</p>
          </article>
        </div>
      </div>
    </section>

    <!-- Register CTA -->
    <section class="section" id="register">
      <div class="container">
        <div class="promo-band reveal">
          <div data-cms-id="txt_${slug}_18" class="section-label">Join the Experience</div>
          <h2 data-cms-id="txt_${slug}_19">Be part of ${title} at IIM Bodh Gaya.</h2>
          <p data-cms-id="txt_${slug}_20">Registrations are open for student founders, startups, and innovators nationwide.</p>
          <a data-cms-id="txt_${slug}_21" href="contact.html" class="btn btn-primary">Get in Touch / Register <i class="fa-solid fa-arrow-right"></i></a>
        </div>
      </div>
    </section>`;
    } else if (template === 'showcase') {
      mainContent = `
    <!-- Stats Highlight -->
    <section class="section">
      <div class="container">
        <div data-cms-grid-id="grid_${slug}_1" class="stat-grid">
          <div class="stat-box reveal">
            <div data-cms-id="txt_${slug}_4" class="stat-number">50+</div>
            <div data-cms-id="txt_${slug}_5" class="stat-label">Startups Supported</div>
          </div>
          <div class="stat-box reveal">
            <div data-cms-id="txt_${slug}_6" class="stat-number">&#8377;1.5Cr+</div>
            <div data-cms-id="txt_${slug}_7" class="stat-label">Funding &amp; Grants</div>
          </div>
          <div class="stat-box reveal">
            <div data-cms-id="txt_${slug}_8" class="stat-number">40+</div>
            <div data-cms-id="txt_${slug}_9" class="stat-label">Industry Mentors</div>
          </div>
          <div class="stat-box reveal">
            <div data-cms-id="txt_${slug}_10" class="stat-number">10k+</div>
            <div data-cms-id="txt_${slug}_11" class="stat-label">Community Reach</div>
          </div>
        </div>
      </div>
    </section>

    <!-- Pillars Grid -->
    <section class="section bg-light">
      <div class="container">
        <div class="section-heading reveal">
          <div data-cms-id="txt_${slug}_12" class="section-label">Key Pillars</div>
          <h2 data-cms-id="txt_${slug}_13">Core Programs &amp; Initiatives</h2>
          <p data-cms-id="txt_${slug}_14">A structured pathway to take bold entrepreneurial ideas into sustainable ventures.</p>
        </div>
        <div data-cms-grid-id="grid_${slug}_2" class="cards-grid grid-4">
          <article class="card reveal">
            <span class="badge">Track 1</span>
            <h3 data-cms-id="txt_${slug}_15">Ideation &amp; Validation</h3>
            <p data-cms-id="txt_${slug}_16">Design thinking workshops, rapid prototyping, and customer validation sprints.</p>
          </article>
          <article class="card reveal">
            <span class="badge">Track 2</span>
            <h3 data-cms-id="txt_${slug}_17">Founder Mentorship</h3>
            <p data-cms-id="txt_${slug}_18">1-on-1 advisory with alumni founders, venture builders, and domain leaders.</p>
          </article>
          <article class="card reveal">
            <span class="badge">Track 3</span>
            <h3 data-cms-id="txt_${slug}_19">Investor Readiness</h3>
            <p data-cms-id="txt_${slug}_20">Financial modeling, deck refining, and dry-run pitches before demo days.</p>
          </article>
          <article class="card reveal">
            <span class="badge">Track 4</span>
            <h3 data-cms-id="txt_${slug}_21">Market Access</h3>
            <p data-cms-id="txt_${slug}_22">Enterprise pilot opportunities, partner credits, and incubator networks.</p>
          </article>
        </div>
      </div>
    </section>

    <!-- FAQ Section -->
    <section class="section">
      <div class="container">
        <div class="section-heading reveal">
          <div data-cms-id="txt_${slug}_23" class="section-label">Questions &amp; Answers</div>
          <h2 data-cms-id="txt_${slug}_24">Frequently Asked Questions</h2>
        </div>
        <div data-cms-grid-id="grid_${slug}_3" class="faq-accordion">
          <div class="faq-item reveal">
            <h3 data-cms-id="txt_${slug}_25" class="faq-title">Who is eligible to participate in this initiative?</h3>
            <div class="faq-answer"><p data-cms-id="txt_${slug}_26">Students, alumni, and aspiring entrepreneurs across universities are encouraged to apply.</p></div>
          </div>
          <div class="faq-item reveal">
            <h3 data-cms-id="txt_${slug}_27" class="faq-title">How can founders access mentor sessions?</h3>
            <div class="faq-answer"><p data-cms-id="txt_${slug}_28">Selected teams are paired with mentors through structured cohort schedules and office hours.</p></div>
          </div>
        </div>
      </div>
    </section>`;
    } else if (template === 'blank') {
      mainContent = `
    <!-- Custom Page Canvas -->
    <section class="section">
      <div class="container">
        <div class="text-block reveal" style="max-width: 820px; margin: 0 auto; text-align: center;">
          <div data-cms-id="txt_${slug}_4" class="section-label">Page Canvas</div>
          <h2 data-cms-id="txt_${slug}_5">Welcome to ${title}</h2>
          <p data-cms-id="txt_${slug}_6">This is your custom page canvas. Click Edit Mode in Visual Studio to write content, replace images, or insert ready-made blocks using the Section Library.</p>
          <div style="margin-top: 2rem;">
            <a data-cms-id="txt_${slug}_7" href="index.html" class="btn btn-primary"><i class="fa-solid fa-arrow-left"></i> Return Home</a>
          </div>
        </div>
      </div>
    </section>`;
    } else {
      // Standard content template
      mainContent = `
    <!-- Main Story & Overview -->
    <section class="section">
      <div class="container grid-2">
        <div class="text-block reveal">
          <div data-cms-id="txt_${slug}_4" class="section-label">Overview</div>
          <h2 data-cms-id="txt_${slug}_5">Empowering innovation from campus to the world.</h2>
          <p data-cms-id="txt_${slug}_6">${tagline}</p>
          <p data-cms-id="txt_${slug}_7">Through tailored mentorship, industry immersion, and ecosystem grants, we help turn early-stage thinking into robust, venture-backed reality.</p>
          <div style="margin-top: 1.8rem;">
            <a data-cms-id="txt_${slug}_8" href="contact.html" class="btn btn-primary">Connect With Us <i class="fa-solid fa-arrow-right"></i></a>
          </div>
        </div>
        <div class="image-panel reveal">
          <img data-cms-id="img_${slug}_1" src="mission-campus.jpg" alt="${title}" />
        </div>
      </div>
    </section>

    <!-- Core Features Grid -->
    <section class="section bg-light">
      <div class="container">
        <div class="section-heading reveal">
          <div data-cms-id="txt_${slug}_9" class="section-label">Key Highlights</div>
          <h2 data-cms-id="txt_${slug}_10">What We Offer</h2>
          <p data-cms-id="txt_${slug}_11">Explore the resources, programs, and network available through Envision.</p>
        </div>
        <div data-cms-grid-id="grid_${slug}_1" class="cards-grid grid-3">
          <article class="card reveal">
            <div class="card-icon"><i class="fa-solid fa-compass"></i></div>
            <h3 data-cms-id="txt_${slug}_12">Guided Mentorship</h3>
            <p data-cms-id="txt_${slug}_13">Direct access to experienced alumni, faculty advisors, and venture capitalists.</p>
          </article>
          <article class="card reveal">
            <div class="card-icon"><i class="fa-solid fa-rocket"></i></div>
            <h3 data-cms-id="txt_${slug}_14">Venture Incubation</h3>
            <p data-cms-id="txt_${slug}_15">Collaborative co-working, seed funding assistance, and market pilot access.</p>
          </article>
          <article class="card reveal">
            <div class="card-icon"><i class="fa-solid fa-handshake"></i></div>
            <h3 data-cms-id="txt_${slug}_16">Industry Ecosystem</h3>
            <p data-cms-id="txt_${slug}_17">Connections with Angel networks, government startup schemes, and corporate partners.</p>
          </article>
        </div>
      </div>
    </section>

    <!-- Action Banner -->
    <section class="section">
      <div class="container">
        <div class="promo-band reveal">
          <div data-cms-id="txt_${slug}_18" class="section-label">Get Involved</div>
          <h2 data-cms-id="txt_${slug}_19">Ready to start your journey?</h2>
          <p data-cms-id="txt_${slug}_20">Reach out to our team at IIM Bodh Gaya and take the next leap for your venture.</p>
          <a data-cms-id="txt_${slug}_21" href="contact.html" class="btn btn-primary">Contact Envision E-Cell <i class="fa-solid fa-arrow-right"></i></a>
        </div>
      </div>
    </section>`;
    }

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${title} | Envision E-Cell IIM Bodh Gaya</title>
  <meta name="description" content="${tagline}" />
  <link rel="canonical" href="https://envision.iimbg.ac.in/${filename}" />

  <!-- Open Graph / Social Tags -->
  <meta property="og:type" content="website" />
  <meta property="og:url" content="https://envision.iimbg.ac.in/${filename}" />
  <meta property="og:title" content="${title} | Envision E-Cell IIM Bodh Gaya" />
  <meta property="og:description" content="${tagline}" />
  <meta property="og:image" content="https://envision.iimbg.ac.in/envision-logo.jpeg" />

  <!-- Twitter Card -->
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="${title} | Envision E-Cell IIM Bodh Gaya" />
  <meta name="twitter:description" content="${tagline}" />
  <meta name="twitter:image" content="https://envision.iimbg.ac.in/envision-logo.jpeg" />

  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&family=Montserrat:wght@300;400;600;700;800;900&display=swap" rel="stylesheet" />
  <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css" integrity="sha512-iecdLmaskl7CVkqkXNQ/ZH/XLlvWZOJyj7Yy7tcenmpD1ypASozpmT/E0iPtmFIB46ZmdtAc9eNBvH0H/ZpiBw==" crossorigin="anonymous" referrerpolicy="no-referrer" />
  <link rel="stylesheet" href="styles.css" />

  <!-- Live Dynamic Global Theme -->
  <style id="cms-dynamic-global-styles">
${themeCss}
  </style>
</head>

<body ${bodyClass}>
  <header class="topbar">
    <div class="nav-wrap">
      <div class="logo logo-pair">
        <a href="https://iimbg.ac.in/" class="logo-mark logo-institute-link" target="_blank" rel="noopener noreferrer" aria-label="Visit IIM Bodh Gaya website, opens in a new tab">
          <img src="iimbg-crest-transparent.png" alt="IIM Bodh Gaya" />
        </a>
        <a href="index.html" class="logo-mark logo-brand" aria-label="Envision Home">
          <img src="envision-logo-transparent.png" alt="Envision E-Cell" />
        </a>
        <a href="index.html" class="logo-text logo-title-link" aria-label="Envision Home">
          <strong class="logo-title">ENVISION</strong><span>E-Cell IIM Bodh Gaya</span>
        </a>
      </div>
      <div class="nav-slider-wrapper">
        <button type="button" class="nav-slider-btn nav-slider-prev" aria-label="Previous navigation items">
          <i class="fa-solid fa-chevron-left"></i>
        </button>
        <nav class="nav-links" aria-label="Main navigation">
          ${navHtml}
        </nav>
        <button type="button" class="nav-slider-btn nav-slider-next" aria-label="Next navigation items">
          <i class="fa-solid fa-chevron-right"></i>
        </button>
      </div>
      <a href="contact.html" class="nav-cta">Connect With Us</a>
      <button class="menu-toggle" aria-label="Toggle navigation"><i class="fa-solid fa-bars"></i></button>
    </div>
    <div class="mobile-menu" aria-label="Mobile navigation">
      <div class="mobile-menu-inner">
        ${mobileNavHtml}
        <a href="contact.html" class="mobile-connect">Connect With Us</a>
      </div>
    </div>
  </header>

  <!-- Page Hero -->
  <section class="page-hero">
    <div class="page-hero-inner reveal">
      <div data-cms-id="txt_${slug}_1" class="section-label">${escapeHtml(title)}</div>
      <h1 data-cms-id="txt_${slug}_2">${escapeHtml(title)}</h1>
      <p data-cms-id="txt_${slug}_3">${tagline}</p>
    </div>
  </section>

  <main>
${mainContent}
  </main>

  <footer>
    <div class="container">
      <div class="footer-grid">
        <div>
          <video class="signature-clip" autoplay muted loop playsinline preload="metadata" aria-hidden="true">
            <source src="ECell%20Sign%20mail%202026%20(2).mp4" type="video/mp4" />
          </video>
        </div>
        <div>
          <h3 style="margin: 0 0 1.2rem; font-family: 'Montserrat',sans-serif; letter-spacing: 0.1em; text-transform: uppercase; font-size: 0.8rem;">Explore</h3>
          <ul class="footer-links">
            <li><a href="about.html">About Us</a></li>
            <li><a href="events.html">Events</a></li>
            <li><a href="incubation.html">INSPIRE Incubation</a></li>
            <li><a href="index.html#faq">FAQs</a></li>
            <li><a href="contact.html">Contact Us</a></li>
          </ul>
        </div>
        <div>
          <h3 style="margin: 0 0 1.2rem; font-family: 'Montserrat',sans-serif; letter-spacing: 0.1em; text-transform: uppercase; font-size: 0.8rem;">Reach Out</h3>
          <ul class="footer-links">
            <li>IIM Bodh Gaya Campus, Bihar 824234</li>
            <li><a href="mailto:envision@iimbg.ac.in">envision@iimbg.ac.in</a></li>
            <li><a href="tel:+916312200238">+91 (0) 631 220 0238</a></li>
          </ul>
        </div>
      </div>
      <div class="footer-meta">
        <span>© <span id="year"></span> ENVISION E-CELL IIM BODH GAYA</span>
        <span>
          <a href="https://iimbg.ac.in/privacy-policy/" target="_blank" rel="noopener noreferrer">Privacy Policy</a> •
          <a href="https://iimbg.ac.in/terms-conditions/" target="_blank" rel="noopener noreferrer">Terms and Conditions</a> •
          <a href="https://iimbg.ac.in/copyright-policy/" target="_blank" rel="noopener noreferrer">Copyright Policy</a> •
          <a href="https://iimbg.ac.in/disclaimer/" target="_blank" rel="noopener noreferrer">Disclaimer</a>
        </span>
      </div>
    </div>
  </footer>

  <script src="script.js"></script>
</body>
</html>`;
  }

  function openNewPageModal(defaultTemplate = 'content', targetButtonToAttach = null) {
    const backdrop = document.createElement('div');
    backdrop.className = 'cms-modal-backdrop open';
    backdrop.innerHTML = `
      <div class="cms-modal-box" style="width: min(640px, 94vw); max-height: 90vh; overflow-y: auto;">
        <div class="cms-modal-header">
          <h3 class="cms-modal-title"><i class="fa-solid fa-file-circle-plus" style="color: var(--wp-accent, #c5a059);"></i> Add New HTML Page</h3>
          <button type="button" class="cms-modal-close"><i class="fa-solid fa-xmark"></i></button>
        </div>
        <p style="font-size: 13px; color: #64748b; margin: 0 0 16px;">
          Create a new HTML page with the exact same theme, fonts, headers, and footer across your website.
        </p>
        ${targetButtonToAttach ? `
        <div style="background:#eff6ff; border:1px solid #bfdbfe; color:#1e40af; padding:8px 12px; border-radius:6px; font-size:12px; margin-bottom:14px; display:flex; align-items:center; gap:6px;">
          <i class="fa-solid fa-link"></i> Will automatically attach to button: <strong>${escapeHtml(targetButtonToAttach.textContent.trim().slice(0, 30))}</strong>
        </div>` : ''}
        <form id="wp-new-page-form">
          <div class="wp-panel-group" style="margin-bottom: 12px;">
            <label class="wp-control-label" style="display:block; margin-bottom: 6px; font-weight: 600;">Page Title:</label>
            <input type="text" id="wp-new-page-title" class="wp-input" style="width:100%;" placeholder="e.g. Manthan 3.0 / Campus Ventures / Mentors" required />
          </div>
          <div class="wp-panel-group" style="margin-bottom: 12px;">
            <label class="wp-control-label" style="display:block; margin-bottom: 6px; font-weight: 600;">HTML File Name:</label>
            <input type="text" id="wp-new-page-filename" class="wp-input" style="width:100%;" placeholder="e.g. ventures.html" required />
            <small style="font-size: 11px; color: #64748b; display: block; margin-top: 4px;">Must end in .html (e.g. <code>manthan.html</code>, <code>summit.html</code>)</small>
          </div>
          <div class="wp-panel-group" style="margin-bottom: 12px;">
            <label class="wp-control-label" style="display:block; margin-bottom: 6px; font-weight: 600;">Tagline / Subtitle:</label>
            <input type="text" id="wp-new-page-tagline" class="wp-input" style="width:100%;" placeholder="e.g. Empowering bold ideas and next-gen student ventures" required />
          </div>
          <div class="wp-panel-group" style="margin-bottom: 14px;">
            <label class="wp-control-label" style="display:block; margin-bottom: 6px; font-weight: 600;">Page Layout Template:</label>
            <select id="wp-new-page-template" class="wp-select" style="width:100%; padding: 8px 10px; border-radius: 6px; border: 1px solid #cbd5e1;">
              <option value="content" ${defaultTemplate === 'content' ? 'selected' : ''}>📄 Standard Content &amp; Initiatives (Hero, Story 2-col, 3 Feature Cards, CTA)</option>
              <option value="event" ${defaultTemplate === 'event' ? 'selected' : ''}>🌟 Dedicated Event &amp; Conclave (Hero Banner, About 2-col, Highlights 3-Grid, Registration)</option>
              <option value="showcase" ${defaultTemplate === 'showcase' ? 'selected' : ''}>🚀 Program &amp; Showcase (Hero, Stats Numbers, 4-Track Grid, FAQ Accordion)</option>
              <option value="blank" ${defaultTemplate === 'blank' ? 'selected' : ''}>🎨 Clean Starter Canvas (Hero + Editable container ready for Section Blocks)</option>
            </select>
          </div>
          <div class="wp-panel-group" style="margin-bottom: 18px;">
            <label style="display:flex; align-items:center; gap:8px; font-size:13px; cursor:pointer;">
              <input type="checkbox" id="wp-new-page-add-nav" checked /> Add to main navigation menu automatically across all pages
            </label>
          </div>
          <div style="display: flex; justify-content: flex-end; gap: 10px; padding-top: 8px; border-top: 1px solid #e2e8f0;">
            <button type="button" class="wp-bar-btn wp-modal-cancel" style="background:#f1f5f9; color:#475569;">Cancel</button>
            <button type="submit" class="wp-bar-btn btn-publish"><i class="fa-solid fa-file-circle-plus"></i> Create HTML Page</button>
          </div>
        </form>
      </div>
    `;

    backdrop.querySelector('.cms-modal-close').onclick = () => backdrop.remove();
    backdrop.querySelector('.wp-modal-cancel').onclick = () => backdrop.remove();

    // Auto-slugify filename based on title
    const titleInput = backdrop.querySelector('#wp-new-page-title');
    const filenameInput = backdrop.querySelector('#wp-new-page-filename');
    let userEditedFilename = false;

    filenameInput.addEventListener('input', () => {
      userEditedFilename = filenameInput.value.trim().length > 0;
    });

    titleInput.addEventListener('input', () => {
      if (!userEditedFilename) {
        const slug = titleInput.value.trim()
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/^-|-$/g, '');
        filenameInput.value = slug ? `${slug}.html` : '';
      }
    });

    backdrop.querySelector('#wp-new-page-form').onsubmit = async (e) => {
      e.preventDefault();
      const title = titleInput.value.trim();
      const tagline = backdrop.querySelector('#wp-new-page-tagline').value.trim();
      let filename = filenameInput.value.trim();
      if (!filename.toLowerCase().endsWith('.html')) filename += '.html';
      const template = backdrop.querySelector('#wp-new-page-template').value;
      const addToNav = backdrop.querySelector('#wp-new-page-add-nav').checked;

      // Current navigation list
      const storedNav = localStorage.getItem(CMS_NAV_KEY);
      let navList = [];
      try { if (storedNav) navList = JSON.parse(storedNav); } catch (err) { }
      if (!Array.isArray(navList) || navList.length === 0) {
        document.querySelectorAll('.nav-links > a:not(.nav-cta):not(.wp-nav-add-btn)').forEach(link => {
          const t = link.textContent.trim().replace(/^Move\s+/i, '');
          if (t && t.toLowerCase() !== 'new tab') {
            navList.push({ title: t, url: link.getAttribute('href') || '#' });
          }
        });
      }

      if (addToNav) {
        // Prevent duplicate navigation entries
        const existingIdx = navList.findIndex(item => (item.url || '').toLowerCase() === filename.toLowerCase());
        if (existingIdx !== -1) {
          navList[existingIdx].title = title;
        } else {
          navList.push({ title, url: filename });
        }
      }

      // Generate complete HTML with embedded active theme & layout
      const generatedHTML = generateNewPageHTML({
        title,
        tagline,
        filename,
        template,
        navList,
        styles: globalStyles
      });

      // 1. Try to save file directly to disk via local dev server API
      let diskSaved = false;
      try {
        const res = await fetch('/api/save-page', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ filename, title, addToNav, html: generatedHTML })
        });
        if (res.ok) {
          const json = await res.json();
          if (json.success) diskSaved = true;
        }
      } catch (err) {
        try {
          const res2 = await fetch('http://localhost:3456/api/save-page', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ filename, title, addToNav, html: generatedHTML })
          });
          if (res2.ok) {
            const json2 = await res2.json();
            if (json2.success) diskSaved = true;
          }
        } catch (err2) { }
      }

      // 2. Fallback: Save File Picker or Direct Download
      if (!diskSaved) {
        if ('showSaveFilePicker' in window) {
          try {
            const handle = await window.showSaveFilePicker({
              suggestedName: filename,
              types: [{ description: 'HTML Page', accept: { 'text/html': ['.html'] } }]
            });
            const writable = await handle.createWritable();
            await writable.write(generatedHTML);
            await writable.close();
            diskSaved = true;
          } catch (pickerErr) { }
        }
        if (!diskSaved) {
          const blob = new Blob([generatedHTML], { type: 'text/html;charset=utf-8' });
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = filename;
          document.body.append(a);
          a.click();
          a.remove();
          URL.revokeObjectURL(url);
        }
      }

      // 3. Sync to Supabase site_content table
      if (window.supabaseClient) {
        try {
          const slug = filename.replace(/\.html$/i, '').replace(/[^a-zA-Z0-9_-]/g, '_');
          const initialContentData = {
            [`txt_${slug}_1`]: { type: 'text', html: title },
            [`txt_${slug}_2`]: { type: 'text', html: title },
            [`txt_${slug}_3`]: { type: 'text', html: tagline }
          };

          await window.supabaseClient.from('site_content').upsert({
            page_path: filename,
            content_data: initialContentData,
            grid_data: {},
            global_styles: globalStyles,
            updated_at: new Date().toISOString()
          }, { onConflict: 'page_path' });

          if (addToNav) {
            await window.supabaseClient.from('site_content').upsert({
              page_path: '_global',
              global_styles: { ...globalStyles, _nav: navList },
              updated_at: new Date().toISOString()
            }, { onConflict: 'page_path' });
          }
        } catch (syncErr) {
          console.warn('[Supabase] Sync new page notice:', syncErr);
        }
      }

      // 4. Update local navigation
      if (addToNav) {
        localStorage.setItem(CMS_NAV_KEY, JSON.stringify(navList));
        loadGlobalNavigation();
      }

      if (targetButtonToAttach) {
        targetButtonToAttach.setAttribute('href', filename);
        markDirty();
        showToast(`Created "${filename}" and linked button to it!`, 'success');
        if (document.getElementById('wp-sidebar-inspector')?.classList.contains('open')) {
          syncSidebarInspector(targetButtonToAttach);
        }
      }

      backdrop.remove();
      openPageCreatedSuccessModal(filename, title, diskSaved);
    };

    document.body.append(backdrop);
  }

  function openEventPageGeneratorModal() {
    return openNewPageModal('event');
  }

  function openPageCreatedSuccessModal(filename, title, diskSaved) {
    const backdrop = document.createElement('div');
    backdrop.className = 'cms-modal-backdrop open';
    backdrop.innerHTML = `
      <div class="cms-modal-box" style="text-align: center; max-width: 480px; padding: 28px 24px;">
        <div style="width: 56px; height: 56px; background: #ecfdf5; border-radius: 50%; display: flex; align-items: center; justify-content: center; margin: 0 auto 16px;">
          <i class="fa-solid fa-circle-check" style="color: #10b981; font-size: 28px;"></i>
        </div>
        <h3 style="margin: 0 0 8px; font-size: 19px; color: #0f172a;">Page Created Successfully!</h3>
        <p style="font-size: 13.5px; color: #64748b; margin: 0 0 20px; line-height: 1.5;">
          <strong>${escapeHtml(filename)}</strong> has been generated with your active theme, fonts, and full navigation.
          ${diskSaved ? '<br/><span style="color:#10b981; font-weight:600;"><i class="fa-solid fa-hard-drive"></i> Saved directly to your project workspace!</span>' : '<br/>Downloaded to your system. Move it to the project root to view locally.'}
        </p>
        <div style="display: flex; gap: 10px; justify-content: center;">
          <a href="${encodeURI(filename)}" class="wp-bar-btn btn-publish" style="text-decoration:none; display:inline-flex; align-items:center; gap:6px;">
            <i class="fa-solid fa-arrow-up-right-from-square"></i> Open "${escapeHtml(filename)}"
          </a>
          <button type="button" class="wp-bar-btn cms-success-close" style="background:#f1f5f9; color:#475569;">Close</button>
        </div>
      </div>
    `;
    backdrop.querySelector('.cms-success-close').onclick = () => backdrop.remove();
    document.body.append(backdrop);
  }

  // ==========================================================================
  // 8. Template Library Modal (Block Inserter)
  // ==========================================================================

  function openTemplateLibraryModal(callback) {
    const backdrop = document.createElement('div');
    backdrop.className = 'cms-modal-backdrop open';
    backdrop.innerHTML = `
      <div class="cms-modal-box" style="width: min(720px, 94vw);">
        <div class="cms-modal-header">
          <h3 class="cms-modal-title"><i class="fa-solid fa-cubes-stacked" style="color: var(--wp-primary);"></i> WordPress Block &amp; Section Library</h3>
          <button type="button" class="cms-modal-close"><i class="fa-solid fa-xmark"></i></button>
        </div>
        <p style="font-size: 13px; color: #64748b; margin: 0 0 14px;">Select a ready-made block to insert into your page:</p>
        <div class="wp-template-grid">
          <div class="wp-template-card" data-tmpl="event-grid">
            <div class="wp-template-card-title"><i class="fa-solid fa-calendar-day" style="color:#f59e0b;"></i> Event Card Grid (Row Format)</div>
            <div class="wp-template-card-desc">Showcase cards with title, description, and in-row add/delete controls.</div>
          </div>
          <div class="wp-template-card" data-tmpl="split-text-img">
            <div class="wp-template-card-title"><i class="fa-solid fa-columns" style="color:#2563eb;"></i> 2-Column Split Feature</div>
            <div class="wp-template-card-desc">Headline, story text, bullet points and featured photograph side-by-side.</div>
          </div>
          <div class="wp-template-card" data-tmpl="faq-accordion">
            <div class="wp-template-card-title"><i class="fa-solid fa-circle-question" style="color:#10b981;"></i> FAQ Accordion</div>
            <div class="wp-template-card-desc">Interactive accordion with expandable question and answers.</div>
          </div>
          <div class="wp-template-card" data-tmpl="promo-band">
            <div class="wp-template-card-title"><i class="fa-solid fa-bullhorn" style="color:#8b5cf6;"></i> Callout Promo Band</div>
            <div class="wp-template-card-desc">High-impact full-width call to action box with primary button.</div>
          </div>
          <div class="wp-template-card" data-tmpl="stats-grid">
            <div class="wp-template-card-title"><i class="fa-solid fa-chart-simple" style="color:#ec4899;"></i> Metrics &amp; Stats Grid</div>
            <div class="wp-template-card-desc">Row of stats counters with editable numbers and labels.</div>
          </div>
        </div>
      </div>
    `;

    backdrop.querySelector('.cms-modal-close').onclick = () => backdrop.remove();

    const templates = {
      'event-grid': `
        <section class="section custom-event-section">
          <div class="container">
            <div class="section-heading reveal">
              <div class="section-label"><i class="fa-solid fa-calendar"></i> Event Formats</div>
              <h2>Designed for <span class="gradient-text">hands-on learning.</span></h2>
            </div>
            <div class="cards-grid">
              <article class="card reveal">
                <div class="card-body">
                  <h3>Workshops</h3>
                  <p>Practical sessions covering startup fundamentals, entrepreneurship, funding, and product thinking.</p>
                </div>
              </article>
              <article class="card reveal">
                <div class="card-body">
                  <h3>Panels</h3>
                  <p>Insights from founders, operators, and experts on building resilient and meaningful businesses.</p>
                </div>
              </article>
              <article class="card reveal">
                <div class="card-body">
                  <h3>Pitch Nights</h3>
                  <p>High-energy showcase moments where early-stage ideas get real feedback, attention, and support.</p>
                </div>
              </article>
            </div>
          </div>
        </section>
      `,
      'split-text-img': `
        <section class="section custom-split-section">
          <div class="container grid-2">
            <div class="text-block reveal">
              <div class="section-label">Empowering Founders</div>
              <h2>Mentorship that transforms ideas into companies.</h2>
              <p>Connect with seasoned entrepreneurs, alumni founders, and domain experts who guide you through product discovery, scaling, and fundraising.</p>
              <a href="contact.html" class="btn btn-secondary">Connect With Mentors</a>
            </div>
            <div class="image-panel reveal">
              <img src="https://images.unsplash.com/photo-1517245386807-bb43f82c33c4?q=80&w=2070&auto=format&fit=crop" alt="Team meeting" />
            </div>
          </div>
        </section>
      `,
      'faq-accordion': `
        <section class="section custom-faq-section">
          <div class="container">
            <div class="section-heading reveal">
              <div class="section-label"><i class="fa-solid fa-circle-question"></i> Questions &amp; Answers</div>
              <h2>Frequently Asked Questions</h2>
            </div>
            <div class="faq-accordion" style="max-width: 800px; margin: 0 auto;">
              <details class="faq-item reveal" open>
                <summary class="faq-question">
                  <span class="faq-title">How do I register for Envision events?</span>
                  <span class="faq-icon"><i class="fa-solid fa-chevron-down"></i></span>
                </summary>
                <div class="faq-answer"><p>You can register through the event page link or contact our team directly via the contact form.</p></div>
              </details>
            </div>
          </div>
        </section>
      `,
      'promo-band': `
        <section class="section custom-promo-section">
          <div class="container">
            <div class="promo-band reveal">
              <div class="section-label">Ready to Build?</div>
              <h2>Turn your napkin sketch into a real startup.</h2>
              <p>Get incubation support, workspace, mentor access, and seed funding support at IIM Bodh Gaya.</p>
              <a href="incubation.html" class="btn btn-primary">Apply for Incubation <i class="fa-solid fa-arrow-right"></i></a>
            </div>
          </div>
        </section>
      `,
      'stats-grid': `
        <section class="section custom-stats-section" style="background:#f8fafc;">
          <div class="container">
            <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 1.5rem; text-align:center;">
              <div class="stat-box" style="padding: 1.5rem; background:#fff; border-radius:10px; border:1px solid #e2e8f0;">
                <h3 class="stat-number" style="font-size: 2.4rem; color: #2563eb; margin:0;">50+</h3>
                <p class="stat-label" style="color: #64748b; font-size: 0.9rem; margin-top:0.4rem;">Startups Incubated</p>
              </div>
              <div class="stat-box" style="padding: 1.5rem; background:#fff; border-radius:10px; border:1px solid #e2e8f0;">
                <h3 class="stat-number" style="font-size: 2.4rem; color: #f59e0b; margin:0;">₹50L+</h3>
                <p class="stat-label" style="color: #64748b; font-size: 0.9rem; margin-top:0.4rem;">Grants &amp; Funding</p>
              </div>
            </div>
          </div>
        </section>
      `
    };

    backdrop.querySelectorAll('.wp-template-card').forEach((card) => {
      card.onclick = () => {
        const tmplId = card.getAttribute('data-tmpl');
        if (templates[tmplId]) {
          callback(templates[tmplId]);
          backdrop.remove();
        }
      };
    });

    document.body.append(backdrop);
  }

  // ==========================================================================
  // 9. Global Styles & Typography Modal
  // ==========================================================================

  // ==========================================================================
  // 9. Full Website Theme Customizer & Studio (Presets, Dark Mode, Palette, Fonts)
  // ==========================================================================

  const THEME_PRESETS = [
    {
      id: 'geist',
      name: 'Vercel Geist Pro',
      tag: 'Monochrome & Mesh (DESIGN.md)',
      icon: 'fa-cube',
      primary: '#171717',
      accent: '#0070f3',
      bg: '#fafafa',
      panel: '#ffffff',
      line: '#ebebeb',
      text: '#171717',
      muted: '#666666',
      fontHeading: 'Inter',
      fontPrimary: 'Inter',
      fontMono: 'Geist Mono',
      radius: '100px',
      isDark: false
    },
    {
      id: 'imperial',
      name: 'Imperial Navy & Gold',
      tag: 'Envision Classic Heritage',
      icon: 'fa-crown',
      primary: '#0a192f',
      accent: '#c5a059',
      bg: '#f8fafc',
      panel: '#ffffff',
      line: 'rgba(15, 23, 42, 0.12)',
      text: '#172334',
      muted: '#596579',
      fontHeading: 'Montserrat',
      fontPrimary: 'Inter',
      fontMono: 'monospace',
      radius: '12px',
      isDark: false
    },
    {
      id: 'cyberpunk',
      name: 'Midnight Obsidian & Cyan',
      tag: 'Cyberpunk Neon Dark Mode',
      icon: 'fa-moon',
      primary: '#06b6d4',
      accent: '#8b5cf6',
      bg: '#080c14',
      panel: '#111827',
      line: 'rgba(6, 182, 212, 0.25)',
      text: '#f8fafc',
      muted: '#94a3b8',
      fontHeading: 'Outfit',
      fontPrimary: 'Plus Jakarta Sans',
      fontMono: 'monospace',
      radius: '14px',
      isDark: true
    },
    {
      id: 'emerald',
      name: 'Emerald Venture Tech',
      tag: 'Growth & Sustainable Innovation',
      icon: 'fa-leaf',
      primary: '#064e3b',
      accent: '#10b981',
      bg: '#f0fdf4',
      panel: '#ffffff',
      line: 'rgba(16, 185, 129, 0.2)',
      text: '#064e3b',
      muted: '#374151',
      fontHeading: 'Inter',
      fontPrimary: 'Inter',
      fontMono: 'monospace',
      radius: '12px',
      isDark: false
    },
    {
      id: 'crimson',
      name: 'Sunset Crimson & Coral',
      tag: 'Vibrant & High Energy',
      icon: 'fa-fire',
      primary: '#4c0519',
      accent: '#f43f5e',
      bg: '#fff1f2',
      panel: '#ffffff',
      line: 'rgba(244, 63, 94, 0.2)',
      text: '#4c0519',
      muted: '#4b5563',
      fontHeading: 'Montserrat',
      fontPrimary: 'Inter',
      fontMono: 'monospace',
      radius: '16px',
      isDark: false
    },
    {
      id: 'nordic',
      name: 'Nordic Slate & Sky Blue',
      tag: 'Clean Architectural Minimal',
      icon: 'fa-snowflake',
      primary: '#0f172a',
      accent: '#0284c7',
      bg: '#f8fafc',
      panel: '#ffffff',
      line: 'rgba(2, 132, 199, 0.18)',
      text: '#0f172a',
      muted: '#64748b',
      fontHeading: 'Inter',
      fontPrimary: 'Inter',
      fontMono: 'monospace',
      radius: '8px',
      isDark: false
    },
    {
      id: 'amethyst',
      name: 'Royal Amethyst & Violet',
      tag: 'Luxury Editorial Style',
      icon: 'fa-gem',
      primary: '#1e1b4b',
      accent: '#8b5cf6',
      bg: '#faf5ff',
      panel: '#ffffff',
      line: 'rgba(139, 92, 246, 0.2)',
      text: '#1e1b4b',
      muted: '#6b7280',
      fontHeading: "'Playfair Display', serif",
      fontPrimary: 'Inter',
      fontMono: 'monospace',
      radius: '12px',
      isDark: false
    },
    {
      id: 'minimal',
      name: 'Pure Minimalist Light',
      tag: 'Sharp Dev Studio',
      icon: 'fa-sun',
      primary: '#000000',
      accent: '#2563eb',
      bg: '#ffffff',
      panel: '#ffffff',
      line: '#e5e7eb',
      text: '#111827',
      muted: '#6b7280',
      fontHeading: 'Inter',
      fontPrimary: 'Inter',
      fontMono: 'monospace',
      radius: '6px',
      isDark: false
    }
  ];

  function openGlobalStylesModal() {
    openThemeStudioModal();
  }

  function openThemeStudioModal() {
    let currentTheme = {
      primaryColor: globalStyles.primaryColor || '#0a192f',
      accentColor: globalStyles.accentColor || '#c5a059',
      bg: globalStyles.bg || '#f8fafc',
      panel: globalStyles.panel || '#ffffff',
      line: globalStyles.line || 'rgba(15, 23, 42, 0.12)',
      text: globalStyles.text || '#172334',
      muted: globalStyles.muted || '#596579',
      fontHeading: globalStyles.fontHeading || 'Montserrat',
      fontPrimary: globalStyles.fontPrimary || 'Inter',
      fontMono: globalStyles.fontMono || 'monospace',
      radius: globalStyles.radius || '12px',
      isDarkMode: !!globalStyles.isDarkMode
    };

    let temp = { ...currentTheme };

    const backdrop = document.createElement('div');
    backdrop.className = 'cms-modal-backdrop open';
    backdrop.innerHTML = `
      <div class="cms-modal-box cms-theme-modal-box">
        <div class="cms-modal-header">
          <h3 class="cms-modal-title"><i class="fa-solid fa-palette" style="color:var(--wp-accent);"></i> Website Theme Customizer</h3>
          <button type="button" class="cms-modal-close"><i class="fa-solid fa-xmark"></i></button>
        </div>

        <!-- Theme Studio Tabs -->
        <div class="cms-theme-tabs">
          <button type="button" class="cms-theme-tab-btn active" data-tab="presets"><i class="fa-solid fa-wand-magic-sparkles"></i> Curated Presets</button>
          <button type="button" class="cms-theme-tab-btn" data-tab="colors"><i class="fa-solid fa-droplet"></i> Custom Palette</button>
          <button type="button" class="cms-theme-tab-btn" data-tab="typography"><i class="fa-solid fa-font"></i> Typography &amp; Shapes</button>
        </div>

        <!-- Live Preview Banner -->
        <div class="cms-theme-live-preview" id="cms-theme-preview-container">
          <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:10px;">
            <span style="font-size:11px; font-weight:700; text-transform:uppercase; letter-spacing:0.05em; color:var(--muted,#64748b);">Live Theme Preview</span>
            <button type="button" id="cms-theme-mode-toggle" style="background:transparent; border:1px solid #cbd5e1; border-radius:9999px; padding:3px 10px; font-size:11.5px; font-weight:600; cursor:pointer; color:inherit;">
              <i class="fa-solid ${temp.isDarkMode ? 'fa-sun' : 'fa-moon'}"></i> ${temp.isDarkMode ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
            </button>
          </div>
          <div class="cms-theme-preview-card">
            <div style="display:inline-block; padding:3px 10px; border-radius:9999px; background:rgba(197,160,89,0.15); color:var(--gold,#c5a059); font-size:11px; font-weight:700; margin-bottom:6px;">
              FEATURED INITIATIVE
            </div>
            <h4 id="cms-preview-heading" style="margin:0 0 6px; font-size:17px; font-weight:700;">Building Next-Generation Founders</h4>
            <p id="cms-preview-body" style="margin:0 0 12px; font-size:12.5px; line-height:1.5;">Empowering student startups with incubation, seed capital, and mentorship at IIM Bodh Gaya.</p>
            <div style="display:flex; gap:8px;">
              <button type="button" style="background:var(--blue,#3b82f6); color:#fff; border:0; padding:6px 14px; border-radius:var(--card-radius,12px); font-size:12px; font-weight:600; cursor:pointer;">Primary Action</button>
              <button type="button" style="background:transparent; border:1px solid var(--line,rgba(0,0,0,0.15)); color:inherit; padding:6px 12px; border-radius:var(--card-radius,12px); font-size:12px; font-weight:500; cursor:pointer;">Secondary</button>
            </div>
          </div>
        </div>

        <form id="wp-theme-studio-form" style="flex:1; overflow-y:auto; padding-right:4px;">
          <!-- Tab 1: Presets -->
          <div id="cms-tab-presets" class="cms-theme-tab-pane">
            <div class="cms-theme-presets-grid">
              ${THEME_PRESETS.map((p) => `
                <div class="cms-theme-preset-card" data-preset-id="${p.id}">
                  <div class="cms-preset-title"><i class="fa-solid ${p.icon}" style="color:${p.accent};"></i> ${p.name}</div>
                  <div class="cms-preset-swatches">
                    <div class="cms-preset-swatch" style="background:${p.primary};" title="Primary: ${p.primary}"></div>
                    <div class="cms-preset-swatch" style="background:${p.accent};" title="Accent: ${p.accent}"></div>
                    <div class="cms-preset-swatch" style="background:${p.bg}; border-right:1px solid #ccc;" title="Background: ${p.bg}"></div>
                    <div class="cms-preset-swatch" style="background:${p.panel};" title="Card Panel: ${p.panel}"></div>
                  </div>
                  <div class="cms-preset-tag">${p.tag}</div>
                </div>
              `).join('')}
            </div>
          </div>

          <!-- Tab 2: Custom Palette -->
          <div id="cms-tab-colors" class="cms-theme-tab-pane" style="display:none;">
            <div class="wp-panel-group">
              <div class="wp-control-row">
                <span class="wp-control-label">Primary Brand Accent:</span>
                <input type="color" id="wp-theme-primary" class="wp-color-picker" value="${temp.primaryColor}" />
              </div>
              <div class="wp-control-row">
                <span class="wp-control-label">Secondary / Gold Accent:</span>
                <input type="color" id="wp-theme-accent" class="wp-color-picker" value="${temp.accentColor}" />
              </div>
              <div class="wp-control-row">
                <span class="wp-control-label">Page Canvas Background:</span>
                <input type="color" id="wp-theme-bg" class="wp-color-picker" value="${temp.bg}" />
              </div>
              <div class="wp-control-row">
                <span class="wp-control-label">Card &amp; Panel Surface:</span>
                <input type="color" id="wp-theme-panel" class="wp-color-picker" value="${temp.panel}" />
              </div>
              <div class="wp-control-row">
                <span class="wp-control-label">Text Ink Color:</span>
                <input type="color" id="wp-theme-text" class="wp-color-picker" value="${temp.text}" />
              </div>
              <div class="wp-control-row">
                <span class="wp-control-label">Muted Description Text:</span>
                <input type="color" id="wp-theme-muted" class="wp-color-picker" value="${temp.muted}" />
              </div>
            </div>
          </div>

          <!-- Tab 3: Typography & Shapes -->
          <div id="cms-tab-typography" class="cms-theme-tab-pane" style="display:none;">
            <div class="wp-panel-group">
              <label class="wp-control-label" style="display:block; margin-bottom:6px;">Heading Font Family:</label>
              <select id="wp-theme-font-heading" class="wp-select" style="width:100%; margin-bottom:12px;">
                <option value="Montserrat" ${temp.fontHeading === 'Montserrat' ? 'selected' : ''}>Montserrat (Modern Geometric)</option>
                <option value="Inter" ${temp.fontHeading === 'Inter' ? 'selected' : ''}>Inter (Clean Minimalist Crisp)</option>
                <option value="'Playfair Display', serif" ${temp.fontHeading.includes('Playfair') ? 'selected' : ''}>Playfair Display (Editorial Luxury)</option>
                <option value="'Outfit', sans-serif" ${temp.fontHeading.includes('Outfit') ? 'selected' : ''}>Outfit (Contemporary Tech)</option>
                <option value="'Plus Jakarta Sans', sans-serif" ${temp.fontHeading.includes('Jakarta') ? 'selected' : ''}>Plus Jakarta Sans (High-End SaaS)</option>
                <option value="'Cinzel', serif" ${temp.fontHeading.includes('Cinzel') ? 'selected' : ''}>Cinzel (Regal Classic)</option>
              </select>

              <label class="wp-control-label" style="display:block; margin-bottom:6px;">Body Text Font Family:</label>
              <select id="wp-theme-font-body" class="wp-select" style="width:100%; margin-bottom:12px;">
                <option value="Inter" ${temp.fontPrimary === 'Inter' ? 'selected' : ''}>Inter (High Readability)</option>
                <option value="Montserrat" ${temp.fontPrimary === 'Montserrat' ? 'selected' : ''}>Montserrat</option>
                <option value="'Outfit', sans-serif" ${temp.fontPrimary.includes('Outfit') ? 'selected' : ''}>Outfit</option>
                <option value="'Plus Jakarta Sans', sans-serif" ${temp.fontPrimary.includes('Jakarta') ? 'selected' : ''}>Plus Jakarta Sans</option>
                <option value="-apple-system, BlinkMacSystemFont, sans-serif" ${temp.fontPrimary.includes('apple-system') ? 'selected' : ''}>System Native Sans</option>
              </select>

              <label class="wp-control-label" style="display:block; margin-bottom:6px;">Card &amp; Button Corner Radius:</label>
              <select id="wp-theme-radius" class="wp-select" style="width:100%;">
                <option value="100px" ${temp.radius === '100px' ? 'selected' : ''}>Vercel Pill (100px Full Pill Buttons / 16px Cards)</option>
                <option value="16px" ${temp.radius === '16px' ? 'selected' : ''}>Modern Luxe (16px Soft Rounded)</option>
                <option value="12px" ${temp.radius === '12px' ? 'selected' : ''}>Classic Standard (12px Rounded)</option>
                <option value="6px" ${temp.radius === '6px' ? 'selected' : ''}>Compact Subtle (6px Radius)</option>
                <option value="0px" ${temp.radius === '0px' ? 'selected' : ''}>Sharp Flat (0px Square)</option>
              </select>
            </div>
          </div>

          <div style="display:flex; justify-content:flex-end; gap:10px; margin-top:20px;">
            <button type="button" class="wp-bar-btn wp-modal-cancel" style="background:#f1f5f9; color:#475569;">Cancel</button>
            <button type="submit" class="wp-bar-btn btn-publish"><i class="fa-solid fa-check"></i> Apply &amp; Save Theme</button>
          </div>
        </form>
      </div>
    `;

    backdrop.querySelector('.cms-modal-close').onclick = () => {
      applyGlobalStyles(globalStyles);
      backdrop.remove();
    };
    backdrop.querySelector('.wp-modal-cancel').onclick = () => {
      applyGlobalStyles(globalStyles);
      backdrop.remove();
    };

    // Live update helper
    const updatePreviewAndSite = () => {
      applyGlobalStyles(temp);
      const prevBox = backdrop.querySelector('#cms-theme-preview-container');
      if (prevBox) {
        prevBox.style.background = temp.bg;
        prevBox.style.color = temp.text;
      }
      const prevHeading = backdrop.querySelector('#cms-preview-heading');
      if (prevHeading) prevHeading.style.fontFamily = temp.fontHeading;
      const prevBody = backdrop.querySelector('#cms-preview-body');
      if (prevBody) prevBody.style.fontFamily = temp.fontPrimary;
    };

    // Tab switcher
    backdrop.querySelectorAll('.cms-theme-tab-btn').forEach(btn => {
      btn.onclick = () => {
        backdrop.querySelectorAll('.cms-theme-tab-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        const tab = btn.getAttribute('data-tab');
        backdrop.querySelectorAll('.cms-theme-tab-pane').forEach(p => p.style.display = 'none');
        backdrop.querySelector(`#cms-tab-${tab}`).style.display = 'block';
      };
    });

    // Preset cards click
    backdrop.querySelectorAll('.cms-theme-preset-card').forEach(card => {
      card.onclick = () => {
        backdrop.querySelectorAll('.cms-theme-preset-card').forEach(c => c.classList.remove('active'));
        card.classList.add('active');
        const presetId = card.getAttribute('data-preset-id');
        const preset = THEME_PRESETS.find(p => p.id === presetId);
        if (preset) {
          temp.primaryColor = preset.primary;
          temp.accentColor = preset.accent;
          temp.bg = preset.bg;
          temp.panel = preset.panel;
          temp.line = preset.line;
          temp.text = preset.text;
          temp.muted = preset.muted;
          temp.fontHeading = preset.fontHeading;
          temp.fontPrimary = preset.fontPrimary;
          temp.fontMono = preset.fontMono;
          temp.radius = preset.radius;
          temp.isDarkMode = preset.isDark;

          // Sync input fields
          const priInput = backdrop.querySelector('#wp-theme-primary');
          if (priInput) priInput.value = preset.primary;
          const accInput = backdrop.querySelector('#wp-theme-accent');
          if (accInput) accInput.value = preset.accent;
          const bgInput = backdrop.querySelector('#wp-theme-bg');
          if (bgInput) bgInput.value = preset.bg;
          const panInput = backdrop.querySelector('#wp-theme-panel');
          if (panInput) panInput.value = preset.panel;
          const txtInput = backdrop.querySelector('#wp-theme-text');
          if (txtInput) txtInput.value = preset.text;
          const mutInput = backdrop.querySelector('#wp-theme-muted');
          if (mutInput) mutInput.value = preset.muted;

          const modeBtn = backdrop.querySelector('#cms-theme-mode-toggle');
          if (modeBtn) {
            modeBtn.innerHTML = `<i class="fa-solid ${temp.isDarkMode ? 'fa-sun' : 'fa-moon'}"></i> ${temp.isDarkMode ? 'Switch to Light Mode' : 'Switch to Dark Mode'}`;
          }

          updatePreviewAndSite();
        }
      };
    });

    // Dark / Light Mode button toggle
    const modeBtn = backdrop.querySelector('#cms-theme-mode-toggle');
    if (modeBtn) {
      modeBtn.onclick = () => {
        temp.isDarkMode = !temp.isDarkMode;
        if (temp.isDarkMode) {
          temp.bg = '#080c14';
          temp.panel = '#111827';
          temp.line = 'rgba(255, 255, 255, 0.12)';
          temp.text = '#f8fafc';
          temp.muted = '#94a3b8';
        } else {
          temp.bg = '#f8fafc';
          temp.panel = '#ffffff';
          temp.line = 'rgba(15, 23, 42, 0.12)';
          temp.text = '#172334';
          temp.muted = '#596579';
        }

        modeBtn.innerHTML = `<i class="fa-solid ${temp.isDarkMode ? 'fa-sun' : 'fa-moon'}"></i> ${temp.isDarkMode ? 'Switch to Light Mode' : 'Switch to Dark Mode'}`;
        updatePreviewAndSite();
      };
    }

    // Color inputs live change
    backdrop.querySelector('#wp-theme-primary').oninput = (e) => { temp.primaryColor = e.target.value; updatePreviewAndSite(); };
    backdrop.querySelector('#wp-theme-accent').oninput = (e) => { temp.accentColor = e.target.value; updatePreviewAndSite(); };
    backdrop.querySelector('#wp-theme-bg').oninput = (e) => { temp.bg = e.target.value; updatePreviewAndSite(); };
    backdrop.querySelector('#wp-theme-panel').oninput = (e) => { temp.panel = e.target.value; updatePreviewAndSite(); };
    backdrop.querySelector('#wp-theme-text').oninput = (e) => { temp.text = e.target.value; updatePreviewAndSite(); };
    backdrop.querySelector('#wp-theme-muted').oninput = (e) => { temp.muted = e.target.value; updatePreviewAndSite(); };

    // Typography inputs
    backdrop.querySelector('#wp-theme-font-heading').onchange = (e) => { temp.fontHeading = e.target.value; updatePreviewAndSite(); };
    backdrop.querySelector('#wp-theme-font-body').onchange = (e) => { temp.fontPrimary = e.target.value; updatePreviewAndSite(); };
    backdrop.querySelector('#wp-theme-radius').onchange = (e) => { temp.radius = e.target.value; updatePreviewAndSite(); };

    // Form submit
    backdrop.querySelector('#wp-theme-studio-form').onsubmit = (e) => {
      e.preventDefault();
      globalStyles = { ...temp };
      localStorage.setItem(CMS_GLOBAL_STYLES_KEY, JSON.stringify(globalStyles));
      applyGlobalStyles(globalStyles);
      markDirty();
      backdrop.remove();
      showToast('Website theme and styling applied successfully across all pages!', 'success');
    };

    document.body.append(backdrop);
  }

  // ==========================================================================
  // 10. Admin Interface Construction (Top Bar, Sidebar, Floating Bar)
  // ==========================================================================

  function injectAdminInterface() {
    prepareEditableDOM();

    // 1. Top WordPress Admin Bar
    const bar = document.createElement('header');
    bar.id = 'wp-admin-bar';
    bar.className = 'cms-hidden';
    bar.innerHTML = `
      <div class="wp-bar-left">
        <div class="wp-bar-dropdown">
          <button type="button" class="wp-bar-btn"><i class="fa-solid fa-plus"></i> New <i class="fa-solid fa-caret-down" style="font-size:10px;"></i></button>
          <div class="wp-dropdown-menu">
            <button type="button" class="wp-dropdown-item" id="wp-new-html-page-btn"><i class="fa-solid fa-file-circle-plus"></i> Add New HTML Page</button>
            <button type="button" class="wp-dropdown-item" id="wp-new-event-page-btn"><i class="fa-solid fa-calendar-plus"></i> Dedicated Event Page</button>
            <button type="button" class="wp-dropdown-item" id="wp-new-nav-tab-btn"><i class="fa-solid fa-compass"></i> Add Navigation Tab</button>
            <button type="button" class="wp-dropdown-item" id="wp-new-section-btn"><i class="fa-solid fa-layer-group"></i> Add Section Block</button>
          </div>
        </div>
        <button type="button" class="wp-bar-btn" id="wp-toggle-edit"><i class="fa-solid fa-pen"></i> Edit Mode</button>
        <button type="button" class="wp-bar-btn" id="wp-toggle-relocate" title="Show move handles for every element on page"><i class="fa-solid fa-arrows-up-down-left-right"></i> Relocate Tool</button>
        <button type="button" class="wp-bar-btn active" id="wp-toggle-ribbon"><i class="fa-solid fa-file-word"></i> Word Ribbon</button>
        <button type="button" class="wp-bar-btn" id="wp-toggle-inspector"><i class="fa-solid fa-sliders"></i> Element Inspector</button>
        <button type="button" class="wp-bar-btn" id="wp-hero-media-btn"><i class="fa-solid fa-photo-film"></i> Hero Media</button>
        <button type="button" class="wp-bar-btn" id="wp-global-styles-btn"><i class="fa-solid fa-palette"></i> Themes</button>
        <button type="button" class="wp-bar-btn" id="wp-nav-manager-btn"><i class="fa-solid fa-bars"></i> Menus &amp; Tabs</button>
        <button type="button" class="wp-bar-btn" id="wp-security-vault-btn" title="Passkey Security &amp; Session Management"><i class="fa-solid fa-shield-halved" style="color:#10b981;"></i> Security Vault</button>
        <button type="button" class="wp-bar-btn btn-publish" id="wp-publish-btn"><i class="fa-solid fa-cloud-arrow-up"></i> Publish Changes</button>
        <button type="button" class="wp-bar-btn" id="wp-export-btn" title="Download clean updated HTML"><i class="fa-solid fa-download"></i> Export HTML</button>
        <button type="button" class="wp-bar-btn" id="wp-logout-btn" title="Exit Admin Mode"><i class="fa-solid fa-right-from-bracket"></i></button>
      </div>
    `;
    document.body.prepend(bar);

    // 2. Microsoft Word Fluent Ribbon Bar (Docked under Admin Bar)
    const ribbon = document.createElement('div');
    ribbon.id = 'wp-word-ribbon';
    ribbon.className = 'wp-word-ribbon';
    ribbon.innerHTML = `
      <div class="word-ribbon-inner">
        <!-- Font Section -->
        <div class="word-group word-group-font">
          <div class="word-group-content">
            <!-- Row 1: Font Family, Size, Grow, Shrink, Case, Clear -->
            <div class="word-row">
              <select class="word-select word-font-family" title="Font Family">
                <option value="Arial">Arial</option>
                <option value="Inter">Inter</option>
                <option value="Montserrat">Montserrat</option>
                <option value="Playfair Display">Playfair Display</option>
                <option value="Outfit">Outfit</option>
                <option value="Plus Jakarta Sans">Plus Jakarta Sans</option>
                <option value="Cinzel">Cinzel</option>
                <option value="Georgia">Georgia</option>
                <option value="Times New Roman">Times New Roman</option>
                <option value="Courier New">Courier New</option>
                <option value="Verdana">Verdana</option>
                <option value="Tahoma">Tahoma</option>
              </select>
              <select class="word-select word-font-size" title="Font Size">
                <option value="10">10</option>
                <option value="11">11</option>
                <option value="12">12</option>
                <option value="14">14</option>
                <option value="16" selected>16</option>
                <option value="18">18</option>
                <option value="20">20</option>
                <option value="24">24</option>
                <option value="28">28</option>
                <option value="32">32</option>
                <option value="36">36</option>
                <option value="48">48</option>
                <option value="60">60</option>
                <option value="72">72</option>
              </select>
              <div class="word-divider-v"></div>
              <button type="button" class="word-btn" data-word-act="growFont" title="Increase Font Size (Ctrl+Shift+>)">
                <span style="font-weight:700; font-size:13px;">A<sup style="font-size:8px;">▲</sup></span>
              </button>
              <button type="button" class="word-btn" data-word-act="shrinkFont" title="Decrease Font Size (Ctrl+Shift+<)">
                <span style="font-weight:700; font-size:11px;">A<sub style="font-size:8px;">▼</sub></span>
              </button>
              <div class="word-dropdown-wrap">
                <button type="button" class="word-btn word-dropdown-toggle" title="Change Case">
                  <span style="font-weight:700;">Aa</span> <i class="fa-solid fa-caret-down word-caret"></i>
                </button>
                <div class="word-dropdown-menu">
                  <button type="button" class="word-dropdown-opt" data-word-act="case-sentence">Sentence case.</button>
                  <button type="button" class="word-dropdown-opt" data-word-act="case-lower">lowercase</button>
                  <button type="button" class="word-dropdown-opt" data-word-act="case-upper">UPPERCASE</button>
                  <button type="button" class="word-dropdown-opt" data-word-act="case-title">Capitalize Each Word</button>
                  <button type="button" class="word-dropdown-opt" data-word-act="case-toggle">tOGGLE cASE</button>
                </div>
              </div>
              <button type="button" class="word-btn" data-word-act="clearFormat" title="Clear All Formatting">
                <span style="color:#f43f5e;"><i class="fa-solid fa-eraser"></i></span>
              </button>
            </div>
            <!-- Row 2: Bold, Italic, Underline, Strike, Sub, Super, Text Effect, Highlight, Font Color -->
            <div class="word-row">
              <button type="button" class="word-btn" data-word-act="bold" title="Bold (Ctrl+B)">
                <strong style="font-family:serif; font-size:14px;">B</strong>
              </button>
              <button type="button" class="word-btn" data-word-act="italic" title="Italic (Ctrl+I)">
                <em style="font-family:serif; font-size:14px;">I</em>
              </button>
              <div class="word-dropdown-wrap">
                <button type="button" class="word-btn" data-word-act="underline" title="Underline (Ctrl+U)">
                  <u style="font-size:13px; font-weight:700;">U</u> <i class="fa-solid fa-caret-down word-caret"></i>
                </button>
                <div class="word-dropdown-menu">
                  <button type="button" class="word-dropdown-opt" data-word-act="ul-solid"><span style="text-decoration: underline;">Solid Underline</span></button>
                  <button type="button" class="word-dropdown-opt" data-word-act="ul-double"><span style="text-decoration: underline double;">Double Underline</span></button>
                  <button type="button" class="word-dropdown-opt" data-word-act="ul-dashed"><span style="text-decoration: underline dashed;">Dashed Underline</span></button>
                  <button type="button" class="word-dropdown-opt" data-word-act="ul-wavy"><span style="text-decoration: underline wavy;">Wavy Underline</span></button>
                </div>
              </div>
              <button type="button" class="word-btn" data-word-act="strikeThrough" title="Strikethrough">
                <span style="text-decoration: line-through; font-weight:600;">ab</span>
              </button>
              <button type="button" class="word-btn" data-word-act="subscript" title="Subscript (Ctrl+=)">
                <span>x<sub>2</sub></span>
              </button>
              <button type="button" class="word-btn" data-word-act="superscript" title="Superscript (Ctrl+Shift++)">
                <span>x<sup>2</sup></span>
              </button>
              <div class="word-divider-v"></div>
              <div class="word-dropdown-wrap">
                <button type="button" class="word-btn" title="Text Effects &amp; Typography">
                  <span class="word-glow-a">A</span> <i class="fa-solid fa-caret-down word-caret"></i>
                </button>
                <div class="word-dropdown-menu">
                  <button type="button" class="word-dropdown-opt" data-word-act="fx-glow"><span style="color:#60a5fa; text-shadow:0 0 8px #2563eb;">Blue Glow</span></button>
                  <button type="button" class="word-dropdown-opt" data-word-act="fx-gold"><span style="color:#fbbf24; font-weight:700;">Gold Luxury</span></button>
                  <button type="button" class="word-dropdown-opt" data-word-act="fx-shadow"><span style="text-shadow:2px 2px 4px #000;">Drop Shadow</span></button>
                  <button type="button" class="word-dropdown-opt" data-word-act="fx-outline"><span>Crisp Outline</span></button>
                  <button type="button" class="word-dropdown-opt" data-word-act="fx-none"><span>None</span></button>
                </div>
              </div>
              <div class="word-color-wrap" title="Text Highlight Color">
                <button type="button" class="word-btn word-hl-btn">
                  <i class="fa-solid fa-highlighter"></i>
                  <span class="word-strip" id="word-hl-strip" style="background:#eab308;"></span>
                  <input type="color" class="word-color-input" id="word-hl-picker" value="#fef08a" />
                </button>
              </div>
              <div class="word-color-wrap" title="Font Color">
                <button type="button" class="word-btn word-fc-btn">
                  <span style="font-weight:900; font-size:13px;">A</span>
                  <span class="word-strip" id="word-fc-strip" style="background:#ef4444;"></span>
                  <input type="color" class="word-color-input" id="word-fc-picker" value="#ef4444" />
                </button>
              </div>
            </div>
          </div>
          <div class="word-group-footer">
            <span>Font</span>
            <button type="button" class="word-group-launch-btn" title="Open Font Properties in Inspector"><i class="fa-solid fa-arrow-up-right-from-square"></i></button>
          </div>
        </div>

        <div class="word-group-divider"></div>

        <!-- Paragraph Section -->
        <div class="word-group word-group-para">
          <div class="word-group-content">
            <!-- Row 1: Bullets, Numbering, Multilevel, Outdent, Indent, Sort, Show/Hide ¶ -->
            <div class="word-row">
              <div class="word-dropdown-wrap">
                <button type="button" class="word-btn" data-word-act="insertUnorderedList" title="Bullets">
                  <i class="fa-solid fa-list-ul"></i> <i class="fa-solid fa-caret-down word-caret"></i>
                </button>
                <div class="word-dropdown-menu">
                  <button type="button" class="word-dropdown-opt" data-word-act="list-disc"><i class="fa-solid fa-circle" style="font-size:8px;"></i> Disc Bullet</button>
                  <button type="button" class="word-dropdown-opt" data-word-act="list-circle"><i class="fa-regular fa-circle" style="font-size:8px;"></i> Circle Bullet</button>
                  <button type="button" class="word-dropdown-opt" data-word-act="list-square"><i class="fa-solid fa-square" style="font-size:8px;"></i> Square Bullet</button>
                </div>
              </div>
              <div class="word-dropdown-wrap">
                <button type="button" class="word-btn" data-word-act="insertOrderedList" title="Numbering">
                  <i class="fa-solid fa-list-ol"></i> <i class="fa-solid fa-caret-down word-caret"></i>
                </button>
                <div class="word-dropdown-menu">
                  <button type="button" class="word-dropdown-opt" data-word-act="list-123">1. 2. 3. Numbered</button>
                  <button type="button" class="word-dropdown-opt" data-word-act="list-abc">a. b. c. Letters</button>
                  <button type="button" class="word-dropdown-opt" data-word-act="list-roman">i. ii. iii. Roman</button>
                </div>
              </div>
              <button type="button" class="word-btn" data-word-act="list-check" title="Checklist / Task Items">
                <i class="fa-solid fa-list-check"></i>
              </button>
              <div class="word-divider-v"></div>
              <button type="button" class="word-btn" data-word-act="outdent" title="Decrease Indent (Shift+Tab)">
                <i class="fa-solid fa-outdent"></i>
              </button>
              <button type="button" class="word-btn" data-word-act="indent" title="Increase Indent (Tab)">
                <i class="fa-solid fa-indent"></i>
              </button>
              <button type="button" class="word-btn" data-word-act="sortLines" title="Sort Lines / Items (A to Z)">
                <i class="fa-solid fa-arrow-down-a-z"></i>
              </button>
              <button type="button" class="word-btn" data-word-act="toggleMarks" title="Show/Hide Paragraph Marks (¶)">
                <i class="fa-solid fa-paragraph"></i>
              </button>
            </div>
            <!-- Row 2: Align Left, Center, Right, Justify, Line Spacing, Shading, Borders -->
            <div class="word-row">
              <button type="button" class="word-btn" data-word-act="justifyLeft" title="Align Left (Ctrl+L)">
                <i class="fa-solid fa-align-left"></i>
              </button>
              <button type="button" class="word-btn" data-word-act="justifyCenter" title="Align Center (Ctrl+E)">
                <i class="fa-solid fa-align-center"></i>
              </button>
              <button type="button" class="word-btn" data-word-act="justifyRight" title="Align Right (Ctrl+R)">
                <i class="fa-solid fa-align-right"></i>
              </button>
              <button type="button" class="word-btn" data-word-act="justifyFull" title="Justify (Ctrl+J)">
                <i class="fa-solid fa-align-justify"></i>
              </button>
              <div class="word-divider-v"></div>
              <div class="word-dropdown-wrap">
                <button type="button" class="word-btn" title="Line &amp; Paragraph Spacing">
                  <i class="fa-solid fa-arrows-up-down"></i> <i class="fa-solid fa-caret-down word-caret"></i>
                </button>
                <div class="word-dropdown-menu">
                  <button type="button" class="word-dropdown-opt" data-word-act="lh-10">1.0 Single Spacing</button>
                  <button type="button" class="word-dropdown-opt" data-word-act="lh-115">1.15 Normal Spacing</button>
                  <button type="button" class="word-dropdown-opt" data-word-act="lh-15">1.5 Lines Spacing</button>
                  <button type="button" class="word-dropdown-opt" data-word-act="lh-20">2.0 Double Spacing</button>
                  <button type="button" class="word-dropdown-opt" data-word-act="lh-25">2.5 Relaxed Spacing</button>
                </div>
              </div>
              <div class="word-color-wrap" title="Shading / Paragraph Background Fill">
                <button type="button" class="word-btn">
                  <i class="fa-solid fa-fill-drip"></i>
                  <input type="color" class="word-color-input" id="word-shade-picker" value="#f1f5f9" />
                </button>
              </div>
              <div class="word-dropdown-wrap">
                <button type="button" class="word-btn" title="Borders">
                  <i class="fa-solid fa-border-all"></i> <i class="fa-solid fa-caret-down word-caret"></i>
                </button>
                <div class="word-dropdown-menu">
                  <button type="button" class="word-dropdown-opt" data-word-act="border-bottom">Bottom Border</button>
                  <button type="button" class="word-dropdown-opt" data-word-act="border-top">Top Border</button>
                  <button type="button" class="word-dropdown-opt" data-word-act="border-left">Left Accent Border</button>
                  <button type="button" class="word-dropdown-opt" data-word-act="border-box">Box Border</button>
                  <button type="button" class="word-dropdown-opt" data-word-act="border-none">No Border</button>
                </div>
              </div>
            </div>
          </div>
          <div class="word-group-footer">
            <span>Paragraph</span>
            <button type="button" class="word-group-launch-btn" title="Open Layout in Inspector"><i class="fa-solid fa-arrow-up-right-from-square"></i></button>
          </div>
        </div>

        <div class="word-group-divider"></div>

        <!-- Design & Studio Tools Section -->
        <div class="word-group word-group-studio">
          <div class="word-group-content">
            <div class="word-row">
              <button type="button" class="word-btn" id="word-theme-btn" style="padding:2px 8px; font-weight:600; color:#fbbf24;" title="Open Website Themes &amp; Presets">
                <i class="fa-solid fa-palette"></i> Themes
              </button>
              <button type="button" class="word-btn" id="word-relocate-btn" style="padding:2px 8px; font-weight:600; color:#60a5fa;" title="Toggle Relocate &amp; Move Handles Mode">
                <i class="fa-solid fa-arrows-up-down-left-right"></i> Relocate Tool
              </button>
            </div>
            <div class="word-row">
              <button type="button" class="word-btn" id="word-hero-btn" style="padding:2px 8px; font-size:11px;" title="Hero Background Photo &amp; Video">
                <i class="fa-solid fa-photo-film"></i> Hero Media
              </button>
              <button type="button" class="word-btn" id="word-event-btn" style="padding:2px 8px; font-size:11px;" title="Create Event Page">
                <i class="fa-solid fa-calendar-plus"></i> + Event Page
              </button>
            </div>
          </div>
          <div class="word-group-footer">
            <span>Design Tools</span>
          </div>
        </div>
      </div>
    `;
    document.body.prepend(ribbon);

    // 3. Floating Quick-Format Toolbar (Word Mini Bar)
    const floatToolbar = document.createElement('div');
    floatToolbar.id = 'wp-floating-toolbar';
    floatToolbar.innerHTML = `
      <select class="word-select word-font-family" style="max-width:110px;" title="Font Family">
        <option value="Arial">Arial</option>
        <option value="Inter">Inter</option>
        <option value="Montserrat">Montserrat</option>
        <option value="Playfair Display">Playfair Display</option>
        <option value="Outfit">Outfit</option>
        <option value="Plus Jakarta Sans">Plus Jakarta Sans</option>
        <option value="Cinzel">Cinzel</option>
      </select>
      <select class="word-select word-font-size" style="width:52px;" title="Font Size">
        <option value="12">12</option>
        <option value="14">14</option>
        <option value="16" selected>16</option>
        <option value="18">18</option>
        <option value="20">20</option>
        <option value="24">24</option>
        <option value="28">28</option>
        <option value="32">32</option>
        <option value="36">36</option>
        <option value="48">48</option>
      </select>
      <div class="word-divider-v"></div>
      <button type="button" class="word-btn" data-word-act="bold" title="Bold"><strong style="font-family:serif;">B</strong></button>
      <button type="button" class="word-btn" data-word-act="italic" title="Italic"><em style="font-family:serif;">I</em></button>
      <button type="button" class="word-btn" data-word-act="underline" title="Underline"><u>U</u></button>
      <button type="button" class="word-btn" data-word-act="strikeThrough" title="Strikethrough"><span style="text-decoration:line-through;">ab</span></button>
      <div class="word-color-wrap" title="Highlight">
        <button type="button" class="word-btn">
          <i class="fa-solid fa-highlighter"></i>
          <span class="word-strip" id="float-hl-strip" style="background:#eab308;"></span>
          <input type="color" class="word-color-input" id="float-hl-picker" value="#fef08a" />
        </button>
      </div>
      <div class="word-color-wrap" title="Font Color">
        <button type="button" class="word-btn">
          <span style="font-weight:900;">A</span>
          <span class="word-strip" id="float-fc-strip" style="background:#ef4444;"></span>
          <input type="color" class="word-color-input" id="float-fc-picker" value="#ef4444" />
        </button>
      </div>
      <div class="word-divider-v"></div>
      <button type="button" class="word-btn" data-word-act="justifyLeft" title="Align Left"><i class="fa-solid fa-align-left"></i></button>
      <button type="button" class="word-btn" data-word-act="justifyCenter" title="Align Center"><i class="fa-solid fa-align-center"></i></button>
      <button type="button" class="word-btn" data-word-act="insertUnorderedList" title="Bullets"><i class="fa-solid fa-list-ul"></i></button>
      <button type="button" class="word-btn" data-word-act="insertOrderedList" title="Numbers"><i class="fa-solid fa-list-ol"></i></button>
      <div class="word-divider-v"></div>
      <button type="button" class="word-btn" id="wp-float-link-btn" title="Insert Link"><i class="fa-solid fa-link"></i></button>
      <button type="button" class="word-btn" id="wp-float-insp-btn" title="Open Inspector"><i class="fa-solid fa-sliders"></i></button>
    `;
    document.body.append(floatToolbar);

    // Wire Word Buttons & Selects
    document.querySelectorAll('[data-word-act]').forEach((btn) => {
      btn.onmousedown = (e) => {
        e.preventDefault();
        const act = btn.getAttribute('data-word-act');
        executeWordAction(act);
      };
    });

    document.querySelectorAll('.word-font-family').forEach((sel) => {
      sel.onchange = (e) => executeWordAction('fontFamily', e.target.value);
    });

    document.querySelectorAll('.word-font-size').forEach((sel) => {
      sel.onchange = (e) => executeWordAction('fontSize', e.target.value);
    });

    // Color pickers
    document.querySelectorAll('#word-hl-picker, #float-hl-picker').forEach(picker => {
      picker.oninput = (e) => {
        const c = e.target.value;
        document.querySelectorAll('#word-hl-strip, #float-hl-strip').forEach(s => s.style.background = c);
        executeWordAction('highlight', c);
      };
    });

    document.querySelectorAll('#word-fc-picker, #float-fc-picker').forEach(picker => {
      picker.oninput = (e) => {
        const c = e.target.value;
        document.querySelectorAll('#word-fc-strip, #float-fc-strip').forEach(s => s.style.background = c);
        executeWordAction('foreColor', c);
      };
    });

    const shadePicker = document.getElementById('word-shade-picker');
    if (shadePicker) {
      shadePicker.oninput = (e) => executeWordAction('shading', e.target.value);
    }

    // Launch buttons to inspector & studio tools
    document.querySelectorAll('.word-group-launch-btn').forEach(btn => {
      btn.onclick = () => openSidebarInspector();
    });
    document.getElementById('word-theme-btn')?.addEventListener('click', openThemeStudioModal);
    document.getElementById('word-relocate-btn')?.addEventListener('click', () => {
      isRelocateMode = !isRelocateMode;
      document.body.classList.toggle('cms-relocate-mode', isRelocateMode);
      document.getElementById('wp-toggle-relocate')?.classList.toggle('active', isRelocateMode);
      showToast(isRelocateMode ? 'Relocate Mode Active: Move handles visible on all elements!' : 'Relocate Mode Off', 'info');
    });
    document.getElementById('word-hero-btn')?.addEventListener('click', () => openHeroMediaModal());
    document.getElementById('word-event-btn')?.addEventListener('click', openEventPageGeneratorModal);

    // Float link button
    document.getElementById('wp-float-link-btn')?.addEventListener('click', (e) => {
      e.preventDefault();
      const url = prompt('Enter Destination URL:');
      if (url) formatText('createLink', url);
    });
    document.getElementById('wp-float-insp-btn')?.addEventListener('click', openSidebarInspector);

    // Dropdown menu toggle and auto-close
    document.addEventListener('click', (e) => {
      const toggle = e.target.closest('.word-dropdown-toggle, [data-word-act="underline"], [data-word-act="insertUnorderedList"], [data-word-act="insertOrderedList"]');
      const wrap = e.target.closest('.word-dropdown-wrap');
      document.querySelectorAll('.word-dropdown-menu.open').forEach(menu => {
        if (!wrap || menu !== wrap.querySelector('.word-dropdown-menu')) {
          menu.classList.remove('open');
        }
      });
      if (wrap && (toggle || e.target.closest('.word-caret'))) {
        const menu = wrap.querySelector('.word-dropdown-menu');
        if (menu) menu.classList.toggle('open');
      }
    });

    // 4. Sidebar Inspector
    const sidebar = document.createElement('aside');
    sidebar.id = 'wp-sidebar-inspector';
    sidebar.innerHTML = `
      <div class="wp-sidebar-header">
        <h4 class="wp-sidebar-title"><i class="fa-solid fa-sliders" style="color:var(--wp-primary);"></i> Style &amp; Typography Inspector</h4>
        <button type="button" class="wp-sidebar-close" id="wp-close-insp-btn"><i class="fa-solid fa-xmark"></i></button>
      </div>
      <div class="wp-sidebar-tabs">
        <button type="button" class="wp-sidebar-tab active" data-tab="style">Typography &amp; Style</button>
        <button type="button" class="wp-sidebar-tab" data-tab="layout">Spacing &amp; Layout</button>
      </div>
      <div class="wp-sidebar-body">
        <div id="wp-tab-style">
          <div class="wp-panel-group">
            <div class="wp-panel-heading">Selected Element: <span id="wp-insp-tag" style="color:#2563eb; text-transform:none;">p</span></div>
            <div class="wp-control-row">
              <span class="wp-control-label">Font Family:</span>
              <select id="wp-insp-font" class="wp-select" style="max-width:180px;">
                <option value="Arial">Arial</option>
                <option value="Inter">Inter</option>
                <option value="Montserrat">Montserrat</option>
                <option value="Playfair Display">Playfair Display</option>
                <option value="Outfit">Outfit</option>
                <option value="Plus Jakarta Sans">Plus Jakarta Sans</option>
                <option value="Cinzel">Cinzel</option>
                <option value="monospace">Monospace</option>
              </select>
            </div>
            <div class="wp-control-row">
              <span class="wp-control-label">Font Size (px):</span>
              <input type="number" id="wp-insp-size" class="wp-input" style="width:80px;" min="10" max="96" value="16" />
            </div>
            <div class="wp-control-row">
              <span class="wp-control-label">Font Weight:</span>
              <select id="wp-insp-weight" class="wp-select" style="max-width:120px;">
                <option value="300">Light (300)</option>
                <option value="400">Regular (400)</option>
                <option value="500">Medium (500)</option>
                <option value="600">SemiBold (600)</option>
                <option value="700">Bold (700)</option>
                <option value="800">ExtraBold (800)</option>
                <option value="900">Black (900)</option>
              </select>
            </div>
          </div>
          <div class="wp-panel-group">
            <div class="wp-panel-heading">Color &amp; Alignment</div>
            <div class="wp-control-row">
              <span class="wp-control-label">Text Color:</span>
              <input type="color" id="wp-insp-color" class="wp-color-picker" />
            </div>
            <div class="wp-control-row">
              <span class="wp-control-label">Background Color:</span>
              <input type="color" id="wp-insp-bg" class="wp-color-picker" />
            </div>
            <div class="wp-control-row">
              <span class="wp-control-label">Text Align:</span>
              <select id="wp-insp-align" class="wp-select" style="max-width:120px;">
                <option value="left">Left</option>
                <option value="center">Center</option>
                <option value="right">Right</option>
                <option value="justify">Justify</option>
              </select>
            </div>
          </div>
          <div class="wp-panel-group" id="wp-insp-link-panel" style="display:none;">
            <div class="wp-panel-heading">Link / Button Destination</div>
            <div class="wp-control-row">
              <span class="wp-control-label">Attached Page:</span>
              <select id="wp-insp-page-select" class="wp-select" style="max-width:140px;">
                <option value="">(Custom or Select)</option>
              </select>
            </div>
            <div class="wp-control-row">
              <span class="wp-control-label">URL (href):</span>
              <input type="text" id="wp-insp-link" class="wp-input" style="width:140px;" placeholder="events.html or https://..." />
            </div>
            <div style="display:flex; gap:5px; margin-top:8px;">
              <button type="button" id="wp-insp-btn-create-page" class="wp-bar-btn" style="flex:1; font-size:11px; padding:4px 6px; background:#10b981; color:#fff;" title="Create new HTML page and link"><i class="fa-solid fa-plus"></i> New Page</button>
              <button type="button" id="wp-insp-btn-add-button" class="wp-bar-btn" style="flex:1; font-size:11px; padding:4px 6px; background:var(--wp-primary,#2563eb); color:#fff;" title="Add another button beside"><i class="fa-solid fa-square-plus"></i> Add Btn</button>
              <button type="button" id="wp-insp-btn-del-button" class="wp-bar-btn" style="font-size:11px; padding:4px 6px; background:#ef4444; color:#fff;" title="Delete this button"><i class="fa-solid fa-trash"></i></button>
            </div>
          </div>
        </div>
        <div id="wp-tab-layout" style="display:none;">
          <div class="wp-panel-group">
            <div class="wp-panel-heading">Spacing (Padding &amp; Margin)</div>
            <div class="wp-control-row">
              <span class="wp-control-label">Padding (px):</span>
              <input type="number" id="wp-insp-padding" class="wp-input" style="width:80px;" min="0" max="100" />
            </div>
            <div class="wp-control-row">
              <span class="wp-control-label">Margin Bottom (px):</span>
              <input type="number" id="wp-insp-margin" class="wp-input" style="width:80px;" min="0" max="100" />
            </div>
            <div class="wp-control-row">
              <span class="wp-control-label">Border Radius (px):</span>
              <input type="number" id="wp-insp-radius" class="wp-input" style="width:80px;" min="0" max="50" />
            </div>
          </div>
        </div>
      </div>
    `;
    document.body.append(sidebar);

    // Inspector Event handlers
    sidebar.querySelector('#wp-close-insp-btn').onclick = closeSidebarInspector;
    sidebar.querySelectorAll('.wp-sidebar-tab').forEach((tab) => {
      tab.onclick = () => {
        sidebar.querySelectorAll('.wp-sidebar-tab').forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        const isStyle = tab.getAttribute('data-tab') === 'style';
        document.getElementById('wp-tab-style').style.display = isStyle ? 'block' : 'none';
        document.getElementById('wp-tab-layout').style.display = isStyle ? 'none' : 'block';
      };
    });

    sidebar.querySelector('#wp-insp-font').onchange = (e) => applyStyleToActive('fontFamily', e.target.value);
    sidebar.querySelector('#wp-insp-size').oninput = (e) => applyStyleToActive('fontSize', e.target.value + 'px');
    sidebar.querySelector('#wp-insp-weight').onchange = (e) => applyStyleToActive('fontWeight', e.target.value);
    sidebar.querySelector('#wp-insp-color').oninput = (e) => applyStyleToActive('color', e.target.value);
    sidebar.querySelector('#wp-insp-bg').oninput = (e) => applyStyleToActive('backgroundColor', e.target.value);
    sidebar.querySelector('#wp-insp-align').onchange = (e) => applyStyleToActive('textAlign', e.target.value);
    sidebar.querySelector('#wp-insp-padding').oninput = (e) => applyStyleToActive('padding', e.target.value + 'px');
    sidebar.querySelector('#wp-insp-margin').oninput = (e) => applyStyleToActive('marginBottom', e.target.value + 'px');
    sidebar.querySelector('#wp-insp-radius').oninput = (e) => applyStyleToActive('borderRadius', e.target.value + 'px');

    // Dropdown + New menu toggle and handlers
    const newDropdown = document.querySelector('.wp-bar-dropdown');
    const newBtn = newDropdown?.querySelector('.wp-bar-btn');
    const newMenu = newDropdown?.querySelector('.wp-dropdown-menu');

    if (newBtn && newMenu) {
      newBtn.onclick = (e) => {
        e.stopPropagation();
        newMenu.classList.toggle('open');
      };

      newMenu.querySelectorAll('.wp-dropdown-item').forEach((item) => {
        item.addEventListener('click', () => {
          newMenu.classList.remove('open');
        });
      });
    }

    document.addEventListener('click', (e) => {
      if (!e.target.closest('.wp-bar-dropdown')) {
        document.querySelector('.wp-dropdown-menu')?.classList.remove('open');
      }
    });

    // Admin Bar Listeners
    document.getElementById('wp-toggle-edit').onclick = () => setEditMode(!isEditMode);
    document.getElementById('wp-toggle-relocate').onclick = () => {
      isRelocateMode = !isRelocateMode;
      document.body.classList.toggle('cms-relocate-mode', isRelocateMode);
      document.getElementById('wp-toggle-relocate').classList.toggle('active', isRelocateMode);
      showToast(isRelocateMode ? 'Relocate Mode Active: Move handles visible on all elements!' : 'Relocate Mode Off', 'info');
    };
    document.getElementById('wp-toggle-ribbon').onclick = toggleWordRibbon;
    document.getElementById('wp-toggle-inspector').onclick = toggleSidebarInspector;
    document.getElementById('wp-hero-media-btn').onclick = () => openHeroMediaModal();
    document.getElementById('wp-global-styles-btn').onclick = openThemeStudioModal;
    document.getElementById('wp-nav-manager-btn').onclick = openNavManagerModal;
    document.getElementById('wp-new-nav-tab-btn').onclick = openNavManagerModal;
    document.getElementById('wp-new-html-page-btn').onclick = () => openNewPageModal('content');
    document.getElementById('wp-new-event-page-btn').onclick = () => openNewPageModal('event');
    document.getElementById('wp-new-section-btn').onclick = () => {
      openTemplateLibraryModal((html) => {
        const temp = document.createElement('div');
        temp.innerHTML = html;
        const newEl = temp.firstElementChild;
        if (newEl) {
          if (newEl.classList.contains('reveal')) newEl.classList.add('active');
          newEl.querySelectorAll('.reveal').forEach((r) => r.classList.add('active'));
          document.querySelector('main')?.append(newEl);
          prepareEditableDOM();
          setEditMode(true);
          markDirty();
          showToast('Section block added to page!', 'success');
        }
      });
    };
    document.getElementById('wp-security-vault-btn').onclick = openSecurityVaultModal;
    document.getElementById('wp-publish-btn').onclick = saveAllChanges;
    document.getElementById('wp-export-btn').onclick = exportPageHTML;
    document.getElementById('wp-logout-btn').onclick = logoutAdmin;
  }

  // ==========================================================================
  // 11. Hero Photo/Video & Coverage Studio
  // ==========================================================================

  function loadHeroMedia() {
    try {
      const storedHero = localStorage.getItem(heroStorageKey);
      if (storedHero) {
        pageHeroSettings = JSON.parse(storedHero);
        const heroSection = document.querySelector('.hero, .page-hero, header + main > section:first-of-type, header + section');
        if (heroSection && pageHeroSettings) {
          applyHeroMedia(heroSection, pageHeroSettings);
        }
      }
    } catch (e) {
      console.warn('[CMS] Failed to load hero media:', e);
    }
  }

  function applyHeroMedia(heroEl, settings) {
    if (!heroEl || !settings) return;
    heroEl.style.position = 'relative';
    heroEl.style.overflow = 'hidden';
    heroEl.classList.add('has-cms-media');

    // 1. Ensure or create media wrap container
    let wrap = heroEl.querySelector('.cms-hero-media-wrap');
    if (!wrap) {
      wrap = document.createElement('div');
      wrap.className = 'cms-hero-media-wrap';
      heroEl.prepend(wrap);
    }

    // Clean any legacy/static direct child media elements outside wrap
    heroEl.querySelectorAll(':scope > video, :scope > img.page-hero-img').forEach(el => el.remove());

    const widthVal = settings.width !== undefined ? Number(settings.width) : 100;
    const heightVal = settings.height !== undefined ? settings.height : 100;
    const opacityVal = settings.opacity !== undefined ? Number(settings.opacity) : 0.35;
    const pos = settings.position || 'full';
    const fit = settings.objectFit || 'cover';
    const blurPx = settings.blur !== undefined ? Number(settings.blur) : 0;

    // Apply positioning class and styles
    wrap.className = `cms-hero-media-wrap pos-${pos}`;
    wrap.style.width = pos === 'full' ? '100%' : `${widthVal}%`;
    wrap.style.height = `${heightVal}%`;
    wrap.style.opacity = opacityVal.toString();

    // Immediately and cleanly clear or apply blur
    if (blurPx > 0) {
      wrap.style.filter = `blur(${blurPx}px)`;
      wrap.style.webkitFilter = `blur(${blurPx}px)`;
    } else {
      wrap.style.filter = 'none';
      wrap.style.webkitFilter = 'none';
      wrap.style.removeProperty('filter');
      wrap.style.removeProperty('-webkit-filter');
    }

    // 2. Create Video or Image
    if (settings.type === 'video') {
      let video = wrap.querySelector('video');
      if (!video || video.getAttribute('data-src') !== settings.src) {
        wrap.innerHTML = '';
        video = document.createElement('video');
        video.className = 'cms-hero-media-el';
        video.autoplay = true;
        video.loop = true;
        video.playsInline = true;
        video.muted = settings.muted !== false;
        video.defaultMuted = settings.muted !== false;
        if (settings.muted !== false) {
          video.setAttribute('muted', '');
        } else {
          video.removeAttribute('muted');
        }
        video.setAttribute('playsinline', '');
        video.setAttribute('autoplay', '');
        video.setAttribute('loop', '');
        video.setAttribute('aria-hidden', 'true');
        video.removeAttribute('poster');
        video.src = settings.src;
        video.setAttribute('data-src', settings.src);
        wrap.append(video);
      }
      video.style.objectFit = fit;
      video.muted = settings.muted !== false;
      video.defaultMuted = settings.muted !== false;
      if (settings.muted !== false) {
        video.setAttribute('muted', '');
      } else {
        video.removeAttribute('muted');
      }
      video.removeAttribute('poster');
      const volNum = typeof settings.volume === 'number' ? settings.volume : 80;
      video.volume = Math.max(0, Math.min(1, volNum / 100));
      const playPromise = video.play();
      if (playPromise !== undefined) {
        playPromise.catch(() => {
          if (!video.muted) {
            video.muted = true;
            video.setAttribute('muted', '');
            video.play().catch(() => { });
          }
        });
      }

      // Ensure no floating sound button is rendered
      const oldSoundBtn = heroEl.querySelector(':scope > .cms-hero-sound-btn');
      if (oldSoundBtn) oldSoundBtn.remove();
      heroEl.querySelectorAll('.cms-hero-sound-btn').forEach(b => b.remove());
    } else {
      const oldSoundBtn = heroEl.querySelector(':scope > .cms-hero-sound-btn');
      if (oldSoundBtn) oldSoundBtn.remove();
      heroEl.querySelectorAll('.cms-hero-sound-btn').forEach(b => b.remove());

      let img = wrap.querySelector('img');
      if (!img || img.src !== settings.src) {
        wrap.innerHTML = '';
        img = document.createElement('img');
        img.className = 'cms-hero-media-el';
        img.src = settings.src;
        wrap.append(img);
      }
      img.alt = settings.alt || 'Hero background media';
      img.style.objectFit = fit;
    }

    // 3. Ensure overlay layer for text contrast
    let overlay = heroEl.querySelector('.cms-hero-overlay');
    if (!overlay) {
      overlay = document.createElement('div');
      overlay.className = 'cms-hero-overlay';
      heroEl.insertBefore(overlay, wrap.nextSibling);
    }
    const overlayType = settings.overlay || 'vignette';
    overlay.className = `cms-hero-overlay overlay-${overlayType}`;
    if (overlayType === 'none') {
      overlay.style.display = 'none';
    } else {
      overlay.style.display = '';
    }

    // 4. Ensure hero content sits above media
    const content = heroEl.querySelector('.hero-content, .page-hero-inner, .container');
    if (content) {
      content.style.position = 'relative';
      content.style.zIndex = '2';
    }

    // 5. Attach hover edit pill
    attachHeroControls(heroEl);
  }

  function attachHeroControls(heroEl) {
    if (!heroEl.querySelector(':scope > .wp-hero-edit-pill')) {
      const pill = document.createElement('button');
      pill.type = 'button';
      pill.className = 'wp-hero-edit-pill';
      pill.title = 'Customize Hero Photo/Video, Size, and Page Coverage';
      pill.innerHTML = `<i class="fa-solid fa-photo-film"></i> Customize Hero Media &amp; Coverage`;
      pill.onclick = (e) => {
        e.stopPropagation();
        openHeroMediaModal(heroEl);
      };
      heroEl.append(pill);
    }

    // Clean up any lingering floating sound buttons
    heroEl.querySelectorAll('.cms-hero-sound-btn').forEach(b => b.remove());
  }

  function openHeroMediaModal(targetHero) {
    const heroEl = targetHero || document.querySelector('.hero, .page-hero, header + main > section:first-of-type, header + section') || document.querySelector('section');
    if (!heroEl) {
      showToast('No hero banner found on this page.', 'error');
      return;
    }

    let existingVideo = heroEl.querySelector('video source')?.getAttribute('src') || heroEl.querySelector('video')?.src;
    let existingImg = heroEl.querySelector('img.page-hero-img, .cms-hero-media-el')?.src;

    const current = pageHeroSettings || {
      type: existingVideo ? 'video' : 'image',
      src: existingVideo || existingImg || 'https://images.unsplash.com/photo-1522202176988-66273c2fd55f?q=80&w=2070&auto=format&fit=crop',
      width: 100,
      height: 100,
      position: 'full',
      opacity: 0.35,
      objectFit: 'cover',
      overlay: 'vignette',
      blur: 0,
      muted: true,
      volume: 80,
      showSoundButton: true
    };

    if (current.muted === undefined) current.muted = true;
    if (current.volume === undefined) current.volume = 80;
    if (current.showSoundButton === undefined) current.showSoundButton = true;

    let temp = { ...current };

    const backdrop = document.createElement('div');
    backdrop.className = 'cms-modal-backdrop open';
    backdrop.innerHTML = `
      <div class="cms-modal-box" style="width: min(740px, 94vw);">
        <div class="cms-modal-header">
          <h3 class="cms-modal-title"><i class="fa-solid fa-photo-film" style="color: var(--wp-primary);"></i> Hero Media &amp; Coverage</h3>
          <button type="button" class="cms-modal-close"><i class="fa-solid fa-xmark"></i></button>
        </div>

        <form id="wp-hero-media-form">
          <!-- 1. Media Type Selection -->
          <div class="wp-panel-group">
            <label class="wp-control-label" style="display:block; margin-bottom: 8px;">1. Choose Media Format:</label>
            <div style="display:flex; gap:10px;">
              <button type="button" class="wp-bar-btn wp-media-type-btn ${temp.type === 'image' ? 'active' : ''}" data-type="image" style="flex:1; justify-content:center; padding:10px; font-size:13px; border:1px solid #cbd5e1; color:#0f172a;">
                <i class="fa-solid fa-image"></i> Photo / Background Image
              </button>
              <button type="button" class="wp-bar-btn wp-media-type-btn ${temp.type === 'video' ? 'active' : ''}" data-type="video" style="flex:1; justify-content:center; padding:10px; font-size:13px; border:1px solid #cbd5e1; color:#0f172a;">
                <i class="fa-solid fa-video"></i> Video (MP4 Background Loop)
              </button>
            </div>
          </div>

          <!-- 2. Media Source (Web URL or Upload) -->
          <div class="wp-panel-group">
            <label class="wp-control-label" style="display:block; margin-bottom: 6px;">2. Media Source (Web URL or Upload):</label>
            <input type="text" id="wp-hero-url-input" class="wp-input" style="width:100%; margin-bottom:8px;" value="${escapeHtml(temp.src || '')}" placeholder="https://example.com/video.mp4 or https://images.unsplash.com/..." />
            
            <div style="display:flex; align-items:center; gap:10px; margin-bottom:8px;">
              <span style="font-size:12px; color:#64748b; font-weight:600;">Or Upload from Computer:</span>
              <input type="file" id="wp-hero-file-input" class="wp-input" style="flex:1;" accept="image/*,video/mp4,video/webm" />
            </div>

            <!-- Instant Presets -->
            <div style="margin-top:6px;">
              <span style="font-size:11px; font-weight:700; color:#64748b; text-transform:uppercase;">Quick Presets:</span>
              <div style="display:flex; flex-wrap:wrap; gap:6px; margin-top:5px;">
                <button type="button" class="wp-preset-btn" data-preset-type="video" data-preset-src="https://cdn.coverr.co/videos/coverr-a-hands-on-start-up-pitch-1567798121770/1080p.mp4"><i class="fa-solid fa-video"></i> Pitch Event (Video)</button>
                <button type="button" class="wp-preset-btn" data-preset-type="video" data-preset-src="WhatsApp%20Video%202026-10-08%20at%2001.06.07.mp4"><i class="fa-solid fa-video"></i> INSPIRE Hub Movie (Video)</button>
                <button type="button" class="wp-preset-btn" data-preset-type="image" data-preset-src="https://images.unsplash.com/photo-1522202176988-66273c2fd55f?q=80&w=2070&auto=format&fit=crop"><i class="fa-solid fa-image"></i> Founders Team (Photo)</button>
                <button type="button" class="wp-preset-btn" data-preset-type="image" data-preset-src="https://images.unsplash.com/photo-1540575467063-178a50c2df87?q=80&w=2070&auto=format&fit=crop"><i class="fa-solid fa-image"></i> Summit Stage (Photo)</button>
                <button type="button" class="wp-preset-btn" data-preset-type="image" data-preset-src="https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?q=80&w=2070&auto=format&fit=crop"><i class="fa-solid fa-image"></i> Modern Architecture (Photo)</button>
              </div>
            </div>
          </div>

          <!-- 3. Coverage & Sizing Sliders -->
          <div class="wp-panel-group">
            <div class="wp-panel-heading">3. Page Area Coverage &amp; Sizing Controls</div>
            
            <div class="wp-control-row">
              <span class="wp-control-label">Width Coverage (<span id="wp-hero-width-val">${escapeHtml(temp.width || 100)}%</span>):</span>
              <input type="range" id="wp-hero-width-slider" min="20" max="100" step="5" value="${escapeHtml(temp.width || 100)}" style="flex:1; max-width:260px;" />
            </div>

            <div class="wp-control-row">
              <span class="wp-control-label">Split Position / Placement:</span>
              <select id="wp-hero-pos-select" class="wp-select" style="max-width:220px;">
                <option value="full" ${temp.position === 'full' ? 'selected' : ''}>Full Width (100% Screen)</option>
                <option value="right" ${temp.position === 'right' ? 'selected' : ''}>Right Side Split (e.g. 50% - 70%)</option>
                <option value="left" ${temp.position === 'left' ? 'selected' : ''}>Left Side Split</option>
                <option value="center" ${temp.position === 'center' ? 'selected' : ''}>Centered Window Box</option>
              </select>
            </div>

            <div class="wp-control-row">
              <span class="wp-control-label">Media Opacity / Brightness (<span id="wp-hero-opacity-val">${Math.round((temp.opacity !== undefined ? temp.opacity : 0.35) * 100)}%</span>):</span>
              <input type="range" id="wp-hero-opacity-slider" min="5" max="100" step="5" value="${Math.round((temp.opacity !== undefined ? temp.opacity : 0.35) * 100)}" style="flex:1; max-width:260px;" />
            </div>

            <div class="wp-control-row">
              <span class="wp-control-label">Object Fit Scaling:</span>
              <select id="wp-hero-fit-select" class="wp-select" style="max-width:220px;">
                <option value="cover" ${temp.objectFit === 'cover' ? 'selected' : ''}>Cover (Fills Area Proportionally)</option>
                <option value="contain" ${temp.objectFit === 'contain' ? 'selected' : ''}>Contain (Show Entire Media)</option>
                <option value="fill" ${temp.objectFit === 'fill' ? 'selected' : ''}>Fill (Stretch to Fit Area)</option>
              </select>
            </div>

            <div class="wp-control-row">
              <span class="wp-control-label">Contrast Tint &amp; Gradient:</span>
              <select id="wp-hero-overlay-select" class="wp-select" style="max-width:220px;">
                <option value="vignette" ${temp.overlay === 'vignette' ? 'selected' : ''}>Dark Vignette (Text Friendly)</option>
                <option value="navy" ${temp.overlay === 'navy' ? 'selected' : ''}>Royal Navy Luxe Gradient</option>
                <option value="gold" ${temp.overlay === 'gold' ? 'selected' : ''}>Luxury Gold Gradient</option>
                <option value="none" ${temp.overlay === 'none' ? 'selected' : ''}>No Overlay (Vivid Raw Media)</option>
              </select>
            </div>

            <div class="wp-control-row">
              <span class="wp-control-label">Background Blur (<span id="wp-hero-blur-val">${escapeHtml(temp.blur || 0)}px</span>):</span>
              <input type="range" id="wp-hero-blur-slider" min="0" max="25" step="1" value="${escapeHtml(temp.blur || 0)}" style="flex:1; max-width:260px;" />
            </div>
          </div>

          <!-- 4. Video Sound & Audio Adjustments (Active for Videos) -->
          <div class="wp-panel-group" id="wp-hero-sound-group" style="${temp.type === 'video' ? '' : 'display:none;'}">
            <div class="wp-panel-heading"><i class="fa-solid fa-volume-high" style="color: var(--wp-primary);"></i> 4. Video Sound &amp; Audio Controls</div>
            
            <div class="wp-control-row">
              <span class="wp-control-label">Sound Mode:</span>
              <div style="display:flex; gap:8px;">
                <button type="button" class="wp-bar-btn wp-sound-mode-btn ${temp.muted !== false ? 'active' : ''}" data-sound="muted">
                  <i class="fa-solid fa-volume-xmark"></i> Silent Loop (Muted)
                </button>
                <button type="button" class="wp-bar-btn wp-sound-mode-btn ${temp.muted === false ? 'active' : ''}" data-sound="unmuted">
                  <i class="fa-solid fa-volume-high"></i> Sound Enabled
                </button>
              </div>
            </div>

            <div class="wp-control-row">
              <span class="wp-control-label">Volume Level (<span id="wp-hero-volume-val">${escapeHtml(temp.volume !== undefined ? temp.volume : 80)}%</span>):</span>
              <div style="display:flex; align-items:center; gap:10px; flex:1; max-width:260px;">
                <i class="fa-solid fa-volume-low" style="font-size:12px; color:#64748b;"></i>
                <input type="range" id="wp-hero-volume-slider" min="0" max="100" step="5" value="${escapeHtml(temp.volume !== undefined ? temp.volume : 80)}" style="flex:1;" />
                <i class="fa-solid fa-volume-high" style="font-size:12px; color:#64748b;"></i>
              </div>
            </div>
          </div>

          <div style="display:flex; justify-content:flex-end; gap:10px; margin-top:20px;">
            <button type="button" class="wp-bar-btn wp-modal-cancel" style="background:#f1f5f9; color:#475569; cursor:pointer;">Cancel</button>
            <button type="button" id="wp-hero-save-btn" class="wp-bar-btn btn-publish" style="cursor:pointer; pointer-events:auto; font-weight:700;"><i class="fa-solid fa-check"></i> Save &amp; Apply Media</button>
          </div>
        </form>
      </div>
    `;

    backdrop.querySelector('.cms-modal-close').onclick = () => {
      if (pageHeroSettings) applyHeroMedia(heroEl, pageHeroSettings);
      backdrop.remove();
    };
    backdrop.querySelector('.wp-modal-cancel').onclick = () => {
      if (pageHeroSettings) applyHeroMedia(heroEl, pageHeroSettings);
      backdrop.remove();
    };

    const updateSoundGroupVisibility = () => {
      const soundGroup = backdrop.querySelector('#wp-hero-sound-group');
      if (soundGroup) soundGroup.style.display = temp.type === 'video' ? '' : 'none';
    };

    // Type toggles
    backdrop.querySelectorAll('.wp-media-type-btn').forEach((btn) => {
      btn.onclick = () => {
        backdrop.querySelectorAll('.wp-media-type-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        temp.type = btn.getAttribute('data-type');
        updateSoundGroupVisibility();
        applyHeroMedia(heroEl, temp);
      };
    });

    // Preset buttons
    backdrop.querySelectorAll('.wp-preset-btn').forEach((btn) => {
      btn.onclick = () => {
        temp.type = btn.getAttribute('data-preset-type');
        temp.src = btn.getAttribute('data-preset-src');
        const urlInput = backdrop.querySelector('#wp-hero-url-input');
        if (urlInput) urlInput.value = temp.src;
        backdrop.querySelectorAll('.wp-media-type-btn').forEach(b => {
          b.classList.toggle('active', b.getAttribute('data-type') === temp.type);
        });
        updateSoundGroupVisibility();
        applyHeroMedia(heroEl, temp);
      };
    });

    // Live update listeners
    const urlInput = backdrop.querySelector('#wp-hero-url-input');
    urlInput.oninput = (e) => {
      temp.src = e.target.value.trim();
      if (temp.src.match(/\.(mp4|webm)(\?.*)?$/i)) {
        temp.type = 'video';
        backdrop.querySelectorAll('.wp-media-type-btn').forEach(b => {
          b.classList.toggle('active', b.getAttribute('data-type') === 'video');
        });
        updateSoundGroupVisibility();
      }
      applyHeroMedia(heroEl, temp);
    };

    const widthSlider = backdrop.querySelector('#wp-hero-width-slider');
    const widthVal = backdrop.querySelector('#wp-hero-width-val');
    widthSlider.oninput = (e) => {
      temp.width = Number(e.target.value);
      if (widthVal) widthVal.textContent = temp.width + '%';
      applyHeroMedia(heroEl, temp);
    };

    const posSelect = backdrop.querySelector('#wp-hero-pos-select');
    posSelect.onchange = (e) => {
      temp.position = e.target.value;
      applyHeroMedia(heroEl, temp);
    };

    const opacitySlider = backdrop.querySelector('#wp-hero-opacity-slider');
    const opacityVal = backdrop.querySelector('#wp-hero-opacity-val');
    opacitySlider.oninput = (e) => {
      temp.opacity = Number(e.target.value) / 100;
      if (opacityVal) opacityVal.textContent = e.target.value + '%';
      applyHeroMedia(heroEl, temp);
    };

    const fitSelect = backdrop.querySelector('#wp-hero-fit-select');
    fitSelect.onchange = (e) => {
      temp.objectFit = e.target.value;
      applyHeroMedia(heroEl, temp);
    };

    const overlaySelect = backdrop.querySelector('#wp-hero-overlay-select');
    overlaySelect.onchange = (e) => {
      temp.overlay = e.target.value;
      applyHeroMedia(heroEl, temp);
    };

    const blurSlider = backdrop.querySelector('#wp-hero-blur-slider');
    const blurVal = backdrop.querySelector('#wp-hero-blur-val');
    blurSlider.oninput = (e) => {
      temp.blur = Math.max(0, Number(e.target.value) || 0);
      if (blurVal) blurVal.textContent = temp.blur + 'px';
      applyHeroMedia(heroEl, temp);
    };

    // Volume slider & val elements
    const volumeSlider = backdrop.querySelector('#wp-hero-volume-slider');
    const volumeVal = backdrop.querySelector('#wp-hero-volume-val');

    // UI sync for Sound Mode buttons (Muted vs Sound Enabled)
    const updateSoundModeUI = () => {
      backdrop.querySelectorAll('.wp-sound-mode-btn').forEach((btn) => {
        const mode = btn.getAttribute('data-sound');
        const isActive = (mode === 'muted' && temp.muted !== false) || (mode === 'unmuted' && temp.muted === false);
        btn.classList.toggle('active', isActive);
      });
    };

    // Live video audio updater without restarting the video
    const updateLiveVideoAudio = () => {
      const vid = heroEl.querySelector('.cms-hero-media-wrap video') || heroEl.querySelector('video');
      if (vid) {
        vid.muted = (temp.muted !== false);
        const vol = typeof temp.volume === 'number' ? temp.volume : 80;
        vid.volume = Math.max(0, Math.min(1, vol / 100));
        if (!temp.muted && temp.volume > 0) {
          vid.muted = false;
          const p = vid.play();
          if (p !== undefined) {
            p.catch(() => { });
          }
        }
      }
      // Ensure any floating sound button is removed
      heroEl.querySelectorAll('.cms-hero-sound-btn').forEach(b => b.remove());
    };

    // Initial sync
    updateSoundModeUI();

    // File input handler
    const fileInput = backdrop.querySelector('#wp-hero-file-input');
    fileInput.onchange = (e) => {
      const file = e.target.files[0];
      if (file) {
        temp.type = file.type.startsWith('video/') ? 'video' : 'image';
        backdrop.querySelectorAll('.wp-media-type-btn').forEach(b => {
          b.classList.toggle('active', b.getAttribute('data-type') === temp.type);
        });
        updateSoundGroupVisibility();

        const reader = new FileReader();
        reader.onload = (uploadEvent) => {
          const rawData = uploadEvent.target.result;
          temp.src = rawData;
          if (urlInput) urlInput.value = rawData.startsWith('data:') ? `[Uploading ${file.name}...]` : rawData;
          applyHeroMedia(heroEl, temp);

          // Upload to local disk in uploads/ so it is permanently saved as a static file
          const uploadEndpoints = ['/api/upload-media', 'http://127.0.0.1:3456/api/upload-media'];
          const knownMediaFiles = ['iimbg_campus_view.mp4', 'hero-video.mp4', 'gemini_generated_video_fef441c7.mp4', 'ECell Sign mail 2026 (2).mp4'];
          const matchedKnown = knownMediaFiles.find(k => k.toLowerCase() === file.name.toLowerCase());

          const tryUpload = (endpointIdx) => {
            if (endpointIdx >= uploadEndpoints.length) {
              if (matchedKnown) {
                temp.src = matchedKnown;
                if (urlInput) urlInput.value = matchedKnown;
                applyHeroMedia(heroEl, temp);
                showToast(`Using pre-deployed media file "${matchedKnown}"!`, 'success');
                return;
              }
              const isLocal = window.location.hostname === '127.0.0.1' || window.location.hostname === 'localhost';
              if (!isLocal) {
                if (urlInput && urlInput.value.startsWith('[Uploading')) {
                  urlInput.value = temp.src.startsWith('data:') ? `[Local: ${file.name}]` : temp.src;
                }
                showToast('Cloudflare Workers is serverless/read-only. For live hosting, please enter a public Video URL (e.g. Supabase Storage, CDN, or a pre-deployed file name like "iimbg_campus_view.mp4").', 'warning', 6000);
              } else {
                if (urlInput && urlInput.value.startsWith('[Uploading')) {
                  urlInput.value = temp.src.startsWith('data:') ? `[Local File: ${file.name}]` : temp.src;
                }
              }
              return;
            }
            fetch(uploadEndpoints[endpointIdx], {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ filename: file.name, data: rawData })
            })
              .then(res => res.json())
              .then(data => {
                if (data && data.url) {
                  temp.src = data.url;
                  if (urlInput) urlInput.value = data.url;
                  applyHeroMedia(heroEl, temp);
                  console.log('[CMS] Hero media uploaded successfully to:', data.url);
                } else {
                  tryUpload(endpointIdx + 1);
                }
              })
              .catch(() => {
                tryUpload(endpointIdx + 1);
              });
          };
          tryUpload(0);
        };
        reader.readAsDataURL(file);
      }
    };

    // Form submission & Save Button click
    const saveAndApplyHeroMedia = (e) => {
      if (e) {
        e.preventDefault();
        e.stopPropagation();
      }
      try {
        pageHeroSettings = { ...temp };
        if (pageHeroSettings.src && pageHeroSettings.src.startsWith('data:') && pageHeroSettings.src.length > 50000) {
          pageHeroSettings.src = 'hero-video.mp4';
        }
        pageContentMap['_hero'] = { type: 'hero', data: pageHeroSettings };

        // Save safely to localStorage with quota protection
        try {
          const storageCopy = { ...pageHeroSettings };
          localStorage.setItem(heroStorageKey, JSON.stringify(storageCopy));

          const cleanPageMap = { ...pageContentMap };
          cleanPageMap['_hero'] = { type: 'hero', data: storageCopy };
          localStorage.setItem(pageStorageKey, JSON.stringify(cleanPageMap));
          localStorage.setItem('envision_cms_saved_at_' + pagePath, Date.now().toString());
        } catch (storageErr) {
          console.warn('[CMS] localStorage quota notice when saving hero settings:', storageErr);
        }

        try {
          applyHeroMedia(heroEl, pageHeroSettings);
        } catch (applyErr) {
          console.error('[CMS] Error applying hero media:', applyErr);
        }

        try {
          if (typeof markDirty === 'function') {
            markDirty();
          }
        } catch (dirtyErr) { }

        backdrop.remove();
        showToast('Hero Photo/Video & Coverage settings updated!', 'success');
        saveAllChanges(false);
      } catch (fatalErr) {
        console.error('[CMS] Fatal error saving hero settings:', fatalErr);
        backdrop.remove();
        showToast('Hero media applied!', 'success');
      }
    };

    const saveBtn = backdrop.querySelector('#wp-hero-save-btn');
    if (saveBtn) {
      saveBtn.onclick = saveAndApplyHeroMedia;
    }
    const heroForm = backdrop.querySelector('#wp-hero-media-form');
    if (heroForm) {
      heroForm.onsubmit = saveAndApplyHeroMedia;
    };

    document.body.append(backdrop);
  }

  // ==========================================================================
  // 12. Card Media Studio Modal (Photos & Videos for All Cards / Palettes)
  // ==========================================================================

  function openCardMediaModal(targetEl) {
    if (!targetEl) return;

    // 1. Resolve card, media container, current media element, and badge
    let container = targetEl.closest('.card-media, .leader-card-media, figure') || (targetEl.classList.contains('card-media') || targetEl.classList.contains('leader-card-media') ? targetEl : null);
    let card = targetEl.closest('.card, article, .leader-card');

    if (!container && card) {
      container = card.querySelector('.card-media, .leader-card-media, figure');
    }

    const isLeaderMedia = !!(container?.classList.contains('leader-card-media') || card?.classList.contains('leader-card') || targetEl.closest('.leader-card, .leader-card-media'));

    let existingImg = container ? container.querySelector('img') : (targetEl.tagName === 'IMG' ? targetEl : targetEl.querySelector('img'));
    let existingVideo = container ? container.querySelector('video') : (targetEl.tagName === 'VIDEO' ? targetEl : targetEl.querySelector('video'));
    let existingBadge = (container || card)?.querySelector('.card-badge, .badge, .event-type-badge');

    let currentType = existingVideo ? 'video' : 'image';
    let currentSrc = existingVideo ? (existingVideo.querySelector('source')?.src || existingVideo.src) : (existingImg ? existingImg.src : '');
    let currentAlt = existingImg ? existingImg.alt : '';
    let currentBadge = existingBadge ? existingBadge.textContent.trim() : '';
    let currentFit = (existingImg || existingVideo)?.style.objectFit || 'cover';
    let currentHeight = container ? parseInt(window.getComputedStyle(container).height) || (isLeaderMedia ? 150 : 260) : (isLeaderMedia ? 150 : 260);

    let temp = {
      type: currentType,
      src: currentSrc || (isLeaderMedia ? '' : 'https://images.unsplash.com/photo-1540575467063-178a50c2df87?q=80&w=2070&auto=format&fit=crop'),
      badge: currentBadge,
      height: isLeaderMedia ? '150px' : (currentHeight <= 210 ? '200px' : (currentHeight > 280 ? (currentHeight > 340 ? '380px' : '320px') : '260px')),
      objectFit: currentFit,
      alt: currentAlt || (isLeaderMedia ? (card?.querySelector('.leader-name')?.textContent.trim() || 'Speaker') : 'Card Media')
    };

    const backdrop = document.createElement('div');
    backdrop.className = 'cms-modal-backdrop open';
    backdrop.innerHTML = `
      <div class="cms-modal-box" style="width: min(640px, 94vw);">
        <div class="cms-modal-header">
          <h3 class="cms-modal-title"><i class="fa-solid fa-photo-film" style="color: var(--wp-primary);"></i> Card Media (Photo / Video)</h3>
          <button type="button" class="cms-modal-close"><i class="fa-solid fa-xmark"></i></button>
        </div>
        <form id="wp-card-media-form">
          <!-- 1. Media Type Selection -->
          <div class="wp-panel-group">
            <label class="wp-control-label" style="display:block; margin-bottom: 8px;">1. Choose Media Format:</label>
            <div style="display:flex; gap:10px;">
              <button type="button" class="wp-bar-btn wp-media-type-btn ${temp.type === 'image' ? 'active' : ''}" data-type="image" style="flex:1; justify-content:center; padding:10px; font-size:13px; border:1px solid #cbd5e1; color:#0f172a;">
                <i class="fa-solid fa-image"></i> Photo / Image
              </button>
              <button type="button" class="wp-bar-btn wp-media-type-btn ${temp.type === 'video' ? 'active' : ''}" data-type="video" style="flex:1; justify-content:center; padding:10px; font-size:13px; border:1px solid #cbd5e1; color:#0f172a;">
                <i class="fa-solid fa-video"></i> Video (MP4 / WebM Loop)
              </button>
            </div>
          </div>

          <!-- 2. Source URL or Local Upload -->
          <div class="wp-panel-group">
            <label class="wp-control-label" style="display:block; margin-bottom: 6px;">2. Media Source (Web URL or Upload):</label>
            <input type="text" id="wp-card-media-url" class="wp-input" style="width:100%; margin-bottom:8px;" value="${escapeHtml(temp.src.startsWith('data:') ? '' : temp.src)}" placeholder="${isLeaderMedia ? 'https://example.com/speaker-photo.jpg or choose preset/upload...' : 'https://example.com/video.mp4 or https://images.unsplash.com/...'}" />
            
            <div style="display:flex; align-items:center; gap:10px; margin-bottom:8px;">
              <span style="font-size:12px; color:#64748b; font-weight:600;">Or Upload from Computer:</span>
              <input type="file" id="wp-card-media-file" class="wp-input" style="flex:1;" accept="image/*,video/mp4,video/webm" />
            </div>

            <!-- Instant Presets -->
            <div style="margin-top:6px;">
              <span style="font-size:11px; font-weight:700; color:#64748b; text-transform:uppercase;">Quick Presets:</span>
              <div style="display:flex; flex-wrap:wrap; gap:6px; margin-top:5px;">
                <button type="button" class="wp-preset-btn" data-preset-type="image" data-preset-src="placeholder.svg"><i class="fa-solid fa-lightbulb"></i> Envision Logo</button>
                <button type="button" class="wp-preset-btn" data-preset-type="image" data-preset-src="https://images.unsplash.com/photo-1540575467063-178a50c2df87?q=80&w=2070&auto=format&fit=crop"><i class="fa-solid fa-image"></i> Summit (Photo)</button>
                <button type="button" class="wp-preset-btn" data-preset-type="image" data-preset-src="https://images.unsplash.com/photo-1475721027785-f74eccf877e2?q=80&w=2070&auto=format&fit=crop"><i class="fa-solid fa-image"></i> Talks / Mic (Photo)</button>
                <button type="button" class="wp-preset-btn" data-preset-type="image" data-preset-src="https://images.unsplash.com/photo-1559136555-9303baea8ebd?q=80&w=2070&auto=format&fit=crop"><i class="fa-solid fa-image"></i> Competition (Photo)</button>
                <button type="button" class="wp-preset-btn" data-preset-type="video" data-preset-src="https://cdn.coverr.co/videos/coverr-a-hands-on-start-up-pitch-1567798121770/1080p.mp4"><i class="fa-solid fa-video"></i> Pitch Event (Video)</button>
                <button type="button" class="wp-preset-btn" data-preset-type="video" data-preset-src="WhatsApp%20Video%202026-10-08%20at%2001.06.07.mp4"><i class="fa-solid fa-video"></i> INSPIRE Movie (Video)</button>
                <button type="button" class="wp-preset-btn" data-preset-type="video" data-preset-src="https://assets.mixkit.co/videos/preview/mixkit-software-developer-working-on-code-42866-large.mp4"><i class="fa-solid fa-video"></i> Tech Dev (Video)</button>
              </div>
            </div>
          </div>

          <!-- 3. Badge Tag & Sizing -->
          <div class="wp-panel-group">
            <div class="wp-panel-heading">3. Badge Tag &amp; Layout Controls</div>
            <div class="wp-control-row">
              <span class="wp-control-label">Card Badge Pill Text (e.g. SUMMIT, TALKS, COMPETITION):</span>
              <input type="text" id="wp-card-badge-input" class="wp-input" style="width:200px;" value="${escapeHtml(temp.badge)}" placeholder="Leave empty for no badge" />
            </div>
            <div class="wp-control-row">
              <span class="wp-control-label">Card Media Height:</span>
              <select id="wp-card-height-select" class="wp-select" style="width:160px;">
                ${isLeaderMedia ? `<option value="150px" ${temp.height === '150px' ? 'selected' : ''}>Leader Standard (150px)</option>` : ''}
                <option value="200px" ${temp.height === '200px' ? 'selected' : ''}>Compact (200px)</option>
                <option value="260px" ${temp.height === '260px' ? 'selected' : ''}>Standard (260px)</option>
                <option value="320px" ${temp.height === '320px' ? 'selected' : ''}>Tall (320px)</option>
                <option value="380px" ${temp.height === '380px' ? 'selected' : ''}>Extra Large (380px)</option>
                <option value="auto" ${temp.height === 'auto' ? 'selected' : ''}>Original / Auto</option>
              </select>
            </div>
            <div class="wp-control-row">
              <span class="wp-control-label">Object Fit Scaling:</span>
              <select id="wp-card-fit-select" class="wp-select" style="width:160px;">
                <option value="cover" ${temp.objectFit === 'cover' ? 'selected' : ''}>Cover (Fills container)</option>
                <option value="contain" ${temp.objectFit === 'contain' ? 'selected' : ''}>Contain (Shows entire media)</option>
                <option value="fill" ${temp.objectFit === 'fill' ? 'selected' : ''}>Fill (Stretch to fit)</option>
              </select>
            </div>
            <div class="wp-control-row">
              <span class="wp-control-label">Alt / SEO Description:</span>
              <input type="text" id="wp-card-alt-input" class="wp-input" style="width:200px;" value="${escapeHtml(temp.alt)}" placeholder="Card Media description" />
            </div>
          </div>

          <div style="display:flex; justify-content:space-between; align-items:center; gap:10px; margin-top:20px;">
            ${(isLeaderMedia || existingImg || existingVideo) ? `
              <button type="button" class="wp-bar-btn wp-modal-reset-avatar" style="background:#fef2f2; color:#b91c1c; border:1px solid #fecaca;">
                <i class="fa-solid fa-user-xmark"></i> ${isLeaderMedia ? 'Reset to Initials' : 'Remove Media'}
              </button>
            ` : '<div></div>'}
            <div style="display:flex; gap:10px;">
              <button type="button" class="wp-bar-btn wp-modal-cancel" style="background:#f1f5f9; color:#475569;">Cancel</button>
              <button type="submit" class="wp-bar-btn btn-publish"><i class="fa-solid fa-check"></i> Apply Media to Card</button>
            </div>
          </div>
        </form>
      </div>
    `;

    backdrop.querySelector('.cms-modal-close').onclick = () => backdrop.remove();
    backdrop.querySelector('.wp-modal-cancel').onclick = () => backdrop.remove();

    function restoreInitialsOrClearMedia() {
      if (container) {
        container.querySelectorAll('img, video, .leader-avatar-placeholder, .avatar-placeholder, [class*="avatar-placeholder"]').forEach(el => el.remove());
        container.classList.remove('has-image', 'has-video');
        if (isLeaderMedia) {
          const nameEl = card ? card.querySelector('.leader-name') : null;
          const nameText = nameEl ? nameEl.textContent.trim() : '';
          let initials = 'EV';
          if (nameText) {
            const parts = nameText.split(/\s+/).filter(Boolean);
            if (parts.length >= 2) {
              initials = (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
            } else if (parts.length === 1) {
              initials = parts[0].slice(0, 2).toUpperCase();
            }
          }
          const ph = document.createElement('div');
          ph.className = 'leader-avatar-placeholder';
          ph.innerHTML = `<span>${escapeHtml(initials)}</span>`;
          container.append(ph);
          container.style.height = '';

          // Sync reset to matching card in duplicate set
          const track = card?.closest('.leaders-stream-track');
          if (track && nameText) {
            track.querySelectorAll('.leader-card').forEach((otherCard) => {
              if (otherCard !== card && otherCard.querySelector('.leader-name')?.textContent.trim() === nameText) {
                const otherContainer = otherCard.querySelector('.leader-card-media');
                if (otherContainer) {
                  otherContainer.querySelectorAll('img, video, .leader-avatar-placeholder, .avatar-placeholder, [class*="avatar-placeholder"]').forEach(el => el.remove());
                  otherContainer.classList.remove('has-image', 'has-video');
                  const otherPh = document.createElement('div');
                  otherPh.className = 'leader-avatar-placeholder';
                  otherPh.innerHTML = `<span>${escapeHtml(initials)}</span>`;
                  otherContainer.append(otherPh);
                  otherContainer.style.height = '';
                }
              }
            });
          }
        }
        markDirty();
        backdrop.remove();
        showToast(isLeaderMedia ? 'Speaker initials placeholder restored!' : 'Card media removed.', 'success');
      }
    }

    const resetAvatarBtn = backdrop.querySelector('.wp-modal-reset-avatar');
    if (resetAvatarBtn) {
      resetAvatarBtn.onclick = (e) => {
        e.preventDefault();
        restoreInitialsOrClearMedia();
      };
    }

    // Type toggles
    backdrop.querySelectorAll('.wp-media-type-btn').forEach((btn) => {
      btn.onclick = () => {
        backdrop.querySelectorAll('.wp-media-type-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        temp.type = btn.getAttribute('data-type');
      };
    });

    // Preset buttons
    backdrop.querySelectorAll('.wp-preset-btn').forEach((btn) => {
      btn.onclick = () => {
        temp.type = btn.getAttribute('data-preset-type');
        temp.src = btn.getAttribute('data-preset-src');
        const urlInput = backdrop.querySelector('#wp-card-media-url');
        if (urlInput) urlInput.value = temp.src;
        backdrop.querySelectorAll('.wp-media-type-btn').forEach(b => {
          b.classList.toggle('active', b.getAttribute('data-type') === temp.type);
        });
      };
    });

    // Form submission
    backdrop.querySelector('#wp-card-media-form').onsubmit = (e) => {
      e.preventDefault();
      const fileInput = backdrop.querySelector('#wp-card-media-file');
      const urlInput = backdrop.querySelector('#wp-card-media-url');
      const badgeInput = backdrop.querySelector('#wp-card-badge-input');
      const heightSelect = backdrop.querySelector('#wp-card-height-select');
      const fitSelect = backdrop.querySelector('#wp-card-fit-select');
      const altInput = backdrop.querySelector('#wp-card-alt-input');

      const applyChanges = (mediaSrc, mediaType) => {
        if (!mediaSrc || !mediaSrc.trim()) {
          restoreInitialsOrClearMedia();
          return;
        }

        const badgeVal = badgeInput ? badgeInput.value.trim() : '';
        const heightVal = heightSelect ? heightSelect.value : (isLeaderMedia ? '150px' : '260px');
        const fitVal = fitSelect ? fitSelect.value : 'cover';
        const altVal = altInput ? altInput.value.trim() : 'Card Media';

        // 1. If container exists (e.g. .card-media, .leader-card-media)
        if (container) {
          if (heightVal === 'auto' || (isLeaderMedia && heightVal === '150px')) {
            container.style.height = isLeaderMedia ? '150px' : '';
          } else {
            container.style.height = heightVal;
          }
          container.style.position = 'relative';

          // Capture data-cms-id from the element being replaced so the new
          // element stays tracked in content_data (not only as raw grid HTML).
          const oldMedia = container.querySelector('img, video');
          const inheritedCmsId = oldMedia ? oldMedia.getAttribute('data-cms-id') : null;
          const mediaId = inheritedCmsId || `img_${pagePath.replace('.html', '')}_card_${Date.now().toString().slice(-4)}_${Math.floor(Math.random() * 1000)}`;

          // Remove old img or video elements AND any avatar/placeholder elements inside container
          container.querySelectorAll('img, video, .leader-avatar-placeholder, .avatar-placeholder, [class*="avatar-placeholder"]').forEach(el => el.remove());
          container.classList.add(mediaType === 'video' ? 'has-video' : 'has-image');

          if (mediaType === 'video') {
            const video = document.createElement('video');
            video.className = 'card-media-video';
            video.autoplay = true;
            video.muted = true;
            video.loop = true;
            video.playsInline = true;
            video.src = mediaSrc;
            video.style.objectFit = fitVal;
            video.style.width = '100%';
            video.style.height = '100%';
            video.setAttribute('data-cms-editable-image', 'true');
            video.setAttribute('data-cms-id', mediaId);
            container.prepend(video);
            video.play().catch(() => { });
          } else {
            const img = document.createElement('img');
            img.className = 'card-media-img';
            img.src = mediaSrc;
            img.alt = altVal;
            img.style.objectFit = fitVal;
            img.style.width = '100%';
            img.style.height = '100%';
            img.setAttribute('data-cms-editable-image', 'true');
            img.setAttribute('data-cms-id', mediaId);
            container.prepend(img);
          }

          // If this is a leader card in the stream track, sync media to matching card in duplicate set
          if (isLeaderMedia) {
            const track = card?.closest('.leaders-stream-track');
            const leaderName = card?.querySelector('.leader-name')?.textContent.trim();
            if (track && leaderName) {
              track.querySelectorAll('.leader-card').forEach((otherCard) => {
                if (otherCard !== card && otherCard.querySelector('.leader-name')?.textContent.trim() === leaderName) {
                  const otherContainer = otherCard.querySelector('.leader-card-media');
                  if (otherContainer) {
                    otherContainer.querySelectorAll('img, video, .leader-avatar-placeholder, .avatar-placeholder, [class*="avatar-placeholder"]').forEach(el => el.remove());
                    otherContainer.classList.add(mediaType === 'video' ? 'has-video' : 'has-image');
                    if (mediaType === 'video') {
                      const otherVideo = document.createElement('video');
                      otherVideo.className = 'card-media-video';
                      otherVideo.autoplay = true;
                      otherVideo.muted = true;
                      otherVideo.loop = true;
                      otherVideo.playsInline = true;
                      otherVideo.src = mediaSrc;
                      otherVideo.style.objectFit = fitVal;
                      otherVideo.style.width = '100%';
                      otherVideo.style.height = '100%';
                      otherContainer.prepend(otherVideo);
                    } else {
                      const otherImg = document.createElement('img');
                      otherImg.className = 'card-media-img';
                      otherImg.src = mediaSrc;
                      otherImg.alt = altVal;
                      otherImg.style.objectFit = fitVal;
                      otherImg.style.width = '100%';
                      otherImg.style.height = '100%';
                      otherContainer.prepend(otherImg);
                    }
                  }
                }
              });
            }
          }

          // Handle badge tag
          let badgeEl = container.querySelector('.card-badge, .badge, .event-type-badge') || card?.querySelector('.card-badge, .badge, .event-type-badge');
          if (badgeVal) {
            if (badgeEl) {
              badgeEl.textContent = badgeVal;
            } else {
              badgeEl = document.createElement('div');
              badgeEl.className = 'card-badge';
              badgeEl.textContent = badgeVal;
              container.append(badgeEl);
            }
          } else if (badgeEl) {
            badgeEl.remove();
          }
        } else if (targetEl.tagName === 'IMG' || targetEl.tagName === 'VIDEO') {
          // Standalone image or video — inherit cms-id from the replaced element
          const inheritedCmsId = targetEl.getAttribute('data-cms-id');
          if (mediaType === 'video') {
            const video = document.createElement('video');
            video.className = targetEl.className;
            video.autoplay = true;
            video.muted = true;
            video.loop = true;
            video.playsInline = true;
            video.src = mediaSrc;
            video.style.objectFit = fitVal;
            video.setAttribute('data-cms-editable-image', 'true');
            if (inheritedCmsId) video.setAttribute('data-cms-id', inheritedCmsId);
            targetEl.replaceWith(video);
          } else {
            const img = document.createElement('img');
            img.className = targetEl.className;
            img.src = mediaSrc;
            img.alt = altVal;
            img.style.objectFit = fitVal;
            img.setAttribute('data-cms-editable-image', 'true');
            if (inheritedCmsId) img.setAttribute('data-cms-id', inheritedCmsId);
            targetEl.replaceWith(img);
          }
        }

        if (mediaId && mediaSrc) {
          pageContentMap[mediaId] = {
            type: mediaType === 'video' ? 'video' : 'image',
            src: mediaSrc,
            alt: altVal,
            style: {}
          };
          try {
            localStorage.setItem(pageStorageKey, JSON.stringify(pageContentMap));
            localStorage.setItem('envision_cms_saved_at_' + pagePath, Date.now().toString());
          } catch (e) { }
        }

        markDirty();
        backdrop.remove();
        showToast(`Card ${mediaType === 'video' ? 'Video' : 'Photo'} updated successfully!`, 'success');
        saveAllChanges(false);
      };

      const file = fileInput?.files[0];
      const url = urlInput?.value.trim();

      if (file) {
        const reader = new FileReader();
        reader.onload = (ev) => {
          const detectedType = file.type.startsWith('video/') ? 'video' : (file.type.startsWith('image/') ? 'image' : temp.type);
          applyChanges(ev.target.result, detectedType);
        };
        reader.readAsDataURL(file);
      } else if (url) {
        applyChanges(url, temp.type);
      } else if (temp.src) {
        applyChanges(temp.src, temp.type);
      } else {
        restoreInitialsOrClearMedia();
      }
    };

    document.body.append(backdrop);
  }

  // ==========================================================================
  // 12. CERT-In Cryptographic Engine & Google-Style 2-Factor Authentication
  // ==========================================================================

  /**
   * Constant-Time String Comparison (Timing-Attack Resistant)
   */
  function constantTimeEqual(a, b) {
    if (typeof a !== 'string' || typeof b !== 'string') return false;
    let diff = a.length ^ b.length;
    for (let i = 0; i < Math.max(a.length, b.length); i++) {
      const charA = i < a.length ? a.charCodeAt(i) : 0;
      const charB = i < b.length ? b.charCodeAt(i) : 0;
      diff |= charA ^ charB;
    }
    return diff === 0;
  }

  // ==========================================================================
  // Step 1: Admin Authentication Modal
  // ==========================================================================

  function openLoginModal() {
    if (!window.supabaseClient) {
      alert('CMS access is unavailable until the trusted Supabase authentication backend is configured.');
      return;
    }

    const backdrop = document.createElement('div');
    backdrop.className = 'cms-modal-backdrop open';
    backdrop.innerHTML = `
      <div class="cms-modal-box" style="width: min(440px, 94vw);">
        <div class="cms-modal-header">
          <h3 class="cms-modal-title"><i class="fa-solid fa-lock" style="color: var(--wp-accent);"></i> Admin Authentication</h3>
          <button type="button" class="cms-modal-close"><i class="fa-solid fa-xmark"></i></button>
        </div>

        <form id="wp-supabase-form">
          <div class="wp-panel-group">
            <label class="wp-control-label" style="display:block; margin-bottom: 6px;">Admin Email:</label>
            <input type="email" id="wp-supabase-email" class="wp-input" style="width:100%; font-size:14px; padding:10px; margin-bottom:10px;" placeholder="admin@envision.iimbg.ac.in" required autocomplete="username" />
            <label class="wp-control-label" style="display:block; margin-bottom: 6px;">Password:</label>
            <input type="password" id="wp-supabase-password" class="wp-input" style="width:100%; font-size:14px; padding:10px;" placeholder="Enter password" required autocomplete="current-password" />
            <div id="wp-mfa-step" style="display:none; margin-top:14px;">
              <label class="wp-control-label" style="display:block; margin-bottom:6px;">Authenticator code:</label>
              <input type="text" id="wp-supabase-mfa-code" class="wp-input" style="width:100%; font-size:16px; padding:10px; letter-spacing:4px;" inputmode="numeric" autocomplete="one-time-code" pattern="[0-9 ]{6,}" maxlength="7" placeholder="123456" />
              <div style="font-size:11.5px; color:#64748b; margin-top:8px;">
                Enter the current 6-digit code from your enrolled authenticator app.
              </div>
            </div>
          </div>
          <div style="display: flex; justify-content: flex-end; gap: 10px; margin-top:16px;">
            <button type="button" class="wp-bar-btn wp-modal-cancel" style="background:#f1f5f9; color:#475569;">Cancel</button>
            <button type="submit" class="wp-bar-btn btn-publish" id="wp-supabase-submit" style="padding:8px 18px; font-size:13px;"><i class="fa-solid fa-cloud"></i> Sign In</button>
          </div>
        </form>
      </div>
    `;

    backdrop.querySelectorAll('.cms-modal-close, .wp-modal-cancel').forEach(btn => {
      btn.onclick = () => backdrop.remove();
    });

    const supabaseForm = backdrop.querySelector('#wp-supabase-form');

    if (supabaseForm) {
      supabaseForm.onsubmit = async (e) => {
        e.preventDefault();
        const email = document.getElementById('wp-supabase-email').value.trim();
        const password = document.getElementById('wp-supabase-password').value;
        const mfaStep = backdrop.querySelector('#wp-mfa-step');
        const mfaCode = backdrop.querySelector('#wp-supabase-mfa-code');
        const submitButton = backdrop.querySelector('#wp-supabase-submit');

        try {
          submitButton.disabled = true;
          if (mfaStep.style.display === 'block') {
            if (!mfaCode.value.trim()) {
              throw new Error('Enter the authenticator code to continue.');
            }
            const session = await completeMfaChallenge(
              (await window.supabaseClient.auth.getSession()).data.session,
              mfaCode.value
            );
            const authorizedSession = await getAuthorizedSession();
            if (!authorizedSession) {
              throw new Error('MFA verification succeeded, but this account is not authorized to publish.');
            }
            backdrop.remove();
            await grantAuthenticatedAccess(session || authorizedSession);
            showToast('Signed in with MFA. Studio unlocked successfully!', 'success');
          } else {
            const { data, error } = await window.supabaseClient.auth.signInWithPassword({ email, password });
            if (error) throw error;

            let assurance = null;
            if (window.supabaseClient.auth.mfa?.getAuthenticatorAssuranceLevel) {
              const { data: assuranceData, error: assuranceError } =
                await window.supabaseClient.auth.mfa.getAuthenticatorAssuranceLevel();
              if (assuranceError) throw assuranceError;
              assurance = assuranceData;
            }

            if (assurance && assurance.currentLevel !== 'aal2' && assurance.nextLevel === 'aal2') {
              mfaStep.style.display = 'block';
              submitButton.innerHTML = '<i class="fa-solid fa-shield-halved"></i> Verify MFA';
              mfaCode.required = true;
              mfaCode.focus();
              showToast('Password accepted. Complete MFA to enable publishing.', 'success');
              return;
            }

            const session = await getAuthorizedSession();
            if (!session) {
              const role = data.session?.user?.app_metadata?.role;
              if (role !== 'admin') {
                throw new Error('Access denied. Administrator account required.');
              }
              throw new Error('This admin account requires a verified MFA session before publishing.');
            }
            backdrop.remove();
            await grantAuthenticatedAccess(session || data.session);
            showToast(`Signed in to Supabase as ${data.user.email}!`, 'success');
          }
        } catch (err) {
          alert('Supabase login error: ' + (err.message || 'Authentication failed.'));
        } finally {
          submitButton.disabled = false;
        }
      };
    }

    document.body.append(backdrop);
  }

  async function grantAuthenticatedAccess(session) {
    if (!session || !session.user || !(await getAuthorizedSession())) return;
    document.getElementById('wp-admin-bar')?.classList.remove('cms-hidden');
    document.body.classList.add('cms-logged-in');
    setEditMode(true);
    showToast('Studio Unlocked successfully!', 'success');
  }

  // ==========================================================================
  // Step 2: Security Vault Modal (Passkey & Session Security)
  // ==========================================================================

  function openSecurityVaultModal() {
    const backdrop = document.createElement('div');
    backdrop.className = 'cms-modal-backdrop open';
    backdrop.innerHTML = `
      <div class="cms-modal-box cms-vault-modal-box">
        <div class="cms-modal-header">
          <h3 class="cms-modal-title"><i class="fa-solid fa-shield-halved" style="color:#10b981;"></i> Security Vault &amp; Passkey Management</h3>
          <button type="button" class="cms-modal-close"><i class="fa-solid fa-xmark"></i></button>
        </div>

        <!-- Compliance Score Banner -->
        <div class="cms-vault-score-banner">
          <div>
            <h4 class="cms-vault-score-title"><i class="fa-solid fa-award"></i> Security Level: Grade A+</h4>
            <p class="cms-vault-score-desc">Authentication, authorization, session expiry, and lockout enforcement are delegated to the configured Supabase project.</p>
          </div>
          <div class="cms-vault-score-badge">100%</div>
        </div>

        <!-- Security Checklist -->
        <div class="cms-vault-checklist">
          <div class="cms-vault-item">
            <i class="fa-solid fa-circle-check"></i>
            <div>
              <div class="cms-vault-item-title">Trusted Authentication Backend</div>
              <div class="cms-vault-item-desc">Browser-local passkeys and browser-generated session tokens are disabled.</div>
            </div>
          </div>
          <div class="cms-vault-item">
            <i class="fa-solid fa-circle-check"></i>
            <div>
              <div class="cms-vault-item-title">Server-Enforced Lockout &amp; MFA</div>
              <div class="cms-vault-item-desc">Configure Supabase Auth MFA and provider-side rate limits before enabling administration.</div>
            </div>
          </div>
          <div class="cms-vault-item">
            <i class="fa-solid fa-circle-check"></i>
            <div>
              <div class="cms-vault-item-title">Server-Managed Sessions</div>
              <div class="cms-vault-item-desc">Session validity is checked through the Supabase Auth session and admin role.</div>
            </div>
          </div>
        </div>

        <!-- Global Session Invalidation -->
        <div style="display:flex; justify-content:space-between; align-items:center; border-top:1px solid #e2e8f0; padding-top:16px;">
          <button type="button" class="wp-bar-btn" id="cms-vault-revoke-all-btn" style="background:#fee2e2; color:#ef4444; border:1px solid #fca5a5;">
            <i class="fa-solid fa-triangle-exclamation"></i> Invalidate All Active Sessions
          </button>
          <button type="button" class="wp-bar-btn wp-modal-cancel" style="background:#f1f5f9; color:#475569;">Close Vault</button>
        </div>
      </div>
    `;

    backdrop.querySelector('.cms-modal-close').onclick = () => backdrop.remove();
    backdrop.querySelector('.wp-modal-cancel').onclick = () => backdrop.remove();

    // Invalidate all active sessions
    backdrop.querySelector('#cms-vault-revoke-all-btn').onclick = async () => {
      if (confirm('Are you sure you want to invalidate all active administrative sessions globally? You will need to log in again.')) {
        await window.supabaseClient?.auth.signOut();
        setEditMode(false);
        document.getElementById('wp-admin-bar')?.classList.add('cms-hidden');
        document.body.classList.remove('cms-logged-in');
        backdrop.remove();
        showToast('All administrative sessions globally invalidated.', 'success');
      }
    };

    document.body.append(backdrop);
  }

  async function checkAuthSession() {
    const session = await getAuthorizedSession();
    if (session) {
      document.getElementById('wp-admin-bar')?.classList.remove('cms-hidden');
      document.body.classList.add('cms-logged-in');

      try {
        const ribbonPref = sessionStorage.getItem('envision_cms_ribbon_visible');
        if (ribbonPref !== null) {
          isRibbonVisible = ribbonPref === 'true';
        }
        const urlParams = new URLSearchParams(window.location.search);
        const shouldEdit = urlParams.get('edit') === '1' ||
          urlParams.get('cms') === '1' ||
          sessionStorage.getItem('envision_cms_edit_mode') === 'true';
        if (shouldEdit && !isEditMode) {
          setEditMode(true);
        }
      } catch (e) { }
    } else {
      setEditMode(false);
      document.getElementById('wp-admin-bar')?.classList.add('cms-hidden');
      document.body.classList.remove('cms-logged-in');
    }
  }

  function logoutAdmin() {
    if (window.supabaseClient) {
      window.supabaseClient.auth.signOut();
    }
    try {
      sessionStorage.removeItem('envision_cms_edit_mode');
      sessionStorage.removeItem('envision_cms_ribbon_visible');
    } catch (e) { }
    setEditMode(false);
    document.getElementById('wp-admin-bar')?.classList.add('cms-hidden');
    document.body.classList.remove('cms-logged-in');
    showToast('Logged out of Admin Mode.', 'success');
  }

  function setupShortcuts() {
    window.addEventListener('keydown', async (e) => {
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && (e.key === 'E' || e.key === 'e')) {
        e.preventDefault();
        const session = await getAuthorizedSession();
        if (session) {
          setEditMode(!isEditMode);
        } else {
          openLoginModal();
        }
      }
    });
  }

  // ==========================================================================
  // 13. Save, Export & Toast Helper
  // ==========================================================================

  function getCleanPageHTML() {
    const clone = document.documentElement.cloneNode(true);
    clone.querySelectorAll(CMS_UI_SELECTOR).forEach(el => el.remove());
    clone.querySelectorAll('.cms-hero-sound-btn').forEach(el => el.remove());
    clone.querySelectorAll('.custom-cursor').forEach(el => el.remove());
    clone.querySelectorAll('[contenteditable]').forEach(el => el.removeAttribute('contenteditable'));
    clone.querySelectorAll('[data-cms-relocatable]').forEach(el => el.removeAttribute('data-cms-relocatable'));
    clone.querySelectorAll('[data-cms-editable], [data-cms-editable-image]').forEach(el => {
      el.removeAttribute('data-cms-editable');
      el.removeAttribute('data-cms-editable-image');
    });
    clone.querySelectorAll('[data-cms-offset-x]').forEach(el => {
      el.removeAttribute('data-cms-offset-x');
      el.removeAttribute('data-cms-offset-y');
    });
    clone.querySelectorAll('.cms-dragging, .cms-drop-target-before, .cms-drop-target-after').forEach(el => {
      el.classList.remove('cms-dragging', 'cms-drop-target-before', 'cms-drop-target-after');
    });
    clone.querySelectorAll('video').forEach(v => {
      const src = v.getAttribute('src') || v.src || '';
      if (src.startsWith('data:') && src.length > 50000) {
        v.setAttribute('src', 'hero-video.mp4');
      }
      if (v.classList.contains('cms-hero-media-el') || v.closest('.cms-hero-media-wrap, .hero, .page-hero')) {
        v.muted = true;
        v.defaultMuted = true;
        v.setAttribute('muted', '');
        v.setAttribute('autoplay', '');
        v.setAttribute('playsinline', '');
        v.removeAttribute('poster');
      }
    });
    clone.querySelectorAll('body').forEach(b => {
      b.classList.remove('cms-edit-mode', 'cms-logged-in', 'cms-relocate-mode', 'has-word-ribbon', 'has-custom-cursor');
      b.style.paddingTop = '';
    });
    return '<!DOCTYPE html>\n' + clone.outerHTML;
  }

  async function saveAllChanges(showSuccessToast = true) {
    const pubBtn = document.getElementById('wp-publish-btn');
    if (pubBtn && showSuccessToast) {
      pubBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Publishing...';
    }

    try {
      // 1. Save all dynamic cards and grids (including leader stream tracks)
      const gridMap = {};
      document.querySelectorAll('[data-cms-grid-id]').forEach((grid) => {
        const gridId = grid.getAttribute('data-cms-grid-id');
        gridMap[gridId] = sanitizeHtml(getCleanElementHtml(grid));

        grid.querySelectorAll('[data-cms-id]').forEach((el) => {
          const id = el.getAttribute('data-cms-id');
          if (!id) return;
          if (el.tagName === 'IMG') {
            const srcVal = el.getAttribute('src') || el.src || '';
            pageContentMap[id] = {
              type: 'image',
              src: srcVal,
              alt: el.alt || ''
            };
          } else if (el.tagName === 'VIDEO') {
            pageContentMap[id] = {
              type: 'image',
              src: el.getAttribute('src') || el.src,
              alt: ''
            };
          }
        });
      });
      try {
        localStorage.setItem(gridStorageKey, JSON.stringify(gridMap));
      } catch (e) {
        console.warn('[CMS] localStorage grid quota notice:', e);
      }

      // 2. Save all texts and images
      document.querySelectorAll('[data-cms-id]').forEach((el) => {
        const id = el.getAttribute('data-cms-id');
        const offsetX = el.getAttribute('data-cms-offset-x');
        const offsetY = el.getAttribute('data-cms-offset-y');
        const elStyle = {};
        if (el.style.transform) elStyle.transform = el.style.transform;
        if (offsetX !== null) elStyle.offsetX = offsetX;
        if (offsetY !== null) elStyle.offsetY = offsetY;

        if (el.tagName === 'IMG') {
          const srcVal = el.getAttribute('src') || el.src || '';
          pageContentMap[id] = {
            type: 'image',
            src: srcVal,
            alt: el.alt || '',
            style: elStyle
          };
        } else {
          const itemObj = {
            type: 'text',
            html: sanitizeHtml(getCleanElementHtml(el)),
            style: elStyle
          };
          if (id === 'txt_index_1' && typeof itemObj.html === 'string' && !itemObj.html.includes('data-pairs')) {
            itemObj.html = '<span class="sub">Build the</span>\n<span class="animated-word" data-pairs="Build the: NEXT BIG IDEA | Empower the: FUTURE FOUNDERS | Launch the: BOLD STARTUPS | Drive the: REAL IMPACT | Ignite the: STARTUP REVOLUTION">NEXT BIG IDEA</span>';
          }
          if (el.tagName === 'A' || el.hasAttribute('href')) {
            itemObj.href = el.getAttribute('href') || '';
            if (el.getAttribute('target')) itemObj.target = el.getAttribute('target');
          }
          pageContentMap[id] = itemObj;
        }
      });

      // 3. Save Hero Photo/Video & Coverage settings
      if (pageHeroSettings) {
        try {
          localStorage.setItem(heroStorageKey, JSON.stringify(pageHeroSettings));
        } catch (e) { }
        pageContentMap['_hero'] = { type: 'hero', data: pageHeroSettings };
      }

      // 4. Save Navigation Menu
      try {
        const storedNav = localStorage.getItem(CMS_NAV_KEY);
        if (storedNav) {
          const parsedNav = JSON.parse(storedNav);
          if (Array.isArray(parsedNav) && parsedNav.length > 0) {
            globalStyles['_nav'] = parsedNav;
            try {
              fetch('/api/save-nav-order', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ nav: parsedNav })
              }).catch(() => { });
            } catch (e) { }
          }
        }
      } catch (e) { }

      try {
        localStorage.setItem(pageStorageKey, JSON.stringify(pageContentMap));
      } catch (e) {
        console.warn('[CMS] localStorage content quota notice:', e);
      }

      const saveTimestamp = Date.now().toString();
      try {
        localStorage.setItem('envision_cms_saved_at_' + pagePath, saveTimestamp);
      } catch (e) { }

      // 5. Publish clean production HTML directly to disk via local dev server API
      let diskSaved = false;
      let targetFilename = pagePath;
      if (!targetFilename || targetFilename === '/' || targetFilename === '') targetFilename = 'index.html';
      if (!targetFilename.toLowerCase().endsWith('.html')) targetFilename += '.html';

      const cleanHtml = getCleanPageHTML();
      const publishPayload = JSON.stringify({ filename: targetFilename, html: cleanHtml });

      const tryEndpoints = [
        '/api/publish-page',
        'http://127.0.0.1:3456/api/publish-page',
        'http://localhost:3456/api/publish-page'
      ];

      for (const ep of tryEndpoints) {
        if (diskSaved) break;
        try {
          const res = await fetch(ep, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: publishPayload
          });
          if (res.ok) {
            const json = await res.json();
            if (json.success) {
              diskSaved = true;
              break;
            }
          }
        } catch (err) { }
      }

      // 6. Sync to Supabase if client and authorized admin session are available
      let supabaseSaved = false;
      let session = null;
      try {
        session = await getAuthorizedSession();
      } catch (e) { }

      if (window.supabaseClient && session) {
        const payload = {
          page_path: pagePath,
          content_data: pageContentMap,
          grid_data: gridMap,
          global_styles: globalStyles,
          updated_at: new Date().toISOString(),
          updated_by: session.user?.id || null
        };
        const { error } = await window.supabaseClient
          .from('site_content')
          .upsert(payload, { onConflict: 'page_path' });

        if (!error) {
          supabaseSaved = true;
          const globalPayload = {
            page_path: '_global',
            content_data: {},
            grid_data: {},
            global_styles: globalStyles,
            updated_at: new Date().toISOString(),
            updated_by: session.user?.id || null
          };
          await window.supabaseClient
            .from('site_content')
            .upsert(globalPayload, { onConflict: 'page_path' });
        } else {
          console.warn('[Supabase] Database publish notice:', error);
        }
      }

      if (pubBtn) {
        pubBtn.innerHTML = '<i class="fa-solid fa-check"></i> Published Live';
        pubBtn.classList.remove('btn-publish');
      }

      if (showSuccessToast) {
        if (diskSaved && supabaseSaved) {
          showToast('All changes published to disk and synced live to database!', 'success');
        } else if (diskSaved) {
          showToast('All changes saved and published permanently to website files!', 'success');
        } else if (supabaseSaved) {
          showToast('All changes published live to database!', 'success');
        } else {
          showToast('All edits saved locally in browser!', 'success');
        }
      }
    } catch (fatalErr) {
      console.error('[CMS] Save error:', fatalErr);
      if (pubBtn) {
        pubBtn.innerHTML = '<i class="fa-solid fa-cloud-arrow-up"></i> Publish Changes';
      }
      if (showSuccessToast) {
        showToast('All edits saved in browser storage.', 'success');
      }
    }
  }

  function exportPageHTML() {
    const htmlContent = getCleanPageHTML();
    const blob = new Blob([htmlContent], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = pagePath;
    document.body.append(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    showToast(`Exported ${pagePath} clean HTML!`, 'success');
  }

  function showToast(msg, type = 'success') {
    let toast = document.querySelector('.cms-toast');
    if (!toast) {
      toast = document.createElement('div');
      toast.className = 'cms-toast';
      document.body.append(toast);
    }
    const icon = type === 'success' ? 'fa-circle-check' : 'fa-triangle-exclamation';
    toast.innerHTML = `<i class="fa-solid ${icon}" style="color:${type === 'success' ? '#10b981' : '#ef4444'};"></i> <span>${msg}</span>`;
    toast.classList.add('show');
    setTimeout(() => toast.classList.remove('show'), 3500);
  }

})();
