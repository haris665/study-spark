import { motion } from "motion/react";
import { Sparkles, LibraryBig, Check } from "lucide-react";
import { useTheme, THEMES, type ThemeId } from "@/lib/theme";

interface ThemeToggleProps {
  variant?: "compact" | "card" | "dropdown";
  className?: string;
}

const THEME_ICONS: Record<ThemeId, React.ElementType> = {
  aurora: Sparkles,
  heritage: LibraryBig,
};

const THEME_ACCENTS: Record<ThemeId, { bg: string; border: string; preview: string }> = {
  aurora: {
    bg: "bg-[#0b2634]",
    border: "border-teal-300/40",
    preview: "from-[#7CE0D3] via-[#4BA6B8] to-[#1B4663]",
  },
  heritage: {
    bg: "bg-[#F7F2E9]",
    border: "border-[#C4653E]/45",
    preview: "from-[#29382E] via-[#E7A653] to-[#C4653E]",
  },
};

export function ThemeToggle({ variant = "compact", className = "" }: ThemeToggleProps) {
  const { theme, setTheme } = useTheme();

  if (variant === "card") {
    return (
      <div className={`grid grid-cols-1 sm:grid-cols-2 gap-3.5 ${className}`}>
        {THEMES.map((t) => {
          const isSelected = theme === t.id;
          const Icon = THEME_ICONS[t.id];
          const accent = THEME_ACCENTS[t.id];

          return (
            <motion.button
              key={t.id}
              type="button"
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => setTheme(t.id)}
              className={`relative flex flex-col justify-between p-4 rounded-2xl border text-left transition-colors cursor-pointer overflow-hidden ${
                isSelected
                  ? `bg-surface-2 ${accent.border} ring-2 ring-accent/30 shadow-md`
                  : "bg-surface border-border hover:border-border-2"
              }`}
            >
              {isSelected && (
                <motion.div
                  layoutId="cardThemeGlow"
                  className="absolute inset-0 bg-gradient-to-br from-accent/10 to-transparent pointer-events-none"
                  transition={{ type: "spring", stiffness: 350, damping: 28 }}
                />
              )}

              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div
                    className={`size-8 rounded-xl grid place-items-center bg-surface-3 ${
                      isSelected ? "text-accent" : "text-muted"
                    }`}
                  >
                    <Icon className="size-4" />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-foreground capitalize">{t.label}</h4>
                    <p className="text-[11px] text-faint">{t.hint}</p>
                  </div>
                </div>

                {isSelected && (
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    className="size-5 rounded-full bg-accent text-accent-foreground grid place-items-center shadow-xs"
                  >
                    <Check className="size-3 stroke-[3]" />
                  </motion.div>
                )}
              </div>

              {/* Theme swatch visual bar */}
              <div className="mt-2 flex items-center gap-1.5 pt-2 border-t border-border">
                <span className="text-[10px] font-mono text-faint uppercase tracking-wider">
                  Palette:
                </span>
                <div
                  className={`h-2.5 flex-1 rounded-full bg-gradient-to-r ${accent.preview} opacity-80`}
                />
              </div>
            </motion.button>
          );
        })}
      </div>
    );
  }

  // Compact bar switcher (for headers and top toolbars)
  return (
    <div
      className={`inline-flex items-center p-1 rounded-xl bg-surface-2 border border-border/80 shadow-xs ${className}`}
    >
      {THEMES.map((t) => {
        const isSelected = theme === t.id;
        const Icon = THEME_ICONS[t.id];

        return (
          <button
            key={t.id}
            type="button"
            onClick={() => setTheme(t.id)}
            className={`relative flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
              isSelected ? "text-foreground" : "text-muted hover:text-foreground"
            }`}
          >
            {isSelected && (
              <motion.div
                layoutId="compactThemePill"
                className="absolute inset-0 bg-surface border border-border-2 rounded-lg shadow-xs"
                transition={{ type: "spring", stiffness: 450, damping: 30 }}
              />
            )}
            <span className="relative z-10 flex items-center gap-1.5 capitalize">
              <Icon className={`size-3.5 ${isSelected ? "text-accent" : "text-faint"}`} />
              <span className="hidden sm:inline">{t.label}</span>
            </span>
          </button>
        );
      })}
    </div>
  );
}
