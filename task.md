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

## Pendente — Próxima sessão ⏳

- [ ] **Testar no app real (browser)**: abrir o formulário, preencher variáveis (Vestígio,
  Lacre nº etc.) e verificar que os labels aparecem corretos na UI (confirmar que UTF-8
  está ok no browser)
- [ ] **Upload de imagem inline**: testar o fluxo de upload de imagem dentro de uma seção
  (Figura 02 / Figura 03) e verificar que o DOCX gerado inclui a imagem na posição certa
- [ ] **Limpar drafts obsoletos**: 5 drafts antigos na DB (REP 28203, test_laudo etc.)
  — apagar ou deixar acumular conforme preferência do usuário
- [ ] **Scripts de migração avulsos**: fix_oficio.py, fix_paragraphs.py, fix_paragraphs2.py,
  fix_sections.py, fix_sections2.py, recreate_confirmed.py — adicionar ao .gitignore
  ou commitar como histórico

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
