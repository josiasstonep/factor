import { useEffect, useState } from "react";
import { acceptSection, improveSection, listAiProviders, reportDocxUrl } from "../api/client";
import type {
  AiProviderInfo,
  DiffOp,
  GenerateBatchResponse,
  GeneratedReport,
} from "../api/types";
import DiffView from "../components/DiffView";

interface Props {
  result: GenerateBatchResponse;
  aiImprovableSectionIds: Set<string>;
  onDone: () => void;
}

interface SectionState {
  improving: boolean;
  aiText: string | null;
  diff: DiffOp[] | null;
  accepted: boolean;
  error: string | null;
}

type SectionKey = `${string}::${string}`; // reportId::sectionId

function key(reportId: string, sectionId: string): SectionKey {
  return `${reportId}::${sectionId}`;
}

export default function AiImprove({ result, aiImprovableSectionIds, onDone }: Props) {
  const [providers, setProviders] = useState<AiProviderInfo[]>([]);
  const [selectedProvider, setSelectedProvider] = useState<string>("");
  const [apiKey, setApiKey] = useState("");
  const [sections, setSections] = useState<Record<SectionKey, SectionState>>({});
  const [improvingAll, setImprovingAll] = useState(false);

  useEffect(() => {
    listAiProviders().then((ps) => {
      const available = ps.filter((p) => p.available);
      setProviders(ps);
      if (available.length > 0) setSelectedProvider(available[0].name);
    });
  }, []);

  const provider = providers.find((p) => p.name === selectedProvider);
  const keyRequired = provider?.requires_key ?? false;

  function updateSection(reportId: string, sectionId: string, patch: Partial<SectionState>) {
    const k = key(reportId, sectionId);
    setSections((prev) => ({ ...prev, [k]: { ...prev[k], ...patch } as SectionState }));
  }

  function getSection(reportId: string, sectionId: string): SectionState {
    return (
      sections[key(reportId, sectionId)] ?? {
        improving: false,
        aiText: null,
        diff: null,
        accepted: false,
        error: null,
      }
    );
  }

  async function handleImprove(report: GeneratedReport, sectionId: string) {
    updateSection(report.id, sectionId, { improving: true, error: null });
    try {
      const res = await improveSection(
        report.id,
        sectionId,
        selectedProvider,
        keyRequired ? apiKey || null : null,
        null,
      );
      updateSection(report.id, sectionId, {
        improving: false,
        aiText: res.ai_text,
        diff: res.diff,
        accepted: false,
      });
    } catch (err) {
      updateSection(report.id, sectionId, {
        improving: false,
        error: err instanceof Error ? err.message : "Erro desconhecido.",
      });
    }
  }

  async function handleAccept(reportId: string, sectionId: string, accept: boolean) {
    await acceptSection(reportId, sectionId, accept);
    updateSection(reportId, sectionId, { accepted: accept });
  }

  async function handleImproveAll() {
    if (keyRequired && !apiKey.trim()) return;
    setImprovingAll(true);
    for (const report of result.reports) {
      for (const s of report.sections) {
        if (!aiImprovableSectionIds.has(s.section_id)) continue;
        await handleImprove(report, s.section_id);
      }
    }
    setImprovingAll(false);
  }

  const improvablePairs: { report: GeneratedReport; sectionId: string }[] = [];
  for (const report of result.reports) {
    for (const s of report.sections) {
      if (aiImprovableSectionIds.has(s.section_id)) {
        improvablePairs.push({ report, sectionId: s.section_id });
      }
    }
  }

  return (
    <div className="card">
      <h2>6. Melhorar com IA</h2>
      <p className="hint">
        Selecione um provedor de IA para melhorar as seções dos laudos. O texto original é
        preservado — você revisa e aceita cada sugestão.
      </p>

      {/* ── Provider selector ── */}
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 16 }}>
        <div className="field-row" style={{ flex: "1 1 200px", marginBottom: 0 }}>
          <label>Provedor</label>
          <select
            value={selectedProvider}
            onChange={(e) => setSelectedProvider(e.target.value)}
          >
            {providers.map((p) => (
              <option key={p.name} value={p.name} disabled={!p.available}>
                {p.label}{!p.available ? " (indisponível)" : ""}
              </option>
            ))}
          </select>
        </div>

        {keyRequired && (
          <div className="field-row" style={{ flex: "2 1 300px", marginBottom: 0 }}>
            <label>Chave de API</label>
            <input
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="Cole sua chave aqui (não é salva)"
            />
          </div>
        )}

        <div style={{ alignSelf: "flex-end" }}>
          <button
            type="button"
            onClick={() => void handleImproveAll()}
            disabled={improvingAll || (keyRequired && !apiKey.trim())}
          >
            {improvingAll ? "Melhorando…" : "Melhorar tudo"}
          </button>
        </div>
      </div>

      {/* ── Per-report per-section ── */}
      {result.reports.map((report) => {
        const improvable = report.sections.filter((s) =>
          aiImprovableSectionIds.has(s.section_id),
        );
        if (improvable.length === 0) return null;
        return (
          <div key={report.id} style={{ marginBottom: 24 }}>
            <h4 style={{ marginBottom: 8 }}>{report.row_label ?? report.id}</h4>
            {improvable.map((s) => {
              const st = getSection(report.id, s.section_id);
              return (
                <div
                  key={s.section_id}
                  style={{
                    border: "1px solid #dde1e7",
                    borderRadius: 6,
                    padding: 12,
                    marginBottom: 10,
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                    <strong style={{ fontSize: 13 }}>Seção {s.section_id.slice(0, 8)}</strong>
                    <div style={{ display: "flex", gap: 8 }}>
                      {st.aiText && !st.accepted && (
                        <>
                          <button
                            type="button"
                            style={{ padding: "4px 12px", fontSize: 12, background: "#2e7d32", color: "#fff", border: "none", borderRadius: 4 }}
                            onClick={() => void handleAccept(report.id, s.section_id, true)}
                          >
                            Aceitar
                          </button>
                          <button
                            type="button"
                            className="secondary"
                            style={{ padding: "4px 12px", fontSize: 12 }}
                            onClick={() => void handleAccept(report.id, s.section_id, false)}
                          >
                            Manter original
                          </button>
                        </>
                      )}
                      {st.accepted && (
                        <span style={{ color: "#2e7d32", fontSize: 12, fontWeight: 600 }}>✓ Aceito</span>
                      )}
                      {!st.aiText && (
                        <button
                          type="button"
                          className="secondary"
                          style={{ padding: "4px 12px", fontSize: 12 }}
                          disabled={st.improving || (keyRequired && !apiKey.trim())}
                          onClick={() => void handleImprove(report, s.section_id)}
                        >
                          {st.improving ? "Melhorando…" : "Melhorar"}
                        </button>
                      )}
                    </div>
                  </div>

                  {st.error && (
                    <div className="error-banner" style={{ padding: "6px 10px", fontSize: 12 }}>
                      {st.error}
                    </div>
                  )}

                  <div style={{ fontSize: 13 }}>
                    <div style={{ color: "#848b96", marginBottom: 4, fontSize: 11 }}>ORIGINAL</div>
                    <p style={{ margin: 0, lineHeight: 1.6, whiteSpace: "pre-wrap" }}>{s.original_text}</p>
                  </div>

                  {st.diff && (
                    <div style={{ marginTop: 10, fontSize: 13 }}>
                      <div style={{ color: "#848b96", marginBottom: 4, fontSize: 11 }}>SUGESTÃO DA IA</div>
                      <DiffView diff={st.diff} />
                    </div>
                  )}
                </div>
              );
            })}
            <a href={reportDocxUrl(report.id)} download={`${report.row_label ?? report.id}.docx`}>
              <button type="button" className="secondary" style={{ fontSize: 12, padding: "5px 12px" }}>
                Baixar DOCX (com melhorias aceitas)
              </button>
            </a>
          </div>
        );
      })}

      <div className="actions" style={{ marginTop: 16 }}>
        <button type="button" className="secondary" onClick={onDone}>
          Voltar aos resultados
        </button>
      </div>
    </div>
  );
}
