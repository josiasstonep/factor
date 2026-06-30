# Factor — Rastreamento de Tarefas

## Milestone Atual: M2 — Batch multi-row

### Backend (já pronto no M1)
- [x] POST /reports/generate aceita `rows: list[...]` (multi-row)
- [x] GET /reports/batch/{batch_id}/zip retorna ZIP

### Backend (pequenas adições para M2)
- [ ] Adicionar `row_label: str | None` ao modelo `GeneratedReport`
- [ ] Popular `row_label` no endpoint de geração

### Frontend
- [ ] `BatchForm.tsx` — suporte a N linhas (botão "Adicionar caso", remover, cada linha tem seu próprio conjunto de campos)
- [ ] `GenerationReview.tsx` — tabela com todas as linhas (row_label, status, link individual, botão ZIP de todos)
- [ ] `api/types.ts` — adicionar `row_label` ao `GeneratedReport`

---

## Concluído

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

### M3 — Melhoria com IA + diff
- [ ] ai_providers/: base Protocol + Ollama, Claude, OpenAI, Groq, Gemini
- [ ] diffing/word_diff.py (difflib.SequenceMatcher word-level)
- [ ] POST /ai/improve, GET /ai/providers, PATCH bulk accept
- [ ] AiImprove.tsx (seletor de provedor + API key)
- [ ] DiffView.tsx (track-changes visual)
- [ ] safeStorage Electron para API keys

### M4 — Multi-templates + packaging
- [ ] Tela de lista/seleção de templates
- [ ] PyInstaller spec (build_sidecar.spec)
- [ ] electron-builder.yml (NSIS Windows installer)
- [ ] Teste em sessão limpa sem Python

---

## Pendências / Decisões Abertas
_Nenhuma no momento._
