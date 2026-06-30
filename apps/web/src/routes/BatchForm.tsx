import { useState } from "react";
import { generateBatch, uploadImage } from "../api/client";
import type { GenerateBatchResponse, ReportInputCreate, Template } from "../api/types";

interface Props {
  template: Template;
  onGenerated: (result: GenerateBatchResponse) => void;
}

interface RowState {
  rowId: string;
  rowLabel: string;
  variableValues: Record<string, string>;
  sectionTexts: Record<string, string>;
  imagePaths: Record<string, string>;
  uploadingId: string | null;
}

function createEmptyRow(index: number): RowState {
  return {
    rowId: crypto.randomUUID(),
    rowLabel: `Caso ${index + 1}`,
    variableValues: {},
    sectionTexts: {},
    imagePaths: {},
    uploadingId: null,
  };
}

export default function BatchForm({ template, onGenerated }: Props) {
  const [rows, setRows] = useState<RowState[]>([createEmptyRow(0)]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function updateRow(rowId: string, patch: Partial<RowState>) {
    setRows((prev) => prev.map((r) => (r.rowId === rowId ? { ...r, ...patch } : r)));
  }

  function addRow() {
    setRows((prev) => [...prev, createEmptyRow(prev.length)]);
  }

  function removeRow(rowId: string) {
    setRows((prev) => prev.filter((r) => r.rowId !== rowId));
  }

  async function handleImageChange(rowId: string, placeholderId: string, file: File) {
    updateRow(rowId, { uploadingId: placeholderId });
    setError(null);
    try {
      const { file_path } = await uploadImage(file);
      setRows((prev) =>
        prev.map((r) =>
          r.rowId === rowId
            ? { ...r, imagePaths: { ...r.imagePaths, [placeholderId]: file_path }, uploadingId: null }
            : r,
        ),
      );
    } catch (err) {
      updateRow(rowId, { uploadingId: null });
      setError(err instanceof Error ? err.message : "Falha ao enviar imagem.");
    }
  }

  async function handleSubmit() {
    if (rows.length === 0) return;
    setSubmitting(true);
    setError(null);
    try {
      const payload: ReportInputCreate[] = rows.map((row) => ({
        template_id: template.id,
        row_label: row.rowLabel,
        variables: template.variables.map((v) => ({
          variable_id: v.id,
          value: row.variableValues[v.id] ?? "",
        })),
        sections: template.sections.map((s) => ({
          section_id: s.id,
          text: row.sectionTexts[s.id] ?? "",
        })),
        images: template.image_placeholders
          .filter((p) => row.imagePaths[p.id])
          .map((p) => ({ placeholder_id: p.id, file_path: row.imagePaths[p.id], order: 0 })),
      }));

      const result = await generateBatch(template.id, `Batch ${new Date().toLocaleString("pt-BR")}`, payload);
      onGenerated(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao gerar laudos.");
    } finally {
      setSubmitting(false);
    }
  }

  const sortedSections = template.sections.slice().sort((a, b) => a.order - b.order);

  return (
    <div className="card">
      <h2>3. Preencher dados dos laudos</h2>
      <p className="hint">
        Cada linha abaixo gera um laudo DOCX separado. Adicione quantas linhas precisar.
      </p>
      {error && <div className="error-banner">{error}</div>}

      {rows.map((row, index) => (
        <details key={row.rowId} open={index === 0} style={{ marginBottom: 16 }}>
          <summary
            style={{
              cursor: "pointer",
              fontWeight: 600,
              padding: "10px 14px",
              background: "#f4f5f7",
              borderRadius: 6,
              userSelect: "none",
            }}
          >
            {row.rowLabel || `Caso ${index + 1}`}
            {rows.length > 1 && (
              <button
                type="button"
                className="secondary"
                style={{ marginLeft: 12, padding: "2px 10px", fontSize: 12 }}
                onClick={(e) => {
                  e.preventDefault();
                  removeRow(row.rowId);
                }}
              >
                Remover
              </button>
            )}
          </summary>

          <div style={{ padding: "16px 4px 0" }}>
            <div className="field-row">
              <label>Identificação</label>
              <input
                type="text"
                value={row.rowLabel}
                onChange={(e) => updateRow(row.rowId, { rowLabel: e.target.value })}
              />
            </div>

            {template.variables.length > 0 && (
              <>
                <h4 style={{ margin: "16px 0 8px" }}>Cabeçalho</h4>
                {template.variables.map((v) => (
                  <div className="field-row" key={v.id}>
                    <label>{v.label}</label>
                    <input
                      type="text"
                      value={row.variableValues[v.id] ?? ""}
                      onChange={(e) =>
                        updateRow(row.rowId, {
                          variableValues: { ...row.variableValues, [v.id]: e.target.value },
                        })
                      }
                    />
                  </div>
                ))}
              </>
            )}

            {sortedSections.length > 0 && (
              <>
                <h4 style={{ margin: "16px 0 8px" }}>Seções</h4>
                {sortedSections.map((s) => (
                  <div className="field-row" key={s.id}>
                    <label>{s.label}</label>
                    <textarea
                      value={row.sectionTexts[s.id] ?? ""}
                      onChange={(e) =>
                        updateRow(row.rowId, {
                          sectionTexts: { ...row.sectionTexts, [s.id]: e.target.value },
                        })
                      }
                      placeholder={s.default_text ?? ""}
                    />
                  </div>
                ))}
              </>
            )}

            {template.image_placeholders.length > 0 && (
              <>
                <h4 style={{ margin: "16px 0 8px" }}>Imagens</h4>
                {template.image_placeholders.map((p) => (
                  <div className="field-row" key={p.id}>
                    <label>{p.label}</label>
                    <div>
                      <input
                        type="file"
                        accept="image/*"
                        disabled={row.uploadingId === p.id}
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) void handleImageChange(row.rowId, p.id, file);
                        }}
                      />
                      {row.uploadingId === p.id && <p className="hint">Enviando…</p>}
                      {row.imagePaths[p.id] && row.uploadingId !== p.id && (
                        <p className="hint">Imagem enviada ✓</p>
                      )}
                    </div>
                  </div>
                ))}
              </>
            )}
          </div>
        </details>
      ))}

      <button type="button" className="secondary" onClick={addRow} style={{ marginBottom: 16 }}>
        + Adicionar caso
      </button>

      <div className="actions">
        <span className="hint" style={{ alignSelf: "center" }}>
          {rows.length} {rows.length === 1 ? "laudo" : "laudos"} a gerar
        </span>
        <button type="button" disabled={submitting} onClick={handleSubmit}>
          {submitting ? "Gerando…" : `Gerar ${rows.length === 1 ? "laudo" : `${rows.length} laudos`}`}
        </button>
      </div>
    </div>
  );
}
