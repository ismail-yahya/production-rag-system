import streamlit as st
import httpx
import json
import time
import pandas as pd
from datetime import datetime

# Page configuration
st.set_page_config(
    page_title="Antigravity RAG System",
    page_icon="🚀",
    layout="wide",
    initial_sidebar_state="expanded",
)

# Custom CSS for premium look
st.markdown("""
    <style>
    .main {
        background-color: #0e1117;
    }
    .stButton>button {
        width: 100%;
        border-radius: 5px;
        height: 3em;
        background-color: #ff4b4b;
        color: white;
    }
    .stTextInput>div>div>input {
        background-color: #262730;
        color: white;
    }
    .status-card {
        padding: 1.5rem;
        border-radius: 0.5rem;
        background-color: #1e1e1e;
        border: 1px solid #333;
        margin-bottom: 1rem;
    }
    .metric-label {
        color: #888;
        font-size: 0.8rem;
    }
    .metric-value {
        font-size: 1.5rem;
        font-weight: bold;
        color: #00ffcc;
    }
    </style>
    """, unsafe_allow_index=True)

# Sidebar - Configuration
st.sidebar.title("⚙️ System Config")
api_url = st.sidebar.text_input("API Base URL", value="http://localhost:8000")
tenant_id = st.sidebar.text_input("Tenant ID", value="00000000-0000-0000-0000-000000000000")
api_key = st.sidebar.text_input("API Key", type="password", value="your-secret-key")

headers = {
    "Authorization": f"Bearer {api_key}",
    "X-Tenant-ID": tenant_id
}

# Navigation
tabs = st.tabs(["🔍 Query", "📥 Ingestion", "📊 Admin"])

# --- TAB 1: Query ---
with tabs[0]:
    st.header("Semantic Search & RAG")
    
    # Mode selection
    mode = st.radio("Search Mode", ["Standard", "Streaming"], horizontal=True)
    
    # Query input
    query = st.text_input("Ask a question about your documents...", placeholder="e.g. What are the key findings in the report?")
    
    if st.button("Run Query") and query:
        with st.spinner("Retrieving knowledge and generating answer..."):
            try:
                start_time = time.time()
                
                if mode == "Standard":
                    response = httpx.post(
                        f"{api_url}/v1/query",
                        json={"question": query, "mode": "standard"},
                        headers=headers,
                        timeout=30.0
                    )
                    
                    if response.status_code == 200:
                        data = response.json()
                        latency = (time.time() - start_time) * 1000
                        
                        st.markdown(f"### 🤖 Answer")
                        st.write(data["answer"])
                        
                        col1, col2, col3 = st.columns(3)
                        col1.metric("Latency", f"{data.get('latency_ms', latency):.0f}ms")
                        col2.metric("Sources", len(data.get("sources", [])))
                        col3.metric("Model", data.get("model", "n/a"))
                        
                        if data.get("sources"):
                            with st.expander("📚 Sources"):
                                for i, source in enumerate(data["sources"]):
                                    st.markdown(f"**Source {i+1}** (Score: {source.get('score', 0):.2f})")
                                    st.info(source["content"])
                    else:
                        st.error(f"Error {response.status_code}: {response.text}")
                
                else: # Streaming
                    # Placeholder for streaming implementation
                    st.info("Streaming mode requested. Displaying response as it arrives...")
                    # Note: Simplified for the demo as Streamlit handles SSE via generator
                    response = httpx.post(
                        f"{api_url}/v1/query/stream",
                        json={"question": query, "mode": "standard"},
                        headers=headers,
                        timeout=60.0
                    )
                    # Implementation detail for streaming would go here
                    st.write("Streaming not fully implemented in this demo frontend yet, using standard fallback.")
                    
            except Exception as e:
                st.error(f"Connection failed: {str(e)}")

# --- TAB 2: Ingestion ---
with tabs[1]:
    st.header("Document Ingestion")
    
    uploaded_file = st.file_uploader("Upload a PDF or Image", type=["pdf", "png", "jpg", "jpeg"])
    
    if uploaded_file is not None:
        if st.button("🚀 Upload & Process"):
            with st.spinner("Uploading and triggering background pipeline..."):
                try:
                    files = {"file": (uploaded_file.name, uploaded_file.getvalue(), uploaded_file.type)}
                    response = httpx.post(
                        f"{api_url}/v1/ingest",
                        files=files,
                        headers=headers,
                        timeout=30.0
                    )
                    
                    if response.status_code == 202:
                        data = response.json()
                        st.success(f"File uploaded successfully! Job ID: {data['job_id']}")
                        st.json(data)
                    else:
                        st.error(f"Upload failed: {response.text}")
                except Exception as e:
                    st.error(f"Error: {str(e)}")
    
    st.divider()
    st.subheader("📋 Document Status")
    if st.button("Refresh Document List"):
        try:
            response = httpx.get(f"{api_url}/v1/documents", headers=headers)
            if response.status_code == 200:
                docs = response.json().get("documents", [])
                if docs:
                    df = pd.DataFrame(docs)
                    st.dataframe(df, use_container_width=True)
                else:
                    st.write("No documents found.")
        except Exception as e:
            st.error(f"Failed to fetch documents: {str(e)}")

# --- TAB 3: Admin ---
with tabs[2]:
    st.header("System Administration")
    
    col1, col2 = st.columns(2)
    
    with col1:
        st.subheader("📈 Performance Metrics")
        if st.button("Fetch Stats"):
            try:
                response = httpx.get(f"{api_url}/v1/admin/stats", headers=headers)
                if response.status_code == 200:
                    stats = response.json()
                    st.markdown(f"""
                    <div class="status-card">
                        <div class="metric-label">Total Documents</div>
                        <div class="metric-value">{stats['total_documents']}</div>
                        <br/>
                        <div class="metric-label">Avg Latency</div>
                        <div class="metric-value">{stats['average_latency_ms']:.2f}ms</div>
                    </div>
                    """, unsafe_allow_index=True)
            except:
                st.warning("Admin endpoints might require higher privileges.")
                
    with col2:
        st.subheader("🧪 Evaluation Control")
        if st.button("Run RAGAS Evaluation"):
            try:
                response = httpx.post(f"{api_url}/v1/admin/eval/run", headers=headers)
                if response.status_code == 202:
                    st.info("Evaluation task submitted to Celery worker.")
            except:
                st.error("Evaluation trigger failed.")

    st.divider()
    st.subheader("🏆 Latest Evaluation Results")
    try:
        response = httpx.get(f"{api_url}/v1/admin/eval/results", headers=headers)
        if response.status_code == 200:
            results = response.json()
            if results.get("results"):
                st.write(f"Evaluated at: {results['evaluated_at']}")
                # Simplified table
                st.table(results["results"])
            else:
                st.write("No evaluation data available yet.")
    except:
        st.write("Unable to fetch evaluation results.")

# Footer
st.markdown("---")
st.markdown("Built with ❤️ by the Antigravity Team")
