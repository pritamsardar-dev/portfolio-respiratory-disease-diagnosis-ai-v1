import { useState } from "react";

import { DownloadIcon, DiagnoseIcon, ExternalLinkIcon, AlertIcon } from "../assets/icons";

// Glob imports — pulls every WAV from each class folder as a resolved URL.
// SamplesPage is in src/pages/, so assets are one level up.
const SAMPLE_MODULES = {
  healthy: import.meta.glob("../assets/samples/healthy/*.wav", { query: "?url", import: "default", eager: true }),
  copd: import.meta.glob("../assets/samples/copd/*.wav", { query: "?url", import: "default", eager: true }),
  pneumonia: import.meta.glob("../assets/samples/pneumonia/*.wav", { query: "?url", import: "default", eager: true }),
  
};

// Converts the glob result object into a usable [{name, url}] array
function getFiles(id) {
  const mod = SAMPLE_MODULES[id] ?? {};
  return Object.entries(mod).map(([path, url]) => ({
    name: path.split("/").pop(),
    url,
  }));
}

// Triggers individual file downloads for every WAV in a class folder.
// Files are prefixed with the class name so saved files are self-explanatory.
function downloadAll(id, files) {
  if (!files.length) return;
  files.forEach(({ url, name }, i) => {
    setTimeout(() => {
      const a = document.createElement("a");
      a.href = url;
      a.download = `pulmo-${id}-${name}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    }, i * 350);
  });
}

const SAMPLES = [
  {
    id: "healthy",
    label: "Healthy",
    description:
      "Clean vesicular breath sounds from a healthy individual. No crackles or wheezes. The model predicts this class consistently.",
    note: "Untrained not seen during model training.",
    accuracyWarning: null,
  },
  {
    id: "copd",
    label: "COPD",
    description:
      "Audible crackles and prolonged expiration from a COPD patient. This is the best-represented class in the training data and the model performs reliably on it.",
    note: "Untrained not seen during model training.",
    accuracyWarning: null,
  },
  {
    id: "pneumonia",
    label: "Pneumonia",
    description:
      "Lung sounds from a pneumonia patient. This class has very few samples in the training data, so the model may not always predict it correctly.",
    note: "Untrained not seen during model training",
    accuracyWarning:
      "Limited training data for this class. Predictions may be less reliable than other classes.",
  },
];

const DATASET_STATS = [
  { label: "Patients", value: "126" },
  { label: "Recordings", value: "920" },
  { label: "Duration", value: "~5.5 hrs" },
  { label: "Classes", value: "8" },
];

function SampleCard({ sample, onAutoTest }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const files = getFiles(sample.id) || [];

  // Fetches all WAV files in this class folder and passes File[] to onAutoTest.
  // DiagnosePage handles arrays via: Array.isArray(autoTestFile) ? autoTestFile : [autoTestFile]
  const handleTest = async () => {
    if (!files.length) {
      setError(
        `No sample files found. Make sure WAV files exist in src/assets/samples/${sample.id}/`,
      );
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const fileObjects = await Promise.all(
        files.map(async ({ url, name }) => {
          const res = await fetch(url);

          if (!res.ok) {
            throw new Error(
              `Could not load ${name}. Check that the file exists in src/assets/samples/${sample.id}/`,
            );
          }

          const blob = await res.blob();
          return new File([blob], name, { type: "audio/wav" });
        }),
      );

      // Pass the full File[] array — DiagnosePage must guard with Array.isArray()
      onAutoTest(fileObjects);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="med-card w-full" style={{ padding: 20 }}>
      <div style={{ display: "flex", gap: 14, alignItems: "flex-start" }}>
        {/* Accent Dot */}
        <div
          style={{
            width: 10,
            height: 10,
            borderRadius: "50%",
            background: "var(--accent)",
            flexShrink: 0,
            marginTop: 5,
          }}
        />

        <div style={{ flex: 1, minWidth: 0 }}>
          <h3 style={{ marginBottom: 6 }}>{sample.label}</h3>

          <p
            style={{
              fontSize: "var(--fs-base)",
              color: "var(--text)",
              lineHeight: 1.65,
              marginBottom: 10,
            }}
          >
            {sample.description}
          </p>

          {/* Untrained Badge */}
          <span
            style={{
              fontSize: "var(--fs-xs)",
              fontWeight: 600,
              color: "var(--warning)",
              background: "var(--warning-bg)",
              border: "1px solid var(--warning-border)",
              borderRadius: 7,
              padding: "4px 10px",
              display: "inline-block",
              marginBottom: sample.accuracyWarning ? 8 : 12,
            }}
          >
            {sample.note}
          </span>

          {/* Accuracy Warning */}
          {sample.accuracyWarning && (
            <div
              style={{
                display: "flex",
                gap: 7,
                alignItems: "flex-start",
                background: "var(--danger-bg)",
                border: "1px solid var(--danger-border)",
                borderRadius: 8,
                padding: "7px 10px",
                marginBottom: 12,
              }}
            >
              <AlertIcon
                style={{
                  width: 13,
                  height: 13,
                  color: "var(--danger)",
                  flexShrink: 0,
                  marginTop: 1,
                }}
                strokeWidth={2}
              />
              <p style={{ fontSize: "var(--fs-xs)", color: "var(--danger)", lineHeight: 1.55 }}>
                {sample.accuracyWarning}
              </p>
            </div>
          )}

          {/* Fetch or Network Error */}
          {error && (
            <div
              style={{
                display: "flex",
                gap: 8,
                alignItems: "flex-start",
                background: "var(--danger-bg)",
                border: "1px solid var(--danger-border)",
                borderRadius: 8,
                padding: "8px 11px",
                marginBottom: 10,
              }}
            >
              <AlertIcon
                style={{
                  width: 14,
                  height: 14,
                  color: "var(--danger)",
                  flexShrink: 0,
                  marginTop: 1,
                }}
                strokeWidth={2}
              />
              <p style={{ fontSize: "var(--fs-sm)", color: "var(--danger)", lineHeight: 1.5 }}>{error}</p>
            </div>
          )}

          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button
              className="btn-secondary"
              onClick={() => downloadAll(sample.id, files)}
              style={{ fontSize: "var(--fs-sm)", padding: "7px 13px" }}
            >
              <DownloadIcon style={{ width: 13, height: 13 }} strokeWidth={2} />
              Download Samples
            </button>

            <button
              className="btn-primary"
              onClick={handleTest}
              disabled={loading}
              style={{ fontSize: "var(--fs-sm)", padding: "7px 13px" }}
            >
              {loading ? (
                <>
                  <div className="ai-spinner" style={{ width: 13, height: 13, borderWidth: 2 }} />
                  Loading...
                </>
              ) : (
                <>
                  <DiagnoseIcon style={{ width: 13, height: 13 }} strokeWidth={2} />
                  Test Diagnosis
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function SamplesPage({ onAutoTest }) {
  return (
    <div className="page-grid">
      {/* Samples Column */}
      <div className="w-full flex flex-col" style={{ gap: 14 }}>
        {/* Section Header */}
        <div style={{ paddingBottom: 2 }}>
          <p
            style={{
              fontSize: "var(--fs-xs)",
              fontWeight: 600,
              textTransform: "uppercase",
              letterSpacing: "0.08em",
              color: "var(--accent)",
              marginBottom: 8,
            }}
          >
            Unseen Test Samples
          </p>
          <p style={{ fontSize: "var(--fs-base)", color: "var(--text)", lineHeight: 1.65 }}>
            These recordings were held out of training. Click{" "}
            <strong style={{ color: "var(--text-h)" }}>Test Diagnosis</strong> to load all samples
            from that class into the diagnosis page and run the model.
          </p>
        </div>

        {SAMPLES.map((sample) => (
          <SampleCard key={sample.id} sample={sample} onAutoTest={onAutoTest} />
        ))}
      </div>

      {/* Dataset Column */}
      <div className="w-full flex flex-col" style={{ gap: 14 }}>
        <p
          style={{
            fontSize: "var(--fs-xs)",
            fontWeight: 600,
            textTransform: "uppercase",
            letterSpacing: "0.08em",
            color: "var(--text)",
            opacity: 0.45,
            margin: 0,
          }}
        >
          Training Dataset
        </p>

        <div className="med-card w-full" style={{ padding: 20 }}>
          <h2 style={{ marginBottom: 10 }}>ICBHI 2017 Respiratory Sound Database</h2>

          <p
            style={{
              fontSize: "var(--fs-base)",
              color: "var(--text)",
              lineHeight: 1.75,
              marginBottom: 14,
            }}
          >
            Pulmo AI is trained on the{" "}
            <strong style={{ color: "var(--text-h)" }}>
              ICBHI 2017 Respiratory Sound Challenge dataset
            </strong>
            , a clinically recorded collection gathered from hospitals and outpatient clinics. Audio
            was captured using digital stethoscopes and annotated by respiratory experts across 8
            disease categories.
          </p>

          {/* Dataset Stats */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(110px, 1fr))",
              gap: 10,
              marginBottom: 16,
            }}
          >
            {DATASET_STATS.map((stat) => (
              <div
                key={stat.label}
                style={{
                  background: "var(--card2)",
                  border: "1px solid var(--border)",
                  borderRadius: 10,
                  padding: "11px 14px",
                }}
              >
                <p
                  style={{
                    fontSize: "var(--fs-xs)",
                    color: "var(--text)",
                    opacity: 0.55,
                    marginBottom: 4,
                  }}
                >
                  {stat.label}
                </p>
                <p style={{ fontSize: 16, fontWeight: 700, color: "var(--text-h)" }}>
                  {stat.value}
                </p>
              </div>
            ))}
          </div>

          <p
            style={{
              fontSize: "var(--fs-base)",
              color: "var(--text)",
              lineHeight: 1.75,
              marginBottom: 14,
            }}
          >
            The dataset includes real respiratory sounds such as crackles, wheezes, and mixed
            patterns. It is highly imbalanced, with COPD representing the majority of samples. This
            imbalance makes minority class performance a key challenge, addressed in this project
            using data augmentation and balancing techniques.
          </p>

          <a
            href="https://bhichallenge.med.auth.gr/ICBHI_2017_Challenge"
            target="_blank"
            rel="noopener noreferrer"
            className="btn-secondary"
            style={{ textDecoration: "none", display: "inline-flex", fontSize: "var(--fs-sm)" }}
          >
            <ExternalLinkIcon style={{ width: 13, height: 13 }} strokeWidth={2} />
            Official ICBHI Dataset Page
          </a>

          <p
            style={{
              fontSize: "var(--fs-xs)",
              color: "var(--text)",
              opacity: 0.5,
              marginTop: 10,
              lineHeight: 1.55,
            }}
          >
            If the official page is down, search "ICBHI 2017 dataset" on Google. Several research
            repositories and mirrors host a copy.
          </p>
        </div>
      </div>
    </div>
  );
}

export default SamplesPage;
