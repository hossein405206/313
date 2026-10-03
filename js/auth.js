(function(window,document){
'use strict';
var $=function(s){return document.querySelector(s);};
function api(){return window.KanoonApp&&window.KanoonApp.api;}
function toast(m,e){var t=window.KanoonApp&&window.KanoonApp.toast;if(t)(e?t.error:t.success)(m);else alert(m);}
function validPhone(p){return /^09\d{9}$/.test(String(p||'').trim());}
function init(){
 var form=$('#memberForm'), name=$('#nameInput'), phone=$('#phoneInput'), btn=$('#memberSubmit'); if(!form)return;
 phone.addEventListener('input',function(){phone.value=phone.value.replace(/\D/g,'').slice(0,11);});
 form.addEventListener('submit',async function(e){
  e.preventDefault();
  var n=name.value.trim().replace(/\s+/g,' '), p=phone.value.trim();
  if(n.length<2){toast('نام را وارد کن','error');name.focus();return;}
  if(!validPhone(p)){toast('شماره همراه نامعتبر است','error');phone.focus();return;}
  var service=api(); if(!service){toast('اتصال به سرور آماده نیست','error');return;}
  btn.disabled=true;btn.textContent='در حال ورود...';
  try{
   var res=await service.post({action:'registerMember',name:n,phone:p});
   if(window.KanoonApp&&window.KanoonApp.session)window.KanoonApp.session.setMember(res.member,res.token);
   $('#welcomeTitle').textContent=res.member&&res.member.firstName?'خوش آمدی، '+res.member.firstName:'خوش آمدی';
   $('#welcomeSubtitle').textContent=res.existing?'ورود با موفقیت انجام شد':'حساب شما با موفقیت ساخته شد';
   document.querySelectorAll('.auth-step').forEach(function(s){s.classList.toggle('active',s.getAttribute('data-step')==='2')});
   window.scrollTo(0,0);
  }catch(err){toast(err.message||'خطا در ورود','error');}
  finally{btn.disabled=false;btn.textContent='ورود به سایت';}
 });
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})(window,document);