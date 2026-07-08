import { useState } from "react";
import { generateBatch } from "../api/client";
import { mergeStandardVars } from "../utils/standardVars";
import type { GenerateBatchResponse, ReportInputCreate, Template } from "../api/types";
import type { RowState } from "./BatchForm";

const SIDECAR_PORT = 8731;

// Matches "Josias Stone Pinheiro dos Santos Perito Criminal Mat. 18435416-01"
const SIGNATURE_RE = /^(.+?)\s+Perito\s+Criminal\s+Mat\.\s*([\d-]+)\s*$/i;
// Matches list items: bullet chars or "Vestígio N"
const LIST_ITEM_RE = /^[·•–—•\-]\s|^Vest[ií]gio\s+\S+/u;

interface Props {
  template: Template;
  rows: RowState[];
  onBack: () => void;
  onGenerated: (result: GenerateBatchResponse) => void;
}

function templateFileToUrl(filePath: string): string {
  const normalized = filePath.replace(/\\/g, "/");
  const parts = normalized.split("/templates/");
  if (parts.length >= 2) {
    return `http://127.0.0.1:${SIDECAR_PORT}/templates-static/${parts[parts.length - 1]}`;
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

export default function BatchPreview({ template, rows, onBack, onGenerated }: Props) {
  const effectiveTemplate = { ...template, variables: mergeStandardVars(template.variables) };
  const [activeTab, setActiveTab] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const sortedSections = effectiveTemplate.sections.slice().sort((a, b) => a.order - b.order);

  const imagesBySectionId = effectiveTemplate.image_placeholders.reduce<
    Record<string, typeof template.image_placeholders>
  >((acc, p) => {
    const key = p.section_id ?? "__orphan__";
    acc[key] = [...(acc[key] ?? []), p];
    return acc;
  }, {});
  const orphanImages = imagesBySectionId["__orphan__"] ?? [];

  const allImages = effectiveTemplate.image_placeholders.slice().sort(
    (a, b) => (a.order ?? 0) - (b.order ?? 0),
  );

  async function handleGenerate() {
    setSubmitting(true);
    setError(null);
    try {
      const payload: ReportInputCreate[] = rows.map((row) => ({
        template_id: template.id,
        row_label: row.rowLabel,
        variables: effectiveTemplate.variables.map((v) => ({
          variable_id: v.id,
          value: row.variableValues[v.id] ?? "",
        })),
        sections: effectiveTemplate.sections.map((s) => ({
          section_id: s.id,
          text: row.sectionTexts[s.id] ?? "",
        })),
        images: effectiveTemplate.image_placeholders
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
      <div className="preview-tabs">
        {rows.map((r, i) => {
          const filled = effectiveTemplate.variables.every((v) => (r.variableValues[v.id] ?? "").trim() !== "");
          const imgCount = allImages.filter((p) => r.imagePaths[p.id]).length;
          return (
            <button
              key={r.rowId}
              type="button"
              className={`preview-tab ${i === activeTab ? "active" : ""}`}
              onClick={() => setActiveTab(i)}
            >
              <span className="preview-tab-name">{r.rowLabel || `Caso ${i + 1}`}</span>
              <span className="preview-tab-badges">
                <span className={`preview-tab-badge ${filled ? "ok" : "warn"}`}>
                  {filled ? "✓" : "!"} dados
                </span>
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
        {/* Institutional header */}
        {template.header_image_path ? (
          <div className="doc-inst-header" style={{ padding: 0, background: "none", border: "none" }}>
            <img
              src={templateFileToUrl(template.header_image_path)}
              alt="Cabeçalho institucional"
              style={{ width: "100%", display: "block" }}
            />
          </div>
        ) : (
          <div className="doc-inst-header">
            Governo do Estado de Pernambuco — Secretaria de Defesa Social<br />
            Gerência Geral de Polícia Científica<br />
            Unidade Regional de Polícia Científica Sertão Setentrional — Salgueiro
          </div>
        )}

        {/* Variables table */}
        {effectiveTemplate.variables.length > 0 && (
          <table className="doc-vars-table" style={{ marginBottom: 24 }}>
            <tbody>
              {effectiveTemplate.variables.map((v) => {
                const value = (row.variableValues[v.id] ?? "").trim();
                return (
                  <tr key={v.id}>
                    <td className="doc-var-label">{v.label}</td>
                    <td style={{ fontSize: 12, fontWeight: value ? 600 : 400, color: value ? "#000" : "#9ca3af", fontStyle: value ? "normal" : "italic" }}>
                      {value || `[${v.label} não preenchido]`}
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

          return (
            <div className="doc-section" key={s.id}>
              <div className="doc-section-heading" style={{ cursor: "default" }}>
                <span className="doc-section-number">{idx + 1}.</span>
                {s.label.toUpperCase()}
              </div>

              <div className=”doc-section-preview preview-readonly”>
                {rendered
                  ? rendered.split(“\n”).map((line, i) => {
                      if (!line.trim()) return null;
                      const trimmed = line.trimStart();

                      // Perito signature → 3 centered lines (matches _postprocess_signature in DOCX)
                      const sig = trimmed.match(SIGNATURE_RE);
                      if (sig) {
                        return (
                          <div key={i} className=”doc-signature-block”>
                            <div className=”doc-signature-name”>{sig[1].trim()}</div>
                            <div className=”doc-signature-role”>Perito Criminal</div>
                            <div className=”doc-signature-mat”>Mat. {sig[2].trim()}</div>
                          </div>
                        );
                      }

                      // Block quote: starts with opening quote char (matches _is_quote_start in DOCX)
                      if (
                        trimmed.startsWith('”') ||
                        trimmed.startsWith('“') ||
                        trimmed.startsWith('„') ||
                        trimmed.startsWith('«') ||
                        trimmed.startsWith('[...')
                      ) return <p key={i} className=”doc-section-quote”>{line}</p>;

                      // List item: bullet or “Vestígio N” → no first-line indent
                      if (LIST_ITEM_RE.test(trimmed)) return <p key={i} className=”doc-section-list”>{line}</p>;

                      return <p key={i}>{line}</p>;
                    })
                  : <span className=”doc-section-empty”>Seção sem texto.</span>}
              </div>

              {/* Section images */}
              {sectionImages.length > 0 && (
                <div className="preview-images">
                  {sectionImages.map((p) => {
                    const previewUrl = row.imagePreviewUrls[p.id] ?? null;
                    const refUrl = p.preview_image_path ? templateFileToUrl(p.preview_image_path) : null;
                    const src = previewUrl ?? refUrl;
                    const caption = resolveVars(p.label, effectiveTemplate, row.variableValues);
                    return (
                      <div key={p.id} className="preview-image-block">
                        {src ? (
                          <>
                            <img src={src} alt={caption} className="preview-image-img" />
                            {!previewUrl && refUrl && (
                              <div className="preview-image-ref-note">foto do modelo (substituir no formulário)</div>
                            )}
                          </>
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
              return (
                <div key={p.id} className="preview-image-block">
                  {src ? (
                    <img src={src} alt={caption} className="preview-image-img" />
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
            <img
              src={templateFileToUrl(template.footer_image_path)}
              alt="Rodapé"
              style={{ width: "100%", display: "block" }}
            />
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
          ← Voltar e editar
        </button>
        <span className="batch-generate-count">
          {rows.length} {rows.length === 1 ? "laudo" : "laudos"} prontos para gerar
        </span>
        <button
          type="button"
          className="batch-generate-btn"
          disabled={submitting}
          onClick={handleGenerate}
        >
          {submitting
            ? "Gerando…"
            : rows.length === 1
            ? "Gerar laudo DOCX"
            : `Gerar ${rows.length} laudos DOCX`}
        </button>
      </div>
    </div>
  );
}
