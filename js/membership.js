(function () {
  'use strict';
  var $ = function (selector) { return document.querySelector(selector); };
  var form = $('#membershipForm');
  var statusBox = $('#membershipStatusBox');
  var submitButton = $('#membershipSubmit');
  function app() { return window.KanoonApp; }
  function normalizeDigits(value) {
    return String(value || '')
      .replace(/[۰-۹]/g, function (d) { return String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d)); })
      .replace(/[٠-٩]/g, function (d) { return String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)); })
      .replace(/\D/g, '').slice(0, 11);
  }
  function validPhone(value) { return /^09\d{9}$/.test(String(value || '')); }
  function setStatus(title, message, kind) {
    if (!statusBox) return;
    statusBox.className = 'membership-status ' + (kind || 'info');
    statusBox.innerHTML = '<strong>' + title + '</strong><p>' + message + '</p>';
    statusBox.classList.remove('hidden');
  }
  function setFormVisible(visible) {
    if (form) form.classList.toggle('hidden', !visible);
  }
  function getMember() {
    return app() && app().session ? app().session.getMember() : null;
  }
  function setMember(member, token) {
    if (app() && app().session) app().session.setMember(member, token || (member && member.token));
  }
  function prefill(member) {
    if (!member) return;
    $('#memberFirstName').value = member.firstName || '';
    $('#memberLastName').value = member.lastName || '';
    $('#memberPhone').value = member.phone || '';
    if (member.phone) $('#memberPhone').readOnly = true;
  }
  async function initialize() {
    for (var i = 0; i < 100; i++) {
      if (app() && app().session && app().api) break;
      await new Promise(function (resolve) { setTimeout(resolve, 50); });
    }
    if (!app() || !app().api || !app().session) {
      setStatus('اتصال برقرار نشد', 'صفحه را دوباره بارگذاری کن.', 'error');
      return;
    }
    var member = getMember();
    if (!member || !member.token) return;
    prefill(member);
    try {
      var result = await app().api.get({ action: 'getMyMembershipStatus', token: member.token });
      var status = String(result.membershipStatus || (result.member && result.member.membershipStatus) || '');
      member = Object.assign({}, member, result.member || {}, { membershipStatus: status, token: member.token });
      setMember(member, member.token);
      if (status === 'approved') {
        setStatus('عضویتت فعال است ✓', 'درخواست عضویتت قبلاً تأیید شده. می‌توانی وارد بازی‌ها شوی.', 'success');
        setFormVisible(false);
      } else if (status === 'pending') {
        setStatus('درخواستت در حال بررسی است', 'اگر لازم است اطلاعاتت را اصلاح کنی، فرم را به‌روزرسانی و دوباره ارسال کن.', 'pending');
      } else if (status === 'rejected') {
        setStatus('درخواست قبلی تأیید نشد', 'اطلاعات را بررسی کن و در صورت نیاز دوباره درخواست بده.', 'error');
      }
    } catch (error) {
      setStatus('وضعیت عضویت دریافت نشد', 'فرم را می‌توانی تکمیل کنی؛ اگر خطا ادامه داشت، اتصال اینترنت را بررسی کن.', 'error');
    }
  }
  if (form) {
    ['#memberPhone', '#memberGuardianPhone'].forEach(function (selector) {
      var field = $(selector);
      field.addEventListener('input', function () { if (!field.readOnly) field.value = normalizeDigits(field.value); });
    });
    form.addEventListener('submit', async function (event) {
      event.preventDefault();
      if (!app() || !app().api || !app().session) {
        setStatus('اتصال برقرار نیست', 'چند لحظه بعد دوباره تلاش کن.', 'error');
        return;
      }
      var firstName = $('#memberFirstName').value.trim().replace(/\s+/g, ' ');
      var lastName = $('#memberLastName').value.trim().replace(/\s+/g, ' ');
      var phone = normalizeDigits($('#memberPhone').value);
      var guardianName = $('#memberGuardianName').value.trim().replace(/\s+/g, ' ');
      var guardianPhone = normalizeDigits($('#memberGuardianPhone').value);
      var schoolLevel = $('#memberSchoolLevel').value;
      var schoolGrade = $('#memberSchoolGrade').value.trim();
      var birthDate = $('#memberBirthDate').value;
      if (firstName.length < 2 || lastName.length < 2) {
        setStatus('اطلاعات ناقص است', 'نام و نام خانوادگی را کامل وارد کن.', 'error'); return;
      }
      if (!validPhone(phone)) {
        setStatus('شماره همراه نامعتبر است', 'شماره همراه عضو باید با 09 شروع شود و ۱۱ رقم داشته باشد.', 'error'); return;
      }
      if (!guardianName || !validPhone(guardianPhone)) {
        setStatus('اطلاعات سرپرست ناقص است', 'نام سرپرست و شماره همراه معتبر او را وارد کن.', 'error'); return;
      }
      if (!schoolLevel || !schoolGrade) {
        setStatus('اطلاعات تحصیلی ناقص است', 'مقطع و پایه تحصیلی را انتخاب یا وارد کن.', 'error'); return;
      }
      var member = getMember();
      var originalText = submitButton.textContent;
      submitButton.disabled = true;
      submitButton.textContent = 'در حال ثبت درخواست...';
      try {
        if (!member || !member.token) {
          var account = await app().api.post({
            action: 'registerMember',
            name: firstName + ' ' + lastName,
            phone: phone
          });
          member = Object.assign({}, account.member || {}, { token: account.token });
          setMember(member, account.token);
        } else if (String(member.phone || '') !== phone) {
          throw new Error('شماره همراه با حساب واردشده مطابقت ندارد. ابتدا از حساب خارج شو.');
        }
        var result = await app().api.post({
          action: 'submitMembershipApplication',
          token: member.token,
          phone: phone,
          firstName: firstName,
          lastName: lastName,
          birthDate: birthDate,
          schoolLevel: schoolLevel,
          schoolGrade: schoolGrade,
          guardianName: guardianName,
          guardianPhone: guardianPhone
        });
        var updated = Object.assign({}, member, result.member || {}, { token: member.token, membershipStatus: result.membershipStatus || 'pending' });
        setMember(updated, member.token);
        if (result.alreadyMember || updated.membershipStatus === 'approved') {
          setStatus('عضویتت فعال است ✓', 'حساب تو از قبل عضو تأییدشده حلقه است.', 'success');
          setFormVisible(false);
        } else {
          setStatus('درخواست عضویت ثبت شد ✓', 'درخواستت برای بررسی به مالک حلقه ارسال شد. پس از تأیید، بازی‌ها برایت فعال می‌شوند.', 'success');
        }
      } catch (error) {
        setStatus('ثبت درخواست انجام نشد', error && error.message ? error.message : 'خطای نامشخص؛ دوباره تلاش کن.', 'error');
      } finally {
        submitButton.disabled = false;
        submitButton.textContent = originalText;
      }
    });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initialize);
  else initialize();
})();
