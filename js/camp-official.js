(function () {
  'use strict';
  var $ = function (id) { return document.getElementById(id); };
  var app = window.KanoonApp;
  var state = { official: null, token: '', camps: [], editingCampId: '' };

  function api() {
    if (!app || !app.api) throw new Error('اتصال سایت آماده نیست؛ صفحه را تازه‌سازی کن.');
    return app.api;
  }
  function esc(value) {
    return String(value == null ? '' : value).replace(/[&<>"']/g, function (c) {
      return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];
    });
  }
  function toast(message, isError) {
    var t = app && app.toast;
    if (t) (isError ? t.error : t.success)(message);
  }
  function normalizeDigits(value) {
    return String(value == null ? '' : value)
      .replace(/[۰-۹]/g, function (c) { return String('۰۱۲۳۴۵۶۷۸۹'.indexOf(c)); })
      .replace(/[٠-٩]/g, function (c) { return String('٠١٢٣٤٥٦٧٨٩'.indexOf(c)); });
  }
  function setBusy(button, label) {
    if (!button) return;
    button.dataset.oldText = button.textContent;
    button.disabled = true;
    button.textContent = label || 'در حال پردازش…';
  }
  function clearBusy(button) {
    if (!button) return;
    button.disabled = false;
    button.textContent = button.dataset.oldText || 'ذخیره';
  }
  function expectedBackendVersion() {
    return String(app && app.config && app.config.BACKEND_VERSION || '');
  }
  function backendVersionMessage(actual) {
    return 'برای استفادهٔ کامل از پنل، بک‌اند نسخهٔ ' + expectedBackendVersion() +
      ' لازم است. نسخهٔ پاسخ‌دهندهٔ فعلی: ' + String(actual || 'نامشخص') +
      '. فایل apps-script/Code.gs را در Google Apps Script جایگزین و از مسیر Manage deployments → Edit → New version → Deploy منتشر کن.';
  }
  function setBackendNotice(message) {
    var notice = $('campBackendNotice');
    if (notice) {
      notice.textContent = String(message || '');
      notice.hidden = !message;
    }
  }
  async function checkBackendVersion() {
    try {
      var ping = await api().get({ action: 'ping' });
      var actual = String(ping && ping.version || '');
      if (!actual || actual !== expectedBackendVersion()) {
        setBackendNotice(backendVersionMessage(actual));
        return false;
      }
      setBackendNotice('');
      return true;
    } catch (e) {
      setBackendNotice('بررسی نسخهٔ بک‌اند انجام نشد. اتصال اینترنت را بررسی کن و صفحه را تازه‌سازی کن.');
      return false;
    }
  }
  async function ensureBackendVersion() {
    var ping = await api().get({ action: 'ping' });
    var actual = String(ping && ping.version || '');
    if (!actual || actual !== expectedBackendVersion()) {
      setBackendNotice(backendVersionMessage(actual));
      throw new Error(backendVersionMessage(actual));
    }
    setBackendNotice('');
    return ping;
  }
  function formatDeadline(value) {
    if (!value) return 'مهلت مشخص نشده';
    try { if (app && app.date && app.date.format) return app.date.format(value); } catch (e) {}
    return String(value);
  }
  function formatMoney(value) {
    return Number(value || 0).toLocaleString('fa-IR') + ' تومان';
  }
  function clearCampForm() {
    state.editingCampId = '';
    ['campTitle','campCardNumber','campCost','campCapacity','campDeadline'].forEach(function (id) {
      if ($(id)) $(id).value = '';
    });
    var save = $('saveCampBtn');
    if (save) save.textContent = 'ثبت اردو';
  }
  function renderCamps(items) {
    state.camps = Array.isArray(items) ? items : [];
    var box = $('campsAdmin');
    if (!box) return;
    if (!state.camps.length) {
      box.innerHTML = '<div class="camp-empty">اردوی فعالی در فهرست وجود ندارد.</div>';
      return;
    }
    box.innerHTML = state.camps.map(function (camp) {
      var capacity = Number(camp.capacity || 0), count = Number(camp.registrationCount || 0), cost = Number(camp.cost || 0);
      var cap = capacity > 0
        ? 'ثبت‌نام: ' + count.toLocaleString('fa-IR') + ' از ' + capacity.toLocaleString('fa-IR') + ' نفر' + (count >= capacity ? ' · ظرفیت تکمیل' : '')
        : 'ثبت‌نام: ' + count.toLocaleString('fa-IR') + ' نفر · ظرفیت تعیین نشده';
      var details = 'ظرفیت: ' + cap + ' · شماره کارت: ' + String(camp.cardNumber || 'ثبت نشده') +
        ' · هزینه: ' + (cost ? formatMoney(cost) : 'بدون هزینه') + ' · پایان ثبت‌نام: ' + formatDeadline(camp.registrationDeadline);
      return '<article class="camp-item"><div class="camp-item__main"><strong>' + esc(camp.title) +
        '</strong><small>' + esc(details) + '</small></div><div class="camp-item__actions">' +
        '<button type="button" data-camp-edit="' + esc(camp.id) + '">ویرایش / ظرفیت</button>' +
        '<button type="button" class="danger" data-camp-delete="' + esc(camp.id) + '">حذف اردو</button></div></article>';
    }).join('');
    box.querySelectorAll('[data-camp-edit]').forEach(function (button) {
      button.addEventListener('click', function () {
        var camp = state.camps.filter(function (item) { return String(item.id) === String(button.dataset.campEdit); })[0];
        if (!camp) return;
        state.editingCampId = String(camp.id || '');
        $('campTitle').value = String(camp.title || '');
        $('campCardNumber').value = String(camp.cardNumber || '');
        $('campCost').value = Number(camp.cost || 0) || '';
        $('campCapacity').value = Number(camp.capacity || 0) || '';
        $('campDeadline').value = String(camp.registrationDeadline || '').slice(0, 10);
        $('saveCampBtn').textContent = 'ذخیره تغییرات اردو';
        $('campCampsSection').scrollIntoView({ behavior: 'smooth', block: 'start' });
        $('campTitle').focus({ preventScroll: true });
      });
    });
    box.querySelectorAll('[data-camp-delete]').forEach(function (button) {
      button.addEventListener('click', async function () {
        var id = String(button.dataset.campDelete || '');
        if (!id || !window.confirm('این اردو از فهرست ثبت‌نام برداشته شود؟')) return;
        setBusy(button, 'در حال حذف…');
        try {
          await ensureBackendVersion();
          await api().post({ action: 'deleteCamp', token: state.token, id: id });
          toast('اردو از فهرست ثبت‌نام حذف شد.');
          await loadCamps();
        } catch (e) {
          toast(e.message || 'حذف اردو ناموفق بود', true);
        } finally { clearBusy(button); }
      });
    });
  }
  async function loadCamps() {
    var box = $('campsAdmin');
    if (!box) return;
    box.innerHTML = '<div class="camp-empty">در حال دریافت فهرست اردوها…</div>';
    try {
      var result = await api().get({ action: 'listCamps' });
      renderCamps(result.items || []);
    } catch (e) {
      box.innerHTML = '<div class="camp-empty">بارگذاری اردوها ناموفق بود: ' + esc(e.message || 'خطای اتصال') + '</div>';
    }
  }
  function renderReceipts(items) {
    var box = $('campPaymentReviewAdmin');
    if (!box) return;
    items = Array.isArray(items) ? items : [];
    if (!items.length) {
      box.innerHTML = '<div class="camp-empty">رسید پرداختی برای بررسی وجود ندارد.</div>';
      return;
    }
    box.innerHTML = items.map(function (item) {
      var person = String(item.firstName || '') + ' ' + String(item.lastName || '');
      var details = String(item.campTitle || '') + ' · ' + String(item.phone || '') + ' · ' +
        String(item.paymentStatus || 'منتظر ارسال رسید') + ' · ' + formatMoney(item.campCost || 0);
      var actions = item.receiptPhotoUrl
        ? '<button type="button" data-receipt-view="' + esc(item.id) + '">مشاهده رسید</button>' +
          (item.paymentStatus === 'تایید پرداخت' ? '' :
            '<button type="button" data-payment-ok="' + esc(item.id) + '">تأیید پرداخت</button>' +
            '<button type="button" class="danger" data-payment-no="' + esc(item.id) + '">رد رسید</button>')
        : '<span class="camp-payment-waiting">در انتظار ارسال رسید</span>';
      return '<article class="camp-item camp-registration-item"><div class="camp-item__main"><strong>' +
        esc(person.trim() || 'ثبت‌نام اردو') + '</strong><small>' + esc(details) +
        '</small></div><div class="camp-item__actions">' + actions + '</div></article>';
    }).join('');
    box.querySelectorAll('[data-receipt-view]').forEach(function (button) {
      button.addEventListener('click', function () { viewRegistrationPhoto(button.dataset.receiptView, button); });
    });
    box.querySelectorAll('[data-payment-ok]').forEach(function (button) {
      button.addEventListener('click', function () { setPaymentStatus(button.dataset.paymentOk, 'تایید پرداخت', button); });
    });
    box.querySelectorAll('[data-payment-no]').forEach(function (button) {
      button.addEventListener('click', function () { setPaymentStatus(button.dataset.paymentNo, 'رد پرداخت', button); });
    });
  }
  async function loadCampPaymentReceipts() {
    var box = $('campPaymentReviewAdmin');
    if (!box) return;
    box.innerHTML = '<div class="camp-empty">در حال دریافت رسیدها…</div>';
    try {
      var result = await api().post({ action: 'listCampPaymentReceipts', token: state.token });
      renderReceipts(result.items || []);
    } catch (e) {
      var original = String(e && e.message || 'دریافت رسیدها ناموفق بود');
      var message = original.indexOf('listCampPaymentReceipts') >= 0
        ? 'مسیر دریافت رسیدها در نسخهٔ فعال بک‌اند وجود ندارد. نسخهٔ جدید Apps Script را طبق راهنمای انتشار در README منتشر کن. جزئیات: ' + original
        : 'دریافت رسیدها ناموفق بود: ' + original;
      box.innerHTML = '<div class="camp-empty">' + esc(message) + '</div>';
    }
  }
  async function loadConsentUrl() {
    try {
      var result = await api().get({ action: 'getCampConsentUrl' });
      if ($('campConsentUrl')) $('campConsentUrl').value = String(result.url || '');
    } catch (e) {}
  }
  async function saveCamp() {
    var save = $('saveCampBtn');
    var title = String($('campTitle').value || '').trim();
    var cardNumber = normalizeDigits($('campCardNumber').value).replace(/[\s-]/g, '');
    var costText = normalizeDigits($('campCost').value).replace(/[\s,،٬]/g, '');
    var deadline = String($('campDeadline').value || '').trim();
    var capacityText = normalizeDigits($('campCapacity').value).replace(/[\s,،٬]/g, '');
    if (!title) { toast('نام اردو را وارد کن.', true); $('campTitle').focus(); return; }
    if (!/^\d+$/.test(capacityText) || Number(capacityText) < 1 || Number(capacityText) > 100000) {
      toast('ظرفیت را به عدد صحیح بین ۱ تا ۱۰۰٬۰۰۰ نفر وارد کن.', true); $('campCapacity').focus(); return;
    }
    if (!deadline) { toast('تاریخ پایان ثبت‌نام را انتخاب کن.', true); $('campDeadline').focus(); return; }
    if (costText && !/^\d+$/.test(costText)) { toast('هزینه را با رقم وارد کن.', true); $('campCost').focus(); return; }
    if (Number(costText || 0) > 0 && !/^\d{16,26}$/.test(cardNumber)) {
      toast('شماره کارت یا شبا را درست وارد کن.', true); $('campCardNumber').focus(); return;
    }
    setBusy(save, 'در حال ثبت اردو…');
    try {
      await ensureBackendVersion();
      await api().post({ action: 'saveCamp', token: state.token, id: state.editingCampId || '',
        title: title, cardNumber: cardNumber, cost: costText || 0,
        registrationDeadline: deadline, capacity: Number(capacityText) });
      toast(state.editingCampId ? 'تغییرات اردو ذخیره شد.' : 'اردو با موفقیت ثبت شد.');
      clearCampForm();
      await loadCamps();
    } catch (e) { toast(e.message || 'ثبت اردو ناموفق بود.', true); }
    finally { clearBusy(save); }
  }
  async function saveConsentUrl() {
    var button = $('saveCampConsentBtn');
    var url = String($('campConsentUrl').value || '').trim();
    if (url && !/^https?:\/\//i.test(url)) {
      toast('لینک باید با https:// یا http:// شروع شود.', true); $('campConsentUrl').focus(); return;
    }
    setBusy(button, 'در حال ذخیره…');
    try {
      await ensureBackendVersion();
      await api().post({ action: 'saveCampConsentUrl', token: state.token, url: url });
      toast(url ? 'لینک رضایت‌نامه ذخیره شد.' : 'لینک رضایت‌نامه پاک شد.');
    } catch (e) { toast(e.message || 'ذخیرهٔ لینک ناموفق بود.', true); }
    finally { clearBusy(button); }
  }
  async function setPaymentStatus(id, status, button) {
    var prompt = status === 'تایید پرداخت' ? 'رسید را تأیید کنی و ثبت‌نام این فرد هم نهایی شود؟' : 'این رسید را رد کنی؟';
    if (!window.confirm(prompt)) return;
    setBusy(button, 'در حال ثبت…');
    try {
      await ensureBackendVersion();
      await api().post({ action: 'setCampPaymentStatus', token: state.token, id: id, status: status });
      toast(status === 'تایید پرداخت' ? 'پرداخت تأیید و ثبت‌نام نهایی شد.' : 'رسید رد شد.');
      await Promise.all([loadCampPaymentReceipts(), loadCamps()]);
    } catch (e) { toast(e.message || 'تغییر وضعیت رسید ناموفق بود.', true); }
    finally { clearBusy(button); }
  }
  async function viewRegistrationPhoto(id, button) {
    var modal = $('registrationPhotoModal'), img = $('registrationPhotoImage'), status = $('registrationPhotoStatus');
    if (!modal || !img || !status) { toast('نمایشگر رسید آماده نیست.', true); return; }
    modal.hidden = false; modal.classList.add('active'); document.body.style.overflow = 'hidden';
    img.hidden = true; img.removeAttribute('src'); status.textContent = 'در حال دریافت امن رسید پرداخت…';
    if (button) setBusy(button, 'در حال دریافت…');
    try {
      var result = await api().post({ action: 'getRegistrationPhoto', token: state.token, id: id, type: 'receipt' });
      if (!result.base64) throw new Error('رسید پرداخت در پاسخ سرور موجود نبود.');
      img.onload = function () { img.hidden = false; status.textContent = 'این تصویر فقط در پنل مجاز نمایش داده می‌شود.'; };
      img.onerror = function () { img.hidden = true; status.textContent = 'تصویر دریافت شد اما مرورگر نتوانست آن را نمایش دهد.'; };
      img.src = 'data:' + String(result.mimeType || 'image/jpeg') + ';base64,' + result.base64;
    } catch (e) { status.textContent = e.message || 'نمایش رسید ناموفق بود.'; }
    finally { if (button) clearBusy(button); }
  }
  function closeRegistrationPhotoModal() {
    var modal = $('registrationPhotoModal'), img = $('registrationPhotoImage'), status = $('registrationPhotoStatus');
    if (modal) { modal.hidden = true; modal.classList.remove('active'); }
    if (img) { img.hidden = true; img.removeAttribute('src'); }
    if (status) status.textContent = '';
    document.body.style.overflow = '';
  }
  function bindEvents() {
    var card = $('campCardNumber'), cost = $('campCost');
    if (card) card.addEventListener('input', function () {
      card.value = normalizeDigits(card.value).replace(/[^0-9\s-]/g, '').slice(0, 30);
    });
    if (cost) cost.addEventListener('input', function () {
      cost.value = normalizeDigits(cost.value).replace(/[^0-9,،٬]/g, '').slice(0, 14);
    });
    $('saveCampBtn').addEventListener('click', saveCamp);
    $('cancelCampBtn').addEventListener('click', clearCampForm);
    $('saveCampConsentBtn').addEventListener('click', saveConsentUrl);
    $('refreshCampDataBtn').addEventListener('click', async function () {
      setBusy(this, 'در حال دریافت…');
      await Promise.all([checkBackendVersion(), loadCamps(), loadCampPaymentReceipts(), loadConsentUrl()]);
      clearBusy(this);
    });
    $('refreshCampReceiptsBtn').addEventListener('click', loadCampPaymentReceipts);
    $('campLogout').addEventListener('click', function () {
      if (app && app.session && app.session.clearOfficial) app.session.clearOfficial();
      location.replace('officials.html');
    });
    var modal = $('registrationPhotoModal'), close = $('registrationPhotoClose');
    if (close) close.addEventListener('click', closeRegistrationPhotoModal);
    if (modal) modal.addEventListener('click', function (event) { if (event.target === modal) closeRegistrationPhotoModal(); });
    document.addEventListener('keydown', function (event) {
      if (event.key === 'Escape' && modal && !modal.hidden) closeRegistrationPhotoModal();
    });
  }
  function boot() {
    var official = app && app.session && app.session.getOfficial ? app.session.getOfficial() : null;
    if (!official || !official.token || String(official.role || '').trim() !== 'مسئول اردو') {
      if ($('campAccessError')) $('campAccessError').hidden = false;
      if ($('campDashboard')) $('campDashboard').hidden = true;
      return;
    }
    state.official = official;
    state.token = String(official.token);
    try {
      ['coach_token','coach_name','coach_master','coach_permissions','coach_camp_official'].forEach(function (key) {
        window.sessionStorage.removeItem(key);
      });
    } catch (e) {}
    if ($('campOfficialName')) $('campOfficialName').textContent = String(official.name || 'مسئول اردو');
    if ($('campDashboard')) $('campDashboard').hidden = false;
    bindEvents();
    checkBackendVersion();
    loadCamps();
    loadCampPaymentReceipts();
    loadConsentUrl();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();