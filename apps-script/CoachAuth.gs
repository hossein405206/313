/* ============================================================================
   احراز هویت مربیان — فایل مستقل
   این فایل همراه با Code.gs داخل همان پروژه Google Apps Script قرار می‌گیرد.
   ============================================================================ */

function verifyCoachCode(code) {
  var rows=getSheetObjects('مربیان');
  for(var i=0;i<rows.length;i++){var r=rows[i];if(truthy(r.active)&&String(r.code).toUpperCase()===String(code).toUpperCase())return {code:String(r.code),name:String(r.name||''),phone:String(r.phone||''),role:String(r.role||'coach'),isMaster:String(r.role||'')==='master'};}
  return null;
}
function loginCoach(p){
  var phone=normalizeIranDigits(String(p.phone||'').trim()).replace(/\s+/g,'');
  var code=String(p.code||'').trim();
  if(!/^09\d{9}$/.test(phone)) throw new Error('شماره مربی نامعتبر است');
  if(!code) throw new Error('کد مربی را وارد کن');

  // مربی ارشد مستقیماً از تنظیمات اصلی احراز می‌شود؛
  // بنابراین ورود به وجود ردیف شیت مربیان وابسته نیست.
  if(phone===CFG.MASTER_COACH_PHONE && code===CFG.MASTER_COACH_CODE){
    ensureMasterCoach();
    return {
      ok:true,
      coach:{name:CFG.MASTER_COACH_NAME,phone:CFG.MASTER_COACH_PHONE,role:'master',isMaster:true},
      token:issueToken('coach',CFG.MASTER_COACH_CODE,true)
    };
  }

  var coachSheet=getSheet('مربیان');
  migrateSheetHeaders(coachSheet,'مربیان');
  var rows=getSheetObjects('مربیان');
  var coach=rows.filter(function(r){
    var rowPhone=normalizeIranDigits(String(r.phone||'').trim()).replace(/\s+/g,'');
    var rowCode=String(r.code||'').trim();
    return truthy(r.active)&&rowPhone===phone&&rowCode===code;
  })[0];

  if(!coach) throw new Error('شماره یا کد مربی نادرست است');
  var isMaster=String(coach.role||'')==='master';
  return {
    ok:true,
    coach:{name:coach.name,phone:phone,role:coach.role,isMaster:isMaster},
    token:issueToken('coach',coach.code,isMaster)
  };
}
function ensureMasterCoach(){
  var rows=getSheetObjects('مربیان');
  var found=rows.some(function(r){return String(r.phone)===CFG.MASTER_COACH_PHONE&&String(r.code)===CFG.MASTER_COACH_CODE;});
  if(!found)getSheet('مربیان').appendRow([CFG.MASTER_COACH_CODE,CFG.MASTER_COACH_NAME,CFG.MASTER_COACH_PHONE,true,'master',nowIso(),nowIso()]);
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
  if(rows.some(function(r){return truthy(r.active)&&String(r.phone)===phone;}))throw new Error('این شماره قبلاً ثبت شده');
  if(rows.some(function(r){return truthy(r.active)&&String(r.code)===code;}))throw new Error('این کد قبلاً استفاده شده');
  getSheet('مربیان').appendRow([code,name,phone,true,'coach',nowIso(),nowIso()]);
  return {ok:true,coach:{name:name,phone:phone,role:'coach',isMaster:false}};
}
