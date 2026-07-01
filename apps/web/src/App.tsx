import { useState } from "react";
import type { GenerateBatchResponse, Template } from "./api/types";
import AiImprove from "./routes/AiImprove";
import BatchForm from "./routes/BatchForm";
import GenerationReview from "./routes/GenerationReview";
import TemplateStructureEditor from "./routes/TemplateStructureEditor";
import TemplateUpload from "./routes/TemplateUpload";

type Step = "upload" | "structure" | "form" | "review" | "ai";

const STEP_ORDER: { key: Step; label: string }[] = [
  { key: "upload", label: "1. Upload" },
  { key: "structure", label: "2. Estrutura" },
  { key: "form", label: "3. Dados" },
  { key: "review", label: "4. Resultado" },
  { key: "ai", label: "5. IA" },
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

  // Set of section IDs that are marked is_ai_improvable on the current template
  const aiImprovableSectionIds = new Set(
    (template?.sections ?? [])
      .filter((s) => s.is_ai_improvable)
      .map((s) => s.id),
  );

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
          hasAiImprovable={aiImprovableSectionIds.size > 0}
          onImproveWithAi={() => setStep("ai")}
          onStartOver={() => {
            setTemplate(null);
            setResult(null);
            setStep("upload");
          }}
        />
      )}

      {step === "ai" && result && (
        <AiImprove
          result={result}
          aiImprovableSectionIds={aiImprovableSectionIds}
          onDone={() => setStep("review")}
        />
      )}
    </div>
  );
}
