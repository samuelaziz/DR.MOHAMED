// ======================================================
// ADMIN DASHBOARD — Firebase Auth (login) + Firestore (live bookings)
// ======================================================
const auth = firebase.auth();
let bookings = [];
let currentFilter = '';
let unsubscribeBookings = null;

// ---------- Auth ----------
function loginToDashboard() {
  const email = document.getElementById('dashboardEmail').value.trim();
  const password = document.getElementById('dashboardPassword').value;
  const errEl = document.getElementById('loginError');
  errEl.textContent = '';

  if (!email || !password) {
    errEl.textContent = 'Please enter both email and password.';
    return;
  }

  auth.signInWithEmailAndPassword(email, password).catch(function(err) {
    errEl.textContent = 'Incorrect email or password. Please try again.';
    errEl.style.animation = 'none';
    void errEl.offsetWidth;
    errEl.style.animation = '';
  });
}

function logoutFromDashboard() {
  auth.signOut();
}

function toggleLoginPwVis() {
  const inp = document.getElementById('dashboardPassword');
  const ico = document.getElementById('loginEyeIcon');
  if (!inp) return;
  inp.type = inp.type === 'password' ? 'text' : 'password';
  if (ico) ico.className = inp.type === 'password' ? 'fas fa-eye' : 'fas fa-eye-slash';
}

auth.onAuthStateChanged(function(user) {
  const loginModal = document.getElementById('dashboardLoginModal');
  const dashPage = document.getElementById('dashboard-page');
  if (user) {
    loginModal.style.display = 'none';
    dashPage.style.display = 'block';
    document.getElementById('dashboardPassword').value = '';
    document.getElementById('loginError').textContent = '';
    startBookingsListener();
  } else {
    loginModal.style.display = 'flex';
    dashPage.style.display = 'none';
    if (unsubscribeBookings) { unsubscribeBookings(); unsubscribeBookings = null; }
  }
});

// ---------- Live bookings from Firestore ----------
function startBookingsListener() {
  if (unsubscribeBookings) return; // already listening
  unsubscribeBookings = bookingsCollection.orderBy('createdAt', 'desc').onSnapshot(
    function(snapshot) {
      bookings = snapshot.docs.map(function(doc) {
        const data = doc.data();
        return {
          id: doc.id,
          name: data.name || '',
          email: data.email || '',
          phone: data.phone || '',
          type: data.type || '',
          date: data.date || '',
          time: data.time || '',
          message: data.message || '',
          status: data.status || 'pending',
          createdAt: data.createdAt
        };
      });
      renderDashboardTable();
    },
    function(err) {
      console.error('Failed to load bookings:', err);
      const tbody = document.getElementById('bookingsTableBody');
      if (tbody) tbody.innerHTML = '<tr><td colspan="10" style="text-align:center;padding:30px;">⚠️ Could not load bookings. Check your Firebase setup / connection.</td></tr>';
    }
  );
}

function deleteBooking(id) {
  if (confirm('هل أنت متأكد من حذف هذا الحجز؟')) {
    Promise.all([
      bookingsCollection.doc(id).delete(),
      slotsCollection.doc(id).delete().catch(function(){}) // free the slot too (ignore if already gone)
    ]).catch(function(e) { console.error('Delete failed:', e); alert('Could not delete booking.'); });
  }
}

function updateBookingStatus(id, newStatus) {
  const booking = bookings.find(function(b) { return b.id === id; });
  bookingsCollection.doc(id).update({ status: newStatus }).then(function() {
    if (newStatus === 'cancelled') {
      slotsCollection.doc(id).delete().catch(function(){}); // free the slot so someone else can book it
    }
    if (newStatus === 'confirmed' && booking) {
      let rawPhone = booking.phone.replace(/[^0-9]/g, '');
      if (rawPhone.length >= 10) {
        const waMsg = buildConfirmMsg(booking.name, booking.date, booking.time, booking.type);
        openWhatsAppModal(booking.name, rawPhone, waMsg);
      }
    }
  }).catch(function(e) { console.error('Update failed:', e); alert('Could not update booking status.'); });
}

function openWhatsAppModal(name, phoneNumber, msgText) {
  document.getElementById('waModalMsg').textContent = msgText;
  document.getElementById('waModalSub').textContent = `سترسل إلى: ${name} — ${phoneNumber}`;
  document.getElementById('waModalLink').href = `https://wa.me/${phoneNumber}?text=${encodeURIComponent(msgText)}`;
  document.getElementById('waModal').classList.add('open');
}

function buildConfirmMsg(name, date, time, type) {
  return (
    'مرحباً ' + name + ' 👋\n\n' +
    'نبشركم بأن موعدكم لدى عيادة د. محمد عماد الدين تم تأكيده بنجاح ✅\n\n' +
    '━━━━━━━━━━━━━━━━━━━━━\n' +
    '📅 التاريخ: ' + date + '\n' +
    '🕐 الوقت: ' + (time || '—') + '\n' +
    '🩺 الخدمة: ' + type + '\n' +
    '━━━━━━━━━━━━━━━━━━━━━\n\n' +
    '🕐 يُرجى الحضور قبل موعدكم بـ 15 دقيقة.\n' +
    '📞 للاستفسار أو التعديل: +201027870022\n\n' +
    'شكراً لثقتكم الغالية 🏥\n' +
    '— د. محمد عماد الدين\n' +
    'مدرس المسالك البولية — جامعة بني سويف'
  );
}

function filterBookings() { renderDashboardTable(); }

function renderDashboardTable() {
  const tbody = document.getElementById('bookingsTableBody');
  const search = (document.getElementById('searchBookings')?.value || '').toLowerCase();

  const filtered = bookings.filter(function(b) {
    return !search || b.name.toLowerCase().includes(search) || b.email.toLowerCase().includes(search);
  });

  document.getElementById('totalBookings').textContent = bookings.length;
  document.getElementById('pendingBookings').textContent = bookings.filter(function(b){return b.status==='pending';}).length;
  document.getElementById('confirmedBookings').textContent = bookings.filter(function(b){return b.status==='confirmed';}).length;
  document.getElementById('completedBookings').textContent = bookings.filter(function(b){return b.status==='completed';}).length;

  if (filtered.length === 0) {
    tbody.innerHTML = '<tr><td colspan="10" style="text-align:center;padding:30px;">No bookings found.</td></tr>';
    return;
  }

  tbody.innerHTML = filtered.map(function(b, i) {
    const highlightClass = b.status === 'confirmed' ? 'highlight-row' : '';
    return `<tr id="row-${b.id}" class="${highlightClass}">
      <td>${i + 1}</td>
      <td>${escapeHtml(b.name)}</td>
      <td>${escapeHtml(b.email)}</td>
      <td>${escapeHtml(b.phone)}</td>
      <td>${escapeHtml(b.type)}</td>
      <td>${escapeHtml(b.date)}</td>
      <td>${escapeHtml(b.time)}</td>
      <td>${escapeHtml(b.message)}</td>
      <td><span class="status-badge status-${b.status}">${b.status}</span></td>
      <td>
        <button class="action-btn" onclick="updateBookingStatus('${b.id}','confirmed')">✓ Confirm</button>
        <button class="action-btn" onclick="updateBookingStatus('${b.id}','completed')">✔ Done</button>
        <button class="action-btn" onclick="updateBookingStatus('${b.id}','cancelled')">✗ Cancel</button>
        <button class="action-btn" onclick="deleteBooking('${b.id}')">🗑 Delete</button>
      </td>
    </tr>`;
  }).join('');
}

function escapeHtml(str) {
  return String(str || '').replace(/[&<>"']/g, function(m) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m];
  });
}
