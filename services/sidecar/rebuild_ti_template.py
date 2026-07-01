"""
Re-builds the confirmed T.I. laudo template from the original PDF,
enforcing the exact 8-chapter structure with proper text merging.

The PDF parser often detects "Cellebrite" and "UFED" as headings because
those words appear in bold/larger font inline.  This script:
  1. Parses the PDF fresh
  2. Removes false headings (cellebrite, ufed, figura)
     and MERGES their body text into the preceding real section
  3. Applies the canonical 8-chapter labels
  4. Adds Figura placeholders with section_id
  5. Fixes variable labels
  6. Rebuilds the DOCX skeleton

Run from: services/sidecar/
  .venv/Scripts/python rebuild_ti_template.py
"""
import re, sys
from pathlib import Path
from datetime import datetime, timezone
from uuid import uuid4

sys.path.insert(0, str(Path(__file__).parent))

from sidecar import repo
from sidecar.config import DATA_DIR
from sidecar.models.template import (
    Template, SectionType, ImagePlaceholderType, TemplateImagePlaceholder,
)
from sidecar.parsing.orchestrator import parse_pdf
from sidecar.generation.docx_template_builder import build_skeleton

# ── Config ─────────────────────────────────────────────────────────────────
# Fragments that mark a FALSE section heading (case-insensitive, anywhere in label)
FALSE_FRAGMENTS = ("cellebrite", "ufed", "figura")

# Maps a substring of the heading text (uppercase) → canonical label + SectionType
CANONICAL_SECTIONS = [
    ("HIST",         "Histórico",                                   SectionType.HISTORIA),
    ("MATER",        "Material Recebido para Análise",              SectionType.DESCRICAO),
    ("OBJET",        "Objetivo",                                    SectionType.CUSTOM),
    ("CONDI",        "Condições Gerais",                            SectionType.CUSTOM),
    ("AQUISI",       "Aquisição e Preservação dos Dados Digitais",  SectionType.ANALISE),
    ("LISE FORENSE", "Análise Forense dos Dados Extraídos",         SectionType.ANALISE),
    ("VERIFICA",     "Verificação de Integridade dos Arquivos",     SectionType.CUSTOM),
    ("CONCLUS",      "Conclusão",                                   SectionType.CONCLUSAO),
]

CANONICAL_VARS = {
    "rep":      "REP nº",
    "vestigio": "Vestígio",
    "sei":      "SEI nº",
    "oficio":   "Ofício",
    "marca":    "Marca",
    "lacre":    "Lacre nº",
    "processo": "Processo",
}

FIGURE_RE = re.compile(r'Figura\s+(\d+)\s*[–\-—]\s*([^\n]+)')

# ── Find confirmed template ─────────────────────────────────────────────────
confirmed = [t for t in repo.list_templates() if t.status == "confirmed"]
assert confirmed, "No confirmed template found"
existing = confirmed[0]
template_id = existing.id
pdf_path = DATA_DIR / "uploads" / f"{template_id}.pdf"
assert pdf_path.exists(), f"PDF not found: {pdf_path}"

print(f"Re-parsing {pdf_path.name} (template {template_id[:8]})…")
parsed = parse_pdf(pdf_path)
print(f"  Raw parse: {len(parsed.sections)} sections")

# ── Merge false sections & apply canonical labels ───────────────────────────
clean: list = []
for s in sorted(parsed.sections, key=lambda x: x.order):
    norm_lower = (s.heading_text or s.label or "").lower()
    is_false = any(f in norm_lower for f in FALSE_FRAGMENTS)

    if is_false:
        print(f"  False section: {s.heading_text!r} — merging text into previous")
        if s.default_text and clean:
            prev = clean[-1]
            extra = s.default_text.strip()
            if extra:
                prev.default_text = ((prev.default_text or "").rstrip() + "\n" + extra)
        continue

    # Apply canonical label
    norm_upper = (s.heading_text or s.label or "").upper()
    for frag, label, stype in CANONICAL_SECTIONS:
        if frag in norm_upper:
            old = s.label
            s.label = label
            s.type = stype
            if old != label:
                print(f"  Label: {old!r} -> {label!r}")
            break
    else:
        print(f"  No canonical match: {s.heading_text!r} (keeping {s.label!r})")

    clean.append(s)

print(f"  Clean sections: {len(clean)}")

# ── Warn / error if we don't have exactly 8 ────────────────────────────────
if len(clean) != 8:
    print(f"  WARNING: expected 8, got {len(clean)}")
    for i, s in enumerate(clean):
        print(f"    [{i}] {s.label!r}")

# Re-number
for i, s in enumerate(clean):
    s.order = i

# ── Fix variable labels ─────────────────────────────────────────────────────
for v in parsed.variables:
    canon = CANONICAL_VARS.get(v.key)
    if canon and v.label != canon:
        print(f"  Var: {v.key}={v.label!r} -> {canon!r}")
        v.label = canon

# ── Remove trailing signature from Conclusão ────────────────────────────────
for s in clean:
    if s.default_text and "____" in s.default_text:
        s.default_text = s.default_text[:s.default_text.index("____")].rstrip()
        print(f"  Removed signature from {s.label!r}")

# ── Detect Figura references → image placeholders ───────────────────────────
new_placeholders: list[TemplateImagePlaceholder] = []
for s in clean:
    for m in FIGURE_RE.finditer(s.default_text or ""):
        fig_num = m.group(1).zfill(2)
        caption = f"Figura {fig_num} – {m.group(2).strip()}"
        p = TemplateImagePlaceholder(
            id=str(uuid4()),
            type=ImagePlaceholderType.CUSTOM,
            label=caption,
            order=int(fig_num),
            max_count=1,
            section_id=s.id,
        )
        new_placeholders.append(p)
        print(f"  Image: {caption[:60]!r} -> {s.label!r}")

# ── Build skeleton path ────────────────────────────────────────────────────
skeleton_path = DATA_DIR / "templates" / f"{template_id}_skeleton.docx"

# ── Preserve header/footer from existing template ─────────────────────────
header_image_path = existing.header_image_path
footer_image_path = existing.footer_image_path

# ── Assemble Template ──────────────────────────────────────────────────────
t = Template(
    id=template_id,
    name=existing.name,
    status="confirmed",
    source_pdf_filename=existing.source_pdf_filename,
    docx_skeleton_path=str(skeleton_path),
    header_image_path=header_image_path,
    footer_image_path=footer_image_path,
    sections=clean,
    variables=parsed.variables,
    image_placeholders=sorted(new_placeholders, key=lambda p: p.order),
    created_at=existing.created_at,
)

repo.save_template(t)
sk = build_skeleton(t, skeleton_path)
print(f"\nSaved {template_id[:8]} with {len(clean)} sections and {len(new_placeholders)} images")
print(f"Skeleton: {sk.name}")
print("\nFinal structure:")
sec_by_id = {s.id: s.label for s in t.sections}
for s in t.sections:
    imgs = [p for p in t.image_placeholders if p.section_id == s.id]
    img_tag = f"  [+{len(imgs)} img]" if imgs else ""
    print(f"  {s.order+1}. {s.label}{img_tag}")
