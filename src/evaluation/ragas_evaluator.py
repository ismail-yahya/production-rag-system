from typing import Any

import structlog
from datasets import Dataset
from ragas import evaluate
from ragas.metrics import (
    answer_relevancy,
    context_precision,
    context_recall,
    faithfulness,
)

logger = structlog.get_logger(__name__)


class RagasEvaluator:
    """
    Wrapper for RAGAS evaluation library.
    Measures retrieval and generation quality using LLM-as-a-judge metrics.
    """

    def __init__(
        self,
        llm: Any,  # LangChain compatible LLM
        embeddings: Any,  # LangChain compatible Embeddings
    ) -> None:
        """
        Initialize the evaluator with LLM and Embeddings providers.

        Args:
            llm: LLM provider (must be compatible with RAGAS, typically LangChain based).
            embeddings: Embeddings provider (LangChain compatible).
        """
        self.llm = llm
        self.embeddings = embeddings
        self.metrics = [
            faithfulness,
            answer_relevancy,
            context_precision,
            context_recall,
        ]

    async def evaluate_rag(
        self,
        questions: list[str],
        answers: list[str],
        contexts: list[list[str]],
        ground_truths: list[str] | None = None,
    ) -> dict[str, float]:
        """
        Run RAGAS evaluation on a set of results.

        Args:
            questions: List of user questions.
            answers: List of generated answers.
            contexts: List of lists of retrieved context strings.
            ground_truths: Optional list of reference answers.

        Returns:
            Dictionary of metric scores.
        """
        data = {
            "question": questions,
            "answer": answers,
            "contexts": contexts,
        }

        if ground_truths:
            data["ground_truth"] = ground_truths

        dataset = Dataset.from_dict(data)

        logger.info(
            "ragas_evaluation_started",
            sample_count=len(questions),
            metrics=[m.name for m in self.metrics],
        )

        try:
            # RAGAS 0.4.x requires explicit wrapping for LangChain components
            # and the evaluate call is async.
            from ragas.embeddings import LangchainEmbeddingsWrapper
            from ragas.llms import LangchainLLMWrapper

            ragas_llm = LangchainLLMWrapper(self.llm)
            ragas_embeddings = LangchainEmbeddingsWrapper(self.embeddings)

            result = await evaluate(  # type: ignore[misc]
                dataset=dataset,
                metrics=self.metrics,
                llm=ragas_llm,
                embeddings=ragas_embeddings,
            )

            scores = result.scores
            # Convert to dict for easier consumption
            final_scores = {k: float(v) for k, v in scores.items()}

            logger.info("ragas_evaluation_completed", scores=final_scores)
            return final_scores

        except Exception as e:
            logger.error("ragas_evaluation_failed", error=str(e))
            raise
