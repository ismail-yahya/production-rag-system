import asyncio
import io
import sys

from qdrant_client import QdrantClient
from qdrant_client.http import models as qmodels
from sqlalchemy import select
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

from src.core.config import settings
from src.core.models import Document

# Force UTF-8 output
if isinstance(sys.stdout, io.TextIOWrapper):
    sys.stdout.reconfigure(encoding='utf-8')


async def main() -> None:
    # Connect to Qdrant (using localhost from the host machine)
    qdrant_url = settings.QDRANT_URL.replace("http://qdrant:", "http://localhost:")
    print("Qdrant URL:", qdrant_url)
    qclient = QdrantClient(url=qdrant_url)
    
    # Connect to PostgreSQL (using localhost)
    dsn_str = settings.POSTGRES_DSN.get_secret_value()
    dsn = dsn_str.replace("@postgres:", "@localhost:")
    engine = create_async_engine(dsn)
    async_session = async_sessionmaker(engine, expire_on_commit=False)
    
    # Get all documents
    async with async_session() as session:
        result = await session.execute(select(Document))
        docs = result.scalars().all()
        print(f"Loaded {len(docs)} documents from database.")
        
        updates_count = 0
        for doc in docs:
            doc_id_str = str(doc.id)
            try:
                # Query Qdrant for the count of points with this document_id
                count_res = qclient.count(
                    collection_name=settings.QDRANT_COLLECTION_NAME,
                    count_filter=qmodels.Filter(
                        must=[
                            qmodels.FieldCondition(
                                key="document_id",
                                match=qmodels.MatchValue(value=doc_id_str)
                            )
                        ]
                    )
                )
                qdrant_chunks = count_res.count
                
                # Update if different or None
                if doc.chunk_count != qdrant_chunks:
                    print(f"Syncing document {doc.file_name} ({doc.id}): DB chunk_count={doc.chunk_count} -> Qdrant chunks={qdrant_chunks}")
                    doc.chunk_count = qdrant_chunks
                    updates_count += 1
            except Exception as e:
                print(f"Error querying Qdrant for document {doc.file_name} ({doc.id}): {e}")
                
        if updates_count > 0:
            await session.commit()
            print(f"Successfully updated chunk_count for {updates_count} documents in PostgreSQL.")
        else:
            print("All documents are already in sync.")

if __name__ == "__main__":
    asyncio.run(main())
