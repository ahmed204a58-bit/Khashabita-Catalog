خشابيتا CNC — نسخة موحّدة محدثة

محتويات النسخة:
- واجهة عربية متجاوبة بتصميم البنر المطوّر.
- صورة أحمد الكرتونية واللوجو الأصلي.
- روابط تفاعلية لفيسبوك ويوتيوب وتيك توك داخل البنر.
- أيقونات الأقسام، ومنها قسم السيارات.
- كتالوج المنتجات ولوحة الإدارة الحالية كما هي، دون تغيير منطق Firebase.
- المنتج يدعم عدة صور ووصفًا وسعرًا وكودًا ومقاسات وخامة وقسمًا.
- زر واتساب مباشر للعميل.

مهم: تم توحيد صفحة البداية في:
1) index.html في جذر المشروع — لموقع GitHub Pages المضبوط على main / (root).
2) public/index.html — لاستضافة Firebase المضبوطة على مجلد public.

كما تم إبقاء app.js وملفات الصور متطابقة في الجذر ومجلد public حتى تعمل الصفحة في كلا المكانين.

روابط السوشيال:
- Facebook: https://www.facebook.com/share/1DUHTuDPca/
- YouTube: https://youtube.com/@khashabita?si=zkpL1V_TVNy_Dqgd
- TikTok: https://www.tiktok.com/@khashabita?_r=1&_t=ZS-9BHYWpW8PDU

حساب المدير المصرّح به: ahmed204a58@gmail.com
مشروع Firebase: khashabita-catalog

النشر على GitHub Pages:
- ارفع محتويات مجلد Khashabita-Catalog إلى جذر المستودع (main).
- من Settings > Pages اختر Deploy from a branch ثم main و /(root).
- لا ترفع ملف ZIP نفسه.

ملاحظة تسجيل الدخول:
- في Firebase Console افتح Authentication > Settings > Authorized domains.
- أضف اسم المضيف المستخدم لفتح الموقع، مثل ahmed204a58-bit.github.io.
- أضف أي نطاق آخر تستخدمه فعليًا، دون https أو مسار /Khashabita-Catalog.

النشر على Firebase Hosting (اختياري):
- من جذر المشروع نفّذ firebase deploy بعد تسجيل الدخول إلى Firebase CLI.
- إعداد firebase.json يستخدم public كمجلد النشر.

إضافة المنتجات:
- سجّل الدخول بزر «إدارتي» باستخدام حساب المدير.
- اكتب اسم المنتج والكود والسعر والقسم والمقاسات والخامة والوصف.
- ضع رابط HTTPS مباشر لكل صورة في سطر مستقل.
- للسيارات اكتب القسم بالضبط: قسم السيارات.
- احفظ المنتج ليظهر في الكتالوج.
