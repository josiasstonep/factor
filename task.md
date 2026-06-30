# Factor — Rastreamento de Tarefas

## Milestone Atual: M3 — Melhoria com IA + diff

### Backend
- [ ] `ai_providers/base.py` — Protocol `AiProvider` com método `improve_text(section_text, variables) -> str`
- [ ] `ai_providers/ollama.py` — Ollama local (HTTP, sem chave)
- [ ] `ai_providers/claude.py` — Anthropic Claude (httpx, chave via header)
- [ ] `ai_providers/openai.py` — OpenAI (httpx, chave via header)
- [ ] `ai_providers/groq.py` — Groq (httpx, chave via header)
- [ ] `ai_providers/gemini.py` — Google Gemini (httpx, chave via header)
- [ ] `diffing/word_diff.py` — diff word-level via `difflib.SequenceMatcher`
- [ ] `POST /ai/improve` — recebe report_id + section_id + provider + api_key, devolve ai_text + diff
- [ ] `GET /ai/providers` — lista provedores disponíveis (Ollama: verifica se está rodando)
- [ ] `PATCH /reports/{id}/sections/{section_id}/accept` — marca ai_text como aceito

### Frontend
- [ ] `AiImprove.tsx` — seletor de provedor (dropdown) + campo de API key (não persiste localmente)
- [ ] `DiffView.tsx` — track-changes visual (verde = inserção, vermelho = remoção)
- [ ] Integrar step 4+ no wizard: após geração, oferecer "Melhorar com IA"
- [ ] Aceitar/rejeitar por seção + "aceitar tudo"

### Electron (safeStorage)
- [ ] IPC handler `store-api-key` / `get-api-key` usando `safeStorage.encryptString`
- [ ] Frontend lê/escreve chaves via IPC (não via HTTP direto ao sidecar)

---

## Concluído

### M2 — Batch multi-row ✅ (commit 1249627, push 2026-06-30)
- [x] `BatchForm.tsx` — repetidor de N linhas, add/remove, collapsible por caso
- [x] `GenerationReview.tsx` — tabela com row_label, link DOCX individual, botão ZIP
- [x] `api/types.ts` — `row_label: string | null` em `GeneratedReport`
- [x] `GeneratedReport` model — campo `row_label: Optional[str] = None`
- [x] `/reports/generate` — propaga `row_label` do `ReportInputCreate` ao `GeneratedReport`
- [x] ZIP export — usa `report_input.row_label` como arcname
- [x] Testado end-to-end: 3 laudos com row_label correto (Caso 2026/001-003), ZIP com nomes certos

### M1 — Fluxo base (1 template, 1 laudo) ✅
- [x] Monorepo: apps/desktop (Electron), apps/web (React+Vite), services/sidecar (FastAPI Python)
- [x] Parsing PDF: seções (heurística de font size/bold/keywords + rapidfuzz), variáveis (regex label:value), imagens
- [x] Geração DOCX: skeleton docxtpl gerado do Template confirmado + render por ReportInput
- [x] Endpoints: /templates/parse, /templates/{id} GET+PUT, /uploads/image, /reports/generate, /reports/{id}/docx
- [x] SQLite (SQLAlchemy) + repo layer para Template, ReportInput, GeneratedReport
- [x] React wizard 4 passos: Upload → Estrutura → Dados → Resultado
- [x] Electron: main.ts (healthcheck + spawn sidecar em prod), preload.ts, sidecar.ts
- [x] Testado end-to-end via HTTP: parse → confirm → generate → download DOCX 37KB ✓

---

## Backlog

### M4 — Multi-templates + packaging
- [ ] Tela de lista/seleção de templates
- [ ] PyInstaller spec (build_sidecar.spec)
- [ ] electron-builder.yml (NSIS Windows installer)
- [ ] Teste em sessão limpa sem Python

---

## Pendências / Decisões Abertas
_Nenhuma no momento._
