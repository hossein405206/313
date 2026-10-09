(function(){'use strict';
var $=function(s){return document.querySelector(s)};
var form=$('#circleRegisterForm'),button=$('#circleSubmit'),notice=$('#circleFormNotice');
function normalizePhone(v){return String(v||'').replace(/[^0-9۰-۹٠-٩]/g,'').replace(/[۰-۹]/g,function(d){return String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d))}).replace(/[٠-٩]/g,function(d){return String('٠١٢٣٤٥٦٧٨٩'.indexOf(d))})}
function showNotice(message,error){notice.textContent=message;notice.classList.remove('hidden','is-error');if(error)notice.classList.add('is-error');notice.scrollIntoView({behavior:'smooth',block:'center'})}
['#circlePhone','#circleGuardianPhone'].forEach(function(selector){var input=$(selector);input.addEventListener('input',function(){input.value=normalizePhone(input.value).slice(0,11)})});
form.addEventListener('submit',async function(e){e.preventDefault();
 var data={firstName:$('#circleFirstName').value.trim(),lastName:$('#circleLastName').value.trim(),phone:normalizePhone($('#circlePhone').value),birthDate:$('#circleBirthDate').value,school:$('#circleSchool').value.trim(),grade:$('#circleGrade').value,guardianName:$('#circleGuardianName').value.trim(),guardianPhone:normalizePhone($('#circleGuardianPhone').value),notes:$('#circleNotes').value.trim(),guardianConsent:$('#circleGuardianConsent').checked};
 if(!data.firstName||!data.lastName||!data.school||!data.grade||!data.guardianName){showNotice('لطفاً فیلدهای ستاره‌دار را کامل کن.',true);return}
 if(!/^09\d{9}$/.test(data.phone)||!/^09\d{9}$/.test(data.guardianPhone)){showNotice('شماره همراه عضو و ولی باید ۱۱ رقم و با ۰۹ شروع شود.',true);return}
 if(!data.guardianConsent){showNotice('برای ارسال درخواست، تأیید ولی لازم است.',true);return}
 if(!window.KanoonApp||!window.KanoonApp.api){showNotice('ارتباط با سرور آماده نیست؛ صفحه را دوباره باز کن.',true);return}
 button.disabled=true;button.textContent='در حال ارسال...';
 try{var result=await window.KanoonApp.api.post(Object.assign({action:'applyCircleMembership'},data));showNotice(result.message||'درخواستت ثبت شد و در انتظار بررسی است.',false);form.reset();button.textContent='درخواست ارسال شد';}
 catch(err){showNotice(err.message||'ارسال درخواست انجام نشد؛ دوباره تلاش کن.',true);button.disabled=false;button.textContent='ارسال درخواست عضویت';}
});
})();