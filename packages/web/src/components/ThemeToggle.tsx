import { useTranslation } from "react-i18next";
import { MoonIcon, SunIcon } from "./icons/ThemeIcons";
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
      <span className="theme-toggle__icon" key={theme} aria-hidden>
        {isDark ? <SunIcon /> : <MoonIcon />}
      </span>
    </button>
  );
}
