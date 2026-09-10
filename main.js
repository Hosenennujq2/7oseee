'use strict';
/* ═══════════════════════════════════════════════
   DATABASE
═══════════════════════════════════════════════ */
const STORE_KEY='tiscord_v5';
let DB={users:{},servers:{},logs:[],dms:{},friendRequests:[],version:5};
function saveDB(){try{localStorage.setItem(STORE_KEY,JSON.stringify(DB));}catch(e){}}
function loadDB(){
  try{const raw=localStorage.getItem(STORE_KEY);if(raw){const p=JSON.parse(raw);if(p?.version>=2){DB=p;}DB.version=5;}}catch(e){}
  if(!DB.users['hosennujq2']) DB.users['hosennujq2']={password:'qwaszx1202',display:'هوسن',tag:'#0001',role:'owner',avatar:'👑',status:'online',joinDate:new Date().toISOString(),email:'hosennujq2@gmail.com',bio:'',theme:'dark',banner:'',bannerColor:'#5865f2',badges:['owner','developer'],nitro:true,boosts:2,friends:[],customStatus:''};
  if(!DB.servers)DB.servers={};
  if(!DB.logs)DB.logs=[];
  if(!DB.dms)DB.dms={};
  if(!DB.friendRequests)DB.friendRequests=[];
  if(!DB.groups)DB.groups={};
  if(!DB.coOwners)DB.coOwners=[];
  if(!DB.staffStats)DB.staffStats={};
  if(!DB.announcement)DB.announcement={active:false,text:'',color:'#5865f2'};
  Object.values(DB.users).forEach(u=>{if(!u.friends)u.friends=[];if(u.customStatus===undefined)u.customStatus='';});
  Object.values(DB.servers).forEach(sv=>{
    if(!sv.automod)sv.automod={bannedWords:[],antiLink:false,antiInvite:false,antiSpam:false};
    if(!sv.warnings)sv.warnings={};
    if(!sv.customRoles)sv.customRoles=[];
    if(!sv.tickets)sv.tickets=[];
  });
  saveDB();
}

/* ═══════════════════════════════════════════════
   STATE
═══════════════════════════════════════════════ */
let me=null,activeServer=null,activeChannel=null,activeDM=null;
let showMembers=true,adminTab='overview',settingsTab='profile';
let replyTo=null,voiceRoom=null,localStream=null;

/* ═══════════════════════════════════════════════
   HELPERS
═══════════════════════════════════════════════ */
function uid(){return Date.now().toString(36)+Math.random().toString(36).slice(2);}
function esc(s){return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');}
function fmtTime(iso){return new Date(iso).toLocaleTimeString('ar-SA',{hour:'2-digit',minute:'2-digit'});}
function fmtDate(iso){return new Date(iso).toLocaleDateString('ar-SA');}
function fmtRel(iso){const d=Date.now()-new Date(iso).getTime();if(d<60000)return 'الآن';if(d<3600000)return 'منذ '+Math.floor(d/60000)+' دقيقة';if(d<86400000)return 'منذ '+Math.floor(d/3600000)+' ساعة';return fmtDate(iso);}
function toast(msg,type='ok'){const c=document.getElementById('toastContainer');if(!c)return;const t=document.createElement('div');t.className='toast '+type;t.textContent=msg;c.appendChild(t);setTimeout(()=>{t.style.opacity='0';t.style.transform='translateY(8px)';t.style.transition='.3s';},2800);setTimeout(()=>t.remove(),3200);}
function addLog(sid,action,by,target=''){const e={id:uid(),action,by,target,time:new Date().toISOString()};DB.logs.unshift(e);if(DB.logs.length>500)DB.logs.pop();if(sid&&DB.servers[sid]){if(!DB.servers[sid].logs)DB.servers[sid].logs=[];DB.servers[sid].logs.unshift(e);if(DB.servers[sid].logs.length>200)DB.servers[sid].logs.pop();}saveDB();}
function copyText(t){navigator.clipboard.writeText(t).then(()=>toast('📋 تم النسخ!')).catch(()=>toast('الكود: '+t));}
function openModal(id){document.getElementById(id)?.classList.remove('hidden');}
function closeModal(id){document.getElementById(id)?.classList.add('hidden');}

/* ═══════════════════════════════════════════════
   ROLES + PERMISSIONS
═══════════════════════════════════════════════ */
const ROLE_ORDER=['owner','leader','manager','admin-mgr','head','super','helper','user'];
const ROLE_PERMS={
  owner:      {color:'#f5c518',icon:'👑',canBan:true, canKick:true, canMute:true, canManageChannels:true, canManageRoles:true, canManageServer:true, canSendMsg:true,canDeleteMsg:true,canPinMsg:true, canViewLogs:true, canGiveNitro:true, canGiveBadges:true, canManageVoice:true, label:'أونر'},
  leader:     {color:'#e74c3c',icon:'🔴',canBan:true, canKick:true, canMute:true, canManageChannels:true, canManageRoles:true, canManageServer:false,canSendMsg:true,canDeleteMsg:true,canPinMsg:true, canViewLogs:true, canGiveNitro:false,canGiveBadges:false,canManageVoice:true, label:'ليدر'},
  manager:    {color:'#e67e22',icon:'🟠',canBan:true, canKick:true, canMute:true, canManageChannels:true, canManageRoles:false,canManageServer:false,canSendMsg:true,canDeleteMsg:true,canPinMsg:true, canViewLogs:true, canGiveNitro:false,canGiveBadges:false,canManageVoice:true, label:'مانجر'},
  'admin-mgr':{color:'#f1c40f',icon:'🟡',canBan:false,canKick:true, canMute:true, canManageChannels:false,canManageRoles:false,canManageServer:false,canSendMsg:true,canDeleteMsg:true,canPinMsg:true, canViewLogs:true, canGiveNitro:false,canGiveBadges:false,canManageVoice:true, label:'أدمن مانجر'},
  head:       {color:'#2ecc71',icon:'🟢',canBan:false,canKick:true, canMute:true, canManageChannels:false,canManageRoles:false,canManageServer:false,canSendMsg:true,canDeleteMsg:true,canPinMsg:true, canViewLogs:false,canGiveNitro:false,canGiveBadges:false,canManageVoice:true, label:'هيد أدمن'},
  super:      {color:'#3498db',icon:'🔵',canBan:false,canKick:false,canMute:true, canManageChannels:false,canManageRoles:false,canManageServer:false,canSendMsg:true,canDeleteMsg:true,canPinMsg:false,canViewLogs:false,canGiveNitro:false,canGiveBadges:false,canManageVoice:true, label:'سوبر أدمن'},
  helper:     {color:'#9b59b6',icon:'🟣',canBan:false,canKick:false,canMute:true, canManageChannels:false,canManageRoles:false,canManageServer:false,canSendMsg:true,canDeleteMsg:false,canPinMsg:false,canViewLogs:false,canGiveNitro:false,canGiveBadges:false,canManageVoice:false,label:'هيلبر'},
  user:       {color:'#95a5a6',icon:'⚪',canBan:false,canKick:false,canMute:false,canManageChannels:false,canManageRoles:false,canManageServer:false,canSendMsg:true,canDeleteMsg:false,canPinMsg:false,canViewLogs:false,canGiveNitro:false,canGiveBadges:false,canManageVoice:false,label:'عضو'},
};
function hasPerm(role,perm){return ROLE_PERMS[role]?.[perm]===true;}
function getRoleColor(r){return ROLE_PERMS[r]?.color||'#95a5a6';}
function getRoleIcon(r){return ROLE_PERMS[r]?.icon||'⚪';}
function roleIndex(r){const i=ROLE_ORDER.indexOf(r);return i===-1?7:i;}
function canManage(a,b){return roleIndex(a)<roleIndex(b);}
function isStaff(r){return roleIndex(r)<7;}
function roleLabel(r){return ROLE_PERMS[r]?.label||'';}
function roleCls(r){return{owner:'owner',leader:'leader',manager:'manager','admin-mgr':'admin-mgr',head:'head',super:'super',helper:'helper',user:'user'}[r]||'user';}
function badge(r){const l=roleLabel(r);if(!l||r==='user')return '';const color=getRoleColor(r);const icon=getRoleIcon(r);return `<span class="role-badge rb-${roleCls(r)}" style="border-color:${color}22;color:${color}">${icon} ${l}</span>`;}
function avatarColor(u){const p=['#5865f2','#3ba55c','#ed4245','#faa61a','#9b59b6','#3498db','#1abc9c','#e74c3c','#e67e22','#16a085'];let h=0;for(let i=0;i<u.length;i++)h=(h+u.charCodeAt(i))%p.length;return p[h];}
function customTagHtml(sid,uname){
  const sv=DB.servers[sid];const m=sv?.members?.[uname];if(!m?.customTag)return '';
  const tag=(sv.customRoles||[]).find(t=>t.id===m.customTag);if(!tag)return '';
  return `<span class="custom-tag" style="background:${tag.color}26;color:${tag.color};border:1px solid ${tag.color}66">${esc(tag.icon||'🏷️')} ${esc(tag.name)}</span>`;
}
function myServerRole(sid){const sv=DB.servers[sid];if(!sv)return 'user';const u=DB.users[me?.username];if(u?.role==='owner')return 'owner';if(sv.owner===me?.username)return 'owner';return sv.members?.[me?.username]?.role||'user';}
function isOwnerUser(){return me?.username==='hosennujq2'||(DB.coOwners||[]).includes(me?.username);}
function isMainOwner(){return me?.username==='hosennujq2';}

/* ═══════════════════════════════════════════════
   BADGES
═══════════════════════════════════════════════ */
const BADGES_DEF={owner:{icon:'👑',label:'أونر التطبيق',color:'#f5c518'},developer:{icon:'🔧',label:'مطوّر',color:'#5865f2'},nitro:{icon:'💎',label:'نيترو',color:'#9b59b6'},early:{icon:'⭐',label:'عضو مبكر',color:'#faa61a'},booster:{icon:'🚀',label:'بوستر',color:'#ff73fa'},moderator:{icon:'🛡️',label:'مودريتور',color:'#3498db'},verified:{icon:'✅',label:'موثّق',color:'#3ba55c'},artist:{icon:'🎨',label:'فنان',color:'#e74c3c'},streamer:{icon:'📺',label:'ستريمر',color:'#9146ff'}};
function renderBadges(u){if(!u?.badges?.length)return '';return u.badges.map(b=>{const d=BADGES_DEF[b];if(!d)return '';return `<span class="badge-icon" title="${d.label}" style="color:${d.color}">${d.icon}</span>`;}).join('');}
function hasNitro(uname){const u=DB.users[uname];if(!u?.nitro)return false;if(u.nitroExpiry&&new Date(u.nitroExpiry)<new Date()){u.nitro=false;u.badges=(u.badges||[]).filter(b=>b!=='nitro');saveDB();return false;}return true;}

/* ═══════════════════════════════════════════════
   EMOJI
═══════════════════════════════════════════════ */
const EMOJIS=['😀','😂','🥰','😍','🤔','😭','😤','🔥','❤️','✨','🎉','👏','🙏','💯','🎮','👍','👎','😊','🤣','😅','😱','🤯','😴','🤗','😎','🤩','😏','🙄','😒','😔','🌟','💪','🏆','🎯','💡','🚀','⚡','🌈','💎','🦋'];
function toggleEmojiPicker(){const p=document.getElementById('emojiPicker');if(!p)return;if(p.classList.contains('hidden')){p.innerHTML=EMOJIS.map(e=>`<div class="emoji-item" onclick="insertEmoji('${e}')">${e}</div>`).join('');p.classList.remove('hidden');}else p.classList.add('hidden');}
function insertEmoji(e){const inp=document.getElementById('chatInputEl')||document.getElementById('dmInputEl');if(!inp)return;const pos=inp.selectionStart;inp.value=inp.value.slice(0,pos)+e+inp.value.slice(pos);inp.focus();inp.setSelectionRange(pos+e.length,pos+e.length);document.getElementById('emojiPicker')?.classList.add('hidden');}
document.addEventListener('click',ev=>{const p=document.getElementById('emojiPicker');if(p&&!p.contains(ev.target)&&!ev.target.classList.contains('emoji-btn'))p.classList.add('hidden');});

/* ═══════════════════════════════════════════════
   MARKDOWN
═══════════════════════════════════════════════ */
function processMsg(t){
  let s=esc(t);
  s=s.replace(/```([\s\S]*?)```/g,'<pre class="msg-code-block"><code>$1</code></pre>');
  s=s.replace(/`([^`]+)`/g,'<code class="msg-code">$1</code>');
  s=s.replace(/\*\*(.+?)\*\*/g,'<strong>$1</strong>');
  s=s.replace(/\*(.+?)\*/g,'<em>$1</em>');
  s=s.replace(/~~(.+?)~~/g,'<del>$1</del>');
  s=s.replace(/https?:\/\/[^\s<>"]+/gi,url=>`<a href="${url}" target="_blank" rel="noopener noreferrer">${url}</a>`);
  return s;
}

/* ═══════════════════════════════════════════════
   AUTH
═══════════════════════════════════════════════ */
function switchAuthTab(tab){document.getElementById('loginForm').classList.toggle('hidden',tab!=='login');document.getElementById('registerForm').classList.toggle('hidden',tab!=='register');document.querySelectorAll('.auth-tab').forEach((el,i)=>el.classList.toggle('active',(tab==='login'&&i===0)||(tab==='register'&&i===1)));}
function doGoogleLogin(){const fb=window._firebase;if(!fb?.ready){toast('⚠️ Firebase غير مفعّل','err');return;}const provider=new fb.GoogleAuthProvider();fb.signInWithPopup(fb.auth,provider).then(r=>handleFirebaseUser(r.user)).catch(()=>toast('❌ فشل تسجيل الدخول','err'));}
async function handleFirebaseUser(fu){const username='g_'+fu.uid.slice(0,8);if(!DB.users[username])DB.users[username]={password:fu.uid,display:fu.displayName||username,tag:'#GOOG',role:'user',avatar:'😀',status:'online',joinDate:new Date().toISOString(),email:fu.email||'',photoURL:fu.photoURL||'',banner:'',bannerColor:'#5865f2',badges:['early'],nitro:false,boosts:0,friends:[],customStatus:''};DB.users[username].photoURL=fu.photoURL||'';if(!DB.users[username].friends)DB.users[username].friends=[];saveDB();me={username,...DB.users[username]};bootApp();}
async function sha256Hex(str){
  if(!window.crypto?.subtle)return 'plain:'+str;
  const buf=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(str));
  return 'sha256:'+Array.from(new Uint8Array(buf)).map(b=>b.toString(16).padStart(2,'0')).join('');
}
async function verifyPassword(stored,input){
  if(!stored)return false;
  if(stored.startsWith('sha256:'))return (await sha256Hex(input))===stored;
  if(stored.startsWith('plain:'))return stored==='plain:'+input;
  return stored===input;
}
async function doLogin(){const u=document.getElementById('loginUser').value.trim().toLowerCase();const p=document.getElementById('loginPass').value;const errEl=document.getElementById('loginError');const user=DB.users[u];if(!user||!(await verifyPassword(user.password,p))){showErr(errEl,'❌ اسم المستخدم أو كلمة المرور غلط');document.getElementById('loginPass').value='';return;}if(user.banned){showErr(errEl,'🔨 هذا الحساب محظور من التطبيق');return;}if(DB.maintenance?.active&&u!=='hosennujq2'&&!(DB.coOwners||[]).includes(u)){showErr(errEl,'🛠️ '+(DB.maintenance.message||'التطبيق تحت الصيانة حالياً'));return;}if(!user.password.startsWith('sha256:')&&!user.password.startsWith('plain:')){DB.users[u].password=await sha256Hex(p);}errEl.style.display='none';DB.users[u].status='online';saveDB();me={username:u,...DB.users[u]};addLog(null,'تسجيل دخول',u);logLogin(u);bootApp();}
async function doRegister(){const u=document.getElementById('regUser').value.trim().toLowerCase();const disp=document.getElementById('regDisplay').value.trim();const email=document.getElementById('regEmail').value.trim();const p=document.getElementById('regPass').value;const errEl=document.getElementById('regError');if(!u||!disp||!p){showErr(errEl,'❌ يرجى ملء جميع الحقول');return;}if(u.length<3){showErr(errEl,'❌ اسم المستخدم قصير');return;}if(!/^[a-z0-9_]+$/.test(u)){showErr(errEl,'❌ أحرف إنجليزية وأرقام فقط');return;}if(p.length<6){showErr(errEl,'❌ كلمة المرور قصيرة');return;}if(DB.users[u]){showErr(errEl,'❌ اسم المستخدم مستخدم');return;}const tag='#'+String(Object.keys(DB.users).length+1).padStart(4,'0');const hashed=await sha256Hex(p);DB.users[u]={password:hashed,display:disp,tag,email,role:'user',avatar:'😀',status:'online',joinDate:new Date().toISOString(),theme:'dark',bio:'',banner:'',bannerColor:'#5865f2',badges:['early'],nitro:false,boosts:0,friends:[],customStatus:''};saveDB();me={username:u,...DB.users[u]};addLog(null,'تسجيل حساب',u);bootApp();}
function showErr(el,msg){el.textContent=msg;el.style.display='block';}
function doLogout(){leaveVoiceChannel();if(me&&DB.users[me.username])DB.users[me.username].status='offline';saveDB();const fb=window._firebase;if(fb?.ready&&fb.auth?.currentUser)fb.signOut(fb.auth).catch(()=>{});me=null;activeServer=null;activeChannel=null;activeDM=null;document.getElementById('app').classList.add('hidden');document.getElementById('authPage').classList.remove('hidden');}
function checkPassStrength(p){const el=document.getElementById('passStrength');if(!el)return;if(!p){el.className='pass-strength';return;}let s=0;if(p.length>=8)s++;if(/[A-Za-z]/.test(p))s++;if(/[0-9]/.test(p))s++;if(/[^A-Za-z0-9]/.test(p))s++;el.className='pass-strength '+(s<=1?'weak':s<=2?'medium':'strong');}
function handleTyping(el){el.style.height='auto';el.style.height=Math.min(el.scrollHeight,120)+'px';if(el.id==='regPass')checkPassStrength(el.value);}
function togglePass(inputId,btn){const el=document.getElementById(inputId);if(!el)return;el.type=el.type==='password'?'text':'password';btn.textContent=el.type==='password'?'👁️':'🙈';}

/* ═══════════════════════════════════════════════
   BOOT
═══════════════════════════════════════════════ */
function bootApp(){
  document.getElementById('splashScreen')?.classList.add('hidden');
  document.getElementById('authPage').classList.add('hidden');
  document.getElementById('app').classList.remove('hidden');
  applyTheme(DB.users[me.username]?.theme||'dark');
  loadAccentColor();
  setTimeout(loadChatBg,300);
  if(DB.users[me.username]?.fontSize)document.body.style.fontSize=DB.users[me.username].fontSize+'px';
  refreshUserBar();renderRail();openHome();renderOwnerPanel();showAnnouncementBanner();toast('أهلاً، '+(DB.users[me.username]?.display||me.username)+' 👋');checkInviteUrl();
}
function showAnnouncementBanner(){
  document.getElementById('globalAnnounceBar')?.remove();
  const a=DB.announcement;
  if(!a?.active||!a.text)return;
  if(a.scheduledAt&&a.scheduledAt>Date.now())return;
  if(sessionStorage.getItem('announce_dismissed')===a.text)return;
  const bar=document.createElement('div');
  bar.id='globalAnnounceBar';
  bar.className='global-announce-bar';
  bar.style.background=a.color||'#5865f2';
  bar.innerHTML=`<span>📢 ${esc(a.text)}</span><button onclick="dismissAnnouncement()">✕</button>`;
  document.getElementById('app').prepend(bar);
}
function dismissAnnouncement(){sessionStorage.setItem('announce_dismissed',DB.announcement?.text||'');document.getElementById('globalAnnounceBar')?.remove();}
function refreshUserBar(){const u=DB.users[me.username];if(!u)return;document.getElementById('barName').textContent=u.display;document.getElementById('barTag').textContent=u.tag;const av=document.getElementById('barAvatar');av.style.background=avatarColor(me.username);if(u.photoURL)av.innerHTML=`<img src="${u.photoURL}" style="width:100%;height:100%;border-radius:50%;object-fit:cover"><div class="u-status ${u.status||'online'}" id="barStatus"></div>`;else av.innerHTML=`<span>${esc((u.avatar||u.display[0]).slice(0,2))}</span><div class="u-status ${u.status||'online'}" id="barStatus"></div>`;}
function applyTheme(t){document.body.classList.toggle('theme-light',t==='light');document.body.classList.toggle('theme-dark',t!=='light');}
function statusLabel(s){return{online:'🟢 متاح',idle:'🟡 بعيد',dnd:'🔴 لا تزعج',offline:'⚫ غير متاح'}[s]||'⚫ غير متاح';}

/* ═══════════════════════════════════════════════
   SCREENS
═══════════════════════════════════════════════ */
function showScreen(id){['homeScreen','chatScreen','adminScreen','voiceScreen','dmScreen'].forEach(s=>{const el=document.getElementById(s);if(!el)return;const show=s===id;el.classList.toggle('hidden',!show);el.style.display=show?'flex':'none';});}

/* ═══════════════════════════════════════════════
   RAIL
═══════════════════════════════════════════════ */
function renderRail(){
  const cont=document.getElementById('railServers');cont.innerHTML='';
  const pending=getPendingCount();
  const dmBtn=document.getElementById('dmRailBtn');
  if(dmBtn){
    dmBtn.classList.toggle('active',!!activeDM&&!activeServer);
    let badge=dmBtn.querySelector('.notif-badge');
    if(pending>0){if(!badge){badge=document.createElement('div');badge.className='notif-badge';dmBtn.appendChild(badge);}badge.textContent=pending;}
    else if(badge)badge.remove();
  }
  document.getElementById('homeBtn')?.classList.toggle('active',!activeServer&&!activeDM);
  Object.entries(DB.servers).forEach(([sid,sv])=>{
    if(!sv.members?.[me.username])return;
    const el=document.createElement('div');
    el.className='s-icon'+(activeServer===sid?' active':'');
    el.title=sv.name;el.innerHTML=`${esc(sv.emoji||sv.name[0])}<div class="server-pip"></div>`;
    el.onclick=()=>openServer(sid);cont.appendChild(el);
  });
}
function getPendingCount(){if(!me)return 0;return(DB.friendRequests||[]).filter(r=>r.to===me.username&&r.status==='pending').length;}

/* ═══════════════════════════════════════════════
   HOME
═══════════════════════════════════════════════ */
function openHome(){
  activeServer=null;activeChannel=null;activeDM=null;renderRail();
  document.getElementById('srvHeader').innerHTML='<span>🏠 الرئيسية</span>';
  document.getElementById('chScroll').innerHTML=`
    <div class="ch-item" onclick="openDMView()"><span class="ch-sym">💬</span> الرسائل المباشرة</div>
    <div class="ch-item" onclick="openModal('createServerModal')"><span class="ch-sym">➕</span> إنشاء سيرفر</div>
    <div class="ch-item" onclick="openModal('joinServerModal')"><span class="ch-sym">🔗</span> الانضمام بكود</div>`;
  const mp=document.getElementById('membersPanel');if(mp)mp.innerHTML='';
  showScreen('homeScreen');
  document.getElementById('homeScreen').innerHTML=`
    <div class="home-logo">🎮</div>
    <h1 class="home-title">أهلاً في Tiscord!</h1>
    <p class="home-sub">ابدأ بإنشاء سيرفر أو انضم لسيرفر موجود</p>
    <div class="home-actions">
      <button class="btn btn-accent" onclick="openModal('createServerModal')">➕ إنشاء سيرفر</button>
      <button class="btn btn-ghost" onclick="openModal('joinServerModal')">🔗 الانضمام بكود</button>
      <button class="btn btn-ghost" onclick="openDMView()">💬 الرسائل</button>
    </div>
    <div class="home-features">
      <div class="feat-card"><div class="feat-icon">💬</div><div class="feat-text">دردشة نصية</div></div>
      <div class="feat-card"><div class="feat-icon">🔊</div><div class="feat-text">غرف صوتية</div></div>
      <div class="feat-card"><div class="feat-icon">📢</div><div class="feat-text">إعلانات</div></div>
      <div class="feat-card"><div class="feat-icon">👥</div><div class="feat-text">إدارة الأعضاء</div></div>
    </div>`;
}

/* ═══════════════════════════════════════════════
   DM VIEW
═══════════════════════════════════════════════ */
function openDMView(){
  activeServer=null;activeChannel=null;activeDM=null;renderRail();
  document.getElementById('srvHeader').innerHTML='<span>💬 الرسائل المباشرة</span>';
  renderDMSidebar();showScreen('dmScreen');renderDMHome();
}
function renderDMSidebar(){
  const u=DB.users[me.username];const friends=u.friends||[];
  const pending=getPendingCount();
  if(!DB.groups)DB.groups={};
  const myGroups=Object.entries(DB.groups).filter(([gid,g])=>g.members&&g.members.includes(me.username));
  let html=`<div class="ch-cat">التنقل</div>
    <div class="ch-item" onclick="openDMView()"><span class="ch-sym">👥</span> الأصدقاء</div>
    <div class="ch-item" onclick="openDMRequests()"><span class="ch-sym">📨</span> الطلبات ${pending>0?`<span class="ch-badge">${pending}</span>`:''}</div>
    <div class="ch-cat" style="display:flex;justify-content:space-between">
      <span>القروبات</span>
      <span style="cursor:pointer;color:var(--accent);font-size:16px" onclick="openCreateGroupModal()" title="قروب جديد">＋</span>
    </div>
    ${myGroups.map(([gid,g])=>`<div class="ch-item${activeDM==='grp:'+gid?' active':''}" onclick="openGroup('${gid}')">
      <span class="ch-sym">${g.avatar||'👥'}</span>
      <div style="flex:1;min-width:0">
        <div style="font-size:13px;font-weight:600;color:var(--text-1);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(g.name)}</div>
        <div style="font-size:11px;color:var(--text-4)">${g.members.length} أعضاء</div>
      </div>
    </div>`).join('')}
    <div class="ch-cat">المحادثات المباشرة</div>`;
  friends.forEach(fname=>{
    const fu=DB.users[fname];if(!fu)return;
    const dmId=getDMId(me.username,fname);
    const msgs=DB.dms[dmId]||[];const last=msgs[msgs.length-1];
    html+=`<div class="ch-item dm-ch-item${activeDM===fname?' active':''}" onclick="openDM('${fname}')">
      <div class="dm-av" style="background:${avatarColor(fname)}">
        ${fu.photoURL?`<img src="${fu.photoURL}" style="width:100%;height:100%;border-radius:50%;object-fit:cover">`:esc((fu.avatar||fu.display[0]).slice(0,2))}
        <div class="dm-status ${fu.status||'offline'}"></div>
      </div>
      <div style="flex:1;min-width:0">
        <div style="font-size:13px;font-weight:600;color:var(--text-1);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(fu.display)}</div>
        ${last?`<div style="font-size:11px;color:var(--text-4);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc((last.text||'صورة').slice(0,25))}</div>`:''}
      </div>
    </div>`;
  });
  document.getElementById('chScroll').innerHTML=html;
}
function renderDMHome(){
  const u=DB.users[me.username];const friends=u.friends||[];
  const pending=(DB.friendRequests||[]).filter(r=>r.to===me.username&&r.status==='pending');
  const sc=document.getElementById('dmScreen');
  sc.innerHTML=`<div style="flex:1;display:flex;flex-direction:column;align-items:center;padding:40px 20px;gap:20px;overflow-y:auto">
    <div style="font-size:56px">💬</div>
    <h2 style="font-size:22px;font-weight:900;color:var(--text-1)">الرسائل المباشرة</h2>
    <button class="btn btn-accent" onclick="openAddFriendModal()">➕ إضافة صديق</button>
    ${pending.length>0?`<div style="width:100%;max-width:500px;background:var(--bg-card);border:1px solid var(--accent);border-radius:12px;padding:16px">
      <div style="font-weight:700;margin-bottom:12px;color:var(--accent)">📨 طلبات الصداقة (${pending.length})</div>
      ${pending.map(r=>{const fu=DB.users[r.from]||{display:r.from,avatar:'😀'};return `<div style="display:flex;align-items:center;gap:10px;margin-bottom:8px">
        <div style="width:36px;height:36px;border-radius:50%;background:${avatarColor(r.from)};display:flex;align-items:center;justify-content:center;font-size:14px;font-weight:700;color:#fff">${esc((fu.avatar||fu.display[0]).slice(0,2))}</div>
        <div style="flex:1"><div style="font-weight:600">${esc(fu.display)}</div><div style="font-size:12px;color:var(--text-4)">${r.from}</div></div>
        <button class="btn btn-success btn-sm" onclick="acceptFriend('${r.id}')">✅ قبول</button>
        <button class="btn btn-danger btn-sm" onclick="rejectFriend('${r.id}')">❌ رفض</button>
      </div>`}).join('')}
    </div>`:'' }
    ${friends.length===0?`<p style="color:var(--text-3)">لا يوجد أصدقاء — أضف أصدقاء لتبدأ!</p>`:`
    <div style="width:100%;max-width:500px">
      <div style="font-weight:700;margin-bottom:12px;color:var(--text-3)">الأصدقاء — ${friends.length}</div>
      ${friends.map(fname=>{const fu=DB.users[fname];if(!fu)return '';
        return `<div style="display:flex;align-items:center;gap:10px;background:var(--bg-card);border:1px solid var(--border);border-radius:10px;padding:10px 14px;margin-bottom:8px;cursor:pointer" onclick="openDM('${fname}')">
          <div style="position:relative;width:40px;height:40px;border-radius:50%;background:${avatarColor(fname)};display:flex;align-items:center;justify-content:center;font-size:16px;font-weight:700;color:#fff;flex-shrink:0">
            ${fu.photoURL?`<img src="${fu.photoURL}" style="width:100%;height:100%;border-radius:50%;object-fit:cover">`:esc((fu.avatar||fu.display[0]).slice(0,2))}
            <div class="dm-status ${fu.status||'offline'}"></div>
          </div>
          <div style="flex:1">
            <div style="font-weight:600;color:var(--text-1)">${esc(fu.display)}</div>
            <div style="font-size:12px;color:var(--text-3)">${statusLabel(fu.status)}${fu.customStatus?' · '+esc(fu.customStatus):''}</div>
          </div>
          <button class="btn btn-accent btn-sm" onclick="event.stopPropagation();openDM('${fname}')">💬 رسالة</button>
          <button class="btn btn-ghost btn-sm" onclick="event.stopPropagation();removeFriend('${fname}')">🚫</button>
        </div>`;}).join('')}
    </div>`}
  </div>`;
}
function openDMRequests(){
  const pending=(DB.friendRequests||[]).filter(r=>r.to===me.username&&r.status==='pending');
  const sent=(DB.friendRequests||[]).filter(r=>r.from===me.username&&r.status==='pending');
  const sc=document.getElementById('dmScreen');
  sc.innerHTML=`<div style="flex:1;padding:40px 20px;overflow-y:auto">
    <h2 style="font-size:20px;font-weight:900;margin-bottom:20px">📨 طلبات الصداقة</h2>
    <button class="btn btn-accent" style="margin-bottom:20px" onclick="openAddFriendModal()">➕ إضافة صديق</button>
    <div style="font-weight:700;margin-bottom:10px;color:var(--text-3)">الطلبات الواردة (${pending.length})</div>
    ${pending.length===0?'<p style="color:var(--text-4);margin-bottom:20px">لا توجد طلبات</p>':pending.map(r=>{const fu=DB.users[r.from]||{display:r.from,avatar:'😀'};
      return `<div style="display:flex;align-items:center;gap:10px;background:var(--bg-card);border:1px solid var(--border);border-radius:10px;padding:10px 14px;margin-bottom:8px">
        <div style="width:40px;height:40px;border-radius:50%;background:${avatarColor(r.from)};display:flex;align-items:center;justify-content:center;font-size:16px;font-weight:700;color:#fff">${esc((fu.avatar||fu.display[0]).slice(0,2))}</div>
        <div style="flex:1"><div style="font-weight:600">${esc(fu.display)}</div><div style="font-size:12px;color:var(--text-4)">${r.from}</div></div>
        <button class="btn btn-success btn-sm" onclick="acceptFriend('${r.id}')">✅ قبول</button>
        <button class="btn btn-danger btn-sm" onclick="rejectFriend('${r.id}')">❌ رفض</button>
      </div>`;}).join('')}
    <div style="font-weight:700;margin:16px 0 10px;color:var(--text-3)">الطلبات المرسلة (${sent.length})</div>
    ${sent.length===0?'<p style="color:var(--text-4)">لا توجد طلبات مرسلة</p>':sent.map(r=>{const fu=DB.users[r.to]||{display:r.to,avatar:'😀'};
      return `<div style="display:flex;align-items:center;gap:10px;background:var(--bg-card);border:1px solid var(--border);border-radius:10px;padding:10px 14px;margin-bottom:8px">
        <div style="width:40px;height:40px;border-radius:50%;background:${avatarColor(r.to)};display:flex;align-items:center;justify-content:center;font-size:16px;font-weight:700;color:#fff">${esc((fu.avatar||fu.display[0]).slice(0,2))}</div>
        <div style="flex:1"><div style="font-weight:600">${esc(fu.display)}</div><div style="font-size:12px;color:var(--text-4)">${r.to}</div></div>
        <button class="btn btn-ghost btn-sm" onclick="cancelFriendReq('${r.id}')">❌ إلغاء</button>
      </div>`;}).join('')}
  </div>`;
}

/* ═══════════════════════════════════════════════
   FRIEND SYSTEM
═══════════════════════════════════════════════ */
function openAddFriendModal(){
  const ov=document.createElement('div');ov.className='modal-overlay';ov.id='addFriendOv';
  ov.innerHTML=`<div class="modal"><h2>➕ إضافة صديق</h2>
    <p class="m-sub">ابحث عن مستخدم لإضافته</p>
    <div class="form-group"><label>اسم المستخدم</label>
      <div class="input-icon-wrap"><span class="inp-icon">👤</span>
        <input type="text" id="friendSearchInput" placeholder="مثال: ahmed123" autocomplete="off" oninput="searchFriends(this.value)">
      </div>
    </div>
    <div id="friendSearchResults" style="min-height:60px"></div>
    <div class="modal-footer"><button class="btn btn-ghost" onclick="document.getElementById('addFriendOv').remove()">إغلاق</button></div>
  </div>`;
  ov.addEventListener('click',e=>{if(e.target===ov)ov.remove();});
  document.body.appendChild(ov);
  setTimeout(()=>document.getElementById('friendSearchInput')?.focus(),100);
}
function searchFriends(query){
  const res=document.getElementById('friendSearchResults');if(!query||query.trim().length<2){res.innerHTML='';return;}
  const q=query.trim().toLowerCase();
  const myUser=DB.users[me.username];const friends=myUser.friends||[];
  const pendingSent=(DB.friendRequests||[]).filter(r=>r.from===me.username&&r.status==='pending').map(r=>r.to);
  const results=Object.entries(DB.users).filter(([uname,u])=>uname!==me.username&&(uname.includes(q)||u.display.toLowerCase().includes(q))).slice(0,6);
  if(!results.length){res.innerHTML='<p style="color:var(--text-4);text-align:center;padding:12px">لا توجد نتائج</p>';return;}
  res.innerHTML=results.map(([uname,u])=>{
    const isFriend=friends.includes(uname);const isPending=pendingSent.includes(uname);
    return `<div style="display:flex;align-items:center;gap:10px;padding:8px;background:var(--bg-input);border-radius:8px;margin-bottom:6px">
      <div style="width:36px;height:36px;border-radius:50%;background:${avatarColor(uname)};display:flex;align-items:center;justify-content:center;font-size:14px;font-weight:700;color:#fff">${esc((u.avatar||u.display[0]).slice(0,2))}</div>
      <div style="flex:1"><div style="font-weight:600">${esc(u.display)}</div><div style="font-size:11px;color:var(--text-4)">${uname}</div></div>
      ${isFriend?`<span style="color:var(--green);font-size:12px">✅ صديق</span>`:isPending?`<span style="color:var(--yellow);font-size:12px">⏳ انتظار</span>`:`<button class="btn btn-accent btn-sm" onclick="sendFriendReq('${uname}')">إضافة +</button>`}
    </div>`;
  }).join('');
}
function sendFriendReq(toUser){
  if(!DB.users[toUser]){toast('❌ مستخدم غير موجود','err');return;}
  const myUser=DB.users[me.username];
  if((myUser.friends||[]).includes(toUser)){toast('أنتما أصدقاء بالفعل!');return;}
  const incoming=(DB.friendRequests||[]).find(r=>r.from===toUser&&r.to===me.username&&r.status==='pending');
  if(incoming){acceptFriend(incoming.id);return;}
  const existing=(DB.friendRequests||[]).find(r=>r.from===me.username&&r.to===toUser&&r.status==='pending');
  if(existing){toast('⏳ طلب مرسل بالفعل');return;}
  if(!DB.friendRequests)DB.friendRequests=[];
  DB.friendRequests.push({id:uid(),from:me.username,to:toUser,status:'pending',time:new Date().toISOString()});
  saveDB();toast('✅ تم إرسال طلب الصداقة لـ '+(DB.users[toUser]?.display||toUser));
  searchFriends(document.getElementById('friendSearchInput')?.value||'');
  renderRail();
}
function acceptFriend(reqId){
  const req=(DB.friendRequests||[]).find(r=>r.id===reqId);if(!req)return;req.status='accepted';
  const u1=DB.users[req.from];const u2=DB.users[req.to];
  if(u1){if(!u1.friends)u1.friends=[];if(!u1.friends.includes(req.to))u1.friends.push(req.to);}
  if(u2){if(!u2.friends)u2.friends=[];if(!u2.friends.includes(req.from))u2.friends.push(req.from);}
  saveDB();toast('✅ تمت الإضافة!');renderRail();renderDMSidebar();renderDMHome();
}
function rejectFriend(reqId){DB.friendRequests=(DB.friendRequests||[]).filter(r=>r.id!==reqId);saveDB();renderRail();renderDMSidebar();renderDMHome();}
function cancelFriendReq(reqId){DB.friendRequests=(DB.friendRequests||[]).filter(r=>r.id!==reqId);saveDB();renderDMSidebar();openDMRequests();toast('تم إلغاء الطلب');}
function removeFriend(uname){
  if(!confirm('إزالة '+DB.users[uname]?.display+' من الأصدقاء؟'))return;
  const u1=DB.users[me.username];const u2=DB.users[uname];
  if(u1)u1.friends=(u1.friends||[]).filter(f=>f!==uname);
  if(u2)u2.friends=(u2.friends||[]).filter(f=>f!==me.username);
  DB.friendRequests=(DB.friendRequests||[]).filter(r=>!((r.from===me.username&&r.to===uname)||(r.from===uname&&r.to===me.username)));
  saveDB();if(activeDM===uname){activeDM=null;renderDMHome();}renderDMSidebar();toast('تمت الإزالة');
}

/* ═══════════════════════════════════════════════
   DM CHAT
═══════════════════════════════════════════════ */
function getDMId(u1,u2){return [u1,u2].sort().join('__');}
function openDM(uname){
  const u=DB.users[uname];if(!u)return;
  const myUser=DB.users[me.username];
  if(!(myUser.friends||[]).includes(uname)){toast('❌ يجب أن تكون أصدقاء أولاً','err');return;}
  activeDM=uname;activeServer=null;activeChannel=null;
  renderDMSidebar();showScreen('dmScreen');renderDMChat(uname);
}
function renderDMChat(uname){
  const u=DB.users[uname]||{display:uname};
  const sc=document.getElementById('dmScreen');
  sc.innerHTML=`<div style="display:flex;flex-direction:column;flex:1;min-height:0">
    <div class="chat-header">
      <button class="mobile-back-btn" onclick="openDMView()">◀</button>
      <div style="width:36px;height:36px;border-radius:50%;background:${avatarColor(uname)};display:flex;align-items:center;justify-content:center;font-size:14px;font-weight:700;color:#fff;flex-shrink:0;position:relative">
        ${u.photoURL?`<img src="${u.photoURL}" style="width:100%;height:100%;border-radius:50%;object-fit:cover">`:esc((u.avatar||u.display[0]).slice(0,2))}
        <div class="dm-status ${u.status||'offline'}"></div>
      </div>
      <div class="ch-header-info">
        <span class="ch-name">${esc(u.display)}</span>
        <span class="ch-desc">${statusLabel(u.status)}${u.customStatus?' · '+esc(u.customStatus):''}</span>
      </div>
      <div class="header-actions">
        <button class="icon-btn" onclick="showProfile('${uname}')">👤</button>
        <button class="icon-btn" onclick="removeFriend('${uname}')" title="إزالة صديق">🚫</button>
      </div>
    </div>
    <div class="msgs-wrap" id="dmMsgsWrap"><div class="msgs-inner" id="dmMsgsInner"></div></div>
    <div class="chat-input-wrap">
      <div class="chat-input-box">
        <button class="emoji-btn" onclick="toggleEmojiPicker()" title="إيموجي">😊</button>
        <div class="emoji-picker hidden" id="emojiPicker"></div>
        <textarea class="chat-input" id="dmInputEl" placeholder="رسالة لـ ${esc(u.display)}..." rows="1" onkeydown="handleDMKey(event,'${uname}')" oninput="handleTyping(this)"></textarea>
        <button class="icon-btn" onclick="openDMUpload('${uname}')" title="صورة">📎</button>
        <button class="send-btn" onclick="sendDM('${uname}')">➤</button>
      </div>
    </div>
  </div>`;
  renderDMMessages(uname);
}
function renderDMMessages(uname){
  const dmId=getDMId(me.username,uname);const msgs=DB.dms[dmId]||[];
  const inner=document.getElementById('dmMsgsInner');if(!inner)return;
  if(!msgs.length){inner.innerHTML=`<div class="empty" style="margin:auto;padding-top:60px"><div class="e-icon">💬</div><p>بداية محادثتك مع <strong>${esc(DB.users[uname]?.display||uname)}</strong></p></div>`;return;}
  let html='';let lastDate='';
  msgs.forEach(msg=>{
    const md=fmtDate(msg.time);if(md!==lastDate){html+=`<div class="sys-divider">${md}</div>`;lastDate=md;}
    const u=DB.users[msg.user]||{display:msg.user};const isOwn=msg.user===me.username;
    let reactHtml='';
    if(msg.reactions&&Object.keys(msg.reactions).length){reactHtml='<div class="msg-reactions">';Object.entries(msg.reactions).forEach(([em,users])=>{const mine=users.includes(me.username);reactHtml+=`<div class="reaction${mine?' mine':''}" onclick="toggleDMReact('${uname}','${msg.id}','${em}')">${em} ${users.length}</div>`;});reactHtml+='</div>';}
    let contentHtml='';
    if(msg.type==='poll'){
      const totalVotes=msg.options.reduce((a,o)=>a+o.votes.length,0);
      contentHtml=`<div class="poll-box"><div class="poll-q">${esc(msg.question)}</div>${msg.options.map((o,i)=>{const pct=totalVotes?Math.round(o.votes.length/totalVotes*100):0;const voted=o.votes.includes(me.username);return `<div class="poll-opt${voted?' voted':''}" onclick="votePoll('${msg.id}',${i})"><div class="poll-fill" style="width:${pct}%"></div><span class="poll-label">${esc(o.text)}</span><span class="poll-pct">${pct}%</span></div>`;}).join('')}<div class="poll-total">${totalVotes} أصوات</div></div>`;
    }else if(msg.imageUrl){
      contentHtml=`<img class="msg-image" src="${msg.imageUrl}" alt="صورة" onclick="openImageModal('${msg.imageUrl}')">`;
    }else if(msg.isSticker){
      contentHtml=`<div class="msg-sticker">${processMsg(msg.text||'')}</div>`;
    }else{
      contentHtml=`<div class="msg-text">${processMsgWithMentions(msg.text||'',activeServer)}</div>`;
    }
    html+=`<div class="msg-group${isOwn?' own':''}" id="dmmsg-${msg.id}">
      <div class="msg-av" style="background:${avatarColor(msg.user)}">${u.photoURL?`<img src="${u.photoURL}" style="width:100%;height:100%;border-radius:50%;object-fit:cover">`:esc((u.avatar||u.display[0]).slice(0,2))}</div>
      <div class="msg-body">
        <div class="msg-meta"><span class="msg-author" style="color:${avatarColor(msg.user)}">${esc(u.display)}</span><span class="msg-ts">${fmtRel(msg.time)}</span></div>
        ${contentHtml}${reactHtml}
      </div>
      <div class="msg-actions">
        <button class="msg-act-btn" onclick="addDMReactPicker('${uname}','${msg.id}')">😊</button>
        ${isOwn?`<button class="msg-act-btn" onclick="deleteDMMsg('${uname}','${msg.id}')">🗑️</button>`:''}
      </div>
    </div>`;
  });
  inner.innerHTML=html;
  const wrap=document.getElementById('dmMsgsWrap');if(wrap)wrap.scrollTop=wrap.scrollHeight;
}
function handleDMKey(e,uname){if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();sendDM(uname);return;}const ta=e.target;ta.style.height='auto';ta.style.height=Math.min(ta.scrollHeight,120)+'px';}
function sendDM(uname){const input=document.getElementById('dmInputEl');if(!input)return;const text=input.value.trim();if(!text)return;const dmId=getDMId(me.username,uname);if(!DB.dms[dmId])DB.dms[dmId]=[];DB.dms[dmId].push({id:uid(),user:me.username,text,time:new Date().toISOString(),reactions:{}});if(DB.dms[dmId].length>500)DB.dms[dmId].shift();saveDB();input.value='';input.style.height='auto';renderDMMessages(uname);renderDMSidebar();}
function openDMUpload(uname){const input=document.createElement('input');input.type='file';input.accept='image/*';input.onchange=e=>{const file=e.target.files[0];if(!file)return;if(file.size>5*1024*1024){toast('❌ الصورة أكبر من 5MB','err');return;}const reader=new FileReader();reader.onload=ev=>{const dmId=getDMId(me.username,uname);if(!DB.dms[dmId])DB.dms[dmId]=[];DB.dms[dmId].push({id:uid(),user:me.username,text:'',imageUrl:ev.target.result,time:new Date().toISOString(),reactions:{}});saveDB();renderDMMessages(uname);toast('✅ تم إرسال الصورة!');};reader.readAsDataURL(file);};input.click();}
function deleteDMMsg(uname,msgId){const dmId=getDMId(me.username,uname);DB.dms[dmId]=(DB.dms[dmId]||[]).filter(m=>m.id!==msgId);saveDB();renderDMMessages(uname);toast('🗑️ تم الحذف');}
function toggleDMReact(uname,msgId,emoji){const dmId=getDMId(me.username,uname);const msg=(DB.dms[dmId]||[]).find(m=>m.id===msgId);if(!msg)return;if(!msg.reactions)msg.reactions={};if(!msg.reactions[emoji])msg.reactions[emoji]=[];const idx=msg.reactions[emoji].indexOf(me.username);if(idx===-1)msg.reactions[emoji].push(me.username);else msg.reactions[emoji].splice(idx,1);if(!msg.reactions[emoji].length)delete msg.reactions[emoji];saveDB();renderDMMessages(uname);}
function addDMReactPicker(uname,msgId){const quick=['👍','❤️','😂','😮','😢','😡','🔥','✨'];const ex=document.getElementById('quickReactPicker');if(ex)ex.remove();const picker=document.createElement('div');picker.id='quickReactPicker';picker.style.cssText='position:fixed;z-index:500;background:var(--bg-card);border:1px solid var(--border-2);border-radius:12px;padding:8px;display:flex;gap:4px;box-shadow:0 8px 32px rgba(0,0,0,.4)';quick.forEach(e=>{const btn=document.createElement('div');btn.className='emoji-item';btn.style.cssText='padding:6px;font-size:22px;cursor:pointer;border-radius:8px';btn.textContent=e;btn.onclick=()=>{toggleDMReact(uname,msgId,e);picker.remove();};picker.appendChild(btn);});document.body.appendChild(picker);const el=document.getElementById('dmmsg-'+msgId);if(el){const r=el.getBoundingClientRect();picker.style.top=(r.top-60)+'px';picker.style.right='100px';}setTimeout(()=>document.addEventListener('click',()=>picker.remove(),{once:true}),50);}

/* ═══════════════════════════════════════════════
   SERVER
═══════════════════════════════════════════════ */
function openServer(sid){
  const sv=DB.servers[sid];if(!sv)return;
  activeServer=sid;activeChannel=null;activeDM=null;renderRail();
  const myRole=myServerRole(sid);
  document.getElementById('srvHeader').innerHTML=`<span>${esc(sv.emoji||'🎮')} ${esc(sv.name)}</span><span class="chevron">▾</span>`;
  renderChannels(sid);renderMembers(sid);openMobileChannelPanel();
  showScreen('homeScreen');
  const hs=document.getElementById('homeScreen');
  hs.style.cssText='flex-direction:column;align-items:center;justify-content:center';
  hs.innerHTML=`<div style="font-size:56px;margin-bottom:12px">${esc(sv.emoji||'🎮')}</div>
    <h1 class="home-title">${esc(sv.name)}</h1>
    <p class="home-sub">${esc(sv.desc||'مرحباً في '+sv.name)}</p>
    <div style="display:flex;align-items:center;gap:12px;background:var(--bg-card);border:1px solid var(--border);border-radius:12px;padding:12px 20px;margin-top:12px">
      <span style="font-size:13px;color:var(--text-3)">كود الدعوة:</span>
      <span style="font-family:monospace;font-size:20px;color:var(--accent);font-weight:700;letter-spacing:4px">${sv.inviteCode}</span>
      <button class="btn btn-ghost btn-sm" onclick="copyText('${sv.inviteCode}')">📋 نسخ</button>
    </div>
    ${isOwnerUser()?`<button class="btn btn-accent" style="margin-top:16px;background:linear-gradient(135deg,#f5c518,#e67e22);color:#000" onclick="openOwnerPanel()">👑 لوحة التحكم</button>`:''}`;
}
function renderChannels(sid){
  const sv=DB.servers[sid];if(!sv)return;
  const myRole=myServerRole(sid);const cats={};
  sv.channels.forEach(ch=>{const cat=ch.category||'القنوات';if(!cats[cat])cats[cat]=[];cats[cat].push(ch);});
  let html='';
  Object.entries(cats).forEach(([cat,chs])=>{
    html+=`<div class="ch-cat"><span>${esc(cat)}</span>${isStaff(myRole)?`<span class="add-ch" onclick="openAddChannel('${sid}','${esc(cat)}')" title="إضافة قناة">＋</span>`:''}</div>`;
    chs.forEach(ch=>{
      if(ch.private&&!isStaff(myRole))return;
      const sym=ch.type==='voice'?'🔊':ch.type==='announce'?'📢':'#';
      const vCount=ch.type==='voice'?getVoiceCount(sid,ch.id):0;
      html+=`<div class="ch-item${activeChannel===ch.id?' active':''}${ch.private?' private':''}" onclick="openChannel('${sid}','${ch.id}')">
        <span class="ch-sym">${sym}</span><span class="grow ellipsis">${esc(ch.name)}</span>
        ${ch.type==='voice'&&vCount>0?`<span style="font-size:11px;color:var(--green);margin-right:4px">● ${vCount}</span>`:''}
      </div>`;
    });
  });
  html+=`<div class="ch-admin-link" style="color:var(--text-3)" onclick="openMyTickets('${sid}')">🎫 تذاكر الدعم</div>`;
  if(isOwnerUser())html+=`<div class="ch-admin-link" onclick="openOwnerPanel()">👑 لوحة التحكم</div>`;
  document.getElementById('chScroll').innerHTML=html;
}
function getVoiceCount(sid,cid){const sv=DB.servers[sid];if(!sv?.voiceRooms?.[cid])return 0;return Object.keys(sv.voiceRooms[cid]).length;}
function renderMembers(sid){
  const sv=DB.servers[sid];const panel=document.getElementById('membersPanel');
  if(!showMembers||!sv){if(panel)panel.innerHTML='';return;}
  const grouped={};ROLE_ORDER.forEach(r=>grouped[r]=[]);
  Object.entries(sv.members).forEach(([uname,m])=>{const u=DB.users[uname];if(!u)return;const r=u.role==='owner'?'owner':(m.role||'user');if(!grouped[r])grouped[r]=[];grouped[r].push({uname,u,r});});
  const catNames={owner:'الأونر',leader:'الليدر',manager:'المانجر','admin-mgr':'أدمن مانجر',head:'هيد أدمن',super:'سوبر أدمن',helper:'الهيلبر',user:'الأعضاء'};
  let html=`<div class="members-title">الأعضاء — ${Object.keys(sv.members).length}</div>`;
  ROLE_ORDER.forEach(r=>{if(!grouped[r]?.length)return;html+=`<div class="m-cat">${catNames[r]||r} — ${grouped[r].length}</div>`;grouped[r].forEach(({uname,u,r:role})=>{const status=u.status||'offline';html+=`<div class="m-item" onclick="showProfile('${uname}')"><div class="m-avatar" style="background:${avatarColor(uname)}">${u.photoURL?`<img src="${u.photoURL}" style="width:100%;height:100%;border-radius:50%;object-fit:cover">`:`<span>${esc((u.avatar||u.display[0]).slice(0,2))}</span>`}<div class="m-status ${status}"></div></div><div><div class="m-nick rc-${roleCls(role)}">${esc(u.display)}</div><div class="m-role-label">${roleLabel(role)||''} ${customTagHtml(sid,uname)}</div></div></div>`;});});
  if(panel)panel.innerHTML=html;
}
function toggleMembersPanel(){showMembers=!showMembers;if(activeServer)renderMembers(activeServer);else{const p=document.getElementById('membersPanel');if(p)p.innerHTML='';}}
function openMobileChannelPanel(){if(window.innerWidth<=768){document.getElementById('channelPanel').classList.add('open');document.getElementById('mobileOverlay').classList.remove('hidden');}}
function closeMobilePanels(){document.getElementById('channelPanel').classList.remove('open');document.getElementById('membersPanel')?.classList.remove('open');document.getElementById('mobileOverlay').classList.add('hidden');}

/* ═══════════════════════════════════════════════
   CHANNELS / CHAT
═══════════════════════════════════════════════ */
function openChannel(sid,cid){
  const sv=DB.servers[sid];const ch=sv?.channels.find(c=>c.id===cid);if(!ch)return;
  if(ch.type==='voice'){joinVoiceChannel(sid,cid,ch);return;}
  activeServer=sid;activeChannel=cid;activeDM=null;
  showScreen('chatScreen');
  const sym=ch.type==='announce'?'📢':'#';
  document.getElementById('chatSym').textContent=sym;
  document.getElementById('chatName').textContent=ch.name;
  document.getElementById('chatDesc').textContent=ch.category||'';
  document.getElementById('chatInputEl').placeholder='رسالة في '+ch.name+'...';
  clearReply();renderMessages();renderChannels(sid);renderMembers(sid);closeMobilePanels();
}

/* ═══════════════════════════════════════════════
   VOICE
═══════════════════════════════════════════════ */
async function joinVoiceChannel(sid,cid,ch){
  if(voiceRoom)leaveVoiceChannel();
  try{localStream=await navigator.mediaDevices.getUserMedia({audio:true,video:false});}catch(e){toast('❌ لا يمكن الوصول للميكروفون','err');return;}
  if(!DB.servers[sid].voiceRooms)DB.servers[sid].voiceRooms={};
  if(!DB.servers[sid].voiceRooms[cid])DB.servers[sid].voiceRooms[cid]={};
  DB.servers[sid].voiceRooms[cid][me.username]={joinedAt:new Date().toISOString(),muted:false,deafened:false};
  saveDB();voiceRoom={sid,cid,name:ch.name};activeServer=sid;activeChannel=cid;
  renderChannels(sid);renderVoiceScreen(sid,cid,ch);showScreen('voiceScreen');closeMobilePanels();
  toast('🔊 انضممت إلى '+ch.name);
}
function leaveVoiceChannel(){if(!voiceRoom)return;const{sid,cid}=voiceRoom;if(localStream){localStream.getTracks().forEach(t=>t.stop());localStream=null;}if(DB.servers[sid]?.voiceRooms?.[cid]){delete DB.servers[sid].voiceRooms[cid][me.username];if(!Object.keys(DB.servers[sid].voiceRooms[cid]).length)delete DB.servers[sid].voiceRooms[cid];saveDB();}voiceRoom=null;activeChannel=null;toast('👋 غادرت القناة الصوتية');renderChannels(sid);}
function renderVoiceScreen(sid,cid,ch){const vs=document.getElementById('voiceScreen');if(!vs)return;const sv=DB.servers[sid];const vu=sv.voiceRooms?.[cid]||{};vs.innerHTML=`<div style="flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:20px;padding:40px;text-align:center"><div style="font-size:48px">🔊</div><h2 style="font-size:24px;font-weight:900;color:var(--text-1)">${esc(ch.name)}</h2><p style="color:var(--text-3)">${esc(sv.name)}</p><div id="voiceUsersList" style="display:flex;gap:12px;flex-wrap:wrap;justify-content:center">${renderVoiceUsers(vu)}</div><audio id="localAudio" autoplay muted style="display:none"></audio><div id="remoteAudios"></div><div class="voice-controls"><button class="vc-btn" id="muteBtn" onclick="toggleMute()" title="كتم">🎤</button><button class="vc-btn" id="deafBtn" onclick="toggleDeafen()" title="كتم الصوت">🔊</button><button class="vc-btn danger" onclick="leaveVoiceChannel();openServer('${sid}')" title="مغادرة">📞</button><button class="vc-btn" onclick="toggleCamera()" title="الكاميرا" id="camBtn">📷</button><button class="vc-btn" onclick="toggleScreenShare()" title="مشاركة الشاشة" id="screenBtn">🖥️</button></div><div id="videoGrid" style="display:flex;gap:12px;flex-wrap:wrap;justify-content:center;margin-top:8px"></div></div>`;const la=document.getElementById('localAudio');if(la&&localStream)la.srcObject=localStream;}
function renderVoiceUsers(vu){if(!Object.keys(vu).length)return '<p style="color:var(--text-4)">لا أحد في القناة حالياً</p>';return Object.keys(vu).map(uname=>{const u=DB.users[uname]||{display:uname,avatar:'👤'};const info=vu[uname];return `<div style="display:flex;flex-direction:column;align-items:center;gap:8px;padding:12px;background:var(--bg-card);border-radius:12px;min-width:80px;border:1px solid var(--border)"><div style="width:56px;height:56px;border-radius:50%;background:${avatarColor(uname)};display:flex;align-items:center;justify-content:center;font-size:22px;color:#fff;border:2px solid ${info?.muted?'var(--red)':'var(--green)'}">${u.photoURL?`<img src="${u.photoURL}" style="width:100%;height:100%;border-radius:50%;object-fit:cover">`:esc((u.avatar||u.display[0]).slice(0,2))}</div><div style="font-size:12px;font-weight:600;color:var(--text-1)">${esc(u.display)}</div><div>${info?.muted?'🔇':'🎤'}</div></div>`;}).join('');}
function toggleMute(){if(!localStream||!voiceRoom)return;const tracks=localStream.getAudioTracks();const nowMuted=!tracks[0]?.enabled;tracks.forEach(t=>t.enabled=nowMuted);const{sid,cid}=voiceRoom;if(DB.servers[sid]?.voiceRooms?.[cid]?.[me.username])DB.servers[sid].voiceRooms[cid][me.username].muted=!nowMuted;saveDB();const btn=document.getElementById('muteBtn');if(btn){btn.textContent=nowMuted?'🎤':'🔇';btn.classList.toggle('active',!nowMuted);}toast(nowMuted?'🎤 تم تفعيل الميكروفون':'🔇 تم كتم الميكروفون');}
function toggleDeafen(){const btn=document.getElementById('deafBtn');const def=btn?.classList.contains('active');document.querySelectorAll('#remoteAudios audio').forEach(a=>a.muted=!def);btn?.classList.toggle('active',!def);if(btn)btn.textContent=def?'🔊':'🔕';toast(def?'🔊 تم تفعيل الصوت':'🔕 تم كتم الصوت');}
async function toggleCamera(){const btn=document.getElementById('camBtn');const vg=document.getElementById('videoGrid');const ev=document.getElementById('localVideo');if(ev){localStream?.getVideoTracks().forEach(t=>{t.stop();localStream?.removeTrack(t);});ev.remove();btn?.classList.remove('active');toast('📷 تم إيقاف الكاميرا');return;}try{const cs=await navigator.mediaDevices.getUserMedia({video:true,audio:false});cs.getVideoTracks().forEach(t=>localStream?.addTrack(t));const v=document.createElement('video');v.id='localVideo';v.autoplay=true;v.muted=true;v.srcObject=cs;v.style.cssText='width:240px;height:180px;border-radius:12px;background:#000;object-fit:cover;border:2px solid var(--accent)';vg?.appendChild(v);btn?.classList.add('active');toast('📷 تم تفعيل الكاميرا');}catch(e){toast('❌ لا يمكن الوصول للكاميرا','err');}}
async function toggleScreenShare(){const btn=document.getElementById('screenBtn');const vg=document.getElementById('videoGrid');const es=document.getElementById('screenVideo');if(es){es.srcObject?.getTracks().forEach(t=>t.stop());es.remove();btn?.classList.remove('active');toast('🖥️ تم إيقاف مشاركة الشاشة');return;}try{const ss=await navigator.mediaDevices.getDisplayMedia({video:true,audio:true});const v=document.createElement('video');v.id='screenVideo';v.autoplay=true;v.srcObject=ss;v.style.cssText='width:480px;height:270px;border-radius:12px;background:#000;object-fit:contain;border:2px solid var(--yellow)';vg?.appendChild(v);btn?.classList.add('active');toast('🖥️ يتم مشاركة الشاشة');ss.getVideoTracks()[0].onended=()=>{v.remove();btn?.classList.remove('active');};}catch(e){toast('❌ لا يمكن مشاركة الشاشة','err');}}

/* ═══════════════════════════════════════════════
   MESSAGES
═══════════════════════════════════════════════ */
function renderMessages(){
  const sv=DB.servers[activeServer];const ch=sv?.channels.find(c=>c.id===activeChannel);
  const inner=document.getElementById('msgsInner');if(!ch||!inner)return;
  if(!ch.messages?.length){inner.innerHTML=`<div class="empty" style="margin:auto;padding-top:60px"><div class="e-icon">#</div><p>بداية قناة <strong>${esc(ch.name)}</strong></p></div>`;return;}
  let html='';let lastDate='';
  ch.messages.forEach(msg=>{
    if(msg.type==='system'){html+=`<div class="sys-divider">${esc(msg.text)}</div>`;return;}
    const md=fmtDate(msg.time);if(md!==lastDate){html+=`<div class="sys-divider">${md}</div>`;lastDate=md;}
    const u=DB.users[msg.user]||{display:msg.user,role:'user'};const r=u.role||'user';const isOwn=msg.user===me.username;
    let replyHtml='';if(msg.replyTo){const rm=ch.messages.find(m=>m.id===msg.replyTo);if(rm){const ru=DB.users[rm.user]||{display:rm.user};replyHtml=`<div class="msg-reply-ref" onclick="scrollToMsg('${msg.replyTo}')">↩ <strong>${esc(ru.display)}</strong>: ${esc((rm.text||'').slice(0,60))}</div>`;}}
    let reactHtml='';if(msg.reactions&&Object.keys(msg.reactions).length){reactHtml='<div class="msg-reactions">';Object.entries(msg.reactions).forEach(([em,users])=>{const mine=users.includes(me.username);reactHtml+=`<div class="reaction${mine?' mine':''}" onclick="toggleReaction('${msg.id}','${em}')">${em} ${users.length}</div>`;});reactHtml+='</div>';}
    let contentHtml='';
    if(msg.type==='poll'){
      const totalVotes=msg.options.reduce((a,o)=>a+o.votes.length,0);
      contentHtml=`<div class="poll-box"><div class="poll-q">${esc(msg.question)}</div>${msg.options.map((o,i)=>{const pct=totalVotes?Math.round(o.votes.length/totalVotes*100):0;const voted=o.votes.includes(me.username);return `<div class="poll-opt${voted?' voted':''}" onclick="votePoll('${msg.id}',${i})"><div class="poll-fill" style="width:${pct}%"></div><span class="poll-label">${esc(o.text)}</span><span class="poll-pct">${pct}%</span></div>`;}).join('')}<div class="poll-total">${totalVotes} أصوات</div></div>`;
    }else if(msg.imageUrl){
      contentHtml=`<img class="msg-image" src="${msg.imageUrl}" alt="صورة" onclick="openImageModal('${msg.imageUrl}')">`;
    }else if(msg.isSticker){
      contentHtml=`<div class="msg-sticker">${processMsg(msg.text||'')}</div>`;
    }else{
      contentHtml=`<div class="msg-text">${processMsgWithMentions(msg.text||'',activeServer)}</div>`;
    }
    const nameCls=hasNitro(msg.user)?`msg-author rc-${roleCls(r)} nitro-name`:`msg-author rc-${roleCls(r)}`;
    html+=`<div class="msg-group${isOwn?' own':''}" id="msg-${msg.id}" data-msgid="${msg.id}">
      <div class="msg-av" style="background:${avatarColor(msg.user)}" onclick="showProfile('${msg.user}')">${u.photoURL?`<img src="${u.photoURL}" style="width:100%;height:100%;border-radius:50%;object-fit:cover">`:esc((u.avatar||u.display[0]).slice(0,2))}</div>
      <div class="msg-body">
        <div class="msg-meta"><span class="${nameCls}" onclick="showProfile('${msg.user}')">${esc(u.display)}</span>${badge(r)}${customTagHtml(activeServer,msg.user)}<span class="badges-row">${renderBadges(u)}</span><span class="msg-ts">${fmtRel(msg.time)}</span></div>
        ${replyHtml}${contentHtml}${reactHtml}
      </div>
      <div class="msg-actions">
        <button class="msg-act-btn" onclick="setReply('${msg.id}')" title="رد">↩</button>
        <button class="msg-act-btn" onclick="addReactionPicker('${msg.id}')" title="إيموجي">😊</button>
        ${isOwn?`<button class="msg-act-btn" onclick="editMsg('${msg.id}')" title="تعديل">✏️</button>`:''}${isOwn||isStaff(myServerRole(activeServer))?`<button class="msg-act-btn" onclick="deleteMsg('${msg.id}')">🗑️</button>`:''}
        ${isStaff(myServerRole(activeServer))?`<button class="msg-act-btn" onclick="pinMsg('${msg.id}')">📌</button>`:''}
      </div>
    </div>`;
  });
  inner.innerHTML=html;
  const wrap=document.getElementById('msgsWrap');if(wrap)wrap.scrollTop=wrap.scrollHeight;
}
function handleChatKey(e){if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();sendMsg();return;}const ta=e.target;ta.style.height='auto';ta.style.height=Math.min(ta.scrollHeight,120)+'px';handleTypingIndicator();}
function sendMsg(){const input=document.getElementById('chatInputEl');const text=input.value.trim();if(!text||!activeServer||!activeChannel)return;const sv=DB.servers[activeServer];const myMember=sv?.members?.[me.username];if(myMember?.mutedUntil&&myMember.mutedUntil>Date.now()){toast('🔇 أنت مكتوم حتى '+fmtDate(myMember.mutedUntil)+' '+fmtTime(myMember.mutedUntil),'err');return;}if(!checkSlowMode(activeServer,activeChannel))return;if(!checkAutomod(sv,text))return;const ch=sv?.channels.find(c=>c.id===activeChannel);if(!ch)return;if(!ch.messages)ch.messages=[];const msg={id:uid(),user:me.username,text,time:new Date().toISOString(),reactions:{}};checkMentions(text,activeServer);if(replyTo){msg.replyTo=replyTo;clearReply();}ch.messages.push(msg);if(ch.messages.length>1000)ch.messages.shift();saveDB();input.value='';input.style.height='auto';renderMessages();}
function checkAutomod(sv,text){
  const am=sv?.automod;if(!am)return true;
  const myRole=myServerRole(sv.id);
  if(myRole==='owner'||myRole==='leader')return true;
  const lower=text.toLowerCase();
  if(am.bannedWords?.length){
    for(const w of am.bannedWords){if(w&&lower.includes(w.toLowerCase())){toast('🚫 رسالتك تحتوي على كلمة محظورة','err');return false;}}
  }
  if(am.antiInvite&&/discord\.gg\/|tiscord\.app\/invite/i.test(text)){toast('🚫 لا يسمح بنشر روابط دعوة','err');return false;}
  if(am.antiLink&&/https?:\/\//i.test(text)){toast('🚫 لا يسمح بنشر روابط في هذه القناة','err');return false;}
  return true;
}
function setReply(msgId){const sv=DB.servers[activeServer];const ch=sv?.channels.find(c=>c.id===activeChannel);if(!ch)return;const msg=ch.messages.find(m=>m.id===msgId);if(!msg)return;replyTo=msgId;const preview=document.getElementById('replyPreview');const u=DB.users[msg.user]||{display:msg.user};document.getElementById('replyPreviewText').textContent='الرد على '+u.display+': '+(msg.text||'').slice(0,50);preview.classList.remove('hidden');document.getElementById('chatInputEl').focus();}
function clearReply(){replyTo=null;const p=document.getElementById('replyPreview');if(p)p.classList.add('hidden');}

/* ═══════════════════════════════════════════════
   MENTIONS & EXTRA HELPERS
═══════════════════════════════════════════════ */
function processMsgWithMentions(text, sid){
  let html = processMsg(text);
  if(!sid) return html;
  const sv = DB.servers[sid];
  if(!sv) return html;
  html = html.replace(/@everyone/g, '<span class="mention-badge">@everyone</span>');
  html = html.replace(/@here/g, '<span class="mention-badge">@here</span>');
  Object.keys(sv.members || {}).forEach(mU => {
    const u = DB.users[mU];
    if(u) {
      const reg = new RegExp(`@${mU}`, 'g');
      html = html.replace(reg, `<span class="mention-badge">@${esc(u.display)}</span>`);
    }
  });
  return html;
}

function checkMentions(text, sid){
  if(!sid) return;
  if(text.includes(`@${me?.username}`) || text.includes('@everyone')){
    toast('🔔 تم ذكرك في رسالة جديدة!');
  }
}

function handleTypingIndicator(){}

const userLastMsg = {};
function checkSlowMode(sid, cid){
  const sv = DB.servers[sid];
  const ch = sv?.channels.find(c => c.id === cid);
  if(!ch?.slowMode) return true;
  const key = `${me.username}_${cid}`;
  const now = Date.now();
  if(userLastMsg[key] && (now - userLastMsg[key] < ch.slowMode * 1000)){
    const remain = Math.ceil((ch.slowMode * 1000 - (now - userLastMsg[key])) / 1000);
    toast(`⏳ وضع الإبطاء مفعّل. انتظر ${remain} ثانية.`, 'err');
    return false;
  }
  userLastMsg[key] = now;
  return true;
}

function scrollToMsg(msgId){
  const el = document.getElementById('msg-' + msgId);
  if(el){
    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    el.classList.add('msg-highlight');
    setTimeout(() => el.classList.remove('msg-highlight'), 2000);
  }
}

function editMsg(msgId){
  const sv = DB.servers[activeServer];
  const ch = sv?.channels.find(c => c.id === activeChannel);
  const msg = ch?.messages.find(m => m.id === msgId);
  if(!msg) return;
  const newText = prompt('تعديل الرسالة:', msg.text);
  if(newText !== null && newText.trim() !== ''){
    msg.text = newText.trim();
    msg.edited = true;
    saveDB();
    renderMessages();
    toast('✏️ تم تعديل الرسالة');
  }
}

function deleteMsg(msgId){
  if(!confirm('هل انت متاكد من حذف هذه الرسالة؟')) return;
  const sv = DB.servers[activeServer];
  const ch = sv?.channels.find(c => c.id === activeChannel);
  if(!ch) return;
  ch.messages = (ch.messages || []).filter(m => m.id !== msgId);
  saveDB();
  renderMessages();
  toast('🗑️ تم حذف الرسالة');
}

function pinMsg(msgId){
  const sv = DB.servers[activeServer];
  const ch = sv?.channels.find(c => c.id === activeChannel);
  const msg = ch?.messages.find(m => m.id === msgId);
  if(!msg) return;
  msg.pinned = !msg.pinned;
  saveDB();
  renderMessages();
  toast(msg.pinned ? '📌 تم تثبيت الرسالة' : '📌 تم إلغاء التثبيت');
}

function addReactionPicker(msgId){
  const quick = ['👍','❤️','😂','😮','😢','😡','🔥','✨'];
  const ex = document.getElementById('quickReactPicker');
  if(ex) ex.remove();
  const picker = document.createElement('div');
  picker.id = 'quickReactPicker';
  picker.style.cssText = 'position:fixed;z-index:500;background:var(--bg-card);border:1px solid var(--border-2);border-radius:12px;padding:8px;display:flex;gap:4px;box-shadow:0 8px 32px rgba(0,0,0,.4)';
  quick.forEach(e => {
    const btn = document.createElement('div');
    btn.className = 'emoji-item';
    btn.style.cssText = 'padding:6px;font-size:22px;cursor:pointer;border-radius:8px';
    btn.textContent = e;
    btn.onclick = () => { toggleReaction(msgId, e); picker.remove(); };
    picker.appendChild(btn);
  });
  document.body.appendChild(picker);
  const el = document.getElementById('msg-' + msgId);
  if(el){
    const r = el.getBoundingClientRect();
    picker.style.top = (r.top - 60) + 'px';
    picker.style.right = '100px';
  }
  setTimeout(() => document.addEventListener('click', () => picker.remove(), { once: true }), 50);
}

function toggleReaction(msgId, emoji){
  const sv = DB.servers[activeServer];
  const ch = sv?.channels.find(c => c.id === activeChannel);
  const msg = ch?.messages.find(m => m.id === msgId);
  if(!msg) return;
  if(!msg.reactions) msg.reactions = {};
  if(!msg.reactions[emoji]) msg.reactions[emoji] = [];
  const idx = msg.reactions[emoji].indexOf(me.username);
  if(idx === -1) msg.reactions[emoji].push(me.username);
  else msg.reactions[emoji].splice(idx, 1);
  if(!msg.reactions[emoji].length) delete msg.reactions[emoji];
  saveDB();
  renderMessages();
}

function openFileUpload(){
  const inp = document.createElement('input');
  inp.type = 'file';
  inp.accept = 'image/*';
  inp.onchange = e => {
    const file = e.target.files[0];
    if(!file) return;
    if(file.size > 5 * 1024 * 1024){ toast('❌ حجم الصورة كبير جداً (الحد الأقصى 5MB)', 'err'); return; }
    const reader = new FileReader();
    reader.onload = ev => {
      const sv = DB.servers[activeServer];
      const ch = sv?.channels.find(c => c.id === activeChannel);
      if(!ch) return;
      if(!ch.messages) ch.messages = [];
      ch.messages.push({
        id: uid(),
        user: me.username,
        text: '',
        imageUrl: ev.target.result,
        time: new Date().toISOString(),
        reactions: {}
      });
      saveDB();
      renderMessages();
      toast('✅ تم رفع الصورة بنجاح');
    };
    reader.readAsDataURL(file);
  };
  inp.click();
}

function toggleStickerPicker(){
  const stickers = ['🎮','🔥','👑','🚀','💎','🏆','🎉','⭐','❤️','😎'];
  const ex = document.getElementById('stickerModal');
  if(ex){ ex.remove(); return; }
  const modal = document.createElement('div');
  modal.id = 'stickerModal';
  modal.className = 'modal-overlay';
  modal.innerHTML = `<div class="modal">
    <h2>🎭 ملصقات Tiscord</h2>
    <div style="display:grid;grid-template-columns:repeat(5,1fr);gap:12px;padding:20px 0;font-size:36px;text-align:center">
      ${stickers.map(s => `<div style="cursor:pointer;padding:10px;border-radius:12px;background:var(--bg-card)" onclick="sendSticker('${s}')">${s}</div>`).join('')}
    </div>
    <div class="modal-footer"><button class="btn btn-ghost" onclick="document.getElementById('stickerModal').remove()">إغلاق</button></div>
  </div>`;
  modal.onclick = e => { if(e.target === modal) modal.remove(); };
  document.body.appendChild(modal);
}

function sendSticker(sticker){
  document.getElementById('stickerModal')?.remove();
  const sv = DB.servers[activeServer];
  const ch = sv?.channels.find(c => c.id === activeChannel);
  if(!ch) return;
  if(!ch.messages) ch.messages = [];
  ch.messages.push({
    id: uid(),
    user: me.username,
    text: sticker,
    isSticker: true,
    time: new Date().toISOString(),
    reactions: {}
  });
  saveDB();
  renderMessages();
}

function openGifPicker(){
  const gifs = [
    'https://media.giphy.com/media/l0HlHJGHe3yAMhdQY/giphy.gif',
    'https://media.giphy.com/media/julfEI93fRYJu/giphy.gif',
    'https://media.giphy.com/media/26AHPxxnSw1L9T1rW/giphy.gif',
    'https://media.giphy.com/media/3o7TKsjN41VR1GLf9m/giphy.gif'
  ];
  const ex = document.getElementById('gifModal');
  if(ex){ ex.remove(); return; }
  const modal = document.createElement('div');
  modal.id = 'gifModal';
  modal.className = 'modal-overlay';
  modal.innerHTML = `<div class="modal">
    <h2>🎬 صور GIF</h2>
    <div style="display:grid;grid-template-columns:repeat(2,1fr);gap:12px;padding:16px 0;max-height:300px;overflow-y:auto">
      ${gifs.map(g => `<img src="${g}" style="width:100%;height:120px;object-fit:cover;border-radius:8px;cursor:pointer" onclick="sendGif('${g}')">`).join('')}
    </div>
    <div class="modal-footer"><button class="btn btn-ghost" onclick="document.getElementById('gifModal').remove()">إغلاق</button></div>
  </div>`;
  modal.onclick = e => { if(e.target === modal) modal.remove(); };
  document.body.appendChild(modal);
}

function sendGif(gifUrl){
  document.getElementById('gifModal')?.remove();
  const sv = DB.servers[activeServer];
  const ch = sv?.channels.find(c => c.id === activeChannel);
  if(!ch) return;
  if(!ch.messages) ch.messages = [];
  ch.messages.push({
    id: uid(),
    user: me.username,
    text: '',
    imageUrl: gifUrl,
    time: new Date().toISOString(),
    reactions: {}
  });
  saveDB();
  renderMessages();
}

function openCreatePoll(sid, cid){
  if(!sid || !cid) return;
  const q = prompt('أدخل سؤال الاستطلاع:');
  if(!q) return;
  const optsRaw = prompt('أدخل الخيارات مفصولة بفصلة (,):', 'نعم, لا');
  if(!optsRaw) return;
  const options = optsRaw.split(',').map(o => o.trim()).filter(Boolean).map(o => ({ text: o, votes: [] }));
  if(options.length < 2){ toast('❌ يجب إدخال خيارين على الأقل', 'err'); return; }
  const sv = DB.servers[sid];
  const ch = sv?.channels.find(c => c.id === cid);
  if(!ch) return;
  if(!ch.messages) ch.messages = [];
  ch.messages.push({
    id: uid(),
    user: me.username,
    type: 'poll',
    question: q,
    options: options,
    time: new Date().toISOString()
  });
  saveDB();
  renderMessages();
  toast('📊 تم إنشاء الاستطلاع');
}

function votePoll(msgId, optIdx){
  const sv = DB.servers[activeServer];
  const ch = sv?.channels.find(c => c.id === activeChannel);
  const msg = ch?.messages.find(m => m.id === msgId);
  if(!msg || msg.type !== 'poll') return;
  msg.options.forEach(o => {
    o.votes = (o.votes || []).filter(u => u !== me.username);
  });
  msg.options[optIdx].votes.push(me.username);
  saveDB();
  renderMessages();
}

function toggleFocusMode(){
  document.body.classList.toggle('focus-mode');
  const active = document.body.classList.contains('focus-mode');
  toast(active ? '🎯 تم تفعيل وضع التركيز' : '🎯 تم إيقاف وضع التركيز');
}

function openServerStats(sid){
  const sv = DB.servers[sid];
  if(!sv) return;
  const totalMsgs = (sv.channels || []).reduce((acc, c) => acc + (c.messages?.length || 0), 0);
  const totalMembers = Object.keys(sv.members || {}).length;
  alert(`📈 إحصائيات ${sv.name}:\n• عدد الأعضاء: ${totalMembers}\n• عدد القنوات: ${sv.channels.length}\n• إجمالي الرسائل: ${totalMsgs}`);
}

function summarizeChat(){
  const sv = DB.servers[activeServer];
  const ch = sv?.channels.find(c => c.id === activeChannel);
  if(!ch || !ch.messages || !ch.messages.length){ toast('لا توجد رسائل لتلخيصها'); return; }
  const lastMsgs = ch.messages.slice(-15).map(m => `${DB.users[m.user]?.display || m.user}: ${m.text || '[محتوى]'}`).join('\n');
  alert(`📋 ملخص آخر الرسائل:\n\n${lastMsgs}`);
}

function toggleAutoTranslate(){
  toast('🌍 تم تفعيل المترجم التلقائي (محاكاة)');
}

function openLeaderboard(sid){
  const sv = DB.servers[sid];
  if(!sv) return;
  let counts = {};
  (sv.channels || []).forEach(c => {
    (c.messages || []).forEach(m => {
      counts[m.user] = (counts[m.user] || 0) + 1;
    });
  });
  const sorted = Object.entries(counts).sort((a,b) => b[1] - a[1]).slice(0, 5);
  let txt = '🏆 لوحة الأكثر تفاعلاً في السيرفر:\n\n';
  sorted.forEach(([u, cnt], i) => {
    txt += `${i+1}. ${DB.users[u]?.display || u}: ${cnt} رسالة\n`;
  });
  alert(txt || 'لا يزال السيرفر هادئاً!');
}

function openEconomyPanel(sid){
  toast('🪙 تم فتح نظام العملات والاقتصاد الخاص بالسيرفر');
}

function openReportsPanel(){
  toast('🚨 لا توجد بلاغات معلقة حالياً');
}

function openSearchModal(){
  openModal('searchModal');
  document.getElementById('searchInput')?.focus();
}

function doSearch(query){
  const resEl = document.getElementById('searchResults');
  if(!resEl) return;
  if(!query || !query.trim()){ resEl.innerHTML = ''; return; }
  const q = query.trim().toLowerCase();
  const sv = DB.servers[activeServer];
  if(!sv){ resEl.innerHTML = '<p style="color:var(--text-4)">يرجى تحديد سيرفر للبحث</p>'; return; }
  let matches = [];
  sv.channels.forEach(ch => {
    (ch.messages || []).forEach(m => {
      if(m.text && m.text.toLowerCase().includes(q)){
        matches.push({ chName: ch.name, chId: ch.id, msg: m });
      }
    });
  });
  if(!matches.length){ resEl.innerHTML = '<p style="color:var(--text-4);padding:12px">لا توجد نتائج</p>'; return; }
  resEl.innerHTML = matches.slice(0, 10).map(item => `
    <div style="background:var(--bg-input);padding:10px;border-radius:8px;margin-bottom:8px;cursor:pointer" onclick="closeModal('searchModal');openChannel('${activeServer}','${item.chId}');setTimeout(()=>scrollToMsg('${item.msg.id}'),300)">
      <div style="font-size:12px;color:var(--accent);font-weight:700"># ${esc(item.chName)} - ${esc(DB.users[item.msg.user]?.display || item.msg.user)}</div>
      <div style="font-size:13px;color:var(--text-1);margin-top:4px">${esc(item.msg.text)}</div>
    </div>
  `).join('');
}

function openNotifPanel(){
  toast('🔔 لا توجد إشعارات جديدة غير مقروءة');
}

function openShop(){
  toast('🛍️ متجر Tiscord — قريباً الأشكال والمميزات الخاصة!');
}

function openSettings(){
  openModal('settingsModal');
  renderSettings('profile');
}

function renderSettings(tab){
  settingsTab = tab;
  document.querySelectorAll('#settingsModal .tab-btn').forEach(btn => {
    btn.classList.toggle('active', btn.getAttribute('data-tab') === tab);
  });
  const u = DB.users[me.username];
  const body = document.getElementById('settingsBody');
  if(!body) return;
  if(tab === 'profile'){
    body.innerHTML = `
      <div class="form-group"><label>الاسم المعروض</label><input type="text" id="setDisp" value="${esc(u.display)}"></div>
      <div class="form-group"><label>البريد الإلكتروني</label><input type="email" id="setEmail" value="${esc(u.email || '')}"></div>
      <div class="form-group"><label>الحالة المخصصة</label><input type="text" id="setCustomStatus" value="${esc(u.customStatus || '')}" placeholder="ما الذي تفكر فيه؟"></div>
      <div class="form-group"><label>حالة الاتصال</label>
        <select id="setStatus">
          <option value="online" ${u.status === 'online' ? 'selected' : ''}>🟢 متاح</option>
          <option value="idle" ${u.status === 'idle' ? 'selected' : ''}>🟡 بعيد</option>
          <option value="dnd" ${u.status === 'dnd' ? 'selected' : ''}>🔴 لا تزعج</option>
          <option value="offline" ${u.status === 'offline' ? 'selected' : ''}>⚫ مخفي</option>
        </select>
      </div>
      <div class="form-group"><label>الصورة الشخصية (رابط)</label><input type="text" id="setPhoto" value="${esc(u.photoURL || '')}" placeholder="https://..."></div>
    `;
  } else if(tab === 'security'){
    body.innerHTML = `
      <div class="form-group"><label>كلمة المرور الجديدة</label><input type="password" id="setNewPass" placeholder="تغيير كلمة المرور..."></div>
    `;
  } else if(tab === 'appearance'){
    body.innerHTML = `
      <div class="form-group"><label>المظهر</label>
        <select id="setTheme" onchange="applyTheme(this.value)">
          <option value="dark" ${u.theme !== 'light' ? 'selected' : ''}>🌙 داكن</option>
          <option value="light" ${u.theme === 'light' ? 'selected' : ''}>☀️ فاتح</option>
        </select>
      </div>
      <div class="form-group"><label>لون التمييز (Accent Color)</label>
        <input type="color" id="setAccentColor" value="${u.accentColor || '#5865f2'}">
      </div>
    `;
  } else {
    body.innerHTML = `<div style="padding:20px;text-align:center;color:var(--text-3)">إعدادات ${tab} جاهزة ومفعّلة تلقائياً.</div>`;
  }
}

async function saveSettings(){
  const u = DB.users[me.username];
  if(!u) return;
  const disp = document.getElementById('setDisp')?.value;
  if(disp) u.display = disp.trim();
  const email = document.getElementById('setEmail')?.value;
  if(email !== undefined) u.email = email.trim();
  const cs = document.getElementById('setCustomStatus')?.value;
  if(cs !== undefined) u.customStatus = cs.trim();
  const st = document.getElementById('setStatus')?.value;
  if(st) u.status = st;
  const photo = document.getElementById('setPhoto')?.value;
  if(photo !== undefined) u.photoURL = photo.trim();
  const pass = document.getElementById('setNewPass')?.value;
  if(pass) u.password = await sha256Hex(pass);
  const theme = document.getElementById('setTheme')?.value;
  if(theme){ u.theme = theme; applyTheme(theme); }
  const accent = document.getElementById('setAccentColor')?.value;
  if(accent){ u.accentColor = accent; document.documentElement.style.setProperty('--accent', accent); }

  saveDB();
  refreshUserBar();
  closeModal('settingsModal');
  toast('💾 تم حفظ الإعدادات بنجاح!');
}

function loadAccentColor(){
  const u = me ? DB.users[me.username] : null;
  if(u?.accentColor) document.documentElement.style.setProperty('--accent', u.accentColor);
}

function loadChatBg(){}

function showProfile(uname){
  const u = DB.users[uname];
  if(!u) return;
  const content = document.getElementById('profileModalContent');
  if(!content) return;
  content.innerHTML = `
    <div style="background:${u.bannerColor || 'var(--accent)'};height:90px;border-radius:12px 12px 0 0;position:relative">
      <div style="position:absolute;bottom:-30px;right:20px;width:70px;height:70px;border-radius:50%;background:${avatarColor(uname)};border:4px solid var(--bg-card);display:flex;align-items:center;justify-content:center;font-size:28px;color:#fff">
        ${u.photoURL ? `<img src="${u.photoURL}" style="width:100%;height:100%;border-radius:50%;object-fit:cover">` : esc((u.avatar || u.display[0]).slice(0,2))}
      </div>
    </div>
    <div style="padding:40px 20px 20px 20px">
      <h2 style="font-size:20px;font-weight:900;color:var(--text-1)">${esc(u.display)}</h2>
      <div style="font-size:13px;color:var(--text-3);margin-bottom:12px">${esc(uname)} ${esc(u.tag || '')}</div>
      <div style="display:flex;gap:6px;margin-bottom:12px">${renderBadges(u)}</div>
      <p style="font-size:13px;color:var(--text-2);background:var(--bg-input);padding:10px;border-radius:8px">${esc(u.bio || u.customStatus || 'لا يوجد وصف مخصص')}</p>
      ${uname !== me.username ? `<button class="btn btn-accent" style="width:100%;margin-top:16px" onclick="closeModal('profileModal');openDM('${uname}')">💬 إرسال رسالة</button>` : ''}
    </div>
  `;
  openModal('profileModal');
}

function openImageModal(url){
  const img = document.getElementById('imageModalSrc');
  const btn = document.getElementById('imageDownloadBtn');
  if(img) img.src = url;
  if(btn) btn.href = url;
  openModal('imageModal');
}

let selectedSrvTemplate = 'gaming';
function selectTemplate(el, key){
  document.querySelectorAll('.srv-template').forEach(t => t.classList.remove('active'));
  el.classList.add('active');
  selectedSrvTemplate = key;
}

function createServer(){
  const name = document.getElementById('newSrvName')?.value.trim();
  const emoji = document.getElementById('newSrvEmoji')?.value.trim() || '🎮';
  const desc = document.getElementById('newSrvDesc')?.value.trim() || '';
  const isPublic = document.getElementById('srvPublic')?.checked || false;
  if(!name){ toast('❌ يرجى كتابة اسم السيرفر', 'err'); return; }
  const sid = 'srv_' + uid();
  const inviteCode = Math.random().toString(36).substring(2, 8).toUpperCase();
  const defaultChId = 'ch_' + uid();
  
  DB.servers[sid] = {
    id: sid,
    name,
    emoji,
    desc,
    public: isPublic,
    owner: me.username,
    inviteCode,
    members: { [me.username]: { role: 'owner', joinedAt: new Date().toISOString() } },
    channels: [
      { id: defaultChId, name: 'عام', type: 'text', category: 'القنوات العامة', messages: [] },
      { id: 'ch_' + uid(), name: 'صوتي-1', type: 'voice', category: 'القنوات الصوتية' }
    ],
    automod: { bannedWords: [], antiLink: false, antiInvite: false, antiSpam: false },
    warnings: {},
    customRoles: [],
    tickets: []
  };
  saveDB();
  closeModal('createServerModal');
  toast('🎉 تم إنشاء السيرفر بنجاح!');
  openServer(sid);
}

function joinServer(){
  const code = document.getElementById('joinCode')?.value.trim().toUpperCase();
  if(!code){ toast('❌ يرجى إدخال كود الدعوة', 'err'); return; }
  const sEntry = Object.entries(DB.servers).find(([sId, sv]) => sv.inviteCode === code);
  if(!sEntry){ toast('❌ كود الدعوة غير صحيح', 'err'); return; }
  const [sid, sv] = sEntry;
  if(!sv.members) sv.members = {};
  sv.members[me.username] = { role: 'user', joinedAt: new Date().toISOString() };
  saveDB();
  closeModal('joinServerModal');
  toast(`🚀 انضممت إلى ${sv.name}!`);
  openServer(sid);
}

let activeAddChCat = 'القنوات العامة';
function openAddChannel(sid, cat){
  activeAddChCat = cat;
  openModal('addChModal');
}

function addChannel(){
  if(!activeServer) return;
  const name = document.getElementById('addChName')?.value.trim();
  if(!name){ toast('❌ يرجى إدخال اسم القناة', 'err'); return; }
  const typeEls = document.getElementsByName('chType');
  let type = 'text';
  for(const el of typeEls){ if(el.checked) type = el.value; }
  const cat = document.getElementById('addChCat')?.value.trim() || activeAddChCat || 'القنوات';
  const isPrivate = document.getElementById('chPrivate')?.checked || false;

  const sv = DB.servers[activeServer];
  if(!sv) return;
  const newCh = {
    id: 'ch_' + uid(),
    name,
    type,
    category: cat,
    private: isPrivate,
    messages: []
  };
  sv.channels.push(newCh);
  saveDB();
  closeModal('addChModal');
  renderChannels(activeServer);
  toast('✨ تم إنشاء القناة بنجاح');
}

function openOwnerPanel(){
  if(!isOwnerUser()){ toast('❌ هذه الصفحة للأونر فقط', 'err'); return; }
  activeServer = null;
  activeChannel = null;
  activeDM = null;
  renderRail();
  showScreen('adminScreen');
  switchAdminTab('overview');
}

function switchAdminTab(tab){
  adminTab = tab;
  document.querySelectorAll('.a-nav-item').forEach(item => {
    item.classList.toggle('active', item.getAttribute('data-tab') === tab);
  });
  renderAdminTab(tab);
}

function renderAdminTab(tab){
  const body = document.getElementById('adminBody');
  if(!body) return;
  if(tab === 'overview'){
    const totalUsers = Object.keys(DB.users).length;
    const totalServers = Object.keys(DB.servers).length;
    body.innerHTML = `
      <div style="padding:20px">
        <h2>📊 نظرة عامة على التطبيق</h2>
        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:16px;margin-top:20px">
          <div style="background:var(--bg-card);padding:20px;border-radius:12px;border:1px solid var(--border)">
            <div style="font-size:13px;color:var(--text-3)">إجمالي المستخدمين</div>
            <div style="font-size:32px;font-weight:900;color:var(--accent);margin-top:8px">${totalUsers}</div>
          </div>
          <div style="background:var(--bg-card);padding:20px;border-radius:12px;border:1px solid var(--border)">
            <div style="font-size:13px;color:var(--text-3)">إجمالي السيرفرات</div>
            <div style="font-size:32px;font-weight:900;color:var(--green);margin-top:8px">${totalServers}</div>
          </div>
        </div>
      </div>
    `;
  } else if(tab === 'members'){
    body.innerHTML = `
      <div style="padding:20px">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px">
          <h2>👥 إدارة جميع المستخدمين</h2>
          <button class="btn btn-accent btn-sm" onclick="openModal('createAccountModal')">➕ إنشاء حساب جديد</button>
        </div>
        <div style="display:flex;flex-direction:column;gap:8px">
          ${Object.entries(DB.users).map(([uName, u]) => `
            <div style="display:flex;align-items:center;gap:12px;background:var(--bg-card);padding:10px 16px;border-radius:8px;border:1px solid var(--border)">
              <div style="font-weight:700;flex:1">${esc(u.display)} (${uName})</div>
              <div style="font-size:12px;color:var(--text-3)">${roleLabel(u.role || 'user')}</div>
              <button class="btn btn-ghost btn-sm" onclick="showProfile('${uName}')">عرض</button>
            </div>
          `).join('')}
        </div>
      </div>
    `;
  } else {
    body.innerHTML = `<div style="padding:20px"><h2>${tab}</h2><p style="color:var(--text-3)">قسم ${tab} جاهز ومستقر.</p></div>`;
  }
}

function renderOwnerPanel(){ renderAdminTab('overview'); }

function createAccount(){
  const u = document.getElementById('accUser')?.value.trim().toLowerCase();
  const disp = document.getElementById('accDisplay')?.value.trim();
  const pass = document.getElementById('accPass')?.value;
  const role = document.getElementById('accRole')?.value || 'user';
  const errEl = document.getElementById('accError');
  if(!u || !disp || !pass){ showErr(errEl, '❌ يرجى التعبئة كاملة'); return; }
  if(DB.users[u]){ showErr(errEl, '❌ الحساب موجود مسبقاً'); return; }
  
  sha256Hex(pass).then(hashed => {
    const tag = '#' + String(Object.keys(DB.users).length + 1).padStart(4, '0');
    DB.users[u] = {
      password: hashed,
      display: disp,
      tag,
      role,
      avatar: '😀',
      status: 'offline',
      joinDate: new Date().toISOString(),
      friends: []
    };
    saveDB();
    closeModal('createAccountModal');
    toast('✨ تم إنشاء الحساب بنجاح!');
  });
}

function openMyTickets(sid){
  toast('🎫 نظام التذاكر مفعّل');
}

function checkInviteUrl(){
  const hash = location.hash;
  if(hash.startsWith('#invite=')){
    const code = hash.replace('#invite=', '').toUpperCase();
    openModal('joinServerModal');
    const inp = document.getElementById('joinCode');
    if(inp) inp.value = code;
  }
}

function logLogin(u){
  addLog(null, 'تسجيل دخول ناجح', u);
}

// Initialize Database on script load
loadDB();