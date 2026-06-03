import clsx from "clsx";

const STEPS = [
  {
    num: "01",
    title: "Upload Lung Audio",
    body: "Upload WAV breathing sound recordings captured using a stethoscope or lung sound recording device. Preview audio before analysis if needed.",
  },
  {
    num: "02",
    title: "AI Analyzes Recordings",
    body: "Pulmo AI analyzes each recording and detects patterns linked to respiratory conditions.",
  },
  {
    num: "03",
    title: "Review Diagnosis",
    body: "See diagnosis results, confidence scores, and overall severity assessment for each sample.",
  },
  {
    num: "04",
    title: "Download Diagnosis Report",
    body: "View diagnosis results, recommendations, sample breakdown, and export the PDF report.",
  },
];

const CONDITIONS = [
  "Healthy",
  "COPD",
  "Asthma",
  "Bronchiectasis",
  "URTI",
  "LRTI",
  "Pneumonia",
  "Bronchiolitis",
];

const SAMPLE_INFO = {
  title: "Sample Diagnosis",
  body: "Try instant AI diagnosis using real unseen patient lung recordings from the Samples page.",
};

function GuidePage({ navigate }) {
  return (
    <div className="page-grid">
      {/* Steps Column */}
      <div className="w-full flex flex-col" style={{ gap: 14 }}>
        {STEPS.map((step) => (
          <div
            key={step.num}
            className={clsx("med-card w-full", "flex items-start", "gap-[14px] p-5")}
          >
            {/* Step Number */}
            <div
              style={{
                flexShrink: 0,
                width: 40,
                height: 40,
                borderRadius: 12,
                background: "var(--accent-bg)",
                border: "1px solid var(--accent-border)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontWeight: 700,
                fontSize: "var(--fs-xs)",
                color: "var(--accent)",
                fontFamily: "var(--font-sans)",
                letterSpacing: "0.04em",
              }}
            >
              {step.num}
            </div>

            {/* Step Content */}
            <div style={{ minWidth: 0 }}>
              <h3
                style={{
                  margin: "0 0 6px 0",
                  fontSize: "var(--fs-lg)",
                  lineHeight: 1.35,
                  color: "var(--text-h)",
                }}
              >
                {step.title}
              </h3>

              <p
                style={{
                  margin: 0,
                  fontSize: "var(--fs-base)",
                  color: "var(--text)",
                  opacity: 0.82,
                  lineHeight: 1.65,
                }}
              >
                {step.body}
              </p>
            </div>
          </div>
        ))}
      </div>

      {/* Sidebar Column */}
      <div className="w-full flex flex-col" style={{ gap: 14 }}>
        {/* Supported Conditions */}
        <div className="med-card w-full" style={{ padding: 20 }}>
          <p
            style={{
              fontSize: "var(--fs-xs)",
              fontWeight: 600,
              textTransform: "uppercase",
              letterSpacing: "0.08em",
              color: "var(--accent)",
              margin: "0 0 14px 0",
            }}
          >
            Supported Conditions
          </p>

          <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
            {CONDITIONS.map((c) => (
              <div
                key={c}
                style={{
                  display: "flex",
                  alignItems: "flex-start",
                  gap: 10,
                  fontSize: "var(--fs-base)",
                  color: "var(--text-h)",
                  lineHeight: 1.5,
                }}
              >
                <span
                  style={{
                    width: 7,
                    height: 7,
                    borderRadius: "50%",
                    background: "var(--accent)",
                    flexShrink: 0,
                    marginTop: 6,
                    opacity: 0.9,
                  }}
                />
                <span style={{ opacity: 0.88 }}>{c}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Sample Diagnosis */}
        <div className="med-card w-full" style={{ padding: 20 }}>
          <p
            style={{
              fontSize: "var(--fs-xs)",
              fontWeight: 600,
              textTransform: "uppercase",
              letterSpacing: "0.08em",
              color: "var(--accent)",
              margin: "0 0 12px 0",
            }}
          >
            {SAMPLE_INFO.title}
          </p>

          <p
            style={{
              margin: 0,
              fontSize: "var(--fs-base)",
              color: "var(--text)",
              opacity: 0.82,
              lineHeight: 1.65,
            }}
          >
            {SAMPLE_INFO.body}
          </p>

          <button
            className="btn-secondary"
            onClick={() => navigate?.("samples")}
            style={{ width: "100%", justifyContent: "center", marginTop: 14 }}
          >
            Try Sample Diagnosis
          </button>
        </div>
      </div>
    </div>
  );
}

export default GuidePage;
