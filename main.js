/* =========================================================
   حلقه شهید هادی ذوالفقاری — منطق مشترک سایت
   نکته: این نسخه اولیه است. لیست مربی‌ها و رویدادها فعلاً
   به‌صورت آرایه‌ی محلی است. در قدم بعد این‌ها را از طریق
   Google Apps Script Web App به یک Google Sheet وصل می‌کنیم
   (توضیح کامل در README.md).
   ========================================================= */

// ---------- داده‌های نمونه (بعداً از Google Sheet خوانده می‌شود) ----------

// شماره مربی‌های از پیش ثبت‌شده. ورود فقط با شماره تلفن انجام می‌شود.
const MENTOR_NUMBERS = [
  "09120000000",
  "09350000000",
];

const SAMPLE_EVENTS = [
  {
    title: "اردوی نوروزی حلقه",
    date: "۱۵ اسفند",
    tag: "رویداد ویژه",
    image: "",
  },
  {
    title: "مسابقه‌ی PS5 هفتگی",
    date: "هر پنجشنبه",
    tag: "برنامه‌ی هفتگی",
    image: "",
  },
  {
    title: "جلسه‌ی هیئت شهدا",
    date: "۲۲ بهمن",
    tag: "رویداد",
    image: "",
  },
];

// ---------- ابزار کمکی ----------

function toast(message) {
  let el = document.querySelector(".toast");
  if (!el) {
    el = document.createElement("div");
    el.className = "toast";
    document.body.appendChild(el);
  }
  el.textContent = message;
  el.classList.add("show");
  clearTimeout(el._t);
  el._t = setTimeout(() => el.classList.remove("show"), 2600);
}

function normalizePhone(value) {
  return value.replace(/[^\d]/g, "");
}

// ---------- کاروسل رویدادها ----------

function initCarousel() {
  const track = document.querySelector(".carousel-track");
  const dotsWrap = document.querySelector(".carousel-dots");
  if (!track || !dotsWrap) return;

  track.innerHTML = "";
  dotsWrap.innerHTML = "";

  SAMPLE_EVENTS.forEach((ev, i) => {
    const slide = document.createElement("div");
    slide.className = "carousel-slide";
    if (ev.image) slide.style.backgroundImage = `url(${ev.image})`;
    else
      slide.style.background =
        "linear-gradient(135deg, #146b66, #223a5e)";
    slide.innerHTML = `
      <div class="carousel-text">
        <p class="eyebrow">${ev.tag}</p>
        <h2>${ev.title} — ${ev.date}</h2>
      </div>`;
    track.appendChild(slide);

    const dot = document.createElement("button");
    if (i === 0) dot.classList.add("active");
    dot.addEventListener("click", () => goToSlide(i));
    dotsWrap.appendChild(dot);
  });

  let current = 0;
  let timer;

  function goToSlide(index) {
    current = (index + SAMPLE_EVENTS.length) % SAMPLE_EVENTS.length;
    track.style.transform = `translateX(${current * 100}%)`;
    dotsWrap.querySelectorAll("button").forEach((d, i) => {
      d.classList.toggle("active", i === current);
    });
  }

  function autoplay() {
    timer = setInterval(() => goToSlide(current + 1), 4500);
  }

  // چون سایت راست‌به‌چپ است، اسلایدر را هم بر همین اساس می‌چرخانیم
  track.style.direction = "ltr";
  goToSlide(0);
  autoplay();
}

// ---------- هایلایت آیتم فعال در نوار پایین ----------

function initBottomNav() {
  const links = document.querySelectorAll(".bottom-nav a[data-page]");
  const current = document.body.dataset.page;
  links.forEach((link) => {
    link.classList.toggle("active", link.dataset.page === current);
  });
}

// ---------- ورود مربیان (فقط با شماره تلفن) ----------

function initMentorLogin() {
  const trigger = document.querySelector("[data-open-login]");
  const overlay = document.querySelector(".modal-overlay");
  if (!trigger || !overlay) return;

  const closeBtns = overlay.querySelectorAll("[data-close-login]");
  const form = overlay.querySelector("form");
  const input = overlay.querySelector("#mentorPhone");

  trigger.addEventListener("click", () => overlay.classList.add("open"));
  closeBtns.forEach((b) =>
    b.addEventListener("click", () => overlay.classList.remove("open"))
  );
  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) overlay.classList.remove("open");
  });

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const phone = normalizePhone(input.value);

    // فعلاً بررسی در همین آرایه‌ی محلی انجام می‌شود.
    // بعداً این خط با یک fetch به Google Apps Script جایگزین می‌شود
    // تا لیست مربی‌ها از Google Sheet خوانده شود.
    if (MENTOR_NUMBERS.includes(phone)) {
      localStorage.setItem("hlq_mentor_phone", phone);
      overlay.classList.remove("open");
      toast("خوش آمدید! دسترسی مربی فعال شد.");
    } else {
      toast("این شماره در فهرست مربی‌ها ثبت نشده است.");
    }
  });
}

// ---------- اجرای همه‌ی موارد بعد از بارگذاری صفحه ----------

document.addEventListener("DOMContentLoaded", () => {
  initCarousel();
  initBottomNav();
  initMentorLogin();
});
