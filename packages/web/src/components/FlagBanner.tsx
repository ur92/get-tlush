import type { FlagExplanation } from "@tlush/explain";

type FlagBannerProps = {
  flag: FlagExplanation;
};

export function FlagBanner({ flag }: FlagBannerProps) {
  const severity = flag.severity === "error" ? "warning" : flag.severity;
  const role = severity === "warning" ? "alert" : "status";

  return (
    <div className={`insight insight--${severity}`} role={role}>
      <p className="insight__text">{flag.text}</p>
    </div>
  );
}
