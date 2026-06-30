import { reportDocxUrl } from "../api/client";
import type { GenerateBatchResponse } from "../api/types";

interface Props {
  result: GenerateBatchResponse;
  onStartOver: () => void;
}

export default function GenerationReview({ result, onStartOver }: Props) {
  return (
    <div className="card">
      <h2>4. Laudo gerado</h2>

      {result.errors.length > 0 && (
        <div className="error-banner">
          {result.errors.map((e) => (
            <div key={e.row_label}>
              {e.row_label}: {e.error}
            </div>
          ))}
        </div>
      )}

      {result.reports.length === 0 ? (
        <p>Nenhum laudo foi gerado.</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th>Laudo</th>
              <th style={{ width: 140 }}></th>
            </tr>
          </thead>
          <tbody>
            {result.reports.map((r) => (
              <tr key={r.id}>
                <td>{r.id}</td>
                <td>
                  <a href={reportDocxUrl(r.id)} target="_blank" rel="noreferrer">
                    <button type="button">Baixar DOCX</button>
                  </a>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <div className="actions">
        <button type="button" className="secondary" onClick={onStartOver}>
          Começar novo laudo
        </button>
      </div>
    </div>
  );
}
