import { useState } from "react";
import { updateTemplate } from "../api/client";
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

export default function TemplateStructureEditor({ template, onConfirmed }: Props) {
  const [name, setName] = useState(template.name);
  const [sections, setSections] = useState<TemplateSection[]>(template.sections);
  const [variables, setVariables] = useState<TemplateVariable[]>(template.variables);
  const [imagePlaceholders, setImagePlaceholders] = useState<TemplateImagePlaceholder[]>(
    template.image_placeholders,
  );
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

  async function handleConfirm() {
    setSaving(true);
    setError(null);
    try {
      const updated = await updateTemplate(template.id, {
        name,
        sections,
        variables,
        image_placeholders: imagePlaceholders,
        confirm: true,
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
                  value={v.label}
                  onChange={(e) => updateVariable(v.id, { label: e.target.value })}
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
          setVariables((p) => [
            ...p,
            { id: uid(), key: `campo_${p.length + 1}`, label: "Novo Campo", source_label_detected: null, required: true, value_type: "text" },
          ])
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
