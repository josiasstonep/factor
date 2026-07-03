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

## Sessão 2026-07-02 (noite) — Parser Figura 01 + UX de navegação ✅

### Concluído
- [x] **Figura 01 auto-detectada no upload**: `detect_figures_from_text` agora escaneia
  texto completo do PDF (não só seções), detecta "Figura 01 – Vestígio..." que fica abaixo
  de imagem embutida; usa posição Y para atribuir corretamente à seção "Material Recebido"
  mesmo quando heading da próxima seção está na mesma página
- [x] **Navegação pelos steps**: chips "1. Upload", "2. Estrutura" etc. ficam clicáveis
  quando já concluídos (cursor pointer); "1. Upload" vai à tela inicial (home/TemplateList)
- [x] **Botão "Estrutura" para templates confirmados**: recarrega dados frescos da API antes
  de abrir o editor (evita estado obsoleto)
- [x] **Botão "Editar" para templates draft**: permite editar um rascunho existente sem
  re-upload do PDF
- [x] **Diagnóstico do ciclo vicioso**: template confirmado sumia porque o sidecar do
  Electron usa `userData/factor-data/` (prod) enquanto os testes de API iam para `.data/`
  (dev) — dois bancos diferentes

### Estado atual do DB (dev, porta 8731)
- 2 drafts `draft_parsed` de REP 32214_2026 (sem template confirmado ainda)
- **Para criar template confirmado com Figura 01**: reiniciar sidecar, fazer upload do PDF
  → Figura 01 aparece automaticamente → Confirmar estrutura

---

## Sessão 2026-07-03 — Variáveis padrão + Preset quick-select + Polish ✅

### Concluído
- [x] **`apps/web/src/utils/standardVars.ts`** (novo): `mergeStandardVars()` injeta
  Modelo, IMEI 1, IMEI 2, Nome do Perito, Circunscrição se ausentes do template.
  IDs estáveis `__std__${key}` para consistência entre componentes.
- [x] **`apps/web/src/utils/varPresets.ts`** (novo): save/load/delete de atalhos em
  `localStorage` por chave de variável (`factor_presets_${key}`), max 20 por campo.
- [x] **`TemplateStructureEditor.tsx`**: state de `variables` inicializado com
  `mergeStandardVars()` → PUT confirm sempre inclui as 5 variáveis padrão.
- [x] **`BatchForm.tsx`**: usa `effectiveTemplate` com `mergeStandardVars()` para
  mostrar todos os campos mesmo em templates antigos; componente `VarField` com:
  - Botão ★ salva valor atual como atalho em localStorage
  - Botão ▾ abre dropdown com atalhos salvos (click-to-fill, × para deletar)
  - Click-outside fecha o dropdown automaticamente
- [x] **`BatchPreview.tsx`**: usa `effectiveTemplate` para preview e payload de geração
- [x] **CSS**: `overflow: hidden` removido do `.batch-case` (prevenia clipping do dropdown);
  `.batch-case-header` ganhou `border-radius: 10px 10px 0 0` próprio
- [x] **Numeração**: GenerationReview "4." → "5.", AiImprove "5." → "6."
- [x] **`DEVELOPMENT.md`** (novo): guia completo de setup para novo PC + handoff

### Estado do repositório
- Branch: `main` — 2 commits novos na sessão: `2c9132f`, `7001134`
- GitHub: `https://github.com/josiasstonep/factor.git` — pushed ✅
- TypeScript: 0 erros

---

## Pendente — Próxima sessão ⏳

### Setup no novo PC (fazer primeiro)
1. `git clone https://github.com/josiasstonep/factor.git`
2. `cd factor && npm install`
3. `cd services/sidecar && python -m venv .venv && .venv\Scripts\Activate.ps1 && pip install -r requirements.txt`
4. `cd ../.. && npm run dev`

### Testes a fazer após setup
- [ ] **Testar Figura 01 no upload**: fazer upload do PDF REP 32214_2026 → verificar que
  Figura 01 aparece na lista de imagens → Confirmar → gerar DOCX
- [ ] **Verificar DOCX gerado**: foto do vestígio entre "Material Recebido" e "Objetivo",
  mesma formatação que Figura 02 e Figura 03
- [ ] **Cabeçalho full-width**: verificar visualmente que cabeçalho ocupa 210mm
- [ ] **Testar preset quick-select**: preencher campo Circunscrição → clicar ★ para salvar
  → clicar ▾ → confirmar que o valor aparece na lista → clicar para reutilizar

### Melhorias futuras (não urgentes)
- [ ] Limpar drafts duplicados no DB após ter template confirmado com as 3 figuras
- [ ] Identificação de seção no AiImprove (mostra UUID truncado; ideal: label da seção)
- [ ] DOCX customizado do usuário como esqueleto alternativo
- [ ] Histórico de batches por template
- [ ] Gestão de chaves API via Electron safeStorage

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
