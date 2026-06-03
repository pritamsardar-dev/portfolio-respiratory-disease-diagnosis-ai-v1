import clsx from "clsx";

import AppSidebar from "../layout/AppSidebar";

function AppLayout({
  children,
  collapsed,
  setCollapsed,
  activeView,
  setActiveView,
  mobileOpen,
  setMobileOpen,
}) {
  return (
    <>
      <AppSidebar
        collapsed={collapsed}
        setCollapsed={setCollapsed}
        activeView={activeView}
        setActiveView={setActiveView}
        mobileOpen={mobileOpen}
        setMobileOpen={setMobileOpen}
      />

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

      {/* Main Content */}
      <main className={clsx("min-w-0 flex-1", "bg-[var(--bg)]", "min-h-svh")}>{children}</main>
    </>
  );
}

export default AppLayout;
