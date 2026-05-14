import json
import time
from collections.abc import Generator

import requests
import streamlit as st

# ==============================================================================
# إعدادات الصفحة والتصميم (Page Config & Premium CSS)
# ==============================================================================
st.set_page_config(
    page_title="Production RAG System — Premium UI",
    page_icon="🚀",
    layout="wide",
    initial_sidebar_state="expanded",
)

# Custom Styling to WOW the user with a premium design aesthetic
st.markdown(
    """
<style>
    @import url('https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;800&family=Inter:wght@400;600&display=swap');

    /* دعم كامل للغة العربية (RTL) وتخصيص الخطوط */
    * {
        font-family: 'Cairo', 'Inter', sans-serif !important;
    }
    
    .block-container {
        direction: rtl;
        text-align: right;
    }

    /* عنوان رئيسي بتدرج لوني مميز */
    .premium-title {
        background: linear-gradient(135deg, #1E3C72 0%, #2A5298 100%);
        -webkit-background-clip: text;
        -webkit-text-fill-color: transparent;
        font-size: 2.8rem;
        font-weight: 800;
        text-align: center;
        margin-bottom: 0.5rem;
        padding-top: 1rem;
    }
    
    .premium-subtitle {
        text-align: center;
        color: #6c757d;
        font-size: 1.1rem;
        margin-bottom: 2.5rem;
    }

    /* تحسين البطاقات (Source Cards) مع تأثيرات حركية خفيفة */
    .source-card {
        background: rgba(255, 255, 255, 0.7);
        backdrop-filter: blur(10px);
        border-right: 4px solid #2A5298;
        border-left: 1px solid #e9ecef;
        border-top: 1px solid #e9ecef;
        border-bottom: 1px solid #e9ecef;
        padding: 1.2rem;
        margin-bottom: 1rem;
        border-radius: 8px;
        box-shadow: 0 4px 6px rgba(0,0,0,0.02);
        transition: all 0.3s ease;
    }
    
    .source-card:hover {
        transform: translateY(-3px);
        box-shadow: 0 8px 15px rgba(42, 82, 152, 0.1);
        border-right-color: #FF6B6B;
    }

    .source-header {
        font-weight: 600;
        color: #1E3C72;
        margin-bottom: 0.5rem;
        display: flex;
        align-items: center;
        justify-content: space-between;
    }

    .source-snippet {
        font-size: 0.95rem;
        color: #333;
        line-height: 1.7;
        background-color: #fcfcfc;
        padding: 0.8rem;
        border-radius: 6px;
        border: 1px solid #f0f0f0;
    }

    .custom-badge {
        background: linear-gradient(135deg, #f1f3f5 0%, #e9ecef 100%);
        color: #495057;
        padding: 0.2rem 0.6rem;
        border-radius: 20px;
        font-size: 0.75rem;
        font-weight: 600;
        border: 1px solid #dee2e6;
    }
    
    .score-badge {
        background: linear-gradient(135deg, #e3f2fd 0%, #bbdefb 100%);
        color: #1565c0;
        padding: 0.2rem 0.6rem;
        border-radius: 20px;
        font-size: 0.75rem;
        font-weight: 800;
    }

    /* تجميل القائمة الجانبية */
    [data-testid="stSidebar"] {
        background-color: #f8f9fa;
        border-left: 1px solid #e9ecef;
    }
</style>
""",
    unsafe_allow_html=True,
)

# ==============================================================================
# المتغيرات العامة والحالة (Global Config & Session State)
# ==============================================================================
BASE_URL = "http://localhost:8000"

if "current_sources" not in st.session_state:
    st.session_state.current_sources = []


def get_headers() -> dict[str, str]:
    """توليد الترويسات المطلوبة للاتصال بالخادم مع التحقق من المفتاح."""
    api_key = st.session_state.get("api_key", "").strip()
    return {"Authorization": f"Bearer {api_key}"} if api_key else {}


# ==============================================================================
# القائمة الجانبية (Sidebar Config)
# ==============================================================================
with st.sidebar:
    st.markdown("### 🔐 إعدادات المصادقة")
    api_key_input = st.text_input(
        "مفتاح المستأجر (Tenant API Key):",
        value=st.session_state.get("api_key", ""),
        type="password",
        placeholder="أدخل الـ API Key الخاص بك...",
        help="يستخدم لتحديد نطاق البيانات وعزلها لكل مستأجر.",
    )
    if api_key_input != st.session_state.get("api_key", ""):
        st.session_state.api_key = api_key_input

    st.markdown("---")
    st.markdown("### ℹ️ معلومات النظام")
    st.info(
        "نظام متقدم يعتمد على بنية **RAG** الإنتاجية مع دعم خوارزميات البحث المتعددة وعزل كامل لبيانات العملاء."
    )

    # التحقق من حالة الخادم (Health Check)
    if st.button("🔄 فحص حالة الخادم", use_container_width=True):
        try:
            res = requests.get(f"{BASE_URL}/health", timeout=3)
            if res.status_code == 200:
                st.success("الخادم يعمل بشكل ممتاز! 🟢")
            else:
                st.warning(f"استجابة غير متوقعة: {res.status_code}")
        except Exception:
            st.error("تعذر الاتصال بالخادم 🔴")

# ==============================================================================
# الواجهة الرئيسية (Main Interface Layout)
# ==============================================================================
st.markdown(
    '<div class="premium-title">نظام الاسترجاع الذكي (RAG System)</div>', unsafe_allow_html=True
)
st.markdown(
    '<div class="premium-subtitle">واجهة تفاعلية متقدمة تتيح التحكم الدقيق بأساليب البحث والاسترجاع</div>',
    unsafe_allow_html=True,
)

if not st.session_state.get("api_key"):
    st.warning(
        "⚠️ يُرجى إدخال **مفتاح المستأجر (Tenant API Key)** في القائمة الجانبية للبدء باستخدام النظام."
    )
    st.stop()

# إنشاء التبويبات الثلاثة المحددة في ملف TDD
tab_query, tab_upload, tab_docs = st.tabs(
    ["🔍 الاستعلام والبحث", "📤 رفع المستندات", "📁 إدارة المستندات"]
)

# ------------------------------------------------------------------------------
# التبويب الأول: لوحة الاستعلام (Query Panel)
# ------------------------------------------------------------------------------
with tab_query, st.container():
    st.markdown("#### 💬 طرح سؤال جديد")

    # شبكة إعدادات البحث
    col1, col2 = st.columns([2, 1])
    with col1:
        question = st.text_area(
            "اكتب استفسارك هنا:",
            placeholder="مثال: ما هي شروط الخدمة وآلية حماية البيانات؟",
            height=100,
        )

    with col2:
        st.markdown("##### ⚙️ خيارات البحث الأساسية")
        search_type_label = st.selectbox(
            "نوع البحث (Search Type):",
            options=[
                "هجين (Hybrid Search) — مُوصى به",
                "بحث تشابه معاني (Semantic Search)",
                "بحث حرفي (Keyword Exact Match)",
            ],
            index=0,
            help="يحدد الخوارزمية المستخدمة لاسترجاع الفقرات من المستندات.",
        )

        # تحويل الاختيار إلى القيمة المتوافقة مع الـ API
        type_mapping = {
            "هجين (Hybrid Search) — مُوصى به": "hybrid",
            "بحث تشابه معاني (Semantic Search)": "semantic",
            "بحث حرفي (Keyword Exact Match)": "literal",
        }
        search_type = type_mapping[search_type_label]

        mode_label = st.radio(
            "نمط الإجابة (Query Mode):",
            options=["قياسي (Standard)", "صارم ضد الهلوسة (Strict)"],
            horizontal=True,
        )
        mode = "strict" if "Strict" in mode_label else "standard"

    # خيارات التحكم المتقدمة (Advanced Admin Options)
    with st.expander(
        "🛠️ خيارات التحكم المتقدمة في الاسترجاع (Advanced Configuration)", expanded=False
    ):
        st.markdown(
            "تتيح لك هذه الإعدادات ضبط أوزان خوارزمية **Reciprocal Rank Fusion (RRF)** وحدود التصفية:"
        )
        adv_col1, adv_col2, adv_col3, adv_col4 = st.columns(4)

        with adv_col1:
            vector_weight = st.slider(
                "وزن البحث الدلالي:",
                min_value=0.0,
                max_value=1.0,
                value=0.7,
                step=0.05,
                help="تأثير المتجهات الدلالية في الترتيب النهائي للنتائج (خاص بالبحث الهجين).",
            )

        with adv_col2:
            keyword_weight = st.slider(
                "وزن البحث الحرفي (BM25):",
                min_value=0.0,
                max_value=1.0,
                value=0.3,
                step=0.05,
                help="تأثير الكلمات المفتاحية في الترتيب النهائي.",
            )

        with adv_col3:
            similarity_threshold = st.slider(
                "حد التشابه الأدنى (Threshold):",
                min_value=0.0,
                max_value=1.0,
                value=0.1,
                step=0.05,
                help="استبعاد أي قطع بيانات (Chunks) تقل درجة تطابقها الدلالي عن هذا الحد.",
            )

        with adv_col4:
            top_k = st.number_input(
                "عدد القطع المسترجعة (Top-K):",
                min_value=1,
                max_value=50,
                value=10,
                step=1,
                help="العدد الأولي للقطع المسترجعة قبل تطبيق إعادة الترتيب (Reranking).",
            )

    # تنفيذ الاستعلام
    if st.button("🚀 إرسال الاستعلام واستقبال الإجابة", type="primary"):
        if not question.strip():
            st.warning("يُرجى كتابة السؤال أولاً.")
        else:
            st.session_state.current_sources = []
            payload = {
                "question": question.strip(),
                "mode": mode,
                "search_type": search_type,
                "search_config": {
                    "vector_weight": float(vector_weight),
                    "keyword_weight": float(keyword_weight),
                    "similarity_threshold": float(similarity_threshold),
                    "top_k": int(top_k),
                },
            }

            st.markdown("#### ✨ الإجابة:")
            answer_container = st.empty()

            # دالة المولد لاستقبال الـ SSE Stream progressive rendering
            def stream_answer_generator() -> Generator[str, None, None]:
                try:
                    with requests.post(
                        f"{BASE_URL}/v1/query/stream",
                        json=payload,
                        headers=get_headers(),
                        stream=True,
                        timeout=30,
                    ) as r:
                        if r.status_code != 200:
                            yield f"❌ تعذر الحصول على استجابة من الخادم (رمز الخطأ: {r.status_code}).\n\n{r.text}"
                            return

                        for line in r.iter_lines():
                            if line:
                                decoded = line.decode("utf-8")
                                if decoded.startswith("data: "):
                                    event_str = decoded[6:]
                                    try:
                                        event = json.loads(event_str)
                                        e_type = event.get("type")
                                        if e_type == "token":
                                            yield event.get("content", "")
                                        elif e_type == "sources":
                                            st.session_state.current_sources = event.get(
                                                "sources", []
                                            )
                                        elif e_type == "done":
                                            break
                                    except json.JSONDecodeError:
                                        pass
                except requests.exceptions.RequestException as e:
                    yield f"\n\n❌ حدث خطأ أثناء الاتصال بالخادم: {str(e)}"

            # طباعة الـ Stream مباشرة باستخدام الأداة الأصلية لـ Streamlit
            st.write_stream(stream_answer_generator())

    # عرض المصادر (Sources Attribution Cards) عند توفرها
    if st.session_state.current_sources:
        st.markdown("---")
        st.markdown("#### 📚 المصادر والفقرات المرجعية المسترجعة:")
        for idx, src in enumerate(st.session_state.current_sources):
            score = src.get("relevance_score", 0.0)
            file_name = src.get("file_name", "غير معروف")
            page = src.get("page_number")
            page_str = f" • صفحة {page}" if page else ""
            section = src.get("section_title")
            section_str = f" • قسم: {section}" if section else ""
            snippet = src.get("snippet", "")

            st.markdown(
                f"""
                <div class="source-card">
                    <div class="source-header">
                        <span>📄 {file_name} <span class="custom-badge">المصدر #{idx + 1}</span>{page_str}{section_str}</span>
                        <span class="score-badge">درجة الارتباط: {score:.3f}</span>
                    </div>
                    <div class="source-snippet">{snippet}</div>
                </div>
                """,
                unsafe_allow_html=True,
            )

# ------------------------------------------------------------------------------
# التبويب الثاني: لوحة رفع الملفات (Upload Panel)
# ------------------------------------------------------------------------------
with tab_upload:
    st.markdown("#### 📤 إضافة مستند جديد لبيانات المستأجر")
    st.info(
        "تدعم الواجهة رفع ملفات **PDF** أو الصور، حيث تتم معالجتها وجدولتها وفهرستها دلالياً في الخلفية تلقائياً."
    )

    uploaded_file = st.file_uploader(
        "اختر ملفاً لرفعه:",
        type=["pdf", "png", "jpg", "jpeg"],
        help="الحد الأقصى لحجم الملف يحدده الخادم.",
    )

    if uploaded_file and st.button("🚀 بدء الرفع والفهرسة", type="primary"):
        with st.spinner("جارٍ إرسال الملف للخادم..."):
            try:
                files = {"file": (uploaded_file.name, uploaded_file.getvalue(), uploaded_file.type)}
                res = requests.post(
                    f"{BASE_URL}/v1/ingest", headers=get_headers(), files=files, timeout=60
                )

                if res.status_code in (200, 202):
                    data = res.json()
                    doc_id = data.get("document_id")
                    st.success(f"✅ تم استلام الملف بنجاح! مُعرّف المعالجة: `{doc_id}`")

                    # متابعة حالة الفهرسة (Polling Status)
                    status_placeholder = st.empty()
                    for _ in range(15):
                        time.sleep(2)
                        status_res = requests.get(
                            f"{BASE_URL}/v1/documents/{doc_id}", headers=get_headers(), timeout=5
                        )
                        if status_res.status_code == 200:
                            s_data = status_res.json()
                            status = s_data.get("status", "")
                            chunks = s_data.get("chunk_count")
                            if status == "indexed":
                                status_placeholder.success(
                                    f"🎉 اكتملت الفهرسة بنجاح! تم استخراج **{chunks}** كتل (Chunks)."
                                )
                                break
                            elif status == "failed":
                                status_placeholder.error("❌ فشلت عملية الفهرسة في الخلفية.")
                                break
                            else:
                                status_placeholder.info(
                                    f"⏳ حالة المعالجة الحالية: **{status}**..."
                                )
                    else:
                        status_placeholder.warning(
                            "تستغرق المعالجة وقتاً أطول من المعتاد. يمكنك التحقق من الحالة لاحقاً في قائمة المستندات."
                        )
                elif res.status_code == 409:
                    st.error(
                        "⚠️ هذا الملف موجود مسبقاً في النظام (تم اكتشاف تطابق في البصمة الرقمية)."
                    )
                else:
                    st.error(f"❌ فشل الرفع: {res.status_code} - {res.text}")
            except Exception as e:
                st.error(f"حدث خطأ غير متوقع: {str(e)}")

# ------------------------------------------------------------------------------
# التبويب الثالث: لوحة إدارة المستندات (Documents Panel)
# ------------------------------------------------------------------------------
with tab_docs:
    st.markdown("#### 📁 المستندات المؤرشفة للمستأجر الحالي")

    if st.button("🔄 تحديث القائمة"):
        st.rerun()

    try:
        res = requests.get(f"{BASE_URL}/v1/documents", headers=get_headers(), timeout=10)
        if res.status_code == 200:
            docs = res.json().get("documents", [])
            if not docs:
                st.info("لا توجد مستندات مؤرشفة حالياً لهذا المستأجر.")
            else:
                for doc in docs:
                    with st.container():
                        d_col1, d_col2, d_col3, d_col4 = st.columns([3, 2, 1, 1])
                        with d_col1:
                            st.markdown(f"**📄 {doc.get('file_name', 'بدون اسم')}**")
                            st.caption(f"ID: `{doc.get('id')}`")
                        with d_col2:
                            indexed_at = doc.get("indexed_at")
                            date_str = indexed_at.split("T")[0] if indexed_at else "قيد الانتظار"
                            st.write(f"تاريخ الفهرسة: {date_str}")
                        with d_col3:
                            st.write(f"الكتل: **{doc.get('chunk_count') or 0}**")
                        with d_col4:
                            if st.button("🗑️ حذف", key=f"del_{doc.get('id')}"):
                                del_res = requests.delete(
                                    f"{BASE_URL}/v1/documents/{doc.get('id')}",
                                    headers=get_headers(),
                                    timeout=5,
                                )
                                if del_res.status_code == 200:
                                    st.success("تم الحذف بنجاح!")
                                    time.sleep(1)
                                    st.rerun()
                                else:
                                    st.error("فشل الحذف.")
                        st.divider()
        else:
            st.error(f"تعذر جلب المستندات (الرمز: {res.status_code})")
    except Exception as e:
        st.error(f"حدث خطأ أثناء تحميل المستندات: {str(e)}")

# التذييل
st.markdown("---")
st.markdown(
    """
<div style="text-align: center; color: #adb5bd; font-size: 0.85rem;">
    Production-Grade RAG System • صُمم بواجهات عصرية مخصصة لتحقيق تجربة استرجاع فائقة الدقة 🚀
</div>
""",
    unsafe_allow_html=True,
)
