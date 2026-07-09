import { useState } from "react";
import type { GenerateBatchResponse, Template } from "./api/types";
import BatchAiImprove from "./routes/BatchAiImprove";
import BatchForm, { type RowState } from "./routes/BatchForm";
import BatchPreview from "./routes/BatchPreview";
import GenerationReview from "./routes/GenerationReview";
import TemplateList from "./routes/TemplateList";
import TemplateStructureEditor from "./routes/TemplateStructureEditor";
import TemplateUpload from "./routes/TemplateUpload";

// "home" is the template-selection screen (not part of the numbered wizard steps)
type Step = "home" | "upload" | "structure" | "form" | "ai" | "preview" | "review";

const WIZARD_STEPS: { key: Step; label: string }[] = [
  { key: "upload", label: "1. Upload" },
  { key: "structure", label: "2. Estrutura" },
  { key: "form", label: "3. Dados" },
  { key: "ai", label: "4. IA" },
  { key: "preview", label: "5. Preview" },
  { key: "review", label: "6. Resultado" },
];

export default function App() {
  const [step, setStep] = useState<Step>("home");
  const [template, setTemplate] = useState<Template | null>(null);
  const [batchRows, setBatchRows] = useState<RowState[] | null>(null);
  const [result, setResult] = useState<GenerateBatchResponse | null>(null);

  function stepStatus(key: Step): "active" | "done" | "" {
    const order = WIZARD_STEPS.map((s) => s.key);
    const current = order.indexOf(step);
    const target = order.indexOf(key);
    if (target === current) return "active";
    if (target < current) return "done";
    return "";
  }

  function navigateTo(key: Step) {
    if (key === "upload") {
      setTemplate(null);
      setBatchRows(null);
      setResult(null);
      setStep("home");
    } else {
      setStep(key);
    }
  }

  const showWizard = step !== "home";

  return (
    <div className="app-shell">
      <h1 style={{ cursor: showWizard ? "pointer" : "default" }} onClick={() => {
        if (showWizard) {
          setTemplate(null);
          setBatchRows(null);
          setResult(null);
          setStep("home");
        }
      }}>
        Factor — Gerador de Laudos Periciais
      </h1>

      {showWizard && (
        <div className="steps">
          {WIZARD_STEPS.map((s) => {
            const status = stepStatus(s.key);
            return (
              <span
                key={s.key}
                className={`step-chip ${status}`}
                style={{ cursor: status === "done" ? "pointer" : "default" }}
                title={status === "done" ? "Voltar a este passo" : undefined}
                onClick={() => { if (status === "done") navigateTo(s.key); }}
              >
                {s.label}
              </span>
            );
          })}
        </div>
      )}

      {step === "home" && (
        <TemplateList
          onSelect={(t) => {
            setTemplate(t);
            setBatchRows(null);
            setResult(null);
            setStep("form");
          }}
          onUploadNew={(draft) => {
            setTemplate(draft);
            setStep("structure");
          }}
        />
      )}

      {step === "upload" && (
        <TemplateUpload
          onParsed={(t) => {
            setTemplate(t);
            setStep("structure");
          }}
        />
      )}

      {step === "structure" && template && (
        <TemplateStructureEditor
          template={template}
          onConfirmed={(t) => {
            setTemplate(t);
            setStep("form");
          }}
        />
      )}

      {step === "form" && template && (
        <BatchForm
          template={template}
          initialRows={batchRows ?? undefined}
          onPreview={(rows) => {
            setBatchRows(rows);
            setStep("ai");
          }}
        />
      )}

      {step === "ai" && template && batchRows && (
        <BatchAiImprove
          template={template}
          rows={batchRows}
          onContinue={(updatedRows) => {
            setBatchRows(updatedRows);
            setStep("preview");
          }}
          onSkip={(rows) => {
            setBatchRows(rows);
            setStep("preview");
          }}
        />
      )}

      {step === "preview" && template && batchRows && (
        <BatchPreview
          template={template}
          rows={batchRows}
          onBack={() => setStep("ai")}
          onGenerated={(r) => {
            setResult(r);
            setStep("review");
          }}
          onRowsChange={(updated) => setBatchRows(updated)}
        />
      )}

      {step === "review" && result && (
        <GenerationReview
          result={result}
          onStartOver={() => {
            setResult(null);
            setStep("home");
          }}
        />
      )}
    </div>
  );
}
