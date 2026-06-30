import { useState } from "react";
import { parseTemplate } from "../api/client";
import type { Template } from "../api/types";

interface Props {
  onParsed: (template: Template) => void;
}

export default function TemplateUpload({ onParsed }: Props) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleFile(file: File) {
    setLoading(true);
    setError(null);
    try {
      const template = await parseTemplate(file);
      onParsed(template);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao processar o PDF.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="card">
      <h2>1. Upload do PDF modelo</h2>
      <p className="hint">
        Envie um laudo pericial existente em PDF. O sistema vai tentar identificar
        automaticamente as seções, variáveis de cabeçalho e imagens — você poderá
        corrigir tudo na próxima etapa.
      </p>
      {error && <div className="error-banner">{error}</div>}
      <input
        type="file"
        accept="application/pdf"
        disabled={loading}
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) void handleFile(file);
        }}
      />
      {loading && <p className="hint">Analisando PDF…</p>}
    </div>
  );
}
