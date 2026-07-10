# Factor — Progresso e Pendências

Última atualização: 2026-07-10

---

## Concluído

### Infraestrutura
- [x] Electron + React + Python FastAPI sidecar na porta 8731
- [x] Wizard de 6 passos: Upload → Estrutura → Dados → IA → Preview → Resultado
- [x] Templates salvos em SQLite, versionados por status (draft / confirmed)
- [x] Geração de DOCX com imagens, cabeçalho/rodapé e variáveis {{chave}}
- [x] Variável data_recebimento disponível em todos os templates
- [x] Espaçamento entre capítulos no DOCX

### Templates
- [x] Upload de PDF → parsing automático de seções
- [x] Editor de estrutura (ordem, tipo, label, toggle IA por seção)
- [x] Toggle is_ai_improvable por seção — seções como "Condições Gerais" não passam pela IA
- [x] Templates builtin por tipo de perícia (backend pronto, UI pendente)

### Chaves de API
- [x] .env na raiz do projeto (nunca vai ao GitHub)
- [x] config.py carrega .env em 3 locais por prioridade
- [x] GET /config/keys retorna apenas booleans (chave nunca viaja pro frontend)
- [x] PUT /config/keys salva no .env via python-dotenv
- [x] Modal "API" no app para configurar chaves sem sair do app
- [x] Providers com fallback automático para chave do .env

### Passo 4 — Melhoria com IA
- [x] Prompts reframeados: adaptador cirúrgico, não melhorador
- [x] Sanitizador com 5 camadas: echo, comprimento, preamble, alucinação, variáveis destruídas
- [x] Dois modos: parágrafo a parágrafo (Ollama) vs. seção inteira (cloud com contexto)
- [x] Seções analise e conclusao processadas inteiras — modelo pode suprimir parágrafos redundantes
- [x] Dois campos de contexto separados:
      - "Condições do vestígio recebido" → Descrição + Análise
      - "Relato do caso" → Histórico + Conclusão
- [x] Sem preenchimento → seção fica igual ao template, zero alterações
- [x] Diff visual word-level com aceitar/rejeitar por seção
- [x] Guard do router corrigido: permite provider com chave no .env sem api_key no payload
- [x] Guias de seção com fronteiras explícitas por capítulo
- [x] Regra crítica de variáveis: {{chave}} deve aparecer no output mesmo com reescrita total

### Providers de IA suportados
- [x] Groq (LLaMA 70B) — grátis
- [x] Google Gemini — grátis
- [x] Anthropic Claude
- [x] OpenAI
- [x] Ollama (local)

---

## Pendente / Próximos passos

### Alta prioridade — IA
- [ ] Testes com casos reais para calibrar prompts (tag: ia-implementada-ajustes-pendentes)
- [ ] Testar fluxo: "conector quebrado" → Análise 1 parágrafo limpo → Conclusão com síntese completa
- [ ] Verificar GROQ_API_KEY (console.groq.com) para ter mais um provider gratuito

### Funcionalidades planejadas
- [ ] Tela de seleção de tipo de perícia na home (backend pronto: listBuiltinTypes + createBuiltinTemplate)
- [ ] UI para gerenciamento de Peritos e Delegacias (backend já implementado)
- [ ] Configuração de cabeçalho/rodapé por template na UI

### Build / Distribuição
- [ ] Build final: Electron + PyInstaller empacotados em instalador .exe
- [ ] Ícone, splash screen, auto-update

---

## Arquitetura resumida

apps/web/           React + TypeScript (Vite)
  src/routes/       Telas do wizard
  src/components/   ConfigModal, DiffView
  src/api/          client.ts (fetch para sidecar)

services/sidecar/   Python FastAPI
  routers/          ai.py, templates.py, reports.py, config_router.py
  ai_providers/     base.py (prompts + sanitizador), claude/openai/groq/gemini/ollama
  parsing/          PDF → Template
  docx_gen/         Template + dados → DOCX

electron/           Shell Electron (main process)
