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
  Object.values(DB.users).forEach(u=>{if(!u.friends)u.friends=[];if(u.customStatus===undefined)u.customStatus='';});
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
function myServerRole(sid){const sv=DB.servers[sid];if(!sv)return 'user';const u=DB.users[me?.username];if(u?.role==='owner')return 'owner';if(sv.owner===me?.username)return 'owner';return sv.members?.[me?.username]?.role||'user';}
function isOwnerUser(){return me?.username==='hosennujq2';}

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
function doLogin(){const u=document.getElementById('loginUser').value.trim().toLowerCase();const p=document.getElementById('loginPass').value;const errEl=document.getElementById('loginError');const user=DB.users[u];if(!user||user.password!==p){showErr(errEl,'❌ اسم المستخدم أو كلمة المرور غلط');document.getElementById('loginPass').value='';return;}errEl.style.display='none';DB.users[u].status='online';saveDB();me={username:u,...DB.users[u]};addLog(null,'تسجيل دخول',u);bootApp();}
function doRegister(){const u=document.getElementById('regUser').value.trim().toLowerCase();const disp=document.getElementById('regDisplay').value.trim();const email=document.getElementById('regEmail').value.trim();const p=document.getElementById('regPass').value;const errEl=document.getElementById('regError');if(!u||!disp||!p){showErr(errEl,'❌ يرجى ملء جميع الحقول');return;}if(u.length<3){showErr(errEl,'❌ اسم المستخدم قصير');return;}if(!/^[a-z0-9_]+$/.test(u)){showErr(errEl,'❌ أحرف إنجليزية وأرقام فقط');return;}if(p.length<6){showErr(errEl,'❌ كلمة المرور قصيرة');return;}if(DB.users[u]){showErr(errEl,'❌ اسم المستخدم مستخدم');return;}const tag='#'+String(Object.keys(DB.users).length+1).padStart(4,'0');DB.users[u]={password:p,display:disp,tag,email,role:'user',avatar:'😀',status:'online',joinDate:new Date().toISOString(),theme:'dark',bio:'',banner:'',bannerColor:'#5865f2',badges:['early'],nitro:false,boosts:0,friends:[],customStatus:''};saveDB();me={username:u,...DB.users[u]};addLog(null,'تسجيل حساب',u);bootApp();}
function showErr(el,msg){el.textContent=msg;el.style.display='block';}
function doLogout(){leaveVoiceChannel();if(me&&DB.users[me.username])DB.users[me.username].status='offline';saveDB();const fb=window._firebase;if(fb?.ready&&fb.auth?.currentUser)fb.signOut(fb.auth).catch(()=>{});me=null;activeServer=null;activeChannel=null;activeDM=null;document.getElementById('app').classList.add('hidden');document.getElementById('authPage').classList.remove('hidden');}
function checkPassStrength(p){const el=document.getElementById('passStrength');if(!el)return;if(!p){el.className='pass-strength';return;}let s=0;if(p.length>=8)s++;if(/[A-Za-z]/.test(p))s++;if(/[0-9]/.test(p))s++;if(/[^A-Za-z0-9]/.test(p))s++;el.className='pass-strength '+(s<=1?'weak':s<=2?'medium':'strong');}
function handleTyping(el){el.style.height='auto';el.style.height=Math.min(el.scrollHeight,120)+'px';if(el.id==='regPass')checkPassStrength(el.value);}
function togglePass(inputId,btn){const el=document.getElementById(inputId);if(!el)return;el.type=el.type==='password'?'text':'password';btn.textContent=el.type==='password'?'👁️':'🙈';}

/* ═══════════════════════════════════════════════
   BOOT
═══════════════════════════════════════════════ */
function bootApp(){document.getElementById('authPage').classList.add('hidden');document.getElementById('app').classList.remove('hidden');applyTheme(DB.users[me.username]?.theme||'dark');if(DB.users[me.username]?.fontSize)document.body.style.fontSize=DB.users[me.username].fontSize+'px';refreshUserBar();renderRail();openHome();renderOwnerPanel();toast('أهلاً، '+(DB.users[me.username]?.display||me.username)+' 👋');checkInviteUrl();}
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
  let html=`<div class="ch-cat">التنقل</div>
    <div class="ch-item" onclick="openDMView()"><span class="ch-sym">👥</span> الأصدقاء</div>
    <div class="ch-item" onclick="openDMRequests()"><span class="ch-sym">📨</span> الطلبات ${pending>0?`<span class="ch-badge">${pending}</span>`:''}</div>
    <div class="ch-cat">المحادثات</div>`;
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
    const contentHtml=msg.imageUrl?`<img class="msg-image" src="${msg.imageUrl}" alt="صورة" onclick="openImageModal('${msg.imageUrl}')">`:`<div class="msg-text">${processMsg(msg.text||'')}</div>`;
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
  ROLE_ORDER.forEach(r=>{if(!grouped[r]?.length)return;html+=`<div class="m-cat">${catNames[r]||r} — ${grouped[r].length}</div>`;grouped[r].forEach(({uname,u,r:role})=>{const status=u.status||'offline';html+=`<div class="m-item" onclick="showProfile('${uname}')"><div class="m-avatar" style="background:${avatarColor(uname)}">${u.photoURL?`<img src="${u.photoURL}" style="width:100%;height:100%;border-radius:50%;object-fit:cover">`:`<span>${esc((u.avatar||u.display[0]).slice(0,2))}</span>`}<div class="m-status ${status}"></div></div><div><div class="m-nick rc-${roleCls(role)}">${esc(u.display)}</div>${roleLabel(role)?`<div class="m-role-label">${roleLabel(role)}</div>`:''}</div></div>`;});});
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
    const contentHtml=msg.imageUrl?`<img class="msg-image" src="${msg.imageUrl}" alt="صورة" onclick="openImageModal('${msg.imageUrl}')">`:`<div class="msg-text">${processMsg(msg.text||'')}</div>`;
    const nameCls=hasNitro(msg.user)?`msg-author rc-${roleCls(r)} nitro-name`:`msg-author rc-${roleCls(r)}`;
    html+=`<div class="msg-group${isOwn?' own':''}" id="msg-${msg.id}" data-msgid="${msg.id}">
      <div class="msg-av" style="background:${avatarColor(msg.user)}" onclick="showProfile('${msg.user}')">${u.photoURL?`<img src="${u.photoURL}" style="width:100%;height:100%;border-radius:50%;object-fit:cover">`:esc((u.avatar||u.display[0]).slice(0,2))}</div>
      <div class="msg-body">
        <div class="msg-meta"><span class="${nameCls}" onclick="showProfile('${msg.user}')">${esc(u.display)}</span>${badge(r)}<span class="badges-row">${renderBadges(u)}</span><span class="msg-ts">${fmtRel(msg.time)}</span></div>
        ${replyHtml}${contentHtml}${reactHtml}
      </div>
      <div class="msg-actions">
        <button class="msg-act-btn" onclick="setReply('${msg.id}')" title="رد">↩</button>
        <button class="msg-act-btn" onclick="addReactionPicker('${msg.id}')" title="إيموجي">😊</button>
        ${isOwn||isStaff(myServerRole(activeServer))?`<button class="msg-act-btn" onclick="deleteMsg('${msg.id}')">🗑️</button>`:''}
        ${isStaff(myServerRole(activeServer))?`<button class="msg-act-btn" onclick="pinMsg('${msg.id}')">📌</button>`:''}
      </div>
    </div>`;
  });
  inner.innerHTML=html;
  const wrap=document.getElementById('msgsWrap');wrap.scrollTop=wrap.scrollHeight;
}
function handleChatKey(e){if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();sendMsg();return;}const ta=e.target;ta.style.height='auto';ta.style.height=Math.min(ta.scrollHeight,120)+'px';}
function sendMsg(){const input=document.getElementById('chatInputEl');const text=input.value.trim();if(!text||!activeServer||!activeChannel)return;const sv=DB.servers[activeServer];const ch=sv?.channels.find(c=>c.id===activeChannel);if(!ch)return;if(!ch.messages)ch.messages=[];const msg={id:uid(),user:me.username,text,time:new Date().toISOString(),reactions:{}};if(replyTo){msg.replyTo=replyTo;clearReply();}ch.messages.push(msg);if(ch.messages.length>1000)ch.messages.shift();saveDB();input.value='';input.style.height='auto';renderMessages();}
function setReply(msgId){const sv=DB.servers[activeServer];const ch=sv?.channels.find(c=>c.id===activeChannel);if(!ch)return;const msg=ch.messages.find(m=>m.id===msgId);if(!msg)return;replyTo=msgId;const preview=document.getElementById('replyPreview');const u=DB.users[msg.user]||{display:msg.user};document.getElementById('replyPreviewText').textContent='الرد على '+u.display+': '+(msg.text||'').slice(0,50);preview.classList.remove('hidden');document.getElementById('chatInputEl').focus();}
function clearReply(){replyTo=null;document.getElementById('replyPreview')?.classList.add('hidden');}
function deleteMsg(msgId){const sv=DB.servers[activeServer];const ch=sv?.channels.find(c=>c.id===activeChannel);if(!ch)return;const idx=ch.messages.findIndex(m=>m.id===msgId);if(idx===-1)return;const msg=ch.messages[idx];if(msg.user!==me.username&&!isStaff(myServerRole(activeServer)))return;ch.messages.splice(idx,1);saveDB();renderMessages();toast('🗑️ تم حذف الرسالة');}
function pinMsg(msgId){const sv=DB.servers[activeServer];const ch=sv?.channels.find(c=>c.id===activeChannel);if(!ch)return;const msg=ch.messages.find(m=>m.id===msgId);if(!msg)return;msg.pinned=!msg.pinned;saveDB();toast(msg.pinned?'📌 تم التثبيت':'📌 إلغاء التثبيت');renderMessages();}
function toggleReaction(msgId,emoji){const sv=DB.servers[activeServer];const ch=sv?.channels.find(c=>c.id===activeChannel);if(!ch)return;const msg=ch.messages.find(m=>m.id===msgId);if(!msg)return;if(!msg.reactions)msg.reactions={};if(!msg.reactions[emoji])msg.reactions[emoji]=[];const idx=msg.reactions[emoji].indexOf(me.username);if(idx===-1)msg.reactions[emoji].push(me.username);else msg.reactions[emoji].splice(idx,1);if(!msg.reactions[emoji].length)delete msg.reactions[emoji];saveDB();renderMessages();}
function addReactionPicker(msgId){const quick=['👍','❤️','😂','😮','😢','😡','🔥','✨'];const ex=document.getElementById('quickReactPicker');if(ex)ex.remove();const picker=document.createElement('div');picker.id='quickReactPicker';picker.style.cssText='position:fixed;z-index:500;background:var(--bg-card);border:1px solid var(--border-2);border-radius:12px;padding:8px;display:flex;gap:4px;box-shadow:0 8px 32px rgba(0,0,0,.4)';quick.forEach(e=>{const btn=document.createElement('div');btn.className='emoji-item';btn.style.cssText='padding:6px;font-size:22px;cursor:pointer;border-radius:8px';btn.textContent=e;btn.onclick=()=>{toggleReaction(msgId,e);picker.remove();};picker.appendChild(btn);});document.body.appendChild(picker);const el=document.getElementById('msg-'+msgId);if(el){const r=el.getBoundingClientRect();picker.style.top=(r.top-60)+'px';picker.style.right='100px';}setTimeout(()=>document.addEventListener('click',()=>picker.remove(),{once:true}),50);}
function scrollToMsg(id){const el=document.getElementById('msg-'+id);if(el){el.scrollIntoView({behavior:'smooth',block:'center'});el.style.background='var(--accent-glow)';setTimeout(()=>el.style.background='',1500);}}
function openFileUpload(){const input=document.createElement('input');input.type='file';input.accept='image/*';input.onchange=e=>{const file=e.target.files[0];if(!file)return;if(file.size>5*1024*1024){toast('❌ الصورة أكبر من 5MB','err');return;}const reader=new FileReader();reader.onload=ev=>sendImageMsg(ev.target.result);reader.readAsDataURL(file);};input.click();}
function sendImageMsg(imageUrl){if(!activeServer||!activeChannel)return;const sv=DB.servers[activeServer];const ch=sv?.channels.find(c=>c.id===activeChannel);if(!ch)return;if(!ch.messages)ch.messages=[];ch.messages.push({id:uid(),user:me.username,text:'',imageUrl,time:new Date().toISOString(),reactions:{}});saveDB();renderMessages();toast('✅ تم إرسال الصورة!');}
function openImageModal(src){document.getElementById('imageModalSrc').src=src;document.getElementById('imageDownloadBtn').href=src;openModal('imageModal');}

/* ═══════════════════════════════════════════════
   JOIN SERVER - FIXED
═══════════════════════════════════════════════ */
function joinServer(){
  const input=document.getElementById('joinCode');if(!input){toast('❌ خطأ','err');return;}
  const code=input.value.trim().toUpperCase();
  const errEl=document.getElementById('joinError');
  if(!code){if(errEl){errEl.textContent='❌ أدخل كود الدعوة';errEl.style.display='block';}return;}
  const sv=Object.values(DB.servers).find(s=>s.inviteCode&&s.inviteCode.trim().toUpperCase()===code);
  if(!sv){if(errEl){errEl.textContent='❌ كود الدعوة غير صحيح';errEl.style.display='block';}return;}
  if(sv.bans?.includes(me.username)){toast('❌ أنت محظور من هذا السيرفر','err');return;}
  if(sv.members?.[me.username]){toast('أنت موجود في السيرفر!');closeModal('joinServerModal');openServer(sv.id);return;}
  sv.members[me.username]={role:'user',joinDate:new Date().toISOString()};
  saveDB();closeModal('joinServerModal');
  if(errEl)errEl.style.display='none';input.value='';
  document.getElementById('serverPreview')?.classList.add('hidden');
  addLog(sv.id,'انضمام للسيرفر',me.username);
  renderRail();openServer(sv.id);toast('✅ أهلاً في '+sv.name+'!');
}

/* ═══════════════════════════════════════════════
   CREATE SERVER
═══════════════════════════════════════════════ */
const TEMPLATES={gaming:{name:'سيرفر الألعاب',emoji:'🎮',channels:[{n:'عام',t:'text',c:'عام'},{n:'بث-مباشر',t:'text',c:'عام'},{n:'صوتي-عام',t:'voice',c:'صوتي'}]},study:{name:'مجموعة الدراسة',emoji:'📚',channels:[{n:'عام',t:'text',c:'عام'},{n:'أسئلة',t:'text',c:'دراسة'},{n:'مذاكرة',t:'voice',c:'صوتي'}]},friends:{name:'سيرفر الأصدقاء',emoji:'🤝',channels:[{n:'عام',t:'text',c:'عام'},{n:'ميمز',t:'text',c:'ترفيه'},{n:'دردشة',t:'voice',c:'صوتي'}]},art:{name:'جاليري الفنون',emoji:'🎨',channels:[{n:'عام',t:'text',c:'عام'},{n:'أعمالي',t:'text',c:'فن'}]},music:{name:'سيرفر الموسيقى',emoji:'🎵',channels:[{n:'عام',t:'text',c:'عام'},{n:'استماع',t:'voice',c:'صوتي'}]},custom:{name:'',emoji:'🎮',channels:[]}};
function selectTemplate(el,key){document.querySelectorAll('.srv-template').forEach(t=>t.classList.remove('active'));el.classList.add('active');const tpl=TEMPLATES[key];if(!tpl||key==='custom')return;document.getElementById('newSrvName').value=tpl.name;document.getElementById('newSrvEmoji').value=tpl.emoji;}
function createServer(){
  const name=document.getElementById('newSrvName').value.trim();const emoji=document.getElementById('newSrvEmoji').value.trim()||'🎮';const desc=document.getElementById('newSrvDesc').value.trim();const isPublic=document.getElementById('srvPublic').checked;
  if(!name){toast('❌ أدخل اسم السيرفر','err');return;}
  const sid=uid();const code=Math.random().toString(36).slice(2,8).toUpperCase();
  const tplKey=document.querySelector('.srv-template.active')?.dataset.key;const tpl=tplKey&&TEMPLATES[tplKey];
  const defaultCh=tpl?.channels?.length?tpl.channels.map(c=>({id:uid(),name:c.n,type:c.t,category:c.c,messages:[],private:false})):[{id:uid(),name:'عام',type:'text',category:'القنوات العامة',messages:[],private:false},{id:uid(),name:'الإعلانات',type:'announce',category:'القنوات العامة',messages:[],private:false},{id:uid(),name:'صوتي-عام',type:'voice',category:'القنوات الصوتية',messages:[],private:false}];
  DB.servers[sid]={id:sid,name,emoji,desc,owner:me.username,createdAt:new Date().toISOString(),inviteCode:code,isPublic,members:{[me.username]:{role:'owner',joinDate:new Date().toISOString()}},channels:defaultCh,logs:[],webhooks:[],bans:[],roles:{},voiceRooms:{}};
  saveDB();closeModal('createServerModal');
  ['newSrvName','newSrvDesc'].forEach(id=>{const el=document.getElementById(id);if(el)el.value='';});
  document.getElementById('newSrvEmoji').value='🎮';
  addLog(sid,'إنشاء سيرفر',me.username,name);renderRail();openServer(sid);toast('✅ تم إنشاء السيرفر!');
}

/* ═══════════════════════════════════════════════
   ADD CHANNEL
═══════════════════════════════════════════════ */
function openAddChannel(sid,cat){document.getElementById('addChCat').value=cat;document.getElementById('addChModal').dataset.sid=sid;openModal('addChModal');}
function addChannel(){const modal=document.getElementById('addChModal');const sid=modal.dataset.sid||activeServer;const sv=DB.servers[sid];const type=document.querySelector('input[name="chType"]:checked')?.value||'text';const name=document.getElementById('addChName').value.trim();const cat=document.getElementById('addChCat').value.trim()||'القنوات';const priv=document.getElementById('chPrivate').checked;if(!name){toast('❌ أدخل اسم القناة','err');return;}sv.channels.push({id:uid(),name,type,category:cat,messages:[],private:priv});saveDB();closeModal('addChModal');document.getElementById('addChName').value='';addLog(sid,'إنشاء قناة',me.username,name);renderChannels(sid);toast('✅ تم إنشاء القناة!');}
/* ═══════════════════════════════════════════════
   ADMIN PANEL
═══════════════════════════════════════════════ */
function openAdminPanel(sid){activeServer=sid;showScreen('adminScreen');switchAdminTab('overview');}
function switchAdminTab(tab){adminTab=tab;document.querySelectorAll('.a-nav-item').forEach(el=>el.classList.toggle('active',el.dataset.tab===tab));renderAdmin();}
function renderAdmin(){
  const sv=DB.servers[activeServer];const myRole=myServerRole(activeServer);const body=document.getElementById('adminBody');
  if(!sv){body.innerHTML='<div class="empty"><p>لا يوجد سيرفر</p></div>';return;}
  switch(adminTab){
    case 'overview':renderAdminOverview(sv,body,myRole);break;
    case 'members':renderAdminMembers(sv,body,myRole);break;
    case 'roles':renderAdminRoles(sv,body,myRole);break;
    case 'channels':renderAdminChannels(sv,body,myRole);break;
    case 'webhooks':renderAdminWebhooks(sv,body,myRole);break;
    case 'logs':renderAdminLogs(sv,body);break;
    case 'bans':renderAdminBans(sv,body,myRole);break;
    case 'invites':renderAdminInvites(sv,body,myRole);break;
    case 'settings':renderAdminSettings(sv,body,myRole);break;
    default:body.innerHTML='<div class="empty"><p>قريباً</p></div>';
  }
}
function renderAdminOverview(sv,el,myRole){
  const mc=Object.keys(sv.members).length,cc=sv.channels.length,ms=sv.channels.reduce((a,c)=>a+(c.messages?.length||0),0),bc=sv.bans?.length||0;
  el.innerHTML=`<div class="a-title">📊 نظرة عامة</div>
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
    <div class="t-wrap"><table>
      <tr><td>الاسم</td><td style="color:var(--text-1);font-weight:600">${esc(sv.name)}</td></tr>
      <tr><td>الأونر</td><td class="rc-owner" style="font-weight:600">${esc(DB.users[sv.owner]?.display||sv.owner)}</td></tr>
      <tr><td>تاريخ الإنشاء</td><td>${fmtDate(sv.createdAt)}</td></tr>
      <tr><td>الوصف</td><td>${esc(sv.desc||'—')}</td></tr>
      <tr><td>النوع</td><td>${sv.isPublic?'🌐 عام':'🔒 خاص'}</td></tr>
    </table></div>
    ${myRole==='owner'?`<button class="btn btn-accent" style="margin-top:12px" onclick="openModal('createAccountModal')">👤 إنشاء حساب جديد</button>`:''}`;
}
function renderAdminMembers(sv,el,myRole){
  let rows='';
  Object.entries(sv.members).forEach(([uname,m])=>{
    const u=DB.users[uname];if(!u)return;
    const role=u.role==='owner'?'owner':(m.role||'user');
    const editable=(canManage(myRole,role)||myRole==='owner')&&role!=='owner';
    rows+=`<tr>
      <td><div style="display:flex;align-items:center;gap:8px">
        <div style="width:32px;height:32px;border-radius:50%;background:${avatarColor(uname)};display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:700;color:#fff">
          ${u.photoURL?`<img src="${u.photoURL}" style="width:100%;height:100%;border-radius:50%;object-fit:cover">`:esc((u.avatar||u.display[0]).slice(0,2))}
        </div>
        <div><div style="font-weight:600;color:var(--text-1)">${esc(u.display)}</div><div style="font-size:11px;color:var(--text-4)">${uname}</div></div>
      </div></td>
      <td>${badge(role)||'عضو'}</td>
      <td>${fmtDate(m.joinDate||u.joinDate)}</td>
      <td><div style="display:flex;gap:4px;flex-wrap:wrap">
        ${editable?`<select class="role-sel" onchange="setMemberRole('${sv.id}','${uname}',this.value)">${ROLE_ORDER.filter(r=>r!=='owner').map(r=>`<option value="${r}" ${role===r?'selected':''}>${roleLabel(r)||'عضو'}</option>`).join('')}</select>`:''}
        ${editable?`<button class="btn btn-warn btn-sm" onclick="kickMember('${sv.id}','${uname}')">طرد</button><button class="btn btn-danger btn-sm" onclick="banMember('${sv.id}','${uname}')">حظر</button>`:''}
      </div></td>
    </tr>`;
  });
  el.innerHTML=`<div class="a-title">👥 إدارة الأعضاء</div>
    <div class="t-wrap"><table><thead><tr><th>العضو</th><th>الرتبة</th><th>تاريخ الانضمام</th><th>الإجراءات</th></tr></thead><tbody>${rows}</tbody></table></div>`;
}
function setMemberRole(sid,uname,newRole){const sv=DB.servers[sid];if(!sv?.members[uname])return;sv.members[uname].role=newRole;if(DB.users[uname])DB.users[uname].role=newRole;saveDB();addLog(sid,'تغيير رتبة',me.username,uname+'←'+newRole);toast('✅ تم تغيير الرتبة إلى '+roleLabel(newRole));renderAdmin();renderMembers(sid);}
function kickMember(sid,uname){if(uname===me.username){toast('❌ لا يمكنك طرد نفسك','err');return;}if(!confirm('هل تريد طرد '+DB.users[uname]?.display+'؟'))return;delete DB.servers[sid].members[uname];saveDB();addLog(sid,'طرد عضو',me.username,uname);toast('👟 تم الطرد');renderAdmin();renderMembers(sid);}
function banMember(sid,uname){if(uname===me.username){toast('❌ لا يمكنك حظر نفسك','err');return;}if(!confirm('هل تريد حظر '+DB.users[uname]?.display+'؟'))return;const sv=DB.servers[sid];if(!sv.bans)sv.bans=[];if(!sv.bans.includes(uname))sv.bans.push(uname);delete sv.members[uname];saveDB();addLog(sid,'حظر عضو',me.username,uname);toast('🔨 تم الحظر');renderAdmin();renderMembers(sid);}
function unbanMember(sid,uname){DB.servers[sid].bans=DB.servers[sid].bans.filter(b=>b!==uname);saveDB();addLog(sid,'رفع الحظر',me.username,uname);toast('✅ تم رفع الحظر');renderAdmin();}

/* ROLES */
function renderAdminRoles(sv,el,myRole){
  const canEdit=myRole==='owner'||myRole==='leader';
  const custom=sv.roles||{};
  let html=`<div class="a-title">🎖️ نظام الرتب</div>`;
  if(canEdit)html+=`<div class="t-wrap" style="margin-bottom:16px;padding:16px"><h3 style="margin-bottom:12px">➕ إضافة رتبة مخصصة</h3>
    <div style="display:flex;gap:8px;flex-wrap:wrap">
      <input id="newRoleName" type="text" placeholder="اسم الرتبة" style="flex:1;padding:8px 12px;background:var(--bg-input);border:none;border-radius:8px;color:var(--text-1);font-family:var(--font-main)">
      <input id="newRoleColor" type="color" value="#5865f2" style="width:48px;height:38px;border:none;border-radius:8px;cursor:pointer">
      <button class="btn btn-accent" onclick="addCustomRole('${sv.id}')">إضافة</button>
    </div></div>`;
  if(Object.keys(custom).length){
    html+=`<div class="t-wrap" style="margin-bottom:16px"><div style="padding:12px 16px;font-weight:700;color:var(--text-2)">🎨 الرتب المخصصة</div>`;
    Object.entries(custom).forEach(([rid,r])=>{html+=`<div style="display:flex;align-items:center;justify-content:space-between;padding:12px 16px;border-top:1px solid var(--border)"><div style="display:flex;align-items:center;gap:10px"><span style="width:14px;height:14px;border-radius:50%;background:${r.color};display:inline-block"></span><span style="font-weight:600;color:${r.color}">${esc(r.name)}</span></div>${canEdit?`<button class="btn btn-danger btn-sm" onclick="deleteCustomRole('${sv.id}','${rid}')">🗑️</button>`:''}</div>`;});
    html+=`</div>`;
  }
  [['leader','ليدر','var(--c-leader)',['كل الصلاحيات','إدارة الأعضاء','طرد/حظر']],['manager','مانجر','var(--c-manager)',['إدارة الأعضاء','إنشاء قنوات']],['admin-mgr','أدمن مانجر','var(--c-admin-mgr)',['إدارة الأدمنز']],['head','هيد أدمن','var(--c-head)',['قبول الطلبات']],['super','سوبر أدمن','var(--c-super)',['مراقبة الأعضاء']],['helper','هيلبر','var(--c-helper)',['مساعدة الأعضاء']]].forEach(([key,name,color,perms])=>{
    html+=`<div class="t-wrap" style="margin-bottom:12px"><div class="t-head"><h3 style="color:${color}">${name}</h3></div><div style="padding:12px 16px;display:flex;gap:8px;flex-wrap:wrap">${perms.map(p=>`<span style="background:var(--bg-input);border:1px solid var(--border);padding:4px 12px;border-radius:99px;font-size:13px;color:var(--text-2)">✓ ${p}</span>`).join('')}</div></div>`;
  });
  el.innerHTML=html;
}
function addCustomRole(sid){const name=document.getElementById('newRoleName')?.value.trim();const color=document.getElementById('newRoleColor')?.value||'#5865f2';if(!name){toast('❌ أدخل اسم الرتبة','err');return;}const sv=DB.servers[sid];if(!sv.roles)sv.roles={};const rid=uid();sv.roles[rid]={id:rid,name,color,createdBy:me.username,createdAt:new Date().toISOString()};saveDB();addLog(sid,'إضافة رتبة',me.username,name);toast('✅ تم إضافة رتبة '+name);renderAdmin();}
function deleteCustomRole(sid,rid){if(!confirm('حذف هذه الرتبة؟'))return;delete DB.servers[sid].roles[rid];saveDB();toast('🗑️ تم الحذف');renderAdmin();}

/* CHANNELS */
function renderAdminChannels(sv,el,myRole){const rows=sv.channels.map(ch=>{const sym=ch.type==='voice'?'🔊 صوتية':ch.type==='announce'?'📢 إعلانات':'💬 نصية';return `<tr><td style="font-weight:600">${esc(ch.name)}</td><td>${sym}</td><td>${esc(ch.category||'—')}</td><td>${ch.messages?.length||0}</td><td>${ch.private?'🔒':'🌐'}</td><td>${(myRole==='owner'||myRole==='leader')?`<button class="btn btn-ghost btn-sm" onclick="openChSettings('${activeServer}','${ch.id}')">⚙️</button> <button class="btn btn-danger btn-sm" onclick="deleteChannel('${activeServer}','${ch.id}')">🗑️</button>`:'—'}</td></tr>`;}).join('');el.innerHTML=`<div class="a-title">💬 إدارة القنوات</div><div style="margin-bottom:16px"><button class="btn btn-accent" onclick="openAddChannel('${activeServer}','')">➕ قناة جديدة</button></div><div class="t-wrap"><table><thead><tr><th>الاسم</th><th>النوع</th><th>الفئة</th><th>الرسائل</th><th>الوصول</th><th>إجراءات</th></tr></thead><tbody>${rows}</tbody></table></div>`;}
function openChSettings(sid,cid){const sv=DB.servers[sid];const ch=sv?.channels.find(c=>c.id===cid);if(!ch)return;const ov=document.createElement('div');ov.className='modal-overlay';ov.id='chSetOv';ov.innerHTML=`<div class="modal"><h2>⚙️ إعدادات — ${esc(ch.name)}</h2><div class="form-group"><label>الاسم</label><input id="csName" type="text" value="${esc(ch.name)}"></div><div class="form-group"><label>الفئة</label><input id="csCat" type="text" value="${esc(ch.category||'')}"></div><div class="form-group"><label>الوصف</label><input id="csDesc" type="text" value="${esc(ch.desc||'')}"></div><div class="form-group"><label><input type="checkbox" id="csPrivate" ${ch.private?'checked':''}> قناة خاصة</label></div><div class="modal-footer"><button class="btn btn-ghost" onclick="document.getElementById('chSetOv').remove()">إلغاء</button><button class="btn btn-accent" onclick="saveChSettings('${sid}','${cid}')">💾 حفظ</button></div></div>`;ov.addEventListener('click',e=>{if(e.target===ov)ov.remove();});document.body.appendChild(ov);}
function saveChSettings(sid,cid){const sv=DB.servers[sid];const ch=sv?.channels.find(c=>c.id===cid);if(!ch)return;ch.name=document.getElementById('csName')?.value.trim()||ch.name;ch.category=document.getElementById('csCat')?.value.trim()||ch.category;ch.desc=document.getElementById('csDesc')?.value.trim()||'';ch.private=document.getElementById('csPrivate')?.checked;saveDB();document.getElementById('chSetOv')?.remove();addLog(sid,'تعديل قناة',me.username,ch.name);toast('✅ تم الحفظ!');renderAdmin();renderChannels(sid);}
function deleteChannel(sid,cid){if(!confirm('حذف القناة؟'))return;const sv=DB.servers[sid];sv.channels=sv.channels.filter(c=>c.id!==cid);saveDB();if(activeChannel===cid){activeChannel=null;showScreen('homeScreen');}renderAdmin();renderChannels(sid);toast('🗑️ تم الحذف');}

/* WEBHOOKS, LOGS, BANS, INVITES */
function renderAdminWebhooks(sv,el,myRole){if(!sv.webhooks)sv.webhooks=[];const items=sv.webhooks.map(wh=>`<div class="wh-item"><div style="flex:1"><div class="wh-name">${esc(wh.name)}</div><div class="wh-url">${esc(wh.url)}</div></div><div class="wh-actions"><button class="btn btn-ghost btn-sm" onclick="copyText('${esc(wh.url)}')">📋</button><button class="btn btn-danger btn-sm" onclick="deleteWebhook('${activeServer}','${wh.id}')">🗑️</button></div></div>`).join('');el.innerHTML=`<div class="a-title">🔗 الويبهوك</div><div class="input-row" style="margin-bottom:20px"><input type="text" id="whName" placeholder="اسم الويبهوك"><button class="btn btn-accent" onclick="createWebhook('${activeServer}')">➕ إنشاء</button></div><div class="t-wrap">${items||'<div class="empty"><div class="e-icon">🔗</div><p>لا توجد ويبهوكات</p></div>'}</div>`;}
function createWebhook(sid){const name=document.getElementById('whName')?.value.trim();if(!name){toast('❌ أدخل اسم','err');return;}const sv=DB.servers[sid];if(!sv.webhooks)sv.webhooks=[];sv.webhooks.push({id:uid(),name,url:'https://tiscord.app/webhooks/'+uid(),createdBy:me.username,createdAt:new Date().toISOString()});saveDB();addLog(sid,'إنشاء ويبهوك',me.username,name);toast('✅ تم الإنشاء!');renderAdmin();}
function deleteWebhook(sid,wid){if(!confirm('حذف الويبهوك؟'))return;DB.servers[sid].webhooks=DB.servers[sid].webhooks.filter(w=>w.id!==wid);saveDB();toast('🗑️ تم الحذف');renderAdmin();}
function renderAdminLogs(sv,el){const logs=sv.logs||[];const rows=logs.slice(0,100).map(l=>`<div class="log-row"><span class="log-ts">🕐 ${fmtDate(l.time)} ${fmtTime(l.time)}</span><span class="log-act-badge">${esc(l.action)}</span><span class="log-detail">بواسطة <strong>${esc(DB.users[l.by]?.display||l.by)}</strong>${l.target?' — '+esc(l.target):''}</span></div>`).join('');el.innerHTML=`<div class="a-title">📋 سجل الأحداث</div><div class="t-wrap"><div class="t-head"><h3>السجلات (${logs.length})</h3><button class="btn btn-ghost btn-sm" onclick="exportLogs()">⬇️ تصدير</button></div>${rows||'<div class="empty"><div class="e-icon">📋</div><p>لا توجد سجلات</p></div>'}</div>`;}
function exportLogs(){const sv=DB.servers[activeServer];if(!sv?.logs?.length){toast('لا توجد سجلات','err');return;}const text=sv.logs.map(l=>`[${l.time}] ${l.action} | ${l.by}${l.target?' > '+l.target:''}`).join('\n');const blob=new Blob([text],{type:'text/plain'});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=sv.name+'-logs.txt';a.click();URL.revokeObjectURL(url);}
function renderAdminBans(sv,el,myRole){const bans=sv.bans||[];const rows=bans.map(uname=>{const u=DB.users[uname]||{display:uname};return `<tr><td>${esc(u.display)}</td><td>${uname}</td><td>${(myRole==='owner'||myRole==='leader')?`<button class="btn btn-success btn-sm" onclick="unbanMember('${activeServer}','${uname}')">✅ رفع الحظر</button>`:'—'}</td></tr>`;}).join('');el.innerHTML=`<div class="a-title">🔨 المحظورون</div><div class="t-wrap"><table><thead><tr><th>الاسم</th><th>المستخدم</th><th>إجراءات</th></tr></thead><tbody>${rows||'<tr><td colspan="3" style="text-align:center;padding:20px;color:var(--text-4)">لا يوجد محظورون</td></tr>'}</tbody></table></div>`;}
function renderAdminInvites(sv,el,myRole){el.innerHTML=`<div class="a-title">📨 الدعوات</div><div class="invite-card"><div><h3>كود الدعوة الحالي</h3></div><div style="display:flex;align-items:center;gap:12px;flex-wrap:wrap"><div class="invite-code">${sv.inviteCode}</div><button class="btn btn-ghost btn-sm" onclick="copyText('${sv.inviteCode}')">📋 نسخ</button><button class="btn btn-ghost btn-sm" onclick="shareInviteLink('${sv.inviteCode}')">🔗 مشاركة</button>${(myRole==='owner'||myRole==='leader')?`<button class="btn btn-danger btn-sm" onclick="regenInvite('${activeServer}')">🔄 تجديد</button>`:''}</div></div>`;}
function shareInviteLink(code){const url=location.origin+location.pathname+'?invite='+code;if(navigator.share)navigator.share({title:'Tiscord',text:'انضم! الكود: '+code,url});else copyText(url);}
function regenInvite(sid){DB.servers[sid].inviteCode=Math.random().toString(36).slice(2,8).toUpperCase();saveDB();addLog(sid,'تجديد كود الدعوة',me.username);toast('✅ تم التجديد!');renderAdmin();}
function renderAdminSettings(sv,el,myRole){if(myRole!=='owner'){el.innerHTML='<div class="empty"><div class="e-icon">🔒</div><p>هذا القسم للأونر فقط</p></div>';return;}el.innerHTML=`<div class="a-title">⚙️ إعدادات السيرفر</div><div class="form-group"><label>اسم السيرفر</label><input id="edName" type="text" value="${esc(sv.name)}"></div><div class="form-group"><label>إيموجي</label><input id="edEmoji" type="text" value="${esc(sv.emoji||'🎮')}" maxlength="2"></div><div class="form-group"><label>الوصف</label><input id="edDesc" type="text" value="${esc(sv.desc||'')}"></div><div class="form-group"><label><input type="checkbox" id="edPublic" ${sv.isPublic?'checked':''}> السيرفر عام</label></div><div style="display:flex;gap:8px;margin-top:16px;flex-wrap:wrap"><button class="btn btn-accent" onclick="saveServerSettings('${activeServer}')">💾 حفظ</button><button class="btn btn-danger" onclick="confirmDelete('${activeServer}')">🗑️ حذف السيرفر</button><button class="btn btn-ghost" onclick="leaveServer('${activeServer}')">🚪 مغادرة</button></div>`;}
function saveServerSettings(sid){const sv=DB.servers[sid];sv.name=document.getElementById('edName')?.value.trim()||sv.name;sv.emoji=document.getElementById('edEmoji')?.value.trim()||sv.emoji;sv.desc=document.getElementById('edDesc')?.value.trim();sv.isPublic=document.getElementById('edPublic')?.checked;saveDB();addLog(sid,'تعديل إعدادات السيرفر',me.username);renderRail();document.getElementById('srvHeader').innerHTML=`<span>${esc(sv.emoji)} ${esc(sv.name)}</span><span class="chevron">▾</span>`;toast('✅ تم الحفظ!');}
function confirmDelete(sid){if(!confirm('هل أنت متأكد من حذف السيرفر؟ لا يمكن التراجع!'))return;delete DB.servers[sid];saveDB();toast('🗑️ تم حذف السيرفر');activeServer=null;activeChannel=null;renderRail();openHome();}
function leaveServer(sid){const sv=DB.servers[sid];if(sv?.owner===me.username){toast('❌ الأونر لا يمكنه المغادرة','err');return;}if(!confirm('هل تريد مغادرة السيرفر؟'))return;delete sv.members[me.username];saveDB();toast('🚪 تم مغادرة السيرفر');activeServer=null;activeChannel=null;renderRail();openHome();}
/* ═══════════════════════════════════════════════
   PROFILE
═══════════════════════════════════════════════ */
function showProfile(uname){
  const u=DB.users[uname];if(!u)return;
  const isSelf=uname===me.username;
  const myRole=DB.users[me.username]?.role;
  const targetRole=u.role||'user';
  const isNitroU=hasNitro(uname);
  const bannerStyle=u.banner?'background-image:url('+u.banner+');background-size:cover;background-position:center':'background:'+(u.bannerColor||'#5865f2');
  const myUser=DB.users[me.username];
  const isFriend=(myUser.friends||[]).includes(uname);
  const pendingSent=(DB.friendRequests||[]).find(r=>r.from===me.username&&r.to===uname&&r.status==='pending');
  let srvRoleHtml='';
  if(activeServer&&DB.servers[activeServer]?.members?.[uname]){
    const srole=DB.servers[activeServer].members[uname].role||'user';
    if(srole!=='user')srvRoleHtml=badge(srole);
  }
  const content=document.getElementById('profileModalContent');
  content.innerHTML=`<div class="profile-popup" style="padding:0;overflow:hidden">
    <div style="${bannerStyle};height:80px;width:100%;border-radius:12px 12px 0 0;position:relative">
      ${isSelf?`<button onclick="changeBanner()" style="position:absolute;bottom:4px;left:4px;background:rgba(0,0,0,.6);border:none;color:#fff;border-radius:6px;padding:3px 8px;font-size:11px;cursor:pointer">✏️ تغيير البنر</button>`:''}
    </div>
    <div style="padding:0 16px;position:relative;margin-top:-28px;margin-bottom:8px">
      <div style="width:56px;height:56px;border-radius:50%;background:${avatarColor(uname)};display:inline-flex;align-items:center;justify-content:center;font-size:22px;font-weight:700;color:#fff;border:3px solid var(--bg-card)">
        ${u.photoURL?`<img src="${u.photoURL}" style="width:100%;height:100%;border-radius:50%;object-fit:cover">`:esc((u.avatar||u.display[0]).slice(0,2))}
      </div>
      ${isSelf?`<button onclick="changeAvatar()" style="position:absolute;bottom:0;left:44px;background:var(--accent);border:none;color:#fff;border-radius:99px;width:20px;height:20px;font-size:10px;cursor:pointer;display:flex;align-items:center;justify-content:center">✏️</button>`:''}
    </div>
    <div style="padding:0 16px 16px">
      <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:4px">
        <span class="profile-name ${isNitroU?'nitro-name':''}">${esc(u.display)}</span>
        ${badge(targetRole)}${srvRoleHtml}
        ${isNitroU?'<span style="color:#9b59b6;font-size:14px" title="نيترو">💎</span>':''}
      </div>
      <div class="badges-row" style="margin-bottom:8px;font-size:18px">${renderBadges(u)}</div>
      <div class="profile-tag">${u.tag}${roleLabel(u.role)?' · '+roleLabel(u.role):''}</div>
      ${u.customStatus?`<div style="font-size:13px;color:var(--accent);margin-top:4px">💬 ${esc(u.customStatus)}</div>`:''}
      ${u.bio?`<p style="font-size:13px;color:var(--text-3);margin-top:8px;max-width:260px">${esc(u.bio)}</p>`:''}
      <div style="font-size:12px;color:var(--text-4);margin-top:6px">انضم: ${fmtDate(u.joinDate)}</div>
      <div class="profile-actions" style="margin-top:12px">
        ${!isSelf?`
          ${isFriend?`
            <button class="btn btn-accent btn-sm" onclick="closeModal('profileModal');openDM('${uname}')">💬 رسالة</button>
            <button class="btn btn-ghost btn-sm" onclick="removeFriend('${uname}');closeModal('profileModal')">👋 إزالة صديق</button>`:
          pendingSent?`<button class="btn btn-ghost btn-sm" onclick="cancelFriendReq('${pendingSent.id}');closeModal('profileModal')">⏳ إلغاء الطلب</button>`:
          `<button class="btn btn-accent btn-sm" onclick="sendFriendReq('${uname}');closeModal('profileModal')">➕ إضافة صديق</button>`}
        `:''}
        ${isSelf?`<button class="btn btn-ghost btn-sm" onclick="closeModal('profileModal');openSettings()">✏️ تعديل الملف</button>
          <button class="btn btn-ghost btn-sm" onclick="closeModal('profileModal');openNitroModal()">💎 نيترو</button>`:''}
        ${!isSelf&&activeServer&&(myRole==='owner'||isStaff(myRole)&&canManage(myRole,targetRole))?`
          <div style="margin-top:8px;width:100%">
            <label style="font-size:12px;color:var(--text-4);margin-bottom:4px;display:block">تغيير الرتبة في السيرفر</label>
            <select class="role-sel" style="width:100%" onchange="setMemberRole('${activeServer}','${uname}',this.value)">
              ${ROLE_ORDER.filter(r=>r!=='owner').map(r=>`<option value="${r}" ${(DB.servers[activeServer]?.members?.[uname]?.role||'user')===r?'selected':''}>${roleLabel(r)||'عضو عادي'}</option>`).join('')}
            </select>
          </div>`:''}
        ${myRole==='owner'&&!isSelf?`<button class="btn btn-ghost btn-sm" style="margin-top:8px;width:100%" onclick="manageBadges('${uname}')">🏅 إدارة الشارات</button>`:''}
      </div>
    </div>
  </div>`;
  openModal('profileModal');
}

/* ═══════════════════════════════════════════════
   BADGES MANAGEMENT
═══════════════════════════════════════════════ */
function manageBadges(uname){
  closeModal('profileModal');const u=DB.users[uname];
  const ov=document.createElement('div');ov.className='modal-overlay';ov.id='badgesOv';
  ov.innerHTML=`<div class="modal"><h2>🏅 شارات ${esc(u.display)}</h2>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin:16px 0">
      ${Object.entries(BADGES_DEF).map(([key,def])=>`<label style="display:flex;align-items:center;gap:8px;padding:10px;background:var(--bg-input);border-radius:8px;cursor:pointer"><input type="checkbox" ${(u.badges||[]).includes(key)?'checked':''} onchange="toggleBadge('${uname}','${key}',this.checked)"><span style="font-size:18px">${def.icon}</span><span style="font-size:13px;color:var(--text-2)">${def.label}</span></label>`).join('')}
    </div>
    <div class="modal-footer"><button class="btn btn-accent" onclick="document.getElementById('badgesOv').remove();toast('✅ تم حفظ الشارات')">حفظ</button><button class="btn btn-ghost" onclick="document.getElementById('badgesOv').remove()">إغلاق</button></div>
  </div>`;
  ov.addEventListener('click',e=>{if(e.target===ov)ov.remove();});document.body.appendChild(ov);
}
function toggleBadge(uname,b,add){const u=DB.users[uname];if(!u.badges)u.badges=[];if(add&&!u.badges.includes(b))u.badges.push(b);else if(!add)u.badges=u.badges.filter(x=>x!==b);saveDB();}

/* ═══════════════════════════════════════════════
   AVATAR / BANNER
═══════════════════════════════════════════════ */
function changeAvatar(){const input=document.createElement('input');input.type='file';input.accept='image/*';input.onchange=e=>{const file=e.target.files[0];if(!file)return;if(file.size>2*1024*1024){toast('❌ الصورة أكبر من 2MB','err');return;}const reader=new FileReader();reader.onload=ev=>{DB.users[me.username].photoURL=ev.target.result;saveDB();refreshUserBar();closeModal('profileModal');toast('✅ تم تحديث الأفاتار!');};reader.readAsDataURL(file);};input.click();}
function changeBanner(){
  const u=DB.users[me.username];
  const ov=document.createElement('div');ov.className='modal-overlay';ov.id='bannerOv';
  ov.innerHTML=`<div class="modal"><h2>🎨 تغيير البنر</h2>
    <div class="form-group"><label>لون البنر</label><input type="color" id="bannerColorPick" value="${u.bannerColor||'#5865f2'}" style="width:100%;height:48px;border:none;border-radius:8px;cursor:pointer"></div>
    <div class="form-group"><label>أو رفع صورة</label><button class="btn btn-ghost" style="width:100%" onclick="uploadBannerImg()">📁 اختر صورة</button></div>
    ${u.banner?`<button class="btn btn-danger btn-sm" onclick="removeBanner()">🗑️ إزالة البنر</button>`:''}
    <div class="modal-footer"><button class="btn btn-ghost" onclick="document.getElementById('bannerOv').remove()">إلغاء</button><button class="btn btn-accent" onclick="saveBannerColor()">💾 حفظ</button></div>
  </div>`;
  ov.addEventListener('click',e=>{if(e.target===ov)ov.remove();});document.body.appendChild(ov);
}
function uploadBannerImg(){const input=document.createElement('input');input.type='file';input.accept='image/*';input.onchange=e=>{const file=e.target.files[0];if(!file)return;if(file.size>5*1024*1024){toast('❌ أكبر من 5MB','err');return;}const reader=new FileReader();reader.onload=ev=>{DB.users[me.username].banner=ev.target.result;saveDB();document.getElementById('bannerOv')?.remove();toast('✅ تم تحديث البنر!');};reader.readAsDataURL(file);};input.click();}
function saveBannerColor(){const u=DB.users[me.username];u.bannerColor=document.getElementById('bannerColorPick')?.value||'#5865f2';u.banner='';saveDB();document.getElementById('bannerOv')?.remove();toast('✅ تم التحديث!');}
function removeBanner(){DB.users[me.username].banner='';saveDB();document.getElementById('bannerOv')?.remove();toast('🗑️ تم إزالة البنر');}

/* ═══════════════════════════════════════════════
   NITRO + PAYPAL
═══════════════════════════════════════════════ */
const PAYPAL_EMAIL='nujhosen@gmail.com';
function openNitroModal(){
  const u=DB.users[me.username];const isN=hasNitro(me.username);
  const ov=document.createElement('div');ov.className='modal-overlay';ov.id='nitroOv';
  ov.innerHTML=`<div class="modal" style="width:460px;max-width:100%">
    <div style="text-align:center;margin-bottom:20px">
      <div style="font-size:48px">💎</div>
      <h2 style="font-size:22px;background:linear-gradient(135deg,#9b59b6,#8e44ad);-webkit-background-clip:text;-webkit-text-fill-color:transparent">نيترو Tiscord</h2>
      <p style="color:var(--text-3)">حسّن تجربتك!</p>
    </div>
    ${isN?`<div style="background:rgba(155,89,182,.15);border:1px solid rgba(155,89,182,.4);border-radius:12px;padding:16px;text-align:center;margin-bottom:16px"><div style="color:#9b59b6;font-weight:700">✅ لديك نيترو نشط!</div><div style="color:var(--text-3);font-size:13px;margin-top:4px">${u.nitroExpiry?'ينتهي: '+fmtDate(u.nitroExpiry):'نيترو دائم'}</div></div>`:''}
    <div style="background:var(--bg-input);border-radius:12px;padding:16px;margin-bottom:16px">
      <h3 style="margin-bottom:10px">💎 مميزات النيترو</h3>
      <ul style="list-style:none;display:grid;gap:6px">
        ${['اسم ملون متدرج ✨','أفاتار متحرك GIF 🎞️','بنر مخصص 🎨','رفع ملفات حتى 100MB 📁','بوست سيرفرات (2) 🚀','إيموجي مخصص 😎'].map(f=>`<li style="color:var(--text-2);font-size:13px">✅ ${f}</li>`).join('')}
      </ul>
    </div>
    ${!isN?`
    <div style="background:rgba(0,180,0,.08);border:1px solid rgba(0,180,0,.3);border-radius:12px;padding:14px;margin-bottom:16px">
      <div style="font-weight:700;margin-bottom:6px;color:var(--green)">💳 الدفع عبر PayPal</div>
      <p style="font-size:13px;color:var(--text-2);margin-bottom:10px">أرسل المبلغ على PayPal ثم أرسل لقطة الشاشة للأدمن لتفعيل النيترو</p>
      <div style="display:flex;align-items:center;gap:8px;background:var(--bg-input);padding:8px 12px;border-radius:8px;flex-wrap:wrap">
        <span style="font-size:13px;color:var(--text-3)">حساب PayPal:</span>
        <span style="font-weight:700;color:var(--accent);direction:ltr">${PAYPAL_EMAIL}</span>
        <button class="btn btn-ghost btn-sm" onclick="copyText('${PAYPAL_EMAIL}')">📋 نسخ</button>
      </div>
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:16px">
      <div style="background:var(--bg-card);border:2px solid var(--border);border-radius:12px;padding:16px;text-align:center">
        <div style="font-size:20px;font-weight:900;color:#9b59b6">$9.99</div>
        <div style="color:var(--text-3);font-size:12px">/ شهرياً</div>
        <button class="btn btn-sm" style="background:linear-gradient(135deg,#9b59b6,#8e44ad);color:#fff;border:none;margin-top:8px;width:100%;border-radius:8px;padding:8px;cursor:pointer" onclick="paypalNitro('monthly')">💳 ادفع الآن</button>
      </div>
      <div style="background:linear-gradient(135deg,rgba(155,89,182,.2),rgba(142,68,173,.2));border:2px solid #9b59b6;border-radius:12px;padding:16px;text-align:center">
        <div style="font-size:20px;font-weight:900;color:#9b59b6">$99.99</div>
        <div style="color:var(--text-3);font-size:12px">/ سنوياً</div>
        <button class="btn btn-sm" style="background:linear-gradient(135deg,#9b59b6,#8e44ad);color:#fff;border:none;margin-top:8px;width:100%;border-radius:8px;padding:8px;cursor:pointer" onclick="paypalNitro('yearly')">💳 ادفع الآن</button>
      </div>
    </div>`:''}
    ${DB.users[me.username]?.role==='owner'?`<div style="border-top:1px solid var(--border);padding-top:12px">
      <div style="font-size:12px;color:var(--text-4);margin-bottom:8px">🔧 منح نيترو (أونر فقط)</div>
      <div style="display:flex;gap:8px"><input id="nitroGrantUser" type="text" placeholder="اسم المستخدم" style="flex:1;padding:8px 12px;background:var(--bg-input);border:none;border-radius:8px;color:var(--text-1);font-family:var(--font-main)"><button class="btn btn-accent btn-sm" onclick="grantNitro()">منح</button></div>
    </div>`:''}
    <div class="modal-footer"><button class="btn btn-ghost" onclick="document.getElementById('nitroOv').remove()">إغلاق</button></div>
  </div>`;
  ov.addEventListener('click',e=>{if(e.target===ov)ov.remove();});document.body.appendChild(ov);
}
function paypalNitro(plan){
  const price=plan==='monthly'?'9.99':'99.99';
  const paypalUrl='https://www.paypal.com/paypalme/'+PAYPAL_EMAIL.split('@')[0]+'/'+price;
  window.open(paypalUrl,'_blank');
  document.getElementById('nitroOv')?.remove();
  setTimeout(()=>{
    const ov=document.createElement('div');ov.className='modal-overlay';ov.id='payInstrOv';
    ov.innerHTML=`<div class="modal" style="text-align:center">
      <div style="font-size:40px;margin-bottom:12px">💳</div>
      <h2>تعليمات الدفع</h2>
      <div style="background:var(--bg-input);border-radius:10px;padding:16px;text-align:right;margin:16px 0">
        <p style="margin-bottom:8px;color:var(--text-2)">1. أرسل <strong>$${price}</strong> على PayPal</p>
        <p style="margin-bottom:8px;color:var(--text-2)">2. الحساب: <strong style="color:var(--accent);direction:ltr">${PAYPAL_EMAIL}</strong></p>
        <p style="margin-bottom:8px;color:var(--text-2)">3. في ملاحظة الدفع اكتب: <strong>${me.username}</strong></p>
        <p style="color:var(--text-2)">4. أرسل لقطة الشاشة للأدمن لتفعيل النيترو</p>
      </div>
      <button class="btn btn-accent" onclick="copyText('${PAYPAL_EMAIL}');toast('تم نسخ الإيميل!')">📋 نسخ إيميل PayPal</button>
      <div class="modal-footer" style="justify-content:center"><button class="btn btn-ghost" onclick="document.getElementById('payInstrOv').remove()">فهمت ✅</button></div>
    </div>`;
    ov.addEventListener('click',e=>{if(e.target===ov)ov.remove();});document.body.appendChild(ov);
  },300);
}
function grantNitro(){const uname=document.getElementById('nitroGrantUser')?.value.trim().toLowerCase();if(!uname||!DB.users[uname]){toast('❌ مستخدم غير موجود','err');return;}const u=DB.users[uname];u.nitro=true;const exp=new Date();exp.setMonth(exp.getMonth()+1);u.nitroExpiry=exp.toISOString();if(!u.badges)u.badges=[];if(!u.badges.includes('nitro'))u.badges.push('nitro');saveDB();toast('✅ تم منح نيترو لـ '+u.display);document.getElementById('nitroGrantUser').value='';}

/* ═══════════════════════════════════════════════
   SETTINGS
═══════════════════════════════════════════════ */
function openSettings(){openModal('settingsModal');renderSettings('profile');}
function renderSettings(tab){
  settingsTab=tab;
  document.querySelectorAll('#settingsModal .tab-btn').forEach(el=>el.classList.toggle('active',el.dataset.tab===tab));
  const u=DB.users[me.username];const con=document.getElementById('settingsBody');
  if(tab==='profile'){
    con.innerHTML=`
      <div style="border-radius:12px;overflow:hidden;margin-bottom:20px">
        <div style="${u.banner?'background-image:url('+u.banner+');background-size:cover;background-position:center':'background:'+(u.bannerColor||'#5865f2')};height:80px;position:relative">
          <button onclick="changeBanner()" style="position:absolute;bottom:6px;left:6px;background:rgba(0,0,0,.6);border:none;color:#fff;border-radius:6px;padding:4px 10px;font-size:12px;cursor:pointer">✏️ تغيير البنر</button>
        </div>
        <div style="background:var(--bg-input);padding:12px 16px;display:flex;align-items:center;gap:12px">
          <div style="width:64px;height:64px;border-radius:50%;background:${avatarColor(me.username)};display:flex;align-items:center;justify-content:center;font-size:26px;font-weight:700;color:#fff;margin-top:-32px;border:4px solid var(--bg-input);cursor:pointer;flex-shrink:0" onclick="changeAvatar()">
            ${u.photoURL?`<img src="${u.photoURL}" style="width:100%;height:100%;border-radius:50%;object-fit:cover">`:esc((u.avatar||u.display[0]).slice(0,2))}
          </div>
          <div>
            <div class="${hasNitro(me.username)?'nitro-name':''}" style="font-size:18px;font-weight:700">${esc(u.display)}</div>
            <div style="font-size:13px;color:var(--text-3)">${u.tag}</div>
            <div style="font-size:18px;margin-top:4px">${renderBadges(u)}</div>
          </div>
        </div>
      </div>
      <div class="form-group"><label>الاسم المعروض</label><input id="setDisplay" type="text" value="${esc(u.display)}"></div>
      <div class="form-group"><label>الأفاتار / إيموجي</label><input id="setAvatar" type="text" value="${esc(u.avatar||u.display[0])}" maxlength="2"></div>
      <div class="form-group"><label>السيرة الذاتية</label><input id="setBio" type="text" value="${esc(u.bio||'')}" placeholder="عرّف عن نفسك..."></div>
      <div class="form-group"><label>الحالة المخصصة 💬</label><input id="setCustomStatus" type="text" value="${esc(u.customStatus||'')}" placeholder="مثال: جالس أذاكر 📚" maxlength="60"></div>
      <div class="form-group"><label>الحالة</label>
        <select id="setStatus">
          <option value="online" ${u.status==='online'?'selected':''}>🟢 متاح</option>
          <option value="idle" ${u.status==='idle'?'selected':''}>🟡 بعيد</option>
          <option value="dnd" ${u.status==='dnd'?'selected':''}>🔴 لا تزعج</option>
          <option value="offline" ${u.status==='offline'?'selected':''}>⚫ غير مرئي</option>
        </select>
      </div>`;
  }else if(tab==='security'){
    con.innerHTML=`
      <div class="form-group"><label>كلمة المرور الحالية</label><input id="setOldPass" type="password"></div>
      <div class="form-group"><label>كلمة المرور الجديدة</label><input id="setNewPass" type="password"></div>
      <div class="form-group"><label>تأكيد كلمة المرور</label><input id="setConfirmPass" type="password"></div>`;
  }else if(tab==='appearance'){
    const theme=u.theme||'dark';
    con.innerHTML=`
      <div class="form-group"><label>المظهر</label></div>
      <div class="theme-grid">
        <div class="theme-opt${theme==='dark'?' active':''}" onclick="previewTheme('dark',this)"><div class="t-icon">🌙</div>داكن</div>
        <div class="theme-opt${theme==='light'?' active':''}" onclick="previewTheme('light',this)"><div class="t-icon">☀️</div>فاتح</div>
      </div>
      <div class="form-group" style="margin-top:16px"><label>حجم الخط</label>
        <input type="range" id="fontSizeRange" min="13" max="18" value="${u.fontSize||15}" oninput="document.getElementById('fontPreview').style.fontSize=this.value+'px'">
        <div style="font-size:13px;color:var(--text-3);margin-top:4px">معاينة: <span id="fontPreview" style="font-size:${u.fontSize||15}px">هذا حجم الخط</span></div>
      </div>`;
  }else if(tab==='notifications'){
    const n=u.notifications||{};
    con.innerHTML=`
      <div class="form-group"><label><input type="checkbox" id="notifSound" ${n.sound!==false?'checked':''}> صوت الإشعارات</label></div>
      <div class="form-group"><label><input type="checkbox" id="notifDesktop" ${n.desktop?'checked':''}> إشعارات سطح المكتب</label></div>
      <div class="form-group"><label><input type="checkbox" id="notifMentions" ${n.mentions!==false?'checked':''}> تنبيه عند الإشارة إليّ</label></div>`;
  }
}
function previewTheme(t,el){document.querySelectorAll('.theme-opt').forEach(x=>x.classList.remove('active'));el.classList.add('active');applyTheme(t);}
function saveSettings(){
  const u=DB.users[me.username];
  if(settingsTab==='profile'){
    const d=document.getElementById('setDisplay')?.value.trim();const av=document.getElementById('setAvatar')?.value.trim();const bio=document.getElementById('setBio')?.value.trim();const status=document.getElementById('setStatus')?.value;const customStatus=document.getElementById('setCustomStatus')?.value.trim();
    if(d){u.display=d;me.display=d;}if(av)u.avatar=av;if(bio!==undefined)u.bio=bio;if(status)u.status=status;if(customStatus!==undefined)u.customStatus=customStatus;
    saveDB();refreshUserBar();toast('✅ تم حفظ الملف الشخصي!');
  }else if(settingsTab==='security'){
    const op=document.getElementById('setOldPass')?.value;const np=document.getElementById('setNewPass')?.value;const cp=document.getElementById('setConfirmPass')?.value;
    if(!op||!np){toast('❌ أدخل كلمتي المرور','err');return;}if(u.password!==op){toast('❌ كلمة المرور الحالية خاطئة','err');return;}if(np!==cp){toast('❌ كلمتا المرور غير متطابقتين','err');return;}if(np.length<6){toast('❌ كلمة المرور قصيرة','err');return;}
    u.password=np;saveDB();toast('✅ تم تغيير كلمة المرور!');
  }else if(settingsTab==='appearance'){
    const themeActive=document.querySelector('.theme-opt.active');const themeVal=themeActive?(themeActive.textContent.includes('داكن')?'dark':'light'):'dark';const fs=document.getElementById('fontSizeRange')?.value||15;
    u.theme=themeVal;u.fontSize=parseInt(fs);applyTheme(themeVal);document.body.style.fontSize=fs+'px';saveDB();toast('✅ تم حفظ المظهر!');
  }else if(settingsTab==='notifications'){
    u.notifications={sound:document.getElementById('notifSound')?.checked,desktop:document.getElementById('notifDesktop')?.checked,mentions:document.getElementById('notifMentions')?.checked};
    if(u.notifications.desktop)Notification.requestPermission();saveDB();toast('✅ تم حفظ الإشعارات!');
  }
}

/* ═══════════════════════════════════════════════
   CREATE ACCOUNT (Owner)
═══════════════════════════════════════════════ */
function createAccount(){
  const u=document.getElementById('accUser').value.trim().toLowerCase();const disp=document.getElementById('accDisplay').value.trim();const p=document.getElementById('accPass').value;const role=document.getElementById('accRole').value;const errEl=document.getElementById('accError');
  if(!u||!disp||!p){showErr(errEl,'❌ يرجى ملء جميع الحقول');return;}if(DB.users[u]){showErr(errEl,'❌ اسم المستخدم مستخدم');return;}
  DB.users[u]={password:p,display:disp,tag:'#'+String(Object.keys(DB.users).length+1).padStart(4,'0'),role,avatar:'😀',status:'offline',joinDate:new Date().toISOString(),banner:'',bannerColor:'#5865f2',badges:role==='owner'?['owner','developer']:isStaff(role)?['moderator']:['early'],nitro:false,boosts:0,friends:[],customStatus:''};
  saveDB();addLog(activeServer,'إنشاء حساب',me.username,u+' ('+disp+')');closeModal('createAccountModal');['accUser','accDisplay','accPass'].forEach(id=>{const el=document.getElementById(id);if(el)el.value='';});errEl.style.display='none';toast('✅ تم إنشاء حساب '+disp+'!');
}

/* ═══════════════════════════════════════════════
   SEARCH
═══════════════════════════════════════════════ */
function openSearchModal(){openModal('searchModal');document.getElementById('searchInput').value='';document.getElementById('searchResults').innerHTML='';document.getElementById('searchInput').focus();}
function doSearch(query){
  const container=document.getElementById('searchResults');if(!query.trim()||!activeServer){container.innerHTML='';return;}
  const sv=DB.servers[activeServer];const results=[];
  sv.channels.forEach(ch=>(ch.messages||[]).forEach(msg=>{if(msg.text?.toLowerCase().includes(query.toLowerCase()))results.push({ch,msg});}));
  if(!results.length){container.innerHTML='<div class="empty"><p>لا توجد نتائج</p></div>';return;}
  container.innerHTML=results.slice(0,20).map(({ch,msg})=>{const u=DB.users[msg.user]||{display:msg.user};return `<div class="search-hit" onclick="gotoSearchResult('${ch.id}','${msg.id}')"><div class="search-hit-user">#${esc(ch.name)} · ${esc(u.display)}</div><div class="search-hit-text">${esc(msg.text.slice(0,120))}</div></div>`;}).join('');
}
function gotoSearchResult(cid,msgId){closeModal('searchModal');openChannel(activeServer,cid);setTimeout(()=>scrollToMsg(msgId),300);}

/* ═══════════════════════════════════════════════
   MISC UTILS
═══════════════════════════════════════════════ */
function checkInviteUrl(){const params=new URLSearchParams(location.search);const code=params.get('invite');if(code&&me){const el=document.getElementById('joinCode');if(el)el.value=code.toUpperCase();openModal('joinServerModal');}}

/* ═══════════════════════════════════════════════
   INIT
═══════════════════════════════════════════════ */
document.addEventListener('DOMContentLoaded',()=>{
  loadDB();
  setTimeout(()=>{const sp=document.getElementById('splashScreen');if(sp){sp.style.opacity='0';sp.style.transition='.5s';setTimeout(()=>{sp.style.display='none';document.getElementById('authPage').classList.remove('hidden');},500);}},1600);
  document.querySelectorAll('.modal-overlay').forEach(ov=>ov.addEventListener('click',e=>{if(e.target===ov)ov.classList.add('hidden');}));
  ['loginUser','loginPass'].forEach(id=>{const el=document.getElementById(id);if(el)el.addEventListener('keydown',e=>{if(e.key==='Enter')doLogin();});});
  ['regUser','regDisplay','regEmail','regPass'].forEach(id=>{const el=document.getElementById(id);if(el){el.addEventListener('keydown',e=>{if(e.key==='Enter')doRegister();});if(id==='regPass')el.addEventListener('input',()=>checkPassStrength(el.value));}});
  const joinEl=document.getElementById('joinCode');
  if(joinEl)joinEl.addEventListener('input',e=>{
    const code=e.target.value.trim().toUpperCase();
    const sv=Object.values(DB.servers).find(s=>s.inviteCode&&s.inviteCode.trim().toUpperCase()===code);
    const preview=document.getElementById('serverPreview');const errEl=document.getElementById('joinError');
    if(sv){
      preview?.classList.remove('hidden');
      if(preview)preview.innerHTML=`<div class="sp-icon">${sv.emoji||'🎮'}</div><div><div class="sp-name">${esc(sv.name)}</div><div class="sp-members">👥 ${Object.keys(sv.members).length} عضو</div></div>`;
      if(errEl)errEl.style.display='none';
    }else{preview?.classList.add('hidden');}
  });
  document.addEventListener('keydown',e=>{if(e.key==='Escape'){document.querySelectorAll('.modal-overlay:not(.hidden)').forEach(m=>m.classList.add('hidden'));document.getElementById('emojiPicker')?.classList.add('hidden');}});
});
/* ═══════════════════════════════════════════════
   OWNER CONTROL PANEL
═══════════════════════════════════════════════ */
function renderOwnerPanel(){
  const ex = document.getElementById('ownerPanelBtn');
  if(ex) ex.remove();
  if(!isOwnerUser()) return;
  const btn = document.createElement('button');
  btn.id = 'ownerPanelBtn';
  btn.className = 'owner-panel-fab';
  btn.innerHTML = '👑 تحكم';
  btn.onclick = openOwnerPanel;
  document.getElementById('app').appendChild(btn);
}

function openOwnerPanel(){
  const ex = document.getElementById('ownerPanelOverlay');
  if(ex) ex.remove();

  const allUsers = Object.entries(DB.users);
  const allServers = Object.entries(DB.servers);
  const totalMsgs = Object.values(DB.servers).reduce((a,sv)=>a+sv.channels.reduce((b,ch)=>b+(ch.messages?.length||0),0),0);

  const ov = document.createElement('div');
  ov.id = 'ownerPanelOverlay';
  ov.className = 'owner-panel-overlay';
  ov.innerHTML = `
  <div class="owner-panel">
    <div class="op-header">
      <div class="op-title">👑 لوحة تحكم الأونر</div>
      <div class="op-stats">
        <span>👥 ${allUsers.length} مستخدم</span>
        <span>🌐 ${allServers.length} سيرفر</span>
        <span>💬 ${totalMsgs} رسالة</span>
      </div>
      <button class="op-close" onclick="document.getElementById('ownerPanelOverlay').remove()">✕</button>
    </div>
    <div class="op-tabs">
      <button class="op-tab active" onclick="ownerTab('ban',this)">🔨 باند</button>
      <button class="op-tab" onclick="ownerTab('badges',this)">🏅 شارات</button>
      <button class="op-tab" onclick="ownerTab('nitro',this)">💎 نيترو</button>
      <button class="op-tab" onclick="ownerTab('logs',this)">📋 لوقان</button>
      <button class="op-tab" onclick="ownerTab('servers',this)">🌐 السيرفرات</button>
      <button class="op-tab" onclick="ownerTab('voice',this)">🔊 كالم</button>
    </div>
    <div class="op-body" id="opBody"></div>
  </div>`;
  ov.addEventListener('click', e=>{ if(e.target===ov) ov.remove(); });
  document.body.appendChild(ov);
  ownerTab('ban', ov.querySelector('.op-tab'));
}

function ownerTab(tab, el){
  document.querySelectorAll('.op-tab').forEach(t=>t.classList.remove('active'));
  el.classList.add('active');
  const body = document.getElementById('opBody');
  if(tab==='ban') renderOpBan(body);
  else if(tab==='badges') renderOpBadges(body);
  else if(tab==='nitro') renderOpNitro(body);
  else if(tab==='logs') renderOpLogs(body);
  else if(tab==='servers') renderOpServers(body);
  else if(tab==='voice') renderOpVoice(body);
}

/* ─── BAN ─── */
function renderOpBan(body){
  const users = Object.entries(DB.users).filter(([u])=>u!=='hosennujq2');
  body.innerHTML = `
    <div class="op-section-title">🔨 باند / رفع الباند</div>
    <div class="op-search-bar">
      <input id="opBanSearch" type="text" placeholder="ابحث عن مستخدم..." oninput="filterOpBan(this.value)">
    </div>
    <div id="opBanList" class="op-list">
      ${users.map(([uname,u])=>`
      <div class="op-user-row" data-name="${uname} ${u.display.toLowerCase()}">
        <div class="op-av" style="background:${avatarColor(uname)}">${esc((u.avatar||u.display[0]).slice(0,2))}</div>
        <div class="op-uinfo">
          <div class="op-uname">${esc(u.display)}</div>
          <div class="op-utag">${uname} ${u.banned?'<span class="op-banned-tag">محظور عالتطبيق</span>':''}</div>
        </div>
        <div class="op-actions">
          ${u.banned
            ? `<button class="op-btn op-btn-green" onclick="ownerUnban('${uname}')">✅ رفع الباند</button>`
            : `<button class="op-btn op-btn-red" onclick="ownerBan('${uname}')">🔨 باند</button>`}
        </div>
      </div>`).join('')}
    </div>`;
}
function filterOpBan(q){
  document.querySelectorAll('#opBanList .op-user-row').forEach(row=>{
    row.style.display = row.dataset.name?.includes(q.toLowerCase()) ? '' : 'none';
  });
}
function ownerBan(uname){
  if(!confirm('حظر '+DB.users[uname]?.display+' من التطبيق كله؟')) return;
  DB.users[uname].banned = true;
  // Kick from all servers
  Object.values(DB.servers).forEach(sv=>{ delete sv.members[uname]; });
  addLog(null,'باند من التطبيق','hosennujq2',uname);
  saveDB(); toast('🔨 تم الباند'); openOwnerPanel();
}
function ownerUnban(uname){
  DB.users[uname].banned = false;
  addLog(null,'رفع الباند من التطبيق','hosennujq2',uname);
  saveDB(); toast('✅ تم رفع الباند'); openOwnerPanel();
}

/* ─── BADGES ─── */
function renderOpBadges(body){
  const users = Object.entries(DB.users).filter(([u])=>u!=='hosennujq2');
  body.innerHTML = `
    <div class="op-section-title">🏅 إدارة الشارات</div>
    <div class="op-search-bar">
      <input id="opBadgeSearch" type="text" placeholder="ابحث عن مستخدم..." oninput="filterOpBadge(this.value)">
    </div>
    <div id="opBadgeList" class="op-list">
      ${users.map(([uname,u])=>`
      <div class="op-user-row" data-name="${uname} ${u.display.toLowerCase()}">
        <div class="op-av" style="background:${avatarColor(uname)}">${esc((u.avatar||u.display[0]).slice(0,2))}</div>
        <div class="op-uinfo">
          <div class="op-uname">${esc(u.display)}</div>
          <div style="display:flex;gap:4px;flex-wrap:wrap;margin-top:2px">${renderBadges(u)||'<span style="color:var(--text-4);font-size:11px">لا توجد شارات</span>'}</div>
        </div>
        <div class="op-actions">
          <button class="op-btn op-btn-blue" onclick="ownerEditBadges('${uname}')">✏️ تعديل</button>
        </div>
      </div>`).join('')}
    </div>`;
}
function filterOpBadge(q){ document.querySelectorAll('#opBadgeList .op-user-row').forEach(row=>{ row.style.display=row.dataset.name?.includes(q.toLowerCase())?'':'none'; }); }
function ownerEditBadges(uname){
  const u = DB.users[uname];
  const ov = document.createElement('div'); ov.className='modal-overlay'; ov.id='ownerBadgeOv';
  ov.innerHTML = `<div class="modal">
    <h2>🏅 شارات ${esc(u.display)}</h2>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin:16px 0">
      ${Object.entries(BADGES_DEF).map(([key,def])=>`
      <label style="display:flex;align-items:center;gap:8px;padding:10px;background:var(--bg-input);border-radius:8px;cursor:pointer">
        <input type="checkbox" ${(u.badges||[]).includes(key)?'checked':''} onchange="toggleBadge('${uname}','${key}',this.checked)">
        <span style="font-size:20px">${def.icon}</span>
        <span style="font-size:13px;color:var(--text-2)">${def.label}</span>
      </label>`).join('')}
    </div>
    <div class="modal-footer">
      <button class="btn btn-ghost" onclick="document.getElementById('ownerBadgeOv').remove()">إغلاق</button>
      <button class="btn btn-accent" onclick="document.getElementById('ownerBadgeOv').remove();saveDB();toast('✅ تم حفظ الشارات!')">💾 حفظ</button>
    </div>
  </div>`;
  ov.addEventListener('click',e=>{if(e.target===ov)ov.remove();});
  document.body.appendChild(ov);
}

/* ─── NITRO ─── */
function renderOpNitro(body){
  const users = Object.entries(DB.users).filter(([u])=>u!=='hosennujq2');
  body.innerHTML = `
    <div class="op-section-title">💎 إدارة النيترو</div>
    <div class="op-nitro-grant" style="background:var(--bg-input);border-radius:10px;padding:14px;margin-bottom:16px;display:flex;gap:8px;flex-wrap:wrap;align-items:center">
      <select id="opNitroUser" style="flex:1;padding:8px 12px;background:var(--bg-card);border:1px solid var(--border);border-radius:8px;color:var(--text-1);font-family:var(--font-main)">
        <option value="">اختر مستخدم...</option>
        ${users.map(([u,ud])=>`<option value="${u}">${esc(ud.display)} (${u})</option>`).join('')}
      </select>
      <select id="opNitroPlan" style="padding:8px 12px;background:var(--bg-card);border:1px solid var(--border);border-radius:8px;color:var(--text-1);font-family:var(--font-main)">
        <option value="1m">شهر</option>
        <option value="3m">3 أشهر</option>
        <option value="1y">سنة</option>
        <option value="lifetime">دائم</option>
      </select>
      <button class="op-btn op-btn-purple" onclick="ownerGrantNitro()">💎 منح نيترو</button>
    </div>
    <div class="op-list">
      ${users.map(([uname,u])=>{
        const n = hasNitro(uname);
        return `<div class="op-user-row">
          <div class="op-av" style="background:${avatarColor(uname)}">${esc((u.avatar||u.display[0]).slice(0,2))}</div>
          <div class="op-uinfo">
            <div class="op-uname">${esc(u.display)} ${n?'💎':''}</div>
            <div class="op-utag">${n?`<span style="color:#9b59b6">نيترو نشط${u.nitroExpiry?' — ينتهي '+fmtDate(u.nitroExpiry):'  دائم'}</span>`:'<span style="color:var(--text-4)">لا يوجد نيترو</span>'}</div>
          </div>
          <div class="op-actions">
            ${n?`<button class="op-btn op-btn-red" onclick="ownerRevokeNitro('${uname}')">🚫 سحب</button>`:''}
          </div>
        </div>`;
      }).join('')}
    </div>`;
}
function ownerGrantNitro(){
  const uname = document.getElementById('opNitroUser')?.value;
  const plan = document.getElementById('opNitroPlan')?.value;
  if(!uname){toast('❌ اختر مستخدم','err');return;}
  const u = DB.users[uname]; if(!u) return;
  u.nitro = true;
  if(!u.badges) u.badges=[];
  if(!u.badges.includes('nitro')) u.badges.push('nitro');
  if(plan==='lifetime'){ delete u.nitroExpiry; }
  else{ const exp=new Date(); if(plan==='1m')exp.setMonth(exp.getMonth()+1); else if(plan==='3m')exp.setMonth(exp.getMonth()+3); else exp.setFullYear(exp.getFullYear()+1); u.nitroExpiry=exp.toISOString(); }
  addLog(null,'منح نيترو','hosennujq2',uname+' ('+plan+')');
  saveDB(); toast('💎 تم منح النيترو لـ '+u.display); ownerTab('nitro',document.querySelector('.op-tab.active'));
}
function ownerRevokeNitro(uname){
  const u = DB.users[uname]; if(!u) return;
  u.nitro=false; delete u.nitroExpiry; u.badges=(u.badges||[]).filter(b=>b!=='nitro');
  addLog(null,'سحب نيترو','hosennujq2',uname);
  saveDB(); toast('🚫 تم سحب النيترو'); ownerTab('nitro',document.querySelector('.op-tab.active'));
}

/* ─── LOGS ─── */
function renderOpLogs(body){
  const logs = [...DB.logs].slice(0,200);
  body.innerHTML = `
    <div class="op-section-title">📋 سجلات التطبيق (${logs.length})</div>
    <div style="margin-bottom:10px;display:flex;gap:8px">
      <button class="op-btn op-btn-blue" onclick="exportAllLogs()">⬇️ تصدير</button>
      <button class="op-btn op-btn-red" onclick="if(confirm('مسح كل السجلات؟')){DB.logs=[];saveDB();ownerTab('logs',document.querySelector('.op-tab.active'));}">🗑️ مسح</button>
    </div>
    <div class="op-logs-list">
      ${logs.length?logs.map(l=>`
      <div class="op-log-row">
        <span class="op-log-time">${fmtDate(l.time)} ${fmtTime(l.time)}</span>
        <span class="op-log-badge">${esc(l.action)}</span>
        <span class="op-log-by">بواسطة <strong>${esc(DB.users[l.by]?.display||l.by)}</strong>${l.target?' ← '+esc(l.target):''}</span>
      </div>`).join(''):'<div class="empty"><p>لا توجد سجلات</p></div>'}
    </div>`;
}
function exportAllLogs(){
  const text=DB.logs.map(l=>`[${l.time}] ${l.action} | ${l.by}${l.target?' > '+l.target:''}`).join('\n');
  const blob=new Blob([text],{type:'text/plain'}); const url=URL.createObjectURL(blob);
  const a=document.createElement('a'); a.href=url; a.download='tiscord-all-logs.txt'; a.click(); URL.revokeObjectURL(url);
}

/* ─── SERVERS ─── */
function renderOpServers(body){
  const servers = Object.entries(DB.servers);
  body.innerHTML = `
    <div class="op-section-title">🌐 إدارة السيرفرات (${servers.length})</div>
    <div class="op-list">
      ${servers.length ? servers.map(([sid,sv])=>`
      <div class="op-server-row">
        <div class="op-srv-icon">${sv.emoji||'🎮'}</div>
        <div class="op-uinfo">
          <div class="op-uname">${esc(sv.name)}</div>
          <div class="op-utag">👥 ${Object.keys(sv.members).length} عضو · كود: <code style="color:var(--accent)">${sv.inviteCode}</code></div>
          <div class="op-utag">الأونر: ${esc(DB.users[sv.owner]?.display||sv.owner)}</div>
        </div>
        <div class="op-actions" style="flex-direction:column;gap:4px">
          <button class="op-btn op-btn-blue" onclick="copyText('${sv.inviteCode}')">📋 نسخ الكود</button>
          <button class="op-btn op-btn-red" onclick="ownerDeleteServer('${sid}')">🗑️ حذف</button>
        </div>
      </div>`).join('') : '<div class="empty"><p>لا توجد سيرفرات</p></div>'}
    </div>`;
}
function ownerDeleteServer(sid){
  if(!confirm('حذف سيرفر '+DB.servers[sid]?.name+'؟ لا يمكن التراجع!')) return;
  addLog(null,'حذف سيرفر بواسطة الأونر','hosennujq2',sid);
  delete DB.servers[sid]; saveDB();
  if(activeServer===sid){activeServer=null;activeChannel=null;renderRail();openHome();}
  toast('🗑️ تم حذف السيرفر'); ownerTab('servers',document.querySelector('.op-tab.active'));
}

/* ─── VOICE (CALM) ─── */
function renderOpVoice(body){
  const voiceChannels=[];
  Object.entries(DB.servers).forEach(([sid,sv])=>{
    sv.channels.forEach(ch=>{
      if(ch.type==='voice'){
        const users=Object.keys(sv.voiceRooms?.[ch.id]||{});
        voiceChannels.push({sid,sv,ch,users});
      }
    });
  });
  const active=voiceChannels.filter(v=>v.users.length>0);
  body.innerHTML = `
    <div class="op-section-title">🔊 القنوات الصوتية النشطة (${active.length})</div>
    ${active.length===0?'<div class="empty"><p style="margin-top:20px">لا يوجد أحد في الكالم الآن</p></div>':
    active.map(({sid,sv,ch,users})=>`
    <div class="op-voice-room">
      <div class="op-voice-header">
        <span style="font-size:20px">🔊</span>
        <div>
          <div style="font-weight:700;color:var(--text-1)">${esc(ch.name)}</div>
          <div style="font-size:12px;color:var(--text-3)">${esc(sv.name)} · ${users.length} شخص</div>
        </div>
        <button class="op-btn op-btn-red" style="margin-right:auto" onclick="ownerClearVoice('${sid}','${ch.id}')">🔇 طرد الكل</button>
      </div>
      <div class="op-voice-users">
        ${users.map(uname=>{const u=DB.users[uname]||{display:uname};return `
        <div class="op-voice-user">
          <div class="op-av" style="background:${avatarColor(uname)};width:32px;height:32px;font-size:12px">${esc((u.avatar||u.display[0]).slice(0,2))}</div>
          <span style="font-size:13px">${esc(u.display)}</span>
          <button class="op-btn op-btn-red" style="padding:2px 8px;font-size:11px" onclick="ownerKickFromVoice('${sid}','${ch.id}','${uname}')">طرد</button>
        </div>`;}).join('')}
      </div>
    </div>`).join('')}
    <div class="op-section-title" style="margin-top:20px">كل القنوات الصوتية (${voiceChannels.length})</div>
    ${voiceChannels.map(({sid,sv,ch,users})=>`
    <div class="op-user-row">
      <span style="font-size:18px">🔊</span>
      <div class="op-uinfo">
        <div class="op-uname">${esc(ch.name)}</div>
        <div class="op-utag">${esc(sv.name)} · ${users.length>0?users.length+' مستخدم':'فارغة'}</div>
      </div>
    </div>`).join('')}`;
}
function ownerClearVoice(sid,cid){
  if(!DB.servers[sid]?.voiceRooms?.[cid]) return;
  delete DB.servers[sid].voiceRooms[cid]; saveDB();
  toast('🔇 تم طرد الجميع من الكالم');
  ownerTab('voice',document.querySelector('.op-tab.active'));
}
function ownerKickFromVoice(sid,cid,uname){
  if(!DB.servers[sid]?.voiceRooms?.[cid]?.[uname]) return;
  delete DB.servers[sid].voiceRooms[cid][uname]; saveDB();
  toast('👟 تم طرد '+DB.users[uname]?.display+' من الكالم');
  ownerTab('voice',document.querySelector('.op-tab.active'));
}
