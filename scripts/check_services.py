import asyncio
from src.core.database import engine
from src.vectorstore.factory import VectorStoreFactory
from src.core.config import settings

async def check():
    print("Checking Database...")
    try:
        async with engine.connect() as conn:
            print("Database: OK")
    except Exception as e:
        print(f"Database: FAIL - {e}")

    print("\nChecking Vector Store...")
    try:
        vs = VectorStoreFactory.create(settings.VECTOR_STORE_PROVIDER, settings)
        if await vs.is_healthy():
            print("Vector Store: OK")
        else:
            print("Vector Store: FAIL (is_healthy returned False)")
    except Exception as e:
        print(f"Vector Store: FAIL - {e}")

if __name__ == "__main__":
    asyncio.run(check())
