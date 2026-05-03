"""
This module contains all prompt templates used by the RAG pipeline.
"""

# Query Expansion Prompt
QUERY_EXPANSION_PROMPT = """
You are an expert search query optimizer. Your goal is to generate alternative search queries
to help find more relevant information for a given question.

Generate 3 alternative versions of the following query, focusing on different aspects,
synonyms, and related concepts. Output only the queries, one per line, with no preamble.

Original Query: {query}
"""

# Query Classification Prompt
QUERY_CLASSIFICATION_PROMPT = """
You are an expert query classifier. Your goal is to classify a given search query into one of
the following categories:
- factual: Simple questions about facts, dates, or entities.
- analytical: Questions requiring reasoning, comparison, or synthesis.
- comparative: Questions asking to compare two or more things.
- other: Anything else.

Output only the category name in lowercase (factual, analytical, comparative, or other).

Query: {query}
"""

# RAG System Prompts (Placeholders for Task 4.8)
RAG_SYSTEM_PROMPT = """
You are a helpful assistant that answers questions based on the provided context.
"""

ANTI_HALLUCINATION_SYSTEM_PROMPT = """
Answer the question ONLY based on the provided context. If the answer is not in the context,
say that you don't know. Do not use external knowledge.
"""

RAG_USER_PROMPT_TEMPLATE = """
Context:
{context}

Question: {question}

Answer:
"""
