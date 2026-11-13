# TerraWise — Backend work still needed (per page)

> **للفريق (عربي):** ده الشغل الباقي على الباك-إند. الواجهة جاهزة ومستنية الـ endpoints دي.
> كل بند مكتوب فيه: الصفحة اللي بتستخدمه، الـ method + path، شكل الـ **request**، وشكل الـ **response** المطلوب بالظبط
> (نفس أسماء الحقول والأنواع في كود الواجهة). ابنوا بالأولوية من فوق لتحت.
>
> المواصفات الكاملة والتفصيلية موجودة في `BACKEND_API_SPEC.md` — الملف ده نسخة شغل مختصرة بالباقي بس.

- **Base URL:** `http://localhost:5080/api`
- **Content-Type:** `application/json` · **Dates:** `YYYY-MM-DD` · **Months:** `1–12`

---

## ✅ خلص (مش محتاج شغل)

| Endpoint | الصفحات | الحالة |
|---|---|---|
| `POST /api/analyze` | `/setup` → `/results` | **LIVE** — مربوط ومختبَر (200) |

مسار المزارع كامل (field → setup → results) شغّال فعلي. الباقي تحت ⬇️

---

## 🟨 الأولوية 1 — توسيع رد `/api/analyze` بكتلة GDD
**الصفحة:** `/results` (وضع "Agronomist") — دلوقتي بيرسم منحنى **placeholder** ثابت.
**المطلوب:** زوّدوا حقل `gdd` جوه نفس رد `/api/analyze` الحالي:

```jsonc
"gdd": {
  "unit": "°C-day",
  "base": 0,
  "points": [                       // GDD تراكمي، مرتّب Oct→Sep (12 نقطة)
    { "month": 10, "cumulative": 0 },
    { "month": 11, "cumulative": 60 }
    // ... 12 عنصر
  ],
  "stages": [                       // خطوط المراحل العمودية على الرسم
    { "label": "Emergence",  "month": 11 },
    { "label": "Tillering",  "month": 1 },
    { "label": "Flowering",  "month": 4 },
    { "label": "Grain-fill", "month": 6 }
  ]
}
```
> مجرد ما يرجع، أوصّل الواجهة بيه وأشيل الـ placeholder.

---

## 🟧 الأولوية 2 — لوحة المهندس الزراعي  `/agronomist`
الصفحة كلها دلوقتي على **بيانات وهمية**. دي كل الـ endpoints المطلوبة بنفس الشكل اللي الواجهة مستنياه:

### 2a. تسجيل الدخول (بديل مؤقت → auth حقيقي لاحقاً)
```
POST /api/agronomist/login     { "code": "AGRO-2026" }
→ 200  { "token": "...", "agronomist": { "id": "...", "name": "...", "area": "Nile Delta" } }
```
الواجهة حالياً بتقبل أي كود غير فاضي وتخزّنه في sessionStorage.

### 2b. المؤشرات (KPIs)
```
GET /api/agronomist/kpis
→ 200
{ "awaitingReview": 3, "farmersInArea": 86, "plantingLateVsWindow": 9, "localRulesActive": 2 }
```

### 2c. طلبات المزارعين + المراجعة
```
GET /api/agronomist/requests
→ 200
[
  { "id":"f_001", "name":"Ahmed Hassan", "crop":"Wheat",
    "window":"Nov 16–29", "usual":"Dec 1", "status":"late", "reviewed":false }
  // status: 'ok' | 'late'
]

POST /api/agronomist/requests/{id}/review
{ "decision":"approve", "note":"...", "testFirst":true }   // decision: 'approve' | 'adjust'
→ 200  { "id":"f_001", "reviewed":true }
```

### 2d. خريطة المنطقة
```
GET /api/agronomist/area?lat=30.6&lon=31.2&radiusKm=25
→ 200
[
  { "name":"Ahmed", "lat":30.61, "lon":31.24, "status":"ok" }   // status: 'ok' | 'near' | 'late'
]
```
الواجهة بتعرض تنبيه تلقائي لو فيه أي `status:"late"`.

### 2e. قواعد المعرفة المحلية
```
GET    /api/agronomist/rules
→ 200  [ { "id":"r1", "text":"...", "type":"soil", "active":true } ]
       // type: 'soil' | 'variety' | 'market' | 'pest' | 'irrigation'

POST   /api/agronomist/rules        { "text":"...", "type":"pest" }   → 201 { rule }
PATCH  /api/agronomist/rules/{id}   { "active":false }                 → 200 { rule }
DELETE /api/agronomist/rules/{id}                                      → 204
```

### 2f. سجل المواسم (بعد الحصاد)
```
GET  /api/agronomist/season-log
→ 200
[
  { "farmer":"Ahmed Hassan", "triedWindow":true, "outcome":"success", "modelSaid":"success" }
  // outcome/modelSaid: 'success'|'partial'|'heat-stressed'|'frost-damage'|'at-risk'|'other'
]

POST /api/agronomist/season-log
{ "farmer":"...", "triedWindow":true, "outcome":"success" }
→ 201  { logRow }      // الباك يملأ modelSaid من التوقّع المخزّن
```

---

## 🟦 الأولوية 3 — تصدير PDF للنتائج
**الصفحة:** `/results` — زر **"Download as PDF"** دلوقتي **معطّل** لحد ما يتبني.
```
POST /api/results/pdf        body: AnalysisRequest (أو analysisId محفوظ)
→ 200  application/pdf  (binary)      // أو { "url": "https://.../report.pdf" }
```

---

## ⬜ اختياري — بروكسي للبحث الجغرافي
**الصفحة:** `/field` — البحث حالياً بيستخدم OpenStreetMap Nominatim مباشرة من المتصفّح.
لو عايزين تتحكّموا فيه server-side (cache/حدود الاستخدام):
```
GET /api/geocode?q=<string>
→ 200  [ { "lat":30.6042, "lon":31.2358, "displayName":"Nile Delta, Egypt" } ]
```
> لو مش محتاجينه، سيبوا Nominatim زي ما هو.

---

## ملخّص الأولويات

| # | الشغل | الصفحة | الأثر |
|---|------|--------|------|
| 1 | كتلة `gdd` في رد `/analyze` | /results (Agronomist) | يفعّل رسم GDD الحقيقي |
| 2 | كل `/api/agronomist/*` | /agronomist | يشغّل لوحة المهندس بالكامل |
| 3 | `POST /api/results/pdf` | /results | يفعّل زر تحميل الـ PDF |
| 4 | `GET /api/geocode` (اختياري) | /field | بحث server-side بدل Nominatim |

> كل الأنواع (enums) وأسماء الحقول فوق **لازم تطابق** كود الواجهة بالظبط. التفاصيل الكاملة في `BACKEND_API_SPEC.md`.
