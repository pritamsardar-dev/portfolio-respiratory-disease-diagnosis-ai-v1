import { useRef, useState } from "react";

import { createPortal } from "react-dom";

import clsx from "clsx";

import AppLogo from "../branding/AppLogo";
import ThemeToggle from "../ui/ThemeToggle";
import {
  AboutIcon,
  CloseIcon,
  CollapseIcon,
  DiagnoseIcon,
  ExpandIcon,
  GuideIcon,
  SamplesIcon,
} from "../../assets/icons";

const NAV_ITEMS = [
  { key: "diagnose", label: "Diagnose", Icon: DiagnoseIcon },
  { key: "guide", label: "Guide", Icon: GuideIcon },
  { key: "samples", label: "Samples", Icon: SamplesIcon },
  { key: "about", label: "About", Icon: AboutIcon },
];

const W_OPEN = 220;
const W_COLLAPSE = 60;

// Portal tooltip that escapes sidebar overflow clipping
function SideTooltip({ label, show, children, wrapStyle }) {
  const [pos, setPos] = useState(null);
  const ref = useRef(null);

  if (!show) return <>{children}</>;

  const handleEnter = () => {
    if (!ref.current) return;
    const rect = ref.current.getBoundingClientRect();
    setPos({
      top: rect.top + rect.height / 2,
      left: rect.right + 10,
    });
  };

  return (
    <div
      ref={ref}
      onMouseEnter={handleEnter}
      onMouseLeave={() => setPos(null)}
      style={{ position: "relative", ...wrapStyle }}
    >
      {children}

      {pos &&
        createPortal(
          <div
            className={clsx(
              "fixed -translate-y-1/2",
              "px-[11px] py-[5px]",
              "rounded-[9px]",
              "bg-[var(--text-h)] text-[var(--bg)]",
              "font-[var(--font-sans)] text-[11px] font-medium",
              "whitespace-nowrap pointer-events-none",
              "shadow-[0_4px_18px_rgba(0,0,0,0.22)]",
              "z-[99999]",
              "animate-[tooltipSlideIn_0.15s_ease]",
            )}
            style={{ top: pos.top, left: pos.left }}
          >
            {label}
          </div>,
          document.body,
        )}
    </div>
  );
}

function AppSidebar({
  collapsed,
  setCollapsed,
  activeView,
  setActiveView,
  mobileOpen,
  setMobileOpen,
}) {
  const width = collapsed ? W_COLLAPSE : W_OPEN;

  const handleNav = (key) => {
    setActiveView(key);
    setMobileOpen(false);
  };

  return (
    <>
      {/* Desktop Sidebar */}
      <aside
        className="sticky top-0 hidden flex-shrink-0 flex-col sm:flex"
        style={{
          width,
          height: "100svh",
          background: "var(--card)",
          borderRight: "1px solid var(--border)",
          transition: "width 0.24s cubic-bezier(0.4,0,0.2,1)",
        }}
      >
        <SidebarContent
          collapsed={collapsed}
          w={width}
          onToggleCollapse={() => setCollapsed((prev) => !prev)}
          activeView={activeView}
          onNav={handleNav}
          showCollapse
        />
      </aside>

      {/* Mobile Backdrop */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 sm:hidden"
          onClick={() => setMobileOpen(false)}
          style={{
            background: "rgba(0,0,0,0.42)",
            backdropFilter: "blur(2px)",
            WebkitBackdropFilter: "blur(2px)",
          }}
        />
      )}

      {/* Mobile Drawer */}
      <aside
        className="sm:hidden"
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          width: 220,
          height: "100svh",
          background: "var(--card)",
          borderRight: "1px solid var(--border)",
          transform: mobileOpen ? "translateX(0)" : "translateX(-100%)",
          transition: "transform 0.24s cubic-bezier(0.4,0,0.2,1)",
          zIndex: 50,
          display: "flex",
          flexDirection: "column",
        }}
      >
        <SidebarContent
          collapsed={false}
          w={220}
          activeView={activeView}
          onNav={handleNav}
          onClose={() => setMobileOpen(false)}
          showClose
        />
      </aside>
    </>
  );
}

// Shared sidebar content used by both desktop and mobile
function SidebarContent({
  collapsed,
  w,
  onToggleCollapse,
  activeView,
  onNav,
  onClose,
  showCollapse,
  showClose,
}) {
  // Tracks hover state for collapsed logo expand action
  const [logoHovered, setLogoHovered] = useState(false);

  const startYear = 2025;
  const year = new Date().getFullYear();
  const yearRange = year > startYear ? `${startYear}–${year}` : `${startYear}`;

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100%",
        width: w,
      }}
    >
      {/* Sidebar Header */}
      <div
        style={{
          flexShrink: 0,
          height: 65,
          padding: collapsed ? 0 : "0 12px",
          borderBottom: "1px solid var(--border)",
          display: "flex",
          alignItems: "center",
          justifyContent: collapsed ? "center" : "space-between",
          gap: 8,
        }}
      >
        {collapsed ? (
          // Collapsed logo — click to expand
          <div
            onClick={onToggleCollapse}
            onMouseEnter={() => setLogoHovered(true)}
            onMouseLeave={() => setLogoHovered(false)}
            className="flex size-[32px] flex-shrink-0 cursor-pointer items-center justify-center"
          >
            {logoHovered ? (
              <div
                className={clsx(
                  "flex size-[32px] items-center justify-center",
                  "rounded-[9px]",
                  "bg-[var(--accent-bg)]",
                  "border border-[var(--accent-border)]",
                  "transition-all duration-[180ms] ease-[ease]",
                )}
              >
                <ExpandIcon className="size-[15px] text-[var(--accent)]" strokeWidth={2.5} />
              </div>
            ) : (
              <AppLogo iconOnly size={32} />
            )}
          </div>
        ) : (
          <>
            <div onClick={() => onNav("diagnose")} style={{ cursor: "pointer" }}>
              <AppLogo size={32} />
            </div>

            {showCollapse && (
              <button
                onClick={onToggleCollapse}
                className={clsx(
                  "collapse-btn",
                  "flex size-[32px] flex-shrink-0 items-center justify-center",
                  "rounded-[9px]",
                  "border border-[var(--border)]",
                  "bg-[var(--card)]",
                  "text-[var(--text)]",
                  "cursor-pointer transition-all duration-[180ms] ease-[ease]",
                )}
              >
                <CollapseIcon className="size-[16px]" strokeWidth={2} />
              </button>
            )}
          </>
        )}

        {showClose && (
          <button
            onClick={onClose}
            className={clsx(
              "ml-auto",
              "flex size-[32px] flex-shrink-0 items-center justify-center",
              "rounded-[9px]",
              "border border-[var(--border)]",
              "bg-[var(--card)]",
              "text-[var(--text)]",
              "cursor-pointer transition-all duration-[160ms] ease-[ease]",
            )}
          >
            <CloseIcon className="size-[14px]" strokeWidth={2} />
          </button>
        )}
      </div>

      {/* Navigation */}
      <nav
        style={{
          flex: 1,
          overflowY: "auto",
          padding: "8px 6px",
          display: "flex",
          flexDirection: "column",
          gap: 2,
        }}
      >
        {NAV_ITEMS.map((item) => {
          const active = activeView === item.key;

          return (
            <SideTooltip
              key={item.key}
              label={item.label}
              show={collapsed}
              wrapStyle={{ width: "100%" }}
            >
              <button
                onClick={() => onNav(item.key)}
                className="nav-btn"
                data-active={active}
                style={{
                  width: "100%",
                  display: "flex",
                  alignItems: "center",
                  gap: collapsed ? 0 : 9,
                  justifyContent: collapsed ? "center" : "flex-start",
                  padding: collapsed ? "10px 0" : "9px 10px",
                  borderRadius: 10,
                  border: "none",
                  cursor: "pointer",
                  fontFamily: "var(--font-sans)",
                  fontSize: "var(--fs-md)",
                  fontWeight: active ? 600 : 400,
                  background: active ? "var(--accent-bg)" : "transparent",
                  color: active ? "var(--accent)" : "var(--text)",
                  transition: "all 0.14s ease",
                  overflow: "hidden",
                  whiteSpace: "nowrap",
                }}
              >
                <item.Icon className="size-[17px] flex-shrink-0" strokeWidth={active ? 2.5 : 2} />

                {!collapsed && <span className="overflow-hidden text-ellipsis">{item.label}</span>}
              </button>
            </SideTooltip>
          );
        })}
      </nav>

      {/* Bottom Controls */}
      <div
        style={{
          flexShrink: 0,
          borderTop: "1px solid var(--border)",
        }}
      >
        {/* Theme Toggle */}
        <div
          style={{
            padding: "10px 12px",
            display: "flex",
            alignItems: "center",
            justifyContent: collapsed ? "center" : "space-between",
          }}
        >
          {!collapsed && (
            <p
              className={clsx(
                "m-0",
                "font-[var(--font-sans)] text-[11px]",
                "text-[var(--text)] opacity-45",
              )}
            >
              Appearance
            </p>
          )}

          <ThemeToggle />
        </div>

        {/* Copyright */}
        <div
          style={{
            padding: collapsed ? "6px 6px 14px" : "4px 12px 14px",
            display: "flex",
            justifyContent: "center",
          }}
        >
          <p
            className={clsx(
              "m-0 text-center leading-[1.4]",
              "font-[var(--font-sans)] text-[10px]",
              "text-[var(--text)] opacity-50",
            )}
            style={{
              whiteSpace: collapsed ? "nowrap" : "normal",
              maxWidth: collapsed ? "100%" : 180,
            }}
          >
            {collapsed
              ? `\u00A9 ${year}`
              : `\u00A9 ${yearRange} Pulmo AI · Designed & Developed by Pritam Sardar`}
          </p>
        </div>
      </div>
    </div>
  );
}

export default AppSidebar;
