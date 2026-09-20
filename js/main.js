/=======================================================
   حلقه شهید هادی ذوالفقاری
   فایل اصلی جاوااسکریپت — main.js
   نسخه: 2.0
   ========================================================== */
(function () {
  'use strict';
* ===
  /* ==========================================================
     1) تنظیمات
     ========================================================== */
  var CONFIG = {
    API_URL: 'https://script.google.com/macros/s/AKfycbykIp_S-p5grZvgwLGCwaaajnG7lEbRfiTTu6epq5ATQXPLPtYTZDfUKECameopRDOf/exec',
    CAROUSEL_INTERVAL: 4500,
    TOAST_DURATION: 3200,
    MAX_FILE_SIZE: 5 * 1024 * 1024, // 5MB
    DEBUG: true // اگه true باشه، لاگ‌های دقیق توی Console نمایش داده می‌شه
  };

  /* ==========================================================
     2) داده‌های نمونه
     (بعداً از Google Sheets خوانده می‌شن)
     ========================================================== */
  var SAMPLE_EVENTS = [
    { id: 1, title: 'مسابقه فوتبال دستی',        date: '۱۴۰۳/۱۲/۱۵', category: 'ورزشی',
      image: 'https://images.unsplash.com/photo-1551958219-acbc608c6377?w=600&auto=format&fit=crop' },
    { id: 2, title: 'اردوی زیارتی مشهد مقدس',     date: '۱۴۰۳/۱۲/۲۰', category: 'اردو',
      image: 'https://images.unsplash.com/photo-1542810634-71277d95dcbb?w=600&auto=format&fit=crop' },
    { id: 3, title: 'کلاس حفظ قرآن کریم',         date: 'هر پنج‌شنبه',   category: 'تربیتی',
      image: 'https://images.unsplash.com/photo-1609599006353-e629aaabfeae?w=600&auto=format&fit=crop' },
    { id: 4, title: 'شب شعر و ادبیات',            date: '۱۴۰۳/۱۲/۲۵', category: 'فرهنگی',
      image: 'https://images.unsplash.com/photo-1524995997946-a1c2e315a42f?w=600&auto=format&fit=crop' },
    { id: 5, title: 'مسابقات FIFA و PS5',         date: 'پنج‌شنبه‌ها',   category: 'ورزشی',
      image: 'https://images.unsplash.com/photo-1511512578047-dfb367046420?w=600&auto=format&fit=crop' }
  ];

  var OFFICIALS = [
    { name: 'مهدی رضایی',    role: 'مسئول PS5' },
    { name: 'حسین احمدی',    role: 'مسئول سیستم صوتی' },
    { name: 'علی محمدی',      role: 'مسئول خرید' },
    { name: 'رضا کریمی',      role: 'مسئول مسجد' },
    { name: 'امیر حسینی',     role: 'مسئول کانون' },
    { name: 'سعید نوری',      role: 'مسئول هیئت' },
    { name: 'محمد صادقی',     role: 'مسئول مکبری' },
    { name: 'یاسر تقوی',      role: 'مسئول آشپزخانه' },
    { name: 'ابوالفضل رحیمی', role: 'مسئول تدارکات' },
    { name: 'میلاد عباسی',    role: 'مسئول هماهنگی' },
    { name: 'کاظم شریفی',     role: 'مسئول رسانه' },
    { name: 'پویا مرادی',     role: 'مسئول اتاق رسانه' },
    { name: 'حامد سلیمی',     role: 'مسئول ورزش' },
    { name: 'دانیال اکبری',   role: 'مسئول VR' },
    { name: 'سینا جوادی',     role: 'مسئول عکاسی' },
    { name: 'رضا مهدوی',      role: 'مسئول حضور و غیاب' }
  ];

  var WEEKLY_SCHEDULE = [
    { day: 'شنبه',    slots: [
      { time: '18:00', title: 'کلاس قرآن',   note: 'حاج آقا موسوی' },
      { time: '19:30', title: 'هیئت هفتگی',  note: 'سالن اصلی' } ]},
    { day: 'یک‌شنبه', slots: [ { time: '17:30', title: 'تمرین فوتبال',   note: 'سالن ورزشی' } ]},
    { day: 'دوشنبه',  slots: [ { time: '18:00', title: 'دوره تربیتی',    note: 'کتاب «مرام»' } ]},
    { day: 'سه‌شنبه', slots: [ { time: '19:00', title: 'جلسه مسئولین',   note: 'اتاق مدیریت' } ]},
    { day: 'چهارشنبه', slots: [ { time: '18:30', title: 'کلاس احکام',    note: 'حجت‌الاسلام کریمی' } ]},
    { day: 'پنج‌شنبه', slots: [
      { time: '20:00', title: 'مسابقات PS5',   note: 'همراه با جایزه' },
      { time: '21:30', title: 'دعای کمیل',     note: '' } ]},
    { day: 'جمعه',    slots: [ { time: '06:00', title: 'دعای ندبه', note: 'سالن اصلی' } ]}
  ];

  var MENTOR_NUMBERS = ['09120000000', '09131111111'];

  /* ==========================================================
     3) ابزارهای کمکی
     ========================================================== */

  // انتخاب یک عنصر
  function $(selector, root) {
    return (root || document).querySelector(selector);
  }

  // انتخاب چند عنصر
  function $$(selector, root) {
    return Array.prototype.slice.call(
      (root || document).querySelectorAll(selector)
    );
  }

  // لاگ فقط در حالت دیباگ
  function log() {
    if (!CONFIG.DEBUG) return;
    var args = Array.prototype.slice.call(arguments);
    args.unshift('[حلقه]');
    console.log.apply(console, args);
  }

  // لاگ خطا (همیشه)
  function logError() {
    var args = Array.prototype.slice.call(arguments);
    args.unshift('[حلقه-خطا]');
    console.error.apply(console, args);
  }

  // escape کردن HTML برای جلوگیری از XSS
  function escapeHtml(str) {
    if (str === null || str === undefined) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  // اعتبارسنجی شماره موبایل ایران
  function isValidIranMobile(phone) {
    return /^09[0-9]{9}$/.test(String(phone || '').trim());
  }

  // تبدیل فایل به base64 خالص (بدون پیشوند)
  function fileToBase64Raw(file) {
    return new Promise(function (resolve, reject) {
      var reader = new FileReader();
      reader.onload = function () {
        var result = String(reader.result || '');
        var commaIndex = result.indexOf(',');
        resolve(commaIndex >= 0 ? result.slice(commaIndex + 1) : result);
      };
      reader.onerror = function (e) { reject(e); };
      reader.readAsDataURL(file);
    });
  }

  /* ==========================================================
     4) سیستم Toast
     ========================================================== */
  var toastTimer = null;

  function showToast(message, type) {
    var el = $('#appToast');
    if (!el) {
      el = document.createElement('div');
      el.id = 'appToast';
      el.className = 'toast';
      el.setAttribute('role', 'status');
      el.setAttribute('aria-live', 'polite');
      document.body.appendChild(el);
    }

    el.textContent = message;
    el.classList.toggle('error', type === 'error');
    el.classList.add('show');

    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(function () {
      el.classList.remove('show');
    }, CONFIG.TOAST_DURATION);
  }

  /* ==========================================================
     5) هایلایت نوار ناوبری پایین
     ========================================================== */
  function highlightNav() {
    var currentPath = location.pathname.split('/').pop() || 'index.html';
    var items = $$('.bottom-nav .nav-item');

    items.forEach(function (item) {
      var href = item.getAttribute('href') || '';
      var isActive = (href === currentPath);

      item.classList.toggle('active', isActive);

      if (isActive) {
        item.setAttribute('aria-current', 'page');
      } else {
        item.removeAttribute('aria-current');
      }
    });
  }

  /* ==========================================================
     6) کاروسل صفحه‌ی خانه
     ========================================================== */
  function initCarousel() {
    var container = $('#carouselContainer');
    if (!container) return;

    var slides = $$('.carousel-slide', container);
    var dots   = $$('.dot', container);
    if (slides.length < 2) return;

    var prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    var currentIndex = 0;
    var timerId = null;

    function setSlide(index) {
      if (index < 0 || index >= slides.length) return;

      slides.forEach(function (slide, i) {
        var isActive = (i === index);
        slide.classList.toggle('active', isActive);
        slide.setAttribute('aria-hidden', String(!isActive));
      });

      dots.forEach(function (dot, i) {
        var isActive = (i === index);
        dot.classList.toggle('active', isActive);
        dot.setAttribute('aria-selected', String(isActive));
      });

      currentIndex = index;
    }

    function goNext() {
      setSlide((currentIndex + 1) % slides.length);
    }

    function startAuto() {
      if (prefersReduced) return;
      stopAuto();
      timerId = setInterval(goNext, CONFIG.CAROUSEL_INTERVAL);
    }

    function stopAuto() {
      if (timerId) {
        clearInterval(timerId);
        timerId = null;
      }
    }

    dots.forEach(function (dot) {
      dot.addEventListener('click', function () {
        var idx = parseInt(dot.getAttribute('data-index'), 10);
        if (!isNaN(idx)) {
          setSlide(idx);
          startAuto();
        }
      });
    });

    container.addEventListener('mouseenter', stopAuto);
    container.addEventListener('mouseleave', startAuto);

    // توقف وقتی تب مخفی می‌شه
    document.addEventListener('visibilitychange', function () {
      if (document.hidden) stopAuto();
      else startAuto();
    });

    // پشتیبانی از swipe
    var touchStartX = 0;
    container.addEventListener('touchstart', function (e) {
      touchStartX = e.changedTouches[0].clientX;
      stopAuto();
    }, { passive: true });

    container.addEventListener('touchend', function (e) {
      var dx = e.changedTouches[0].clientX - touchStartX;
      if (Math.abs(dx) > 40) {
        var direction = (dx < 0) ? 1 : -1;
        setSlide((currentIndex + direction + slides.length) % slides.length);
      }
      startAuto();
    }, { passive: true });

    setSlide(0);
    startAuto();
  }

  /* ==========================================================
     7) مدال ورود مربیان
     ========================================================== */
  var modalState = { lastFocused: null };

  function injectMentorModal() {
    if ($('#loginModal')) return;

    var modal = document.createElement('div');
    modal.className = 'modal';
    modal.id = 'loginModal';
    modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-modal', 'true');
    modal.setAttribute('aria-labelledby', 'loginTitle');

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

    modal.innerHTML = html;
    document.body.appendChild(modal);
  }

  function openLoginModal() {
    var modal = $('#loginModal');
    if (!modal) return;

    modalState.lastFocused = document.activeElement;
    modal.classList.add('active');
    document.body.style.overflow = 'hidden';

    setTimeout(function () {
      var input = $('#phoneInput');
      if (input) input.focus();
    }, 100);
  }

  function closeLoginModal() {
    var modal = $('#loginModal');
    if (!modal) return;

    modal.classList.remove('active');
    document.body.style.overflow = '';

    if (modalState.lastFocused && typeof modalState.lastFocused.focus === 'function') {
      modalState.lastFocused.focus();
    }
  }

  function initMentorLogin() {
    injectMentorModal();

    var modal = $('#loginModal');
    var form  = $('#mentorLoginForm');
    var phoneInput = $('#phoneInput');
    if (!modal || !form || !phoneInput) return;

    // باز کردن مدال
    document.addEventListener('click', function (e) {
      var trigger = e.target.closest('[data-open-login], .nav-item[href="#"]');
      if (trigger) {
        e.preventDefault();
        openLoginModal();
        return;
      }
      if (e.target === modal || e.target.hasAttribute('data-close')) {
        closeLoginModal();
      }
    });

    // بستن با Escape
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && modal.classList.contains('active')) {
        closeLoginModal();
      }
    });

    // ارسال فرم
    form.addEventListener('submit', async function (e) {
      e.preventDefault();

      var phone = phoneInput.value.trim();
      if (!isValidIranMobile(phone)) {
        showToast('شماره باید ۱۱ رقم و با ۰۹ شروع شود', 'error');
        phoneInput.focus();
        return;
      }

      var btn = form.querySelector('button[type="submit"]');
      btn.disabled = true;
      btn.textContent = 'در حال بررسی...';

      try {
        var allowed = await checkMentorLogin(phone);
        if (!allowed) {
          showToast('این شماره در لیست مربیان نیست', 'error');
          return;
        }

        closeLoginModal();
        showToast('خوش آمدید 🌿');
        log('مربی وارد شد:', phone);

        // در نسخه بعد:
        // setTimeout(function(){ location.href = 'mentor-panel.html'; }, 800);

      } catch (err) {
        logError('خطا در ورود:', err);
        showToast('خطا در ارتباط با سرور. دوباره تلاش کنید', 'error');
      } finally {
        btn.disabled = false;
        btn.textContent = 'ورود';
      }
    });
  }

  /* ==========================================================
     8) صفحه‌ی فعالیت‌ها
     ========================================================== */
  function renderActivityCard(event) {
    var html = '';
    html += '<article class="activity-card">';
    html +=   '<div class="thumb">';
    html +=     '<img src="' + escapeHtml(event.image) + '"';
    html +=          ' alt="' + escapeHtml(event.title) + '" loading="lazy">';
    html +=     '<span class="badge">' + escapeHtml(event.category) + '</span>';
    html +=   '</div>';
    html +=   '<div class="body">';
    html +=     '<h3>' + escapeHtml(event.title) + '</h3>';
    html +=     '<div class="meta">';
    html +=       '<span>' + escapeHtml(event.date) + '</span>';
    html +=     '</div>';
    html +=   '</div>';
    html += '</article>';
    return html;
  }

  function initActivities() {
    var list = $('#activityList');
    if (!list) return;

    var chips = $$('.chip[data-filter]');
    var activeFilter = 'all';

    function render() {
      var filtered = (activeFilter === 'all')
        ? SAMPLE_EVENTS
        : SAMPLE_EVENTS.filter(function (ev) { return ev.category === activeFilter; });

      if (filtered.length === 0) {
        list.innerHTML = '<div class="empty"><p>فعالیتی در این دسته یافت نشد</p></div>';
        return;
      }

      var html = filtered.map(renderActivityCard).join('');
      list.innerHTML = html;
    }

    chips.forEach(function (chip) {
      chip.addEventListener('click', function () {
        chips.forEach(function (c) { c.classList.remove('active'); });
        chip.classList.add('active');
        activeFilter = chip.getAttribute('data-filter') || 'all';
        render();
      });
    });

    render();
  }

  /* ==========================================================
     9) صفحه‌ی مسئولین
     ========================================================== */
  function initOfficials() {
    var grid = $('#officialsGrid');
    if (!grid) return;

    var html = OFFICIALS.map(function (person) {
      var initial = person.name ? person.name.charAt(0) : '؟';
      return ''
        + '<div class="official-card">'
        +   '<div class="avatar">' + escapeHtml(initial) + '</div>'
        +   '<h4>' + escapeHtml(person.name) + '</h4>'
        +   '<span class="role">' + escapeHtml(person.role) + '</span>'
        + '</div>';
    }).join('');

    grid.innerHTML = html;
  }

  /* ==========================================================
     10) برنامه‌ی هفتگی
     ========================================================== */
  function initSchedule() {
    var wrap = $('#weeklySchedule');
    if (!wrap) return;

    var dayIndex = new Date().getDay();
    var dayNames = ['یک‌شنبه','دوشنبه','سه‌شنبه','چهارشنبه','پنج‌شنبه','جمعه','شنبه'];
    var today = dayNames[dayIndex];

    var html = WEEKLY_SCHEDULE.map(function (day) {
      var isToday = (day.day === today);

      var slotsHtml;
      if (day.slots.length > 0) {
        slotsHtml = day.slots.map(function (slot) {
          return ''
            + '<div class="slot">'
            +   '<span class="time">' + escapeHtml(slot.time) + '</span>'
            +   '<div class="desc">'
            +     '<strong>' + escapeHtml(slot.title) + '</strong>'
            +     (slot.note ? '<small>' + escapeHtml(slot.note) + '</small>' : '')
            +   '</div>'
            + '</div>';
        }).join('');
      } else {
        slotsHtml = '<div class="slot"><div class="desc"><small>برنامه‌ای ثبت نشده</small></div></div>';
      }

      return ''
        + '<div class="day-block' + (isToday ? ' today' : '') + '">'
        +   '<div class="day-title">'
        +     (isToday ? '<span class="today-tag">امروز</span>' : '')
        +     escapeHtml(day.day)
        +   '</div>'
        +   slotsHtml
        + '</div>';
    }).join('');

    wrap.innerHTML = html;
  }

  /* ==========================================================
     11) فرم ثبت‌نام اردو
     ========================================================== */
  function initRegisterForm() {
    var form = $('#registerForm');
    if (!form) return;

    var zone = $('#uploadZone');
    var fileInput = $('#fileInput');
    var preview = $('#uploadPreview');
    var selectedFile = null;

    // مدیریت آپلود
    function handleFile(file) {
      if (!file) return;

      if (!file.type || file.type.indexOf('image/') !== 0) {
        showToast('فقط فایل تصویری مجاز است', 'error');
        return;
      }
      if (file.size > CONFIG.MAX_FILE_SIZE) {
        showToast('حجم فایل بیشتر از ۵ مگابایت است', 'error');
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

      log('فایل انتخاب شد:', file.name, '(' + file.size + ' بایت)');
    }

    if (zone && fileInput) {
      zone.addEventListener('click', function () { fileInput.click(); });

      zone.addEventListener('dragenter', function (e) {
        e.preventDefault(); zone.classList.add('dragover');
      });
      zone.addEventListener('dragover', function (e) {
        e.preventDefault(); zone.classList.add('dragover');
      });
      zone.addEventListener('dragleave', function (e) {
        e.preventDefault(); zone.classList.remove('dragover');
      });
      zone.addEventListener('drop', function (e) {
        e.preventDefault();
        zone.classList.remove('dragover');
        if (e.dataTransfer.files[0]) handleFile(e.dataTransfer.files[0]);
      });

      fileInput.addEventListener('change', function () {
        if (fileInput.files[0]) handleFile(fileInput.files[0]);
      });
    }

    // ارسال فرم
    form.addEventListener('submit', async function (e) {
      e.preventDefault();

      var data = {
        firstName:   ($('#firstName')   || {}).value || '',
        lastName:    ($('#lastName')    || {}).value || '',
        phone:       ($('#phone')       || {}).value || '',
        fatherName:  ($('#fatherName')  || {}).value || '',
        fatherPhone: ($('#fatherPhone') || {}).value || ''
      };

      // trim
      Object.keys(data).forEach(function (k) { data[k] = data[k].trim(); });

      // اعتبارسنجی
      if (!data.firstName || !data.lastName) {
        showToast('نام و نام خانوادگی را کامل وارد کنید', 'error');
        return;
      }
      if (!data.fatherName) {
        showToast('نام پدر را وارد کنید', 'error');
        return;
      }
      if (!isValidIranMobile(data.phone)) {
        showToast('شماره همراه خود را درست وارد کنید', 'error');
        return;
      }
      if (!isValidIranMobile(data.fatherPhone)) {
        showToast('شماره همراه پدر را درست وارد کنید', 'error');
        return;
      }

      var btn = form.querySelector('button[type="submit"]');
      btn.disabled = true;
      btn.textContent = 'در حال ارسال...';

      try {
        var result = await submitCampRegistration(data, selectedFile);
        log('نتیجه ثبت‌نام:', result);

        form.reset();
        if (preview) {
          preview.innerHTML = '';
          preview.classList.remove('active');
        }
        selectedFile = null;

        showToast('ثبت‌نام ارسال شد و در انتظار تایید مربی است ✓');

      } catch (err) {
        logError('خطا در ثبت‌نام:', err);
        var msg = err && err.message ? err.message : 'خطا در ارسال. دوباره تلاش کنید';
        showToast(msg, 'error');
      } finally {
        btn.disabled = false;
        btn.textContent = 'ثبت‌نام';
      }
    });
  }

  /* ==========================================================
     12) فرم پیشنهاد و انتقاد
     ========================================================== */
  function initFeedbackForm() {
    var form = $('#feedbackForm');
    if (!form) return;

    form.addEventListener('submit', async function (e) {
      e.preventDefault();

      var data = {
        name:     (($('#fbName')     || {}).value || '').trim(),
        phone:    (($('#fbPhone')    || {}).value || '').trim(),
        category: ($('#fbCategory')  || {}).value || 'پیشنهاد',
        message:  (($('#fbMessage')  || {}).value || '').trim()
      };

      if (!data.message) {
        showToast('متن پیام خالی است', 'error');
        return;
      }
      if (data.phone && !isValidIranMobile(data.phone)) {
        showToast('شماره تماس نامعتبر است (اختیاری است)', 'error');
        return;
      }

      var btn = form.querySelector('button[type="submit"]');
      btn.disabled = true;
      btn.textContent = 'در حال ارسال...';

      try {
        await submitFeedback(data);
        form.reset();
        showToast('پیام شما ثبت شد. ممنون از همراهی‌تان 🌿');
      } catch (err) {
        logError('خطا در ارسال پیام:', err);
        var msg = err && err.message ? err.message : 'خطا در ارسال پیام';
        showToast(msg, 'error');
      } finally {
        btn.disabled = false;
        btn.textContent = 'ارسال پیام';
      }
    });
  }

  /* ==========================================================
     13) لایه‌ی ارتباط با Google Apps Script
     ========================================================== */

  // ساخت URL با پارامتر
  function buildUrl(params) {
    var parts = [];
    Object.keys(params).forEach(function (key) {
      parts.push(encodeURIComponent(key) + '=' + encodeURIComponent(params[key]));
    });
    return CONFIG.API_URL + (CONFIG.API_URL.indexOf('?') >= 0 ? '&' : '?') + parts.join('&');
  }

  // درخواست POST با JSON
  async function apiPost(payload) {
    log('ارسال درخواست:', payload.action);
    log('مقصد:', CONFIG.API_URL);

    var res;
    try {
      res = await fetch(CONFIG.API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify(payload)
      });
    } catch (networkErr) {
      logError('خطای شبکه:', networkErr);
      throw new Error('اتصال به سرور برقرار نشد. اینترنت را چک کنید');
    }

    log('پاسخ سرور - status:', res.status);

    var text = await res.text();
    log('پاسخ خام:', text.substring(0, 200));

    var json;
    try {
      json = JSON.parse(text);
    } catch (parseErr) {
      logError('پاسخ JSON نامعتبر:', text);
      throw new Error('پاسخ سرور نامعتبر بود');
    }

    if (!json.ok) {
      throw new Error(json.error || 'خطای ناشناخته از سرور');
    }

    return json;
  }

  // ورود مربی
  async function checkMentorLogin(phone) {
    var url = buildUrl({
      action: 'checkMentor',
      phone: phone
    });

    log('بررسی ورود مربی:', phone);

    var res = await fetch(url);
    var json = await res.json();

    if (json && json.allowed) {
      try {
        sessionStorage.setItem('mentor_phone', phone);
        sessionStorage.setItem('mentor_name', json.name || '');
      } catch (e) { /* ignore */ }
      return true;
    }
    return false;
  }

  // ثبت‌نام اردو
  async function submitCampRegistration(data, file) {
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
        payload.fileData = await fileToBase64Raw(file);
        payload.fileName = file.name;
        payload.fileMime = file.type || 'image/jpeg';
        log('عکس به base64 تبدیل شد - طول:', payload.fileData.length);
      } catch (fileErr) {
        logError('خطا در تبدیل فایل:', fileErr);
        // ادامه می‌ده بدون عکس
      }
    }

    return await apiPost(payload);
  }

  // ارسال پیام/انتقاد
  async function submitFeedback(data) {
    var payload = {
      action:   'feedback',
      name:     data.name,
      phone:    data.phone,
      category: data.category,
      message:  data.message
    };

    return await apiPost(payload);
  }

  /* ==========================================================
     14) راه‌اندازی
     ========================================================== */
  function boot() {
    log('نسخه 2.0 در حال راه‌اندازی...');
    log('API_URL:', CONFIG.API_URL);

    try { highlightNav(); }    catch (e) { logError('highlightNav:', e); }
    try { initCarousel(); }    catch (e) { logError('initCarousel:', e); }
    try { initMentorLogin(); } catch (e) { logError('initMentorLogin:', e); }
    try { initActivities(); }  catch (e) { logError('initActivities:', e); }
    try { initOfficials(); }   catch (e) { logError('initOfficials:', e); }
    try { initSchedule(); }    catch (e) { logError('initSchedule:', e); }
    try { initRegisterForm(); } catch (e) { logError('initRegisterForm:', e); }
    try { initFeedbackForm(); } catch (e) { logError('initFeedbackForm:', e); }

    log('راه‌اندازی کامل شد ✓');
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }

  /* ==========================================================
     15) در معرض عموم (برای دیباگ و استفاده‌ی بعدی)
     ========================================================== */
  window.AppUtils = {
    showToast: showToast,
    CONFIG: CONFIG,
    SAMPLE_EVENTS: SAMPLE_EVENTS,
    OFFICIALS: OFFICIALS,
    WEEKLY_SCHEDULE: WEEKLY_SCHEDULE,
    checkMentorLogin: checkMentorLogin,
    submitCampRegistration: submitCampRegistration,
    submitFeedback: submitFeedback
  };

})();
