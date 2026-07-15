import io
import sys

from qdrant_client import QdrantClient

# Force UTF-8 output
if isinstance(sys.stdout, io.TextIOWrapper):
    sys.stdout.reconfigure(encoding='utf-8')


def main() -> None:
    qclient = QdrantClient(url="http://localhost:6333")
    try:
        collections = qclient.get_collections()
        print("Collections:", [c.name for c in collections.collections])
        
        collection_name = "rag_chunks"
        info = qclient.get_collection(collection_name)
        print(f"Collection '{collection_name}' stats:")
        print(f"  Points count: {info.points_count}")
        print(f"  Indexed vectors count: {info.indexed_vectors_count}")
        
        # Scroll some points to inspect their payloads
        points, _ = qclient.scroll(
            collection_name=collection_name,
            limit=10,
            with_payload=True,
            with_vectors=False
        )
        print(f"Sample points fetched: {len(points)}")
        doc_ids = set()
        for p in points:
            payload = p.payload or {}
            doc_id = payload.get("document_id")
            tenant_id = payload.get("tenant_id")
            doc_ids.add(doc_id)
            print(f"  - Point ID: {p.id}, Document ID: {doc_id}, Tenant ID: {tenant_id}")
            
        print("Unique Document IDs in sample:", doc_ids)
    except Exception as e:
        print("Error checking Qdrant:", e)

if __name__ == "__main__":
    main()
