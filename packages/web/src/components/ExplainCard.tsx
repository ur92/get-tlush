import { useId, useState, type KeyboardEvent } from "react";
import { formatNis } from "../lib/format";
import type { SimpleGroupDetail } from "../lib/simple-groups";

type ExplainCardProps = {
  id: string;
  label: string;
  amount: number;
  tone: "in" | "out";
  intro?: string;
  details: SimpleGroupDetail[];
};

export function ExplainCard({ id, label, amount, tone, intro, details }: ExplainCardProps) {
  const [expanded, setExpanded] = useState(false);
  const bodyId = useId();
  const headerId = useId();

  const toggle = () => setExpanded((open) => !open);

  const onKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      toggle();
    }
  };

  return (
    <article className={`explain-card explain-card--${tone}`}>
      <h3 className="explain-card__heading">
        <button
          type="button"
          id={headerId}
          className="explain-card__header"
          aria-expanded={expanded}
          aria-controls={bodyId}
          onClick={toggle}
          onKeyDown={onKeyDown}
        >
          <span className="explain-card__label">{label}</span>
          <span className="explain-card__meta">
            <span className="explain-card__amount">{formatNis(amount)}</span>
            <span className="explain-card__toggle" aria-hidden="true">
              {expanded ? "−" : "+"}
            </span>
          </span>
        </button>
      </h3>
      {expanded && (
        <div id={bodyId} className="explain-card__body" role="region" aria-labelledby={headerId}>
          {intro && <p className="explain-card__intro">{intro}</p>}
          {details.length > 0 && (
            <ul className="explain-card__details">
              {details.map((detail) => (
                <li key={`${id}-${detail.label}-${detail.amount}`} className="line-item">
                  <div className="line-item__header">
                    <span className="line-item__label">{detail.label}</span>
                    <span className="line-item__amount">{formatNis(detail.amount)}</span>
                  </div>
                  {detail.text && <p className="line-item__text">{detail.text}</p>}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </article>
  );
}
