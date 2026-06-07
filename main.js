/* ═══════════════════════════════════════════
   TISCORD v3.0 — main.js
   ═══════════════════════════════════════════ */
'use strict';

/* ══════════════════════════════
   DATABASE
   Hybrid: Firebase (if configured) + localStorage fallback
══════════════════════════════ */
const STORE_KEY = 'tiscord_v3';

let DB = { users: {}, servers: {}, logs: [], version: 3 };

function saveDB() {
  try { localStorage.setItem(STORE_KEY, JSON.stringify(DB)); } catch (e) {}
}

function loadDB() {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed?.version >= 2) DB = parsed;
      if (!DB.version || DB.version < 3) DB.version = 3;
    }
  } catch (e) {}

  // Always ensure owner account exists
  if (!DB.users['hosennujq2']) {
    DB.users['hosennujq2'] = {
      password: 'qwaszx1202', display: 'هوسن',
      tag: '#0001', role: 'owner', avatar: '👑',
      status: 'online', joinDate: new Date().toISOString(),
      email: '', bio: '', theme: 'dark'
    };
  }
  if (!DB.servers) DB.servers = {};
  if (!DB.logs)    DB.logs    = [];
  saveDB();
}

/* ══════════════════════════════
   STATE
══════════════════════════════ */
let me            = null;
let activeServer  = null;
let activeChannel = null;
let showMembers   = true;
let adminTab      = 'overview';
let settingsTab   = 'profile';
let replyTo       = null;
let typingTimer   = null;
let unsubMessages = null;   // Firestore listener cleanup

/* ══════════════════════════════
   HELPERS
══════════════════════════════ */
function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2); }
function esc(s) { return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }

function fmtTime(iso) {
  return new Date(iso).toLocaleTimeString('ar-SA', { hour:'2-digit', minute:'2-digit' });
}
function fmtDate(iso) { return new Date(iso).toLocaleDateString('ar-SA'); }
function fmtRelTime(iso) {
  const diff = Date.now() - new Date(iso).getTime();
  if (diff < 60000) return 'الآن';
  if (diff < 3600000) return `منذ ${Math.floor(diff/60000)} دقيقة`;
  if (diff < 86400000) return `منذ ${Math.floor(diff/3600000)} ساعة`;
  return fmtDate(iso);
}

function toast(msg, type = 'ok') {
  const c = document.getElementById('toastContainer');
  const t = document.createElement('div');
  t.className = `toast ${type}`;
  t.textContent = msg;
  c.appendChild(t);
  setTimeout(() => { t.style.opacity = '0'; t.style.transform = 'translateY(8px)'; t.style.transition = '.3s'; }, 2800);
  setTimeout(() => t.remove(), 3200);
}

function addLog(serverId, action, by, target = '') {
  const entry = { id:uid(), action, by, target, time: new Date().toISOString() };
  DB.logs.unshift(entry);
  if (DB.logs.length > 500) DB.logs.pop();
  if (serverId && DB.servers[serverId]) {
    if (!DB.servers[serverId].logs) DB.servers[serverId].logs = [];
    DB.servers[serverId].logs.unshift(entry);
    if (DB.servers[serverId].logs.length > 200) DB.servers[serverId].logs.pop();
  }
  saveDB();
}

const ROLE_ORDER = ['owner','leader','manager','admin-mgr','head','super','helper','user'];
function roleIndex(r)  { const i = ROLE_ORDER.indexOf(r); return i === -1 ? 7 : i; }
function canManage(a, b) { return roleIndex(a) < roleIndex(b); }
function isStaff(r)    { return roleIndex(r) < 7; }

function roleLabel(r) {
  return { owner:'أونر', leader:'ليدر', manager:'مانجر', 'admin-mgr':'أدمن مانجر',
           head:'هيد أدمن', super:'سوبر أدمن', helper:'هيلبر', user:'' }[r] || '';
}
function roleCls(r) {
  return { owner:'owner', leader:'leader', manager:'manager', 'admin-mgr':'admin-mgr',
           head:'head', super:'super', helper:'helper', user:'user' }[r] || 'user';
}
function badge(r) {
  const lbl = roleLabel(r);
  if (!lbl) return '';
  return `<span class="role-badge rb-${roleCls(r)}">${lbl}</span>`;
}

function avatarColor(username) {
  const palette = ['#5865f2','#3ba55c','#ed4245','#faa61a','#9b59b6',
                   '#3498db','#1abc9c','#e74c3c','#e67e22','#16a085'];
  let h = 0;
  for (let i = 0; i < username.length; i++) h = (h + username.charCodeAt(i)) % palette.length;
  return palette[h];
}

function myServerRole(sid) {
  const sv = DB.servers[sid];
  if (!sv) return 'user';
  const u = DB.users[me?.username];
  if (u?.role === 'owner') return 'owner';
  if (sv.owner === me?.username) return 'owner';
  return sv.members?.[me?.username]?.role || 'user';
}

function togglePass(inputId, btn) {
  const el = document.getElementById(inputId);
  if (!el) return;
  el.type = el.type === 'password' ? 'text' : 'password';
  btn.textContent = el.type === 'password' ? '👁️' : '🙈';
}

function checkPassStrength(pass) {
  const el = document.getElementById('passStrength');
  if (!el) return;
  if (!pass) { el.className = 'pass-strength'; return; }
  let score = 0;
  if (pass.length >= 8) score++;
  if (/[A-Z]/.test(pass) || /[a-z]/.test(pass)) score++;
  if (/[0-9]/.test(pass)) score++;
  if (/[^A-Za-z0-9]/.test(pass)) score++;
  if (score <= 1) el.className = 'pass-strength weak';
  else if (score <= 2) el.className = 'pass-strength medium';
  else el.className = 'pass-strength strong';
}

function processMessageText(text) {
  // Convert URLs to links
  return esc(text).replace(
    /https?:\/\/[^\s<>"]+/gi,
    url => `<a href="${url}" target="_blank" rel="noopener noreferrer">${url}</a>`
  );
}

/* ══════════════════════════════
   EMOJI PICKER
══════════════════════════════ */
const EMOJIS = ['😀','😂','🥰','😍','🤔','😭','😤','🔥','❤️','✨','🎉','👏','🙏','💯','🎮',
                '👍','👎','😊','🤣','😅','😱','🤯','😴','🤗','😎','🤩','😏','🙄','😒','😔',
                '🌟','💪','🏆','🎯','💡','🚀','⚡','🌈','💎','🦋','🌸','🍕','🎵','📱','💻',
                '🔑','🎁','🎈','🎊','🎆','❄️','🌙','☀️','⭐','🌍','🦁','🐯','🦊','🐺','🦅'];

function toggleEmojiPicker() {
  const picker = document.getElementById('emojiPicker');
  if (picker.classList.contains('hidden')) {
    picker.innerHTML = EMOJIS.map(e =>
      `<div class="emoji-item" onclick="insertEmoji('${e}')">${e}</div>`
    ).join('');
    picker.classList.remove('hidden');
  } else {
    picker.classList.add('hidden');
  }
}

function insertEmoji(emoji) {
  const input = document.getElementById('chatInputEl');
  if (!input) return;
  const pos = input.selectionStart;
  const val = input.value;
  input.value = val.slice(0, pos) + emoji + val.slice(pos);
  input.focus();
  input.setSelectionRange(pos + emoji.length, pos + emoji.length);
  document.getElementById('emojiPicker').classList.add('hidden');
}

// Close emoji picker on outside click
document.addEventListener('click', (e) => {
  const picker = document.getElementById('emojiPicker');
  if (picker && !picker.contains(e.target) && !e.target.classList.contains('emoji-btn')) {
    picker.classList.add('hidden');
  }
});

/* ══════════════════════════════
   AUTH
══════════════════════════════ */
function switchAuthTab(tab) {
  document.getElementById('loginForm').classList.toggle('hidden', tab !== 'login');
  document.getElementById('registerForm').classList.toggle('hidden', tab !== 'register');
  document.querySelectorAll('.auth-tab').forEach((el, i) =>
    el.classList.toggle('active', (tab === 'login' && i === 0) || (tab === 'register' && i === 1))
  );
}

async function doGoogleLogin() {
  const fb = window._firebase;
  if (!fb?.ready) {
    toast('⚠️ Firebase غير مفعّل — راجع إعداد Firebase', 'err');
    showFirebaseSetupNotice();
    return;
  }
  try {
    const provider = new fb.GoogleAuthProvider();
    const result = await fb.signInWithPopup(fb.auth, provider);
    const user = result.user;
    await handleFirebaseUser(user, true);
  } catch (err) {
    toast('❌ فشل تسجيل الدخول بجوجل', 'err');
    console.error(err);
  }
}

async function handleFirebaseUser(firebaseUser, isGoogle = false) {
  const uid = firebaseUser.uid;
  const fb  = window._firebase;
  const username = isGoogle ? `g_${uid.slice(0,8)}` : uid.slice(0,12);

  // Check if user doc exists
  let userDoc = null;
  try {
    const ref = fb.doc(fb.db, 'users', uid);
    const snap = await fb.getDoc(ref);
    if (snap.exists()) {
      userDoc = snap.data();
    } else {
      // Create new user doc
      userDoc = {
        uid, username,
        display: firebaseUser.displayName || username,
        email: firebaseUser.email || '',
        tag: '#' + String(Math.floor(Math.random() * 9999)).padStart(4,'0'),
        role: 'user', avatar: '😀', status: 'online',
        joinDate: new Date().toISOString(), theme: 'dark',
        photoURL: firebaseUser.photoURL || ''
      };
      await fb.setDoc(ref, userDoc);
    }
  } catch (e) {
    console.error('Firestore error', e);
    // Fallback to localStorage
    if (!DB.users[username]) {
      DB.users[username] = {
        password: uid, display: firebaseUser.displayName || username,
        tag: '#GOOG', role: 'user', avatar: '😀', status: 'online',
        joinDate: new Date().toISOString(), email: firebaseUser.email || ''
      };
      saveDB();
    }
    me = { username, ...DB.users[username] };
    bootApp();
    return;
  }

  me = { username: uid, ...userDoc };
  bootApp();
}

function doLogin() {
  const u = document.getElementById('loginUser').value.trim().toLowerCase();
  const p = document.getElementById('loginPass').value;
  const errEl = document.getElementById('loginError');
  const user = DB.users[u];

  if (!user || user.password !== p) {
    showErr(errEl, '❌ اسم المستخدم أو كلمة المرور غلط');
    document.getElementById('loginPass').value = '';
    document.querySelector('#loginForm input').focus();
    return;
  }
  errEl.style.display = 'none';
  DB.users[u].status = 'online';
  saveDB();
  me = { username: u, ...DB.users[u] };
  addLog(null, 'تسجيل دخول', u);
  bootApp();
}

function doRegister() {
  const u    = document.getElementById('regUser').value.trim().toLowerCase();
  const disp = document.getElementById('regDisplay').value.trim();
  const email = document.getElementById('regEmail').value.trim();
  const p    = document.getElementById('regPass').value;
  const errEl = document.getElementById('regError');

  if (!u || !disp || !p) { showErr(errEl, '❌ يرجى ملء جميع الحقول'); return; }
  if (u.length < 3)      { showErr(errEl, '❌ اسم المستخدم قصير جداً (3 أحرف على الأقل)'); return; }
  if (!/^[a-z0-9_]+$/.test(u)) { showErr(errEl, '❌ اسم المستخدم يجب أن يحتوي على أحرف إنجليزية وأرقام فقط'); return; }
  if (p.length < 6)      { showErr(errEl, '❌ كلمة المرور قصيرة جداً (6 أحرف على الأقل)'); return; }
  if (DB.users[u])       { showErr(errEl, '❌ اسم المستخدم مستخدم بالفعل'); return; }

  const tag = '#' + String(Object.keys(DB.users).length + 1).padStart(4, '0');
  DB.users[u] = {
    password: p, display: disp, tag, email,
    role: 'user', avatar: '😀', status: 'online',
    joinDate: new Date().toISOString(), theme: 'dark', bio: ''
  };
  saveDB();
  me = { username: u, ...DB.users[u] };
  addLog(null, 'تسجيل حساب', u);
  bootApp();
}

function showErr(el, msg) {
  el.textContent = msg;
  el.style.display = 'block';
  el.style.animation = 'none';
  el.offsetHeight; // reflow
  el.style.animation = 'slideUp .3s ease';
}

function doLogout() {
  if (me) { DB.users[me.username] && (DB.users[me.username].status = 'offline'); saveDB(); }
  if (unsubMessages) { unsubMessages(); unsubMessages = null; }
  const fb = window._firebase;
  if (fb?.ready && fb.auth?.currentUser) {
    fb.signOut(fb.auth).catch(() => {});
  }
  me = null; activeServer = null; activeChannel = null;
  document.getElementById('app').classList.add('hidden');
  document.getElementById('authPage').classList.remove('hidden');
  document.getElementById('loginUser').value = '';
  document.getElementById('loginPass').value = '';
}

function showFirebaseSetupNotice() {
  // Show in auth form area
  const wrap = document.querySelector('.auth-wrap');
  const existing = wrap.querySelector('.firebase-notice');
  if (existing) return;
  const notice = document.createElement('div');
  notice.className = 'firebase-notice';
  notice.innerHTML = `
    ⚠️ <strong>Firebase غير مفعّل</strong><br>
    لتفعيل Google Login وحفظ البيانات على الإنترنت:<br>
    1. اذهب إلى <a href="https://console.firebase.google.com" target="_blank">console.firebase.google.com</a><br>
    2. أنشئ مشروع جديد<br>
    3. فعّل <code>Authentication > Google</code><br>
    4. فعّل <code>Firestore Database</code><br>
    5. انسخ الـ config واستبدله في <code>index.html</code><br>
    <em>الآن يعمل بالتخزين المحلي فقط ✓</em>
  `;
  wrap.insertBefore(notice, wrap.firstChild);
}

/* ══════════════════════════════
   APP BOOT
══════════════════════════════ */
function bootApp() {
  document.getElementById('authPage').classList.add('hidden');
  document.getElementById('app').classList.remove('hidden');
  applyTheme(DB.users[me.username]?.theme || 'dark');
  refreshUserBar();
  renderRail();
  openHome();
  toast(`أهلاً، ${me.display || DB.users[me.username]?.display}! 👋`);
}

function refreshUserBar() {
  const u = DB.users[me.username];
  if (!u) return;
  const display = u.display;
  document.getElementById('barName').textContent = display;
  document.getElementById('barTag').textContent  = u.tag;
  const av = document.getElementById('barAvatar');
  av.style.background = avatarColor(me.username);
  if (u.photoURL) {
    av.innerHTML = `<img src="${u.photoURL}" style="width:100%;height:100%;border-radius:50%;object-fit:cover"><div class="u-status online" id="barStatus"></div>`;
  } else {
    av.innerHTML = `<span id="barAvLetter">${(u.avatar || display[0]).slice(0,2)}</span><div class="u-status online" id="barStatus"></div>`;
  }
}

function applyTheme(theme) {
  document.body.classList.toggle('theme-light', theme === 'light');
  document.body.classList.toggle('theme-dark', theme !== 'light');
}

/* ══════════════════════════════
   SERVER RAIL
══════════════════════════════ */
function renderRail() {
  const cont = document.getElementById('railServers');
  cont.innerHTML = '';
  Object.entries(DB.servers).forEach(([sid, sv]) => {
    if (!sv.members?.[me.username]) return;
    const el = document.createElement('div');
    el.className = 's-icon' + (activeServer === sid ? ' active' : '');
    el.title = sv.name;
    el.innerHTML = `${esc(sv.emoji || sv.name[0])}<div class="server-pip"></div>`;
    el.onclick = () => openServer(sid);
    cont.appendChild(el);
  });
  // Update home button
  document.getElementById('homeBtn')?.classList.toggle('active', !activeServer);
}

/* ══════════════════════════════
   SCREENS
══════════════════════════════ */
function showScreen(id) {
  ['homeScreen','chatScreen','adminScreen'].forEach(s => {
    const el = document.getElementById(s);
    if (!el) return;
    el.classList.toggle('hidden', s !== id);
    el.style.display = s === id ? 'flex' : 'none';
  });
}

/* ══════════════════════════════
   HOME
══════════════════════════════ */
function openHome() {
  activeServer = null; activeChannel = null;
  renderRail();
  document.getElementById('srvHeader').innerHTML = '<span>🏠 الرئيسية</span>';
  document.getElementById('chScroll').innerHTML = `
    <div class="ch-item" onclick="openModal('createServerModal')"><span class="ch-sym">➕</span> إنشاء سيرفر</div>
    <div class="ch-item" onclick="openModal('joinServerModal')"><span class="ch-sym">🔗</span> الانضمام بكود</div>
  `;
  document.getElementById('membersPanel').innerHTML = '';
  showScreen('homeScreen');

  // Restore home screen
  const hs = document.getElementById('homeScreen');
  hs.innerHTML = `
    <div class="home-logo">🎮</div>
    <h1 class="home-title">أهلاً في Tiscord!</h1>
    <p class="home-sub">ابدأ بإنشاء سيرفر جديد أو انضم لسيرفر موجود</p>
    <div class="home-actions">
      <button class="btn btn-accent" onclick="openModal('createServerModal')">➕ إنشاء سيرفر</button>
      <button class="btn btn-ghost"  onclick="openModal('joinServerModal')">🔗 الانضمام بكود</button>
    </div>
    <div class="home-features">
      <div class="feat-card"><div class="feat-icon">💬</div><div class="feat-text">محادثات نصية</div></div>
      <div class="feat-card"><div class="feat-icon">🔊</div><div class="feat-text">قنوات صوتية</div></div>
      <div class="feat-card"><div class="feat-icon">📢</div><div class="feat-text">إعلانات</div></div>
      <div class="feat-card"><div class="feat-icon">👥</div><div class="feat-text">إدارة الأعضاء</div></div>
    </div>
  `;
}

/* ══════════════════════════════
   SERVER
══════════════════════════════ */
function openServer(sid) {
  const sv = DB.servers[sid];
  if (!sv) return;
  activeServer = sid; activeChannel = null;
  renderRail();
  const myRole = myServerRole(sid);
  document.getElementById('srvHeader').innerHTML =
    `<span>${esc(sv.emoji || '🎮')} ${esc(sv.name)}</span><span class="chevron">▾</span>`;
  renderChannels(sid);
  renderMembers(sid);

  // Mobile: open channel panel
  openMobileChannelPanel();

  showScreen('homeScreen');
  const hs = document.getElementById('homeScreen');
  hs.style.flexDirection = 'column';
  hs.style.alignItems = 'center';
  hs.style.justifyContent = 'center';
  hs.innerHTML = `
    <div style="font-size:56px;margin-bottom:12px">${esc(sv.emoji || '🎮')}</div>
    <h1 class="home-title">${esc(sv.name)}</h1>
    <p class="home-sub">${esc(sv.desc || 'مرحباً في ' + sv.name)}</p>
    <div style="display:flex;align-items:center;gap:12px;background:var(--bg-card);border:1px solid var(--border);border-radius:12px;padding:12px 20px;margin-top:12px">
      <span style="font-size:13px;color:var(--text-3)">كود الدعوة:</span>
      <span style="font-family:monospace;font-size:20px;color:var(--accent);font-weight:700;letter-spacing:4px">${sv.inviteCode}</span>
      <button class="btn btn-ghost btn-sm" onclick="copyText('${sv.inviteCode}')">📋 نسخ</button>
    </div>
    ${isStaff(myRole) ? `<button class="btn btn-accent" style="margin-top:16px" onclick="openAdminPanel('${sid}')">⚙️ لوحة الإدارة</button>` : ''}
  `;
}

function renderChannels(sid) {
  const sv = DB.servers[sid];
  if (!sv) return;
  const myRole = myServerRole(sid);
  const cats = {};
  sv.channels.forEach(ch => {
    const cat = ch.category || 'القنوات';
    if (!cats[cat]) cats[cat] = [];
    cats[cat].push(ch);
  });
  let html = '';
  Object.entries(cats).forEach(([cat, chs]) => {
    html += `<div class="ch-cat">
      <span>${esc(cat)}</span>
      ${isStaff(myRole) ? `<span class="add-ch" onclick="openAddChannel('${sid}','${esc(cat)}')" title="إضافة قناة">＋</span>` : ''}
    </div>`;
    chs.forEach(ch => {
      if (ch.private && !isStaff(myRole)) return;
      const sym = ch.type === 'voice' ? '🔊' : ch.type === 'announce' ? '📢' : '#';
      const isActive = activeChannel === ch.id;
      html += `<div class="ch-item${isActive ? ' active' : ''}${ch.private ? ' private' : ''}" 
        onclick="openChannel('${sid}','${ch.id}')">
        <span class="ch-sym">${sym}</span>
        <span class="grow ellipsis">${esc(ch.name)}</span>
      </div>`;
    });
  });
  if (isStaff(myRole)) {
    html += `<div class="ch-admin-link" onclick="openAdminPanel('${sid}')">⚙️ لوحة الإدارة</div>`;
  }
  document.getElementById('chScroll').innerHTML = html;
}

function renderMembers(sid) {
  const sv = DB.servers[sid];
  const panel = document.getElementById('membersPanel');
  if (!showMembers || !sv) { panel.innerHTML = ''; return; }

  const grouped = {};
  ROLE_ORDER.forEach(r => grouped[r] = []);
  Object.entries(sv.members).forEach(([uname, m]) => {
    const u = DB.users[uname];
    if (!u) return;
    const r = u.role === 'owner' ? 'owner' : (m.role || 'user');
    if (!grouped[r]) grouped[r] = [];
    grouped[r].push({ uname, u, r });
  });

  const catNames = { owner:'الأونر', leader:'الليدر', manager:'المانجر', 'admin-mgr':'أدمن مانجر',
                     head:'هيد أدمن', super:'سوبر أدمن', helper:'الهيلبر', user:'الأعضاء' };
  let html = `<div class="members-title">الأعضاء — ${Object.keys(sv.members).length}</div>`;
  ROLE_ORDER.forEach(r => {
    if (!grouped[r]?.length) return;
    html += `<div class="m-cat">${catNames[r] || r} — ${grouped[r].length}</div>`;
    grouped[r].forEach(({ uname, u, r: role }) => {
      const status = u.status || 'offline';
      html += `<div class="m-item" onclick="showProfile('${uname}')">
        <div class="m-avatar" style="background:${avatarColor(uname)}">
          ${u.photoURL ? `<img src="${u.photoURL}" style="width:100%;height:100%;border-radius:50%;object-fit:cover">` : `<span>${esc((u.avatar || u.display[0]).slice(0,2))}</span>`}
          <div class="m-status ${status}"></div>
        </div>
        <div>
          <div class="m-nick rc-${roleCls(role)}">${esc(u.display)}</div>
          ${roleLabel(role) ? `<div class="m-role-label">${roleLabel(role)}</div>` : ''}
        </div>
      </div>`;
    });
  });
  panel.innerHTML = html;
}

function toggleMembersPanel() {
  showMembers = !showMembers;
  const panel = document.getElementById('membersPanel');
  if (activeServer) renderMembers(activeServer);
  else panel.innerHTML = '';
  
  // Mobile
  panel.classList.toggle('open', showMembers);
  if (showMembers && window.innerWidth <= 768) {
    document.getElementById('mobileOverlay').classList.remove('hidden');
  } else if (!showMembers && window.innerWidth <= 768) {
    document.getElementById('mobileOverlay').classList.add('hidden');
  }
}

function openMobileChannelPanel() {
  if (window.innerWidth <= 768) {
    document.getElementById('channelPanel').classList.add('open');
    document.getElementById('mobileOverlay').classList.remove('hidden');
  }
}

function closeMobilePanels() {
  document.getElementById('channelPanel').classList.remove('open');
  document.getElementById('membersPanel').classList.remove('open');
  document.getElementById('mobileOverlay').classList.add('hidden');
}

/* ══════════════════════════════
   CHANNELS / CHAT
══════════════════════════════ */
function openChannel(sid, cid) {
  const sv = DB.servers[sid];
  const ch = sv?.channels.find(c => c.id === cid);
  if (!ch) return;
  if (ch.type === 'voice') { toast('🔊 القنوات الصوتية قريباً!'); return; }

  activeServer = sid; activeChannel = cid;
  showScreen('chatScreen');

  const sym = ch.type === 'announce' ? '📢' : '#';
  document.getElementById('chatSym').textContent   = sym;
  document.getElementById('chatName').textContent  = ch.name;
  document.getElementById('chatDesc').textContent  = ch.category || '';
  document.getElementById('chatInputEl').placeholder = `رسالة في ${ch.name}...`;

  // Reset reply
  clearReply();

  renderMessages();
  renderChannels(sid);
  renderMembers(sid);

  // Close mobile panels
  closeMobilePanels();
}

function renderMessages() {
  const sv = DB.servers[activeServer];
  const ch = sv?.channels.find(c => c.id === activeChannel);
  const inner = document.getElementById('msgsInner');
  if (!ch || !inner) return;

  if (!ch.messages?.length) {
    inner.innerHTML = `<div class="empty" style="margin:auto;padding-top:60px">
      <div class="e-icon">#</div>
      <p>هذا بداية قناة <strong>${esc(ch.name)}</strong></p>
      <p style="font-size:12px;margin-top:8px;color:var(--text-4)">كن أول من يرسل رسالة!</p>
    </div>`;
    return;
  }

  let html = '';
  let lastDate = '';
  ch.messages.forEach(msg => {
    if (msg.type === 'system') {
      html += `<div class="sys-divider">${esc(msg.text)}</div>`;
      return;
    }

    // Date separator
    const msgDate = fmtDate(msg.time);
    if (msgDate !== lastDate) {
      html += `<div class="sys-divider">${msgDate}</div>`;
      lastDate = msgDate;
    }

    const u = DB.users[msg.user] || { display: msg.user, role: 'user' };
    const r = u.role || 'user';
    const isOwn = msg.user === me.username;

    // Reply reference
    let replyHtml = '';
    if (msg.replyTo) {
      const refMsg = ch.messages.find(m => m.id === msg.replyTo);
      if (refMsg) {
        const refUser = DB.users[refMsg.user] || { display: refMsg.user };
        replyHtml = `<div class="msg-reply-ref" onclick="scrollToMsg('${msg.replyTo}')">
          ↩ <strong>${esc(refUser.display)}</strong>: ${esc((refMsg.text||'').slice(0,60))}
        </div>`;
      }
    }

    // Reactions
    let reactHtml = '';
    if (msg.reactions && Object.keys(msg.reactions).length) {
      reactHtml = `<div class="msg-reactions">`;
      Object.entries(msg.reactions).forEach(([emoji, users]) => {
        const mine = users.includes(me.username);
        reactHtml += `<div class="reaction${mine ? ' mine' : ''}" 
          onclick="toggleReaction('${msg.id}','${emoji}')">
          ${emoji} ${users.length}
        </div>`;
      });
      reactHtml += `</div>`;
    }

    // Image content
    let contentHtml = '';
    if (msg.imageUrl) {
      contentHtml = `<img class="msg-image" src="${msg.imageUrl}" alt="صورة" 
        onclick="openImageModal('${msg.imageUrl}')">`;
    } else {
      contentHtml = `<div class="msg-text">${processMessageText(msg.text || '')}</div>`;
    }

    html += `<div class="msg-group${isOwn ? ' own' : ''}" id="msg-${msg.id}" 
      data-msgid="${msg.id}">
      <div class="msg-av" style="background:${avatarColor(msg.user)}" onclick="showProfile('${msg.user}')">
        ${u.photoURL ? `<img src="${u.photoURL}" style="width:100%;height:100%;border-radius:50%;object-fit:cover">` : esc((u.avatar || u.display[0]).slice(0,2))}
      </div>
      <div class="msg-body">
        <div class="msg-meta">
          <span class="msg-author rc-${roleCls(r)}" onclick="showProfile('${msg.user}')">${esc(u.display)}</span>
          ${badge(r)}
          <span class="msg-ts">${fmtRelTime(msg.time)}</span>
        </div>
        ${replyHtml}
        ${contentHtml}
        ${reactHtml}
      </div>
      <div class="msg-actions">
        <button class="msg-act-btn" onclick="setReply('${msg.id}')" title="رد">↩</button>
        <button class="msg-act-btn" onclick="addReactionPicker('${msg.id}')" title="إيموجي">😊</button>
        ${isOwn || isStaff(myServerRole(activeServer)) ? 
          `<button class="msg-act-btn" onclick="deleteMsg('${msg.id}')" title="حذف">🗑️</button>` : ''}
        ${isStaff(myServerRole(activeServer)) ? 
          `<button class="msg-act-btn" onclick="pinMsg('${msg.id}')" title="تثبيت">📌</button>` : ''}
      </div>
    </div>`;
  });

  inner.innerHTML = html;
  const wrap = document.getElementById('msgsWrap');
  wrap.scrollTop = wrap.scrollHeight;
}

function handleChatKey(e) {
  if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMsg(); return; }
  // Auto-resize textarea
  const ta = e.target;
  ta.style.height = 'auto';
  ta.style.height = Math.min(ta.scrollHeight, 120) + 'px';
}

function handleTyping(el) {
  el.style.height = 'auto';
  el.style.height = Math.min(el.scrollHeight, 120) + 'px';
  // Password strength for registration
  if (el.id === 'regPass') checkPassStrength(el.value);
}

function sendMsg() {
  const input = document.getElementById('chatInputEl');
  const text  = input.value.trim();
  if (!text || !activeServer || !activeChannel) return;
  const sv = DB.servers[activeServer];
  const ch = sv?.channels.find(c => c.id === activeChannel);
  if (!ch) return;
  if (!ch.messages) ch.messages = [];

  const msg = {
    id: uid(), user: me.username, text,
    time: new Date().toISOString(),
    reactions: {}
  };
  if (replyTo) { msg.replyTo = replyTo; clearReply(); }

  ch.messages.push(msg);
  if (ch.messages.length > 1000) ch.messages.shift();
  saveDB();
  input.value = '';
  input.style.height = 'auto';
  renderMessages();
}

/* ── Message Actions ── */
function setReply(msgId) {
  const sv = DB.servers[activeServer];
  const ch = sv?.channels.find(c => c.id === activeChannel);
  if (!ch) return;
  const msg = ch.messages.find(m => m.id === msgId);
  if (!msg) return;
  replyTo = msgId;
  const preview = document.getElementById('replyPreview');
  const u = DB.users[msg.user] || { display: msg.user };
  document.getElementById('replyPreviewText').textContent = `الرد على ${u.display}: ${(msg.text||'').slice(0,50)}`;
  preview.classList.remove('hidden');
  document.getElementById('chatInputEl').focus();
}

function clearReply() {
  replyTo = null;
  document.getElementById('replyPreview')?.classList.add('hidden');
}

function deleteMsg(msgId) {
  const sv = DB.servers[activeServer];
  const ch = sv?.channels.find(c => c.id === activeChannel);
  if (!ch) return;
  const idx = ch.messages.findIndex(m => m.id === msgId);
  if (idx === -1) return;
  const msg = ch.messages[idx];
  if (msg.user !== me.username && !isStaff(myServerRole(activeServer))) return;
  ch.messages.splice(idx, 1);
  saveDB();
  addLog(activeServer, 'حذف رسالة', me.username);
  renderMessages();
  toast('🗑️ تم حذف الرسالة');
}

function pinMsg(msgId) {
  const sv = DB.servers[activeServer];
  const ch = sv?.channels.find(c => c.id === activeChannel);
  if (!ch) return;
  const msg = ch.messages.find(m => m.id === msgId);
  if (!msg) return;
  msg.pinned = !msg.pinned;
  saveDB();
  toast(msg.pinned ? '📌 تم تثبيت الرسالة' : '📌 تم إلغاء التثبيت');
  renderMessages();
}

function toggleReaction(msgId, emoji) {
  const sv = DB.servers[activeServer];
  const ch = sv?.channels.find(c => c.id === activeChannel);
  if (!ch) return;
  const msg = ch.messages.find(m => m.id === msgId);
  if (!msg) return;
  if (!msg.reactions) msg.reactions = {};
  if (!msg.reactions[emoji]) msg.reactions[emoji] = [];
  const idx = msg.reactions[emoji].indexOf(me.username);
  if (idx === -1) msg.reactions[emoji].push(me.username);
  else msg.reactions[emoji].splice(idx, 1);
  if (msg.reactions[emoji].length === 0) delete msg.reactions[emoji];
  saveDB();
  renderMessages();
}

function addReactionPicker(msgId) {
  // Quick reaction picker
  const quickEmojis = ['👍','❤️','😂','😮','😢','😡','🔥','✨'];
  const existing = document.getElementById('quickReactPicker');
  if (existing) existing.remove();

  const picker = document.createElement('div');
  picker.id = 'quickReactPicker';
  picker.style.cssText = `position:fixed;z-index:500;background:var(--bg-card);border:1px solid var(--border-2);
    border-radius:12px;padding:8px;display:flex;gap:4px;box-shadow:0 8px 32px rgba(0,0,0,.4)`;
  quickEmojis.forEach(e => {
    const btn = document.createElement('div');
    btn.className = 'emoji-item';
    btn.style.cssText = 'padding:6px;font-size:22px;cursor:pointer;border-radius:8px;transition:background .1s';
    btn.textContent = e;
    btn.onmouseenter = () => btn.style.background = 'var(--bg-hover)';
    btn.onmouseleave = () => btn.style.background = '';
    btn.onclick = () => { toggleReaction(msgId, e); picker.remove(); };
    picker.appendChild(btn);
  });
  document.body.appendChild(picker);

  // Position near the message
  const msgEl = document.getElementById(`msg-${msgId}`);
  if (msgEl) {
    const rect = msgEl.getBoundingClientRect();
    picker.style.top = (rect.top - 60) + 'px';
    picker.style.right = '100px';
  }
  setTimeout(() => document.addEventListener('click', () => picker.remove(), { once: true }), 50);
}

function scrollToMsg(msgId) {
  const el = document.getElementById(`msg-${msgId}`);
  if (el) {
    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    el.style.background = 'var(--accent-glow)';
    setTimeout(() => { el.style.background = ''; }, 1500);
  }
}

/* ── File Upload ── */
function openFileUpload() {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = 'image/*';
  input.onchange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { toast('❌ الصورة أكبر من 5MB', 'err'); return; }
    
    const fb = window._firebase;
    if (fb?.ready && fb.storage) {
      try {
        toast('⏳ جاري الرفع...');
        const ref = fb.storageRef(fb.storage, `images/${uid()}_${file.name}`);
        const snap = await fb.uploadBytes(ref, file);
        const url = await fb.getDownloadURL(snap.ref);
        sendImageMsg(url);
      } catch (e) {
        toast('❌ فشل رفع الصورة', 'err');
        sendLocalImage(file);
      }
    } else {
      sendLocalImage(file);
    }
  };
  input.click();
}

function sendLocalImage(file) {
  const reader = new FileReader();
  reader.onload = (e) => sendImageMsg(e.target.result);
  reader.readAsDataURL(file);
}

function sendImageMsg(imageUrl) {
  if (!activeServer || !activeChannel) return;
  const sv = DB.servers[activeServer];
  const ch = sv?.channels.find(c => c.id === activeChannel);
  if (!ch) return;
  if (!ch.messages) ch.messages = [];
  ch.messages.push({ id:uid(), user:me.username, text:'', imageUrl, time:new Date().toISOString(), reactions:{} });
  saveDB(); renderMessages();
  toast('✅ تم إرسال الصورة!');
}

function openImageModal(src) {
  document.getElementById('imageModalSrc').src = src;
  document.getElementById('imageDownloadBtn').href = src;
  openModal('imageModal');
}

/* ══════════════════════════════
   SEARCH
══════════════════════════════ */
function openSearchModal() {
  openModal('searchModal');
  document.getElementById('searchInput').value = '';
  document.getElementById('searchResults').innerHTML = '';
  document.getElementById('searchInput').focus();
}

function doSearch(query) {
  const container = document.getElementById('searchResults');
  if (!query.trim() || !activeServer) { container.innerHTML = ''; return; }
  const sv = DB.servers[activeServer];
  const results = [];
  sv.channels.forEach(ch => {
    (ch.messages || []).forEach(msg => {
      if (msg.text && msg.text.toLowerCase().includes(query.toLowerCase())) {
        results.push({ ch, msg });
      }
    });
  });
  if (!results.length) {
    container.innerHTML = '<div class="empty"><p>لا توجد نتائج</p></div>';
    return;
  }
  container.innerHTML = results.slice(0, 20).map(({ ch, msg }) => {
    const u = DB.users[msg.user] || { display: msg.user };
    return `<div class="search-hit" onclick="gotoSearchResult('${ch.id}','${msg.id}')">
      <div class="search-hit-user">#${esc(ch.name)} · ${esc(u.display)} · ${fmtDate(msg.time)}</div>
      <div class="search-hit-text">${esc(msg.text.slice(0,120))}</div>
    </div>`;
  }).join('');
}

function gotoSearchResult(cid, msgId) {
  closeModal('searchModal');
  openChannel(activeServer, cid);
  setTimeout(() => scrollToMsg(msgId), 300);
}

/* ══════════════════════════════
   SERVER TEMPLATES
══════════════════════════════ */
const TEMPLATES = {
  gaming:  { name:'سيرفر الألعاب', emoji:'🎮', desc:'جمعنا هنا نلعب!',
    channels:[{n:'عام',t:'text',c:'عام'},{n:'بث-مباشر',t:'text',c:'عام'},{n:'طلبات',t:'text',c:'طلبات'},{n:'صوتي-عام',t:'voice',c:'صوتي'}] },
  study:   { name:'مجموعة الدراسة', emoji:'📚', desc:'نتعلم سوا!',
    channels:[{n:'عام',t:'text',c:'عام'},{n:'مواد',t:'text',c:'دراسة'},{n:'أسئلة',t:'text',c:'دراسة'},{n:'مذاكرة',t:'voice',c:'صوتي'}] },
  friends: { name:'سيرفر الأصدقاء', emoji:'🤝', desc:'أهلاً بأصحابي!',
    channels:[{n:'عام',t:'text',c:'عام'},{n:'صور',t:'text',c:'ترفيه'},{n:'ميمز',t:'text',c:'ترفيه'},{n:'دردشة',t:'voice',c:'صوتي'}] },
  art:     { name:'جاليري الفنون', emoji:'🎨', desc:'اعرض إبداعك!',
    channels:[{n:'عام',t:'text',c:'عام'},{n:'أعمالي',t:'text',c:'فن'},{n:'نقد',t:'text',c:'فن'}] },
  music:   { name:'سيرفر الموسيقى', emoji:'🎵', desc:'نحب الموسيقى!',
    channels:[{n:'عام',t:'text',c:'عام'},{n:'توصيات',t:'text',c:'موسيقى'},{n:'استماع',t:'voice',c:'صوتي'}] },
  custom:  { name:'', emoji:'🎮', desc:'', channels:[] }
};

function selectTemplate(el, key) {
  document.querySelectorAll('.srv-template').forEach(t => t.classList.remove('active'));
  el.classList.add('active');
  const tpl = TEMPLATES[key];
  if (!tpl || key === 'custom') return;
  document.getElementById('newSrvName').value  = tpl.name;
  document.getElementById('newSrvEmoji').value = tpl.emoji;
  document.getElementById('newSrvDesc').value  = tpl.desc;
}

/* ══════════════════════════════
   CREATE SERVER
══════════════════════════════ */
function createServer() {
  const name   = document.getElementById('newSrvName').value.trim();
  const emoji  = document.getElementById('newSrvEmoji').value.trim() || '🎮';
  const desc   = document.getElementById('newSrvDesc').value.trim();
  const isPublic = document.getElementById('srvPublic').checked;
  if (!name) { toast('❌ أدخل اسم السيرفر', 'err'); return; }

  const sid  = uid();
  const code = Math.random().toString(36).slice(2, 8).toUpperCase();

  // Check template channels
  const selectedTpl = document.querySelector('.srv-template.active');
  const tplKey = selectedTpl?.onclick?.toString().match(/'(\w+)'/)?.[1];
  const tpl = tplKey && TEMPLATES[tplKey];

  const defaultChannels = tpl?.channels?.length ? tpl.channels.map(c => ({
    id: uid(), name: c.n, type: c.t, category: c.c, messages: [], private: false
  })) : [
    { id:uid(), name:'عام',       type:'text',     category:'القنوات العامة',  messages:[], private:false },
    { id:uid(), name:'الإعلانات', type:'announce', category:'القنوات العامة',  messages:[], private:false },
    { id:uid(), name:'صوتي-عام',  type:'voice',    category:'القنوات الصوتية', messages:[], private:false }
  ];

  DB.servers[sid] = {
    id: sid, name, emoji, desc,
    owner: me.username,
    createdAt: new Date().toISOString(),
    inviteCode: code,
    isPublic,
    members: { [me.username]: { role: 'owner', joinDate: new Date().toISOString() } },
    channels: defaultChannels,
    logs: [], webhooks: [], bans: []
  };
  saveDB();
  closeModal('createServerModal');
  // Reset form
  ['newSrvName','newSrvDesc'].forEach(id => { const el=document.getElementById(id); if(el) el.value=''; });
  document.getElementById('newSrvEmoji').value = '🎮';
  addLog(sid, 'إنشاء سيرفر', me.username, name);
  renderRail();
  openServer(sid);
  toast('✅ تم إنشاء السيرفر!');
}

/* ══════════════════════════════
   JOIN SERVER
══════════════════════════════ */
function joinServer() {
  const code  = document.getElementById('joinCode').value.trim().toUpperCase();
  const sv    = Object.values(DB.servers).find(s => s.inviteCode === code);
  const errEl = document.getElementById('joinError');

  if (!sv) { errEl.style.display = 'block'; return; }
  if (sv.bans?.includes(me.username)) { toast('❌ أنت محظور من هذا السيرفر', 'err'); return; }
  if (sv.members?.[me.username]) {
    toast('أنت موجود في السيرفر!'); closeModal('joinServerModal');
    openServer(sv.id); return;
  }
  sv.members[me.username] = { role:'user', joinDate:new Date().toISOString() };
  saveDB(); closeModal('joinServerModal'); errEl.style.display = 'none';
  document.getElementById('joinCode').value = '';
  addLog(sv.id, 'انضمام للسيرفر', me.username);
  renderRail(); openServer(sv.id);
  toast('✅ تم الانضمام بنجاح!');
}

// Live server preview when typing invite code
document.addEventListener('DOMContentLoaded', () => {
  const joinCodeEl = document.getElementById('joinCode');
  if (joinCodeEl) {
    joinCodeEl.addEventListener('input', (e) => {
      const code = e.target.value.trim().toUpperCase();
      const sv = Object.values(DB.servers).find(s => s.inviteCode === code);
      const preview = document.getElementById('serverPreview');
      if (sv) {
        preview.classList.remove('hidden');
        preview.innerHTML = `
          <div class="sp-icon">${sv.emoji || '🎮'}</div>
          <div>
            <div class="sp-name">${esc(sv.name)}</div>
            <div class="sp-members">👥 ${Object.keys(sv.members).length} عضو</div>
          </div>
        `;
        document.getElementById('joinError').style.display = 'none';
      } else {
        preview.classList.add('hidden');
      }
    });
  }
});

/* ══════════════════════════════
   ADD CHANNEL
══════════════════════════════ */
function openAddChannel(sid, cat) {
  document.getElementById('addChCat').value = cat;
  document.getElementById('addChModal').dataset.sid = sid;
  openModal('addChModal');
}

function addChannel() {
  const modal  = document.getElementById('addChModal');
  const sid    = modal.dataset.sid || activeServer;
  const sv     = DB.servers[sid];
  const type   = document.querySelector('input[name="chType"]:checked')?.value || 'text';
  const name   = document.getElementById('addChName').value.trim();
  const cat    = document.getElementById('addChCat').value.trim() || 'القنوات';
  const priv   = document.getElementById('chPrivate').checked;
  if (!name) { toast('❌ أدخل اسم القناة', 'err'); return; }
  sv.channels.push({ id:uid(), name, type, category:cat, messages:[], private:priv });
  saveDB(); closeModal('addChModal');
  document.getElementById('addChName').value = '';
  addLog(sid, 'إنشاء قناة', me.username, name);
  renderChannels(sid);
  toast('✅ تم إنشاء القناة!');
}

/* ══════════════════════════════
   ADMIN PANEL
══════════════════════════════ */
function openAdminPanel(sid) {
  activeServer = sid;
  showScreen('adminScreen');
  switchAdminTab('overview');
}

function switchAdminTab(tab) {
  adminTab = tab;
  document.querySelectorAll('.a-nav-item').forEach(el =>
    el.classList.toggle('active', el.dataset.tab === tab));
  renderAdmin();
}

function renderAdmin() {
  const sv     = DB.servers[activeServer];
  const myRole = myServerRole(activeServer);
  const body   = document.getElementById('adminBody');
  if (!sv) { body.innerHTML = '<div class="empty"><p>لا يوجد سيرفر</p></div>'; return; }
  switch (adminTab) {
    case 'overview':  renderAdminOverview(sv, body, myRole);  break;
    case 'members':   renderAdminMembers(sv, body, myRole);   break;
    case 'roles':     renderAdminRoles(sv, body, myRole);     break;
    case 'channels':  renderAdminChannels(sv, body, myRole);  break;
    case 'webhooks':  renderAdminWebhooks(sv, body, myRole);  break;
    case 'logs':      renderAdminLogs(sv, body);              break;
    case 'bans':      renderAdminBans(sv, body, myRole);      break;
    case 'invites':   renderAdminInvites(sv, body, myRole);   break;
    case 'settings':  renderAdminSettings(sv, body, myRole);  break;
    default: body.innerHTML = '<div class="empty"><p>قريباً</p></div>';
  }
}

function renderAdminOverview(sv, el, myRole) {
  const mc = Object.keys(sv.members).length;
  const cc = sv.channels.length;
  const ms = sv.channels.reduce((a, c) => a + (c.messages?.length || 0), 0);
  const bc = sv.bans?.length || 0;
  el.innerHTML = `
    <div class="a-title">📊 نظرة عامة — ${esc(sv.name)}</div>
    <div class="a-sub">إحصائيات ومعلومات السيرفر</div>
    <div class="stats-grid">
      <div class="stat-card"><div class="s-icon-lg">👥</div><div class="s-num">${mc}</div><div class="s-lbl">الأعضاء</div></div>
      <div class="stat-card"><div class="s-icon-lg">💬</div><div class="s-num">${cc}</div><div class="s-lbl">القنوات</div></div>
      <div class="stat-card"><div class="s-icon-lg">📨</div><div class="s-num">${ms}</div><div class="s-lbl">الرسائل</div></div>
      <div class="stat-card"><div class="s-icon-lg">🔨</div><div class="s-num">${bc}</div><div class="s-lbl">المحظورون</div></div>
    </div>
    <div class="invite-card">
      <div><h3>كود الدعوة</h3><p>شارك هذا الكود مع أصدقائك</p></div>
      <div style="display:flex;align-items:center;gap:12px;flex-wrap:wrap">
        <div class="invite-code">${sv.inviteCode}</div>
        <button class="btn btn-ghost btn-sm" onclick="copyText('${sv.inviteCode}')">📋 نسخ</button>
        <button class="btn btn-ghost btn-sm" onclick="shareInviteLink('${sv.inviteCode}')">🔗 مشاركة</button>
      </div>
    </div>
    <div class="t-wrap">
      <div class="t-head"><h3>💡 معلومات السيرفر</h3></div>
      <table>
        <tr><td>الاسم</td><td style="color:var(--text-1);font-weight:600">${esc(sv.name)}</td></tr>
        <tr><td>الأونر</td><td class="rc-owner" style="font-weight:600">${esc(DB.users[sv.owner]?.display || sv.owner)}</td></tr>
        <tr><td>تاريخ الإنشاء</td><td>${fmtDate(sv.createdAt)}</td></tr>
        <tr><td>الوصف</td><td>${esc(sv.desc || '—')}</td></tr>
        <tr><td>السيرفر</td><td>${sv.isPublic ? '🌐 عام' : '🔒 خاص'}</td></tr>
      </table>
    </div>
    ${myRole === 'owner' ? `<button class="btn btn-accent" onclick="openModal('createAccountModal')">👤 إنشاء حساب جديد</button>` : ''}
  `;
}

function renderAdminMembers(sv, el, myRole) {
  let rows = '';
  Object.entries(sv.members).forEach(([uname, m]) => {
    const u = DB.users[uname]; if (!u) return;
    const role = u.role === 'owner' ? 'owner' : (m.role || 'user');
    const rb   = badge(role);
    const editable = (canManage(myRole, role) || myRole === 'owner') && role !== 'owner';
    rows += `<tr>
      <td>
        <div style="display:flex;align-items:center;gap:8px">
          <div style="width:32px;height:32px;border-radius:50%;background:${avatarColor(uname)};display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:700;color:#fff;overflow:hidden;flex-shrink:0">
            ${u.photoURL ? `<img src="${u.photoURL}" style="width:100%;height:100%;object-fit:cover">` : esc((u.avatar||u.display[0]).slice(0,2))}
          </div>
          <div>
            <div style="font-weight:700;color:var(--text-1)">${esc(u.display)}</div>
            <div style="font-size:11px;color:var(--text-4)">${uname}</div>
          </div>
        </div>
      </td>
      <td>${rb || '<span style="color:var(--text-4)">عضو</span>'}</td>
      <td>${fmtDate(m.joinDate || sv.createdAt)}</td>
      <td>
        ${editable ? `
          <div style="display:flex;gap:6px;align-items:center;flex-wrap:wrap">
            <select class="role-sel" onchange="setMemberRole('${activeServer}','${uname}',this.value)">
              ${['user','helper','super','head','admin-mgr','manager','leader'].map(rv =>
                `<option value="${rv}" ${role===rv?'selected':''}>${roleLabel(rv)||'عضو'}</option>`
              ).join('')}
            </select>
            <button class="btn btn-warn btn-sm" onclick="kickMember('${activeServer}','${uname}')">👟 طرد</button>
            <button class="btn btn-danger btn-sm" onclick="banMember('${activeServer}','${uname}')">🔨 حظر</button>
          </div>
        ` : '<span style="color:var(--text-4);font-size:13px">—</span>'}
      </td>
    </tr>`;
  });
  el.innerHTML = `
    <div class="a-title">👥 إدارة الأعضاء</div>
    <div class="a-sub">إدارة أعضاء السيرفر وصلاحياتهم</div>
    <div class="t-wrap">
      <div class="t-head"><h3>الأعضاء (${Object.keys(sv.members).length})</h3>
        <input type="text" placeholder="بحث..." oninput="filterMembersTable(this.value)"
          style="background:var(--bg-input);border:1px solid var(--border);border-radius:6px;padding:6px 10px;font-family:var(--font-main);color:var(--text-1);outline:none;font-size:13px">
      </div>
      <table><thead><tr><th>العضو</th><th>الرتبة</th><th>تاريخ الانضمام</th><th>الإجراءات</th></tr></thead>
      <tbody id="membersTableBody">${rows}</tbody></table>
    </div>
  `;
}

function filterMembersTable(query) {
  const tbody = document.getElementById('membersTableBody');
  if (!tbody) return;
  tbody.querySelectorAll('tr').forEach(row => {
    row.style.display = row.textContent.toLowerCase().includes(query.toLowerCase()) ? '' : 'none';
  });
}

function setMemberRole(sid, uname, newRole) {
  const sv = DB.servers[sid];
  if (!sv?.members[uname]) return;
  sv.members[uname].role = newRole;
  if (DB.users[uname]) DB.users[uname].role = newRole;
  saveDB();
  addLog(sid, 'تغيير رتبة', me.username, `${uname} ← ${newRole}`);
  toast(`✅ تم تغيير رتبة ${DB.users[uname]?.display || uname}`);
  renderAdmin(); renderMembers(sid);
}

function kickMember(sid, uname) {
  if (uname === me.username) { toast('❌ لا يمكنك طرد نفسك', 'err'); return; }
  if (!confirm(`هل تريد طرد ${DB.users[uname]?.display || uname}؟`)) return;
  delete DB.servers[sid].members[uname]; saveDB();
  addLog(sid, 'طرد عضو', me.username, uname);
  toast(`👟 تم طرد ${DB.users[uname]?.display || uname}`);
  renderAdmin(); renderMembers(sid);
}

function banMember(sid, uname) {
  if (uname === me.username) { toast('❌ لا يمكنك حظر نفسك', 'err'); return; }
  if (!confirm(`هل تريد حظر ${DB.users[uname]?.display || uname}؟`)) return;
  const sv = DB.servers[sid];
  if (!sv.bans) sv.bans = [];
  if (!sv.bans.includes(uname)) sv.bans.push(uname);
  delete sv.members[uname]; saveDB();
  addLog(sid, 'حظر عضو', me.username, uname);
  toast(`🔨 تم حظر ${DB.users[uname]?.display || uname}`);
  renderAdmin(); renderMembers(sid);
}

function renderAdminRoles(sv, el, myRole) {
  const roleData = [
    { key:'leader',    name:'ليدر',       color:'var(--c-leader)',    perms:['كل الصلاحيات تقريباً','إدارة الأعضاء','طرد/حظر','تجديد الدعوات'] },
    { key:'manager',   name:'مانجر',      color:'var(--c-manager)',   perms:['إدارة الأعضاء','إنشاء قنوات','عرض السجلات'] },
    { key:'admin-mgr', name:'أدمن مانجر', color:'var(--c-admin-mgr)', perms:['إدارة الأدمنز','تغيير الرتب'] },
    { key:'head',      name:'هيد أدمن',   color:'var(--c-head)',      perms:['قبول الطلبات','إدارة التذاكر'] },
    { key:'super',     name:'سوبر أدمن',  color:'var(--c-super)',     perms:['مراقبة الأعضاء','طرد الأعضاء'] },
    { key:'helper',    name:'هيلبر',      color:'var(--c-helper)',    perms:['مساعدة الأعضاء','الإجابة على الأسئلة'] },
  ];
  let html = `<div class="a-title">🎖️ نظام الرتب</div><div class="a-sub">رتب الإدارة وصلاحياتها</div>`;
  roleData.forEach(r => {
    html += `<div class="t-wrap" style="margin-bottom:12px">
      <div class="t-head"><h3 style="color:${r.color}">${r.name}</h3></div>
      <div style="padding:12px 16px;display:flex;gap:8px;flex-wrap:wrap">
        ${r.perms.map(p => `<span style="background:var(--bg-input);border:1px solid var(--border);padding:4px 12px;border-radius:99px;font-size:13px;color:var(--text-2)">✓ ${p}</span>`).join('')}
      </div>
    </div>`;
  });
  el.innerHTML = html;
}

function renderAdminChannels(sv, el, myRole) {
  let rows = sv.channels.map(ch => {
    const sym = ch.type==='voice'?'🔊 صوتية':ch.type==='announce'?'📢 إعلانات':'💬 نصية';
    return `<tr>
      <td style="font-weight:600;color:var(--text-1)">${esc(ch.name)}</td>
      <td>${sym}</td>
      <td>${esc(ch.category||'—')}</td>
      <td>${ch.messages?.length||0}</td>
      <td>${ch.private ? '🔒 خاصة' : '🌐 عامة'}</td>
      <td>${(myRole==='owner'||myRole==='leader') ? `<button class="btn btn-danger btn-sm" onclick="deleteChannel('${activeServer}','${ch.id}')">🗑️</button>` : '—'}</td>
    </tr>`;
  }).join('');
  el.innerHTML = `
    <div class="a-title">💬 إدارة القنوات</div>
    <div class="a-sub">إدارة وتنظيم قنوات السيرفر</div>
    <div style="margin-bottom:16px"><button class="btn btn-accent" onclick="openAddChannel('${activeServer}','')">➕ إضافة قناة</button></div>
    <div class="t-wrap">
      <table><thead><tr><th>الاسم</th><th>النوع</th><th>الفئة</th><th>الرسائل</th><th>الوصول</th><th>حذف</th></tr></thead>
      <tbody>${rows}</tbody></table>
    </div>
  `;
}

function deleteChannel(sid, cid) {
  if (!confirm('حذف القناة؟')) return;
  const sv = DB.servers[sid];
  sv.channels = sv.channels.filter(c => c.id !== cid); saveDB();
  addLog(sid, 'حذف قناة', me.username);
  if (activeChannel === cid) { activeChannel = null; showScreen('homeScreen'); }
  renderAdmin(); renderChannels(sid);
  toast('🗑️ تم حذف القناة');
}

function renderAdminWebhooks(sv, el, myRole) {
  if (!sv.webhooks) sv.webhooks = [];
  const items = sv.webhooks.map(wh => `
    <div class="wh-item">
      <div style="flex:1;min-width:0">
        <div class="wh-name">${esc(wh.name)}</div>
        <div class="wh-url">${esc(wh.url)}</div>
      </div>
      <div class="wh-actions">
        <button class="btn btn-ghost btn-sm" onclick="copyText('${esc(wh.url)}')">📋</button>
        <button class="btn btn-danger btn-sm" onclick="deleteWebhook('${activeServer}','${wh.id}')">🗑️</button>
      </div>
    </div>
  `).join('');
  el.innerHTML = `
    <div class="a-title">🔗 الويبهوك</div>
    <div class="a-sub">إدارة ويبهوكات السيرفر للتكامل الخارجي</div>
    <div class="input-row" style="margin-bottom:20px">
      <input type="text" id="whName" placeholder="اسم الويبهوك">
      <button class="btn btn-accent" onclick="createWebhook('${activeServer}')">➕ إنشاء</button>
    </div>
    <div class="t-wrap">
      <div class="t-head"><h3>الويبهوكات (${sv.webhooks.length})</h3></div>
      ${items || '<div class="empty"><div class="e-icon">🔗</div><p>لا توجد ويبهوكات</p></div>'}
    </div>
  `;
}

function createWebhook(sid) {
  const name = document.getElementById('whName')?.value.trim();
  if (!name) { toast('❌ أدخل اسم الويبهوك', 'err'); return; }
  const sv = DB.servers[sid];
  if (!sv.webhooks) sv.webhooks = [];
  sv.webhooks.push({ id:uid(), name, url:`https://tiscord.app/webhooks/${uid()}`, createdBy:me.username, createdAt:new Date().toISOString() });
  saveDB(); addLog(sid, 'إنشاء ويبهوك', me.username, name);
  toast('✅ تم إنشاء الويبهوك!'); renderAdmin();
}

function deleteWebhook(sid, wid) {
  if (!confirm('حذف الويبهوك؟')) return;
  DB.servers[sid].webhooks = DB.servers[sid].webhooks.filter(w => w.id !== wid); saveDB();
  toast('🗑️ تم حذف الويبهوك'); renderAdmin();
}

function renderAdminLogs(sv, el) {
  const logs = sv.logs || [];
  const rows = logs.slice(0, 100).map(log => `
    <div class="log-row">
      <span class="log-ts">🕐 ${fmtDate(log.time)} ${fmtTime(log.time)}</span>
      <span class="log-act-badge">${esc(log.action)}</span>
      <span class="log-detail">بواسطة <strong>${esc(DB.users[log.by]?.display || log.by)}</strong>${log.target ? ' — ' + esc(log.target) : ''}</span>
    </div>
  `).join('');
  el.innerHTML = `
    <div class="a-title">📋 سجل الأحداث</div>
    <div class="a-sub">جميع الإجراءات التي تمت في السيرفر</div>
    <div class="t-wrap">
      <div class="t-head"><h3>السجلات (${logs.length})</h3>
        <button class="btn btn-ghost btn-sm" onclick="exportLogs()">⬇️ تصدير</button>
      </div>
      ${rows || '<div class="empty"><div class="e-icon">📋</div><p>لا توجد سجلات بعد</p></div>'}
    </div>
  `;
}

function exportLogs() {
  const sv = DB.servers[activeServer];
  if (!sv?.logs?.length) { toast('لا توجد سجلات', 'err'); return; }
  const text = sv.logs.map(l => `[${l.time}] ${l.action} | ${l.by}${l.target ? ' > ' + l.target : ''}`).join('\n');
  const blob = new Blob([text], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = `${sv.name}-logs.txt`; a.click();
  URL.revokeObjectURL(url);
}

function renderAdminBans(sv, el, myRole) {
  const bans = sv.bans || [];
  const rows = bans.map(uname => {
    const u = DB.users[uname] || { display: uname };
    return `<tr>
      <td style="color:var(--text-1)">${esc(u.display)}</td>
      <td style="color:var(--text-3)">${uname}</td>
      <td>${(myRole==='owner'||myRole==='leader') ? `<button class="btn btn-success btn-sm" onclick="unbanMember('${activeServer}','${uname}')">✅ رفع الحظر</button>` : '—'}</td>
    </tr>`;
  }).join('');
  el.innerHTML = `
    <div class="a-title">🔨 المحظورون</div>
    <div class="a-sub">قائمة الأعضاء المحظورين من السيرفر</div>
    <div class="t-wrap">
      <table><thead><tr><th>الاسم</th><th>المستخدم</th><th>إجراءات</th></tr></thead>
      <tbody>${rows || `<tr><td colspan="3" style="text-align:center;color:var(--text-4);padding:20px">لا يوجد محظورون</td></tr>`}</tbody></table>
    </div>
  `;
}

function unbanMember(sid, uname) {
  DB.servers[sid].bans = DB.servers[sid].bans.filter(b => b !== uname); saveDB();
  addLog(sid, 'رفع الحظر', me.username, uname);
  toast(`✅ تم رفع الحظر عن ${DB.users[uname]?.display || uname}`); renderAdmin();
}

function renderAdminInvites(sv, el, myRole) {
  el.innerHTML = `
    <div class="a-title">📨 الدعوات</div>
    <div class="a-sub">إدارة روابط الدعوة</div>
    <div class="invite-card">
      <div><h3>كود الدعوة الحالي</h3><p>شارك هذا الكود مع من تريد دعوته</p></div>
      <div style="display:flex;align-items:center;gap:12px;flex-wrap:wrap">
        <div class="invite-code">${sv.inviteCode}</div>
        <button class="btn btn-ghost btn-sm" onclick="copyText('${sv.inviteCode}')">📋 نسخ</button>
        <button class="btn btn-ghost btn-sm" onclick="shareInviteLink('${sv.inviteCode}')">🔗 مشاركة</button>
        ${(myRole==='owner'||myRole==='leader') ? `<button class="btn btn-danger btn-sm" onclick="regenInvite('${activeServer}')">🔄 تجديد</button>` : ''}
      </div>
    </div>
  `;
}

function shareInviteLink(code) {
  const url = `${location.origin}${location.pathname}?invite=${code}`;
  if (navigator.share) {
    navigator.share({ title: 'Tiscord', text: `انضم إلى السيرفر! الكود: ${code}`, url });
  } else {
    copyText(url);
  }
}

function regenInvite(sid) {
  DB.servers[sid].inviteCode = Math.random().toString(36).slice(2,8).toUpperCase(); saveDB();
  addLog(sid, 'تجديد كود الدعوة', me.username);
  toast('✅ تم تجديد كود الدعوة!'); renderAdmin();
}

function renderAdminSettings(sv, el, myRole) {
  if (myRole !== 'owner') {
    el.innerHTML = '<div class="empty"><div class="e-icon">🔒</div><p>هذا القسم للأونر فقط</p></div>';
    return;
  }
  el.innerHTML = `
    <div class="a-title">⚙️ إعدادات السيرفر</div>
    <div class="a-sub">تعديل إعدادات السيرفر</div>
    <div class="form-group"><label>اسم السيرفر</label><input id="edName" type="text" value="${esc(sv.name)}"></div>
    <div class="form-group"><label>إيموجي</label><input id="edEmoji" type="text" value="${esc(sv.emoji||'🎮')}" maxlength="2"></div>
    <div class="form-group"><label>الوصف</label><input id="edDesc" type="text" value="${esc(sv.desc||'')}"></div>
    <div class="form-group">
      <label><input type="checkbox" id="edPublic" ${sv.isPublic?'checked':''}> السيرفر عام</label>
    </div>
    <div style="display:flex;gap:8px;margin-top:16px;flex-wrap:wrap">
      <button class="btn btn-accent" onclick="saveServerSettings('${activeServer}')">💾 حفظ</button>
      <button class="btn btn-danger" onclick="confirmDelete('${activeServer}')">🗑️ حذف السيرفر</button>
      <button class="btn btn-ghost" onclick="leaveServer('${activeServer}')">🚪 مغادرة</button>
    </div>
  `;
}

function saveServerSettings(sid) {
  const sv = DB.servers[sid];
  sv.name     = document.getElementById('edName')?.value.trim()   || sv.name;
  sv.emoji    = document.getElementById('edEmoji')?.value.trim()  || sv.emoji;
  sv.desc     = document.getElementById('edDesc')?.value.trim();
  sv.isPublic = document.getElementById('edPublic')?.checked;
  saveDB();
  addLog(sid, 'تعديل إعدادات السيرفر', me.username);
  renderRail();
  document.getElementById('srvHeader').innerHTML = `<span>${esc(sv.emoji)} ${esc(sv.name)}</span><span class="chevron">▾</span>`;
  toast('✅ تم حفظ الإعدادات!');
}

function confirmDelete(sid) {
  if (!confirm('هل أنت متأكد من حذف السيرفر؟ لا يمكن التراجع!')) return;
  delete DB.servers[sid]; saveDB();
  toast('🗑️ تم حذف السيرفر');
  activeServer = null; activeChannel = null;
  renderRail(); openHome();
}

function leaveServer(sid) {
  const sv = DB.servers[sid];
  if (sv?.owner === me.username) { toast('❌ الأونر لا يمكنه المغادرة، احذف السيرفر أو انقل الملكية', 'err'); return; }
  if (!confirm('هل تريد مغادرة السيرفر؟')) return;
  delete sv.members[me.username]; saveDB();
  toast('🚪 تم مغادرة السيرفر');
  activeServer = null; activeChannel = null;
  renderRail(); openHome();
}

/* ══════════════════════════════
   SETTINGS MODAL
══════════════════════════════ */
function openSettings() { openModal('settingsModal'); renderSettings('profile'); }

function renderSettings(tab) {
  settingsTab = tab;
  document.querySelectorAll('#settingsModal .tab-btn').forEach(el =>
    el.classList.toggle('active', el.dataset.tab === tab));
  const u   = DB.users[me.username];
  const con = document.getElementById('settingsBody');

  if (tab === 'profile') {
    con.innerHTML = `
      <div style="display:flex;align-items:center;gap:16px;margin-bottom:20px;padding:16px;background:var(--bg-input);border-radius:12px">
        <div style="width:64px;height:64px;border-radius:50%;background:${avatarColor(me.username)};display:flex;align-items:center;justify-content:center;font-size:26px;font-weight:700;color:#fff">
          ${u.photoURL ? `<img src="${u.photoURL}" style="width:100%;height:100%;border-radius:50%;object-fit:cover">` : esc((u.avatar||u.display[0]).slice(0,2))}
        </div>
        <div>
          <div style="font-size:18px;font-weight:700">${esc(u.display)}</div>
          <div style="font-size:13px;color:var(--text-3)">${u.tag} · ${roleLabel(u.role) || 'عضو'}</div>
          ${u.email ? `<div style="font-size:12px;color:var(--text-4)">${esc(u.email)}</div>` : ''}
        </div>
      </div>
      <div class="form-group"><label>الاسم المعروض</label><input id="setDisplay" type="text" value="${esc(u.display)}"></div>
      <div class="form-group"><label>الأفاتار / إيموجي</label><input id="setAvatar" type="text" value="${esc(u.avatar||u.display[0])}" maxlength="2"></div>
      <div class="form-group"><label>السيرة الذاتية</label><input id="setBio" type="text" value="${esc(u.bio||'')}" placeholder="عرّف عن نفسك..."></div>
      <div class="form-group">
        <label>الحالة</label>
        <select id="setStatus">
          <option value="online" ${u.status==='online'?'selected':''}>🟢 متاح</option>
          <option value="idle"   ${u.status==='idle'?'selected':''}>🟡 بعيد</option>
          <option value="dnd"    ${u.status==='dnd'?'selected':''}>🔴 لا تزعج</option>
          <option value="offline" ${u.status==='offline'?'selected':''}>⚫ غير مرئي</option>
        </select>
      </div>
    `;
  } else if (tab === 'security') {
    con.innerHTML = `
      <div class="form-group"><label>كلمة المرور الحالية</label><input id="setOldPass" type="password" placeholder="أدخل كلمة المرور الحالية"></div>
      <div class="form-group"><label>كلمة المرور الجديدة</label><input id="setNewPass" type="password" placeholder="أدخل كلمة المرور الجديدة"></div>
      <div class="form-group"><label>تأكيد كلمة المرور</label><input id="setConfirmPass" type="password" placeholder="أعد إدخال كلمة المرور الجديدة"></div>
    `;
  } else if (tab === 'appearance') {
    const theme = u.theme || 'dark';
    con.innerHTML = `
      <div class="form-group"><label>المظهر</label></div>
      <div class="theme-grid">
        <div class="theme-opt${theme==='dark'?' active':''}" onclick="previewTheme('dark',this)">
          <div class="t-icon">🌙</div>داكن
        </div>
        <div class="theme-opt${theme==='light'?' active':''}" onclick="previewTheme('light',this)">
          <div class="t-icon">☀️</div>فاتح
        </div>
      </div>
      <div class="form-group" style="margin-top:16px">
        <label>حجم الخط</label>
        <input type="range" id="fontSizeRange" min="13" max="18" value="${u.fontSize||15}"
          oninput="previewFontSize(this.value)">
        <div style="font-size:13px;color:var(--text-3);margin-top:4px">المعاينة: <span id="fontPreview" style="font-size:${u.fontSize||15}px">هذا حجم الخط الحالي</span></div>
      </div>
    `;
  } else if (tab === 'notifications') {
    const notif = u.notifications || {};
    con.innerHTML = `
      <div class="form-group">
        <label><input type="checkbox" id="notifSound" ${notif.sound!==false?'checked':''}> صوت الإشعارات</label>
      </div>
      <div class="form-group">
        <label><input type="checkbox" id="notifDesktop" ${notif.desktop?'checked':''}> إشعارات سطح المكتب</label>
      </div>
      <div class="form-group">
        <label><input type="checkbox" id="notifMentions" ${notif.mentions!==false?'checked':''}> تنبيه عند الإشارة إليّ</label>
      </div>
    `;
  }
}

function previewTheme(theme, el) {
  document.querySelectorAll('.theme-opt').forEach(t => t.classList.remove('active'));
  el.classList.add('active');
  applyTheme(theme);
}

function previewFontSize(size) {
  const preview = document.getElementById('fontPreview');
  if (preview) preview.style.fontSize = size + 'px';
  document.querySelector('.msgs-wrap') && (document.querySelector('.msgs-wrap').style.fontSize = size + 'px');
}

function saveSettings() {
  const u = DB.users[me.username];
  if (settingsTab === 'profile') {
    const d      = document.getElementById('setDisplay')?.value.trim();
    const av     = document.getElementById('setAvatar')?.value.trim();
    const bio    = document.getElementById('setBio')?.value.trim();
    const status = document.getElementById('setStatus')?.value;
    if (d)  { u.display = d; me.display = d; }
    if (av) { u.avatar  = av; }
    if (bio !== undefined) u.bio = bio;
    if (status) { u.status = status; }
    saveDB(); refreshUserBar();
    toast('✅ تم حفظ الملف الشخصي!');
  } else if (settingsTab === 'security') {
    const op = document.getElementById('setOldPass')?.value;
    const np = document.getElementById('setNewPass')?.value;
    const cp = document.getElementById('setConfirmPass')?.value;
    if (!op || !np) { toast('❌ أدخل كلمتي المرور', 'err'); return; }
    if (u.password !== op) { toast('❌ كلمة المرور الحالية خاطئة', 'err'); return; }
    if (np !== cp) { toast('❌ كلمتا المرور الجديدتان غير متطابقتين', 'err'); return; }
    if (np.length < 6) { toast('❌ كلمة المرور قصيرة جداً', 'err'); return; }
    u.password = np; saveDB();
    toast('✅ تم تغيير كلمة المرور!');
  } else if (settingsTab === 'appearance') {
    const theme = document.querySelector('.theme-opt.active') ? 
      (document.querySelectorAll('.theme-opt')[0].classList.contains('active') ? 'dark' : 'light') : 'dark';
    const fontSize = document.getElementById('fontSizeRange')?.value || 15;
    u.theme    = theme;
    u.fontSize = parseInt(fontSize);
    applyTheme(theme);
    document.body.style.fontSize = fontSize + 'px';
    saveDB();
    toast('✅ تم حفظ المظهر!');
  } else if (settingsTab === 'notifications') {
    u.notifications = {
      sound:    document.getElementById('notifSound')?.checked,
      desktop:  document.getElementById('notifDesktop')?.checked,
      mentions: document.getElementById('notifMentions')?.checked
    };
    if (u.notifications.desktop) {
      Notification.requestPermission().then(p => {
        if (p === 'granted') toast('✅ تم تفعيل إشعارات سطح المكتب!');
      });
    }
    saveDB(); toast('✅ تم حفظ إعدادات الإشعارات!');
  }
}

/* ══════════════════════════════
   CREATE ACCOUNT (Owner only)
══════════════════════════════ */
function createAccount() {
  const u     = document.getElementById('accUser').value.trim().toLowerCase();
  const disp  = document.getElementById('accDisplay').value.trim();
  const p     = document.getElementById('accPass').value;
  const role  = document.getElementById('accRole').value;
  const errEl = document.getElementById('accError');
  if (!u || !disp || !p) { showErr(errEl, '❌ يرجى ملء جميع الحقول'); return; }
  if (DB.users[u])       { showErr(errEl, '❌ اسم المستخدم مستخدم'); return; }
  DB.users[u] = {
    password:p, display:disp,
    tag:'#' + String(Object.keys(DB.users).length + 1).padStart(4,'0'),
    role, avatar:'😀', status:'offline', joinDate:new Date().toISOString()
  };
  saveDB();
  addLog(activeServer, 'إنشاء حساب جديد', me.username, `${u} (${disp})`);
  closeModal('createAccountModal');
  ['accUser','accDisplay','accPass'].forEach(id => { const el=document.getElementById(id); if(el) el.value=''; });
  errEl.style.display = 'none';
  toast(`✅ تم إنشاء حساب ${disp} بنجاح!`);
}

/* ══════════════════════════════
   PROFILE POPUP
══════════════════════════════ */
function showProfile(uname) {
  const u = DB.users[uname];
  if (!u) return;
  const modal = document.getElementById('profileModal');
  const content = document.getElementById('profileModalContent');
  const isSelf = uname === me.username;
  content.innerHTML = `
    <div class="profile-popup">
      <div class="profile-av-big" style="background:${avatarColor(uname)}">
        ${u.photoURL ? `<img src="${u.photoURL}" style="width:100%;height:100%;border-radius:50%;object-fit:cover">` : esc((u.avatar||u.display[0]).slice(0,2))}
      </div>
      <div class="profile-name">${esc(u.display)}</div>
      <div class="profile-tag">${u.tag}${roleLabel(u.role) ? ' · ' + roleLabel(u.role) : ''}</div>
      ${u.bio ? `<p style="font-size:13px;color:var(--text-3);text-align:center;max-width:260px">${esc(u.bio)}</p>` : ''}
      <div style="font-size:12px;color:var(--text-4)">انضم: ${fmtDate(u.joinDate)}</div>
      <div class="profile-actions">
        ${!isSelf ? `<button class="btn btn-accent btn-sm" onclick="closeModal('profileModal');toast('💬 الرسائل المباشرة قريباً!')">💬 رسالة</button>` : ''}
        ${isSelf  ? `<button class="btn btn-ghost btn-sm" onclick="closeModal('profileModal');openSettings()">✏️ تعديل</button>` : ''}
      </div>
    </div>
  `;
  openModal('profileModal');
}

/* ══════════════════════════════
   MODAL HELPERS
══════════════════════════════ */
function openModal(id)  { document.getElementById(id).classList.remove('hidden'); }
function closeModal(id) { document.getElementById(id).classList.add('hidden'); }

function copyText(t) {
  navigator.clipboard.writeText(t)
    .then(() => toast('📋 تم النسخ!'))
    .catch(() => toast('الكود: ' + t));
}

/* ══════════════════════════════
   PWA INSTALL
══════════════════════════════ */
let deferredPrompt;
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredPrompt = e;
  // Show install banner after 3 seconds
  setTimeout(() => {
    const banner = document.createElement('div');
    banner.style.cssText = `
      position:fixed;bottom:80px;left:50%;transform:translateX(-50%);
      background:var(--bg-card);border:1px solid var(--accent);
      border-radius:12px;padding:12px 20px;z-index:1000;
      display:flex;align-items:center;gap:12px;box-shadow:0 8px 32px rgba(0,0,0,.4);
      animation:toastIn .3s ease;
    `;
    banner.innerHTML = `
      <span>📱 ثبّت Tiscord على جهازك!</span>
      <button onclick="installPWA()" style="background:var(--accent);border:none;color:#fff;padding:6px 14px;border-radius:8px;cursor:pointer;font-family:var(--font-main);font-weight:600">تثبيت</button>
      <button onclick="this.parentElement.remove()" style="background:none;border:none;cursor:pointer;color:var(--text-3);font-size:18px">✕</button>
    `;
    document.body.appendChild(banner);
    setTimeout(() => banner.remove(), 8000);
  }, 3000);
});

function installPWA() {
  if (deferredPrompt) {
    deferredPrompt.prompt();
    deferredPrompt.userChoice.then(() => { deferredPrompt = null; });
  }
}

// Auto-handle invite codes in URL
function checkInviteUrl() {
  const params = new URLSearchParams(location.search);
  const code = params.get('invite');
  if (code && me) {
    document.getElementById('joinCode').value = code.toUpperCase();
    openModal('joinServerModal');
  }
}

/* ══════════════════════════════
   NOTIFICATIONS
══════════════════════════════ */
function sendNotification(title, body) {
  if (!me) return;
  const u = DB.users[me.username];
  if (u?.notifications?.sound !== false) {
    // Play a simple beep
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain); gain.connect(ctx.destination);
      osc.frequency.value = 440;
      gain.gain.setValueAtTime(0.1, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);
      osc.start(); osc.stop(ctx.currentTime + 0.3);
    } catch(e) {}
  }
  if (u?.notifications?.desktop && Notification.permission === 'granted') {
    new Notification(title, { body, icon: '🎮' });
  }
}

/* ══════════════════════════════
   INIT
══════════════════════════════ */
document.addEventListener('DOMContentLoaded', () => {
  loadDB();

  // Animate splash then show auth
  setTimeout(() => {
    document.getElementById('splashScreen').style.opacity = '0';
    document.getElementById('splashScreen').style.transition = '.5s';
    setTimeout(() => {
      document.getElementById('splashScreen').style.display = 'none';
      document.getElementById('authPage').classList.remove('hidden');
    }, 500);
  }, 1800);

  // Close modals on overlay click
  document.querySelectorAll('.modal-overlay').forEach(overlay => {
    overlay.addEventListener('click', e => {
      if (e.target === overlay) overlay.classList.add('hidden');
    });
  });

  // Enter key on auth inputs
  ['loginUser','loginPass'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.addEventListener('keydown', e => { if(e.key==='Enter') doLogin(); });
  });
  ['regUser','regDisplay','regEmail','regPass'].forEach(id => {
    const el = document.getElementById(id);
    if (el) {
      el.addEventListener('keydown', e => { if(e.key==='Enter') doRegister(); });
      if (id === 'regPass') el.addEventListener('input', () => checkPassStrength(el.value));
    }
  });

  // Keyboard shortcut: Escape to close modals
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') {
      document.querySelectorAll('.modal-overlay:not(.hidden)').forEach(m => m.classList.add('hidden'));
      document.getElementById('emojiPicker')?.classList.add('hidden');
    }
  });

  // Font size from settings
  if (me) {
    const u = DB.users[me?.username];
    if (u?.fontSize) document.body.style.fontSize = u.fontSize + 'px';
  }
});

// Register Service Worker for PWA
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  });
}
