import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState, useMemo, useCallback } from "react";
import { motion, AnimatePresence } from "motion/react";
import { toast } from "sonner";
import QRCode from "qrcode";
import { QRCodeSVG } from "qrcode.react";
import { useQuery } from "@tanstack/react-query";
import { AppShell } from "@/components/app/AppShell";
import { StudySparkLogo } from "@/components/app/StudySparkLogo";
import { useAuth } from "@/lib/auth";
import { profileQuery, attemptsQuery, mcqsQuery, computeStreak } from "@/lib/queries";
import {
  createDevicePairingSession,
  resolveDevicePairingSession,
  type WorkspaceSyncPayload,
} from "@/lib/device-sync.functions";
import {
  QrCode,
  Smartphone,
  Laptop,
  Copy,
  Check,
  Share2,
  Download,
  RefreshCw,
  ExternalLink,
  Sparkles,
  Zap,
  ShieldCheck,
  Flame,
  ArrowRight,
  Wifi,
  Globe,
  Radio,
  BookOpen,
  FileText,
  Send,
  Tablet,
  CheckCircle2,
  Link as LinkIcon,
} from "lucide-react";

export const Route = createFileRoute("/scanner")({
  head: () => ({
    meta: [
      { title: "Universal Device Connect & QR Hub — StudySpark OS" },
      {
        name: "description",
        content:
          "Scan the universal QR code with any smartphone camera or tap the direct link to instantly connect your StudySpark workspace on any phone, tablet or laptop anywhere.",
      },
      { property: "og:title", content: "Universal Device Connect & QR Hub — StudySpark OS" },
      {
        property: "og:description",
        content:
          "Connect any phone or device to StudySpark in seconds with instant QR codes and universal links.",
      },
    ],
  }),
  component: UniversalDeviceConnectPage,
});

type ShareDestination = "workspace" | "app" | "practice" | "notes" | "ai";
type IncomingStatus = "idle" | "connecting" | "connected" | "expired";

const encodePayloadForUrl = (payload: WorkspaceSyncPayload) => {
  if (typeof window === "undefined") return "";
  const json = JSON.stringify(payload);
  const bytes = new TextEncoder().encode(json);
  return window.btoa(Array.from(bytes, (byte) => String.fromCharCode(byte)).join(""));
};

const decodePayloadFromUrl = (encoded: string): WorkspaceSyncPayload => {
  const binary = window.atob(encoded);
  const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
  return JSON.parse(new TextDecoder().decode(bytes)) as WorkspaceSyncPayload;
};

function UniversalDeviceConnectPage() {
  const { user } = useAuth();
  const { data: profile } = useQuery(profileQuery(user?.id));
  const { data: attempts = [] } = useQuery(attemptsQuery());
  const { data: mcqs = [] } = useQuery(mcqsQuery());

  const [destination, setDestination] = useState<ShareDestination>("workspace");
  const [copied, setCopied] = useState(false);
  const [appOrigin, setAppOrigin] = useState<string>("");
  const [customHost, setCustomHost] = useState<string>("");
  const [activeHostMode, setActiveHostMode] = useState<"auto" | "wifi" | "custom">("auto");
  const [wifiIp, setWifiIp] = useState<string>("");
  const [incomingStatus, setIncomingStatus] = useState<IncomingStatus>("idle");
  const [incomingPayload, setIncomingPayload] = useState<WorkspaceSyncPayload | null>(null);
  const [incomingPairCode, setIncomingPairCode] = useState<string>("");

  // Pairing session state
  const [pairingCode, setPairingCode] = useState<string>("SPARK-8920");
  const [expiresAt, setExpiresAt] = useState<number>(Date.now() + 15 * 60 * 1000);
  const [creatingPair, setCreatingPair] = useState<boolean>(false);
  const [timeLeft, setTimeLeft] = useState<string>("15:00");

  // Compute live study stats
  const streak = attempts.length ? computeStreak(attempts.map((a) => a.created_at)) : 0;
  const correctCount = attempts.filter((a) => a.is_correct).length;
  const accuracy = attempts.length ? Math.round((correctCount / attempts.length) * 100) : null;

  // Active workspace metadata payload
  const currentPayload: WorkspaceSyncPayload = useMemo(
    () => ({
      displayName: profile?.display_name || user?.displayName || "Student",
      examName: profile?.exam_name || "MDCAT 2026",
      theme: profile?.theme || "aurora",
      streak,
      totalAttempts: attempts.length,
      totalMcqs: mcqs.length,
      accuracy,
      sourceDevice:
        typeof navigator !== "undefined" && /Mobi|Android/i.test(navigator.userAgent)
          ? "Mobile Phone"
          : "Laptop / Desktop",
    }),
    [profile, user, streak, attempts.length, mcqs.length, accuracy],
  );

  // Initialize browser origin
  useEffect(() => {
    if (typeof window !== "undefined") {
      const origin = window.location.origin;
      setAppOrigin(origin);

      // Check if user stored a custom/Wi-Fi host
      const savedHost = localStorage.getItem("studyspark_custom_connect_host");
      if (savedHost) {
        setCustomHost(savedHost);
        setActiveHostMode("custom");
      }
    }
  }, []);

  // Countdown timer for pairing code expiration
  useEffect(() => {
    const updateCountdown = () => {
      const diff = Math.max(0, expiresAt - Date.now());
      const mins = Math.floor(diff / 60000);
      const secs = Math.floor((diff % 60000) / 1000);
      setTimeLeft(`${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`);
    };

    updateCountdown();
    const interval = setInterval(updateCountdown, 1000);
    return () => clearInterval(interval);
  }, [expiresAt]);

  // Request fresh pairing session from backend
  const refreshPairingSession = useCallback(async () => {
    setCreatingPair(true);
    try {
      const res = await createDevicePairingSession({
        data: { payload: currentPayload },
      });
      if (res.success) {
        setPairingCode(res.code);
        setExpiresAt(res.expiresAt);
        toast.success(`Active Pairing Code: ${res.code}`);
      }
    } catch {
      // Offline fallback PIN
      const fallback = `SPARK-${Math.floor(1000 + Math.random() * 9000)}`;
      setPairingCode(fallback);
      setExpiresAt(Date.now() + 15 * 60 * 1000);
    } finally {
      setCreatingPair(false);
    }
  }, [currentPayload]);

  useEffect(() => {
    refreshPairingSession();
  }, [refreshPairingSession]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const params = new URLSearchParams(window.location.search);
    const sync = params.get("sync");
    const pair = params.get("pair");
    if (!sync && !pair) return;

    setIncomingPairCode(pair || "");
    setIncomingStatus("connecting");

    const applyPayload = (payload: WorkspaceSyncPayload) => {
      localStorage.setItem("studyspark_incoming_workspace", JSON.stringify(payload));
      setIncomingPayload(payload);
      setIncomingStatus("connected");
      toast.success("Workspace link connected on this device.");
    };

    if (sync) {
      try {
        applyPayload(decodePayloadFromUrl(sync));
        return;
      } catch (err) {
        console.warn("[Device Connect] Failed to decode sync payload:", err);
      }
    }

    if (pair) {
      resolveDevicePairingSession({ data: { query: pair } })
        .then((res) => {
          if (res.success) {
            applyPayload(res.payload);
          } else {
            setIncomingStatus("expired");
            toast.error(res.error || "This pairing link has expired.");
          }
        })
        .catch((err) => {
          console.warn("[Device Connect] Pairing lookup failed:", err);
          setIncomingStatus("expired");
          toast.error("Could not connect this pairing link.");
        });
    }
  }, []);

  // Determine the effective base URL
  const effectiveBaseUrl = useMemo(() => {
    if (activeHostMode === "custom" && customHost.trim()) {
      let host = customHost.trim();
      if (!host.startsWith("http://") && !host.startsWith("https://")) {
        host = `http://${host}`;
      }
      return host;
    }
    if (activeHostMode === "wifi" && wifiIp.trim()) {
      let ip = wifiIp.trim();
      if (!ip.startsWith("http://") && !ip.startsWith("https://")) {
        ip = `http://${ip}:3000`;
      }
      return ip;
    }
    // Auto mode: use current window origin or fallback
    return appOrigin || "https://studyspark.app";
  }, [activeHostMode, customHost, wifiIp, appOrigin]);

  // Construct final universal share URL
  const universalConnectUrl = useMemo(() => {
    const base = effectiveBaseUrl;
    if (destination === "app") {
      return base;
    }
    if (destination === "practice") {
      return `${base}/practice`;
    }
    if (destination === "notes") {
      return `${base}/notes`;
    }
    if (destination === "ai") {
      return `${base}/ai-studio`;
    }
    // Live Workspace Sync: passes pairing code + encoded session snapshot
    const encodedPayload = encodePayloadForUrl(currentPayload);
    return `${base}/scanner?pair=${pairingCode}&sync=${encodedPayload}`;
  }, [effectiveBaseUrl, destination, pairingCode, currentPayload]);

  // Copy link handler
  const handleCopy = () => {
    navigator.clipboard.writeText(universalConnectUrl);
    setCopied(true);
    toast.success("Universal link copied to clipboard!");
    setTimeout(() => setCopied(false), 2200);
  };

  // Native Web Share API
  const handleNativeShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: "StudySpark OS — Cross-Device Connect",
          text: `Open my StudySpark workspace on your phone (${currentPayload.examName})!`,
          url: universalConnectUrl,
        });
      } catch {
        // Dismissed by user
      }
    } else {
      handleCopy();
    }
  };

  // WhatsApp 1-tap share
  const handleWhatsAppShare = () => {
    const message = encodeURIComponent(
      `⚡ Open my StudySpark workspace on your phone (${currentPayload.examName}):\n${universalConnectUrl}`,
    );
    window.open(`https://api.whatsapp.com/send?text=${message}`, "_blank");
  };

  // Download high-res PNG for slides or printing
  const handleDownloadQR = async () => {
    try {
      const dataUrl = await QRCode.toDataURL(universalConnectUrl, {
        width: 1200,
        margin: 2,
        color: {
          dark: "#05070d",
          light: "#ffffff",
        },
      });
      const link = document.createElement("a");
      link.href = dataUrl;
      link.download = `studyspark-qr-${pairingCode}.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      toast.success("High-resolution QR code downloaded.");
    } catch {
      toast.error("Failed to export QR image.");
    }
  };

  // Save custom host
  const saveCustomHost = (host: string) => {
    setCustomHost(host);
    if (typeof window !== "undefined") {
      localStorage.setItem("studyspark_custom_connect_host", host);
    }
    toast.success("Custom host configuration saved.");
  };

  return (
    <AppShell
      title="Device Connect & QR Hub"
      subtitle="Connect any phone, tablet or laptop to your study workspace"
      actions={
        <div className="flex items-center gap-2">
          <div className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3 py-1.5 text-xs font-mono font-medium text-emerald-400 backdrop-blur-sm">
            <span className="size-2 rounded-full bg-emerald-400 animate-pulse" />
            <span>Broadcast Active</span>
          </div>
        </div>
      }
    >
      <div className="space-y-8">
        {/* Hero Header Card */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35 }}
          className="relative overflow-hidden rounded-3xl border border-border/80 bg-gradient-to-br from-surface to-surface-2/70 p-6 md:p-8 shadow-sm backdrop-blur-md"
        >
          {/* Ambient decorative aura */}
          <div
            className="pointer-events-none absolute -right-24 -top-24 size-72 rounded-full opacity-20 blur-3xl"
            style={{ background: "radial-gradient(circle, var(--accent) 0%, transparent 70%)" }}
          />

          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
            <div className="max-w-2xl">
              <div className="inline-flex items-center gap-2 rounded-full border border-accent/25 bg-accent/10 px-3 py-1 text-xs font-mono font-semibold text-accent">
                <Radio className="size-3.5 animate-pulse" />
                <span>UNIVERSAL CROSS-DEVICE PAIRING</span>
              </div>
              <h2 className="mt-3 text-2xl sm:text-3xl font-extrabold tracking-tight text-foreground font-serif">
                Connect Any Phone, Tablet or Laptop
              </h2>
              <p className="mt-2 text-xs sm:text-sm text-muted leading-relaxed">
                Scan this universal QR code with your smartphone camera to instantly launch and
                synchronize your StudySpark study deck, syllabus, and practice test progress
                anywhere in the world with zero app installation required.
              </p>
            </div>

            {/* Visual Animated Device Pairing Indicator */}
            <div className="flex items-center justify-center gap-3 rounded-2xl border border-border/80 bg-surface-2/40 p-4 shrink-0 shadow-inner">
              <div className="flex flex-col items-center gap-1.5 text-center">
                <div className="grid size-10 place-items-center rounded-xl bg-surface-3 border border-border text-accent shadow-xs">
                  <Laptop className="size-5" />
                </div>
                <span className="text-[10px] font-mono text-muted uppercase">This PC</span>
              </div>

              {/* Animated Wave Beam */}
              <div className="flex flex-col items-center gap-1 px-1">
                <motion.div
                  animate={{ scale: [1, 1.2, 1], opacity: [0.6, 1, 0.6] }}
                  transition={{ duration: 2, repeat: Infinity }}
                  className="flex items-center gap-1 text-accent"
                >
                  <span className="size-1.5 rounded-full bg-accent animate-ping" />
                  <span className="h-0.5 w-8 bg-gradient-to-r from-accent to-emerald-400" />
                  <Sparkles className="size-3.5 text-emerald-400" />
                </motion.div>
                <span className="font-mono text-[9px] text-emerald-400 font-bold uppercase tracking-wider">
                  Live Sync
                </span>
              </div>

              <div className="flex flex-col items-center gap-1.5 text-center">
                <div className="grid size-10 place-items-center rounded-xl bg-surface-3 border border-border text-emerald-400 shadow-xs">
                  <Smartphone className="size-5" />
                </div>
                <span className="text-[10px] font-mono text-muted uppercase">Phone / Tablet</span>
              </div>
            </div>
          </div>
        </motion.div>

        <AnimatePresence>
          {incomingStatus !== "idle" && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className={`rounded-2xl border p-4 md:p-5 shadow-sm ${
                incomingStatus === "connected"
                  ? "border-emerald-500/30 bg-emerald-500/10"
                  : incomingStatus === "expired"
                    ? "border-red-500/30 bg-red-500/10"
                    : "border-accent/30 bg-accent/10"
              }`}
            >
              <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div className="flex items-start gap-3">
                  <div
                    className={`grid size-10 shrink-0 place-items-center rounded-xl border ${
                      incomingStatus === "connected"
                        ? "border-emerald-500/30 bg-emerald-500/15 text-emerald-300"
                        : incomingStatus === "expired"
                          ? "border-red-500/30 bg-red-500/15 text-red-300"
                          : "border-accent/30 bg-accent/15 text-accent"
                    }`}
                  >
                    {incomingStatus === "connected" ? (
                      <CheckCircle2 className="size-5" />
                    ) : (
                      <LinkIcon className="size-5" />
                    )}
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-foreground">
                      {incomingStatus === "connected"
                        ? "Workspace connected on this device"
                        : incomingStatus === "expired"
                          ? "Pairing link needs a refresh"
                          : "Connecting workspace link"}
                    </h3>
                    <p className="mt-1 text-xs text-muted leading-relaxed">
                      {incomingPayload
                        ? `${incomingPayload.displayName}'s ${incomingPayload.examName} workspace is ready here with ${incomingPayload.totalMcqs} MCQs and ${incomingPayload.streak} day streak data.`
                        : incomingPairCode
                          ? `Pairing code ${incomingPairCode} is being checked.`
                          : "Opening the shared workspace snapshot."}
                    </p>
                  </div>
                </div>

                {incomingStatus === "connected" && (
                  <div className="flex flex-wrap gap-2">
                    <a
                      href="/practice"
                      className="inline-flex items-center gap-1.5 rounded-xl bg-accent px-3 py-2 text-xs font-bold text-accent-foreground transition hover:opacity-90"
                    >
                      <Zap className="size-3.5" />
                      Practice
                    </a>
                    <a
                      href="/ai-studio"
                      className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-surface-2 px-3 py-2 text-xs font-semibold text-foreground transition hover:bg-surface-3"
                    >
                      <Sparkles className="size-3.5 text-accent" />
                      AI Studio
                    </a>
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Main 2-Column Cross-Device Showcase */}
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-12 items-start">
          {/* Left Column: The High-Aesthetic QR Code Showcase */}
          <motion.div
            initial={{ opacity: 0, x: -14 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.4 }}
            className="lg:col-span-5 relative rounded-3xl border border-border/80 bg-surface/90 p-6 md:p-7 shadow-xl backdrop-blur-xl flex flex-col items-center text-center overflow-hidden"
          >
            {/* Glowing background halo */}
            <motion.div
              animate={{ scale: [1, 1.05, 1], opacity: [0.25, 0.45, 0.25] }}
              transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
              className="pointer-events-none absolute -top-24 size-80 rounded-full blur-3xl"
              style={{
                background: "radial-gradient(circle, var(--accent) 0%, transparent 70%)",
              }}
            />

            {/* Header */}
            <div className="w-full flex items-center justify-between pb-3 border-b border-border/60">
              <div className="flex items-center gap-2 text-left">
                <StudySparkLogo variant="mark" size="sm" />
                <div>
                  <h3 className="text-sm font-bold text-foreground">Universal QR Code</h3>
                  <p className="text-[11px] text-muted">Point any camera lens to open</p>
                </div>
              </div>

              <button
                onClick={refreshPairingSession}
                disabled={creatingPair}
                className="rounded-xl border border-border bg-surface-2/60 p-2 text-muted hover:bg-surface-2 hover:text-foreground transition cursor-pointer"
                title="Generate fresh pairing session"
              >
                <RefreshCw
                  className={`size-3.5 ${creatingPair ? "animate-spin text-accent" : ""}`}
                />
              </button>
            </div>

            {/* High-Contrast Pristine QR Stage */}
            <div className="relative my-6 rounded-3xl border-2 border-white/20 bg-white p-6 shadow-2xl transition-transform duration-300 hover:scale-[1.01]">
              <QRCodeSVG
                value={universalConnectUrl}
                size={230}
                level="H"
                includeMargin={false}
                imageSettings={{
                  src: "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32' fill='%2310b981'><path d='M16 4L17.8 9.2L23 11L17.8 12.8L16 18L14.2 12.8L9 11L14.2 9.2L16 4Z'/></svg>",
                  height: 42,
                  width: 42,
                  excavate: true,
                }}
              />

              {/* Floating PIN Tag */}
              <div className="absolute -bottom-3.5 left-1/2 -translate-x-1/2 rounded-full bg-zinc-950 border border-zinc-800 px-4 py-1 font-mono text-xs font-bold text-emerald-400 shadow-xl whitespace-nowrap flex items-center gap-1.5">
                <span className="size-1.5 rounded-full bg-emerald-400 animate-pulse" />
                <span>{pairingCode}</span>
              </div>
            </div>

            {/* Code status & timer */}
            <div className="mt-2 space-y-1">
              <div className="flex items-center justify-center gap-2 text-xs text-muted">
                <span>Code expires in:</span>
                <span className="font-mono font-bold text-accent">{timeLeft}</span>
              </div>
              <p className="text-[11px] text-faint max-w-xs">
                Works on iOS Camera, Android Lens, Chrome, Safari, and tablet scanners.
              </p>
            </div>

            {/* Primary Action Buttons */}
            <div className="mt-6 flex w-full flex-col gap-2.5 pt-5 border-t border-border/60">
              <motion.button
                whileHover={{ scale: 1.01 }}
                whileTap={{ scale: 0.98 }}
                onClick={handleCopy}
                className="w-full rounded-xl bg-accent hover:opacity-90 text-accent-foreground py-2.5 px-4 text-xs sm:text-sm font-bold transition shadow-sm flex items-center justify-center gap-2 cursor-pointer"
              >
                {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
                <span>{copied ? "Link Copied to Clipboard!" : "Copy Universal Link"}</span>
              </motion.button>

              <div className="grid grid-cols-2 gap-2 w-full">
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={handleNativeShare}
                  className="rounded-xl border border-border-2 bg-surface-2/80 hover:bg-surface-3 text-foreground py-2 text-xs font-semibold transition flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <Share2 className="size-3.5 text-accent" />
                  <span>Share App</span>
                </motion.button>

                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={handleWhatsAppShare}
                  className="rounded-xl border border-emerald-500/30 bg-emerald-950/20 hover:bg-emerald-950/40 text-emerald-300 py-2 text-xs font-semibold transition flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <Send className="size-3.5 text-emerald-400" />
                  <span>WhatsApp</span>
                </motion.button>
              </div>

              <motion.button
                whileHover={{ scale: 1.01 }}
                whileTap={{ scale: 0.98 }}
                onClick={handleDownloadQR}
                className="w-full rounded-xl border border-border/80 bg-surface-2/40 hover:bg-surface-2 text-muted hover:text-foreground py-2 text-xs font-medium transition flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <Download className="size-3.5" />
                <span>Download High-Res QR (PNG)</span>
              </motion.button>
            </div>
          </motion.div>

          {/* Right Column: Broadcast Controls, Network Accessibility & Compatibility */}
          <div className="lg:col-span-7 space-y-6">
            {/* Target Module Selector */}
            <motion.div
              initial={{ opacity: 0, x: 14 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.4 }}
              className="rounded-3xl border border-border/80 bg-surface/80 p-6 md:p-7 shadow-sm backdrop-blur-md"
            >
              <h3 className="text-base font-bold tracking-tight text-foreground">
                What to Broadcast to Secondary Device
              </h3>
              <p className="mt-1 text-xs text-muted">
                Select whether the scanned QR code loads your synchronized workspace or a specific
                study module.
              </p>

              <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div
                  onClick={() => setDestination("workspace")}
                  className={`rounded-2xl border p-4 transition-all cursor-pointer ${
                    destination === "workspace"
                      ? "border-accent bg-accent/10 ring-1 ring-accent shadow-xs"
                      : "border-border bg-surface-2/40 hover:bg-surface-2"
                  }`}
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-xs font-bold text-foreground">Live Workspace Sync</span>
                    <Sparkles className="size-4 text-accent" />
                  </div>
                  <p className="text-[11px] text-muted leading-relaxed">
                    Transfers student name, active target exam ({currentPayload.examName}), streak,
                    and study records.
                  </p>
                </div>

                <div
                  onClick={() => setDestination("app")}
                  className={`rounded-2xl border p-4 transition-all cursor-pointer ${
                    destination === "app"
                      ? "border-accent bg-accent/10 ring-1 ring-accent shadow-xs"
                      : "border-border bg-surface-2/40 hover:bg-surface-2"
                  }`}
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-xs font-bold text-foreground">Full Web App Home</span>
                    <Smartphone className="size-4 text-accent" />
                  </div>
                  <p className="text-[11px] text-muted leading-relaxed">
                    Opens StudySpark OS home directly on any phone browser with local session.
                  </p>
                </div>

                <div
                  onClick={() => setDestination("practice")}
                  className={`rounded-2xl border p-4 transition-all cursor-pointer ${
                    destination === "practice"
                      ? "border-accent bg-accent/10 ring-1 ring-accent shadow-xs"
                      : "border-border bg-surface-2/40 hover:bg-surface-2"
                  }`}
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-xs font-bold text-foreground">Practice & Tests</span>
                    <Zap className="size-4 text-accent" />
                  </div>
                  <p className="text-[11px] text-muted leading-relaxed">
                    Instantly launches into timed MCQ test drill mode on the mobile phone.
                  </p>
                </div>

                <div
                  onClick={() => setDestination("notes")}
                  className={`rounded-2xl border p-4 transition-all cursor-pointer ${
                    destination === "notes"
                      ? "border-accent bg-accent/10 ring-1 ring-accent shadow-xs"
                      : "border-border bg-surface-2/40 hover:bg-surface-2"
                  }`}
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-xs font-bold text-foreground">Chapter Notes Deck</span>
                    <BookOpen className="size-4 text-accent" />
                  </div>
                  <p className="text-[11px] text-muted leading-relaxed">
                    Opens syllabus notes for dual-screen reading alongside your main screen.
                  </p>
                </div>
              </div>

              {/* Direct Read-Only URL Field */}
              <div className="mt-5 space-y-1.5">
                <label className="block text-xs font-medium text-muted">
                  Universal Direct Link for Other Devices
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    readOnly
                    value={universalConnectUrl}
                    className="w-full h-10 rounded-xl border border-border/80 bg-surface-2/80 px-3 font-mono text-xs text-foreground focus:outline-none select-all"
                  />
                  <button
                    onClick={handleCopy}
                    className="rounded-xl bg-surface-2 border border-border-2 p-2.5 text-foreground hover:bg-surface-3 transition cursor-pointer"
                    title="Copy link"
                  >
                    {copied ? (
                      <Check className="size-4 text-emerald-400" />
                    ) : (
                      <Copy className="size-4" />
                    )}
                  </button>
                  <a
                    href={universalConnectUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="rounded-xl bg-surface-2 border border-border-2 p-2.5 text-foreground hover:bg-surface-3 transition"
                    title="Open in new tab"
                  >
                    <ExternalLink className="size-4" />
                  </a>
                </div>
              </div>
            </motion.div>

            {/* Network Accessibility & Multi-Location Configuration Card */}
            <motion.div
              initial={{ opacity: 0, x: 14 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.45 }}
              className="rounded-3xl border border-border/80 bg-surface/80 p-6 md:p-7 shadow-sm backdrop-blur-md"
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2.5">
                  <div className="grid size-8 place-items-center rounded-lg bg-accent/15 text-accent">
                    <Globe className="size-4" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-foreground">
                      Network & Multi-Location Access
                    </h3>
                    <p className="text-[11px] text-muted">
                      Ensures your QR code connects from any phone, network or location
                    </p>
                  </div>
                </div>

                <span className="rounded-full bg-surface-2 border border-border px-2.5 py-0.5 font-mono text-[10px] text-accent">
                  Host: {activeHostMode.toUpperCase()}
                </span>
              </div>

              {/* Host mode tabs */}
              <div className="mt-4 grid grid-cols-3 gap-2 rounded-xl border border-border bg-surface-2/60 p-1 text-xs">
                <button
                  type="button"
                  onClick={() => setActiveHostMode("auto")}
                  className={`rounded-lg py-1.5 font-semibold transition cursor-pointer ${
                    activeHostMode === "auto"
                      ? "bg-surface text-foreground shadow-xs"
                      : "text-muted hover:text-foreground"
                  }`}
                >
                  Cloud / Public Domain
                </button>
                <button
                  type="button"
                  onClick={() => setActiveHostMode("wifi")}
                  className={`rounded-lg py-1.5 font-semibold transition cursor-pointer ${
                    activeHostMode === "wifi"
                      ? "bg-surface text-foreground shadow-xs"
                      : "text-muted hover:text-foreground"
                  }`}
                >
                  Local Wi-Fi IP
                </button>
                <button
                  type="button"
                  onClick={() => setActiveHostMode("custom")}
                  className={`rounded-lg py-1.5 font-semibold transition cursor-pointer ${
                    activeHostMode === "custom"
                      ? "bg-surface text-foreground shadow-xs"
                      : "text-muted hover:text-foreground"
                  }`}
                >
                  Custom Domain
                </button>
              </div>

              {/* Wi-Fi IP helper input */}
              {activeHostMode === "wifi" && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  className="mt-4 rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4 text-xs text-amber-300 space-y-2"
                >
                  <div className="flex items-center gap-2 font-bold">
                    <Wifi className="size-4 text-amber-400" />
                    <span>Same Wi-Fi Network Mode</span>
                  </div>
                  <p className="text-[11px] text-amber-200/90 leading-relaxed">
                    Enter your computer's local Wi-Fi IP address (e.g. <code>192.168.1.15</code>) so
                    your phone on the same Wi-Fi network can connect directly to your laptop.
                  </p>
                  <div className="flex items-center gap-2 pt-1">
                    <input
                      type="text"
                      placeholder="e.g. 192.168.1.15"
                      value={wifiIp}
                      onChange={(e) => setWifiIp(e.target.value)}
                      className="h-9 flex-1 rounded-xl border border-amber-500/40 bg-black/30 px-3 font-mono text-xs text-amber-100 placeholder:text-amber-400/50 focus:outline-none"
                    />
                    <span className="font-mono text-xs text-amber-300">:3000</span>
                  </div>
                </motion.div>
              )}

              {/* Custom host input */}
              {activeHostMode === "custom" && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  className="mt-4 space-y-2 text-xs"
                >
                  <label className="block text-muted">Custom Web Host / Tunnel URL</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      placeholder="https://your-custom-domain.com"
                      value={customHost}
                      onChange={(e) => setCustomHost(e.target.value)}
                      className="h-9 flex-1 rounded-xl border border-border-2 bg-surface-2 px-3 font-mono text-xs text-foreground placeholder:text-faint focus:border-accent focus:outline-none"
                    />
                    <button
                      onClick={() => saveCustomHost(customHost)}
                      className="rounded-xl bg-accent text-accent-foreground font-bold px-3 py-2 text-xs"
                    >
                      Save
                    </button>
                  </div>
                </motion.div>
              )}

              {/* Auto mode explanation */}
              {activeHostMode === "auto" && (
                <div className="mt-3 text-[11px] text-muted flex items-center gap-2">
                  <CheckCircle2 className="size-3.5 text-emerald-400 shrink-0" />
                  <span>
                    Broadcasting via <strong>{appOrigin || "Public Host"}</strong>. Accessible on
                    any cellular or Wi-Fi network worldwide.
                  </span>
                </div>
              )}
            </motion.div>

            {/* Universal Device Compatibility Checklist */}
            <motion.div
              initial={{ opacity: 0, x: 14 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.5 }}
              className="rounded-3xl border border-border/80 bg-surface/80 p-6 md:p-7 shadow-sm backdrop-blur-md"
            >
              <h4 className="text-xs font-bold uppercase tracking-wider text-muted mb-3">
                Universal Device Compatibility
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                <div className="flex items-center gap-2.5 rounded-2xl border border-border/60 bg-surface-2/30 p-3">
                  <Smartphone className="size-4 text-accent shrink-0" />
                  <div>
                    <p className="font-bold text-foreground">iOS Devices</p>
                    <p className="text-[10px] text-faint">iPhone / iPad Safari</p>
                  </div>
                </div>

                <div className="flex items-center gap-2.5 rounded-2xl border border-border/60 bg-surface-2/30 p-3">
                  <Smartphone className="size-4 text-emerald-400 shrink-0" />
                  <div>
                    <p className="font-bold text-foreground">Android Phones</p>
                    <p className="text-[10px] text-faint">Samsung, Pixel, Xiaomi</p>
                  </div>
                </div>

                <div className="flex items-center gap-2.5 rounded-2xl border border-border/60 bg-surface-2/30 p-3">
                  <Tablet className="size-4 text-amber-400 shrink-0" />
                  <div>
                    <p className="font-bold text-foreground">Tablets & Laptops</p>
                    <p className="text-[10px] text-faint">Chrome, Edge, Firefox</p>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
