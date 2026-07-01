import re
import unicodedata

LABEL_VALUE_RE = re.compile(r"^([A-ZÀ-Ú][^:]{0,40}):\s*(.*)$")


def strip_accents(text: str) -> str:
    normalized = unicodedata.normalize("NFKD", text)
    return "".join(c for c in normalized if not unicodedata.combining(c))


def normalize_for_match(text: str) -> str:
    return strip_accents(text).lower().strip()


def slugify(text: str) -> str:
    ascii_text = strip_accents(text).lower()
    ascii_text = re.sub(r"[^a-z0-9]+", "_", ascii_text).strip("_")
    return ascii_text or "campo"


_PT_LOWERCASE = frozenset([
    "a", "e", "o", "de", "da", "do", "das", "dos", "em", "na", "no",
    "nas", "nos", "ao", "aos", "para", "por", "com",
])


def title_case_label(text: str) -> str:
    words = text.strip().split()
    result = []
    for i, w in enumerate(words):
        lower = w.lower()
        # Prepositions/articles stay lowercase unless they are the first word
        result.append(w.capitalize() if (i == 0 or lower not in _PT_LOWERCASE) else lower)
    return " ".join(result)
