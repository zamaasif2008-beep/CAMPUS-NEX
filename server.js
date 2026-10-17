/* ---------- Canteen rendering & logic ---------- */
function renderCanteen(anim = true) {
  const q = $('food-search').value.trim().toLowerCase();
  const stalls = ['All', ...new Set(canteenItems.map(i => i.stall))];
  
  $('stall-chips').innerHTML = stalls.map(s =>
    `<button onclick="setStall('${s}')" class="px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
      stallFilter === s ? 'bg-orange-600 text-white shadow-sm' : 'bg-white text-slate-600 hover:bg-orange-50 border border-slate-200'
    }">${s}</button>`
  ).join('');

  const filtered = canteenItems.filter(i => {
    const matchStall = stallFilter === 'All' || i.stall === stallFilter;
    const matchQuery = !q || i.name.toLowerCase().includes(q) || i.stall.toLowerCase().includes(q);
    return matchStall && matchQuery;
  });

  const grid = $('canteen-items-grid');
  grid.innerHTML = filtered.map(item => {
    const customImg = foodPhotos[item.id];
    const imgSrc = customImg || item.img;
    
    return `
      <div class="bg-white rounded-3xl p-5 border border-orange-100 shadow-sm flex flex-col justify-between space-y-4 ${anim ? 'rmp-enter' : ''}">
        <div class="space-y-3">
          <div class="relative h-36 bg-orange-50 rounded-2xl overflow-hidden flex items-center justify-center text-4xl group">
            ${imgSrc ? `<img src="${imgSrc}" alt="${item.name}" class="w-full h-full object-cover">` : `<span>${item.emoji}</span>`}
            <div class="absolute bottom-2 right-2 flex gap-1">
              <button onclick="foodPhoto(${item.id})" class="bg-white/90 backdrop-blur-sm p-1.5 rounded-xl text-xs shadow hover:bg-white" title="Add photo">📷</button>
              ${customImg ? `<button onclick="removeFoodPhoto(${item.id})" class="bg-slate-900/80 text-white p-1.5 rounded-xl text-xs shadow hover:bg-slate-900" title="Remove photo">✕</button>` : ''}
            </div>
          </div>
          <div>
            <div class="flex items-center justify-between">
              <h3 class="font-bold text-slate-900 text-base">${item.name}</h3>
              <span class="font-extrabold text-orange-600 text-base">${inr(item.price)}</span>
            </div>
            <p class="text-xs text-slate-500 font-medium mt-0.5">${item.stall}</p>
          </div>
        </div>
        <button onclick="openModal(${item.id})" class="w-full bg-slate-900 text-white py-2.5 rounded-xl text-xs font-semibold hover:bg-slate-800 shadow-sm">Order Express</button>
      </div>
    `;
  }).join('');
}

function setStall(s) { stallFilter = s; renderCanteen(false); }
$('food-search').addEventListener('input', () => renderCanteen(false));

/* ---------- Payment Modal & Cart ---------- */
let activeItem = null;
let activeQty = 1;
let activePayMode = 'upi';

function openModal(id) {
  activeItem = canteenItems.find(i => i.id === id);
  if (!activeItem) return;
  activeQty = 1;
  activePayMode = 'upi';
  $('modal-item-title').textContent = activeItem.name + ' — Checkout';
  updateModalTotal();
  selectPaymentMode('upi');
  $('payment-modal').classList.remove('hidden');$('payment-modal').classList.add('flex');
}

function closeModal() {
  $('payment-modal').classList.add('hidden');$('payment-modal').classList.remove('flex');
}

function changeQty(d) {
  activeQty = Math.max(1, activeQty + d);
  updateModalTotal();
}

function updateModalTotal() {
  $('qty').textContent = activeQty;
  const tot = activeItem.price * activeQty;
  $('modal-total').textContent = inr(tot);
  if (activePayMode === 'upi') {
    const upiUri = `upi://pay?pa=campusnex@upi&pn=CAMPUS_NEX_Canteen&am=${tot}&cu=INR`;
    makeQR($('qrcode-container'), upiUri, 140);
  }
}

function selectPaymentMode(mode) {
  activePayMode = mode;
  const isUpi = mode === 'upi';
  $('btn-upi').className = `p-3 rounded-2xl border-2 font-semibold text-xs ${isUpi ? 'border-orange-500 bg-orange-50 text-orange-900' : 'border-slate-200 text-slate-600'}`;
  $('btn-cash').className = `p-3 rounded-2xl border-2 font-semibold text-xs ${!isUpi ? 'border-orange-500 bg-orange-50 text-orange-900' : 'border-slate-200 text-slate-600'}`;
  $('upi-container').classList.toggle('hidden', !isUpi);$('cash-container').classList.toggle('hidden', isUpi);
  updateModalTotal();
}

function confirmOrder() {
  closeModal();
  confetti();
  const token = 'CN-' + Math.floor(100 + Math.random() * 900);
  toast(`🎉 Order placed! Token: ${token}`);
  addExpenseDirect('Canteen', `${activeItem.name} (x${activeQty})`, activeItem.price * activeQty, activePayMode.toUpperCase());
}

/* ---------- Bus Tracking ---------- */
const busRoutes = [
  { id: 'r1', name: 'Route 12 - Tambaram Express', start: 'Tambaram', current: 'Guindy', status: 'On Time', progress: 45, occupancy: 'Medium' },
  { id: 'r2', name: 'Route 05 - Central Direct', start: 'Central Station', current: 'Koyambedu', status: 'Delayed 5m', progress: 70, occupancy: 'High' },
  { id: 'r3', name: 'Route 21 - Velachery Shuttle', start: 'Velachery', current: 'Madipakkam', status: 'On Time', progress: 20, occupancy: 'Low' }
];
let activeBus = busRoutes[0];

function renderBus() {
  $('bus-routes-list').innerHTML = busRoutes.map(b => `
    <button onclick="selectBus('${b.id}')" class="w-full text-left p-3 rounded-2xl border transition-all ${
      activeBus.id === b.id ? 'border-orange-500 bg-orange-50/50 shadow-sm' : 'border-slate-100 hover:bg-slate-50'
    }">
      <div class="flex justify-between items-center">
        <p class="font-bold text-xs text-slate-900">${b.name}</p>
        <span class="text-[10px] px-2 py-0.5 rounded-full font-bold ${b.status.includes('Delayed') ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-800'}">${b.status}</span>
      </div>
      <p class="text-[11px] text-slate-500 mt-1">From: ${b.start}</p>
    </button>
  `).join('');

  $('active-bus-title').textContent = activeBus.name;
  $('active-bus-status').textContent = activeBus.status;
  $('bus-start').textContent = activeBus.start;
  $('bus-current-stop').textContent = activeBus.current;
  $('bus-progress').style.width = activeBus.progress + '\%';$('bus-icon').style.left = activeBus.progress + '%';
  
  const occ = $('bus-occupancy-badge');
  occ.textContent = activeBus.occupancy + ' Occupancy';
  occ.className = `text-white font-bold text-xs px-2.5 py-1 rounded-lg inline-block mt-0.5 ${
    activeBus.occupancy === 'High' ? 'bg-rose-500' : activeBus.occupancy === 'Medium' ? 'bg-amber-500' : 'bg-emerald-500'
  }`;
}

function selectBus(id) { activeBus = busRoutes.find(b => b.id === id); renderBus(); }
function simulateDriverMove() {
  activeBus.progress = (activeBus.progress + 15) % 100;
  renderBus();
  toast('📍 Driver location updated');
}
function updateSeatRadar(color) {
  const occMap = { green: 'Low', yellow: 'Medium', red: 'High' };
  activeBus.occupancy = occMap[color];
  renderBus();
  toast('Seat occupancy reported!');
}

/* ---------- Hostel Login & Outpass ---------- */
let isHostelLoggedIn = load('hostel_login', false);

function checkHostelAuth() {
  $('hostel-login-box').classList.toggle('hidden', isHostelLoggedIn);$('hostel-dashboard').classList.toggle('hidden', !isHostelLoggedIn);
}

function loginHostel() {
  const id = $('hostel-id').value, pass =$('hostel-pass').value;
  if (id === 'HST101' && pass === 'hostel123') {
    isHostelLoggedIn = true; save('hostel_login', true);
    checkHostelAuth(); toast('Logged into Hostel Portal');
  } else toast('Invalid Credentials');
}

function logoutHostel() {
  isHostelLoggedIn = false; save('hostel_login', false);
  checkHostelAuth(); toast('Logged out');
}

function requestOutpass() {
  const reason = $('outpass-reason').value.trim();
  if (!reason) { toast('Please enter a reason'); return; }
  $('outpass-status').textContent = 'Approved (Valid for 24h)';
  makeQR($('qrcode-outpass'), 'CAMPUS_NEX_OUTPASS_HST101_' + Date.now(), 120);
  toast('Outpass generated successfully!');
}

function submitMaintenance() {
  const val = $('maintenance-issue').value.trim();
  if (!val) return;
  const li = document.createElement('li');
  li.textContent = `• ${val} (Pending)`;
  $('ticket-list').appendChild(li);$('maintenance-issue').value = '';
  toast('Ticket submitted');
}

function bookLaundry() {
  $('laundry-text').textContent = 'Block A, Machine #2 (Booked by you)';
  $('laundry-btn').disabled = true;
  $('laundry-btn').className = 'bg-slate-300 text-slate-500 px-3 py-1.5 rounded-lg font-semibold cursor-not-allowed';
  toast('Laundry slot reserved');
}

/* ---------- Timetable ---------- */
function loadTimetable() {
  const dept = $('select-dept').value;
  const sec = $('select-section').value;
  $('timetable-result').innerHTML = `
    <div class="p-4 bg-slate-50 rounded-2xl border border-slate-100 text-xs space-y-2">
      <p class="font-bold text-slate-800">${dept} — ${sec}</p>
      <div class="grid grid-cols-2 sm:grid-cols-4 gap-2 text-slate-600 mt-2">
        <div class="bg-white p-2.5 rounded-xl border border-slate-200"><strong>08:30 AM</strong><br>Data Structures (Lab 3)</div>
        <div class="bg-white p-2.5 rounded-xl border border-slate-200"><strong>10:15 AM</strong><br>OS & Architecture (LH 201)</div>
        <div class="bg-white p-2.5 rounded-xl border border-slate-200"><strong>01:00 PM</strong><br>Discrete Maths (LH 104)</div>
        <div class="bg-white p-2.5 rounded-xl border border-slate-200"><strong>02:45 PM</strong><br>Web Dev Project (Lab 1)</div>
      </div>
    </div>
  `;
}

/* ---------- PDF Generator ---------- */
function generatePDF(type) {
  const code = $('pdf-code-input').value.trim();
  if (!code) { toast('Please paste text or code first'); return; }
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF();
  doc.setFontSize(16);
  doc.text(type === 'assignment' ? 'CAMPUS NEX Assignment Submission' : 'CAMPUS NEX Exam Summary', 14, 20);
  doc.setFontSize(10);
  const lines = doc.splitTextToSize(code, 180);
  doc.text(lines, 14, 30);
  doc.save(`${type}_export.pdf`);
  toast('PDF downloaded');
}

/* ---------- Chat ---------- */
let chatData = load('chats', [
  { text: 'Has anyone submitted the Web Dev assignment?', sec: 'Section C', course: 'CSE Core', year: '1st Year', time: '10:15 AM' }
]);

function filterChat() {
  const yr = $('chat-year').value, crs = $('chat-course').value, sec =$('chat-sec').value;
  $('chat-filter-badge').textContent = `${yr} | ${crs} | ${sec}`;
  const filtered = chatData.filter(c => c.year === yr && c.course === crs && c.sec === sec);
  $('chat-messages').innerHTML = filtered.map(m => `
    <div class="bg-white p-2.5 rounded-xl border border-slate-200 space-y-1">
      <p class="text-slate-800">${esc(m.text)}</p>
      <span class="text-[9px] text-slate-400 block text-right">${m.time}</span>
    </div>
  `).join('');
}

function sendChatMessage() {
  const inp = $('chat-input'), txt = inp.value.trim();
  if (!txt) return;
  chatData.push({
    text: txt,
    year: $('chat-year').value,
    course: $('chat-course').value,
    sec: $('chat-sec').value,
    time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  });
  save('chats', chatData);
  inp.value = '';
  filterChat();
}

/* ---------- Finance / Ledger ---------- */
let ledger = load('ledger', [
  { cat: 'Tuition', desc: 'Semester 1 Partial Dues', amt: 45000, method: 'Net Banking', date: '2026-09-10', receipt: null }
]);

function renderLedger() {
  const tbody = $('ledger-tbody');
  let tot = 0;
  tbody.innerHTML = ledger.map((item, idx) => {
    tot += Number(item.amt);
    return `
      <tr>
        <td class="p-3 font-semibold text-slate-900">${esc(item.cat)}</td>
        <td class="p-3 text-slate-600">${esc(item.desc || '—')}</td>
        <td class="p-3 text-slate-500">${item.date}</td>
        <td class="p-3 text-slate-500">${item.method}</td>
        <td class="p-3 font-bold text-slate-900">${inr(item.amt)}</td>
        <td class="p-3">${item.receipt ? `<button onclick="viewPhoto('${item.receipt}',${idx})" class="text-orange-600 underline">View</button>` : `<button onclick="attachReceipt(${idx})" class="text-slate-400 hover:text-slate-600">+ Add</button>`}</td>
        <td class="p-3"><button onclick="deleteExpense(${idx})" class="text-rose-500 font-bold">✕</button></td>
      </tr>
    `;
  }).join('');
  $('ledger-total').textContent = inr(tot);$('receipt-count').textContent = ledger.filter(i => i.receipt).length;
}

function toggleExpenseForm() { $('expense-form').classList.toggle('hidden'); }

function addExpense(e) {
  e.preventDefault();
  addExpenseDirect($('exp-cat').value, $('exp-desc').value, $('exp-amt').value, $('exp-method').value);$('expense-form').reset();
  toggleExpenseForm();
}

function addExpenseDirect(cat, desc, amt, method) {
  ledger.push({ cat, desc, amt, method, date: new Date().toISOString().split('T')[0], receipt: null });
  save('ledger', ledger);
  renderLedger();
  toast('Expense recorded');
}

function deleteExpense(idx) { ledger.splice(idx, 1); save('ledger', ledger); renderLedger(); }

let activeReceiptIdx = null;
function attachReceipt(idx) {
  pickImage(800, d => { ledger[idx].receipt = d; save('ledger', ledger); renderLedger(); toast('Receipt saved'); });
}

function viewPhoto(src, idx) {
  activeReceiptIdx = idx;
  $('photo-big').src = src;
  $('photo-modal').classList.remove('hidden');$('photo-modal').classList.add('flex');
}

function closePhoto() { $('photo-modal').classList.add('hidden');$('photo-modal').classList.remove('flex'); }
function replaceReceipt() { if (activeReceiptIdx !== null) attachReceipt(activeReceiptIdx); closePhoto(); }
function removeReceipt() { if (activeReceiptIdx !== null) { ledger[activeReceiptIdx].receipt = null; save('ledger', ledger); renderLedger(); } closePhoto(); }

/* ---------- Student Tools ---------- */
function calcAttendance() {
  const a = Number($('att-a').value), h = Number($('att-h').value), t = Number($('att-t').value);
  if (!h || a > h) { $('att-out').textContent = 'Enter valid classes attended and held.'; return; }
  const pct = ((a / h) * 100).toFixed(1);
  if (pct >= t) {
    const safeBunk = Math.floor((a - (t / 100) * h) / (t / 100));
    $('att-out').textContent = `Current: ${pct}%. You are safe! You can bunk ~${safeBunk} more class(es).`;
  } else {
    const need = Math.ceil(((t / 100) * h - a) / (1 - t / 100));
    $('att-out').textContent = `Current: ${pct}%. Warning! You need to attend the next ${need} class(es) straight.`;
  }
}

let courses = load('courses', [{ name: 'Data Structures', pts: 9, cr: 4 }, { name: 'OS', pts: 8, cr: 3 }]);
function renderGPA() {
  $('course-rows').innerHTML = courses.map((c, i) => `
    <div class="flex gap-2 items-center">
      <input type="text" value="${esc(c.name)}" onchange="updateCourse(${i},'name',this.value)" class="flex-1 px-3 py-1.5 rounded-xl border text-xs">
      <select onchange="updateCourse(${i},'pts',this.value)" class="px-2 py-1.5 rounded-xl border text-xs bg-white">
        <option value="10" ${c.pts == 10 ? 'selected' : ''}>O</option>
        <option value="9" ${c.pts == 9 ? 'selected' : ''}>A+</option>
        <option value="8" ${c.pts == 8 ? 'selected' : ''}>A</option>
        <option value="7" ${c.pts == 7 ? 'selected' : ''}>B+</option>
        <option value="6" ${c.pts == 6 ? 'selected' : ''}>B</option>
      </select>
      <input type="number" value="${c.cr}" min="1" onchange="updateCourse(${i},'cr',this.value)" class="w-14 px-2 py-1.5 rounded-xl border text-xs">
      <button onclick="removeCourse(${i})" class="text-rose-500 font-bold px-1">✕</button>
    </div>
  `).join('');
  
  let totPts = 0, totCr = 0;
  courses.forEach(c => { totPts += c.pts * c.cr; totCr += Number(c.cr); });
  const gpa = totCr ? (totPts / totCr).toFixed(2) : '0.00';
  $('gpa-out').textContent = `GPA: ${gpa}`;
}

function addCourse() { courses.push({ name: 'New Subject', pts: 8, cr: 3 }); save('courses', courses); renderGPA(); }
function updateCourse(i, k, v) { courses[i][k] = k === 'name' ? v : Number(v); save('courses', courses); renderGPA(); }
function removeCourse(i) { courses.splice(i, 1); save('courses', courses); renderGPA(); }

/* Countdown & Todo */
let exams = load('exams', []);
function renderExams() {
  $('exam-list').innerHTML = exams.map((ex, i) => `
    <li class="flex justify-between p-2.5 bg-slate-50 rounded-xl border">
      <span><strong>${esc(ex.name)}</strong> (${ex.date})</span>
      <button onclick="deleteExam(${i})" class="text-rose-500 font-bold">✕</button>
    </li>
  `).join('');
}
function addExam() {
  const n = $('exam-name').value, d =$('exam-date').value;
  if (!n || !d) return;
  exams.push({ name: n, date: d }); save('exams', exams); renderExams();
  $('exam-name').value = '';$('exam-date').value = '';
}
function deleteExam(i) { exams.splice(i, 1); save('exams', exams); renderExams(); }

let todos = load('todos', []);
function renderTodos() {
  $('todo-list').innerHTML = todos.map((td, i) => `
    <li class="flex justify-between p-2.5 bg-slate-50 rounded-xl border">
      <span class="${td.done ? 'line-through text-slate-400' : ''}" onclick="toggleTodo(${i})">${esc(td.text)}</span>
      <button onclick="deleteTodo(${i})" class="text-rose-500 font-bold">✕</button>
    </li>
  `).join('');
}
function addTodo() {
  const t = $('todo-text').value.trim();
  if (!t) return;
  todos.push({ text: t, done: false }); save('todos', todos); renderTodos();
  $('todo-text').value = '';
}
function toggleTodo(i) { todos[i].done = !todos[i].done; save('todos', todos); renderTodos(); }
function deleteTodo(i) { todos.splice(i, 1); save('todos', todos); renderTodos(); }

/* ---------- Submit Ideas ---------- */
let ideas = load('ideas', []);
function renderIdeas() {
  $('idea-list').innerHTML = ideas.map(id => `
    <div class="p-3 bg-orange-50/50 rounded-2xl border border-orange-100 text-xs space-y-1">
      <p class="font-bold text-orange-950">${esc(id.title)} <span class="text-[10px] bg-orange-200 text-orange-900 px-2 py-0.5 rounded-full ml-1">${esc(id.cat)}</span></p>
      <p class="text-slate-600">${esc(id.desc)}</p>
    </div>
  `).join('');
}
function submitNewIdea() {
  const t = $('new-title').value.trim(), c = $('new-category').value, d =$('new-desc').value.trim();
  if (!t || !d) { toast('Please complete all fields'); return; }
  ideas.push({ title: t, cat: c, desc: d });
  save('ideas', ideas);
  renderIdeas();
  $('new-title').value = '';$('new-desc').value = '';
  toast('Campus idea added!');
}

/* ---------- Init ---------- */
window.addEventListener('DOMContentLoaded', () => {
  renderAvatar();
  switchTab(load('tab', 'canteen'));
  renderCanteen(false);
  renderBus();
  checkHostelAuth();
  loadTimetable();
  filterChat();
  renderLedger();
  renderGPA();
  renderExams();
  renderTodos();
  renderIdeas();
});