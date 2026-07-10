import { useEffect, useState } from "react";
import { getKeysStatus, saveKeys, type KeysStatus } from "../api/client";

interface Props {
  onClose: () => void;
}

const PROVIDERS: { key: keyof KeysStatus; label: string; placeholder: string; hint: string }[] = [
  { key: "groq", label: "Groq (LLaMA 70B — grátis)", placeholder: "gsk_...", hint: "console.groq.com" },
  { key: "gemini", label: "Google Gemini (grátis)", placeholder: "AIza...", hint: "aistudio.google.com" },
  { key: "claude", label: "Anthropic (Claude Haiku)", placeholder: "sk-ant-...", hint: "console.anthropic.com" },
  { key: "openai", label: "OpenAI (GPT-4o mini)", placeholder: "sk-...", hint: "platform.openai.com" },
];

export default function ConfigModal({ onClose }: Props) {
  const [status, setStatus] = useState<KeysStatus | null>(null);
  const [inputs, setInputs] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getKeysStatus().then(setStatus).catch(() => {});
  }, []);

  async function handleSave() {
    setSaving(true);
    setSaved(false);
    setError(null);
    try {
      const payload: Record<string, string> = {};
      for (const [k, v] of Object.entries(inputs)) {
        if (v.trim()) payload[k] = v.trim();
      }
      await saveKeys(payload);
      // Refresh status
      const fresh = await getKeysStatus();
      setStatus(fresh);
      setInputs({});
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao salvar.");
    } finally {
      setSaving(false);
    }
  }

  const hasChanges = Object.values(inputs).some((v) => v.trim() !== "");

  return (
    <div
      style={{
        position: "fixed", inset: 0, zIndex: 1000,
        background: "rgba(0,0,0,0.45)",
        display: "flex", alignItems: "center", justifyContent: "center",
      }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div style={{
        background: "var(--bg, #fff)", borderRadius: 12, padding: "28px 32px",
        width: "100%", maxWidth: 480, boxShadow: "0 8px 40px rgba(0,0,0,0.18)",
        color: "var(--text, #1e293b)",
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
          <h3 style={{ margin: 0, fontSize: 17, fontWeight: 700 }}>Chaves de API</h3>
          <button
            type="button"
            onClick={onClose}
            style={{ background: "none", border: "none", fontSize: 20, cursor: "pointer", color: "#6b7280", padding: "0 4px" }}
          >
            ×
          </button>
        </div>

        <p style={{ fontSize: 12, color: "#6b7280", marginBottom: 20, lineHeight: 1.5 }}>
          As chaves são salvas em <code style={{ fontSize: 11 }}>.env</code> na sua máquina e nunca enviadas ao GitHub.
          Deixe em branco para manter a chave atual.
        </p>

        {error && <div className="error-banner" style={{ marginBottom: 12, padding: "6px 10px", fontSize: 12 }}>{error}</div>}

        {PROVIDERS.map((p) => {
          const configured = status?.[p.key] ?? false;
          return (
            <div key={p.key} style={{ marginBottom: 16 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                <label style={{ fontSize: 13, fontWeight: 600, flex: 1 }}>{p.label}</label>
                {configured
                  ? <span style={{ fontSize: 11, color: "#16a34a", fontWeight: 700 }}>✓ configurada</span>
                  : <span style={{ fontSize: 11, color: "#9ca3af" }}>não configurada</span>
                }
              </div>
              <input
                type="password"
                style={{ width: "100%", fontSize: 13, boxSizing: "border-box" }}
                value={inputs[p.key] ?? ""}
                placeholder={configured ? "••••••••• (deixe em branco para manter)" : p.placeholder}
                onChange={(e) => setInputs((prev) => ({ ...prev, [p.key]: e.target.value }))}
              />
              <div style={{ fontSize: 11, color: "#9ca3af", marginTop: 2 }}>
                {p.hint}
              </div>
            </div>
          );
        })}

        <div style={{ display: "flex", gap: 10, marginTop: 24, justifyContent: "flex-end" }}>
          <button type="button" className="secondary" onClick={onClose}>Fechar</button>
          <button
            type="button"
            disabled={!hasChanges || saving}
            onClick={handleSave}
            style={{ minWidth: 100 }}
          >
            {saving ? "Salvando…" : saved ? "✓ Salvo" : "Salvar"}
          </button>
        </div>
      </div>
    </div>
  );
}
