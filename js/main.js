/**
 * ============================================================================
 * حلقه شهید هادی ذوالفقاری — Frontend Application
 * ============================================================================
 *
 * @file    main.js
 * @version 3.0.0
 * @author  Kanoon Dev Team
 * @license MIT
 *
 * Architecture:
 *   CONFIG      → تنظیمات مرکزی (immutable)
 *   DATA        → داده‌های نمونه (بعداً از Sheets خوانده می‌شن)
 *   Logger      → لاگ کردن با سطوح مختلف
 *   DOM         → کمک‌کننده‌های DOM
 *   Validate    → اعتبارسنجی ورودی‌ها
 *   Api         → لایه‌ی ارتباط با Google Apps Script
 *   Toast       → نمایش پیام کاربر
 *   Modal       → مدیریت مدال‌ها
 *   Carousel    → اسلایدر صفحه‌ی خانه
 *   Activities  → لیست فعالیت‌ها با فیلتر
 *   Officials   → گرید مسئولین
 *   Schedule    → برنامه‌ی هفتگی
 *   RegisterForm   → فرم ثبت‌نام اردو
 *   FeedbackForm   → فرم پیشنهاد و انتقاد
 *   App         → راه‌انداز نهایی
 * ============================================================================
 */

(function (window, document) {
  'use strict';

  /* ══════════════════════════════════════════════════════════════════════
     CONFIG — تنظیمات مرکزی
     ══════════════════════════════════════════════════════════════════════ */

  var CONFIG = Object.freeze({
    API_URL: 'https://script.google.com/macros/s/AKfycbykIp_S-p5grZvgwLGCwaaajnG7lEbRfiTTu6epq5ATQXPLPtYTZDfUKECameopRDOf/exec',
    CAROUSEL_INTERVAL: 4500,
    TOAST_DURATION: 3200,
    MAX_FILE_SIZE: 5 * 1024 * 1024,
    DEBUG: true,
    VERSION: '3.0.0'
  });


  /* ══════════════════════════════════════════════════════════════════════
     DATA — داده‌های نمونه (فاز بعدی: از Sheets)
     ══════════════════════════════════════════════════════════════════════ */

  var SAMPLE_EVENTS = [
    { id: 1, title: 'مسابقه فوتبال دستی', date: '۱۴۰۳/۱۲/۱۵', category: 'ورزشی',
      image: 'https://images.unsplash.com/photo-1551958219-acbc608c6377?w=600&auto=format&fit=crop' },
    { id: 2, title: 'اردوی زیارتی مشهد مقدس', date: '۱۴۰۳/۱۲/۲۰', category: 'اردو',
      image: 'https://images.unsplash.com/photo-1542810634-71277d95dcbb?w=600&auto=format&fit=crop' },
    { id: 3, title: 'کلاس حفظ قرآن کریم', date: 'هر پنج‌شنبه', category: 'تربیتی',
      image: 'https://images.unsplash.com/photo-1609599006353-e629aaabfeae?w=600&auto=format&fit=crop' },
    { id: 4, title: 'شب شعر و ادبیات', date: '۱۴۰۳/۱۲/۲۵', category: 'فرهنگی',
      image: 'https://images.unsplash.com/photo-1524995997946-a1c2e315a42f?w=600&auto=format&fit=crop' },
    { id: 5, title: 'مسابقات FIFA و PS5', date: 'پنج‌شنبه‌ها', category: 'ورزشی',
      image: 'https://images.unsplash.com/photo-1511512578047-dfb367046420?w=600&auto=format&fit=crop' }
  ];

  var OFFICIALS = [
    { name: 'مهدی رضایی', role: 'مسئول PS5' },
    { name: 'حسین احمدی', role: 'مسئول سیستم صوتی' },
    { name: 'علی محمدی', role: 'مسئول خرید' },
    { name: 'رضا کریمی', role: 'مسئول مسجد' },
    { name: 'امیر حسینی', role: 'مسئول کانون' },
    { name: 'سعید نوری', role: 'مسئول هیئت' },
    { name: 'محمد صادقی', role: 'مسئول مکبری' },
    { name: 'یاسر تقوی', role: 'مسئول آشپزخانه' },
    { name: 'ابوالفضل رحیمی', role: 'مسئول تدارکات' },
    { name: 'میلاد عباسی', role: 'مسئول هماهنگی' },
    { name: 'کاظم شریفی', role: 'مسئول رسانه' },
    { name: 'پویا مرادی', role: 'مسئول اتاق رسانه' },
    { name: 'حامد سلیمی', role: 'مسئول ورزش' },
    { name: 'دانیال اکبری', role: 'مسئول VR' },
    { name: 'سینا جوادی', role: 'مسئول عکاسی' },
    { name: 'رضا مهدوی', role: 'مسئول حضور و غیاب' }
  ];

  var WEEKLY_SCHEDULE = [
    { day: 'شنبه', slots: [
      { time: '18:00', title: 'کلاس قرآن', note: 'حاج آقا موسوی' },
      { time: '19:30', title: 'هیئت هفتگی', note: 'سالن اصلی' }
    ]},
    { day: 'یک‌شنبه', slots: [{ time: '17:30', title: 'تمرین فوتبال', note: 'سالن ورزشی' }] },
    { day: 'دوشنبه', slots: [{ time: '18:00', title: 'دوره تربیتی', note: 'کتاب «مرام»' }] },
    { day: 'سه‌شنبه', slots: [{ time: '19:00', title: 'جلسه مسئولین', note: 'اتاق مدیریت' }] },
    { day: 'چهارشنبه', slots: [{ time: '18:30', title: 'کلاس احکام', note: 'حجت‌الاسلام کریمی' }] },
    { day: 'پنج‌شنبه', slots: [
      { time: '20:00', title: 'مسابقات PS5', note: 'همراه با جایزه' },
      { time: '21:30', title: 'دعای کمیل', note: '' }
    ]},
    { day: 'جمعه', slots: [{ time: '06:00', title: 'دعای ندبه', note: 'سالن اصلی' }] }
  ];


  /* ══════════════════════════════════════════════════════════════════════
     Logger — سیستم لاگ‌گیری
     ══════════════════════════════════════════════════════════════════════ */

  var Logger = {
    _prefix: '[' + 'حلقه' + ']',
    _errPrefix: '[' + 'حلقه-خطا' + ']',

    info: function () {
      if (!CONFIG.DEBUG) return;
      var args = Array.prototype.slice.call(arguments);
      args.unshift(this._prefix);
      console.log.apply(console, args);
    },

    warn: function () {
      var args = Array.prototype.slice.call(arguments);
      args.unshift(this._prefix);
      console.warn.apply(console, args);
    },

    error: function () {
      var args = Array.prototype.slice.call(arguments);
      args.unshift(this._errPrefix);
      console.error.apply(console, args);
    }
  };


  /* ══════════════════════════════════════════════════════════════════════
     DOM — کمک‌کننده‌های کار با DOM
     ══════════════════════════════════════════════════════════════════════ */

  var DOM = {
    /** انتخاب یک عنصر */
    qs: function (selector, root) {
      return (root || document).querySelector(selector);
    },

    /** انتخاب چند عنصر (خروجی: Array) */
    qsa: function (selector, root) {
      return Array.prototype.slice.call(
        (root || document).querySelectorAll(selector)
      );
    },

    /** ساخت المان با ویژگی‌ها و فرزندان */
    create: function (tag, attrs, children) {
      var el = document.createElement(tag);
      if (attrs) {
        Object.keys(attrs).forEach(function (key) {
          if (key === 'class') el.className = attrs[key];
          else if (key === 'text') el.textContent = attrs[key];
          else if (key === 'html') el.innerHTML = attrs[key];
          else el.setAttribute(key, attrs[key]);
        });
      }
      if (children) {
        (Array.isArray(children) ? children : [children]).forEach(function (child) {
          if (typeof child === 'string') el.appendChild(document.createTextNode(child));
          else if (child) el.appendChild(child);
        });
      }
      return el;
    },

    /** افزودن لیسنر */
    on: function (el, event, handler, options) {
      if (!el) return function () {};
      el.addEventListener(event, handler, options || false);
      return function () { el.removeEventListener(event, handler, options || false); };
    },

    /** Event delegation */
    delegate: function (root, selector, event, handler) {
      return DOM.on(root, event, function (e) {
        var target = e.target.closest(selector);
        if (target && root.contains(target)) handler.call(target, e, target);
      });
    },

    /** پاک‌سازی HTML از کاراکترهای خطرناک (بدون regex) */
    escape: function (str) {
      if (str === null || str === undefined) return '';
      return String(str)
        .split('&').join('&amp;')
        .split('<').join('&lt;')
        .split('>').join('&gt;')
        .split('"').join('&quot;')
        .split("'").join('&#39;');
    }
  };


  /* ══════════════════════════════════════════════════════════════════════
     Validate — اعتبارسنجی
     ══════════════════════════════════════════════════════════════════════ */

  var Validate = {
    /** بررسی شماره موبایل ایران (۰۹XXXXXXXXX) — بدون regex */
    iranMobile: function (phone) {
      var p = String(phone || '').trim();
      if (p.length !== 11) return false;
      if (p.charAt(0) !== '0' || p.charAt(1) !== '9') return false;
      for (var i = 0; i < p.length; i++) {
        var c = p.charCodeAt(i);
        if (c < 48 || c > 57) return false; // 0-9
      }
      return true;
    },

    /** بررسی خالی نبودن */
    notEmpty: function (value) {
      return String(value || '').trim().length > 0;
    },

    /** بررسی حجم فایل */
    fileSize: function (file, maxBytes) {
      return file && file.size <= maxBytes;
    },

    /** بررسی نوع فایل تصویری */
    isImage: function (file) {
      if (!file || !file.type) return false;
      return file.type.indexOf('image/') === 0;
    }
  };


  /* ══════════════════════════════════════════════════════════════════════
     Api — لایه‌ی ارتباط با Google Apps Script
     ══════════════════════════════════════════════════════════════════════ */

  var Api = {
    /** ساخت URL با query parameters */
    _buildUrl: function (params) {
      var parts = Object.keys(params).map(function (key) {
        return encodeURIComponent(key) + '=' + encodeURIComponent(params[key]);
      });
      var sep = CONFIG.API_URL.indexOf('?') >= 0 ? '&' : '?';
      return CONFIG.API_URL + sep + parts.join('&');
    },

    /** GET request */
    get: async function (params) {
      var url = Api._buildUrl(params);
      Logger.info('GET', url);

      var res;
      try {
        res = await fetch(url);
      } catch (err) {
        Logger.error('Network error:', err);
        throw new Error('اتصال به سرور برقرار نشد');
      }

      if (!res.ok) {
        throw new Error('پاسخ سرور نامعتبر بود (' + res.status + ')');
      }
      return Api._parse(res);
    },

    /** POST request */
    post: async function (payload) {
      Logger.info('POST action:', payload.action);

      var res;
      try {
        res = await fetch(CONFIG.API_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'text/plain;charset=utf-8' },
          body: JSON.stringify(payload)
        });
      } catch (err) {
        Logger.error('Network error:', err);
        throw new Error('اتصال به سرور برقرار نشد. اینترنت را بررسی کنید');
      }

      if (!res.ok) {
        throw new Error('پاسخ سرور نامعتبر بود (' + res.status + ')');
      }
      return Api._parse(res);
    },

    /** پردازش پاسخ JSON */
    _parse: async function (res) {
      var text = await res.text();
      Logger.info('Response:', text.substring(0, 200));

      var json;
      try {
        json = JSON.parse(text);
      } catch (err) {
        Logger.error('Invalid JSON:', text);
        throw new Error('پاسخ سرور نامعتبر بود');
      }

      if (!json.ok) {
        throw new Error(json.error || 'خطای ناشناخته از سرور');
      }
      return json;
    }
  };


  /* ══════════════════════════════════════════════════════════════════════
     Toast — نمایش پیام کوتاه
     ══════════════════════════════════════════════════════════════════════ */

  var Toast = (function () {
    var timer = null;

    function ensureElement() {
      var el = DOM.qs('#appToast');
      if (!el) {
        el = DOM.create('div', {
          id: 'appToast',
          class: 'toast',
          role: 'status',
          'aria-live': 'polite'
        });
        document.body.appendChild(el);
      }
      return el;
    }

    return {
      show: function (message, type) {
        var el = ensureElement();
        el.textContent = message;
        el.classList.toggle('error', type === 'error');
        el.classList.add('show');

        if (timer) clearTimeout(timer);
        timer = setTimeout(function () {
          el.classList.remove('show');
        }, CONFIG.TOAST_DURATION);
      },

      success: function (msg) { Toast.show(msg, 'success'); },
      error: function (msg)   { Toast.show(msg, 'error'); }
    };
  })();


  /* ══════════════════════════════════════════════════════════════════════
     Modal — مدیریت مدال‌ها
     ══════════════════════════════════════════════════════════════════════ */

  var Modal = {
    _lastFocused: null,

    open: function (modalEl) {
      if (!modalEl) return;
      this._lastFocused = document.activeElement;
      modalEl.classList.add('active');
      document.body.style.overflow = 'hidden';

      var self = this;
      setTimeout(function () {
        var focusable = modalEl.querySelector('input, button, [tabindex]');
        if (focusable) focusable.focus();
      }, 100);
    },

    close: function (modalEl) {
      if (!modalEl) return;
      modalEl.classList.remove('active');
      document.body.style.overflow = '';

      if (this._lastFocused && typeof this._lastFocused.focus === 'function') {
        this._lastFocused.focus();
      }
    }
  };


  /* ══════════════════════════════════════════════════════════════════════
     Carousel — اسلایدر صفحه‌ی خانه
     ══════════════════════════════════════════════════════════════════════ */

  function Carousel(container) {
    if (!container) return;

    var slides = DOM.qsa('.carousel-slide', container);
    var dots   = DOM.qsa('.dot', container);
    if (slides.length < 2) return;

    var self = this;
    var prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    var currentIndex = 0;
    var timerId = null;

    this.setSlide = function (index) {
      if (index < 0 || index >= slides.length) return;

      slides.forEach(function (slide, i) {
        var isActive = i === index;
        slide.classList.toggle('active', isActive);
        slide.setAttribute('aria-hidden', String(!isActive));
      });

      dots.forEach(function (dot, i) {
        var isActive = i === index;
        dot.classList.toggle('active', isActive);
        dot.setAttribute('aria-selected', String(isActive));
      });

      currentIndex = index;
    };

    this.next = function () { self.setSlide((currentIndex + 1) % slides.length); };

    this.start = function () {
      if (prefersReduced) return;
      self.stop();
      timerId = setInterval(self.next, CONFIG.CAROUSEL_INTERVAL);
    };

    this.stop = function () {
      if (timerId) {
        clearInterval(timerId);
        timerId = null;
      }
    };

    // کنترل با دات‌ها
    dots.forEach(function (dot) {
      DOM.on(dot, 'click', function () {
        var idx = parseInt(dot.getAttribute('data-index'), 10);
        if (!isNaN(idx)) {
          self.setSlide(idx);
          self.start();
        }
      });
    });

    // توقف روی hover
    DOM.on(container, 'mouseenter', self.stop);
    DOM.on(container, 'mouseleave', self.start);

    // توقف وقتی تب مخفیه
    DOM.on(document, 'visibilitychange', function () {
      if (document.hidden) self.stop();
      else self.start();
    });

    // Swipe
    var touchStartX = 0;
    DOM.on(container, 'touchstart', function (e) {
      touchStartX = e.changedTouches[0].clientX;
      self.stop();
    }, { passive: true });

    DOM.on(container, 'touchend', function (e) {
      var dx = e.changedTouches[0].clientX - touchStartX;
      if (Math.abs(dx) > 40) {
        var dir = dx < 0 ? 1 : -1;
        self.setSlide((currentIndex + dir + slides.length) % slides.length);
      }
      self.start();
    }, { passive: true });

    this.setSlide(0);
    this.start();
  }


  /* ══════════════════════════════════════════════════════════════════════
     Mentor Login — مدال ورود مربیان
     ══════════════════════════════════════════════════════════════════════ */

  var MentorLogin = {
    _initialized: false,

    _injectModal: function () {
      if (DOM.qs('#loginModal')) return;

      var html = '';
      html += '<div class="modal-content">';
      html +=   '<div class="modal-header">';
      html +=     '<h3 id="loginTitle">ورود مربیان</h3>';
      html +=     '<button type="button" class="close-btn" data-close aria-label="بستن">&times;</button>';
      html +=   '</div>';
      html +=   '<form id="mentorLoginForm" novalidate>';
      html +=     '<div class="form-group">';
      html +=       '<label for="phoneInput">شماره همراه مربی:</label>';
      html +=       '<input type="tel" id="phoneInput" class="form-control"';
      html +=         ' placeholder="09123456789" dir="ltr" inputmode="numeric"';
      html +=         ' autocomplete="tel" maxlength="11" required>';
      html +=     '</div>';
      html +=     '<button type="submit" class="btn-submit">ورود</button>';
      html +=   '</form>';
      html += '</div>';

      var modal = DOM.create('div', {
        id: 'loginModal',
        class: 'modal',
        role: 'dialog',
        'aria-modal': 'true',
        'aria-labelledby': 'loginTitle',
        html: html
      });
      document.body.appendChild(modal);
    },

    init: function () {
      if (this._initialized) return;
      this._initialized = true;

      this._injectModal();

      var modal = DOM.qs('#loginModal');
      var form  = DOM.qs('#mentorLoginForm');
      var input = DOM.qs('#phoneInput');
      if (!modal || !form || !input) return;

      // باز/بسته کردن
      DOM.on(document, 'click', function (e) {
        var trigger = e.target.closest('[data-open-login], .nav-item[href="#"]');
        if (trigger) {
          e.preventDefault();
          Modal.open(modal);
          return;
        }
        if (e.target === modal || e.target.hasAttribute('data-close')) {
          Modal.close(modal);
        }
      });

      DOM.on(document, 'keydown', function (e) {
        if (e.key === 'Escape' && modal.classList.contains('active')) {
          Modal.close(modal);
        }
      });

      // ارسال
      DOM.on(form, 'submit', async function (e) {
        e.preventDefault();

        var phone = input.value.trim();
        if (!Validate.iranMobile(phone)) {
          Toast.error('شماره باید ۱۱ رقم و با ۰۹ شروع شود');
          input.focus();
          return;
        }

        var btn = form.querySelector('button[type="submit"]');
        btn.disabled = true;
        btn.textContent = 'در حال بررسی...';

        try {
          var ok = await MentorLogin.check(phone);
          if (!ok) {
            Toast.error('این شماره در لیست مربیان نیست');
            return;
          }
          Modal.close(modal);
          Toast.success('خوش آمدید 🌿');
          Logger.info('Mentor logged in:', phone);

          // فاز بعدی: انتقال به پنل
          // setTimeout(function () { location.href = 'mentor-panel.html'; }, 800);

        } catch (err) {
          Logger.error('Login failed:', err);
          Toast.error(err.message || 'خطا در ارتباط با سرور');
        } finally {
          btn.disabled = false;
          btn.textContent = 'ورود';
        }
      });
    },

    check: async function (phone) {
      var json = await Api.get({ action: 'checkMentor', phone: phone });
      if (json && json.allowed) {
        try {
          sessionStorage.setItem('mentor_phone', phone);
          sessionStorage.setItem('mentor_name', json.name || '');
        } catch (e) { /* ignore */ }
        return true;
      }
      return false;
    }
  };


  /* ══════════════════════════════════════════════════════════════════════
     Activities — صفحه‌ی فعالیت‌ها
     ══════════════════════════════════════════════════════════════════════ */

  function Activities(listEl) {
    if (!listEl) return;

    var chips = DOM.qsa('.chip[data-filter]');
    var activeFilter = 'all';

    function renderCard(event) {
      return ''
        + '<article class="activity-card">'
        +   '<div class="thumb">'
        +     '<img src="' + DOM.escape(event.image) + '"'
        +          ' alt="' + DOM.escape(event.title) + '" loading="lazy">'
        +     '<span class="badge">' + DOM.escape(event.category) + '</span>'
        +   '</div>'
        +   '<div class="body">'
        +     '<h3>' + DOM.escape(event.title) + '</h3>'
        +     '<div class="meta"><span>' + DOM.escape(event.date) + '</span></div>'
        +   '</div>'
        + '</article>';
    }

    function render() {
      var filtered = (activeFilter === 'all')
        ? SAMPLE_EVENTS
        : SAMPLE_EVENTS.filter(function (ev) {
            return ev.category === activeFilter;
          });

      if (filtered.length === 0) {
        listEl.innerHTML = '<div class="empty"><p>فعالیتی در این دسته یافت نشد</p></div>';
        return;
      }

      listEl.innerHTML = filtered.map(renderCard).join('');
    }

    chips.forEach(function (chip) {
      DOM.on(chip, 'click', function () {
        chips.forEach(function (c) { c.classList.remove('active'); });
        chip.classList.add('active');
        activeFilter = chip.getAttribute('data-filter') || 'all';
        render();
      });
    });

    render();
  }


  /* ══════════════════════════════════════════════════════════════════════
     Officials — گرید مسئولین
     ══════════════════════════════════════════════════════════════════════ */

  function Officials(gridEl) {
    if (!gridEl) return;

    var html = OFFICIALS.map(function (person) {
      var initial = person.name ? person.name.charAt(0) : '؟';
      return ''
        + '<div class="official-card">'
        +   '<div class="avatar">' + DOM.escape(initial) + '</div>'
        +   '<h4>' + DOM.escape(person.name) + '</h4>'
        +   '<span class="role">' + DOM.escape(person.role) + '</span>'
        + '</div>';
    }).join('');

    gridEl.innerHTML = html;
  }


  /* ══════════════════════════════════════════════════════════════════════
     Schedule — برنامه‌ی هفتگی
     ══════════════════════════════════════════════════════════════════════ */

  function Schedule(wrapEl) {
    if (!wrapEl) return;

    var dayIndex = new Date().getDay(); // 0 = Sunday
    var dayNames = ['یک‌شنبه', 'دوشنبه', 'سه‌شنبه', 'چهارشنبه', 'پنج‌شنبه', 'جمعه', 'شنبه'];
    var today = dayNames[dayIndex];

    var html = WEEKLY_SCHEDULE.map(function (day) {
      var isToday = day.day === today;

      var slotsHtml = day.slots.length > 0
        ? day.slots.map(function (slot) {
            return ''
              + '<div class="slot">'
              +   '<span class="time">' + DOM.escape(slot.time) + '</span>'
              +   '<div class="desc">'
              +     '<strong>' + DOM.escape(slot.title) + '</strong>'
              +     (slot.note ? '<small>' + DOM.escape(slot.note) + '</small>' : '')
              +   '</div>'
              + '</div>';
          }).join('')
        : '<div class="slot"><div class="desc"><small>برنامه‌ای ثبت نشده</small></div></div>';

      return ''
        + '<div class="day-block' + (isToday ? ' today' : '') + '">'
        +   '<div class="day-title">'
        +     (isToday ? '<span class="today-tag">امروز</span>' : '')
        +     DOM.escape(day.day)
        +   '</div>'
        +   slotsHtml
        + '</div>';
    }).join('');

    wrapEl.innerHTML = html;
  }


  /* ══════════════════════════════════════════════════════════════════════
     RegisterForm — فرم ثبت‌نام اردو
     ══════════════════════════════════════════════════════════════════════ */

  function RegisterForm(formEl) {
    if (!formEl) return;

    var zone = DOM.qs('#uploadZone');
    var fileInput = DOM.qs('#fileInput');
    var preview = DOM.qs('#uploadPreview');
    var selectedFile = null;

    function handleFile(file) {
      if (!Validate.isImage(file)) {
        Toast.error('فقط فایل تصویری مجاز است');
        return;
      }
      if (!Validate.fileSize(file, CONFIG.MAX_FILE_SIZE)) {
        Toast.error('حجم فایل بیشتر از ۵ مگابایت است');
        return;
      }

      selectedFile = file;

      var reader = new FileReader();
      reader.onload = function (e) {
        if (preview) {
          preview.innerHTML = '<img src="' + e.target.result + '" alt="پیش‌نمایش">';
          preview.classList.add('active');
        }
      };
      reader.readAsDataURL(file);
      Logger.info('File selected:', file.name, file.size + 'B');
    }

    if (zone && fileInput) {
      DOM.on(zone, 'click', function () { fileInput.click(); });

      ['dragenter', 'dragover'].forEach(function (ev) {
        DOM.on(zone, ev, function (e) {
          e.preventDefault();
          zone.classList.add('dragover');
        });
      });

      ['dragleave', 'drop'].forEach(function (ev) {
        DOM.on(zone, ev, function (e) {
          e.preventDefault();
          zone.classList.remove('dragover');
        });
      });

      DOM.on(zone, 'drop', function (e) {
        if (e.dataTransfer.files[0]) handleFile(e.dataTransfer.files[0]);
      });

      DOM.on(fileInput, 'change', function () {
        if (fileInput.files[0]) handleFile(fileInput.files[0]);
      });
    }

    DOM.on(formEl, 'submit', async function (e) {
      e.preventDefault();

      var fields = {
        firstName:   DOM.qs('#firstName'),
        lastName:    DOM.qs('#lastName'),
        phone:       DOM.qs('#phone'),
        fatherName:  DOM.qs('#fatherName'),
        fatherPhone: DOM.qs('#fatherPhone')
      };

      var data = {
        firstName:   fields.firstName   ? fields.firstName.value.trim()   : '',
        lastName:    fields.lastName    ? fields.lastName.value.trim()    : '',
        phone:       fields.phone       ? fields.phone.value.trim()       : '',
        fatherName:  fields.fatherName  ? fields.fatherName.value.trim()  : '',
        fatherPhone: fields.fatherPhone ? fields.fatherPhone.value.trim() : ''
      };

      if (!data.firstName || !data.lastName) {
        Toast.error('نام و نام خانوادگی را کامل وارد کنید');
        return;
      }
      if (!data.fatherName) {
        Toast.error('نام پدر را وارد کنید');
        return;
      }
      if (!Validate.iranMobile(data.phone)) {
        Toast.error('شماره همراه خود را درست وارد کنید');
        return;
      }
      if (!Validate.iranMobile(data.fatherPhone)) {
        Toast.error('شماره همراه پدر را درست وارد کنید');
        return;
      }

      var btn = formEl.querySelector('button[type="submit"]');
      btn.disabled = true;
      btn.textContent = 'در حال ارسال...';

      try {
        await RegisterForm.submit(data, selectedFile);
        formEl.reset();
        if (preview) {
          preview.innerHTML = '';
          preview.classList.remove('active');
        }
        selectedFile = null;
        Toast.success('ثبت‌نام ارسال شد و در انتظار تایید مربی است ✓');
      } catch (err) {
        Logger.error('Registration failed:', err);
        Toast.error(err.message || 'خطا در ارسال. دوباره تلاش کنید');
      } finally {
        btn.disabled = false;
        btn.textContent = 'ثبت‌نام';
      }
    });
  }

  RegisterForm.submit = async function (data, file) {
    var payload = {
      action:      'registerCamp',
      firstName:   data.firstName,
      lastName:    data.lastName,
      phone:       data.phone,
      fatherName:  data.fatherName,
      fatherPhone: data.fatherPhone,
      fileData:    '',
      fileName:    '',
      fileMime:    ''
    };

    if (file) {
      try {
        payload.fileData = await RegisterForm._fileToBase64(file);
        payload.fileName = file.name;
        payload.fileMime = file.type || 'image/jpeg';
        Logger.info('Base64 length:', payload.fileData.length);
      } catch (err) {
        Logger.error('File conversion failed:', err);
      }
    }

    return await Api.post(payload);
  };

  RegisterForm._fileToBase64 = function (file) {
    return new Promise(function (resolve, reject) {
      var reader = new FileReader();
      reader.onload = function () {
        var result = String(reader.result || '');
        var comma = result.indexOf(',');
        resolve(comma >= 0 ? result.slice(comma + 1) : result);
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };


  /* ══════════════════════════════════════════════════════════════════════
     FeedbackForm — فرم پیشنهاد و انتقاد
     ══════════════════════════════════════════════════════════════════════ */

  function FeedbackForm(formEl) {
    if (!formEl) return;

    DOM.on(formEl, 'submit', async function (e) {
      e.preventDefault();

      var data = {
        name:     (DOM.qs('#fbName')     || {}).value || '',
        phone:    (DOM.qs('#fbPhone')    || {}).value || '',
        category: (DOM.qs('#fbCategory') || {}).value || 'پیشنهاد',
        message:  (DOM.qs('#fbMessage')  || {}).value || ''
      };

      data.name = data.name.trim();
      data.phone = data.phone.trim();
      data.message = data.message.trim();

      if (!data.message) {
        Toast.error('متن پیام خالی است');
        return;
      }
      if (data.phone && !Validate.iranMobile(data.phone)) {
        Toast.error('شماره تماس نامعتبر است');
        return;
      }

      var btn = formEl.querySelector('button[type="submit"]');
      btn.disabled = true;
      btn.textContent = 'در حال ارسال...';

      try {
        await Api.post({
          action:   'feedback',
          name:     data.name,
          phone:    data.phone,
          category: data.category,
          message:  data.message
        });
        formEl.reset();
        Toast.success('پیام شما ثبت شد. ممنون از همراهی‌تان 🌿');
      } catch (err) {
        Logger.error('Feedback failed:', err);
        Toast.error(err.message || 'خطا در ارسال پیام');
      } finally {
        btn.disabled = false;
        btn.textContent = 'ارسال پیام';
      }
    });
  }


  /* ══════════════════════════════════════════════════════════════════════
     Navigation — هایلایت نوار پایین
     ══════════════════════════════════════════════════════════════════════ */

  function Navigation() {
    var currentPath = location.pathname.split('/').pop() || 'index.html';
    var items = DOM.qsa('.bottom-nav .nav-item');

    items.forEach(function (item) {
      var href = item.getAttribute('href') || '';
      var isActive = href === currentPath;
      item.classList.toggle('active', isActive);
      if (isActive) item.setAttribute('aria-current', 'page');
      else item.removeAttribute('aria-current');
    });
  }


  /* ══════════════════════════════════════════════════════════════════════
     App — راه‌انداز نهایی
     ══════════════════════════════════════════════════════════════════════ */

  var App = {
    version: CONFIG.VERSION,

    init: function () {
      Logger.info('Booting version ' + this.version + '...');
      Logger.info('API_URL:', CONFIG.API_URL);

      // هر کامپوننت در try/catch مستقل — یک خطا کل سایت رو خراب نمی‌کنه
      this._safe('Navigation',    function () { Navigation(); });
      this._safe('Carousel',      function () { new Carousel(DOM.qs('#carouselContainer')); });
      this._safe('MentorLogin',   function () { MentorLogin.init(); });
      this._safe('Activities',    function () { Activities(DOM.qs('#activityList')); });
      this._safe('Officials',     function () { Officials(DOM.qs('#officialsGrid')); });
      this._safe('Schedule',      function () { Schedule(DOM.qs('#weeklySchedule')); });
      this._safe('RegisterForm',  function () { RegisterForm(DOM.qs('#registerForm')); });
      this._safe('FeedbackForm',  function () { FeedbackForm(DOM.qs('#feedbackForm')); });

      Logger.info('Boot complete ✓');
    },

    _safe: function (name, fn) {
      try {
        fn();
      } catch (err) {
        Logger.error('[' + name + '] Failed:', err);
      }
    }
  };

  // راه‌اندازی
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () { App.init(); });
  } else {
    App.init();
  }

  // در معرض عموم (برای دیباگ و استفاده‌ی بعدی)
  window.KanoonApp = {
    version: CONFIG.VERSION,
    config: CONFIG,
    api: Api,
    validate: Validate,
    toast: Toast,
    modal: Modal,
    data: {
      events: SAMPLE_EVENTS,
      officials: OFFICIALS,
      schedule: WEEKLY_SCHEDULE
    }
  };

})(window, document);
