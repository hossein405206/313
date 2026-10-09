# سایت حلقه شهید هادی ذوالفقاری

سایت موبایل‌محور مسجد امام رضا (ع) / حلقه شهید هادی ذوالفقاری با GitHub Pages و Google Apps Script.

## اتصال فعلی بک‌اند

تمام صفحات وب از لایه‌ی API مرکزی در `js/main.js` استفاده می‌کنند و endpoint فعلی این است:

`https://script.google.com/macros/s/AKfycbwQu_bIijvel7wu1898AZVlWMKavL00egnJc6-eTT3HiWxxjOo54-LKUblvLNLZOCO9/exec`

فقط `js/main.js` باید URL بک‌اند را نگه دارد؛ فایل‌های دیگر از `KanoonApp.api` استفاده می‌کنند و endpoint جداگانه ندارند.

## ساختار اصلی

- `index.html` — خانه و رویدادها
- `activities.html` — فعالیت‌ها
- `schedule.html` — برنامه هفتگی
- `coach.html` — پنل مربیان
- `officials.html` — ورود مسئولین
- `attendance.html` — حضور و غیاب
- `supervision.html` — نظارت
- `login.html` / `register.html` / `profile.html` — ورود و پروفایل اعضا
- `js/main.js` — API مرکزی و منطق مشترک
- `js/coach.js` — منطق پنل مربیان
- `apps-script/Code.gs` — بک‌اند Google Apps Script

## دسترسی و امنیت

- برای اینکه GitHub Pages بتواند API را صدا بزند، Web App باید با `Execute as: Me` و `Who has access: Anyone` منتشر شود؛ این فقط دسترسی شبکه‌ای به endpoint است و به‌تنهایی مجوز مدیریتی نمی‌دهد.
- اطلاعات ورود مربی ارشد را فقط در **Project Settings → Script Properties** با کلیدهای `MASTER_COACH_PHONE`، `MASTER_COACH_CODE` و در صورت نیاز `MASTER_COACH_NAME` ثبت کن؛ اطلاعات واقعی ورود نباید داخل GitHub باشد.
- نسخه قبلی اطلاعات ورود مربی ارشد را در مخزن عمومی داشته؛ کد قبلی را در شیت «مربیان» تعویض/غیرفعال کن و بعد از ثبت Script Properties، `setup()` را اجرا کن.
- پس از تغییر `apps-script/Code.gs`، در Google Apps Script، Deployment فعلی را ویرایش و نسخه جدید را Deploy کن. تغییر فایل GitHub به‌تنهایی کد منتشرشده گوگل را تغییر نمی‌دهد.

## GitHub Pages

این پروژه بدون build روی GitHub Pages اجرا می‌شود.
