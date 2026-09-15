import { motion } from "motion/react";

interface StudySparkLogoProps {
  variant?: "full" | "mark";
  size?: "sm" | "md" | "lg";
  className?: string;
  animate?: boolean;
}

export function StudySparkLogo({
  variant = "full",
  size = "md",
  className = "",
  animate = true,
}: StudySparkLogoProps) {
  const iconSizes = {
    sm: "size-7",
    md: "size-9",
    lg: "size-11",
  };

  const textSizes = {
    sm: "text-sm",
    md: "text-[15px]",
    lg: "text-lg",
  };

  const subtitleSizes = {
    sm: "text-[9px]",
    md: "text-[10px]",
    lg: "text-[11px]",
  };

  const iconElement = (
    <motion.div
      whileHover={animate ? { scale: 1.05, rotate: 2 } : undefined}
      whileTap={animate ? { scale: 0.95 } : undefined}
      className={`relative grid ${iconSizes[size]} place-items-center rounded-xl p-1.5 shadow-sm transition-all duration-300 ${className}`}
      style={{
        background:
          "linear-gradient(135deg, color-mix(in oklab, var(--accent) 25%, var(--surface-2)) 0%, color-mix(in oklab, var(--amber) 20%, var(--surface-3)) 100%)",
        border: "1px solid color-mix(in oklab, var(--accent) 35%, var(--border-2))",
        boxShadow: "0 0 20px color-mix(in oklab, var(--accent) 15%, transparent)",
      }}
    >
      {/* Background glow radial */}
      <div
        className="absolute inset-0 rounded-xl opacity-40 blur-xs pointer-events-none"
        style={{
          background: "radial-gradient(circle at 30% 30%, var(--accent), transparent 70%)",
        }}
      />

      <svg
        viewBox="0 0 32 32"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="relative z-10 w-full h-full drop-shadow-sm"
      >
        <defs>
          <linearGradient
            id="sparkGradient"
            x1="2"
            y1="2"
            x2="30"
            y2="30"
            gradientUnits="userSpaceOnUse"
          >
            <stop stopColor="var(--accent)" />
            <stop offset="0.6" stopColor="var(--amber)" />
            <stop offset="1" stopColor="var(--accent)" />
          </linearGradient>
          <linearGradient
            id="bookGradient"
            x1="4"
            y1="16"
            x2="28"
            y2="28"
            gradientUnits="userSpaceOnUse"
          >
            <stop stopColor="var(--foreground)" stopOpacity="0.9" />
            <stop offset="1" stopColor="var(--foreground)" stopOpacity="0.4" />
          </linearGradient>
        </defs>

        {/* Open Book Wings */}
        <path
          d="M16 25C13.2 23 7 22.8 4 24.5V11C7 9.5 13.2 9.8 16 11.8C18.8 9.8 25 9.5 28 11V24.5C25 22.8 18.8 23 16 25Z"
          fill="url(#bookGradient)"
          fillOpacity="0.15"
          stroke="url(#bookGradient)"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* Book Spine Center line */}
        <path
          d="M16 12V25"
          stroke="var(--accent)"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeOpacity="0.8"
        />

        {/* Central Luminous 8-Pointed Star / Knowledge Spark */}
        <path
          d="M16 4L17.8 9.2L23 11L17.8 12.8L16 18L14.2 12.8L9 11L14.2 9.2L16 4Z"
          fill="url(#sparkGradient)"
        />

        {/* Small Ambient Sparkle Dot */}
        <circle cx="24.5" cy="7.5" r="1.2" fill="var(--amber)" className="animate-pulse" />
      </svg>
    </motion.div>
  );

  if (variant === "mark") {
    return iconElement;
  }

  return (
    <div className="flex items-center gap-3">
      {iconElement}
      <div className="leading-tight select-none">
        <div className="flex items-center gap-1.5">
          <span
            className={`font-serif font-bold tracking-tight text-foreground ${textSizes[size]}`}
          >
            StudySpark
          </span>
          <span
            className="rounded px-1.5 py-0.2 font-mono text-[9px] font-semibold uppercase tracking-wider text-accent"
            style={{
              background: "color-mix(in oklab, var(--accent) 12%, transparent)",
              border: "1px solid color-mix(in oklab, var(--accent) 25%, transparent)",
            }}
          >
            OS
          </span>
        </div>
        <p className={`font-mono uppercase tracking-[0.22em] text-faint ${subtitleSizes[size]}`}>
          MCQ Mastery
        </p>
      </div>
    </div>
  );
}
