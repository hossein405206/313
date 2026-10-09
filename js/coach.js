(function(){'use strict';
var $=function(s){return document.querySelector(s)},state={token:'',name:'',isMaster:false,permissions:{},events:[],data:null};
var PERMS=[['events','رویدادها'],['schedule','برنامه هفتگی'],['registrations','ثبت‌نام‌ها'],['reports','گزارش‌ها'],['game','جایزه بازی']];
function api(){return window.KanoonApp&&window.KanoonApp.api}
function toast(m,e){var t=window.KanoonApp&&window.KanoonApp.toast;if(t)(e?t.error:t.success)(m)}
function esc(s){return String(s==null?'':s).replace(/[&<>"]/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]})}
function setBusy(btn,text){if(btn){btn.disabled=true;btn.dataset.oldText=btn.textContent;btn.textContent=text||'در حال پردازش...'}}
function clearBusy(btn){if(btn){btn.disabled=false;btn.textContent=btn.dataset.oldText||'ذخیره'}}

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
 document.querySelectorAll('.coach-permission-section').forEach(function(s){
   var p=s.getAttribute('data-permission');s.classList.toggle('permission-hidden',!state.isMaster && state.permissions[p]!==true);
 });
 var staff=$('#coachStaffPanel'),official=$('#officialStaffPanel'),membership=$('#membershipApplicationsPanel');
 if(staff)staff.classList.toggle('hidden',!state.isMaster);
 if(official)official.classList.toggle('hidden',!state.isMaster);
 if(membership)membership.classList.toggle('hidden',!state.isMaster);
}
function login(){
 var f=$('#coachLoginForm');if(!f)return;
 f.addEventListener('submit',async function(e){e.preventDefault();
  var phone=$('#coachPhone').value.trim(),code=$('#coachCode').value.trim();
  if(!/^09\d{9}$/.test(phone)){toast('شماره مربی نامعتبر است',1);return}
  if(!code){toast('کد مربی را وارد کن',1);return}
  var btn=f.querySelector('button');setBusy(btn,'در حال ورود...');
  try{
   var r=await api().post({action:'loginCoach',phone:phone,code:code});
   state.token=r.token;state.name=r.coach.name;state.isMaster=!!r.coach.isMaster;state.permissions=r.coach.permissions||{};
   sessionStorage.setItem('coach_token',state.token);sessionStorage.setItem('coach_name',state.name);sessionStorage.setItem('coach_master',state.isMaster?'1':'0');sessionStorage.setItem('coach_permissions',JSON.stringify(state.permissions));
   $('#coachLogin').classList.add('hidden');$('#coachDashboard').classList.remove('hidden');$('#coachName').textContent=state.name;$('#coachRoleBadge').textContent=state.isMaster?'مالک اصلی':'مدیر';
   applyPermissions();await load();if(state.isMaster){loadCoaches();loadOfficials()}
  }catch(e){toast(e.message||'شماره یا کد مربی نادرست است',1)}
  finally{clearBusy(btn)}
 })
}
async function load(){
 var r=await api().get({action:'getDashboard',token:state.token});state.data=r;state.events=r.events||[];renderStats(r.stats);renderEvents(state.events);renderRegs(r.registrations||[]);renderMembershipApplications(r.membershipApplications||[]);renderAttendance(r.attendance||[]);renderWarnings(r.warnings||[]);$('#gamePrize').value=r.prize||'به بیشترین رکورد هفته جایزه داده می شود';}
function renderStats(s){$('#coachStats').innerHTML=[['اعضای فعال',s.activeMembers],['در انتظار اردو',s.pendingRegistrations],['درخواست عضویت',s.pendingMembershipApplications],['حضور امروز',s.todayAttendance],['اخطار ماه',s.monthWarnings]].map(function(x){return '<div class="coach-stat"><strong>'+Number(x[1]||0).toLocaleString('fa-IR')+'</strong><span>'+x[0]+'</span></div>'}).join('')}
function renderEvents(list){var box=$('#eventsAdmin');if(!box)return;box.innerHTML=list.length?list.map(function(e){return '<div class="admin-item"><img src="'+esc(e.imageUrl||'images/placeholder.svg')+'"><div class="admin-item-main"><strong>'+esc(e.title)+'</strong><small>'+esc(e.label||'رویداد')+' · '+esc(e.date||'')+'</small></div><div class="admin-actions"><button data-edit="'+esc(e.id)+'">ویرایش</button><button class="danger" data-del="'+esc(e.id)+'">حذف</button></div></div>'}).join(''):'<div class="empty"><p>هنوز رویدادی ثبت نشده</p></div>';box.querySelectorAll('[data-edit]').forEach(function(b){b.onclick=function(){editEvent(b.dataset.edit)}});box.querySelectorAll('[data-del]').forEach(function(b){b.onclick=function(){deleteEvent(b.dataset.del)}})}
function renderRegs(list){
 var box=$('#registrationsAdmin');if(!box)return;
 box.innerHTML=list.length?list.map(function(r){
  var consent=state.isMaster&&r.photoId?'<a class="consent-file-link" href="https://drive.google.com/file/d/'+encodeURIComponent(r.photoId)+'/view" target="_blank" rel="noopener">مشاهده رضایت‌نامه</a>':'';
  return '<div class="admin-item"><div class="admin-item-main"><strong>'+esc(r.firstName+' '+r.lastName)+'</strong><small>'+esc(r.phone)+' · '+esc(r.status)+'</small>'+(consent?'<small>'+consent+'</small>':'')+'</div><div class="admin-actions">'+(r.status==='در انتظار تایید'?'<button data-ok="'+esc(r.id)+'">تایید</button><button class="danger" data-no="'+esc(r.id)+'">رد</button>':'')+'</div></div>';
 }).join(''):'<div class="empty"><p>ثبت‌نامی وجود ندارد</p></div>';
 box.querySelectorAll('[data-ok]').forEach(function(b){b.onclick=function(){setReg(b.dataset.ok,'تایید شد')}});
 box.querySelectorAll('[data-no]').forEach(function(b){b.onclick=function(){setReg(b.dataset.no,'رد شد')}});
}
function setReg(id,status){api().post({action:'setRegistrationStatus',token:state.token,id:id,status:status}).then(function(){toast('وضعیت ثبت شد ✓');load()}).catch(function(e){toast(e.message,1)})}
function renderMembershipApplications(rows){
 var box=$('#membershipApplicationsAdmin');if(!box)return;
 box.innerHTML=rows.length?rows.map(function(r){
  var name=esc((r.firstName||'')+' '+(r.lastName||'')),phone=esc(r.phone),guardian=esc(r.guardianName),guardianPhone=esc(r.guardianPhone),school=esc((r.schoolLevel||'')+' · '+(r.schoolGrade||'')),birth=esc(r.birthDate||'ثبت نشده');
  return '<div class="admin-item membership-admin-item"><div class="admin-item-main"><strong>'+name+'</strong><small>عضو: '+phone+' · '+school+'</small><small>ولی: '+guardian+' · '+guardianPhone+' · تولد: '+birth+'</small></div><div class="admin-actions"><button data-membership-ok="'+esc(r.id)+'">تأیید عضویت</button><button class="danger" data-membership-no="'+esc(r.id)+'">رد درخواست</button></div></div>';
 }).join(''):'<div class="empty"><p>درخواست عضویت در انتظار بررسی وجود ندارد</p></div>';
 box.querySelectorAll('[data-membership-ok]').forEach(function(b){b.onclick=function(){setMembershipStatus(b.dataset.membershipOk,'approved')}});
 box.querySelectorAll('[data-membership-no]').forEach(function(b){b.onclick=function(){setMembershipStatus(b.dataset.membershipNo,'rejected')}});
}
function setMembershipStatus(memberId,status){
 var message=status==='approved'?'عضویت تأیید شد ✓':'درخواست رد شد';
 api().post({action:'setMembershipStatus',token:state.token,memberId:memberId,status:status}).then(function(){toast(message);load()}).catch(function(e){toast(e.message||'ثبت وضعیت عضویت ناموفق بود',1)});
}
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
async function saveEvent(){var btn=$('#saveEventBtn');setBusy(btn,'در حال ذخیره...');try{var imageId='',imageUrl='',file=$('#eventImage').files[0];if(file){var up=await api().post({action:'uploadEventImage',token:state.token,base64:await file64(file),mimeType:file.type});imageId=up.fileId;imageUrl=up.url}else{var old=state.events.find(function(x){return x.id===$('#eventId').value});if(old){imageId=old.imageId||'';imageUrl=old.imageUrl||''}}await api().post({action:'saveEvent',token:state.token,id:$('#eventId').value,title:$('#eventTitle').value,description:$('#eventDescription').value,label:$('#eventLabel').value,date:$('#eventDate').value,sort:Number($('#eventSort').value||0),imageId:imageId,imageUrl:imageUrl,active:true});toast('رویداد ذخیره شد ✓');$('#eventEditor').classList.add('hidden');load()}catch(e){toast(e.message||'خطا در ذخیره رویداد',1)}finally{clearBusy(btn)}}
function loadSchedule(){api().get({action:'listSchedule'}).then(function(r){var list=r.items||[],box=$('#scheduleAdmin');box.innerHTML=list.length?list.map(function(x){return '<div class="admin-item"><div class="admin-item-main"><strong>'+esc(x.day)+' · '+esc(x.title)+'</strong><small>'+esc(x.time)+'</small></div><div class="admin-actions"><button data-sedit="'+esc(x.id)+'">ویرایش</button><button class="danger" data-sdel="'+esc(x.id)+'">حذف</button></div></div>'}).join(''):'<div class="empty"><p>برنامه هفتگی خالی است</p></div>';box.querySelectorAll('[data-sedit]').forEach(function(b){b.onclick=function(){var x=list.find(function(y){return y.id===b.dataset.sedit});if(x){$('#scheduleEditor').classList.remove('hidden');$('#scheduleId').value=x.id;$('#scheduleDay').value=x.day;$('#scheduleTitle').value=x.title;$('#scheduleTime').value=x.time;$('#scheduleSort').value=x.sort||0}}});box.querySelectorAll('[data-sdel]').forEach(function(b){b.onclick=function(){if(confirm('این برنامه حذف شود؟'))api().post({action:'deleteSchedule',token:state.token,id:b.dataset.sdel}).then(function(){toast('برنامه حذف شد');loadSchedule()}).catch(function(e){toast(e.message,1)})}})}).catch(function(e){toast(e.message||'خطا در برنامه هفتگی',1)})}
function setupSchedule(){var b=$('#newScheduleBtn');if(!b)return;b.onclick=function(){$('#scheduleEditor').classList.remove('hidden');$('#scheduleId').value='';$('#scheduleDay').value='';$('#scheduleTitle').value='';$('#scheduleTime').value='';$('#scheduleSort').value='0'};$('#cancelScheduleBtn').onclick=function(){$('#scheduleEditor').classList.add('hidden')};$('#saveScheduleBtn').onclick=function(){var day=$('#scheduleDay').value,title=$('#scheduleTitle').value,time=$('#scheduleTime').value;if(!day||!title||!time){toast('روز، عنوان و ساعت را وارد کن',1);return}api().post({action:'saveSchedule',token:state.token,id:$('#scheduleId').value,day:day,title:title,time:time,location:'',sort:Number($('#scheduleSort').value||0)}).then(function(){toast('برنامه ذخیره شد ✓');$('#scheduleEditor').classList.add('hidden');loadSchedule()}).catch(function(e){toast(e.message,1)})};loadSchedule()}
function loadCoaches(){api().get({action:'listCoaches',token:state.token}).then(function(r){var box=$('#coachList');box.innerHTML=r.items.map(function(x){var label=x.role==='master'?'مالک اصلی':'مدیر';return '<div class="admin-item coach-admin-item"><div class="admin-item-main"><strong>'+esc(x.name)+' <span class="status-dot '+(x.active?'on':'off')+'"></span></strong><small>'+esc(x.phone)+' · '+label+' · '+esc(x.code)+'</small><div class="permission-summary">'+PERMS.filter(function(p){return x.permissions&&x.permissions[p[0]]}).map(function(p){return '<span>'+p[1]+'</span>'}).join(' · ')+'</div></div><div class="admin-actions">'+(x.role==='master'?'':'<button data-coach-edit="'+esc(x.code)+'">ویرایش</button><button data-coach-status="'+esc(x.code)+'" data-active="'+(x.active?'0':'1')+'">'+(x.active?'اخراج':'فعال‌سازی')+'</button>')+'</div></div>'}).join('');box.querySelectorAll('[data-coach-edit]').forEach(function(b){b.onclick=function(){editCoach(b.dataset.coachEdit,r.items)}});box.querySelectorAll('[data-coach-status]').forEach(function(b){b.onclick=function(){setCoachStatus(b.dataset.coachStatus,b.dataset.active==='1')}})}).catch(function(e){toast(e.message,1)})}
function editCoach(code,list){var x=list.find(function(y){return y.code===code});if(!x)return;var name=prompt('نام مدیر:',x.name);if(name===null)return;var phone=prompt('شماره مدیر:',x.phone);if(phone===null)return;var newCode=prompt('کد جدید:',x.code);if(newCode===null)return;var wrap=document.createElement('div');renderPermissionChecks(wrap,x.permissions);var txt=PERMS.map(function(p,i){return (x.permissions&&x.permissions[p[0]]?'✓ ':'')+p[1]}).join('، ');var perms={};PERMS.forEach(function(p){perms[p[0]]=confirm('دسترسی «'+p[1]+'» فعال باشد؟\nوضعیت فعلی: '+(x.permissions&&x.permissions[p[0]]?'فعال':'خاموش'))});api().post({action:'updateCoach',token:state.token,oldCode:code,name:name,phone:phone,code:newCode,permissions:perms}).then(function(){toast('اطلاعات مدیر ذخیره شد ✓');loadCoaches()}).catch(function(e){toast(e.message,1)})}
function setCoachStatus(code,active){api().post({action:'setCoachStatus',token:state.token,code:code,active:active}).then(function(){toast(active?'مدیر فعال شد ✓':'دسترسی مدیر بسته شد');loadCoaches()}).catch(function(e){toast(e.message,1)})}
function loadOfficials(){api().get({action:'listOfficialsManage',token:state.token}).then(function(r){var box=$('#officialList');box.innerHTML=r.items.map(function(x){return '<div class="admin-item"><div class="admin-item-main"><strong>'+esc(x.name)+' <span class="status-dot '+(x.active?'on':'off')+'"></span></strong><small>'+esc(x.role)+' · '+esc(x.code)+'</small></div><div class="admin-actions"><button data-off-edit="'+esc(x.code)+'">ویرایش</button><button data-off-status="'+esc(x.code)+'" data-active="'+(x.active?'0':'1')+'">'+(x.active?'اخراج':'فعال‌سازی')+'</button></div></div>'}).join('')}).catch(function(e){toast(e.message,1)})}
function setupStaff(){
 renderPermissionChecks($('#newCoachPermissions'),{});
 $('#addCoachBtn').onclick=function(){var p=readPermissions($('#newCoachPermissions'));api().post({action:'addCoach',token:state.token,name:$('#newCoachName').value.trim(),phone:$('#newCoachPhone').value.trim(),code:$('#newCoachCode').value.trim(),permissions:p}).then(function(){toast('مدیر ثبت شد ✓');$('#newCoachName').value='';$('#newCoachPhone').value='';$('#newCoachCode').value='';renderPermissionChecks($('#newCoachPermissions'),{});loadCoaches()}).catch(function(e){toast(e.message,1)})};
 $('#addOfficialBtn').onclick=function(){api().post({action:'addOfficial',token:state.token,name:$('#newOfficialName').value.trim(),code:$('#newOfficialCode').value.trim(),role:$('#newOfficialRole').value}).then(function(){toast('مسئول ثبت شد ✓');$('#newOfficialName').value='';$('#newOfficialCode').value='';loadOfficials()}).catch(function(e){toast(e.message,1)})};
 $('#officialList').addEventListener('click',function(e){var edit=e.target.closest('[data-off-edit]'),st=e.target.closest('[data-off-status]');if(st){api().post({action:'setOfficialStatus',token:state.token,code:st.dataset.offStatus,active:st.dataset.active==='1'}).then(function(){toast('وضعیت مسئول تغییر کرد ✓');loadOfficials()}).catch(function(x){toast(x.message,1)})}else if(edit){var code=edit.dataset.offEdit;var name=prompt('نام مسئول جدید:');if(name===null)return;var newCode=prompt('کد جدید:');if(newCode===null)return;var role=prompt('نوع مسئولیت: حضور و غیاب - راهنمایی / حضور و غیاب - دبستان / نظارت');if(role===null)return;api().post({action:'updateOfficial',token:state.token,oldCode:code,name:name,code:newCode,role:role}).then(function(){toast('مسئول ویرایش شد ✓');loadOfficials()}).catch(function(x){toast(x.message,1)})}})}
function setup(){
 setupSchedule();setupStaff();
 $('#newEventBtn').onclick=function(){openEditor(null)};$('#cancelEventBtn').onclick=function(){$('#eventEditor').classList.add('hidden')};$('#saveEventBtn').onclick=saveEvent;
 $('#savePrizeBtn').onclick=function(){api().post({action:'saveGamePrize',token:state.token,prize:$('#gamePrize').value.trim()}).then(function(){toast('جایزه ذخیره شد ✓')}).catch(function(e){toast(e.message,1)})};
 $('#coachLogout').onclick=function(){sessionStorage.removeItem('coach_token');sessionStorage.removeItem('coach_name');sessionStorage.removeItem('coach_master');sessionStorage.removeItem('coach_permissions');location.reload()};
 state.token=sessionStorage.getItem('coach_token')||'';state.name=sessionStorage.getItem('coach_name')||'';state.isMaster=sessionStorage.getItem('coach_master')==='1';try{state.permissions=JSON.parse(sessionStorage.getItem('coach_permissions')||'{}')}catch(e){state.permissions={}};
 if(state.token){
  $('#coachLogin').classList.add('hidden');$('#coachDashboard').classList.remove('hidden');
  $('#coachName').textContent=state.name;$('#coachRoleBadge').textContent=state.isMaster?'مالک اصلی':'مدیر';
  applyPermissions();
  load().then(function(){if(state.isMaster){loadCoaches();loadOfficials()}}).catch(function(e){
   ['coach_token','coach_name','coach_master','coach_permissions'].forEach(function(k){sessionStorage.removeItem(k)});
   state.token='';state.name='';state.isMaster=false;state.permissions={};
   $('#coachDashboard').classList.add('hidden');$('#coachLogin').classList.remove('hidden');
   toast('نشست معتبر نبود؛ دوباره وارد شو',1);
  });
 }else login();
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',setup);else setup();
})();