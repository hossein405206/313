/* ============================================================================
   حلقه شهید هادی ذوالفقاری — main.js
   نسخه 4.0 — با اتصال به Google Apps Script
   ============================================================================ */

(function (window, document) {
  'use strict';

  /* ══════════════════════════════════════════════════════════════════════
     CONFIG — تنظیمات
     ══════════════════════════════════════════════════════════════════════ */

  var CONFIG = {
    API_URL: 'https://script.google.com/macros/s/AKfycbwQu_bIijvel7wu1898AZVlWMKavL00egnJc6-eTT3HiWxxjOo54-LKUblvLNLZOCO9/exec',
    CAROUSEL_INTERVAL: 4500,
    TOAST_DURATION: 3200,
    MAX_FILE_SIZE: 5 * 1024 * 1024,
    DEBUG: false,
    VERSION: '5.50.0',
    BACKEND_VERSION: '4.30.0-camp-capacity-official-role',
    BACKEND_COMPATIBLE_VERSIONS: ['4.28.0-attendance-upsert-normalized-date', '4.27.0-attendance-archive-recorded-dates', '4.26.0-attendance-chart-date-normalization', '4.25.0-jalali-date-limits']
  };

  /* ══════════════════════════════════════════════════════════════════════
     Logger — لاگ گرفتن
     ══════════════════════════════════════════════════════════════════════ */

  var Logger = {
    info: function () {
      if (!CONFIG.DEBUG) return;
      var args = Array.prototype.slice.call(arguments);
      args.unshift('[کانون]');
      console.log.apply(console, args);
    },
    error: function () {
      var args = Array.prototype.slice.call(arguments);
      args.unshift('[کانون-خطا]');
      console.error.apply(console, args);
    }
  };

  /* ══════════════════════════════════════════════════════════════════════
     DOM — کمک‌کننده‌ها
     ══════════════════════════════════════════════════════════════════════ */

  var DOM = {
    qs: function (sel, root) {
      return (root || document).querySelector(sel);
    },
    qsa: function (sel, root) {
      return Array.prototype.slice.call(
        (root || document).querySelectorAll(sel)
      );
    },
    on: function (el, ev, fn, opt) {
      if (!el) return function () {};
      el.addEventListener(ev, fn, opt || false);
      return function () { el.removeEventListener(ev, fn, opt || false); };
    },
    escape: function (str) {
      if (str === null || str === undefined) return '';
      return String(str)
        .split('&').join('&amp;')
        .split('<').join('&lt;')
        .split('>').join('&gt;')
        .split('"').join('&quot;')
        .split("'").join('&#39;');
    },
    toPersianNum: function (num) {
      var en = String(num);
      var fa = ['۰','۱','۲','۳','۴','۵','۶','۷','۸','۹'];
      var out = '';
      for (var i = 0; i < en.length; i++) {
        var c = en.charAt(i);
        var idx = en.indexOf(c);
        var code = c.charCodeAt(0);
        if (code >= 48 && code <= 57) {
          out = out + fa[code - 48];
        } else {
          out = out + c;
        }
      }
      return out;
    }
  };

  /* ══════════════════════════════════════════════════════════════════════
     Validate — اعتبارسنجی
     ══════════════════════════════════════════════════════════════════════ */


  /* تقویم شمسی یکپارچه: نمایش شمسی، مقدار ISO برای سازگاری با سرور */
  var JalaliDate = (function () {
    var monthNames=['فروردین','اردیبهشت','خرداد','تیر','مرداد','شهریور','مهر','آبان','آذر','دی','بهمن','اسفند'];
    function div(a,b){return Math.trunc(a/b)} function mod(a,b){return a-div(a,b)*b}
    function g2jdn(gy,gm,gd){var d=div((gy+div(gm-8,6)+100100)*1461,4)+div(153*mod(gm+9,12)+2,5)+gd-34840408;return d-div(div(gy+100100+div(gm-8,6),100)*3,4)+752;}
    function jdn2g(jdn){var j=4*jdn+139361631;j+=div(div(4*jdn+183187720,146097)*3,4)*4-3908;var i=div(mod(j,1461),4)*5+308,gd=div(mod(i,153),5)+1,gm=mod(div(i,153),12)+1,gy=div(j,1461)-100100+div(8-gm,6);return {gy:gy,gm:gm,gd:gd};}
    function jalCal(jy){var breaks=[-61,9,38,199,426,686,756,818,1111,1181,1210,1635,2060,2097,2192,2262,2324,2394,2456,3178],bl=breaks.length,gy=jy+621,leapJ=-14,jp=breaks[0],jm,jump,leapG,march,n;if(jy<jp||jy>=breaks[bl-1])throw new Error('سال شمسی نامعتبر است');for(var i=1;i<bl;i++){jm=breaks[i];jump=jm-jp;if(jy<jm)break;leapJ+=div(jump,33)*8+div(mod(jump,33),4);jp=jm;}n=jy-jp;leapJ+=div(n,33)*8+div(mod(n,33)+3,4);if(mod(jump,33)===4&&jump-n===4)leapJ++;leapG=div(gy,4)-div((div(gy,100)+1)*3,4)-150;march=20+leapJ-leapG;if(jump-n<6)n=n-jump+div(jump+4,33)*33;var leap=mod(mod(n+1,33)-1,4);if(leap===-1)leap=4;return {leap:leap,gy:gy,march:march};}
    function jdn2j(jdn){var gy=jdn2g(jdn).gy,jy=Math.min(gy-621,3177),r=jalCal(jy),first=g2jdn(r.gy,3,r.march),k=jdn-first,jm,jd;if(k>=0){if(k<=185)return {jy:jy,jm:1+div(k,31),jd:mod(k,31)+1};k-=186;}else{jy--;k+=179;if(r.leap===1)k++;}jm=7+div(k,30);jd=mod(k,30)+1;return {jy:jy,jm:jm,jd:jd};}
    function j2g(jy,jm,jd){var r=jalCal(jy),offset=(jm-1)*31-div(jm,7)*(jm-7)+jd-1;return jdn2g(g2jdn(r.gy,3,r.march)+offset);}
    function pad(n){return String(n).padStart(2,'0')} function fa(s){return String(s).replace(/\d/g,function(x){return '۰۱۲۳۴۵۶۷۸۹'.charAt(+x);});}
    function format(iso){var m=/^(\d{4})-(\d{2})-(\d{2})/.exec(String(iso||''));if(!m)return '';try{var j=jdn2j(g2jdn(+m[1],+m[2],+m[3]));return fa(j.jy+'/'+pad(j.jm)+'/'+pad(j.jd));}catch(e){return String(iso||'');}}
    function toISO(y,m,d){var g=j2g(y,m,d);return g.gy+'-'+pad(g.gm)+'-'+pad(g.gd);}
    function today(){var d=new Date(),j=jdn2j(g2jdn(d.getFullYear(),d.getMonth()+1,d.getDate()));return {y:j.jy,m:j.jm,d:j.jd,iso:toISO(j.jy,j.jm,j.jd)};}
    function addYearsISO(iso,years){var p=String(iso).split('-').map(Number),d=new Date(p[0],p[1]-1,p[2]);d.setFullYear(d.getFullYear()+years);return d.getFullYear()+'-'+pad(d.getMonth()+1)+'-'+pad(d.getDate());}
    function configureRange(input){var t=today(),id=input.id;
      /* پیش‌فرض: تاریخ‌های گزارش و سوابق فقط تا امروز؛ سقف تقویم در همه حالت‌ها سال ۱۴۹۸ است. */
      input.max=t.iso;
      if(id==='campDeadline'){input.min=t.iso;input.max=addYearsISO(t.iso,1);}
      else if(id==='eventDate'){input.max=addYearsISO(t.iso,1);}
      if(input.min&&input.value&&input.value<input.min)input.value=input.min;
      if(input.max&&input.value&&input.value>input.max)input.value=input.max;
    }
    function jalaliYear(iso){var m=/^(\d{4})-(\d{2})-(\d{2})$/.exec(String(iso||''));if(!m)return null;try{return jdn2j(g2jdn(+m[1],+m[2],+m[3])).jy;}catch(e){return null;}}
    function setup(){
      var inputs=Array.prototype.slice.call(document.querySelectorAll('input[type="date"]:not([data-jalali-ready])'));if(!inputs.length)return;inputs.forEach(configureRange);
      var overlay=document.createElement('div');overlay.className='jalali-global-overlay';overlay.hidden=true;overlay.innerHTML='<section class="jalali-global-card" role="dialog" aria-modal="true" aria-label="انتخاب تاریخ شمسی"><header><div><small>تقویم شمسی</small><h3 id="jalaliGlobalTitle">سال را انتخاب کنید</h3></div><button type="button" class="jalali-global-close" aria-label="بستن">×</button></header><p class="jalali-global-summary">انتخاب مرحله‌ای سال، ماه و روز</p><div class="jalali-global-years"></div><div class="jalali-global-months" hidden></div><div class="jalali-global-days" hidden></div><footer><button type="button" class="jalali-global-back" hidden>مرحله قبل</button><button type="button" class="jalali-global-cancel">انصراف</button><button type="button" class="jalali-global-confirm" disabled>تأیید تاریخ</button></footer></section>';document.body.appendChild(overlay);
      var title=overlay.querySelector('#jalaliGlobalTitle'),summary=overlay.querySelector('.jalali-global-summary'),years=overlay.querySelector('.jalali-global-years'),mbox=overlay.querySelector('.jalali-global-months'),dbox=overlay.querySelector('.jalali-global-days'),back=overlay.querySelector('.jalali-global-back'),confirm=overlay.querySelector('.jalali-global-confirm'),active=null,stage='year',chosen=null;
      function close(){overlay.hidden=true;active=null;}overlay.querySelector('.jalali-global-close').onclick=close;overlay.querySelector('.jalali-global-cancel').onclick=close;overlay.addEventListener('click',function(e){if(e.target===overlay)close();});
      function allowed(iso){if(active.id==='attendanceArchiveDate'){try{return JSON.parse(active.getAttribute('data-available-dates')||'[]').indexOf(iso)>=0;}catch(e){return false;}}return (!active.min||iso>=active.min)&&(!active.max||iso<=active.max);}
      function render(){years.hidden=stage!=='year';mbox.hidden=stage!=='month';dbox.hidden=stage!=='day';back.hidden=stage==='year';confirm.disabled=!(chosen&&chosen.iso&&allowed(chosen.iso));
        if(stage==='year'){title.textContent='ابتدا سال را انتخاب کنید';summary.textContent='سال شمسی موردنظر را انتخاب کنید';years.innerHTML='';var currentYear=today().y,minYear=1300,maxYear=1498,archiveDates=null;if(active.id==='attendanceArchiveDate'){try{archiveDates=JSON.parse(active.getAttribute('data-available-dates')||'[]');}catch(e){archiveDates=[];}if(!archiveDates.length){summary.textContent='هنوز هیچ تاریخ حضور و غیابی ثبت نشده است';return;}}else if(active.id==='activityReportDate'){maxYear=currentYear;}else if(active.id==='campDeadline'){minYear=currentYear;maxYear=Math.min(1498,currentYear+1);}else if(active.id==='eventDate'){maxYear=Math.min(1498,currentYear+1);}minYear=Math.max(1300,minYear);maxYear=Math.min(1498,maxYear);var yearSet={};if(archiveDates)archiveDates.forEach(function(iso){var jy=jalaliYear(iso);if(jy)yearSet[jy]=true;});for(var y=maxYear;y>=minYear;y--){if(archiveDates&&!yearSet[y])continue;var b=document.createElement('button');b.type='button';b.textContent=fa(y);if(chosen&&chosen.y===y)b.classList.add('selected');b.onclick=function(yy){return function(){chosen={y:yy,m:0,d:0,iso:''};stage='month';render();};}(y);years.appendChild(b);}}
        else if(stage==='month'){title.textContent='حالا ماه را انتخاب کنید';summary.textContent='سال انتخاب‌شده: '+fa(chosen.y);mbox.innerHTML='';var archiveDates=null;if(active.id==='attendanceArchiveDate'){try{archiveDates=JSON.parse(active.getAttribute('data-available-dates')||'[]');}catch(e){archiveDates=[];}}monthNames.forEach(function(label,i){var b=document.createElement('button');b.type='button';b.textContent=label;if(archiveDates&&!archiveDates.some(function(iso){var p=iso.split('-').map(Number),j=jdn2j(g2jdn(p[0],p[1],p[2]));return j.jy===chosen.y&&j.jm===i+1;}))b.disabled=true;b.onclick=function(){chosen.m=i+1;chosen.d=0;chosen.iso='';stage='day';render();};mbox.appendChild(b);});}
        else{title.textContent='روز را انتخاب کنید';summary.textContent=monthNames[chosen.m-1]+' '+fa(chosen.y);dbox.innerHTML='';var first=j2g(chosen.y,chosen.m,1),offset=(new Date(first.gy,first.gm-1,first.gd).getDay()+1)%7,limit=chosen.m<=6?31:(chosen.m<=11?30:(jalCal(chosen.y).leap===0?30:29));['ش','ی','د','س','چ','پ','ج'].forEach(function(w){var s=document.createElement('span');s.className='weekday';s.textContent=w;dbox.appendChild(s);});for(var z=0;z<offset;z++){var blank=document.createElement('span');blank.className='blank';dbox.appendChild(blank);}for(var d=1;d<=limit;d++){var iso=toISO(chosen.y,chosen.m,d),btn=document.createElement('button');btn.type='button';btn.textContent=fa(d);if(!allowed(iso))btn.disabled=true;if(chosen.d===d)btn.classList.add('selected');btn.onclick=function(dd,ii){return function(){chosen.d=dd;chosen.iso=ii;render();};}(d,iso);dbox.appendChild(btn);}}
      }
      back.onclick=function(){if(stage==='day')stage='month';else if(stage==='month')stage='year';if(chosen){chosen.d=0;chosen.iso='';}render();};
      confirm.onclick=function(){if(!active||!chosen||!chosen.iso||!allowed(chosen.iso))return;active.value=chosen.iso;active.dispatchEvent(new Event('input',{bubbles:true}));active.dispatchEvent(new Event('change',{bubbles:true}));close();};
      inputs.forEach(function(input){input.setAttribute('data-jalali-ready','1');var initial=input.value,display=document.createElement('input');display.type='text';display.readOnly=true;display.className=input.className+' jalali-global-input';display.id=input.id+'JalaliDisplay';display.placeholder='برای انتخاب تاریخ شمسی لمس کنید';display.setAttribute('aria-label',input.getAttribute('aria-label')||'انتخاب تاریخ شمسی');display.value=format(initial);input.style.display='none';input.insertAdjacentElement('afterend',display);var desc=Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value');try{Object.defineProperty(input,'value',{configurable:true,get:function(){return desc.get.call(this);},set:function(v){desc.set.call(this,v);display.value=format(v);}});}catch(e){}display.addEventListener('click',function(){active=input;var t=today(),m=/^(\d{4})-(\d{2})-(\d{2})$/.exec(input.value);chosen=m?(function(){var j=jdn2j(g2jdn(+m[1],+m[2],+m[3]));return {y:j.jy,m:j.jm,d:j.jd,iso:''};})():{y:t.y,m:t.m,d:t.d,iso:t.iso};stage='year';overlay.hidden=false;render();});if(initial)display.value=format(initial);});
    }
    return {format:format,fromJalali:toISO,setup:setup};
  })();

  var Validate = {
    normalizeDigits: function (value) {
      return String(value || '')
        .replace(/[۰-۹]/g, function (c) { return String('۰۱۲۳۴۵۶۷۸۹'.indexOf(c)); })
        .replace(/[٠-٩]/g, function (c) { return String('٠١٢٣٤٥٦٧٨٩'.indexOf(c)); });
    },
    iranMobile: function (phone) {
      var p = String(phone || '').trim()
        .replace(/[۰-۹]/g, function (d) { return String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d)); })
        .replace(/[٠-٩]/g, function (d) { return String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)); });
      if (p.length !== 11) return false;
      if (p.charAt(0) !== '0' || p.charAt(1) !== '9') return false;
      for (var i = 0; i < 11; i++) {
        var c = p.charCodeAt(i);
        if (c < 48 || c > 57) return false;
      }
      return true;
    },
    notEmpty: function (v) {
      return String(v || '').trim().length > 0;
    },
    isImage: function (file) {
      if (!file || !file.type) return false;
      return file.type.indexOf('image/') === 0;
    },
    fileSize: function (file, max) {
      return file && file.size <= max;
    }
  };

  /* ══════════════════════════════════════════════════════════════════════
     Api — لایه‌ی ارتباط با Apps Script
     ══════════════════════════════════════════════════════════════════════ */

  var Api = {
    _buildUrl: function (params) {
      var parts = [];
      var keys = Object.keys(params);
      for (var i = 0; i < keys.length; i++) {
        var k = keys[i];
        parts.push(encodeURIComponent(k) + '=' + encodeURIComponent(params[k]));
      }
      var sep = CONFIG.API_URL.indexOf('?') >= 0 ? '&' : '?';
      return CONFIG.API_URL + sep + parts.join('&');
    },

    get: async function (params) {
      var url = Api._buildUrl(params);
      Logger.info('GET', url);

      var res;
      try {
        res = await fetch(url);
      } catch (err) {
        Logger.error('Network:', err);
        throw new Error('اتصال به سرور برقرار نشد');
      }
      if (!res.ok) throw new Error('خطای سرور: ' + res.status);
      return Api._parse(res, params && params.action);
    },

    post: async function (payload) {
      Logger.info('POST', payload.action);

      var res;
      try {
        res = await fetch(CONFIG.API_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'text/plain;charset=utf-8' },
          body: JSON.stringify(payload)
        });
      } catch (err) {
        Logger.error('Network:', err);
        throw new Error('اتصال به سرور برقرار نشد. اینترنت رو چک کن');
      }
      if (!res.ok) throw new Error('خطای سرور: ' + res.status);
      return Api._parse(res, payload && payload.action);
    },

    checkBackendVersion: async function () {
      var result = await Api.get({ action: 'ping' });
      if (!result || (result.version !== CONFIG.BACKEND_VERSION && CONFIG.BACKEND_COMPATIBLE_VERSIONS.indexOf(result.version) < 0)) {
        var actual = result && result.version ? 'نسخه فعلی: ' + result.version : 'نسخه سرور مشخص نیست';
        throw new Error('بک‌اند سایت به‌روز نشده است (' + actual + '). فایل apps-script/Code.gs را با نسخه جدید جایگزین و Deploy را با New version منتشر کن.');
      }
      return result;
    },

    _parse: async function (res, action) {
      var text = await res.text();
      Logger.info('Response:', text.substring(0, 200));

      var json;
      try {
        json = JSON.parse(text);
      } catch (err) {
        Logger.error('Invalid JSON:', text);
        throw new Error('پاسخ سرور نامعتبر بود');
      }
      if (!json.ok) throw new Error(json.error || ('سرور برای عملیات «' + String(action || 'نامشخص') + '» پاسخ ناموفقِ بدون توضیح برگرداند. نسخهٔ بک‌اند و گزارش اجرای Apps Script را بررسی کن.'));
      return json;
    }
  };

  /* ══════════════════════════════════════════════════════════════════════
     Toast — پیام کوتاه
     ══════════════════════════════════════════════════════════════════════ */

  var Toast = (function () {
    var timer = null;

    function ensure() {
      var el = DOM.qs('#appToast');
      if (!el) {
        el = document.createElement('div');
        el.id = 'appToast';
        el.className = 'toast';
        el.setAttribute('role', 'status');
        el.setAttribute('aria-live', 'polite');
        document.body.appendChild(el);
      }
      return el;
    }

    return {
      show: function (msg, type) {
        var el = ensure();
        el.textContent = msg;
        el.classList.toggle('error', type === 'error');
        el.classList.add('show');
        if (timer) clearTimeout(timer);
        timer = setTimeout(function () { el.classList.remove('show'); }, CONFIG.TOAST_DURATION);
      },
      success: function (m) { Toast.show(m, 'success'); },
      error: function (m)   { Toast.show(m, 'error'); }
    };
  })();

  /* ══════════════════════════════════════════════════════════════════════
     Modal — مدیریت مدال‌ها
     ══════════════════════════════════════════════════════════════════════ */

  var Modal = {
    _last: null,
    open: function (el) {
      if (!el) return;
      this._last = document.activeElement;
      el.classList.add('active');
      document.body.style.overflow = 'hidden';
      setTimeout(function () {
        var f = el.querySelector('input, button, [tabindex]');
        if (f) f.focus();
      }, 100);
    },
    close: function (el) {
      if (!el) return;
      el.classList.remove('active');
      document.body.style.overflow = '';
      if (this._last && typeof this._last.focus === 'function') this._last.focus();
    }
  };

  /* ══════════════════════════════════════════════════════════════════════
     Session — مدیریت ورود کاربر و مسئول
     ══════════════════════════════════════════════════════════════════════ */

  var Session = {
    _keyUser: 'kanoon_member',
    _keyOfficial: 'kanoon_official',
    _legacyUser: 'kanoon_member',
    _legacyOfficial: 'kanoon_official',
    _read: function (key, legacyKey) {
      try {
        var raw = localStorage.getItem(key);
        if (!raw) {
          raw = sessionStorage.getItem(legacyKey || key);
          if (raw) localStorage.setItem(key, raw);
        }
        return raw ? JSON.parse(raw) : null;
      } catch (e) { return null; }
    },
    setMember: function (member, token) {
      try {
        var value = Object.assign({}, member || {});
        if (token) value.token = token;
        localStorage.setItem(this._keyUser, JSON.stringify(value));
      } catch (e) { Logger.error('Session set error', e); }
    },
    getMember: function () { return this._read(this._keyUser, this._legacyUser); },
    clearMember: function () {
      try { localStorage.removeItem(this._keyUser); sessionStorage.removeItem(this._legacyUser); } catch (e) {}
    },
    setOfficial: function (official, token) {
      try {
        var value = Object.assign({}, official || {});
        if (token) value.token = token;
        localStorage.setItem(this._keyOfficial, JSON.stringify(value));
      } catch (e) { Logger.error('Session set error', e); }
    },
    getOfficial: function () { return this._read(this._keyOfficial, this._legacyOfficial); },
    clearOfficial: function () {
      try { localStorage.removeItem(this._keyOfficial); sessionStorage.removeItem(this._legacyOfficial); } catch (e) {}
    }
  };

  /* ══════════════════════════════════════════════════════════════════════
     Navigation — هایلایت نوار پایین
     ══════════════════════════════════════════════════════════════════════ */

  function Navigation() {
    var path = location.pathname.split('/').pop() || 'index.html';
    var items = DOM.qsa('.bottom-nav .nav-item');
    for (var i = 0; i < items.length; i++) {
      var item = items[i];
      var href = item.getAttribute('href') || '';
      var isActive = href === path;
      item.classList.toggle('active', isActive);
      if (isActive) item.setAttribute('aria-current', 'page');
      else item.removeAttribute('aria-current');
    }
  }

  /* ══════════════════════════════════════════════════════════════════════
     Carousel — اسلایدر
     ══════════════════════════════════════════════════════════════════════ */

  function Carousel(el) {
    if (!el) return;

    var slides = DOM.qsa('.carousel-slide', el);
    var dots   = DOM.qsa('.dot', el);
    if (slides.length < 2) return;

    var reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    var current = 0;
    var timerId = null;

    function setSlide(idx) {
      if (idx < 0 || idx >= slides.length) return;
      for (var i = 0; i < slides.length; i++) {
        var on = (i === idx);
        slides[i].classList.toggle('active', on);
        slides[i].setAttribute('aria-hidden', String(!on));
      }
      for (var j = 0; j < dots.length; j++) {
        var on2 = (j === idx);
        dots[j].classList.toggle('active', on2);
        dots[j].setAttribute('aria-selected', String(on2));
      }
      current = idx;
    }

    function next() { setSlide((current + 1) % slides.length); }
    function start() {
      if (reduced) return;
      stop();
      timerId = setInterval(next, CONFIG.CAROUSEL_INTERVAL);
    }
    function stop() {
      if (timerId) { clearInterval(timerId); timerId = null; }
    }

    for (var k = 0; k < dots.length; k++) {
      (function (dot) {
        DOM.on(dot, 'click', function () {
          var idx = parseInt(dot.getAttribute('data-index'), 10);
          if (!isNaN(idx)) { setSlide(idx); start(); }
        });
      })(dots[k]);
    }

    DOM.on(el, 'mouseenter', stop);
    DOM.on(el, 'mouseleave', start);
    DOM.on(document, 'visibilitychange', function () {
      if (document.hidden) stop(); else start();
    });

    var tx = 0;
    DOM.on(el, 'touchstart', function (e) {
      tx = e.changedTouches[0].clientX; stop();
    }, { passive: true });
    DOM.on(el, 'touchend', function (e) {
      var dx = e.changedTouches[0].clientX - tx;
      if (Math.abs(dx) > 40) {
        var dir = dx < 0 ? 1 : -1;
        setSlide((current + dir + slides.length) % slides.length);
      }
      start();
    }, { passive: true });

    setSlide(0);
    start();
  }

  /* ══════════════════════════════════════════════════════════════════════
     Officials — مسئولین (از API)
     ══════════════════════════════════════════════════════════════════════ */

  function OfficialsPage() {
    var gridOfficial = DOM.qs('#officialsGridOfficial');
    var gridSpecial  = DOM.qs('#officialsGridSpecial');
    if (!gridOfficial && !gridSpecial) return;

    var chips = DOM.qsa('.chip[data-filter]');
    var sectionOfficial = DOM.qs('.officials-section[data-section="official"]');
    var sectionSpecial  = DOM.qs('.officials-section[data-section="special"]');
    var emptyEl = DOM.qs('#officialsEmpty');
    var currentFilter = 'all';

    function avatarLetter(name) {
      if (!name) return '؟';
      return String(name).trim().charAt(0);
    }

    function renderCard(o) {
      var phone = String(o.phone || '').trim();
      var phoneButton = '';
      if (phone) {
        phoneButton = ''
          + '<a class="contact-btn" href="tel:' + DOM.escape(phone) + '">'
          +   '<svg viewBox="0 0 24 24" aria-hidden="true">'
          +     '<path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/>'
          +   '</svg>'
          +   '<span>تماس</span>'
          + '</a>';
      }

      return ''
        + '<div class="official-card">'
        +   '<div class="avatar">' + DOM.escape(avatarLetter(o.name)) + '</div>'
        +   '<h4>' + DOM.escape(o.name) + '</h4>'
        +   '<span class="role">' + DOM.escape(o.role) + '</span>'
        +   phoneButton
        + '</div>';
    }

    function render(officials) {
      var officialList = [];
      var specialList = [];

      for (var i = 0; i < officials.length; i++) {
        var o = officials[i];
        var t = String(o.type || 'official').trim();
        if (t === 'official') officialList.push(o);
        else specialList.push(o);
      }

      if (gridOfficial) {
        gridOfficial.innerHTML = officialList.map(renderCard).join('');
      }
      if (gridSpecial) {
        gridSpecial.innerHTML = specialList.map(renderCard).join('');
      }

      var cOff = DOM.qs('#countOfficial');
      var cSpec = DOM.qs('#countSpecial');
      var sTot = DOM.qs('#statTotal');
      var sOff = DOM.qs('#statOfficial');
      var sSpec = DOM.qs('#statSpecial');

      if (cOff) cOff.textContent = DOM.toPersianNum(officialList.length) + ' نفر';
      if (cSpec) cSpec.textContent = DOM.toPersianNum(specialList.length) + ' نفر';
      if (sTot) sTot.textContent = DOM.toPersianNum(officials.length);
      if (sOff) sOff.textContent = DOM.toPersianNum(officialList.length);
      if (sSpec) sSpec.textContent = DOM.toPersianNum(specialList.length);

      applyFilter(currentFilter);
    }

    function applyFilter(filter) {
      currentFilter = filter;
      if (filter === 'official') {
        if (sectionOfficial) sectionOfficial.classList.remove('hidden');
        if (sectionSpecial)  sectionSpecial.classList.add('hidden');
      } else if (filter === 'special') {
        if (sectionOfficial) sectionOfficial.classList.add('hidden');
        if (sectionSpecial)  sectionSpecial.classList.remove('hidden');
      } else {
        if (sectionOfficial) sectionOfficial.classList.remove('hidden');
        if (sectionSpecial)  sectionSpecial.classList.remove('hidden');
      }
    }

    for (var i = 0; i < chips.length; i++) {
      (function (chip) {
        DOM.on(chip, 'click', function () {
          for (var j = 0; j < chips.length; j++) chips[j].classList.remove('active');
          chip.classList.add('active');
          applyFilter(chip.getAttribute('data-filter') || 'all');
        });
      })(chips[i]);
    }

    // بارگذاری از API
    Logger.info('بارگذاری مسئولین...');
    Api.get({ action: 'listOfficials' })
      .then(function (res) {
        Logger.info('مسئولین:', res.items ? res.items.length : 0);
        render(res.items || []);
      })
      .catch(function (err) {
        Logger.error('خطا در مسئولین:', err);
        if (emptyEl) {
          emptyEl.classList.remove('hidden');
          emptyEl.querySelector('p').textContent = 'خطا در بارگذاری مسئولین';
        }
      });
  }

  /* ══════════════════════════════════════════════════════════════════════
     Official Login — ورود مسئولین با کد
     ══════════════════════════════════════════════════════════════════════ */

  function OfficialLogin() {
    var modal = DOM.qs('#officialLoginModal');
    var openBtn = DOM.qs('#openOfficialLogin');
    var form = DOM.qs('#officialLoginForm');
    var input = DOM.qs('#officialCodeInput');
    var expectedRole = '';

    if (!modal || !form || !input) return;

    DOM.qsa('.role-gate').forEach(function (gate) {
      DOM.on(gate, 'click', function () {
        expectedRole = String(gate.getAttribute('data-role') || '');
        Modal.open(modal);
      });
    });

    if (openBtn) {
      DOM.on(openBtn, 'click', function () {
        expectedRole = '';
        Modal.open(modal);
      });
    }

    DOM.on(modal, 'click', function (e) {
      if (e.target === modal || e.target.hasAttribute('data-close-modal')) {
        expectedRole = '';
        Modal.close(modal);
      }
    });

    DOM.on(document, 'keydown', function (e) {
      if (e.key === 'Escape' && modal.classList.contains('active')) {
        Modal.close(modal);
      }
    });

    DOM.on(form, 'submit', async function (e) {
      e.preventDefault();
      var code = input.value.trim().toUpperCase();

      if (!code) {
        Toast.error('کد مسئولیت رو وارد کن');
        return;
      }

      var btn = form.querySelector('button[type="submit"]');
      btn.disabled = true;
      btn.textContent = 'در حال بررسی...';

      try {
        // verifyOfficialCode performs its own server-side validation. Do not block official login
        // when an unrelated backend patch version (such as date normalization) has not been deployed.
        var res = await Api.post({ action: 'verifyOfficialCode', code: code });
        if (!res.official) throw new Error('کد نامعتبر است');

        var official = res.official;
        if (expectedRole === 'attendance' && String(official.role || '').indexOf('حضور') < 0) {
          throw new Error('این کد برای مسئول نظارت است؛ کد مسئول حضور و غیاب را وارد کن');
        }
        if (expectedRole === 'supervision' && String(official.role || '').indexOf('نظارت') < 0) {
          throw new Error('این کد برای مسئول حضور و غیاب است؛ کد مسئول نظارت را وارد کن');
        }
        if (expectedRole === 'camp' && String(official.role || '').trim() !== 'مسئول اردو') {
          throw new Error('این کد برای مسئول اردو نیست؛ کد مسئول اردو را وارد کن');
        }
        Session.setOfficial(official, res.token);

        Toast.success('خوش آمدی، ' + (official.name || 'مسئول'));
        Logger.info('ورود مسئول:', official);

        // هدایت به پنل مربوطه
        setTimeout(function () {
          var role = String(official.role || '');
          if (role.indexOf('حضور') >= 0) {
            location.href = 'attendance.html';
          } else if (role.indexOf('نظارت') >= 0) {
            location.href = 'supervision.html';
          } else if (role.indexOf('اردو') >= 0) {
            location.href = 'coach.html';
          } else {
            location.href = 'index.html';
            Toast.show('پنل این مسئولیت هنوز آماده نیست', 'error');
          }
        }, 800);

      } catch (err) {
        Logger.error('ورود مسئول:', err);
        Toast.error(err.message || 'کد نامعتبر است');
      } finally {
        btn.disabled = false;
        btn.textContent = 'ورود';
      }
    });
  }

  /* ══════════════════════════════════════════════════════════════════════
     Activities — فعالیت‌ها (از API)
     ══════════════════════════════════════════════════════════════════════ */

  function ActivitiesPage() {
    var list = DOM.qs('#activityList');
    if (!list) return;

    var chips = DOM.qsa('.chip[data-filter]');
    var allEvents = [];
    var currentFilter = 'all';

    function renderCard(ev) {
      return ''
        + '<article class="activity-card">'
        +   '<div class="thumb">'
        +     '<img src="' + DOM.escape(ev.imageUrl || ev.image || 'images/placeholder.svg') + '"'
        +          ' alt="' + DOM.escape(ev.title) + '" loading="lazy">'
        +     '<span class="badge">' + DOM.escape(ev.label || ev.category || 'عمومی') + '</span>'
        +   '</div>'
        +   '<div class="body">'
        +     '<h3>' + DOM.escape(ev.title) + '</h3>'
        +     '<div class="meta"><span>' + DOM.escape(JalaliDate.format(ev.date) || ev.date || '') + '</span></div>'
        +   '</div>'
        + '</article>';
    }

    function render() {
      var filtered = (currentFilter === 'all')
        ? allEvents
        : allEvents.filter(function (ev) {
            return String(ev.label || ev.category) === currentFilter;
          });

      if (!filtered.length) {
        list.innerHTML = '<div class="empty"><p>فعالیتی در این دسته یافت نشد</p></div>';
        return;
      }

      list.innerHTML = filtered.map(renderCard).join('');
    }

    for (var i = 0; i < chips.length; i++) {
      (function (chip) {
        DOM.on(chip, 'click', function () {
          for (var j = 0; j < chips.length; j++) chips[j].classList.remove('active');
          chip.classList.add('active');
          currentFilter = chip.getAttribute('data-filter') || 'all';
          render();
        });
      })(chips[i]);
    }

    Logger.info('بارگذاری فعالیت‌ها...');
    Api.get({ action: 'listActivities' })
      .then(function (res) {
        allEvents = res.items || [];
        Logger.info('فعالیت‌ها:', allEvents.length);
        render();
      })
      .catch(function (err) {
        Logger.error('خطا در فعالیت‌ها:', err);
        list.innerHTML = '<div class="empty"><p>خطا در بارگذاری</p></div>';
      });
  }

  /* ══════════════════════════════════════════════════════════════════════
     Schedule — برنامه هفتگی
     ══════════════════════════════════════════════════════════════════════ */

  var WEEKLY_SCHEDULE = [
    { day: 'شنبه', slots: [
      { time: '18:00', title: 'کلاس قرآن', note: 'حاج آقا موسوی' },
      { time: '19:30', title: 'هیئت هفتگی', note: 'سالن اصلی' }
    ]},
    { day: 'یک‌شنبه', slots: [{ time: '17:30', title: 'تمرین فوتبال', note: 'سالن ورزشی' }] },
    { day: 'دوشنبه', slots: [{ time: '18:00', title: 'دوره تربیتی', note: 'کتاب مرام' }] },
    { day: 'سه‌شنبه', slots: [{ time: '19:00', title: 'جلسه مسئولین', note: 'اتاق مدیریت' }] },
    { day: 'چهارشنبه', slots: [{ time: '18:30', title: 'کلاس احکام', note: '' }] },
    { day: 'پنج‌شنبه', slots: [
      { time: '20:00', title: 'مسابقات PS5', note: 'با جایزه' },
      { time: '21:30', title: 'دعای کمیل', note: '' }
    ]},
    { day: 'جمعه', slots: [{ time: '06:00', title: 'دعای ندبه', note: 'سالن اصلی' }] }
  ];

  function SchedulePage() {
    var wrap = DOM.qs('#weeklySchedule');
    if (!wrap) return;

    var dayNames = ['یک‌شنبه','دوشنبه','سه‌شنبه','چهارشنبه','پنج‌شنبه','جمعه','شنبه'];
    var today = dayNames[new Date().getDay()];

    var html = '';
    for (var i = 0; i < WEEKLY_SCHEDULE.length; i++) {
      var day = WEEKLY_SCHEDULE[i];
      var isToday = day.day === today;

      var slotsHtml = '';
      for (var j = 0; j < day.slots.length; j++) {
        var s = day.slots[j];
        slotsHtml += ''
          + '<div class="slot">'
          +   '<span class="time">' + DOM.escape(s.time) + '</span>'
          +   '<div class="desc">'
          +     '<strong>' + DOM.escape(s.title) + '</strong>'
          +     (s.note ? '<small>' + DOM.escape(s.note) + '</small>' : '')
          +   '</div>'
          + '</div>';
      }

      html += ''
        + '<div class="day-block' + (isToday ? ' today' : '') + '">'
        +   '<div class="day-title">'
        +     (isToday ? '<span class="today-tag">امروز</span>' : '')
        +     DOM.escape(day.day)
        +   '</div>'
        +   slotsHtml
        + '</div>';
    }
    wrap.innerHTML = html;
  }

  /* ══════════════════════════════════════════════════════════════════════
     Register Form — فرم ثبت‌نام اردو
     ══════════════════════════════════════════════════════════════════════ */

  function RegisterForm(form) {
    if (!form) return;

    var zone = DOM.qs('#uploadZone');
    var fileInput = DOM.qs('#fileInput');
    var preview = DOM.qs('#uploadPreview');
    var campSelect = DOM.qs('#campSelect');
    var selectedFile = null;
    var camps = [];
    var pendingRegistrationId = '';
    var receiptFile = null;
    var campInfoCard = DOM.qs('#campInfoCard');
    var paymentStep = DOM.qs('#campPaymentStep');
    var receiptInput = DOM.qs('#receiptInput');
    var receiptPreview = DOM.qs('#receiptPreview');
    var receiptBtn = DOM.qs('#sendReceiptBtn');
    var paymentStatus = DOM.qs('#paymentStepStatus');

    function money(value) { return Number(value || 0).toLocaleString('fa-IR') + ' تومان'; }
    function selectedCamp() {
      var id = campSelect ? campSelect.value : '';
      for (var i = 0; i < camps.length; i++) if (String(camps[i].id) === String(id)) return camps[i];
      return null;
    }
    function updateCampInfo(camp, finalStep) {
      camp = camp || selectedCamp();
      if (!camp) { if (campInfoCard) campInfoCard.hidden = true; return; }
      if (campInfoCard) campInfoCard.hidden = false;
      var fields = finalStep ? {
        campFinalName: camp.title || '—',
        campFinalCost: Number(camp.cost || 0) > 0 ? money(camp.cost) : 'بدون هزینه',
        campFinalCard: camp.cardNumber || 'ثبت نشده',
        campFinalDeadline: camp.registrationDeadline ? (JalaliDate.format(camp.registrationDeadline) || camp.registrationDeadline) : 'اعلام نشده'
      } : {
        campInitialName: camp.title || '—',
        campInitialCost: Number(camp.cost || 0) > 0 ? money(camp.cost) : 'بدون هزینه',
        campInitialCard: camp.cardNumber || 'ثبت نشده',
        campInitialDeadline: camp.registrationDeadline ? (JalaliDate.format(camp.registrationDeadline) || camp.registrationDeadline) : 'اعلام نشده'
      };
      Object.keys(fields).forEach(function(id) { var el = DOM.qs('#' + id); if (el) el.textContent = fields[id]; });
      var capacity = Number(camp.capacity || 0);
      var count = Number(camp.registrationCount || 0);
      var capacityBlock = DOM.qs('#campCapacityBlock');
      var capacityText = DOM.qs('#campCapacityText');
      var capacityTrack = DOM.qs('#campCapacityTrack');
      var capacityBar = DOM.qs('#campCapacityBar');
      if (capacityBlock) capacityBlock.hidden = false;
      if (capacityText) capacityText.textContent = capacity > 0
        ? (count.toLocaleString('fa-IR') + ' از ' + capacity.toLocaleString('fa-IR') + ' نفر ثبت‌نام کرده‌اند')
        : (count.toLocaleString('fa-IR') + ' نفر ثبت‌نام کرده‌اند · ظرفیت تعیین نشده');
      if (capacityTrack) capacityTrack.hidden = capacity <= 0;
      if (capacityBar) {
        var percent = capacity > 0 ? Math.max(0, Math.min(100, Math.round(count * 100 / capacity))) : 0;
        capacityBar.style.width = percent + '%';
        capacityBar.setAttribute('aria-valuenow', String(percent));
        capacityBar.classList.toggle('is-full', capacity > 0 && count >= capacity);
      }
    }

    function handleFile(file) {
      var allowedTypes = ['image/jpeg','image/png','image/webp'];
      if (!file || allowedTypes.indexOf(String(file.type || '').toLowerCase()) < 0) {
        selectedFile = null;
        if (fileInput) fileInput.value = '';
        if (preview) { preview.innerHTML = ''; preview.classList.remove('active'); }
        Toast.error('فرمت عکس باید JPG، PNG یا WebP باشد');
        return;
      }
      if (!Validate.fileSize(file, CONFIG.MAX_FILE_SIZE)) {
        selectedFile = null;
        if (fileInput) fileInput.value = '';
        if (preview) { preview.innerHTML = ''; preview.classList.remove('active'); }
        Toast.error('حجم فایل بیشتر از ۵ مگابایت');
        return;
      }
      selectedFile = file;
      var reader = new FileReader();
      reader.onload = function (e) {
        if (preview) {
          preview.innerHTML = '<img src="' + e.target.result + '" alt="پیش‌نمایش">';
          preview.classList.add('active');
        }
      };
      reader.readAsDataURL(file);
    }

    if (zone && fileInput) {
      DOM.on(zone, 'click', function () { fileInput.click(); });
      DOM.on(zone, 'dragover', function (e) { e.preventDefault(); zone.classList.add('dragover'); });
      DOM.on(zone, 'dragleave', function (e) { e.preventDefault(); zone.classList.remove('dragover'); });
      DOM.on(zone, 'drop', function (e) {
        e.preventDefault();
        zone.classList.remove('dragover');
        if (e.dataTransfer.files[0]) handleFile(e.dataTransfer.files[0]);
      });
      DOM.on(fileInput, 'change', function () {
        if (fileInput.files[0]) handleFile(fileInput.files[0]);
      });
    }

    // بارگذاری اردوهای فعال
    if (campSelect) {
      Api.get({ action: 'listCamps', status: 'active' })
        .then(function (res) {
          camps = res.items || [];
          var html = '<option value="">انتخاب کن...</option>';
          for (var i = 0; i < camps.length; i++) {
            var costLabel = Number(camps[i].cost || 0) > 0 ? ' · ' + money(camps[i].cost) : ' · بدون هزینه';
            var capacity = Number(camps[i].capacity || 0), count = Number(camps[i].registrationCount || 0);
            var capacityLabel = capacity > 0 ? ' · ثبت‌نام ' + count.toLocaleString('fa-IR') + '/' + capacity.toLocaleString('fa-IR') : '';
            var fullLabel = capacity > 0 && count >= capacity ? ' · ظرفیت تکمیل' : '';
            html += '<option value="' + DOM.escape(camps[i].id) + '">' + DOM.escape(camps[i].title) + DOM.escape(costLabel + capacityLabel + fullLabel) + '</option>';
          }
          campSelect.innerHTML = html;
          updateCampInfo();
          DOM.on(campSelect, 'change', function() { updateCampInfo(); });
          if (!camps.length) {
            campSelect.innerHTML = '<option value="">هیچ اردوی فعالی نیست</option>';
            if (campInfoCard) campInfoCard.hidden = true;
          }
        })
        .catch(function (err) {
          Logger.error('خطا در اردوها:', err);
          campSelect.innerHTML = '<option value="">خطا در بارگذاری</option>';
        });
    }

    DOM.on(form, 'submit', async function (e) {
      e.preventDefault();

      var data = {
        campId:       campSelect ? campSelect.value : '',
        firstName:    (DOM.qs('#firstName')    || {}).value || '',
        lastName:     (DOM.qs('#lastName')     || {}).value || '',
        nationalCode: (DOM.qs('#nationalCode') || {}).value || '',
        phone:        (DOM.qs('#phone')        || {}).value || '',
        fatherName:   (DOM.qs('#fatherName')   || {}).value || '',
        fatherPhone:  (DOM.qs('#fatherPhone')  || {}).value || ''
      };

      var keys = Object.keys(data);
      for (var i = 0; i < keys.length; i++) data[keys[i]] = String(data[keys[i]]).trim();

      if (!selectedFile) { Toast.error('عکس رضایت‌نامه پدر را انتخاب کن'); if (zone) zone.focus(); return; }
      if (!data.campId)         { Toast.error('اردو رو انتخاب کن'); return; }
      if (!data.firstName)      { Toast.error('نام رو وارد کن'); return; }
      if (!data.lastName)       { Toast.error('نام خانوادگی رو وارد کن'); return; }
      if (!data.fatherName)     { Toast.error('نام پدر رو وارد کن'); return; }
      if (!Validate.iranMobile(data.phone))       { Toast.error('شماره همراه خودت نامعتبر'); return; }
      if (!Validate.iranMobile(data.fatherPhone)) { Toast.error('شماره پدر نامعتبر'); return; }

      var campBeforeSubmit = selectedCamp();
      if (campBeforeSubmit && Number(campBeforeSubmit.capacity || 0) > 0 && Number(campBeforeSubmit.registrationCount || 0) >= Number(campBeforeSubmit.capacity || 0)) {
        Toast.error('ظرفیت این اردو تکمیل شده است؛ اردو دیگری انتخاب کن'); return;
      }

      var btn = form.querySelector('button[type="submit"]');
      btn.disabled = true;
      btn.textContent = 'در حال ارسال...';

      try {
        var backendVersion = await Api.get({ action: 'ping' });
        if (!backendVersion || backendVersion.version !== CONFIG.BACKEND_VERSION) {
          throw new Error('برای ثبت امن ظرفیت اردو، مربی باید ابتدا نسخهٔ جدید فایل Apps Script را منتشر کند. فعلاً ثبت‌نام ارسال نشد.');
        }
        var photoBase64 = '';
        if (selectedFile) photoBase64 = await RegisterForm._fileToBase64(selectedFile);

        var registrationResult = await Api.post({
          action: 'registerCamp',
          campId: data.campId,
          firstName: data.firstName,
          lastName: data.lastName,
          nationalCode: data.nationalCode,
          phone: data.phone,
          fatherName: data.fatherName,
          fatherPhone: data.fatherPhone,
          photoBase64: photoBase64,
          photoMimeType: selectedFile ? selectedFile.type : '',
          extraData: {}
        });

        var campForPayment = selectedCamp();
        if (campForPayment) {
          campForPayment.registrationCount = Number(campForPayment.registrationCount || 0) + 1;
          campForPayment.isFull = Number(campForPayment.capacity || 0) > 0 && campForPayment.registrationCount >= Number(campForPayment.capacity || 0);
          updateCampInfo(campForPayment);
        }
        pendingRegistrationId = String(registrationResult && registrationResult.id || '');
        if (campForPayment && Number(campForPayment.cost || 0) > 0) {
          if (!pendingRegistrationId) throw new Error('ثبت‌نام ذخیره شد، اما شناسه برای ارسال رسید دریافت نشد. لطفاً با مربی هماهنگ کن.');
          if (paymentStep) { paymentStep.hidden = false; paymentStep.classList.remove('hidden'); }
          updateCampInfo(campForPayment, true);
          if (paymentStatus) paymentStatus.textContent = 'اطلاعات ثبت‌نام دریافت شد؛ پس از واریز، تصویر رسید را بفرست.';
          form.classList.add('hidden');
          if (paymentStep) paymentStep.scrollIntoView({behavior:'smooth', block:'start'});
          Toast.success('مرحله اول ثبت‌نام انجام شد؛ حالا رسید پرداخت را بفرست.');
        } else {
          form.reset();
          if (preview) { preview.innerHTML = ''; preview.classList.remove('active'); }
          selectedFile = null;
          updateCampInfo();
          Toast.success('ثبت‌نام ارسال شد و در انتظار تأیید مربی است ✓');
        }

      } catch (err) {
        Logger.error('ثبت‌نام:', err);
        Toast.error(err.message || 'خطا در ارسال');
      } finally {
        btn.disabled = false;
        btn.textContent = 'ثبت‌نام';
      }
    });

    if (receiptInput) DOM.on(receiptInput, 'change', function() {
      receiptFile = receiptInput.files && receiptInput.files[0] || null;
      if (!receiptFile) { if (receiptPreview) { receiptPreview.innerHTML = ''; receiptPreview.hidden = true; } return; }
      if (['image/jpeg','image/png','image/webp'].indexOf(String(receiptFile.type || '').toLowerCase()) < 0 || receiptFile.size > CONFIG.MAX_FILE_SIZE) {
        receiptFile = null; receiptInput.value = '';
        if (receiptPreview) { receiptPreview.innerHTML = ''; receiptPreview.hidden = true; }
        Toast.error('رسید باید تصویر JPG، PNG یا WebP و حداکثر ۵ مگابایت باشد'); return;
      }
      var reader = new FileReader();
      reader.onload = function(e) {
        if (!receiptPreview) return;
        receiptPreview.innerHTML = '<img src="' + e.target.result + '" alt="پیش‌نمایش رسید کارت‌به‌کارت"><span>رسید انتخاب‌شده</span>';
        receiptPreview.hidden = false;
      };
      reader.readAsDataURL(receiptFile);
    });

    if (receiptBtn) DOM.on(receiptBtn, 'click', async function() {
      if (!pendingRegistrationId) { Toast.error('شناسه ثبت‌نام پیدا نشد؛ ثبت‌نام را دوباره انجام بده'); return; }
      if (!receiptFile) { Toast.error('اول تصویر رسید کارت‌به‌کارت را انتخاب کن'); return; }
      receiptBtn.disabled = true; receiptBtn.textContent = 'در حال ارسال امن رسید...';
      try {
        var base64 = await RegisterForm._fileToBase64(receiptFile);
        await Api.post({action:'uploadCampReceipt', registrationId:pendingRegistrationId, receiptBase64:base64, receiptMimeType:receiptFile.type});
        if (paymentStatus) paymentStatus.textContent = 'رسید ثبت شد؛ اکنون منتظر تأیید مربی باشید.';
        receiptInput.disabled = true;
        receiptBtn.textContent = 'رسید با موفقیت ارسال شد ✓';
        if (receiptPreview) receiptPreview.classList.add('is-submitted');
        Toast.success('رسید ارسال شد؛ منتظر تأیید مربی باشید ✓');
      } catch (err) {
        Logger.error('ارسال رسید اردو:', err);
        Toast.error(err.message || 'ارسال رسید ناموفق بود');
        receiptBtn.disabled = false; receiptBtn.textContent = 'ثبت و ارسال رسید';
      }
    });
  }

  RegisterForm._fileToBase64 = function (file) {
    return new Promise(function (resolve, reject) {
      var reader = new FileReader();
      reader.onload = function () {
        var result = String(reader.result || '');
        var comma = result.indexOf(',');
        resolve(comma >= 0 ? result.slice(comma + 1) : result);
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  /* ══════════════════════════════════════════════════════════════════════
     Feedback Form — پیشنهاد و انتقاد
     ══════════════════════════════════════════════════════════════════════ */

  function FeedbackForm(form) {
    if (!form) return;

    DOM.on(form, 'submit', async function (e) {
      e.preventDefault();

      var data = {
        name:     (DOM.qs('#fbName')     || {}).value || '',
        phone:    (DOM.qs('#fbPhone')    || {}).value || '',
        category: (DOM.qs('#fbCategory') || {}).value || 'پیشنهاد',
        message:  (DOM.qs('#fbMessage')  || {}).value || ''
      };

      var keys = Object.keys(data);
      for (var i = 0; i < keys.length; i++) data[keys[i]] = String(data[keys[i]]).trim();

      if (!data.message) { Toast.error('متن پیام خالی است'); return; }
      if (data.phone && !Validate.iranMobile(data.phone)) {
        Toast.error('شماره تماس نامعتبر');
        return;
      }

      var btn = form.querySelector('button[type="submit"]');
      btn.disabled = true;
      btn.textContent = 'در حال ارسال...';

      try {
        await Api.post({ action: 'feedback', name: data.name, phone: data.phone, category: data.category, message: data.message });
        form.reset();
        Toast.success('پیام ثبت شد. ممنون 🌿');
      } catch (err) {
        Logger.error('Feedback:', err);
        Toast.error(err.message || 'خطا در ارسال');
      } finally {
        btn.disabled = false;
        btn.textContent = 'ارسال پیام';
      }
    });
  }

  /* ══════════════════════════════════════════════════════════════════════
     Header Auth — دکمه ورود/پروفایل در هدر
     ══════════════════════════════════════════════════════════════════════ */

  function HeaderAuth() {
    var header = DOM.qs('.app-header');
    if (!header) return;

    var existingBtn = DOM.qs('.header-auth', header);
    var member = Session.getMember();
    var official = Session.getOfficial();
    var user = member || official;

    var btn = existingBtn || document.createElement('a');
    btn.className = 'header-auth';

    if (user) {
      var firstName = user.firstName || user.name || 'کاربر';
      var initial = String(firstName).charAt(0);
      btn.href = 'profile.html';
      btn.setAttribute('aria-label', 'پروفایل من');
      if (member && member.profileImage) {
        btn.innerHTML = '<span class="header-auth__avatar has-image"><img src="' + DOM.escape(member.profileImage) + '" alt="" style="display:block;width:100%;height:100%;object-fit:cover;border-radius:inherit"></span>';
      } else {
        btn.innerHTML = '<span class="header-auth__avatar">' + DOM.escape(initial) + '</span>';
      }
    } else {
      btn.href = 'login.html';
      btn.setAttribute('aria-label', 'ورود / ثبت‌نام');
      btn.innerHTML = '<span class="header-auth__text">ورود / ثبت‌نام</span>';
    }

    if (!existingBtn) header.appendChild(btn);
  }

  /* ══════════════════════════════════════════════════════════════════════
     App — راه‌انداز
     ══════════════════════════════════════════════════════════════════════ */

  var App = {
    version: CONFIG.VERSION,
    init: function () {
      Logger.info('نسخه ' + this.version + ' در حال راه‌اندازی...');
      Logger.info('API_URL:', CONFIG.API_URL);

      App._safe('Navigation',   function () { Navigation(); });
      App._safe('HeaderAuth',   function () { HeaderAuth(); });
      App._safe('Carousel',     function () { Carousel(DOM.qs('#carouselContainer')); });
      App._safe('Officials',    function () { OfficialsPage(); });
      App._safe('OfficialLogin',function () { OfficialLogin(); });
      App._safe('Activities',   function () { ActivitiesPage(); });
      App._safe('Schedule',     function () { SchedulePage(); });
      App._safe('RegisterForm', function () { RegisterForm(DOM.qs('#registerForm')); });
      App._safe('FeedbackForm', function () { FeedbackForm(DOM.qs('#feedbackForm')); });

      JalaliDate.setup();
      Logger.info('راه‌اندازی کامل ✓');
    },
    _safe: function (name, fn) {
      try { fn(); } catch (err) { Logger.error('[' + name + ']', err); }
    }
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () { App.init(); });
  } else {
    App.init();
  }

  // در معرض عموم
  window.KanoonApp = {
    version: CONFIG.VERSION,
    config: CONFIG,
    api: Api,
    toast: Toast,
    modal: Modal,
    session: Session,
    validate: Validate,
    date: JalaliDate,
    refreshHeaderAuth: function () { App._safe('HeaderAuthRefresh', HeaderAuth); }
  };

})(window, document);



/* ============================================================================
   Home Events — رویدادهای زنده از Google Sheets / Drive
   ============================================================================ */
(function(){
  'use strict';
  function esc(s){return window.KanoonApp&&window.KanoonApp.api?String(s||'').replace(/[&<>"]/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]}):String(s||'');}
  function init(){
    var root=document.getElementById('homeEvents'); if(!root||!window.KanoonApp)return;
    window.KanoonApp.api.get({action:'listEvents'}).then(function(r){
      var items=r.items||[];
      if(!items.length){root.innerHTML='<div class="event-empty"><strong>فعلاً رویداد جدیدی ثبت نشده</strong></div>';return}
      root.innerHTML=items.slice(0,6).map(function(e,i){
        var label=String(e.label||'').trim();
        var labelMarkup=label && label!=='رویداد' ? '<span>'+esc(label)+'</span>' : '';
        return '<a class="home-event-slide '+(i===0?'active':'')+'" href="activities.html" aria-hidden="'+(i!==0)+'"><img src="'+esc(e.imageUrl||'images/placeholder.svg')+'" alt="'+esc(e.title)+'" loading="'+(i===0?'eager':'lazy')+'"><div class="home-event-overlay">'+labelMarkup+'<h3>'+esc(e.title)+'</h3><p>'+esc(e.description||e.date||'')+'</p><b>مشاهده جزئیات ←</b></div></a>';
      }).join('');
      if(items.length>1){
        var n=0,slides=root.querySelectorAll('.home-event-slide');
        setInterval(function(){slides[n].classList.remove('active');n=(n+1)%slides.length;slides[n].classList.add('active');for(var i=0;i<slides.length;i++)slides[i].setAttribute('aria-hidden',String(i!==n))},5000);
      }
    }).catch(function(){root.innerHTML='<div class="event-empty"><strong>رویدادها فعلاً در دسترس نیستند</strong></div>'});
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();
/* ============================================================================
   PRO UI — Tactile interaction layer
   ============================================================================ */
(function () {
  'use strict';

  function addRipple(target, event) {
    if (!target || target.classList.contains('nav-item') && target.tagName === 'BUTTON') {
      /* button nav still gets normal active physics; avoid visual noise there */
    }
    var rect = target.getBoundingClientRect();
    var size = Math.max(rect.width, rect.height) * 1.35;
    var x = (event.clientX || (rect.left + rect.width / 2)) - rect.left - size / 2;
    var y = (event.clientY || (rect.top + rect.height / 2)) - rect.top - size / 2;
    var ripple = document.createElement('span');
    ripple.className = 'ripple';
    ripple.style.width = size + 'px';
    ripple.style.height = size + 'px';
    ripple.style.left = x + 'px';
    ripple.style.top = y + 'px';
    target.appendChild(ripple);
    window.setTimeout(function () {
      if (ripple.parentNode) ripple.parentNode.removeChild(ripple);
    }, 560);
  }

  function init() {
    var reduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduced) return;

    var selectors = [
      '.menu-card', '.btn-submit', '.btn-secondary', '.social-btn',
      '.contact-item', '.chip', '.upload-zone', '.header-auth',
      '.header-back', '.header-logout', '.close-btn'
    ];
    var items = document.querySelectorAll(selectors.join(','));
    for (var i = 0; i < items.length; i++) {
      var item = items[i];
      if (window.getComputedStyle(item).position === 'static') item.style.position = 'relative';
      item.style.overflow = 'hidden';
      item.addEventListener('pointerdown', function (e) {
        if (e.pointerType === 'mouse' && e.button !== 0) return;
        addRipple(this, e);
      }, { passive: true });
    }

    /* وقتی صفحه اسکرول می‌شود، هدر اندکی جمع می‌شود؛ فقط سایه تغییر می‌کند */
    var header = document.querySelector('.app-header');
    if (header) {
      var ticking = false;
      window.addEventListener('scroll', function () {
        if (ticking) return;
        ticking = true;
        window.requestAnimationFrame(function () {
          header.classList.toggle('is-scrolled', window.scrollY > 8);
          ticking = false;
        });
      }, { passive: true });
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();


/* ============================================================================
   PRO V2 — Home product interactions
   ============================================================================ */
(function () {
  'use strict';

  function setupDrawer() {
    var drawer = document.querySelector('.app-drawer');
    var backdrop = document.querySelector('.drawer-backdrop');
    if (!drawer || !backdrop) return;

    function open() {
      drawer.classList.add('open');
      backdrop.classList.add('open');
      document.body.style.overflow = 'hidden';
      drawer.setAttribute('aria-hidden', 'false');
    }
    function close() {
      drawer.classList.remove('open');
      backdrop.classList.remove('open');
      document.body.style.overflow = '';
      drawer.setAttribute('aria-hidden', 'true');
    }

    document.querySelectorAll('[data-open-drawer]').forEach(function (el) {
      el.addEventListener('click', open);
    });
    document.querySelectorAll('[data-close-drawer]').forEach(function (el) {
      el.addEventListener('click', close);
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') close();
    });
    drawer.querySelectorAll('a').forEach(function (a) {
      a.addEventListener('click', close);
    });
  }

  function setupRipples() {
    if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    var selectors = [
      '.hero-primary','.hero-secondary','.quick-item',
      '.feature-card','.service-card','.nav-item',
      '.header-menu','.header-auth','.drawer-links a'
    ];

    document.querySelectorAll(selectors.join(',')).forEach(function (el) {
      if (el.dataset.rippleV2) return;
      el.dataset.rippleV2 = '1';
      if (getComputedStyle(el).position === 'static') el.style.position = 'relative';
      el.style.overflow = 'hidden';

      el.addEventListener('pointerdown', function (e) {
        if (e.pointerType === 'mouse' && e.button !== 0) return;
        var rect = el.getBoundingClientRect();
        var size = Math.max(rect.width, rect.height) * 1.35;
        var x = (e.clientX || rect.left + rect.width / 2) - rect.left - size / 2;
        var y = (e.clientY || rect.top + rect.height / 2) - rect.top - size / 2;
        var ripple = document.createElement('span');
        ripple.className = 'ripple-v2';
        ripple.style.width = size + 'px';
        ripple.style.height = size + 'px';
        ripple.style.left = x + 'px';
        ripple.style.top = y + 'px';
        el.appendChild(ripple);
        setTimeout(function () {
          if (ripple.parentNode) ripple.parentNode.removeChild(ripple);
        }, 600);
      }, { passive: true });
    });
  }

  function setupScrollReveal() {
    if (!('IntersectionObserver' in window)) return;
    var items = document.querySelectorAll('.home-section,.quote-panel,.home-footer');
    var observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        entry.target.classList.add('is-visible');
        observer.unobserve(entry.target);
      });
    }, { threshold: .08 });

    items.forEach(function (item) {
      item.classList.add('reveal-v2');
      observer.observe(item);
    });
  }

  function initProV2() {
    setupDrawer();
    setupRipples();
    setupScrollReveal();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initProV2);
  } else {
    initProV2();
  }
})();
  /* V5 navigation — ورود یا پروفایل */
function buildBottomNav() {
  var nav=document.querySelector('.bottom-nav'); if(!nav)return;
  var path=(location.pathname.split('/').pop()||'index.html').toLowerCase();
  var session=window.KanoonApp&&window.KanoonApp.session;
  var member=session?session.getMember():null;
  var official=session?session.getOfficial():null;
  var staffPage=['officials.html','attendance.html','supervision.html'].indexOf(path)>=0 || !!official;
  var items=[
    ['index.html','⌂','خانه'],
    ['activities.html','✦','فعالیت‌ها'],
    ['schedule.html','◷','برنامه'],
    ['game.html','◉','بازی'],
    staffPage?['officials.html','♙','مسئولین']:[member?'profile.html':'login.html',member?'♙':'↗',member?'پروفایل':'ورود']
  ];
  nav.innerHTML=items.map(function(x){var active=path===x[0]?' active':'';return '<a class="nav-item'+active+'" href="'+x[0]+'"><span class="nav-icon">'+x[1]+'</span><span>'+x[2]+'</span></a>'}).join('');
}
function bindGlobalNavigation(){
  buildBottomNav();
  Array.prototype.slice.call(document.querySelectorAll('[data-open-login]')).forEach(function(b){b.addEventListener('click',function(){location.href=((window.KanoonApp&&window.KanoonApp.session&&window.KanoonApp.session.getMember())?'profile.html':'login.html')})});
  var drawer=document.querySelector('.app-drawer'),back=document.querySelector('.drawer-backdrop');
  Array.prototype.slice.call(document.querySelectorAll('[data-open-drawer]')).forEach(function(b){b.addEventListener('click',function(){if(drawer){drawer.classList.add('open');if(back)back.classList.add('open');document.body.classList.add('drawer-open')}})});
  Array.prototype.slice.call(document.querySelectorAll('[data-close-drawer]')).forEach(function(b){b.addEventListener('click',function(){if(drawer){drawer.classList.remove('open');if(back)back.classList.remove('open');document.body.classList.remove('drawer-open')}})});
}
(function(){
  function bootV4Navigation(){
    if(typeof bindGlobalNavigation==='function') bindGlobalNavigation();
  }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',bootV4Navigation); else bootV4Navigation();
})();
