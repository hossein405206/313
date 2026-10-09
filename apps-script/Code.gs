/* ============================================================================
   313 / حلقه شهید هادی ذوالفقاری
   Google Apps Script Backend v4
   ----------------------------------------------------------------------------
   این فایل را داخل Google Apps Script پروژه‌ی backend قرار بده.

   قبل از Deploy:
   1) SPREADSHEET_ID را وارد کن
   2) DRIVE_FOLDER_ID را وارد کن
   3) تابع setup() را یک بار اجرا کن
   4) کدهای پیش‌فرض ساخته‌شده در شیت «مسئولین» و «مربیان» را عوض کن
   5) Deploy > Manage deployments > ویرایش Deployment فعلی > انتخاب نسخه جدید > Deploy
      Execute as: Me
      Who has access: Anyone
   6) برای انتشار نهایی، یک Deployment جدید بساز و URL همان Deployment را در js/main.js قرار بده

   ساختار داده‌ها در Google Sheets:
   تنظیمات، مربیان، مسئولین، اعضا، رویدادها، اردوها،
   ثبت‌نام‌ها، حضورغیاب، اخطارها، بازی
   ============================================================================ */

var CFG = {
  SPREADSHEET_ID: '181xhlPLXByFjDRqos0pSi7K-iUsN8MUxTacTtzFTh4U',
  DRIVE_FOLDER_ID: '1D0UJh3swn-wXDfn0rGORpZh9hWqO00xd',
  TIMEZONE: 'Asia/Tehran',
  TOKEN_TTL_MS: 1000 * 60 * 60 * 12,
  DEFAULT_GAME_PRIZE: 'به بیشترین رکورد هفته جایزه داده می شود',
  MASTER_COACH_NAME: 'مربی ارشد'
};

// Credentials are stored in Script Properties, never in the public repository.
function getMasterCoachConfig() {
  var props = PropertiesService.getScriptProperties();
  return {
    phone: normalizeIranDigits(String(props.getProperty('MASTER_COACH_PHONE') || '')).replace(/\s+/g, ''),
    code: String(props.getProperty('MASTER_COACH_CODE') || '').trim(),
    name: String(props.getProperty('MASTER_COACH_NAME') || CFG.MASTER_COACH_NAME).trim() || CFG.MASTER_COACH_NAME
  };
}

var HEADERS = {
  'تنظیمات': ['key','value'],
  'مربیان': ['code','name','phone','active','role','permissions','createdAt','updatedAt'],
  'مسئولین': ['code','name','role','active','createdAt'],
  'اعضا': ['id','firstName','lastName','name','phone','nickname','profileCompleted','bestScore','active','createdAt'],
  'رویدادها': ['id','title','description','imageUrl','imageId','label','date','active','sort','createdAt','updatedAt'],
  'اردوها': ['id','title','status','createdAt'],
  'ثبت‌نام‌ها': ['id','campId','firstName','lastName','fatherName','fatherPhone','phone','nationalCode','photoUrl','status','createdAt','updatedAt'],
  'حضورغیاب': ['date','memberId','memberName','status','note','officialCode','createdAt'],
  'اخطارها': ['date','responsibility','memberId','memberName','reason','officialCode','createdAt'],
  'بازی': ['weekKey','memberId','playerName','score','updatedAt'],
  'برنامه': ['id','day','title','time','location','active','sort','createdAt','updatedAt'],
  'بازخوردها': ['id','name','phone','category','message','status','createdAt']
};

/* -------------------------------------------------------------------------- */
/* HTTP                                                                      */
/* -------------------------------------------------------------------------- */

function doGet(e) {
  var p = (e && e.parameter) || {};
  try {
    return json(handleGet(p));
  } catch (err) {
    return json({ ok: false, error: safeError(err) });
  }
}

function doPost(e) {
  try {
    var raw = e && e.postData ? e.postData.contents : '{}';
    var p = JSON.parse(raw || '{}');
    return json(handlePost(p));
  } catch (err) {
    return json({ ok: false, error: safeError(err) });
  }
}

function json(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

function safeError(err) {
  return err && err.message ? err.message : String(err);
}

/* -------------------------------------------------------------------------- */
/* Setup                                                                      */
/* -------------------------------------------------------------------------- */

function listSchedulePublic(){
  var rows=getSheetObjects('برنامه').filter(function(x){return String(x.active).toLowerCase()!=='false';});
  rows.sort(function(a,b){return Number(a.sort||0)-Number(b.sort||0);});
  return {items:rows};
}
function saveSchedule(p){
  requireCoachPermission(p.token,'schedule');
  var sheet=getSheet('برنامه'), id=String(p.id||Utilities.getUuid()), rows=getSheetObjects('برنامه'), pos=findRowById('برنامه',id);
  var obj={id:id,day:String(p.day||'').trim(),title:String(p.title||'').trim(),time:String(p.time||'').trim(),location:String(p.location||'').trim(),active:p.active!==false,sort:Number(p.sort||0),createdAt:new Date().toISOString(),updatedAt:new Date().toISOString()};
  if(!obj.day||!obj.title)throw new Error('روز و عنوان برنامه الزامی است');
  if(pos){var old=rows[pos-2];obj.createdAt=old.createdAt||obj.createdAt;sheet.getRange(pos,1,1,HEADERS['برنامه'].length).setValues([rowToArray('برنامه',obj)]);}else sheet.appendRow(rowToArray('برنامه',obj));
  return {item:obj};
}
function deleteSchedule(p){requireCoachPermission(p.token,'schedule');var pos=findRowById('برنامه',String(p.id||''));if(!pos)throw new Error('برنامه پیدا نشد');getSheet('برنامه').deleteRow(pos);return {deleted:true};}
function setup() {
  var ss = getSS();
  Object.keys(HEADERS).forEach(function(name) {
    var sh = ensureSheet(ss, name, HEADERS[name]);
    migrateSheetHeaders(sh, name);
  });

  var settings = getSheet('تنظیمات');
  if (!findRow(settings, 'key', 'gamePrize')) {
    settings.appendRow(['gamePrize', CFG.DEFAULT_GAME_PRIZE]);
  }

  var coaches = getSheet('مربیان');
  migrateSheetHeaders(coaches, 'مربیان');
  ensureMasterCoach();
  normalizeCoachRecords();
  ensureOfficialRoles();

  var officials = getSheet('مسئولین');
  if (officials.getLastRow() < 2) {
    officials.appendRow(['ATT-GUIDE-CHANGE-ME', 'مسئول حضور و غیاب راهنمایی', 'حضور و غیاب - راهنمایی', true, nowIso()]);
    officials.appendRow(['ATT-ELEMENTARY-CHANGE-ME', 'مسئول حضور و غیاب دبستان', 'حضور و غیاب - دبستان', true, nowIso()]);
    officials.appendRow(['SUP-CHANGE-ME', 'مسئول نظارت', 'نظارت', true, nowIso()]);
  }

  var camps = getSheet('اردوها');
  if (camps.getLastRow() < 2) {
    camps.appendRow([uid('CAMP'), 'اردوی مشهد', 'active', nowIso()]);
  }

  ensureLifetimeGameRecords();
  ensureSecret();

  return { ok: true, message: 'راه‌اندازی اولیه انجام شد' };
}

/* -------------------------------------------------------------------------- */
/* GET Actions                                                                */
/* -------------------------------------------------------------------------- */

function handleGet(p) {
  var action = String(p.action || 'ping');

  if (action === 'ping') return { ok: true, service: '313', version: '4.0.0-coach-auth', diagnostic: 'COACH_AUTH_DIAGNOSTIC_20261003' };

  if (action === 'coachStatus') {
    var masterConfig = getMasterCoachConfig();
    return { ok: true, service: '313', version: '4.1.0', masterConfigured: !!(masterConfig.phone && masterConfig.code) };
  }

  if (action === 'listEvents' || action === 'listActivities') {
    return { ok: true, items: listEventsPublic() };
  }

  if (action === 'listSchedule') { return listSchedulePublic(); }

  if (action === 'listCoaches') {
    var coachAuthGet = requireToken(p.token, ['coach']);
    if (!coachAuthGet.isMaster) throw new Error('فقط مربی ارشد به فهرست مربیان دسترسی دارد');
    return { ok: true, items: listCoachRecords() };
  }

  if (action === 'listOfficialsManage') {
    var officialManageAuth = requireToken(p.token, ['coach']);
    if (!officialManageAuth.isMaster) throw new Error('فقط مربی ارشد می‌تواند مسئولین را مدیریت کند');
    return { ok:true, items:listOfficialRecords() };
  }

  if (action === 'listCamps') {
    return { ok: true, items: listCamps() };
  }

  if (action === 'listOfficials') {
    return {
      ok: true,
      items: getSheetObjects('مسئولین')
        .filter(function(r){ return truthy(r.active); })
        .map(function(r){
          return { name: r.name, role: r.role, type: 'official' };
        })
    };
  }

  if (action === 'verifyOfficialCode') {
    var official = verifyOfficialCode(String(p.code || '').trim().toUpperCase());
    if (!official) throw new Error('کد مسئولیت نامعتبر است');
    return { ok: true, official: officialPublic(official), token: issueToken(official.roleCode, official.code) };
  }

  if (action === 'verifyCoachCode') {
    var coach = verifyCoachCode(String(p.code || '').trim().toUpperCase());
    if (!coach) throw new Error('کد مربی نامعتبر است');
    return { ok: true, coach: { name: coach.name, role: coach.role, isMaster: coach.isMaster, permissions: coachPermissions(coach) }, token: issueToken('coach', coach.code, coach.isMaster, coachPermissions(coach)) };
  }

  if (action === 'listMembers') {
    var auth = requireToken(p.token, ['attendance','coach']);
    return { ok: true, items: listActiveMembers(), role: auth.role };
  }

  if (action === 'getAttendanceToday') {
    requireToken(p.token, ['attendance']);
    var date = currentDate();
    return {
      ok: true,
      date: date,
      locked: hasAttendanceDate(date),
      items: attendanceForDate(date)
    };
  }

  if (action === 'listMonthlyAttendance') {
    requireCoachPermission(p.token, 'reports');
    var month = String(p.month || currentMonth());
    if (month !== currentMonth()) throw new Error('مربی فقط به اطلاعات ماه جاری دسترسی دارد');
    return {
      ok: true,
      month: month,
      items: attendanceForMonth(month)
    };
  }

  if (action === 'listWarnings') {
    var warnAuth = requireCoachPermission(p.token, 'reports');
    var requestedMonth = String(p.month || currentMonth());
    if (requestedMonth !== currentMonth()) {
      throw new Error('فقط اطلاعات ماه جاری قابل مشاهده است');
    }
    return {
      ok: true,
      month: requestedMonth,
      items: warningsForMonth(requestedMonth),
      role: warnAuth.role
    };
  }

  if (action === 'listRegistrations') {
    if (!p.token) throw new Error('نشست معتبر نیست');
    var registrationAuth = requireToken(p.token, ['coach', 'member']);
    var registrations = getSheetObjects('ثبت‌نام‌ها');
    if (registrationAuth.role === 'coach') {
      requireCoachPermission(p.token, 'registrations');
      return { ok: true, items: registrations.sort(byNewest) };
    }
    return {
      ok: true,
      items: registrations
        .filter(function(r){ return String(r.phone || '') === String(registrationAuth.subject || ''); })
        .sort(byNewest)
    };
  }

  if (action === 'getDashboard') { var dashAuth=requireToken(p.token,['coach']); var dash=dashboardData(dashAuth); dash.isMaster=!!dashAuth.isMaster; dash.permissions=dashAuth.isMaster?allCoachPermissions():dashAuth.permissions; return dash; }

  if (action === 'getGameData') {
    var week = currentWeekKey();
    var prize = getSetting('gamePrize') || CFG.DEFAULT_GAME_PRIZE;
    return {
      ok: true,
      weekKey: week,
      prize: prize,
      leaderboard: leaderboardForWeek(week),
      previousWinner: previousWinner(),
      allTimeLeaderboard: allTimeLeaderboard()
    };
  }

  return { ok: false, error: 'عملیات شناخته نشد: ' + action };
}

/* -------------------------------------------------------------------------- */
/* POST Actions                                                               */
/* -------------------------------------------------------------------------- */

function handlePost(p) {
  var action = String(p.action || '');

  if (action === 'registerMember') { return registerMember(p); }
  if (action === 'loginCoach') { return loginCoach(p); }
  if (action === 'addCoach') { return addCoach(p); }
  if (action === 'listCoaches') {
    var coachAuth = requireToken(p.token, ['coach']);
    if (!coachAuth.isMaster) throw new Error('فقط مربی ارشد به فهرست مربیان دسترسی دارد');
    return { ok:true, items:listCoachRecords() };
  }
  if (action === 'updateCoach') return updateCoach(p);
  if (action === 'setCoachStatus') return setCoachStatus(p);
  if (action === 'updateCoachCode') return updateCoachCode(p);
  if (action === 'addOfficial') return addOfficial(p);
  if (action === 'updateOfficial') return updateOfficial(p);
  if (action === 'setOfficialStatus') return setOfficialStatus(p);
  if (action === 'generateLoginCode') { return generateLoginCode(String(p.phone || '').trim()); }

  if (action === 'verifyLoginCode') {
    return verifyLoginCode(String(p.phone || '').trim(), String(p.code || '').trim());
  }

  if (action === 'updateMember') {
    requireToken(p.token, ['member']);
    return updateMember(p);
  }

  if (action === 'registerCamp') {
    return registerCamp(p);
  }

  if (action === 'uploadEventImage') {
    requireCoachPermission(p.token, 'events');
    return uploadEventImage(p);
  }

  if (action === 'saveEvent') {
    requireCoachPermission(p.token, 'events');
    return saveEvent(p);
  }

  if (action === 'deleteEvent') {
    requireCoachPermission(p.token, 'events');
    return deleteEvent(String(p.id || ''));
  }

  if (action === 'setRegistrationStatus') {
    requireCoachPermission(p.token, 'registrations');
    return setRegistrationStatus(p);
  }

  if (action === 'addMember') {
    requireToken(p.token, ['attendance']);
    return addMember(p);
  }

  if (action === 'deleteMember') {
    requireToken(p.token, ['attendance']);
    return deleteMember(String(p.id || ''));
  }

  if (action === 'saveAttendanceBatch') {
    requireToken(p.token, ['attendance']);
    return saveAttendanceBatch(p);
  }

  if (action === 'saveWarning') {
    requireToken(p.token, ['supervision']);
    return saveWarning(p);
  }

  if (action === 'saveGamePrize') {
    requireCoachPermission(p.token, 'game');
    return saveGamePrize(String(p.prize || '').trim());
  }

  if (action === 'submitGameScore') {
    return submitGameScore(p);
  }
  if (action === 'feedback') { return submitFeedback(p); }

  throw new Error('عملیات شناخته نشد: ' + action);
}

/* -------------------------------------------------------------------------- */
/* Auth                                                                       */
/* -------------------------------------------------------------------------- */

function verifyOfficialCode(code) {
  var rows = getSheetObjects('مسئولین');
  for (var i = 0; i < rows.length; i++) {
    var r = rows[i];
    if (truthy(r.active) && String(r.code).toUpperCase() === code) {
      var roleKey = normalizeRole(String(r.role || ''));
      return {
        code: String(r.code),
        name: String(r.name || ''),
        role: String(r.role || ''),
        roleCode: roleKey
      };
    }
  }
  return null;
}

function verifyCoachCode(code) {
  var rows=getSheetObjects('مربیان');
  for(var i=0;i<rows.length;i++){
    var r=rows[i];
    // مربی ارشد باید از مسیر loginCoach و با شماره + کد احراز شود؛ کد تنها کافی نیست.
    if(String(r.role||'')==='master')continue;
    if(!truthy(r.active)||String(r.code||'').toUpperCase()!==String(code||'').toUpperCase())continue;
    return {code:String(r.code),name:String(r.name||''),phone:String(r.phone||''),role:String(r.role||'coach'),isMaster:false};
  }
  return null;
}
function loginCoach(p){
  var phone=normalizeIranDigits(String(p.phone||'').trim()).replace(/\s+/g,'');
  var code=String(p.code||'').trim();
  if(!/^09\d{9}$/.test(phone)) throw new Error('شماره مربی نامعتبر است');
  if(!code) throw new Error('کد مربی را وارد کن');

  // مربی ارشد مستقیماً از تنظیمات اصلی احراز می‌شود؛
  // بنابراین ورود به وجود ردیف شیت مربیان وابسته نیست.
  var masterConfig = getMasterCoachConfig();
  if(masterConfig.phone && masterConfig.code && phone===masterConfig.phone && code===masterConfig.code){
    ensureMasterCoach();
    return {
      ok:true,
      coach:{name:masterConfig.name,phone:masterConfig.phone,role:'master',isMaster:true,permissions:allCoachPermissions()},
      token:issueToken('coach',masterConfig.code,true,allCoachPermissions())
    };
  }

  var coachSheet=getSheet('مربیان');
  migrateSheetHeaders(coachSheet,'مربیان');
  var rows=getSheetObjects('مربیان');
  var coach=rows.filter(function(r){
    var rowPhone=normalizeIranDigits(String(r.phone||'').trim()).replace(/\s+/g,'');
    var rowCode=String(r.code||'').trim();
    return truthy(r.active)&&rowPhone===phone&&rowCode===code&&(String(r.role||'')!=='master'||(masterConfig.phone===phone&&masterConfig.code===code));
  })[0];

  if(!coach) throw new Error('شماره یا کد مربی نادرست است');
  var isMaster=String(coach.role||'')==='master';
  return {
    ok:true,
    coach:{name:coach.name,phone:phone,role:coach.role,isMaster:isMaster,permissions:coachPermissions(coach)},
    token:issueToken('coach',coach.code,isMaster,coachPermissions(coach))
  };
}
function ensureMasterCoach(){
  var config=getMasterCoachConfig();
  if(!config.phone||!config.code)return;
  var rows=getSheetObjects('مربیان');
  var found=rows.some(function(r){return String(normalizeIranDigits(r.phone||'')).replace(/\s+/g,'')===config.phone&&String(r.code||'').trim()===config.code&&String(r.role||'')==='master';});
  if(!found)getSheet('مربیان').appendRow([config.code,config.name,config.phone,true,'master',JSON.stringify(allCoachPermissions()),nowIso(),nowIso()]);
}
function normalizeIranDigits(value){
  return String(value||'')
    .replace(/[۰-۹]/g,function(c){return String('۰۱۲۳۴۵۶۷۸۹'.indexOf(c));})
    .replace(/[٠-٩]/g,function(c){return String('٠١٢٣٤٥٦٧٨٩'.indexOf(c));});
}
function addCoach(p){
  var auth=requireToken(p.token,['coach']); if(!auth.isMaster)throw new Error('فقط مربی ارشد می‌تواند مربی اضافه کند');
  var name=String(p.name||'').trim(),phone=String(p.phone||'').trim(),code=String(p.code||'').trim();
  if(!name)throw new Error('نام مربی را وارد کن'); if(!/^09\d{9}$/.test(phone))throw new Error('شماره مربی نامعتبر است'); if(!code)throw new Error('کد مربی را وارد کن');
  var rows=getSheetObjects('مربیان');
  if(rows.some(function(r){return String(normalizeIranDigits(r.phone||'')).replace(/\s+/g,'')===phone;}))throw new Error('این شماره قبلاً ثبت شده');
  if(rows.some(function(r){return String(r.code||'').trim().toUpperCase()===code.toUpperCase();}))throw new Error('این کد قبلاً استفاده شده');
  getSheet('مربیان').appendRow([code,name,phone,true,'admin',JSON.stringify(normalizePermissions(p.permissions)),nowIso(),nowIso()]);
  return {ok:true,coach:{name:name,phone:phone,role:'coach',isMaster:false}};
}

function allCoachPermissions() {
  return { events:true, schedule:true, registrations:true, reports:true, game:true, coaches:true, officials:true };
}
function normalizePermissions(value) {
  var base = { events:false, schedule:false, registrations:false, reports:false, game:false, coaches:false, officials:false };
  if (typeof value === 'string') {
    try { value = JSON.parse(value || '{}'); } catch (e) { value = {}; }
  }
  value = value || {};
  Object.keys(base).forEach(function(k){ base[k] = value[k] === true || String(value[k]).toLowerCase() === 'true'; });
  return base;
}
function coachPermissions(row) {
  if (String(row.role || '') === 'master') return allCoachPermissions();
  return normalizePermissions(row.permissions);
}
function listCoachRecords() {
  normalizeCoachRecords();
  return getSheetObjects('مربیان').map(function(r){
    return {
      name:String(r.name||''), phone:String(r.phone||''), code:String(r.code||''),
      role:String(r.role||'admin'), active:truthy(r.active),
      permissions:coachPermissions(r), createdAt:r.createdAt||'', updatedAt:r.updatedAt||''
    };
  });
}
function normalizeCoachRecords() {
  var sheet=getSheet('مربیان'), rows=sheet.getDataRange().getValues();
  if(rows.length<2)return;
  var headers=rows[0].map(String), idx={};
  headers.forEach(function(h,i){idx[h]=i;});
  var seenPhone={}, seenCode={}, masterKept=false, changed=false;
  for(var i=1;i<rows.length;i++){
    var phone=String(rows[i][idx.phone]||'').replace(/\s+/g,'');
    var code=String(rows[i][idx.code]||'').trim().toUpperCase();
    var isMaster=String(rows[i][idx.role]||'')==='master';
    var duplicate=(phone && seenPhone[phone]) || (code && seenCode[code]);
    if(isMaster && masterKept) duplicate=true;
    if(duplicate && truthy(rows[i][idx.active])) { rows[i][idx.active]=false; changed=true; continue; }
    if(phone)seenPhone[phone]=true;
    if(code)seenCode[code]=true;
    if(isMaster)masterKept=true;
    if(idx.permissions!==undefined){
      if(!String(rows[i][idx.permissions]||'').trim() && String(rows[i][idx.role]||'')!=='master') rows[i][idx.permissions]=JSON.stringify({events:true,schedule:true,registrations:true,reports:true,game:true,coaches:false,officials:false});
      var normalized=JSON.stringify(coachPermissions(rowToObject('مربیان',rows[i])));
      if(String(rows[i][idx.permissions]||'')!==normalized){rows[i][idx.permissions]=normalized;changed=true;}
    }
  }
  if(changed) sheet.getRange(1,1,rows.length,headers.length).setValues(rows);
}
function requireCoachPermission(token, permission) {
  var auth=requireToken(token,['coach']);
  if(auth.isMaster)return auth;
  if(!auth.permissions || auth.permissions[permission] !== true) throw new Error('دسترسی این بخش برای شما فعال نیست');
  return auth;
}
function findCoachRowByCode(code) {
  return findRow(getSheet('مربیان'),'code',String(code||''));
}
function updateCoach(p) {
  var auth=requireToken(p.token,['coach']); if(!auth.isMaster)throw new Error('فقط مربی ارشد می‌تواند مربیان را ویرایش کند');
  var oldCode=String(p.oldCode||'').trim(); var pos=findCoachRowByCode(oldCode); if(!pos)throw new Error('مربی پیدا نشد');
  var sheet=getSheet('مربیان'), rows=sheet.getDataRange().getValues(), headers=rows[0].map(String), row=rows[pos-1], idx={};
  headers.forEach(function(h,i){idx[h]=i;});
  if(String(row[idx.role]||'')==='master')throw new Error('مربی ارشد قابل ویرایش از این بخش نیست');
  var name=String(p.name||'').trim(), phone=normalizeIranDigits(String(p.phone||'').trim()).replace(/\s+/g,''), code=String(p.code||'').trim();
  if(!name)throw new Error('نام مربی را وارد کن'); if(!/^09\d{9}$/.test(phone))throw new Error('شماره مربی نامعتبر است'); if(!code)throw new Error('کد مربی را وارد کن');
  for(var i=1;i<rows.length;i++){if(i===pos-1)continue;var rr=rows[i];if(String(normalizeIranDigits(rr[idx.phone]||'')).replace(/\s+/g,'')===phone)throw new Error('این شماره قبلاً ثبت شده');if(String(rr[idx.code]||'').trim().toUpperCase()===code.toUpperCase())throw new Error('این کد قبلاً استفاده شده');}
  row[idx.name]=name; row[idx.phone]=phone; row[idx.code]=code; row[idx.permissions]=JSON.stringify(normalizePermissions(p.permissions)); row[idx.updatedAt]=nowIso();
  sheet.getRange(pos,1,1,headers.length).setValues([row]); return {ok:true,item:{name:name,phone:phone,code:code,role:'admin',active:truthy(row[idx.active]),permissions:normalizePermissions(p.permissions)}};
}
function setCoachStatus(p) {
  var auth=requireToken(p.token,['coach']); if(!auth.isMaster)throw new Error('فقط مربی ارشد می‌تواند وضعیت مربیان را تغییر دهد');
  var pos=findCoachRowByCode(String(p.code||'').trim()); if(!pos)throw new Error('مربی پیدا نشد');
  var sheet=getSheet('مربیان'), headers=sheet.getDataRange().getValues()[0].map(String), idx={}; headers.forEach(function(h,i){idx[h]=i;});
  var row=sheet.getRange(pos,1,1,headers.length).getValues()[0]; if(String(row[idx.role]||'')==='master')throw new Error('مربی ارشد قابل اخراج نیست');
  row[idx.active]=p.active===true || String(p.active).toLowerCase()==='true'; row[idx.updatedAt]=nowIso(); sheet.getRange(pos,1,1,headers.length).setValues([row]);
  return {ok:true,active:truthy(row[idx.active])};
}
function updateCoachCode(p) {
  var auth=requireToken(p.token,['coach']); if(!auth.isMaster)throw new Error('فقط مربی ارشد می‌تواند کد را تغییر دهد');
  var pos=findCoachRowByCode(String(p.oldCode||'').trim()); if(!pos)throw new Error('مربی پیدا نشد');
  var newCode=String(p.code||'').trim(); if(!newCode)throw new Error('کد جدید را وارد کن');
  var rows=getSheetObjects('مربیان'); if(rows.some(function(r){return String(r.code||'').trim().toUpperCase()===newCode.toUpperCase() && String(r.code||'').trim()!==String(p.oldCode||'').trim();}))throw new Error('این کد قبلاً استفاده شده');
  var sheet=getSheet('مربیان'), headers=sheet.getDataRange().getValues()[0].map(String), ci=headers.indexOf('code'), ui=headers.indexOf('updatedAt'); var row=sheet.getRange(pos,1,1,headers.length).getValues()[0]; if(String(row[headers.indexOf('role')]||'')==='master')throw new Error('کد مربی ارشد قابل تغییر نیست'); row[ci]=newCode; row[ui]=nowIso(); sheet.getRange(pos,1,1,headers.length).setValues([row]); return {ok:true,code:newCode};
}
function ensureOfficialRoles() {
  var sheet=getSheet('مسئولین'), rows=getSheetObjects('مسئولین');
  var roles=['حضور و غیاب - راهنمایی','حضور و غیاب - دبستان','نظارت'];
  roles.forEach(function(role){
    var exists=rows.some(function(r){return truthy(r.active)&&String(r.role||'')===role;});
    if(!exists){
      var prefix=role.indexOf('راهنمایی')>=0?'ATT-GUIDE':role.indexOf('دبستان')>=0?'ATT-ELEMENTARY':'SUP';
      sheet.appendRow([prefix+'-'+Utilities.getUuid().split('-')[0].toUpperCase(),'مسئول '+role,role,true,nowIso()]);
    }
  });
}
function listOfficialRecords() {
  return getSheetObjects('مسئولین').map(function(r){return {code:String(r.code||''),name:String(r.name||''),role:String(r.role||''),active:truthy(r.active),createdAt:r.createdAt||''};});
}
function addOfficial(p) {
  var auth=requireToken(p.token,['coach']); if(!auth.isMaster)throw new Error('فقط مربی ارشد می‌تواند مسئول اضافه کند');
  var code=String(p.code||'').trim(),name=String(p.name||'').trim(),role=String(p.role||'').trim();
  if(!code||!name||!role)throw new Error('نام، کد و نوع مسئولیت الزامی است');
  if(['حضور و غیاب - راهنمایی','حضور و غیاب - دبستان','نظارت'].indexOf(role)<0)throw new Error('نوع مسئولیت نامعتبر است');
  var existingOfficials=getSheetObjects('مسئولین'); if(existingOfficials.some(function(r){return String(r.code||'').trim().toUpperCase()===code.toUpperCase();}))throw new Error('این کد قبلاً استفاده شده'); if(existingOfficials.some(function(r){return truthy(r.active)&&String(r.role||'')===role;}))throw new Error('برای این نوع مسئولیت یک مسئول فعال از قبل وجود دارد؛ همان را ویرایش یا غیرفعال کن');
  getSheet('مسئولین').appendRow([code,name,role,true,nowIso()]); return {ok:true};
}
function updateOfficial(p) {
  var auth=requireToken(p.token,['coach']); if(!auth.isMaster)throw new Error('فقط مربی ارشد می‌تواند مسئولین را ویرایش کند');
  var oldCode=String(p.oldCode||'').trim(), pos=findRow(getSheet('مسئولین'),'code',oldCode); if(!pos)throw new Error('مسئول پیدا نشد');
  var code=String(p.code||'').trim(),name=String(p.name||'').trim(),role=String(p.role||'').trim();
  if(!code||!name||!role)throw new Error('نام، کد و نوع مسئولیت الزامی است');
  var rows=getSheetObjects('مسئولین'); if(rows.some(function(r){return String(r.code||'').trim().toUpperCase()===code.toUpperCase() && String(r.code||'').trim()!==oldCode;}))throw new Error('این کد قبلاً استفاده شده');
  var sheet=getSheet('مسئولین'), headers=sheet.getDataRange().getValues()[0].map(String), vals=sheet.getRange(pos,1,1,headers.length).getValues()[0]; vals[0]=code;vals[1]=name;vals[2]=role;sheet.getRange(pos,1,1,headers.length).setValues([vals]); return {ok:true};
}
function setOfficialStatus(p) {
  var auth=requireToken(p.token,['coach']); if(!auth.isMaster)throw new Error('فقط مربی ارشد می‌تواند وضعیت مسئولین را تغییر دهد');
  var pos=findRow(getSheet('مسئولین'),'code',String(p.code||'')); if(!pos)throw new Error('مسئول پیدا نشد');
  var sheet=getSheet('مسئولین'), vals=sheet.getRange(pos,1,1,5).getValues()[0]; vals[3]=p.active===true || String(p.active).toLowerCase()==='true'; sheet.getRange(pos,1,1,5).setValues([vals]); return {ok:true,active:truthy(vals[3])};
}
function requireCoachPermission(token, permission) {
  var auth=requireToken(token,['coach']); if(auth.isMaster)return auth;
  if(!auth.permissions || auth.permissions[permission] !== true) throw new Error('دسترسی این بخش برای شما فعال نیست');
  return auth;
}

function normalizeRole(role) {
  if (role.indexOf('حضور') >= 0) return 'attendance';
  if (role.indexOf('نظارت') >= 0) return 'supervision';
  throw new Error('نقش مسئول معتبر نیست');
}

function officialPublic(o) {
  return { code: o.code, name: o.name, role: o.role };
}

function issueToken(role, subject, isMaster, permissions) {
  ensureSecret();
  var payload = {
    r: role,
    s: subject,
    exp: Date.now() + CFG.TOKEN_TTL_MS,
    n: Utilities.getUuid(),
    m: !!isMaster,
    p: permissions || (role === 'coach' ? allCoachPermissions() : {})
  };
  var body = b64(JSON.stringify(payload));
  var sig = b64Bytes(Utilities.computeHmacSha256Signature(body, getSecret()));
  return body + '.' + sig;
}

function requireToken(token, roles) {
  if (!token) throw new Error('نشست معتبر نیست');
  var parts = String(token).split('.');
  if (parts.length !== 2) throw new Error('نشست نامعتبر است');

  var expected = b64Bytes(Utilities.computeHmacSha256Signature(parts[0], getSecret()));
  if (expected !== parts[1]) throw new Error('نشست نامعتبر است');

  var payload;
  try { payload = JSON.parse(Utilities.newBlob(Utilities.base64DecodeWebSafe(parts[0])).getDataAsString()); }
  catch (e) { throw new Error('نشست نامعتبر است'); }

  if (!payload.exp || Date.now() > Number(payload.exp)) throw new Error('نشست منقضی شده');
  if (roles.indexOf(payload.r) < 0) throw new Error('دسترسی کافی نیست');

  return { role: payload.r, subject: payload.s, exp: payload.exp, isMaster: !!payload.m, permissions: payload.p || {} };
}

function ensureSecret() {
  var sp = PropertiesService.getScriptProperties();
  if (!sp.getProperty('AUTH_SECRET')) {
    sp.setProperty('AUTH_SECRET', Utilities.getUuid() + '-' + Utilities.getUuid());
  }
}

function getSecret() {
  return PropertiesService.getScriptProperties().getProperty('AUTH_SECRET') || 'UNINITIALIZED';
}

function b64(s) {
  return Utilities.base64EncodeWebSafe(String(s), Utilities.Charset.UTF_8).replace(/=+$/,'');
}

function b64Bytes(bytes) {
  return Utilities.base64EncodeWebSafe(bytes).replace(/=+$/,'');
}

/* -------------------------------------------------------------------------- */
/* Member auth                                                                */
/* -------------------------------------------------------------------------- */

function registerMember(p){
  var fullName=String(p.name||'').trim().replace(/\s+/g,' '), phone=String(p.phone||'').trim();
  if(!fullName)throw new Error('نام و نام خانوادگی را وارد کن');
  if(!/^09\d{9}$/.test(phone))throw new Error('شماره همراه نامعتبر است');
  var existing=findMemberByPhone(phone,true);
  if(existing){
    if(String(existing.name||'').trim()!==fullName)throw new Error('این شماره قبلاً با نام دیگری ثبت شده است');
    return {ok:true,member:publicMember(existing),token:issueToken('member',phone),existing:true};
  }
  var parts=fullName.split(' '), last=parts.length>1?parts.pop():'', first=parts.join(' ');
  var member=addMemberInternal({firstName:first,lastName:last,phone:phone,nickname:'',profileCompleted:false,active:true});
  return {ok:true,member:publicMember(member),token:issueToken('member',phone),existing:false};
}
function generateLoginCode(phone) {
  if (!/^09\d{9}$/.test(phone)) throw new Error('شماره همراه نامعتبر است');
  // Do not disclose one-time login codes in public API responses.
  throw new Error('ورود پیامکی هنوز پیکربندی نشده است؛ کد ورود به‌صورت عمومی صادر نمی‌شود');
}

function verifyLoginCode(phone, code) {
  var cached = CacheService.getScriptCache().get('login:' + phone);
  if (!cached || cached !== code) throw new Error('کد نامعتبر یا منقضی شده');

  CacheService.getScriptCache().remove('login:' + phone);

  var member = findMemberByPhone(phone);
  if (!member) {
    var created = addMemberInternal({
      firstName: '',
      lastName: '',
      phone: phone,
      active: true
    });
    member = created;
  }

  member = publicMember(member);
  return {
    ok: true,
    isNewUser: !member.firstName && !member.lastName,
    member: member,
    token: issueToken('member', phone)
  };
}

/* -------------------------------------------------------------------------- */
/* Members                                                                    */
/* -------------------------------------------------------------------------- */

function addMember(p) {
  var first = String(p.firstName || '').trim();
  var last = String(p.lastName || '').trim();
  var phone = String(p.phone || '').trim();

  if (!first || !last) throw new Error('نام و نام خانوادگی الزامی است');
  if (!/^09\d{9}$/.test(phone)) throw new Error('شماره همراه نامعتبر است');

  if (findMemberByPhone(phone, true)) throw new Error('این عضو قبلاً وجود دارد');

  var m = addMemberInternal({
    firstName: first,
    lastName: last,
    phone: phone,
    active: true
  });

  return { ok: true, member: publicMember(m) };
}

function addMemberInternal(o) {
  var sheet = getSheet('اعضا');
  var name = ((o.firstName || '') + ' ' + (o.lastName || '')).trim();
  var row = {
    id: uid('MEM'),
    firstName: o.firstName || '',
    lastName: o.lastName || '',
    name: name,
    phone: o.phone || '',
    nickname: o.nickname || '',
    profileCompleted: o.profileCompleted === true,
    bestScore: Number(o.bestScore || 0),
    active: o.active !== false,
    createdAt: nowIso()
  };
  sheet.appendRow(rowToArray('اعضا', row));
  return row;
}

function updateMember(p) {
  var token = String(p.token || '');
  var auth = requireToken(token, ['member']);
  var phone = auth.subject;
  var sheet = getSheet('اعضا');
  var rows = sheet.getDataRange().getValues();
  if (rows.length < 2) throw new Error('عضو پیدا نشد');

  for (var i = 1; i < rows.length; i++) {
    var row = rows[i];
    if (String(row[4]) !== phone) continue;

    row[1] = String(p.firstName || '').trim();
    row[2] = String(p.lastName || '').trim();
    row[3] = (row[1] + ' ' + row[2]).trim();
    row[5] = String(p.nickname || '').trim();
    if (!row[1] || !row[2] || !row[5]) throw new Error('نام، نام خانوادگی و نام نمایشی الزامی است');
    row[6] = true;
    sheet.getRange(i + 1, 1, 1, row.length).setValues([row]);

    return { ok: true, member: publicMember(rowToObject('اعضا', row)) };
  }
  throw new Error('عضو پیدا نشد');
}

function deleteMember(id) {
  var sheet = getSheet('اعضا');
  var rows = sheet.getDataRange().getValues();
  for (var i = 1; i < rows.length; i++) {
    if (String(rows[i][0]) === id) {
      rows[i][8] = false;
      sheet.getRange(i + 1, 1, 1, rows[i].length).setValues([rows[i]]);
      return { ok: true };
    }
  }
  throw new Error('عضو پیدا نشد');
}

function listActiveMembers() {
  return getSheetObjects('اعضا')
    .filter(function(r){ return truthy(r.active); })
    .sort(function(a,b){ return String(a.name).localeCompare(String(b.name), 'fa'); })
    .map(publicMember);
}

function findMemberByPhone(phone, includeInactive) {
  var rows = getSheetObjects('اعضا');
  for (var i = 0; i < rows.length; i++) {
    if (String(rows[i].phone) === String(phone) && (includeInactive || truthy(rows[i].active))) {
      return rows[i];
    }
  }
  return null;
}

function publicMember(r) {
  return {
    id: r.id,
    firstName: r.firstName,
    lastName: r.lastName,
    name: r.name,
    phone: r.phone,
    nickname: r.nickname || '',
    profileCompleted: truthy(r.profileCompleted),
    bestScore: Number(r.bestScore || 0),
    active: truthy(r.active),
    createdAt: r.createdAt
  };
}

/* -------------------------------------------------------------------------- */
/* Events / Drive                                                             */
/* -------------------------------------------------------------------------- */

function listEventsPublic() {
  return getSheetObjects('رویدادها')
    .filter(function(r){ return truthy(r.active); })
    .sort(function(a,b){ return Number(a.sort || 0) - Number(b.sort || 0); })
    .map(function(r){
      return {
        id: r.id,
        title: r.title,
        description: r.description,
        imageUrl: r.imageId ? ('https://drive.google.com/thumbnail?id=' + encodeURIComponent(String(r.imageId)) + '&sz=w1200') : r.imageUrl,
        imageId: r.imageId || '',
        label: r.label,
        date: r.date
      };
    });
}

function uploadEventImage(p) {
  var data = String(p.base64 || '');
  if (!data) throw new Error('فایلی ارسال نشده');

  var mime = String(p.mimeType || 'image/jpeg');
  var ext = mime.split('/')[1] || 'jpg';
  var blob = Utilities.newBlob(Utilities.base64Decode(data), mime, 'event-' + Date.now() + '.' + ext);
  var folder = getDriveFolder();
  var file = folder.createFile(blob);

  try {
    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  } catch (e) {}

  return {
    ok: true,
    fileId: file.getId(),
    url: 'https://drive.google.com/thumbnail?id=' + encodeURIComponent(file.getId()) + '&sz=w1200'
  };
}

function saveEvent(p) {
  var sheet = getSheet('رویدادها');
  var id = String(p.id || '').trim();

  var rowObj = {
    id: id || uid('EVT'),
    title: String(p.title || '').trim(),
    description: String(p.description || '').trim(),
    imageUrl: String(p.imageUrl || '').trim(),
    imageId: String(p.imageId || '').trim(),
    label: String(p.label || 'رویداد').trim(),
    date: String(p.date || '').trim(),
    active: p.active !== false,
    sort: Number(p.sort || 0),
    createdAt: nowIso(),
    updatedAt: nowIso()
  };

  if (!rowObj.title) throw new Error('عنوان رویداد الزامی است');

  if (!id) {
    sheet.appendRow(rowToArray('رویدادها', rowObj));
  } else {
    var pos = findRow(sheet, 'id', id);
    if (!pos) throw new Error('رویداد پیدا نشد');

    rowObj.createdAt = sheet.getRange(pos, 10).getValue() || rowObj.createdAt;
    sheet.getRange(pos, 1, 1, 11).setValues([rowToArray('رویدادها', rowObj)]);
  }

  return { ok: true, item: rowObj };
}

function deleteEvent(id) {
  var sheet = getSheet('رویدادها');
  var pos = findRow(sheet, 'id', id);
  if (!pos) throw new Error('رویداد پیدا نشد');

  var row = sheet.getRange(pos, 1, 1, 11).getValues()[0];
  row[7] = false;
  row[10] = nowIso();
  sheet.getRange(pos, 1, 1, 11).setValues([row]);
  return { ok: true };
}

/* -------------------------------------------------------------------------- */
/* Feedback                                                                   */
/* -------------------------------------------------------------------------- */

function submitFeedback(p) {
  var name = String(p.name || '').trim();
  var phone = normalizeIranDigits(String(p.phone || '').trim());
  var category = String(p.category || 'پیشنهاد').trim();
  var message = String(p.message || '').trim();

  if (!message) throw new Error('متن پیام خالی است');
  if (phone && !/^09\d{9}$/.test(phone)) throw new Error('شماره تماس نامعتبر است');
  if (['پیشنهاد','انتقاد','شکایت','سایر'].indexOf(category) < 0) category = 'سایر';
  if (message.length > 2000) throw new Error('متن پیام بیش از حد طولانی است');

  getSheet('بازخوردها').appendRow([
    uid('FDB'),
    name,
    phone,
    category,
    message,
    'جدید',
    nowIso()
  ]);

  return { ok: true, message: 'پیام با موفقیت ثبت شد' };
}

/* -------------------------------------------------------------------------- */
/* Camps / Registrations                                                      */
/* -------------------------------------------------------------------------- */

function listCamps() {
  return getSheetObjects('اردوها')
    .filter(function(r){ return String(r.status) === 'active'; })
    .map(function(r){ return { id:r.id, title:r.title, status:r.status }; });
}

function registerCamp(p) {
  if (!p.campId) throw new Error('اردو انتخاب نشده');
  if (!p.firstName || !p.lastName || !p.fatherName) throw new Error('اطلاعات ناقص است');
  if (!/^09\d{9}$/.test(String(p.phone || ''))) throw new Error('شماره همراه نامعتبر است');
  if (!/^09\d{9}$/.test(String(p.fatherPhone || ''))) throw new Error('شماره همراه پدر نامعتبر است');

  var photoUrl = '';
  if (p.photoBase64) {
    var uploaded = uploadPublicFile(
      String(p.photoBase64),
      String(p.photoMimeType || 'image/jpeg'),
      'registration-' + Date.now()
    );
    photoUrl = uploaded.url;
  }

  var sheet = getSheet('ثبت‌نام‌ها');
  var row = {
    id: uid('REG'),
    campId: String(p.campId),
    firstName: String(p.firstName).trim(),
    lastName: String(p.lastName).trim(),
    fatherName: String(p.fatherName).trim(),
    fatherPhone: String(p.fatherPhone || '').trim(),
    phone: String(p.phone).trim(),
    nationalCode: String(p.nationalCode || '').trim(),
    photoUrl: photoUrl,
    status: 'در انتظار تایید',
    createdAt: nowIso(),
    updatedAt: nowIso()
  };
  sheet.appendRow(rowToArray('ثبت‌نام‌ها', row));
  return { ok: true, id: row.id, status: row.status };
}

function setRegistrationStatus(p) {
  var id = String(p.id || '');
  var status = String(p.status || '');
  if (['تایید شد','رد شد'].indexOf(status) < 0) throw new Error('وضعیت نامعتبر');

  var sheet = getSheet('ثبت‌نام‌ها');
  var pos = findRow(sheet, 'id', id);
  if (!pos) throw new Error('ثبت‌نام پیدا نشد');

  var width = HEADERS['ثبت‌نام‌ها'].length;
  var values = sheet.getRange(pos, 1, 1, width).getValues()[0];
  var statusIndex = HEADERS['ثبت‌نام‌ها'].indexOf('status');
  var updatedIndex = HEADERS['ثبت‌نام‌ها'].indexOf('updatedAt');
  var phoneIndex = HEADERS['ثبت‌نام‌ها'].indexOf('phone');
  values[statusIndex] = status;
  values[updatedIndex] = nowIso();
  sheet.getRange(pos, 1, 1, width).setValues([values]);

  if (status === 'تایید شد') {
    var phone = String(values[phoneIndex] || '');
    if (!findMemberByPhone(phone, true)) {
      addMemberInternal({
        firstName: values[2],
        lastName: values[3],
        phone: phone,
        active: true
      });
    } else {
      reactivateMember(phone);
    }
  }

  return { ok: true };
}

function reactivateMember(phone) {
  var sheet = getSheet('اعضا');
  var rows = sheet.getDataRange().getValues();
  for (var i=1;i<rows.length;i++){
    if (String(rows[i][4]) === String(phone)) {
      rows[i][8] = true;
      sheet.getRange(i+1,1,1,rows[i].length).setValues([rows[i]]);
      return;
    }
  }
}

/* -------------------------------------------------------------------------- */
/* Attendance                                                                 */
/* -------------------------------------------------------------------------- */

function attendanceForDate(date) {
  return getSheetObjects('حضورغیاب')
    .filter(function(r){ return String(r.date) === String(date); })
    .map(function(r){
      return {
        memberId: r.memberId,
        memberName: r.memberName,
        status: r.status,
        note: r.note
      };
    });
}

function attendanceForMonth(month) {
  return getSheetObjects('حضورغیاب')
    .filter(function(r){ return String(r.date).indexOf(month) === 0; })
    .sort(function(a,b){ return String(a.date).localeCompare(String(b.date)); })
    .map(function(r){
      return {
        date: r.date,
        memberId: r.memberId,
        memberName: r.memberName,
        status: r.status,
        note: r.note
      };
    });
}

function hasAttendanceDate(date) {
  var rows = getSheetObjects('حضورغیاب');
  return rows.some(function(r){ return String(r.date) === String(date); });
}

function saveAttendanceBatch(p) {
  var date = String(p.date || currentDate());
  if (date !== currentDate()) throw new Error('ثبت حضور فقط برای امروز مجاز است');
  if (hasAttendanceDate(date)) throw new Error('حضور امروز قبلاً ثبت شده و دیگر قابل ثبت مجدد نیست');

  var records = Array.isArray(p.records) ? p.records : [];
  if (!records.length) throw new Error('رکوردی برای ذخیره وجود ندارد');

  var official = requireToken(p.token, ['attendance']);
  var lock = LockService.getScriptLock();
  lock.waitLock(10000);

  try {
    if (hasAttendanceDate(date)) throw new Error('حضور امروز قبلاً ثبت شده');

    var sheet = getSheet('حضورغیاب');
    var now = nowIso();
    var values = [];

    records.forEach(function(r){
      if (!r.memberId || !r.memberName || !r.status) return;
      var status = String(r.status);
      if (['حاضر','موجه','غیبت'].indexOf(status) < 0) return;
      values.push([date, String(r.memberId), String(r.memberName), status, String(r.note || ''), official.subject, now]);
    });

    if (!values.length) throw new Error('رکورد معتبر وجود ندارد');
    sheet.getRange(sheet.getLastRow()+1,1,values.length,7).setValues(values);

    return { ok:true, locked:true, count:values.length };
  } finally {
    lock.releaseLock();
  }
}

/* -------------------------------------------------------------------------- */
/* Supervision                                                                */
/* -------------------------------------------------------------------------- */

function saveWarning(p) {
  var auth = requireToken(p.token, ['supervision']);
  var responsibility = String(p.responsibility || '').trim();
  var memberId = String(p.memberId || '').trim();
  var memberName = String(p.memberName || '').trim();
  var reason = String(p.reason || '').trim();

  if (!responsibility) throw new Error('اسم مسئولیت الزامی است');
  if (!memberName) throw new Error('نام مسئول الزامی است');
  if (!reason) throw new Error('دلیل اخطار الزامی است');

  var sheet = getSheet('اخطارها');
  sheet.appendRow([
    currentDate(),
    responsibility,
    memberId,
    memberName,
    reason,
    auth.subject,
    nowIso()
  ]);

  return { ok:true };
}

function warningsForMonth(month) {
  return getSheetObjects('اخطارها')
    .filter(function(r){ return String(r.date).indexOf(month) === 0; })
    .sort(function(a,b){ return String(a.date).localeCompare(String(b.date)); })
    .map(function(r){
      return {
        date:r.date,
        responsibility:r.responsibility,
        memberId:r.memberId,
        memberName:r.memberName,
        reason:r.reason
      };
    });
}

/* -------------------------------------------------------------------------- */
/* Dashboard                                                                  */
/* -------------------------------------------------------------------------- */

function dashboardData(auth) {
  var month = currentMonth();
  var today = currentDate();
  var regs = getSheetObjects('ثبت‌نام‌ها');
  var pending = regs.filter(function(r){ return String(r.status) === 'در انتظار تایید'; }).length;
  var attendance = attendanceForMonth(month);
  var warnings = warningsForMonth(month);
  var todayAttendance = attendance.filter(function(r){ return r.date === today; });

  return {
    ok:true,
    month:month,
    today:today,
    stats:{
      activeMembers:listActiveMembers().length,
      pendingRegistrations:pending,
      todayAttendance:todayAttendance.length,
      monthWarnings:warnings.length
    },
    events:(!auth || auth.isMaster || auth.permissions.events) ? listEventsPublic() : [],
    registrations:(!auth || auth.isMaster || auth.permissions.registrations) ? regs.sort(byNewest).slice(0,50) : [],
    attendance:(!auth || auth.isMaster || auth.permissions.reports) ? attendance : [],
    warnings:(!auth || auth.isMaster || auth.permissions.reports) ? warnings : [],
    prize:(!auth || auth.isMaster || auth.permissions.game) ? (getSetting('gamePrize') || CFG.DEFAULT_GAME_PRIZE) : '',
    leaderboard:leaderboardForWeek(currentWeekKey()),
    previousWinner:previousWinner()
  };
}

/* -------------------------------------------------------------------------- */
/* Game                                                                       */
/* -------------------------------------------------------------------------- */

function saveGamePrize(prize) {
  var value = prize || CFG.DEFAULT_GAME_PRIZE;
  setSetting('gamePrize', value);
  return { ok:true, prize:value };
}

function ensureLifetimeGameRecords() {
  var memberSheet = getSheet('اعضا');
  var gameRows = getSheetObjects('بازی');
  if (!gameRows.length) return;

  var members = getSheetObjects('اعضا');
  var bestById = {};
  members.forEach(function(m){ bestById[String(m.id)] = Number(m.bestScore || 0); });

  gameRows.forEach(function(g){
    var score = Number(g.score || 0);
    if (score <= 0) return;
    var memberId = String(g.memberId || '');
    if (memberId && bestById[memberId] !== undefined) {
      if (score > bestById[memberId]) bestById[memberId] = score;
      return;
    }

    // برای رکوردهای قدیمی که memberId نداشتند، فقط در صورت تطبیق یکتای نام تلاش می‌کنیم.
    var playerName = String(g.playerName || '').trim();
    if (!playerName) return;
    var matches = members.filter(function(m){
      return String(m.nickname || '').trim() === playerName || String(m.name || '').trim() === playerName;
    });
    if (matches.length === 1) {
      var id = String(matches[0].id);
      if (score > (bestById[id] || 0)) bestById[id] = score;
    }
  });

  var rows = memberSheet.getDataRange().getValues();
  for (var i = 1; i < rows.length; i++) {
    var id = String(rows[i][0] || '');
    if (!id || bestById[id] === undefined) continue;
    var current = Number(rows[i][7] || 0);
    if (bestById[id] > current) {
      rows[i][7] = bestById[id];
      memberSheet.getRange(i + 1, 1, 1, rows[i].length).setValues([rows[i]]);
    }
  }
}

function submitGameScore(p) {
  var auth = requireToken(p.token, ['member']);
  var member = findMemberByPhone(auth.subject, true);
  if (!member) throw new Error('عضو پیدا نشد');
  if (!truthy(member.profileCompleted)) throw new Error('ابتدا پروفایلت را تکمیل کن');
  var score = Math.floor(Number(p.score || 0));
  if (!isFinite(score) || score < 0 || score > 100000) throw new Error('امتیاز نامعتبر است');
  var memberSheet = getSheet('اعضا');
  var memberRow = findRow(memberSheet, 'id', member.id);
  if (!memberRow) throw new Error('رکورد عضو پیدا نشد');
  var week = currentWeekKey(), sheet = getSheet('بازی');
  var lock = LockService.getScriptLock(); lock.waitLock(10000);
  try {
    var rows=getSheetObjects('بازی'), existing=null, existingRow=0;
    for(var i=0;i<rows.length;i++) if(String(rows[i].weekKey)===week && String(rows[i].memberId)===String(member.id)){existing=rows[i];existingRow=findRow(sheet,'weekKey',week,'memberId',member.id);break;}
    var playerName=String(member.nickname||member.name||'عضو').trim();
    var lifetimeBest = Number(member.bestScore || 0);
    if(score > lifetimeBest){
      memberSheet.getRange(memberRow, 8).setValue(score);
      lifetimeBest = score;
    }
    if(existing){
      if(score<=Number(existing.score||0)) return {ok:true,saved:false,score:Number(existing.score),weekKey:week,lifetimeBest:lifetimeBest,leaderboard:leaderboardForWeek(week),allTimeLeaderboard:allTimeLeaderboard()};
      var vals=sheet.getRange(existingRow,1,1,5).getValues()[0]; vals[1]=member.id; vals[2]=playerName; vals[3]=score; vals[4]=nowIso(); sheet.getRange(existingRow,1,1,5).setValues([vals]);
    }else sheet.appendRow([week,member.id,playerName,score,nowIso()]);
    return {ok:true,saved:true,score:score,weekKey:week,lifetimeBest:lifetimeBest,leaderboard:leaderboardForWeek(week),allTimeLeaderboard:allTimeLeaderboard()};
  } finally { lock.releaseLock(); }
}
function leaderboardForWeek(week) {
  return getSheetObjects('بازی')
    .filter(function(r){ return String(r.weekKey) === String(week); })
    .map(function(r){ return { memberId:String(r.memberId || ''), playerName:r.playerName, score:Number(r.score || 0) }; })
    .sort(function(a,b){ return b.score - a.score; })
    .slice(0,10);
}

function allTimeLeaderboard() {
  return getSheetObjects('اعضا')
    .filter(function(r){ return truthy(r.active) && truthy(r.profileCompleted) && Number(r.bestScore || 0) > 0; })
    .map(function(r){ return { memberId:String(r.id || ''), playerName:String(r.nickname || r.name || 'عضو'), score:Number(r.bestScore || 0) }; })
    .sort(function(a,b){ return b.score - a.score; })
    .slice(0,10);
}

function previousWinner() {
  var prev = previousWeekKey();
  var top = leaderboardForWeek(prev);
  if (!top.length) return null;
  return { weekKey:prev, playerName:top[0].playerName, score:top[0].score };
}

/* -------------------------------------------------------------------------- */
/* Settings                                                                   */
/* -------------------------------------------------------------------------- */

function getSetting(key) {
  var row = findRow(getSheet('تنظیمات'), 'key', key);
  if (!row) return '';
  return String(getSheet('تنظیمات').getRange(row,2).getValue() || '');
}

function setSetting(key, value) {
  var sheet = getSheet('تنظیمات');
  var row = findRow(sheet, 'key', key);
  if (row) {
    sheet.getRange(row,2).setValue(value);
  } else {
    sheet.appendRow([key,value]);
  }
}

/* -------------------------------------------------------------------------- */
/* Drive                                                                      */
/* -------------------------------------------------------------------------- */

function uploadPublicFile(base64, mime, name) {
  var blob = Utilities.newBlob(Utilities.base64Decode(base64), mime, name);
  var folder = getDriveFolder();
  var file = folder.createFile(blob);

  try {
    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  } catch (e) {}

  return {
    id:file.getId(),
    url:'https://drive.google.com/thumbnail?id=' + encodeURIComponent(file.getId()) + '&sz=w1200'
  };
}

function getDriveFolder() {
  if (!CFG.DRIVE_FOLDER_ID || CFG.DRIVE_FOLDER_ID.indexOf('PASTE_') === 0) {
    throw new Error('DRIVE_FOLDER_ID را در Code.gs تنظیم کن');
  }
  return DriveApp.getFolderById(CFG.DRIVE_FOLDER_ID);
}

/* -------------------------------------------------------------------------- */
/* Sheets helpers                                                             */
/* -------------------------------------------------------------------------- */

function migrateSheetHeaders(sheet,name){
  var desired=HEADERS[name]; if(!desired||!desired.length)return;
  var last=sheet.getLastRow(); if(last===0){sheet.getRange(1,1,1,desired.length).setValues([desired]);sheet.setFrozenRows(1);return;}
  var vals=sheet.getDataRange().getValues(), old=vals[0].map(String), same=desired.length===old.length&&desired.every(function(h,i){return h===old[i];});
  if(same)return;
  var output=[desired];
  for(var r=1;r<vals.length;r++){var obj={};for(var j=0;j<old.length;j++)obj[old[j]]=vals[r][j];output.push(desired.map(function(h){return obj[h]!==undefined?obj[h]:'';}));}
  sheet.clearContents();sheet.getRange(1,1,output.length,desired.length).setValues(output);sheet.setFrozenRows(1);
}
function findRowById(name,id){return findRow(getSheet(name),'id',id);}
function getSS() {
  if (!CFG.SPREADSHEET_ID || CFG.SPREADSHEET_ID.indexOf('PASTE_') === 0) {
    throw new Error('SPREADSHEET_ID را در Code.gs تنظیم کن');
  }
  return SpreadsheetApp.openById(CFG.SPREADSHEET_ID);
}

function getSheet(name) {
  var ss = getSS();
  var sheet = ss.getSheetByName(name);
  if (!sheet) {
    ensureSheet(ss,name,HEADERS[name] || []);
    sheet = ss.getSheetByName(name);
  }
  migrateSheetHeaders(sheet,name);
  return sheet;
}

function ensureSheet(ss,name,headers) {
  var sheet = ss.getSheetByName(name);
  if (!sheet) sheet = ss.insertSheet(name);

  if (sheet.getLastRow() === 0 && headers.length) {
    sheet.getRange(1,1,1,headers.length).setValues([headers]);
    sheet.setFrozenRows(1);
  }
  return sheet;
}

function getSheetObjects(name) {
  var sheet = getSheet(name);
  var values = sheet.getDataRange().getValues();
  if (values.length < 2) return [];

  var headers = values[0].map(String);
  var out = [];
  for (var i=1;i<values.length;i++){
    var row = values[i];
    if (row.every(function(v){ return v === '' || v === null; })) continue;
    var obj = {};
    for (var j=0;j<headers.length;j++) obj[headers[j]] = row[j];
    out.push(obj);
  }
  return out;
}

function rowToArray(name,obj) {
  return HEADERS[name].map(function(h){ return obj[h] !== undefined ? obj[h] : ''; });
}

function rowToObject(name,row) {
  var headers = HEADERS[name];
  var o = {};
  for (var i=0;i<headers.length;i++) o[headers[i]] = row[i];
  return o;
}

function findRow(sheet, key1, val1, key2, val2) {
  var range = sheet.getDataRange();
  var values = range.getValues();
  if (values.length < 2) return 0;
  var headers = values[0].map(String);
  var i1 = headers.indexOf(key1);
  var i2 = key2 ? headers.indexOf(key2) : -1;

  for (var r=1;r<values.length;r++){
    if (String(values[r][i1]) === String(val1) &&
        (!key2 || String(values[r][i2]) === String(val2))) {
      return r+1;
    }
  }
  return 0;
}

function truthy(v) {
  if (v === true) return true;
  var s = String(v).toLowerCase();
  return s === 'true' || s === '1' || s === 'بله';
}

function uid(prefix) {
  return prefix + '-' + Utilities.getUuid().split('-')[0].toUpperCase();
}

function nowIso() {
  return Utilities.formatDate(new Date(), CFG.TIMEZONE, "yyyy-MM-dd'T'HH:mm:ss");
}

function currentDate() {
  return Utilities.formatDate(new Date(), CFG.TIMEZONE, 'yyyy-MM-dd');
}

function currentMonth() {
  return Utilities.formatDate(new Date(), CFG.TIMEZONE, 'yyyy-MM');
}

function currentWeekKey() {
  var d = localDateOnly(new Date());
  var day = d.getDay(); // Sunday=0
  // هفته‌ی بازی از جمعه شروع می‌شود
  var delta = (day + 2) % 7;
  d.setDate(d.getDate() - delta);
  return Utilities.formatDate(d, CFG.TIMEZONE, 'yyyy-MM-dd');
}

function previousWeekKey() {
  var d = localDateOnly(new Date());
  d.setDate(d.getDate() - 7);
  var day = d.getDay();
  var delta = (day + 2) % 7;
  d.setDate(d.getDate() - delta);
  return Utilities.formatDate(d, CFG.TIMEZONE, 'yyyy-MM-dd');
}

function localDateOnly(date) {
  var text = Utilities.formatDate(date, CFG.TIMEZONE, 'yyyy-MM-dd');
  var parts = text.split('-').map(Number);
  return new Date(parts[0], parts[1]-1, parts[2]);
}

function byNewest(a,b) {
  return String(b.createdAt || '').localeCompare(String(a.createdAt || ''));
}
