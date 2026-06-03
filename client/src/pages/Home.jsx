import { useState, useEffect } from "react";

import AppLayout from "../components/app-shell/AppLayout";
import AppHeader, { MobileHeader } from "../components/layout/AppHeader";
import DiagnosePage from "./DiagnosePage";
import GuidePage from "./GuidePage";
import SamplesPage from "./SamplesPage";
import AboutPage from "./AboutPage";

const PAGE_META = {
  diagnose: {
    title: "Diagnosis",
    subtitle:
      "Upload respiratory audio recordings (breathing sounds) for AI-powered lung diagnosis.",
    maxWidth: 1320,
  },
  guide: {
    title: "Guide",
    subtitle: "How to use Pulmo AI to analyze respiratory audio recordings for lung conditions.",
    maxWidth: 1320,
  },
  samples: {
    title: "Samples",
    subtitle: "Test the model using sample recordings or explore the dataset.",
    maxWidth: 1320,
  },
  about: {
    title: "About",
    subtitle: "Project overview, model pipeline, and technology used.",
    maxWidth: 1320,
  },
};

// Defined outside component to keep reference stable across re-renders
const PAGES = {
  diagnose: DiagnosePage,
  guide: GuidePage,
  samples: SamplesPage,
  about: AboutPage,
};

function Home() {
  // Restore last active page from localStorage, default to diagnose
  const [activeView, setActiveView] = useState(
    () => localStorage.getItem("pulmo-active-view") || "diagnose",
  );

  // Restore sidebar collapsed state from localStorage, default to false
  const [collapsed, setCollapsed] = useState(
    () => localStorage.getItem("pulmo-sidebar-collapsed") === "true",
  );

  const [mobileOpen, setMobileOpen] = useState(false);

  // File[] or null — passed to DiagnosePage for auto-test runs triggered from Samples
  const [autoTestFiles, setAutoTestFiles] = useState(null);

  // Persist active page across sessions
  useEffect(() => {
    localStorage.setItem("pulmo-active-view", activeView);
  }, [activeView]);

  // Persist sidebar collapsed state across sessions
  useEffect(() => {
    localStorage.setItem("pulmo-sidebar-collapsed", String(collapsed));
  }, [collapsed]);

  const meta = PAGE_META[activeView];

  const getPageProps = () => {
    if (activeView === "diagnose") {
      return {
        navigate: setActiveView,
        autoTestFiles,
        onClearAutoTest: () => setAutoTestFiles(null),
      };
    }
    if (activeView === "samples") {
      return {
        navigate: setActiveView,
        onAutoTest: (files) => {
          // Set files first, then switch — React 18 batches these together
          setAutoTestFiles(files);
          setActiveView("diagnose");
        },
      };
    }
    return { navigate: setActiveView };
  };

  const PageComponent = PAGES[activeView];

  return (
    <AppLayout
      collapsed={collapsed}
      setCollapsed={setCollapsed}
      activeView={activeView}
      setActiveView={setActiveView}
      mobileOpen={mobileOpen}
      setMobileOpen={setMobileOpen}
    >
      <MobileHeader
        onMobileMenu={() => setMobileOpen(true)}
        mobileOpen={mobileOpen}
        navigate={setActiveView}
      />

      <div className="px-6 pb-12 sm:px-9 lg:px-14">
        <div style={{ maxWidth: meta.maxWidth, margin: "0 auto" }}>
          <AppHeader title={meta.title} subtitle={meta.subtitle} />
          <PageComponent {...getPageProps()} />
        </div>
      </div>
    </AppLayout>
  );
}

export default Home;
