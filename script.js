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



  document.querySelectorAll('form[data-mailto]').forEach((contactForm) => {
    const recipient = contactForm.dataset.mailto;
    const contactStatus = contactForm.querySelector('.contact-form-status');
    contactForm.addEventListener('submit', (event) => {
      event.preventDefault();
      const formData = new FormData(contactForm);
      const name = String(formData.get('name')).trim();
      const email = String(formData.get('email')).trim();
      const subject = String(formData.get('subject')).trim();
      const message = String(formData.get('message')).trim();
      const body = `Name: ${name}\r\nReply email: ${email}\r\n\r\n${message}`;
      const mailLink = document.createElement('a');
      mailLink.href = `mailto:${recipient}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
      mailLink.hidden = true;
      document.body.append(mailLink);
      mailLink.click();
      mailLink.remove();
      contactStatus.textContent = `Your email app should open with the message addressed to ${recipient}.`;
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
    document.addEventListener('pointerleave', () => document.body.classList.remove('has-custom-cursor'));
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

    mobileMenu.querySelectorAll('a').forEach((link) => {
      link.addEventListener('click', () => {
        mobileMenu.classList.remove('open');
        const icon = menuToggle.querySelector('i');
        if (icon) {
          icon.classList.add('fa-bars');
          icon.classList.remove('fa-xmark');
        }
      });
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

    if (phrases.length === 0) return;

    let index = 0;
    setInterval(() => {
      word.classList.add('fade');
      setTimeout(() => {
        index = (index + 1) % phrases.length;
        word.textContent = phrases[index];
        word.classList.remove('fade');
      }, 220);
    }, 2200);
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

  const counters = document.querySelectorAll('[data-target]');
  const counterObserver = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      const el = entry.target;
      const target = Number(el.dataset.target);
      const suffix = el.dataset.suffix ?? '+';
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

  // FAQ Accordion Interaction
  const faqAccordions = document.querySelectorAll('.faq-accordion');
  faqAccordions.forEach((accordion) => {
    const items = accordion.querySelectorAll('.faq-item');
    items.forEach((item) => {
      item.addEventListener('toggle', () => {
        if (item.open) {
          items.forEach((otherItem) => {
            if (otherItem !== item && otherItem.open) {
              otherItem.removeAttribute('open');
            }
          });
        }
      });
    });
  });

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

    let isVisible = true;
    document.addEventListener('visibilitychange', () => {
      isVisible = !document.hidden;
    });

    let lastTime = performance.now();

    const animate = (time) => {
      if (!isVisible) {
        requestAnimationFrame(animate);
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

      requestAnimationFrame(animate);
    };

    requestAnimationFrame(animate);
  };

  initAmbientCanvas();

  document.getElementById('year')?.replaceChildren(new Date().getFullYear().toString());
});

