import { useState, useEffect, useRef } from "react";

import clsx from "clsx";
import jsPDF from "jspdf";
import { StethoscopeIcon } from "lucide-react";

import {
  UploadIcon,
  TrashIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  EyeIcon,
  DownloadIcon,
  AlertIcon,
  FileTextIcon,
  TerminalIcon,
  RotateCcwIcon,
  DiagnoseIcon,
  LungsIcon,
  MicIcon,
} from "../assets/icons";

const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:8000";
const DIAGNOSIS_KEY = "pulmo-last-diagnosis";
const MAX_FILES = 10;
const MAX_MB = 10;

const DETECTABLE_CONDITIONS = [
  "Healthy",
  "COPD",
  "Asthma",
  "Bronchiectasis",
  "URTI",
  "LRTI",
  "Pneumonia",
  "Bronchiolitis",
];

const sleep = (ms) => new Promise((res) => setTimeout(res, ms));

// Read persisted diagnosis once at load time — avoids setState-in-effect warning
function loadStoredResult() {
  try {
    const saved = localStorage.getItem(DIAGNOSIS_KEY);
    if (!saved) return null;
    return { ...JSON.parse(saved), isStored: true };
  } catch {
    return null;
  }
}

function getSeverityBadge(severity) {
  const map = {
    normal: { cls: "badge-normal", label: "Normal" },
    moderate: { cls: "badge-moderate", label: "Moderate" },
    high: { cls: "badge-high", label: "High Risk" },
  };
  return map[severity] || { cls: "badge-unknown", label: "Unknown" };
}

function getSeverityColor(severity) {
  if (severity === "normal") return "var(--success)";
  if (severity === "moderate") return "var(--warning)";
  if (severity === "high") return "var(--danger)";
  return "var(--text-h)";
}

// Generates and triggers a PDF download for the diagnosis result
function downloadPDF(result) {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const pageW = 210;
  const margin = 20;
  const cw = pageW - margin * 2;
  let y = 0;

  doc.setFillColor(2, 100, 180);
  doc.rect(0, 0, pageW, 46, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(22);
  doc.setFont("helvetica", "bold");
  doc.text("PULMO AI", margin, 18);
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.text("Respiratory Disease Analysis Report", margin, 28);
  doc.text(`Generated: ${new Date(result.diagnosedAt).toLocaleString()}`, margin, 36);
  const headerMeta = [`Total Samples: ${result.total_samples}`];
  if (result.processingTime) headerMeta.push(`Processing Time: ${result.processingTime}`);
  doc.text(headerMeta.join("   ·   "), pageW - margin, 36, { align: "right" });

  y = 58;

  doc.setTextColor(15, 20, 40);
  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.text("FINAL DIAGNOSIS", margin, y);
  y += 5;
  doc.setDrawColor(200, 210, 220);
  doc.line(margin, y, pageW - margin, y);
  y += 10;

  const rgbMap = { high: [190, 30, 30], moderate: [180, 100, 10], normal: [10, 120, 80] };
  const rgb = rgbMap[result.severity] || [40, 40, 80];

  doc.setFontSize(28);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...rgb);
  doc.text(result.final_prediction.toUpperCase(), margin, y);
  y += 9;
  doc.setFontSize(9);
  doc.setFont("helvetica", "bold");
  doc.text(`Severity: ${result.severity?.toUpperCase()}`, margin, y);
  y += 14;

  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(15, 20, 40);
  doc.text("Clinical Description", margin, y);
  y += 6;
  doc.setFont("helvetica", "normal");
  doc.setTextColor(55, 65, 85);
  const descLines = doc.splitTextToSize(result.description, cw);
  doc.text(descLines, margin, y);
  y += descLines.length * 5 + 9;

  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(15, 20, 40);
  doc.text("Clinical Recommendation", margin, y);
  y += 6;
  doc.setFont("helvetica", "normal");
  doc.setTextColor(55, 65, 85);
  const recLines = doc.splitTextToSize(result.recommendation, cw);
  doc.text(recLines, margin, y);
  y += recLines.length * 5 + 14;

  // Samples table
  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(15, 20, 40);
  doc.text("ANALYZED SAMPLES", margin, y);
  y += 5;
  doc.line(margin, y, pageW - margin, y);
  y += 8;

  doc.setFontSize(8.5);
  doc.setFont("helvetica", "bold");
  doc.setFillColor(224, 242, 254);
  doc.rect(margin, y - 4, cw, 9, "F");
  doc.setTextColor(15, 20, 40);
  doc.text("#", margin + 3, y + 2);
  doc.text("File Name", margin + 12, y + 2);
  doc.text("Prediction", margin + 106, y + 2);
  doc.text("Confidence", margin + 144, y + 2);
  y += 9;

  doc.setFont("helvetica", "normal");
  doc.setTextColor(55, 65, 85);
  result.samples?.forEach((s, i) => {
    if (i % 2 === 0) {
      doc.setFillColor(248, 251, 255);
      doc.rect(margin, y - 4, cw, 8, "F");
    }
    const name = s.filename.length > 40 ? s.filename.slice(0, 37) + "..." : s.filename;
    doc.text(String(i + 1), margin + 3, y + 1);
    doc.text(name, margin + 12, y + 1);
    doc.text(s.prediction, margin + 106, y + 1);
    doc.text(`${(s.confidence * 100).toFixed(1)}%`, margin + 144, y + 1);
    y += 8;
  });

  y += 16;

  const disclaimer =
    "DISCLAIMER: This report was generated by Pulmo AI for educational and research purposes only. " +
    "The AI model was trained on a limited and imbalanced lung sound dataset (ICBHI 2017), so predictions may be inaccurate. " +
    "Recording quality strongly affects reliability, and clinical-quality stethoscope recordings provide the best results. " +
    "Background noise and standard microphone recordings can significantly reduce accuracy. " +
    "This report is not a substitute for professional medical diagnosis, treatment, or advice. " +
    "Always consult a qualified healthcare professional for medical concerns.";

  const discLines = doc.splitTextToSize(disclaimer, cw - 10);
  const discH = discLines.length * 4.5 + 14;

  if (y + discH > 272) {
    doc.addPage();
    y = 20;
  }

  doc.setFillColor(255, 238, 238);
  doc.setDrawColor(200, 50, 50);
  doc.setLineWidth(0.4);
  doc.rect(margin, y, cw, discH, "FD");
  doc.setFontSize(8);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(160, 30, 30);
  doc.text("DISCLAIMER", margin + 5, y + 8);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(130, 40, 40);
  doc.text(discLines, margin + 5, y + 15);

  const dateStr = new Date().toISOString().split("T")[0];
  doc.save(`pulmo-ai-report-${dateStr}.pdf`);
}

// FileItem

function FileItem({ file, index, onRemove }) {
  const [audioUrl, setAudioUrl] = useState(null);
  const [showPlayer, setShowPlayer] = useState(false);

  const togglePlayer = () => {
    if (!showPlayer && !audioUrl) setAudioUrl(URL.createObjectURL(file));
    setShowPlayer((p) => !p);
  };

  // Revoke object URL on unmount to avoid memory leaks
  useEffect(() => {
    return () => {
      if (audioUrl) URL.revokeObjectURL(audioUrl);
    };
  }, [audioUrl]);

  const sizeKB = (file.size / 1024).toFixed(0);

  return (
    <div
      style={{
        background: "var(--card2)",
        border: "1px solid var(--border)",
        borderRadius: 12,
        padding: 11,
        marginBottom: 6,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
        {/* File Icon */}
        <div
          style={{
            width: 32,
            height: 32,
            borderRadius: 8,
            background: "var(--accent-bg)",
            border: "1px solid var(--accent-border)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
          }}
        >
          <FileTextIcon style={{ width: 15, height: 15, color: "var(--accent)" }} strokeWidth={2} />
        </div>

        {/* File Info */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <p
            style={{
              fontSize: "var(--fs-base)",
              fontWeight: 500,
              color: "var(--text-h)",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {file.name}
          </p>
          <p style={{ fontSize: "var(--fs-xs)", color: "var(--text)", opacity: 0.6, marginTop: 1 }}>
            {sizeKB} KB · WAV
          </p>
        </div>

        <button
          onClick={togglePlayer}
          className="btn-ghost"
          style={{ padding: "3px 8px", fontSize: "var(--fs-xs)" }}
        >
          {showPlayer ? "Hide" : "Preview"}
        </button>

        <button
          onClick={() => onRemove(index)}
          title="Remove file"
          style={{
            background: "transparent",
            border: "none",
            cursor: "pointer",
            color: "var(--danger)",
            display: "flex",
            alignItems: "center",
            padding: 4,
            borderRadius: 7,
            opacity: 0.65,
            transition: "opacity 0.14s ease",
          }}
          onMouseEnter={(e) => (e.currentTarget.style.opacity = "1")}
          onMouseLeave={(e) => (e.currentTarget.style.opacity = "0.65")}
        >
          <TrashIcon style={{ width: 14, height: 14 }} strokeWidth={2} />
        </button>
      </div>

      {showPlayer && audioUrl && (
        <audio
          src={audioUrl}
          controls
          style={{
            width: "100%",
            marginTop: 10,
            height: 34,
            borderRadius: 8,
            accentColor: "var(--accent)",
          }}
        />
      )}
    </div>
  );
}

// InputSection

function InputSection({
  files,
  isDragging,
  isRunning,
  diagnosisComplete,
  onDragOver,
  onDragLeave,
  onDrop,
  onAddFiles,
  onRemoveFile,
  onRunDiagnosis,
  onReset,
  onGoToSamples,
}) {
  const fileInputRef = useRef(null);

  const handleFileInputChange = (e) => {
    if (e.target.files) onAddFiles(Array.from(e.target.files));
    e.target.value = "";
  };

  return (
    <div className="med-card" style={{ padding: 20 }}>
      {/* Section Header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "flex-start",
          margin: "0 0 14px 0",
          gap: 8,
          flexWrap: "wrap",
        }}
      >
        <p
          style={{
            fontSize: "var(--fs-xs)",
            fontWeight: 600,
            textTransform: "uppercase",
            letterSpacing: "0.08em",
            color: "var(--accent)",
          }}
        >
          Audio Sample Input
        </p>

        <span
          style={{
            width: 4,
            height: 4,
            borderRadius: "50%",
            background: "var(--border)",
            opacity: 0.7,
            flexShrink: 0,
          }}
        />

        {/* Sample diagnosis shortcut */}
        <button
          className="btn-ghost"
          onClick={onGoToSamples}
          style={{
            padding: "5px 10px",
            fontSize: "var(--fs-xs)",
            height: 30,
            borderRadius: 999,
            background: "var(--accent-bg)",
            border: "1px solid var(--accent-border)",
            color: "var(--accent)",
            display: "flex",
            alignItems: "center",
            gap: 6,
          }}
        >
          <StethoscopeIcon style={{ width: 12, height: 12 }} strokeWidth={2} />
          Sample Diagnosis
        </button>
      </div>

      {/* Drop Zone */}
      <div
        className={clsx("drop-zone", isDragging && "dragging")}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
        onClick={() => !isRunning && fileInputRef.current?.click()}
      >
        <UploadIcon
          style={{
            width: 26,
            height: 26,
            color: "var(--accent)",
            margin: "0 auto 9px",
            display: "block",
          }}
          strokeWidth={1.5}
        />
        <p style={{ fontSize: "var(--fs-base)", fontWeight: 500, color: "var(--text-h)", marginBottom: 4 }}>
          Drop WAV files here or click to browse
        </p>
        <p style={{ fontSize: "var(--fs-sm)", color: "var(--text)", opacity: 0.6 }}>
          Up to {MAX_FILES} files &middot; Max {MAX_MB} MB each
        </p>

        {/* Recording quality note */}
        <div
          style={{
            display: "inline-flex",
            gap: 8,
            alignItems: "flex-start",
            marginTop: 10,
            padding: "8px 11px",
            border: "1px solid var(--border)",
            borderRadius: 9,
            width: "fit-content",
          }}
        >
          <MicIcon
            style={{ width: 13, height: 13, color: "var(--accent)", flexShrink: 0, marginTop: 1 }}
            strokeWidth={2}
          />
          <p style={{ fontSize: "var(--fs-xs)", color: "var(--text)", opacity: 0.7, lineHeight: 1.55 }}>
            Use stethoscope or lung sound device recordings for best results.
          </p>
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept=".wav"
          multiple
          onChange={handleFileInputChange}
          style={{ display: "none" }}
        />
      </div>

      {/* File List */}
      {files.length > 0 && (
        <div style={{ marginTop: 14 }}>
          <p style={{ fontSize: "var(--fs-xs)", color: "var(--text)", opacity: 0.6, marginBottom: 8 }}>
            {files.length} / {MAX_FILES} file{files.length !== 1 ? "s" : ""} selected
          </p>

          {/* Scrollable to prevent tall layout push */}
          <div
            style={{
              maxHeight: "clamp(150px, 26dvh, 270px)",
              overflowY: "auto",
              paddingRight: 2,
            }}
          >
            {files.map((file, i) => (
              <FileItem key={`${file.name}-${i}`} file={file} index={i} onRemove={onRemoveFile} />
            ))}
          </div>
        </div>
      )}

      {/* Action Button */}
      {diagnosisComplete ? (
        <button
          className="btn-primary"
          onClick={onReset}
          style={{ marginTop: 14, width: "100%", justifyContent: "center" }}
        >
          <RotateCcwIcon style={{ width: 14, height: 14 }} strokeWidth={2.5} />
          Run New Diagnosis
        </button>
      ) : (
        <button
          className="btn-primary"
          onClick={onRunDiagnosis}
          disabled={files.length === 0 || isRunning}
          style={{ marginTop: 14, width: "100%", justifyContent: "center" }}
        >
          {isRunning ? (
            <>
              <div className="ai-spinner" style={{ width: 14, height: 14, borderWidth: 2 }} />
              Analyzing...
            </>
          ) : (
            <>
              <DiagnoseIcon style={{ width: 14, height: 14 }} strokeWidth={2} />
              Run Diagnosis
            </>
          )}
        </button>
      )}
    </div>
  );
}

function DiagnosisProgress() {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setElapsed((s) => s + 1), 1000);
    return () => clearInterval(id);
  }, []);

  const mins = Math.floor(elapsed / 60);
  const secs = elapsed % 60;
  const timeStr = mins > 0 ? `${mins}m ${secs}s` : `${secs}s`;

  return (
    <div
      className="med-card"
      style={{
        padding: 24,
        height: "100%",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 16,
      }}
    >
      <div className="ai-spinner" style={{ width: 36, height: 36 }} />

      <p style={{ fontSize: 13, fontWeight: 600, color: "var(--text-h)" }}>
        Analysing audio samples…
      </p>

      <div
        style={{
          background: "var(--card2)",
          border: "1px solid var(--border)",
          borderRadius: 10,
          padding: "9px 18px",
          display: "flex",
          alignItems: "center",
          gap: 10,
        }}
      >
        <p style={{ fontSize: 12, color: "var(--text)", opacity: 0.7 }}>
          Processing time
        </p>
        <p style={{ fontSize: 13, fontWeight: 700, color: "var(--accent)", fontFamily: "monospace" }}>
          {timeStr}
        </p>
      </div>

      <p style={{ fontSize: 12, color: "var(--text)", opacity: 0.45, textAlign: "center", lineHeight: 1.6 }}>
        This may take a moment depending on the number
        <br />
        of files and server load. Please hold on.
      </p>
    </div>
  );
}

// OutputSection

function OutputSection({ result, isRunning, error, onViewReport, onDownloadPDF }) {
  // Empty state
  if (!error && !isRunning && !result) {
    return (
      <div
        className="med-card"
        style={{
          padding: 20,
          height: "100%",
          display: "flex",
          flexDirection: "column",
          textAlign: "center",
        }}
      >
        <p
          style={{
            fontSize: "var(--fs-xs)",
            fontWeight: 600,
            textTransform: "uppercase",
            letterSpacing: "0.08em",
            color: "var(--accent)",
            marginBottom: 14,
            textAlign: "left",
          }}
        >
          Diagnosis Output
        </p>

        {/* Empty Placeholder */}
        <div
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <div
            style={{
              width: 52,
              height: 52,
              borderRadius: 16,
              background: "var(--card2)",
              border: "1px solid var(--border)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              marginBottom: 12,
            }}
          >
            <LungsIcon
              style={{ width: 26, height: 26, color: "var(--accent)" }}
              strokeWidth={1.5}
            />
          </div>

          <p style={{ fontSize: "var(--fs-md)", fontWeight: 600, color: "var(--text-h)", marginBottom: 5 }}>
            No diagnosis yet
          </p>
          <p
            style={{
              fontSize: "var(--fs-sm)",
              color: "var(--text)",
              opacity: 0.6,
              lineHeight: 1.7,
              maxWidth: 320,
              textAlign: "center",
              textWrap: "balance",
            }}
          >
            Upload lung audio or try a sample diagnosis.
          </p>
        </div>

        {/* Detectable Conditions */}
        <div style={{ marginTop: 18, width: "100%" }}>
          <p
            style={{
              fontSize: 10,
              fontWeight: 600,
              textTransform: "uppercase",
              letterSpacing: "0.07em",
              color: "var(--text)",
              opacity: 0.45,
              marginBottom: 8,
            }}
          >
            Detectable Conditions
          </p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 5, justifyContent: "center" }}>
            {DETECTABLE_CONDITIONS.map((c) => (
              <span key={c} className="condition-pill">
                {c}
              </span>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="med-card" style={{ padding: 20 }}>
        <p
          style={{
            fontSize: "var(--fs-xs)",
            fontWeight: 600,
            textTransform: "uppercase",
            letterSpacing: "0.08em",
            color: "var(--danger)",
            marginBottom: 14,
          }}
        >
          Error
        </p>
        <div
          style={{
            background: "var(--danger-bg)",
            border: "1px solid var(--danger-border)",
            borderRadius: 12,
            padding: 14,
            display: "flex",
            gap: 10,
            alignItems: "flex-start",
          }}
        >
          <AlertIcon
            style={{ width: 17, height: 17, color: "var(--danger)", flexShrink: 0, marginTop: 1 }}
            strokeWidth={2}
          />
          <p style={{ fontSize: "var(--fs-base)", color: "var(--danger)", lineHeight: 1.55 }}>{error}</p>
        </div>
      </div>
    );
  }

  // Loading state
  if (isRunning && !result) {
    return <DiagnosisProgress />;
  }

  if (!result) return null;

  const badge = getSeverityBadge(result.severity);
  const color = getSeverityColor(result.severity);

  return (
    <div className="med-card" style={{ padding: 20 }}>
      {/* Result Header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 14,
        }}
      >
        <p
          style={{
            fontSize: "var(--fs-xs)",
            fontWeight: 600,
            textTransform: "uppercase",
            letterSpacing: "0.08em",
            color: "var(--accent)",
          }}
        >
          {result.isStored ? "Previous Diagnosis" : "Diagnosis Result"}
        </p>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          {result.processingTime && !result.isStored && (
            <span style={{ fontSize: "var(--fs-xs)", color: "var(--text)", opacity: 0.45, fontFamily: "monospace" }}>
              {result.processingTime}
            </span>
          )}
          {result.isStored && result.diagnosedAt && (
            <span style={{ fontSize: "var(--fs-xs)", color: "var(--text)", opacity: 0.45 }}>
              {new Date(result.diagnosedAt).toLocaleDateString()}
            </span>
          )}
        </div>
      </div>

      {/* Severity Badge and Diagnosis Name */}
      <div style={{ marginBottom: 14 }}>
        <span className={`badge ${badge.cls}`}>{badge.label}</span>
        <h2
          style={{
            fontSize: 30,
            fontWeight: 800,
            color,
            letterSpacing: "-0.03em",
            lineHeight: 1.1,
            marginTop: 8,
            marginBottom: 4,
          }}
        >
          {result.final_prediction}
        </h2>
      </div>

      {/* Clinical Description */}
      <p
        style={{
          fontSize: "var(--fs-base)",
          color: "var(--text)",
          lineHeight: 1.65,
          marginBottom: 12,
          paddingBottom: 12,
          borderBottom: "1px solid var(--border)",
        }}
      >
        {result.description}
      </p>

      {/* Recommendation */}
      <div
        style={{
          background: "var(--card2)",
          border: "1px solid var(--border)",
          borderRadius: 10,
          padding: "10px 13px",
          marginBottom: 14,
        }}
      >
        <p
          style={{
            fontSize: 10,
            fontWeight: 600,
            textTransform: "uppercase",
            letterSpacing: "0.06em",
            color: "var(--text)",
            opacity: 0.55,
            marginBottom: 4,
          }}
        >
          Recommendation
        </p>
        <p style={{ fontSize: "var(--fs-base)", color: "var(--text-h)", lineHeight: 1.6 }}>
          {result.recommendation}
        </p>
      </div>

      {/* Sample Breakdown */}
      {result.samples?.length > 0 && (
        <div style={{ marginBottom: 14 }}>
          <p
            style={{
              fontSize: 10,
              fontWeight: 600,
              textTransform: "uppercase",
              letterSpacing: "0.06em",
              color: "var(--text)",
              opacity: 0.55,
              marginBottom: 8,
            }}
          >
            Sample Breakdown
          </p>
          <div style={{ maxHeight: 180, overflowY: "auto" }}>
            {result.samples.map((s, i) => (
              <div
                key={i}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  padding: "7px 0",
                  borderBottom: i < result.samples.length - 1 ? "1px solid var(--border)" : "none",
                }}
              >
                <span
                  style={{
                    fontSize: 10,
                    fontWeight: 700,
                    color: "var(--accent)",
                    background: "var(--accent-bg)",
                    borderRadius: 5,
                    padding: "2px 6px",
                    flexShrink: 0,
                  }}
                >
                  {i + 1}
                </span>
                <span
                  style={{
                    flex: 1,
                    fontSize: "var(--fs-sm)",
                    color: "var(--text)",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {s.filename}
                </span>
                <span
                  style={{ fontSize: "var(--fs-sm)", fontWeight: 600, color: "var(--text-h)", flexShrink: 0 }}
                >
                  {s.prediction}
                </span>
                <span
                  style={{
                    fontSize: "var(--fs-xs)",
                    color: "var(--text)",
                    opacity: 0.5,
                    flexShrink: 0,
                    minWidth: 42,
                    textAlign: "right",
                  }}
                >
                  {(s.confidence * 100).toFixed(1)}%
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Action Buttons */}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <button className="btn-secondary" onClick={onViewReport} style={{ flex: 1 }}>
          <EyeIcon style={{ width: 14, height: 14 }} strokeWidth={2} />
          View Report
        </button>
        <button className="btn-secondary" onClick={onDownloadPDF} style={{ flex: 1 }}>
          <DownloadIcon style={{ width: 14, height: 14 }} strokeWidth={2} />
          Download PDF
        </button>
      </div>

      {/* Short Disclaimer */}
      <p
        style={{
          fontSize: "var(--fs-xs)",
          color: "var(--danger)",
          opacity: 0.75,
          marginTop: 12,
          paddingTop: 10,
          borderTop: "1px solid var(--danger-border)",
          lineHeight: 1.55,
        }}
      >
        Disclaimer: Trained on limited and imbalanced lung sound data, so predictions may be
        inaccurate. Recording quality heavily affects results. Not a substitute for professional
        medical diagnosis.
      </p>
    </div>
  );
}

// ProcessingSection

function ProcessingSection({ steps, isRunning, isOpen, onToggle }) {
  const logRef = useRef(null);

  // Auto-scroll to bottom as new steps arrive
  useEffect(() => {
    if (logRef.current) {
      logRef.current.scrollTop = logRef.current.scrollHeight;
    }
  }, [steps]);

  return (
    <div className="med-card" style={{ padding: 0, overflow: "hidden", marginTop: 14 }}>
      {/* Collapsible Toggle Header */}
      <button
        onClick={onToggle}
        style={{
          width: "100%",
          display: "flex",
          alignItems: "center",
          gap: 9,
          padding: "11px 16px",
          background: "transparent",
          border: "none",
          cursor: "pointer",
          fontFamily: "var(--font-sans)",
          borderBottom: isOpen ? "1px solid var(--border)" : "none",
        }}
      >
        <TerminalIcon style={{ width: 14, height: 14, color: "var(--accent)" }} strokeWidth={2} />
        <span
          style={{
            fontSize: "var(--fs-sm)",
            fontWeight: 600,
            color: "var(--text-h)",
            flex: 1,
            textAlign: "left",
          }}
        >
          Processing Log
        </span>
        <span style={{ fontSize: "var(--fs-xs)", color: "var(--text)", opacity: 0.45, marginRight: 5 }}>
          {steps.length} step{steps.length !== 1 ? "s" : ""}
        </span>
        {isOpen ? (
          <ChevronUpIcon
            style={{ width: 14, height: 14, color: "var(--text)", opacity: 0.45 }}
            strokeWidth={2}
          />
        ) : (
          <ChevronDownIcon
            style={{ width: 14, height: 14, color: "var(--text)", opacity: 0.45 }}
            strokeWidth={2}
          />
        )}
      </button>

      {isOpen && (
        <div ref={logRef} className="proc-log" style={{ borderRadius: 0, border: "none" }}>
          {steps.map((step, i) => (
            <span key={i} className="proc-step">
              <span style={{ color: "var(--accent)", opacity: 0.45, marginRight: 8, fontSize: 10 }}>
                {String(i + 1).padStart(2, "0")}
              </span>
              {step}
            </span>
          ))}

          {isRunning && (
            <span className="proc-step">
              <span className="proc-cursor" />
            </span>
          )}

          {steps.length === 0 && !isRunning && (
            <span style={{ color: "var(--text)", opacity: 0.35 }}>Waiting for input...</span>
          )}
        </div>
      )}
    </div>
  );
}

// ReportModal

function ReportModal({ result, onClose }) {
  if (!result) return null;

  const badge = getSeverityBadge(result.severity);
  const color = getSeverityColor(result.severity);

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 1000,
        background: "rgba(0,0,0,0.55)",
        backdropFilter: "blur(5px)",
        WebkitBackdropFilter: "blur(5px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 16,
      }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        style={{
          background: "var(--card)",
          border: "1px solid var(--border)",
          borderRadius: 22,
          width: "100%",
          maxWidth: 680,
          maxHeight: "90vh",
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
          boxShadow: "var(--shadow-lg)",
        }}
      >
        {/* Modal Header */}
        <div
          style={{
            padding: "15px 20px",
            borderBottom: "1px solid var(--border)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            flexShrink: 0,
          }}
        >
          <h3 style={{ margin: 0, fontSize: "var(--fs-md)", fontWeight: 700 }}>Full Diagnosis Report</h3>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <button
              className="btn-secondary"
              onClick={() => downloadPDF(result)}
              style={{ padding: "6px 12px", fontSize: "var(--fs-sm)" }}
            >
              <DownloadIcon style={{ width: 13, height: 13 }} strokeWidth={2} />
              PDF
            </button>
            <button
              onClick={onClose}
              style={{
                width: 30,
                height: 30,
                borderRadius: "50%",
                border: "1px solid var(--border)",
                background: "var(--card2)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                cursor: "pointer",
                color: "var(--text)",
                fontSize: 16,
                lineHeight: 1,
                fontFamily: "var(--font-sans)",
              }}
            >
              &times;
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div style={{ flex: 1, overflowY: "auto", padding: 20 }}>
          {/* Session Meta */}
          <div
            style={{
              background: "var(--card2)",
              border: "1px solid var(--border)",
              borderRadius: 12,
              padding: "10px 14px",
              display: "flex",
              gap: 24,
              marginBottom: 20,
              flexWrap: "wrap",
            }}
          >
            <div>
              <p
                style={{
                  fontSize: 10,
                  fontWeight: 600,
                  textTransform: "uppercase",
                  letterSpacing: "0.06em",
                  color: "var(--text)",
                  opacity: 0.5,
                  marginBottom: 3,
                }}
              >
                Generated
              </p>
              <p style={{ fontSize: "var(--fs-sm)", fontWeight: 500, color: "var(--text-h)" }}>
                {result.diagnosedAt ? new Date(result.diagnosedAt).toLocaleString() : "—"}
              </p>
            </div>
            <div>
              <p
                style={{
                  fontSize: 10,
                  fontWeight: 600,
                  textTransform: "uppercase",
                  letterSpacing: "0.06em",
                  color: "var(--text)",
                  opacity: 0.5,
                  marginBottom: 3,
                }}
              >
                Samples
              </p>
              <p style={{ fontSize: "var(--fs-sm)", fontWeight: 500, color: "var(--text-h)" }}>
                {result.total_samples}
              </p>
            </div>

            {result.processingTime && (
              <div>
                <p
                  style={{
                    fontSize: 10,
                    fontWeight: 600,
                    textTransform: "uppercase",
                    letterSpacing: "0.06em",
                    color: "var(--text)",
                    opacity: 0.5,
                    marginBottom: 3,
                  }}
                >
                  Processing Time
                </p>
                <p style={{ fontSize: "var(--fs-sm)", fontWeight: 500, color: "var(--text-h)", fontFamily: "monospace" }}>
                  {result.processingTime}
                </p>
              </div>
            )}
          </div>

          {/* Diagnosis */}
          <div style={{ marginBottom: 20 }}>
            <span className={`badge ${badge.cls}`} style={{ marginBottom: 10 }}>
              {badge.label} Severity
            </span>
            <h2
              style={{
                fontSize: 32,
                fontWeight: 800,
                color,
                letterSpacing: "-0.03em",
                lineHeight: 1.1,
                marginTop: 8,
              }}
            >
              {result.final_prediction}
            </h2>
          </div>

          {/* Clinical Description */}
          <div style={{ marginBottom: 16 }}>
            <p
              style={{
                fontSize: 10,
                fontWeight: 700,
                textTransform: "uppercase",
                letterSpacing: "0.06em",
                color: "var(--text)",
                opacity: 0.5,
                marginBottom: 6,
              }}
            >
              Clinical Description
            </p>
            <p style={{ fontSize: "var(--fs-base)", color: "var(--text)", lineHeight: 1.7 }}>
              {result.description}
            </p>
          </div>

          {/* Clinical Recommendation */}
          <div style={{ marginBottom: 20 }}>
            <p
              style={{
                fontSize: 10,
                fontWeight: 700,
                textTransform: "uppercase",
                letterSpacing: "0.06em",
                color: "var(--text)",
                opacity: 0.5,
                marginBottom: 6,
              }}
            >
              Clinical Recommendation
            </p>
            <p style={{ fontSize: "var(--fs-base)", color: "var(--text)", lineHeight: 1.7 }}>
              {result.recommendation}
            </p>
          </div>

          {/* Sample Breakdown Table */}
          {result.samples?.length > 0 && (
            <div style={{ marginBottom: 20 }}>
              <p
                style={{
                  fontSize: 10,
                  fontWeight: 700,
                  textTransform: "uppercase",
                  letterSpacing: "0.06em",
                  color: "var(--text)",
                  opacity: 0.5,
                  marginBottom: 10,
                }}
              >
                Sample Breakdown
              </p>
              <div
                style={{ border: "1px solid var(--border)", borderRadius: 10, overflow: "hidden" }}
              >
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead>
                    <tr style={{ background: "var(--card2)" }}>
                      {["#", "File Name", "Prediction", "Confidence"].map((h) => (
                        <th
                          key={h}
                          style={{
                            padding: "8px 12px",
                            textAlign: h === "Confidence" ? "right" : "left",
                            fontSize: "var(--fs-xs)",
                            fontWeight: 600,
                            color: "var(--text)",
                            opacity: 0.6,
                            borderBottom: "1px solid var(--border)",
                          }}
                        >
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {result.samples.map((s, i) => (
                      <tr
                        key={i}
                        style={{
                          borderBottom:
                            i < result.samples.length - 1 ? "1px solid var(--border)" : "none",
                        }}
                      >
                        <td
                          style={{
                            padding: "8px 12px",
                            fontSize: "var(--fs-sm)",
                            color: "var(--accent)",
                            fontWeight: 600,
                          }}
                        >
                          {i + 1}
                        </td>
                        <td
                          style={{
                            padding: "8px 12px",
                            fontSize: "var(--fs-sm)",
                            color: "var(--text)",
                            maxWidth: 200,
                          }}
                        >
                          <span
                            style={{
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                              whiteSpace: "nowrap",
                              display: "block",
                            }}
                          >
                            {s.filename}
                          </span>
                        </td>
                        <td
                          style={{
                            padding: "8px 12px",
                            fontSize: "var(--fs-sm)",
                            fontWeight: 600,
                            color: "var(--text-h)",
                          }}
                        >
                          {s.prediction}
                        </td>
                        <td
                          style={{
                            padding: "8px 12px",
                            fontSize: "var(--fs-sm)",
                            color: "var(--text)",
                            textAlign: "right",
                          }}
                        >
                          {(s.confidence * 100).toFixed(1)}%
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Disclaimer */}
          <div
            style={{
              background: "var(--danger-bg)",
              border: "1px solid var(--danger-border)",
              borderRadius: 10,
              padding: 14,
            }}
          >
            <p style={{ fontSize: "var(--fs-xs)", fontWeight: 700, color: "var(--danger)", marginBottom: 6 }}>
              Disclaimer
            </p>
            <p style={{ fontSize: "var(--fs-sm)", color: "var(--danger)", opacity: 0.8, lineHeight: 1.65 }}>
              This report is generated by Pulmo AI for educational and research purposes only. The
              AI model was trained on a limited and imbalanced lung sound dataset (ICBHI 2017),
              which may lead to inaccurate predictions. Recording quality strongly affects
              reliability, and clinical quality stethoscope recordings provide the best results.
              Background noise and standard microphone recordings can significantly reduce accuracy.
              This report is not intended to provide medical advice, diagnosis, or treatment. Always
              consult a qualified healthcare professional for medical concerns.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

// DiagnosePage

function DiagnosePage({ navigate, autoTestFiles, onClearAutoTest }) {
  const [files, setFiles] = useState([]);
  const [isDragging, setIsDragging] = useState(false);
  const [isRunning, setIsRunning] = useState(false);
  const [diagnosisComplete, setDiagnosisComplete] = useState(false);
  const [processingSteps, setProcessingSteps] = useState([]);
  const [processingOpen, setProcessingOpen] = useState(false);
  const [error, setError] = useState(null);
  const [showReport, setShowReport] = useState(false);

  // Lazy initializer reads localStorage once at mount — no useEffect, no cascade
  const [result, setResult] = useState(loadStoredResult);

  const outputRef = useRef(null);

  const handleReset = () => {
    setFiles([]);
    setResult(null);
    setProcessingSteps([]);
    setError(null);
    setDiagnosisComplete(false);
    setProcessingOpen(false);
    localStorage.removeItem(DIAGNOSIS_KEY);
  };

  const addFiles = (incoming) => {
    const valid = incoming
      .filter((f) => f.name.toLowerCase().endsWith(".wav"))
      .filter((f) => f.size <= MAX_MB * 1024 * 1024);
    if (!valid.length) return;

    // Reset state if a new upload follows a completed diagnosis
    if (diagnosisComplete) {
      setResult(null);
      setProcessingSteps([]);
      setError(null);
      setDiagnosisComplete(false);
      setProcessingOpen(false);
      localStorage.removeItem(DIAGNOSIS_KEY);
      setFiles(valid.slice(0, MAX_FILES));
    } else {
      setFiles((prev) => [...prev, ...valid].slice(0, MAX_FILES));
    }
  };

  const removeFile = (index) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragging(true);
  };
  const handleDragLeave = () => setIsDragging(false);
  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    addFiles(Array.from(e.dataTransfer.files));
  };

  // Accepts an optional File[] override — used by both the button and the auto-test effect
  const runDiagnosis = async (overrideFiles) => {
    const filesToRun = Array.isArray(overrideFiles) ? overrideFiles : files;
    if (filesToRun.length === 0 || isRunning) return;

    // Populate the input panel immediately so the user sees the files
    if (Array.isArray(overrideFiles)) setFiles(overrideFiles);

    const diagnosisStart = Date.now();

    setIsRunning(true);
    setProcessingSteps([]);
    setError(null);
    setResult(null);
    setDiagnosisComplete(false);
    setProcessingOpen(true);

    // Scroll output into view on mobile as soon as diagnosis starts
    if (window.innerWidth < 640 && outputRef.current) {
      setTimeout(() => {
        const elementTop = outputRef.current.getBoundingClientRect().top + window.pageYOffset;
        window.scrollTo({ top: elementTop - 88, behavior: "smooth" });
      }, 200);
    }

    try {
      const formData = new FormData();
      filesToRun.forEach((f) => {
        if (f instanceof File) formData.append("files", f);
      });

      const response = await fetch(`${API_BASE}/predict`, {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.detail || "Diagnosis failed. Please check the backend.");
      }

      const data = await response.json();

      for (const step of data.processing_steps || []) {
        await sleep(55);
        setProcessingSteps((prev) => [...prev, step]);
      }

      const processingMs = Date.now() - diagnosisStart;
      const processingTime =
        processingMs < 60000
          ? `${(processingMs / 1000).toFixed(1)}s`
          : `${Math.floor(processingMs / 60000)}m ${((processingMs % 60000) / 1000).toFixed(0)}s`;

      const resultData = {
        ...data,
        diagnosedAt: new Date().toISOString(),
        processingTime,
        isStored: false,
      };

      localStorage.setItem(DIAGNOSIS_KEY, JSON.stringify(resultData));
      setResult(resultData);
      setDiagnosisComplete(true);

      // Scroll output into view on mobile after result arrives
      if (window.innerWidth < 640 && outputRef.current) {
        setTimeout(() => {
          const elementTop = outputRef.current.getBoundingClientRect().top + window.pageYOffset;
          window.scrollTo({ top: elementTop - 88, behavior: "smooth" });
        }, 200);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setIsRunning(false);
    }
  };

  // When Home passes files via autoTestFiles, load and run immediately
  // Captures the array locally and clears parent state so this fires only once
  useEffect(() => {
    if (!autoTestFiles?.length) return;
    const testFiles = autoTestFiles;
    onClearAutoTest?.();
    const timer = setTimeout(() => runDiagnosis(testFiles), 0);
    return () => clearTimeout(timer);
  }, [autoTestFiles]); // eslint-disable-line react-hooks/exhaustive-deps

  const hasProcessingContent = processingSteps.length > 0 || isRunning;

  return (
    <>
      {/* Two Panel Layout */}
      <div className="page-grid" style={{ alignItems: "stretch" }}>
        <InputSection
          files={files}
          isDragging={isDragging}
          isRunning={isRunning}
          diagnosisComplete={diagnosisComplete}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onAddFiles={addFiles}
          onRemoveFile={removeFile}
          onRunDiagnosis={runDiagnosis}
          onReset={handleReset}
          onGoToSamples={() => navigate?.("samples")}
        />

        {/* Output Panel — ref used for mobile scroll-into-view */}
        <div ref={outputRef} style={{ display: "flex", flexDirection: "column" }}>
          <OutputSection
            result={result}
            isRunning={isRunning}
            error={error}
            onViewReport={() => setShowReport(true)}
            onDownloadPDF={() => result && downloadPDF(result)}
          />
        </div>
      </div>

      {/* Processing Log — collapsible, full width */}
      {hasProcessingContent && (
        <ProcessingSection
          steps={processingSteps}
          isRunning={isRunning}
          isOpen={processingOpen}
          onToggle={() => setProcessingOpen((p) => !p)}
        />
      )}

      {/* Full Report Modal */}
      {showReport && result && <ReportModal result={result} onClose={() => setShowReport(false)} />}
    </>
  );
}

export default DiagnosePage;
