// متجر فايف ام - بدون أي مكتبات خارجية. تشغيل: node server.js
const http=require('http'),fs=require('fs'),path=require('path'),crypto=require('crypto');
const PORT=process.env.PORT||3000, DB='data.json', LOG='logins.log';
let db={users:[],products:[{id:'p1',name:'سيارة نادرة',price:50,desc:'سيارة حصرية للسيرفر',img:'',cat:'منتجات مميزة'},{id:'p2',name:'حزمة VIP',price:120,desc:'مزايا VIP لمدة شهر',img:'',cat:'الحزم'}],keys:[]};
if(fs.existsSync(DB))db=JSON.parse(fs.readFileSync(DB));
const ADMIN_USER='admin',ADMIN_PASS='MagicCity@2026!x';
const save=()=>fs.writeFileSync(DB,JSON.stringify(db,null,2));
const sessions={}, uid=()=>crypto.randomBytes(6).toString('hex');
const hash=(p,s)=>crypto.scryptSync(p,s,32).toString('hex');
if(!db.users.some(u=>u.username===ADMIN_USER)){const salt=uid();db.users.push({id:uid(),username:ADMIN_USER,salt,pass:hash(ADMIN_PASS,salt),fivemId:'',balance:0,role:'admin',inventory:[],created:Date.now()});save()}
if(!fs.existsSync(LOG))fs.writeFileSync(LOG,'')
const send=(r,c,o,h={})=>{r.writeHead(c,{'Content-Type':'application/json',...h});r.end(JSON.stringify(o))};
const pub=u=>({id:u.id,username:u.username,fivemId:u.fivemId,balance:u.balance,role:u.role,inventory:u.inventory});
const mime={'.html':'text/html;charset=utf-8','.js':'text/javascript','.css':'text/css','.png':'image/png'};
http.createServer((req,res)=>{
 let body='';req.on('data',d=>body+=d);req.on('end',()=>{
  const url=req.url.split('?')[0];
  if(!url.startsWith('/api/')){
   const f=path.join(__dirname,'public',url==='/'?'index.html':path.normalize(url).replace(/^(\.\.[\/\\])+/,''));
   return fs.readFile(f,(e,d)=>{if(e){res.writeHead(404);return res.end('404')}res.writeHead(200,{'Content-Type':mime[path.extname(f)]||'application/octet-stream'});res.end(d)});
  }
  let b={};try{b=JSON.parse(body||'{}')}catch{}
  const tok=(req.headers.cookie||'').match(/sid=(\w+)/)?.[1];
  const me=db.users.find(u=>u.id===sessions[tok]);
  const need=()=>{if(!me){send(res,401,{error:'سجّل دخول أولاً'});return false}return true};
  const adm=()=>{if(!need())return false;if(me.role!=='admin'){send(res,403,{error:'ممنوع'});return false}return true};
  const ip=req.socket.remoteAddress;
  const login=(u,why)=>{const t=crypto.randomBytes(24).toString('hex');sessions[t]=u.id;
   fs.appendFileSync(LOG,`${new Date().toISOString()} | ${why} | ${u.username} | FiveM:${u.fivemId||'-'} | IP:${ip}\n`);
   send(res,200,{user:pub(u)},{'Set-Cookie':`sid=${t};Path=/;HttpOnly;SameSite=Lax;Max-Age=2592000`})};
  try{
  if(url==='/api/register'&&req.method==='POST'){
   const un=String(b.username||'').trim();if(un.length<3||String(b.password||'').length<4)return send(res,400,{error:'اسم المستخدم 3 أحرف والباسورد 4 على الأقل'});
   if(db.users.some(u=>u.username.toLowerCase()===un.toLowerCase()))return send(res,400,{error:'الاسم مستخدم'});
   const salt=uid();const u={id:uid(),username:un,salt,pass:hash(b.password,salt),fivemId:String(b.fivemId||'').trim(),balance:0,role:'user',inventory:[],created:Date.now()};
   db.users.push(u);save();return login(u,'تسجيل جديد');
  }
  if(url==='/api/login'&&req.method==='POST'){
   const u=db.users.find(x=>x.username.toLowerCase()===String(b.username||'').toLowerCase());
   if(!u||hash(String(b.password||''),u.salt)!==u.pass){fs.appendFileSync(LOG,`${new Date().toISOString()} | فشل دخول | ${b.username} | IP:${ip}\n`);return send(res,400,{error:'بيانات غلط'})}
   return login(u,'دخول');
  }
  if(url==='/api/logout'){delete sessions[tok];return send(res,200,{ok:1},{'Set-Cookie':'sid=;Path=/;Max-Age=0'})}
  if(url==='/api/me')return send(res,200,{user:me?pub(me):null});
  if(url==='/api/fivemid'&&req.method==='POST'){if(!need())return;me.fivemId=String(b.fivemId||'').trim();save();return send(res,200,{user:pub(me)})}
  if(url==='/api/products')return send(res,200,{products:db.products});
  if(url==='/api/buy'&&req.method==='POST'){if(!need())return;
   const p=db.products.find(x=>x.id===b.id);if(!p)return send(res,404,{error:'منتج غير موجود'});
   if(me.balance<p.price)return send(res,400,{error:'رصيدك لا يكفي'});
   me.balance-=p.price;me.inventory.push({product:p.name,pid:p.id,via:'شراء',date:Date.now()});save();return send(res,200,{user:pub(me)});
  }
  if(url==='/api/redeem'&&req.method==='POST'){if(!need())return;
   const code=String(b.key||'').trim().toUpperCase();const k=db.keys.find(x=>x.code===code);
   if(!k)return send(res,404,{error:'المفتاح غير صحيح'});
   if(k.usedBy)return send(res,400,{error:'المفتاح مستخدم من قبل'});
   const p=db.products.find(x=>x.id===k.pid);if(!p)return send(res,400,{error:'المنتج لم يعد موجود'});
   k.usedBy=me.username;k.usedAt=Date.now();me.inventory.push({product:p.name,pid:p.id,via:'مفتاح هدية',date:Date.now()});save();
   return send(res,200,{user:pub(me),product:p.name});
  }
  // ===== أدمن =====
  if(url==='/api/admin/data'){if(!adm())return;
   const log=fs.existsSync(LOG)?fs.readFileSync(LOG,'utf8').trim().split('\n').slice(-200).reverse():[];
   return send(res,200,{users:db.users.map(pub),keys:db.keys,products:db.products,log});
  }
  if(url==='/api/admin/product'&&req.method==='POST'){if(!adm())return;
   if(!b.name)return send(res,400,{error:'الاسم مطلوب'});
   db.products.push({id:uid(),name:b.name,price:+b.price||0,desc:b.desc||'',img:b.img||'',cat:b.cat||'منتجات مميزة'});save();return send(res,200,{ok:1});
  }
  if(url==='/api/admin/product/delete'){if(!adm())return;db.products=db.products.filter(p=>p.id!==b.id);save();return send(res,200,{ok:1})}
  if(url==='/api/admin/key'&&req.method==='POST'){if(!adm())return;
   const p=db.products.find(x=>x.id===b.pid);if(!p)return send(res,400,{error:'اختر منتج'});
   const out=[];for(let i=0;i<Math.min(+b.qty||1,50);i++){
    const code=[0,1,2].map(()=>crypto.randomBytes(2).toString('hex').toUpperCase()).join('-');
    db.keys.push({code,pid:p.id,product:p.name,created:Date.now(),by:me.username,usedBy:null});out.push(code)}
   save();return send(res,200,{codes:out});
  }
  if(url==='/api/admin/key/delete'){if(!adm())return;db.keys=db.keys.filter(k=>k.code!==b.code);save();return send(res,200,{ok:1})}
  if(url==='/api/admin/balance'){if(!adm())return;const u=db.users.find(x=>x.id===b.id);if(!u)return send(res,404,{error:'؟'});u.balance+=+b.amount||0;save();return send(res,200,{ok:1})}
  if(url==='/api/admin/role'){if(!adm())return;const u=db.users.find(x=>x.id===b.id);if(!u)return send(res,404,{error:'؟'});u.role=b.role==='admin'?'admin':'user';save();return send(res,200,{ok:1})}
  if(url==='/api/admin/give'){if(!adm())return;const u=db.users.find(x=>x.id===b.id),p=db.products.find(x=>x.id===b.pid);if(!u||!p)return send(res,404,{error:'؟'});u.inventory.push({product:p.name,pid:p.id,via:'من الأدمن',date:Date.now()});save();return send(res,200,{ok:1})}
  send(res,404,{error:'غير موجود'});
  }catch(e){send(res,500,{error:'خطأ بالسيرفر'})}
 });
}).listen(PORT,()=>console.log('المتجر شغال على http://localhost:'+PORT));
