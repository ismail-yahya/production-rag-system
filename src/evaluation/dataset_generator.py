from typing import Any

import structlog
from ragas.testset.evolutions import multi_context, reasoning, simple
from ragas.testset.generator import TestsetGenerator

logger = structlog.get_logger(__name__)

class EvalDatasetGenerator:
    """
    Generator for creating evaluation datasets from raw documents.
    Uses RAGAS TestsetGenerator to create synthetic (Question, Context, Answer) triplets.
    """

    def __init__(
        self,
        generator_llm: Any,
        critic_llm: Any,
        embeddings: Any,
    ) -> None:
        """
        Initialize the generator.
        
        Args:
            generator_llm: LLM used to generate questions/answers.
            critic_llm: LLM used to critique and filter generated pairs.
            embeddings: Embeddings model for semantic search during generation.
        """
        self.generator = TestsetGenerator.from_langchain(
            generator_llm,
            critic_llm,
            embeddings
        )

    async def generate_from_documents(
        self,
        documents: list[Any],
        test_size: int = 10,
    ) -> Any:
        """
        Generate a synthetic evaluation dataset from a list of LangChain documents.
        
        Args:
            documents: List of LangChain Document objects.
            test_size: Number of samples to generate.
            
        Returns:
            A RAGAS TestDataset object.
        """
        logger.info("eval_dataset_generation_started", test_size=test_size, doc_count=len(documents))
        
        try:
            # RAGAS TestsetGenerator.generate_with_langchain_docs
            # distribute among different evolution types
            distributions = {
                simple: 0.5,
                reasoning: 0.25,
                multi_context: 0.25
            }
            
            testset = self.generator.generate_with_langchain_docs(
                documents,
                test_size=test_size,
                distributions=distributions
            )
            
            logger.info("eval_dataset_generation_completed", generated_count=len(testset))
            return testset
            
        except Exception as e:
            logger.error("eval_dataset_generation_failed", error=str(e))
            raise
