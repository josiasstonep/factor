# Factor — Rastreamento de Tarefas

## Status: PROJETO COMPLETO (M1–M4) ✅

Todos os milestones foram concluídos. O aplicativo está pronto para uso e empacotamento.

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

## Concluído

### M3 — Melhoria com IA + diff ✅
- [x] `ai_providers/` — Protocol base + Ollama, Claude, OpenAI, Groq, Gemini
- [x] `diffing/word_diff.py` — diff word-level via difflib.SequenceMatcher
- [x] `routers/ai.py` — GET /ai/providers, POST /ai/improve, PATCH /ai/accept
- [x] DOCX download re-renderiza com textos AI aceitos como overrides
- [x] `AiImprove.tsx` — seletor de provedor, API key (sessão), melhora por seção ou tudo
- [x] `DiffView.tsx` — track-changes visual (verde=insert, vermelho=delete)
- [x] `GenerationReview.tsx` — botão "Melhorar com IA" quando há seções improvable
- [x] Verificado: sidecar retorna 5 providers, build clean (36 módulos, 213KB)

### M2 — Batch multi-row ✅
- [x] `BatchForm.tsx` — repetidor de N linhas, add/remove, collapsible por caso
- [x] `GenerationReview.tsx` — tabela com row_label, link DOCX individual, botão ZIP
- [x] `GeneratedReport` model — `row_label: Optional[str] = None`
- [x] ZIP export — usa report_input.row_label como arcname
- [x] Testado end-to-end: 3 laudos com row_label correto, ZIP com nomes certos

### M1 — Fluxo base (1 template, 1 laudo) ✅
- [x] Monorepo: apps/desktop (Electron), apps/web (React+Vite), services/sidecar (FastAPI Python)
- [x] Parsing PDF: seções (heurística font size/bold/keywords + rapidfuzz), variáveis, imagens
- [x] Geração DOCX: skeleton docxtpl + render por ReportInput
- [x] Endpoints: /templates, /uploads/image, /reports/generate, /reports/{id}/docx
- [x] SQLite (SQLAlchemy) + repo layer
- [x] React wizard 4 passos
- [x] Electron: main.ts, preload.ts, sidecar.ts

---

## Como empacotar o instalador

1. **Build Python sidecar** (uma vez, ou quando houver mudança no backend):
   ```
   npm run build:sidecar
   ```
   Gera: `services/sidecar/dist/factor-sidecar/sidecar.exe`

2. **Build frontend + desktop + gerar instalador**:
   ```
   npm run package:full
   ```
   Gera: `dist/release/Factor Setup X.X.X.exe` (instalador NSIS)

3. **Para testar sem instalar** (unpackaged Electron + sidecar dev):
   ```
   npm run dev
   ```

## Melhorias Futuras (pós-V1)

- Suporte a DOCX customizado do usuário (layout avançado) como esqueleto alternativo
- Histórico de batches gerados por template
- Preview HTML antes de exportar (renderização do contexto Jinja2 em HTML)
- Gestão de chaves de API via Electron safeStorage (persistência entre sessões)
- Modo offline completo com Ollama como padrão
