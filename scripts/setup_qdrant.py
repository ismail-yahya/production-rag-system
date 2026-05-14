import asyncio
from qdrant_client import AsyncQdrantClient, models
from src.core.config import settings

async def setup():
    print(f"Connecting to Qdrant at {settings.QDRANT_URL}...")
    client = AsyncQdrantClient(url=settings.QDRANT_URL)
    
    collection_name = settings.QDRANT_COLLECTION_NAME
    vector_size = settings.EMBEDDING_DIMENSION
    
    print(f"Checking if collection '{collection_name}' exists...")
    collections = await client.get_collections()
    exists = any(c.name == collection_name for c in collections.collections)
    
    if not exists:
        print(f"Creating collection '{collection_name}' with vector size {vector_size}...")
        await client.create_collection(
            collection_name=collection_name,
            vectors_config=models.VectorParams(
                size=vector_size,
                distance=models.Distance.COSINE
            )
        )
        print("Collection created successfully.")
    else:
        print(f"Collection '{collection_name}' already exists.")

if __name__ == "__main__":
    asyncio.run(setup())
