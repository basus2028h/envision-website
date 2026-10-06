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

  const authDialog = document.createElement('dialog');
  authDialog.className = 'auth-dialog';
  authDialog.setAttribute('aria-labelledby', 'auth-title');
  authDialog.innerHTML = `
    <section class="auth-panel">
      <button class="auth-close" type="button" aria-label="Close sign-in dialog">
        <i class="fa-solid fa-xmark" aria-hidden="true"></i>
      </button>
      <p class="auth-eyebrow">Envision E-Cell</p>
      <h2 class="auth-title" id="auth-title">Welcome back</h2>
      <p class="auth-description">Sign in or create an account to connect with us.</p>
      <div class="auth-tabs" role="tablist" aria-label="Account access">
        <button type="button" id="auth-tab-signin" role="tab" aria-selected="true" aria-controls="auth-panel-signin" data-auth-tab="signin">Sign in</button>
        <button type="button" id="auth-tab-signup" role="tab" aria-selected="false" aria-controls="auth-panel-signup" data-auth-tab="signup" tabindex="-1">Sign up</button>
      </div>
      <form class="auth-form" id="auth-panel-signin" role="tabpanel" aria-labelledby="auth-tab-signin" data-auth-form="signin">
        <div class="auth-method-tabs" role="group" aria-label="Sign-in method">
          <button type="button" data-auth-signin-method="email-code" aria-pressed="true">Email code</button>
          <button type="button" data-auth-signin-method="password" aria-pressed="false">Password</button>
        </div>
        <label class="auth-field"><span>Email address</span><input type="email" name="email" autocomplete="email" required /></label>
        <label class="auth-field" data-auth-password-field hidden><span>Password</span><input type="password" name="password" autocomplete="current-password" disabled /></label>
        <button class="auth-submit auth-send-code" type="button" data-auth-send>Send sign-in code</button>
        <label class="auth-field auth-code-field" data-auth-code-field hidden><span>6-digit email code</span><input type="text" name="code" inputmode="numeric" autocomplete="one-time-code" pattern="[0-9]{6}" maxlength="6" disabled /></label>
        <button class="auth-submit" type="submit" data-auth-verify hidden disabled>Verify and sign in</button>
        <button class="auth-submit" type="submit" data-auth-password-submit hidden disabled>Sign in with password</button>
      </form>
      <form class="auth-form" id="auth-panel-signup" role="tabpanel" aria-labelledby="auth-tab-signup" data-auth-form="signup" hidden>
        <label class="auth-field"><span>Full name</span><input type="text" name="name" autocomplete="name" required /></label>
        <label class="auth-field"><span>Email address</span><input type="email" name="email" autocomplete="email" required /></label>
        <label class="auth-field"><span>Password (optional)</span><input type="password" name="password" autocomplete="new-password" minlength="8" /></label>
        <button class="auth-submit auth-send-code" type="button" data-auth-send>Create account with email code</button>
        <label class="auth-field auth-code-field" data-auth-code-field hidden><span>6-digit email code</span><input type="text" name="code" inputmode="numeric" autocomplete="one-time-code" pattern="[0-9]{6}" maxlength="6" disabled /></label>
        <button class="auth-submit" type="submit" data-auth-verify hidden disabled>Verify email and create account</button>
      </form>
      <p class="auth-note"></p>
      <p class="auth-status" role="status" aria-live="polite"></p>
    </section>
  `;
  document.body.append(authDialog);

  const authTabs = authDialog.querySelectorAll('[data-auth-tab]');
  const authForms = authDialog.querySelectorAll('[data-auth-form]');
  const authTitle = authDialog.querySelector('.auth-title');
  const authDescription = authDialog.querySelector('.auth-description');
  const authNote = authDialog.querySelector('.auth-note');
  const authStatus = authDialog.querySelector('.auth-status');
  let authClient;
  let authSdkLoad;
  const signinForm = authDialog.querySelector('[data-auth-form="signin"]');

  const setSigninMethod = (form, method) => {
    form.dataset.signinMethod = method;
    form.querySelectorAll('[data-auth-signin-method]').forEach((button) => {
      button.setAttribute('aria-pressed', String(button.dataset.authSigninMethod === method));
    });

    const useEmailCode = method === 'email-code';
    const passwordField = form.querySelector('[data-auth-password-field]');
    const passwordInput = passwordField.querySelector('[name="password"]');
    const passwordSubmit = form.querySelector('[data-auth-password-submit]');
    passwordField.hidden = useEmailCode;
    passwordInput.disabled = useEmailCode;
    passwordInput.required = !useEmailCode;
    passwordSubmit.hidden = useEmailCode;
    passwordSubmit.disabled = useEmailCode;
    form.querySelector('[data-auth-send]').hidden = !useEmailCode;
    form.querySelector('[data-auth-code-field]').hidden = !useEmailCode || form.dataset.otpSent !== 'true';
    form.querySelector('[data-auth-verify]').hidden = !useEmailCode || form.dataset.otpSent !== 'true';
  };

  const getAuthClient = async () => {
    const config = window.ENVISION_SUPABASE_CONFIG;
    if (!config?.url || !config?.publishableKey) {
      throw new Error('Add the Supabase project URL and publishable key to supabase-config.js.');
    }

    if (!window.supabase?.createClient) {
      if (!authSdkLoad) {
        authSdkLoad = new Promise((resolve, reject) => {
          const sdk = document.createElement('script');
          sdk.src = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2';
          sdk.onload = resolve;
          sdk.onerror = () => reject(new Error('Supabase could not be loaded. Check your internet connection.'));
          document.head.append(sdk);
        });
      }
      await authSdkLoad;
    }

    authClient ??= window.supabase.createClient(config.url, config.publishableKey);
    return authClient;
  };

  const resetAuthForm = (form) => {
    form.dataset.otpSent = 'false';
    const emailInput = form.querySelector('[name="email"]');
    const codeField = form.querySelector('[data-auth-code-field]');
    const codeInput = codeField.querySelector('[name="code"]');
    const sendButton = form.querySelector('[data-auth-send]');
    const verifyButton = form.querySelector('[data-auth-verify]');
    emailInput.readOnly = false;
    codeField.hidden = true;
    codeInput.value = '';
    codeInput.required = false;
    codeInput.disabled = true;
    sendButton.hidden = false;
    sendButton.disabled = false;
    sendButton.textContent = form.dataset.authForm === 'signup' ? 'Create account with email code' : 'Send sign-in code';
    verifyButton.hidden = true;
    verifyButton.disabled = true;
    verifyButton.textContent = form.dataset.authForm === 'signup' ? 'Verify email and create account' : 'Verify and sign in';
    if (form.dataset.authForm === 'signin') {
      form.querySelector('[name="password"]').value = '';
      setSigninMethod(form, 'email-code');
    } else {
      form.querySelector('[name="password"]').value = '';
    }
  };

  authNote.textContent = window.ENVISION_SUPABASE_CONFIG?.url && window.ENVISION_SUPABASE_CONFIG?.publishableKey
    ? 'Sign in with an email code or password. Signup passwords are optional.'
    : 'To enable email codes, configure supabase-config.js and set the Supabase email template to use {{ .Token }}.';

  signinForm.querySelectorAll('[data-auth-signin-method]').forEach((button) => {
    button.addEventListener('click', () => {
      resetAuthForm(signinForm);
      setSigninMethod(signinForm, button.dataset.authSigninMethod);
      authStatus.textContent = '';
    });
  });

  const setAuthMode = (mode) => {
    authTabs.forEach((tab) => {
      const selected = tab.dataset.authTab === mode;
      tab.setAttribute('aria-selected', String(selected));
      tab.tabIndex = selected ? 0 : -1;
    });

    authForms.forEach((form) => {
      const selected = form.dataset.authForm === mode;
      form.hidden = !selected;
      if (selected) resetAuthForm(form);
    });

    authTitle.textContent = mode === 'signup' ? 'Create your account' : 'Welcome back';
    authDescription.textContent = mode === 'signup'
      ? 'Create an account and verify your email. A password is optional.'
      : 'Sign in with a one-time email code or your password.';
    authStatus.textContent = '';
  };

  authTabs.forEach((tab, index) => {
    tab.addEventListener('click', () => setAuthMode(tab.dataset.authTab));
    tab.addEventListener('keydown', (event) => {
      if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
      event.preventDefault();
      const offset = event.key === 'ArrowRight' ? 1 : -1;
      const nextTab = authTabs[(index + offset + authTabs.length) % authTabs.length];
      setAuthMode(nextTab.dataset.authTab);
      nextTab.focus();
    });
  });

  document.querySelectorAll('.nav-cta, .mobile-connect').forEach((link) => {
    link.addEventListener('click', (event) => {
      event.preventDefault();
      setAuthMode('signin');
      authDialog.showModal();
      document.querySelectorAll('.custom-cursor').forEach((cursor) => authDialog.append(cursor));
      authDialog.querySelector('[data-auth-form="signin"] input').focus();
    });
  });

  authDialog.querySelector('.auth-close').addEventListener('click', () => authDialog.close());
  authDialog.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') authDialog.close();
  });
  authDialog.addEventListener('click', (event) => {
    if (event.target === authDialog) authDialog.close();
  });

  authForms.forEach((form) => {
    const mode = form.dataset.authForm;
    const nameInput = form.querySelector('[name="name"]');
    const emailInput = form.querySelector('[name="email"]');
    const passwordInput = form.querySelector('[name="password"]');
    const codeField = form.querySelector('[data-auth-code-field]');
    const codeInput = codeField.querySelector('[name="code"]');
    const sendButton = form.querySelector('[data-auth-send]');
    const verifyButton = form.querySelector('[data-auth-verify]');

    sendButton.addEventListener('click', async () => {
      if (nameInput && !nameInput.reportValidity()) return;
      if (!emailInput.reportValidity()) return;

      sendButton.disabled = true;
      authStatus.textContent = 'Requesting a verification code…';

      try {
        const client = await getAuthClient();
        const options = { shouldCreateUser: mode === 'signup' };
        if (nameInput) options.data = { full_name: nameInput.value.trim() };

        const email = emailInput.value.trim();
        const password = passwordInput?.value;
        const response = mode === 'signup' && password
          ? await client.auth.signUp({ email, password, options: { data: options.data } })
          : await client.auth.signInWithOtp({ email, options });
        const { error } = response;
        if (error) throw error;

        form.dataset.otpSent = 'true';
        emailInput.readOnly = true;
        codeField.hidden = false;
        codeInput.disabled = false;
        codeInput.required = true;
        sendButton.textContent = 'Resend code';
        verifyButton.hidden = false;
        verifyButton.disabled = false;
        authStatus.textContent = `If ${emailInput.value.trim()} can receive a code, one is on its way.`;
        codeInput.focus();
      } catch (error) {
        authStatus.textContent = error.message || 'Unable to send a verification code.';
        sendButton.disabled = false;
      }
    });

    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      if (mode === 'signin' && form.dataset.signinMethod === 'password') {
        if (!form.reportValidity()) return;
        const passwordSubmit = form.querySelector('[data-auth-password-submit]');
        passwordSubmit.disabled = true;
        authStatus.textContent = 'Signing in…';
        try {
          const client = await getAuthClient();
          const { data, error } = await client.auth.signInWithPassword({
            email: emailInput.value.trim(),
            password: passwordInput.value
          });
          if (error) throw error;
          authTitle.textContent = 'Welcome back';
          authNote.textContent = 'You are signed in.';
          authStatus.textContent = `Signed in as ${data.user?.email || emailInput.value.trim()}.`;
          passwordInput.disabled = true;
          passwordSubmit.textContent = 'Signed in';
        } catch (error) {
          authStatus.textContent = error.message || 'Unable to sign in.';
          passwordSubmit.disabled = false;
        }
        return;
      }

      if (form.dataset.otpSent !== 'true' || !form.reportValidity()) return;

      verifyButton.disabled = true;
      verifyButton.textContent = 'Verifying…';

      getAuthClient()
        .then((client) => client.auth.verifyOtp({
          email: emailInput.value.trim(),
          token: codeInput.value.trim(),
          type: 'email'
        }))
        .then(({ data, error }) => {
          if (error) throw error;
          const userEmail = data.user?.email || emailInput.value.trim();
          authTitle.textContent = mode === 'signup' ? 'Account created' : 'Welcome back';
          authNote.textContent = 'Your email is verified and you are signed in.';
          authStatus.textContent = `Signed in as ${userEmail}.`;
          verifyButton.textContent = 'Verified';
          codeInput.disabled = true;
          sendButton.hidden = true;
        })
        .catch((error) => {
          authStatus.textContent = error.message || 'That code could not be verified. Try again.';
          verifyButton.disabled = false;
          verifyButton.textContent = mode === 'signup' ? 'Verify email and create account' : 'Verify and sign in';
        });
    });
  });

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

    authDialog.addEventListener('close', () => document.body.append(cursorRing, cursorDot));

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
      document.body.classList.add('has-custom-cursor');
      pointerX = event.clientX;
      pointerY = event.clientY;
      cursorDot.style.transform = `translate3d(${pointerX}px, ${pointerY}px, 0) translate(-50%, -50%)`;

      if (!animationFrame) animationFrame = requestAnimationFrame(followPointer);
    }, { passive: true });

    document.addEventListener('pointerover', (event) => {
      if (!(event.target instanceof Element)) return;
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
        video.play().catch(() => {});
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

