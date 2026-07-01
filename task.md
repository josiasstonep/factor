# Factor — Rastreamento de Tarefas

## Status: PROJETO COMPLETO (M1–M4) ✅ + Refinamentos em andamento

---

## Sessão 2026-07-01 — Imagens inline + Correção dos 8 capítulos ✅

### Imagens dentro das seções
- [x] `TemplateImagePlaceholder` ganha campo `section_id` (opcional) — vincula cada figura à seção pai
- [x] `docx_template_builder.py`: `_add_image_placeholder()` centralizado; imagens com `section_id` aparecem
  logo após o texto da seção; sem `section_id` vão ao final (orphan)
- [x] `BatchForm.tsx`: `ImageZone` renderiza **dentro de cada seção** ao invés do bloco separado no final;
  orphan images mantêm bloco "IMAGENS / ANEXOS" no final
- [x] `types.ts`: `section_id?: string | null` adicionado a `TemplateImagePlaceholder`
- [x] Template confirmado com Figura 02 (Análise Forense) e Figura 03 (Verificação de Integridade)
  linkadas às suas seções via `section_id`

### Correção da detecção de seções (`section_detect.py`)
- [x] `IGNORED_HEADING_FRAGMENTS`: adicionado cellebrite, ufed, physical analyzer, inseyets, ufdr
  — nomes de ferramentas forenses em bold no PDF que NÃO são capítulos do laudo
- [x] Labels únicos e corretos por seção: usa o texto real do heading com `title_case_label()`
  para TODOS os tipos (não só CUSTOM) — elimina três seções todas chamadas "Análise"
- [x] Prefixo numérico ("3. ", "4. ") removido do label automaticamente no parse
- [x] `text_utils.title_case_label()`: respeita artigos/preposições portuguesas (de, do, da,
  para, com...) que ficam minúsculos exceto na primeira palavra
- [x] `rebuild_ti_template.py`: script robusto que re-parseia qualquer PDF do laudo T.I.,
  faz merge de texto de seções falsas na seção anterior, confirma com exatamente 8 capítulos
- [x] Template confirmado `c078e655` com a estrutura correta:
  1. Histórico
  2. Material Recebido para Análise
  3. Objetivo
  4. Condições Gerais
  5. Aquisição e Preservação dos Dados Digitais
  6. Análise Forense dos Dados Extraídos  [+1 img: Figura 02]
  7. Verificação de Integridade dos Arquivos  [+1 img: Figura 03]
  8. Conclusão

---

## Pendente — Próxima sessão ⏳

- [ ] **Testar geração de DOCX** com o template corrigido e verificar que:
  - Imagens (Figura 02 / Figura 03) aparecem nas posições corretas dentro das seções
  - Upload de imagem no formulário funciona dentro das seções (não só no final)
  - DOCX gerado tem Arial 12pt, 1.5 espaçamento, justificado, recuo 1.25cm
- [ ] **Testar novo upload de PDF** (outro laudo T.I.) e verificar que o parse já produz
  os 8 capítulos corretos automaticamente (sem precisar rodar scripts de migração)
- [ ] **Draft templates obsoletos**: limpar os 5 drafts antigos da DB (REP 28203, test_laudo etc.)
  ou deixar para quando o usuário tiver um novo PDF real para testar
- [ ] **Rótulos de variáveis**: verificar se "Vestígio", "Ofício" etc. aparecem corretos
  no formulário batch (sem caractere U+00AD soft-hyphen vindo do PDF)

---

## M4 — Multi-templates + Packaging ✅

### Frontend
- [x] `TemplateList.tsx` — tela home com templates salvos, botão "Usar" por template, upload zone para novo PDF
- [x] `App.tsx` — fluxo começa em "home", clicar no título volta à lista de templates

### Packaging
- [x] `build_sidecar.spec` — spec PyInstaller --onedir com hidden imports (uvicorn, FastAPI, AI providers)
- [x] `electron-builder.yml` — NSIS Windows (x64), web → resources/web/, sidecar → resources/sidecar/
- [x] `package.json` — scripts: build, build:sidecar, package, package:full + electron-builder devDep
- [x] `sidecar.ts` — nome de exe cross-platform, FACTOR_DATA_DIR aponta para userData/factor-data
- [x] `main.ts` — em modo packaged usa process.resourcesPath para encontrar web/index.html
- [x] Testado: sidecar.exe --port 8733 → health OK + 5 providers AI registrados

---

## Concluído em sessões anteriores

### M3 — Melhoria com IA + diff ✅
- [x] `ai_providers/` — Protocol base + Ollama, Claude, OpenAI, Groq, Gemini
- [x] `diffing/word_diff.py` — diff word-level via difflib.SequenceMatcher
- [x] `routers/ai.py` — GET /ai/providers, POST /ai/improve, PATCH /ai/accept
- [x] DOCX download re-renderiza com textos AI aceitos como overrides
- [x] `AiImprove.tsx` — seletor de provedor, API key (sessão), melhora por seção ou tudo
- [x] `DiffView.tsx` — track-changes visual (verde=insert, vermelho=delete)
- [x] `GenerationReview.tsx` — botão "Melhorar com IA" quando há seções improvable

### M2 — Batch multi-row ✅
- [x] `BatchForm.tsx` — repetidor de N linhas, add/remove, collapsible por caso
- [x] `GenerationReview.tsx` — tabela com row_label, link DOCX individual, botão ZIP
- [x] ZIP export — usa report_input.row_label como arcname

### M1 — Fluxo base (1 template, 1 laudo) ✅
- [x] Monorepo: apps/desktop (Electron), apps/web (React+Vite), services/sidecar (FastAPI Python)
- [x] Parsing PDF: seções, variáveis, imagens
- [x] Geração DOCX: skeleton docxtpl + render por ReportInput
- [x] Endpoints: /templates, /uploads/image, /reports/generate, /reports/{id}/docx
- [x] SQLite (SQLAlchemy) + repo layer
- [x] Electron: main.ts, preload.ts, sidecar.ts

### Refinamentos de qualidade ✅
- [x] DOCX: Arial 12pt, espaçamento 1.5, margens A4
- [x] Extração automática de cabeçalho/rodapé do PDF via PyMuPDF
- [x] Fix vestígio regex, campos de variáveis vazios, resolveVars fallback
- [x] Fix Ofício: injectPlaceholders usa regex `\s+` para tolerar quebras do PDF
- [x] `normalize_paragraphs_from_pdf()`: usa posição X para detectar parágrafos
  (evita que cada linha física do PDF vire parágrafo separado no DOCX)

---

## Melhorias Futuras (pós-V1)

- Suporte a DOCX customizado do usuário (layout avançado) como esqueleto alternativo
- Histórico de batches gerados por template
- Preview HTML antes de exportar
- Gestão de chaves de API via Electron safeStorage (persistência entre sessões)
- Modo offline completo com Ollama como padrão
