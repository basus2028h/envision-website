document.addEventListener('DOMContentLoaded', () => {
  const topbar = document.querySelector('.topbar');
  const menuToggle = document.querySelector('.menu-toggle');
  const mobileMenu = document.querySelector('.mobile-menu');
  const mobileMenuInner = mobileMenu?.querySelector('.mobile-menu-inner');

  if (mobileMenuInner && !mobileMenuInner.querySelector('.mobile-connect')) {
    const mobileConnect = document.createElement('a');
    mobileConnect.href = 'contact.html';
    mobileConnect.className = 'mobile-connect';
    mobileConnect.textContent = 'Connect With Us';
    mobileMenuInner.append(mobileConnect);
  }



  // Pre-fill ?subject= query parameter if present on contact / registration forms
  const urlParams = new URLSearchParams(window.location.search);
  const subjectParam = urlParams.get('subject');
  if (subjectParam) {
    const subjectInput = document.querySelector('input[name="subject"], #subject, select[name="subject"]');
    if (subjectInput) {
      subjectInput.value = subjectParam;
    }
  }

  document.querySelectorAll('form[data-mailto]').forEach((contactForm) => {
    const recipient = contactForm.dataset.mailto || 'envision@iimbg.ac.in';
    const contactStatus = contactForm.querySelector('.contact-form-status');
    contactForm.addEventListener('submit', (event) => {
      event.preventDefault();
      const formData = new FormData(contactForm);
      const name = String(formData.get('name') || '').trim();
      const email = String(formData.get('email') || '').trim();
      const subject = String(formData.get('subject') || subjectParam || 'General Inquiry').trim();
      const message = String(formData.get('message') || '').trim();
      const body = `Name: ${name}\r\nReply email: ${email}\r\n\r\n${message}`;

      const mailLink = document.createElement('a');
      mailLink.href = `mailto:${recipient}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
      mailLink.hidden = true;
      document.body.append(mailLink);
      mailLink.click();
      mailLink.remove();

      if (contactStatus) {
        contactStatus.innerHTML = `
          <div style="margin-top:10px; padding:10px 14px; background:rgba(37,99,235,0.08); border:1px solid rgba(37,99,235,0.25); border-radius:8px; font-size:13px; line-height:1.5;">
            <i class="fa-solid fa-paper-plane" style="color:#2563eb;"></i> Opening mail client to send to <strong>${recipient}</strong>.<br/>
            <span style="color:var(--text-muted, #94a3b8); font-size:12px;">If your email client didn't open, write directly to: <a href="mailto:${recipient}" style="color:#2563eb; font-weight:600;">${recipient}</a></span>
          </div>
        `;
      }
    });
  });

  const cursorEnabled = window.matchMedia('(pointer: fine) and (prefers-reduced-motion: no-preference)').matches;

  if (cursorEnabled) {
    const cursorShadow = document.createElement('div');
    const cursorRing = document.createElement('div');
    const cursorDot = document.createElement('div');
    cursorShadow.className = 'custom-cursor custom-cursor-shadow';
    cursorRing.className = 'custom-cursor custom-cursor-ring';
    cursorDot.className = 'custom-cursor custom-cursor-dot';
    cursorShadow.setAttribute('aria-hidden', 'true');
    cursorRing.setAttribute('aria-hidden', 'true');
    cursorDot.setAttribute('aria-hidden', 'true');
    document.body.append(cursorShadow, cursorRing, cursorDot);


    let pointerX = -100;
    let pointerY = -100;
    let shadowX = pointerX;
    let shadowY = pointerY;
    let ringX = pointerX;
    let ringY = pointerY;
    let animationFrame = 0;

    const followPointer = () => {
      shadowX += (pointerX - shadowX) * 0.18;
      shadowY += (pointerY - shadowY) * 0.18;
      ringX += (pointerX - ringX) * 0.22;
      ringY += (pointerY - ringY) * 0.22;
      cursorShadow.style.transform = `translate3d(${shadowX}px, ${shadowY}px, 0) translate(-50%, -50%)`;
      cursorRing.style.transform = `translate3d(${ringX}px, ${ringY}px, 0) translate(-50%, -50%)`;

      if (Math.abs(pointerX - ringX) > 0.5 || Math.abs(pointerY - ringY) > 0.5 || Math.abs(pointerX - shadowX) > 0.5 || Math.abs(pointerY - shadowY) > 0.5) {
        animationFrame = requestAnimationFrame(followPointer);
      } else {
        animationFrame = 0;
      }
    };

    window.addEventListener('pointermove', (event) => {
      if (event.pointerType === 'touch') return;
      if (document.body.classList.contains('cms-logged-in') || document.body.classList.contains('cms-edit-mode')) {
        document.body.classList.remove('has-custom-cursor');
        return;
      }
      document.body.classList.add('has-custom-cursor');
      pointerX = event.clientX;
      pointerY = event.clientY;
      cursorDot.style.transform = `translate3d(${pointerX}px, ${pointerY}px, 0) translate(-50%, -50%)`;

      if (!animationFrame) animationFrame = requestAnimationFrame(followPointer);
    }, { passive: true });

    document.addEventListener('pointerover', (event) => {
      if (!(event.target instanceof Element)) return;
      if (document.body.classList.contains('cms-logged-in') || document.body.classList.contains('cms-edit-mode') || event.target.closest('#wp-admin-bar, #wp-sidebar-inspector, .cms-modal-backdrop, #wp-floating-toolbar, #cms-trigger-btn')) {
        cursorRing.classList.remove('is-interactive');
        return;
      }
      const interactive = event.target.closest('a, button, input, textarea, select, [role="button"]');
      cursorRing.classList.toggle('is-interactive', Boolean(interactive));
    });

    document.addEventListener('pointerdown', () => cursorRing.classList.add('is-pressed'));
    window.addEventListener('pointerup', () => cursorRing.classList.remove('is-pressed'));
    document.documentElement.addEventListener('mouseleave', () => document.body.classList.remove('has-custom-cursor'));
    window.addEventListener('blur', () => document.body.classList.remove('has-custom-cursor'));
  }

  if (topbar) {
    const handleScroll = () => {
      topbar.classList.toggle('scrolled', window.scrollY > 20);
    };
    handleScroll();
    window.addEventListener('scroll', handleScroll);
  }

  if (menuToggle && mobileMenu) {
    menuToggle.addEventListener('click', () => {
      mobileMenu.classList.toggle('open');
      const icon = menuToggle.querySelector('i');
      if (icon) {
        icon.classList.toggle('fa-bars');
        icon.classList.toggle('fa-xmark');
      }
    });

    // Event delegation on mobileMenu so dynamically loaded/replaced links close menu on click
    mobileMenu.addEventListener('click', (e) => {
      const link = e.target.closest('a');
      if (link) {
        mobileMenu.classList.remove('open');
        const icon = menuToggle.querySelector('i');
        if (icon) {
          icon.classList.add('fa-bars');
          icon.classList.remove('fa-xmark');
        }
      }
    });
  }

  const rotatingWords = document.querySelectorAll('.animated-word');
  rotatingWords.forEach((word) => {
    const defaultPhrases = [
      'NEXT BIG IDEA',
      'FUTURE FOUNDERS',
      'BOLD STARTUPS',
      'REAL IMPACT'
    ];
    const phrases = word.dataset.phrases
      ?.split('|')
      .map((phrase) => phrase.trim())
      .filter(Boolean) ?? defaultPhrases;

    if (phrases.length <= 1) return;

    const currentText = word.textContent.trim();
    let index = phrases.findIndex((p) => p.toLowerCase() === currentText.toLowerCase());
    if (index === -1) index = 0;

    setInterval(() => {
      if (document.body.classList.contains('cms-edit-mode')) return;
      word.classList.add('fade');
      setTimeout(() => {
        index = (index + 1) % phrases.length;
        word.textContent = phrases[index];
        word.classList.remove('fade');
      }, 280);
    }, 2600);
  });

  const revealItems = document.querySelectorAll('.reveal');
  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add('active');
      }
    });
  }, { threshold: 0.12 });

  revealItems.forEach((item) => observer.observe(item));

  // Stat Counter Animation (F5: prioritizing visible CMS edited text over data-target)
  const counters = document.querySelectorAll('[data-target]');
  const counterObserver = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      const el = entry.target;
      if (document.body.classList.contains('cms-edit-mode')) return;
      
      const rawText = el.textContent.trim();
      const parsedNum = parseInt(rawText.replace(/[^0-9]/g, ''), 10);
      const target = !isNaN(parsedNum) ? parsedNum : (Number(el.dataset.target) || 0);
      const parsedSuffix = rawText.replace(/[0-9\s]/g, '');
      const suffix = parsedSuffix || (el.dataset.suffix ?? '+');
      const duration = 1800;
      const start = performance.now();

      const tick = (time) => {
        const progress = Math.min((time - start) / duration, 1);
        const value = Math.floor(progress * target);
        el.textContent = `${value}${suffix}`;
        if (progress < 1) requestAnimationFrame(tick);
        else el.textContent = `${target}${suffix}`;
      };

      requestAnimationFrame(tick);
      counterObserver.unobserve(el);
    });
  }, { threshold: 0.4 });

  counters.forEach((counter) => counterObserver.observe(counter));

  const signatureClips = document.querySelectorAll('.signature-clip');
  const signatureObserver = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      const video = entry.target;
      if (entry.isIntersecting) {
        video.play().catch(() => { });
      } else {
        video.pause();
      }
    });
  }, { threshold: 0.1 });
  signatureClips.forEach((video) => signatureObserver.observe(video));

  // FAQ Accordion Interaction - Document-level capture delegation (F9)
  document.addEventListener('toggle', (event) => {
    const item = event.target;
    if (!item || !item.classList || !item.classList.contains('faq-item') || !item.open) return;
    const accordion = item.closest('.faq-accordion');
    if (!accordion) return;
    const items = accordion.querySelectorAll('.faq-item');
    items.forEach((otherItem) => {
      if (otherItem !== item && otherItem.open) {
        otherItem.removeAttribute('open');
      }
    });
  }, true);

  // Leader Category Filter Interaction
  const leaderFilterButtons = document.querySelectorAll('.leader-filter-btn');
  const leaderCards = document.querySelectorAll('.leader-card');

  leaderFilterButtons.forEach((button) => {
    button.addEventListener('click', () => {
      leaderFilterButtons.forEach((btn) => btn.classList.remove('active'));
      button.classList.add('active');

      const filter = button.dataset.filter;
      leaderCards.forEach((card) => {
        if (filter === 'all') {
          card.classList.remove('filter-hidden');
        } else {
          const categories = card.dataset.category || '';
          if (categories.includes(filter)) {
            card.classList.remove('filter-hidden');
          } else {
            card.classList.add('filter-hidden');
          }
        }
      });
    });
  });

  // ==========================================================================
  // Dynamic Living Background Canvas (Light Theme Fluid Orbs & Mesh Nodes)
  // ==========================================================================
  const initAmbientCanvas = () => {
    let canvas = document.getElementById('ambient-canvas');
    if (!canvas) {
      canvas = document.createElement('canvas');
      canvas.id = 'ambient-canvas';
      canvas.className = 'ambient-canvas';
      canvas.setAttribute('aria-hidden', 'true');
      document.body.prepend(canvas);
    }

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let width = 0;
    let height = 0;
    let dpr = Math.min(window.devicePixelRatio || 1, 2);

    const resize = () => {
      width = window.innerWidth;
      height = window.innerHeight;
      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    resize();
    window.addEventListener('resize', resize, { passive: true });

    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReducedMotion) {
      ctx.fillStyle = '#f8fafc';
      ctx.fillRect(0, 0, width, height);
      return;
    }

    // Interactive mouse tracking
    let mouse = { x: width * 0.5, y: height * 0.5, targetX: width * 0.5, targetY: height * 0.5 };
    window.addEventListener('pointermove', (e) => {
      mouse.targetX = e.clientX;
      mouse.targetY = e.clientY;
    }, { passive: true });

    // Floating Ambient Light Gradients
    const orbs = [
      { xFactor: 0.25, yFactor: 0.3, radius: 380, speedX: 0.0006, speedY: 0.0008, phase: 0, color: 'rgba(245, 158, 11, 0.08)' }, // Warm gold
      { xFactor: 0.75, yFactor: 0.35, radius: 440, speedX: 0.0007, speedY: 0.0005, phase: 1.5, color: 'rgba(59, 130, 246, 0.075)' }, // Sky blue
      { xFactor: 0.45, yFactor: 0.75, radius: 400, speedX: 0.0005, speedY: 0.0007, phase: 3.0, color: 'rgba(14, 165, 233, 0.065)' }, // Cyan
      { xFactor: 0.85, yFactor: 0.8, radius: 360, speedX: 0.0008, speedY: 0.0006, phase: 4.5, color: 'rgba(251, 191, 36, 0.07)' } // Amber
    ];

    // Delicate Micro Particles
    const particleCount = Math.min(Math.floor(width * 0.025), 36);
    const particles = Array.from({ length: particleCount }, () => ({
      x: Math.random() * width,
      y: Math.random() * height,
      vx: (Math.random() - 0.5) * 0.35,
      vy: (Math.random() - 0.5) * 0.35,
      radius: Math.random() * 1.4 + 0.8,
      alpha: Math.random() * 0.25 + 0.15,
      color: Math.random() > 0.4 ? 'rgba(100, 116, 139,' : 'rgba(194, 139, 25,'
    }));

    let isVisible = !document.hidden;
    let animId = null;
    let lastTime = performance.now();

    const animate = (time) => {
      if (!isVisible) {
        animId = null;
        return;
      }

      const dt = Math.min(time - lastTime, 40);
      lastTime = time;

      // Mouse smooth lerp
      mouse.x += (mouse.targetX - mouse.x) * 0.04;
      mouse.y += (mouse.targetY - mouse.y) * 0.04;

      ctx.clearRect(0, 0, width, height);

      // 1. Base light canvas fill
      ctx.fillStyle = '#f8fafc';
      ctx.fillRect(0, 0, width, height);

      // 2. Render Moving Ambient Fluid Orbs
      orbs.forEach((orb) => {
        const ox = (orb.xFactor + Math.sin(time * orb.speedX + orb.phase) * 0.18) * width + (mouse.x - width * 0.5) * 0.04;
        const oy = (orb.yFactor + Math.cos(time * orb.speedY + orb.phase) * 0.18) * height + (mouse.y - height * 0.5) * 0.04;

        const gradient = ctx.createRadialGradient(ox, oy, 0, ox, oy, orb.radius);
        gradient.addColorStop(0, orb.color);
        gradient.addColorStop(1, 'rgba(248, 250, 252, 0)');

        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(ox, oy, orb.radius, 0, Math.PI * 2);
        ctx.fill();
      });

      // 3. Render Delicate Particle Constellation Lines
      for (let i = 0; i < particles.length; i++) {
        const p1 = particles[i];

        // Move particles
        p1.x += p1.vx * (dt * 0.06);
        p1.y += p1.vy * (dt * 0.06);

        if (p1.x < 0) p1.x = width;
        else if (p1.x > width) p1.x = 0;
        if (p1.y < 0) p1.y = height;
        else if (p1.y > height) p1.y = 0;

        // Draw connections
        for (let j = i + 1; j < particles.length; j++) {
          const p2 = particles[j];
          const dx = p1.x - p2.x;
          const dy = p1.y - p2.y;
          const dist = Math.sqrt(dx * dx + dy * dy);

          if (dist < 110) {
            const lineAlpha = (1 - dist / 110) * 0.09;
            ctx.strokeStyle = `rgba(148, 163, 184, ${lineAlpha})`;
            ctx.lineWidth = 0.75;
            ctx.beginPath();
            ctx.moveTo(p1.x, p1.y);
            ctx.lineTo(p2.x, p2.y);
            ctx.stroke();
          }
        }

        // Draw particle dot
        ctx.fillStyle = `${p1.color}${p1.alpha})`;
        ctx.beginPath();
        ctx.arc(p1.x, p1.y, p1.radius, 0, Math.PI * 2);
        ctx.fill();
      }

      animId = requestAnimationFrame(animate);
    };

    document.addEventListener('visibilitychange', () => {
      isVisible = !document.hidden;
      if (isVisible && !animId) {
        lastTime = performance.now();
        animId = requestAnimationFrame(animate);
      }
    });

    animId = requestAnimationFrame(animate);
  };

  initAmbientCanvas();

  document.getElementById('year')?.replaceChildren(new Date().getFullYear().toString());

  // Reload page button on 500 error page
  document.getElementById('btn-reload-page')?.addEventListener('click', () => {
    window.location.reload();
  });

  // On-demand CMS Studio Loader: Loads CMS assets and opens Studio on shortcut (Ctrl+Shift+E)
  function loadAdminStudio(autoOpen = true) {
    if (window._cmsLoaded) {
      if (autoOpen && typeof window.openAdminStudio === 'function') {
        window.openAdminStudio();
      }
      return;
    }
    window._cmsLoaded = true;

    if (!document.querySelector('link[href="cms.css"]')) {
      const cssLink = document.createElement('link');
      cssLink.rel = 'stylesheet';
      cssLink.href = 'cms.css';
      document.head.appendChild(cssLink);
    }

    const loadCmsScript = () => {
      if (document.querySelector('script[src="cms.js"]')) return;
      const cmsScript = document.createElement('script');
      cmsScript.src = 'cms.js';
      cmsScript.onload = () => {
        if (autoOpen && typeof window.openAdminStudio === 'function') {
          window.openAdminStudio();
        }
      };
      cmsScript.onerror = () => {
        console.error('[CMS] Failed to load the admin studio.');
      };
      document.body.appendChild(cmsScript);
    };

    if (window.supabaseClient) {
      loadCmsScript();
      return;
    }

    const onSupabaseReady = () => {
      window.removeEventListener('supabaseReady', onSupabaseReady);
      loadCmsScript();
    };
    window.addEventListener('supabaseReady', onSupabaseReady, { once: true });

    if (!window.ENVISION_SUPABASE_CONFIG) {
      const supScript = document.createElement('script');
      supScript.src = 'supabase-config.js';
      supScript.onerror = () => {
        window.removeEventListener('supabaseReady', onSupabaseReady);
        console.error('[CMS] Failed to load the Supabase configuration.');
        loadCmsScript();
      };
      document.body.appendChild(supScript);
    }
  }

  // Load CMS if URL param ?cms=admin or ?admin=true is present
  if (urlParams.has('cms') || urlParams.has('admin')) {
    loadAdminStudio(true);
  }

  // Admin Shortcut: Ctrl + Shift + E
  window.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.shiftKey && (e.key === 'E' || e.key === 'e')) {
      e.preventDefault();
      loadAdminStudio(true);
    }
  });
});


/* ==========================================================================
   Public content loader (read-only)
   Shows what the admin published from the CMS to every visitor, and after a
   normal page refresh. It only READS from Supabase through the public
   (publishable) key; writing is still blocked by the database rules.
   Fails silently: if Supabase is unreachable the page simply shows its
   built-in content.
   ========================================================================== */
(function () {
  'use strict';

  // When the editor is opened (?cms / ?admin) cms.js loads and syncs by itself.
  var qs = new URLSearchParams(window.location.search);
  if (qs.has('cms') || qs.has('admin')) return;

  // The publishable key is designed to be public. Protection comes from RLS.
  var SUPABASE_URL = 'https://jloywbovucitjxihdibb.supabase.co';
  var PUBLISHABLE_KEY = 'sb_publishable_QwAnt4XEwFco_YEoWIy-pQ_ZIs4zdYl';

  var last = window.location.pathname.split('/').pop() || 'index.html';
  var pagePath = /\.[a-z0-9]+$/i.test(last) ? last : last + '.html';
  if (/^(403|404|500)\.html$/.test(pagePath)) return;

  var ALLOWED_TAGS = new Set([
    'A', 'ABBR', 'ADDRESS', 'ARTICLE', 'ASIDE', 'B', 'BDI', 'BDO', 'BLOCKQUOTE', 'BR',
    'BUTTON', 'CITE', 'CODE', 'DATA', 'DD', 'DEL', 'DETAILS', 'DFN', 'DIV', 'DL', 'DT',
    'EM', 'FIGCAPTION', 'FIGURE', 'FOOTER', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'HEADER',
    'HGROUP', 'HR', 'I', 'IMG', 'INS', 'KBD', 'LI', 'MAIN', 'MARK', 'NAV',
    'OL', 'P', 'PICTURE', 'PRE', 'Q', 'RP', 'RT', 'RUBY', 'S', 'SAMP', 'SECTION',
    'SMALL', 'SOURCE', 'SPAN', 'STRONG', 'SUB', 'SUMMARY', 'SUP',
    'TABLE', 'TBODY', 'TD', 'TFOOT', 'TH', 'THEAD', 'TIME', 'TR', 'U', 'UL', 'VAR', 'VIDEO', 'WBR'
  ]);
  var FORBIDDEN_TAGS = new Set(['SCRIPT', 'IFRAME', 'OBJECT', 'EMBED', 'STYLE', 'LINK', 'META', 'FORM', 'INPUT', 'TEXTAREA', 'SELECT', 'OPTION', 'APPLET', 'BASE', 'SVG', 'MATH', 'NOSCRIPT']);

  function isSafeImageSrc(value) {
    if (typeof value !== 'string') return false;
    var v = value.trim().replace(/[\u0000-\u0020]+/g, '');
    if (!v) return false;
    if (/^data:image\/(?:png|jpe?g|gif|webp);base64,[a-z0-9+/=]+$/i.test(v)) return true;
    if (/^https:\/\//i.test(v)) return true;
    if (window.location.origin !== 'null' && v.indexOf(window.location.origin + '/') === 0) return true;
    if (/^\/\//.test(v)) return false;
    return !/^[a-z][a-z0-9+.-]*:/i.test(v);
  }

  function isSafeTransform(value) {
    return typeof value === 'string' && value.length <= 120 &&
      /^(?:\s*(?:translate|translateX|translateY|translate3d|scale|scaleX|scaleY|rotate|skew|skewX|skewY)\([0-9a-z.,\s%+-]*\)\s*)*$/i.test(value);
  }

  function isSafeStyleAttr(value) {
    return !/url\s*\(|expression|@import|behavior|position\s*:\s*(?:fixed|sticky)|javascript:/i.test(value);
  }

  var CMS_UI_SELECTOR = [
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
    '.wp-add-card-placeholder',
    '.wp-hero-edit-pill',
    '.wp-card-media-pill',
    '.cms-element-move-pill',
    '.cms-relocate-popover',
    '.cms-drop-indicator-line',
    '.cms-ignore',
    '.cms-ghost',
    '.cms-drag-tooltip',
    '.cms-drop-placeholder',
    '.cms-move-btn',
    '.cms-move-menu-toggle'
  ].join(', ');

  function sanitizeHtml(html) {
    if (!html || typeof html !== 'string') return '';
    var template = document.createElement('template');
    template.innerHTML = html;

    // Immediately remove any CMS UI controls, move pills, toolbars, and buttons
    template.content.querySelectorAll(CMS_UI_SELECTOR).forEach(function (node) { node.remove(); });
    template.content.querySelectorAll('[contenteditable]').forEach(function (node) { node.removeAttribute('contenteditable'); });
    template.content.querySelectorAll('[data-cms-relocatable]').forEach(function (node) { node.removeAttribute('data-cms-relocatable'); });
    template.content.querySelectorAll('[data-cms-editable], [data-cms-editable-image]').forEach(function (node) {
      node.removeAttribute('data-cms-editable');
      node.removeAttribute('data-cms-editable-image');
    });

    template.content.querySelectorAll('*').forEach(function (node) {
      var tag = node.tagName.toUpperCase();
      if (FORBIDDEN_TAGS.has(tag)) { node.remove(); return; }
      if (!ALLOWED_TAGS.has(tag)) { node.replaceWith.apply(node, Array.from(node.childNodes)); return; }
      Array.from(node.attributes).forEach(function (attr) {
        var name = attr.name.toLowerCase();
        var val = attr.value;
        if (name.indexOf('on') === 0 || name.indexOf(':') !== -1 || name === 'formaction' || name === 'srcdoc') {
          node.removeAttribute(attr.name); return;
        }
        if (name === 'style' && !isSafeStyleAttr(val)) { node.removeAttribute(attr.name); return; }
        if (name === 'href') {
          var h = val.trim().replace(/[\u0000-\u0020]+/g, '');
          if (/^\/\//.test(h) || (/^[a-z][a-z0-9+.-]*:/i.test(h) && !/^(?:https?|mailto|tel):/i.test(h))) { node.removeAttribute(attr.name); return; }
          if (tag === 'A') node.setAttribute('rel', 'noopener noreferrer');
        }
        if (name === 'src' || name === 'poster' || name === 'srcset') {
          if (name === 'srcset' || !isSafeImageSrc(val)) {
            // videos may point to plain https/relative files; images follow the strict rule
            var v = val.trim().replace(/[\u0000-\u0020]+/g, '');
            var okMedia = tag !== 'IMG' && name === 'src' && (/^https:\/\//i.test(v) || (!/^[a-z][a-z0-9+.-]*:/i.test(v) && !/^\/\//.test(v)));
            if (!okMedia) node.removeAttribute(attr.name);
          }
        }
        if (name === 'data-cms-card') {
          node.removeAttribute(attr.name);
        }
      });
      if (tag === 'IMG' && node.hasAttribute('data-cms-id') && /^data:image\//i.test(node.getAttribute('src') || '')) {
        node.removeAttribute('src');
      }
    });
    return template.innerHTML;
  }

  function sanitizeGlobalStyles(styles) {
    var clean = {};
    Object.keys(styles || {}).forEach(function (key) {
      var value = styles[key];
      if (typeof value === 'string' && value.length <= 64 && /^[#a-z0-9(),.%\s-]+$/i.test(value) && !/url|expression|import/i.test(value)) {
        clean[key] = value;
      }
    });
    return clean;
  }

  function applyGlobalStyles(styles) {
    styles = sanitizeGlobalStyles(styles);
    var css = ':root {\n';
    if (styles.bg) css += '  --bg: ' + styles.bg + ' !important;\n';
    if (styles.bg2) css += '  --bg-2: ' + styles.bg2 + ' !important;\n';
    if (styles.panel) { css += '  --panel: ' + styles.panel + ' !important;\n  --panel-strong: ' + styles.panel + ' !important;\n'; }
    if (styles.line) css += '  --line: ' + styles.line + ' !important;\n';
    if (styles.primaryColor) { css += '  --blue: ' + styles.primaryColor + ' !important;\n  --blue-strong: ' + styles.primaryColor + ' !important;\n  --navy: ' + styles.primaryColor + ' !important;\n'; }
    if (styles.accentColor) { css += '  --gold: ' + styles.accentColor + ' !important;\n  --gold-soft: ' + styles.accentColor + ' !important;\n  --gold-strong: ' + styles.accentColor + ' !important;\n'; }
    if (styles.text) css += '  --text: ' + styles.text + ' !important;\n';
    if (styles.muted) css += '  --muted: ' + styles.muted + ' !important;\n';
    if (styles.radius) css += '  --card-radius: ' + styles.radius + ' !important;\n';
    css += '}\n';
    if (css === ':root {\n}\n') return;
    var tag = document.getElementById('cms-dynamic-global-styles');
    if (!tag) { tag = document.createElement('style'); tag.id = 'cms-dynamic-global-styles'; document.head.appendChild(tag); }
    tag.textContent = css;
  }

  function byAttr(attr, value) {
    // value comes from the database: look it up by comparison, never by building a selector from it
    var nodes = document.querySelectorAll('[' + attr + ']');
    for (var i = 0; i < nodes.length; i++) if (nodes[i].getAttribute(attr) === value) return nodes[i];
    return null;
  }

  function apply(row) {
    if (!row) return;

    // 1. Card grids (added / removed / reordered cards)
    var grids = row.grid_data;
    if (grids && typeof grids === 'object') {
      Object.keys(grids).forEach(function (id) {
        var el = byAttr('data-cms-grid-id', id);
        if (el && typeof grids[id] === 'string' && grids[id]) el.innerHTML = sanitizeHtml(grids[id]);
      });
    }

    // 2. Texts and images
    var content = row.content_data;
    if (content && typeof content === 'object') {
      Object.keys(content).forEach(function (key) {
        var data = content[key];
        if (!data || typeof data !== 'object') return;
        var el = byAttr('data-cms-id', key);
        if (!el) return;
        if (data.type === 'text' && typeof data.html === 'string') {
          el.innerHTML = sanitizeHtml(data.html);
          if ((el.tagName === 'A' || el.hasAttribute('href')) && data.href) {
            var sanitizedHref = data.href.trim();
            if (!/^\/\//.test(sanitizedHref) && !/^(?:javascript|data|vbscript):/i.test(sanitizedHref)) {
              try {
                el.setAttribute('href', encodeURI(decodeURI(sanitizedHref)));
              } catch (e) {
                el.setAttribute('href', encodeURI(sanitizedHref));
              }
            }
            if (data.target) el.setAttribute('target', data.target);
          }
        } else if (data.type === 'image' && isSafeImageSrc(data.src)) {
          el.setAttribute('src', data.src);
          if (typeof data.alt === 'string') el.setAttribute('alt', data.alt);
        }
        if (data.style && isSafeTransform(data.style.transform)) el.style.transform = data.style.transform;
      });

      // 2.5 Hero background media (F1 & public styling)
      if (content._hero && content._hero.data) {
        var heroSettings = content._hero.data;
        var heroSec = document.querySelector('.hero, .page-hero, header + main > section:first-of-type, header + section');
        if (heroSec && heroSettings.src && isSafeImageSrc(heroSettings.src)) {
          var wrap = heroSec.querySelector('.cms-hero-media-wrap');
          if (!wrap) {
            wrap = document.createElement('div');
            heroSec.prepend(wrap);
          }
          wrap.innerHTML = '';
          heroSec.style.position = 'relative';
          heroSec.style.overflow = 'hidden';
          var pos = heroSettings.position || 'full';
          wrap.className = 'cms-hero-media-wrap pos-' + pos;
          wrap.style.width = pos === 'full' ? '100%' : ((heroSettings.width || 100) + '%');
          wrap.style.height = (heroSettings.height !== undefined ? heroSettings.height : '100%');
          wrap.style.opacity = (heroSettings.opacity !== undefined ? heroSettings.opacity : 0.35).toString();
          wrap.style.filter = (heroSettings.blur ? 'blur(' + heroSettings.blur + 'px)' : 'none');
          var fit = heroSettings.objectFit || 'cover';
          if (heroSettings.type === 'video') {
            var vid = document.createElement('video');
            vid.className = 'cms-hero-media-el';
            vid.autoplay = true; vid.muted = true; vid.loop = true; vid.playsInline = true;
            vid.style.objectFit = fit;
            vid.src = heroSettings.src;
            wrap.append(vid);
            vid.play().catch(function () { });
          } else {
            var img = document.createElement('img');
            img.className = 'cms-hero-media-el';
            img.style.objectFit = fit;
            img.src = heroSettings.src;
            wrap.append(img);
          }

          var overlay = heroSec.querySelector('.cms-hero-overlay');
          if (!overlay) {
            overlay = document.createElement('div');
            heroSec.insertBefore(overlay, wrap.nextSibling);
          }
          var overlayType = heroSettings.overlay || 'vignette';
          overlay.className = 'cms-hero-overlay overlay-' + overlayType;
        }
      }
    }

    // 3. Global colours & Navigation menu (F1, F2)
    if (row.global_styles && typeof row.global_styles === 'object') {
      applyGlobalStyles(row.global_styles);
      if (Array.isArray(row.global_styles._nav) && row.global_styles._nav.length > 0) {
        var navItems = row.global_styles._nav;
        var navContainers = document.querySelectorAll('.nav-links, .mobile-menu-inner');
        navContainers.forEach(function (container) {
          var isMobile = container.classList.contains('mobile-menu-inner');
          container.innerHTML = navItems.map(function (item) {
            var u = (item.url || '#').trim();
            if (/^\/\//.test(u) || /^(?:javascript|data|vbscript):/i.test(u)) u = '#';
            return '<a href="' + encodeURI(u) + '">' + String(item.title || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;') + '</a>';
          }).join('');
          if (isMobile && !container.querySelector('.mobile-connect')) {
            var conn = document.createElement('a');
            conn.href = 'contact.html';
            conn.className = 'mobile-connect';
            conn.textContent = 'Connect With Us';
            container.append(conn);
          }
        });
      }
    }
  }

  function load() {
    // S15: Skip Supabase request on 404 / 403 / 500 or error pages
    if (document.querySelector('.error-hero, [data-error-page]')) return;
    if (typeof fetch !== 'function') return;
    var controller = typeof AbortController === 'function' ? new AbortController() : null;
    var timer = controller ? setTimeout(function () { controller.abort(); }, 6000) : null;
    var url = SUPABASE_URL + '/rest/v1/site_content?select=page_path,content_data,grid_data,global_styles&page_path=in.(' + encodeURIComponent(pagePath) + ',_global)';
    fetch(url, {
      headers: { apikey: PUBLISHABLE_KEY, Authorization: 'Bearer ' + PUBLISHABLE_KEY, Accept: 'application/json' },
      signal: controller ? controller.signal : undefined
    })
      .then(function (res) { return res.ok ? res.json() : []; })
      .then(function (rows) {
        if (Array.isArray(rows) && rows.length > 0) {
          var globalRow = rows.find(function (r) { return r.page_path === '_global'; });
          var pageRow = rows.find(function (r) { return r.page_path === pagePath; });
          if (globalRow) apply(globalRow);
          if (pageRow) apply(pageRow);
        }
      })
      .catch(function () { /* keep the built-in page content */ })
      .then(function () { if (timer) clearTimeout(timer); });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', load);
  else load();
})();
