import { useState } from "react";
import TemplateUpload from "./routes/TemplateUpload";
import TemplateStructureEditor from "./routes/TemplateStructureEditor";
import BatchForm from "./routes/BatchForm";
import GenerationReview from "./routes/GenerationReview";
import type { GenerateBatchResponse, Template } from "./api/types";

type Step = "upload" | "structure" | "form" | "review";

const STEP_ORDER: { key: Step; label: string }[] = [
  { key: "upload", label: "1. Upload" },
  { key: "structure", label: "2. Estrutura" },
  { key: "form", label: "3. Dados" },
  { key: "review", label: "4. Resultado" },
];

export default function App() {
  const [step, setStep] = useState<Step>("upload");
  const [template, setTemplate] = useState<Template | null>(null);
  const [result, setResult] = useState<GenerateBatchResponse | null>(null);

  function stepStatus(key: Step): "active" | "done" | "" {
    const order = STEP_ORDER.map((s) => s.key);
    const current = order.indexOf(step);
    const target = order.indexOf(key);
    if (target === current) return "active";
    if (target < current) return "done";
    return "";
  }

  return (
    <div className="app-shell">
      <h1>Factor — Gerador de Laudos Periciais</h1>
      <div className="steps">
        {STEP_ORDER.map((s) => (
          <span key={s.key} className={`step-chip ${stepStatus(s.key)}`}>
            {s.label}
          </span>
        ))}
      </div>

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
          onGenerated={(r) => {
            setResult(r);
            setStep("review");
          }}
        />
      )}

      {step === "review" && result && (
        <GenerationReview
          result={result}
          onStartOver={() => {
            setTemplate(null);
            setResult(null);
            setStep("upload");
          }}
        />
      )}
    </div>
  );
}
