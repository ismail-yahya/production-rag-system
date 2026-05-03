import structlog
from rank_bm25 import BM25Okapi
from src.vectorstore.base import Document

logger = structlog.get_logger(__name__)


class BM25Retriever:
    """Retriever that scores a set of documents using the BM25 algorithm.

    This implementation runs BM25 over a provided list of candidate documents
    (typically retrieved from a vector store) to provide keyword-based scoring.
    It satisfies the requirement of being a lightweight keyword signal over
    in-memory candidates.
    """

    def __init__(self) -> None:
        """Initialize the BM25Retriever."""
        pass

    async def retrieve(
        self,
        query: str,
        candidates: list[Document],
    ) -> list[Document]:
        """
        Rank candidate documents using BM25 scoring.

        Args:
            query: The natural language query string.
            candidates: A list of Document objects to be re-ranked.

        Returns:
            A new list of Document objects sorted by BM25 score descending.
            Each document's score attribute is updated with its BM25 score.
        """
        if not candidates:
            return []

        # Improved tokenization: lowercase, split, and strip punctuation
        def tokenize(text: str) -> list[str]:
            return [word.strip(".,!?;:()[]\"'") for word in text.lower().split() if word.strip(".,!?;:()[]\"'")]

        tokenized_query = tokenize(query)
        tokenized_corpus = [tokenize(doc.content) for doc in candidates]

        try:
            bm25 = BM25Okapi(tokenized_corpus)
            scores = bm25.get_scores(tokenized_query)

            # Create new document instances to avoid side effects on input candidates
            ranked_docs = []
            for doc, score in zip(candidates, scores, strict=True):
                ranked_docs.append(
                    Document(
                        id=doc.id,
                        content=doc.content,
                        metadata=doc.metadata.copy(),
                        embedding=doc.embedding,
                        score=float(score),
                    )
                )

            # Sort by BM25 score descending
            ranked_docs.sort(key=lambda x: x.score or 0.0, reverse=True)

            logger.debug(
                "bm25_ranking_completed",
                candidate_count=len(candidates),
                top_score=ranked_docs[0].score if ranked_docs else 0.0,
            )
            return ranked_docs

        except Exception as e:
            logger.error("bm25_ranking_failed", error=str(e))
            # Fallback: return original candidates if BM25 fails
            return candidates
