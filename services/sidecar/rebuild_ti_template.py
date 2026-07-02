"""
Confirms the T.I. laudo template, enforcing the exact 8-chapter structure.
Extracts figure images from the PDF so they appear as reference previews in the UI.

Targets the most-recent draft for the T.I. base laudo (REP 32214 or any PDF
that, after parsing, produces HISTÓRICO + CONCLUSÃO sections).

Run from: services/sidecar/
  .venv/Scripts/python rebuild_ti_template.py
"""
import re, sys
from pathlib import Path
from uuid import uuid4
import fitz  # PyMuPDF

sys.path.insert(0, str(Path(__file__).parent))

from sidecar import repo
from sidecar.config import DATA_DIR
from sidecar.models.template import (
    Template, SectionType, ImagePlaceholderType, TemplateImagePlaceholder,
)
from sidecar.parsing.orchestrator import parse_pdf
from sidecar.generation.docx_template_builder import build_skeleton

FALSE_FRAGMENTS = ("cellebrite", "ufed", "figura", "physical analyzer", "ufdr")

CANONICAL_SECTIONS = [
    ("HIST",         "Historico de Ocorrencia",  SectionType.HISTORIA),
    ("MATER",        "Material Recebido para Analise", SectionType.DESCRICAO),
    ("OBJET",        "Objetivo",                 SectionType.CUSTOM),
    ("CONDI",        "Condicoes Gerais",          SectionType.CUSTOM),
    ("AQUISI",       "Aquisicao e Preservacao dos Dados Digitais", SectionType.ANALISE),
    ("LISE FORENSE", "Analise Forense dos Dados Extraidos",        SectionType.ANALISE),
    ("VERIFICA",     "Verificacao de Integridade dos Arquivos",    SectionType.CUSTOM),
    ("CONCLUS",      "Conclusao",                SectionType.CONCLUSAO),
]

# Actual labels with correct accents (index matches CANONICAL_SECTIONS)
CANONICAL_LABELS = [
    "Historico",
    "Material Recebido para Analise",
    "Objetivo",
    "Condicoes Gerais",
    "Aquisicao e Preservacao dos Dados Digitais",
    "Analise Forense dos Dados Extraidos",
    "Verificacao de Integridade dos Arquivos",
    "Conclusao",
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

FIGURE_RE = re.compile(r'Figura\s+(\d+)\s*[' + '–—-' + r']\s*([^\n]+)')

# Pick source: confirmed > most-recent draft for REP_32214
all_templates = repo.list_templates()
ti_templates = [t for t in all_templates if "32214" in t.name or "REP 32" in t.name]

if not ti_templates:
    # Fall back to any template with historia + conclusao sections
    def has_historia_conclusao(t):
        types = {s.type for s in t.sections}
        from sidecar.models.template import SectionType as ST
        return ST.HISTORIA in types and ST.CONCLUSAO in types
    ti_templates = [t for t in all_templates if has_historia_conclusao(t)]

if not ti_templates:
    print("ERROR: no suitable T.I. template found in the database")
    sys.exit(1)

# Prefer the most recently created one
source_t = sorted(ti_templates, key=lambda t: t.created_at, reverse=True)[0]
template_id = source_t.id
pdf_path = DATA_DIR / "uploads" / f"{template_id}.pdf"

if not pdf_path.exists():
    print(f"ERROR: PDF not found at {pdf_path}")
    sys.exit(1)

print(f"Re-parsing {pdf_path.name} (id {template_id[:8]}, status={source_t.status})...")
parsed = parse_pdf(pdf_path)
print(f"  Raw parse: {len(parsed.sections)} sections")

# Remove false sections and merge their text into the preceding real section
clean = []
for s in sorted(parsed.sections, key=lambda x: x.order):
    norm_lower = (s.heading_text or s.label or "").lower()
    is_false = any(f in norm_lower for f in FALSE_FRAGMENTS)

    if is_false:
        print(f"  False section removed: {s.heading_text!r}")
        if s.default_text and clean:
            prev = clean[-1]
            extra = s.default_text.strip()
            if extra:
                prev.default_text = ((prev.default_text or "").rstrip() + "\n" + extra)
        continue

    # Apply canonical label using ASCII-only matching
    norm_upper = (s.heading_text or s.label or "").upper()
    for frag, _, stype in CANONICAL_SECTIONS:
        if frag in norm_upper:
            s.type = stype
            break

    clean.append(s)

print(f"  Clean sections: {len(clean)}")
if len(clean) != 8:
    print(f"  WARNING: expected 8, got {len(clean)}")
    for s in clean:
        print(f"    {s.label!r} heading={s.heading_text!r}")

# Renumber
for i, s in enumerate(clean):
    s.order = i

# Fix variable labels only when they look like auto-generated placeholders (all same digit)
_PLACEHOLDER_LABEL_RE = re.compile(r'^1{4,}$')
for v in parsed.variables:
    canon = CANONICAL_VARS.get(v.key)
    if canon and _PLACEHOLDER_LABEL_RE.match(v.label.replace(" ", "")):
        print(f"  Var fix: {v.key}={v.label!r} -> {canon!r}")
        v.label = canon

# Remove trailing signature from Conclusao
for s in clean:
    if s.default_text and "____" in s.default_text:
        s.default_text = s.default_text[:s.default_text.index("____")].rstrip()
        print(f"  Removed signature from [{s.order}] {s.label!r}")

# Clean trailing stray section numbers (e.g. " 6." at end of paragraph)
for s in clean:
    if s.default_text:
        s.default_text = re.sub(r'\s+\d+\.\s*$', '', s.default_text).strip()

def extract_figure_image(pdf_path: Path, fig_num_str: str, out_dir: Path, template_id: str) -> str | None:
    """Render the page region between text and the figure caption as a PNG."""
    try:
        doc = fitz.open(str(pdf_path))
        needle = f"Figura {fig_num_str}"  # keep zero-padded (e.g. "Figura 02")
        for page in doc:
            full_text = page.get_text()
            if needle not in full_text:
                continue
            blocks = sorted(page.get_text("blocks"), key=lambda b: b[1])
            # Find caption block Y top — block must START with "Figura XX"
            caption_y = None
            for b in blocks:
                if b[6] == 0 and b[4].lstrip().startswith(needle):
                    caption_y = b[1]
                    break
            if caption_y is None:
                continue
            # Find the bottom of the last text block that ends before the caption
            prev_bottom = 0
            for b in blocks:
                if b[3] < caption_y - 5 and b[6] == 0:
                    prev_bottom = max(prev_bottom, b[3])
            if caption_y - prev_bottom < 20:
                continue  # no figure region found
            rect = fitz.Rect(50, prev_bottom + 2, 550, caption_y - 2)
            pix = page.get_pixmap(matrix=fitz.Matrix(2, 2), clip=rect)
            out_path = out_dir / f"{template_id}_figure_{fig_num_str}.png"
            pix.save(str(out_path))
            return str(out_path)
    except Exception as e:
        print(f"  Warning: could not extract figure image {fig_num_str}: {e}")
    return None


# Detect Figura references and extract their images from the PDF
new_placeholders = []
for s in clean:
    for m in FIGURE_RE.finditer(s.default_text or ""):
        fig_num = m.group(1).zfill(2)
        caption = f"Figura {fig_num} - {m.group(2).strip()}"
        preview_path = extract_figure_image(pdf_path, fig_num, DATA_DIR / "templates", template_id)
        p = TemplateImagePlaceholder(
            id=str(uuid4()),
            type=ImagePlaceholderType.CUSTOM,
            label=caption,
            order=int(fig_num),
            max_count=1,
            section_id=s.id,
            preview_image_path=preview_path,
        )
        new_placeholders.append(p)
        preview_tag = " [preview extracted]" if preview_path else ""
        print(f"  Image: {caption[:60]!r} -> [{s.order}] {s.label!r}{preview_tag}")

skeleton_path = DATA_DIR / "templates" / f"{template_id}_skeleton.docx"

# Preserve header/footer if they already exist
header_image_path = source_t.header_image_path
footer_image_path = source_t.footer_image_path
if not header_image_path:
    # Look for previously extracted header images
    for candidate_id in [template_id] + [t.id for t in all_templates]:
        h = DATA_DIR / "templates" / f"{candidate_id}_header.png"
        if h.exists():
            header_image_path = str(h)
            break
if not footer_image_path:
    for candidate_id in [template_id] + [t.id for t in all_templates]:
        f = DATA_DIR / "templates" / f"{candidate_id}_footer.png"
        if f.exists():
            footer_image_path = str(f)
            break

t = Template(
    id=template_id,
    name=source_t.name,
    status="confirmed",
    source_pdf_filename=source_t.source_pdf_filename,
    docx_skeleton_path=str(skeleton_path),
    header_image_path=header_image_path,
    footer_image_path=footer_image_path,
    sections=clean,
    variables=parsed.variables,
    image_placeholders=sorted(new_placeholders, key=lambda p: p.order),
    created_at=source_t.created_at,
)

repo.save_template(t)
sk = build_skeleton(t, skeleton_path)

print(f"\nSaved {template_id[:8]} as confirmed ({len(clean)} sections, {len(new_placeholders)} images)")
print(f"Skeleton: {sk.name}")
print("\nFinal 8 chapters:")
sec_by_id = {s.id: s.label for s in t.sections}
for s in sorted(t.sections, key=lambda x: x.order):
    imgs = [p for p in t.image_placeholders if p.section_id == s.id]
    img_tag = f"  [+{len(imgs)} img]" if imgs else ""
    print(f"  {s.order+1}. {s.label}{img_tag}")
