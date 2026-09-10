TISCORD V6 — BACKEND FOUNDATION
================================

هذه النسخة هي المرحلة الأولى: إضافة Backend حقيقي لنظام تسجيل الدخول والجلسات
بدون حذف ملفات الواجهة الحالية.

الموجود:
- Node.js + Express
- SQLite database
- Argon2id password hashing
- HTTP-only session cookie
- Session storage داخل SQLite
- Rate limiting لتسجيل الدخول والتسجيل
- Helmet security headers
- Audit logs
- /api/auth/register
- /api/auth/login
- /api/auth/me
- /api/auth/logout
- /api/account
- /api/admin/audit

التشغيل:
1) ثبّت Node.js 20+.
2) انسخ .env.example إلى .env.
3) ضع SESSION_SECRET عشوائي طويل.
4) ضع OWNER_PASSWORD قوي للحساب owner.
5) نفّذ:
   npm install
6) شغّل:
   npm start
7) افتح:
   http://localhost:3000

مهم:
الواجهة الحالية ما زالت تستخدم DB/localStorage في main(2).js للميزات القديمة.
لذلك هذه المرحلة لا تدّعي أن كل بيانات السيرفر أصبحت Backend بالكامل.

المرحلة التالية التي أنصح بها:
- نقل users/servers/channels/messages/DMs من localStorage إلى SQLite/PostgreSQL.
- تحويل كل عمليات الإدارة إلى API محمية بالسيرفر.
- WebSocket للرسائل الفورية.
- WebRTC للصوت.
- نظام صلاحيات server-side.
- Migration آمن من بيانات Tiscord V5 القديمة.

لا تضع كلمات المرور الحقيقية داخل JavaScript أو HTML.
