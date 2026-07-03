# Factor — Guia de Desenvolvimento

Gerador de laudos periciais em batch. App desktop (Electron + React + Python FastAPI sidecar).

## Pré-requisitos

- **Node.js** 20+
- **Python** 3.11+ com `venv`
- **Git**

## Setup inicial (novo PC)

```bash
# 1. Clonar o repositório
git clone <URL_DO_REPO> factor
cd factor

# 2. Instalar dependências Node
npm install

# 3. Criar e ativar o virtualenv Python
cd services/sidecar
python -m venv .venv

# Windows PowerShell:
.venv\Scripts\Activate.ps1
# ou Git Bash:
source .venv/Scripts/activate

# 4. Instalar dependências Python
pip install -r requirements.txt
cd ../..

# 5. Rodar em modo dev
npm run dev
```

O comando `npm run dev` inicia três processos em paralelo via `concurrently`:
- **Sidecar** — uvicorn com `--reload` na porta 8731
- **Web** — Vite dev server (normalmente porta 5173)
- **Electron** — janela desktop

## Estrutura do projeto

```
factor/
├── apps/
│   ├── desktop/          # Electron main process
│   │   └── src/main.ts   # entrada, sobe sidecar, cria janela
│   └── web/              # React + TypeScript (Vite)
│       └── src/
│           ├── routes/   # páginas: TemplateList, BatchForm, BatchPreview, etc.
│           ├── api/      # client.ts (fetch para o sidecar), types.ts
│           └── utils/
│               ├── standardVars.ts   # variáveis forenses padrão
│               └── varPresets.ts     # atalhos salvos em localStorage
└── services/
    └── sidecar/           # FastAPI Python
        ├── sidecar/
        │   ├── main.py
        │   ├── db.py
        │   ├── routers/
        │   │   ├── templates.py   # CRUD de templates + confirm
        │   │   └── batches.py     # geração de DOCX em batch
        │   └── parsing/
        │       └── orchestrator.py  # extração de estrutura do PDF
        └── .data/         # banco SQLite + arquivos gerados
            └── factor.db
```

## Fluxo principal

1. **Upload** — usuário sobe um PDF modelo de laudo pericial
2. **Estrutura** (`TemplateStructureEditor`) — revisa seções, variáveis e placeholders de imagem extraídos automaticamente pelo parser heurístico; clica "Confirmar"
3. **Formulário batch** (`BatchForm`) — preenche N laudos (variáveis de cabeçalho + textos das seções + fotos)
4. **Pré-visualização** (`BatchPreview`) — confere como o laudo ficará em papel A4
5. **Gerar** — clica "Gerar laudos DOCX" e baixa um `.docx` por caso

## Variáveis padrão (sempre presentes)

Definidas em `apps/web/src/utils/standardVars.ts`:

| Chave | Label |
|-------|-------|
| `modelo` | Modelo |
| `imei1` | IMEI 1 |
| `imei2` | IMEI 2 |
| `nome_perito` | Nome do Perito |
| `circunscricao` | Circunscrição |

A função `mergeStandardVars(vars)` injeta essas variáveis se não estiverem no template. É chamada em:
- `TemplateStructureEditor.tsx` — ao inicializar o estado (garante que o PUT confirm sempre as inclua)
- `BatchForm.tsx` — em `effectiveTemplate` (garante que apareçam no formulário mesmo se o DB não as tem)
- `BatchPreview.tsx` — em `effectiveTemplate` (idem, para o preview e o payload de geração)

## Atalhos de campo (presets)

`apps/web/src/utils/varPresets.ts` salva/carrega atalhos em `localStorage` por chave de variável. Na interface, cada campo do formulário tem:
- Botão **★** — salva o valor atual como atalho
- Botão **▾** — abre dropdown com atalhos salvos (clique para preencher, × para remover)

Útil para preencher rapidamente a Circunscrição (ex.: "170ª CIRCUNSCRIÇÃO - ITAPETIM - PCPE").

## API do sidecar (porta 8731)

| Método | Rota | Descrição |
|--------|------|-----------|
| `GET` | `/health` | health check |
| `GET` | `/templates` | lista todos os templates |
| `GET` | `/templates/{id}` | detalhe de um template |
| `POST` | `/uploads/pdf` | faz upload de PDF e cria draft |
| `PUT` | `/templates/{id}` | atualiza estrutura e/ou confirma template |
| `DELETE` | `/templates/{id}` | remove template |
| `POST` | `/batches/generate` | gera N laudos DOCX |
| `GET` | `/reports/{id}/docx` | baixa um laudo DOCX gerado |

Docs interativos: `http://localhost:8731/docs`

## Banco de dados

SQLite em `services/sidecar/.data/factor.db`. Para inspecionar:

```bash
cd services/sidecar
.venv/Scripts/python -c "
import sqlite3, json
conn = sqlite3.connect('.data/factor.db')
conn.row_factory = sqlite3.Row
for row in conn.execute(\"SELECT id, status, created_at FROM templates ORDER BY created_at DESC\"):
    print(dict(row))
"
```

## Problemas conhecidos / atenção

### Sidecar sem `--reload`
Se o sidecar for morto e reiniciado manualmente (sem `npm run dev`), pode não carregar `--reload`. Sempre prefira parar tudo e rodar `npm run dev` do zero. Para matar processos na porta 8731:

```powershell
Get-Process -Id (Get-NetTCPConnection -LocalPort 8731).OwningProcess | Stop-Process -Force
```

### Variáveis padrão x DB
A fonte da verdade para variáveis padrão é o **frontend** (`standardVars.ts`). Mesmo que o banco tenha um template antigo sem essas variáveis, o `effectiveTemplate` garante que apareçam na UI e no payload de geração.

### Template draft vs confirmed
- **draft_parsed**: criado automaticamente após upload do PDF — só tem "Deletar" na lista
- **confirmed**: template confirmado pelo usuário — tem botão "Usar" e é usado para gerar laudos

## Próximos passos sugeridos

1. **Melhoria com IA** — tela de revisão de texto (diff palavra por palavra) usando Ollama local ou Claude/OpenAI
2. **Múltiplos templates** — suporte a laudos de tipos diferentes (celular, computador, etc.)
3. **Export ZIP** — gerar todos os laudos do batch em um arquivo `.zip`
4. **Empacotamento** — PyInstaller + electron-builder para distribuição como instalador `.exe`
5. **Editar drafts** — botão "Editar" na lista de templates para reeditar a estrutura de um draft sem re-upload
