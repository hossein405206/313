(function(window,document){
'use strict';
const ALI_WISDOMS = [
 {a:'الصَّمتُ رَوضَةُ الفِكرِ',m:'سکوت، بوستان اندیشه و تفکر است',s:'غررالحکم، حکمت ۵۹۹'},
 {a:'العِلمُ يَنجِيكَ',m:'دانش، تو را نجات می‌دهد',s:'غررالحکم، حکمت ۱۹۶'},
 {a:'العَدلُ إِنصافٌ',m:'عدالت، انصاف و دادگری است',s:'غررالحکم، حکمت ۲۰۴'},
 {a:'العِلمُ مِصباحُ العَقلِ',m:'دانش، چراغ عقل است',s:'غررالحکم، حکمت ۵۸۹'},
 {a:'الصِّدقُ أمانَةٌ',m:'راستگویی، امانت است',s:'غررالحکم، حکمت ۲۷'},
 {a:'العَقلُ زَينٌ',m:'عقل، زینت انسان است',s:'غررالحکم، حکمت ۲۵'},
 {a:'التَّواضُعُ يَرفَعُ',m:'فروتنی، انسان را بالا می‌برد',s:'غررالحکم، حکمت ۱۹'},
 {a:'الصَّبرُ ثَمَرَةُ اليَقينِ',m:'صبر، میوه یقین است',s:'غررالحکم، حکمت ۴۶۵'},
 {a:'الذِّكرُ مِفتاحُ الأُنسِ',m:'یاد خدا، کلید انس و آرامش است',s:'غررالحکم، حکمت ۵۹۴'},
 {a:'التَّدبيرُ نِصفُ المَعونَةِ',m:'تدبیر، نیمی از یاری و گشایش است',s:'غررالحکم، حکمت ۶۱۶'},
 {a:'الوَفاءُ عُنوانُ الصَّفاءِ',m:'وفاداری، نشانه صفای دل است',s:'غررالحکم، حکمت ۶۱۳'},
 {a:'الفِكرُ يَهدي',m:'اندیشه، راهنمای انسان است',s:'غررالحکم، حکمت ۳۷'}
];

function typeText(el,text,done){
 if(!el)return;
 el.textContent='';
 var i=0;
 function step(){
  if(i<text.length){el.textContent+=text.charAt(i++);setTimeout(step,32);}
  else if(done)done();
 }
 step();
}
function showWisdom(){
 var a=$('#aliWisdomArabic'),m=$('#aliWisdomMeaning'),s=$('#aliWisdomSource');
 if(!a||!m||!s)return;
 var item=ALI_WISDOMS[Math.floor(Math.random()*ALI_WISDOMS.length)];
 a.classList.remove('is-typing');
 m.textContent='';s.textContent='';
 typeText(a,'« '+item.a+' »',function(){
  a.classList.add('is-typing');
  typeText(m,item.m);
  s.textContent=item.s;
 });
}
var $=function(s){return document.querySelector(s);};
function api(){return window.KanoonApp&&window.KanoonApp.api;}
function toast(m,e){var t=window.KanoonApp&&window.KanoonApp.toast;if(t)(e?t.error:t.success)(m);else alert(m);}
function validPhone(p){return /^09\d{9}$/.test(String(p||'').trim());}
function init(){
 showWisdom();
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