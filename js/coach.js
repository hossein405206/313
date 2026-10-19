(function(){'use strict';
var $=function(s){return document.querySelector(s)},state={token:'',name:'',isMaster:false,permissions:{},events:[],data:null};
var PERMS=[['events','رویدادها'],['schedule','برنامه هفتگی'],['registrations','ثبت‌نام‌ها'],['reports','گزارش‌ها'],['game','جایزه بازی'],['officials','مدیریت مسئولین'],['feedback','انتقاد و پیشنهاد']];
function api(){return window.KanoonApp&&window.KanoonApp.api}
function sessionGet(key){try{return window.sessionStorage.getItem(key)||''}catch(e){return ''}}
function sessionSet(key,value){try{window.sessionStorage.setItem(key,value);return true}catch(e){return false}}
function sessionRemove(key){try{window.sessionStorage.removeItem(key)}catch(e){}}
function normalizeDigits(v){return String(v||'').replace(/[۰-۹]/g,function(c){return String('۰۱۲۳۴۵۶۷۸۹'.indexOf(c))}).replace(/[٠-٩]/g,function(c){return String('٠١٢٣٤٥٦٧٨٩'.indexOf(c))})}
function normalizeIranMobileInput(v){var p=normalizeDigits(v).replace(/\D/g,'');if(/^00989\d{9}$/.test(p))return '0'+p.slice(4);if(/^989\d{9}$/.test(p))return '0'+p.slice(2);if(/^9\d{9}$/.test(p))return '0'+p;return p}
function toast(m,e){var t=window.KanoonApp&&window.KanoonApp.toast;if(t)(e?t.error:t.success)(m)}
function esc(s){return String(s==null?'':s).replace(/[&<>"]/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]})}
function setBusy(btn,text){if(btn){btn.disabled=true;btn.dataset.oldText=btn.textContent;btn.textContent=text||'در حال پردازش...'}}
function clearBusy(btn){if(btn){btn.disabled=false;btn.textContent=btn.dataset.oldText||'ذخیره'}}
function scheduleDayIndex(day){return ['شنبه','یکشنبه','دوشنبه','سهشنبه','چهارشنبه','پنجشنبه','جمعه'].indexOf(String(day||'').replace(/\u200c/g,''))}
function sortScheduleRows(list){return list.sort(function(a,b){var ai=scheduleDayIndex(a.day),bi=scheduleDayIndex(b.day);if(ai<0)ai=99;if(bi<0)bi=99;if(ai!==bi)return ai-bi;return String(a.createdAt||'').localeCompare(String(b.createdAt||''))||String(a.title||'').localeCompare(String(b.title||''),'fa')})}
function renderCoachRoleBadge(){var badge=$('#coachRoleBadge');if(!badge)return;badge.textContent=state.isMaster?'مربی ارشد':'مربی';badge.classList.toggle('is-owner',state.isMaster);badge.classList.toggle('is-coach',!state.isMaster)}

function renderPermissionChecks(root,values){
 if(!root)return;
 values=values||{};
 root.innerHTML=PERMS.map(function(p){return '<label class="permission-item"><input type="checkbox" data-permission="'+p[0]+'" '+(values[p[0]]?'checked':'')+'><span>'+p[1]+'</span></label>'}).join('');
}
function readPermissions(root){
 var out={};if(!root)return out;
 root.querySelectorAll('[data-permission]').forEach(function(x){out[x.getAttribute('data-permission')]=x.checked});
 return out;
}
function applyPermissions(){
 document.querySelectorAll('.coach-permission-section,.coach-quick-link').forEach(function(s){
   var p=s.getAttribute('data-permission');s.classList.toggle('permission-hidden',!state.isMaster && state.permissions[p]!==true);
 });
 var staff=$('#coachStaffPanel'),official=$('#officialStaffPanel');
 if(staff)staff.classList.toggle('hidden',!state.isMaster);
 if(official)official.classList.toggle('hidden',!state.isMaster && state.permissions.officials!==true);
 var resetPanel=$('#memberResetPanel');if(resetPanel)resetPanel.classList.toggle('hidden',!state.isMaster);
}
function login(){
 var f=$('#coachLoginForm');
 if(!f||f.dataset.coachLoginBound==='1')return;
 f.dataset.coachLoginBound='1';
 f.addEventListener('submit',async function(e){
  e.preventDefault();
  var phoneField=$('#coachPhone'),codeField=$('#coachCode');
  if(!phoneField||!codeField){toast('فرم ورود کامل بارگذاری نشده است؛ صفحه را تازه‌سازی کن',1);return}
  var phone=normalizeIranMobileInput(phoneField.value),code=String(codeField.value||'').trim();
  phoneField.value=phone;
  if(!/^09\d{9}$/.test(phone)){toast('شماره مربی نامعتبر است',1);return}
  if(!code){toast('کد مربی را وارد کن',1);return}
  var btn=f.querySelector('button[type="submit"],button');
  setBusy(btn,'در حال ورود...');
  try{
   var client=api();
   if(!client||typeof client.post!=='function')throw new Error('بخش ارتباط با سرور بارگذاری نشده است؛ صفحه را تازه‌سازی کن');
   var r=await client.post({action:'loginCoach',phone:phone,code:code});
   var coach=r&&r.coach;
   if(!r||!r.ok||!coach||!r.token){
    console.error('[CoachLogin] پاسخ ناقص یا ناسازگار از سرور',{hasResponse:!!r,keys:r&&Object.keys(r),version:r&&r.version,requestId:r&&r.requestId});
    throw new Error((r&&r.error)||'پاسخ ورود مربی ناقص است؛ نسخهٔ منتشرشدهٔ Google Apps Script را بررسی کن.');
   }
   state.token=r.token;state.name=String(coach.name||'مربی');state.isMaster=!!coach.isMaster;state.permissions=coach.permissions||{};
   sessionSet('coach_token',state.token);sessionSet('coach_name',state.name);sessionSet('coach_master',state.isMaster?'1':'0');sessionSet('coach_permissions',JSON.stringify(state.permissions));
   var loginPanel=$('#coachLogin'),dashboard=$('#coachDashboard'),nameEl=$('#coachName');
   if(loginPanel)loginPanel.classList.add('hidden');
   if(dashboard)dashboard.classList.remove('hidden');
   if(nameEl)nameEl.textContent=state.name;
   renderCoachRoleBadge();applyPermissions();
   await load();
   if(state.isMaster)loadCoaches();
   if(state.isMaster||state.permissions.events)loadCamps();
   if(state.isMaster||state.permissions.officials)loadOfficials();
   if(state.isMaster||state.permissions.feedback)loadFeedback();
  }catch(err){
   console.error('[CoachLogin] ورود ناموفق بود',err);
   toast(err&&err.message||'ورود ناموفق بود؛ اتصال اینترنت را بررسی کن',1);
  }finally{clearBusy(btn)}
 });
}
async function load(){
 var r=await api().post({action:'getDashboard',token:state.token});state.data=r;state.events=r.events||[];renderAttendanceTrend(r.attendanceTrend||[]);renderStats(r.stats);renderEvents(state.events);renderRegs(r.registrations||[]);renderAttendance(r.attendance||[]);renderWarnings(r.warnings||[]);$('#gamePrize').value=r.prize||'به بیشترین رکورد هفته جایزه داده می شود';if(state.isMaster||state.permissions.events){loadActivityReports();loadCamps();}}

function renderAttendanceTrend(items){
 var chart=$('#attendanceTrendChart'),summary=$('#attendanceTrendSummary');
 if(!chart)return;
 items=Array.isArray(items)?items:[];
 if(!items.length){chart.innerHTML='<p class="muted">هنوز داده‌ای از حضور و غیاب ثبت نشده است.</p>';if(summary)summary.innerHTML='<span>حاضران امروز</span><strong>— نفر</strong>';return;}
 var values=items.map(function(x){return Math.max(0,Number(x.present||0));});
 var todayValue=values.length?values[values.length-1]:0;
 var max=Math.max.apply(Math,values.concat([1]));
 var left=35,right=605,top=25,bottom=146,width=640,height=205;
 var coords=values.map(function(v,i){return {x:left+(right-left)*(values.length<=1?0:i/(values.length-1)),y:bottom-(v/max)*(bottom-top),v:v};});
 var line=coords.map(function(p,i){return (i?'L':'M')+p.x.toFixed(1)+' '+p.y.toFixed(1)}).join(' ');
 var area=line+' L '+right+' '+bottom+' L '+left+' '+bottom+' Z';
 var grid='';
 for(var g=0;g<4;g++){var y=top+(bottom-top)*g/3;grid+='<line x1="'+left+'" y1="'+y.toFixed(1)+'" x2="'+right+'" y2="'+y.toFixed(1)+'" stroke="#dce6e3" stroke-dasharray="4 5"/>';}
 var labels=coords.map(function(p,i){var label=i===coords.length-1?'امروز':(coords.length-1-i)+' روز قبل';return '<text x="'+p.x.toFixed(1)+'" y="174" text-anchor="middle" fill="'+(i===coords.length-1?'#087b66':'#7f918d')+'" font-size="'+(i===coords.length-1?'12':'10')+'" font-weight="'+(i===coords.length-1?'800':'500')+'">'+label+'</text><text x="'+p.x.toFixed(1)+'" y="'+Math.max(15,p.y-10).toFixed(1)+'" text-anchor="middle" fill="#244740" font-size="11" font-weight="800">'+p.v.toLocaleString('fa-IR')+'</text>';}).join('');
 var dots=coords.map(function(p,i){return '<circle cx="'+p.x.toFixed(1)+'" cy="'+p.y.toFixed(1)+'" r="'+(i===coords.length-1?5:3.5)+'" fill="'+(i===coords.length-1?'#087b66':'#5fb6a1')+'" stroke="#fff" stroke-width="2"/>';}).join('');
 chart.innerHTML='<svg viewBox="0 0 '+width+' '+height+'" role="img" aria-label="روند حضور ۸ روز اخیر" xmlns="http://www.w3.org/2000/svg"><defs><linearGradient id="attendanceTrendFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#21a58a" stop-opacity=".24"/><stop offset="100%" stop-color="#21a58a" stop-opacity=".015"/></linearGradient></defs>'+grid+'<path d="'+area+'" fill="url(#attendanceTrendFill)"/><path d="'+line+'" fill="none" stroke="#168b75" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"/>'+dots+labels+'</svg><p class="attendance-trend-note">فقط افرادی شمرده می‌شوند که وضعیتشان «حاضر» ثبت شده باشد.</p>';
 if(summary)summary.innerHTML='<span>حاضران امروز</span><strong>'+todayValue.toLocaleString('fa-IR')+' نفر</strong>';
}
function renderStats(s){$('#coachStats').innerHTML=[['اعضای فعال',s.activeMembers],['در انتظار تایید',s.pendingRegistrations],['حضور امروز',s.todayAttendance],['اخطار ماه',s.monthWarnings]].map(function(x){return '<div class="coach-stat"><strong>'+Number(x[1]||0).toLocaleString('fa-IR')+'</strong><span>'+x[0]+'</span></div>'}).join('')}
function renderEvents(list){var box=$('#eventsAdmin');if(!box)return;box.innerHTML=list.length?list.map(function(e){return '<div class="admin-item"><img src="'+esc(e.imageUrl||'images/placeholder.svg')+'"><div class="admin-item-main"><strong>'+esc(e.title)+'</strong><small>'+esc(e.label||'رویداد')+' · '+esc(e.date||'')+'</small></div><div class="admin-actions"><button data-edit="'+esc(e.id)+'">ویرایش</button><button class="danger" data-del="'+esc(e.id)+'">حذف</button></div></div>'}).join(''):'<div class="empty"><p>هنوز رویدادی ثبت نشده</p></div>';box.querySelectorAll('[data-edit]').forEach(function(b){b.onclick=function(){editEvent(b.dataset.edit)}});box.querySelectorAll('[data-del]').forEach(function(b){b.onclick=function(){deleteEvent(b.dataset.del)}})}
async function viewRegistrationPhoto(id,button,type){
 var modal=$('#registrationPhotoModal'),img=$('#registrationPhotoImage'),status=$('#registrationPhotoStatus');
 if(!modal||!img||!status){toast('نمایشگر عکس آماده نیست',1);return}
 modal.hidden=false;modal.classList.add('active');document.body.style.overflow='hidden';img.hidden=true;img.removeAttribute('src');status.textContent=type==='receipt'?'در حال دریافت امن رسید پرداخت…':'در حال دریافت امن عکس رضایت‌نامه…';
 if(button)setBusy(button,'در حال دریافت…');
 try{
  var result=await api().post({action:'getRegistrationPhoto',token:state.token,id:id,type:type||'consent'});
  if(!result.base64)throw new Error(type==='receipt'?'رسید پرداخت در پاسخ سرور موجود نبود':'عکس رضایت‌نامه در پاسخ سرور موجود نبود');
  img.onload=function(){img.hidden=false;status.textContent='این تصویر فقط در پنل مجاز نمایش داده می‌شود.'};
  img.onerror=function(){img.hidden=true;status.textContent='تصویر دریافت شد اما مرورگر نتوانست آن را نمایش دهد.'};
  img.src='data:'+(result.mimeType||'image/jpeg')+';base64,'+result.base64;
 }catch(e){status.textContent=e.message||'نمایش عکس رضایت‌نامه ناموفق بود'}
 finally{if(button)clearBusy(button)}
}
function closeRegistrationPhotoModal(){
 var modal=$('#registrationPhotoModal'),img=$('#registrationPhotoImage'),status=$('#registrationPhotoStatus');
 if(modal){modal.hidden=true;modal.classList.remove('active')}if(img){img.hidden=true;img.removeAttribute('src')}if(status)status.textContent='';document.body.style.overflow='';
}
function setupRegistrationPhotoModal(){
 var modal=$('#registrationPhotoModal'),close=$('#registrationPhotoClose');
 if(close)close.addEventListener('click',closeRegistrationPhotoModal);
 if(modal)modal.addEventListener('click',function(e){if(e.target===modal)closeRegistrationPhotoModal()});
 document.addEventListener('keydown',function(e){if(e.key==='Escape'&&modal&&!modal.hidden)closeRegistrationPhotoModal()});
}
function renderRegs(list){
 var box=$('#registrationsAdmin');if(!box)return;
 box.innerHTML=list.length?list.map(function(r){
  var cost=Number(r.campCost||0),paidStatus=String(r.paymentStatus||'');
  var detail=(r.campTitle?esc(r.campTitle)+' · ':'')+esc(r.phone)+' · '+esc(r.status)+' · '+esc(paidStatus|| (cost>0?'منتظر ارسال رسید':'پرداخت لازم نیست'))+(cost>0?' · '+cost.toLocaleString('fa-IR')+' تومان':'');
  var actions=(r.photoUrl?'<button data-photo="'+esc(r.id)+'">رضایت‌نامه</button>':'')+(r.receiptPhotoUrl?'<button data-receipt="'+esc(r.id)+'">مشاهده رسید</button>':'');
  if(r.status==='در انتظار تایید'){
   if(cost>0){
    if(r.receiptPhotoUrl && paidStatus!=='تایید پرداخت')actions+='<button data-payment-ok="'+esc(r.id)+'">تأیید پرداخت و ثبت‌نام</button><button class="danger" data-payment-no="'+esc(r.id)+'">رد رسید</button>';
    else if(!r.receiptPhotoUrl)actions+='<span class="payment-waiting">منتظر ارسال رسید</span>';
   }else actions+='<button data-ok="'+esc(r.id)+'">تأیید</button><button class="danger" data-no="'+esc(r.id)+'">رد</button>';
  }
  return '<div class="admin-item camp-registration-item"><div class="admin-item-main"><strong>'+esc(r.firstName+' '+r.lastName)+'</strong><small>'+detail+'</small></div><div class="admin-actions">'+actions+'</div></div>';
 }).join(''):'<div class="empty"><p>ثبت‌نامی وجود ندارد</p></div>';
 box.querySelectorAll('[data-photo]').forEach(function(b){b.onclick=function(){viewRegistrationPhoto(b.dataset.photo,b,'consent')}});
 box.querySelectorAll('[data-receipt]').forEach(function(b){b.onclick=function(){viewRegistrationPhoto(b.dataset.receipt,b,'receipt')}});
 box.querySelectorAll('[data-ok]').forEach(function(b){b.onclick=function(){setReg(b.dataset.ok,'تایید شد')}});
 box.querySelectorAll('[data-no]').forEach(function(b){b.onclick=function(){setReg(b.dataset.no,'رد شد')}});
 box.querySelectorAll('[data-payment-ok]').forEach(function(b){b.onclick=function(){setPaymentStatus(b.dataset.paymentOk,'تایید پرداخت',b)}});
 box.querySelectorAll('[data-payment-no]').forEach(function(b){b.onclick=function(){setPaymentStatus(b.dataset.paymentNo,'رد پرداخت',b)}});
}
function setPaymentStatus(id,status,button){
 if(!confirm(status==='تایید پرداخت'?'رسید را تأیید کنی و ثبت‌نام این فرد هم نهایی شود؟':'این رسید را رد کنی؟'))return;
 setBusy(button,'در حال ثبت...');
 api().post({action:'setCampPaymentStatus',token:state.token,id:id,status:status}).then(function(){toast(status==='تایید پرداخت'?'پرداخت تأیید و ثبت‌نام نهایی شد ✓':'رسید رد شد');load()}).catch(function(e){toast(e.message||'تغییر وضعیت رسید ناموفق بود',1)}).finally(function(){clearBusy(button)});
}
function setReg(id,status){api().post({action:'setRegistrationStatus',token:state.token,id:id,status:status}).then(function(){toast('وضعیت ثبت شد ✓');load()}).catch(function(e){toast(e.message,1)})}
function renderAttendance(rows){var box=$('#attendanceAdmin');if(box)box.innerHTML=rows.length?rows.map(function(r){return '<div class="report-row"><span>'+esc(r.date)+'</span><span>'+esc(r.memberName)+'</span><span>'+esc(r.status)+'</span></div>'}).join(''):'<p class="muted">برای ماه جاری هنوز گزارشی ثبت نشده</p>'}
function renderWarnings(rows){
 var box=$('#warningsAdmin');
 if(!box)return;
 if(!rows.length){box.innerHTML='<p class="muted">برای ماه جاری هنوز اخطاری ثبت نشده</p>';return;}
 box.innerHTML=rows.map(function(r){
  var date=esc(r.date), member=esc(r.memberName), reason=esc(r.reason), responsibility=esc(r.responsibility);
  return '<div class="report-row"><span>'+date+'</span><span>'+member+' · '+reason+'</span><span>'+responsibility+'</span></div>';
 }).join('');
}
function openEditor(e){$('#eventEditor').classList.remove('hidden');$('#eventId').value=e?e.id:'';$('#eventTitle').value=e?e.title:'';$('#eventLabel').value=e?e.label:'';$('#eventDescription').value=e?e.description:'';$('#eventDate').value=normalizeDateInput(e?e.date:'');$('#eventSort').value=e?e.sort||0:0;$('#eventPreview').textContent=e&&e.imageUrl?'تصویر فعلی ثبت شده':'تصویر جدید را انتخاب کن'}
function normalizeDateInput(v){var s=String(v||'').trim();return /^\d{4}-\d{2}-\d{2}$/.test(s)?s:''}
function editEvent(id){var e=state.events.find(function(x){return x.id===id});if(e)openEditor(e)}
function deleteEvent(id){if(!confirm('این رویداد حذف شود؟'))return;api().post({action:'deleteEvent',token:state.token,id:id}).then(function(){toast('رویداد حذف شد');load()}).catch(function(e){toast(e.message,1)})}
function file64(file){return new Promise(function(resolve,reject){var r=new FileReader();r.onload=function(){resolve(String(r.result).split(',')[1])};r.onerror=reject;r.readAsDataURL(file)})}
async function saveEvent(){var btn=$('#saveEventBtn'),uploadedImageId='';setBusy(btn,'در حال ذخیره...');try{var imageId='',imageUrl='',file=$('#eventImage').files[0];if(!$('#eventTitle').value.trim())throw new Error('عنوان رویداد را وارد کن');if(file){if(['image/jpeg','image/png','image/webp'].indexOf(String(file.type||'').toLowerCase())<0)throw new Error('فرمت عکس باید JPG، PNG یا WebP باشد');btn.textContent='فشرده‌سازی عکس...';var blob=await compressActivityPhoto(file);if(blob.size>2*1024*1024)throw new Error('حجم عکس رویداد باید حداکثر ۲ مگابایت باشد');btn.textContent='بارگذاری عکس...';var up=await api().post({action:'uploadEventImage',token:state.token,base64:await file64(blob),mimeType:blob.type||'image/jpeg'});imageId=up.fileId||'';uploadedImageId=imageId;imageUrl=up.url||'';if(!imageId||!imageUrl)throw new Error('سرور شناسه یا نشانی عکس را برنگرداند')}else{var old=state.events.find(function(x){return x.id===$('#eventId').value});if(old){imageId=old.imageId||'';imageUrl=old.imageUrl||''}}btn.textContent='ذخیره رویداد...';await api().post({action:'saveEvent',token:state.token,id:$('#eventId').value,title:$('#eventTitle').value,description:$('#eventDescription').value,label:$('#eventLabel').value,date:$('#eventDate').value,sort:Number($('#eventSort').value||0),imageId:imageId,imageUrl:imageUrl,active:true});toast('رویداد ذخیره شد ✓');$('#eventEditor').classList.add('hidden');$('#eventImage').value='';load()}catch(e){if(uploadedImageId){try{await api().post({action:'cleanupEventImage',token:state.token,imageId:uploadedImageId})}catch(cleanupError){if(window.console&&console.warn)console.warn('Event image cleanup failed:',cleanupError)}}toast(e.message||'خطا در ذخیره رویداد',1)}finally{clearBusy(btn)}}

function localTodayInput(){var d=new Date(),m=String(d.getMonth()+1).padStart(2,'0'),day=String(d.getDate()).padStart(2,'0');return d.getFullYear()+'-'+m+'-'+day}
function renderActivityReports(items){
 var box=$('#activityReportsAdmin');if(!box)return;
 box.innerHTML=items.length?items.map(function(r){
  var photos=Array.isArray(r.images)?r.images:[];
  var thumbs=photos.slice(0,4).map(function(p){return '<img src="'+esc(p.url)+'" alt="" loading="lazy">'}).join('');
  return '<div class="admin-item activity-report-admin-item"><div class="activity-report-admin-thumbs">'+(thumbs||'<span class="activity-report-no-photo">بدون عکس</span>')+'</div><div class="admin-item-main"><strong>'+esc(r.title)+'</strong><small>'+esc(r.date||'بدون تاریخ')+' · '+photos.length.toLocaleString('fa-IR')+' عکس</small><p>'+esc(String(r.description||'').slice(0,150))+'</p></div><div class="admin-actions"><button class="danger" data-activity-report-delete="'+esc(r.id)+'">حذف گزارش</button></div></div>';
 }).join(''):'<div class="empty"><p>هنوز گزارش مستقلی ثبت نشده است.</p><small>برای نمونه، گزارش اردو را با چند عکس از دکمه «گزارش جدید» بساز.</small></div>';
 box.querySelectorAll('[data-activity-report-delete]').forEach(function(btn){btn.onclick=function(){var id=btn.getAttribute('data-activity-report-delete');if(!confirm('این گزارش از بخش فعالیت‌ها حذف شود؟'))return;btn.disabled=true;api().post({action:'deleteActivityReport',token:state.token,id:id}).then(function(){toast('گزارش حذف شد ✓');loadActivityReports()}).catch(function(e){toast(e.message||'حذف گزارش ناموفق بود',1);btn.disabled=false})}});
}
function loadActivityReports(){
 var box=$('#activityReportsAdmin');if(!box||!state.token)return;
 api().post({action:'listActivityReportsManage',token:state.token}).then(function(r){renderActivityReports(r.items||[])}).catch(function(e){box.innerHTML='<div class="empty"><p>'+esc(e.message||'دریافت گزارش‌ها ناموفق بود')+'</p></div>'});
}
function compressActivityPhoto(file){
 return new Promise(function(resolve,reject){
  var url=URL.createObjectURL(file),img=new Image();
  img.onload=function(){
   URL.revokeObjectURL(url);
   try{
    var originalW=img.naturalWidth||img.width,originalH=img.naturalHeight||img.height;
    if(!originalW||!originalH)throw new Error('ابعاد عکس قابل تشخیص نیست');
    function renderBlob(maxDimension,quality){
     var scale=Math.min(1,maxDimension/Math.max(originalW,originalH));
     var w=Math.max(1,Math.round(originalW*scale)),h=Math.max(1,Math.round(originalH*scale));
     var canvas=document.createElement('canvas');canvas.width=w;canvas.height=h;
     var ctx=canvas.getContext('2d');ctx.fillStyle='#ffffff';ctx.fillRect(0,0,w,h);ctx.drawImage(img,0,0,w,h);
     canvas.toBlob(function(blob){if(!blob){reject(new Error('فشرده‌سازی عکس ناموفق بود'));return}if(blob.size>1450*1024&&maxDimension>1100){renderBlob(1100,0.62);return}resolve(blob)},'image/jpeg',quality);
    }
    renderBlob(1440,0.76);
   }catch(e){reject(e)}
  };
  img.onerror=function(){URL.revokeObjectURL(url);reject(new Error('یکی از عکس‌ها باز نمی‌شود؛ آن را با فرمت JPG یا PNG دوباره انتخاب کن'))};
  img.src=url;
 });
}
function setupActivityReports(){
 var newBtn=$('#newActivityReportBtn'),editor=$('#activityReportEditor'),photosInput=$('#activityReportPhotos'),preview=$('#activityPhotoPreview'),saveBtn=$('#saveActivityReportBtn');
 if(!newBtn||!editor||!photosInput||!preview||!saveBtn)return;
 var previewUrls=[];
 function revokePreviewUrls(){previewUrls.forEach(function(url){try{URL.revokeObjectURL(url)}catch(e){}});previewUrls=[]}
 function clearPhotos(){revokePreviewUrls();photosInput.value='';preview.innerHTML='<span>هنوز عکسی انتخاب نشده</span>'}
 function resetEditor(){ $('#activityReportTitle').value='';$('#activityReportDescription').value='';$('#activityReportDate').value=localTodayInput();clearPhotos() }
 newBtn.onclick=function(){resetEditor();editor.classList.remove('hidden');editor.scrollIntoView({behavior:'smooth',block:'start'});$('#activityReportTitle').focus()};
 $('#cancelActivityReportBtn').onclick=function(){editor.classList.add('hidden');resetEditor()};
 $('#clearActivityPhotosBtn').onclick=clearPhotos;
 photosInput.addEventListener('change',function(){
  revokePreviewUrls();
  var files=Array.prototype.slice.call(photosInput.files||[]);
  if(files.length>10){clearPhotos();toast('برای هر گزارش حداکثر ۱۰ عکس انتخاب کن',1);return}
  var invalid=files.find(function(f){return ['image/jpeg','image/png','image/webp'].indexOf(f.type)<0});
  if(invalid){clearPhotos();toast('فقط عکس‌های JPG، PNG یا WebP پشتیبانی می‌شوند',1);return}
  if(!files.length){clearPhotos();return}
  preview.innerHTML=files.map(function(f,i){var url=URL.createObjectURL(f);previewUrls.push(url);return '<div class="activity-photo-preview__item"><img src="'+esc(url)+'" alt=""><span>'+String(i+1).toLocaleString('fa-IR')+'. '+esc(f.name)+'</span><small>'+Math.max(1,Math.round(f.size/1024)).toLocaleString('fa-IR')+' کیلوبایت</small></div>'}).join('');
 });
 saveBtn.onclick=async function(){
  var title=$('#activityReportTitle').value.trim(),description=$('#activityReportDescription').value.trim(),date=$('#activityReportDate').value,files=Array.prototype.slice.call(photosInput.files||[]);
  if(!title){toast('عنوان گزارش را وارد کن',1);$('#activityReportTitle').focus();return}
  if(!files.length){toast('برای ثبت گزارش تصویری، دست‌کم یک عکس انتخاب کن',1);photosInput.focus();return}
  if(files.length>10){toast('حداکثر ۱۰ عکس در هر گزارش مجاز است',1);return}
  setBusy(saveBtn,'آماده‌سازی گزارش...');
  var uploaded=[];
  try{
   for(var i=0;i<files.length;i++){
    saveBtn.textContent='فشرده‌سازی عکس '+(i+1)+' از '+files.length+'…';
    var blob=await compressActivityPhoto(files[i]);
    if(blob.size>2*1024*1024)throw new Error('حجم عکس شماره '+(i+1)+' زیاد است؛ عکس دیگری انتخاب کن');
    saveBtn.textContent='بارگذاری عکس '+(i+1)+' از '+files.length+'…';
    var up=await api().post({action:'uploadActivityPhoto',token:state.token,base64:await file64(blob),mimeType:blob.type||'image/jpeg'});
    if(!up.fileId)throw new Error('سرور شناسه عکس شماره '+(i+1)+' را برنگرداند');
    uploaded.push(up.fileId);
   }
   saveBtn.textContent='ذخیره گزارش…';
   await api().post({action:'saveActivityReport',token:state.token,title:title,description:description,date:date,imageIds:uploaded});
   toast('گزارش و '+uploaded.length.toLocaleString('fa-IR')+' عکس ذخیره شد ✓');
   editor.classList.add('hidden');resetEditor();loadActivityReports();
  }catch(e){
   if(uploaded.length){
    try{await api().post({action:'cleanupActivityPhotos',token:state.token,imageIds:uploaded})}
    catch(cleanupError){if(window.console&&console.warn)console.warn('Activity photo cleanup failed:',cleanupError)}
   }
   toast(e.message||'ذخیره گزارش ناموفق بود؛ دوباره تلاش کن',1);
  }finally{clearBusy(saveBtn)}
 };
}
function loadSchedule(){api().get({action:'listSchedule'}).then(function(r){var list=sortScheduleRows(r.items||[]),box=$('#scheduleAdmin');box.innerHTML=list.length?list.map(function(x){var category=String(x.category||'حلقه')==='بازی'?'بازی':'حلقه',cls=category==='حلقه'?'schedule-cat-ring':'schedule-cat-game';return '<div class="admin-item"><div class="admin-item-main"><strong>'+esc(x.day)+' · '+esc(x.title)+'</strong><span class="schedule-admin-category '+cls+'">'+category+'</span></div><div class="admin-actions"><button data-sedit="'+esc(x.id)+'">ویرایش</button><button class="danger" data-sdel="'+esc(x.id)+'">حذف</button></div></div>'}).join(''):'<div class="empty"><p>برنامه هفتگی خالی است</p></div>';box.querySelectorAll('[data-sedit]').forEach(function(b){b.onclick=function(){var x=list.find(function(y){return y.id===b.dataset.sedit});if(x){$('#scheduleEditor').classList.remove('hidden');$('#scheduleId').value=x.id;$('#scheduleDay').value=x.day;$('#scheduleTitle').value=x.title;$('#scheduleCategory').value=String(x.category||'حلقه')}}});box.querySelectorAll('[data-sdel]').forEach(function(b){b.onclick=function(){if(confirm('این برنامه حذف شود؟'))api().post({action:'deleteSchedule',token:state.token,id:b.dataset.sdel}).then(function(){toast('برنامه حذف شد');loadSchedule()}).catch(function(e){toast(e.message,1)})}})}).catch(function(e){toast(e.message||'خطا در برنامه هفتگی',1)})}

function renderCamps(items){
 var box=$('#campsAdmin');if(!box)return;
 box.innerHTML=items.length?items.map(function(c){
  var cost=Number(c.cost||0),deadline=esc(c.registrationDeadline||'مهلت مشخص نشده');
  return '<div class="admin-item camp-admin-item"><div class="admin-item-main"><strong>'+esc(c.title)+'</strong><small>شماره کارت: '+esc(c.cardNumber||'ثبت نشده')+' · هزینه: '+(cost?cost.toLocaleString('fa-IR')+' تومان':'بدون هزینه')+' · پایان ثبت‌نام: '+deadline+'</small></div><div class="admin-actions"><button class="danger" data-camp-delete="'+esc(c.id)+'">حذف اردو</button></div></div>';
 }).join(''):'<div class="empty"><p>اردوی فعالی ثبت نشده است.</p></div>';
 box.querySelectorAll('[data-camp-delete]').forEach(function(b){b.onclick=function(){var id=b.dataset.campDelete;if(!confirm('این اردو از فهرست ثبت‌نام برداشته شود؟'))return;api().post({action:'deleteCamp',token:state.token,id:id}).then(function(){toast('اردو از فهرست ثبت‌نام حذف شد ✓');loadCamps()}).catch(function(e){toast(e.message||'حذف اردو ناموفق بود',1)})}});
}
function loadCamps(){
 var box=$('#campsAdmin');if(!box)return;
 api().get({action:'listCamps'}).then(function(r){renderCamps(r.items||[])}).catch(function(e){box.innerHTML='<div class="empty"><p>'+esc(e.message||'بارگذاری اردوها ناموفق بود')+'</p></div>'});
}
function setupCamps(){
 var save=$('#saveCampBtn'),clear=$('#cancelCampBtn'),box=$('#campsAdmin');
 if(!save||!box)return;
 if(clear)clear.onclick=function(){$('#campTitle').value='';$('#campCardNumber').value='';$('#campCost').value='';$('#campDeadline').value='';};
 var card=$('#campCardNumber'),costInput=$('#campCost');
 if(card)card.addEventListener('input',function(){card.value=normalizeDigits(card.value).replace(/[^0-9\s-]/g,'').slice(0,30)});
 if(costInput)costInput.addEventListener('input',function(){costInput.value=normalizeDigits(costInput.value).replace(/[^0-9,،٬]/g,'').slice(0,14)});
 save.onclick=async function(){
  var title=$('#campTitle').value.trim();
  var cardNumber=normalizeDigits($('#campCardNumber').value).replace(/[\s-]/g,'');
  var cost=normalizeDigits($('#campCost').value).replace(/[\s,،٬]/g,'');
  var registrationDeadline=$('#campDeadline').value;
  if(!title){toast('نام اردو را وارد کن',1);$('#campTitle').focus();return}
  if(!registrationDeadline){toast('تاریخ پایان ثبت‌نام را انتخاب کن',1);$('#campDeadline').focus();return}
  if(Number(cost||0)>0&&!/^\d{16,26}$/.test(cardNumber)){toast('شماره کارت یا شبا را درست وارد کن',1);$('#campCardNumber').focus();return}
  setBusy(save,'در حال ثبت اردو...');
  try{
   await api().post({action:'saveCamp',token:state.token,title:title,cardNumber:cardNumber,cost:cost||0,registrationDeadline:registrationDeadline});
   toast('اردو ثبت شد ✓');
   $('#campTitle').value='';$('#campCardNumber').value='';$('#campCost').value='';$('#campDeadline').value='';
   await loadCamps();
  }catch(e){toast(e.message||'ثبت اردو ناموفق بود',1)}
  finally{clearBusy(save)}
 };
}
function setupSchedule(){var b=$('#newScheduleBtn');if(!b)return;b.onclick=function(){$('#scheduleEditor').classList.remove('hidden');$('#scheduleId').value='';$('#scheduleDay').value='';$('#scheduleTitle').value='';$('#scheduleCategory').value='حلقه'};$('#cancelScheduleBtn').onclick=function(){$('#scheduleEditor').classList.add('hidden')};$('#saveScheduleBtn').onclick=function(){var day=$('#scheduleDay').value,title=$('#scheduleTitle').value.trim(),category=$('#scheduleCategory').value;if(!day||scheduleDayIndex(day)<0||!title||['حلقه','بازی'].indexOf(category)<0){toast('روز، عنوان و دسته برنامه را کامل انتخاب کن',1);return}api().post({action:'saveSchedule',token:state.token,id:$('#scheduleId').value,day:day,title:title,category:category,time:'',location:'',sort:scheduleDayIndex(day)}).then(function(){toast('برنامه ذخیره شد ✓');$('#scheduleEditor').classList.add('hidden');loadSchedule()}).catch(function(e){toast(e.message,1)})};loadSchedule()}
function loadCoaches(){api().post({action:'listCoaches',token:state.token}).then(function(r){var items=r.items||[],box=$('#coachList');box.innerHTML=items.map(function(x){var owner=x.role==='master',label=owner?'مربی ارشد':'مربی',roleClass=owner?'is-owner':'is-coach';return '<div class="admin-item coach-admin-item"><div class="admin-item-main"><strong>'+esc(x.name)+' <span class="status-dot '+(x.active?'on':'off')+'"></span></strong><small>'+esc(x.phone)+' · '+esc(x.code)+'</small><div class="staff-role-badge '+roleClass+'">'+label+'</div><div class="permission-summary">'+PERMS.filter(function(p){return x.permissions&&x.permissions[p[0]]}).map(function(p){return '<span>'+p[1]+'</span>'}).join(' · ')+'</div></div><div class="admin-actions">'+(owner?'':'<button data-coach-edit="'+esc(x.code)+'">ویرایش</button><button data-coach-status="'+esc(x.code)+'" data-active="'+(x.active?'0':'1')+'">'+(x.active?'غیرفعال‌سازی':'فعال‌سازی')+'</button><button class="danger" data-coach-delete="'+esc(x.code)+'">حذف کامل</button>')+'</div></div>'}).join('');box.querySelectorAll('[data-coach-edit]').forEach(function(b){b.onclick=function(){editCoach(b.dataset.coachEdit,items)}});box.querySelectorAll('[data-coach-status]').forEach(function(b){b.onclick=function(){setCoachStatus(b.dataset.coachStatus,b.dataset.active==='1')}});box.querySelectorAll('[data-coach-delete]').forEach(function(b){b.onclick=function(){var item=items.find(function(x){return x.code===b.dataset.coachDelete});if(!confirm('مربی «'+(item?item.name:'')+'» به‌طور کامل حذف شود؟ این کار قابل بازگشت نیست.'))return;api().post({action:'deleteCoach',token:state.token,code:b.dataset.coachDelete}).then(function(){toast('مربی به‌طور کامل حذف شد ✓');loadCoaches()}).catch(function(e){toast(e.message,1)})}})}).catch(function(e){toast(e.message,1)})}
function editCoach(code,list){var x=list.find(function(y){return y.code===code});if(!x)return;var name=prompt('نام مربی:',x.name);if(name===null)return;var phone=prompt('شماره همراه مربی:',x.phone);if(phone===null)return;var newCode=prompt('رمز ورود جدید:',x.code);if(newCode===null)return;var wrap=document.createElement('div');renderPermissionChecks(wrap,x.permissions);var txt=PERMS.map(function(p,i){return (x.permissions&&x.permissions[p[0]]?'✓ ':'')+p[1]}).join('، ');var perms={};PERMS.forEach(function(p){perms[p[0]]=confirm('دسترسی «'+p[1]+'» فعال باشد؟\nوضعیت فعلی: '+(x.permissions&&x.permissions[p[0]]?'فعال':'خاموش'))});api().post({action:'updateCoach',token:state.token,oldCode:code,name:name,phone:phone,code:newCode,permissions:perms}).then(function(){toast('اطلاعات مدیر ذخیره شد ✓');loadCoaches()}).catch(function(e){toast(e.message,1)})}
function setCoachStatus(code,active){api().post({action:'setCoachStatus',token:state.token,code:code,active:active}).then(function(){toast(active?'مربی فعال شد ✓':'دسترسی مربی بسته شد');loadCoaches()}).catch(function(e){toast(e.message,1)})}
function loadOfficials(){api().post({action:'listOfficialsManage',token:state.token}).then(function(r){var items=r.items||[],box=$('#officialList');box.innerHTML=items.map(function(x){return '<div class="admin-item"><div class="admin-item-main"><strong>'+esc(x.name)+' <span class="status-dot '+(x.active?'on':'off')+'"></span></strong><div class="staff-role-badge is-official">'+esc(x.role)+'</div><small>'+esc(x.code)+(x.phone?' · '+esc(x.phone):'')+'</small></div><div class="admin-actions"><button data-off-edit="'+esc(x.code)+'">ویرایش</button><button data-off-status="'+esc(x.code)+'" data-active="'+(x.active?'0':'1')+'">'+(x.active?'غیرفعال‌سازی':'فعال‌سازی')+'</button><button class="danger" data-off-delete="'+esc(x.code)+'">حذف کامل</button></div></div>'}).join('')||'<div class="empty"><p>هنوز مسئول ثبت نشده است.</p></div>'}).catch(function(e){toast(e.message,1)})}
function loadFeedback(){
 var box=$('#feedbackAdmin');if(!box)return;
 api().post({action:'listFeedback',token:state.token}).then(function(r){
  var items=r.items||[];
  if(!items.length){box.innerHTML='<div class="empty"><p>هنوز انتقاد یا پیشنهادی ثبت نشده است.</p></div>';return}
  box.innerHTML=items.map(function(x){
   var status=String(x.status||'جدید');
   var statusOptions=['جدید','در حال بررسی','بررسی شد'].map(function(v){return '<option value="'+esc(v)+'" '+(status===v?'selected':'')+'>'+esc(v)+'</option>'}).join('');
   return '<article class="feedback-item"><div class="feedback-item__top"><div><strong>'+esc(x.category||'سایر')+'</strong><small>'+esc(x.name||'بدون نام')+(x.phone?' · '+esc(x.phone):'')+'</small></div><time>'+esc(x.createdAt||'')+'</time></div><p>'+esc(x.message||'')+'</p><div class="feedback-item__actions"><label>وضعیت <select class="form-control" data-feedback-status data-id="'+esc(x.id)+'">'+statusOptions+'</select></label></div></article>';
  }).join('');
  box.querySelectorAll('[data-feedback-status]').forEach(function(sel){
   sel.addEventListener('change',function(){
    var current=sel.value;sel.disabled=true;
    api().post({action:'setFeedbackStatus',token:state.token,id:sel.getAttribute('data-id'),status:current}).then(function(){toast('وضعیت پیام به‌روز شد ✓');loadFeedback()}).catch(function(e){toast(e.message,1);sel.disabled=false});
   });
  });
 }).catch(function(e){box.innerHTML='<div class="empty"><p>'+esc(e.message||'دریافت پیام‌ها ناموفق بود')+'</p></div>';});
}
function setupOwnCredentials(){
 var phoneInput=$('#ownCoachNewPhone'), codeInput=$('#ownCoachNewCode'), btn=$('#saveOwnCoachCredentials');
 if(phoneInput)phoneInput.addEventListener('input',function(){phoneInput.value=normalizeDigits(phoneInput.value).replace(/[^0-9+]/g,'').slice(0,16)});
 if(!btn)return;
 btn.onclick=async function(){
  var newPhone=phoneInput?normalizeIranMobileInput(phoneInput.value):'';
  var newCode=codeInput?codeInput.value.trim():'';
  if(!newPhone&&!newCode){toast('شماره یا کد ورود جدید را وارد کن',1);return}
  if(newPhone&&!/^09\d{9}$/.test(newPhone)){toast('شماره همراه جدید معتبر نیست',1);return}
  if(newCode&&newCode.length<8){toast('کد ورود باید دست‌کم ۸ نویسه باشد',1);return}
  setBusy(btn,'در حال ذخیره...');
  try{
   var response=await api().post({action:'updateOwnCoachCredentials',token:state.token,newPhone:newPhone,newCode:newCode});
   state.token=response.token;
   state.name=response.coach.name||state.name;
   state.isMaster=!!response.coach.isMaster;
   state.permissions=response.coach.permissions||state.permissions;
   sessionSet('coach_token',state.token);
   sessionSet('coach_name',state.name);
   sessionSet('coach_master',state.isMaster?'1':'0');
   sessionSet('coach_permissions',JSON.stringify(state.permissions));
   if(phoneInput)phoneInput.value='';
   if(codeInput)codeInput.value='';
   applyPermissions();
   toast('اطلاعات ورود تغییر کرد ✓');
  }catch(e){toast(e.message||'ذخیره اطلاعات ورود ناموفق بود',1)}
  finally{clearBusy(btn)}
 };
}
function setupStaff(){
  renderPermissionChecks($('#newCoachPermissions'),{officials:true,feedback:true});
  var coachPhoneAddInput=$('#newCoachPhone');
  if(coachPhoneAddInput)coachPhoneAddInput.addEventListener('input',function(){coachPhoneAddInput.value=normalizeDigits(coachPhoneAddInput.value).replace(/[^0-9+]/g,'').slice(0,16)});
  var officialPhoneInput=$('#newOfficialPhone');
  if(officialPhoneInput)officialPhoneInput.addEventListener('input',function(){officialPhoneInput.value=normalizeDigits(officialPhoneInput.value).replace(/[^0-9+]/g,'').slice(0,16)});
  var addCoachBtn=$('#addCoachBtn');if(addCoachBtn)addCoachBtn.onclick=async function(){var name=$('#newCoachName').value.trim(),phone=normalizeIranMobileInput($('#newCoachPhone').value),code=$('#newCoachCode').value.trim(),permissions=readPermissions($('#newCoachPermissions'));$('#newCoachPhone').value=phone;if(!name){toast('نام مربی را وارد کن',1);$('#newCoachName').focus();return}if(!/^09\d{9}$/.test(phone)){toast('شماره همراه مربی معتبر نیست؛ شماره ۱۱ رقمی با ۰۹ یا قالب +98 وارد کن',1);$('#newCoachPhone').focus();return}if(code.length<8||code.length>64){toast('کد ورود مربی باید بین ۸ تا ۶۴ نویسه باشد',1);$('#newCoachCode').focus();return}setBusy(addCoachBtn,'در حال ثبت مربی...');try{await api().post({action:'addCoach',token:state.token,name:name,phone:phone,code:code,permissions:permissions});toast('مربی اضافه شد ✓');$('#newCoachName').value='';$('#newCoachPhone').value='';$('#newCoachCode').value='';renderPermissionChecks($('#newCoachPermissions'),{officials:true,feedback:true});await loadCoaches()}catch(e){toast(e.message||'ثبت مربی ناموفق بود',1)}finally{clearBusy(addCoachBtn)}};
  $('#addOfficialBtn').onclick=function(){api().post({action:'addOfficial',token:state.token,name:$('#newOfficialName').value.trim(),phone:normalizeDigits($('#newOfficialPhone').value).trim(),code:$('#newOfficialCode').value.trim(),role:$('#newOfficialRole').value}).then(function(){toast('مسئول ثبت شد ✓');$('#newOfficialName').value='';$('#newOfficialPhone').value='';$('#newOfficialCode').value='';loadOfficials()}).catch(function(e){toast(e.message,1)})};
  $('#officialList').addEventListener('click',function(e){
    var edit=e.target.closest('[data-off-edit]'),st=e.target.closest('[data-off-status]'),del=e.target.closest('[data-off-delete]');
    if(del){var code=del.dataset.offDelete;if(!confirm('مسئول با این کد به‌طور کامل حذف شود؟ این کار قابل بازگشت نیست.'))return;api().post({action:'deleteOfficial',token:state.token,code:code}).then(function(){toast('مسئول به‌طور کامل حذف شد ✓');loadOfficials()}).catch(function(x){toast(x.message,1)})}
    else if(st){api().post({action:'setOfficialStatus',token:state.token,code:st.dataset.offStatus,active:st.dataset.active==='1'}).then(function(){toast('وضعیت مسئول تغییر کرد ✓');loadOfficials()}).catch(function(x){toast(x.message,1)})}
    else if(edit){var code=edit.dataset.offEdit,items=[];var name=prompt('نام مسئول جدید:');if(name===null)return;var newPhone=prompt('شماره همراه مسئول (اختیاری؛ برای رنگ نقش در رکوردها):');if(newPhone===null)return;var newCode=prompt('کد جدید:');if(newCode===null)return;var role=prompt('نوع مسئولیت: حضور و غیاب - راهنمایی / حضور و غیاب - دبستان / نظارت');if(role===null)return;api().post({action:'updateOfficial',token:state.token,oldCode:code,name:name,phone:normalizeDigits(newPhone).replace(/\D/g,''),code:newCode,role:role}).then(function(){toast('مسئول ویرایش شد ✓');loadOfficials()}).catch(function(x){toast(x.message,1)})}
  });
}
function safeInit(name,fn){
 try{fn()}catch(err){if(window.console&&console.error)console.error('[CoachSetup:'+name+']',err);toast('بخشی از پنل کامل بارگذاری نشد؛ صفحه را تازه‌سازی کن',1)}
}
function setup(){
 // Bind login first so errors in optional widgets cannot leave the form unresponsive.
 safeInit('login',login);
 safeInit('schedule',setupSchedule);
 safeInit('staff',setupStaff);
 safeInit('own-credentials',setupOwnCredentials);
 safeInit('activity-reports',setupActivityReports);
 safeInit('registration-photo-modal',setupRegistrationPhotoModal);
 safeInit('camps',setupCamps);
 safeInit('phone-inputs',function(){
  var coachPhoneInput=$('#coachPhone');
  if(coachPhoneInput)coachPhoneInput.addEventListener('input',function(){coachPhoneInput.value=normalizeDigits(coachPhoneInput.value).replace(/[^0-9+]/g,'').slice(0,16)});
  var resetPhone=$('#resetMemberPhone'),resetBtn=$('#resetMemberHistoryBtn');
  if(resetPhone)resetPhone.addEventListener('input',function(){resetPhone.value=normalizeDigits(resetPhone.value).replace(/[^0-9+]/g,'').slice(0,16)});
  if(resetPhone&&resetBtn)resetBtn.addEventListener('click',async function(){
   var phone=normalizeIranMobileInput(resetPhone.value);
   if(!/^09\d{9}$/.test(phone)){toast('شماره همراه معتبر ۱۱ رقمی وارد کن',1);return}
   if(!confirm('تمام سابقه عضویت شماره '+phone+' حذف شود؟ حساب مربی ارشد و تنظیمات مربی ارشد حذف نمی‌شود. این عملیات قابل بازگشت نیست.'))return;
   setBusy(resetBtn,'در حال پاک‌کردن...');
   try{var result=await api().post({action:'resetMemberHistory',token:state.token,phone:phone});resetPhone.value='';toast((result.message||'سابقه عضویت پاک شد')+' ✓');await load();}
   catch(err){toast(err.message||'پاک‌کردن سابقه ناموفق بود',1)}
   finally{clearBusy(resetBtn)}
  });
 });
 safeInit('dashboard-buttons',function(){
  var newEventBtn=$('#newEventBtn'),cancelEventBtn=$('#cancelEventBtn'),saveEventBtn=$('#saveEventBtn');
  if(newEventBtn)newEventBtn.onclick=function(){openEditor(null)};
  if(cancelEventBtn)cancelEventBtn.onclick=function(){$('#eventEditor').classList.add('hidden')};
  if(saveEventBtn)saveEventBtn.onclick=saveEvent;
  var savePrizeBtn=$('#savePrizeBtn');
  if(savePrizeBtn)savePrizeBtn.onclick=function(){api().post({action:'saveGamePrize',token:state.token,prize:$('#gamePrize').value.trim()}).then(function(){toast('جایزه ذخیره شد ✓')}).catch(function(err){toast(err.message,1)})};
  var logoutBtn=$('#coachLogout');
  if(logoutBtn)logoutBtn.onclick=function(){['coach_token','coach_name','coach_master','coach_permissions'].forEach(sessionRemove);location.reload()};
  var refreshFeedbackBtn=$('#refreshFeedbackBtn');
  if(refreshFeedbackBtn)refreshFeedbackBtn.addEventListener('click',function(){if(state.token)loadFeedback()});
 });
 state.token=sessionGet('coach_token');state.name=sessionGet('coach_name');state.isMaster=sessionGet('coach_master')==='1';
 try{state.permissions=JSON.parse(sessionGet('coach_permissions')||'{}')}catch(err){state.permissions={}}
 if(state.token){
  var loginPanel=$('#coachLogin'),dashboard=$('#coachDashboard'),nameEl=$('#coachName');
  if(loginPanel)loginPanel.classList.add('hidden');
  if(dashboard)dashboard.classList.remove('hidden');
  if(nameEl)nameEl.textContent=state.name;
  renderCoachRoleBadge();applyPermissions();
  Promise.resolve().then(function(){var client=api();return client&&client.checkBackendVersion?client.checkBackendVersion():null;}).then(function(){return load()}).then(function(){
   if(state.isMaster)loadCoaches();
   if(state.isMaster||state.permissions.events)loadCamps();
   if(state.isMaster||state.permissions.officials)loadOfficials();
   if(state.isMaster||state.permissions.feedback)loadFeedback();
  }).catch(function(err){
   var msg=err&&err.message||'بارگذاری پنل ناموفق بود';
   if(/نشست|توکن|منقضی|دسترسی مسئول|حساب مربی غیرفعال/i.test(msg)){
    ['coach_token','coach_name','coach_master','coach_permissions'].forEach(sessionRemove);
    state.token='';state.name='';state.isMaster=false;state.permissions={};
    if(dashboard)dashboard.classList.add('hidden');
    if(loginPanel)loginPanel.classList.remove('hidden');
   }
   toast(msg,1);
  });
 }
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',setup);else setup();
})();