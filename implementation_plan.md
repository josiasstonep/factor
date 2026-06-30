# Factor — Plano de Implementação

## Visão Geral

Desktop app (Electron + React + Python FastAPI sidecar) para geração de laudos periciais em batch a partir de um PDF modelo.

**Stack:**
- Frontend: React 19 + TypeScript + Vite (apps/web)
- Desktop wrapper: Electron 33 (apps/desktop, TypeScript)
- Backend: Python 3.11 FastAPI sidecar (services/sidecar), comunicação via HTTP/JSON em localhost
- Storage: SQLite (metadados) + arquivos em disco (PDFs, imagens, DOCX)
- AI (M3): Ollama (local) + Anthropic Claude, OpenAI, Groq, Google Gemini (remoto)

**Decisões de arquitetura:**
- Renderer (React) fala com o sidecar diretamente via `fetch` HTTP, não por IPC do Electron
- IPC Electron reservado para: dialogs nativos de arquivo + `safeStorage` para API keys (M3)
- Parsing de PDF é heurístico (PyMuPDF + rapidfuzz) — tela de "corrigir estrutura" é load-bearing
- DOCX gerado pelo app (skeleton docxtpl app-controlled), user só sobe o PDF modelo
- Texto das seções é prosa livre por caso (não mail-merge de texto); variáveis de cabeçalho são o layer de substituição automática

---

## Milestones

### M1 — Fluxo base, 1 template, 1 laudo ✅ COMPLETO
**Entregável:** upload de PDF real → parse → corrigir estrutura → preencher dados de 1 caso → gerar 1 DOCX → download

**Componentes:**
- [x] Estrutura de pastas monorepo (apps/desktop, apps/web, services/sidecar)
- [x] Python sidecar: modelos pydantic (Template, ReportInput, GeneratedReport), SQLite via SQLAlchemy, repo layer
- [x] PDF parsing: section_detect, variable_detect, image_detect (PyMuPDF + rapidfuzz)
- [x] DOCX generation: docx_template_builder (skeleton), docx_render (docxtpl)
- [x] FastAPI endpoints: POST /templates/parse, GET/PUT /templates/{id}, POST /reports/generate, GET /reports/{id}/docx
- [x] Upload de imagens: POST /uploads/image
- [x] React wizard 4 passos: TemplateUpload → TemplateStructureEditor → BatchForm → GenerationReview
- [x] Electron: main.ts, preload.ts, sidecar.ts (healthcheck, spawn em prod)
- [x] Testes HTTP end-to-end (parse→confirm→generate→download DOCX 37 KB)

---

### M2 — Geração em batch (N laudos) 🚧 PRÓXIMO
**Entregável:** 1 template → N linhas de dados → N DOCX → download ZIP

**Backend (já implementado em M1):**
- [x] POST /reports/generate aceita `rows: list[ReportInputCreate]`
- [x] GET /reports/batch/{batch_id}/zip retorna ZIP com todos os DOCX

**Frontend (a fazer):**
- [ ] BatchForm.tsx → repetidor de N linhas (adicionar/remover linha, cada linha com próprio cabeçalho + seções + imagens)
- [ ] GenerationReview.tsx → tabela com todas as linhas geradas (row_label, status, download individual, download ZIP do batch)
- [ ] Adicionar `row_label` ao GeneratedReport para facilitar exibição (sem precisar de chamada extra ao backend)
- [ ] Barra/indicador de progresso durante geração (geração é síncrona no backend, mas pode demorar com muitas linhas)

**Arquivos a modificar:**
- `services/sidecar/sidecar/models/generated_report.py` → adicionar `row_label: str | None`
- `services/sidecar/sidecar/routers/reports.py` → popular `row_label` na geração
- `apps/web/src/routes/BatchForm.tsx` → multi-row
- `apps/web/src/routes/GenerationReview.tsx` → tabela completa + ZIP download
- `apps/web/src/api/types.ts` → adicionar `row_label` ao `GeneratedReport`

---

### M3 — Melhoria com IA + diff ⏳ PLANEJADO
**Entregável:** botão "Melhorar com IA" → escolhe provedor → IA reescreve seções narrativas → diff visual por seção → aceitar/rejeitar

**Backend:**
- [ ] `services/sidecar/sidecar/ai_providers/base.py` — Protocol `AiProvider.improve_text(text, context) -> str`
- [ ] Provedores: `ollama_provider.py`, `anthropic_provider.py`, `openai_provider.py`, `groq_provider.py`, `gemini_provider.py`
- [ ] `services/sidecar/sidecar/diffing/word_diff.py` — diff a nível de palavra via `difflib.SequenceMatcher`
- [ ] Routers: POST /ai/improve, GET /ai/providers, PATCH /reports/batch/{id}/sections/accept-all
- [ ] API keys: recebidas per-request no body (nunca persistidas no sidecar; Electron safeStorage as guarda)

**Frontend:**
- [ ] `apps/web/src/routes/AiImprove.tsx` — seletor de provedor + campo de API key + botão "Melhorar todos"
- [ ] `apps/web/src/components/diff/DiffView.tsx` — renderização inline de diff (igual/inserido/deletado)
- [ ] Aceitar/rejeitar por seção + "aceitar todos" em bulk
- [ ] Passo 4.5 no wizard entre GenerationReview e Export final
- [ ] Electron IPC: `safeStorage.encryptString/decryptString` para API keys (preload.ts expõe API de secrets)

**Provedores suportados:** Ollama local + Anthropic Claude + OpenAI + Groq + Google Gemini

---

### M4 — Múltiplos templates + empacotamento ⏳ PLANEJADO
**Entregável:** lista/troca de templates; instalador `.exe` standalone

**Templates:**
- [ ] Tela de listagem de templates (GET /templates) com opção de selecionar existente ou subir novo PDF
- [ ] Status "draft_parsed" vs "confirmed" visível na lista
- [ ] Possibilidade de re-editar a estrutura de um template já confirmado (via `confirm: false` no PUT)

**Empacotamento:**
- [ ] `services/sidecar/build_sidecar.spec` — PyInstaller `--onedir` com hidden imports pymupdf, docxtpl
- [ ] `electron-builder.yml` — target NSIS (Windows installer), `extraResources: [{from: "services/sidecar/dist", to: "sidecar"}]`
- [ ] Script de build: `npm run build:all` (compila React → Electron aponta para dist/web/dist)
- [ ] Teste: instalar em sessão limpa sem Python instalado e verificar sidecar sobe

---

## Fluxo de Dados

```
PDF upload
    │
    ▼ POST /templates/parse
Template (draft_parsed) ──► tela de correção ──► PUT /templates/{id}?confirm=true
                                                       │
                                                       ▼ build_skeleton() → skeleton.docx
                                                 Template (confirmed)
                                                       │
                                                       ▼ POST /reports/generate
                                                 N × ReportInput  ──► N × render_docx()
                                                       │
                                                       ▼
                                                 N × GeneratedReport
                                                       │
                                            ┌─────────┴─────────┐
                                            │                   │
                                   GET /reports/{id}/docx   GET /batches/{id}/zip
                                     (DOCX individual)       (ZIP de todos)
```

---

## Como Rodar em Dev

```bash
# Terminal 1 — sidecar Python
cd services/sidecar
.venv/Scripts/python.exe -m uvicorn sidecar.main:app --port 8731 --reload

# Terminal 2 — frontend React
cd apps/web
npm run dev   # → http://localhost:5173

# Terminal 3 — Electron (opcional, abre a janela desktop)
cd apps/desktop
npm run dev
```

Ou tudo junto na raiz: `npm run dev` (usa concurrently)
