# 🚀 production-rag-system

This is a production-grade Retrieval-Augmented Generation (RAG) system built with a focus on scalability, security, and developer productivity.

---

## 🛠️ التقنيات المستخدمة (Tech Stack)

- **FastAPI**: لبناء واجهة برمجية سريعة وحديثة.
- **PostgreSQL & SQLAlchemy**: لإدارة البيانات والعلاقات.
- **Qdrant**: كمخزن لمتجهات البيانات (Vector Store).
- **Redis**: للتخزين المؤقت (Caching) وإدارة المهام.
- **Celery**: لمعالجة المهام الخلفية (Background Tasks).
- **Docker**: لضمان بيئة تشغيل موحدة.

---

## 🏗️ نظام العمل (Workflow)

يتبع المشروع نظام تطوير صارم يعتمد على:

1.  **TDD (Technical Design Document)**: التوثيق قبل البرمجة.
2.  **AI Agents**: استخدام عملاء ذكاء اصطناعي متخصصين لكل جزء من الكود.
3.  **Milestones**: تقسيم العمل لمراحل واضحة كما هو موضح في `TASKS.md`.

---

## 🛠️ دليل الإعداد والتشغيل (Step-by-Step Setup)

اتبع الأوامر التالية في الـ Terminal بالترتيب:

### 1️⃣ تهيئة البيئة الافتراضية

نعزل مكتبات المشروع عن الجهاز لضمان الاستقرار.

```bash
# إنشاء بيئة افتراضية معزولة
uv venv

# تفعيل البيئة (Windows)
.\.venv\Scripts\activate
```

### 2️⃣ تثبيت المكتبات البرمجية (Dependencies)

تحميل كل الأدوات اللازمة للذكاء الاصطناعي والويب.

```bash
# تثبيت كافة المكتبات المذكورة في ملف pyproject.toml
uv sync
```

### 3️⃣ إعداد المتغيرات البيئية

تجهيز ملف الإعدادات السرية والمفاتيح.

```bash
# نسخ ملف المثال لإنشاء الملف الفعلي
cp .env.example .env
```

> **ملاحظة:** لا تنسَ وضع مفتاح API الخاص بـ OpenAI داخل ملف `.env`.

### 4️⃣ تشغيل البنية التحتية (Docker)

تشغيل قواعد البيانات والخدمات دون الحاجة لتثبيتها يدوياً.

```bash
# تشغيل Postgres, Qdrant, Redis, و MinIO في الخلفية
docker compose up -d
```

### 5️⃣ تهيئة جداول قاعدة البيانات (Migrations)

رسم هيكل الجداول داخل قاعدة البيانات لتصبح جاهزة لتخزين البيانات.

```bash
# تطبيق التعديلات على قاعدة البيانات
uv run alembic upgrade head
```

### 6️⃣ تشغيل التطبيق

الآن، حان وقت الانطلاق!

```bash
# تشغيل خادم الويب (FastAPI) مع خاصية التحديث التلقائي
uv run uvicorn src.api.main:app --reload
```
