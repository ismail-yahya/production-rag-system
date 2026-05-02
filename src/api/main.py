from fastapi import FastAPI

app = FastAPI(title="RAG System API")


@app.get("/health")
async def health_check():
    return {"status": "healthy"}
