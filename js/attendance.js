/* ============================================================================
   حضور و غیاب — منطق صفحه
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
    // تاریخ شمسی خودکار
    try {
      var d = new Date();
      var p = d.toLocaleDateString('fa-IR', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
      });
      return p;
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
    members: [],
    records: {}, // { phone: { status, note } }
    official: null
  };

  /* ══════════════════════════════════════════════════════════════════════
     Render
     ══════════════════════════════════════════════════════════════════════ */

  function renderMember(member, index) {
    var phone = String(member.phone || '');
    var fullName = (String(member.firstName || '') + ' ' + String(member.lastName || '')).trim();
    if (!fullName) fullName = phone;

    var initial = fullName.charAt(0) || '؟';
    var rec = state.records[phone] || { status: '', note: '' };

    var presentActive = rec.status === 'present' ? 'active' : '';
    var excusedActive = rec.status === 'excused' ? 'active' : '';
    var absentActive  = rec.status === 'absent'  ? 'active' : '';

    var hasStatus = rec.status ? 'has-status' : '';

    return ''
      + '<div class="att-item ' + hasStatus + '" data-phone="' + escapeHtml(phone) + '">'
      +   '<div class="att-item__header">'
      +     '<div class="att-item__avatar">' + escapeHtml(initial) + '</div>'
      +     '<div class="att-item__name">' + escapeHtml(fullName) + '</div>'
      +     '<div class="att-item__index">' + toPersian(index + 1) + '</div>'
      +   '</div>'
      +   '<div class="att-item__status">'
      +     '<button type="button" class="att-status-btn ' + presentActive + '" data-status="present">'
      +       '<svg viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"/></svg>'
      +       '<span>حاضر</span>'
      +     '</button>'
      +     '<button type="button" class="att-status-btn ' + excusedActive + '" data-status="excused">'
      +       '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>'
      +       '<span>موجه</span>'
      +     '</button>'
      +     '<button type="button" class="att-status-btn ' + absentActive + '" data-status="absent">'
      +       '<svg viewBox="0 0 24 24"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>'
      +       '<span>غایب</span>'
      +     '</button>'
      +   '</div>'
      +   '<input type="text" class="att-item__note" placeholder="توضیحات (اختیاری)..." maxlength="80" value="' + escapeHtml(rec.note) + '">'
      + '</div>';
  }

  function renderList() {
    var list = $('#attendanceList');
    var empty = $('#attendanceEmpty');
    if (!list) return;

    if (!state.members.length) {
      list.innerHTML = '';
      if (empty) empty.classList.remove('hidden');
      return;
    }

    if (empty) empty.classList.add('hidden');

    var html = '';
    for (var i = 0; i < state.members.length; i++) {
      html += renderMember(state.members[i], i);
    }
    list.innerHTML = html;

    attachListEvents();
    updateStats();
  }

  function attachListEvents() {
    var items = $$('.att-item');
    for (var i = 0; i < items.length; i++) {
      (function (item) {
        var phone = item.getAttribute('data-phone');
        var btnGroup = item.querySelector('.att-item__status');
        var noteInput = item.querySelector('.att-item__note');

        // کلیک روی دکمه‌های حالت
        if (btnGroup) {
          btnGroup.addEventListener('click', function (e) {
            var btn = e.target.closest('.att-status-btn');
            if (!btn) return;
            var status = btn.getAttribute('data-status');

            // toggle
            var oldStatus = state.records[phone] ? state.records[phone].status : '';
            if (oldStatus === status) status = '';

            if (!state.records[phone]) state.records[phone] = { status: '', note: '' };
            state.records[phone].status = status;

            // آپدیت UI
            var buttons = btnGroup.querySelectorAll('.att-status-btn');
            for (var j = 0; j < buttons.length; j++) {
              buttons[j].classList.remove('active');
            }
            if (status) btn.classList.add('active');

            item.classList.toggle('has-status', !!status);
            updateStats();
          });
        }

        // تغییر توضیحات
        if (noteInput) {
          noteInput.addEventListener('input', function () {
            if (!state.records[phone]) state.records[phone] = { status: '', note: '' };
            state.records[phone].note = noteInput.value;
          });
        }
      })(items[i]);
    }
  }

  /* ══════════════════════════════════════════════════════════════════════
     Stats
     ══════════════════════════════════════════════════════════════════════ */

  function updateStats() {
    var present = 0, excused = 0, absent = 0, total = state.members.length, done = 0;

    var keys = Object.keys(state.records);
    for (var i = 0; i < keys.length; i++) {
      var rec = state.records[keys[i]];
      if (!rec || !rec.status) continue;
      done++;
      if (rec.status === 'present') present++;
      else if (rec.status === 'excused') excused++;
      else if (rec.status === 'absent') absent++;
    }

    var cPresent = $('#countPresent');
    var cExcused = $('#countExcused');
    var cAbsent = $('#countAbsent');
    var cProgress = $('#saveProgress');

    if (cPresent) cPresent.textContent = toPersian(present);
    if (cExcused) cExcused.textContent = toPersian(excused);
    if (cAbsent)  cAbsent.textContent  = toPersian(absent);
    if (cProgress) cProgress.textContent = toPersian(done) + ' از ' + toPersian(total);
  }

  /* ══════════════════════════════════════════════════════════════════════
     Filters & Tools
     ══════════════════════════════════════════════════════════════════════ */

  function setupSearch() {
    var input = $('#searchInput');
    if (!input) return;

    input.addEventListener('input', function () {
      var q = input.value.trim();
      var items = $$('.att-item');
      for (var i = 0; i < items.length; i++) {
        var item = items[i];
        var name = (item.querySelector('.att-item__name') || {}).textContent || '';
        var match = !q || name.indexOf(q) >= 0;
        item.style.display = match ? '' : 'none';
      }
    });
  }

  function setupMarkAll() {
    var btn = $('#markAllPresent');
    if (!btn) return;

    btn.addEventListener('click', function () {
      for (var i = 0; i < state.members.length; i++) {
        var phone = String(state.members[i].phone || '');
        if (!state.records[phone]) state.records[phone] = { status: '', note: '' };
        state.records[phone].status = 'present';
      }
      renderList();
      toast('همه حاضر شدن ✓');
    });
  }

  /* ══════════════════════════════════════════════════════════════════════
     Save
     ══════════════════════════════════════════════════════════════════════ */

  function setupSave() {
    var btn = $('#saveBtn');
    if (!btn) return;

    btn.addEventListener('click', async function () {
      var api = getAPI();
      if (!api) {
        toast('اتصال به سرور آماده نیست', 'error');
        return;
      }

      var official = state.official;
      if (!official) {
        toast('اول باید وارد بشی', 'error');
        return;
      }

      // جمع‌آوری رکوردها
      var records = [];
      for (var i = 0; i < state.members.length; i++) {
        var m = state.members[i];
        var phone = String(m.phone || '');
        var rec = state.records[phone];
        if (!rec || !rec.status) continue;

        var fullName = (String(m.firstName || '') + ' ' + String(m.lastName || '')).trim() || phone;
        var statusFa = 'حاضر';
        if (rec.status === 'excused') statusFa = 'موجه';
        else if (rec.status === 'absent') statusFa = 'غیبت';

        records.push({
          fullName: fullName,
          status: statusFa,
          note: rec.note || ''
        });
      }

      if (!records.length) {
        toast('هیچ حضوری ثبت نکردی', 'error');
        return;
      }

      btn.disabled = true;
      var oldText = btn.querySelector('span').textContent;
      btn.querySelector('span').textContent = 'در حال ذخیره...';

      try {
        await api.post({
          action: 'saveAttendanceBatch',
          officialCode: official.code,
          date: todayISO(),
          records: records
        });

        toast('حضور و غیاب ذخیره شد ✓');

        // ریست
        state.records = {};
        renderList();

      } catch (err) {
        console.error(err);
        toast(err.message || 'خطا در ذخیره', 'error');
      } finally {
        btn.disabled = false;
        btn.querySelector('span').textContent = oldText;
      }
    });
  }

  /* ══════════════════════════════════════════════════════════════════════
     Load Members
     ══════════════════════════════════════════════════════════════════════ */

  async function loadMembers() {
    var api = getAPI();
    var list = $('#attendanceList');

    if (!api) {
      if (list) list.innerHTML = '<div class="empty"><p>اتصال به سرور آماده نیست</p></div>';
      return;
    }

    var official = state.official;
    if (!official) {
      if (list) list.innerHTML = '<div class="empty"><p>اول باید وارد بشی</p></div>';
      return;
    }

    try {
      var res = await api.get({
        action: 'listMembers',
        officialCode: official.code
      });
      state.members = res.items || [];
      renderList();
    } catch (err) {
      console.error(err);
      if (list) list.innerHTML = '<div class="empty"><p>خطا در بارگذاری اعضا</p></div>';
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
    if (nameEl) nameEl.textContent = state.official.name || 'مسئول';

    setupSearch();
    setupMarkAll();
    setupSave();
    loadMembers();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})(window, document);
