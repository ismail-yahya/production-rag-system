import pytest
from src.ingestion.processors.cleaner import TextCleaner


def test_cleaner_empty_and_none_text():
    # Arrange
    cleaner = TextCleaner()

    # Act
    cleaned_empty = cleaner.clean("")
    cleaned_none = cleaner.clean(None)

    # Assert
    assert cleaned_empty == ""
    assert cleaned_none == ""


def test_cleaner_unicode_normalization():
    # Arrange
    cleaner = TextCleaner()
    # "café" with combining acute accent vs precomposed
    raw_text = "cafe\u0301"

    # Act
    cleaned_text = cleaner.clean(raw_text)

    # Assert
    assert cleaned_text == "café"  # NFKC normalized composition


def test_cleaner_remove_control_characters():
    # Arrange
    cleaner = TextCleaner()
    # \x00 is a null control character, \x07 is bell control character
    raw_text = "Hello\x00 World!\x07 \nTab\tseparated."

    # Act
    cleaned_text = cleaner.clean(raw_text)

    # Assert
    assert cleaned_text == "Hello World! \nTab separated."


def test_cleaner_whitespace_normalization():
    # Arrange
    cleaner = TextCleaner()
    raw_text = "Too   many   spaces.  \t  And newlines.\n\n\n\n\nPreserve paragraph."

    # Act
    cleaned_text = cleaner.clean(raw_text)

    # Assert
    assert cleaned_text == "Too many spaces. And newlines.\n\nPreserve paragraph."


def test_cleaner_strip_boundaries():
    # Arrange
    cleaner = TextCleaner()
    raw_text = "   \n\n  Clean boundaries  \n\n   "

    # Act
    cleaned_text = cleaner.clean(raw_text)

    # Assert
    assert cleaned_text == "Clean boundaries"


def test_cleaner_callable():
    # Arrange
    cleaner = TextCleaner()
    raw_text = "  Hello   World  "

    # Act
    cleaned_text = cleaner(raw_text)

    # Assert
    assert cleaned_text == "Hello World"
