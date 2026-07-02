# Factor — Rastreamento de Tarefas

## Status: PROJETO COMPLETO (M1–M4) ✅ + Refinamentos em andamento

---

## Sessão 2026-07-02 — Verificação e correção de qualidade ✅

### Verificado e resolvido
- [x] **DOCX paragraph order**: Figura 02 aparece imediatamente após "Análise Forense dos
  Dados Extraídos" (parágrafos [10→11→12]), Figura 03 após "Verificação de Integridade"
  ([14→15→16]). Imagens dentro das seções, não no final do documento.
- [x] **Novo upload de PDF**: parse de REP 28203 produz exatamente 8 seções canônicas sem
  Cellebrite/UFED. section_detect.py corrigido na sessão anterior funciona corretamente.
- [x] **Encoding UTF-8**: aparente Mojibake nos labels era artefato do terminal Windows
  (cp1252). Os bytes raw da API são UTF-8 correto: `c2 ba` = "º", `c3 ad` = "í".
  Browser com fetch decodifica corretamente. Nenhuma correção necessária na API.
- [x] **Labels de variáveis**: corrigidos de "111..." para labels canônicos:
  REP nº, Vestígio, SEI nº, Ofício, Marca, Lacre nº.
- [x] **Template confirmado 118af226** com estrutura final:
  1. Histórico
  2. Material Recebido para Análise
  3. Objetivo
  4. Condições Gerais
  5. Aquisição e Preservação dos Dados Digitais
  6. Análise Forense dos Dados Extraídos  [+1 img: Figura 02]
  7. Verificação de Integridade dos Arquivos  [+1 img: Figura 03]
  8. Conclusão

---

## Sessão 2026-07-01 — Imagens inline + Correção dos 8 capítulos ✅

### Imagens dentro das seções
- [x] `TemplateImagePlaceholder` ganha campo `section_id` (opcional)
- [x] `docx_template_builder.py`: imagens com `section_id` aparecem logo após o texto da seção
- [x] `BatchForm.tsx`: `ImageZone` renderiza dentro de cada seção
- [x] Template confirmado com Figura 02 e Figura 03 linkadas às suas seções

### Correção da detecção de seções (`section_detect.py`)
- [x] `IGNORED_HEADING_FRAGMENTS`: cellebrite, ufed, physical analyzer, inseyets, ufdr
- [x] Labels únicos por seção usando heading text real com `title_case_label()`
- [x] Prefixo numérico ("3. ", "4. ") removido automaticamente
- [x] `title_case_label()`: preposições portuguesas em minúsculo
- [x] `rebuild_ti_template.py`: script robusto para re-confirmar templates T.I.

---

## Sessão 2026-07-02 (tarde) — Formatação DOCX ✅

### Concluído
- [x] **Block quotes**: `_postprocess_paragraphs()` detecta parágrafos que abrem com `"` e
  aplica `left_indent=5cm`, `italic=True`, alinhamento justificado
- [x] **Mojibake CP1252**: `_sanitize_text()` corrige sequências `â€œ` → `"`, lone surrogate
  U+DC9D → `"`, remove soft hyphens
- [x] **Margens A4**: left=2cm, right=2cm, top=2.8cm, header_distance=0.43cm
- [x] **Cabeçalho/rodapé largura total**: imagem renderizada em 210mm com indent -2cm
  (compensa margem esquerda), ocupa toda a largura da página
- [x] **Caption figuras**: Arial 11pt (era 10pt)
- [x] **Scripts fix_*.py**: adicionados ao .gitignore

---

## Pendente — Próxima sessão ⏳

- [ ] **Reiniciar app + re-confirmar template**: para carregar o novo código do cabeçalho
  full-width; fechar Factor, reabrir, abrir TemplateStructureEditor, clicar Confirmar
- [ ] **Upload de imagem inline (Figura 01)**: usuário quer adicionar foto do vestígio
  no formulário — testar o fluxo de upload de imagem dentro da seção "Material Recebido"
  e verificar que aparece no DOCX na posição certa
- [ ] **Limpar drafts obsoletos**: 5 drafts antigos na DB (REP 28203, test_laudo etc.)
  — apagar ou deixar acumular conforme preferência do usuário

---

## M4 — Multi-templates + Packaging ✅

- [x] `build_sidecar.spec` — spec PyInstaller --onedir
- [x] `electron-builder.yml` — NSIS Windows (x64)
- [x] `sidecar.ts` — FACTOR_DATA_DIR aponta para userData/factor-data
- [x] `main.ts` — em modo packaged usa process.resourcesPath
- [x] Testado: sidecar.exe → health OK + 5 providers AI

---

## Concluído em sessões anteriores

### M3 — Melhoria com IA + diff ✅
- [x] `ai_providers/` — Ollama, Claude, OpenAI, Groq, Gemini
- [x] `diffing/word_diff.py` + `routers/ai.py`
- [x] `AiImprove.tsx`, `DiffView.tsx`, `GenerationReview.tsx`

### M2 — Batch multi-row ✅
- [x] `BatchForm.tsx` — N laudos com tabs, add/remove caso
- [x] ZIP export com row_label como arcname

### M1 — Fluxo base ✅
- [x] Monorepo Electron + React + FastAPI
- [x] Parsing PDF, geração DOCX, SQLite, endpoints

### Refinamentos de qualidade ✅
- [x] DOCX: Arial 12pt, espaçamento 1.5, margens A4
- [x] Extração cabeçalho/rodapé do PDF
- [x] `normalize_paragraphs_from_pdf()`: posição X para detectar parágrafos

---

## Melhorias Futuras

- DOCX customizado do usuário como esqueleto alternativo
- Histórico de batches por template
- Gestão de chaves API via Electron safeStorage
- Modo offline completo com Ollama
