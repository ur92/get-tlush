import type { AnnotatedLineItem, Insight } from "@tlush/explain";
import { formatNis } from "../lib/format";

type LineItemListProps = {
  items: AnnotatedLineItem[];
  insights?: Insight[];
  emptyMessage?: string;
};

export function LineItemList({ items, insights = [], emptyMessage }: LineItemListProps) {
  if (items.length === 0 && insights.length === 0) {
    return emptyMessage ? <p className="line-item-list__empty">{emptyMessage}</p> : null;
  }

  return (
    <div className="line-item-list">
      {insights.map((insight) => (
        <article
          key={insight.explanationKey}
          className={`insight insight--${insight.severity === "warning" ? "warning" : "info"}`}
        >
          <p className="insight__text">{insight.text}</p>
        </article>
      ))}
      {items.map((item) => (
        <article key={`${item.code}-${item.rawLabel}`} className="line-item">
          <div className="line-item__header">
            <span className="line-item__label">{item.rawLabel}</span>
            <span className="line-item__amount">{formatNis(item.amount)}</span>
          </div>
          <p className="line-item__text">{item.text}</p>
        </article>
      ))}
    </div>
  );
}
