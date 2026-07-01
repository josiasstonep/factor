import { useState } from "react";
import { updateTemplate, uploadImage } from "../api/client";
import type {
  ImagePlaceholderType,
  SectionType,
  Template,
  TemplateImagePlaceholder,
  TemplateSection,
  TemplateVariable,
} from "../api/types";

interface Props {
  template: Template;
  onConfirmed: (template: Template) => void;
}

const SECTION_TYPE_LABELS: Record<SectionType, string> = {
  historia: "História",
  descricao: "Descrição",
  analise: "Análise",
  conclusao: "Conclusão",
  custom: "Personalizada",
};

const IMAGE_TYPE_LABELS: Record<ImagePlaceholderType, string> = {
  vestigio: "Foto de Vestígio",
  local_crime: "Foto do Local",
  custom: "Personalizada",
};

const SIDECAR_PORT = 8731;

function uid() {
  return crypto.randomUUID();
}

function move<T>(arr: T[], index: number, dir: -1 | 1): T[] {
  const target = index + dir;
  if (target < 0 || target >= arr.length) return arr;
  const copy = [...arr];
  [copy[index], copy[target]] = [copy[target], copy[index]];
  return copy.map((item, i) => ({ ...item, order: i }) as T);
}

function filePathToPreviewUrl(filePath: string): string {
  const normalized = filePath.replace(/\\/g, "/");
  const parts = normalized.split("/images/");
  if (parts.length >= 2) {
    return `http://127.0.0.1:${SIDECAR_PORT}/uploads-static/images/${parts[parts.length - 1]}`;
  }
  return "";
}

export default function TemplateStructureEditor({ template, onConfirmed }: Props) {
  const [name, setName] = useState(template.name);
  const [sections, setSections] = useState<TemplateSection[]>(template.sections);
  const [variables, setVariables] = useState<TemplateVariable[]>(template.variables);
  const [labelOverrides, setLabelOverrides] = useState<Record<string, string>>({});
  const [imagePlaceholders, setImagePlaceholders] = useState<TemplateImagePlaceholder[]>(
    template.image_placeholders,
  );
  const [headerImagePath, setHeaderImagePath] = useState<string | null>(template.header_image_path);
  const [footerImagePath, setFooterImagePath] = useState<string | null>(template.footer_image_path);
  const [headerPreviewUrl, setHeaderPreviewUrl] = useState<string | null>(
    template.header_image_path ? filePathToPreviewUrl(template.header_image_path) : null,
  );
  const [footerPreviewUrl, setFooterPreviewUrl] = useState<string | null>(
    template.footer_image_path ? filePathToPreviewUrl(template.footer_image_path) : null,
  );
  const [uploadingHeader, setUploadingHeader] = useState(false);
  const [uploadingFooter, setUploadingFooter] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function updateSection(id: string, patch: Partial<TemplateSection>) {
    setSections((prev) => prev.map((s) => (s.id === id ? { ...s, ...patch } : s)));
  }

  function updateVariable(id: string, patch: Partial<TemplateVariable>) {
    setVariables((prev) => prev.map((v) => (v.id === id ? { ...v, ...patch } : v)));
  }

  function updateImagePlaceholder(id: string, patch: Partial<TemplateImagePlaceholder>) {
    setImagePlaceholders((prev) => prev.map((p) => (p.id === id ? { ...p, ...patch } : p)));
  }

  async function handleHeaderUpload(file: File) {
    setUploadingHeader(true);
    setError(null);
    try {
      const { file_path } = await uploadImage(file);
      setHeaderImagePath(file_path);
      setHeaderPreviewUrl(filePathToPreviewUrl(file_path));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao enviar imagem de cabeçalho.");
    } finally {
      setUploadingHeader(false);
    }
  }

  async function handleFooterUpload(file: File) {
    setUploadingFooter(true);
    setError(null);
    try {
      const { file_path } = await uploadImage(file);
      setFooterImagePath(file_path);
      setFooterPreviewUrl(filePathToPreviewUrl(file_path));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao enviar imagem de rodapé.");
    } finally {
      setUploadingFooter(false);
    }
  }

  async function handleConfirm() {
    setSaving(true);
    setError(null);
    try {
      const finalVariables = variables.map((v) => ({
        ...v,
        label: labelOverrides[v.id]?.trim() || v.label,
      }));
      const updated = await updateTemplate(template.id, {
        name,
        sections,
        variables: finalVariables,
        image_placeholders: imagePlaceholders,
        confirm: true,
        header_image_path: headerImagePath,
        footer_image_path: footerImagePath,
      });
      onConfirmed(updated);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao confirmar o template.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="card">
      <h2>2. Corrigir estrutura extraída</h2>
      <p className="hint">
        Revise o que foi detectado no PDF. A extração é automática e pode errar — ajuste
        tipo, rótulo e ordem, apague o que não fizer sentido e adicione o que faltou.
      </p>
      {error && <div className="error-banner">{error}</div>}

      <div className="field-row">
        <label>Nome do template</label>
        <input type="text" value={name} onChange={(e) => setName(e.target.value)} />
      </div>

      {/* ── Header / Footer images ── */}
      <h3 style={{ marginTop: 28 }}>Cabeçalho e Rodapé (todas as páginas do DOCX)</h3>
      <div style={{ display: "flex", gap: 20, marginBottom: 16 }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 8 }}>
            Imagem de cabeçalho
          </div>
          {headerPreviewUrl ? (
            <div>
              <img src={headerPreviewUrl} alt="Cabeçalho" style={{ maxWidth: "100%", maxHeight: 80, objectFit: "contain", border: "1px solid #e5e7eb", borderRadius: 4, padding: 4 }} />
              <label style={{ display: "block", marginTop: 6, fontSize: 12, color: "#2563eb", cursor: "pointer", fontWeight: 600 }}>
                Trocar
                <input type="file" accept="image/*" style={{ display: "none" }} disabled={uploadingHeader}
                  onChange={(e) => { const f = e.target.files?.[0]; if (f) void handleHeaderUpload(f); }} />
              </label>
            </div>
          ) : (
            <label style={{ display: "block", padding: "12px 16px", border: "2px dashed #d1d5db", borderRadius: 6, textAlign: "center", fontSize: 12, color: "#9ca3af", cursor: "pointer" }}>
              {uploadingHeader ? "Enviando…" : "Clique para selecionar imagem de cabeçalho"}
              <input type="file" accept="image/*" style={{ display: "none" }} disabled={uploadingHeader}
                onChange={(e) => { const f = e.target.files?.[0]; if (f) void handleHeaderUpload(f); }} />
            </label>
          )}
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 8 }}>
            Imagem de rodapé
          </div>
          {footerPreviewUrl ? (
            <div>
              <img src={footerPreviewUrl} alt="Rodapé" style={{ maxWidth: "100%", maxHeight: 80, objectFit: "contain", border: "1px solid #e5e7eb", borderRadius: 4, padding: 4 }} />
              <label style={{ display: "block", marginTop: 6, fontSize: 12, color: "#2563eb", cursor: "pointer", fontWeight: 600 }}>
                Trocar
                <input type="file" accept="image/*" style={{ display: "none" }} disabled={uploadingFooter}
                  onChange={(e) => { const f = e.target.files?.[0]; if (f) void handleFooterUpload(f); }} />
              </label>
            </div>
          ) : (
            <label style={{ display: "block", padding: "12px 16px", border: "2px dashed #d1d5db", borderRadius: 6, textAlign: "center", fontSize: 12, color: "#9ca3af", cursor: "pointer" }}>
              {uploadingFooter ? "Enviando…" : "Clique para selecionar imagem de rodapé"}
              <input type="file" accept="image/*" style={{ display: "none" }} disabled={uploadingFooter}
                onChange={(e) => { const f = e.target.files?.[0]; if (f) void handleFooterUpload(f); }} />
            </label>
          )}
        </div>
      </div>

      <h3>Seções</h3>
      <table>
        <thead>
          <tr>
            <th style={{ width: 70 }}>Ordem</th>
            <th style={{ width: 140 }}>Tipo</th>
            <th>Rótulo</th>
            <th>Texto detectado no PDF</th>
            <th style={{ width: 60 }}></th>
          </tr>
        </thead>
        <tbody>
          {sections
            .slice()
            .sort((a, b) => a.order - b.order)
            .map((s, i) => (
              <tr key={s.id}>
                <td>
                  <button type="button" className="secondary" onClick={() => setSections((p) => move(p, i, -1))}>
                    ↑
                  </button>{" "}
                  <button type="button" className="secondary" onClick={() => setSections((p) => move(p, i, 1))}>
                    ↓
                  </button>
                </td>
                <td>
                  <select
                    value={s.type}
                    onChange={(e) => updateSection(s.id, { type: e.target.value as SectionType })}
                  >
                    {Object.entries(SECTION_TYPE_LABELS).map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                </td>
                <td>
                  <input
                    type="text"
                    value={s.label}
                    onChange={(e) => updateSection(s.id, { label: e.target.value })}
                  />
                </td>
                <td>
                  <span className="hint">{s.heading_text ?? "(sem título detectado)"}</span>
                </td>
                <td>
                  <button
                    type="button"
                    className="secondary"
                    onClick={() => setSections((p) => p.filter((x) => x.id !== s.id))}
                  >
                    Apagar
                  </button>
                </td>
              </tr>
            ))}
        </tbody>
      </table>
      <button
        type="button"
        className="secondary"
        onClick={() =>
          setSections((p) => [
            ...p,
            { id: uid(), type: "custom", label: "Nova Seção", order: p.length, heading_text: null, is_ai_improvable: true, default_text: null },
          ])
        }
      >
        + Adicionar seção
      </button>

      <h3 style={{ marginTop: 28 }}>Variáveis de cabeçalho</h3>
      <table>
        <thead>
          <tr>
            <th style={{ width: 160 }}>Chave</th>
            <th>Rótulo</th>
            <th>Detectado no PDF</th>
            <th style={{ width: 60 }}></th>
          </tr>
        </thead>
        <tbody>
          {variables.map((v) => (
            <tr key={v.id}>
              <td>
                <input
                  type="text"
                  value={v.key}
                  onChange={(e) => updateVariable(v.id, { key: e.target.value })}
                />
              </td>
              <td>
                <input
                  type="text"
                  className="tpl-label-input"
                  placeholder={v.label}
                  value={labelOverrides[v.id] ?? ""}
                  onChange={(e) =>
                    setLabelOverrides((prev) => ({ ...prev, [v.id]: e.target.value }))
                  }
                />
              </td>
              <td>
                <span className="hint">{v.source_label_detected ?? "—"}</span>
              </td>
              <td>
                <button
                  type="button"
                  className="secondary"
                  onClick={() => setVariables((p) => p.filter((x) => x.id !== v.id))}
                >
                  Apagar
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <button
        type="button"
        className="secondary"
        onClick={() =>
          setVariables((p) => {
            const newId = uid();
            setLabelOverrides((prev) => ({ ...prev, [newId]: "" }));
            return [...p, { id: newId, key: `campo_${p.length + 1}`, label: "Novo Campo", source_label_detected: null, source_value_detected: null, required: true, value_type: "text" }];
          })
        }
      >
        + Adicionar variável
      </button>

      <h3 style={{ marginTop: 28 }}>Imagens</h3>
      <table>
        <thead>
          <tr>
            <th style={{ width: 160 }}>Tipo</th>
            <th>Rótulo</th>
            <th style={{ width: 60 }}></th>
          </tr>
        </thead>
        <tbody>
          {imagePlaceholders.map((p) => (
            <tr key={p.id}>
              <td>
                <select
                  value={p.type}
                  onChange={(e) =>
                    updateImagePlaceholder(p.id, { type: e.target.value as ImagePlaceholderType })
                  }
                >
                  {Object.entries(IMAGE_TYPE_LABELS).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </td>
              <td>
                <input
                  type="text"
                  value={p.label}
                  onChange={(e) => updateImagePlaceholder(p.id, { label: e.target.value })}
                />
              </td>
              <td>
                <button
                  type="button"
                  className="secondary"
                  onClick={() => setImagePlaceholders((prev) => prev.filter((x) => x.id !== p.id))}
                >
                  Apagar
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <button
        type="button"
        className="secondary"
        onClick={() =>
          setImagePlaceholders((p) => [
            ...p,
            { id: uid(), type: "custom", label: "Nova Imagem", order: p.length, max_count: 1, page_hint: null },
          ])
        }
      >
        + Adicionar imagem
      </button>

      <div className="actions">
        <button type="button" disabled={saving || sections.length === 0} onClick={handleConfirm}>
          {saving ? "Confirmando…" : "Confirmar estrutura"}
        </button>
      </div>
    </div>
  );
}
