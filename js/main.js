/* ==========================================================
حلقه شهید هادی ذوالفقاری — main.js
========================================================== */
(function () {
'use strict';

/* ============ ⚙️ تنظیمات مهم ============ */
// 🔴 این خط رو با URL خودت جایگزین کن (از Manage deployments):
const API_URL = 'https://script.google.com/macros/s/AKfycbykIp_S-p5grZvgwLGCwaaajnG7lEbRfiTTu6epq5ATQXPLPtYTZDfUKECameopRDOf/exec';

/* ============ داده‌های موقت (بعداً از شیت خونده می‌شن) ============ */
const MENTOR_NUMBERS = ['09120000000', '09131111111'];

const SAMPLE_EVENTS = [
{ id: 1, title: 'مسابقه فوتبال دستی', date: '۱۴۰۳/۱۲/۱۵', category: 'ورزشی',
image: 'https://images.unsplash.com/photo-1551958219-acbc608c6377?w=600&auto=format&fit=crop' },
{ id: 2, title: 'اردوی زیارتی مشهد مقدس', date: '۱۴۰۳/۱۲/۲۰', category: 'اردو',
image: 'https://images.unsplash.com/photo-1542810634-71277d95dcbb?w=600&auto=format&fit=crop' },
{ id: 3, title: 'کلاس حفظ قرآن کریم', date: 'هر پنج‌شنبه', category: 'تربیتی',
image: 'https://images.unsplash.com/photo-1609599006353-e629aaabfeae?w=600&auto=format&fit=crop' },
{ id: 4, title: 'شب شعر و ادبیات', date: '۱۴۰۳/۱۲/۲۵', category: 'فرهنگی',
image: 'https://images.unsplash.com/photo-1524995997946-a1c2e315a42f?w=600&auto=format&fit=crop' },
{ id: 5, title: 'مسابقات FIFA و PS5', date: 'پنج‌شنبه‌ها', category: 'ورزشی',
image: 'https://images.unsplash.com/photo-1511512578047-dfb367046420?w=600&auto=format&fit=crop' }
 ];

const OFFICIALS = [
{ name: 'مهدی رضایی', role: 'مسئول PS5' },
{ name: 'حسین احمدی', role: 'مسئول سیستم صوتی' },
{ name: 'علی محمدی', role: 'مسئول خرید' },
{ name: 'رضا کریمی', role: 'مسئول مسجد' },
{ name: 'امیر حسینی', role: 'مسئول کانون' },
{ name: 'سعید نوری', role: 'مسئول هیئت' },
{ name: 'محمد صادقی', role: 'مسئول مکبری' },
{ name: 'یاسر تقوی', role: 'مسئول آشپزخانه' },
{ name: 'ابوالفضل رحیمی', role: 'مسئول تدارکات' },
{ name: 'میلاد عباسی', role: 'مسئول هماهنگی' },
{ name: 'کاظم شریفی', role: 'مسئول رسانه' },
{ name: 'پویا مرادی', role: 'مسئول اتاق رسانه' },
{ name: 'حامد سلیمی', role: 'مسئول ورزش' },
{ name: 'دانیال اکبری', role: 'مسئول VR' },
{ name: 'سینا جوادی', role: 'مسئول عکاسی' },
{ name: 'رضا مهدوی', role: 'مسئول حضور و غیاب' }
 ];

const WEEKLY_SCHEDULE = [
{ day: 'شنبه', slots: [
{ time: '18:00', title: 'کلاس قرآن', note: 'حاج آقا موسوی' },
{ time: '19:30', title: 'هیئت هفتگی', note: 'سالن اصلی' } ]},
{ day: 'یک‌شنبه', slots: [ { time: '17:30', title: 'تمرین فوتبال', note: 'سالن ورزشی' } ]},
{ day: 'دوشنبه', slots: [ { time: '18:00', title: 'دوره تربیتی', note: 'کتاب «مرام»' } ]},
{ day: 'سه‌شنبه', slots: [ { time: '19:00', title: 'جلسه مسئولین', note: 'اتاق مدیریت' } ]},
{ day: 'چهارشنبه', slots: [ { time: '18:30', title: 'کلاس احکام', note: 'حجت‌الاسلام کریمی' } ]},
{ day: 'پنج‌شنبه', slots: [
{ time: '20:00', title: 'مسابقات PS5', note: 'همراه با جایزه' },
{ time: '21:30', title: 'دعای کمیل', note: '' } ]},
{ day: 'جمعه', slots: [ { time: '06:00', title: 'دعای ندبه', note: 'سالن اصلی' } ]}
];

/* ============ helpers ============ */
const  = (sel, root = document) => Array.from(root.querySelectorAll(sel));

/* ============ toast ============ */
let toastTimer;
function showToast(msg, type = 'success') {
let el = $`('#appToast');
if (!el) {
el = document.createElement('div');
el.id = 'appToast';
el.className = 'toast';
document.body.appendChild(el);
}
el.textContent = msg;
el.classList.toggle('error', type === 'error');
el.classList.add('show');
clearTimeout(toastTimer);
toastTimer = setTimeout(() => el.classList.remove('show'), 3200);
}

/* ============ هایلایت نوار پایین ============ */
function highlightNav() {
const path = location.pathname.split('/').pop() || 'index.html';
`$('.bottom-nav .nav-item').forEach(item => {
const href = item.getAttribute('href') || '';
const on = href === path;
item.classList.toggle('active', on);
if (on) item.setAttribute('aria-current', 'page');
else item.removeAttribute('aria-current');
});
}

/* ============ کاروسل ============ */
function initCarousel() {
const slides = ('.dot');
const container = $`('#carouselContainer');
if (!container || slides.length < 2) return;

const prefersReduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
let current = 0, timer = null;

const setSlide = i => {
if (i < 0 || i >= slides.length) return;
slides.forEach((s, k) => {
const on = k === i;
s.classList.toggle('active', on);
s.setAttribute('aria-hidden', String(!on));
});
dots.forEach((d, k) => {
const on = k === i;
d.classList.toggle('active', on);
d.setAttribute('aria-selected', String(on));
});
current = i;
};
const next = () => setSlide((current + 1) % slides.length);
const start = () => { if (prefersReduced) return; stop(); timer = setInterval(next, 4500); };
const stop = () => { if (timer) { clearInterval(timer); timer = null; } };

dots.forEach(d => d.addEventListener('click', () => {
setSlide(Number(d.dataset.index)); start();
}));

container.addEventListener('mouseenter', stop);
container.addEventListener('mouseleave', start);
document.addEventListener('visibilitychange', () =>
document.hidden ? stop() : start());

let tx = 0;
container.addEventListener('touchstart', e => {
tx = e.changedTouches[0].clientX; stop();
}, { passive: true });
container.addEventListener('touchend', e => {
const dx = e.changedTouches[0].clientX - tx;
if (Math.abs(dx) > 40)
setSlide((current + (dx < 0 ? 1 : -1) + slides.length) % slides.length);
start();
}, { passive: true });

setSlide(0);
start();
}

/* ============ مدال ورود مربیان ============ */
function injectMentorModal() {
if ($('#loginModal')) return; const el = document.createElement('div'); el.className = 'modal'; el.id = 'loginModal'; el.setAttribute('role', 'dialog'); el.setAttribute('aria-modal', 'true'); el.innerHTML =
<div class="modal-content">
<div class="modal-header">
<h3 id="loginTitle">ورود مربیان</h3>
<button type="button" class="close-btn" data-close aria-label="بستن">×</button>
</div>
<form id="mentorLoginForm" novalidate>
<div class="form-group">
<label for="phoneInput">شماره همراه مربی:</label>
<input type="tel" id="phoneInput" class="form-control"
placeholder="09123456789" dir="ltr" inputmode="numeric"
autocomplete="tel" maxlength="11" required>
</div>
<button type="submit" class="btn-submit">ورود</button>
</form>
</div>`;
document.body.appendChild(el);
}

function initMentorLogin() {
injectMentorModal();
const modal = latex
('#loginModal'); const form = 

('#mentorLoginForm');
const phoneInput = $`('#phoneInput');
let lastFocus = null;

const open = () => {
lastFocus = document.activeElement;
modal.classList.add('active');
document.body.style.overflow = 'hidden';
requestAnimationFrame(() => phoneInput && phoneInput.focus());
};
const close = () => {
modal.classList.remove('active');
document.body.style.overflow = '';
if (lastFocus && typeof lastFocus.focus === 'function') lastFocus.focus();
};

document.addEventListener('click', e => {
const trigger = e.target.closest('[data-open-login], .nav-item[href="#"]');
if (trigger) { e.preventDefault(); open(); return; }
if (e.target === modal || e.target.hasAttribute('data-close')) close();
});

document.addEventListener('keydown', e => {
if (e.key === 'Escape' && modal.classList.contains('active')) close();
});

form.addEventListener('submit', async e => {
e.preventDefault();
const phone = phoneInput.value.trim();
if (!/^09\d{9}`$/.test(phone)) {
showToast('شماره باید ۱۱ رقم و با ۰۹ شروع شود', 'error');
phoneInput.focus();
return;
}
const btn = form.querySelector('button[type="submit"]');
btn.disabled = true; btn.textContent = 'در حال بررسی...';

try {
const ok = await window.checkMentorLogin(phone);
if (!ok) {
showToast('این شماره در لیست مربیان نیست', 'error');
return;
}
close();
showToast('خوش آمدید 🌿');
// بعداً: location.href = 'mentor-panel.html';
} catch (err) {
console.error(err);
showToast('خطا در ارتباط با سرور', 'error');
} finally {
btn.disabled = false; btn.textContent = 'ورود';
}
});
}

/* ============ فعالیت‌ها ============ */
function initActivities() {
const list = latex
('#activityList'); if (!list) return; const chips = 

('.chip[data-filter]');
let filter = 'all';

const render = () => {
const filtered = filter === 'all'
? SAMPLE_EVENTS
: SAMPLE_EVENTS.filter(ev => ev.category === filter);

if (!filtered.length) {
list.innerHTML = <div class="empty"&gt;&lt;p&gt;فعالیتی در این دسته یافت نشد&lt;/p&gt;&lt;/div>;
return;
}
list.innerHTML = filtered.map(ev => &lt;article class="activity-card"&gt; &lt;div class="thumb"&gt; &lt;img src="${ev.image}" alt="${ev.title}" loading="lazy"&gt; &lt;span class="badge"&gt;${ev.category}</span>
</div>
<div class="body">
<h3>${ev.title}&lt;/h3&gt; &lt;div class="meta"&gt;&lt;span&gt;${ev.date}</span></div>
</div>
</article>
`).join('');
};

chips.forEach(chip => chip.addEventListener('click', () => {
chips.forEach(c => c.classList.remove('active'));
chip.classList.add('active');
filter = chip.dataset.filter;
render();
}));

render();
}

/* ============ مسئولین ============ */
function initOfficials() {
const grid = $('#officialsGrid'); if (!grid) return; grid.innerHTML = OFFICIALS.map(o =&gt;
<div class="official-card">
<div class="avatar">{o.name}</h4>
<span class="role">${o.role}&lt;/span&gt; &lt;/div&gt;).join('');
}

/* ============ برنامه هفتگی ============ */
function initSchedule() {
const wrap = `$('#weeklySchedule');
if (!wrap) return;

const jsDay = new Date().getDay();
const map = ['یک‌شنبه','دوشنبه','سه‌شنبه','چهارشنبه','پنج‌شنبه','جمعه','شنبه'];
const today = map[jsDay];

wrap.innerHTML = WEEKLY_SCHEDULE.map(day => {
const isToday = day.day === today;
const slotsHtml = day.slots.length
? day.slots.map(s => &lt;div class="slot"&gt; &lt;span class="time"&gt;${s.time}</span>
<div class="desc">
<strong>${s.title}&lt;/strong&gt; ${s.note ? <small&gt;${s.note}</small>: ''} &lt;/div&gt; &lt;/div>).join('')
: <div class="slot"&gt;&lt;div class="desc"&gt;&lt;small&gt;برنامه‌ای نیست&lt;/small&gt;&lt;/div&gt;&lt;/div>;

return &lt;div class="day-block ${isToday ? 'today' : ''}">
<div class="day-title">
${isToday ? '&lt;span class="today-tag"&gt;امروز&lt;/span&gt;' : ''} ${day.day}
</div>
${slotsHtml} &lt;/div>;
}).join('');
}

/* ============ فرم ثبت‌نام اردو ============ */
function initRegisterForm() {
const form = $`('#registerForm');
if (!form) return;

const zone = $('#uploadZone'); const input = $('#fileInput');
const preview = `$('#uploadPreview');
let selectedFile = null;

if (zone && input) {
zone.addEventListener('click', () => input.click());
['dragenter','dragover'].forEach(ev =>
zone.addEventListener(ev, e => { e.preventDefault(); zone.classList.add('dragover'); }));
['dragleave','drop'].forEach(ev =>
zone.addEventListener(ev, e => { e.preventDefault(); zone.classList.remove('dragover'); }));
zone.addEventListener('drop', e => {
const f = e.dataTransfer.files[0];
if (f) handleFile(f);
});
input.addEventListener('change', () => {
if (input.files[0]) handleFile(input.files[0]);
});
}

function handleFile(file) {
if (!file.type.startsWith('image/')) { showToast('فقط فایل تصویری مجاز است', 'error'); return; }
if (file.size > 5 * 1024 * 1024) { showToast('حجم فایل بیشتر از ۵ مگابایت است', 'error'); return; }
selectedFile = file;
const reader = new FileReader();
reader.onload = e => {
preview.innerHTML = <img src="${e.target.result}" alt="پیش‌نمایش">`;
preview.classList.add('active');
};
reader.readAsDataURL(file);
}

form.addEventListener('submit', async e => {
e.preventDefault();
const data = {
firstName: $('#firstName').value.trim(), lastName: $('#lastName').value.trim(),
phone: $('#phone').value.trim(), fatherName: $('#fatherName').value.trim(),
fatherPhone: `$('#fatherPhone').value.trim()
};

if (!data.firstName || !data.lastName || !data.fatherName) {
showToast('نام‌ها را کامل وارد کنید', 'error'); return;
}
if (!/^09\d{9}latex
/.test(data.phone)) { showToast('شماره همراه خود را درست وارد کنید', 'error'); return; } if (!/^09\d{9}

/.test(data.fatherPhone)) { showToast('شماره همراه پدر را درست وارد کنید', 'error'); return; }

const btn = form.querySelector('button[type="submit"]');
btn.disabled = true; btn.textContent = 'در حال ارسال...';

try {
await window.submitCampRegistration(data, selectedFile);
form.reset();
preview.innerHTML = ''; preview.classList.remove('active');
selectedFile = null;
showToast('ثبت‌نام ارسال شد و در انتظار تایید مربی است ✓');
} catch (err) {
console.error(err);
showToast(err.message || 'خطا در ارسال. دوباره تلاش کنید', 'error');
} finally {
btn.disabled = false; btn.textContent = 'ثبت‌نام';
}
});
}

/* ============ فرم پیشنهاد و انتقاد ============ */
function initFeedbackForm() {
const form = $`('#feedbackForm');
if (!form) return;

form.addEventListener('submit', async e => {
e.preventDefault();
const data = {
name: $('#fbName').value.trim(), phone: $('#fbPhone').value.trim(),
category: $('#fbCategory').value, message: $('#fbMessage').value.trim()
};
if (!data.message) { showToast('متن پیام خالی است', 'error'); return; }

const btn = form.querySelector('button[type="submit"]');
btn.disabled = true; btn.textContent = 'در حال ارسال...';

try {
await window.submitFeedback(data);
form.reset();
showToast('پیام شما ثبت شد. ممنون از همراهی‌تان 🌿');
} catch (err) {
console.error(err);
showToast(err.message || 'خطا در ارسال پیام', 'error');
} finally {
btn.disabled = false; btn.textContent = 'ارسال پیام';
}
});
}

/* ============ اتصال به Google Apps Script ============ */

window.checkMentorLogin = async (phone) => {
const url = ``${API_URL}?action=checkMentor&phone=${encodeURIComponent(phone)}`;
const res = await fetch(url);
const j = await res.json();
if (j && j.allowed) {
try { sessionStorage.setItem('mentor_phone', phone); } catch(e){}
try { sessionStorage.setItem('mentor_name', j.name || ''); } catch(e){}
return true;
}
return false;
};

window.submitCampRegistration = async (data, file) => {
const fd = new FormData();
fd.append('action', 'registerCamp');
fd.append('firstName', data.firstName || '');
fd.append('lastName', data.lastName || '');
fd.append('phone', data.phone || '');
fd.append('fatherName', data.fatherName || '');
fd.append('fatherPhone', data.fatherPhone || '');

if (file) {
const b64 = await fileToBase64Raw(file);
fd.append('fileData', b64);
fd.append('fileName', file.name);
fd.append('fileMime', file.type || 'image/jpeg');
}

const res = await fetch(API_URL, { method: 'POST', body: fd });
const j = await res.json();
if (!j || !j.ok) throw new Error((j && j.error) || 'خطا در ثبت‌نام');
return j;
};

window.submitFeedback = async (data) => {
const res = await fetch(API_URL, {
method: 'POST',
headers: { 'Content-Type': 'text/plain;charset=utf-8' },
body: JSON.stringify({ action: 'feedback', ...data })
});
const j = await res.json();
if (!j || !j.ok) throw new Error((j && j.error) || 'خطا در ارسال پیام');
return j;
};

function fileToBase64Raw(file) {
return new Promise((resolve, reject) => {
const reader = new FileReader();
reader.onload = () => {
const s = String(reader.result || '');
const i = s.indexOf(',');
resolve(i >= 0 ? s.slice(i + 1) : s);
};
reader.onerror = reject;
reader.readAsDataURL(file);
});
}

/* ============ boot ============ */
document.addEventListener('DOMContentLoaded', () => {
highlightNav();
initCarousel();
initMentorLogin();
initActivities();
initOfficials();
initSchedule();
initRegisterForm();
initFeedbackForm();
});

window.AppUtils = { showToast, MENTOR_NUMBERS, SAMPLE_EVENTS, OFFICIALS, WEEKLY_SCHEDULE, API_URL };
})();
