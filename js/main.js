/* ============================================================================
   حلقه شهید هادی ذوالفقاری — main.js
   نسخه 4.0 — با اتصال به Google Apps Script
   ============================================================================ */

(function (window, document) {
  'use strict';

  /* ══════════════════════════════════════════════════════════════════════
     CONFIG — تنظیمات
     ══════════════════════════════════════════════════════════════════════ */

  var CONFIG = {
    API_URL: 'https://script.google.com/macros/s/AKfycbykIp_S-p5grZvgwLGCwaaajnG7lEbRfiTTu6epq5ATQXPLPtYTZDfUKECameopRDOf/exec',
    CAROUSEL_INTERVAL: 4500,
    TOAST_DURATION: 3200,
    MAX_FILE_SIZE: 5 * 1024 * 1024,
    DEBUG: true,
    VERSION: '4.0.0'
  };

  /* ══════════════════════════════════════════════════════════════════════
     Logger — لاگ گرفتن
     ══════════════════════════════════════════════════════════════════════ */

  var Logger = {
    info: function () {
      if (!CONFIG.DEBUG) return;
      var args = Array.prototype.slice.call(arguments);
      args.unshift('[کانون]');
      console.log.apply(console, args);
    },
    error: function () {
      var args = Array.prototype.slice.call(arguments);
      args.unshift('[کانون-خطا]');
      console.error.apply(console, args);
    }
  };

  /* ══════════════════════════════════════════════════════════════════════
     DOM — کمک‌کننده‌ها
     ══════════════════════════════════════════════════════════════════════ */

  var DOM = {
    qs: function (sel, root) {
      return (root || document).querySelector(sel);
    },
    qsa: function (sel, root) {
      return Array.prototype.slice.call(
        (root || document).querySelectorAll(sel)
      );
    },
    on: function (el, ev, fn, opt) {
      if (!el) return function () {};
      el.addEventListener(ev, fn, opt || false);
      return function () { el.removeEventListener(ev, fn, opt || false); };
    },
    escape: function (str) {
      if (str === null || str === undefined) return '';
      return String(str)
        .split('&').join('&amp;')
        .split('<').join('&lt;')
        .split('>').join('&gt;')
        .split('"').join('&quot;')
        .split("'").join('&#39;');
    },
    toPersianNum: function (num) {
      var en = String(num);
      var fa = ['۰','۱','۲','۳','۴','۵','۶','۷','۸','۹'];
      var out = '';
      for (var i = 0; i < en.length; i++) {
        var c = en.charAt(i);
        var idx = en.indexOf(c);
        var code = c.charCodeAt(0);
        if (code >= 48 && code <= 57) {
          out = out + fa[code - 48];
        } else {
          out = out + c;
        }
      }
      return out;
    }
  };

  /* ══════════════════════════════════════════════════════════════════════
     Validate — اعتبارسنجی
     ══════════════════════════════════════════════════════════════════════ */

  var Validate = {
    iranMobile: function (phone) {
      var p = String(phone || '').trim();
      if (p.length !== 11) return false;
      if (p.charAt(0) !== '0' || p.charAt(1) !== '9') return false;
      for (var i = 0; i < 11; i++) {
        var c = p.charCodeAt(i);
        if (c < 48 || c > 57) return false;
      }
      return true;
    },
    notEmpty: function (v) {
      return String(v || '').trim().length > 0;
    },
    isImage: function (file) {
      if (!file || !file.type) return false;
      return file.type.indexOf('image/') === 0;
    },
    fileSize: function (file, max) {
      return file && file.size <= max;
    }
  };

  /* ══════════════════════════════════════════════════════════════════════
     Api — لایه‌ی ارتباط با Apps Script
     ══════════════════════════════════════════════════════════════════════ */

  var Api = {
    _buildUrl: function (params) {
      var parts = [];
      var keys = Object.keys(params);
      for (var i = 0; i < keys.length; i++) {
        var k = keys[i];
        parts.push(encodeURIComponent(k) + '=' + encodeURIComponent(params[k]));
      }
      var sep = CONFIG.API_URL.indexOf('?') >= 0 ? '&' : '?';
      return CONFIG.API_URL + sep + parts.join('&');
    },

    get: async function (params) {
      var url = Api._buildUrl(params);
      Logger.info('GET', url);

      var res;
      try {
        res = await fetch(url);
      } catch (err) {
        Logger.error('Network:', err);
        throw new Error('اتصال به سرور برقرار نشد');
      }
      if (!res.ok) throw new Error('خطای سرور: ' + res.status);
      return Api._parse(res);
    },

    post: async function (payload) {
      Logger.info('POST', payload.action);

      var res;
      try {
        res = await fetch(CONFIG.API_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'text/plain;charset=utf-8' },
          body: JSON.stringify(payload)
        });
      } catch (err) {
        Logger.error('Network:', err);
        throw new Error('اتصال به سرور برقرار نشد. اینترنت رو چک کن');
      }
      if (!res.ok) throw new Error('خطای سرور: ' + res.status);
      return Api._parse(res);
    },

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
      if (!json.ok) throw new Error(json.error || 'خطای ناشناخته');
      return json;
    }
  };

  /* ══════════════════════════════════════════════════════════════════════
     Toast — پیام کوتاه
     ══════════════════════════════════════════════════════════════════════ */

  var Toast = (function () {
    var timer = null;

    function ensure() {
      var el = DOM.qs('#appToast');
      if (!el) {
        el = document.createElement('div');
        el.id = 'appToast';
        el.className = 'toast';
        el.setAttribute('role', 'status');
        el.setAttribute('aria-live', 'polite');
        document.body.appendChild(el);
      }
      return el;
    }

    return {
      show: function (msg, type) {
        var el = ensure();
        el.textContent = msg;
        el.classList.toggle('error', type === 'error');
        el.classList.add('show');
        if (timer) clearTimeout(timer);
        timer = setTimeout(function () { el.classList.remove('show'); }, CONFIG.TOAST_DURATION);
      },
      success: function (m) { Toast.show(m, 'success'); },
      error: function (m)   { Toast.show(m, 'error'); }
    };
  })();

  /* ══════════════════════════════════════════════════════════════════════
     Modal — مدیریت مدال‌ها
     ══════════════════════════════════════════════════════════════════════ */

  var Modal = {
    _last: null,
    open: function (el) {
      if (!el) return;
      this._last = document.activeElement;
      el.classList.add('active');
      document.body.style.overflow = 'hidden';
      setTimeout(function () {
        var f = el.querySelector('input, button, [tabindex]');
        if (f) f.focus();
      }, 100);
    },
    close: function (el) {
      if (!el) return;
      el.classList.remove('active');
      document.body.style.overflow = '';
      if (this._last && typeof this._last.focus === 'function') this._last.focus();
    }
  };

  /* ══════════════════════════════════════════════════════════════════════
     Session — مدیریت ورود کاربر و مسئول
     ══════════════════════════════════════════════════════════════════════ */

  var Session = {
    _keyUser: 'kanoon_member',
    _keyOfficial: 'kanoon_official',

    setMember: function (member) {
      try {
        sessionStorage.setItem(this._keyUser, JSON.stringify(member));
      } catch (e) { Logger.error('Session set error', e); }
    },
    getMember: function () {
      try {
        var raw = sessionStorage.getItem(this._keyUser);
        return raw ? JSON.parse(raw) : null;
      } catch (e) { return null; }
    },
    clearMember: function () {
      try { sessionStorage.removeItem(this._keyUser); } catch (e) {}
    },

    setOfficial: function (official) {
      try {
        sessionStorage.setItem(this._keyOfficial, JSON.stringify(official));
      } catch (e) { Logger.error('Session set error', e); }
    },
    getOfficial: function () {
      try {
        var raw = sessionStorage.getItem(this._keyOfficial);
        return raw ? JSON.parse(raw) : null;
      } catch (e) { return null; }
    },
    clearOfficial: function () {
      try { sessionStorage.removeItem(this._keyOfficial); } catch (e) {}
    }
  };

  /* ══════════════════════════════════════════════════════════════════════
     Navigation — هایلایت نوار پایین
     ══════════════════════════════════════════════════════════════════════ */

  function Navigation() {
    var path = location.pathname.split('/').pop() || 'index.html';
    var items = DOM.qsa('.bottom-nav .nav-item');
    for (var i = 0; i < items.length; i++) {
      var item = items[i];
      var href = item.getAttribute('href') || '';
      var isActive = href === path;
      item.classList.toggle('active', isActive);
      if (isActive) item.setAttribute('aria-current', 'page');
      else item.removeAttribute('aria-current');
    }
  }

  /* ══════════════════════════════════════════════════════════════════════
     Carousel — اسلایدر
     ══════════════════════════════════════════════════════════════════════ */

  function Carousel(el) {
    if (!el) return;

    var slides = DOM.qsa('.carousel-slide', el);
    var dots   = DOM.qsa('.dot', el);
    if (slides.length < 2) return;

    var reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    var current = 0;
    var timerId = null;

    function setSlide(idx) {
      if (idx < 0 || idx >= slides.length) return;
      for (var i = 0; i < slides.length; i++) {
        var on = (i === idx);
        slides[i].classList.toggle('active', on);
        slides[i].setAttribute('aria-hidden', String(!on));
      }
      for (var j = 0; j < dots.length; j++) {
        var on2 = (j === idx);
        dots[j].classList.toggle('active', on2);
        dots[j].setAttribute('aria-selected', String(on2));
      }
      current = idx;
    }

    function next() { setSlide((current + 1) % slides.length); }
    function start() {
      if (reduced) return;
      stop();
      timerId = setInterval(next, CONFIG.CAROUSEL_INTERVAL);
    }
    function stop() {
      if (timerId) { clearInterval(timerId); timerId = null; }
    }

    for (var k = 0; k < dots.length; k++) {
      (function (dot) {
        DOM.on(dot, 'click', function () {
          var idx = parseInt(dot.getAttribute('data-index'), 10);
          if (!isNaN(idx)) { setSlide(idx); start(); }
        });
      })(dots[k]);
    }

    DOM.on(el, 'mouseenter', stop);
    DOM.on(el, 'mouseleave', start);
    DOM.on(document, 'visibilitychange', function () {
      if (document.hidden) stop(); else start();
    });

    var tx = 0;
    DOM.on(el, 'touchstart', function (e) {
      tx = e.changedTouches[0].clientX; stop();
    }, { passive: true });
    DOM.on(el, 'touchend', function (e) {
      var dx = e.changedTouches[0].clientX - tx;
      if (Math.abs(dx) > 40) {
        var dir = dx < 0 ? 1 : -1;
        setSlide((current + dir + slides.length) % slides.length);
      }
      start();
    }, { passive: true });

    setSlide(0);
    start();
  }

  /* ══════════════════════════════════════════════════════════════════════
     Officials — مسئولین (از API)
     ══════════════════════════════════════════════════════════════════════ */

  function OfficialsPage() {
    var gridOfficial = DOM.qs('#officialsGridOfficial');
    var gridSpecial  = DOM.qs('#officialsGridSpecial');
    if (!gridOfficial && !gridSpecial) return;

    var chips = DOM.qsa('.chip[data-filter]');
    var sectionOfficial = DOM.qs('.officials-section[data-section="official"]');
    var sectionSpecial  = DOM.qs('.officials-section[data-section="special"]');
    var emptyEl = DOM.qs('#officialsEmpty');
    var currentFilter = 'all';

    function avatarLetter(name) {
      if (!name) return '؟';
      return String(name).trim().charAt(0);
    }

    function renderCard(o) {
      var phone = String(o.phone || '').trim();
      var phoneButton = '';
      if (phone) {
        phoneButton = ''
          + '<a class="contact-btn" href="tel:' + DOM.escape(phone) + '">'
          +   '<svg viewBox="0 0 24 24" aria-hidden="true">'
          +     '<path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/>'
          +   '</svg>'
          +   '<span>تماس</span>'
          + '</a>';
      }

      return ''
        + '<div class="official-card">'
        +   '<div class="avatar">' + DOM.escape(avatarLetter(o.name)) + '</div>'
        +   '<h4>' + DOM.escape(o.name) + '</h4>'
        +   '<span class="role">' + DOM.escape(o.role) + '</span>'
        +   phoneButton
        + '</div>';
    }

    function render(officials) {
      var officialList = [];
      var specialList = [];

      for (var i = 0; i < officials.length; i++) {
        var o = officials[i];
        var t = String(o.type || 'official').trim();
        if (t === 'official') officialList.push(o);
        else specialList.push(o);
      }

      if (gridOfficial) {
        gridOfficial.innerHTML = officialList.map(renderCard).join('');
      }
      if (gridSpecial) {
        gridSpecial.innerHTML = specialList.map(renderCard).join('');
      }

      var cOff = DOM.qs('#countOfficial');
      var cSpec = DOM.qs('#countSpecial');
      var sTot = DOM.qs('#statTotal');
      var sOff = DOM.qs('#statOfficial');
      var sSpec = DOM.qs('#statSpecial');

      if (cOff) cOff.textContent = DOM.toPersianNum(officialList.length) + ' نفر';
      if (cSpec) cSpec.textContent = DOM.toPersianNum(specialList.length) + ' نفر';
      if (sTot) sTot.textContent = DOM.toPersianNum(officials.length);
      if (sOff) sOff.textContent = DOM.toPersianNum(officialList.length);
      if (sSpec) sSpec.textContent = DOM.toPersianNum(specialList.length);

      applyFilter(currentFilter);
    }

    function applyFilter(filter) {
      currentFilter = filter;
      if (filter === 'official') {
        if (sectionOfficial) sectionOfficial.classList.remove('hidden');
        if (sectionSpecial)  sectionSpecial.classList.add('hidden');
      } else if (filter === 'special') {
        if (sectionOfficial) sectionOfficial.classList.add('hidden');
        if (sectionSpecial)  sectionSpecial.classList.remove('hidden');
      } else {
        if (sectionOfficial) sectionOfficial.classList.remove('hidden');
        if (sectionSpecial)  sectionSpecial.classList.remove('hidden');
      }
    }

    for (var i = 0; i < chips.length; i++) {
      (function (chip) {
        DOM.on(chip, 'click', function () {
          for (var j = 0; j < chips.length; j++) chips[j].classList.remove('active');
          chip.classList.add('active');
          applyFilter(chip.getAttribute('data-filter') || 'all');
        });
      })(chips[i]);
    }

    // بارگذاری از API
    Logger.info('بارگذاری مسئولین...');
    Api.get({ action: 'listOfficials' })
      .then(function (res) {
        Logger.info('مسئولین:', res.items ? res.items.length : 0);
        render(res.items || []);
      })
      .catch(function (err) {
        Logger.error('خطا در مسئولین:', err);
        if (emptyEl) {
          emptyEl.classList.remove('hidden');
          emptyEl.querySelector('p').textContent = 'خطا در بارگذاری مسئولین';
        }
      });
  }

  /* ══════════════════════════════════════════════════════════════════════
     Official Login — ورود مسئولین با کد
     ══════════════════════════════════════════════════════════════════════ */

  function OfficialLogin() {
    var modal = DOM.qs('#officialLoginModal');
    var openBtn = DOM.qs('#openOfficialLogin');
    var form = DOM.qs('#officialLoginForm');
    var input = DOM.qs('#officialCodeInput');

    if (!modal || !form || !input) return;

    if (openBtn) {
      DOM.on(openBtn, 'click', function () {
        Modal.open(modal);
      });
    }

    DOM.on(modal, 'click', function (e) {
      if (e.target === modal || e.target.hasAttribute('data-close-modal')) {
        Modal.close(modal);
      }
    });

    DOM.on(document, 'keydown', function (e) {
      if (e.key === 'Escape' && modal.classList.contains('active')) {
        Modal.close(modal);
      }
    });

    DOM.on(form, 'submit', async function (e) {
      e.preventDefault();
      var code = input.value.trim().toUpperCase();

      if (!code) {
        Toast.error('کد مسئولیت رو وارد کن');
        return;
      }

      var btn = form.querySelector('button[type="submit"]');
      btn.disabled = true;
      btn.textContent = 'در حال بررسی...';

      try {
        var res = await Api.get({ action: 'verifyOfficialCode', code: code });
        if (!res.official) throw new Error('کد نامعتبر است');

        var official = res.official;
        Session.setOfficial(official);

        Toast.success('خوش آمدی، ' + (official.name || 'مسئول'));
        Logger.info('ورود مسئول:', official);

        // هدایت به پنل مربوطه
        setTimeout(function () {
          var role = String(official.role || '');
          if (role.indexOf('حضور') >= 0) {
            location.href = 'attendance.html';
          } else if (role.indexOf('نظارت') >= 0) {
            location.href = 'supervision.html';
          } else {
            location.href = 'index.html';
            Toast.show('پنل این مسئولیت هنوز آماده نیست', 'error');
          }
        }, 800);

      } catch (err) {
        Logger.error('ورود مسئول:', err);
        Toast.error(err.message || 'کد نامعتبر است');
      } finally {
        btn.disabled = false;
        btn.textContent = 'ورود';
      }
    });
  }

  /* ══════════════════════════════════════════════════════════════════════
     Activities — فعالیت‌ها (از API)
     ══════════════════════════════════════════════════════════════════════ */

  function ActivitiesPage() {
    var list = DOM.qs('#activityList');
    if (!list) return;

    var chips = DOM.qsa('.chip[data-filter]');
    var allEvents = [];
    var currentFilter = 'all';

    function renderCard(ev) {
      return ''
        + '<article class="activity-card">'
        +   '<div class="thumb">'
        +     '<img src="' + DOM.escape(ev.image || 'images/placeholder.svg') + '"'
        +          ' alt="' + DOM.escape(ev.title) + '" loading="lazy">'
        +     '<span class="badge">' + DOM.escape(ev.category || 'عمومی') + '</span>'
        +   '</div>'
        +   '<div class="body">'
        +     '<h3>' + DOM.escape(ev.title) + '</h3>'
        +     '<div class="meta"><span>' + DOM.escape(ev.date || '') + '</span></div>'
        +   '</div>'
        + '</article>';
    }

    function render() {
      var filtered = (currentFilter === 'all')
        ? allEvents
        : allEvents.filter(function (ev) {
            return String(ev.category) === currentFilter;
          });

      if (!filtered.length) {
        list.innerHTML = '<div class="empty"><p>فعالیتی در این دسته یافت نشد</p></div>';
        return;
      }

      list.innerHTML = filtered.map(renderCard).join('');
    }

    for (var i = 0; i < chips.length; i++) {
      (function (chip) {
        DOM.on(chip, 'click', function () {
          for (var j = 0; j < chips.length; j++) chips[j].classList.remove('active');
          chip.classList.add('active');
          currentFilter = chip.getAttribute('data-filter') || 'all';
          render();
        });
      })(chips[i]);
    }

    Logger.info('بارگذاری فعالیت‌ها...');
    Api.get({ action: 'listActivities' })
      .then(function (res) {
        allEvents = res.items || [];
        Logger.info('فعالیت‌ها:', allEvents.length);
        render();
      })
      .catch(function (err) {
        Logger.error('خطا در فعالیت‌ها:', err);
        list.innerHTML = '<div class="empty"><p>خطا در بارگذاری</p></div>';
      });
  }

  /* ══════════════════════════════════════════════════════════════════════
     Schedule — برنامه هفتگی
     ══════════════════════════════════════════════════════════════════════ */

  var WEEKLY_SCHEDULE = [
    { day: 'شنبه', slots: [
      { time: '18:00', title: 'کلاس قرآن', note: 'حاج آقا موسوی' },
      { time: '19:30', title: 'هیئت هفتگی', note: 'سالن اصلی' }
    ]},
    { day: 'یک‌شنبه', slots: [{ time: '17:30', title: 'تمرین فوتبال', note: 'سالن ورزشی' }] },
    { day: 'دوشنبه', slots: [{ time: '18:00', title: 'دوره تربیتی', note: 'کتاب مرام' }] },
    { day: 'سه‌شنبه', slots: [{ time: '19:00', title: 'جلسه مسئولین', note: 'اتاق مدیریت' }] },
    { day: 'چهارشنبه', slots: [{ time: '18:30', title: 'کلاس احکام', note: '' }] },
    { day: 'پنج‌شنبه', slots: [
      { time: '20:00', title: 'مسابقات PS5', note: 'با جایزه' },
      { time: '21:30', title: 'دعای کمیل', note: '' }
    ]},
    { day: 'جمعه', slots: [{ time: '06:00', title: 'دعای ندبه', note: 'سالن اصلی' }] }
  ];

  function SchedulePage() {
    var wrap = DOM.qs('#weeklySchedule');
    if (!wrap) return;

    var dayNames = ['یک‌شنبه','دوشنبه','سه‌شنبه','چهارشنبه','پنج‌شنبه','جمعه','شنبه'];
    var today = dayNames[new Date().getDay()];

    var html = '';
    for (var i = 0; i < WEEKLY_SCHEDULE.length; i++) {
      var day = WEEKLY_SCHEDULE[i];
      var isToday = day.day === today;

      var slotsHtml = '';
      for (var j = 0; j < day.slots.length; j++) {
        var s = day.slots[j];
        slotsHtml += ''
          + '<div class="slot">'
          +   '<span class="time">' + DOM.escape(s.time) + '</span>'
          +   '<div class="desc">'
          +     '<strong>' + DOM.escape(s.title) + '</strong>'
          +     (s.note ? '<small>' + DOM.escape(s.note) + '</small>' : '')
          +   '</div>'
          + '</div>';
      }

      html += ''
        + '<div class="day-block' + (isToday ? ' today' : '') + '">'
        +   '<div class="day-title">'
        +     (isToday ? '<span class="today-tag">امروز</span>' : '')
        +     DOM.escape(day.day)
        +   '</div>'
        +   slotsHtml
        + '</div>';
    }
    wrap.innerHTML = html;
  }

  /* ══════════════════════════════════════════════════════════════════════
     Register Form — فرم ثبت‌نام اردو
     ══════════════════════════════════════════════════════════════════════ */

  function RegisterForm(form) {
    if (!form) return;

    var zone = DOM.qs('#uploadZone');
    var fileInput = DOM.qs('#fileInput');
    var preview = DOM.qs('#uploadPreview');
    var campSelect = DOM.qs('#campSelect');
    var selectedFile = null;

    function handleFile(file) {
      if (!Validate.isImage(file)) { Toast.error('فقط فایل تصویری مجاز است'); return; }
      if (!Validate.fileSize(file, CONFIG.MAX_FILE_SIZE)) { Toast.error('حجم فایل بیشتر از ۵ مگابایت'); return; }
      selectedFile = file;
      var reader = new FileReader();
      reader.onload = function (e) {
        if (preview) {
          preview.innerHTML = '<img src="' + e.target.result + '" alt="پیش‌نمایش">';
          preview.classList.add('active');
        }
      };
      reader.readAsDataURL(file);
    }

    if (zone && fileInput) {
      DOM.on(zone, 'click', function () { fileInput.click(); });
      DOM.on(zone, 'dragover', function (e) { e.preventDefault(); zone.classList.add('dragover'); });
      DOM.on(zone, 'dragleave', function (e) { e.preventDefault(); zone.classList.remove('dragover'); });
      DOM.on(zone, 'drop', function (e) {
        e.preventDefault();
        zone.classList.remove('dragover');
        if (e.dataTransfer.files[0]) handleFile(e.dataTransfer.files[0]);
      });
      DOM.on(fileInput, 'change', function () {
        if (fileInput.files[0]) handleFile(fileInput.files[0]);
      });
    }

    // بارگذاری اردوهای فعال
    if (campSelect) {
      Api.get({ action: 'listCamps', status: 'active' })
        .then(function (res) {
          var camps = res.items || [];
          var html = '<option value="">انتخاب کن...</option>';
          for (var i = 0; i < camps.length; i++) {
            html += '<option value="' + DOM.escape(camps[i].id) + '">' + DOM.escape(camps[i].title) + '</option>';
          }
          campSelect.innerHTML = html;
          if (!camps.length) {
            campSelect.innerHTML = '<option value="">هیچ اردوی فعالی نیست</option>';
          }
        })
        .catch(function (err) {
          Logger.error('خطا در اردوها:', err);
          campSelect.innerHTML = '<option value="">خطا در بارگذاری</option>';
        });
    }

    DOM.on(form, 'submit', async function (e) {
      e.preventDefault();

      var data = {
        campId:       campSelect ? campSelect.value : '',
        firstName:    (DOM.qs('#firstName')    || {}).value || '',
        lastName:     (DOM.qs('#lastName')     || {}).value || '',
        nationalCode: (DOM.qs('#nationalCode') || {}).value || '',
        phone:        (DOM.qs('#phone')        || {}).value || '',
        fatherName:   (DOM.qs('#fatherName')   || {}).value || '',
        fatherPhone:  (DOM.qs('#fatherPhone')  || {}).value || ''
      };

      var keys = Object.keys(data);
      for (var i = 0; i < keys.length; i++) data[keys[i]] = String(data[keys[i]]).trim();

      if (!data.campId)         { Toast.error('اردو رو انتخاب کن'); return; }
      if (!data.firstName)      { Toast.error('نام رو وارد کن'); return; }
      if (!data.lastName)       { Toast.error('نام خانوادگی رو وارد کن'); return; }
      if (!data.fatherName)     { Toast.error('نام پدر رو وارد کن'); return; }
      if (!Validate.iranMobile(data.phone))       { Toast.error('شماره همراه خودت نامعتبر'); return; }
      if (!Validate.iranMobile(data.fatherPhone)) { Toast.error('شماره پدر نامعتبر'); return; }

      var btn = form.querySelector('button[type="submit"]');
      btn.disabled = true;
      btn.textContent = 'در حال ارسال...';

      try {
        var photoBase64 = '';
        if (selectedFile) photoBase64 = await RegisterForm._fileToBase64(selectedFile);

        await Api.post({
          action: 'registerCamp',
          campId: data.campId,
          firstName: data.firstName,
          lastName: data.lastName,
          nationalCode: data.nationalCode,
          phone: data.phone,
          fatherName: data.fatherName,
          fatherPhone: data.fatherPhone,
          photoBase64: photoBase64,
          extraData: {}
        });

        form.reset();
        if (preview) { preview.innerHTML = ''; preview.classList.remove('active'); }
        selectedFile = null;
        Toast.success('ثبت‌نام ارسال شد و در انتظار تایید ✓');

      } catch (err) {
        Logger.error('ثبت‌نام:', err);
        Toast.error(err.message || 'خطا در ارسال');
      } finally {
        btn.disabled = false;
        btn.textContent = 'ثبت‌نام';
      }
    });
  }

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
     Feedback Form — پیشنهاد و انتقاد
     ══════════════════════════════════════════════════════════════════════ */

  function FeedbackForm(form) {
    if (!form) return;

    DOM.on(form, 'submit', async function (e) {
      e.preventDefault();

      var data = {
        name:     (DOM.qs('#fbName')     || {}).value || '',
        phone:    (DOM.qs('#fbPhone')    || {}).value || '',
        category: (DOM.qs('#fbCategory') || {}).value || 'پیشنهاد',
        message:  (DOM.qs('#fbMessage')  || {}).value || ''
      };

      var keys = Object.keys(data);
      for (var i = 0; i < keys.length; i++) data[keys[i]] = String(data[keys[i]]).trim();

      if (!data.message) { Toast.error('متن پیام خالی است'); return; }
      if (data.phone && !Validate.iranMobile(data.phone)) {
        Toast.error('شماره تماس نامعتبر');
        return;
      }

      var btn = form.querySelector('button[type="submit"]');
      btn.disabled = true;
      btn.textContent = 'در حال ارسال...';

      try {
        await Api.post({ action: 'feedback', name: data.name, phone: data.phone, category: data.category, message: data.message });
        form.reset();
        Toast.success('پیام ثبت شد. ممنون 🌿');
      } catch (err) {
        Logger.error('Feedback:', err);
        Toast.error(err.message || 'خطا در ارسال');
      } finally {
        btn.disabled = false;
        btn.textContent = 'ارسال پیام';
      }
    });
  }

  /* ══════════════════════════════════════════════════════════════════════
     Header Auth — دکمه ورود/پروفایل در هدر
     ══════════════════════════════════════════════════════════════════════ */

  function HeaderAuth() {
    var header = DOM.qs('.app-header');
    if (!header) return;

    // اگه دکمه ورود قبلاً هست، کاری نکن
    if (DOM.qs('.header-auth', header)) return;

    var member = Session.getMember();
    var official = Session.getOfficial();
    var user = member || official;

    var btn = document.createElement('a');
    btn.className = 'header-auth';

    if (user) {
      var firstName = user.firstName || user.name || 'کاربر';
      var initial = String(firstName).charAt(0);
      btn.href = member ? 'profile.html' : '#';
      btn.setAttribute('aria-label', 'پروفایل من');
      btn.innerHTML = '<span class="header-auth__avatar">' + DOM.escape(initial) + '</span>';
    } else {
      btn.href = 'login.html';
      btn.setAttribute('aria-label', 'ورود / ثبت‌نام');
      btn.innerHTML = '<span class="header-auth__text">ورود / ثبت‌نام</span>';
    }

    header.appendChild(btn);
  }

  /* ══════════════════════════════════════════════════════════════════════
     App — راه‌انداز
     ══════════════════════════════════════════════════════════════════════ */

  var App = {
    version: CONFIG.VERSION,
    init: function () {
      Logger.info('نسخه ' + this.version + ' در حال راه‌اندازی...');
      Logger.info('API_URL:', CONFIG.API_URL);

      App._safe('Navigation',   function () { Navigation(); });
      App._safe('HeaderAuth',   function () { HeaderAuth(); });
      App._safe('Carousel',     function () { Carousel(DOM.qs('#carouselContainer')); });
      App._safe('Officials',    function () { OfficialsPage(); });
      App._safe('OfficialLogin',function () { OfficialLogin(); });
      App._safe('Activities',   function () { ActivitiesPage(); });
      App._safe('Schedule',     function () { SchedulePage(); });
      App._safe('RegisterForm', function () { RegisterForm(DOM.qs('#registerForm')); });
      App._safe('FeedbackForm', function () { FeedbackForm(DOM.qs('#feedbackForm')); });

      Logger.info('راه‌اندازی کامل ✓');
    },
    _safe: function (name, fn) {
      try { fn(); } catch (err) { Logger.error('[' + name + ']', err); }
    }
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () { App.init(); });
  } else {
    App.init();
  }

  // در معرض عموم
  window.KanoonApp = {
    version: CONFIG.VERSION,
    config: CONFIG,
    api: Api,
    toast: Toast,
    modal: Modal,
    session: Session,
    validate: Validate
  };

})(window, document);
