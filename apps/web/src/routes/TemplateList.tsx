import { useEffect, useState } from "react";
import { listTemplates, parseTemplate } from "../api/client";
import type { Template } from "../api/types";

interface Props {
  onSelect: (template: Template) => void;
  onUploadNew: (template: Template) => void;
}

export default function TemplateList({ onSelect, onUploadNew }: Props) {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    listTemplates()
      .then((ts) => setTemplates(ts))
      .catch(() => setTemplates([]))
      .finally(() => setLoading(false));
  }, []);

  async function handleFile(file: File) {
    setUploading(true);
    setError(null);
    try {
      const draft = await parseTemplate(file);
      onUploadNew(draft);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao fazer upload do PDF.");
    } finally {
      setUploading(false);
    }
  }

  const confirmed = templates.filter((t) => t.status === "confirmed");
  const drafts = templates.filter((t) => t.status !== "confirmed");

  return (
    <div className="card">
      <h2>Templates de Laudo</h2>

      {error && <div className="error-banner">{error}</div>}

      {loading ? (
        <p className="hint">Carregando templates…</p>
      ) : confirmed.length > 0 ? (
        <>
          <p className="hint">Selecione um template salvo ou faça upload de um novo PDF.</p>
          <table style={{ marginBottom: 16 }}>
            <thead>
              <tr>
                <th>Nome</th>
                <th>PDF de origem</th>
                <th>Seções</th>
                <th style={{ width: 90 }}>Ação</th>
              </tr>
            </thead>
            <tbody>
              {confirmed.map((t) => (
                <tr key={t.id}>
                  <td style={{ fontWeight: 600 }}>{t.name}</td>
                  <td style={{ color: "#848b96", fontSize: 12 }}>{t.source_pdf_filename}</td>
                  <td style={{ color: "#848b96", fontSize: 12 }}>{t.sections.length} seções</td>
                  <td>
                    <button
                      type="button"
                      style={{ padding: "4px 14px", fontSize: 13 }}
                      onClick={() => onSelect(t)}
                    >
                      Usar
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      ) : (
        <p className="hint">
          Nenhum template salvo ainda. Faça upload de um PDF de laudo para começar.
        </p>
      )}

      <div
        style={{
          border: "2px dashed #c8cdd6",
          borderRadius: 8,
          padding: 24,
          textAlign: "center",
          background: "#fafbfc",
        }}
      >
        <p style={{ margin: "0 0 12px", color: "#5a6272" }}>
          {confirmed.length > 0 ? "Ou faça upload de um novo PDF" : "Selecione um PDF de laudo pericial"}
        </p>
        <label>
          <input
            type="file"
            accept=".pdf"
            style={{ display: "none" }}
            disabled={uploading}
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void handleFile(f);
            }}
          />
          <span
            style={{
              display: "inline-block",
              padding: "8px 20px",
              background: uploading ? "#aaa" : "#1a56db",
              color: "#fff",
              borderRadius: 6,
              cursor: uploading ? "not-allowed" : "pointer",
              fontSize: 14,
            }}
          >
            {uploading ? "Enviando…" : "Selecionar PDF…"}
          </span>
        </label>
      </div>

      {drafts.length > 0 && (
        <details style={{ marginTop: 16 }}>
          <summary style={{ cursor: "pointer", color: "#848b96", fontSize: 12 }}>
            {drafts.length} rascunho(s) não confirmado(s)
          </summary>
          <ul style={{ fontSize: 12, color: "#848b96", marginTop: 6 }}>
            {drafts.map((t) => (
              <li key={t.id}>{t.name || t.source_pdf_filename}</li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}
