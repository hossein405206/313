# سایت حلقه شهید هادی ذوالفقاری

سایت موبایل‌محور مسجد امام رضا (ع) / حلقه شهید هادی ذوالفقاری با GitHub Pages و Google Apps Script.

## اتصال فعلی بک‌اند

تمام صفحات وب از لایه‌ی API مرکزی در `js/main.js` استفاده می‌کنند و endpoint فعلی این است:

`https://script.google.com/macros/s/AKfycbzI6-Csz0Fk8qixHiWTYOHrCGJq8W-7X2lWID6n5qkQOSLYGXC6-Jwixs7Bf38PunC0/exec`

فقط `js/main.js` باید URL بک‌اند را نگه دارد؛ فایل‌های دیگر از `KanoonApp.api` استفاده می‌کنند و endpoint جداگانه ندارند.

## ساختار اصلی

- `index.html` — خانه و رویدادها
- `activities.html` — فعالیت‌ها
- `circle-register.html` — درخواست عضویت در حلقه
- `snake.html` — بازی مار (دسترسی فقط برای اعضای تأییدشده حلقه)
- `schedule.html` — برنامه هفتگی
- `coach.html` — پنل مربیان
- `officials.html` — ورود مسئولین
- `attendance.html` — حضور و غیاب
- `supervision.html` — نظارت
- `login.html` / `register.html` / `profile.html` — ورود و پروفایل اعضا
- `js/main.js` — API مرکزی و منطق مشترک
- `js/coach.js` — منطق پنل مربیان
- `apps-script/Code.gs` — بک‌اند Google Apps Script

## عضویت در حلقه و بازی‌ها

- درخواست‌های عضویت در شیت `درخواست عضویت` ذخیره می‌شوند.
- مالک اصلی از پنل مربیان درخواست را تأیید یا رد می‌کند.
- بازی پرنده و بازی مار به عضویت تأییدشده نیاز دارند؛ تکمیل پروفایل شرط بازی نیست.
- برای ساخت شیت جدید، پس از قرار دادن نسخه جدید `Code.gs`، تابع `setup()` را یک بار اجرا کن.

## به‌روزرسانی بک‌اند

در Google Apps Script لازم نیست برای هر تغییر URL جدید بسازی. همان Web App deployment را ویرایش کن و آن را به نسخه جدید کد وصل کن؛ URL فعلی را ثابت نگه دار.

## GitHub Pages

این پروژه بدون build روی GitHub Pages اجرا می‌شود.
