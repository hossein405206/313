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
    records: {}, // { memberKey: { maghrib: {status,note}, isha: {status,note} } }
    official: null,
    attendanceLocked: false,
    pendingMembers: []
  };

  /* ══════════════════════════════════════════════════════════════════════
     Render
     ══════════════════════════════════════════════════════════════════════ */

  function recordKey(member) {
    var phone = String(member && member.phone || '').trim();
    return phone || ('member:' + String(member && member.id || 'unknown'));
  }

  function renderMember(member, index) {
    var phone = String(member.phone || '');
    var key = recordKey(member);
    var fullName = (String(member.firstName || '') + ' ' + String(member.lastName || '')).trim();
    if (!fullName) fullName = String(member.name || phone || 'عضو');
    var initial = fullName.charAt(0) || '؟';
    var memberRecords = state.records[key] || {};
    function prayerSection(prayer, label) {
      var rec = memberRecords[prayer] || { status: '', note: '' };
      var presentActive = rec.status === 'present' ? 'active' : '';
      var excusedActive = rec.status === 'excused' ? 'active' : '';
      var absentActive = rec.status === 'absent' ? 'active' : '';
      return '<section class="att-prayer" data-prayer-section="' + prayer + '">'
        + '<h3 class="att-prayer__title">' + label + '</h3>'
        + '<div class="att-item__status" data-prayer="' + prayer + '">'
        + '<button type="button" class="att-status-btn ' + presentActive + '" data-prayer="' + prayer + '" data-status="present"><svg viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"/></svg><span>حاضر</span></button>'
        + '<button type="button" class="att-status-btn ' + excusedActive + '" data-prayer="' + prayer + '" data-status="excused"><svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg><span>موجه</span></button>'
        + '<button type="button" class="att-status-btn ' + absentActive + '" data-prayer="' + prayer + '" data-status="absent"><svg viewBox="0 0 24 24"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg><span>غایب</span></button>'
        + '</div><input type="text" class="att-item__note" data-prayer="' + prayer + '" placeholder="توضیحات ' + label + ' (اختیاری)..." maxlength="500" value="' + escapeHtml(rec.note || '') + '"></section>';
    }
    var hasStatus = ['maghrib','isha'].some(function(p) { return !!(memberRecords[p] && memberRecords[p].status); });
    return '<article class="att-item ' + (hasStatus ? 'has-status' : '') + '" data-phone="' + escapeHtml(phone) + '" data-member-id="' + escapeHtml(member.id || '') + '" data-record-key="' + escapeHtml(key) + '">'
      + '<button type="button" class="att-remove" title="حذف از فهرست فعال" aria-label="غیرفعال‌کردن عضو">×</button>'
      + '<div class="att-item__header"><div class="att-item__avatar">' + escapeHtml(initial) + '</div><div class="att-item__name">' + escapeHtml(fullName) + '</div><div class="att-item__index">' + toPersian(index + 1) + '</div></div>'
      + prayerSection('maghrib', 'نماز مغرب') + prayerSection('isha', 'نماز عشاء') + '</article>';
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
    $$('.att-remove').forEach(function(btn) {
      btn.addEventListener('click', async function() {
        var item = btn.closest('.att-item'), id = item && item.getAttribute('data-member-id');
        if (!id) { toast('شناسه عضو پیدا نشد؛ فهرست را تازه‌سازی کن.', 'error'); return; }
        if (!confirm('این عضو فقط از فهرست فعال خارج و حساب ورودش غیرفعال می‌شود. سوابق حضور و غیاب قبلی او پاک نخواهد شد. ادامه می‌دهی؟')) return;
        var api = getAPI();
        if (!api || !state.official || !state.official.token) { toast('نشست مسئول معتبر نیست؛ دوباره وارد شو.', 'error'); return; }
        btn.disabled = true;
        try {
          await api.post({action:'deleteMember', token:state.official.token, id:id});
          toast('عضو از فهرست فعال خارج شد؛ سوابق قبلی حفظ شد ✓');
          await loadMembers(true);
        } catch (e) {
          btn.disabled = false;
          toast(e.message || 'خطا در حذف عضو از فهرست', 'error');
        }
      });
    });
    $$('.att-item').forEach(function(item) {
      var key = item.getAttribute('data-record-key');
      item.querySelectorAll('.att-item__status').forEach(function(group) {
        group.addEventListener('click', function(e) {
          var btn = e.target.closest('.att-status-btn'); if (!btn) return;
          var prayer = btn.getAttribute('data-prayer'), status = btn.getAttribute('data-status');
          if (['maghrib','isha'].indexOf(prayer) < 0) return;
          if (!state.records[key]) state.records[key] = {};
          if (!state.records[key][prayer]) state.records[key][prayer] = {status:'',note:''};
          if (state.records[key][prayer].status === status) status = '';
          state.records[key][prayer].status = status;
          group.querySelectorAll('.att-status-btn').forEach(function(b) { b.classList.toggle('active', !!status && b === btn); });
          item.classList.toggle('has-status', ['maghrib','isha'].some(function(p) { return !!(state.records[key][p] && state.records[key][p].status); }));
          updateStats();
        });
      });
      item.querySelectorAll('.att-item__note').forEach(function(input) {
        input.addEventListener('input', function() {
          var prayer = input.getAttribute('data-prayer');
          if (!state.records[key]) state.records[key] = {};
          if (!state.records[key][prayer]) state.records[key][prayer] = {status:'',note:''};
          state.records[key][prayer].note = input.value;
        });
      });
    });
  }

  /* ══════════════════════════════════════════════════════════════════════
     Stats
     ══════════════════════════════════════════════════════════════════════ */

  function updateStats() {
    var present=0, excused=0, absent=0, total=state.members.length*2, done=0;
    state.members.forEach(function(member) {
      var recs=state.records[recordKey(member)]||{};
      ['maghrib','isha'].forEach(function(prayer) {
        var rec=recs[prayer]||{}; if(!rec.status)return; done++;
        if(rec.status==='present')present++; else if(rec.status==='excused')excused++; else if(rec.status==='absent')absent++;
      });
    });
    var p=$('#countPresent'),e=$('#countExcused'),a=$('#countAbsent'),progress=$('#saveProgress');
    if(p)p.textContent=toPersian(present); if(e)e.textContent=toPersian(excused); if(a)a.textContent=toPersian(absent);
    if(progress)progress.textContent=toPersian(done)+' از '+toPersian(total);
  }

  /* ══════════════════════════════════════════════════════════════════════
     Filters & Tools
     ══════════════════════════════════════════════════════════════════════ */

  function setupMemberModal() {
    var btn = $('#addMemberBtn');
    var modal = $('#memberModal');
    var form = $('#memberForm');
    var modalApi = window.KanoonApp && window.KanoonApp.modal;
    if (!btn || !modal || !form || !modalApi) return;

    btn.addEventListener('click', function () {
      modalApi.open(modal);
    });

    modal.addEventListener('click', function (e) {
      var closeButton = e.target.closest ? e.target.closest('[data-close-modal]') : null;
      if (e.target === modal || closeButton) modalApi.close(modal);
    });

    form.addEventListener('submit', async function (e) {
      e.preventDefault();
      var api = getAPI();
      var official = state.official;
      if (!api) {
        toast('اتصال به سرور آماده نیست', 'error');
        return;
      }
      if (!official || !official.token) {
        toast('نشست مسئول معتبر نیست؛ دوباره وارد شو', 'error');
        return;
      }

      var submitButton = form.querySelector('button[type="submit"], button:not([type])');
      if (submitButton) {
        submitButton.disabled = true;
        submitButton.textContent = 'در حال افزودن...';
      }

      try {
        await api.post({
          action: 'addMember',
          token: official.token,
          name: $('#memberName').value.trim()
        });
        toast('عضو اضافه شد ✓');
        form.reset();
        modalApi.close(modal);
        await loadMembers();
      } catch (err) {
        toast(err.message || 'خطا در افزودن عضو', 'error');
      } finally {
        if (submitButton) {
          submitButton.disabled = false;
          submitButton.textContent = 'افزودن';
        }
      }
    });
  }

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
        var key = recordKey(state.members[i]);
        if (!state.records[key]) state.records[key] = {};
        ['maghrib','isha'].forEach(function(prayer){if(!state.records[key][prayer])state.records[key][prayer]={status:'',note:''};state.records[key][prayer].status='present';});
      }
      renderList();
      toast('همه اعضا برای هر دو نماز حاضر شدند ✓');
    });
  }

  /* ══════════════════════════════════════════════════════════════════════
     Save
     ══════════════════════════════════════════════════════════════════════ */

  function setupSave() {
    var btn=$('#saveBtn'); if(!btn)return;
    btn.addEventListener('click',async function(){
      var api=getAPI(),official=state.official;
      if(!api){toast('اتصال به سرور آماده نیست','error');return;}
      if(!official||!official.token){toast('اول باید وارد بشی','error');return;}
      var records=[];
      state.members.forEach(function(m){
        var key=recordKey(m),recs=state.records[key]||{};
        var fullName=(String(m.firstName||'')+' '+String(m.lastName||'')).trim()||String(m.name||m.phone||'عضو');
        ['maghrib','isha'].forEach(function(prayer){
          var rec=recs[prayer];if(!rec||!rec.status)return;
          var statusFa=rec.status==='excused'?'موجه':(rec.status==='absent'?'غیبت':'حاضر');
          records.push({memberId:m.id,memberName:fullName,prayer:prayer,status:statusFa,note:rec.note||''});
        });
      });
      if(records.length!==state.members.length*2){toast('برای هر عضو، وضعیت نماز مغرب و نماز عشاء را جداگانه انتخاب کن.','error');return;}
      if(!records.length){toast('هیچ وضعیتی ثبت نکردی','error');return;}
      btn.disabled=true;var label=btn.querySelector('span'),oldText=label?label.textContent:'ذخیره';if(label)label.textContent='در حال ذخیره...';
      try{
        await api.post({action:'saveAttendanceBatch',token:official.token,records:records});
        state.attendanceLocked=true;toast('حضور و غیاب نماز مغرب و عشاء ذخیره شد ✓؛ سوابق قبلی حفظ می‌شوند.');
        await loadMembers();
      }catch(err){console.error(err);toast(err.message||'خطا در ذخیره','error');}
      finally{btn.disabled=false;if(label)label.textContent=oldText;}
    });
  }

  /* ══════════════════════════════════════════════════════════════════════
     Load Members
     ══════════════════════════════════════════════════════════════════════ */

  function updateAttendanceNotice() {
    var notice = $('#attendanceSavedNotice');
    if (!notice) {
      notice = document.createElement('div');
      notice.id = 'attendanceSavedNotice';
      notice.className = 'attendance-saved-notice';
      var list = $('#attendanceList');
      if (list && list.parentNode) list.parentNode.insertBefore(notice, list);
    }
    if (!notice) return;
    notice.textContent = state.attendanceLocked
      ? 'حضور و غیاب امروز قبلاً ثبت شده است؛ پنل همچنان در دسترس است و می‌توانی وضعیت‌ها را اصلاح و دوباره ذخیره کنی.'
      : '';
    notice.style.display = state.attendanceLocked ? 'block' : 'none';
  }

  async function loadMembers(preserveLocal) {
    var localRecords = state.records;
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
      var res = await api.post({
        action: 'listMembers',
        token: official.token
      });
      state.members = res.items || [];
      state.records = preserveLocal ? localRecords : {};
      state.attendanceLocked = false;
      try {
        var today = await api.post({ action: 'getAttendanceToday', token: official.token });
        state.attendanceLocked = !!today.locked;
        (today.items || []).forEach(function(saved) {
          var member = state.members.find(function(m) { return String(m.id) === String(saved.memberId); });
          if (!member) return;
          var status = saved.status === 'حاضر' ? 'present' : (saved.status === 'موجه' ? 'excused' : (saved.status === 'غیبت' || saved.status === 'غایب' ? 'absent' : ''));
          var prayer = saved.prayer === 'isha' ? 'isha' : 'maghrib';
          var key = recordKey(member);
          if (!state.records[key]) state.records[key] = {};
          if (!preserveLocal || !state.records[key][prayer]) state.records[key][prayer] = {status:status,note:saved.note||''};
        });
      } catch (statusError) {
        console.warn('Could not load today attendance state', statusError);
      }
      updateAttendanceNotice();
      renderList();
    } catch (err) {
      console.error(err);
      if (list) list.innerHTML = '<div class="empty"><p>بارگذاری اعضا ناموفق بود</p><small>'+escapeHtml(err.message||'خطای نامشخص')+'</small></div>';
    }
  }

  /* ══════════════════════════════════════════════════════════════════════
     Pending member approvals
     ══════════════════════════════════════════════════════════════════════ */

  function setupPendingApprovals() {
    var refresh = $('#refreshPendingMembers');
    if (refresh) refresh.addEventListener('click', loadPendingMembers);
    loadPendingMembers();
  }

  async function loadPendingMembers() {
    var status = $('#pendingMembersStatus'), list = $('#pendingMembersList'), api = getAPI();
    if (!status || !list) return;
    if (!api || !state.official || !state.official.token) {
      status.textContent = 'برای مشاهدهٔ درخواست‌ها باید با کد مسئول حضور و غیاب وارد شوی.';
      list.textContent = '';
      return;
    }
    status.textContent = 'در حال دریافت درخواست‌ها…';
    list.textContent = '';
    try {
      var result = await api.post({action:'listPendingMembers', token:state.official.token});
      state.pendingMembers = result.items || [];
      if (!state.pendingMembers.length) {
        status.textContent = 'در حال حاضر درخواست تأییدنشده‌ای وجود ندارد.';
        return;
      }
      status.textContent = 'برای هر درخواست، اطلاعات فرد را حضوری بررسی کن و سپس تأیید یا رد را انتخاب کن.';
      state.pendingMembers.forEach(function(member) {
        var card = document.createElement('article'); card.className = 'pending-member-card';
        var info = document.createElement('div'); info.className = 'pending-member-card__info';
        var name = document.createElement('strong'); name.textContent = member.name || 'بدون نام';
        var phone = document.createElement('span'); phone.textContent = member.phone || 'شماره ثبت نشده';
        var date = document.createElement('small'); date.textContent = member.createdAt ? ('ثبت درخواست: ' + String(member.createdAt).slice(0,10)) : 'تاریخ ثبت نامشخص';
        info.appendChild(name); info.appendChild(phone); info.appendChild(date);
        var actions = document.createElement('div'); actions.className = 'pending-member-card__actions';
        var approve = document.createElement('button'); approve.type = 'button'; approve.className = 'pending-approve'; approve.textContent = 'تأیید حضوری';
        approve.addEventListener('click', function(){ reviewPendingMember_(member, 'approve', approve); });
        var reject = document.createElement('button'); reject.type = 'button'; reject.className = 'pending-reject'; reject.textContent = 'رد درخواست';
        reject.addEventListener('click', function(){ reviewPendingMember_(member, 'reject', reject); });
        actions.appendChild(approve); actions.appendChild(reject); card.appendChild(info); card.appendChild(actions); list.appendChild(card);
      });
    } catch (err) {
      status.textContent = err.message || 'دریافت درخواست‌ها ناموفق بود.';
    }
  }

  async function reviewPendingMember_(member, action, button) {
    if (action === 'approve' && !confirm('تأیید می‌کنی که هویت این فرد را حضوری بررسی کرده‌ای؟')) return;
    if (action === 'reject' && !confirm('درخواست عضویت این فرد رد شود؟ در صورت تلاش دوباره، درخواست تازه‌ای برای بررسی ثبت می‌کند.')) return;
    var api = getAPI(); if (!api || !state.official || !state.official.token) return;
    var card = button.closest('.pending-member-card');
    var buttons = card ? card.querySelectorAll('button') : [button];
    Array.prototype.forEach.call(buttons, function(b){b.disabled=true;});
    try {
      await api.post({action:action==='approve'?'approveMember':'rejectPendingMember',token:state.official.token,id:member.id});
      toast(action==='approve'?'حساب عضو تأیید و فعال شد.':'درخواست عضویت رد شد.');
      await loadPendingMembers();
      await loadMembers();
    } catch (err) {
      toast(err.message || 'ثبت تصمیم ناموفق بود.','error');
      Array.prototype.forEach.call(buttons, function(b){b.disabled=false;});
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
    setupPendingApprovals();
    setupMemberModal();
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
