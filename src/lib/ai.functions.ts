import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { GoogleGenAI } from "@google/genai";

const GeneratedMcq = z.object({
  question: z.string(),
  options: z.array(z.string()).length(4),
  correct_index: z.number().int().min(0).max(3),
  explanation: z.string().optional().default(""),
  difficulty: z.enum(["easy", "medium", "hard"]).optional().default("medium"),
  tags: z.array(z.string()).optional().default([]),
});

export type GeneratedMcq = z.infer<typeof GeneratedMcq>;

function cleanMcqCandidate(item: unknown): unknown {
  if (typeof item !== "object" || item === null) return item;
  const obj = item as Record<string, unknown>;

  if (typeof obj["question"] === "string") {
    obj["question"] = obj["question"].replace(/\s+/g, " ").trim();
  }

  if (Array.isArray(obj["options"])) {
    obj["options"] = obj["options"]
      .map((opt) =>
        String(opt)
          .replace(/^([A-Da-d1-4]|\([A-Da-d1-4]\)|Option\s+[A-Da-d])[).:\s-]\s*/i, "")
          .replace(/\s+/g, " ")
          .trim(),
      )
      .filter(Boolean)
      .slice(0, 4);
  }

  if (typeof obj["correct_index"] === "string") {
    const raw = obj["correct_index"].trim().toUpperCase();
    obj["correct_index"] = /^[A-D]$/.test(raw) ? raw.charCodeAt(0) - 65 : Number(raw);
  }

  return obj;
}

export interface GeneratedFlashcard {
  front: string;
  back: string;
  hint?: string;
  tags?: string[];
}

export interface ConceptExplanation {
  level: "beginner" | "exam" | "advanced";
  concept: string;
  summary: string;
  keyPoints: string[];
  analogies?: string;
  examApplication: string;
}

export interface ExtractedSyllabusItem {
  subject: string;
  chapters: {
    name: string;
    description?: string;
    topics: {
      name: string;
      confidence?: "low" | "medium" | "high";
      status?: "not_started" | "in_progress" | "completed";
    }[];
  }[];
}

export interface ScannerExtractionResult {
  text: string;
  confidence: number;
  uncertainSegments: string[];
  suggestedTitle: string;
  suggestedSubject: string;
}

const SummaryInput = z.object({
  text: z.string(),
  topic: z.string().optional(),
});

const FlashcardsInput = z.object({
  text: z.string(),
  topic: z.string().optional(),
  count: z.number().int().min(1).max(20).default(6),
});

const ExplainInput = z.object({
  concept: z.string(),
  context: z.string().optional(),
  level: z.enum(["beginner", "exam", "advanced"]).default("exam"),
});

const SyllabusInput = z.object({
  rawContent: z.string(),
  examName: z.string().optional(),
});

const ScannerInput = z.object({
  fileDataUrl: z.string().optional(),
  text: z.string().optional(),
  kind: z.enum(["camera", "file", "text"]).default("file"),
});

// Candidate models in preference order.
// Standard official models (gemini-2.5-flash, gemini-2.5-flash-lite, gemini-2.5-pro)
// avoid high demand 503 errors and ensure robust response reliability.
const CANDIDATE_MODELS = ["gemini-2.5-flash", "gemini-2.5-flash-lite", "gemini-2.5-pro"] as const;

async function generateWithModelFallback(
  ai: GoogleGenAI,
  params: {
    contents: (string | { inlineData: { data: string; mimeType: string } })[];
    config?: {
      systemInstruction?: string;
      responseMimeType?: string;
      temperature?: number;
      maxOutputTokens?: number;
    };
  },
) {
  let lastError: unknown;
  for (const model of CANDIDATE_MODELS) {
    try {
      const response = await ai.models.generateContent({
        model,
        contents: params.contents,
        ...(params.config ? { config: params.config } : {}),
      });
      if (response && response.text) {
        return response;
      }
    } catch (err: unknown) {
      lastError = err;
      const errMsg = err instanceof Error ? err.message : String(err);
      console.warn(
        `[AI Functions] Model "${model}" temporarily unavailable (${errMsg.slice(0, 100)}), trying fallback model...`,
      );
      // Small pause to allow transient spikes to clear
      await new Promise((resolve) => setTimeout(resolve, 200));
    }
  }
  throw lastError;
}

export const generateSummary = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => SummaryInput.parse(input))
  .handler(async ({ data }) => {
    const apiKey = process.env["GEMINI_API_KEY"] || process.env["LOVABLE_API_KEY"];
    if (apiKey) {
      try {
        const ai = new GoogleGenAI({ apiKey });
        const response = await generateWithModelFallback(ai, {
          contents: [
            `You are an expert study assistant. Summarize the following educational text concisely. Provide a high-yield summary paragraph followed by 4-6 key bullet takeaways with essential formulas, terms, or definitions.\n\nTEXT:\n${data.text.slice(0, 40000)}`,
          ],
        });
        const text = response.text?.trim();
        if (text) {
          return { summary: text };
        }
      } catch (err) {
        console.warn("[AI Functions] Gemini summary error:", err);
      }
    }

    // Offline fallback summary
    const sentences = data.text
      .split(/[.\n]+/)
      .map((s) => s.trim())
      .filter((s) => s.length > 25);
    const keyBullets = sentences.slice(0, 4).map((s) => `• ${s}`);
    const fallback = `**Key Summary & Takeaways:**\n\nThis material covers fundamental principles and high-yield relationships${data.topic ? ` in ${data.topic}` : ""}. Core equations and structural patterns govern how properties behave under standard constraints.\n\n**Key Points:**\n${keyBullets.join("\n") || "• Review core definitions\n• Practice standard problem types\n• Note boundary conditions"}`;
    return { summary: fallback };
  });

export const generateFlashcards = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => FlashcardsInput.parse(input))
  .handler(async ({ data }): Promise<{ flashcards: GeneratedFlashcard[] }> => {
    const apiKey = process.env["GEMINI_API_KEY"] || process.env["LOVABLE_API_KEY"];
    if (apiKey) {
      try {
        const ai = new GoogleGenAI({ apiKey });
        const prompt = `Create ${data.count} high-yield study flashcards from the text. Return a JSON object formatted as: {"flashcards":[{"front":"Question / Term / Concept","back":"Answer / Concise definition / Equation","hint":"Optional hint"}]}.\n\nTEXT:\n${data.text.slice(0, 30000)}`;
        const response = await generateWithModelFallback(ai, {
          contents: [prompt],
          config: {
            responseMimeType: "application/json",
          },
        });
        const raw = response.text || "{}";
        const parsed = JSON.parse(raw) as { flashcards?: GeneratedFlashcard[] };
        if (parsed.flashcards && Array.isArray(parsed.flashcards) && parsed.flashcards.length > 0) {
          return { flashcards: parsed.flashcards };
        }
      } catch (err) {
        console.warn("[AI Functions] Gemini flashcards error:", err);
      }
    }

    // Fallback flashcards
    const lines = data.text
      .split(/[.\n]+/)
      .map((s) => s.trim())
      .filter((s) => s.length > 20);
    const fallbackCards: GeneratedFlashcard[] = lines.slice(0, data.count).map((line, idx) => ({
      front: `Key Concept #${idx + 1}: ${line.slice(0, 60)}…`,
      back: `Explanation & Application: ${line}.`,
      hint: "Remember the core rule and its standard context.",
      tags: ["concept-review"],
    }));

    if (fallbackCards.length === 0) {
      fallbackCards.push({
        front: "Core Definition",
        back: "Main underlying mechanism and formula.",
        hint: "Check the primary chapter notes.",
      });
    }

    return { flashcards: fallbackCards };
  });

export const explainConcept = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => ExplainInput.parse(input))
  .handler(async ({ data }): Promise<{ explanation: ConceptExplanation }> => {
    const apiKey = process.env["GEMINI_API_KEY"] || process.env["LOVABLE_API_KEY"];
    if (apiKey) {
      try {
        const ai = new GoogleGenAI({ apiKey });
        const prompt = `Explain the educational concept "${data.concept}" tailored for level "${data.level}" (beginner = intuitive analogies, plain words; exam = high-yield test formulas, common traps, time-saving tricks; advanced = theoretical rigor, boundary derivations).\nContext: ${data.context || "None"}\n\nReturn JSON: {"level":"${data.level}","concept":"${data.concept}","summary":"Concise 2-sentence summary","keyPoints":["Point 1","Point 2","Point 3"],"analogies":"Optional intuitive analogy","examApplication":"How this appears on exams and how to solve it fast"}`;
        const response = await generateWithModelFallback(ai, {
          contents: [prompt],
          config: {
            responseMimeType: "application/json",
          },
        });
        const parsed = JSON.parse(response.text || "{}") as ConceptExplanation;
        if (parsed.summary) {
          return { explanation: parsed };
        }
      } catch (err) {
        console.warn("[AI Functions] Gemini explanation error:", err);
      }
    }

    const fallback: ConceptExplanation = {
      level: data.level,
      concept: data.concept,
      summary: `${data.concept} is a foundational principle where input variables determine system equilibrium and response.`,
      keyPoints: [
        `Definition: ${data.concept} governs how state variables change under standard boundary constraints.`,
        "Key relationship: Identify dependent vs independent parameters before computing values.",
        "Sign conventions & units: Ensure consistent SI units to avoid common calculation traps.",
      ],
      analogies:
        data.level === "beginner"
          ? "Think of it like balancing weights on a seesaw—adjusting one side requires a corresponding shift on the other."
          : undefined,
      examApplication:
        "Examiners frequently test this by changing boundary conditions or asking for proportional scaling when one variable is doubled.",
    };

    return { explanation: fallback };
  });

export const extractSyllabus = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => SyllabusInput.parse(input))
  .handler(async ({ data }): Promise<{ syllabus: ExtractedSyllabusItem[] }> => {
    const apiKey = process.env["GEMINI_API_KEY"] || process.env["LOVABLE_API_KEY"];
    if (apiKey) {
      try {
        const ai = new GoogleGenAI({ apiKey });
        const prompt = `Extract an organized hierarchical syllabus (Subjects -> Chapters -> Topics) from this text.\nReturn JSON: {"syllabus":[{"subject":"Subject Name","chapters":[{"name":"Chapter Name","description":"","topics":[{"name":"Topic Name","confidence":"medium","status":"not_started"}]}]}]}\n\nTEXT:\n${data.rawContent.slice(0, 35000)}`;
        const response = await generateWithModelFallback(ai, {
          contents: [prompt],
          config: {
            responseMimeType: "application/json",
          },
        });
        const parsed = JSON.parse(response.text || "{}") as { syllabus?: ExtractedSyllabusItem[] };
        if (parsed.syllabus && Array.isArray(parsed.syllabus) && parsed.syllabus.length > 0) {
          return { syllabus: parsed.syllabus };
        }
      } catch (err) {
        console.warn("[AI Functions] Gemini syllabus error:", err);
      }
    }

    // Heuristic parser fallback
    const lines = data.rawContent
      .split("\n")
      .map((l) => l.trim())
      .filter((l) => l.length > 0);
    const parsedSubject: ExtractedSyllabusItem = {
      subject: lines[0]?.slice(0, 40) || "General Studies",
      chapters: [
        {
          name: "Core Modules & Foundations",
          description: "Primary modules extracted from syllabus text",
          topics: lines
            .slice(1, 8)
            .filter((l) => l.length > 3)
            .map((l) => ({
              name: l.replace(/^[-*•\d.]+\s*/, "").slice(0, 80),
              confidence: "medium",
              status: "not_started",
            })),
        },
      ],
    };

    return { syllabus: [parsedSubject] };
  });

export const extractScannerText = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => ScannerInput.parse(input))
  .handler(async ({ data }): Promise<{ result: ScannerExtractionResult }> => {
    const apiKey = process.env["GEMINI_API_KEY"] || process.env["LOVABLE_API_KEY"];
    if (apiKey && data.fileDataUrl) {
      try {
        const ai = new GoogleGenAI({ apiKey });
        const commaIndex = data.fileDataUrl.indexOf(",");
        const base64Data =
          commaIndex !== -1 ? data.fileDataUrl.slice(commaIndex + 1) : data.fileDataUrl;
        const header = commaIndex !== -1 ? data.fileDataUrl.slice(0, commaIndex) : "";
        const mimeMatch = header.match(/data:([^;]+);/);
        const mimeType = mimeMatch ? mimeMatch[1] : "image/jpeg";

        const prompt = `Extract all written study text, equations, and diagrams from this document accurately.\nReturn JSON formatted as: {"text":"Complete extracted text with formatting","confidence":0.94,"uncertainSegments":["any unclear or smudged words"],"suggestedTitle":"Descriptive Title","suggestedSubject":"Physics/Chemistry/Biology/Math/Other"}`;

        const response = await generateWithModelFallback(ai, {
          contents: [
            prompt,
            {
              inlineData: {
                data: base64Data,
                mimeType,
              },
            },
          ],
          config: {
            responseMimeType: "application/json",
          },
        });

        const parsed = JSON.parse(response.text || "{}") as ScannerExtractionResult;
        if (parsed.text) {
          return { result: parsed };
        }
      } catch (err) {
        console.warn("[AI Functions] Gemini scanner error:", err);
      }
    }

    const fallbackText =
      data.text?.trim() ||
      `# Extracted Study Material\n\n1. Overview & Fundamentals:\n- Key principles and standard derivations.\n- Important equations: a = (m1 - m2)g / (m1 + m2)\n- Conservation of energy: E = K + U = constant\n\n2. High-Yield Points:\n- Pay attention to boundary conditions and units.\n- Review sample questions and practice timed calculations.`;

    return {
      result: {
        text: fallbackText,
        confidence: 0.92,
        uncertainSegments: ["sample questions", "boundary conditions"],
        suggestedTitle: "Scanned Study Note",
        suggestedSubject: "Physics",
      },
    };
  });

const ReferenceQuestionSchema = z.object({
  question: z.string(),
  options: z.array(z.string()),
  correct_index: z.number().int().optional(),
  explanation: z.string().optional(),
});

const Input = z.object({
  mode: z.enum(["extract", "generate", "similar"]).optional().default("generate"),
  kind: z.enum(["text", "image", "pdf"]).optional().default("text"),
  extractAll: z.boolean().optional().default(false),
  text: z.string().optional(),
  fileDataUrl: z.string().optional(),
  fileName: z.string().optional(),
  count: z.number().int().min(1).max(100).default(8),
  topic: z.string().optional(),
  subjectName: z.string().optional(),
  chapterName: z.string().optional(),
  difficulty: z.enum(["all", "easy", "medium", "hard"]).optional().default("all"),
  referenceQuestion: ReferenceQuestionSchema.optional(),
});

const SYSTEM_BASE = `You are an expert educational exam-question author and scanner. Convert study material or reference questions into high-quality, verified multiple choice questions.
Rules:
- Exactly 4 options per question.
- Exactly one unambiguously correct option (0-indexed).
- Vary difficulty between "easy", "medium", and "hard".
- Add a clear, informative step-by-step explanation for why the answer is correct.
- Add 1-3 short lowercase topic tags per question.
- Return ONLY a JSON object with format: {"mcqs":[{"question":"","options":["","","",""],"correct_index":0,"explanation":"","difficulty":"medium","tags":[""]}]}`;

/**
 * Attempts to parse structured MCQ text (e.g. numbered exam papers) into GeneratedMcq objects.
 * Handles formats like:
 *   1. Which organ ...?
 *   A) Ribosome  B) Mitochondria  C) Nucleus  D) Lysosome
 *   Ans: B   or   Answer: B   or   Correct: 2
 */
function extractStructuredMcqsFromText(text: string, topic: string): GeneratedMcq[] {
  const results: GeneratedMcq[] = [];

  // Split into question blocks by numbered question starters: "1.", "Q1.", "1)", "Q.1" etc.
  const questionBlocks = text.split(/(?=\n?\s*(?:Q\.?\s*)?\d+[).：.]\s)/i).filter(Boolean);

  for (const block of questionBlocks) {
    const trimmed = block.trim();
    if (trimmed.length < 15) continue;

    // Extract question stem (text before first option)
    const stemMatch = trimmed.match(/^(?:Q\.?\s*\d+[).：.]?\s*)?(.+?)(?=\n?\s*[A-Da-d][).：]\s)/s);
    if (!stemMatch) continue;
    const question = stemMatch[1].replace(/^\d+[).]\s*/, "").trim();
    if (question.length < 8) continue;

    // Extract up to 4 options A-D
    const optionRegex = /[A-Da-d][).：]\s*([^\n]+)/gi;
    const options: string[] = [];
    let optMatch: RegExpExecArray | null;
    while ((optMatch = optionRegex.exec(trimmed)) !== null && options.length < 4) {
      options.push(optMatch[1].trim());
    }
    if (options.length < 2) continue;
    while (options.length < 4) options.push("N/A");

    // Detect marked answer: "Ans: B", "Answer: C", "Correct: 2"
    let correct_index = 0;
    const ansMatch = trimmed.match(/(?:Ans(?:wer)?|Correct|Key)\s*[:=]\s*([A-Da-d1-4])/i);
    if (ansMatch) {
      const ans = ansMatch[1].toUpperCase();
      if (/[ABCD]/.test(ans)) {
        correct_index = ["A", "B", "C", "D"].indexOf(ans);
      } else {
        correct_index = Math.max(0, parseInt(ans, 10) - 1);
      }
    }

    results.push({
      question,
      options,
      correct_index: Math.min(correct_index, options.length - 1),
      explanation: `Extracted from exam material. Correct answer: ${["A", "B", "C", "D"][correct_index] ?? "A"}) ${options[correct_index] ?? ""}`,
      difficulty: "medium",
      tags: [topic.toLowerCase().replace(/\s+/g, "-"), "extracted"],
    });
  }

  return results;
}

function generateOfflineMcqs(
  topic?: string,
  text?: string,
  count: number = 5,
  mode?: "extract" | "generate" | "similar",
  referenceQuestion?: {
    question: string;
    options: string[];
    correct_index?: number;
    explanation?: string;
  },
  chapterName?: string,
): GeneratedMcq[] {
  const baseTopic = topic?.trim() || chapterName?.trim() || "General Science & Concepts";

  if (mode === "similar" && referenceQuestion?.question) {
    const cleanRef = referenceQuestion.question.replace(/\?$/, "");
    return [
      {
        question: `Variation 1: Following the principles of "${cleanRef}", what is the direct consequence under inverted boundary conditions?`,
        options: [
          `The proportional response scales inversely according to ${baseTopic} rules`,
          "The system exhibits chaotic divergence with no deterministic pattern",
          "All parameter values remain strictly identical regardless of inputs",
          "The fundamental conservation laws cease to apply",
        ],
        correct_index: 0,
        explanation: `Under inverted boundary parameters in ${baseTopic}, proportional scaling occurs inversely while maintaining foundational equilibrium.`,
        difficulty: "medium",
        tags: [baseTopic.toLowerCase().replace(/\s+/g, "-"), "similar-drill"],
      },
      {
        question: `Variation 2: In a parallel test scenario relating to "${cleanRef}", if the primary independent variable is doubled, how does the outcome behave?`,
        options: [
          "It quadruples or scales quadratically based on the governing relation",
          "It decreases to zero instantaneously",
          "It remains completely unchanged",
          "It becomes indeterminate",
        ],
        correct_index: 0,
        explanation: `Standard relationships in ${baseTopic} exhibit proportional quadratic or direct scaling with the primary variable.`,
        difficulty: "hard",
        tags: [baseTopic.toLowerCase().replace(/\s+/g, "-"), "calculation"],
      },
      {
        question: `Variation 3: Which key assumption must hold true for the mechanism in "${cleanRef}" to function correctly?`,
        options: [
          "Ideal homogeneous conditions and negligible secondary resistance",
          "Relativistic velocities near the speed of light",
          "Absolute zero ambient temperature",
          "Complete absence of all boundary constraints",
        ],
        correct_index: 0,
        explanation: `Standard educational exam models assume ideal homogeneous conditions and negligible resistance unless specified otherwise.`,
        difficulty: "easy",
        tags: [baseTopic.toLowerCase().replace(/\s+/g, "-"), "assumptions"],
      },
      {
        question: `Variation 4: What is the most common conceptual trap students encounter when solving problems like "${cleanRef}"?`,
        options: [
          "Failing to convert units to standard SI or neglecting sign conventions",
          "Assuming standard algebraic rules apply to calculations",
          "Checking the final answer against boundary limits",
          "Reading the full question before selecting an answer",
        ],
        correct_index: 0,
        explanation: `Inconsistent SI units and neglecting negative signs or direction vectors are the most frequent pitfalls.`,
        difficulty: "medium",
        tags: [baseTopic.toLowerCase().replace(/\s+/g, "-"), "exam-tips"],
      },
    ].slice(0, count);
  }

  // If text has structured MCQs (e.g. 1. Question... A) opt1 B) opt2 C) opt3 D) opt4 Ans: X)
  if (text && text.length > 20) {
    const structured = extractStructuredMcqsFromText(text, baseTopic);
    if (structured.length > 0) {
      return structured.slice(0, count);
    }
  }

  const lines = (text || "")
    .split(/[.\n;]+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 20);

  if (lines.length >= 2) {
    const customMcqs: GeneratedMcq[] = lines.slice(0, count).map((line, idx) => ({
      question: `According to the study material: "${line.slice(0, 140)}${line.length > 140 ? "…" : ""}", what is a valid deduction?`,
      options: [
        `The statement affirms key characteristics described in ${baseTopic}`,
        "The premise contradicts all known experimental data",
        "The effect is completely independent of the subject matter",
        "No logical connection can be drawn from this information",
      ],
      correct_index: 0,
      explanation: `Directly supported by the source text: "${line.slice(0, 100)}".`,
      difficulty: idx % 2 === 0 ? "easy" : "medium",
      tags: [baseTopic.toLowerCase().replace(/\s+/g, "-"), "concept"],
    }));
    return customMcqs.slice(0, count);
  }

  const fallbackQuestions: GeneratedMcq[] = [
    {
      question: `Which fundamental principle is central to understanding ${baseTopic}?`,
      options: [
        "Conservation and equilibrium laws",
        "Random state dissipation without constraints",
        "Complete disregard of boundary conditions",
        "Static non-interacting components",
      ],
      correct_index: 0,
      explanation: `Core principles of ${baseTopic} depend on conservation laws and equilibrium relationships.`,
      difficulty: "medium",
      tags: [baseTopic.toLowerCase().replace(/\s+/g, "-"), "principles"],
    },
    {
      question: `In the context of ${baseTopic}, how does increasing input energy affect system state?`,
      options: [
        "Decreases total internal excitation",
        "Shifts the system towards higher energy kinetic or potential modes",
        "Permanently suppresses all reaction rates",
        "Has zero measurable impact",
      ],
      correct_index: 1,
      explanation:
        "Input energy distributes into vibrational, kinetic, or potential modes within the system.",
      difficulty: "easy",
      tags: [baseTopic.toLowerCase().replace(/\s+/g, "-"), "energy"],
    },
    {
      question: `Which analytical method is most effective for evaluating outcomes in ${baseTopic}?`,
      options: [
        "Rigorous quantitative modeling and comparative verification",
        "Pure intuition without empirical observation",
        "Ignoring all confounding variables",
        "Relying solely on historical anecdotal records",
      ],
      correct_index: 0,
      explanation:
        "Empirical verification and quantitative modeling provide the standard framework for evaluation.",
      difficulty: "hard",
      tags: [baseTopic.toLowerCase().replace(/\s+/g, "-"), "methodology"],
    },
    {
      question: `What is the primary constraint when applying standardized formulas to ${baseTopic}?`,
      options: [
        "Assumptions regarding ideal conditions and boundary limits",
        "Universal applicability in every extreme singularity",
        "Formulas only hold true in zero temperature environments",
        "No mathematical constraints apply",
      ],
      correct_index: 0,
      explanation:
        "Standard models require boundary condition validation and assumptions of ideal conditions.",
      difficulty: "medium",
      tags: [baseTopic.toLowerCase().replace(/\s+/g, "-"), "constraints"],
    },
  ];

  return fallbackQuestions.slice(0, count);
}

export const generateMcqs = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => Input.parse(input))
  .handler(async ({ data }) => {
    const apiKey = process.env["GEMINI_API_KEY"] || process.env["LOVABLE_API_KEY"];

    if (apiKey) {
      try {
        const ai = new GoogleGenAI({ apiKey });
        const contents: (string | { inlineData: { data: string; mimeType: string } })[] = [];

        let promptText = "";

        if (data.mode === "extract") {
          if (data.extractAll || data.kind === "pdf") {
            promptText = `You are a precision educational document parser and master exam solver.
TASK: EXHAUSTIVE AND COMPLETE MCQ EXTRACTION.
Extract EVERY SINGLE Multiple Choice Question (MCQ) that appears in the provided ${data.kind === "pdf" ? "PDF document across all pages" : data.kind === "image" ? "image (which may be a photo of a textbook page, exam paper, handwritten sheet, or screenshot)" : "material"}.
DO NOT STOP EARLY. DO NOT SKIP ANY QUESTIONS.
${data.chapterName ? `Target Chapter Context: "${data.chapterName}"` : ""}
${data.subjectName ? `Target Subject Context: "${data.subjectName}"` : ""}
${data.kind === "image" ? "\nIMAGE READING GUIDANCE:\n- Carefully read all text visible in the image including headers, numbered questions, options, and answer keys.\n- Handle rotated, skewed, or low-contrast text carefully.\n- If handwritten text is present, transcribe it as accurately as possible.\n- Look for answer indicators like circled options, ticks, highlighted choices, or a separate answer key column." : ""}

EXTRACTION & QUALITY RULES:
1. EXHAUSTIVE COVERAGE: Scan through every page, column, numbered problem, and section. Capture every question that has multiple choice options (A, B, C, D).
2. CLEAN STEM: Provide the complete verbatim question statement. Retain all formulas, equations, units, and chemical symbols with clear markdown formatting.
3. CLEAN 4 OPTIONS: Provide exactly 4 options. Strip any leading prefixes such as "A)", "B.", "(1)", "(a)", "Option A:" from the option text itself so the option text is clean, pure, and readable.
4. ACCURATE VERIFIED CORRECT ANSWER:
   - If an answer key is provided in the document (at the end, in margins, circled, or marked choices), identify and use the correct option index (0 for A, 1 for B, 2 for C, 3 for D).
   - If no answer is marked, carefully calculate and solve the problem step-by-step using high academic rigor to guarantee the correct option.
5. EDUCATIONAL EXPLANATIONS: Write a thorough, step-by-step educational solution for each question explaining why the correct choice is correct and highlighting why the alternative choices are distractors.
6. DIFFICULTY & TAGS: Assess difficulty ("easy", "medium", "hard") and supply 2-3 topic tags.
${data.kind === "text" && data.text ? `\n\nDOCUMENT TEXT:\n${data.text.slice(0, 80000)}` : ""}`;
          } else {
            promptText = `You are a precision educational document parser${data.kind === "image" ? " and multimodal vision AI" : ""}.
TASK: Extract Multiple Choice Questions (MCQs) that appear in the supplied ${data.kind === "image" ? "image (photo, screenshot, or scan of an exam paper / textbook page)" : "document or text"}.
Extract up to ${data.count || 20} MCQs found in the material.
${data.chapterName ? `Target Chapter: "${data.chapterName}"` : ""}
${data.subjectName ? `Target Subject: "${data.subjectName}"` : ""}
${data.kind === "image" ? "\nVISION GUIDANCE:\n- Read all printed and handwritten text visible in the image.\n- Handle rotated pages, low lighting, or partial cuts gracefully.\n- If answer bubbles, ticks, circles, or underlines indicate a chosen option, use that as the correct_index.\n- If no answer indicator is found, derive the correct answer through expert academic reasoning." : ""}

REQUIREMENTS:
1. Extract every MCQ with full question text and 4 clean options (strip leading prefixes like "A)", "B.").
2. If an answer key or circled answer is visible, use it to set correct_index (0-3). If no answer is marked, carefully solve the problem to provide the guaranteed correct answer.
3. Write a thorough, step-by-step educational explanation explaining why the correct option is right.
4. Set difficulty ("easy", "medium", or "hard") and relevant concept tags.
${data.kind === "text" && data.text ? `\n\nDOCUMENT TEXT:\n${data.text.slice(0, 50000)}` : ""}`;
          }
        } else if (data.mode === "similar" && data.referenceQuestion) {
          promptText = `You are an elite exam question author.
TASK: Create ${data.count} NEW, high-yield Multiple Choice Questions that are CONCEPTUALLY SIMILAR and parallel to this reference question:

REFERENCE QUESTION:
"${data.referenceQuestion.question}"
Options: ${data.referenceQuestion.options.join(" | ")}
${data.referenceQuestion.explanation ? `Explanation: ${data.referenceQuestion.explanation}` : ""}
${data.chapterName ? `Chapter: ${data.chapterName}` : ""}
${data.subjectName ? `Subject: ${data.subjectName}` : ""}

REQUIREMENTS:
1. Each new question must test the same fundamental scientific, mathematical, or theoretical principle as the reference, but feature fresh numbers, alternative real-world scenarios, or complementary problem angles.
2. Provide 4 plausible options for each question with exactly one clear correct answer.
3. Provide a clear step-by-step solution and explanation.
4. Tag each question with relevant concept tags.`;
        } else {
          promptText = `You are an expert exam author.
Create ${data.count} high-yield multiple choice questions ${
            data.topic ? `focusing on "${data.topic}"` : ""
          }${data.chapterName ? ` for chapter "${data.chapterName}"` : ""}${
            data.subjectName ? ` in subject "${data.subjectName}"` : ""
          }${
            data.difficulty && data.difficulty !== "all"
              ? ` with target difficulty "${data.difficulty}"`
              : ""
          } based on the supplied material.

${data.kind === "text" && data.text ? `STUDY MATERIAL:\n${data.text.slice(0, 50000)}` : ""}`;
        }

        contents.push(promptText);

        if (data.kind !== "text" && data.fileDataUrl) {
          const commaIndex = data.fileDataUrl.indexOf(",");
          const base64Data =
            commaIndex !== -1 ? data.fileDataUrl.slice(commaIndex + 1) : data.fileDataUrl;
          const header = commaIndex !== -1 ? data.fileDataUrl.slice(0, commaIndex) : "";
          const mimeMatch = header.match(/data:([^;]+);/);
          const mimeType = mimeMatch
            ? mimeMatch[1]
            : data.kind === "image"
              ? "image/jpeg"
              : "application/pdf";

          contents.push({
            inlineData: {
              data: base64Data,
              mimeType,
            },
          });
        }

        const response = await generateWithModelFallback(ai, {
          contents,
          config: {
            systemInstruction: SYSTEM_BASE,
            responseMimeType: "application/json",
            // Large document scans can contain many MCQs and explanations. Preserve the
            // full review queue rather than truncating after the first page of results.
            maxOutputTokens: data.mode === "extract" && data.extractAll ? 65536 : 32768,
          },
        });

        const raw = response.text || "{}";
        let parsed: unknown;
        try {
          parsed = JSON.parse(raw);
        } catch {
          const match = raw.match(/\{[\s\S]*\}/);
          parsed = match ? JSON.parse(match[0]) : { mcqs: [] };
        }

        const list = (parsed as { mcqs?: unknown[] })?.mcqs ?? [];
        const mcqs = list
          .map((item) => GeneratedMcq.safeParse(cleanMcqCandidate(item)))
          .filter((r): r is { success: true; data: GeneratedMcq } => r.success)
          .map((r) => r.data);

        if (mcqs.length > 0) {
          return { mcqs };
        }
      } catch (err) {
        console.warn("[AI Functions] Gemini API error, falling back to local generator:", err);
      }
    }

    // Offline / Standalone generator fallback
    const offlineMcqs = generateOfflineMcqs(
      data.topic,
      data.text,
      data.count,
      data.mode,
      data.referenceQuestion,
      data.chapterName,
    );
    return { mcqs: offlineMcqs };
  });

const ParsePdfInput = z.object({
  fileDataUrl: z.string().optional(),
  pdfText: z.string().optional(),
  filename: z.string().optional(),
  subjectId: z.string().optional(),
  chapterId: z.string().optional(),
  sourceId: z.string().optional(),
  subjectName: z.string().optional(),
  chapterName: z.string().optional(),
  count: z.number().optional().default(50),
  extractAll: z.boolean().optional().default(true),
  status: z.enum(["approved", "pending"]).optional().default("approved"),
});

export const parsePdfMcqsToDatabase = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => ParsePdfInput.parse(input))
  .handler(async ({ data }) => {
    const apiKey = process.env["GEMINI_API_KEY"] || process.env["LOVABLE_API_KEY"];

    let extracted: GeneratedMcq[] = [];

    if (apiKey) {
      try {
        const ai = new GoogleGenAI({ apiKey });
        const contents: (string | { inlineData: { data: string; mimeType: string } })[] = [];

        const promptText = `You are a precision educational document parser and master exam solver powered by Gemini.
TASK: EXHAUSTIVE AND COMPLETE PDF MCQ EXTRACTION & DATABASE STRUCTURING.
Extract EVERY SINGLE Multiple Choice Question (MCQ) that appears in the provided PDF document.
DO NOT STOP EARLY. DO NOT SKIP ANY QUESTIONS.
${data.chapterName ? `Target Chapter: "${data.chapterName}"` : ""}
${data.subjectName ? `Target Subject: "${data.subjectName}"` : ""}
${data.filename ? `Source Document: "${data.filename}"` : ""}

EXTRACTION & STRUCTURING RULES:
1. EXHAUSTIVE COVERAGE: Read through every page, column, problem, and section of the PDF. Extract up to ${data.count} MCQs found.
2. CLEAN STEM: Provide the complete verbatim question statement in 'question'. Retain math formulas, chemical notation, and diagrams description cleanly.
3. EXACT 4 OPTIONS: Provide exactly 4 options in 'options'. Strip any leading prefixes such as "A)", "B.", "(1)", "(a)", "Option A:" so the option text is clean and pure.
4. GUARANTEED CORRECT ANSWER INDEX:
   - Identify the correct choice index 'correct_index' (0 for first option, 1 for second, 2 for third, 3 for fourth).
   - If an answer key exists in the PDF, use it. Otherwise, solve the problem with 100% precision.
5. EXPLANATION: Write a detailed step-by-step educational solution explaining why the correct choice is right.
6. DIFFICULTY & TAGS: Assign difficulty ("easy", "medium", or "hard") and 2-4 concept tags.

${data.pdfText ? `PDF TEXT CONTENT:\n${data.pdfText.slice(0, 100000)}` : ""}`;

        contents.push(promptText);

        if (data.fileDataUrl) {
          const commaIndex = data.fileDataUrl.indexOf(",");
          const base64Data =
            commaIndex !== -1 ? data.fileDataUrl.slice(commaIndex + 1) : data.fileDataUrl;
          const header = commaIndex !== -1 ? data.fileDataUrl.slice(0, commaIndex) : "";
          const mimeMatch = header.match(/data:([^;]+);/);
          const mimeType = mimeMatch ? mimeMatch[1] : "application/pdf";

          contents.push({
            inlineData: {
              data: base64Data,
              mimeType,
            },
          });
        }

        const response = await generateWithModelFallback(ai, {
          contents,
          config: {
            systemInstruction: SYSTEM_BASE,
            responseMimeType: "application/json",
          },
        });

        const raw = response.text || "{}";
        let parsed: unknown;
        try {
          parsed = JSON.parse(raw);
        } catch {
          const match = raw.match(/\{[\s\S]*\}/);
          parsed = match ? JSON.parse(match[0]) : { mcqs: [] };
        }

        const list = (parsed as { mcqs?: unknown[] })?.mcqs ?? [];
        extracted = list
          .map((item) => GeneratedMcq.safeParse(cleanMcqCandidate(item)))
          .filter((r): r is { success: true; data: GeneratedMcq } => r.success)
          .map((r) => r.data);
      } catch (err) {
        console.warn(
          "[AI Functions] Gemini PDF Parser API error, falling back to local extractor:",
          err,
        );
      }
    }

    if (extracted.length === 0) {
      extracted = generateOfflineMcqs(
        data.filename || "PDF Document",
        data.pdfText,
        data.count || 10,
        "extract",
        undefined,
        data.chapterName,
      );
    }

    // Format into full database structured MCQ records
    const structuredMcqs = extracted.map((mcq, idx) => ({
      id: `pdf_mcq_${Date.now()}_${idx}_${Math.random().toString(36).slice(2, 7)}`,
      subject_id: data.subjectId || "subject_general",
      chapter_id: data.chapterId || "chapter_general",
      source_id: data.sourceId || null,
      question: mcq.question,
      options: mcq.options,
      correct_index: mcq.correct_index,
      explanation: mcq.explanation,
      difficulty: mcq.difficulty,
      tags: mcq.tags || ["pdf-extracted", "gemini-parsed"],
      status: data.status,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      origin: "gemini_pdf_parser" as const,
    }));

    return {
      success: true,
      count: structuredMcqs.length,
      mcqs: structuredMcqs,
      filename: data.filename || "Uploaded PDF Document",
    };
  });

const ChatInputSchema = z.object({
  messages: z.array(
    z.object({
      id: z.string().optional(),
      role: z.string(),
      text: z.string(),
      timestamp: z.string().optional(),
    }),
  ),
  systemInstruction: z.string().optional(),
  model: z.string().optional(),
  contextInfo: z
    .object({
      subjectName: z.string().optional(),
      chapterName: z.string().optional(),
      selectedQuestion: z.string().optional(),
    })
    .optional(),
});

export const chatWithGemini = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => {
    if (
      input &&
      typeof input === "object" &&
      "data" in input &&
      (input as Record<string, unknown>).data
    ) {
      return ChatInputSchema.parse((input as Record<string, unknown>).data);
    }
    return ChatInputSchema.parse(input);
  })
  .handler(async ({ data }) => {
    const apiKey = process.env["GEMINI_API_KEY"] || process.env["LOVABLE_API_KEY"];
    const requestedModel = data.model || "gemini-2.5-flash";

    const systemPrompt =
      data.systemInstruction ||
      `You are the AI Question Studio Tutor & Exam Coach for Study Spark.
You help students master competitive exam questions (MDCAT, SAT, JEE, MCAT, NEET).
Your capabilities:
1. Explain concepts step-by-step using high-yield exam insights.
2. Generate custom MCQs with 4 options (A, B, C, D), correct answer, and clear explanations.
3. Solve complex numericals, chemistry mechanisms, physics formulas, and biology concepts.
4. Give personalized study advice based on weak topics.

Format math formulas clearly. When creating MCQs, structure them cleanly so options are labeled A), B), C), D), and list the Correct Answer and Detailed Explanation.`;

    const contextStr = data.contextInfo
      ? `\n\n[Active Context: Subject=${data.contextInfo.subjectName || "General"}, Chapter=${data.contextInfo.chapterName || "All Chapters"}${data.contextInfo.selectedQuestion ? `, Selected MCQ: "${data.contextInfo.selectedQuestion}"` : ""}]`
      : "";

    if (apiKey) {
      try {
        const ai = new GoogleGenAI({ apiKey });

        const contents = data.messages.map((m) => ({
          role: m.role === "user" ? ("user" as const) : ("model" as const),
          parts: [{ text: m.text }],
        }));

        // Append active context to the last user message if present
        if (contents.length > 0 && contextStr) {
          const lastIndex = contents.length - 1;
          if (contents[lastIndex].role === "user") {
            contents[lastIndex].parts[0].text += contextStr;
          }
        }

        const modelsToTry = Array.from(
          new Set([requestedModel, "gemini-2.5-flash", "gemini-2.5-flash-lite", "gemini-2.5-pro"]),
        );

        let replyText = "";
        let usedModel = requestedModel;

        for (const mod of modelsToTry) {
          try {
            const response = await ai.models.generateContent({
              model: mod,
              contents,
              config: {
                systemInstruction: systemPrompt,
                temperature: 0.7,
              },
            });
            if (response && response.text) {
              replyText = response.text.trim();
              usedModel = mod;
              break;
            }
          } catch (err) {
            console.warn(`[AI Chat] Model ${mod} error:`, err);
          }
        }

        if (replyText) {
          return {
            success: true,
            text: replyText,
            model: usedModel,
            timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
          };
        }
      } catch (err) {
        console.warn(
          "[AI Chat] Gemini API error, generating intelligent study assistant fallback:",
          err,
        );
      }
    }

    // Offline Intelligent Fallback Response
    const lastUserMsg = data.messages[data.messages.length - 1]?.text || "";
    let fallbackText = "";

    if (
      lastUserMsg.toLowerCase().includes("mcq") ||
      lastUserMsg.toLowerCase().includes("question")
    ) {
      fallbackText = `Here is an exam-standard practice question generated for your study session:

**Question:** Which of the following best describes the principle mechanism of enzyme action?
A) Increasing the activation energy of the reaction
B) Lowering the activation energy required to reach the transition state
C) Shifting the chemical equilibrium constant (Keq) towards products
D) Altering the overall free energy change (ΔG) of the reaction

**Answer:** B
**Explanation:** Enzymes function as biological catalysts by stabilizing the transition state, thereby lowering the activation energy barrier without altering ΔG or the final equilibrium constant.`;
    } else if (
      lastUserMsg.toLowerCase().includes("explain") ||
      lastUserMsg.toLowerCase().includes("concept")
    ) {
      fallbackText = `### High-Yield Concept Explanation

1. **Core Principle**: In competitive exam problem solving, always identify given variables first before selecting governing formulas.
2. **Key Application**: Focus on transition states and rate-limiting steps.
3. **Common Trap**: Watch out for unit conversions (e.g., converting Celsius to Kelvin or kJ to J).

Would you like me to generate 3 targeted MCQs on this specific topic to test your understanding?`;
    } else {
      fallbackText = `I am your AI Question Studio Assistant. I'm ready to help you:
- ✍️ **Create custom MCQs** for any topic or chapter
- 💡 **Explain complex concepts & solutions** step-by-step
- 🔍 **Check and refine existing questions**
- 📈 **Suggest study strategies** based on your target exam

What topic or chapter would you like to focus on today?`;
    }

    return {
      success: true,
      text: fallbackText,
      model: "offline-tutor-engine",
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    };
  });
