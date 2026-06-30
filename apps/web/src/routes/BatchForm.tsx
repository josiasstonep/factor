import { useState } from "react";
import { generateBatch, uploadImage } from "../api/client";
import type { GenerateBatchResponse, Template } from "../api/types";

interface Props {
  template: Template;
  onGenerated: (result: GenerateBatchResponse) => void;
}

export default function BatchForm({ template, onGenerated }: Props) {
  const [rowLabel, setRowLabel] = useState("Caso 1");
  const [variableValues, setVariableValues] = useState<Record<string, string>>({});
  const [sectionTexts, setSectionTexts] = useState<Record<string, string>>({});
  const [imagePaths, setImagePaths] = useState<Record<string, string>>({});
  const [uploadingId, setUploadingId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleImageChange(placeholderId: string, file: File) {
    setUploadingId(placeholderId);
    setError(null);
    try {
      const { file_path } = await uploadImage(file);
      setImagePaths((prev) => ({ ...prev, [placeholderId]: file_path }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao enviar imagem.");
    } finally {
      setUploadingId(null);
    }
  }

  async function handleSubmit() {
    setSubmitting(true);
    setError(null);
    try {
      const result = await generateBatch(template.id, rowLabel, [
        {
          template_id: template.id,
          row_label: rowLabel,
          variables: template.variables.map((v) => ({
            variable_id: v.id,
            value: variableValues[v.id] ?? "",
          })),
          sections: template.sections.map((s) => ({
            section_id: s.id,
            text: sectionTexts[s.id] ?? "",
          })),
          images: template.image_placeholders
            .filter((p) => imagePaths[p.id])
            .map((p) => ({ placeholder_id: p.id, file_path: imagePaths[p.id], order: 0 })),
        },
      ]);
      onGenerated(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao gerar o laudo.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="card">
      <h2>3. Preencher dados do laudo</h2>
      {error && <div className="error-banner">{error}</div>}

      <div className="field-row">
        <label>Identificação do caso</label>
        <input type="text" value={rowLabel} onChange={(e) => setRowLabel(e.target.value)} />
      </div>

      <h3>Cabeçalho</h3>
      {template.variables.map((v) => (
        <div className="field-row" key={v.id}>
          <label>{v.label}</label>
          <input
            type="text"
            value={variableValues[v.id] ?? ""}
            onChange={(e) => setVariableValues((prev) => ({ ...prev, [v.id]: e.target.value }))}
          />
        </div>
      ))}

      <h3 style={{ marginTop: 24 }}>Seções</h3>
      {template.sections
        .slice()
        .sort((a, b) => a.order - b.order)
        .map((s) => (
          <div className="field-row" key={s.id}>
            <label>{s.label}</label>
            <textarea
              value={sectionTexts[s.id] ?? ""}
              onChange={(e) => setSectionTexts((prev) => ({ ...prev, [s.id]: e.target.value }))}
              placeholder={s.default_text ?? ""}
            />
          </div>
        ))}

      {template.image_placeholders.length > 0 && (
        <>
          <h3 style={{ marginTop: 24 }}>Imagens</h3>
          {template.image_placeholders.map((p) => (
            <div className="field-row" key={p.id}>
              <label>{p.label}</label>
              <div>
                <input
                  type="file"
                  accept="image/*"
                  disabled={uploadingId === p.id}
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) void handleImageChange(p.id, file);
                  }}
                />
                {imagePaths[p.id] && <p className="hint">Imagem enviada ✓</p>}
              </div>
            </div>
          ))}
        </>
      )}

      <div className="actions">
        <button type="button" disabled={submitting} onClick={handleSubmit}>
          {submitting ? "Gerando…" : "Gerar laudo"}
        </button>
      </div>
    </div>
  );
}
