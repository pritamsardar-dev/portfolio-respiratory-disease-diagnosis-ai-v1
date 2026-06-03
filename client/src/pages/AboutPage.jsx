import { CpuIcon, DiagnoseIcon, ExternalLinkIcon, LungsIcon, VolumeIcon } from "../assets/icons";

// Shared section label style
const LABEL = {
  fontSize: "var(--fs-xs)",
  fontWeight: 600,
  textTransform: "uppercase",
  letterSpacing: "0.08em",
  color: "var(--accent)",
  marginBottom: 10,
};

const CONDITIONS = [
  { name: "Healthy", note: "Healthy lung sounds" },
  {
    name: "COPD",
    note: "Chronic Obstructive Pulmonary Disease",
  },
  {
    name: "Asthma",
    note: "Wheezing and bronchoconstriction",
  },
  {
    name: "Bronchiectasis",
    note: "Abnormal bronchial dilation",
  },
  {
    name: "URTI",
    note: "Upper Respiratory Tract Infection",
  },
  {
    name: "LRTI",
    note: "Lower Respiratory Tract Infection",
  },
  {
    name: "Pneumonia",
    note: "Lung consolidation pattern",
  },
  {
    name: "Bronchiolitis",
    note: "Small airway inflammation",
  },
];

const TECH_STACK = [
  {
    category: "Model",
    items: [
      "TensorFlow / Keras",
      "Convolutional Neural Network (CNN)",
      "Mel Spectrogram (128 bands, 128x128px)",
    ],
  },
  {
    category: "Training Data",
    items: [
      "ICBHI 2017 Respiratory Sound Database",
      "920 recordings, 126 patients",
      "Majority vote across multi-sample sessions",
    ],
  },
  {
    category: "Backend",
    items: ["Python 3.11+", "FastAPI", "Librosa", "Soundfile", "Joblib"],
  },
  {
    category: "Frontend",
    items: ["React 18 + Vite 5", "Tailwind CSS v4", "Lucide React", "jsPDF"],
  },
];

// Pipeline step with optional connector line below the icon
function PipelineStep({ icon: Icon, title, detail, isLast }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "flex-start",
        gap: 14,
      }}
    >
      {/* Pipeline icon and connector */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          flexShrink: 0,
        }}
      >
        <div
          style={{
            width: 40,
            height: 40,
            borderRadius: 12,
            background: "var(--accent-bg)",
            border: "1px solid var(--accent-border)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Icon
            style={{
              width: 18,
              height: 18,
              color: "var(--accent)",
            }}
            strokeWidth={1.8}
          />
        </div>

        {/* Connector line between steps */}
        {!isLast && (
          <div
            style={{
              width: 1,
              height: 28,
              background: "var(--border)",
              marginTop: 4,
            }}
          />
        )}
      </div>

      {/* Step content */}
      <div
        style={{
          paddingTop: 8,
          paddingBottom: isLast ? 0 : 20,
        }}
      >
        <p
          style={{
            fontSize: "var(--fs-base)",
            fontWeight: 600,
            color: "var(--text-h)",
            marginBottom: 3,
          }}
        >
          {title}
        </p>

        <p
          style={{
            fontSize: "var(--fs-sm)",
            color: "var(--text)",
            lineHeight: 1.6,
            opacity: 0.8,
          }}
        >
          {detail}
        </p>
      </div>
    </div>
  );
}

function AboutPage() {
  return (
    // Two-column layout — single column on mobile, side by side on sm+
    <div className="page-grid">
      {/* Left Column */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 14,
        }}
      >
        {/* Hero Section */}
        <div
          style={{
            paddingLeft: 6,
            paddingRight: 6,
          }}
        >
          <p
            style={{
              ...LABEL,
              marginBottom: 12,
            }}
          >
            Portfolio Project
          </p>

          <h1
            style={{
              fontSize: 22,
              fontWeight: 800,
              color: "var(--text-h)",
              letterSpacing: "-0.03em",
              lineHeight: 1.25,
              marginBottom: 12,
            }}
          >
            Respiratory Disease Classification from Lung Audio
          </h1>

          <p
            style={{
              fontSize: "var(--fs-md)",
              color: "var(--text)",
              lineHeight: 1.8,
              marginBottom: 10,
            }}
          >
            Pulmo AI classifies respiratory diseases from lung audio recordings. WAV files are
            converted into mel spectrograms and processed by a CNN model to predict 7 conditions.
            The system includes a full pipeline with model training, FastAPI backend, and React
            frontend.
          </p>

          <p
            style={{
              fontSize: "var(--fs-md)",
              color: "var(--text)",
              lineHeight: 1.8,
            }}
          >
            The main challenge was dataset imbalance in ICBHI 2017, where COPD dominates most
            samples. To handle this, augmentation was used for underrepresented classes, improving
            overall prediction reliability across multiple conditions.
          </p>
        </div>

        {/* Supported Conditions */}
        <div className="med-card" style={{ padding: 20 }}>
          <p style={LABEL}>Supported Conditions</p>

          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 9,
            }}
          >
            {CONDITIONS.map((c) => (
              <div
                key={c.name}
                style={{
                  display: "flex",
                  gap: 12,
                  alignItems: "flex-start",
                }}
              >
                <div
                  style={{
                    width: 7,
                    height: 7,
                    borderRadius: "50%",
                    background: "var(--accent)",
                    flexShrink: 0,
                    marginTop: 5,
                  }}
                />

                <div>
                  <span
                    style={{
                      fontSize: "var(--fs-base)",
                      fontWeight: 600,
                      color: "var(--text-h)",
                    }}
                  >
                    {c.name}
                  </span>

                  <span
                    style={{
                      fontSize: "var(--fs-sm)",
                      color: "var(--text)",
                      opacity: 0.6,
                      marginLeft: 8,
                    }}
                  >
                    {c.note}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Training Dataset */}
        <div className="med-card" style={{ padding: 20 }}>
          <p style={LABEL}>Training Dataset</p>

          <p
            style={{
              fontSize: "var(--fs-base)",
              color: "var(--text)",
              lineHeight: 1.75,
              marginBottom: 10,
            }}
          >
            Trained on the{" "}
            <strong style={{ color: "var(--text-h)" }}>
              ICBHI 2017 Respiratory Sound Database
            </strong>
            , a clinical dataset of 126 patients with 920 annotated recordings (~5.5 hours of
            audio). The data is heavily imbalanced, with COPD dominating most samples, making
            minority class learning the main challenge of this project.
          </p>

          <a
            href="https://bhichallenge.med.auth.gr/ICBHI_2017_Challenge"
            target="_blank"
            rel="noopener noreferrer"
            className="btn-secondary"
            style={{
              textDecoration: "none",
              display: "inline-flex",
              fontSize: "var(--fs-sm)",
            }}
          >
            <ExternalLinkIcon
              style={{
                width: 13,
                height: 13,
              }}
              strokeWidth={2}
            />
            ICBHI 2017 Official Page
          </a>

          {/* Fallback note if official site is down */}
          <p
            style={{
              fontSize: "var(--fs-xs)",
              color: "var(--text)",
              opacity: 0.5,
              marginTop: 8,
              lineHeight: 1.6,
            }}
          >
            If the link is broken, search &quot;ICBHI 2017 dataset Kaggle&quot; for a mirror.
          </p>
        </div>

        {/* Disclaimer */}
        <div
          className="med-card"
          style={{
            padding: 20,
            background: "var(--danger-bg)",
            borderColor: "var(--danger-border)",
          }}
        >
          <p
            style={{
              fontSize: "var(--fs-xs)",
              fontWeight: 700,
              textTransform: "uppercase",
              letterSpacing: "0.08em",
              color: "var(--danger)",
              marginBottom: 8,
            }}
          >
            Disclaimer
          </p>

          <p
            style={{
              fontSize: "var(--fs-base)",
              color: "var(--danger)",
              opacity: 0.85,
              lineHeight: 1.7,
            }}
          >
            This project is for educational and research purposes only and is not intended for
            clinical use.
            <br />
            <br />
            The model was trained on a limited and imbalanced dataset (ICBHI 2017), so predictions
            may not always be accurate. Results are highly dependent on recording quality, with
            clinical stethoscope recordings performing best. Background noise or low-quality audio
            can significantly reduce reliability.
            <br />
            <br />
            This system is not a substitute for professional medical diagnosis, treatment, or
            advice. Always consult a qualified healthcare professional for any medical concerns.
          </p>
        </div>
      </div>

      {/* Right Column */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 14,
        }}
      >
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
          Technical Details
        </p>

        {/* AI Pipeline */}
        <div className="med-card" style={{ padding: 20 }}>
          <p style={LABEL}>AI Pipeline</p>

          <p
            style={{
              fontSize: "var(--fs-base)",
              color: "var(--text)",
              lineHeight: 1.65,
              marginBottom: 18,
            }}
          >
            Every uploaded WAV goes through this before a diagnosis is returned:
          </p>

          <PipelineStep
            icon={VolumeIcon}
            title="WAV Input"
            detail="Raw lung recording received. WAV only, up to 10 MB. Up to 10 files per session for majority voting."
          />

          <PipelineStep
            icon={CpuIcon}
            title="Mel Spectrogram"
            detail="Loaded via Librosa, converted to a 128-band mel spectrogram using short-time Fourier transform. Saved as 128x128 grayscale."
          />

          <PipelineStep
            icon={LungsIcon}
            title="CNN Classification"
            detail="Normalized and passed through the CNN. Outputs a probability score across all 7 conditions."
          />

          <PipelineStep
            icon={DiagnoseIcon}
            title="Majority Vote"
            detail="Multiple files each get an independent prediction. The most frequent class wins, improving reliability across varying recording quality."
            isLast
          />
        </div>

        {/* System Architecture */}
        <div className="med-card" style={{ padding: 20 }}>
          <p style={LABEL}>System Architecture</p>

          {/* Backend */}
          <p
            style={{
              fontSize: "var(--fs-base)",
              fontWeight: 700,
              color: "var(--text-h)",
              marginBottom: 6,
            }}
          >
            FastAPI Backend
          </p>

          <p
            style={{
              fontSize: "var(--fs-base)",
              color: "var(--text)",
              lineHeight: 1.75,
              marginBottom: 10,
            }}
          >
            Receives WAV files via POST request, processes them using Librosa and a CNN model, and
            returns structured predictions with confidence scores and per-sample results.
          </p>

          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 4,
              marginBottom: 10,
            }}
          >
            {["POST /predict", "GET /health", "Max 10 files • 10 MB each"].map((item) => (
              <p
                key={item}
                style={{
                  fontSize: "var(--fs-xs)",
                  color: "var(--accent)",
                  fontFamily: "monospace",
                }}
              >
                {item}
              </p>
            ))}
          </div>

          <div
            style={{
              height: 1,
              background: "var(--border)",
              margin: "14px 0",
            }}
          />

          {/* Frontend */}
          <p
            style={{
              fontSize: "var(--fs-base)",
              fontWeight: 700,
              color: "var(--text-h)",
              marginBottom: 6,
            }}
          >
            React Frontend
          </p>

          <p
            style={{
              fontSize: "var(--fs-base)",
              color: "var(--text)",
              lineHeight: 1.75,
              marginBottom: 10,
            }}
          >
            Single-page application communicating with the backend using fetch. Results are stored
            in localStorage and support theme switching and mobile responsiveness.
          </p>

          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 4,
            }}
          >
            {["React 18 + Vite", "Tailwind CSS", "jsPDF export"].map((item) => (
              <p
                key={item}
                style={{
                  fontSize: "var(--fs-xs)",
                  color: "var(--accent)",
                  fontFamily: "monospace",
                }}
              >
                {item}
              </p>
            ))}
          </div>
        </div>

        {/* Tech Stack */}
        <div className="med-card" style={{ padding: 20 }}>
          <p style={LABEL}>Tech Stack</p>

          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 14,
            }}
          >
            {TECH_STACK.map((section) => (
              <div key={section.category}>
                <p
                  style={{
                    fontSize: "var(--fs-xs)",
                    fontWeight: 600,
                    color: "var(--text)",
                    opacity: 0.5,
                    textTransform: "uppercase",
                    letterSpacing: "0.06em",
                    marginBottom: 6,
                  }}
                >
                  {section.category}
                </p>

                <div
                  style={{
                    display: "flex",
                    flexWrap: "wrap",
                    gap: 6,
                  }}
                >
                  {section.items.map((item) => (
                    <span key={item} className="condition-pill">
                      {item}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export default AboutPage;
