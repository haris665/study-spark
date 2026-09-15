import { useState, useRef, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "motion/react";
import { toast } from "sonner";
import {
  Sparkles,
  Send,
  Trash2,
  Copy,
  Check,
  Bot,
  User,
  Plus,
  BookOpen,
  HelpCircle,
  Lightbulb,
  Zap,
  Layers,
  CheckCircle2,
  Cpu,
  RefreshCw,
} from "lucide-react";
import { chatWithGemini } from "@/lib/ai.functions";
import { useAuth } from "@/lib/auth";
import { db, doc, setDoc, getDoc } from "@/integrations/firebase/firebase";
import { supabase } from "@/integrations/supabase/client";

export interface ChatMessage {
  id: string;
  role: "user" | "model";
  text: string;
  timestamp: string;
  model?: string;
}

export interface GeminiChatbotProps {
  subjectName?: string;
  chapterName?: string;
  selectedQuestion?: string;
  onImportMcq?: (mcq: {
    question: string;
    options: string[];
    correctIndex: number;
    explanation: string;
  }) => void;
}

const SYSTEM_ROLES = [
  {
    id: "tutor",
    name: "Exam Tutor",
    icon: BookOpen,
    desc: "Step-by-step concept explanations & problem solving",
    systemPrompt:
      "You are the master AI Exam Tutor for Study Spark. Help the student understand complex concepts step-by-step with clear breakdowns, key terms, formulas, and common exam traps.",
  },
  {
    id: "creator",
    name: "MCQ Creator",
    icon: HelpCircle,
    desc: "Generates exam-ready multiple choice questions",
    systemPrompt:
      "You are the MCQ Question Generator for Study Spark. Generate high-yield exam MCQs with 4 distinct options (A, B, C, D), mark the correct answer clearly, and provide a detailed explanation for each.",
  },
  {
    id: "auditor",
    name: "Solution Auditor",
    icon: CheckCircle2,
    desc: "Audits questions and verifies accuracy",
    systemPrompt:
      "You are an expert Question Auditor. Analyze questions for scientific correctness, fix misleading options, and provide unambiguous explanations.",
  },
  {
    id: "strategist",
    name: "Exam Strategist",
    icon: Lightbulb,
    desc: "Recommends revision plans & study shortcuts",
    systemPrompt:
      "You are an Exam Strategy Coach. Suggest high-yield revision schedules, memorization shortcuts, and active recall techniques.",
  },
];

const GEMINI_MODELS = [
  { id: "gemini-2.5-flash", name: "Gemini 2.5 Flash", badge: "Balanced & Fast" },
  { id: "gemini-2.5-pro", name: "Gemini 2.5 Pro", badge: "Deep Reasoning" },
  { id: "gemini-2.5-flash-lite", name: "Gemini 2.5 Flash Lite", badge: "Ultra Fast" },
];

const PROMPT_SUGGESTIONS = [
  "Generate 3 MDCAT MCQs on DNA Replication",
  "Explain Oxidative Phosphorylation step-by-step",
  "What is the electrostatic potential formula?",
  "Give me 5 organic chemistry mechanism questions",
];

export function GeminiChatbot({
  subjectName,
  chapterName,
  selectedQuestion,
  onImportMcq,
}: GeminiChatbotProps) {
  const { user } = useAuth();
  const [messages, setMessages] = useState<ChatMessage[]>(() => [
    {
      id: "msg-welcome",
      role: "model",
      text: "👋 **Hello! I'm your Gemini AI Question Studio Assistant.**\n\nAsk me to create custom MCQs, explain difficult exam concepts, audit questions, or generate targeted revision notes!",
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      model: "gemini-2.5-flash",
    },
  ]);
  const [inputText, setInputText] = useState("");
  const [selectedRole, setSelectedRole] = useState(SYSTEM_ROLES[0].id);
  const [selectedModel, setSelectedModel] = useState(GEMINI_MODELS[0].id);
  const [loading, setLoading] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const threadEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom on new message
  useEffect(() => {
    threadEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  // Load chat history from Firestore or LocalStorage
  useEffect(() => {
    async function loadHistory() {
      if (user?.id) {
        try {
          const docRef = doc(db, "users", user.id, "aiChats", "question_studio_chat");
          const snap = await getDoc(docRef);
          if (snap.exists()) {
            const data = snap.data();
            if (Array.isArray(data.messages) && data.messages.length > 0) {
              setMessages(data.messages);
            }
          }
        } catch (e) {
          console.warn("Firestore chat load fallback:", e);
        }
      } else if (typeof window !== "undefined") {
        try {
          const local = localStorage.getItem("study_spark_gemini_chat");
          if (local) {
            const parsed = JSON.parse(local);
            if (Array.isArray(parsed) && parsed.length > 0) {
              setMessages(parsed);
            }
          }
        } catch {
          // ignore
        }
      }
    }
    loadHistory();
  }, [user]);

  // Save chat history to Firestore / LocalStorage
  const saveChatHistory = async (newMessages: ChatMessage[]) => {
    setMessages(newMessages);
    if (user?.id) {
      try {
        const docRef = doc(db, "users", user.id, "aiChats", "question_studio_chat");
        await setDoc(
          docRef,
          {
            messages: newMessages,
            updatedAt: new Date().toISOString(),
          },
          { merge: true },
        );
      } catch (e) {
        console.warn("Firestore chat save error:", e);
      }
    }
    if (typeof window !== "undefined") {
      try {
        localStorage.setItem("study_spark_gemini_chat", JSON.stringify(newMessages));
      } catch {
        // ignore
      }
    }
  };

  const handleSendMessage = async (textToSend?: string) => {
    const text = (textToSend || inputText).trim();
    if (!text || loading) return;

    const userMessage: ChatMessage = {
      id: `user-${Date.now()}`,
      role: "user",
      text,
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    };

    const updatedMessages = [...messages, userMessage];
    setMessages(updatedMessages);
    setInputText("");
    setLoading(true);

    const activeRoleObj = SYSTEM_ROLES.find((r) => r.id === selectedRole);

    try {
      const result = await chatWithGemini({
        data: {
          messages: updatedMessages.map((m) => ({
            id: m.id,
            role: m.role,
            text: m.text,
            timestamp: m.timestamp,
          })),
          systemInstruction: activeRoleObj?.systemPrompt,
          model: selectedModel,
          contextInfo: {
            subjectName,
            chapterName,
            selectedQuestion,
          },
        },
      });

      const aiMessage: ChatMessage = {
        id: `model-${Date.now()}`,
        role: "model",
        text: result.text,
        timestamp:
          result.timestamp ||
          new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        model: result.model || selectedModel,
      };

      const finalMessages = [...updatedMessages, aiMessage];
      await saveChatHistory(finalMessages);
    } catch (err) {
      toast.error("Failed to connect to Gemini chatbot. Please try again.");
      console.error("[Gemini Chat] Error:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleClearChat = async () => {
    const initial: ChatMessage[] = [
      {
        id: "msg-welcome-reset",
        role: "model",
        text: "✨ **Chat thread reset.** How can I assist you with your questions today?",
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        model: selectedModel,
      },
    ];
    await saveChatHistory(initial);
    toast.info("Conversation history cleared.");
  };

  const copyToClipboard = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    toast.success("Copied to clipboard");
    setTimeout(() => setCopiedId(null), 2000);
  };

  // Helper to extract MCQ from chat text if user wants to import
  const parseMcqFromText = (text: string) => {
    const questionMatch =
      text.match(/\*\*Question:\*\*\s*(.+?)(?=\n[A-D]\)|$)/s) ||
      text.match(/Question:\s*(.+?)(?=\n[A-D]\)|$)/s);
    const optionsMatches = Array.from(text.matchAll(/([A-D])\)\s*(.+)/g));
    const answerMatch =
      text.match(/\*\*Answer:\*\*\s*([A-D])/i) || text.match(/Answer:\s*([A-D])/i);
    const explanationMatch =
      text.match(/\*\*Explanation:\*\*\s*(.+)/s) || text.match(/Explanation:\s*(.+)/s);

    if (optionsMatches.length >= 4) {
      const question = questionMatch ? questionMatch[1].trim() : text.slice(0, 100);
      const options = optionsMatches.slice(0, 4).map((m) => m[2].trim());
      const letter = answerMatch ? answerMatch[1].toUpperCase() : "A";
      const correctIndex = ["A", "B", "C", "D"].indexOf(letter);
      const explanation = explanationMatch
        ? explanationMatch[1].trim()
        : "Generated via Gemini AI Chat.";
      return { question, options, correctIndex: Math.max(0, correctIndex), explanation };
    }
    return null;
  };

  return (
    <div className="flex flex-col h-[680px] max-w-4xl mx-auto w-full rounded-2xl border border-slate-800 bg-[#111622] overflow-hidden shadow-2xl">
      {/* Top Header Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-3.5 border-b border-slate-800 bg-[#151c2c]">
        <div className="flex items-center gap-3">
          <div className="size-9 rounded-xl bg-gradient-to-br from-amber-500/20 to-amber-600/30 border border-amber-500/40 grid place-items-center text-amber-400">
            <Sparkles className="size-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-bold text-slate-100 tracking-tight">
                Gemini AI Studio Chatbot
              </h3>
              <span className="bg-amber-500/20 text-amber-300 text-[10px] font-mono px-2 py-0.5 rounded-full border border-amber-500/30">
                Multi-Turn
              </span>
            </div>
            <p className="text-[11px] text-slate-400 font-normal">
              Context-aware tutor for question creation & problem solving
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Model Selector */}
          <select
            value={selectedModel}
            onChange={(e) => setSelectedModel(e.target.value)}
            className="bg-[#1c2638] text-slate-200 border border-slate-700/80 text-xs rounded-xl px-3 py-1.5 font-medium focus:outline-none focus:border-amber-400 cursor-pointer"
          >
            {GEMINI_MODELS.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name} ({m.badge})
              </option>
            ))}
          </select>

          {/* Clear Button */}
          <button
            type="button"
            onClick={handleClearChat}
            className="text-slate-400 hover:text-rose-400 p-2 rounded-xl hover:bg-slate-800 transition-colors cursor-pointer"
            title="Clear Chat History"
          >
            <Trash2 className="size-4" />
          </button>
        </div>
      </div>

      {/* Role Selection Bar */}
      <div className="flex items-center gap-2 px-5 py-2.5 bg-[#141a28] border-b border-slate-800/80 overflow-x-auto">
        <span className="text-[11px] font-medium text-slate-400 shrink-0 mr-1">Role:</span>
        {SYSTEM_ROLES.map((role) => {
          const Icon = role.icon;
          const isSelected = selectedRole === role.id;
          return (
            <button
              key={role.id}
              type="button"
              onClick={() => setSelectedRole(role.id)}
              className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-medium transition-all cursor-pointer whitespace-nowrap ${
                isSelected
                  ? "bg-amber-500 text-zinc-950 font-bold shadow-xs"
                  : "bg-[#1c2638] text-slate-300 hover:bg-[#253249]"
              }`}
            >
              <Icon className="size-3.5" />
              <span>{role.name}</span>
            </button>
          );
        })}
      </div>

      {/* Messages Scroll Area */}
      <div className="flex-1 overflow-y-auto p-5 space-y-4 bg-[#0e121b]">
        <AnimatePresence initial={false}>
          {messages.map((msg) => {
            const isUser = msg.role === "user";
            const parsedMcq = !isUser ? parseMcqFromText(msg.text) : null;

            return (
              <motion.div
                key={msg.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className={`flex items-start gap-3 ${isUser ? "flex-row-reverse" : "flex-row"}`}
              >
                {/* Avatar */}
                <div
                  className={`size-8 rounded-xl shrink-0 grid place-items-center ${
                    isUser
                      ? "bg-amber-500/20 text-amber-300 border border-amber-500/30"
                      : "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                  }`}
                >
                  {isUser ? <User className="size-4" /> : <Bot className="size-4" />}
                </div>

                {/* Message Bubble */}
                <div
                  className={`max-w-[82%] rounded-2xl p-4 space-y-2 text-xs leading-relaxed shadow-sm ${
                    isUser
                      ? "bg-amber-500 text-zinc-950 rounded-tr-none font-medium"
                      : "bg-[#182030] border border-slate-800 text-slate-200 rounded-tl-none"
                  }`}
                >
                  {/* Header info */}
                  <div className="flex items-center justify-between gap-4 border-b border-black/10 dark:border-white/10 pb-1.5 mb-1">
                    <span className="font-bold text-[11px] opacity-85">
                      {isUser ? "You" : "Gemini AI Studio"}
                    </span>
                    <div className="flex items-center gap-2 opacity-70 text-[10px]">
                      {msg.model && <span>{msg.model}</span>}
                      <span>{msg.timestamp}</span>
                    </div>
                  </div>

                  {/* Message content */}
                  <div className="whitespace-pre-wrap font-sans">{msg.text}</div>

                  {/* MCQ Action Bar if detected */}
                  {parsedMcq && (
                    <div className="mt-3 pt-2 border-t border-slate-700/60 flex items-center justify-between gap-2">
                      <span className="text-[11px] text-emerald-400 font-semibold flex items-center gap-1">
                        <CheckCircle2 className="size-3.5" /> MCQ format detected
                      </span>
                      {onImportMcq && (
                        <button
                          type="button"
                          onClick={() => {
                            onImportMcq(parsedMcq);
                            toast.success("MCQ imported into Question Bank pending queue!");
                          }}
                          className="bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/40 text-[11px] font-bold px-3 py-1 rounded-lg transition-colors flex items-center gap-1 cursor-pointer"
                        >
                          <Plus className="size-3.5" /> Import to Question Bank
                        </button>
                      )}
                    </div>
                  )}

                  {/* Copy Button for model messages */}
                  {!isUser && (
                    <div className="flex justify-end pt-1">
                      <button
                        type="button"
                        onClick={() => copyToClipboard(msg.id, msg.text)}
                        className="text-slate-400 hover:text-slate-200 text-[10px] flex items-center gap-1 cursor-pointer"
                      >
                        {copiedId === msg.id ? (
                          <>
                            <Check className="size-3 text-emerald-400" /> Copied
                          </>
                        ) : (
                          <>
                            <Copy className="size-3" /> Copy
                          </>
                        )}
                      </button>
                    </div>
                  )}
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>

        {loading && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex items-center gap-3 text-xs text-slate-400 bg-[#182030] p-3.5 rounded-2xl border border-slate-800 w-fit"
          >
            <RefreshCw className="size-4 text-amber-400 animate-spin" />
            <span>Gemini is generating response...</span>
          </motion.div>
        )}

        <div ref={threadEndRef} />
      </div>

      {/* Prompt Suggestions Bar */}
      <div className="px-5 py-2 bg-[#121824] border-t border-slate-800/80 flex items-center gap-2 overflow-x-auto">
        <span className="text-[11px] font-medium text-slate-400 shrink-0">Try:</span>
        {PROMPT_SUGGESTIONS.map((prompt, i) => (
          <button
            key={i}
            type="button"
            onClick={() => handleSendMessage(prompt)}
            className="bg-[#1a2334] hover:bg-[#232e44] text-slate-300 border border-slate-700/60 text-[11px] px-2.5 py-1 rounded-full whitespace-nowrap transition-colors cursor-pointer"
          >
            {prompt}
          </button>
        ))}
      </div>

      {/* Bottom Input Field Bar */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          handleSendMessage();
        }}
        className="p-4 bg-[#151c2c] border-t border-slate-800 flex items-center gap-3"
      >
        <input
          type="text"
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          placeholder={`Ask Gemini (${SYSTEM_ROLES.find((r) => r.id === selectedRole)?.name} mode)...`}
          disabled={loading}
          className="flex-1 bg-[#1a2334] border border-slate-700/80 text-slate-100 text-xs rounded-xl px-4 py-3 placeholder:text-slate-500 focus:outline-none focus:border-amber-400"
        />
        <button
          type="submit"
          disabled={!inputText.trim() || loading}
          className="bg-amber-500 hover:bg-amber-400 text-zinc-950 font-bold p-3 rounded-xl transition-all disabled:opacity-50 cursor-pointer shadow-xs"
        >
          <Send className="size-4" />
        </button>
      </form>
    </div>
  );
}
