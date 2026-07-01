import { useState } from "react";
import { generateBatch, uploadImage } from "../api/client";
import type { GenerateBatchResponse, ReportInputCreate, Template, TemplateVariable } from "../api/types";

const SIDECAR_PORT = 8731;

const VARIABLE_HINTS: Record<string, string> = {
  oficio: "ex: 11 (86414402)",
  sei: "ex: 3900000825.000159/2026-68",
  vestigio: "ex: 74C5AC5E-4",
  lacre: "ex: 1343769",
  rep: "ex: 28203/2026",
  processo: "ex: 0000152-35.2026.8.17.2250",
  marca: "ex: XIAOMI, SAMSUNG, APPLE",
};

interface Props {
  template: Template;
  onGenerated: (result: GenerateBatchResponse) => void;
}

interface RowState {
  rowId: string;
  rowLabel: string;
  variableValues: Record<string, string>;   // keyed by variable.id
  sectionTexts: Record<string, string>;     // keyed by section.id
  imagePaths: Record<string, string>;
  imagePreviewUrls: Record<string, string>;
  uploadingId: string | null;
}

/**
 * Replace detected source values in section text with {{key}} placeholders.
 * Mirrors the Python _inject_placeholders logic so old (pre-injection) templates
 * also get proper substitution without needing a re-parse.
 */
function injectPlaceholders(text: string, variables: TemplateVariable[]): string {
  let result = text;
  for (const v of variables) {
    const val = v.source_value_detected ?? "";
    if (val.length < 6) continue;
    // Build a regex that matches the value with any whitespace between tokens
    // (PDFs often insert newlines mid-value when extracted)
    const escaped = val.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/\s+/g, "\\s+");
    result = result.replace(new RegExp(escaped, "g"), `{{${v.key}}}`);
  }
  return result;
}

function createEmptyRow(index: number, template: Template): RowState {
  const variableValues: Record<string, string> = {};

  // Apply placeholder injection so old templates (confirmed before server-side
  // injection was added) also get {{key}} substitution in section text
  const sectionTexts: Record<string, string> = {};
  for (const s of template.sections) {
    const raw = s.default_text ?? "";
    sectionTexts[s.id] = injectPlaceholders(raw, template.variables);
  }

  return {
    rowId: crypto.randomUUID(),
    rowLabel: `Caso ${index + 1}`,
    variableValues,
    sectionTexts,
    imagePaths: {},
    imagePreviewUrls: {},
    uploadingId: null,
  };
}

function filePathToPreviewUrl(filePath: string): string {
  const normalized = filePath.replace(/\\/g, "/");
  const parts = normalized.split("/images/");
  if (parts.length >= 2) {
    return `http://127.0.0.1:${SIDECAR_PORT}/uploads-static/images/${parts[parts.length - 1]}`;
  }
  return "";
}

/**
 * Resolve section text for preview:
 * 1. Run placeholder injection so old templates (literal values, no {{key}}) are also handled
 * 2. Substitute each {{key}} with the user's current value, falling back to the
 *    source_value_detected (template example) and then to [label]
 */
function resolveVars(text: string, template: Template, variableValues: Record<string, string>): string {
  // Inject first — no-op when {{key}} placeholders are already present
  let result = injectPlaceholders(text, template.variables);
  for (const v of template.variables) {
    const value = variableValues[v.id] ?? "";
    result = result.replaceAll(`{{${v.key}}}`, value || `[${v.label}]`);
  }
  return result;
}

export default function BatchForm({ template, onGenerated }: Props) {
  const [rows, setRows] = useState<RowState[]>([createEmptyRow(0, template)]);
  const [activeTab, setActiveTab] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // sections being edited (show textarea instead of preview)
  const [editingSections, setEditingSections] = useState<Record<string, boolean>>({});

  const sortedSections = template.sections.slice().sort((a, b) => a.order - b.order);

  function updateRow(rowId: string, patch: Partial<RowState>) {
    setRows((prev) => prev.map((r) => (r.rowId === rowId ? { ...r, ...patch } : r)));
  }

  function addRow() {
    const next = rows.length;
    setRows((prev) => [...prev, createEmptyRow(next, template)]);
    setActiveTab(next);
  }

  function removeRow(index: number) {
    if (rows.length === 1) return;
    setRows((prev) => prev.filter((_, i) => i !== index));
    setActiveTab(Math.min(activeTab, rows.length - 2));
  }

  async function handleImageChange(rowId: string, placeholderId: string, file: File) {
    updateRow(rowId, { uploadingId: placeholderId });
    setError(null);
    try {
      const { file_path } = await uploadImage(file);
      const previewUrl = filePathToPreviewUrl(file_path);
      setRows((prev) =>
        prev.map((r) =>
          r.rowId === rowId
            ? {
                ...r,
                imagePaths: { ...r.imagePaths, [placeholderId]: file_path },
                imagePreviewUrls: { ...r.imagePreviewUrls, [placeholderId]: previewUrl },
                uploadingId: null,
              }
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

      const result = await generateBatch(
        template.id,
        `Batch ${new Date().toLocaleString("pt-BR")}`,
        payload,
      );
      onGenerated(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao gerar laudos.");
    } finally {
      setSubmitting(false);
    }
  }

  const row = rows[activeTab] ?? rows[0];

  return (
    <div>
      {error && <div className="error-banner">{error}</div>}

      {/* ── Case tabs ── */}
      <div className="case-tabs">
        {rows.map((r, i) => (
          <button
            key={r.rowId}
            type="button"
            className={`case-tab ${i === activeTab ? "active" : ""}`}
            onClick={() => setActiveTab(i)}
          >
            {r.rowLabel || `Caso ${i + 1}`}
            {rows.length > 1 && (
              <span
                className="case-tab-remove"
                role="button"
                title="Remover caso"
                onClick={(e) => {
                  e.stopPropagation();
                  removeRow(i);
                }}
              >
                ×
              </span>
            )}
          </button>
        ))}
        <button type="button" className="case-tab-add" onClick={addRow}>
          + Caso
        </button>
      </div>

      {/* ── Paper canvas ── */}
      <div className="doc-paper">
        {/* Institutional header */}
        {template.header_image_path ? (
          <div className="doc-inst-header" style={{ padding: 0, background: "none", border: "none" }}>
            <img
              src={filePathToPreviewUrl(template.header_image_path)}
              alt="Cabeçalho institucional"
              style={{ width: "100%", display: "block" }}
            />
          </div>
        ) : (
          <div className="doc-inst-header">
            Governo do Estado de Pernambuco — Secretaria de Defesa Social<br />
            Gerência Geral de Polícia Científica — Instituto de Criminalística Prof. Armando Samico<br />
            Unidade Regional de Polícia Científica Sertão Setentrional — Salgueiro
          </div>
        )}

        {/* Case identification */}
        <div className="doc-row-label-row">
          <label>Identificação</label>
          <input
            type="text"
            value={row.rowLabel}
            onChange={(e) => updateRow(row.rowId, { rowLabel: e.target.value })}
            placeholder="Ex: MAIR FREDSON — iPhone 7"
          />
        </div>

        {/* ── Variables table ── */}
        {template.variables.length > 0 && (
          <table className="doc-vars-table">
            <tbody>
              {template.variables.map((v) => (
                <tr key={v.id}>
                  <td className="doc-var-label">{v.label}</td>
                  <td>
                    <input
                      type="text"
                      className="doc-var-input"
                      value={row.variableValues[v.id] ?? ""}
                      placeholder={VARIABLE_HINTS[v.key] ?? ""}
                      onChange={(e) =>
                        updateRow(row.rowId, {
                          variableValues: { ...row.variableValues, [v.id]: e.target.value },
                        })
                      }
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {/* ── Sections ── */}
        {sortedSections.map((s, idx) => {
          const isEditing = editingSections[s.id] ?? false;
          const rawText = row.sectionTexts[s.id] ?? "";
          const rendered = resolveVars(rawText, template, row.variableValues);

          return (
            <div className="doc-section" key={s.id}>
              <div className="doc-section-heading">
                <span className="doc-section-number">{idx + 1}.</span>
                {s.label.toUpperCase()}
                <button
                  type="button"
                  className="secondary"
                  style={{ marginLeft: "auto", padding: "2px 10px", fontSize: 11, fontWeight: 600, textTransform: "none", letterSpacing: 0, flexShrink: 0 }}
                  onClick={() =>
                    setEditingSections((prev) => ({ ...prev, [s.id]: !isEditing }))
                  }
                >
                  {isEditing ? "Visualizar" : "Editar"}
                </button>
              </div>

              {isEditing ? (
                <textarea
                  className="doc-textarea"
                  value={rawText}
                  onChange={(e) =>
                    updateRow(row.rowId, {
                      sectionTexts: { ...row.sectionTexts, [s.id]: e.target.value },
                    })
                  }
                  rows={10}
                  autoFocus
                />
              ) : (
                <div
                  className="doc-section-preview"
                  onClick={() =>
                    setEditingSections((prev) => ({ ...prev, [s.id]: true }))
                  }
                  title="Clique para editar"
                >
                  {rendered
                    ? rendered.split("\n").map((line, i) => {
                        if (!line.trim()) return null;
                        const isQuote = line.trimStart().startsWith('"') || line.trimStart().startsWith('"') || line.trimStart().startsWith('"[');
                        return isQuote
                          ? <p key={i} className="doc-section-quote">{line}</p>
                          : <p key={i}>{line}</p>;
                      })
                    : <span className="doc-section-empty">Clique para digitar o conteúdo desta seção…</span>}
                </div>
              )}
            </div>
          );
        })}

        {/* ── Images ── */}
        {template.image_placeholders.length > 0 && (
          <div className="doc-section">
            <div className="doc-section-heading">
              <span className="doc-section-number">{sortedSections.length + 1}</span>
              IMAGENS / ANEXOS
            </div>
            <div className="doc-images">
              {template.image_placeholders.map((p) => (
                <ImageZone
                  key={p.id}
                  label={p.label}
                  uploading={row.uploadingId === p.id}
                  previewUrl={row.imagePreviewUrls[p.id] ?? null}
                  onFile={(file) => void handleImageChange(row.rowId, p.id, file)}
                />
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ── Generate bar ── */}
      <div className="doc-generate-bar">
        <span>
          {rows.length} {rows.length === 1 ? "laudo a gerar" : "laudos a gerar"}
        </span>
        <button type="button" disabled={submitting} onClick={handleSubmit}>
          {submitting ? "Gerando…" : `Gerar ${rows.length === 1 ? "laudo" : `${rows.length} laudos`}`}
        </button>
      </div>
    </div>
  );
}

interface ImageZoneProps {
  label: string;
  uploading: boolean;
  previewUrl: string | null;
  onFile: (file: File) => void;
}

function ImageZone({ label, uploading, previewUrl, onFile }: ImageZoneProps) {
  return (
    <div className="doc-image-zone">
      <div style={{ fontSize: 11, fontWeight: 700, color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6 }}>
        {label}
      </div>

      {previewUrl ? (
        <div>
          <img src={previewUrl} alt={label} className="doc-image-preview" />
          <div className="doc-image-caption">{label}</div>
          <div className="doc-image-change">
            <label style={{ fontSize: 12, color: "#2563eb", cursor: "pointer", fontWeight: 600 }}>
              Trocar imagem
              <input
                type="file"
                accept="image/*"
                style={{ display: "none" }}
                disabled={uploading}
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) onFile(file);
                }}
              />
            </label>
          </div>
        </div>
      ) : (
        <div className="doc-image-drop">
          <input
            type="file"
            accept="image/*"
            disabled={uploading}
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) onFile(file);
            }}
          />
          <div className="doc-image-drop-label">
            {uploading ? "Enviando…" : <><strong>Clique para selecionar</strong> ou arraste uma imagem</>}
          </div>
        </div>
      )}
    </div>
  );
}
