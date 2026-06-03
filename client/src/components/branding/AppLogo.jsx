import clsx from "clsx";

import { LungsIcon } from "../../assets/icons";

function AppLogo({ iconOnly = false, size = 32 }) {
  const iconSize = Math.round(size * 0.52);
  const radius = Math.round(size * 0.28);

  return (
    <div className="flex flex-shrink-0 items-center gap-[10px]">
      {/* Logo Icon */}
      <div
        className={clsx(
          "flex flex-shrink-0 items-center justify-center",
          "bg-[linear-gradient(135deg,var(--accent),var(--accent-hover))]",
          "shadow-[0_2px_10px_var(--accent-bg)]",
        )}
        style={{
          width: size,
          height: size,
          borderRadius: radius,
        }}
      >
        <LungsIcon
          style={{ width: iconSize, height: iconSize }}
          className="text-white"
          strokeWidth={1.8}
        />
      </div>

      {/* Logo Text */}
      {!iconOnly && (
        <div className="select-none leading-[1.15]">
          <div
            className={clsx(
              "font-[var(--font-sans)]",
              "text-[15px] font-bold",
              "tracking-[-0.02em]",
              "text-[var(--text-h)]",
            )}
          >
            Pulmo AI
          </div>

          <div
            className={clsx(
              "mt-[3px]",
              "font-[var(--font-sans)]",
              "text-[9px] font-semibold uppercase",
              "tracking-[0.08em]",
              "text-[var(--accent)]",
            )}
          >
            Respiratory Dx
          </div>
        </div>
      )}
    </div>
  );
}

export default AppLogo;
