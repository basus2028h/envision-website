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
    // Clear any existing or duplicate custom cursor elements
    document.querySelectorAll('.custom-cursor').forEach(el => el.remove());

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

  // ---- Header Navigation Slider & Arrow Controls ----
  function initNavSlider() {
    var navs = document.querySelectorAll('.nav-links');
    navs.forEach(function (nav) {
      if (nav.closest('.mobile-menu')) return;

      var wrapper = nav.closest('.nav-slider-wrapper');
      var prevBtn, nextBtn;

      if (!wrapper) {
        wrapper = document.createElement('div');
        wrapper.className = 'nav-slider-wrapper';
        nav.parentNode.insertBefore(wrapper, nav);

        prevBtn = document.createElement('button');
        prevBtn.type = 'button';
        prevBtn.className = 'nav-slider-btn nav-slider-prev';
        prevBtn.setAttribute('aria-label', 'Previous navigation items');
        prevBtn.innerHTML = '<i class="fa-solid fa-chevron-left"></i>';

        nextBtn = document.createElement('button');
        nextBtn.type = 'button';
        nextBtn.className = 'nav-slider-btn nav-slider-next';
        nextBtn.setAttribute('aria-label', 'Next navigation items');
        nextBtn.innerHTML = '<i class="fa-solid fa-chevron-right"></i>';

        wrapper.appendChild(prevBtn);
        wrapper.appendChild(nav);
        wrapper.appendChild(nextBtn);
      } else {
        prevBtn = wrapper.querySelector('.nav-slider-prev');
        nextBtn = wrapper.querySelector('.nav-slider-next');
      }

      function updateControls() {
        var scrollLeft = nav.scrollLeft;
        var maxScroll = Math.max(0, nav.scrollWidth - nav.clientWidth);

        if (prevBtn) {
          var disablePrev = scrollLeft <= 2;
          prevBtn.disabled = disablePrev;
          prevBtn.classList.toggle('is-disabled', disablePrev);
        }

        if (nextBtn) {
          var disableNext = scrollLeft >= maxScroll - 2 || maxScroll <= 2;
          nextBtn.disabled = disableNext;
          nextBtn.classList.toggle('is-disabled', disableNext);
        }
      }

      if (prevBtn && !prevBtn._sliderBound) {
        prevBtn._sliderBound = true;
        prevBtn.addEventListener('click', function (e) {
          e.preventDefault();
          nav.scrollBy({ left: -160, behavior: 'smooth' });
        });
      }

      if (nextBtn && !nextBtn._sliderBound) {
        nextBtn._sliderBound = true;
        nextBtn.addEventListener('click', function (e) {
          e.preventDefault();
          nav.scrollBy({ left: 160, behavior: 'smooth' });
        });
      }

      if (!nav._sliderScrollBound) {
        nav._sliderScrollBound = true;
        nav.addEventListener('scroll', updateControls, { passive: true });
        window.addEventListener('resize', updateControls, { passive: true });

        // Wheel scroll support for the navigation track
        nav.addEventListener('wheel', function (e) {
          if (Math.abs(e.deltaY) > Math.abs(e.deltaX) && nav.scrollWidth > nav.clientWidth) {
            e.preventDefault();
            nav.scrollLeft += e.deltaY;
            updateControls();
          }
        }, { passive: false });
      }

      // Smooth scroll active link into visible view if needed
      requestAnimationFrame(function () {
        updateControls();
        var active = nav.querySelector('a.active');
        if (active) {
          var nRect = nav.getBoundingClientRect();
          var aRect = active.getBoundingClientRect();
          if (aRect.left < nRect.left || aRect.right > nRect.right) {
            active.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
          }
        }
      });
    });
  }
  window.initNavSlider = initNavSlider;

  // ---- Rotating Words Animation Engine ----
  var rotatingWordTimers = new WeakMap();

  function initRotatingWords(root) {
    root = root || document;
    var containers = root.querySelectorAll ? root.querySelectorAll('.animated-word') : [];
    if (root === document) containers = document.querySelectorAll('.animated-word');

    containers.forEach(function (word) {
      if (rotatingWordTimers.has(word)) {
        return;
      }

      var heading = word.closest('h1, h2, h3, .hero-content');
      var sub = heading ? heading.querySelector('.sub') : null;

      var defaultHeroPairs = [
        { sub: 'Build the', word: 'NEXT BIG IDEA' },
        { sub: 'Empower the', word: 'FUTURE FOUNDERS' },
        { sub: 'Launch the', word: 'BOLD STARTUPS' },
        { sub: 'Drive the', word: 'REAL IMPACT' },
        { sub: 'Ignite the', word: 'STARTUP REVOLUTION' }
      ];

      var pairs = [];

      if (word.dataset.pairs) {
        pairs = word.dataset.pairs.split('|').map(function (p) {
          var parts = p.split(':');
          return { sub: parts[0] ? parts[0].trim() : '', word: (parts[1] ? parts[1].trim() : parts[0].trim()) };
        }).filter(function (p) { return Boolean(p.word); });
      } else if (word.dataset.phrases) {
        var rawPhrases = word.dataset.phrases.split('|').map(function (p) { return p.trim(); }).filter(Boolean);
        pairs = rawPhrases.map(function (p) {
          if (p.indexOf(':') !== -1) {
            var parts = p.split(':');
            return { sub: parts[0] ? parts[0].trim() : '', word: (parts[1] ? parts[1].trim() : parts[0].trim()) };
          }
          return { sub: sub ? sub.textContent.trim() : '', word: p };
        });
      } else if (sub || (heading && heading.getAttribute('data-cms-id') === 'txt_index_1')) {
        pairs = defaultHeroPairs;
      } else {
        pairs = [
          { sub: '', word: 'NEXT BIG IDEA' },
          { sub: '', word: 'FUTURE FOUNDERS' },
          { sub: '', word: 'BOLD STARTUPS' },
          { sub: '', word: 'REAL IMPACT' }
        ];
      }

      if (pairs.length <= 1) return;

      var currentWordText = word.textContent.trim().toLowerCase();
      var index = -1;
      for (var i = 0; i < pairs.length; i++) {
        if (pairs[i].word.toLowerCase() === currentWordText) {
          index = i;
          break;
        }
      }
      if (index === -1) index = 0;

      var timerId = setInterval(function () {
        // If element is removed from DOM, cancel timer to avoid orphaned leak
        if (!document.contains(word)) {
          clearInterval(timerId);
          rotatingWordTimers.delete(word);
          return;
        }

        var currentHeading = word.closest('h1, h2, h3, .hero-content');
        var currentSub = currentHeading ? currentHeading.querySelector('.sub') : sub;

        // Pause animation only when editor is actively typing in the heading
        if (word.isContentEditable && (document.activeElement === word || (currentHeading && currentHeading.contains(document.activeElement)))) return;

        word.classList.add('fade');
        if (currentSub) currentSub.classList.add('fade');

        setTimeout(function () {
          if (!document.contains(word)) return;
          index = (index + 1) % pairs.length;
          var nextPair = pairs[index];

          word.textContent = nextPair.word;
          if (currentSub && nextPair.sub) {
            currentSub.textContent = nextPair.sub;
          }

          word.classList.remove('fade');
          if (currentSub) currentSub.classList.remove('fade');
        }, 280);
      }, 2400);

      rotatingWordTimers.set(word, timerId);
    });
  }
  window.initRotatingWords = initRotatingWords;
  initRotatingWords(document);

  // ---- Re-runnable observer/interaction setup ----
  // Called once on load (root = document) and again whenever cms.js replaces
  // a grid's innerHTML via cmsGridRestored so new nodes get observed.
  function initDynamicObservers(root) {
    root = root || document;

    // Reveal animations
    var revealItems = root.querySelectorAll ? root.querySelectorAll('.reveal') : [];
    if (root === document) revealItems = document.querySelectorAll('.reveal');
    var revealObserver = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) entry.target.classList.add('active');
      });
    }, { threshold: 0.12 });
    revealItems.forEach(function (item) { revealObserver.observe(item); });

    // Stat Counter Animation
    var counters = root.querySelectorAll ? root.querySelectorAll('[data-target]') : [];
    if (root === document) counters = document.querySelectorAll('[data-target]');
    var counterObserver = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        var el = entry.target;
        if (document.body.classList.contains('cms-edit-mode')) return;
        var rawText = el.textContent.trim();
        var parsedNum = parseInt(rawText.replace(/[^0-9]/g, ''), 10);
        var target = !isNaN(parsedNum) ? parsedNum : (Number(el.dataset.target) || 0);
        var parsedSuffix = rawText.replace(/[0-9\s]/g, '');
        var suffix = parsedSuffix || (el.dataset.suffix != null ? el.dataset.suffix : '+');
        var duration = 1800;
        var start = performance.now();
        var tick = function (time) {
          var progress = Math.min((time - start) / duration, 1);
          var value = Math.floor(progress * target);
          el.textContent = value + suffix;
          if (progress < 1) requestAnimationFrame(tick);
          else el.textContent = target + suffix;
        };
        requestAnimationFrame(tick);
        counterObserver.unobserve(el);
      });
    }, { threshold: 0.4 });
    counters.forEach(function (counter) { counterObserver.observe(counter); });

    // Signature video clips
    var signatureClips = root.querySelectorAll ? root.querySelectorAll('.signature-clip') : [];
    if (root === document) signatureClips = document.querySelectorAll('.signature-clip');
    var signatureObserver = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        var video = entry.target;
        if (entry.isIntersecting) video.play().catch(function () { });
        else video.pause();
      });
    }, { threshold: 0.1 });
    signatureClips.forEach(function (video) { signatureObserver.observe(video); });


    initRotatingWords(root);
    initInteractiveLeaderStreams(root);
  }

  // ==========================================================================
  // Interactive Infinite Leader Streams (Phone Swipe / Drag & Auto-Resume)
  // Allows users on mobile/touch (and desktop) to slide the pallets back and forth.
  // When untouched, the continuous moving animation smoothly resumes in place.
  // ==========================================================================
  function initInteractiveLeaderStreams(root) {
    var streamRows = (root || document).querySelectorAll('.leaders-stream-row');
    if (!streamRows || streamRows.length === 0) return;

    streamRows.forEach(function (row) {
      if (row._streamController) {
        row._streamController.refresh();
        return;
      }

      var track = row.querySelector('.leaders-stream-track');
      if (!track) return;

      var isReverse = row.classList.contains('leaders-stream-row-reverse');
      // Forward row moves left (-1), Reverse row moves right (+1)
      var baseDirection = isReverse ? 1 : -1;

      var halfWidth = 0;
      var currentX = 0;
      var targetSpeed = 0; // px / sec
      var currentSpeed = 0;
      var baseSpeed = 0;

      var isPointerDown = false;
      var isDragging = false;
      var isAxisLocked = false;
      var isVerticalScroll = false;
      var hasDragged = false;
      var startX = 0;
      var startY = 0;
      var lastPointerX = 0;
      var lastPointerTime = 0;
      var velocity = 0; // px / ms
      var isMomentum = false;
      var isHovered = false;
      var isVisible = true;
      var resumeTimeout = null;

      function measure() {
        var cards = track.querySelectorAll('.leader-card');
        if (cards.length >= 2) {
          var halfIndex = Math.floor(cards.length / 2);
          var dist = cards[halfIndex].offsetLeft - cards[0].offsetLeft;
          if (dist > 50) {
            halfWidth = dist;
          }
        }
        if (!halfWidth || halfWidth <= 50) {
          halfWidth = track.scrollWidth / 2 || 2200;
        }

        // 48s for forward row, 52s for reverse row
        var duration = isReverse ? 52 : 48;
        baseSpeed = baseDirection * (halfWidth / duration);
        if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
          baseSpeed = 0;
        }
        if (!isPointerDown && !isMomentum && !resumeTimeout && !isHovered) {
          targetSpeed = baseSpeed;
        }
      }

      measure();

      // Normalize position strictly within [-halfWidth, 0) for seamless wrap
      function normalize(x) {
        if (!halfWidth || halfWidth <= 0) return x;
        x = x % halfWidth;
        if (x > 0) x -= halfWidth;
        return x;
      }

      // Initial offset for reverse row: offset by halfWidth * 0.5 for aesthetic variety
      if (isReverse) {
        currentX = -halfWidth * 0.5;
      }
      currentX = normalize(currentX);
      currentSpeed = baseSpeed;
      targetSpeed = baseSpeed;

      // Mark row as interactive so CSS keyframe animation is turned off cleanly
      row.classList.add('is-interactive');

      // Schedule untouched auto-resume
      function scheduleResume(delay) {
        if (resumeTimeout) clearTimeout(resumeTimeout);
        resumeTimeout = setTimeout(function () {
          resumeTimeout = null;
          if (!isPointerDown && !isHovered) {
            targetSpeed = baseSpeed;
          }
        }, typeof delay === 'number' ? delay : 750);
      }

      // Pointer Event Handlers (touch, pen, mouse)
      function onPointerDown(e) {
        if (e.isPrimary === false) return;
        if (e.pointerType === 'mouse' && e.button !== 0) return;

        isPointerDown = true;
        isDragging = false;
        hasDragged = false;
        isAxisLocked = false;
        isVerticalScroll = false;
        isMomentum = false;

        if (resumeTimeout) {
          clearTimeout(resumeTimeout);
          resumeTimeout = null;
        }

        startX = e.clientX;
        startY = e.clientY;
        lastPointerX = e.clientX;
        lastPointerTime = performance.now();
        velocity = 0;
        currentSpeed = 0;
        targetSpeed = 0;
      }

      function onPointerMove(e) {
        if (!isPointerDown) return;

        var clientX = e.clientX;
        var clientY = e.clientY;
        var diffX = clientX - startX;
        var diffY = clientY - startY;

        // Direction / axis locking (preserves smooth native vertical page scroll)
        if (!isAxisLocked) {
          var absX = Math.abs(diffX);
          var absY = Math.abs(diffY);
          if (absX > 6 || absY > 6) {
            isAxisLocked = true;
            if (absY > absX) {
              // User is scrolling vertically: release drag, do not hijack
              isVerticalScroll = true;
              isPointerDown = false;
              scheduleResume(400);
              return;
            } else {
              // User is sliding the pallet horizontally
              isVerticalScroll = false;
              isDragging = true;
              hasDragged = true;
              row.classList.add('is-dragging');
              try {
                if (e.pointerId !== undefined && e.target.setPointerCapture) {
                  e.target.setPointerCapture(e.pointerId);
                }
              } catch (_) { }
            }
          } else {
            return; // within initial deadband
          }
        }

        if (isVerticalScroll) return;

        if (isDragging) {
          if (e.cancelable) e.preventDefault();

          var now = performance.now();
          var dt = now - lastPointerTime;
          var deltaX = clientX - lastPointerX;

          if (dt > 0) {
            var instV = deltaX / dt;
            velocity = 0.65 * velocity + 0.35 * instV;
          }

          lastPointerX = clientX;
          lastPointerTime = now;

          // 1:1 direct pallet dragging
          currentX += deltaX;
          currentX = normalize(currentX);
          track.style.transform = 'translate3d(' + currentX.toFixed(2) + 'px, 0, 0)';
        }
      }

      function onPointerUp(e) {
        if (!isPointerDown && !isDragging) return;

        isPointerDown = false;
        try {
          if (e.pointerId !== undefined && e.target.releasePointerCapture) {
            e.target.releasePointerCapture(e.pointerId);
          }
        } catch (_) { }

        if (isDragging) {
          row.classList.remove('is-dragging');
          isDragging = false;

          // Momentum coast if flicked
          if (Math.abs(velocity) > 0.12) {
            var maxV = 2.4;
            velocity = Math.sign(velocity) * Math.min(Math.abs(velocity), maxV);
            isMomentum = true;
          } else {
            // Untouched -> resume auto-moving animation after brief pause
            scheduleResume(750);
          }
        } else {
          scheduleResume(400);
        }

        isAxisLocked = false;
        isVerticalScroll = false;
      }

      function onPointerCancel(e) {
        onPointerUp(e);
      }

      row.addEventListener('pointerdown', onPointerDown, { passive: true });
      window.addEventListener('pointermove', onPointerMove, { passive: false });
      window.addEventListener('pointerup', onPointerUp, { passive: true });
      window.addEventListener('pointercancel', onPointerCancel, { passive: true });

      // Desktop hover pause
      row.addEventListener('mouseenter', function (e) {
        if (e.pointerType === 'touch') return;
        isHovered = true;
        targetSpeed = 0;
      });

      row.addEventListener('mouseleave', function (e) {
        if (e.pointerType === 'touch') return;
        isHovered = false;
        if (!isPointerDown && !isMomentum) {
          scheduleResume(200);
        }
      });

      // Prevent accidental clicks after dragging pallets
      row.addEventListener('click', function (e) {
        if (hasDragged) {
          e.preventDefault();
          e.stopPropagation();
          setTimeout(function () { hasDragged = false; }, 60);
        }
      }, true);

      // Intersection Observer: pause when row is outside viewport (saves phone CPU & battery)
      if (window.IntersectionObserver) {
        var rowObserver = new IntersectionObserver(function (entries) {
          entries.forEach(function (entry) {
            isVisible = entry.isIntersecting;
          });
        }, { threshold: 0.05 });
        rowObserver.observe(row);
      }

      // Continuous Animation Loop (rAF)
      var lastFrameTime = performance.now();
      function tick(now) {
        var dt = Math.min((now - lastFrameTime) / 1000, 0.1);
        lastFrameTime = now;

        if (isVisible && !document.hidden) {
          if (isMomentum) {
            // Momentum decay
            velocity *= Math.pow(0.92, dt * 60);
            currentX += (velocity * 1000) * dt;
            currentX = normalize(currentX);
            track.style.transform = 'translate3d(' + currentX.toFixed(2) + 'px, 0, 0)';

            if (Math.abs(velocity) < 0.02) {
              isMomentum = false;
              scheduleResume(700);
            }
          } else if (!isPointerDown && !isDragging) {
            // Smoothly ease speed back to target
            if (currentSpeed !== targetSpeed) {
              var step = (targetSpeed - currentSpeed) * Math.min(1, dt * 3.5);
              if (Math.abs(targetSpeed - currentSpeed) < 0.5) {
                currentSpeed = targetSpeed;
              } else {
                currentSpeed += step;
              }
            }

            if (Math.abs(currentSpeed) > 0.001) {
              currentX += currentSpeed * dt;
              currentX = normalize(currentX);
              track.style.transform = 'translate3d(' + currentX.toFixed(2) + 'px, 0, 0)';
            }
          }
        }

        requestAnimationFrame(tick);
      }

      requestAnimationFrame(tick);

      var controller = {
        refresh: function () {
          measure();
          currentX = normalize(currentX);
          track.style.transform = 'translate3d(' + currentX.toFixed(2) + 'px, 0, 0)';
        }
      };

      row._streamController = controller;
    });
  }

  initDynamicObservers(document);

  // Re-run observer setup whenever cms.js (or the public apply()) replaces a
  // grid's innerHTML — prevents .reveal nodes and leader-card filter from
  // silently breaking after a card image change or structural grid restore.
  document.addEventListener('cmsGridRestored', function (e) {
    var gridEl = e.target;
    if (gridEl && gridEl.querySelectorAll) {
      initDynamicObservers(gridEl);
    }
    initRotatingWords(document);
    initInteractiveLeaderStreams(document);
  });

  // Re-measure on window resize / orientation change
  window.addEventListener('resize', function () {
    var streamRows = document.querySelectorAll('.leaders-stream-row');
    streamRows.forEach(function (row) {
      if (row._streamController) row._streamController.refresh();
    });
  });


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

  // FAQ Accordion — document-level delegation is already capture-based so it
  // keeps working even after innerHTML replacements; no re-setup needed.

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

  // Media Loading Placeholder Handler (shows placeholder.svg while images / videos load)
  initMediaPlaceholders();

  // Initialize Header Navigation Slider and Arrow Controls
  initNavSlider();
});

/* ============================================================
   Automatic Media Placeholder & Loading Handler
   Shows placeholder.svg while images and videos load
   ============================================================ */
function initMediaPlaceholders() {
  var PLACEHOLDER_URL = 'placeholder.svg';

  function setupImage(img) {
    if (img.closest('.logo-mark, .logo, .logo-pair')) return;

    var parent = img.closest('.card-media, .vision-mission-media, .image-panel, .cms-hero-media-wrap, .media-placeholder-container');
    var currentSrc = img.getAttribute('src') || '';

    if (currentSrc.endsWith(PLACEHOLDER_URL) || currentSrc === PLACEHOLDER_URL) {
      img.classList.remove('media-loading');
      img.classList.add('media-loaded');
      if (parent) parent.classList.remove('is-media-loading');
      return;
    }

    if (img.complete && img.naturalWidth > 0) {
      img.classList.remove('media-loading');
      img.classList.add('media-loaded');
      if (parent) parent.classList.remove('is-media-loading');
      return;
    }

    img.classList.remove('media-loaded');
    img.classList.add('media-loading');
    if (parent) parent.classList.add('is-media-loading');

    var onLoad = function () {
      img.classList.remove('media-loading');
      img.classList.add('media-loaded');
      if (parent) parent.classList.remove('is-media-loading');
      img.removeEventListener('load', onLoad);
      img.removeEventListener('error', onError);
    };

    var onError = function () {
      if (!img.src.endsWith(PLACEHOLDER_URL)) {
        img.src = PLACEHOLDER_URL;
      }
      img.classList.remove('media-loading');
      img.classList.add('media-loaded');
      if (parent) parent.classList.remove('is-media-loading');
      img.removeEventListener('load', onLoad);
      img.removeEventListener('error', onError);
    };

    img.addEventListener('load', onLoad);
    img.addEventListener('error', onError);
  }

  function setupVideo(video) {
    if (video.classList.contains('cms-hero-media-el') || video.closest('.cms-hero-media-wrap, .hero, .page-hero')) {
      // Hero background video: must autoplay, loop, muted, with no placeholder poster
      const currentSrc = video.getAttribute('src') || video.src || '';
      if (currentSrc.startsWith('data:') && currentSrc.length > 50000) {
        video.src = 'hero-video.mp4';
      }
      video.muted = true;
      video.defaultMuted = true;
      video.setAttribute('muted', '');
      video.setAttribute('playsinline', '');
      video.setAttribute('autoplay', '');
      video.removeAttribute('poster');
      video.classList.remove('media-loading');
      video.classList.add('media-loaded');
      var p = video.play();
      if (p !== undefined) {
        p.catch(function () {
          video.muted = true;
          video.setAttribute('muted', '');
          video.play().catch(function () { });
        });
      }
      return;
    }

    if (!video.getAttribute('poster')) {
      video.setAttribute('poster', PLACEHOLDER_URL);
    }
    var parent = video.closest('.hero, .page-hero, .image-panel, .card-media, .cms-hero-media-wrap') || video.parentElement;

    if (video.readyState >= 2 || !video.paused) {
      video.classList.remove('media-loading');
      video.classList.add('media-loaded');
      if (parent) parent.classList.remove('is-media-loading');
      return;
    }

    video.classList.add('media-loading');
    if (parent && (parent.classList.contains('image-panel') || parent.classList.contains('card-media'))) {
      parent.classList.add('is-media-loading');
    }

    var onVideoReady = function () {
      video.classList.remove('media-loading');
      video.classList.add('media-loaded');
      if (parent) parent.classList.remove('is-media-loading');
      video.removeEventListener('loadeddata', onVideoReady);
      video.removeEventListener('canplay', onVideoReady);
      video.removeEventListener('playing', onVideoReady);
    };

    video.addEventListener('loadeddata', onVideoReady);
    video.addEventListener('canplay', onVideoReady);
    video.addEventListener('playing', onVideoReady);
  }

  document.querySelectorAll('img').forEach(setupImage);
  document.querySelectorAll('video').forEach(setupVideo);

  if (window.MutationObserver) {
    var observer = new MutationObserver(function (mutations) {
      var needsWordInit = false;
      mutations.forEach(function (m) {
        if (m.type === 'childList') {
          m.addedNodes.forEach(function (node) {
            if (node.nodeType === Node.ELEMENT_NODE) {
              if (node.tagName === 'IMG') setupImage(node);
              else if (node.tagName === 'VIDEO') setupVideo(node);
              else if (node.querySelectorAll) {
                node.querySelectorAll('img').forEach(setupImage);
                node.querySelectorAll('video').forEach(setupVideo);
              }
              if (node.classList && node.classList.contains('animated-word')) {
                needsWordInit = true;
              } else if (node.querySelector && node.querySelector('.animated-word')) {
                needsWordInit = true;
              }
            }
          });
        } else if (m.type === 'attributes' && m.attributeName === 'src') {
          if (m.target.tagName === 'IMG') setupImage(m.target);
          else if (m.target.tagName === 'VIDEO') setupVideo(m.target);
        }
      });
      if (needsWordInit && typeof window.initRotatingWords === 'function') {
        window.initRotatingWords(document);
      }
    });

    if (document.body) {
      observer.observe(document.body, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ['src']
      });
    }
  }

  document.addEventListener('cmsGridRestored', function () {
    document.querySelectorAll('img').forEach(setupImage);
    document.querySelectorAll('video').forEach(setupVideo);
  });
}

// Run immediately for elements already parsed
if (document.readyState === 'interactive' || document.readyState === 'complete') {
  initMediaPlaceholders();
}


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
    if (/^data:(?:image\/(?:png|jpe?g|gif|webp)|video\/(?:mp4|webm|ogg));base64,/i.test(v)) return true;
    if (/^https?:\/\//i.test(v)) return true;
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
    '.cms-move-menu-toggle',
    '.cms-hero-sound-btn'
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
      if (typeof value === 'boolean') {
        clean[key] = value;
      } else if (typeof value === 'string' && value.length <= 80 && /^[#a-z0-9(),.%\s-]+$/i.test(value) && !/url|expression|import/i.test(value)) {
        clean[key] = value;
      }
    });
    return clean;
  }

  function applyGlobalStyles(styles) {
    if (!styles) return;
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

    if (styles.fontPrimary) {
      css += 'body, p, span, a, li, input, button { font-family: ' + styles.fontPrimary + ', -apple-system, sans-serif !important; }\n';
    }
    if (styles.fontHeading) {
      css += 'h1, h2, h3, h4, h5, h6, .section-label, .stat-number, .leader-name, .logo-title { font-family: ' + styles.fontHeading + ', sans-serif !important; }\n';
    }
    if (styles.fontMono) {
      css += 'code, pre, .mono-eyebrow, .badge, .section-label { font-family: ' + styles.fontMono + ', monospace !important; }\n';
    }

    if (styles.isDarkMode) {
      if (document.body) document.body.classList.add('theme-dark');
      css += 'body { background-color: ' + (styles.bg || '#0b0f19') + ' !important; color: ' + (styles.text || '#f1f5f9') + ' !important; }\n';
      css += '.ambient-canvas { background: ' + (styles.bg || '#0b0f19') + ' !important; }\n';
      css += '.topbar { background: rgba(11, 15, 25, 0.92) !important; border-bottom: 1px solid rgba(255, 255, 255, 0.1) !important; }\n';
      css += '.card, .stat-box, .faq-item, .promo-band, .leader-card { background: ' + (styles.panel || '#131b2e') + ' !important; border-color: ' + (styles.line || 'rgba(255, 255, 255, 0.12)') + ' !important; color: ' + (styles.text || '#f1f5f9') + ' !important; }\n';
      css += '.card-body p, .faq-answer p, .stat-label { color: ' + (styles.muted || '#94a3b8') + ' !important; }\n';
    } else {
      if (document.body) document.body.classList.remove('theme-dark');
      if (styles.bg) {
        css += 'body { background-color: ' + styles.bg + ' !important; }\n';
        css += '.ambient-canvas { background: ' + styles.bg + ' !important; }\n';
      }
    }

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

  function normalizeEventsRow(row) {
    if (!row || pagePath !== 'events.html') return row;
    var content = row.content_data;
    if (content && content.txt_events_2 && typeof content.txt_events_2.html === 'string') {
      if (!content.txt_events_2.html.includes('animated-word')) {
        content.txt_events_2.html = content.txt_events_2.html.replace(
          /<span\b[^>]*class="[^"]*gradient-text[^"]*"[^>]*>[\s\S]*?<\/span>(\s*action\.?)?/i,
          '<span class="gradient-text animated-word" data-phrases="building action.|igniting ideas.|scaling ventures.|creating impact.|inspiring leaders.">building action.</span>'
        );
      }
    }
    if (content && content.txt_events_4 && content.txt_events_4.html === 'YES') {
      var remapped = {};
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
      for (var i = 24; i <= 38; i++) {
        var oldKey = 'txt_events_' + i;
        var newKey = 'txt_events_' + (i + 6);
        if (content[oldKey]) remapped[newKey] = content[oldKey];
      }
      row.content_data = remapped;
      if (row.grid_data && row.grid_data.grid_events_1 && (row.grid_data.grid_events_1.length > 50000 || row.grid_data.grid_events_1.indexOf('txt_events_8') === -1)) {
        delete row.grid_data.grid_events_1;
      }
      if (row.grid_data && row.grid_data.grid_events_2 && row.grid_data.grid_events_2.indexOf('<p></p>') !== -1) {
        delete row.grid_data.grid_events_2;
      }
    }
    if (content) {
      if (content.txt_events_6 && content.txt_events_6.html && (content.txt_events_6.html.includes('conclave') || content.txt_events_6.html.includes('founders'))) {
        delete content.txt_events_6;
      }
      if (content.txt_events_13 && content.txt_events_13.html === 'YES') {
        content.txt_events_12 = { type: 'text', html: 'Talks', style: {} };
        content.txt_events_13 = { type: 'text', html: 'TEDx', style: {} };
        content.txt_events_14 = { type: 'text', html: 'Ideas worth spreading', style: {} };
        content.txt_events_15 = { type: 'text', html: 'An intellectual platform showcasing insight-rich conversations from founders, artists, builders, and leaders.', style: {} };
      }
      if (content.txt_events_19 && (content.txt_events_19.html === 'TEDx' || content.txt_events_19.html === 'Ideas worth spreading')) {
        content.txt_events_17 = { type: 'text', html: 'Competition', style: {} };
        content.txt_events_18 = { type: 'text', html: 'Odyssey', style: {} };
        content.txt_events_19 = { type: 'text', html: 'Startup B-Plan Competition', style: {} };
        content.txt_events_20 = { type: 'text', html: 'A challenge-driven platform for students to test ideas, solve real problems, and pitch business models with conviction.', style: {} };
      }
    }
    if (row.grid_data && row.grid_data.grid_events_1) {
      if (row.grid_data.grid_events_1.indexOf('fa-photo-film') !== -1 || (row.grid_data.grid_events_1.match(/YES/g) || []).length > 2 || row.grid_data.grid_events_1.indexOf('wp-add-card-placeholder') !== -1) {
        delete row.grid_data.grid_events_1;
      }
    }
    return row;
  }

  function normalizeIndexRow(row) {
    if (!row || (pagePath !== 'index.html' && pagePath !== '')) return row;
    var content = row.content_data;
    if (content && content.txt_index_1 && typeof content.txt_index_1.html === 'string') {
      var h = content.txt_index_1.html;
      if (!h.includes('data-pairs')) {
        content.txt_index_1.html = '<span class="sub">Build the</span>\n<span class="animated-word" data-pairs="Build the: NEXT BIG IDEA | Empower the: FUTURE FOUNDERS | Launch the: BOLD STARTUPS | Drive the: REAL IMPACT | Ignite the: STARTUP REVOLUTION">NEXT BIG IDEA</span>';
      }
    }
    return row;
  }

  function apply(row) {
    if (!row) return;
    row = normalizeEventsRow(row);
    row = normalizeIndexRow(row);

    // 1. Card grids (added / removed / reordered cards)
    var grids = row.grid_data;
    if (grids && typeof grids === 'object') {
      Object.keys(grids).forEach(function (id) {
        var el = byAttr('data-cms-grid-id', id);
        if (el && typeof grids[id] === 'string' && grids[id]) {
          el.innerHTML = sanitizeHtml(grids[id]);
          // Fire cmsGridRestored so initDynamicObservers re-attaches to new nodes
          el.dispatchEvent(new CustomEvent('cmsGridRestored', { bubbles: true, detail: { gridId: id } }));
        }
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

      if (window.initRotatingWords) {
        window.initRotatingWords(document);
      }

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
          heroSec.classList.add('has-cms-media');
          var pos = heroSettings.position || 'full';
          wrap.className = 'cms-hero-media-wrap pos-' + pos;
          wrap.style.width = pos === 'full' ? '100%' : ((heroSettings.width || 100) + '%');
          wrap.style.height = (heroSettings.height !== undefined ? heroSettings.height : '100%');
          wrap.style.opacity = (heroSettings.opacity !== undefined ? heroSettings.opacity : 0.35).toString();

          var blurPx = heroSettings.blur !== undefined ? Number(heroSettings.blur) : 0;
          if (blurPx > 0) {
            wrap.style.filter = 'blur(' + blurPx + 'px)';
            wrap.style.webkitFilter = 'blur(' + blurPx + 'px)';
          } else {
            wrap.style.filter = 'none';
            wrap.style.webkitFilter = 'none';
            wrap.style.removeProperty('filter');
            wrap.style.removeProperty('-webkit-filter');
          }

          var fit = heroSettings.objectFit || 'cover';
          if (heroSettings.type === 'video') {
            var vid = document.createElement('video');
            vid.className = 'cms-hero-media-el';
            vid.autoplay = true;
            vid.muted = (heroSettings.muted !== false);
            vid.defaultMuted = (heroSettings.muted !== false);
            if (heroSettings.muted !== false) {
              vid.setAttribute('muted', '');
            } else {
              vid.removeAttribute('muted');
            }
            var volVal = typeof heroSettings.volume === 'number' ? heroSettings.volume : 80;
            vid.volume = Math.max(0, Math.min(1, volVal / 100));
            vid.loop = true;
            vid.playsInline = true;
            vid.setAttribute('playsinline', '');
            vid.setAttribute('autoplay', '');
            vid.setAttribute('aria-hidden', 'true');
            vid.removeAttribute('poster');
            vid.style.objectFit = fit;
            vid.src = heroSettings.src;
            wrap.append(vid);
            var playP = vid.play();
            if (playP !== undefined) {
              playP.catch(function () {
                if (!vid.muted) {
                  vid.muted = true;
                  vid.setAttribute('muted', '');
                  vid.play().catch(function () { });
                }
              });
            }

            // Ensure no floating sound button is rendered
            var oldSoundBtn = heroSec.querySelector('.cms-hero-sound-btn');
            if (oldSoundBtn) oldSoundBtn.remove();
            heroSec.querySelectorAll('.cms-hero-sound-btn').forEach(function (b) { b.remove(); });
          } else {
            var oldSoundBtn = heroSec.querySelector('.cms-hero-sound-btn');
            if (oldSoundBtn) oldSoundBtn.remove();
            heroSec.querySelectorAll('.cms-hero-sound-btn').forEach(function (b) { b.remove(); });

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
          if (overlayType === 'none') {
            overlay.style.display = 'none';
          } else {
            overlay.style.display = '';
          }
        }
      }

      removeHeroAudioButtons();
    }

    // 3. Global colours & Navigation menu (F1, F2)
    if (row.global_styles && typeof row.global_styles === 'object') {
      applyGlobalStyles(row.global_styles);
      try {
        localStorage.setItem('envision_cms_global_styles', JSON.stringify(row.global_styles));
      } catch (e) { }
      if (Array.isArray(row.global_styles._nav) && row.global_styles._nav.length > 0) {
        var navItems = reconcileNavItems(row.global_styles._nav);
        renderNavItems(navItems);
      }
    }
  }

  // Master canonical page links: AIC and core tabs are ALWAYS guaranteed
  var CANONICAL_PAGES = [
    { title: 'Home', url: 'index.html' },
    { title: 'About', url: 'about.html' },
    { title: 'Events', url: 'events.html' },
    { title: 'Incubation', url: 'incubation.html' },
    { title: 'FAQs', url: 'index.html#faq' },
    { title: 'Contact', url: 'contact.html' },
    { title: 'AIC', url: 'aic.html' }
  ];

  function reconcileNavItems(baseItems) {
    var items = Array.isArray(baseItems) && baseItems.length > 0 ? baseItems.slice() : [];

    // Ensure all canonical pages are present
    CANONICAL_PAGES.forEach(function (canon) {
      var exists = items.some(function (it) {
        return (it.url || '').toLowerCase() === canon.url.toLowerCase();
      });
      if (!exists) {
        if (canon.title === 'FAQs') {
          var contactIdx = items.findIndex(function (it) {
            return (it.url || '').toLowerCase() === 'contact.html';
          });
          if (contactIdx !== -1) {
            items.splice(contactIdx, 0, { title: canon.title, url: canon.url });
            return;
          }
        }
        items.push({ title: canon.title, url: canon.url });
      }
    });

    // Merge links from current DOM only if items list is empty
    if (items.length === 0) {
      var domLinks = document.querySelectorAll('.nav-links > a:not(.nav-cta), .mobile-menu-inner > a:not(.mobile-connect)');
      domLinks.forEach(function (a) {
        var href = (a.getAttribute('href') || '').trim();
        var text = a.textContent.trim().replace(/^Move\s+/i, '');
        if (href && text && !href.startsWith('#') && !href.startsWith('javascript:')) {
          var exists = items.some(function (it) {
            return (it.url || '').toLowerCase() === href.toLowerCase();
          });
          if (!exists) {
            items.push({ title: text, url: href });
          }
        }
      });
    }

    return items;
  }

  window.addEventListener('storage', function (e) {
    if (e.key === 'envision_cms_global_nav' && e.newValue) {
      try {
        var parsed = JSON.parse(e.newValue);
        if (Array.isArray(parsed) && parsed.length > 0) {
          renderNavItems(reconcileNavItems(parsed));
        }
      } catch (err) { }
    }
  });

  function renderNavItems(navItems) {
    if (!Array.isArray(navItems) || navItems.length === 0) return;
    try {
      localStorage.setItem('envision_cms_global_nav', JSON.stringify(navItems));
    } catch (e) { }

    var navContainers = document.querySelectorAll('.nav-links, .mobile-menu-inner');
    navContainers.forEach(function (container) {
      var isMobile = container.classList.contains('mobile-menu-inner');
      container.innerHTML = navItems.map(function (item) {
        var u = (item.url || '#').trim();
        if (/^\/\//.test(u) || /^(?:javascript|data|vbscript):/i.test(u)) u = '#';
        var activeClass = (u === pagePath || (u === 'index.html' && pagePath === '')) ? ' class="active"' : '';
        return '<a href="' + encodeURI(u) + '"' + activeClass + '>' + String(item.title || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;') + '</a>';
      }).join('');

      if (isMobile && !container.querySelector('.mobile-connect')) {
        var conn = document.createElement('a');
        conn.href = 'contact.html';
        conn.className = 'mobile-connect';
        conn.textContent = 'Connect With Us';
        container.append(conn);
      }
    });

    if (typeof initNavSlider === 'function') initNavSlider();
  }

  function removeHeroAudioButtons() {
    document.querySelectorAll('.cms-hero-sound-btn').forEach(function (b) {
      try { b.remove(); } catch (e) { }
    });
  }

  // Instant local theme, navigation, page content & grids bootstrap
  try {
    var earlyStyles = localStorage.getItem('envision_cms_global_styles');
    if (earlyStyles) {
      try { applyGlobalStyles(JSON.parse(earlyStyles)); } catch (e) { }
    }
    var earlyNav = localStorage.getItem('envision_cms_global_nav');
    var earlyNavItems = [];
    try { if (earlyNav) earlyNavItems = JSON.parse(earlyNav); } catch (e) { }
    var mergedEarly = reconcileNavItems(earlyNavItems);
    renderNavItems(mergedEarly);

    var storedContent = localStorage.getItem('envision_cms_content_' + pagePath);
    var storedGrids = localStorage.getItem('envision_cms_grids_' + pagePath);
    var storedHero = localStorage.getItem('envision_cms_hero_' + pagePath);
    if (storedContent || storedGrids || storedHero) {
      var localRow = {
        page_path: pagePath,
        content_data: storedContent ? JSON.parse(storedContent) : {},
        grid_data: storedGrids ? JSON.parse(storedGrids) : {},
        global_styles: earlyStyles ? JSON.parse(earlyStyles) : {}
      };
      if (storedHero) {
        try {
          localRow.content_data._hero = { type: 'hero', data: JSON.parse(storedHero) };
        } catch (e) { }
      }
      apply(localRow);
      if (pagePath === 'index.html' && localRow.content_data && localRow.content_data.txt_index_1) {
        try { localStorage.setItem('envision_cms_content_' + pagePath, JSON.stringify(localRow.content_data)); } catch (e) { }
      }
    }
    removeHeroAudioButtons();
  } catch (e) { }

  function load() {
    removeHeroAudioButtons();
    // S15: Skip Supabase request on 404 / 403 / 500 or error pages
    if (document.querySelector('.error-hero, [data-error-page]')) return;
    if (typeof fetch !== 'function') return;
    var controller = typeof AbortController === 'function' ? new AbortController() : null;
    var timer = controller ? setTimeout(function () { controller.abort(); }, 6000) : null;
    var url = SUPABASE_URL + '/rest/v1/site_content?select=page_path,content_data,grid_data,global_styles,updated_at&page_path=in.(' + encodeURIComponent(pagePath) + ',_global)';
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
          if (pageRow) {
            var localSavedAt = 0;
            try {
              var ts = localStorage.getItem('envision_cms_saved_at_' + pagePath);
              if (ts) localSavedAt = parseInt(ts, 10) || 0;
            } catch (e) { }
            var remoteSavedAt = pageRow.updated_at ? new Date(pageRow.updated_at).getTime() : 0;
            var hasLocalEdits = Boolean(storedContent || storedGrids || storedHero);
            // If local edits exist, do NOT let stale remote database rows overwrite local work
            if (!hasLocalEdits || (localSavedAt && remoteSavedAt > localSavedAt)) {
              apply(pageRow);
            }
          }
        }
        removeHeroAudioButtons();
      })
      .catch(function () { /* keep the built-in or locally loaded page content */ })
      .then(function () { if (timer) clearTimeout(timer); removeHeroAudioButtons(); });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', load);
  else load();
})();
