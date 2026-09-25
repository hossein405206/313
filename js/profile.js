/* ============================================================================
   پروفایل من — منطق صفحه
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

  function getAPI() {
    return window.KanoonApp && window.KanoonApp.api ? window.KanoonApp.api : null;
  }

  function getToast() {
    return window.KanoonApp && window.KanoonApp.toast ? window.KanoonApp.toast : null;
  }

  function getSession() {
    return window.KanoonApp && window.KanoonApp.session ? window.KanoonApp.session : null;
  }

  function getModal() {
    return window.KanoonApp && window.KanoonApp.modal ? window.KanoonApp.modal : null;
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
    member: null
  };

  /* ══════════════════════════════════════════════════════════════════════
     Render
     ══════════════════════════════════════════════════════════════════════ */

  function renderProfile(member) {
    if (!member) return;

    var firstName = String(member.firstName || '').trim();
    var lastName = String(member.lastName || '').trim();
    var fullName = (firstName + ' ' + lastName).trim() || 'کاربر کانون';
    var initial = firstName ? firstName.charAt(0) : '؟';

    // کارت هویت
    var av = $('#profileAvatar');
    var nm = $('#profileName');
    var ph = $('#profilePhone');

    if (av) av.textContent = initial;
    if (nm) nm.textContent = fullName;
    if (ph) ph.textContent = member.phone || '—';

    // اطلاعات
    var map = {
      infoFullName: fullName,
      infoNationalCode: member.nationalCode || 'ثبت نشده',
      infoBirthDate: member.birthDate || 'ثبت نشده',
      infoFatherName: member.fatherName || 'ثبت نشده',
      infoFatherPhone: member.fatherPhone || 'ثبت نشده',
      infoAddress: member.address || 'ثبت نشده'
    };

    var keys = Object.keys(map);
    for (var i = 0; i < keys.length; i++) {
      var el = $('#' + keys[i]);
      if (el) el.textContent = map[keys[i]];
    }

    // آمار
    var statPoints = $('#statPoints');
    if (statPoints) statPoints.textContent = toPersian(member.points || 0);

    // تعداد روز از عضویت
    var daysEl = $('#statDays');
    if (daysEl && member.createdAt) {
      try {
        var created = new Date(member.createdAt);
        var now = new Date();
        var days = Math.floor((now - created) / (1000 * 60 * 60 * 24));
        if (days < 0) days = 0;
        daysEl.textContent = toPersian(days);
      } catch (e) {
        daysEl.textContent = '—';
      }
    }

    // تعداد اردو (از API می‌گیریم)
    loadCampCount(member);
  }

  async function loadCampCount(member) {
    var api = getAPI();
    var el = $('#statCamps');
    if (!api || !el || !member.phone) return;

    try {
      var res = await api.get({
        action: 'listRegistrations',
        memberPhone: member.phone
      });
      var items = res.items || [];
      var approved = items.filter(function (r) {
        return String(r.status).indexOf('تایید') >= 0;
      });
      el.textContent = toPersian(approved.length);
    } catch (err) {
      // اگه خطا داد، صفر بمونه
      console.error('Camp count error:', err);
      el.textContent = '۰';
    }
  }

  /* ══════════════════════════════════════════════════════════════════════
     Edit Modal
     ══════════════════════════════════════════════════════════════════════ */

  function openEditModal() {
    var m = state.member;
    if (!m) return;

    var fields = {
      editFirstName: m.firstName || '',
      editLastName: m.lastName || '',
      editNationalCode: m.nationalCode || '',
      editBirthDate: m.birthDate || '',
      editFatherName: m.fatherName || '',
      editFatherPhone: m.fatherPhone || '',
      editAddress: m.address || ''
    };

    var keys = Object.keys(fields);
    for (var i = 0; i < keys.length; i++) {
      var el = $('#' + keys[i]);
      if (el) el.value = fields[keys[i]];
    }

    var modal = $('#editModal');
    var modalHelper = getModal();
    if (modal && modalHelper) modalHelper.open(modal);
    else if (modal) modal.classList.add('active');
  }

  function closeEditModal() {
    var modal = $('#editModal');
    var modalHelper = getModal();
    if (modal && modalHelper) modalHelper.close(modal);
    else if (modal) modal.classList.remove('active');
  }

  /* ══════════════════════════════════════════════════════════════════════
     Save Edit
     ══════════════════════════════════════════════════════════════════════ */

  function setupEditForm() {
    var form = $('#editForm');
    var btn = $('#saveEditBtn');
    if (!form) return;

    form.addEventListener('submit', async function (e) {
      e.preventDefault();

      var api = getAPI();
      if (!api) { toast('اتصال به سرور آماده نیست', 'error'); return; }
      if (!state.member || !state.member.phone) {
        toast('ابتدا باید وارد بشی', 'error');
        return;
      }

      var data = {
        phone: state.member.phone,
        firstName:    ($('#editFirstName')    || {}).value || '',
        lastName:     ($('#editLastName')     || {}).value || '',
        nationalCode: ($('#editNationalCode') || {}).value || '',
        birthDate:    ($('#editBirthDate')    || {}).value || '',
        fatherName:   ($('#editFatherName')   || {}).value || '',
        fatherPhone:  ($('#editFatherPhone')  || {}).value || '',
        address:      ($('#editAddress')      || {}).value || ''
      };

      var keys = Object.keys(data);
      for (var i = 0; i < keys.length; i++) {
        data[keys[i]] = String(data[keys[i]]).trim();
      }

      if (!data.firstName) { toast('نام رو وارد کن', 'error'); return; }
      if (!data.lastName)  { toast('نام خانوادگی رو وارد کن', 'error'); return; }
      if (data.fatherPhone && !isValidIranMobile(data.fatherPhone)) {
        toast('شماره پدر نامعتبر', 'error');
        return;
      }

      btn.disabled = true;
      btn.textContent = 'در حال ذخیره...';

      try {
        await api.post({ action: 'updateMember', ...data });

        // آپدیت state محلی
        var updated = Object.assign({}, state.member, data);
        state.member = updated;

        // ذخیره در session
        var session = getSession();
        if (session) session.setMember(updated);

        // رندر مجدد
        renderProfile(updated);

        toast('اطلاعات ذخیره شد ✓');
        closeEditModal();

      } catch (err) {
        console.error(err);
        toast(err.message || 'خطا در ذخیره', 'error');
      } finally {
        btn.disabled = false;
        btn.textContent = 'ذخیره تغییرات';
      }
    });

    // بستن مدال
    var modal = $('#editModal');
    if (modal) {
      modal.addEventListener('click', function (e) {
        if (e.target === modal || e.target.hasAttribute('data-close-modal')) {
          closeEditModal();
        }
      });
    }

    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') closeEditModal();
    });
  }

  /* ══════════════════════════════════════════════════════════════════════
     Logout
     ══════════════════════════════════════════════════════════════════════ */

  function doLogout() {
    var session = getSession();
    if (session) {
      session.clearMember();
      session.clearOfficial();
    }
    toast('با موفقیت خارج شدی');
    setTimeout(function () {
      location.href = 'index.html';
    }, 700);
  }

  function setupLogout() {
    var b1 = $('#logoutBtn');
    var b2 = $('#logoutBtn2');
    if (b1) b1.addEventListener('click', doLogout);
    if (b2) b2.addEventListener('click', doLogout);
  }

  /* ══════════════════════════════════════════════════════════════════════
     Init
     ══════════════════════════════════════════════════════════════════════ */

  async function init() {
    var session = getSession();
    if (!session) {
      toast('خطای سیستمی', 'error');
      return;
    }

    var member = session.getMember();

    // اگه کاربر وارد نشده، برو به login
    if (!member) {
      toast('اول باید وارد بشی', 'error');
      setTimeout(function () {
        location.href = 'login.html';
      }, 1200);
      return;
    }

    // اگه عضو جدید (بدون نام)، ازش بخواه تکمیل کنه
    if (!member.firstName && !member.lastName) {
      // بهش پیام بدیم که پروفایلش رو تکمیل کنه
      setTimeout(function () {
        toast('پروفایلت رو کامل کن 🌿');
        openEditModal();
      }, 800);
    }

    state.member = member;
    renderProfile(member);

    var editBtn = $('#editProfileBtn');
    if (editBtn) editBtn.addEventListener('click', openEditModal);

    setupEditForm();
    setupLogout();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})(window, document);
