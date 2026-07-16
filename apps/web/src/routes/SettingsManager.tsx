import { useEffect, useState } from "react";
import {
  createDelegacia,
  createPerito,
  deleteDelegacia,
  deletePerito,
  listDelegacias,
  listPeritos,
  updateDelegacia,
  updatePerito,
} from "../api/client";
import type { Delegacia, Perito } from "../api/types";

interface Props {
  onBack: () => void;
}

// ─── Peritos ─────────────────────────────────────────────────────────────────

function PeritosPanel() {
  const [peritos, setPeritos] = useState<Perito[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // editing
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editNome, setEditNome] = useState("");
  const [editMatricula, setEditMatricula] = useState("");
  const [editCargo, setEditCargo] = useState("");

  // add form
  const [addNome, setAddNome] = useState("");
  const [addMatricula, setAddMatricula] = useState("");
  const [addCargo, setAddCargo] = useState("");
  const [adding, setAdding] = useState(false);

  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    listPeritos()
      .then(setPeritos)
      .catch(() => setError("Falha ao carregar peritos."))
      .finally(() => setLoading(false));
  }, []);

  function startEdit(p: Perito) {
    setEditingId(p.id);
    setEditNome(p.nome);
    setEditMatricula(p.matricula);
    setEditCargo(p.cargo ?? "");
  }

  async function commitEdit() {
    if (!editingId) return;
    const nome = editNome.trim();
    const matricula = editMatricula.trim();
    if (!nome || !matricula) { setEditingId(null); return; }
    try {
      const updated = await updatePerito(editingId, { nome, matricula, cargo: editCargo.trim() || undefined });
      setPeritos((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
    } catch {
      setError("Falha ao salvar perito.");
    } finally {
      setEditingId(null);
    }
  }

  async function handleAdd() {
    const nome = addNome.trim();
    const matricula = addMatricula.trim();
    if (!nome || !matricula) return;
    setAdding(true);
    setError(null);
    try {
      const p = await createPerito({ nome, matricula, cargo: addCargo.trim() || undefined });
      setPeritos((prev) => [...prev, p]);
      setAddNome("");
      setAddMatricula("");
      setAddCargo("");
    } catch {
      setError("Falha ao adicionar perito.");
    } finally {
      setAdding(false);
    }
  }

  async function handleDelete(id: string) {
    try {
      await deletePerito(id);
      setPeritos((prev) => prev.filter((p) => p.id !== id));
    } catch {
      setError("Falha ao deletar perito.");
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div className="card" style={{ marginBottom: 0 }}>
      <h3 style={{ margin: "0 0 12px" }}>Peritos</h3>
      {error && <div className="error-banner">{error}</div>}
      {loading ? (
        <p className="hint">Carregando…</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th>Nome</th>
              <th>Matrícula</th>
              <th>Cargo</th>
              <th style={{ width: 120 }}>Ações</th>
            </tr>
          </thead>
          <tbody>
            {peritos.map((p) => (
              <tr key={p.id}>
                {editingId === p.id ? (
                  <>
                    <td><input value={editNome} onChange={(e) => setEditNome(e.target.value)} style={{ width: "100%" }} /></td>
                    <td><input value={editMatricula} onChange={(e) => setEditMatricula(e.target.value)} style={{ width: "100%" }} /></td>
                    <td><input value={editCargo} onChange={(e) => setEditCargo(e.target.value)} placeholder="opcional" style={{ width: "100%" }} /></td>
                    <td>
                      <span style={{ display: "flex", gap: 4 }}>
                        <button type="button" style={{ padding: "3px 10px", fontSize: 12 }} onClick={() => void commitEdit()}>Salvar</button>
                        <button type="button" className="secondary" style={{ padding: "3px 8px", fontSize: 12 }} onClick={() => setEditingId(null)}>✕</button>
                      </span>
                    </td>
                  </>
                ) : deletingId === p.id ? (
                  <>
                    <td colSpan={3} style={{ fontSize: 12, color: "#dc2626", fontWeight: 600 }}>Deletar {p.nome}?</td>
                    <td>
                      <span style={{ display: "flex", gap: 4 }}>
                        <button type="button" className="danger" style={{ padding: "3px 8px", fontSize: 12 }} onClick={() => void handleDelete(p.id)}>Sim</button>
                        <button type="button" className="secondary" style={{ padding: "3px 8px", fontSize: 12 }} onClick={() => setDeletingId(null)}>Não</button>
                      </span>
                    </td>
                  </>
                ) : (
                  <>
                    <td style={{ fontWeight: 600 }}>{p.nome}</td>
                    <td style={{ color: "#6b7280", fontSize: 13 }}>{p.matricula}</td>
                    <td style={{ color: "#6b7280", fontSize: 13 }}>{p.cargo || <span style={{ fontStyle: "italic", color: "#9ca3af" }}>—</span>}</td>
                    <td>
                      <span style={{ display: "flex", gap: 4 }}>
                        <button type="button" className="secondary" style={{ padding: "3px 8px", fontSize: 12 }} onClick={() => startEdit(p)}>✎</button>
                        <button type="button" className="danger" style={{ padding: "3px 8px", fontSize: 12 }} onClick={() => setDeletingId(p.id)}>✕</button>
                      </span>
                    </td>
                  </>
                )}
              </tr>
            ))}

            {/* ── Add row ── */}
            <tr>
              <td><input value={addNome} onChange={(e) => setAddNome(e.target.value)} placeholder="Nome completo" style={{ width: "100%" }} /></td>
              <td><input value={addMatricula} onChange={(e) => setAddMatricula(e.target.value)} placeholder="Matrícula" style={{ width: "100%" }} /></td>
              <td><input value={addCargo} onChange={(e) => setAddCargo(e.target.value)} placeholder="Cargo (opcional)" style={{ width: "100%" }} /></td>
              <td>
                <button
                  type="button"
                  disabled={adding || !addNome.trim() || !addMatricula.trim()}
                  style={{ padding: "3px 10px", fontSize: 12 }}
                  onClick={() => void handleAdd()}
                >
                  {adding ? "…" : "+ Adicionar"}
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      )}
    </div>
  );
}

// ─── Delegacias ───────────────────────────────────────────────────────────────

function DelegaciasPanel() {
  const [delegacias, setDelegacias] = useState<Delegacia[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editNome, setEditNome] = useState("");
  const [editMunicipio, setEditMunicipio] = useState("");

  const [addNome, setAddNome] = useState("");
  const [addMunicipio, setAddMunicipio] = useState("");
  const [adding, setAdding] = useState(false);

  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    listDelegacias()
      .then(setDelegacias)
      .catch(() => setError("Falha ao carregar delegacias."))
      .finally(() => setLoading(false));
  }, []);

  function startEdit(d: Delegacia) {
    setEditingId(d.id);
    setEditNome(d.nome);
    setEditMunicipio(d.municipio ?? "");
  }

  async function commitEdit() {
    if (!editingId) return;
    const nome = editNome.trim();
    if (!nome) { setEditingId(null); return; }
    try {
      const updated = await updateDelegacia(editingId, { nome, municipio: editMunicipio.trim() || undefined });
      setDelegacias((prev) => prev.map((d) => (d.id === updated.id ? updated : d)));
    } catch {
      setError("Falha ao salvar delegacia.");
    } finally {
      setEditingId(null);
    }
  }

  async function handleAdd() {
    const nome = addNome.trim();
    if (!nome) return;
    setAdding(true);
    setError(null);
    try {
      const d = await createDelegacia({ nome, municipio: addMunicipio.trim() || undefined });
      setDelegacias((prev) => [...prev, d]);
      setAddNome("");
      setAddMunicipio("");
    } catch {
      setError("Falha ao adicionar delegacia.");
    } finally {
      setAdding(false);
    }
  }

  async function handleDelete(id: string) {
    try {
      await deleteDelegacia(id);
      setDelegacias((prev) => prev.filter((d) => d.id !== id));
    } catch {
      setError("Falha ao deletar delegacia.");
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div className="card" style={{ marginBottom: 0 }}>
      <h3 style={{ margin: "0 0 12px" }}>Delegacias</h3>
      {error && <div className="error-banner">{error}</div>}
      {loading ? (
        <p className="hint">Carregando…</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th>Nome</th>
              <th>Município</th>
              <th style={{ width: 120 }}>Ações</th>
            </tr>
          </thead>
          <tbody>
            {delegacias.map((d) => (
              <tr key={d.id}>
                {editingId === d.id ? (
                  <>
                    <td><input value={editNome} onChange={(e) => setEditNome(e.target.value)} style={{ width: "100%" }} /></td>
                    <td><input value={editMunicipio} onChange={(e) => setEditMunicipio(e.target.value)} placeholder="opcional" style={{ width: "100%" }} /></td>
                    <td>
                      <span style={{ display: "flex", gap: 4 }}>
                        <button type="button" style={{ padding: "3px 10px", fontSize: 12 }} onClick={() => void commitEdit()}>Salvar</button>
                        <button type="button" className="secondary" style={{ padding: "3px 8px", fontSize: 12 }} onClick={() => setEditingId(null)}>✕</button>
                      </span>
                    </td>
                  </>
                ) : deletingId === d.id ? (
                  <>
                    <td colSpan={2} style={{ fontSize: 12, color: "#dc2626", fontWeight: 600 }}>Deletar {d.nome}?</td>
                    <td>
                      <span style={{ display: "flex", gap: 4 }}>
                        <button type="button" className="danger" style={{ padding: "3px 8px", fontSize: 12 }} onClick={() => void handleDelete(d.id)}>Sim</button>
                        <button type="button" className="secondary" style={{ padding: "3px 8px", fontSize: 12 }} onClick={() => setDeletingId(null)}>Não</button>
                      </span>
                    </td>
                  </>
                ) : (
                  <>
                    <td style={{ fontWeight: 600 }}>{d.nome}</td>
                    <td style={{ color: "#6b7280", fontSize: 13 }}>{d.municipio || <span style={{ fontStyle: "italic", color: "#9ca3af" }}>—</span>}</td>
                    <td>
                      <span style={{ display: "flex", gap: 4 }}>
                        <button type="button" className="secondary" style={{ padding: "3px 8px", fontSize: 12 }} onClick={() => startEdit(d)}>✎</button>
                        <button type="button" className="danger" style={{ padding: "3px 8px", fontSize: 12 }} onClick={() => setDeletingId(d.id)}>✕</button>
                      </span>
                    </td>
                  </>
                )}
              </tr>
            ))}

            {/* ── Add row ── */}
            <tr>
              <td><input value={addNome} onChange={(e) => setAddNome(e.target.value)} placeholder="Nome da delegacia" style={{ width: "100%" }} /></td>
              <td><input value={addMunicipio} onChange={(e) => setAddMunicipio(e.target.value)} placeholder="Município (opcional)" style={{ width: "100%" }} /></td>
              <td>
                <button
                  type="button"
                  disabled={adding || !addNome.trim()}
                  style={{ padding: "3px 10px", fontSize: 12 }}
                  onClick={() => void handleAdd()}
                >
                  {adding ? "…" : "+ Adicionar"}
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      )}
    </div>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export default function SettingsManager({ onBack }: Props) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <button type="button" className="secondary" style={{ padding: "5px 12px", fontSize: 13 }} onClick={onBack}>
          ← Voltar
        </button>
        <h2 style={{ margin: 0 }}>Peritos e Delegacias</h2>
      </div>
      <PeritosPanel />
      <DelegaciasPanel />
    </div>
  );
}
