/* ============================================================================
   ورود — منطق سه مرحله‌ای
   ============================================================================ */

(function (window, document) {
  'use strict';

  var $  = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) {
    return Array.prototype.slice.call((r || document).querySelectorAll(s));
  };

  function toPersian(num) {
    var en = String(num);
    var fa = ['۰','۱','۲','۳','۴','۵','۶','۷','۸','۹'];
    var out = '';
    for (var i = 0; i < en.length; i++) {
      var c = en.charCodeAt(i);
      if (c >= 48 && c <= 57) out += fa[c - 48];
      else out += en.charAt(i);
    }
    return out;
  }

  function getAPI() {
    return window.KanoonApp && window.KanoonApp.api ? window.KanoonApp.api : null;
  }

  function getToast() {
    return window.KanoonApp && window.KanoonApp.toast ? window.KanoonApp.toast : null;
  }

  function getSession() {
    return window.KanoonApp && window.KanoonApp.session ? window.KanoonApp.session : null;
  }

  function toast(msg, type) {
    var t = getToast();
    if (t) {
      if (type === 'error') t.error(msg);
      else t.success(msg);
    } else {
      alert(msg);
    }
  }

  function isValidIranMobile(phone) {
    var p = String(phone || '').trim();
    if (p.length !== 11) return false;
    if (p.charAt(0) !== '0' || p.charAt(1) !== '9') return false;
    for (var i = 0; i < 11; i++) {
      var c = p.charCodeAt(i);
      if (c < 48 || c > 57) return false;
    }
    return true;
  }

  /* ══════════════════════════════════════════════════════════════════════
     State
     ══════════════════════════════════════════════════════════════════════ */

  var state = {
    phone: '',
    code: '',
    codeId: '',
    expiresAt: null,
    timerId: null,
    isNewUser: false,
    member: null
  };

  /* ══════════════════════════════════════════════════════════════════════
     Step Management
     ══════════════════════════════════════════════════════════════════════ */

  function goToStep(n) {
    var steps = $$('.auth-step');
    for (var i = 0; i < steps.length; i++) {
      steps[i].classList.toggle('active', String(steps[i].getAttribute('data-step')) === String(n));
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  /* ══════════════════════════════════════════════════════════════════════
     Render Code
     ══════════════════════════════════════════════════════════════════════ */

  function renderCode(code) {
    var container = $('#codeDisplay');
    if (!container) return;

    var digits = container.querySelectorAll('.digit');
    var codeStr = String(code || '');

    for (var i = 0; i < digits.length; i++) {
      if (i < codeStr.length) {
        digits[i].textContent = codeStr.charAt(i);
        digits[i].classList.add('filled');
      } else {
        digits[i].textContent = '–';
        digits[i].classList.remove('filled');
      }
    }
  }

  function renderPhone(phone) {
    var el = $('#displayPhone');
    if (el) el.textContent = String(phone || '—');
  }

  /* ══════════════════════════════════════════════════════════════════════
     Timer
     ══════════════════════════════════════════════════════════════════════ */

  function startTimer(seconds) {
    stopTimer();

    state.expiresAt = Date.now() + seconds * 1000;
    updateTimerDisplay();

    state.timerId = setInterval(function () {
      var remaining = Math.max(0, Math.floor((state.expiresAt - Date.now()) / 1000));
      updateTimerDisplay(remaining);

      if (remaining <= 0) {
        stopTimer();
        onCodeExpired();
      }
    }, 1000);
  }

  function stopTimer() {
    if (state.timerId) {
      clearInterval(state.timerId);
      state.timerId = null;
    }
  }

  function updateTimerDisplay(remaining) {
    if (remaining === undefined) {
      remaining = Math.max(0, Math.floor((state.expiresAt - Date.now()) / 1000));
    }

    var min = Math.floor(remaining / 60);
    var sec = remaining % 60;
    var text = toPersian(min) + ':' + toPersian(sec < 10 ? '0' + sec : sec);

    var timerEl = $('#codeTimer');
    var textEl = $('#timerText');

    if (textEl) textEl.textContent = text;

    if (timerEl) {
      timerEl.classList.toggle('warning', remaining <= 60 && remaining > 0);
      timerEl.classList.toggle('expired', remaining <= 0);
    }
  }

  function onCodeExpired() {
    var verifyBtn = $('#verifyBtn');
    if (verifyBtn) {
      verifyBtn.disabled = true;
      verifyBtn.textContent = 'کد منقضی شده — کد جدید بگیر';
    }
    toast('کد منقضی شد، یه کد جدید بگیر', 'error');
  }

  /* ══════════════════════════════════════════════════════════════════════
     Phase 1: درخواست کد
     ══════════════════════════════════════════════════════════════════════ */

  function setupPhoneForm() {
    var form = $('#phoneForm');
    var input = $('#phoneInput');
    var btn = $('#phoneSubmit');
    if (!form || !input) return;

    // فقط عدد قبول کن
    input.addEventListener('input', function () {
      input.value = input.value.replace(/[^0-9]/g, '');
    });

    form.addEventListener('submit', async function (e) {
      e.preventDefault();

      var phone = input.value.trim();
      if (!isValidIranMobile(phone)) {
        toast('شماره باید ۱۱ رقمی و با ۰۹ شروع بشه', 'error');
        input.focus();
        return;
      }

      var api = getAPI();
      if (!api) {
        toast('اتصال به سرور آماده نیست', 'error');
        return;
      }

      btn.disabled = true;
      btn.textContent = 'در حال ارسال...';

      try {
        var res = await api.post({
          action: 'generateLoginCode',
          phone: phone
        });

        state.phone = phone;
        state.code = res.code;
        state.codeId = res.codeId;

        renderPhone(phone);
        renderCode(res.code);

        var verifyBtn = $('#verifyBtn');
        if (verifyBtn) {
          verifyBtn.disabled = false;
          verifyBtn.textContent = 'مربی تایید کرد → ورود';
        }

        goToStep(2);
        startTimer(res.expiresIn || 300);

      } catch (err) {
        console.error(err);
        toast(err.message || 'خطا در دریافت کد', 'error');
      } finally {
        btn.disabled = false;
        btn.textContent = 'دریافت کد ورود';
      }
    });
  }

  /* ══════════════════════════════════════════════════════════════════════
     Phase 2: Verify
     ══════════════════════════════════════════════════════════════════════ */

  function setupVerify() {
    var verifyBtn = $('#verifyBtn');
    var retryBtn = $('#retryCodeBtn');
    var editBtn = $('#editPhoneBtn');

    if (verifyBtn) {
      verifyBtn.addEventListener('click', async function () {
        var api = getAPI();
        if (!api) { toast('اتصال به سرور آماده نیست', 'error'); return; }

        verifyBtn.disabled = true;
        verifyBtn.textContent = 'در حال بررسی...';

        try {
          var res = await api.post({
            action: 'verifyLoginCode',
            phone: state.phone,
            code: state.code
          });

          stopTimer();

          if (res.isNewUser) {
            state.isNewUser = true;
            state.member = null;
          } else {
            state.isNewUser = false;
            state.member = res.member;
          }

          // ذخیره session
          var session = getSession();
          if (session && state.member) {
            session.setMember(state.member);
          }

          // نمایش خوش‌آمد
          var welcomeTitle = $('#welcomeTitle');
          var welcomeSubtitle = $('#welcomeSubtitle');

          if (state.isNewUser) {
            if (welcomeTitle) welcomeTitle.textContent = 'خوش اومدی 🌿';
            if (welcomeSubtitle) {
              welcomeSubtitle.textContent = 'حساب کاربری برات ساخته شد. حالا پروفایلت رو کامل کن.';
            }
          } else {
            var name = state.member && state.member.firstName ? state.member.firstName : 'دوست عزیز';
            if (welcomeTitle) welcomeTitle.textContent = 'خوش آمدی، ' + name + ' 🌿';
            if (welcomeSubtitle) {
              welcomeSubtitle.textContent = 'با موفقیت وارد شدی. خوشحالیم که برگشتی.';
            }
          }

          toast('ورود موفق ✓');
          goToStep(3);

        } catch (err) {
          console.error(err);
          toast(err.message || 'کد نامعتبر یا منقضی شده', 'error');

          if (String(err.message || '').indexOf('منقضی') >= 0) {
            onCodeExpired();
          } else {
            verifyBtn.disabled = false;
            verifyBtn.textContent = 'مربی تایید کرد → ورود';
          }
        }
      });
    }

    if (retryBtn) {
      retryBtn.addEventListener('click', async function () {
        var api = getAPI();
        if (!api) return;

        retryBtn.disabled = true;
        retryBtn.textContent = 'در حال ارسال...';

        try {
          var res = await api.post({
            action: 'generateLoginCode',
            phone: state.phone
          });

          state.code = res.code;
          state.codeId = res.codeId;

          renderCode(res.code);

          var vb = $('#verifyBtn');
          if (vb) {
            vb.disabled = false;
            vb.textContent = 'مربی تایید کرد → ورود';
          }

          startTimer(res.expiresIn || 300);
          toast('کد جدید ارسال شد ✓');

        } catch (err) {
          console.error(err);
          toast(err.message || 'خطا در دریافت کد جدید', 'error');
        } finally {
          retryBtn.disabled = false;
          retryBtn.textContent = 'کد جدید بگیر';
        }
      });
    }

    if (editBtn) {
      editBtn.addEventListener('click', function () {
        stopTimer();
        state.code = '';
        state.codeId = '';
        var phoneInput = $('#phoneInput');
        if (phoneInput) phoneInput.value = state.phone;
        goToStep(1);
      });
    }
  }

  /* ══════════════════════════════════════════════════════════════════════
     Init
     ══════════════════════════════════════════════════════════════════════ */

  function init() {
    // اگه کاربر از قبل وارد شده، مستقیم بره پروفایل
    var session = getSession();
    if (session && session.getMember()) {
      var m = session.getMember();
      var welcomeTitle = $('#welcomeTitle');
      if (welcomeTitle) welcomeTitle.textContent = 'قبلاً وارد شدی 🌿';
      goToStep(3);
      return;
    }

    setupPhoneForm();
    setupVerify();
    goToStep(1);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})(window, document);
