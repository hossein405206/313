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

  function updateMembershipBadge(member) {
    var badge = $('#profileRoleBadge'), hero = $('.profile-hero');
    if (!badge) return;
    function setState(registered) {
      badge.className = 'profile-role-badge ' + (registered ? 'role-badge--member' : 'role-badge--unregistered');
      badge.textContent = registered ? 'عضو حلقه' : 'عضویت تکمیل نشده';
      if (hero) {
        hero.classList.toggle('profile-hero--registered', !!registered);
        hero.classList.toggle('profile-hero--unregistered', !registered);
      }
    }
    setState(false);
    var api = getAPI();
    if (!member || !member.token || !api) return;
    api.get({ action: 'getRingRegistration', token: member.token }).then(function (res) {
      setState(!!(res && res.registered));
    }).catch(function () { setState(false); });
  }

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

    if (av) {
      if (member.profileImage) {
        av.innerHTML = '<img class="profile-avatar__img" src="' + escapeHtml(member.profileImage) + '" alt="عکس پروفایل">';
        av.classList.add('has-image');
      } else {
        av.textContent = initial;
        av.classList.remove('has-image');
      }
    }
    if (nm) nm.textContent = fullName;
    if (ph) ph.textContent = member.phone || '—';
    updateMembershipBadge(member);

    // اطلاعات
    var map = {
      infoFullName: fullName,
      infoNickname: member.nickname || 'ثبت نشده'
    };

    var keys = Object.keys(map);
    for (var i = 0; i < keys.length; i++) {
      var el = $('#' + keys[i]);
      if (el) el.textContent = map[keys[i]];
    }

    // آمار
    var statPoints = $('#statPoints');
    if (statPoints) statPoints.textContent = toPersian(member.points || 0);
    var bestScore = $('#statBestScore');
    if (bestScore) bestScore.textContent = toPersian(member.bestScore || 0);

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
        token: member.token
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
     Profile photo upload
     ══════════════════════════════════════════════════════════════════════ */

  function imageFileToJpeg(file) {
    return new Promise(function(resolve, reject) {
      var reader = new FileReader();
      reader.onerror = function() { reject(new Error('خواندن عکس ناموفق بود')); };
      reader.onload = function() {
        var image = new Image();
        image.onerror = function() { reject(new Error('فایل عکس قابل‌خواندن نیست')); };
        image.onload = function() {
          var max = 640;
          var scale = Math.min(1, max / Math.max(image.naturalWidth || image.width, image.naturalHeight || image.height));
          var canvas = document.createElement('canvas');
          canvas.width = Math.max(1, Math.round((image.naturalWidth || image.width) * scale));
          canvas.height = Math.max(1, Math.round((image.naturalHeight || image.height) * scale));
          var context = canvas.getContext('2d');
          if (!context) { reject(new Error('پردازش عکس در این مرورگر ممکن نیست')); return; }
          context.drawImage(image, 0, 0, canvas.width, canvas.height);
          var url = canvas.toDataURL('image/jpeg', 0.82);
          resolve({base64:url.split(',')[1], mimeType:'image/jpeg'});
        };
        image.src = String(reader.result || '');
      };
      reader.readAsDataURL(file);
    });
  }

  function handleSessionFailure(err) {
    var message = String(err && err.message || '');
    if (!/نشست|توکن|session|token|منقضی/i.test(message)) return false;
    var session = getSession();
    if (session) session.clearMember();
    toast('نشست قبلی با نسخه فعلی سازگار نیست؛ دوباره با شماره و گذرواژه وارد شو', 'error');
    setTimeout(function() { location.href = 'login.html'; }, 1100);
    return true;
  }

  function setupProfilePhoto() {
    var btn = $('#changeProfilePhoto');
    var input = $('#profilePhotoInput');
    if (!btn || !input) return;
    btn.addEventListener('click', function() {
      if (!state.member || !state.member.token) {
        toast('برای تغییر عکس دوباره وارد شو', 'error');
        return;
      }
      input.click();
    });

    input.addEventListener('change', async function() {
      var file = input.files && input.files[0];
      if (!file) return;
      if (!/^image\/(jpeg|png|webp)$/i.test(file.type || '')) {
        toast('فرمت عکس باید JPG، PNG یا WebP باشد', 'error');
        input.value = '';
        return;
      }
      if (file.size > 5 * 1024 * 1024) {
        toast('حجم عکس باید کمتر از ۵ مگابایت باشد', 'error');
        input.value = '';
        return;
      }
      var api = getAPI();
      if (!api || !state.member || !state.member.token) {
        toast('نشست ورود پیدا نشد؛ دوباره وارد شو', 'error');
        input.value = '';
        return;
      }
      btn.disabled = true;
      btn.textContent = 'در حال ذخیره عکس...';
      try {
        var image = await imageFileToJpeg(file);
        var response = await api.post({
          action: 'uploadProfileImage',
          token: state.member.token,
          base64: image.base64,
          mimeType: image.mimeType
        });
        var updated = Object.assign({}, state.member, response.member || {}, {
          profileImage: response.profileImage || (response.member && response.member.profileImage) || ''
        });
        state.member = updated;
        var session = getSession();
        if (session) session.setMember(updated, updated.token);
        renderProfile(updated);
        toast('عکس پروفایل ذخیره شد ✓');
      } catch (err) {
        console.error('Profile photo upload:', err);
        if (!handleSessionFailure(err)) toast(err.message || 'ذخیره عکس ناموفق بود', 'error');
      } finally {
        btn.disabled = false;
        btn.textContent = 'تغییر عکس پروفایل';
        input.value = '';
      }
    });
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
      editNickname: m.nickname || ''
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
        firstName: ($('#editFirstName') || {}).value || '',
        lastName: ($('#editLastName') || {}).value || '',
        nickname: ($('#editNickname') || {}).value || ''
      };

      var keys = Object.keys(data);
      for (var i = 0; i < keys.length; i++) {
        data[keys[i]] = String(data[keys[i]]).trim();
      }

      if (!data.firstName) { toast('نام رو وارد کن', 'error'); return; }
      if (!data.lastName)  { toast('نام خانوادگی رو وارد کن', 'error'); return; }
      if (!data.nickname) { toast('نام نمایشی رو وارد کن', 'error'); return; }

      btn.disabled = true;
      btn.textContent = 'در حال ذخیره...';

      try {
        if (!state.member.token) {
          toast('نشست ورود پیدا نشد؛ یک‌بار خارج شو و دوباره وارد شو', 'error');
          return;
        }

        var response = await api.post({
          action: 'updateMember',
          token: state.member.token,
          ...data
        });

        // پاسخ سرور را مبنا قرار می‌دهیم و توکن فعلی را نگه می‌داریم
        var updated = Object.assign({}, state.member, response.member || data);
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
        if (!handleSessionFailure(err)) toast(err.message || 'خطا در ذخیره', 'error');
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
    if (!member || !member.token) {
      session.clearMember();
      toast('برای ورود دوباره شماره همراه و گذرواژه را وارد کن', 'error');
      setTimeout(function () {
        location.href = 'login.html';
      }, 900);
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
    setupProfilePhoto();
    setupLogout();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})(window, document);
