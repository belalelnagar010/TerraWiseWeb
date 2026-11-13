# TerraWise — Backend API Specification

> **للفريق (عربي):** ده ملف مواصفات الـ API بين الواجهة (Angular) والباك-إند.
> لكل صفحة: الـ endpoint المطلوب، الـ **request** اللي الواجهة بتبعته، والـ **response** اللي مستنياه.
> أسماء الحقول والأنواع (enums) دي **ثابتة** في كود الواجهة — لازم الباك يرجّعها بنفس الأسماء بالظبط.
> أي endpoint مكتوب جنبه **(proposed)** يعني الواجهة حالياً بتستخدم بيانات وهمية (mock) ومستنية الباك يبنيه بنفس الشكل.

- **Frontend:** Angular 20 (standalone, signals)
- **Base URL (configurable):** `/api`
- **Content-Type:** `application/json` for all requests/responses
- **Dates:** ISO `YYYY-MM-DD`. **Months:** integer `1–12` (Jan=1). **No timezones needed** (date-only).

---

## 0. Shared types & enums (must match exactly)

```ts
type IrrigationMethod = 'rainfed' | 'surface' | 'drip' | 'well';
type SoilType        = 'clay' | 'sandy' | 'loam' | 'silty' | null;   // null = unknown → use SoilGrids
type PlantWeek       = 'early' | 'mid' | 'late';

type CalendarStatus  = 'out' | 'safe' | 'optimal' | 'flowering' | 'heat' | 'frost';
type IrrigationNeed  = 'none' | 'low' | 'high';
type Confidence      = 'high' | 'medium' | 'low';

// Crop ids sent by the UI (lowercase, no spaces):
type CropId = 'wheat' | 'maize' | 'rice' | 'barley' | 'sorghum' | 'cotton' | 'lentils' | 'favabeans';
```

**GeoJSON:** when the user draws a field boundary, the UI sends a standard GeoJSON
`Feature<Polygon>` (lon/lat order, WGS84). When they only drop a pin, `boundaryGeoJSON` is `null`.

---

## PAGE 1 — Field selection  `/field`

**What it produces:** the field location. It does **not** call the analysis backend itself.

- `lat`, `lon` (numbers, WGS84)
- optional `boundaryGeoJSON` (Feature<Polygon>) + `areaHectares` (number) when the user draws a boundary

### Geocoding (currently frontend-only)
The search box currently calls **OpenStreetMap Nominatim** directly from the browser:
`GET https://nominatim.openstreetmap.org/search?format=json&q=<query>`

**(proposed)** If you want to proxy/cache geocoding server-side:

```
GET /api/geocode?q=<string>
→ 200
[
  { "lat": 30.6042, "lon": 31.2358, "displayName": "Nile Delta, Egypt" }
]
```

---

## PAGE 2 — Crop & field setup  `/setup`  →  **main analysis call**

When the user clicks **"Find my planting window"**, the UI sends everything collected
so far to the analysis endpoint and waits for the result, then navigates to `/results`.

### Request — `POST /api/analyze`

```jsonc
{
  "lat": 30.6042,
  "lon": 31.2358,
  "crop": "wheat",                 // CropId
  "irrigation": "surface",         // IrrigationMethod
  "soilType": "clay",              // SoilType | null
  "usualPlantMonth": 12,           // 1–12
  "usualPlantWeek": "mid",         // PlantWeek
  "priorities": {                  // each 0–5 (sliders)
    "waterSaving": 3,
    "soilHealth": 3,
    "yieldStability": 3
  },
  "boundaryGeoJSON": {             // optional; null if only a pin was dropped
    "type": "Feature",
    "properties": {},
    "geometry": { "type": "Polygon", "coordinates": [[[31.1,30.5],[31.3,30.5],[31.3,30.7],[31.1,30.7],[31.1,30.5]]] }
  }
}
```

### Response — `200 AnalysisResponse`

```jsonc
{
  "window": {
    "start":      "2026-11-16",   // ISO date — recommended window start
    "end":        "2026-11-29",   // ISO date — recommended window end
    "usualStart": "2026-12-01",   // the farmer's usual planting date
    "shiftDays":  11              // signed int: how many days the optimal start differs from usual (+ = earlier/later per your convention)
  },

  "calendar": [                   // EXACTLY 12 items, one per month, month = 1..12
    { "month": 1,  "status": "out" },
    { "month": 2,  "status": "safe" },
    { "month": 3,  "status": "optimal" },
    { "month": 4,  "status": "flowering" },
    { "month": 5,  "status": "flowering" },
    { "month": 6,  "status": "out" },
    { "month": 7,  "status": "heat" },
    { "month": 8,  "status": "heat" },
    { "month": 9,  "status": "out" },
    { "month": 10, "status": "out" },
    { "month": 11, "status": "out" },
    { "month": 12, "status": "out" }
  ],

  "irrigation": [                 // EXACTLY 12 items, one per month
    { "month": 1,  "need": "none" },
    { "month": 2,  "need": "low" },
    { "month": 3,  "need": "low" },
    { "month": 4,  "need": "high" },
    { "month": 5,  "need": "high" },
    { "month": 6,  "need": "high" },
    { "month": 7,  "need": "high" },
    { "month": 8,  "need": "low" },
    { "month": 9,  "need": "none" },
    { "month": 10, "need": "none" },
    { "month": 11, "need": "none" },
    { "month": 12, "need": "none" }
  ],

  "timeMachine": [                // climate drift: best-window start day per year.
    { "year": 2001, "windowStartDay": 5 },   // windowStartDay = day-of-November (1 = Nov 1, 31 = Dec 1)
    { "year": 2005, "windowStartDay": 7 },
    { "year": 2010, "windowStartDay": 9 },
    { "year": 2015, "windowStartDay": 11 },
    { "year": 2020, "windowStartDay": 14 },
    { "year": 2025, "windowStartDay": 16 },
    { "year": 2050, "windowStartDay": 27 }
  ],

  "evidence": {
    "why":        "Flowering avoids April heat waves and grain-fill ends before peak summer heat.",
    "nasaSource": "NASA POWER · 1981–2025",
    "confidence": "high"          // Confidence
  }
}
```

**Notes for the backend:**
- `calendar` and `irrigation` **must contain all 12 months** (the UI reorders them Oct→Sep itself).
- `timeMachine` may contain any number of year points (≥2). The UI **interpolates linearly** between them for every year 2001–2050, so provide enough anchor years. `windowStartDay` is a day index anchored to **1 November** (e.g. 16 → "Nov 16", 33 → "Dec 3").
- `shiftDays` drives the headline "+N days later"; send it signed and consistent with `window.start` vs `window.usualStart`.
- Target latency: the UI shows a 1.5s "Analyzing…" state. Anything under ~3s is fine.

---

## PAGE 3 — Results  `/results`

Consumes the **same `AnalysisResponse`** above — no extra call for the farmer view.
The route is guarded: it requires a selected field, otherwise redirects to `/field`.

### 3a. GDD chart (agronomist view)  **(proposed — currently a placeholder shape)**
When the user flips to the **Agronomist** toggle, a Growing-Degree-Days chart is shown.
Today the UI draws a placeholder curve. To make it real, extend `evidence` (or add a field):

```jsonc
"gdd": {
  "unit": "°C-day",
  "base": 0,
  "points": [                     // cumulative GDD, ordered Oct→Sep (12 points)
    { "month": 10, "cumulative": 0 },
    { "month": 11, "cumulative": 60 }
    // … 12 total
  ],
  "stages": [                     // vertical markers on the chart
    { "label": "Emergence", "month": 11 },
    { "label": "Tillering", "month": 1 },
    { "label": "Flowering", "month": 4 },
    { "label": "Grain-fill", "month": 6 }
  ]
}
```

### 3b. PDF export  **(proposed — button is disabled until ready)**
```
POST /api/results/pdf        body: AnalysisRequest (or a saved analysisId)
→ 200  application/pdf  (binary)   // or { "url": "https://…/report.pdf" }
```

---

## PAGE 4 — Agronomist dashboard  `/agronomist`  **(all endpoints below are proposed)**

The whole dashboard currently runs on **mock data**. Below is the exact shape the UI expects,
so the backend can return the same structures. Auth is a placeholder code gate for now.

### 4a. Auth (placeholder today → real auth later)
```
POST /api/agronomist/login     { "code": "AGRO-2026" }
→ 200  { "token": "…", "agronomist": { "id": "…", "name": "…", "area": "Nile Delta" } }
```
Currently the UI only checks the code is non-empty and stores it in `sessionStorage`.

### 4b. KPIs
```
GET /api/agronomist/kpis
→ 200
{
  "awaitingReview": 3,
  "farmersInArea": 86,
  "plantingLateVsWindow": 9,
  "localRulesActive": 2
}
```

### 4c. Farmer requests
```
GET /api/agronomist/requests
→ 200
[
  {
    "id": "f_001",
    "name": "Ahmed Hassan",
    "crop": "Wheat",
    "window": "Nov 16–29",      // display string
    "usual": "Dec 1",            // display string
    "status": "late",            // 'ok' | 'late'
    "reviewed": false
  }
  // …
]
```

Review / approve a request:
```
POST /api/agronomist/requests/{id}/review
{
  "decision": "approve",         // 'approve' | 'adjust'
  "note": "Try the window on half the field first",
  "testFirst": true              // "Recommend testing on part of field first" checkbox
}
→ 200  { "id": "f_001", "reviewed": true }
```

### 4d. Area map markers
```
GET /api/agronomist/area?lat=30.6&lon=31.2&radiusKm=25
→ 200
[
  { "name": "Ahmed", "lat": 30.61, "lon": 31.24, "status": "ok" },    // 'ok' | 'near' | 'late'
  { "name": "Hoda",  "lat": 30.55, "lon": 31.19, "status": "late" }
  // …
]
```
The UI shows an amber alert banner automatically when any `status: "late"` markers exist.

### 4e. Local knowledge rules
```
GET    /api/agronomist/rules
→ 200
[
  { "id": "r1", "text": "Slow-draining soil — delay planting start by 5 days", "type": "soil", "active": true }
]
// type: 'soil' | 'variety' | 'market' | 'pest' | 'irrigation'

POST   /api/agronomist/rules        { "text": "...", "type": "pest" }       → 201 { rule }
PATCH  /api/agronomist/rules/{id}   { "active": false }                      → 200 { rule }
DELETE /api/agronomist/rules/{id}                                            → 204
```

### 4f. Season log (post-harvest outcomes)
```
GET  /api/agronomist/season-log
→ 200
[
  {
    "farmer": "Ahmed Hassan",
    "triedWindow": true,
    "outcome": "success",        // 'success' | 'partial' | 'heat-stressed' | 'frost-damage' | 'at-risk' | 'other'
    "modelSaid": "success"       // same enum — model's prediction, used to show agreement ✓/⚠️
  }
]

POST /api/agronomist/season-log
{ "farmer": "…", "triedWindow": true, "outcome": "success" }
→ 201  { logRow }   // backend fills modelSaid from the stored prediction
```

---

## Summary — what the backend must deliver (priority order)

| # | Endpoint | Status | Drives |
|---|----------|--------|--------|
| 1 | `POST /api/analyze` | **core** | /setup → /results (the whole product) |
| 2 | `gdd` block in response | nice-to-have | Agronomist GDD chart |
| 3 | `POST /api/results/pdf` | later | PDF download button |
| 4 | `GET /api/geocode` | optional | server-side search (else keep Nominatim) |
| 5 | `/api/agronomist/*` | phase 2 | the agronomist dashboard |

**The single most important deliverable is `POST /api/analyze`** returning the exact
`AnalysisResponse` shape in Page 2. Once that is live, the farmer-facing flow
(/field → /setup → /results) is fully functional end-to-end.

The frontend `AnalysisService` already has the real HTTP call prepared (commented out)
and a mock in place, so switching to the live backend is a one-line change.
