import type { DiffOp } from "../api/types";

interface Props {
  diff: DiffOp[];
}

export default function DiffView({ diff }: Props) {
  return (
    <p style={{ lineHeight: 1.7, margin: 0 }}>
      {diff.map((op, i) => {
        if (op.op === "equal") {
          return <span key={i}>{op.revised}</span>;
        }
        if (op.op === "insert") {
          return (
            <span key={i} style={{ background: "#d4edda", color: "#155724", borderRadius: 2 }}>
              {op.revised}
            </span>
          );
        }
        if (op.op === "delete") {
          return (
            <span
              key={i}
              style={{ background: "#f8d7da", color: "#721c24", textDecoration: "line-through", borderRadius: 2 }}
            >
              {op.original}
            </span>
          );
        }
        // replace: show deleted then inserted
        return (
          <span key={i}>
            <span
              style={{ background: "#f8d7da", color: "#721c24", textDecoration: "line-through", borderRadius: 2 }}
            >
              {op.original}
            </span>
            {" "}
            <span style={{ background: "#d4edda", color: "#155724", borderRadius: 2 }}>
              {op.revised}
            </span>
          </span>
        );
      })}
    </p>
  );
}
