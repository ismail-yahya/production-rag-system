from rank_bm25 import BM25Okapi


def tokenize(text: str) -> list[str]:
    return [
        word.strip(".,!?;:()[]\"'") for word in text.lower().split() if word.strip(".,!?;:()[]\"'")
    ]


query = "banana"
corpus = ["apple", "banana", "cherry", "date"]

tokenized_query = tokenize(query)
tokenized_corpus = [tokenize(doc) for doc in corpus]

bm25 = BM25Okapi(tokenized_corpus)
scores = bm25.get_scores(tokenized_query)

print(f"Scores for {query}: {scores}")
