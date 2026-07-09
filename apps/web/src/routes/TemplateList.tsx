import { useEffect, useRef, useState } from "react";
import { createBuiltinTemplate, deleteTemplate, getTemplate, listBuiltinTypes, listTemplates, parseTemplate, renameTemplate } from "../api/client";
import type { Template } from "../api/types";

interface Props {
  onSelect: (template: Template) => void;
  onUploadNew: (template: Template) => void;
}

interface BuiltinType { key: string; label: string; }

const BUILTIN_ICONS: Record<string, string> = {
  informatica_extracao_completa: "📱",
  informatica_extracao: "📲",
  informatica_multiplos: "📱📱",
  homicidio: "🔍",
  transito: "🚗",
};

export default function TemplateList({ onSelect, onUploadNew }: Props) {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showBuiltinModal, setShowBuiltinModal] = useState(false);
  const [builtinTypes, setBuiltinTypes] = useState<BuiltinType[]>([]);
  const [creatingBuiltin, setCreatingBuiltin] = useState<string | null>(null);
  const renameInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    listTemplates()
      .then(setTemplates)
      .catch(() => setTemplates([]))
      .finally(() => setLoading(false));
    listBuiltinTypes().then(setBuiltinTypes).catch(() => {});
  }, []);

  useEffect(() => {
    if (renamingId) renameInputRef.current?.focus();
  }, [renamingId]);

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

  function startRename(t: Template) {
    setRenamingId(t.id);
    setRenameValue(t.name);
  }

  async function commitRename(id: string) {
    const name = renameValue.trim();
    if (!name) { setRenamingId(null); return; }
    try {
      const updated = await renameTemplate(id, name);
      setTemplates((prev) => prev.map((t) => (t.id === id ? updated : t)));
    } catch {
      setError("Falha ao renomear.");
    } finally {
      setRenamingId(null);
    }
  }

  async function handleUseTemplate(id: string) {
    setEditingId(id);
    try {
      const fresh = await getTemplate(id);
      onSelect(fresh);
      // component unmounts after onSelect, no need to reset editingId
    } catch {
      setError("Falha ao carregar template.");
      setEditingId(null);
    }
  }

  async function handleEditStructure(id: string) {
    setEditingId(id);
    try {
      const fresh = await getTemplate(id);
      onUploadNew(fresh);
    } catch {
      setError("Falha ao carregar template.");
    } finally {
      setEditingId(null);
    }
  }

  async function handleCreateBuiltin(key: string) {
    setCreatingBuiltin(key);
    setError(null);
    try {
      const template = await createBuiltinTemplate(key);
      setShowBuiltinModal(false);
      onUploadNew(template);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao criar template.");
      setCreatingBuiltin(null);
    }
  }

  async function confirmDelete(id: string) {
    try {
      await deleteTemplate(id);
      setTemplates((prev) => prev.filter((t) => t.id !== id));
    } catch {
      setError("Falha ao deletar.");
    } finally {
      setDeletingId(null);
    }
  }

  const confirmed = templates.filter((t) => t.status === "confirmed");
  const drafts = templates.filter((t) => t.status !== "confirmed");

  return (
    <div className="card">
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
        <h2 style={{ margin: 0 }}>Templates de Laudo</h2>
        {builtinTypes.length > 0 && (
          <button type="button" style={{ fontSize: 13, padding: "5px 14px" }} onClick={() => setShowBuiltinModal(true)}>
            + Novo template
          </button>
        )}
      </div>

      {/* ── Builtin template modal ── */}
      {showBuiltinModal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div style={{ background: "#fff", borderRadius: 12, padding: 28, maxWidth: 480, width: "100%", boxShadow: "0 20px 60px rgba(0,0,0,0.3)" }}>
            <h3 style={{ margin: "0 0 6px" }}>Criar template por tipo de perícia</h3>
            <p style={{ margin: "0 0 18px", fontSize: 13, color: "#6b7280" }}>
              Selecione o tipo de perícia. O template será criado com seções e variáveis padrão que você pode ajustar.
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {builtinTypes.map((t) => (
                <button
                  key={t.key}
                  type="button"
                  className="secondary"
                  disabled={!!creatingBuiltin}
                  onClick={() => void handleCreateBuiltin(t.key)}
                  style={{ textAlign: "left", padding: "10px 14px", fontSize: 14, display: "flex", alignItems: "center", gap: 10 }}
                >
                  <span style={{ fontSize: 20 }}>{BUILTIN_ICONS[t.key] ?? "📄"}</span>
                  <span>
                    {creatingBuiltin === t.key ? "Criando…" : t.label}
                  </span>
                </button>
              ))}
            </div>
            <div style={{ marginTop: 16, textAlign: "right" }}>
              <button type="button" className="secondary" onClick={() => { setShowBuiltinModal(false); setCreatingBuiltin(null); }}>
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {error && <div className="error-banner">{error}</div>}

      {loading ? (
        <p className="hint">Carregando templates…</p>
      ) : confirmed.length > 0 ? (
        <>
          <p className="hint" style={{ marginBottom: 12 }}>
            Selecione um template salvo ou faça upload de um novo PDF.
          </p>
          <table style={{ marginBottom: 16 }}>
            <thead>
              <tr>
                <th>Nome</th>
                <th>PDF de origem</th>
                <th>Seções</th>
                <th style={{ width: 220 }}>Ações</th>
              </tr>
            </thead>
            <tbody>
              {confirmed.map((t) => (
                <tr key={t.id}>
                  {/* ── Name (editable inline) ── */}
                  <td style={{ fontWeight: 600 }}>
                    {renamingId === t.id ? (
                      <input
                        ref={renameInputRef}
                        type="text"
                        value={renameValue}
                        onChange={(e) => setRenameValue(e.target.value)}
                        onBlur={() => void commitRename(t.id)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") void commitRename(t.id);
                          if (e.key === "Escape") setRenamingId(null);
                        }}
                        style={{ width: "100%", fontWeight: 600 }}
                      />
                    ) : (
                      <span
                        title="Clique duas vezes para renomear"
                        onDoubleClick={() => startRename(t)}
                        style={{ cursor: "text" }}
                      >
                        {t.name}
                      </span>
                    )}
                  </td>

                  <td style={{ color: "#6b7280", fontSize: 12 }}>{t.source_pdf_filename}</td>
                  <td style={{ color: "#6b7280", fontSize: 12 }}>{t.sections.length} seções</td>

                  {/* ── Actions ── */}
                  <td>
                    {deletingId === t.id ? (
                      <span style={{ display: "flex", gap: 6, alignItems: "center" }}>
                        <span style={{ fontSize: 12, color: "#dc2626", fontWeight: 600 }}>Confirmar?</span>
                        <button
                          type="button"
                          className="danger"
                          style={{ padding: "3px 10px", fontSize: 12 }}
                          onClick={() => void confirmDelete(t.id)}
                        >
                          Sim
                        </button>
                        <button
                          type="button"
                          className="secondary"
                          style={{ padding: "3px 10px", fontSize: 12 }}
                          onClick={() => setDeletingId(null)}
                        >
                          Não
                        </button>
                      </span>
                    ) : (
                      <span style={{ display: "flex", gap: 6 }}>
                        <button
                          type="button"
                          style={{ padding: "4px 14px", fontSize: 12 }}
                          disabled={editingId === t.id}
                          onClick={() => void handleUseTemplate(t.id)}
                        >
                          {editingId === t.id ? "…" : "Usar"}
                        </button>
                        <button
                          type="button"
                          className="secondary"
                          style={{ padding: "4px 10px", fontSize: 12 }}
                          title="Editar estrutura"
                          disabled={editingId === t.id}
                          onClick={() => void handleEditStructure(t.id)}
                        >
                          {editingId === t.id ? "…" : "Estrutura"}
                        </button>
                        <button
                          type="button"
                          className="secondary"
                          style={{ padding: "4px 10px", fontSize: 12 }}
                          title="Renomear"
                          onClick={() => startRename(t)}
                        >
                          ✎
                        </button>
                        <button
                          type="button"
                          className="danger"
                          style={{ padding: "4px 10px", fontSize: 12 }}
                          title="Deletar"
                          onClick={() => setDeletingId(t.id)}
                        >
                          ✕
                        </button>
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      ) : (
        <p className="hint" style={{ marginBottom: 16 }}>
          Nenhum template salvo ainda. Faça upload de um PDF de laudo para começar.
        </p>
      )}

      {/* ── Upload zone ── */}
      <div
        style={{
          border: "2px dashed #c8cdd6",
          borderRadius: 8,
          padding: 24,
          textAlign: "center",
          background: "#fafbfc",
        }}
      >
        <p style={{ margin: "0 0 12px", color: "#5a6272", fontSize: 13 }}>
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
              padding: "9px 22px",
              background: uploading ? "#9ca3af" : "var(--c-primary)",
              color: "#fff",
              borderRadius: 6,
              cursor: uploading ? "not-allowed" : "pointer",
              fontSize: 13,
              fontWeight: 600,
            }}
          >
            {uploading ? "Processando…" : "Selecionar PDF…"}
          </span>
        </label>
      </div>

      {/* ── Drafts ── */}
      {drafts.length > 0 && (
        <details style={{ marginTop: 16 }}>
          <summary style={{ cursor: "pointer", color: "#6b7280", fontSize: 12 }}>
            {drafts.length} rascunho(s) não confirmado(s)
          </summary>
          <table style={{ marginTop: 8 }}>
            <tbody>
              {drafts.map((t) => (
                <tr key={t.id}>
                  <td style={{ fontSize: 12 }}>{t.name || t.source_pdf_filename}</td>
                  <td>
                    <span style={{ display: "flex", gap: 6 }}>
                      <button
                        type="button"
                        className="secondary"
                        style={{ padding: "3px 10px", fontSize: 11 }}
                        disabled={editingId === t.id}
                        onClick={() => void handleEditStructure(t.id)}
                      >
                        {editingId === t.id ? "…" : "Editar"}
                      </button>
                      <button
                        type="button"
                        className="danger"
                        style={{ padding: "3px 10px", fontSize: 11 }}
                        onClick={() => void confirmDelete(t.id)}
                      >
                        Deletar
                      </button>
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </details>
      )}
    </div>
  );
}
