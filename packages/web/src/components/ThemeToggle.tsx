import { useTranslation } from "react-i18next";
import { useTheme } from "../lib/theme";

export function ThemeToggle() {
  const { t } = useTranslation();
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === "dark";
  const label = isDark ? t("common.theme_light") : t("common.theme_dark");

  return (
    <button
      type="button"
      className="theme-toggle"
      onClick={toggleTheme}
      aria-label={label}
      title={label}
    >
      <span className="theme-toggle__icon" aria-hidden>
        {isDark ? (
          <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
            <path d="M12 18a6 6 0 1 1 0-12 6 6 0 0 1 0 12Zm0-2a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM11 1h2v3h-2V1Zm0 19h2v3h-2v-3ZM4.22 4.22l1.42 1.42-2.12 2.12-1.42-1.42 2.12-2.12Zm15.56 15.56 1.42 1.42-2.12 2.12-1.42-1.42 2.12-2.12ZM1 11h3v2H1v-2Zm19 0h3v2h-3v-2ZM4.22 19.78l2.12-2.12 1.42 1.42-2.12 2.12-1.42-1.42ZM18.36 5.64l2.12-2.12 1.42 1.42-2.12 2.12-1.42-1.42Z" />
          </svg>
        ) : (
          <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
            <path d="M12 3a9 9 0 1 0 9 9 7 7 0 0 1-9-9Z" />
          </svg>
        )}
      </span>
    </button>
  );
}
