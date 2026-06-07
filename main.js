/* ═══════════════════════════════════════════
   TISCORD — main.js
   ═══════════════════════════════════════════ */

'use strict';

/* ══════════════════════════════
   DATABASE (localStorage)
══════════════════════════════ */
const STORE_KEY = 'tiscord_v2';

let DB = {
  users: {},
  servers: {},
  logs: [],
  version: 2
};

function saveDB() {
  try { localStorage.setItem(STORE_KEY, JSON.stringify(DB)); } catch (e) { console.warn('Save failed', e); }
}

function loadDB() {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && parsed.version >= 2) DB = parsed;
    }
  } catch (e) { console.warn('Load failed', e); }

  // Always ensure owner account exists
  if (!DB.users['hosennujq2']) {
    DB.users['hosennujq2'] = {
      password: 'qwaszx1202',
      display: 'هوسن',
      tag: '#0001',
      role: 'owner',
      avatar: '👑',
      status: 'online',
      joinDate: new Date().toISOString()
    };
  }
  if (!DB.servers) DB.servers = {};
  if (!DB.logs)    DB.logs    = [];
  saveDB();
}

/* ══════════════════════════════
   STATE
══════════════════════════════ */
let me           = null;   // current user object
let activeServer = null;   // server id
let activeChannel= null;   // channel id
let showMembers  = true;
let adminTab     = 'overview';
let settingsTab  = 'profile';

/* ══════════════════════════════
   HELPERS
══════════════════════════════ */
function uid()  { return Date.now().toString(36) + Math.random().toString(36).slice(2); }
function esc(s) { return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }

function fmtTime(iso) {
  const d = new Date(iso);
  return d.toLocaleTimeString('ar-SA', { hour:'2-digit', minute:'2-digit' });
}
function fmtDate(iso) {
  return new Date(iso).toLocaleDateString('ar-SA');
}

function toast(msg, type = 'ok') {
  const c = document.getElementById('toastContainer');
  const t = document.createElement('div');
  t.className = `toast ${type}`;
  t.textContent = msg;
  c.appendChild(t);
  setTimeout(() => t.remove(), 3200);
}

function addLog(serverId, action, by, target = '') {
  const entry = { id: uid(), action, by, target, time: new Date().toISOString() };
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

function roleIndex(r) { return ROLE_ORDER.indexOf(r) === -1 ? 7 : ROLE_ORDER.indexOf(r); }
function canManage(a, b) { return roleIndex(a) < roleIndex(b); }
function isStaff(r) { return roleIndex(r) < 7; }

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
  const u = DB.users[me.username];
  if (u?.role === 'owner') return 'owner';
  if (sv.owner === me.username) return 'owner';
  return sv.members[me.username]?.role || 'user';
}

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

function doLogin() {
  const u = document.getElementById('loginUser').value.trim().toLowerCase();
  const p = document.getElementById('loginPass').value;
  const user = DB.users[u];
  const errEl = document.getElementById('loginError');

  if (!user || user.password !== p) {
    errEl.style.display = 'block';
    errEl.textContent = '❌ اسم المستخدم أو كلمة المرور غلط';
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
  const p    = document.getElementById('regPass').value;
  const errEl = document.getElementById('regError');

  if (!u || !disp || !p) { showErr(errEl, '❌ يرجى ملء جميع الحقول'); return; }
  if (u.length < 3)      { showErr(errEl, '❌ اسم المستخدم قصير جداً'); return; }
  if (DB.users[u])       { showErr(errEl, '❌ اسم المستخدم مستخدم'); return; }

  const tag = '#' + String(Object.keys(DB.users).length + 1).padStart(4, '0');
  DB.users[u] = { password:p, display:disp, tag, role:'user', avatar:'😀', status:'online', joinDate:new Date().toISOString() };
  saveDB();
  me = { username: u, ...DB.users[u] };
  addLog(null, 'تسجيل حساب', u);
  bootApp();
}

function showErr(el, msg) { el.textContent = msg; el.style.display = 'block'; }

function doLogout() {
  if (me) { DB.users[me.username].status = 'offline'; saveDB(); }
  me = null; activeServer = null; activeChannel = null;
  document.getElementById('authPage').classList.remove('hidden');
  document.getElementById('app').classList.add('hidden');
  document.getElementById('loginUser').value = '';
  document.getElementById('loginPass').value = '';
}

/* ══════════════════════════════
   APP BOOT
══════════════════════════════ */
function bootApp() {
  document.getElementById('authPage').classList.add('hidden');
  document.getElementById('app').classList.remove('hidden');
  refreshUserBar();
  renderRail();
  openHome();
}

function refreshUserBar() {
  const u = DB.users[me.username];
  document.getElementById('barName').textContent   = u.display;
  document.getElementById('barTag').textContent    = u.tag;
  document.getElementById('barAvLetter').textContent = (u.avatar || u.display[0]).slice(0, 2);
  document.getElementById('barAvatar').style.background = avatarColor(me.username);
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
  showScreen('homeScreen');

  document.getElementById('homeScreen').innerHTML = `
    <div class="home-logo">${esc(sv.emoji || '🎮')}</div>
    <h1 class="home-title">${esc(sv.name)}</h1>
    <p class="home-sub">${esc(sv.desc || 'مرحباً في ' + sv.name)}</p>
    <div style="display:flex;align-items:center;gap:12px;background:var(--bg-card);border:1px solid var(--border);border-radius:12px;padding:12px 20px;margin-top:8px">
      <span style="font-size:13px;color:var(--text-3)">كود الدعوة:</span>
      <span style="font-family:monospace;font-size:20px;color:var(--accent);font-weight:700;letter-spacing:3px">${sv.inviteCode}</span>
      <button class="btn btn-ghost btn-sm" onclick="copyText('${sv.inviteCode}')">📋 نسخ</button>
    </div>
    ${isStaff(myRole) ? `<button class="btn btn-accent" style="margin-top:12px" onclick="openAdminPanel('${sid}')">⚙️ لوحة الإدارة</button>` : ''}
  `;
}

function renderChannels(sid) {
  const sv = DB.servers[sid];
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
      const sym = ch.type === 'voice' ? '🔊' : ch.type === 'announce' ? '📢' : '#';
      html += `<div class="ch-item${activeChannel === ch.id ? ' active' : ''}" onclick="openChannel('${sid}','${ch.id}')">
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
      html += `<div class="m-item" onclick="showProfile('${uname}')">
        <div class="m-avatar" style="background:${avatarColor(uname)}">
          <span>${(u.avatar || u.display[0]).slice(0,2)}</span>
          <div class="m-status online"></div>
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
  document.getElementById('chatSym').textContent  = sym;
  document.getElementById('chatName').textContent = ch.name;
  document.getElementById('chatDesc').textContent = ch.category || '';
  document.getElementById('chatInputEl').placeholder = `رسالة في ${ch.name}`;

  renderMessages();
  renderChannels(sid);
  renderMembers(sid);
}

function renderMessages() {
  const sv = DB.servers[activeServer];
  const ch = sv?.channels.find(c => c.id === activeChannel);
  const area = document.getElementById('msgsWrap');
  if (!ch) return;

  if (!ch.messages?.length) {
    area.innerHTML = `<div class="empty" style="margin:auto">
      <div class="e-icon">#</div>
      <p>هذا بداية قناة <strong>${esc(ch.name)}</strong></p>
    </div>`;
    return;
  }

  let html = '';
  ch.messages.forEach(msg => {
    if (msg.type === 'system') {
      html += `<div class="sys-divider">${esc(msg.text)}</div>`;
      return;
    }
    const u = DB.users[msg.user] || { display: msg.user, role: 'user' };
    const r = u.role || 'user';
    html += `<div class="msg-group">
      <div class="msg-av" style="background:${avatarColor(msg.user)}" onclick="showProfile('${msg.user}')">
        ${esc((u.avatar || u.display[0]).slice(0,2))}
      </div>
      <div class="msg-body">
        <div class="msg-meta">
          <span class="msg-author rc-${roleCls(r)}" onclick="showProfile('${msg.user}')">${esc(u.display)}</span>
          ${badge(r)}
          <span class="msg-ts">${fmtTime(msg.time)}</span>
        </div>
        <div class="msg-text">${esc(msg.text)}</div>
      </div>
    </div>`;
  });
  area.innerHTML = html;
  area.scrollTop = area.scrollHeight;
}

function handleChatKey(e) {
  if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMsg(); }
}

function sendMsg() {
  const input = document.getElementById('chatInputEl');
  const text  = input.value.trim();
  if (!text || !activeServer || !activeChannel) return;
  const sv = DB.servers[activeServer];
  const ch = sv?.channels.find(c => c.id === activeChannel);
  if (!ch) return;
  if (!ch.messages) ch.messages = [];
  ch.messages.push({ id: uid(), user: me.username, text, time: new Date().toISOString() });
  if (ch.messages.length > 500) ch.messages.shift();
  saveDB();
  input.value = '';
  renderMessages();
}

/* ══════════════════════════════
   CREATE SERVER
══════════════════════════════ */
function createServer() {
  const name  = document.getElementById('newSrvName').value.trim();
  const emoji = document.getElementById('newSrvEmoji').value.trim() || '🎮';
  const desc  = document.getElementById('newSrvDesc').value.trim();
  if (!name) { toast('❌ أدخل اسم السيرفر', 'err'); return; }

  const sid  = uid();
  const code = Math.random().toString(36).slice(2, 8).toUpperCase();

  DB.servers[sid] = {
    id: sid, name, emoji, desc,
    owner: me.username,
    createdAt: new Date().toISOString(),
    inviteCode: code,
    members: { [me.username]: { role: 'owner', joinDate: new Date().toISOString() } },
    channels: [
      { id: uid(), name: 'عام',         type: 'text',     category: 'القنوات العامة',  messages: [] },
      { id: uid(), name: 'الإعلانات',   type: 'announce', category: 'القنوات العامة',  messages: [] },
      { id: uid(), name: 'صوتي-عام',    type: 'voice',    category: 'القنوات الصوتية', messages: [] }
    ],
    logs: [], webhooks: [], bans: []
  };
  saveDB();
  closeModal('createServerModal');
  addLog(sid, 'إنشاء سيرفر', me.username, name);
  renderRail();
  openServer(sid);
  toast('✅ تم إنشاء السيرفر!');
}

/* ══════════════════════════════
   JOIN SERVER
══════════════════════════════ */
function joinServer() {
  const code = document.getElementById('joinCode').value.trim().toUpperCase();
  const sv   = Object.values(DB.servers).find(s => s.inviteCode === code);
  const errEl = document.getElementById('joinError');

  if (!sv) { errEl.style.display = 'block'; return; }
  if (sv.bans?.includes(me.username)) { toast('❌ أنت محظور من هذا السيرفر', 'err'); return; }
  if (sv.members[me.username]) { toast('أنت موجود في السيرفر!'); closeModal('joinServerModal'); openServer(sv.id); return; }

  sv.members[me.username] = { role: 'user', joinDate: new Date().toISOString() };
  saveDB();
  closeModal('joinServerModal');
  errEl.style.display = 'none';
  addLog(sv.id, 'انضمام للسيرفر', me.username);
  renderRail();
  openServer(sv.id);
  toast('✅ تم الانضمام بنجاح!');
}

/* ══════════════════════════════
   ADD CHANNEL
══════════════════════════════ */
function openAddChannel(sid, cat) {
  document.getElementById('addChCat').value = cat;
  document.getElementById('addChModal').dataset.sid = sid;
  openModal('addChModal');
}

function addChannel() {
  const modal   = document.getElementById('addChModal');
  const sid     = modal.dataset.sid || activeServer;
  const sv      = DB.servers[sid];
  const type    = document.getElementById('addChType').value;
  const name    = document.getElementById('addChName').value.trim();
  const cat     = document.getElementById('addChCat').value.trim() || 'القنوات';
  if (!name) { toast('❌ أدخل اسم القناة', 'err'); return; }
  sv.channels.push({ id: uid(), name, type, category: cat, messages: [] });
  saveDB();
  closeModal('addChModal');
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
    el.classList.toggle('active', el.dataset.tab === tab)
  );
  renderAdmin();
}

function renderAdmin() {
  const sv     = DB.servers[activeServer];
  const myRole = myServerRole(activeServer);
  const body   = document.getElementById('adminBody');
  if (!sv) { body.innerHTML = '<div class="empty"><p>لا يوجد سيرفر</p></div>'; return; }

  switch (adminTab) {
    case 'overview':  renderAdminOverview(sv, body, myRole);   break;
    case 'members':   renderAdminMembers(sv, body, myRole);    break;
    case 'roles':     renderAdminRoles(sv, body, myRole);      break;
    case 'channels':  renderAdminChannels(sv, body, myRole);   break;
    case 'webhooks':  renderAdminWebhooks(sv, body, myRole);   break;
    case 'logs':      renderAdminLogs(sv, body);               break;
    case 'bans':      renderAdminBans(sv, body, myRole);       break;
    case 'invites':   renderAdminInvites(sv, body, myRole);    break;
    case 'settings':  renderAdminSettings(sv, body, myRole);   break;
    default:          body.innerHTML = '<div class="empty"><p>قريباً</p></div>';
  }
}

/* ─ Overview ─ */
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
      <div style="display:flex;align-items:center;gap:12px">
        <div class="invite-code">${sv.inviteCode}</div>
        <button class="btn btn-ghost btn-sm" onclick="copyText('${sv.inviteCode}')">📋 نسخ</button>
      </div>
    </div>
    <div class="t-wrap">
      <div class="t-head"><h3>💡 معلومات السيرفر</h3></div>
      <table>
        <tr><td>الاسم</td><td style="color:var(--text-1);font-weight:600">${esc(sv.name)}</td></tr>
        <tr><td>الأونر</td><td class="rc-owner" style="font-weight:600">${esc(DB.users[sv.owner]?.display || sv.owner)}</td></tr>
        <tr><td>تاريخ الإنشاء</td><td>${fmtDate(sv.createdAt)}</td></tr>
        <tr><td>الوصف</td><td>${esc(sv.desc || '—')}</td></tr>
      </table>
    </div>
    ${myRole === 'owner' ? `<button class="btn btn-accent" onclick="openModal('createAccountModal')">👤 إنشاء حساب جديد</button>` : ''}
  `;
}

/* ─ Members ─ */
function renderAdminMembers(sv, el, myRole) {
  let rows = '';
  Object.entries(sv.members).forEach(([uname, m]) => {
    const u = DB.users[uname];
    if (!u) return;
    const role = u.role === 'owner' ? 'owner' : (m.role || 'user');
    const rb   = badge(role);
    const editable = (canManage(myRole, role) || myRole === 'owner') && role !== 'owner';

    rows += `<tr>
      <td>
        <div style="display:flex;align-items:center;gap:8px">
          <div style="width:28px;height:28px;border-radius:50%;background:${avatarColor(uname)};display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:700;color:#fff">
            ${esc((u.avatar || u.display[0]).slice(0,2))}
          </div>
          <div>
            <div style="font-weight:700;color:var(--text-1)">${esc(u.display)}</div>
            <div style="font-size:11px;color:var(--text-4)">${uname}</div>
          </div>
        </div>
      </td>
      <td>${rb || '<span style="color:var(--text-4)">عضو</span>'}</td>
      <td>${fmtDate(m.joinDate || sv.createdAt)}</td>
      <td style="display:flex;gap:6px;align-items:center">
        ${editable ? `
          <select class="role-sel" onchange="setMemberRole('${activeServer}','${uname}',this.value)">
            <option value="user"      ${role==='user'?'selected':''}>عضو</option>
            <option value="helper"    ${role==='helper'?'selected':''}>هيلبر</option>
            <option value="super"     ${role==='super'?'selected':''}>سوبر أدمن</option>
            <option value="head"      ${role==='head'?'selected':''}>هيد أدمن</option>
            <option value="admin-mgr" ${role==='admin-mgr'?'selected':''}>أدمن مانجر</option>
            <option value="manager"   ${role==='manager'?'selected':''}>مانجر</option>
            <option value="leader"    ${role==='leader'?'selected':''}>ليدر</option>
          </select>
          <button class="btn btn-warn btn-sm"   onclick="kickMember('${activeServer}','${uname}')">👟 طرد</button>
          <button class="btn btn-danger btn-sm" onclick="banMember('${activeServer}','${uname}')">🔨 حظر</button>
        ` : '<span style="color:var(--text-4);font-size:13px">—</span>'}
      </td>
    </tr>`;
  });

  el.innerHTML = `
    <div class="a-title">👥 إدارة الأعضاء</div>
    <div class="a-sub">إدارة أعضاء السيرفر وصلاحياتهم</div>
    <div class="t-wrap">
      <div class="t-head"><h3>الأعضاء (${Object.keys(sv.members).length})</h3></div>
      <table>
        <thead><tr><th>العضو</th><th>الرتبة</th><th>تاريخ الانضمام</th><th>الإجراءات</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
  `;
}

function setMemberRole(sid, uname, newRole) {
  const sv = DB.servers[sid];
  if (!sv?.members[uname]) return;
  sv.members[uname].role = newRole;
  if (DB.users[uname]) DB.users[uname].role = newRole;
  saveDB();
  addLog(sid, 'تغيير رتبة', me.username, `${uname} ← ${newRole}`);
  toast(`✅ تم تغيير رتبة ${DB.users[uname]?.display || uname} إلى ${roleLabel(newRole) || newRole}`);
  renderAdmin();
  renderMembers(sid);
}

function kickMember(sid, uname) {
  if (uname === me.username) { toast('❌ لا يمكنك طرد نفسك', 'err'); return; }
  delete DB.servers[sid].members[uname];
  saveDB();
  addLog(sid, 'طرد عضو', me.username, uname);
  toast(`👟 تم طرد ${DB.users[uname]?.display || uname}`);
  renderAdmin(); renderMembers(sid);
}

function banMember(sid, uname) {
  if (uname === me.username) { toast('❌ لا يمكنك حظر نفسك', 'err'); return; }
  const sv = DB.servers[sid];
  if (!sv.bans) sv.bans = [];
  if (!sv.bans.includes(uname)) sv.bans.push(uname);
  delete sv.members[uname];
  saveDB();
  addLog(sid, 'حظر عضو', me.username, uname);
  toast(`🔨 تم حظر ${DB.users[uname]?.display || uname}`);
  renderAdmin(); renderMembers(sid);
}

/* ─ Roles ─ */
function renderAdminRoles(sv, el, myRole) {
  const roleData = [
    { key:'leader',    name:'ليدر',       color:'var(--c-leader)',    perms:['كل الصلاحيات تقريباً','إدارة الأعضاء','طرد/حظر'] },
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

/* ─ Channels ─ */
function renderAdminChannels(sv, el, myRole) {
  let rows = sv.channels.map(ch => {
    const sym = ch.type==='voice'?'🔊 صوتية':ch.type==='announce'?'📢 إعلانات':'💬 نصية';
    return `<tr>
      <td style="font-weight:600;color:var(--text-1)">${esc(ch.name)}</td>
      <td>${sym}</td>
      <td>${esc(ch.category||'—')}</td>
      <td>${ch.messages?.length||0}</td>
      <td>${(myRole==='owner'||myRole==='leader') ? `<button class="btn btn-danger btn-sm" onclick="deleteChannel('${activeServer}','${ch.id}')">🗑️ حذف</button>` : '—'}</td>
    </tr>`;
  }).join('');

  el.innerHTML = `
    <div class="a-title">💬 إدارة القنوات</div>
    <div class="a-sub">إدارة وتنظيم قنوات السيرفر</div>
    <div style="margin-bottom:16px">
      <button class="btn btn-accent" onclick="openAddChannel('${activeServer}','')">➕ إضافة قناة</button>
    </div>
    <div class="t-wrap">
      <table>
        <thead><tr><th>الاسم</th><th>النوع</th><th>الفئة</th><th>الرسائل</th><th>إجراءات</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
  `;
}

function deleteChannel(sid, cid) {
  const sv = DB.servers[sid];
  sv.channels = sv.channels.filter(c => c.id !== cid);
  saveDB();
  addLog(sid, 'حذف قناة', me.username);
  if (activeChannel === cid) { activeChannel = null; showScreen('homeScreen'); }
  renderAdmin(); renderChannels(sid);
  toast('🗑️ تم حذف القناة');
}

/* ─ Webhooks ─ */
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
  saveDB();
  addLog(sid, 'إنشاء ويبهوك', me.username, name);
  toast('✅ تم إنشاء الويبهوك!');
  renderAdmin();
}

function deleteWebhook(sid, wid) {
  DB.servers[sid].webhooks = DB.servers[sid].webhooks.filter(w => w.id !== wid);
  saveDB();
  toast('🗑️ تم حذف الويبهوك');
  renderAdmin();
}

/* ─ Logs ─ */
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
      <div class="t-head"><h3>السجلات (${logs.length})</h3></div>
      ${rows || '<div class="empty"><div class="e-icon">📋</div><p>لا توجد سجلات بعد</p></div>'}
    </div>
  `;
}

/* ─ Bans ─ */
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
      <table>
        <thead><tr><th>الاسم</th><th>المستخدم</th><th>إجراءات</th></tr></thead>
        <tbody>${rows || `<tr><td colspan="3" style="text-align:center;color:var(--text-4);padding:20px">لا يوجد محظورون</td></tr>`}</tbody>
      </table>
    </div>
  `;
}

function unbanMember(sid, uname) {
  DB.servers[sid].bans = DB.servers[sid].bans.filter(b => b !== uname);
  saveDB();
  addLog(sid, 'رفع الحظر', me.username, uname);
  toast(`✅ تم رفع الحظر عن ${DB.users[uname]?.display || uname}`);
  renderAdmin();
}

/* ─ Invites ─ */
function renderAdminInvites(sv, el, myRole) {
  el.innerHTML = `
    <div class="a-title">📨 الدعوات</div>
    <div class="a-sub">إدارة روابط الدعوة</div>
    <div class="invite-card">
      <div><h3>كود الدعوة الحالي</h3><p>شارك هذا الكود مع من تريد دعوته</p></div>
      <div style="display:flex;align-items:center;gap:12px">
        <div class="invite-code">${sv.inviteCode}</div>
        <button class="btn btn-ghost btn-sm" onclick="copyText('${sv.inviteCode}')">📋 نسخ</button>
        ${(myRole==='owner'||myRole==='leader') ? `<button class="btn btn-danger btn-sm" onclick="regenInvite('${activeServer}')">🔄 تجديد</button>` : ''}
      </div>
    </div>
  `;
}

function regenInvite(sid) {
  DB.servers[sid].inviteCode = Math.random().toString(36).slice(2,8).toUpperCase();
  saveDB();
  addLog(sid, 'تجديد كود الدعوة', me.username);
  toast('✅ تم تجديد كود الدعوة!');
  renderAdmin();
}

/* ─ Server Settings ─ */
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
    <div style="display:flex;gap:8px;margin-top:16px">
      <button class="btn btn-accent" onclick="saveServerSettings('${activeServer}')">💾 حفظ</button>
      <button class="btn btn-danger" onclick="confirmDelete('${activeServer}')">🗑️ حذف السيرفر</button>
    </div>
  `;
}

function saveServerSettings(sid) {
  const sv = DB.servers[sid];
  sv.name  = document.getElementById('edName')?.value.trim()  || sv.name;
  sv.emoji = document.getElementById('edEmoji')?.value.trim() || sv.emoji;
  sv.desc  = document.getElementById('edDesc')?.value.trim();
  saveDB();
  addLog(sid, 'تعديل إعدادات السيرفر', me.username);
  renderRail();
  document.getElementById('srvHeader').innerHTML = `<span>${esc(sv.emoji)} ${esc(sv.name)}</span><span class="chevron">▾</span>`;
  toast('✅ تم حفظ الإعدادات!');
}

function confirmDelete(sid) {
  if (confirm('هل أنت متأكد من حذف السيرفر؟ لا يمكن التراجع!')) {
    delete DB.servers[sid];
    saveDB();
    toast('🗑️ تم حذف السيرفر');
    activeServer = null; activeChannel = null;
    renderRail(); openHome();
  }
}

/* ══════════════════════════════
   SETTINGS MODAL
══════════════════════════════ */
function openSettings() { openModal('settingsModal'); renderSettings('profile'); }

function renderSettings(tab) {
  settingsTab = tab;
  document.querySelectorAll('#settingsModal .tab-btn').forEach(el =>
    el.classList.toggle('active', el.dataset.tab === tab)
  );
  const u   = DB.users[me.username];
  const con = document.getElementById('settingsBody');

  if (tab === 'profile') {
    con.innerHTML = `
      <div class="form-group"><label>الاسم المعروض</label><input id="setDisplay" type="text" value="${esc(u.display)}"></div>
      <div class="form-group"><label>الأفاتار / إيموجي</label><input id="setAvatar" type="text" value="${esc(u.avatar||u.display[0])}" maxlength="2"></div>
    `;
  } else if (tab === 'security') {
    con.innerHTML = `
      <div class="form-group"><label>كلمة المرور الحالية</label><input id="setOldPass" type="password" placeholder="أدخل كلمة المرور الحالية"></div>
      <div class="form-group"><label>كلمة المرور الجديدة</label><input id="setNewPass" type="password" placeholder="أدخل كلمة المرور الجديدة"></div>
    `;
  } else {
    con.innerHTML = '<div class="empty"><div class="e-icon">🔔</div><p>إعدادات الإشعارات قريباً!</p></div>';
  }
}

function saveSettings() {
  const u = DB.users[me.username];
  if (settingsTab === 'profile') {
    const d  = document.getElementById('setDisplay')?.value.trim();
    const av = document.getElementById('setAvatar')?.value.trim();
    if (d)  { u.display = d; me.display = d; }
    if (av) { u.avatar  = av; }
    saveDB(); refreshUserBar();
    toast('✅ تم حفظ الملف الشخصي!');
  } else if (settingsTab === 'security') {
    const op = document.getElementById('setOldPass')?.value;
    const np = document.getElementById('setNewPass')?.value;
    if (!op || !np) { toast('❌ أدخل كلمتي المرور', 'err'); return; }
    if (u.password !== op) { toast('❌ كلمة المرور الحالية غلط', 'err'); return; }
    u.password = np; saveDB();
    toast('✅ تم تغيير كلمة المرور!');
  }
}

/* ══════════════════════════════
   CREATE ACCOUNT (Owner only)
══════════════════════════════ */
function createAccount() {
  const u    = document.getElementById('accUser').value.trim().toLowerCase();
  const disp = document.getElementById('accDisplay').value.trim();
  const p    = document.getElementById('accPass').value;
  const role = document.getElementById('accRole').value;
  const errEl = document.getElementById('accError');

  if (!u || !disp || !p) { showErr(errEl, '❌ يرجى ملء جميع الحقول'); return; }
  if (DB.users[u])       { showErr(errEl, '❌ اسم المستخدم مستخدم');   return; }

  DB.users[u] = {
    password: p, display: disp,
    tag: '#' + String(Object.keys(DB.users).length + 1).padStart(4,'0'),
    role, avatar: '😀', status: 'offline',
    joinDate: new Date().toISOString()
  };
  saveDB();
  addLog(activeServer, 'إنشاء حساب جديد', me.username, `${u} (${disp})`);
  closeModal('createAccountModal');
  ['accUser','accDisplay','accPass'].forEach(id => { const el = document.getElementById(id); if(el) el.value=''; });
  errEl.style.display = 'none';
  toast(`✅ تم إنشاء حساب ${disp} بنجاح!`);
}

/* ══════════════════════════════
   PROFILE POPUP
══════════════════════════════ */
function showProfile(uname) {
  const u = DB.users[uname];
  if (!u) return;
  toast(`👤 ${u.display} ${u.tag} ${roleLabel(u.role) ? '• ' + roleLabel(u.role) : ''}`);
}

/* ══════════════════════════════
   MODAL HELPERS
══════════════════════════════ */
function openModal(id)  { document.getElementById(id).classList.remove('hidden'); }
function closeModal(id) { document.getElementById(id).classList.add('hidden'); }

function copyText(t) {
  navigator.clipboard.writeText(t)
    .then(()  => toast('📋 تم النسخ!'))
    .catch(()  => toast('الكود: ' + t));
}

/* ══════════════════════════════
   INIT
══════════════════════════════ */
document.addEventListener('DOMContentLoaded', () => {
  loadDB();
  showScreen('homeScreen');

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
  ['regUser','regDisplay','regPass'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.addEventListener('keydown', e => { if(e.key==='Enter') doRegister(); });
  });
});
