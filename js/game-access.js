(function () {
  'use strict';
  var gate = document.getElementById('gameAccessGate');
  var content = document.getElementById('gameContent');
  function note(text) {
    var el = document.getElementById('gameGateNote');
    if (el && text) el.textContent = text;
  }
  function showGate(text) {
    if (content) content.classList.add('hidden');
    if (gate) gate.classList.remove('hidden');
    note(text || 'برای بازی، درخواست عضویت در حلقه را ثبت کن. پس از تأیید مربی می‌توانی بازی کنی.');
  }
  function showGame() {
    if (gate) gate.classList.add('hidden');
    if (content) content.classList.remove('hidden');
  }
  async function checkMembership() {
    for (var i = 0; i < 100; i++) {
      if (window.KanoonApp && window.KanoonApp.session && window.KanoonApp.api) break;
      await new Promise(function (resolve) { setTimeout(resolve, 50); });
    }
    var app = window.KanoonApp;
    if (!app || !app.session || !app.api) {
      showGate('اتصال به سامانه آماده نشد. صفحه را دوباره بارگذاری کن.');
      return false;
    }
    var member = app.session.getMember();
    if (!member || !member.token) {
      showGate('بازی فقط برای اعضای حلقه است. برای ثبت درخواست عضویت از دکمه زیر استفاده کن.');
      return false;
    }
    try {
      var result = await app.api.get({ action: 'getMyMembershipStatus', token: member.token });
      var status = String(result.membershipStatus || (result.member && result.member.membershipStatus) || '');
      if (status === 'approved') {
        app.session.setMember(Object.assign({}, member, result.member || {}, { membershipStatus: 'approved', token: member.token }));
        showGame();
        return true;
      }
      if (status === 'pending') {
        showGate('درخواست عضویتت ثبت شده و هنوز در انتظار بررسی مربی است.');
      } else if (status === 'rejected') {
        showGate('درخواست قبلی تأیید نشده است. می‌توانی اطلاعاتت را بررسی و دوباره درخواست بدهی.');
      } else {
        showGate('بازی فقط برای اعضای حلقه است. ابتدا درخواست عضویت ثبت کن.');
      }
      return false;
    } catch (error) {
      showGate('وضعیت عضویت بررسی نشد. اتصال اینترنت را بررسی و صفحه را دوباره بارگذاری کن.');
      return false;
    }
  }
  var ready = checkMembership();
  window.CircleGameAccess = { ready: ready, checkMembership: checkMembership };
})();
