import { useEffect, useState } from "react";
import { improveRawText, listAiProviders } from "../api/client";
import type { AiProviderInfo, DiffOp, Template } from "../api/types";
import DiffView from "../components/DiffView";
import type { RowState } from "./BatchForm";

interface Props {
  template: Template;
  rows: RowState[];
  onContinue: (rows: RowState[]) => void;
  onSkip: (rows: RowState[]) => void;
}

interface SectionImproveState {
  improving: boolean;
  aiText: string | null;
  diff: DiffOp[] | null;
  accepted: boolean | null;
  error: string | null;
  warnings: string[];
}

type SectionKey = `${string}::${string}`; // rowId::sectionId

function sKey(rowId: string, sectionId: string): SectionKey {
  return `${rowId}::${sectionId}`;
}

const IMPROVABLE_TYPES = new Set(["historia", "descricao", "analise", "conclusao", "custom"]);

function buildVariableContext(row: RowState, tmpl: Template): Record<string, string> {
  return Object.fromEntries(
    tmpl.variables
      .filter((v) => row.variableValues[v.id]?.trim())
      .map((v) => [v.label, row.variableValues[v.id]]),
  );
}

export default function BatchAiImprove({ template, rows, onContinue, onSkip }: Props) {
  const [providers, setProviders] = useState<AiProviderInfo[]>([]);
  const [selectedProvider, setSelectedProvider] = useState("");
  const [selectedModel, setSelectedModel] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [checking, setChecking] = useState(false);
  const [sections, setSections] = useState<Record<SectionKey, SectionImproveState>>({});
  const [improvingAll, setImprovingAll] = useState(false);
  const [localRows, setLocalRows] = useState<RowState[]>(rows);
  const [caseDetails, setCaseDetails] = useState<Record<string, string>>(
    () => Object.fromEntries(rows.map((r) => [r.rowId, r.caseDetails ?? ""])),
  );

  const sortedSections = template.sections
    .filter((s) => IMPROVABLE_TYPES.has(s.type) && s.is_ai_improvable)
    .sort((a, b) => a.order - b.order);

  async function loadProviders() {
    setChecking(true);
    try {
      const ps = await listAiProviders();
      setProviders(ps);
      const first = ps.find((p) => p.available);
      if (first && !selectedProvider) setSelectedProvider(first.name);
    } finally {
      setChecking(false);
    }
  }

  useEffect(() => { void loadProviders(); }, []);

  const provider = providers.find((p) => p.name === selectedProvider);
  const keyRequired = provider?.requires_key ?? false;
  const ollamaModels = provider?.available_models ?? [];
  const effectiveModel = selectedModel || ollamaModels[0] || null;

  function getState(rowId: string, sectionId: string): SectionImproveState {
    return sections[sKey(rowId, sectionId)] ?? {
      improving: false, aiText: null, diff: null, accepted: null, error: null, warnings: [],
    };
  }

  function patchState(rowId: string, sectionId: string, patch: Partial<SectionImproveState>) {
    setSections((prev) => ({
      ...prev,
      [sKey(rowId, sectionId)]: { ...getState(rowId, sectionId), ...patch },
    }));
  }

  async function handleImprove(row: RowState, sectionId: string) {
    const text = row.sectionTexts[sectionId] ?? "";
    if (!text.trim()) return;
    patchState(row.rowId, sectionId, { improving: true, error: null, aiText: null, diff: null });
    try {
      const res = await improveRawText(
        text, template.id, sectionId, selectedProvider,
        keyRequired ? apiKey || null : null,
        effectiveModel,
        caseDetails[row.rowId] || null,
        buildVariableContext(row, template),
      );
      patchState(row.rowId, sectionId, {
        improving: false, aiText: res.ai_text, diff: res.diff, accepted: null,
        warnings: res.warnings ?? [],
      });
    } catch (err) {
      patchState(row.rowId, sectionId, {
        improving: false,
        error: err instanceof Error ? err.message : "Erro desconhecido.",
      });
    }
  }

  function handleAccept(row: RowState, sectionId: string, accept: boolean) {
    const st = getState(row.rowId, sectionId);
    patchState(row.rowId, sectionId, { accepted: accept });
    if (accept && st.aiText) {
      setLocalRows((prev) =>
        prev.map((r) =>
          r.rowId === row.rowId
            ? { ...r, sectionTexts: { ...r.sectionTexts, [sectionId]: st.aiText! } }
            : r,
        ),
      );
    }
  }

  async function handleImproveAll() {
    if (keyRequired && !apiKey.trim()) return;
    setImprovingAll(true);
    for (const row of localRows) {
      for (const s of sortedSections) {
        const text = row.sectionTexts[s.id] ?? "";
        if (!text.trim()) continue;
        await handleImprove(row, s.id);
      }
    }
    setImprovingAll(false);
  }

  function handleAcceptAll() {
    const updates: Record<SectionKey, SectionImproveState> = {};
    const rowPatches: Record<string, Record<string, string>> = {};
    for (const [key, st] of Object.entries(sections) as [SectionKey, SectionImproveState][]) {
      // Only accept when there are actual changes (non-empty diff)
      if (st.aiText && st.accepted === null && st.diff !== null && st.diff.length > 0) {
        updates[key] = { ...st, accepted: true };
        const [rowId, sectionId] = key.split("::") as [string, string];
        if (!rowPatches[rowId]) rowPatches[rowId] = {};
        rowPatches[rowId][sectionId] = st.aiText;
      }
    }
    if (Object.keys(updates).length === 0) return;
    setSections((prev) => ({ ...prev, ...updates }));
    setLocalRows((prev) =>
      prev.map((r) =>
        rowPatches[r.rowId]
          ? { ...r, sectionTexts: { ...r.sectionTexts, ...rowPatches[r.rowId] } }
          : r,
      ),
    );
  }

  const totalPending = localRows.length * sortedSections.length;
  const totalImproved = Object.values(sections).filter((s) => s.accepted === true).length;
  const pendingSuggestions = Object.values(sections).filter((s) => s.aiText && s.accepted === null && s.diff !== null && s.diff.length > 0).length;

  return (
    <div className="card">
      <h2>4. Melhoria com IA <span style={{ fontSize: 13, fontWeight: 400, color: "#6b7280" }}>(opcional)</span></h2>
      <p className="hint">
        Melhore os textos das seções antes de gerar o DOCX. Você revisa e aceita cada sugestão individualmente.
        Se preferir pular, clique em <strong>Pular IA</strong>.
      </p>

      {/* Provider selector */}
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 20, padding: "14px 16px", background: "#f8fafc", borderRadius: 8, border: "1px solid #e2e8f0" }}>
        <div className="field-row" style={{ flex: "1 1 180px", marginBottom: 0 }}>
          <label>Provedor de IA</label>
          <div style={{ display: "flex", gap: 6 }}>
            <select style={{ flex: 1 }} value={selectedProvider} onChange={(e) => setSelectedProvider(e.target.value)}>
              {providers.length === 0 && <option value="">Carregando…</option>}
              {providers.map((p) => (
                <option key={p.name} value={p.name} disabled={!p.available}>
                  {p.label}{!p.available ? " (indisponível)" : ""}
                </option>
              ))}
            </select>
            <button type="button" className="secondary" title="Recarregar" disabled={checking} onClick={() => void loadProviders()} style={{ padding: "8px 10px" }}>
              {checking ? "…" : "↺"}
            </button>
          </div>
        </div>

        {ollamaModels.length > 0 && (
          <div className="field-row" style={{ flex: "1 1 180px", marginBottom: 0 }}>
            <label>Modelo</label>
            <select value={selectedModel || ollamaModels[0]} onChange={(e) => setSelectedModel(e.target.value)}>
              {ollamaModels.map((m) => <option key={m} value={m}>{m}</option>)}
            </select>
          </div>
        )}

        {keyRequired && (
          <div className="field-row" style={{ flex: "2 1 260px", marginBottom: 0 }}>
            <label>Chave de API</label>
            <input type="password" value={apiKey} onChange={(e) => setApiKey(e.target.value)} placeholder="Cole sua chave (não é salva)" />
          </div>
        )}

        <div style={{ alignSelf: "flex-end", display: "flex", gap: 8 }}>
          {pendingSuggestions > 0 && (
            <button
              type="button"
              style={{ background: "#16a34a", color: "#fff", border: "none", borderRadius: 6, padding: "8px 14px", cursor: "pointer", fontSize: 13, fontWeight: 600 }}
              onClick={handleAcceptAll}
            >
              ✓ Aceitar todas ({pendingSuggestions})
            </button>
          )}
          <button
            type="button"
            disabled={improvingAll || !selectedProvider || (keyRequired && !apiKey.trim())}
            onClick={() => void handleImproveAll()}
          >
            {improvingAll ? "Melhorando…" : "Melhorar tudo"}
          </button>
        </div>
      </div>

      {/* Per-row per-section list */}
      {localRows.map((row) => (
        <div key={row.rowId} style={{ marginBottom: 28 }}>
          {localRows.length > 1 && (
            <h4 style={{ margin: "0 0 10px", fontSize: 14, color: "#374151" }}>
              {row.rowLabel || `Caso ${localRows.indexOf(row) + 1}`}
            </h4>
          )}

          <div className="case-details-block">
            <label>
              Particularidades deste caso
              <span> (opcional — a IA usará para adaptar os textos sem inventar fatos)</span>
            </label>
            <textarea
              rows={3}
              placeholder="Ex: celular com tela quebrada, Cellebrite nao suportou extracao logica, apenas chip SIM foi extraido, dois chips instalados..."
              value={caseDetails[row.rowId] ?? ""}
              onChange={(e) => setCaseDetails((prev) => ({ ...prev, [row.rowId]: e.target.value }))}
            />
          </div>

          {sortedSections.map((s) => {
            const st = getState(row.rowId, s.id);
            const text = row.sectionTexts[s.id] ?? "";
            if (!text.trim()) return null;
            return (
              <div key={s.id} style={{ border: "1px solid #dde1e7", borderRadius: 8, padding: 14, marginBottom: 10 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                  <strong style={{ fontSize: 13, color: "#1e293b" }}>{s.label.toUpperCase()}</strong>
                  <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                    {st.accepted === true && <span style={{ color: "#16a34a", fontSize: 12, fontWeight: 700 }}>✓ Aceito</span>}
                    {st.accepted === false && <span style={{ color: "#6b7280", fontSize: 12 }}>Original mantido</span>}
                    {/* Show accept/reject only when there are ACTUAL changes (non-empty diff) */}
                    {st.diff !== null && st.diff.length > 0 && st.accepted === null && (
                      <>
                        <button type="button" style={{ padding: "4px 12px", fontSize: 12, background: "#16a34a", color: "#fff", border: "none", borderRadius: 4, cursor: "pointer" }} onClick={() => handleAccept(row, s.id, true)}>
                          Aceitar
                        </button>
                        <button type="button" className="secondary" style={{ padding: "4px 10px", fontSize: 12 }} onClick={() => handleAccept(row, s.id, false)}>
                          Manter original
                        </button>
                      </>
                    )}
                    {!st.aiText && st.accepted === null && (
                      <button
                        type="button"
                        className="secondary"
                        style={{ padding: "4px 12px", fontSize: 12 }}
                        disabled={st.improving || !selectedProvider || (keyRequired && !apiKey.trim())}
                        onClick={() => void handleImprove(row, s.id)}
                      >
                        {st.improving ? "Melhorando…" : "Melhorar"}
                      </button>
                    )}
                  </div>
                </div>

                {st.error && <div className="error-banner" style={{ padding: "6px 10px", fontSize: 12, marginBottom: 8 }}>{st.error}</div>}

                <div style={{ fontSize: 12, color: "#6b7280", marginBottom: 4 }}>TEXTO ATUAL</div>
                <div style={{ fontSize: 13, lineHeight: 1.6, whiteSpace: "pre-wrap", maxHeight: 120, overflow: "auto", padding: "6px 8px", background: "#f8fafc", borderRadius: 4 }}>
                  {row.sectionTexts[s.id]}
                </div>

                {st.diff !== null && st.accepted === null && (
                  <div style={{ marginTop: 10 }}>
                    {/* Warnings from sanitizer — show regardless of whether there were changes */}
                    {st.warnings.length > 0 && (
                      <div style={{ fontSize: 11, color: "#b45309", background: "#fef3c7", border: "1px solid #fde68a", borderRadius: 4, padding: "4px 10px", marginBottom: 6 }}>
                        {st.warnings.includes("summarized") && "⚠ IA abreviou o texto — original restaurado. "}
                        {st.warnings.includes("hallucinated") && "⚠ IA reescreveu o conteúdo (alucinação) — original restaurado. "}
                        {st.warnings.includes("echoed_context") && "⚠ IA ecoou o contexto — original restaurado. "}
                        {st.warnings.some((w) => w.startsWith("vars_destroyed")) && "⚠ IA destruiu variáveis — original restaurado. "}
                        {st.warnings.includes("preamble_stripped") && "• Prefixo removido automaticamente."}
                      </div>
                    )}
                    {st.diff.length > 0 && (
                      <>
                        <div style={{ fontSize: 12, color: "#6b7280", marginBottom: 4 }}>SUGESTÃO DA IA</div>
                        <DiffView diff={st.diff} />
                      </>
                    )}
                    {st.diff.length === 0 && st.warnings.length === 0 && (
                      <div style={{ fontSize: 12, color: "#6b7280", fontStyle: "italic" }}>
                        Sem alterações — IA confirmou que o texto já está correto para este caso.
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ))}

      {/* Bottom action bar */}
      <div className="batch-generate-bar" style={{ marginTop: 8 }}>
        <button
          type="button"
          className="secondary"
          style={{ background: "rgba(255,255,255,0.15)", color: "#fff", border: "1px solid rgba(255,255,255,0.3)" }}
          onClick={() => onSkip(localRows.map((r) => ({ ...r, caseDetails: caseDetails[r.rowId] ?? "" })))}
        >
          Pular IA →
        </button>
        {totalImproved > 0 && (
          <span className="batch-generate-count">
            {totalImproved} de {totalPending} seções melhoradas
          </span>
        )}
        <button
          type="button"
          className="batch-generate-btn"
          onClick={() => onContinue(localRows.map((r) => ({ ...r, caseDetails: caseDetails[r.rowId] ?? "" })))}
        >
          {totalImproved > 0 ? `Continuar com ${totalImproved} melhorias →` : "Continuar sem IA →"}
        </button>
      </div>
    </div>
  );
}
