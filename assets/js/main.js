// ======================================================
// Particle Canvas (background animation)
// ======================================================
(function(){const c=document.getElementById('cosmos'),ctx=c.getContext('2d');let W,H,p=[],m={x:-9999,y:-9999};function r(){W=c.width=window.innerWidth;H=c.height=window.innerHeight}function cp(){return{x:Math.random()*W,y:Math.random()*H,vx:(Math.random()-0.5)*0.1,vy:(Math.random()-0.5)*0.1,r:Math.random()*1+0.3,alpha:Math.random()*0.4+0.1}}function i(){r();p=Array.from({length:100},cp)}function d(){ctx.clearRect(0,0,W,H);for(let i=0;i<p.length;i++)for(let j=i+1;j<p.length;j++){const dx=p[i].x-p[j].x,dy=p[i].y-p[j].y,dist=Math.hypot(dx,dy);if(dist<100){ctx.beginPath();ctx.strokeStyle=`rgba(200,200,200,${0.03*(1-dist/100)})`;ctx.lineWidth=0.5;ctx.moveTo(p[i].x,p[i].y);ctx.lineTo(p[j].x,p[j].y);ctx.stroke()}}p.forEach(pa=>{const dx=pa.x-m.x,dy=pa.y-m.y,md=Math.hypot(dx,dy);if(md<100){const f=(100-md)/100*0.3;pa.vx+=dx/md*f;pa.vy+=dy/md*f}pa.vx*=0.99;pa.vy*=0.99;pa.x+=pa.vx;pa.y+=pa.vy;if(pa.x<0)pa.x=W;if(pa.x>W)pa.x=0;if(pa.y<0)pa.y=H;if(pa.y>H)pa.y=0;ctx.beginPath();ctx.fillStyle=`rgba(220,220,220,${pa.alpha})`;ctx.arc(pa.x,pa.y,pa.r,0,Math.PI*2);ctx.fill()});requestAnimationFrame(d)}window.addEventListener('resize',r);window.addEventListener('mousemove',e=>{m.x=e.clientX;m.y=e.clientY});i();d()})();

// ======================================================
// BOOKING FORM — saves to Firestore (shared, live for every visitor)
// + optional email notification via Formspree
// ======================================================
// 🔧 SETUP: Go to https://formspree.io → create free account
//   → New Form → copy your Form ID and paste it below
const FORMSPREE_ID = 'xeendkgq'; // e.g. 'xpzgkwqr'
// ======================================================

// ======================================================
// CLINIC SCHEDULE — open every day except Friday, 1:00 PM – 11:00 PM,
// 30-minute slots. Change these three values if the schedule changes.
// ======================================================
const CLINIC_CLOSED_WEEKDAY = 5; // JS getDay(): 0=Sun,1=Mon,2=Tue,3=Wed,4=Thu,5=Fri,6=Sat
const CLINIC_START_MIN = 13 * 60;  // 1:00 PM in minutes-from-midnight
const CLINIC_END_MIN   = 23 * 60;  // 11:00 PM (last slot starts before this)
const SLOT_LENGTH_MIN  = 30;
const MIN_ADVANCE_MIN  = 60; // require booking at least 1 hour ahead for same-day slots

function minutesToLabel(mins) {
  let h = Math.floor(mins / 60), m = mins % 60;
  const ampm = h >= 12 ? 'PM' : 'AM';
  let h12 = h % 12; if (h12 === 0) h12 = 12;
  return `${h12}:${String(m).padStart(2,'0')} ${ampm}`;
}
function minutesToHHMM(mins) {
  return `${String(Math.floor(mins/60)).padStart(2,'0')}:${String(mins%60).padStart(2,'0')}`;
}

// (Re)build the time dropdown for a given date — past times (or all times,
// if the clinic is closed that day) are shown but disabled, with a label
// explaining why, instead of letting the person pick them and then fail.
function populateTimeOptions(dateVal) {
  const sel = document.getElementById('bookingTime');
  if (!sel) return;
  const isArabic = document.body.dir === 'rtl';
  const prevValue = sel.value;

  const now = new Date();
  const isToday = dateVal === now.toISOString().split('T')[0];
  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  const picked = dateVal ? new Date(dateVal + 'T00:00:00') : null;
  const isClosedDay = picked && picked.getDay() === CLINIC_CLOSED_WEEKDAY;

  sel.innerHTML = '';
  const placeholder = document.createElement('option');
  placeholder.value = '';
  placeholder.textContent = '— اختر الوقت / Select Time —';
  sel.appendChild(placeholder);

  for (let m = CLINIC_START_MIN; m < CLINIC_END_MIN; m += SLOT_LENGTH_MIN) {
    const hhmm = minutesToHHMM(m);
    const opt = document.createElement('option');
    opt.value = hhmm;
    const isPast = isToday && (m - nowMinutes) < MIN_ADVANCE_MIN;
    const disabled = isClosedDay || isPast;
    let label = minutesToLabel(m);
    if (isClosedDay) label += isArabic ? ' (العيادة مغلقة)' : ' (clinic closed)';
    else if (isPast) label += isArabic ? ' (انتهى الوقت)' : ' (past)';
    opt.textContent = label;
    opt.disabled = disabled;
    sel.appendChild(opt);
  }

  // Keep the previous selection only if it's still a valid, enabled option
  const stillValid = Array.from(sel.options).some(o => o.value === prevValue && !o.disabled);
  sel.value = stillValid ? prevValue : '';
}

function onBookingDateChange() {
  populateTimeOptions(document.getElementById('bookingDate').value);
  checkAvailability();
}

// Build today's options as soon as the page loads
populateTimeOptions(new Date().toISOString().split('T')[0]);

let availabilityCheckToken = 0;

// Called whenever the date or time field changes — checks that ONE
// specific date+time against Firestore and tells the person immediately.
async function checkAvailability() {
  const dateVal = document.getElementById('bookingDate').value;
  const timeVal = document.getElementById('bookingTime').value;
  const msgEl = document.getElementById('availabilityMsg');
  const isArabic = document.body.dir === 'rtl';
  const myToken = ++availabilityCheckToken; // avoid race between overlapping checks

  if (!dateVal || !timeVal) { msgEl.className = 'slots-status-msg'; msgEl.textContent = ''; return; }

  const picked = new Date(dateVal + 'T00:00:00');
  if (picked.getDay() === CLINIC_CLOSED_WEEKDAY) {
    msgEl.className = 'slots-status-msg warn';
    msgEl.textContent = isArabic ? '⚠️ العيادة إجازة يوم الجمعة — برجاء اختيار يوم آخر.' : '⚠️ The clinic is closed on Fridays — please choose another day.';
    return;
  }

  const now = new Date();
  const isToday = dateVal === now.toISOString().split('T')[0];
  if (isToday) {
    const [hh, mm] = timeVal.split(':').map(Number);
    const nowMinutes = now.getHours() * 60 + now.getMinutes();
    if ((hh * 60 + mm) - nowMinutes < MIN_ADVANCE_MIN) {
      msgEl.className = 'slots-status-msg warn';
      msgEl.textContent = isArabic ? '⚠️ هذا الوقت قريب جداً، برجاء اختيار وقت لاحق بساعة على الأقل.' : '⚠️ That time is too soon — please pick a time at least 1 hour from now.';
      return;
    }
  }

  msgEl.className = 'slots-status-msg';
  msgEl.textContent = isArabic ? '⏳ جاري التحقق من توفر الميعاد...' : '⏳ Checking availability...';

  try {
    const doc = await slotsCollection.doc(`${dateVal}_${timeVal}`).get();
    if (myToken !== availabilityCheckToken) return; // a newer check superseded this one
    const isTaken = doc.exists;
    if (isTaken) {
      msgEl.className = 'slots-status-msg error';
      msgEl.textContent = isArabic ? '❌ هذا الميعاد محجوز بالفعل، برجاء اختيار وقت آخر.' : '❌ This time is already booked — please choose another.';
    } else {
      msgEl.className = 'slots-status-msg ok';
      msgEl.textContent = isArabic ? '✅ الميعاد متاح' : '✅ This time is available';
    }
  } catch (e) {
    if (myToken !== availabilityCheckToken) return;
    console.error('Availability check failed:', e);
    msgEl.className = 'slots-status-msg error';
    msgEl.textContent = isArabic ? '⚠️ تعذر التحقق من الميعاد. حاول مرة أخرى.' : '⚠️ Could not check availability. Please try again.';
  }
}

// Helper function to get formatted phone number with country code
function getFullPhoneNumber() {
  let countryCode = document.getElementById('bookingCountryCode').value;
  let localNumber = document.getElementById('bookingPhoneNumber')?.value.trim().replace(/^0+/, '');
  if (!localNumber) return '';
  localNumber = localNumber.replace(/\D/g, '');
  if (!localNumber) return '';
  return `${countryCode}${localNumber}`;
}

// Submit Booking — saves to Firestore (visible instantly in the dashboard, from any device)
// AND sends to Formspree (email notification to the doctor)
async function submitBooking() {
  const firstName = document.getElementById('bookingFirstName')?.value.trim();
  const lastName  = document.getElementById('bookingLastName')?.value.trim();
  const email     = document.getElementById('bookingEmail')?.value.trim();
  const fullRawPhone = getFullPhoneNumber();
  const type      = document.getElementById('bookingType')?.value;
  const date      = document.getElementById('bookingDate')?.value;
  const time      = document.getElementById('bookingTime')?.value;
  const message   = document.getElementById('bookingMessage')?.value.trim();

  const successMsg = document.getElementById('bookingSuccessMsg');

  function showError(msgAr, msgEn) {
    const isArabic = document.body.dir === 'rtl';
    successMsg.style.display = 'block';
    successMsg.style.cssText += ';background:rgba(220,53,69,0.2);border-color:#dc3545;color:#dc3545;display:block';
    successMsg.innerHTML = isArabic ? msgAr : msgEn;
    setTimeout(() => { successMsg.style.display = 'none'; }, 4000);
  }

  // --- VALIDATION: All fields required ---
  if (!firstName) { showError('⚠️ الرجاء إدخال الاسم الأول.', '⚠️ Please enter your first name.'); return; }
  if (!lastName)  { showError('⚠️ الرجاء إدخال اسم العائلة.', '⚠️ Please enter your last name.'); return; }
  if (!email)     { showError('⚠️ الرجاء إدخال البريد الإلكتروني.', '⚠️ Please enter your email address.'); return; }
  const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailPattern.test(email)) { showError('⚠️ الرجاء إدخال بريد إلكتروني صحيح (مثال: name@domain.com).', '⚠️ Please enter a valid email address (e.g., name@domain.com).'); return; }
  if (!fullRawPhone) { showError('⚠️ الرجاء إدخال رقم الهاتف (واتساب) بشكل صحيح.', '⚠️ Please enter a valid WhatsApp phone number.'); return; }
  if (!type) { showError('⚠️ الرجاء اختيار نوع الاستفسار.', '⚠️ Please select an inquiry type.'); return; }
  if (!date) { showError('⚠️ الرجاء تحديد تاريخ الحجز.', '⚠️ Please select a booking date.'); return; }
  if (!time) { showError('⚠️ الرجاء اختيار ميعاد من المواعيد المتاحة.', '⚠️ Please select an available time slot.'); return; }
  const pickedDate = new Date(date + 'T00:00:00');
  if (pickedDate.getDay() === CLINIC_CLOSED_WEEKDAY) { showError('⚠️ العيادة إجازة يوم الجمعة.', '⚠️ The clinic is closed on Fridays.'); return; }
  const nowCheck = new Date();
  if (date === nowCheck.toISOString().split('T')[0]) {
    const [hhC, mmC] = time.split(':').map(Number);
    if ((hhC * 60 + mmC) - (nowCheck.getHours() * 60 + nowCheck.getMinutes()) < MIN_ADVANCE_MIN) {
      showError('⚠️ هذا الوقت قريب جداً، برجاء اختيار وقت آخر.', '⚠️ That time is too soon, please choose another.');
      return;
    }
  }

  const displayPhone = `+${fullRawPhone}`;

  const submitBtn = document.querySelector('.form-submit');
  if (submitBtn) { submitBtn.disabled = true; submitBtn.style.opacity = '0.6'; }

  const newBooking = {
    name: `${firstName} ${lastName}`,
    email, phone: displayPhone,
    type, date, time,
    message: message || 'No message',
    status: 'pending',
    createdAt: firebase.firestore.FieldValue.serverTimestamp()
  };

  // Deterministic doc ID (date_time) — the "slots" doc is the public source
  // of truth for whether a time is taken (no personal data in it), while
  // the matching "bookings" doc (same ID) holds the full patient details.
  const slotId = `${date}_${time}`;
  let savedOk = false;
  let slotTaken = false;
  try {
    await db.runTransaction(async (tx) => {
      const slotRef = slotsCollection.doc(slotId);
      const slotSnap = await tx.get(slotRef);
      if (slotSnap.exists) {
        throw new Error('SLOT_TAKEN');
      }
      tx.set(slotRef, { date, time, createdAt: firebase.firestore.FieldValue.serverTimestamp() });
      tx.set(bookingsCollection.doc(slotId), newBooking);
    });
    savedOk = true;
  } catch (e) {
    if (e && e.message === 'SLOT_TAKEN') {
      slotTaken = true;
    } else {
      console.error('Firestore save failed:', e);
    }
  }

  // Email notification to the doctor (best-effort, doesn't block the booking)
  if (FORMSPREE_ID && FORMSPREE_ID !== 'YOUR_FORM_ID') {
    try {
      await fetch(`https://formspree.io/f/${FORMSPREE_ID}`, {
        method: 'POST',
        headers: { 'Accept': 'application/json', 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: `${firstName} ${lastName}`,
          email, phone: displayPhone,
          inquiry_type: type,
          appointment_date: date || 'لم يُحدد',
          appointment_time: time || 'لم يُحدد',
          message: message || 'لا توجد رسالة',
          _subject: `🏥 حجز جديد من ${firstName} ${lastName} — د. محمد عماد الدين`
        })
      });
    } catch (e) { /* ignore — Firestore save is the source of truth */ }
  }

  if (submitBtn) { submitBtn.disabled = false; submitBtn.style.opacity = '1'; }

  const isArabic = document.body.dir === 'rtl';
  if (savedOk) {
    ['bookingFirstName','bookingLastName','bookingEmail','bookingDate','bookingMessage']
      .forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });
    document.getElementById('bookingPhoneNumber').value = '';
    document.getElementById('bookingCountryCode').value = '20';
    document.getElementById('bookingTime').value = '';
    document.getElementById('availabilityMsg').textContent = '';

    successMsg.style.cssText = 'display:block;background:rgba(40,167,69,0.2);border:1px solid #28a745;color:#28a745;padding:14px;border-radius:10px;margin-top:20px;text-align:center';
    successMsg.innerHTML = isArabic
      ? '✅ تم إرسال طلب الحجز بنجاح! سيتواصل معك الدكتور عماد قريباً.'
      : '✅ Booking request sent successfully! Dr. Emad will contact you soon.';
    setTimeout(() => { successMsg.style.display = 'none'; }, 6000);
  } else if (slotTaken) {
    showError(
      '⚠️ للأسف تم حجز هذا الميعاد للتو من شخص آخر. برجاء اختيار ميعاد آخر.',
      '⚠️ Sorry, this time slot was just booked by someone else. Please pick another time.'
    );
    checkAvailability(); // re-check so the message reflects the now-taken slot
  } else {
    showError(
      '⚠️ حدث خطأ أثناء إرسال الحجز. برجاء المحاولة مرة أخرى أو التواصل عبر واتساب.',
      '⚠️ Something went wrong sending your booking. Please try again or contact us via WhatsApp.'
    );
  }
}

// Restrict the booking date picker to today .. +90 days
(function() {
  const dateInput = document.getElementById('bookingDate');
  if (!dateInput) return;
  const today = new Date();
  const maxDate = new Date();
  maxDate.setDate(maxDate.getDate() + 90);
  dateInput.min = today.toISOString().split('T')[0];
  dateInput.max = maxDate.toISOString().split('T')[0];
})();

// Navigation scroll style
window.addEventListener('scroll', () => { document.getElementById('nav').classList.toggle('scrolled', window.scrollY > 60); });

const observer = new IntersectionObserver(e => { e.forEach(entry => { if (entry.isIntersecting) { entry.target.classList.add('visible'); observer.unobserve(entry.target); } }); }, { threshold: 0.05, rootMargin: '0px 0px -30px 0px' });
document.querySelectorAll('.reveal').forEach(el => observer.observe(el));

const counterObserver = new IntersectionObserver(e => { e.forEach(entry => { if (entry.isIntersecting) { const el = entry.target, target = parseInt(el.dataset.target), duration = 2000, step = target / (duration / 16); let cur = 0; const t = setInterval(() => { cur = Math.min(cur + step, target); el.textContent = Math.floor(cur); if (cur >= target) { el.textContent = target; clearInterval(t); } }, 16); counterObserver.unobserve(el); } }); }, { threshold: 0, rootMargin: '0px 0px -50px 0px' });
document.querySelectorAll('.counter').forEach(c => counterObserver.observe(c));

let slideIndex = 0;
const allSlides = document.querySelectorAll('.testimonial-slide');
const totalSlides = allSlides.length;

function updateSlider() {
  allSlides.forEach((s, i) => { s.classList.toggle('active', i === slideIndex); });
  document.querySelectorAll('.dot').forEach((d, i) => { d.classList.toggle('active', i === slideIndex); });
}
function nextSlide() { slideIndex = (slideIndex + 1) % totalSlides; updateSlider(); }
function prevSlide() { slideIndex = (slideIndex - 1 + totalSlides) % totalSlides; updateSlider(); }
function goToSlide(i) { slideIndex = i; updateSlider(); }
setInterval(nextSlide, 5000);

function filterPortfolio(cat, btn) {
  document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  document.querySelectorAll('.portfolio-item').forEach(item => { if (cat === 'all' || item.dataset.cat === cat) item.style.display = ''; else item.style.display = 'none'; });
}

const pData = [
  {catAr:'رسم طبي',catEn:'Medical Illustration',titleAr:'وضع خزان المضخة القضيبية تحت العضلة المائلة الخارجية',titleEn:'Ectopic Reservoir Placement',descAr:'رسم توضيحي مفصل يصور تقنية جديدة لوضع خزان المضخة القضيبية.',descEn:'Detailed illustration of novel reservoir placement technique.',img:''},
  {catAr:'رسم طبي',catEn:'Medical Illustration',titleAr:'تخفيف الضغط القضيبي الصفني',titleEn:'Penoscrotal Decompression',descAr:'رسم توضيحي لعلاج الانتصاب المؤلم المستعصي.',descEn:'Anatomical illustration for priapism decompression.',img:''},
  {catAr:'غلاف مجلة Sexual Medicine',catEn:'Journal Cover',titleAr:'خياطة تثبيت الحشفة المزدوجة',titleEn:'Double Distal Anchoring Stitch',descAr:'ظهر على غلاف مجلة الطب الجنسي.',descEn:'Featured on JSM cover.',img:''},
  {catAr:'حالة جراحية',catEn:'Surgical Case',titleAr:'إغلاق الناسور بعد الإحليل التحتي',titleEn:'Hypospadias Fistula Closure',descAr:'إدارة جراحية للناسور الإحليلي.',descEn:'Surgical management of urethrocutaneous fistula.',img:''},
  {catAr:'رسم طبي',catEn:'Medical Illustration',titleAr:'بضع الكهف الممتد',titleEn:'Extended Corporotomy',descAr:'تقنية جديدة لزراعة المضخة القضيبية.',descEn:'Novel technique for penile prosthesis.',img:''},
  {catAr:'حالة جراحية',catEn:'Surgical Case',titleAr:'ترميم مجرى البول الأنثوي',titleEn:'Female Urethroplasty',descAr:'ترميم تضيق مجرى البول عند السيدات.',descEn:'Female urethral stricture reconstruction.',img:''}
];
function openModal(i) {
  const d = pData[i];
  const lang = document.body.dir === 'rtl';
  document.getElementById('modal-cat').textContent = lang ? d.catAr : d.catEn;
  document.getElementById('modal-title').textContent = lang ? d.titleAr : d.titleEn;
  document.getElementById('modal-desc').textContent = lang ? d.descAr : d.descEn;
  const imgEl = document.getElementById('modal-img');
  const placeholder = document.getElementById('modal-img-placeholder');
  if (d.img) { imgEl.src = d.img; imgEl.style.display = 'block'; placeholder.style.display = 'none'; }
  else { imgEl.style.display = 'none'; placeholder.style.display = 'flex'; }
  document.getElementById('modal').style.display = 'flex';
  document.body.style.overflow = 'hidden';
}
function closeModal() { document.getElementById('modal').style.display = 'none'; document.body.style.overflow = ''; }
document.getElementById('modal').addEventListener('click', e => { if (e.target === document.getElementById('modal')) closeModal(); });
document.addEventListener('keydown', e => { if (e.key === 'Escape') closeModal(); });

function toggleMobileNav() { const l = document.querySelector('.nav-links'), c = document.querySelector('.nav-cta'); if (l.style.display === 'flex') { l.style.display = 'none'; if (c) c.style.display = ''; } else { l.style.cssText = 'display:flex;flex-direction:column;position:fixed;top:80px;left:0;right:0;background:rgba(0,0,0,0.98);backdrop-filter:blur(24px);padding:40px 24px;gap:28px;z-index:999;border-bottom:1px solid rgba(200,200,200,0.1)'; l.querySelectorAll('a').forEach(a => a.style.cssText = 'color:rgba(245,245,245,0.8);font-size:0.9rem;'); if (c) c.style.display = 'none'; } }

const langButtons = document.querySelectorAll('.lang-btn');
function setLanguage(lang) { if (lang === 'en') { document.body.dir = "ltr"; document.body.style.textAlign = "left"; } else { document.body.dir = "rtl"; document.body.style.textAlign = "right"; } langButtons.forEach(btn => { if (btn.dataset.lang === lang) btn.classList.add('active'); else btn.classList.remove('active'); }); localStorage.setItem('preferred_lang', lang); document.querySelectorAll('#bookingType option').forEach(opt => { opt.textContent = lang === 'en' ? opt.dataset.en : opt.dataset.ar; }); }
langButtons.forEach(btn => { btn.addEventListener('click', () => setLanguage(btn.dataset.lang)); });
setLanguage('en');

let currentMode = 'grid'; const toggleBtn = document.getElementById('displayModeToggle'); const toggleIcon = toggleBtn.querySelector('i');
function setDisplayMode(mode) { document.body.classList.remove('grid-mode', 'list-mode'); document.body.classList.add(mode + '-mode'); currentMode = mode; localStorage.setItem('portfolioDisplayMode', mode); toggleIcon.className = mode === 'grid' ? 'fas fa-th-large' : 'fas fa-list-ul'; }
toggleBtn.addEventListener('click', () => { setDisplayMode(currentMode === 'grid' ? 'list' : 'grid'); });
const savedMode = localStorage.getItem('portfolioDisplayMode'); setDisplayMode(savedMode === 'list' ? 'list' : 'grid');

// Surgery Video Toggle
function toggleSurgeryVideo() {
  const video = document.getElementById('surgeryVideoEl');
  const overlay = document.getElementById('videoPlayOverlay');
  const icon = document.getElementById('videoPlayIcon');
  if (!video) return;
  if (video.paused) { video.play(); overlay.style.opacity = '0'; overlay.style.pointerEvents = 'none'; icon.className = 'fas fa-pause'; }
  else { video.pause(); overlay.style.opacity = '1'; overlay.style.pointerEvents = 'auto'; icon.className = 'fas fa-play'; }
}
const surgeryVideoEl = document.getElementById('surgeryVideoEl');
if (surgeryVideoEl) {
  surgeryVideoEl.addEventListener('ended', () => {
    const overlay = document.getElementById('videoPlayOverlay');
    const icon = document.getElementById('videoPlayIcon');
    if (overlay) { overlay.style.opacity = '1'; overlay.style.pointerEvents = 'auto'; }
    if (icon) icon.className = 'fas fa-play';
  });
  surgeryVideoEl.addEventListener('click', toggleSurgeryVideo);
}

// ── Country Picker ──────────────────────────────────────────
const COUNTRIES = [
  { code:'20',  flag:'🇪🇬', name:'Egypt',          dial:'+20'  },
  { code:'966', flag:'🇸🇦', name:'Saudi Arabia',   dial:'+966' },
  { code:'971', flag:'🇦🇪', name:'UAE',            dial:'+971' },
  { code:'974', flag:'🇶🇦', name:'Qatar',          dial:'+974' },
  { code:'965', flag:'🇰🇼', name:'Kuwait',         dial:'+965' },
  { code:'973', flag:'🇧🇭', name:'Bahrain',        dial:'+973' },
  { code:'968', flag:'🇴🇲', name:'Oman',           dial:'+968' },
  { code:'962', flag:'🇯🇴', name:'Jordan',         dial:'+962' },
  { code:'961', flag:'🇱🇧', name:'Lebanon',        dial:'+961' },
  { code:'218', flag:'🇱🇾', name:'Libya',          dial:'+218' },
  { code:'216', flag:'🇹🇳', name:'Tunisia',        dial:'+216' },
  { code:'212', flag:'🇲🇦', name:'Morocco',        dial:'+212' },
  { code:'213', flag:'🇩🇿', name:'Algeria',        dial:'+213' },
  { code:'249', flag:'🇸🇩', name:'Sudan',          dial:'+249' },
  { code:'967', flag:'🇾🇪', name:'Yemen',          dial:'+967' },
  { code:'964', flag:'🇮🇶', name:'Iraq',           dial:'+964' },
  { code:'963', flag:'🇸🇾', name:'Syria',          dial:'+963' },
  { code:'1',   flag:'🇺🇸', name:'United States',  dial:'+1'   },
  { code:'44',  flag:'🇬🇧', name:'United Kingdom', dial:'+44'  },
  { code:'49',  flag:'🇩🇪', name:'Germany',        dial:'+49'  },
  { code:'33',  flag:'🇫🇷', name:'France',         dial:'+33'  },
  { code:'39',  flag:'🇮🇹', name:'Italy',          dial:'+39'  },
  { code:'34',  flag:'🇪🇸', name:'Spain',          dial:'+34'  },
  { code:'90',  flag:'🇹🇷', name:'Turkey',         dial:'+90'  },
  { code:'91',  flag:'🇮🇳', name:'India',          dial:'+91'  },
  { code:'86',  flag:'🇨🇳', name:'China',          dial:'+86'  },
  { code:'1-CA',flag:'🇨🇦', name:'Canada',         dial:'+1'   },
  { code:'55',  flag:'🇧🇷', name:'Brazil',         dial:'+55'  },
  { code:'61',  flag:'🇦🇺', name:'Australia',      dial:'+61'  },
];

let selectedCountry = COUNTRIES[0];
let filteredCountries = [...COUNTRIES];

function renderCountryList(list) {
  const el = document.getElementById('countryList');
  if (!el) return;
  el.innerHTML = list.map(c =>
    '<div class="country-option' + (c.code === selectedCountry.code ? ' selected' : '') + '" onclick="selectCountry(\'' + c.code + '\')">' +
    '<span class="opt-flag">' + c.flag + '</span>' +
    '<span class="opt-name">' + c.name + '</span>' +
    '<span class="opt-code">' + c.dial + '</span>' +
    '</div>'
  ).join('');
}
function selectCountry(code) {
  const country = COUNTRIES.find(c => c.code === code);
  if (!country) return;
  selectedCountry = country;
  const flagEl = document.getElementById('selectedFlag');
  const dialEl = document.getElementById('selectedDial');
  if (flagEl) flagEl.textContent = country.flag;
  if (dialEl) dialEl.textContent = country.dial;
  const dialCode = country.code.replace(/[^0-9]/g, '');
  document.getElementById('bookingCountryCode').value = dialCode;
  closeCountryPicker();
  renderCountryList(filteredCountries);
}
function filterCountries(q) {
  const query = q.toLowerCase();
  filteredCountries = query ? COUNTRIES.filter(c => c.name.toLowerCase().includes(query) || c.dial.includes(query)) : [...COUNTRIES];
  renderCountryList(filteredCountries);
}
function toggleCountryPicker(e) {
  if (e) e.stopPropagation();
  const picker = document.getElementById('countryPicker');
  if (picker.classList.contains('open')) { closeCountryPicker(); return; }
  picker.classList.add('open');
  const search = document.getElementById('countrySearch');
  if (search) { search.value = ''; filterCountries(''); setTimeout(() => search.focus(), 50); }
}
function closeCountryPicker() { const picker = document.getElementById('countryPicker'); if (picker) picker.classList.remove('open'); }
document.addEventListener('click', function(e) { const picker = document.getElementById('countryPicker'); if (picker && !picker.contains(e.target)) closeCountryPicker(); });
renderCountryList(COUNTRIES);
// ── End Country Picker ──────────────────────────────────────

// ── Animated Expertise Ticker ────────────────────────────────
(function() {
  const expertiseItems = { en: ['Expert In Prosthetic Implantation.', 'Expert In Hypospadias Surgery.'], ar: ['خبير فى زراعة الدعامات الذكرية', 'جراحات الاحليل البولى السفلى'] };
  let currentIndex = 0;
  let isAnimating = false;
  function getCurrentLang() { return document.body.dir === 'rtl' ? 'ar' : 'en'; }
  function initTicker() { const lang = getCurrentLang(); const active = document.getElementById('tickerActive'); if (active) { active.textContent = expertiseItems[lang][0]; active.style.transform = 'translateY(0)'; active.style.opacity = '1'; } }
  function rotateTicker() {
    if (isAnimating) return;
    isAnimating = true;
    const lang = getCurrentLang();
    const items = expertiseItems[lang];
    const nextIndex = (currentIndex + 1) % items.length;
    const activeEl = document.getElementById('tickerActive');
    const nextEl   = document.getElementById('tickerNext');
    if (!activeEl || !nextEl) { isAnimating = false; return; }
    nextEl.textContent = items[nextIndex];
    nextEl.style.transform = 'translateY(110%)';
    nextEl.style.opacity = '0';
    nextEl.style.transition = 'none';
    void nextEl.offsetWidth;
    activeEl.classList.remove('ticker-enter');
    activeEl.classList.add('ticker-exit');
    nextEl.classList.remove('ticker-exit');
    nextEl.classList.add('ticker-enter');
    nextEl.style.transform = '';
    nextEl.style.opacity = '';
    nextEl.style.transition = '';
    setTimeout(function() {
      activeEl.textContent = items[nextIndex];
      activeEl.style.transform = 'translateY(0)';
      activeEl.style.opacity = '1';
      activeEl.style.transition = 'none';
      activeEl.classList.remove('ticker-exit');
      nextEl.style.opacity = '0';
      nextEl.classList.remove('ticker-enter');
      currentIndex = nextIndex;
      isAnimating = false;
    }, 580);
  }
  window.addEventListener('load', function() { initTicker(); setInterval(rotateTicker, 3200); });
  const origSetLanguage = window.setLanguage;
  if (typeof setLanguage === 'function') {
    setTimeout(function() {
      const origFn = setLanguage;
      window.setLanguage = function(lang) {
        origFn(lang);
        currentIndex = 0;
        const lang2 = lang === 'en' ? 'en' : 'ar';
        const active = document.getElementById('tickerActive');
        if (active) { active.textContent = expertiseItems[lang2][0]; active.style.transform = 'translateY(0)'; active.style.opacity = '1'; }
      };
      document.querySelectorAll('.lang-btn').forEach(function(btn) { btn.addEventListener('click', function() { window.setLanguage(btn.dataset.lang); }); });
    }, 100);
  }
})();
// ── End Expertise Ticker ──────────────────────────────────────
