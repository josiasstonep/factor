import re
from difflib import SequenceMatcher

from sidecar.models.generated_report import SectionDiffOp


def _tokenize(text: str) -> list[str]:
    """Split text into alternating word/whitespace tokens to preserve spacing."""
    return re.findall(r"\S+|\s+", text)


def word_diff(original: str, revised: str) -> list[SectionDiffOp]:
    orig_tokens = _tokenize(original)
    rev_tokens = _tokenize(revised)

    matcher = SequenceMatcher(None, orig_tokens, rev_tokens, autojunk=False)
    ops: list[SectionDiffOp] = []

    for tag, i1, i2, j1, j2 in matcher.get_opcodes():
        orig_chunk = "".join(orig_tokens[i1:i2])
        rev_chunk = "".join(rev_tokens[j1:j2])
        ops.append(SectionDiffOp(op=tag, original=orig_chunk, revised=rev_chunk))

    return ops
