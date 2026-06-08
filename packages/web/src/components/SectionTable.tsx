import { useTranslation } from "react-i18next";
import { formatNis } from "../lib/format";

type SectionRow = {
  id: string;
  labelKey: string;
  amount: number;
  explanationKey?: string;
};

type SectionTableProps = {
  rows: SectionRow[];
};

export function SectionTable({ rows }: SectionTableProps) {
  const { t } = useTranslation();

  if (rows.length === 0) {
    return <p className="placeholder-text">{t("breakdown.placeholder")}</p>;
  }

  return (
    <table className="section-table">
      <thead>
        <tr>
          <th>{t("breakdown.columns.description")}</th>
          <th>{t("breakdown.columns.amount")}</th>
          <th>{t("breakdown.columns.explanation")}</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr key={row.id}>
            <td>{t(row.labelKey)}</td>
            <td>{formatNis(row.amount)}</td>
            <td>{row.explanationKey ? t(row.explanationKey) : "—"}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
