/* ============================================================================
   313 / حلقه شهید هادی ذوالفقاری
   Google Apps Script Backend v4
   ----------------------------------------------------------------------------
   این فایل را داخل Google Apps Script پروژه‌ی backend قرار بده.

   قبل از Deploy:
   1) SPREADSHEET_ID را وارد کن
   2) DRIVE_FOLDER_ID را وارد کن
   3) تابع setup() را یک بار اجرا کن
   4) کدهای تصادفی مسئولین را از شیت «مسئولین» بردار و امن به مسئول مربوطه تحویل بده؛ اطلاعات مربی ارشد را در Script Properties تنظیم کن
   4.1) ورود اعضا با شماره همراه + گذرواژه است؛ گذرواژه فقط به صورت HMAC hash نگه‌داری می‌شود
   4.2) برای تغییر ساختار شیت‌ها، بعد از ذخیره این کد تابع setup() را اجرا کن
   5) Deploy > Manage deployments > ویرایش Deployment فعلی > انتخاب نسخه جدید > Deploy
      Execute as: Me
      Who has access: Anyone
   6) فقط اگر عمداً Deployment جدید ساختی، URL جدید را در js/main.js هم جایگزین کن.

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
    phone: normalizeIranMobile_(props.getProperty('MASTER_COACH_PHONE') || ''),
    code: String(props.getProperty('MASTER_COACH_CODE') || '').trim(),
    name: String(props.getProperty('MASTER_COACH_NAME') || CFG.MASTER_COACH_NAME).trim() || CFG.MASTER_COACH_NAME
  };
}

var HEADERS = {
  'تنظیمات': ['key','value'],
  'مربیان': ['code','name','phone','active','role','permissions','createdAt','updatedAt'],
  'مسئولین': ['code','name','role','active','createdAt','phone'],
  'اعضا': ['id','firstName','lastName','name','phone','nickname','profileCompleted','bestScore','active','createdAt','passwordSalt','passwordHash','profileImage'],
  'رویدادها': ['id','title','description','imageUrl','imageId','label','date','active','sort','createdAt','updatedAt'],
  'گزارش فعالیت‌ها': ['id','title','description','date','imageIds','active','createdAt','updatedAt','createdBy'],
  'اردوها': ['id','title','status','createdAt'],
  'ثبت‌نام‌ها': ['id','campId','firstName','lastName','fatherName','fatherPhone','phone','nationalCode','photoUrl','status','createdAt','updatedAt'],
  'حضورغیاب': ['date','memberId','memberName','status','note','officialCode','createdAt'],
  'اخطارها': ['date','responsibility','memberId','memberName','reason','officialCode','createdAt'],
  'بازی': ['weekKey','memberId','playerName','score','updatedAt'],
  'برنامه': ['id','day','title','time','location','active','sort','createdAt','updatedAt','category'],
  'بازخوردها': ['id','name','phone','category','message','status','createdAt'],
  'ثبت‌نام حلقه': ['id','memberId','phone','nationalCode','birthDate','fatherName','fatherPhone','address','school','grade','guardianName','emergencyPhone','status','createdAt','updatedAt'],
  'گزارش خطاها': ['timestamp','requestId','method','action','category','message','stack']
};

/* -------------------------------------------------------------------------- */
/* HTTP                                                                      */
/* -------------------------------------------------------------------------- */

var APP_VERSION = '4.18.0-required-consent-photo';

function doGet(e) {
  var p = (e && e.parameter) || {};
  var requestId = Utilities.getUuid();
  try {
    var result = handleGet(p);
    if (result && typeof result === 'object' && !result.requestId) result.requestId = requestId;
    return json(result);
  } catch (err) {
    return json(backendErrorResponse_(err, 'GET', String(p.action || 'ping'), requestId));
  }
}

function doPost(e) {
  var requestId = Utilities.getUuid();
  var p = {};
  try {
    var raw = e && e.postData ? e.postData.contents : '{}';
    p = JSON.parse(raw || '{}');
    if (!p || typeof p !== 'object' || Array.isArray(p)) throw new Error('بدنهٔ درخواست باید یک شیء معتبر باشد');
    var result = handlePost(p);
    if (result && typeof result === 'object' && !result.requestId) result.requestId = requestId;
    return json(result);
  } catch (err) {
    return json(backendErrorResponse_(err, 'POST', String(p.action || 'parse'), requestId));
  }
}

function json(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

function safeError(err) {
  var message = err && err.message ? err.message : String(err);
  return String(message || 'خطای ناشناخته').slice(0, 800);
}

// این تابع هیچ توکن، گذرواژه، شماره همراه یا بدنهٔ کامل درخواست را ذخیره نمی‌کند.
function backendErrorResponse_(err, method, action, requestId) {
  var message = safeError(err);
  var expected = isExpectedClientError_(message);
  var category = expected ? 'درخواست/اعتبارسنجی' : 'خطای فنی';
  recordBackendError_({
    timestamp: nowIso(),
    requestId: requestId,
    method: method,
    action: String(action || 'unknown').slice(0, 80),
    category: category,
    message: message,
    stack: expected ? '' : String(err && err.stack || '').slice(0, 4000)
  });

  return {
    ok: false,
    error: expected ? message : (message + ' (کد پیگیری: ' + requestId + ')'),
    errorCode: expected ? 'REQUEST_ERROR' : 'SERVER_ERROR',
    requestId: requestId,
    hint: expected ? '' : 'اگر خطا تکرار شد، کد پیگیری را به مدیر سامانه بده تا از بخش گزارش خطاها بررسی شود.',
    version: APP_VERSION
  };
}

function isExpectedClientError_(message) {
  return /نامعتبر|الزامی|وارد کن|انتخاب کن|پیدا نشد|نشست|دسترسی|غیرفعال|مجاز نیست|قبلاً|تکمیل کن|حداکثر|باید|اشتباه است|نادرست است|معتبر نیست|حجم|فرمت|فقط |ثبت‌نام|تغییر کرده|منقضی|تکراری|کد مربی|گذرواژه|شماره همراه|بدنهٔ درخواست/.test(String(message || ''));
}

function recordBackendError_(entry) {
  try {
    var sheet = getSheet('گزارش خطاها');
    sheet.appendRow([
      entry.timestamp || nowIso(),
      entry.requestId || '',
      entry.method || '',
      entry.action || '',
      entry.category || '',
      entry.message || '',
      entry.stack || ''
    ]);
    // نگه‌داری آخرین 1000 خطا برای جلوگیری از بزرگ‌شدن بی‌پایان گزارش.
    var last = sheet.getLastRow();
    if (last > 1001) sheet.deleteRows(2, last - 1001);
  } catch (logErr) {
    console.error('[313][' + String(entry.requestId || '') + '] Failed to write error log: ' + safeError(logErr));
  }
}

function listSystemErrors_(limit) {
  var rows = getSheetObjects('گزارش خطاها');
  var count = Math.max(1, Math.min(100, Number(limit || 50)));
  return rows.slice(-count).reverse().map(function(r) {
    return {
      timestamp: String(r.timestamp || ''),
      requestId: String(r.requestId || ''),
      method: String(r.method || ''),
      action: String(r.action || ''),
      category: String(r.category || ''),
      message: String(r.message || ''),
      stack: String(r.stack || '')
    };
  });
}

/* -------------------------------------------------------------------------- */
/* Setup                                                                      */
/* -------------------------------------------------------------------------- */

function scheduleDayIndex(day){
  var normalized=String(day||'').replace(/\u200c/g,'').trim();
  return ['شنبه','یکشنبه','دوشنبه','سهشنبه','چهارشنبه','پنجشنبه','جمعه'].indexOf(normalized);
}
function listSchedulePublic(){
  var rows=getSheetObjects('برنامه').filter(function(x){return String(x.active).toLowerCase()!=='false';});
  rows=rows.map(function(x){x.category=(String(x.category||'حلقه')==='بازی')?'بازی':'حلقه';return x;});
  rows.sort(function(a,b){
    var ai=scheduleDayIndex(a.day),bi=scheduleDayIndex(b.day);
    if(ai<0)ai=99;if(bi<0)bi=99;
    if(ai!==bi)return ai-bi;
    var ac=String(a.createdAt||''),bc=String(b.createdAt||'');
    if(ac!==bc)return ac.localeCompare(bc);
    return String(a.title||'').localeCompare(String(b.title||''),'fa');
  });
  return {ok:true,items:rows};
}
function saveSchedule(p){
  requireCoachPermission(p.token,'schedule');
  var sheet=getSheet('برنامه'), id=String(p.id||Utilities.getUuid()), rows=getSheetObjects('برنامه'), pos=findRowById('برنامه',id);
  var day=String(p.day||'').trim(),dayIndex=scheduleDayIndex(day);
  var category=String(p.category||'حلقه').trim();
  if(category!=='حلقه'&&category!=='بازی')throw new Error('دسته برنامه را انتخاب کن');
  var obj={id:id,day:day,title:String(p.title||'').trim(),time:'',location:String(p.location||'').trim(),active:p.active!==false,sort:dayIndex<0?99:dayIndex,createdAt:new Date().toISOString(),updatedAt:new Date().toISOString(),category:category};
  if(dayIndex<0||!obj.title)throw new Error('روز معتبر و عنوان برنامه را وارد کن');
  if(obj.title.length>120)throw new Error('عنوان برنامه نباید بیشتر از ۱۲۰ نویسه باشد');
  if(obj.location.length>160)throw new Error('مکان برنامه نباید بیشتر از ۱۶۰ نویسه باشد');
  if(pos){var old=rows[pos-2];obj.createdAt=old.createdAt||obj.createdAt;sheet.getRange(pos,1,1,HEADERS['برنامه'].length).setValues([rowToArray('برنامه',obj)]);}else sheet.appendRow(rowToArray('برنامه',obj));
  return {ok:true,item:obj};
}
function deleteSchedule(p){requireCoachPermission(p.token,'schedule');var pos=findRowById('برنامه',String(p.id||''));if(!pos)throw new Error('برنامه پیدا نشد');getSheet('برنامه').deleteRow(pos);return {ok:true,deleted:true};}
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
  var generatedOfficialCodes = ensureOfficialRoles();
  generatedOfficialCodes = generatedOfficialCodes.concat(rotateUnsafeDefaultOfficialCodes_());

  var camps = getSheet('اردوها');
  if (camps.getLastRow() < 2) {
    camps.appendRow([uid('CAMP'), 'اردوی مشهد', 'active', nowIso()]);
  }

  ensureLifetimeGameRecords();
  ensureSecret();

  return {
    ok: true,
    message: 'راه‌اندازی اولیه انجام شد',
    generatedOfficialCodes: generatedOfficialCodes
  };
}

/* -------------------------------------------------------------------------- */
/* GET Actions                                                                */
/* -------------------------------------------------------------------------- */

function isPostOnlyAuthenticatedReadAction_(action) {
  return [
    'listSystemErrors', 'listFeedback', 'listActivityReportsManage',
    'listCoaches', 'listOfficialsManage', 'getRingRegistration',
    'getMyGameRole', 'listMembers', 'getAttendanceToday',
    'listMonthlyAttendance', 'listWarnings', 'listRegistrations',
    'getDashboard'
  ].indexOf(String(action || '')) >= 0;
}

function handleGet(p, allowPostOnlyAuthenticatedRead) {
  var action = String(p.action || 'ping');
  if (!allowPostOnlyAuthenticatedRead && isPostOnlyAuthenticatedReadAction_(action)) {
    throw new Error('برای امنیت نشست، این عملیات فقط از طریق POST مجاز است');
  }

  if (action === 'ping') return { ok: true, service: '313', version: APP_VERSION, serverTime: nowIso() };

  if (action === 'coachStatus') {
    var masterConfig = getMasterCoachConfig();
    return { ok: true, service: '313', version: APP_VERSION, masterConfigured: !!(masterConfig.phone && masterConfig.code) };
  }

  if (action === 'listSystemErrors') {
    var diagnosticsAuth = requireToken(p.token, ['coach']);
    if (!diagnosticsAuth.isMaster) throw new Error('گزارش خطاها فقط برای مدیر اصلی سامانه قابل مشاهده است');
    return { ok: true, version: APP_VERSION, items: listSystemErrors_(p.limit) };
  }

  if (action === 'listFeedback') {
    requireCoachPermission(p.token, 'feedback');
    return { ok: true, items: listFeedbackRecords() };
  }

  if (action === 'listEvents' || action === 'listActivities') {
    return { ok: true, items: listEventsPublic() };
  }

  if (action === 'listActivityReports') {
    return { ok: true, items: listActivityReportsPublic() };
  }

  if (action === 'listActivityReportsManage') {
    requireCoachPermission(p.token, 'events');
    return { ok: true, items: listActivityReportsManage() };
  }

  if (action === 'listSchedule') { return listSchedulePublic(); }

  if (action === 'listCoaches') {
    var coachAuthGet = requireToken(p.token, ['coach']);
    if (!coachAuthGet.isMaster) throw new Error('فقط مربی ارشد به فهرست مربیان دسترسی دارد');
    return { ok: true, items: listCoachRecords() };
  }

  if (action === 'listOfficialsManage') {
    requireCoachPermission(p.token, 'officials');
    return { ok:true, items:listOfficialRecords() };
  }

  if (action === 'getRingRegistration') return getRingRegistration(p);

  if (action === 'getMyGameRole') {
    var roleAuth = requireToken(p.token, ['member']);
    var roleMember = findMemberByPhone(roleAuth.subject, true);
    if (!roleMember) throw new Error('حساب عضو پیدا نشد');
    var roleMap = gameRoleMap_([roleMember], registeredRingPhones_());
    return {ok:true, roleKey:(roleMap[String(roleMember.id)] || {}).roleKey || 'member'};
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

  // Credential verification is POST-only so access codes never appear in URL query strings.

  if (action === 'verifyCoachCode') {
    throw new Error('برای ورود مربیان، شماره همراه و کد ورود هر دو لازم است');
  }

  if (action === 'listMembers') {
    var auth = requireToken(p.token, ['attendance']);
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
    var warningAuth = requireToken(p.token, ['supervision', 'coach']);
    if (warningAuth.role === 'coach') requireCoachPermission(p.token, 'reports');
    var requestedMonth = String(p.month || currentMonth());
    if (requestedMonth !== currentMonth()) {
      throw new Error('فقط اطلاعات ماه جاری قابل مشاهده است');
    }
    return {
      ok: true,
      month: requestedMonth,
      items: warningsForMonth(requestedMonth),
      role: warningAuth.role
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
        .filter(function(r){ return normalizeMemberPhone(r.phone) === normalizeMemberPhone(registrationAuth.subject); })
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
  if (isPostOnlyAuthenticatedReadAction_(action)) return handleGet(p, true);

  if (action === 'memberAuth') { return memberAuth(p); }
  if (action === 'saveRingRegistration') return saveRingRegistration(p);
  if (action === 'registerMember') { throw new Error('برای ثبت‌نام و ورود از فرم شماره همراه و گذرواژه استفاده کن'); }
  if (action === 'loginCoach') { return loginCoach(p); }
  if (action === 'addCoach') { return addCoach(p); }
  if (action === 'listCoaches') {
    var coachAuth = requireToken(p.token, ['coach']);
    if (!coachAuth.isMaster) throw new Error('فقط مربی ارشد به فهرست مربیان دسترسی دارد');
    return { ok:true, items:listCoachRecords() };
  }
  if (action === 'updateCoach') return updateCoach(p);
  if (action === 'setCoachStatus') return setCoachStatus(p);
   if (action === 'deleteCoach') return deleteCoach(p);
  if (action === 'updateCoachCode') return updateCoachCode(p);
  if (action === 'addOfficial') return addOfficial(p);
  if (action === 'updateOfficial') return updateOfficial(p);
  if (action === 'setOfficialStatus') return setOfficialStatus(p);
   if (action === 'deleteOfficial') return deleteOfficial(p);
  if (action === 'generateLoginCode' || action === 'verifyLoginCode') {
    throw new Error('ورود پیامکی فعال نیست؛ با شماره همراه و گذرواژه وارد شو');
  }

  if (action === 'updateMember') return updateMember(p);

  if (action === 'uploadProfileImage') return uploadProfileImage(p);

  if (action === 'updateOwnCoachCredentials') return updateOwnCoachCredentials(p);

  if (action === 'setFeedbackStatus') return setFeedbackStatus(p);

  if (action === 'registerCamp') {
    return registerCamp(p);
  }

  if (action === 'uploadEventImage') {
    requireCoachPermission(p.token, 'events');
    return uploadEventImage(p);
  }

  if (action === 'uploadActivityPhoto') {
    requireCoachPermission(p.token, 'events');
    return uploadActivityPhoto(p);
  }

  if (action === 'cleanupActivityPhotos') {
    requireCoachPermission(p.token, 'events');
    return { ok:true, trashed:cleanupUnusedActivityPhotos_(p.imageIds) };
  }

  if (action === 'cleanupEventImage') {
    requireCoachPermission(p.token, 'events');
    return { ok:true, trashed:cleanupUnusedEventPhoto_(p.imageId) };
  }

  if (action === 'saveActivityReport') {
    requireCoachPermission(p.token, 'events');
    return saveActivityReport(p);
  }

  if (action === 'deleteActivityReport') {
    requireCoachPermission(p.token, 'events');
    return deleteActivityReport(String(p.id || ''));
  }

  if (action === 'saveEvent') {
    requireCoachPermission(p.token, 'events');
    return saveEvent(p);
  }

  if (action === 'saveSchedule') return saveSchedule(p);
  if (action === 'deleteSchedule') return deleteSchedule(p);

  if (action === 'deleteEvent') {
    requireCoachPermission(p.token, 'events');
    return deleteEvent(String(p.id || ''));
  }

  if (action === 'getRegistrationPhoto') return getRegistrationPhoto(p);

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
  if (action === 'resetMemberHistory') return resetMemberHistory(p);

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
  if (action === 'verifyOfficialCode') {
    var official = verifyOfficialCode(normalizeIranDigits(String(p.code || '').trim()).toUpperCase());
    if (!official) throw new Error('کد مسئولیت نامعتبر است');
    return { ok:true, official:officialPublic(official), token:issueToken(official.roleCode, official.code) };
  }

  if (action === 'feedback') { return submitFeedback(p); }

  throw new Error('عملیات شناخته نشد: ' + action);
}

/* -------------------------------------------------------------------------- */
/* Auth                                                                       */
/* -------------------------------------------------------------------------- */

function officialDefaultCodePrefix_(code) {
  var target = normalizeIranDigits(String(code || '').trim()).toUpperCase();
  var defaults = {
    'ATT-GUIDE-CHANGE-ME': 'ATT-GUIDE',
    'ATT-ELEMENTARY-CHANGE-ME': 'ATT-ELEMENTARY',
    'SUP-CHANGE-ME': 'SUP'
  };
  return defaults[target] || '';
}

function generateOfficialAccessCode_(prefix) {
  return String(prefix || 'OFFICIAL') + '-' +
    Utilities.getUuid().replace(/-/g, '').slice(0, 16).toUpperCase();
}

function rotateUnsafeDefaultOfficialCodes_() {
  var sheet = getSheet('مسئولین');
  var values = sheet.getDataRange().getValues();
  if (values.length < 2) return [];
  var headers = values[0].map(String);
  var codeIndex = headers.indexOf('code');
  var nameIndex = headers.indexOf('name');
  if (codeIndex < 0) return [];
  var rotated = [];
  for (var i = 1; i < values.length; i++) {
    var oldCode = normalizeIranDigits(String(values[i][codeIndex] || '').trim()).toUpperCase();
    var prefix = officialDefaultCodePrefix_(oldCode);
    if (!prefix) continue;
    var newCode = generateOfficialAccessCode_(prefix);
    sheet.getRange(i + 1, codeIndex + 1).setValue(newCode);
    rotated.push({
      name: nameIndex >= 0 ? String(values[i][nameIndex] || '') : '',
      code: newCode
    });
  }
  return rotated;
}

function verifyOfficialCode(code) {
  var target = normalizeIranDigits(String(code || '').trim()).toUpperCase();
  if (!target || officialDefaultCodePrefix_(target)) return null;
  var rows = getSheetObjects('مسئولین');
  for (var i = 0; i < rows.length; i++) {
    var r = rows[i];
    if (truthy(r.active) && normalizeIranDigits(String(r.code || '').trim()).toUpperCase() === target) {
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
  var phone=normalizeIranMobile_(p.phone||'');
  var code=normalizeCoachCode_(p.code);
  if(!/^09\d{9}$/.test(phone)) throw new Error('شماره مربی نامعتبر است');
  if(!code) throw new Error('کد مربی را وارد کن');

  // مربی ارشد مستقیماً از تنظیمات اصلی احراز می‌شود؛
  // بنابراین ورود به وجود ردیف شیت مربیان وابسته نیست.
  var masterConfig = getMasterCoachConfig();
  var masterCode = normalizeCoachCode_(masterConfig.code);
  if(masterConfig.phone && masterCode && phone===masterConfig.phone && code===masterCode){
    ensureMasterCoach();
    return {
      ok:true,
      coach:{name:masterConfig.name,phone:masterConfig.phone,role:'master',isMaster:true,permissions:allCoachPermissions()},
      token:issueToken('coach',masterCode,true,allCoachPermissions())
    };
  }

  var coachSheet=getSheet('مربیان');
  migrateSheetHeaders(coachSheet,'مربیان');
  var rows=getSheetObjects('مربیان');
  var coach=rows.filter(function(r){
    var rowPhone=normalizeIranMobile_(r.phone||'');
    var rowCode=normalizeCoachCode_(r.code);
    return truthy(r.active)&&rowPhone===phone&&rowCode===code&&(String(r.role||'')!=='master'||(masterConfig.phone===phone&&masterCode===code));
  })[0];

  if(!coach){
    // مالک می‌تواند در پنل مربیان با گذرواژهٔ حساب عضو خود وارد شود.
    // شماره فقط شناسهٔ مجاز است؛ گذرواژه با هش ذخیره‌شده در برگهٔ اعضا بررسی می‌شود.
    // The existing Script Property is the allow-list; no private phone number is hard-coded in the public repository.
    var ownerPhone = masterConfig.phone;
    if(ownerPhone && phone === ownerPhone){
      var owner = findMemberByPhone(phone, true);
      var ownerPassword = String(p.code || '');
      var ownerSalt = String(owner && owner.passwordSalt || '');
      var ownerHash = String(owner && owner.passwordHash || '');
      if(owner && truthy(owner.active) && ownerSalt && ownerHash &&
         memberPasswordHash(ownerPassword, ownerSalt) === ownerHash){
        var props = PropertiesService.getScriptProperties();
        var effectiveCode = (masterConfig.phone === phone && masterCode)
          ? masterConfig.code
          : ('owner-' + Utilities.getUuid() + '-' + Utilities.getUuid());
        var ownerName = String(owner.name || ((owner.firstName || '') + ' ' + (owner.lastName || '')).trim() || CFG.MASTER_COACH_NAME);
        props.setProperty('MASTER_COACH_PHONE', phone);
        props.setProperty('MASTER_COACH_CODE', effectiveCode);
        props.setProperty('MASTER_COACH_NAME', ownerName);
        ensureMasterCoach();
        return {
          ok:true,
          coach:{name:ownerName,phone:phone,role:'master',isMaster:true,permissions:allCoachPermissions()},
          token:issueToken('coach', effectiveCode, true, allCoachPermissions())
        };
      }
      throw new Error('شماره مالک یا گذرواژه حساب مالک نادرست است');
    }
    throw new Error('شماره یا کد مربی نادرست است');
  }
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
  var found=rows.some(function(r){return normalizeIranMobile_(r.phone||'')===config.phone&&normalizeCoachCode_(r.code)===normalizeCoachCode_(config.code)&&String(r.role||'')==='master';});
  if(!found)getSheet('مربیان').appendRow([config.code,config.name,config.phone,true,'master',JSON.stringify(allCoachPermissions()),nowIso(),nowIso()]);
}
function normalizeMemberPhone(value) {
  return normalizeIranMobile_(value);
}

function normalizeIranDigits(value){
  return String(value||'')
    .replace(/[۰-۹]/g,function(c){return String('۰۱۲۳۴۵۶۷۸۹'.indexOf(c));})
    .replace(/[٠-٩]/g,function(c){return String('٠١٢٣٤٥٦٧٨٩'.indexOf(c));});
}

// شماره‌های ایران را مستقل از ارقام فارسی/عربی، فاصله، خط تیره یا پیش‌شماره بین‌المللی یکسان می‌کند.
function normalizeCoachCode_(value) { return normalizeIranDigits(String(value || '').trim()); }

function normalizeIranMobile_(value){
  var phone=normalizeIranDigits(String(value||'')).replace(/[^0-9]/g,'');
  if(/^00989\d{9}$/.test(phone)) return '0'+phone.slice(4);
  if(/^989\d{9}$/.test(phone)) return '0'+phone.slice(2);
  if(/^9\d{9}$/.test(phone)) return '0'+phone;
  return phone;
}
function updateOwnCoachCredentials(p) {
  var auth = requireToken(p.token, ['coach']);
  var newPhoneInput = normalizeIranMobile_(p.newPhone || '');
  var newCodeInput = normalizeCoachCode_(p.newCode);
  if (!newPhoneInput && !newCodeInput) throw new Error('شماره یا کد جدید را وارد کن');
  if (newPhoneInput && !/^09\d{9}$/.test(newPhoneInput)) throw new Error('شماره همراه نامعتبر است');
  if (newCodeInput && newCodeInput.length < 8) throw new Error('کد ورود جدید باید دست‌کم ۸ نویسه داشته باشد');
  if (newCodeInput.length > 64) throw new Error('کد ورود بیش از حد طولانی است');

  var sheet = getSheet('مربیان');
  var values = sheet.getDataRange().getValues();
  var headers = values[0].map(String);
  var idx = {};
  headers.forEach(function(h, i) { idx[h] = i; });
  var rows = getSheetObjects('مربیان');
  var oldCode = normalizeCoachCode_(auth.subject);
  var current;
  var rowNumber = 0;
  var isMaster = !!auth.isMaster;

  if (isMaster) {
    current = getMasterCoachConfig();
    if (!current.phone || !current.code || normalizeCoachCode_(current.code) !== oldCode) {
      throw new Error('اطلاعات مربی ارشد تغییر کرده؛ دوباره وارد شو');
    }
    for (var mi = 1; mi < values.length; mi++) {
      if (String(values[mi][idx.role] || '') === 'master' && normalizeCoachCode_(values[mi][idx.code]) === oldCode) {
        rowNumber = mi + 1;
        break;
      }
    }
  } else {
    current = rows.filter(function(r) {
      return normalizeCoachCode_(r.code) === oldCode && truthy(r.active) && String(r.role || '') !== 'master';
    })[0];
    if (!current) throw new Error('حساب مربی پیدا نشد یا غیرفعال است');
    rowNumber = findCoachRowByCode(oldCode);
  }

  var newPhone = newPhoneInput || normalizeIranMobile_(current.phone || '');
  var newCode = newCodeInput || normalizeCoachCode_(current.code);
  var newName = String(current.name || (isMaster ? 'مربی ارشد' : '')).trim();
  if (!/^09\d{9}$/.test(newPhone)) throw new Error('شماره همراه فعلی معتبر نیست');

  rows.forEach(function(r) {
    if (String(r.role || '') === 'master' && isMaster) return;
    if (normalizeCoachCode_(r.code) === oldCode && !isMaster) return;
    if (normalizeIranMobile_(r.phone || '') === newPhone) {
      throw new Error('این شماره همراه قبلاً برای مربی دیگری ثبت شده است');
    }
    if (normalizeCoachCode_(r.code) === newCode) {
      throw new Error('این کد ورود قبلاً استفاده شده است');
    }
  });

  var permissions = isMaster ? allCoachPermissions() : coachPermissions(current);

  if (isMaster) {
    var props = PropertiesService.getScriptProperties();
    props.setProperty('MASTER_COACH_PHONE', newPhone);
    props.setProperty('MASTER_COACH_CODE', newCode);
    if (newName) props.setProperty('MASTER_COACH_NAME', newName);

    if (rowNumber) {
      var masterRow = sheet.getRange(rowNumber, 1, 1, headers.length).getValues()[0];
      masterRow[idx.code] = newCode;
      masterRow[idx.name] = newName;
      masterRow[idx.phone] = newPhone;
      masterRow[idx.active] = true;
      masterRow[idx.role] = 'master';
      masterRow[idx.permissions] = JSON.stringify(allCoachPermissions());
      if (idx.updatedAt !== undefined) masterRow[idx.updatedAt] = nowIso();
      sheet.getRange(rowNumber, 1, 1, headers.length).setValues([masterRow]);
    } else {
      sheet.appendRow(rowToArray('مربیان', {
        code:newCode, name:newName, phone:newPhone, active:true, role:'master',
        permissions:JSON.stringify(allCoachPermissions()), createdAt:nowIso(), updatedAt:nowIso()
      }));
    }
  } else {
    if (!rowNumber) throw new Error('رکورد مربی پیدا نشد');
    var coachRow = sheet.getRange(rowNumber, 1, 1, headers.length).getValues()[0];
    coachRow[idx.phone] = newPhone;
    coachRow[idx.code] = newCode;
    if (idx.updatedAt !== undefined) coachRow[idx.updatedAt] = nowIso();
    sheet.getRange(rowNumber, 1, 1, headers.length).setValues([coachRow]);
  }

  return {
    ok: true,
    coach: { name:newName, phone:newPhone, role:isMaster ? 'master' : String(current.role || 'admin'), isMaster:isMaster, permissions:permissions },
    token: issueToken('coach', newCode, isMaster, permissions)
  };
}

function addCoach(p){
  var auth=requireToken(p.token,['coach']); if(!auth.isMaster)throw new Error('فقط مربی ارشد می‌تواند مربی اضافه کند');
  var name=String(p.name||'').trim(),phone=normalizeIranMobile_(p.phone||''),code=normalizeCoachCode_(p.code);
  if(!name)throw new Error('نام مربی را وارد کن'); if(!/^09\d{9}$/.test(phone))throw new Error('شماره مربی نامعتبر است'); if(code.length<8)throw new Error('رمز ورود مربی باید دست‌کم ۸ نویسه داشته باشد');
  var rows=getSheetObjects('مربیان');
  if(rows.some(function(r){return normalizeIranMobile_(r.phone||'')===phone;}))throw new Error('این شماره قبلاً ثبت شده');
  if(rows.some(function(r){return normalizeCoachCode_(r.code)===code;}))throw new Error('این کد قبلاً استفاده شده');
  getSheet('مربیان').appendRow([code,name,phone,true,'admin',JSON.stringify(normalizePermissions(p.permissions)),nowIso(),nowIso()]);
  return {ok:true,coach:{name:name,phone:phone,role:'coach',isMaster:false}};
}

function allCoachPermissions() {
  return { events:true, schedule:true, registrations:true, reports:true, game:true, coaches:true, officials:true, feedback:true };
}
function normalizePermissions(value) {
  var base = { events:false, schedule:false, registrations:false, reports:false, game:false, coaches:false, officials:false, feedback:false };
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
  var config = getMasterCoachConfig();
  var records = getSheetObjects('مربیان').filter(function(r) {
    return String(r.role || '') !== 'master';
  }).map(function(r) {
    return {
      name:String(r.name||''), phone:String(r.phone||''), code:String(r.code||''),
      role:String(r.role||'admin'), active:truthy(r.active),
      permissions:coachPermissions(r), createdAt:r.createdAt||'', updatedAt:r.updatedAt||''
    };
  });
  if (config.phone && config.code) {
    records.unshift({
      name:config.name,
      phone:config.phone,
      code:config.code,
      role:'master',
      active:true,
      permissions:allCoachPermissions(),
      createdAt:'',
      updatedAt:''
    });
  }
  return records;
}
function normalizeCoachRecords() {
  var sheet=getSheet('مربیان'), rows=sheet.getDataRange().getValues();
  if(rows.length<2)return;
  var headers=rows[0].map(String), idx={};
  headers.forEach(function(h,i){idx[h]=i;});
  var seenPhone={}, seenCode={}, masterKept=false, changed=false;
  for(var i=1;i<rows.length;i++){
    var phone=String(rows[i][idx.phone]||'').replace(/\s+/g,'');
    var code=normalizeCoachCode_(rows[i][idx.code]);
    var isMaster=String(rows[i][idx.role]||'')==='master';
    var duplicate=(phone && seenPhone[phone]) || (code && seenCode[code]);
    if(isMaster && masterKept) duplicate=true;
    if(duplicate && truthy(rows[i][idx.active])) { rows[i][idx.active]=false; changed=true; continue; }
    if(phone)seenPhone[phone]=true;
    if(code)seenCode[code]=true;
    if(isMaster)masterKept=true;
    if(idx.permissions!==undefined){
      if(!String(rows[i][idx.permissions]||'').trim() && String(rows[i][idx.role]||'')!=='master') rows[i][idx.permissions]=JSON.stringify({events:true,schedule:true,registrations:true,reports:true,game:true,coaches:false,officials:false,feedback:false});
      var normalized=JSON.stringify(coachPermissions(rowToObject('مربیان',rows[i])));
      if(String(rows[i][idx.permissions]||'')!==normalized){rows[i][idx.permissions]=normalized;changed=true;}
    }
  }
  if(changed) sheet.getRange(1,1,rows.length,headers.length).setValues(rows);
}
function findCoachRowByCode(code) {
  var target = normalizeCoachCode_(code);
  var sheet = getSheet('مربیان');
  var values = sheet.getDataRange().getValues();
  if (values.length < 2) return 0;
  var codeIndex = values[0].map(String).indexOf('code');
  if (codeIndex < 0) return 0;
  for (var i = 1; i < values.length; i++) {
    if (normalizeCoachCode_(values[i][codeIndex]) === target) return i + 1;
  }
  return 0;
}
function updateCoach(p) {
  var auth=requireToken(p.token,['coach']); if(!auth.isMaster)throw new Error('فقط مربی ارشد می‌تواند مربیان را ویرایش کند');
  var oldCode=normalizeCoachCode_(p.oldCode); var pos=findCoachRowByCode(oldCode); if(!pos)throw new Error('مربی پیدا نشد');
  var sheet=getSheet('مربیان'), rows=sheet.getDataRange().getValues(), headers=rows[0].map(String), row=rows[pos-1], idx={};
  headers.forEach(function(h,i){idx[h]=i;});
  if(String(row[idx.role]||'')==='master')throw new Error('مربی ارشد قابل ویرایش از این بخش نیست');
  var name=String(p.name||'').trim(), phone=normalizeIranMobile_(p.phone||''), code=normalizeCoachCode_(p.code);
  if(!name)throw new Error('نام مربی را وارد کن'); if(!/^09\d{9}$/.test(phone))throw new Error('شماره مربی نامعتبر است'); if(code.length<8)throw new Error('رمز ورود مربی باید دست‌کم ۸ نویسه داشته باشد');
  for(var i=1;i<rows.length;i++){if(i===pos-1)continue;var rr=rows[i];if(normalizeIranMobile_(rr[idx.phone]||'')===phone)throw new Error('این شماره قبلاً ثبت شده');if(normalizeCoachCode_(rr[idx.code])===code)throw new Error('این کد قبلاً استفاده شده');}
  row[idx.name]=name; row[idx.phone]=phone; row[idx.code]=code; row[idx.permissions]=JSON.stringify(normalizePermissions(p.permissions)); row[idx.updatedAt]=nowIso();
  sheet.getRange(pos,1,1,headers.length).setValues([row]); return {ok:true,item:{name:name,phone:phone,code:code,role:'admin',active:truthy(row[idx.active]),permissions:normalizePermissions(p.permissions)}};
}
function setCoachStatus(p) {
  var auth=requireToken(p.token,['coach']); if(!auth.isMaster)throw new Error('فقط مربی ارشد می‌تواند وضعیت مربیان را تغییر دهد');
  var pos=findCoachRowByCode(normalizeCoachCode_(p.code)); if(!pos)throw new Error('مربی پیدا نشد');
  var sheet=getSheet('مربیان'), headers=sheet.getDataRange().getValues()[0].map(String), idx={}; headers.forEach(function(h,i){idx[h]=i;});
  var row=sheet.getRange(pos,1,1,headers.length).getValues()[0]; if(String(row[idx.role]||'')==='master')throw new Error('مربی ارشد قابل اخراج نیست');
  row[idx.active]=p.active===true || String(p.active).toLowerCase()==='true'; row[idx.updatedAt]=nowIso(); sheet.getRange(pos,1,1,headers.length).setValues([row]);
  return {ok:true,active:truthy(row[idx.active])};
}
function deleteCoach(p){
  var auth=requireToken(p.token,['coach']);
  if(!auth.isMaster)throw new Error('فقط مالک می‌تواند مربی را حذف کند');
  var target=normalizeCoachCode_(p.code);
  if(!target)throw new Error('مربی انتخاب نشده است');
  var pos=findCoachRowByCode(target);
  if(!pos)throw new Error('مربی پیدا نشد');
  var sheet=getSheet('مربیان');
  var headers=sheet.getDataRange().getValues()[0].map(String);
  var row=sheet.getRange(pos,1,1,headers.length).getValues()[0];
  if(String(row[headers.indexOf('role')]||'')==='master')throw new Error('حساب مالک قابل حذف نیست');
  sheet.deleteRow(pos);
  return {ok:true,deleted:true};
}
function updateCoachCode(p) {
  var auth=requireToken(p.token,['coach']); if(!auth.isMaster)throw new Error('فقط مربی ارشد می‌تواند کد را تغییر دهد');
  var oldCode=normalizeCoachCode_(p.oldCode); var pos=findCoachRowByCode(oldCode); if(!pos)throw new Error('مربی پیدا نشد');
  var newCode=normalizeCoachCode_(p.code); if(newCode.length<8)throw new Error('رمز ورود جدید باید دست‌کم ۸ نویسه داشته باشد');
  var rows=getSheetObjects('مربیان'); if(rows.some(function(r){var existing=normalizeCoachCode_(r.code);return existing===newCode && existing!==oldCode;}))throw new Error('این کد قبلاً استفاده شده');
  var sheet=getSheet('مربیان'), headers=sheet.getDataRange().getValues()[0].map(String), ci=headers.indexOf('code'), ui=headers.indexOf('updatedAt'); var row=sheet.getRange(pos,1,1,headers.length).getValues()[0]; if(String(row[headers.indexOf('role')]||'')==='master')throw new Error('کد مربی ارشد قابل تغییر نیست'); row[ci]=newCode; row[ui]=nowIso(); sheet.getRange(pos,1,1,headers.length).setValues([row]); return {ok:true,code:newCode};
}
function ensureOfficialRoles() {
  var sheet = getSheet('مسئولین');
  var rows = getSheetObjects('مسئولین');
  var roles = ['حضور و غیاب - راهنمایی', 'حضور و غیاب - دبستان', 'نظارت'];
  var generated = [];
  roles.forEach(function(role) {
    var exists = rows.some(function(r) {
      return truthy(r.active) && String(r.role || '') === role;
    });
    if (!exists) {
      var prefix = role.indexOf('راهنمایی') >= 0 ? 'ATT-GUIDE' :
        (role.indexOf('دبستان') >= 0 ? 'ATT-ELEMENTARY' : 'SUP');
      var code = generateOfficialAccessCode_(prefix);
      var name = 'مسئول ' + role;
      sheet.appendRow([code, name, role, true, nowIso()]);
      generated.push({ name: name, code: code });
      rows.push({ code: code, name: name, role: role, active: true });
    }
  });
  return generated;
}
function ensureOfficialPhoneColumn_(){
  var sheet=getSheet('مسئولین'),values=sheet.getDataRange().getValues();
  if(!values.length)return;
  var headers=values[0].map(String);
  if(headers.indexOf('phone')<0)sheet.getRange(1,headers.length+1).setValue('phone');
}
function listOfficialRecords() {
  ensureOfficialPhoneColumn_();
  return getSheetObjects('مسئولین').map(function(r){return {code:String(r.code||''),name:String(r.name||''),role:String(r.role||''),active:truthy(r.active),createdAt:r.createdAt||'',phone:String(r.phone||'')};});
}
function addOfficial(p) {
  requireCoachPermission(p.token, 'officials');
  ensureOfficialPhoneColumn_();
  var code=String(p.code||'').trim(),name=String(p.name||'').trim(),role=String(p.role||'').trim(),phone=normalizeMemberPhone(p.phone||'');
  if(!code||!name||!role)throw new Error('نام، کد و نوع مسئولیت الزامی است');
  if(phone&&!/^09\d{9}$/.test(phone))throw new Error('شماره همراه مسئول باید ۱۱ رقم و با ۰۹ شروع شود');
  if(code.length<8)throw new Error('کد مسئولیت باید دست‌کم ۸ نویسه داشته باشد');
  if(['حضور و غیاب - راهنمایی','حضور و غیاب - دبستان','نظارت'].indexOf(role)<0)throw new Error('نوع مسئولیت نامعتبر است');
  var existingOfficials=getSheetObjects('مسئولین'); if(existingOfficials.some(function(r){return String(r.code||'').trim().toUpperCase()===code.toUpperCase();}))throw new Error('این کد قبلاً استفاده شده'); if(existingOfficials.some(function(r){return truthy(r.active)&&String(r.role||'')===role;}))throw new Error('برای این نوع مسئولیت یک مسئول فعال از قبل وجود دارد؛ همان را ویرایش یا غیرفعال کن');
  getSheet('مسئولین').appendRow(rowToArray('مسئولین',{code:code,name:name,role:role,active:true,createdAt:nowIso(),phone:phone})); return {ok:true};
}
function updateOfficial(p) {
  requireCoachPermission(p.token, 'officials');
  ensureOfficialPhoneColumn_();
  var oldCode=String(p.oldCode||'').trim(), pos=findRow(getSheet('مسئولین'),'code',oldCode); if(!pos)throw new Error('مسئول پیدا نشد');
  var code=String(p.code||'').trim(),name=String(p.name||'').trim(),role=String(p.role||'').trim(),phone=normalizeMemberPhone(p.phone||'');
  if(!code||!name||!role)throw new Error('نام، کد و نوع مسئولیت الزامی است');
  if(phone&&!/^09\d{9}$/.test(phone))throw new Error('شماره همراه مسئول باید ۱۱ رقم و با ۰۹ شروع شود');
  if(code.length<8)throw new Error('کد مسئولیت باید دست‌کم ۸ نویسه داشته باشد');
  if(['حضور و غیاب - راهنمایی','حضور و غیاب - دبستان','نظارت'].indexOf(role)<0)throw new Error('نوع مسئولیت نامعتبر است');
  var rows=getSheetObjects('مسئولین');
  if(rows.some(function(r){return String(r.code||'').trim().toUpperCase()===code.toUpperCase() && String(r.code||'').trim()!==oldCode;}))throw new Error('این کد قبلاً استفاده شده');
  if(rows.some(function(r){return truthy(r.active) && String(r.role||'')===role && String(r.code||'').trim()!==oldCode;}))throw new Error('برای این نوع مسئولیت مسئول فعال دیگری وجود دارد؛ ابتدا او را غیرفعال کن');
  var sheet=getSheet('مسئولین'), headers=sheet.getDataRange().getValues()[0].map(String), vals=sheet.getRange(pos,1,1,headers.length).getValues()[0];
  vals[headers.indexOf('code')]=code;vals[headers.indexOf('name')]=name;vals[headers.indexOf('role')]=role;vals[headers.indexOf('phone')]=phone;
  sheet.getRange(pos,1,1,headers.length).setValues([vals]); return {ok:true};
}
function setOfficialStatus(p) {
  requireCoachPermission(p.token, 'officials');
  var code=normalizeIranDigits(String(p.code||'').trim()).toUpperCase();
  var officialRows=getSheetObjects('مسئولین');
  var pos=0;
  for(var oi=0;oi<officialRows.length;oi++){
    if(normalizeIranDigits(String(officialRows[oi].code||'').trim()).toUpperCase()===code){pos=oi+2;break;}
  }
  if(!pos)throw new Error('مسئول پیدا نشد');
  var sheet=getSheet('مسئولین'), vals=sheet.getRange(pos,1,1,5).getValues()[0];
  var makeActive=p.active===true || String(p.active).toLowerCase()==='true';
  if(makeActive){
    var targetRole=String(vals[2]||'');
    var rows=getSheetObjects('مسئولین');
    if(rows.some(function(r){return truthy(r.active) && String(r.role||'')===targetRole && String(r.code||'').trim().toUpperCase()!==code;})){
      throw new Error('برای این نوع مسئولیت، مسئول فعال دیگری وجود دارد');
    }
  }
  vals[3]=makeActive; sheet.getRange(pos,1,1,5).setValues([vals]); return {ok:true,active:truthy(vals[3])};
}
function deleteOfficial(p){
  requireCoachPermission(p.token,'officials');
  var target=normalizeIranDigits(String(p.code||'').trim()).toUpperCase();
  if(!target)throw new Error('مسئول انتخاب نشده است');
  var rows=getSheetObjects('مسئولین'),pos=0;
  for(var i=0;i<rows.length;i++){if(normalizeIranDigits(String(rows[i].code||'').trim()).toUpperCase()===target){pos=i+2;break;}}
  if(!pos)throw new Error('مسئول پیدا نشد');
  getSheet('مسئولین').deleteRow(pos);
  return {ok:true,deleted:true};
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

  // لغو فوری دسترسی مسئولان و مربیان غیرفعال‌شده یا تغییرکرده.
  if (payload.r === 'attendance' || payload.r === 'supervision') {
    var currentOfficial = verifyOfficialCode(String(payload.s || '').toUpperCase());
    if (!currentOfficial || currentOfficial.roleCode !== payload.r) {
      throw new Error('دسترسی مسئول غیرفعال شده یا تغییر کرده است؛ دوباره وارد شو');
    }
  }
  if (payload.r === 'coach') {
    if (payload.m) {
      var master = getMasterCoachConfig();
      if (!master.phone || !master.code || normalizeCoachCode_(master.code) !== normalizeCoachCode_(payload.s)) {
        throw new Error('حساب مربی ارشد تغییر کرده است؛ دوباره وارد شو');
      }
      payload.p = allCoachPermissions();
    } else {
      var currentCoach = null;
      var coachRows = getSheetObjects('مربیان');
      for (var ci = 0; ci < coachRows.length; ci++) {
        if (String(coachRows[ci].role || '') !== 'master' &&
            normalizeCoachCode_(coachRows[ci].code) === normalizeCoachCode_(payload.s)) {
          currentCoach = coachRows[ci]; break;
        }
      }
      if (!currentCoach || !truthy(currentCoach.active)) throw new Error('حساب مربی غیرفعال شده است؛ دوباره وارد شو');
      payload.p = coachPermissions(currentCoach);
    }
  }

  return { role: payload.r, subject: payload.s, exp: payload.exp, isMaster: !!payload.m, permissions: payload.p || {} };
}

function ensureSecret() {
  var sp = PropertiesService.getScriptProperties();
  if (!sp.getProperty('AUTH_SECRET')) {
    sp.setProperty('AUTH_SECRET', Utilities.getUuid() + '-' + Utilities.getUuid());
  }
}

function getSecret() {
  var secret = PropertiesService.getScriptProperties().getProperty('AUTH_SECRET');
  if (!secret || String(secret).trim().length < 32) {
    throw new Error('کلید امنیتی سامانه تنظیم نشده است؛ مدیر باید تابع setup() را اجرا کند.');
  }
  return secret;
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

function memberPasswordHash(password, salt) {
  ensureSecret();
  return b64Bytes(Utilities.computeHmacSha256Signature(String(salt) + ':' + String(password), getSecret()));
}

function validateMemberPassword(password) {
  var value = String(password == null ? '' : password);
  if (value.length < 8) throw new Error('گذرواژه باید دست‌کم ۸ نویسه داشته باشد');
  if (value.length > 128) throw new Error('گذرواژه بیش از حد طولانی است');
  if (!value.trim()) throw new Error('گذرواژه را وارد کن');
  return value;
}

function setMemberPassword(memberId, password) {
  var sheet = getSheet('اعضا');
  var rowNumber = findRow(sheet, 'id', String(memberId || ''));
  if (!rowNumber) throw new Error('حساب عضو پیدا نشد');
  var headers = sheet.getDataRange().getValues()[0].map(String);
  var saltIndex = headers.indexOf('passwordSalt');
  var hashIndex = headers.indexOf('passwordHash');
  if (saltIndex < 0 || hashIndex < 0) throw new Error('ستون‌های گذرواژه آماده نیستند؛ setup را اجرا کن');
  var salt = Utilities.getUuid() + '-' + Utilities.getUuid();
  var hash = memberPasswordHash(password, salt);
  sheet.getRange(rowNumber, saltIndex + 1).setValue(salt);
  sheet.getRange(rowNumber, hashIndex + 1).setValue(hash);
}

function memberAuth(p) {
  var fullName = String(p.name || '').trim().replace(/\s+/g, ' ');
  var phone = normalizeIranDigits(String(p.phone || '').trim()).replace(/\s+/g, '');
  var password = validateMemberPassword(p.password);

  if (!/^09\d{9}$/.test(phone)) throw new Error('شماره همراه نامعتبر است');

  var existing = findMemberByPhone(phone, true);
  var isExisting = !!existing;

  if (existing) {
    if (!truthy(existing.active)) throw new Error('حساب این شماره همراه غیرفعال است؛ با مربی حلقه تماس بگیر');

    var storedHash = String(existing.passwordHash || '');
    var storedSalt = String(existing.passwordSalt || '');

    if (storedHash) {
      if (!storedSalt || memberPasswordHash(password, storedSalt) !== storedHash) {
        throw new Error('شماره همراه یا گذرواژه اشتباه است');
      }
      // اگر حساب قبلاً گذرواژه دارد، شماره همراه شناسه اصلی است؛ نام ارسالی نقشی در ورود ندارد.
    } else {
      // حساب‌های قدیمی پیش از اضافه شدن گذرواژه: فقط یک‌بار با نام ثبت‌شده فعال می‌شوند.
      var storedName = String(existing.name || ((existing.firstName || '') + ' ' + (existing.lastName || ''))).trim().replace(/\s+/g, ' ');
      if (storedName && (!fullName || storedName !== fullName)) {
        throw new Error('این حساب قدیمی هنوز گذرواژه ندارد. برای فعال‌سازی اولیه، یک‌بار نام ثبت‌شده را دقیق وارد کن؛ بعد از آن فقط شماره و گذرواژه لازم است.');
      }
      if (!storedName && !fullName) throw new Error('برای فعال‌سازی اولیه حساب قدیمی، نام و نام خانوادگی را هم وارد کن');
      setMemberPassword(existing.id, password);
      existing = findMemberByPhone(phone, true);
    }

    return {
      ok: true,
      member: publicMember(existing),
      token: issueToken('member', phone),
      existing: true,
      passwordInitialized: !storedHash
    };
  }

  if (!fullName || fullName.length < 2) throw new Error('برای ساخت حساب جدید، نام و نام خانوادگی را وارد کن');

  var parts = fullName.split(' ');
  if (parts.length < 2 || !parts[0] || !parts[1]) {
    throw new Error('برای ساخت حساب جدید، نام و نام خانوادگی را وارد کن');
  }
  var last = parts.pop();
  var first = parts.join(' ');
  var salt = Utilities.getUuid() + '-' + Utilities.getUuid();
  var hash = memberPasswordHash(password, salt);
  var member = addMemberInternal({
    firstName: first,
    lastName: last,
    phone: phone,
    nickname: '',
    profileCompleted: false,
    active: true,
    passwordSalt: salt,
    passwordHash: hash,
    profileImage: ''
  });

  return {
    ok: true,
    member: publicMember(member),
    token: issueToken('member', phone),
    existing: false,
    passwordInitialized: true
  };
}

// Endpoint قدیمی عمداً غیرفعال است تا بدون گذرواژه نتوان حساب عضو ساخت.
function registerMember() {
  throw new Error('برای ورود امن از عملیات memberAuth با شماره همراه و گذرواژه استفاده کن');
}

function generateLoginCode() {
  throw new Error('ورود پیامکی پیکربندی نشده است؛ با شماره همراه و گذرواژه وارد شو');
}

function verifyLoginCode() {
  throw new Error('ورود پیامکی فعال نیست؛ با شماره همراه و گذرواژه وارد شو');
}

/* -------------------------------------------------------------------------- */
/* Members                                                                    */
/* -------------------------------------------------------------------------- */

function addMember(p) {
  var first = String(p.firstName || '').trim();
  var last = String(p.lastName || '').trim();
  var phone = normalizeIranMobile_(p.phone || '');

  if (!first || !last) throw new Error('نام و نام خانوادگی الزامی است');
  if (first.length > 60 || last.length > 80) throw new Error('نام یا نام خانوادگی بیش از حد طولانی است');
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
    createdAt: nowIso(),
    passwordSalt: o.passwordSalt || '',
    passwordHash: o.passwordHash || '',
    profileImage: o.profileImage || ''
  };
  sheet.appendRow(rowToArray('اعضا', row));
  return row;
}

function updateMember(p) {
  var auth = requireToken(String(p.token || ''), ['member']);
  var phone = String(auth.subject || '');
  var sheet = getSheet('اعضا');
  var values = sheet.getDataRange().getValues();
  if (values.length < 2) throw new Error('عضو پیدا نشد');

  var headers = values[0].map(String);
  var idx = {};
  headers.forEach(function(h, i) { idx[h] = i; });
  if (idx.phone === undefined || idx.firstName === undefined || idx.lastName === undefined ||
      idx.name === undefined || idx.nickname === undefined || idx.profileCompleted === undefined) {
    throw new Error('ساختار شیت اعضا کامل نیست؛ setup را اجرا کن');
  }

  for (var i = 1; i < values.length; i++) {
    var row = values[i];
    if (normalizeMemberPhone(row[idx.phone]) !== normalizeMemberPhone(phone)) continue;
    if (!truthy(row[idx.active])) throw new Error('حساب عضو غیرفعال است');

    var firstName = String(p.firstName || '').trim();
    var lastName = String(p.lastName || '').trim();
    var nickname = String(p.nickname || '').trim();
    if (!firstName || !lastName || !nickname) throw new Error('نام، نام خانوادگی و نام نمایشی الزامی است');
    if (firstName.length > 60 || lastName.length > 80) throw new Error('نام یا نام خانوادگی بیش از حد طولانی است');
    if (nickname.length > 24) throw new Error('نام نمایشی حداکثر ۲۴ نویسه باشد');

    row[idx.firstName] = firstName;
    row[idx.lastName] = lastName;
    row[idx.name] = (firstName + ' ' + lastName).trim();
    row[idx.nickname] = nickname;
    row[idx.profileCompleted] = true;
    sheet.getRange(i + 1, 1, 1, row.length).setValues([row]);

    return { ok: true, member: publicMember(rowToObject('اعضا', row)) };
  }
  throw new Error('عضو پیدا نشد');
}

function uploadProfileImage(p) {
  var auth = requireToken(String(p.token || ''), ['member']);
  var mime = String(p.mimeType || '').toLowerCase();
  if (['image/jpeg', 'image/png', 'image/webp'].indexOf(mime) < 0) {
    throw new Error('فرمت عکس باید JPG، PNG یا WebP باشد');
  }

  var base64 = String(p.base64 || '').replace(/\s+/g, '');
  if (base64.indexOf(',') >= 0) base64 = base64.slice(base64.lastIndexOf(',') + 1);
  if (!base64 || base64.length > 3000000) throw new Error('حجم عکس زیاد است؛ یک عکس کوچک‌تر انتخاب کن');

  var bytes;
  try { bytes = Utilities.base64Decode(base64); }
  catch (e) { throw new Error('فایل عکس معتبر نیست'); }
  if (!bytes || !bytes.length || bytes.length > 2 * 1024 * 1024) {
    throw new Error('حجم عکس باید کمتر از ۲ مگابایت باشد');
  }

  // حساب و ساختار شیت را قبل از ساخت فایل بررسی می‌کنیم تا فایل یتیم ایجاد نشود.
  var sheet = getSheet('اعضا');
  var rowNumber = findMemberRowByPhone(sheet, String(auth.subject || ''));
  if (!rowNumber) throw new Error('حساب عضو پیدا نشد');
  var headers = sheet.getDataRange().getValues()[0].map(String);
  var imageIndex = headers.indexOf('profileImage');
  if (imageIndex < 0) throw new Error('ستون عکس پروفایل آماده نیست؛ تابع setup را اجرا کن');

  var ext = mime === 'image/png' ? 'png' : (mime === 'image/webp' ? 'webp' : 'jpg');
  var blob = Utilities.newBlob(bytes, mime, 'profile-' + Date.now() + '.' + ext);
  var file = getDriveFolder().createFile(blob);
  try {
    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    if (file.getSharingAccess() !== DriveApp.Access.ANYONE_WITH_LINK) {
      throw new Error('PUBLIC_SHARING_NOT_CONFIRMED');
    }
  } catch (shareErr) {
    try { file.setTrashed(true); } catch (trashError) {}
    throw new Error('گوگل درایو اجازه نمایش عمومی عکس پروفایل را نداد. تنظیمات اشتراک‌گذاری پوشه و دسترسی برنامه را بررسی کن.');
  }

  var url = 'https://drive.google.com/thumbnail?id=' + encodeURIComponent(file.getId()) + '&sz=w400';
  try {
    sheet.getRange(rowNumber, imageIndex + 1).setValue(url);
  } catch (saveErr) {
    try { file.setTrashed(true); } catch (trashError2) {}
    throw new Error('عکس آپلود شد اما ذخیرهٔ آن در پروفایل ناموفق بود؛ دوباره تلاش کن. کد پیگیری برای بررسی در گزارش خطاها ثبت می‌شود.');
  }
  var member = findMemberByPhone(String(auth.subject || ''), true);
  return { ok: true, profileImage: url, member: member ? publicMember(member) : null };
}

function deleteRowsForMember_(sheetName, predicate) {
  var sheet = getSheet(sheetName);
  var values = sheet.getDataRange().getValues();
  if (values.length < 2) return 0;
  var headers = values[0].map(String), removed = 0;
  for (var i = values.length - 1; i >= 1; i--) {
    var obj = {};
    for (var j = 0; j < headers.length; j++) obj[headers[j]] = values[i][j];
    if (predicate(obj)) {
      sheet.deleteRow(i + 1);
      removed++;
    }
  }
  return removed;
}
function resetMemberHistory(p) {
  var auth = requireToken(p.token, ['coach']);
  if (!auth.isMaster) throw new Error('فقط مالک اصلی می‌تواند سابقه عضویت را پاک کند');
  var phone = normalizeMemberPhone(p.phone);
  if (!/^09\d{9}$/.test(phone)) throw new Error('شماره همراه عضو معتبر نیست');
  var members = getSheetObjects('اعضا').filter(function(m) {
    return normalizeMemberPhone(m.phone) === phone;
  });
  if (!members.length) throw new Error('حساب عضویت با این شماره پیدا نشد');
  var ids = {};
  members.forEach(function(m) { if (m.id) ids[String(m.id)] = true; });
  var removed = {};
  removed.ring = deleteRowsForMember_('ثبت‌نام حلقه', function(r) {
    return normalizeMemberPhone(r.phone) === phone || !!ids[String(r.memberId || '')];
  });
  removed.game = deleteRowsForMember_('بازی', function(r) {
    return !!ids[String(r.memberId || '')];
  });
  removed.attendance = deleteRowsForMember_('حضورغیاب', function(r) {
    return !!ids[String(r.memberId || '')];
  });
  removed.warnings = deleteRowsForMember_('اخطارها', function(r) {
    return !!ids[String(r.memberId || '')];
  });
  removed.camps = deleteRowsForMember_('ثبت‌نام‌ها', function(r) {
    return normalizeMemberPhone(r.phone) === phone;
  });
  removed.feedback = deleteRowsForMember_('بازخوردها', function(r) {
    return normalizeMemberPhone(r.phone) === phone;
  });
  var memberSheet = getSheet('اعضا');
  var values = memberSheet.getDataRange().getValues(), headers = values[0].map(String);
  var phoneIndex = headers.indexOf('phone'), idIndex = headers.indexOf('id'), memberRows = [];
  for (var ri = 1; ri < values.length; ri++) {
    var rowPhone = phoneIndex >= 0 ? normalizeMemberPhone(values[ri][phoneIndex]) : '';
    var rowId = idIndex >= 0 ? String(values[ri][idIndex] || '') : '';
    if (rowPhone === phone || !!ids[rowId]) memberRows.push(ri + 1);
  }
  for (var mr = memberRows.length - 1; mr >= 0; mr--) memberSheet.deleteRow(memberRows[mr]);
  return {
    ok: true,
    reset: true,
    removed: removed,
    membersRemoved: memberRows.length,
    ownerLoginPreserved: true,
    message: 'سابقه عضویت پاک شد. حساب ورود مالک بدون تغییر باقی مانده است.'
  };
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
    if (normalizeMemberPhone(rows[i].phone) === normalizeMemberPhone(phone) && (includeInactive || truthy(rows[i].active))) {
      return rows[i];
    }
  }
  return null;
}


/* -------------------------------------------------------------------------- */
/* Ring membership registration                                               */
/* -------------------------------------------------------------------------- */

function findMemberRowByPhone(sheet, phone) {
  var values = sheet.getDataRange().getValues();
  if (values.length < 2) return 0;
  var headers = values[0].map(String);
  var phoneIndex = headers.indexOf('phone');
  if (phoneIndex < 0) return 0;
  for (var i = 1; i < values.length; i++) {
    if (normalizeMemberPhone(values[i][phoneIndex]) === normalizeMemberPhone(phone)) return i + 1;
  }
  return 0;
}

function getRingRegistrationByPhone(phone) {
  var target = normalizeMemberPhone(phone);
  if (!target) return null;
  var rows = getSheetObjects('ثبت‌نام حلقه');
  for (var i = 0; i < rows.length; i++) {
    if (normalizeMemberPhone(rows[i].phone) === target) return rows[i];
  }
  return null;
}

function ringRegistrationDate(value) {
  if (Object.prototype.toString.call(value) === '[object Date]' && !isNaN(value.getTime())) {
    return Utilities.formatDate(value, CFG.TIMEZONE, 'yyyy-MM-dd');
  }
  return String(value || '');
}

function getRingRegistration(p) {
  var auth = requireToken(String(p.token || ''), ['member']);
  var registration = getRingRegistrationByPhone(auth.subject);
  if (!registration) return { ok:true, registered:false, item:null };
  return {
    ok:true,
    registered:true,
    item:{
      id:String(registration.id || ''),
      nationalCode:String(registration.nationalCode || ''),
      birthDate:ringRegistrationDate(registration.birthDate),
      fatherName:String(registration.fatherName || ''),
      fatherPhone:String(registration.fatherPhone || ''),
      address:String(registration.address || ''),
      school:String(registration.school || ''),
      grade:String(registration.grade || ''),
      guardianName:String(registration.guardianName || ''),
      emergencyPhone:String(registration.emergencyPhone || ''),
      status:String(registration.status || 'ثبت‌نام‌شده'),
      createdAt:String(registration.createdAt || '')
    }
  };
}

function normalizeJalaliRingDate_(value){
  // Accept Persian, Arabic, and Latin digits plus /, - or . separators;
  // always persist a canonical yyyy/MM/dd value.
  var normalized=normalizeIranDigits(String(value||'').trim()).replace(/[.-]/g,'/').replace(/\s+/g,'');
  var m=/^(\d{4})\/(\d{1,2})\/(\d{1,2})$/.exec(normalized);
  if(!m)return '';
  var y=Number(m[1]),mo=Number(m[2]),d=Number(m[3]);
  if(y<1300||y>1500||mo<1||mo>12||d<1)return '';
  var breaks=[-61,9,38,199,426,686,756,818,1111,1181,1210,1635,2060,2097,2192,2262,2324,2394,2456,3178];
  var leapJ=-14,jp=breaks[0],jm,jump,leapG,march,n;
  for(var i=1;i<breaks.length;i++){jm=breaks[i];jump=jm-jp;if(y<jm)break;leapJ+=Math.floor(jump/33)*8+Math.floor((jump%33)/4);jp=jm;}
  n=y-jp;leapJ+=Math.floor(n/33)*8+Math.floor(((n%33)+3)/4);
  if(((jump%33)===4)&&(jump-n===4))leapJ++;
  leapG=Math.floor((y+621)/4)-Math.floor((Math.floor((y+621)/100)+1)*3/4)-150;
  march=20+leapJ-leapG;
  if(jump-n<6)n=n-jump+Math.floor((jump+4)/33)*33;
  var leap=((n+1)%33-1)%4;if(leap===-1)leap=4;
  var leapYear=leap===0,max=mo<=6?31:(mo<=11?30:(leapYear?30:29));
  if(d>max)return '';
  return y+'/'+('0'+mo).slice(-2)+'/'+('0'+d).slice(-2);
}
function isValidJalaliRingDate(value){return !!normalizeJalaliRingDate_(value);}

function saveRingRegistration(p) {
  var auth = requireToken(String(p.token || ''), ['member']);
  var phone = normalizeMemberPhone(auth.subject);
  var member = findMemberByPhone(phone, true);
  if (!member || !truthy(member.active)) throw new Error('حساب عضو پیدا نشد؛ یک‌بار خارج شو و دوباره وارد شو');

  var nationalCode = normalizeIranDigits(String(p.nationalCode || '')).replace(/\s+/g, '');
  var birthDate = normalizeJalaliRingDate_(p.birthDate);
  var fatherName = String(p.fatherName || '').trim();
  var fatherPhone = normalizeMemberPhone(p.fatherPhone);
  var address = String(p.address || '').trim();
  var school = String(p.school || '').trim();
  var grade = String(p.grade || '').trim();
  var guardianName = String(p.guardianName || p.fatherName || '').trim();
  var emergencyPhone = normalizeMemberPhone(p.emergencyPhone || p.fatherPhone);

  if (!/^\d{10}$/.test(nationalCode)) throw new Error('کد ملی باید ۱۰ رقم باشد');
  if (!birthDate) throw new Error('تاریخ تولد شمسی معتبر نیست؛ لطفاً از تقویم یک تاریخ معتبر انتخاب کن.');
  if (!fatherName) throw new Error('نام پدر را وارد کن');
  if (!/^09\d{9}$/.test(fatherPhone)) throw new Error('شماره همراه پدر نامعتبر است');
  if (address.length < 8) throw new Error('آدرس را کامل‌تر وارد کن');
  if (!school) throw new Error('نام مدرسه را وارد کن');
  if (!grade) throw new Error('پایه تحصیلی را انتخاب کن');
  if (!guardianName) throw new Error('نام پدر را وارد کن');
  if (!/^09\d{9}$/.test(emergencyPhone)) throw new Error('شماره تماس اضطراری نامعتبر است');

  var sheet = getSheet('ثبت‌نام حلقه');
  var existingRow = findRingRegistrationRow(sheet, phone);
  var existing = {
    id: existingRow ? String(sheet.getRange(existingRow, 1).getValue() || '') : uid('RING'),
    memberId: String(member.id || ''),
    phone: phone,
    nationalCode: nationalCode,
    birthDate: birthDate,
    fatherName: fatherName,
    fatherPhone: fatherPhone,
    address: address,
    school: school,
    grade: grade,
    guardianName: guardianName,
    emergencyPhone: emergencyPhone,
    status: 'ثبت‌نام‌شده',
    createdAt: existingRow ? String(sheet.getRange(existingRow, 14).getValue() || nowIso()) : nowIso(),
    updatedAt: nowIso()
  };
  var row = rowToArray('ثبت‌نام حلقه', existing);
  if (existingRow) sheet.getRange(existingRow, 1, 1, row.length).setValues([row]);
  else sheet.appendRow(row);

  return { ok:true, registered:true, message:'ثبت‌نام در حلقه با موفقیت انجام شد', item:{
    id:existing.id, nationalCode:nationalCode, birthDate:birthDate, fatherName:fatherName,
    fatherPhone:fatherPhone, address:address, school:school, grade:grade,
    guardianName:guardianName, emergencyPhone:emergencyPhone, status:existing.status
  }};
}

function findRingRegistrationRow(sheet, phone) {
  var values = sheet.getDataRange().getValues();
  if (values.length < 2) return 0;
  var headers = values[0].map(String);
  var index = headers.indexOf('phone');
  if (index < 0) return 0;
  for (var i = 1; i < values.length; i++) {
    if (normalizeMemberPhone(values[i][index]) === normalizeMemberPhone(phone)) return i + 1;
  }
  return 0;
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
    profileImage: r.profileImage || '',
    active: truthy(r.active),
    createdAt: r.createdAt
  };
}

/* -------------------------------------------------------------------------- */
/* Events / Drive                                                             */
/* -------------------------------------------------------------------------- */

function listEventsPublic() {
  var today = currentDate();
  return getSheetObjects('رویدادها')
    .filter(function(r){
      if (!truthy(r.active)) return false;
      var eventDate = String(r.date || '').trim();
      return !eventDate || eventDate >= today;
    })
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
  var data = String(p.base64 || '').replace(/\s+/g, '');
  if (data.indexOf(',') >= 0) data = data.slice(data.lastIndexOf(',') + 1);
  if (!data || data.length > 3000000) throw new Error('حجم عکس رویداد زیاد است؛ عکس کوچک‌تری انتخاب کن');
  var mime = String(p.mimeType || 'image/jpeg').toLowerCase();
  if (['image/jpeg','image/png','image/webp'].indexOf(mime) < 0) throw new Error('فرمت عکس رویداد باید JPG، PNG یا WebP باشد');
  var bytes;
  try { bytes = Utilities.base64Decode(data); } catch (e) { throw new Error('فایل عکس رویداد معتبر نیست'); }
  if (!bytes || !bytes.length || bytes.length > 2 * 1024 * 1024) throw new Error('حجم عکس رویداد پس از فشرده‌سازی باید حداکثر ۲ مگابایت باشد');
  var ext = mime === 'image/png' ? 'png' : (mime === 'image/webp' ? 'webp' : 'jpg');
  var blob = Utilities.newBlob(bytes, mime, 'event-' + Date.now() + '.' + ext);
  var file = getDriveFolder().createFile(blob);
  try {
    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  } catch (e) {
    try { file.setTrashed(true); } catch (trashError) {}
    throw new Error('گوگل درایو اجازه نمایش عمومی عکس را نداد. تنظیمات اشتراک‌گذاری پوشهٔ تصاویر را بررسی کن.');
  }
  return { ok:true, fileId:file.getId(), url:'https://drive.google.com/thumbnail?id=' + encodeURIComponent(file.getId()) + '&sz=w1200' };
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
  if (rowObj.title.length > 160) throw new Error('عنوان رویداد نباید بیشتر از ۱۶۰ نویسه باشد');
  if (rowObj.description.length > 3000) throw new Error('توضیحات رویداد نباید بیشتر از ۳۰۰۰ نویسه باشد');
  if (rowObj.label.length > 60) throw new Error('برچسب رویداد نباید بیشتر از ۶۰ نویسه باشد');
  if (rowObj.imageUrl.length > 2048 || rowObj.imageId.length > 256) throw new Error('اطلاعات تصویر رویداد بیش از حد طولانی است');
  if (rowObj.date && !/^\d{4}-\d{2}-\d{2}$/.test(rowObj.date)) throw new Error('تاریخ رویداد معتبر نیست');
  if (!isFinite(rowObj.sort) || rowObj.sort < 0 || rowObj.sort > 9999) throw new Error('ترتیب نمایش رویداد معتبر نیست');

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
/* Activity reports / multi-photo galleries                                   */
/* -------------------------------------------------------------------------- */

function parseActivityImageIds(value) {
  if (Array.isArray(value)) return value.map(function(x){ return String(x || '').trim(); }).filter(Boolean);
  try {
    var parsed = JSON.parse(String(value || '[]'));
    return Array.isArray(parsed) ? parsed.map(function(x){ return String(x || '').trim(); }).filter(Boolean) : [];
  } catch (e) {
    return [];
  }
}

function activityReportObject(row) {
  var ids = parseActivityImageIds(row.imageIds).slice(0, 10);
  return {
    id: String(row.id || ''),
    title: String(row.title || ''),
    description: String(row.description || ''),
    date: String(row.date || ''),
    images: ids.map(function(id){
      return {
        fileId: id,
        url: 'https://drive.google.com/thumbnail?id=' + encodeURIComponent(id) + '&sz=w1200'
      };
    }),
    active: truthy(row.active),
    createdAt: String(row.createdAt || ''),
    updatedAt: String(row.updatedAt || '')
  };
}

function listActivityReportsPublic() {
  return getSheetObjects('گزارش فعالیت‌ها')
    .filter(function(row){ return truthy(row.active); })
    .sort(function(a,b){
      var ad = String(a.date || a.createdAt || '');
      var bd = String(b.date || b.createdAt || '');
      return bd.localeCompare(ad);
    })
    .map(activityReportObject);
}

function listActivityReportsManage() {
  return getSheetObjects('گزارش فعالیت‌ها')
    .filter(function(row){ return truthy(row.active); })
    .sort(function(a,b){
      return String(b.createdAt || '').localeCompare(String(a.createdAt || ''));
    })
    .map(activityReportObject);
}

function uploadActivityPhoto(p) {
  var data = String(p.base64 || '').replace(/^data:image\/[a-zA-Z0-9.+-]+;base64,/, '');
  if (!data) throw new Error('عکس انتخاب‌شده خالی است');
  var mime = String(p.mimeType || 'image/jpeg').toLowerCase();
  if (['image/jpeg','image/png','image/webp'].indexOf(mime) < 0) {
    throw new Error('فرمت عکس پشتیبانی نمی‌شود؛ عکس را با فرمت JPG، PNG یا WebP انتخاب کن');
  }
  var bytes;
  try { bytes = Utilities.base64Decode(data); }
  catch (e) { throw new Error('اطلاعات عکس قابل خواندن نیست'); }
  if (!bytes.length) throw new Error('عکس انتخاب‌شده خالی است');
  if (bytes.length > 2 * 1024 * 1024) throw new Error('حجم عکس پس از فشرده‌سازی هنوز زیاد است؛ عکس کوچک‌تری انتخاب کن');
  var ext = mime === 'image/png' ? 'png' : (mime === 'image/webp' ? 'webp' : 'jpg');
  var blob = Utilities.newBlob(bytes, mime, 'activity-' + Date.now() + '-' + Math.floor(Math.random() * 100000) + '.' + ext);
  var file = getDriveFolder().createFile(blob);
  try {
    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  } catch (e) {
    try { file.setTrashed(true); } catch (trashError) {}
    throw new Error('گوگل درایو اجازه نمایش عمومی عکس را نداد. تنظیمات اشتراک‌گذاری پوشهٔ تصاویر را بررسی کن.');
  }
  return { ok:true, fileId:file.getId() };
}


function cleanupUnusedEventPhoto_(imageId) {
  var id = String(imageId || '').trim();
  if (!/^[A-Za-z0-9_-]{10,}$/.test(id)) return false;
  try {
    var referenced = getSheetObjects('رویدادها').some(function(row) {
      return String(row.imageId || '').trim() === id;
    });
    if (referenced) return false;
    var file = DriveApp.getFileById(id);
    if (!/^event-/i.test(String(file.getName() || ''))) return false;
    var parents = file.getParents(), insideTargetFolder = false;
    while (parents.hasNext()) {
      if (parents.next().getId() === CFG.DRIVE_FOLDER_ID) { insideTargetFolder = true; break; }
    }
    if (!insideTargetFolder || file.isTrashed()) return false;
    file.setTrashed(true);
    return true;
  } catch (e) {
    return false;
  }
}

function cleanupUnusedActivityPhotos_(imageIds) {
  var ids = parseActivityImageIds(imageIds).filter(function(id, index, list) {
    return list.indexOf(id) === index && /^[A-Za-z0-9_-]{10,}$/.test(id);
  }).slice(0, 10);
  if (!ids.length) return 0;

  // Never trash a photo that any saved report still references.
  var referenced = {};
  getSheetObjects('گزارش فعالیت‌ها').forEach(function(row) {
    parseActivityImageIds(row.imageIds).forEach(function(id) { referenced[id] = true; });
  });

  var trashed = 0;
  ids.forEach(function(id) {
    if (referenced[id]) return;
    try {
      var file = DriveApp.getFileById(id);
      if (!/^activity-/.test(String(file.getName() || ''))) return;
      var parents = file.getParents(), insideTargetFolder = false;
      while (parents.hasNext()) {
        if (parents.next().getId() === CFG.DRIVE_FOLDER_ID) { insideTargetFolder = true; break; }
      }
      if (!insideTargetFolder || file.isTrashed()) return;
      file.setTrashed(true);
      trashed++;
    } catch (e) {
      // One inaccessible item must not stop cleanup of the remaining uploads.
    }
  });
  return trashed;
}

function validateActivityPhotoFiles_(ids) {
  ids.forEach(function(id) {
    try {
      var file = DriveApp.getFileById(id);
      if (file.isTrashed() || !/^activity-/.test(String(file.getName() || ''))) {
        throw new Error('invalid');
      }
      var parents = file.getParents(), insideTargetFolder = false;
      while (parents.hasNext()) {
        if (parents.next().getId() === CFG.DRIVE_FOLDER_ID) { insideTargetFolder = true; break; }
      }
      if (!insideTargetFolder) throw new Error('invalid');
    } catch (e) {
      throw new Error('یکی از عکس‌ها در پوشهٔ گزارش‌های فعالیت ثبت نشده است؛ عکس‌ها را دوباره انتخاب و بارگذاری کن');
    }
  });
}

function saveActivityReport(p) {
  var title = String(p.title || '').trim();
  var description = String(p.description || '').trim();
  var date = String(p.date || '').trim();
  if (!title) throw new Error('عنوان گزارش اردو یا فعالیت را وارد کن');
  if (title.length > 160) throw new Error('عنوان گزارش نباید بیشتر از ۱۶۰ نویسه باشد');
  if (description.length > 6000) throw new Error('توضیحات گزارش بیش از حد طولانی است');
  if (date && !/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error('تاریخ گزارش معتبر نیست');
  var ids = parseActivityImageIds(p.imageIds);
  ids = ids.filter(function(id, index){ return ids.indexOf(id) === index; });
  if (!ids.length) throw new Error('برای ثبت گزارش دست‌کم یک عکس انتخاب کن');
  if (ids.length > 10) throw new Error('هر گزارش حداکثر می‌تواند ۱۰ عکس داشته باشد');
  ids.forEach(function(id){
    if (!/^[A-Za-z0-9_-]{10,}$/.test(id)) throw new Error('شناسه یکی از عکس‌ها معتبر نیست');
  });
  var auth = requireToken(p.token, ['coach']);
  if (!auth.isMaster) requireCoachPermission(p.token, 'events');
  validateActivityPhotoFiles_(ids);
  var now = nowIso();
  var obj = {
    id: uid('ACT'),
    title: title,
    description: description,
    date: date,
    imageIds: JSON.stringify(ids),
    active: true,
    createdAt: now,
    updatedAt: now,
    createdBy: String(auth.subject || '')
  };
  getSheet('گزارش فعالیت‌ها').appendRow(rowToArray('گزارش فعالیت‌ها', obj));
  return { ok:true, id:obj.id, photoCount:ids.length };
}

function deleteActivityReport(id) {
  if (!id) throw new Error('شناسه گزارش مشخص نیست');
  var sheet = getSheet('گزارش فعالیت‌ها');
  var pos = findRow(sheet, 'id', id);
  if (!pos) throw new Error('گزارش فعالیت پیدا نشد یا قبلاً حذف شده است');
  var headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0].map(String);
  var imageColumn = headers.indexOf('imageIds');
  var imageIds = imageColumn >= 0 ? parseActivityImageIds(sheet.getRange(pos, imageColumn + 1).getValue()) : [];
  sheet.deleteRow(pos);
  var cleaned = cleanupUnusedActivityPhotos_(imageIds);
  return { ok:true, photosTrashed:cleaned };
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

  var id = uid('FDB');
  getSheet('بازخوردها').appendRow([id, name, phone, category, message, 'جدید', nowIso()]);
  return { ok: true, id: id, message: 'پیام با موفقیت ثبت شد' };
}

function listFeedbackRecords() {
  return getSheetObjects('بازخوردها').sort(byNewest).map(function(r) {
    return {
      id: String(r.id || ''),
      name: String(r.name || ''),
      phone: String(r.phone || ''),
      category: String(r.category || 'سایر'),
      message: String(r.message || ''),
      status: String(r.status || 'جدید'),
      createdAt: String(r.createdAt || '')
    };
  });
}

function setFeedbackStatus(p) {
  requireCoachPermission(p.token, 'feedback');
  var id = String(p.id || '').trim();
  var status = String(p.status || '').trim();
  if (['جدید', 'در حال بررسی', 'بررسی شد'].indexOf(status) < 0) throw new Error('وضعیت پیام نامعتبر است');
  var sheet = getSheet('بازخوردها');
  var rowNumber = findRow(sheet, 'id', id);
  if (!rowNumber) throw new Error('پیام پیدا نشد');
  var headers = sheet.getDataRange().getValues()[0].map(String);
  var statusIndex = headers.indexOf('status');
  if (statusIndex < 0) throw new Error('ستون وضعیت پیام پیدا نشد');
  sheet.getRange(rowNumber, statusIndex + 1).setValue(status);
  return { ok: true, id: id, status: status };
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
  var campId = String(p.campId || '').trim();
  var firstName = String(p.firstName || '').trim();
  var lastName = String(p.lastName || '').trim();
  var fatherName = String(p.fatherName || '').trim();
  var phone = normalizeIranMobile_(p.phone || '');
  var fatherPhone = normalizeIranMobile_(p.fatherPhone || '');
  var nationalCode = normalizeIranDigits(String(p.nationalCode || '')).replace(/\s+/g, '');
  if (!campId) throw new Error('اردو انتخاب نشده');
  if (!listCamps().some(function(camp){ return String(camp.id) === campId; })) throw new Error('این اردو دیگر فعال نیست؛ صفحه را تازه‌سازی کن');
  if (!firstName || !lastName || !fatherName) throw new Error('اطلاعات ناقص است');
  if (!/^09\d{9}$/.test(phone)) throw new Error('شماره همراه نامعتبر است');
  if (!/^09\d{9}$/.test(fatherPhone)) throw new Error('شماره همراه پدر نامعتبر است');
  if (nationalCode && !/^\d{10}$/.test(nationalCode)) throw new Error('کد ملی باید ۱۰ رقم باشد');

  if (!p.photoBase64) throw new Error('عکس رضایت‌نامه پدر الزامی است');

  var photoUrl = '';
  if (p.photoBase64) {
    var uploaded = uploadConsentPhotoPrivate(
      String(p.photoBase64),
      String(p.photoMimeType || 'image/jpeg'),
      'registration-' + Date.now()
    );
    photoUrl = uploaded.url;
  }

  var sheet = getSheet('ثبت‌نام‌ها');
  var row = {
    id: uid('REG'),
    campId: campId,
    firstName: firstName,
    lastName: lastName,
    fatherName: fatherName,
    fatherPhone: fatherPhone,
    phone: phone,
    nationalCode: nationalCode,
    photoUrl: photoUrl,
    status: 'در انتظار تایید',
    createdAt: nowIso(),
    updatedAt: nowIso()
  };
  sheet.appendRow(rowToArray('ثبت‌نام‌ها', row));
  return { ok: true, id: row.id, status: row.status };
}

function getRegistrationPhoto(p) {
  requireCoachPermission(p.token, 'registrations');
  var registrationId = String(p.id || '').trim();
  if (!registrationId) throw new Error('شناسهٔ ثبت‌نام مشخص نیست');
  var registration = getSheetObjects('ثبت‌نام‌ها').filter(function(row) {
    return String(row.id || '') === registrationId;
  })[0];
  if (!registration) throw new Error('ثبت‌نام پیدا نشد');
  var url = String(registration.photoUrl || '');
  var match = /[?&]id=([A-Za-z0-9_-]{10,})/.exec(url);
  if (!match) throw new Error('برای این ثبت‌نام عکس رضایت‌نامه‌ای ثبت نشده است');
  var file;
  try { file = DriveApp.getFileById(match[1]); }
  catch (e) { throw new Error('فایل رضایت‌نامه پیدا نشد یا دسترسی به آن ممکن نیست'); }
  if (file.isTrashed() || !/^registration-/i.test(String(file.getName() || ''))) {
    throw new Error('فایل به‌عنوان عکس رضایت‌نامه قابل تأیید نیست');
  }
  var parents = file.getParents(), insideTargetFolder = false;
  while (parents.hasNext()) {
    if (parents.next().getId() === CFG.DRIVE_FOLDER_ID) { insideTargetFolder = true; break; }
  }
  if (!insideTargetFolder) throw new Error('فایل در پوشهٔ خصوصی رضایت‌نامه‌ها نیست');
  try {
    file.setSharing(DriveApp.Access.PRIVATE, DriveApp.Permission.NONE);
    if (file.getSharingAccess() !== DriveApp.Access.PRIVATE) throw new Error('PRIVATE_ACCESS_NOT_CONFIRMED');
  } catch (e) {
    throw new Error('نشد دسترسی عمومی این رضایت‌نامه را بست؛ اشتراک‌گذاری فایل را در Google Drive بررسی کن');
  }
  var blob = file.getBlob();
  var bytes = blob.getBytes();
  if (!bytes || !bytes.length || bytes.length > 5 * 1024 * 1024) throw new Error('حجم فایل رضایت‌نامه برای نمایش بیش از حد مجاز است');
  return {
    ok:true,
    mimeType:String(blob.getContentType() || 'image/jpeg'),
    base64:Utilities.base64Encode(bytes)
  };
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
  var official = requireToken(p.token, ['attendance']);
  var date = String(p.date || currentDate());
  if (date !== currentDate()) throw new Error('ثبت حضور فقط برای امروز مجاز است');
  var records = Array.isArray(p.records) ? p.records : [];
  if (!records.length) throw new Error('رکوردی برای ذخیره وجود ندارد');
  if (records.length > 500) throw new Error('تعداد رکوردهای حضور بیش از حد مجاز است');

  var lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    if (hasAttendanceDate(date)) throw new Error('حضور امروز قبلاً ثبت شده و دیگر قابل ثبت مجدد نیست');

    var sheet = getSheet('حضورغیاب');
    var activeMembers = getSheetObjects('اعضا').filter(function(m) { return truthy(m.active); });
    var memberById = {};
    activeMembers.forEach(function(m) { memberById[String(m.id)] = m; });
    var seen = {};
    var now = nowIso();
    var values = [];
    var validStatuses = ['حاضر', 'موجه', 'غیبت'];

    records.forEach(function(r) {
      if (!r || typeof r !== 'object') throw new Error('یکی از رکوردهای حضور نامعتبر است');
      var memberId = String(r.memberId || '').trim();
      if (!memberId || !memberById[memberId]) throw new Error('یکی از اعضا پیدا نشد یا غیرفعال است؛ فهرست را تازه‌سازی کن');
      if (seen[memberId]) throw new Error('برای یک عضو بیش از یک وضعیت ارسال شده است');
      seen[memberId] = true;
      var status = String(r.status || '').trim();
      if (validStatuses.indexOf(status) < 0) throw new Error('وضعیت حضور یکی از اعضا معتبر نیست');
      var note = String(r.note || '').trim();
      if (note.length > 500) throw new Error('یادداشت حضور نباید بیشتر از ۵۰۰ نویسه باشد');
      var member = memberById[memberId];
      var recordName = String(member.name || [member.firstName, member.lastName].filter(Boolean).join(' ') || 'عضو').trim();
      values.push([date, memberId, recordName, status, note, official.subject, now]);
    });

    if (!values.length) throw new Error('رکورد معتبر وجود ندارد');
    sheet.getRange(sheet.getLastRow() + 1, 1, values.length, 7).setValues(values);
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
  if (!member || !truthy(member.active)) throw new Error('حساب عضو پیدا نشد یا غیرفعال است');
  if (!getRingRegistrationByPhone(auth.subject)) throw new Error('برای بازی ابتدا ثبت‌نام در حلقه را تکمیل کن');
  var score = Math.floor(Number(p.score || 0));
  if (!isFinite(score) || score < 0 || score > 100000) throw new Error('امتیاز نامعتبر است');
  var memberSheet = getSheet('اعضا');
  var memberRow = findRow(memberSheet, 'id', member.id);
  if (!memberRow) throw new Error('رکورد عضو پیدا نشد');
  var week = currentWeekKey(), sheet = getSheet('بازی');
  var lock = LockService.getScriptLock(); lock.waitLock(10000);
  try {
    var rows = getSheetObjects('بازی'), existing = null, existingRow = 0;
    for (var i = 0; i < rows.length; i++) {
      if (String(rows[i].weekKey) === week && String(rows[i].memberId) === String(member.id)) {
        existing = rows[i];
        existingRow = findRow(sheet, 'weekKey', week, 'memberId', member.id);
        break;
      }
    }

    var playerName = String(member.nickname || member.name || 'عضو').trim();
    var weeklyBest = existing ? Number(existing.score || 0) : 0;
    var lifetimeBest = Number(member.bestScore || 0);

    // رکورد هفتگی و رکورد تاریخی مستقل‌اند.
if (score <= weeklyBest) {
  return {ok:true, saved:false, score:weeklyBest, weekKey:week, lifetimeBest:lifetimeBest,
    leaderboard:leaderboardForWeek(week), allTimeLeaderboard:allTimeLeaderboard()};
}

// رکورد هفتگی با امتیاز بهتر به‌روز می‌شود؛ رکورد تاریخی فقط هنگام شکستن بهترین قبلی تغییر می‌کند.
if (score > lifetimeBest) {
  memberSheet.getRange(memberRow, 8).setValue(score);
  lifetimeBest = score;
}

    if (existing) {
      var vals = sheet.getRange(existingRow, 1, 1, 5).getValues()[0];
      vals[1] = member.id;
      vals[2] = playerName;
      vals[3] = score;
      vals[4] = nowIso();
      sheet.getRange(existingRow, 1, 1, 5).setValues([vals]);
    } else {
      sheet.appendRow([week, member.id, playerName, score, nowIso()]);
    }

    return {ok:true, saved:true, score:score, weekKey:week, lifetimeBest:lifetimeBest,
      leaderboard:leaderboardForWeek(week), allTimeLeaderboard:allTimeLeaderboard()};
  } finally {
    lock.releaseLock();
  }
}
function registeredRingPhones_(){
  var phones={};
  getSheetObjects('ثبت‌نام حلقه').forEach(function(r){
    var phone=normalizeMemberPhone(r.phone);
    if(phone)phones[phone]=true;
  });
  return phones;
}
function gameRoleMap_(members, registeredPhones){
  var byPhone={}, byId={}, master=getMasterCoachConfig();
  var masterPhone=normalizeMemberPhone(master.phone);
  if(masterPhone)byPhone[masterPhone]={roleKey:'owner',roleLabel:'مالک'};
  getSheetObjects('مربیان').forEach(function(r){
    if(!truthy(r.active))return;
    var phone=normalizeMemberPhone(r.phone);
    if(!phone)return;
    if(String(r.role||'')==='master'||(masterPhone&&phone===masterPhone))byPhone[phone]={roleKey:'owner',roleLabel:'مالک'};
    else if(!byPhone[phone])byPhone[phone]={roleKey:'coach',roleLabel:'مربی'};
  });
  getSheetObjects('مسئولین').forEach(function(r){
    if(!truthy(r.active))return;
    var phone=normalizeMemberPhone(r.phone);
    if(phone&&!byPhone[phone])byPhone[phone]={roleKey:'official',roleLabel:'مسئول'};
  });
  members.forEach(function(m){
    var id=String(m.id||''),phone=normalizeMemberPhone(m.phone),role;
    // نقش‌های ویژه مستقل از ثبت‌نام عادی حلقه هستند؛ مالک همیشه قاب ویژه دارد.
    if(byPhone[phone])role=byPhone[phone];
    else if(registeredPhones[phone])role={roleKey:'member',roleLabel:'عضو حلقه'};
    else role={roleKey:'unregistered',roleLabel:'هنوز عضو نشده'};
    byId[id]=role;
  });
  return byId;
}
function leaderboardForWeek(week) {
  var members=getSheetObjects('اعضا'),memberById={};
  members.forEach(function(m){memberById[String(m.id||'')]=m;});
  var registeredPhones=registeredRingPhones_(),roles=gameRoleMap_(members,registeredPhones);
  return getSheetObjects('بازی')
    .filter(function(r){return String(r.weekKey)===String(week);})
    .map(function(r){
      var id=String(r.memberId||''),member=memberById[id]||{},role=roles[id]||{roleKey:'unregistered',roleLabel:'عضو نشده'};
      return {memberId:id,playerName:r.playerName,score:Number(r.score||0),profileImage:String(member.profileImage||''),registered:!!registeredPhones[normalizeMemberPhone(member.phone)],roleKey:role.roleKey,roleLabel:role.roleLabel};
    })
    .sort(function(a,b){return b.score-a.score;})
    .slice(0,10);
}
function allTimeLeaderboard() {
  var members=getSheetObjects('اعضا'),registeredPhones=registeredRingPhones_(),roles=gameRoleMap_(members,registeredPhones);
  return members.filter(function(r){return truthy(r.active)&&Number(r.bestScore||0)>0;})
    .map(function(r){
      var id=String(r.id||''),role=roles[id]||{roleKey:'unregistered',roleLabel:'عضو نشده'};
      return {memberId:id,playerName:String(r.nickname||r.name||'عضو'),score:Number(r.bestScore||0),profileImage:String(r.profileImage||''),registered:!!registeredPhones[normalizeMemberPhone(r.phone)],roleKey:role.roleKey,roleLabel:role.roleLabel};
    })
    .sort(function(a,b){return b.score-a.score;})
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

function uploadConsentPhotoPrivate(base64, mime, name) {
  var data = String(base64 || '').replace(/\\s+/g, '');
  if (data.indexOf(',') >= 0) data = data.slice(data.lastIndexOf(',') + 1);
  if (!data || data.length > 7100000) throw new Error('حجم عکس رضایت‌نامه باید حداکثر ۵ مگابایت باشد');
  var type = String(mime || 'image/jpeg').toLowerCase();
  if (['image/jpeg','image/png','image/webp'].indexOf(type) < 0) throw new Error('فرمت عکس رضایت‌نامه باید JPG، PNG یا WebP باشد');
  var bytes;
  try { bytes = Utilities.base64Decode(data); } catch (e) { throw new Error('فایل رضایت‌نامه معتبر نیست'); }
  if (!bytes || !bytes.length || bytes.length > 5 * 1024 * 1024) throw new Error('حجم عکس رضایت‌نامه باید حداکثر ۵ مگابایت باشد');
  var blob = Utilities.newBlob(bytes, type, String(name || ('registration-' + Date.now())));
  var file = getDriveFolder().createFile(blob);
  try {
    file.setSharing(DriveApp.Access.PRIVATE, DriveApp.Permission.NONE);
    if (file.getSharingAccess() !== DriveApp.Access.PRIVATE) throw new Error('PRIVATE_ACCESS_NOT_CONFIRMED');
  } catch (e) {
    try { file.setTrashed(true); } catch (trashError) {}
    throw new Error('گوگل درایو اجازهٔ خصوصی‌ماندن عکس رضایت‌نامه را نداد. پوشهٔ تصاویر را بررسی کن.');
  }
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
