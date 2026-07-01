"""
Migration: fix current confirmed template labels + add Figura image placeholders.

Fixes applied to template 4baba2be:
 1. Remove false sections (Cellebrite, Ufed)
 2. Apply canonical section labels
 3. Add Figura 02 placeholder -> Aquisição section
 4. Add Figura 03 placeholder -> Verificação de Integridade section
 5. Rebuild DOCX skeleton

Run from: services/sidecar/
  .venv/Scripts/python fix_images.py
"""
import sys, re
from pathlib import Path
from uuid import uuid4

sys.path.insert(0, str(Path(__file__).parent))

from sidecar import repo
from sidecar.generation.docx_template_builder import build_skeleton
from sidecar.models.template import ImagePlaceholderType, TemplateImagePlaceholder

CANONICAL_SECTIONS = [
    ("HIST",         "Histórico"),
    ("MATER",        "Material Recebido para Análise"),
    ("OBJET",        "Objetivo"),
    ("CONDI",        "Condições Gerais"),
    ("AQUISI",       "Aquisição e Preservação dos Dados Digitais"),
    ("LISE FORENSE", "Análise Forense dos Dados Extraídos"),
    ("VERIFICA",     "Verificação de Integridade dos Arquivos"),
    ("CONCLUS",      "Conclusão"),
]

FALSE_FRAGMENTS = ("cellebrite", "ufed", "figura")

CANONICAL_VARS = {
    "rep":      "REP nº",
    "vestigio": "Vestígio",
    "sei":      "SEI nº",
    "oficio":   "Ofício",
    "marca":    "Marca",
    "lacre":    "Lacre nº",
    "processo": "Processo",
}

confirmed = [t for t in repo.list_templates() if t.status == "confirmed"]
print(f"Found {len(confirmed)} confirmed template(s)")

for t in confirmed:
    print(f"\nProcessing template {t.id[:8]} ({t.name})")
    changed = False

    # --- 1. Remove false sections & fix labels ---
    clean = []
    for s in sorted(t.sections, key=lambda x: x.order):
        norm = (s.heading_text or s.label or "").lower()
        if any(f in norm for f in FALSE_FRAGMENTS):
            print(f"  Removing false section: {s.label!r}")
            continue
        for frag, label in CANONICAL_SECTIONS:
            if frag in (s.heading_text or s.label or "").upper():
                if s.label != label:
                    print(f"  Label fix: {s.label!r} -> {label!r}")
                    s.label = label
                    changed = True
                break
        clean.append(s)

    if len(clean) != len(t.sections):
        changed = True
    for i, s in enumerate(clean):
        s.order = i
    t.sections = clean

    # --- 2. Fix variable labels ---
    for v in t.variables:
        canon = CANONICAL_VARS.get(v.key)
        if canon and v.label != canon:
            print(f"  Var fix: {v.key}={v.label!r} -> {canon!r}")
            v.label = canon
            changed = True

    # --- 3. Remove trailing signature from Conclusão ---
    for s in t.sections:
        if s.default_text and "____" in s.default_text:
            s.default_text = s.default_text[:s.default_text.index("____")].rstrip()
            print(f"  Removed signature from {s.label!r}")
            changed = True

    # --- 4. Add image placeholders for Figura 02 and Figura 03 ---
    # Find sections that contain "Figura 02" and "Figura 03" in their text
    fig_map: dict[str, tuple[str, str]] = {}  # fig_num -> (section_id, caption)
    for s in t.sections:
        text = s.default_text or ""
        for m in re.finditer(r'Figura\s+(\d+)\s*[–\-—]\s*([^\n]+)', text):
            fig_num = m.group(1).zfill(2)
            caption = f"Figura {fig_num} – {m.group(2).strip()}"
            fig_map[fig_num] = (s.id, caption)
            print(f"  Found {caption[:60]!r} in section {s.label!r}")

    # Build set of existing placeholder labels to avoid duplication
    existing_labels = {p.label for p in t.image_placeholders}

    new_placeholders = list(t.image_placeholders)
    for fig_num, (section_id, caption) in sorted(fig_map.items()):
        if caption in existing_labels:
            print(f"  Placeholder already exists: {caption[:60]!r}")
            continue
        placeholder = TemplateImagePlaceholder(
            id=str(uuid4()),
            type=ImagePlaceholderType.CUSTOM,
            label=caption,
            order=int(fig_num),
            max_count=1,
            section_id=section_id,
        )
        new_placeholders.append(placeholder)
        print(f"  Added placeholder: {caption[:60]!r} -> section {section_id[:8]}")
        changed = True

    t.image_placeholders = sorted(new_placeholders, key=lambda p: p.order)

    if changed:
        repo.save_template(t)
        sk = build_skeleton(t, Path(t.docx_skeleton_path))
        print(f"  Saved + skeleton rebuilt: {sk.name}")
    else:
        print("  No changes needed")

print("\nDone.")
