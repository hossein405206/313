/* ============================================================================
   نظارت — منطق صفحه
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

  function escapeHtml(str) {
    if (str === null || str === undefined) return '';
    return String(str)
      .split('&').join('&amp;')
      .split('<').join('&lt;')
      .split('>').join('&gt;')
      .split('"').join('&quot;')
      .split("'").join('&#39;');
  }

  function todayPersian() {
    try {
      var d = new Date();
      return d.toLocaleDateString('fa-IR', {
        year: 'numeric', month: '2-digit', day: '2-digit'
      });
    } catch (e) {
      return new Date().toISOString().slice(0, 10);
    }
  }

  function todayISO() {
    var d = new Date();
    var y = d.getFullYear();
    var m = String(d.getMonth() + 1).padStart(2, '0');
    var day = String(d.getDate()).padStart(2, '0');
    return y + '-' + m + '-' + day;
  }

  function getSession() {
    if (window.KanoonApp && window.KanoonApp.session) {
      return {
        member: window.KanoonApp.session.getMember(),
        official: window.KanoonApp.session.getOfficial()
      };
    }
    return { member: null, official: null };
  }

  function getAPI() {
    return window.KanoonApp && window.KanoonApp.api ? window.KanoonApp.api : null;
  }

  function getToast() {
    return window.KanoonApp && window.KanoonApp.toast ? window.KanoonApp.toast : null;
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

  /* ══════════════════════════════════════════════════════════════════════
     State
     ══════════════════════════════════════════════════════════════════════ */

  var state = {
    official: null,
    officials: [],
    warnings: [],
    currentFilter: 'all'
  };

  /* ══════════════════════════════════════════════════════════════════════
     Load Officials (برای انتخاب در فرم)
     ══════════════════════════════════════════════════════════════════════ */

  async function loadOfficials() {
    var api = getAPI();
    var select = $('#officialSelect');
    if (!api || !select) return;

    try {
      var res = await api.get({ action: 'listOfficials' });
      var all = res.items || [];

      // فقط مسئولیت‌های اجرایی (نه نقش‌های ویژه)
      state.officials = all.filter(function (o) {
        return String(o.type) === 'official';
      });

      var html = '<option value="">انتخاب کن...</option>';
      for (var i = 0; i < state.officials.length; i++) {
        var o = state.officials[i];
        html += '<option value="' + escapeHtml(o.name) + '">'
             + escapeHtml(o.name) + ' — ' + escapeHtml(o.role)
             + '</option>';
      }
      select.innerHTML = html;

      if (!state.officials.length) {
        select.innerHTML = '<option value="">مسئولی یافت نشد</option>';
      }
    } catch (err) {
      console.error(err);
      select.innerHTML = '<option value="">خطا در بارگذاری</option>';
    }
  }

  /* ══════════════════════════════════════════════════════════════════════
     Load Warnings
     ══════════════════════════════════════════════════════════════════════ */

  async function loadWarnings() {
    var api = getAPI();
    var list = $('#warningsList');
    if (!api || !list) return;

    if (!state.official) return;

    try {
      var res = await api.get({
        action: 'listWarnings',
        officialCode: state.official.code
      });
      state.warnings = res.items || [];
      renderWarnings();
    } catch (err) {
      console.error(err);
      list.innerHTML = '<div class="empty"><p>خطا در بارگذاری اخطارها</p></div>';
    }
  }

  /* ══════════════════════════════════════════════════════════════════════
     Render Warnings
     ══════════════════════════════════════════════════════════════════════ */

  function renderWarning(w) {
    var date = w.date || '';
    var name = w.officialName || '—';
    var desc = w.description || '';
    var initial = String(name).charAt(0) || '؟';

    return ''
      + '<div class="sup-item">'
      +   '<div class="sup-item__header">'
      +     '<div class="sup-item__icon">'
      +       '<svg viewBox="0 0 24 24">'
      +         '<path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>'
      +         '<line x1="12" y1="9" x2="12" y2="13"/>'
      +         '<line x1="12" y1="17" x2="12.01" y2="17"/>'
      +       '</svg>'
      +     '</div>'
      +     '<div class="sup-item__title">'
      +       '<span class="sup-item__name">' + escapeHtml(name) + '</span>'
      +       '<span class="sup-item__date">' + escapeHtml(date) + '</span>'
      +     '</div>'
      +   '</div>'
      +   '<div class="sup-item__text">' + escapeHtml(desc) + '</div>'
      + '</div>';
  }

  function filterWarnings() {
    var today = todayISO();
    var now = new Date();
    var weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    return state.warnings.filter(function (w) {
      if (state.currentFilter === 'all') return true;

      var d = String(w.date || '');
      // اگه ISO بود
      if (d.indexOf('T') >= 0) d = d.slice(0, 10);

      if (state.currentFilter === 'today') {
        return d === today;
      }
      if (state.currentFilter === 'week') {
        try {
          var wd = new Date(d);
          return wd >= weekAgo;
        } catch (e) {
          return false;
        }
      }
      return true;
    });
  }

  function renderWarnings() {
    var list = $('#warningsList');
    var empty = $('#warningsEmpty');
    var countEl = $('#warningCount');
    var todayCountEl = $('#todayWarnings');

    if (!list) return;

    var filtered = filterWarnings();

    // شمارنده‌ها
    if (countEl) countEl.textContent = toPersian(state.warnings.length) + ' مورد';

    var todayCount = state.warnings.filter(function (w) {
      var d = String(w.date || '');
      if (d.indexOf('T') >= 0) d = d.slice(0, 10);
      return d === todayISO();
    }).length;
    if (todayCountEl) todayCountEl.textContent = toPersian(todayCount);

    if (!filtered.length) {
      list.innerHTML = '';
      if (empty) empty.classList.remove('hidden');
      return;
    }

    if (empty) empty.classList.add('hidden');

    var html = '';
    for (var i = 0; i < filtered.length; i++) {
      html += renderWarning(filtered[i]);
    }
    list.innerHTML = html;
  }

  /* ══════════════════════════════════════════════════════════════════════
     Submit Warning
     ══════════════════════════════════════════════════════════════════════ */

  function setupForm() {
    var form = $('#warningForm');
    var select = $('#officialSelect');
    var textarea = $('#warningText');
    var charCount = $('#charCount');
    var submitBtn = $('#submitWarning');

    if (!form || !select || !textarea) return;

    // شمارنده کاراکتر
    if (charCount) {
      textarea.addEventListener('input', function () {
        charCount.textContent = toPersian(textarea.value.length);
      });
    }

    form.addEventListener('submit', async function (e) {
      e.preventDefault();

      var api = getAPI();
      if (!api) {
        toast('اتصال به سرور آماده نیست', 'error');
        return;
      }

      if (!state.official) {
        toast('اول باید وارد بشی', 'error');
        return;
      }

      var officialName = select.value.trim();
      var description = textarea.value.trim();

      if (!officialName) {
        toast('مسئول موردنظر رو انتخاب کن', 'error');
        return;
      }
      if (!description) {
        toast('متن اخطار رو بنویس', 'error');
        return;
      }

      submitBtn.disabled = true;
      submitBtn.textContent = 'در حال ثبت...';

      try {
        await api.post({
          action: 'saveWarning',
          officialCode: state.official.code,
          officialName: officialName,
          description: description,
          date: todayISO()
        });

        toast('اخطار ثبت شد ✓');

        // ریست فرم
        form.reset();
        if (charCount) charCount.textContent = '۰';

        // بارگذاری مجدد
        await loadWarnings();

      } catch (err) {
        console.error(err);
        toast(err.message || 'خطا در ثبت اخطار', 'error');
      } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = 'ثبت اخطار';
      }
    });
  }

  /* ══════════════════════════════════════════════════════════════════════
     Filter Chips
     ══════════════════════════════════════════════════════════════════════ */

  function setupFilters() {
    var chips = $$('.chip[data-filter]');
    for (var i = 0; i < chips.length; i++) {
      (function (chip) {
        chip.addEventListener('click', function () {
          for (var j = 0; j < chips.length; j++) chips[j].classList.remove('active');
          chip.classList.add('active');
          state.currentFilter = chip.getAttribute('data-filter') || 'all';
          renderWarnings();
        });
      })(chips[i]);
    }
  }

  /* ══════════════════════════════════════════════════════════════════════
     Init
     ══════════════════════════════════════════════════════════════════════ */

  function init() {
    var session = getSession();
    state.official = session.official;

    // چک ورود
    if (!state.official) {
      toast('اول باید با کد مسئولیت وارد بشی', 'error');
      setTimeout(function () {
        location.href = 'officials.html';
      }, 1500);
      return;
    }

    // نمایش تاریخ و اسم مسئول
    var dateEl = $('#sessionDate');
    var nameEl = $('#officialName');
    if (dateEl) dateEl.textContent = todayPersian();
    if (nameEl) nameEl.textContent = state.official.name || 'مسئول نظارت';

    setupForm();
    setupFilters();
    loadOfficials();
    loadWarnings();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})(window, document);
