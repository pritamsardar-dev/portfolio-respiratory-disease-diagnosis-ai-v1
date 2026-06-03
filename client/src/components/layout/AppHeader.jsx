import clsx from "clsx";

import { HamburgerIcon } from "../../assets/icons";

import AppLogo from "../branding/AppLogo";

// Page title shown above page content
function AppHeader({ title, subtitle }) {
  return (
    <div className="pb-5 pt-3 sm:pt-6">
      <h1 className="mb-[5px]">{title}</h1>

      {subtitle && (
        <p className={clsx("text-[13px] leading-[1.5]", "text-[var(--text)] opacity-65")}>
          {subtitle}
        </p>
      )}
    </div>
  );
}

// Sticky mobile header — hidden above 640px via [data-mobile-header] in index.css
export function MobileHeader({ onMobileMenu, mobileOpen, navigate }) {
  return (
    <div
      data-mobile-header
      className={clsx(
        "sticky top-0 z-30",
        "flex h-[65px] flex-shrink-0 items-center justify-between",
        "px-[16px]",
        "border-b border-[var(--border)]",
        "bg-[color-mix(in_srgb,var(--card)_75%,transparent)]",
        "backdrop-blur-[14px]",
      )}
      style={{
        WebkitBackdropFilter: "blur(14px)",
      }}
    >
      <div onClick={() => navigate?.("diagnose")} style={{ cursor: "pointer" }}>
        <AppLogo size={32} />
      </div>

      {!mobileOpen && (
        <button
          onClick={onMobileMenu}
          className={clsx(
            "mobile-menu-btn",
            "flex flex-shrink-0 items-center justify-center",
            "size-[38px] rounded-[11px]",
            "border border-[var(--border)]",
            "bg-[var(--card)]",
            "text-[var(--text-h)]",
            "cursor-pointer transition-all duration-[160ms] ease-[ease]",
          )}
        >
          <HamburgerIcon className="size-[20px]" strokeWidth={2} />
        </button>
      )}
    </div>
  );
}

export default AppHeader;
