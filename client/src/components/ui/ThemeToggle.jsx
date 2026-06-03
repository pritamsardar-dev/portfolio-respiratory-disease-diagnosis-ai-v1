import { useState } from "react";

import clsx from "clsx";

import { MoonIcon, SunIcon } from "../../assets/icons";
import { initializeTheme, toggleTheme } from "../../utils/theme";

function ThemeToggle() {
  const [isDark, setIsDark] = useState(() => initializeTheme());

  const handleToggle = () => {
    const next = !isDark;
    setIsDark(next);
    toggleTheme(next);
  };

  return (
    <button
      onClick={handleToggle}
      aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
      className={clsx(
        "flex flex-shrink-0 items-center justify-center",
        "size-[32px] rounded-full",
        "border border-[var(--accent-border)]",
        "bg-[var(--accent-bg)]",
        "text-[var(--accent)]",
        "cursor-pointer transition-all duration-[180ms] ease-[ease]",
      )}
    >
      {isDark ? (
        <SunIcon className="size-[15px]" strokeWidth={2} />
      ) : (
        <MoonIcon className="size-[15px]" strokeWidth={2} />
      )}
    </button>
  );
}

export default ThemeToggle;
