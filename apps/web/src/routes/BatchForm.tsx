import { useEffect, useRef, useState } from "react";
import { createDelegacia, createPerito, deleteDelegacia, deletePerito, listDelegacias, listPeritos, uploadImage } from "../api/client";
import { mergeStandardVars } from "../utils/standardVars";
import { deletePreset, getPresets, savePreset } from "../utils/varPresets";
import type { Delegacia, Perito, Template, TemplateVariable } from "../api/types";

const SIDECAR_PORT = 8731;

const VARIABLE_HINTS: Record<string, string> = {
  oficio: "ex: 11 (86414402)",
  sei: "ex: 3900000825.000159/2026-68",
  vestigio: "ex: 74C5AC5E-4",
  lacre: "ex: 1343769",
  rep: "ex: 28203/2026",
  processo: "ex: 0000152-35.2026.8.17.2250",
  marca: "ex: XIAOMI, SAMSUNG, APPLE",
  delegacia_requisitante: "ex: 170ª CIRCUNSCRIÇÃO - ITAPETIM - PCPE",
  nome_perito: "ex: Josias Stone Pinheiro Dos Santos",
  trecho_solicitacao: "Cole o trecho da solicitação que aparece entre colchetes no Histórico",
};

const LONG_TEXT_KEYS = new Set(["trecho_solicitacao"]);

interface Props {
  template: Template;
  initialRows?: RowState[];
  onPreview: (rows: RowState[]) => void;
}

export interface RowState {
  rowId: string;
  rowLabel: string;
  variableValues: Record<string, string>;
  sectionTexts: Record<string, string>;
  imagePaths: Record<string, string>;
  imagePreviewUrls: Record<string, string>;
  uploadingId: string | null;
  sectionsExpanded: boolean;
}

function injectPlaceholders(text: string, variables: TemplateVariable[]): string {
  let result = text;
  for (const v of variables) {
    const val = v.source_value_detected ?? "";
    if (val.length < 6) continue;
    const escaped = val.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/\s+/g, "\\s+");
    result = result.replace(new RegExp(escaped, "g"), `{{${v.key}}}`);
  }
  return result;
}

function createEmptyRow(index: number, template: Template): RowState {
  const sectionTexts: Record<string, string> = {};
  for (const s of template.sections) {
    const raw = s.default_text ?? "";
    sectionTexts[s.id] = injectPlaceholders(raw, template.variables);
  }
  return {
    rowId: crypto.randomUUID(),
    rowLabel: `Caso ${index + 1}`,
    variableValues: {},
    sectionTexts,
    imagePaths: {},
    imagePreviewUrls: {},
    uploadingId: null,
    sectionsExpanded: false,
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

function templateFileToUrl(filePath: string): string {
  const normalized = filePath.replace(/\\/g, "/");
  const parts = normalized.split("/templates/");
  if (parts.length >= 2) {
    return `http://127.0.0.1:${SIDECAR_PORT}/templates-static/${parts[parts.length - 1]}`;
  }
  return "";
}

function resolveVars(text: string, template: Template, variableValues: Record<string, string>): string {
  let result = injectPlaceholders(text, template.variables);
  for (const v of template.variables) {
    const value = variableValues[v.id] ?? "";
    result = result.replaceAll(`{{${v.key}}}`, value || `[${v.label}]`);
  }
  return result;
}

export default function BatchForm({ template, initialRows, onPreview }: Props) {
  const effectiveTemplate = { ...template, variables: mergeStandardVars(template.variables) };
  const [rows, setRows] = useState<RowState[]>(initialRows ?? [createEmptyRow(0, effectiveTemplate)]);
  const [error, setError] = useState<string | null>(null);
  const [peritos, setPeritos] = useState<Perito[]>([]);
  const [delegacias, setDelegacias] = useState<Delegacia[]>([]);

  useEffect(() => {
    listPeritos().then(setPeritos).catch(() => {});
    listDelegacias().then(setDelegacias).catch(() => {});
  }, []);

  const sortedSections = effectiveTemplate.sections.slice().sort((a, b) => a.order - b.order);

  const imagesBySectionId = effectiveTemplate.image_placeholders.reduce<Record<string, typeof template.image_placeholders>>((acc, p) => {
    const key = p.section_id ?? "__orphan__";
    acc[key] = [...(acc[key] ?? []), p];
    return acc;
  }, {});
  const orphanImages = imagesBySectionId["__orphan__"] ?? [];
  const allImages = effectiveTemplate.image_placeholders.slice().sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

  function updateRow(rowId: string, patch: Partial<RowState>) {
    setRows((prev) => prev.map((r) => (r.rowId === rowId ? { ...r, ...patch } : r)));
  }

  function addRow() {
    setRows((prev) => [...prev, createEmptyRow(prev.length, template)]);
  }

  function removeRow(rowId: string) {
    if (rows.length === 1) return;
    setRows((prev) => prev.filter((r) => r.rowId !== rowId));
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

  function handlePreview() {
    onPreview(rows);
  }

  return (
    <div>
      {error && <div className="error-banner">{error}</div>}

      <div className="batch-cases">
        {rows.map((row, idx) => (
          <CaseCard
            key={row.rowId}
            row={row}
            index={idx}
            total={rows.length}
            template={effectiveTemplate}
            sortedSections={sortedSections}
            imagesBySectionId={imagesBySectionId}
            orphanImages={orphanImages}
            allImages={allImages}
            peritos={peritos}
            delegacias={delegacias}
            onPeritosChange={setPeritos}
            onDelegaciasChange={setDelegacias}
            onUpdate={(patch) => updateRow(row.rowId, patch)}
            onRemove={() => removeRow(row.rowId)}
            onImageChange={(pid, file) => handleImageChange(row.rowId, pid, file)}
          />
        ))}
      </div>

      <button
        type="button"
        className="batch-add-btn"
        onClick={addRow}
      >
        + Adicionar caso
      </button>

      <div className="batch-generate-bar">
        <span className="batch-generate-count">
          {rows.length} {rows.length === 1 ? "caso" : "casos"} preenchido{rows.length !== 1 ? "s" : ""}
        </span>
        <button
          type="button"
          className="batch-generate-btn"
          onClick={handlePreview}
        >
          {rows.length === 1 ? "Pré-visualizar laudo →" : `Pré-visualizar ${rows.length} laudos →`}
        </button>
      </div>
    </div>
  );
}

/* ── Variable field with preset quick-select ────────────────────────────── */

function VarField({
  variable,
  value,
  onChange,
  suggestions,
  onCreateNew,
  onDeleteSuggestion,
}: {
  variable: TemplateVariable;
  value: string;
  onChange: (val: string) => void;
  suggestions?: { label: string; value: string; id: string }[];
  onCreateNew?: () => void;
  onDeleteSuggestion?: (id: string) => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [presets, setPresets] = useState<string[]>(() => getPresets(variable.key));
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, [open]);

  function handleSave() {
    if (!value.trim()) return;
    savePreset(variable.key, value);
    setPresets(getPresets(variable.key));
  }

  function handleSelect(preset: string) {
    onChange(preset);
    setOpen(false);
  }

  function handleDelete(e: React.MouseEvent, preset: string) {
    e.stopPropagation();
    deletePreset(variable.key, preset);
    const updated = getPresets(variable.key);
    setPresets(updated);
    if (updated.length === 0) setOpen(false);
  }

  const isLong = LONG_TEXT_KEYS.has(variable.key);
  const [manualMode, setManualMode] = useState(!suggestions?.length);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const hasSuggestions = suggestions && suggestions.length > 0;
  const selectedSuggestion = hasSuggestions ? suggestions.find((s) => s.value === value) : undefined;

  return (
    <div ref={containerRef} className={`batch-var-field${isLong ? " batch-var-field--long" : ""}`} style={{ position: "relative" }}>
      <label className="batch-var-label">{variable.label}</label>
      {hasSuggestions && !manualMode && (
        <div className="var-suggestions-row">
          <select
            className="batch-var-input"
            value={value}
            onChange={(e) => {
              if (e.target.value === "__new__") { onCreateNew?.(); }
              else { onChange(e.target.value); setDeletingId(null); }
            }}
          >
            <option value="">— selecionar —</option>
            {suggestions.map((s) => (
              <option key={s.id} value={s.value}>{s.label}</option>
            ))}
            <option value="__new__">+ Cadastrar novo…</option>
          </select>
          {selectedSuggestion && onDeleteSuggestion && (
            deletingId === selectedSuggestion.id ? (
              <span style={{ display: "flex", gap: 4, alignItems: "center", whiteSpace: "nowrap" }}>
                <span style={{ fontSize: 11, color: "#dc2626", fontWeight: 700 }}>Excluir?</span>
                <button
                  type="button"
                  className="danger"
                  style={{ padding: "2px 8px", fontSize: 11 }}
                  onClick={async () => {
                    await onDeleteSuggestion(selectedSuggestion.id);
                    onChange("");
                    setDeletingId(null);
                  }}
                >Sim</button>
                <button
                  type="button"
                  className="secondary"
                  style={{ padding: "2px 8px", fontSize: 11 }}
                  onClick={() => setDeletingId(null)}
                >Não</button>
              </span>
            ) : (
              <button
                type="button"
                className="var-preset-btn"
                title="Excluir este cadastro"
                style={{ color: "#dc2626" }}
                onClick={() => setDeletingId(selectedSuggestion.id)}
              >✕</button>
            )
          )}
          <button type="button" className="var-preset-btn" title="Digitar manualmente" onClick={() => setManualMode(true)}>✏</button>
        </div>
      )}
      {(!hasSuggestions || manualMode) && (
        <div className="var-input-row">
          {isLong ? (
            <textarea
              className="batch-var-input batch-var-textarea"
              value={value}
              placeholder={VARIABLE_HINTS[variable.key] ?? ""}
              rows={3}
              onChange={(e) => onChange(e.target.value)}
            />
          ) : (
            <input
              type="text"
              className="batch-var-input"
              value={value}
              placeholder={VARIABLE_HINTS[variable.key] ?? ""}
              onChange={(e) => onChange(e.target.value)}
            />
          )}
          <button
            type="button"
            className="var-preset-btn"
            title="Salvar como atalho"
            onClick={handleSave}
            disabled={!value.trim()}
          >
            ★
          </button>
          {presets.length > 0 && (
            <button
              type="button"
              className="var-preset-btn var-preset-open-btn"
              title="Ver atalhos salvos"
              onClick={() => setOpen((o) => !o)}
            >
              ▾
            </button>
          )}
        </div>
      )}
      {open && presets.length > 0 && (
        <div className="var-preset-dropdown">
          {presets.map((p) => (
            <div key={p} className="var-preset-item" onClick={() => handleSelect(p)}>
              <span className="var-preset-text">{p}</span>
              <button
                type="button"
                className="var-preset-delete"
                onClick={(e) => handleDelete(e, p)}
                title="Remover atalho"
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}
      {(!hasSuggestions || manualMode) && hasSuggestions && (
        <button type="button" className="var-preset-btn" style={{ marginTop: 2, fontSize: 10 }} onClick={() => setManualMode(false)}>← lista</button>
      )}
    </div>
  );
}

/* ── Case card component ─────────────────────────────────────────────────── */

interface CaseCardProps {
  row: RowState;
  index: number;
  total: number;
  template: Template;
  sortedSections: Template["sections"];
  imagesBySectionId: Record<string, Template["image_placeholders"]>;
  orphanImages: Template["image_placeholders"];
  allImages: Template["image_placeholders"];
  peritos: Perito[];
  delegacias: Delegacia[];
  onPeritosChange: (p: Perito[]) => void;
  onDelegaciasChange: (d: Delegacia[]) => void;
  onUpdate: (patch: Partial<RowState>) => void;
  onRemove: () => void;
  onImageChange: (placeholderId: string, file: File) => void;
}

function CaseCard({
  row,
  index,
  total,
  template,
  sortedSections,
  imagesBySectionId,
  orphanImages,
  allImages,
  peritos,
  delegacias,
  onPeritosChange,
  onDelegaciasChange,
  onUpdate,
  onRemove,
  onImageChange,
}: CaseCardProps) {
  const [editingSections, setEditingSections] = useState<Record<string, boolean>>({});
  const [newPeritoForm, setNewPeritoForm] = useState<{ nome: string; matricula: string } | null>(null);
  const [newDelForm, setNewDelForm] = useState<{ nome: string; municipio: string } | null>(null);

  async function handleCreatePerito() {
    if (!newPeritoForm?.nome.trim() || !newPeritoForm?.matricula.trim()) return;
    try {
      const created = await createPerito({ nome: newPeritoForm.nome, matricula: newPeritoForm.matricula });
      onPeritosChange([...peritos, created]);
      const newValues = { ...row.variableValues };
      const peritoVar = template.variables.find((v) => v.key === "nome_perito");
      if (peritoVar) newValues[peritoVar.id] = created.nome;
      const matVar = template.variables.find((v) => v.key === "matricula_perito");
      if (matVar) newValues[matVar.id] = created.matricula;
      onUpdate({ variableValues: newValues });
      setNewPeritoForm(null);
    } catch { /* ignore */ }
  }

  async function handleCreateDel() {
    if (!newDelForm?.nome.trim()) return;
    try {
      const created = await createDelegacia({ nome: newDelForm.nome, municipio: newDelForm.municipio });
      onDelegaciasChange([...delegacias, created]);
      const delVar = template.variables.find((v) => v.key === "delegacia_requisitante");
      if (delVar) {
        onUpdate({ variableValues: { ...row.variableValues, [delVar.id]: created.nome } });
      }
      setNewDelForm(null);
    } catch { /* ignore */ }
  }

  const uploadedCount = allImages.filter((p) => row.imagePaths[p.id]).length;
  const hasAllImages = allImages.length > 0 && uploadedCount === allImages.length;
  const hasAllVars = template.variables.every((v) => (row.variableValues[v.id] ?? "").trim() !== "");

  return (
    <div className="batch-case">
      {/* ── Header ── */}
      <div className="batch-case-header">
        <div className="batch-case-num">Caso {index + 1}</div>
        <input
          type="text"
          className="batch-case-label-input"
          value={row.rowLabel}
          placeholder="Ex: João — iPhone 13"
          onChange={(e) => onUpdate({ rowLabel: e.target.value })}
        />
        <div className="batch-case-status">
          <span title="Variáveis" className={`batch-status-dot ${hasAllVars ? "ok" : "empty"}`}>
            {hasAllVars ? "✓" : "○"} dados
          </span>
          <span title="Imagens" className={`batch-status-dot ${hasAllImages ? "ok" : uploadedCount > 0 ? "partial" : "empty"}`}>
            {hasAllImages ? "✓" : uploadedCount > 0 ? `${uploadedCount}/${allImages.length}` : "○"} fotos
          </span>
        </div>
        {total > 1 && (
          <button type="button" className="batch-case-remove" title="Remover caso" onClick={onRemove}>
            ✕
          </button>
        )}
      </div>

      {/* ── Variables grid ── */}
      {template.variables.length > 0 && (
        <div className="batch-vars-grid">
          {template.variables.map((v) => {
            let suggestions: { label: string; value: string; id: string }[] | undefined;
            let onCreateNew: (() => void) | undefined;
            let onDeleteSuggestion: ((id: string) => Promise<void>) | undefined;
            if (v.key === "nome_perito" && peritos.length > 0) {
              suggestions = peritos.map((p) => ({
                id: p.id,
                label: `${p.nome} — Mat. ${p.matricula}`,
                value: p.nome,
              }));
              onCreateNew = () => setNewPeritoForm({ nome: "", matricula: "" });
              onDeleteSuggestion = async (id) => {
                await deletePerito(id);
                onPeritosChange(peritos.filter((p) => p.id !== id));
              };
            } else if (v.key === "delegacia_requisitante" && delegacias.length > 0) {
              suggestions = delegacias.map((d) => ({
                id: d.id,
                label: d.municipio ? `${d.nome} — ${d.municipio}` : d.nome,
                value: d.nome,
              }));
              onCreateNew = () => setNewDelForm({ nome: "", municipio: "" });
              onDeleteSuggestion = async (id) => {
                await deleteDelegacia(id);
                onDelegaciasChange(delegacias.filter((d) => d.id !== id));
              };
            }
            return (
              <VarField
                key={v.id}
                variable={v}
                value={row.variableValues[v.id] ?? ""}
                suggestions={suggestions}
                onCreateNew={onCreateNew}
                onDeleteSuggestion={onDeleteSuggestion}
                onChange={(val) => {
                  const newValues = { ...row.variableValues, [v.id]: val };
                  // When selecting a perito by name, auto-fill matricula_perito
                  if (v.key === "nome_perito") {
                    const selectedPerito = peritos.find((p) => p.nome === val);
                    if (selectedPerito) {
                      const matVar = template.variables.find((v2) => v2.key === "matricula_perito");
                      if (matVar) newValues[matVar.id] = selectedPerito.matricula;
                    }
                  }
                  const patch: Partial<RowState> = { variableValues: newValues };
                  if (v.key === "rep") {
                    const defaultLabel = `Caso ${index + 1}`;
                    if (row.rowLabel === defaultLabel || row.rowLabel.startsWith("REP ")) {
                      patch.rowLabel = val.trim() ? `REP ${val.trim()}` : defaultLabel;
                    }
                  }
                  onUpdate(patch);
                }}
              />
            );
          })}
        </div>
      )}

      {/* ── Inline "Novo Perito" form ── */}
      {newPeritoForm && (
        <div className="entity-new-form">
          <strong>Novo Perito</strong>
          <input className="batch-var-input" placeholder="Nome completo" value={newPeritoForm.nome}
            onChange={(e) => setNewPeritoForm({ ...newPeritoForm, nome: e.target.value })} />
          <input className="batch-var-input" placeholder="Matrícula (ex: 18435416-01)" value={newPeritoForm.matricula}
            onChange={(e) => setNewPeritoForm({ ...newPeritoForm, matricula: e.target.value })} />
          <div style={{ display: "flex", gap: 8 }}>
            <button type="button" className="batch-generate-btn" style={{ flex: 1, padding: "6px 0" }} onClick={handleCreatePerito}>Salvar</button>
            <button type="button" className="secondary" onClick={() => setNewPeritoForm(null)}>Cancelar</button>
          </div>
        </div>
      )}

      {/* ── Inline "Nova Delegacia" form ── */}
      {newDelForm && (
        <div className="entity-new-form">
          <strong>Nova Delegacia</strong>
          <input className="batch-var-input" placeholder="Nome da delegacia" value={newDelForm.nome}
            onChange={(e) => setNewDelForm({ ...newDelForm, nome: e.target.value })} />
          <input className="batch-var-input" placeholder="Município" value={newDelForm.municipio}
            onChange={(e) => setNewDelForm({ ...newDelForm, municipio: e.target.value })} />
          <div style={{ display: "flex", gap: 8 }}>
            <button type="button" className="batch-generate-btn" style={{ flex: 1, padding: "6px 0" }} onClick={handleCreateDel}>Salvar</button>
            <button type="button" className="secondary" onClick={() => setNewDelForm(null)}>Cancelar</button>
          </div>
        </div>
      )}

      {/* ── Images row ── */}
      {allImages.length > 0 && (
        <div className="batch-images-row">
          {allImages.map((p) => (
            <CompactImageZone
              key={p.id}
              label={p.label}
              uploading={row.uploadingId === p.id}
              previewUrl={row.imagePreviewUrls[p.id] ?? null}
              referenceUrl={p.preview_image_path ? templateFileToUrl(p.preview_image_path) : null}
              onFile={(file) => onImageChange(p.id, file)}
              onRemove={() =>
                onUpdate({
                  imagePaths: Object.fromEntries(Object.entries(row.imagePaths).filter(([k]) => k !== p.id)),
                  imagePreviewUrls: Object.fromEntries(Object.entries(row.imagePreviewUrls).filter(([k]) => k !== p.id)),
                })
              }
            />
          ))}
        </div>
      )}

      {/* ── Section text accordion ── */}
      <div className="batch-sections-toggle">
        <button
          type="button"
          className="secondary batch-toggle-btn"
          onClick={() => onUpdate({ sectionsExpanded: !row.sectionsExpanded })}
        >
          {row.sectionsExpanded ? "▲ Ocultar texto das seções" : "▼ Ver/editar texto das seções"}
        </button>
      </div>

      {row.sectionsExpanded && (
        <div className="batch-sections-body">
          {sortedSections.map((s, sidx) => {
            const isEditing = editingSections[s.id] ?? false;
            const rawText = row.sectionTexts[s.id] ?? "";
            const rendered = resolveVars(rawText, template, row.variableValues);
            const sectionImages = imagesBySectionId[s.id] ?? [];

            return (
              <div className="batch-section" key={s.id}>
                <div className="batch-section-heading">
                  <span>{sidx + 1}. {s.label.toUpperCase()}</span>
                  <button
                    type="button"
                    className="secondary"
                    style={{ padding: "2px 10px", fontSize: 11, marginLeft: "auto", flexShrink: 0 }}
                    onClick={() => setEditingSections((prev) => ({ ...prev, [s.id]: !isEditing }))}
                  >
                    {isEditing ? "Visualizar" : "Editar"}
                  </button>
                </div>

                {isEditing ? (
                  <textarea
                    className="doc-textarea"
                    value={rawText}
                    onChange={(e) =>
                      onUpdate({ sectionTexts: { ...row.sectionTexts, [s.id]: e.target.value } })
                    }
                    rows={8}
                    autoFocus
                  />
                ) : (
                  <div
                    className="doc-section-preview"
                    onClick={() => setEditingSections((prev) => ({ ...prev, [s.id]: true }))}
                    title="Clique para editar"
                  >
                    {rendered
                      ? rendered.split("\n").map((line, i) => {
                          if (!line.trim()) return null;
                          const isQuote = line.trimStart().startsWith('"') || line.trimStart().startsWith('“') || line.trimStart().startsWith('„[');
                          return isQuote
                            ? <p key={i} className="doc-section-quote">{line}</p>
                            : <p key={i}>{line}</p>;
                        })
                      : <span className="doc-section-empty">Clique para digitar…</span>}
                  </div>
                )}

                {sectionImages.length > 0 && (
                  <div className="doc-images" style={{ marginTop: 8 }}>
                    {sectionImages.map((p) => (
                      <ImageZoneFull
                        key={p.id}
                        label={p.label}
                        uploading={row.uploadingId === p.id}
                        previewUrl={row.imagePreviewUrls[p.id] ?? null}
                        referenceUrl={p.preview_image_path ? templateFileToUrl(p.preview_image_path) : null}
                        onFile={(file) => onImageChange(p.id, file)}
                        onRemove={() =>
                          onUpdate({
                            imagePaths: Object.fromEntries(Object.entries(row.imagePaths).filter(([k]) => k !== p.id)),
                            imagePreviewUrls: Object.fromEntries(Object.entries(row.imagePreviewUrls).filter(([k]) => k !== p.id)),
                          })
                        }
                      />
                    ))}
                  </div>
                )}
              </div>
            );
          })}

          {orphanImages.length > 0 && (
            <div className="doc-images" style={{ margin: "12px 0 0 0" }}>
              {orphanImages.map((p) => (
                <ImageZoneFull
                  key={p.id}
                  label={p.label}
                  uploading={row.uploadingId === p.id}
                  previewUrl={row.imagePreviewUrls[p.id] ?? null}
                  referenceUrl={p.preview_image_path ? templateFileToUrl(p.preview_image_path) : null}
                  onFile={(file) => onImageChange(p.id, file)}
                  onRemove={() =>
                    onUpdate({
                      imagePaths: Object.fromEntries(Object.entries(row.imagePaths).filter(([k]) => k !== p.id)),
                      imagePreviewUrls: Object.fromEntries(Object.entries(row.imagePreviewUrls).filter(([k]) => k !== p.id)),
                    })
                  }
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ── Compact image zone (used in the main images row) ───────────────────── */

interface CompactImageZoneProps {
  label: string;
  uploading: boolean;
  previewUrl: string | null;
  referenceUrl?: string | null;
  onFile: (file: File) => void;
  onRemove?: () => void;
}

function CompactImageZone({ label, uploading, previewUrl, onFile, onRemove }: CompactImageZoneProps) {
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file && file.type.startsWith("image/")) onFile(file);
  }

  return (
    <div className="compact-image-zone">
      <div className="compact-image-label">{label}</div>

      {previewUrl ? (
        <div className="compact-image-filled" onClick={() => inputRef.current?.click()} title="Clique para trocar">
          <img src={previewUrl} alt={label} className="compact-image-thumb" />
          <div className="compact-image-overlay">Trocar</div>
          <input ref={inputRef} type="file" accept="image/*" style={{ display: "none" }} disabled={uploading}
            onChange={(e) => { const f = e.target.files?.[0]; if (f) onFile(f); }} />
        </div>
      ) : (
        <div
          className={`compact-image-drop${dragging ? " compact-image-drop--drag" : ""}`}
          onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={handleDrop}
          onClick={() => inputRef.current?.click()}
        >
          <input ref={inputRef} type="file" accept="image/*" style={{ display: "none" }} disabled={uploading}
            onChange={(e) => { const f = e.target.files?.[0]; if (f) onFile(f); }} />
          {uploading
            ? <span className="compact-image-hint">Enviando…</span>
            : <span className="compact-image-hint">{dragging ? "Solte aqui" : "+ foto"}</span>}
        </div>
      )}

      {previewUrl && onRemove && (
        <button type="button" className="compact-image-remove" onClick={onRemove} title="Remover">✕</button>
      )}
    </div>
  );
}

/* ── Full image zone (inside section text accordion) ────────────────────── */

interface ImageZoneFullProps {
  label: string;
  uploading: boolean;
  previewUrl: string | null;
  referenceUrl?: string | null;
  onFile: (file: File) => void;
  onRemove?: () => void;
}

function ImageZoneFull({ label, uploading, previewUrl, referenceUrl, onFile, onRemove }: ImageZoneFullProps) {
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file && file.type.startsWith("image/")) onFile(file);
  }

  return (
    <div className="doc-image-zone">
      <div style={{ fontSize: 11, fontWeight: 700, color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6, display: "flex", alignItems: "center", gap: 8 }}>
        <span style={{ flex: 1 }}>{label}</span>
        {previewUrl && onRemove && (
          <button type="button" onClick={onRemove}
            style={{ fontSize: 11, color: "#ef4444", background: "none", border: "none", cursor: "pointer", padding: "0 4px", fontWeight: 700 }}>
            ✕ Remover
          </button>
        )}
      </div>

      {previewUrl ? (
        <div>
          <img src={previewUrl} alt={label} className="doc-image-preview" />
          <div className="doc-image-caption">{label}</div>
          <div className="doc-image-change">
            <label style={{ fontSize: 12, color: "#2563eb", cursor: "pointer", fontWeight: 600 }}>
              Trocar imagem
              <input type="file" accept="image/*" style={{ display: "none" }} disabled={uploading}
                onChange={(e) => { const f = e.target.files?.[0]; if (f) onFile(f); }} />
            </label>
          </div>
        </div>
      ) : referenceUrl ? (
        <div style={{ position: "relative" }}>
          <img src={referenceUrl} alt={label} className="doc-image-preview" style={{ opacity: 0.55, filter: "grayscale(30%)" }} />
          <div className={`doc-image-drop${dragging ? " doc-image-drop--drag" : ""}`}
            onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={handleDrop}
            onClick={() => inputRef.current?.click()}
            style={{ cursor: "pointer", position: "absolute", inset: 0, background: "rgba(255,255,255,0.62)", display: "flex", alignItems: "center", justifyContent: "center", border: "2px dashed #93c5fd", borderRadius: 6 }}>
            <input ref={inputRef} type="file" accept="image/*" disabled={uploading} style={{ display: "none" }}
              onChange={(e) => { const f = e.target.files?.[0]; if (f) onFile(f); }} />
            <div className="doc-image-drop-label" style={{ textAlign: "center" }}>
              {uploading ? "Enviando…" : dragging ? <strong>Solte aqui</strong> : <><strong>Substituir</strong> — clique ou arraste</>}
            </div>
          </div>
        </div>
      ) : (
        <div className={`doc-image-drop${dragging ? " doc-image-drop--drag" : ""}`}
          onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={handleDrop}
          onClick={() => inputRef.current?.click()}
          style={{ cursor: "pointer" }}>
          <input ref={inputRef} type="file" accept="image/*" disabled={uploading} style={{ display: "none" }}
            onChange={(e) => { const f = e.target.files?.[0]; if (f) onFile(f); }} />
          <div className="doc-image-drop-label">
            {uploading ? "Enviando…" : dragging ? <strong>Solte aqui</strong> : <><strong>Clique ou arraste</strong> uma imagem aqui</>}
          </div>
        </div>
      )}
    </div>
  );
}
