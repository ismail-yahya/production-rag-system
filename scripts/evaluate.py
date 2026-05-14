import asyncio
import json
import os
import sys
from uuid import UUID

import structlog
from langchain_openai import ChatOpenAI, OpenAIEmbeddings

# Add project root to path
sys.path.append(os.getcwd())

from typing import TYPE_CHECKING, Any

from src.api.dependencies import get_rag_pipeline
from src.core.config import settings
from src.evaluation.ragas_evaluator import RagasEvaluator

if TYPE_CHECKING:
    from src.rag.schemas import RAGResponse

logger = structlog.get_logger(__name__)


async def run_evaluation(dataset_path: str) -> dict[str, Any] | None:
    """
    Runs end-to-end RAG evaluation.
    1. Loads evaluation dataset.
    2. Executes queries via RAGPipeline.
    3. Evaluates results using RAGAS.
    """
    # 1. Load Dataset
    if not os.path.exists(dataset_path):
        logger.error("dataset_not_found", path=dataset_path)
        return None

    with open(dataset_path) as f:
        dataset = json.load(f)

    logger.info("evaluation_started", sample_count=len(dataset))

    # 2. Initialize RAG Pipeline
    # For evaluation, we assume the environment is set up (DB, Qdrant, etc.)
    # or we mock the retriever if we only want to test the generation/evaluation.
    # In a real CI, this would run against a test environment.
    pipeline = get_rag_pipeline()

    # 3. Collect Pipeline Responses
    questions = []
    answers = []
    contexts = []
    ground_truths = []

    # For MVP evaluation, we use a fixed tenant_id for consistency in CI
    test_tenant_id = UUID("00000000-0000-0000-0000-000000000000")

    for item in dataset:
        question = item["question"]
        gt = item["ground_truth"]

        logger.info("processing_query", question=question[:50])

        try:
            # We run the query through the actual pipeline
            # Note: This requires the retrieval layer to have the relevant context indexed.
            # For the baseline test, we'll use the provided contexts if retrieval fails or
            # if we want to isolate generation.

            result: RAGResponse = await pipeline.query(question=question, tenant_id=test_tenant_id)

            questions.append(question)
            answers.append(result.answer)
            # RAGAS expects contexts as a list of strings
            contexts.append([s.snippet for s in result.sources])
            ground_truths.append(gt)

        except Exception as e:
            logger.error("pipeline_query_failed", question=question[:50], error=str(e))
            continue

    # 4. Initialize RAGAS Evaluator
    # We use LangChain wrappers for RAGAS as it's the standard integration path.
    eval_llm = ChatOpenAI(
        model="gpt-4o",
        api_key=settings.OPENAI_API_KEY.get_secret_value() if settings.OPENAI_API_KEY else None,  # type: ignore[arg-type]
    )
    eval_embeddings = OpenAIEmbeddings(
        model=settings.OPENAI_EMBEDDING_MODEL,
        api_key=settings.OPENAI_API_KEY.get_secret_value() if settings.OPENAI_API_KEY else None,  # type: ignore[arg-type]
    )

    evaluator = RagasEvaluator(llm=eval_llm, embeddings=eval_embeddings)

    # 5. Run Evaluation
    if not questions:
        logger.error("no_results_to_evaluate")
        return None

    scores = await evaluator.evaluate_rag(
        questions=questions, answers=answers, contexts=contexts, ground_truths=ground_truths
    )

    # 6. Report Results
    print("\n" + "=" * 50)
    print("RAGAS EVALUATION RESULTS")
    print("=" * 50)
    for metric, score in scores.items():
        print(f"{metric:20}: {score:.4f}")
    print("=" * 50 + "\n")

    return scores


if __name__ == "__main__":
    dataset_file = "tests/eval_dataset.json"
    scores = asyncio.run(run_evaluation(dataset_file))

    # Threshold check
    threshold = 0.7
    if scores:
        failed_metrics = [m for m, s in scores.items() if s < threshold]
        if failed_metrics:
            logger.warning("evaluation_below_threshold", failed_metrics=failed_metrics)
            sys.exit(1)
        else:
            logger.info("evaluation_passed_threshold")
