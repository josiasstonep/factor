import { batchZipUrl, reportDocxUrl } from "../api/client";
import type { GenerateBatchResponse } from "../api/types";

interface Props {
  result: GenerateBatchResponse;
  onStartOver: () => void;
}

export default function GenerationReview({ result, onStartOver }: Props) {
  const { reports, errors, batch_id } = result;
  const hasErrors = errors.length > 0;
  const hasReports = reports.length > 0;

  return (
    <div className="card">
      <h2>5. Laudos gerados</h2>

      {hasErrors && (
        <div className="error-banner">
          <strong>Falhas ao gerar ({errors.length}):</strong>
          <ul style={{ margin: "6px 0 0", paddingLeft: 20 }}>
            {errors.map((e, i) => (
              <li key={i}>
                <strong>{e.row_label}</strong>: {e.error}
              </li>
            ))}
          </ul>
        </div>
      )}

      {hasReports ? (
        <>
          <p style={{ marginBottom: 12, color: "#2e5c30", fontWeight: 600 }}>
            {reports.length} {reports.length === 1 ? "laudo gerado" : "laudos gerados"} com sucesso.
          </p>

          <table>
            <thead>
              <tr>
                <th>#</th>
                <th>Identificação</th>
                <th style={{ width: 140 }}>Download</th>
              </tr>
            </thead>
            <tbody>
              {reports.map((r, i) => (
                <tr key={r.id}>
                  <td style={{ color: "#848b96" }}>{i + 1}</td>
                  <td>{r.row_label ?? r.id}</td>
                  <td>
                    <a href={reportDocxUrl(r.id)} download={`${r.row_label ?? r.id}.docx`}>
                      <button type="button" style={{ padding: "5px 12px", fontSize: 13 }}>
                        DOCX
                      </button>
                    </a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {reports.length > 1 && (
            <a href={batchZipUrl(batch_id)} download="laudos.zip">
              <button type="button" style={{ marginTop: 4 }}>
                Baixar todos (ZIP)
              </button>
            </a>
          )}
        </>
      ) : (
        <p>Nenhum laudo foi gerado.</p>
      )}

      <div className="actions" style={{ marginTop: 24 }}>
        <button type="button" className="secondary" onClick={onStartOver}>
          Novo laudo / novo batch
        </button>
      </div>
    </div>
  );
}
