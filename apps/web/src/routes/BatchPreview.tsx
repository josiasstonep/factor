import { useRef, useState } from "react";
import { generateBatch, uploadImage } from "../api/client";
import { mergeStandardVars } from "../utils/standardVars";
import type { GenerateBatchResponse, ReportInputCreate, Template } from "../api/types";
import type { RowState } from "./BatchForm";

const SIDECAR_PORT = 8731;

const SIGNATURE_RE = /^(.+?)\s+Perito\s+Criminal\s+Mat\.\s*([\d-]+)\s*$/i;
const LIST_ITEM_RE = /^[·•–—•\-]\s|^Vest[ií]gio\s+\S+/u;
const SIG_UNDERLINE_RE = /_{4,}/;

interface Props {
  template: Template;
  rows: RowState[];
  onBack: () => void;
  onGenerated: (result: GenerateBatchResponse) => void;
  onRowsChange?: (rows: RowState[]) => void;
}

function templateFileToUrl(filePath: string): string {
  const normalized = filePath.replace(/\\/g, "/");
  const parts = normalized.split("/templates/");
  if (parts.length >= 2) {
    return `http://127.0.0.1:${SIDECAR_PORT}/templates-static/${parts[parts.length - 1]}`;
  }
  return "";
}

function filePathToPreviewUrl(filePath: string): string {
  const normalized = filePath.replace(/\\/g, "/");
  const parts = normalized.split("/images/");
  if (parts.length >= 2) {
    return `http://127.0.0.1:${SIDECAR_PORT}/uploads-static/images/${parts[parts.length - 1]}`;
  }
  return "";
}

function resolveVars(text: string, template: Template, variableValues: Record<string, string>): string {
  let result = text;
  for (const v of template.variables) {
    const val = v.source_value_detected ?? "";
    if (val.length >= 6) {
      const escaped = val.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/\s+/g, "\\s+");
      result = result.replace(new RegExp(escaped, "g"), `{{${v.key}}}`);
    }
  }
  for (const v of template.variables) {
    const value = variableValues[v.id] ?? "";
    result = result.replaceAll(`{{${v.key}}}`, value || `[${v.label}]`);
  }
  return result;
}

function renderSectionLines(rendered: string): React.ReactNode[] {
  const rawLines = rendered.split("\n");
  const lines: string[] = [];
  for (const rl of rawLines) {
    const um = rl.match(/^(.*?)(_{4,})\s*$/);
    if (um && um[1].trim()) { lines.push(um[1].trimEnd()); lines.push(um[2]); }
    else { lines.push(rl); }
  }
  let inQuote = false;
  return lines.map((line, i) => {
    if (!line.trim()) return null;
    const trimmed = line.trimStart();
    const stripped = trimmed.trimEnd();

    if (SIG_UNDERLINE_RE.test(trimmed) && trimmed.replace(/_{4,}/, "").trim() === "") {
      return <div key={i} className="doc-signature-line">{trimmed}</div>;
    }

    const sig = trimmed.match(SIGNATURE_RE);
    if (sig) {
      return (
        <div key={i} className="doc-signature-block">
          <div className="doc-signature-name">{sig[1].trim()}</div>
          <div className="doc-signature-role">Perito Criminal</div>
          <div className="doc-signature-mat">Mat. {sig[2].trim()}</div>
        </div>
      );
    }

    if (!inQuote) {
      if (
        trimmed.startsWith('“') ||
        trimmed.startsWith('„') ||
        trimmed.startsWith('«') ||
        trimmed.startsWith('"') ||
        trimmed.startsWith('[...')
      ) inQuote = true;
    }
    if (inQuote) {
      const endsQuote =
        stripped.endsWith('”') ||
        stripped.endsWith('»') ||
        stripped.endsWith('’') ||
        stripped.endsWith('"') ||
        stripped.includes('[...]');
      if (endsQuote) inQuote = false;
      return <p key={i} className="doc-section-quote">{line}</p>;
    }

    if (LIST_ITEM_RE.test(trimmed)) return <p key={i} className="doc-section-list">{line}</p>;
    return <p key={i}>{line}</p>;
  });
}

export default function BatchPreview({ template, rows, onBack, onGenerated, onRowsChange }: Props) {
  const effectiveTemplate = { ...template, variables: mergeStandardVars(template.variables) };
  const [activeTab, setActiveTab] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editingSection, setEditingSection] = useState<string | null>(null);
  const [editingVar, setEditingVar] = useState<string | null>(null);
  const [uploadingId, setUploadingId] = useState<string | null>(null);
  const imgInputRefs = useRef<Record<string, HTMLInputElement | null>>({});

  const sortedSections = effectiveTemplate.sections.slice().sort((a, b) => a.order - b.order);
  const imagesBySectionId = effectiveTemplate.image_placeholders.reduce<Record<string, typeof template.image_placeholders>>((acc, p) => {
    const key = p.section_id ?? "__orphan__";
    acc[key] = [...(acc[key] ?? []), p];
    return acc;
  }, {});
  const orphanImages = imagesBySectionId["__orphan__"] ?? [];
  const allImages = effectiveTemplate.image_placeholders.slice().sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

  const row = rows[activeTab] ?? rows[0];

  function updateActiveRow(patch: Partial<RowState>) {
    if (!onRowsChange) return;
    const updated = rows.map((r, i) => i === activeTab ? { ...r, ...patch } : r);
    onRowsChange(updated);
  }

  async function handleImageChange(placeholderId: string, file: File) {
    setUploadingId(placeholderId);
    setError(null);
    try {
      const { file_path } = await uploadImage(file);
      const previewUrl = filePathToPreviewUrl(file_path);
      updateActiveRow({
        imagePaths: { ...row.imagePaths, [placeholderId]: file_path },
        imagePreviewUrls: { ...row.imagePreviewUrls, [placeholderId]: previewUrl },
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao enviar imagem.");
    } finally {
      setUploadingId(null);
    }
  }

  async function handleGenerate() {
    setSubmitting(true);
    setError(null);
    try {
      const payload: ReportInputCreate[] = rows.map((r) => ({
        template_id: template.id,
        row_label: r.rowLabel,
        variables: effectiveTemplate.variables.map((v) => ({
          variable_id: v.id,
          value: r.variableValues[v.id] ?? "",
        })),
        sections: effectiveTemplate.sections.map((s) => ({
          section_id: s.id,
          text: r.sectionTexts[s.id] ?? "",
        })),
        images: effectiveTemplate.image_placeholders
          .filter((p) => r.imagePaths[p.id])
          .map((p) => ({ placeholder_id: p.id, file_path: r.imagePaths[p.id], order: 0 })),
      }));

      const result = await generateBatch(template.id, `Batch ${new Date().toLocaleString("pt-BR")}`, payload);
      onGenerated(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao gerar laudos.");
    } finally {
      setSubmitting(false);
    }
  }

  const canEdit = !!onRowsChange;

  return (
    <div>
      {error && <div className="error-banner">{error}</div>}

      {/* ── Case tabs ── */}
      <div className="preview-tabs">
        {rows.map((r, i) => {
          const filled = effectiveTemplate.variables.every((v) => (r.variableValues[v.id] ?? "").trim() !== "");
          const imgCount = allImages.filter((p) => r.imagePaths[p.id]).length;
          return (
            <button key={r.rowId} type="button" className={`preview-tab ${i === activeTab ? "active" : ""}`} onClick={() => { setActiveTab(i); setEditingSection(null); setEditingVar(null); }}>
              <span className="preview-tab-name">{r.rowLabel || `Caso ${i + 1}`}</span>
              <span className="preview-tab-badges">
                <span className={`preview-tab-badge ${filled ? "ok" : "warn"}`}>{filled ? "✓" : "!"} dados</span>
                {allImages.length > 0 && (
                  <span className={`preview-tab-badge ${imgCount === allImages.length ? "ok" : imgCount > 0 ? "warn" : "empty"}`}>
                    {imgCount}/{allImages.length} fotos
                  </span>
                )}
              </span>
            </button>
          );
        })}
      </div>

      {/* ── Document preview (A4-like paper) ── */}
      <div className="doc-paper preview-paper">
        {/* Header */}
        {template.header_image_path ? (
          <div className="doc-inst-header" style={{ padding: 0, background: "none", border: "none" }}>
            <img src={templateFileToUrl(template.header_image_path)} alt="Cabeçalho institucional" style={{ width: "100%", display: "block" }} />
          </div>
        ) : (
          <div className="doc-inst-header">
            Governo do Estado de Pernambuco — Secretaria de Defesa Social<br />
            Gerência Geral de Polícia Científica<br />
            Unidade Regional de Polícia Científica Sertão Setentrional — Salgueiro
          </div>
        )}

        {/* Variables table — editable in preview */}
        {effectiveTemplate.variables.length > 0 && (
          <table className="doc-vars-table" style={{ marginBottom: 24 }}>
            <tbody>
              {effectiveTemplate.variables.map((v) => {
                const value = (row.variableValues[v.id] ?? "").trim();
                const isEditing = canEdit && editingVar === v.id;
                return (
                  <tr key={v.id}>
                    <td className="doc-var-label">{v.label}</td>
                    <td
                      style={{ fontSize: 12, fontWeight: value ? 600 : 400, color: value ? "#000" : "#9ca3af", fontStyle: value ? "normal" : "italic", cursor: canEdit ? "text" : "default", minWidth: 120 }}
                      onClick={() => { if (canEdit && !isEditing) setEditingVar(v.id); }}
                    >
                      {isEditing ? (
                        <input
                          autoFocus
                          style={{ width: "100%", fontSize: 12, fontWeight: 600, border: "1px solid #93c5fd", borderRadius: 3, padding: "1px 4px", outline: "none" }}
                          value={row.variableValues[v.id] ?? ""}
                          onChange={(e) => updateActiveRow({ variableValues: { ...row.variableValues, [v.id]: e.target.value } })}
                          onBlur={() => setEditingVar(null)}
                          onKeyDown={(e) => { if (e.key === "Enter" || e.key === "Escape") setEditingVar(null); }}
                        />
                      ) : (
                        <span title={canEdit ? "Clique para editar" : undefined}>
                          {value || `[${v.label} não preenchido]`}
                          {canEdit && <span style={{ marginLeft: 4, fontSize: 10, opacity: 0.4, fontWeight: 400 }}>✏</span>}
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}

        {/* Sections */}
        {sortedSections.map((s, idx) => {
          const rawText = row.sectionTexts[s.id] ?? "";
          const rendered = resolveVars(rawText, effectiveTemplate, row.variableValues);
          const sectionImages = imagesBySectionId[s.id] ?? [];
          const isEditing = canEdit && editingSection === s.id;

          return (
            <div className="doc-section" key={s.id}>
              <div className="doc-section-heading" style={{ cursor: "default", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <span><span className="doc-section-number">{idx + 1}.</span>{s.label.toUpperCase()}</span>
                {canEdit && !isEditing && (
                  <button type="button" className="secondary" style={{ fontSize: 11, padding: "2px 10px", marginLeft: 8 }} onClick={() => setEditingSection(s.id)}>
                    Editar
                  </button>
                )}
                {isEditing && (
                  <button type="button" className="secondary" style={{ fontSize: 11, padding: "2px 10px", marginLeft: 8 }} onClick={() => setEditingSection(null)}>
                    Fechar
                  </button>
                )}
              </div>

              {isEditing ? (
                <textarea
                  className="doc-textarea"
                  value={rawText}
                  rows={10}
                  autoFocus
                  onChange={(e) => updateActiveRow({ sectionTexts: { ...row.sectionTexts, [s.id]: e.target.value } })}
                  onBlur={() => setEditingSection(null)}
                />
              ) : (
                <div
                  className={`doc-section-preview${canEdit ? "" : " preview-readonly"}`}
                  onClick={() => { if (canEdit) setEditingSection(s.id); }}
                  title={canEdit ? "Clique para editar" : undefined}
                  style={{ cursor: canEdit ? "text" : "default" }}
                >
                  {rendered
                    ? renderSectionLines(rendered)
                    : <span className="doc-section-empty">{canEdit ? "Clique para digitar…" : "Seção sem texto."}</span>}
                </div>
              )}

              {/* Section images */}
              {sectionImages.length > 0 && (
                <div className="preview-images">
                  {sectionImages.map((p) => {
                    const previewUrl = row.imagePreviewUrls[p.id] ?? null;
                    const refUrl = p.preview_image_path ? templateFileToUrl(p.preview_image_path) : null;
                    const src = previewUrl ?? refUrl;
                    const caption = resolveVars(p.label, effectiveTemplate, row.variableValues);
                    const isUploading = uploadingId === p.id;
                    return (
                      <div key={p.id} className="preview-image-block">
                        <input
                          type="file"
                          accept="image/*"
                          style={{ display: "none" }}
                          ref={(el) => { imgInputRefs.current[p.id] = el; }}
                          onChange={(e) => { const f = e.target.files?.[0]; if (f) handleImageChange(p.id, f); e.target.value = ""; }}
                        />
                        {src ? (
                          <div style={{ position: "relative", display: "inline-block" }}>
                            <img src={src} alt={caption} className="preview-image-img" />
                            {canEdit && (
                              <button
                                type="button"
                                onClick={() => imgInputRefs.current[p.id]?.click()}
                                disabled={isUploading}
                                style={{ position: "absolute", top: 4, right: 4, fontSize: 10, padding: "2px 6px", background: "rgba(0,0,0,0.6)", color: "#fff", border: "none", borderRadius: 4, cursor: "pointer" }}
                              >
                                {isUploading ? "…" : "Trocar"}
                              </button>
                            )}
                            {!previewUrl && refUrl && (
                              <div className="preview-image-ref-note">foto do modelo</div>
                            )}
                          </div>
                        ) : canEdit ? (
                          <div
                            className="preview-image-empty"
                            style={{ cursor: "pointer", borderStyle: "dashed" }}
                            onClick={() => imgInputRefs.current[p.id]?.click()}
                          >
                            {isUploading ? "Enviando…" : `+ ${caption}`}
                          </div>
                        ) : (
                          <div className="preview-image-empty">[ {caption} — sem foto ]</div>
                        )}
                        <div className="preview-image-caption">{caption}</div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}

        {/* Orphan images */}
        {orphanImages.length > 0 && (
          <div className="preview-images">
            {orphanImages.map((p) => {
              const previewUrl = row.imagePreviewUrls[p.id] ?? null;
              const refUrl = p.preview_image_path ? templateFileToUrl(p.preview_image_path) : null;
              const src = previewUrl ?? refUrl;
              const caption = resolveVars(p.label, effectiveTemplate, row.variableValues);
              const isUploading = uploadingId === p.id;
              return (
                <div key={p.id} className="preview-image-block">
                  <input
                    type="file"
                    accept="image/*"
                    style={{ display: "none" }}
                    ref={(el) => { imgInputRefs.current[p.id] = el; }}
                    onChange={(e) => { const f = e.target.files?.[0]; if (f) handleImageChange(p.id, f); e.target.value = ""; }}
                  />
                  {src ? (
                    <div style={{ position: "relative", display: "inline-block" }}>
                      <img src={src} alt={caption} className="preview-image-img" />
                      {canEdit && (
                        <button
                          type="button"
                          onClick={() => imgInputRefs.current[p.id]?.click()}
                          disabled={isUploading}
                          style={{ position: "absolute", top: 4, right: 4, fontSize: 10, padding: "2px 6px", background: "rgba(0,0,0,0.6)", color: "#fff", border: "none", borderRadius: 4, cursor: "pointer" }}
                        >
                          {isUploading ? "…" : "Trocar"}
                        </button>
                      )}
                    </div>
                  ) : canEdit ? (
                    <div className="preview-image-empty" style={{ cursor: "pointer", borderStyle: "dashed" }} onClick={() => imgInputRefs.current[p.id]?.click()}>
                      {isUploading ? "Enviando…" : `+ ${caption}`}
                    </div>
                  ) : (
                    <div className="preview-image-empty">[ {caption} — sem foto ]</div>
                  )}
                  <div className="preview-image-caption">{caption}</div>
                </div>
              );
            })}
          </div>
        )}

        {/* Footer */}
        {template.footer_image_path && (
          <div style={{ marginTop: 32 }}>
            <img src={templateFileToUrl(template.footer_image_path)} alt="Rodapé" style={{ width: "100%", display: "block" }} />
          </div>
        )}
      </div>

      {/* ── Bottom action bar ── */}
      <div className="batch-generate-bar" style={{ marginTop: 16 }}>
        <button
          type="button"
          className="secondary"
          style={{ background: "rgba(255,255,255,0.15)", color: "#fff", border: "1px solid rgba(255,255,255,0.3)" }}
          onClick={onBack}
        >
          {String.fromCharCode(8592)} Voltar e editar
        </button>
        <span className="batch-generate-count">
          {rows.length} {rows.length === 1 ? "laudo" : "laudos"} prontos para gerar
        </span>
        <button type="button" className="batch-generate-btn" disabled={submitting} onClick={handleGenerate}>
          {submitting ? "Gerando…" : rows.length === 1 ? "Gerar laudo DOCX" : `Gerar ${rows.length} laudos DOCX`}
        </button>
      </div>
    </div>
  );
}
