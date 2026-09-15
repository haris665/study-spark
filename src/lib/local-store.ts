import type {
  Subject,
  Chapter,
  Topic,
  Source,
  Mcq,
  Profile,
  PlanSlot,
  Exam,
  ExamQuestion,
  Note,
  NoteCategory,
  ReviewSchedule,
  ReviewEvent,
} from "./queries";
import { calculateSM2, accuracyToSM2Quality } from "@/lib/sm2";
import { URDU_SUBJECT, URDU_CHAPTERS, URDU_MCQS } from "@/data/urdu-past-papers";

const STORAGE_KEYS = {
  SUBJECTS: "study_spark_subjects",
  CHAPTERS: "study_spark_chapters",
  TOPICS: "study_spark_topics",
  SOURCES: "study_spark_sources",
  MCQS: "study_spark_mcqs",
  ATTEMPTS: "study_spark_attempts",
  SESSIONS: "study_spark_sessions",
  PROFILE: "study_spark_profile",
  PLAN_SLOTS: "study_spark_plan_slots",
  EXAMS: "study_spark_exams",
  EXAM_QUESTIONS: "study_spark_exam_questions",
  NOTES: "study_spark_notes",
  NOTE_CATEGORIES: "study_spark_note_categories",
  REVIEW_SCHEDULES: "study_spark_review_schedules",
  REVIEW_EVENTS: "study_spark_review_events",
  INCOMPLETE_SESSION: "study_spark_incomplete_session",
};

export const INITIAL_PROFILE: Profile = {
  id: "local-user-1",
  email: "mmhb112010@gmail.com",
  display_name: "Hamza Baig",
  exam_name: "National Entrance Exam 2026",
  theme: "aurora",
  daily_reminder: true,
  reminder_time: "19:00",
  reminder_email: "mmhb112010@gmail.com",
};

export const INITIAL_SUBJECTS: Subject[] = [
  {
    id: "sub-1",
    name: "Physics",
    description: "Mechanics, Electromagnetism, Waves and Quantum Physics",
    color: "accent",
    position: 0,
    created_at: new Date(Date.now() - 30 * 86400000).toISOString(),
  },
  {
    id: "sub-2",
    name: "Chemistry",
    description: "Organic Chemistry, Thermodynamics and Chemical Bonding",
    color: "amber",
    position: 1,
    created_at: new Date(Date.now() - 28 * 86400000).toISOString(),
  },
  {
    id: "sub-3",
    name: "Biology",
    description: "Cell Biology, Human Physiology, Genetics and Ecology",
    color: "rose",
    position: 2,
    created_at: new Date(Date.now() - 25 * 86400000).toISOString(),
  },
  {
    id: "sub-4",
    name: "Mathematics",
    description: "Calculus, Linear Algebra, Coordinate Geometry and Statistics",
    color: "accent",
    position: 3,
    created_at: new Date(Date.now() - 22 * 86400000).toISOString(),
  },
  {
    id: "sub-5",
    name: "Computer Science",
    description: "Data Structures, Algorithms, Computer Networks and Databases",
    color: "amber",
    position: 4,
    created_at: new Date(Date.now() - 20 * 86400000).toISOString(),
  },
  {
    id: "sub-6",
    name: "English",
    description: "Comprehension, Literature, Critical Logic and Grammar",
    color: "accent",
    position: 5,
    created_at: new Date(Date.now() - 18 * 86400000).toISOString(),
  },
  URDU_SUBJECT,
];

export const INITIAL_CHAPTERS: Chapter[] = [
  // Physics
  {
    id: "ch-101",
    subject_id: "sub-1",
    name: "Kinematics & Dynamics",
    description: "Newton's laws, projectile motion, circular motion",
    position: 0,
  },
  {
    id: "ch-102",
    subject_id: "sub-1",
    name: "Work, Energy & Power",
    description: "Conservative forces, work-energy theorem, collisions",
    position: 1,
  },
  {
    id: "ch-103",
    subject_id: "sub-1",
    name: "Electromagnetism & Induction",
    description: "Coulomb's law, magnetic fields, Faraday's law",
    position: 2,
  },
  {
    id: "ch-104",
    subject_id: "sub-1",
    name: "Wave Optics & Modern Physics",
    description: "Interference, diffraction, photoelectric effect",
    position: 3,
  },

  // Chemistry
  {
    id: "ch-201",
    subject_id: "sub-2",
    name: "Atomic Structure & Periodic Trends",
    description: "Quantum numbers, ionization energy, electronegativity",
    position: 0,
  },
  {
    id: "ch-202",
    subject_id: "sub-2",
    name: "Thermodynamics & Equilibrium",
    description: "Enthalpy, entropy, Gibbs energy, Le Chatelier",
    position: 1,
  },
  {
    id: "ch-203",
    subject_id: "sub-2",
    name: "Organic Reaction Mechanisms",
    description: "SN1, SN2, electrophilic addition, resonance",
    position: 2,
  },

  // Biology
  {
    id: "ch-301",
    subject_id: "sub-3",
    name: "Cell Structure & Cell Cycle",
    description: "Organelles, mitosis, meiosis, membrane transport",
    position: 0,
  },
  {
    id: "ch-302",
    subject_id: "sub-3",
    name: "Genetics & Molecular Biology",
    description: "Mendelian inheritance, DNA replication, transcription",
    position: 1,
  },
  {
    id: "ch-303",
    subject_id: "sub-3",
    name: "Human Circulatory & Nervous Systems",
    description: "Heart physiology, action potentials, synapses",
    position: 2,
  },

  // Mathematics
  {
    id: "ch-400",
    subject_id: "sub-4",
    name: "Algebra & Quadratic Equations",
    description: "Polynomials, Vieta's formulas, nature of roots, complex conjugates",
    position: 0,
  },
  {
    id: "ch-401",
    subject_id: "sub-4",
    name: "Calculus: Limits & Derivatives",
    description: "Chain rule, extrema, Taylor approximations",
    position: 1,
  },
  {
    id: "ch-402",
    subject_id: "sub-4",
    name: "Integral Calculus & Applications",
    description: "Definite integrals, substitution, area under curve",
    position: 2,
  },
  {
    id: "ch-403",
    subject_id: "sub-4",
    name: "Linear Algebra & Matrices",
    description: "Determinants, eigenvalues, matrix transformations",
    position: 3,
  },
  {
    id: "ch-404",
    subject_id: "sub-4",
    name: "Trigonometry & Identities",
    description: "Trigonometric ratios, compound angle identities, transformations",
    position: 4,
  },

  // Computer Science
  {
    id: "ch-501",
    subject_id: "sub-5",
    name: "Data Structures & Trees",
    description: "Arrays, linked lists, stacks, queues, binary search trees",
    position: 0,
  },
  {
    id: "ch-502",
    subject_id: "sub-5",
    name: "Algorithms & Complexity",
    description: "Sorting, dynamic programming, graph traversal, Big O",
    position: 1,
  },
  {
    id: "ch-503",
    subject_id: "sub-5",
    name: "Databases & SQL Systems",
    description: "Relational modeling, normalization, indexing, ACID",
    position: 2,
  },

  // English & Reasoning
  {
    id: "ch-601",
    subject_id: "sub-6",
    name: "Critical Reading & Argumentation",
    description: "Implicit assumptions, inferences, thesis analysis",
    position: 0,
  },
  {
    id: "ch-602",
    subject_id: "sub-6",
    name: "Formal Logic & Deductive Reasoning",
    description: "Syllogisms, propositional logic, Venn reasoning",
    position: 1,
  },
  {
    id: "ch-603",
    subject_id: "sub-6",
    name: "Quaid-e-Azam",
    description: "Speeches, historical texts, and literature references",
    position: 2,
  },
  ...URDU_CHAPTERS,
];

export const INITIAL_TOPICS: Topic[] = [
  // Physics Kinematics & Dynamics (ch-101)
  {
    id: "top-101-1",
    chapter_id: "ch-101",
    name: "Projectile Motion & Trajectory Equations",
    completion: "not_started",
    confidence: "medium",
    last_studied_at: null,
    due_review_at: null,
    notes_count: 0,
    mcqs_count: 0,
    tags: ["mechanics", "kinematics"],
  },
  {
    id: "top-101-2",
    chapter_id: "ch-101",
    name: "Newton's 2nd & 3rd Laws and Free Body Diagrams",
    completion: "not_started",
    confidence: "medium",
    last_studied_at: null,
    due_review_at: null,
    notes_count: 0,
    mcqs_count: 0,
    tags: ["forces", "newton"],
  },
  {
    id: "top-101-3",
    chapter_id: "ch-101",
    name: "Circular Motion & Centripetal Acceleration",
    completion: "not_started",
    confidence: "medium",
    last_studied_at: null,
    due_review_at: null,
    notes_count: 0,
    mcqs_count: 0,
    tags: ["circular-motion"],
  },
  // Physics Electromagnetism (ch-103)
  {
    id: "top-103-1",
    chapter_id: "ch-103",
    name: "Coulomb's Law & Electric Fields",
    completion: "not_started",
    confidence: "medium",
    last_studied_at: null,
    due_review_at: null,
    notes_count: 0,
    mcqs_count: 0,
    tags: ["electrostatics"],
  },
  {
    id: "top-103-2",
    chapter_id: "ch-103",
    name: "Faraday's Law of Induction & Lenz's Rule",
    completion: "not_started",
    confidence: "medium",
    last_studied_at: null,
    due_review_at: null,
    notes_count: 0,
    mcqs_count: 0,
    tags: ["induction", "lenz"],
  },
  // Chemistry Organic (ch-203)
  {
    id: "top-203-1",
    chapter_id: "ch-203",
    name: "SN1 vs SN2 Nucleophilic Substitution",
    completion: "not_started",
    confidence: "medium",
    last_studied_at: null,
    due_review_at: null,
    notes_count: 0,
    mcqs_count: 0,
    tags: ["organic", "mechanisms"],
  },
  {
    id: "top-203-2",
    chapter_id: "ch-203",
    name: "Electrophilic Aromatic Substitution & Directing Groups",
    completion: "not_started",
    confidence: "medium",
    last_studied_at: null,
    due_review_at: null,
    notes_count: 0,
    mcqs_count: 0,
    tags: ["aromatics", "weak"],
  },
  // Biology Cell (ch-301)
  {
    id: "top-301-1",
    chapter_id: "ch-301",
    name: "Membrane Transport & Osmosis",
    completion: "not_started",
    confidence: "medium",
    last_studied_at: null,
    due_review_at: null,
    notes_count: 0,
    mcqs_count: 0,
    tags: ["cell-bio"],
  },
  {
    id: "top-301-2",
    chapter_id: "ch-301",
    name: "Meiosis Phases & Homologous Crossing Over",
    completion: "not_started",
    confidence: "medium",
    last_studied_at: null,
    due_review_at: null,
    notes_count: 0,
    mcqs_count: 0,
    tags: ["meiosis", "genetics"],
  },
  // Math Algebra (ch-400)
  {
    id: "top-400-1",
    chapter_id: "ch-400",
    name: "Vieta's Formulas & Quadratic Roots",
    completion: "not_started",
    confidence: "medium",
    last_studied_at: null,
    due_review_at: null,
    notes_count: 0,
    mcqs_count: 0,
    tags: ["algebra", "vieta"],
  },
  {
    id: "top-400-2",
    chapter_id: "ch-400",
    name: "Polynomial Remainder & Factor Theorems",
    completion: "not_started",
    confidence: "medium",
    last_studied_at: null,
    due_review_at: null,
    notes_count: 0,
    mcqs_count: 0,
    tags: ["algebra", "unstudied"],
  },
  // Math Calculus (ch-401)
  {
    id: "top-401-1",
    chapter_id: "ch-401",
    name: "Chain Rule & Implicit Differentiation",
    completion: "not_started",
    confidence: "medium",
    last_studied_at: null,
    due_review_at: null,
    notes_count: 0,
    mcqs_count: 0,
    tags: ["calculus"],
  },
  // CS Algorithms (ch-502)
  {
    id: "top-502-1",
    chapter_id: "ch-502",
    name: "Shortest Path: Dijkstra vs Bellman-Ford",
    completion: "not_started",
    confidence: "medium",
    last_studied_at: null,
    due_review_at: null,
    notes_count: 0,
    mcqs_count: 0,
    tags: ["graphs", "algorithms"],
  },
  // Reasoning (ch-602)
  {
    id: "top-602-1",
    chapter_id: "ch-602",
    name: "Syllogistic Deductions & Fallacy of Undistributed Middle",
    completion: "not_started",
    confidence: "medium",
    last_studied_at: null,
    due_review_at: null,
    notes_count: 0,
    mcqs_count: 0,
    tags: ["logic"],
  },
];

export const INITIAL_SOURCES: Source[] = [
  {
    id: "src-1",
    chapter_id: "ch-101",
    title: "Halliday & Resnick Fundamentals of Physics",
    kind: "book",
    reference: "Chapter 2-4: Kinematics & Laws of Motion",
    tags: ["core", "mechanics"],
  },
  {
    id: "src-2",
    chapter_id: "ch-101",
    title: "MIT Classical Mechanics Lecture Notes",
    kind: "notes",
    reference: "Lec 01-08: Dynamics & Inertial Frames",
    tags: ["high-yield"],
  },
  {
    id: "src-102",
    chapter_id: "ch-102",
    title: "University Physics: Work, Energy & Power",
    kind: "book",
    reference: "Chapter 6-7: Potential Energy & Conservation",
    tags: ["mechanics", "energy"],
  },
  {
    id: "src-103",
    chapter_id: "ch-103",
    title: "Griffiths Introduction to Electrodynamics",
    kind: "book",
    reference: "Chapter 7: Electromagnetism & Faraday's Law",
    tags: ["electromagnetism"],
  },
  {
    id: "src-104",
    chapter_id: "ch-104",
    title: "Beiser Concepts of Modern Physics",
    kind: "book",
    reference: "Chapter 2: Photoelectric Effect & Photons",
    tags: ["modern-physics"],
  },
  {
    id: "src-201",
    chapter_id: "ch-201",
    title: "Physical Chemistry by Peter Atkins",
    kind: "book",
    reference: "Chapter 1: Quantum Theory & Atomic Orbitals",
    tags: ["atomic-structure"],
  },
  {
    id: "src-202",
    chapter_id: "ch-202",
    title: "Chemical Thermodynamics Principles",
    kind: "book",
    reference: "Chapter 3: Enthalpy, Entropy & Gibbs Free Energy",
    tags: ["thermodynamics"],
  },
  {
    id: "src-3",
    chapter_id: "ch-203",
    title: "Clayden Organic Chemistry 2nd Edition",
    kind: "book",
    reference: "Chapter 10-12: Nucleophilic Substitution & Elimination",
    tags: ["mechanisms", "organic"],
  },
  {
    id: "src-204",
    chapter_id: "ch-204",
    title: "Cotton & Wilkinson Inorganic Chemistry",
    kind: "book",
    reference: "Chapter 4: Coordination Compounds & Ligands",
    tags: ["inorganic"],
  },
  {
    id: "src-4",
    chapter_id: "ch-301",
    title: "Campbell Biology (12th Edition)",
    kind: "book",
    reference: "Unit 1: The Cell & Meiotic Recombination",
    tags: ["diagrams", "genetics"],
  },
  {
    id: "src-302",
    chapter_id: "ch-302",
    title: "Guyton and Hall Textbook of Medical Physiology",
    kind: "book",
    reference: "Chapter 14: Circulation & Cardiac Cycle",
    tags: ["physiology"],
  },
  {
    id: "src-303",
    chapter_id: "ch-303",
    title: "Kandel Principles of Neural Science",
    kind: "book",
    reference: "Chapter 6: Membrane Potential & Action Potentials",
    tags: ["neurobiology"],
  },
  {
    id: "src-8",
    chapter_id: "ch-400",
    title: "Hall & Knight Higher Algebra",
    kind: "book",
    reference: "Chapter 4: Quadratic Equations & Vieta's Relations",
    tags: ["algebra", "polynomials"],
  },
  {
    id: "src-5",
    chapter_id: "ch-401",
    title: "Stewart Calculus: Early Transcendentals",
    kind: "book",
    reference: "Section 2.1-3.5: Limits, Derivatives & Chain Rule",
    tags: ["calculus"],
  },
  {
    id: "src-402",
    chapter_id: "ch-402",
    title: "Thomas Calculus: Integration & Applications",
    kind: "book",
    reference: "Chapter 5: Definite Integrals & Fundamental Theorem",
    tags: ["calculus", "integration"],
  },
  {
    id: "src-9",
    chapter_id: "ch-404",
    title: "Loney Plane Trigonometry",
    kind: "book",
    reference: "Chapter 6: Compound Angles & Trigonometric Identities",
    tags: ["trigonometry"],
  },
  {
    id: "src-6",
    chapter_id: "ch-501",
    title: "Introduction to Algorithms (CLRS)",
    kind: "book",
    reference: "Chapters 10-13: Binary Search Trees & Heaps",
    tags: ["data-structures"],
  },
  {
    id: "src-502",
    chapter_id: "ch-502",
    title: "Algorithm Design by Kleinberg & Tardos",
    kind: "book",
    reference: "Chapter 4: Greedy Algorithms & Shortest Paths",
    tags: ["graphs", "algorithms"],
  },
  {
    id: "src-503",
    chapter_id: "ch-503",
    title: "Database System Concepts (Silberschatz)",
    kind: "book",
    reference: "Chapter 14: Transactions & ACID Properties",
    tags: ["databases", "acid"],
  },
  {
    id: "src-601",
    chapter_id: "ch-601",
    title: "Wren & Martin High School English Grammar",
    kind: "book",
    reference: "Chapter 12: Subject-Verb Agreement & Modifiers",
    tags: ["grammar"],
  },
  {
    id: "src-7",
    chapter_id: "ch-602",
    title: "GRE & GMAT Critical Reasoning Handbook",
    kind: "guide",
    reference: "Section 3: Deductive Logic & Syllogisms",
    tags: ["verbal", "logic"],
  },
  {
    id: "src-urdu-1",
    chapter_id: "ch-urdu-1",
    title: "پنجاب ٹیکسٹ بک بورڈ (PTBB) اردو لازمی",
    kind: "book",
    reference: "حصہ دوم: اسباق اور منتخب نظم و غزل",
    tags: ["اردو", "شاعری", "نظم"],
  },
  {
    id: "src-urdu-2",
    chapter_id: "ch-urdu-2",
    title: "سرمایہ اردو - اصنافِ ادب و نثر نگاری",
    kind: "book",
    reference: "باب 1 تا 8: داستان، ناول اور افسانہ",
    tags: ["نثر", "ادب"],
  },
  {
    id: "src-urdu-3",
    chapter_id: "ch-urdu-3",
    title: "اردو قواعد و انشا برائے ثانوی و اعلیٰ ثانوی کتب",
    kind: "book",
    reference: "علمِ بیان، علمِ بدیع، سابقے لاحقے اور تذکیر و تانیث",
    tags: ["قواعد", "گرائمر"],
  },
  {
    id: "src-urdu-4",
    chapter_id: "ch-urdu-4",
    title: "سابقہ امتحانی پرچہ جات (2018-2024 Past Papers)",
    kind: "past_paper",
    reference: "لاہور / راولپنڈی / فیڈرل بورڈ اور مقابلہ جاتی امتحانات",
    tags: ["ماضی_کے_پرچے", "معروضی_سوالات"],
  },
  {
    id: "src-603-1",
    chapter_id: "ch-603",
    title: "Chapter 1",
    kind: "book",
    reference: "pg. 1–20",
    tags: ["quaid-e-azam-speech"],
  },
];

export const INITIAL_MCQS: Mcq[] = [
  {
    id: "mcq-qa-1",
    subject_id: "sub-6",
    chapter_id: "ch-603",
    source_id: "src-603-1",
    question: 'In the play "A Visit to a Small Planet," what shape was Kreton\'s spaceship?',
    options: ["Elliptical", "Spherical", "Cylindrical", "Saucer-shaped"],
    correct_index: 0,
    explanation:
      "In Gore Vidal's classic drama 'A Visit to a Small Planet', Kreton describes his spaceship as having an elliptical shape, constructed without rivets or visible seams.",
    difficulty: "medium",
    tags: ["quaid-e-azam-speech", "literature"],
    status: "approved",
    origin: "syllabus",
    created_at: new Date().toISOString(),
  },
  // Mathematics: Quadratic Equations & Algebra (Referenced in Notes & Questions)
  {
    id: "mcq-math-1",
    subject_id: "sub-4",
    chapter_id: "ch-400",
    source_id: "src-8",
    question: "If α, β are the roots of 2x² - 5x + 3 = 0, find α² + β².",
    options: ["13/4", "19/4", "25/4", "7/4"],
    correct_index: 0,
    explanation:
      "Using Vieta's formulas: sum of roots α + β = -(-5)/2 = 5/2, product of roots αβ = 3/2. Then α² + β² = (α + β)² - 2αβ = (5/2)² - 2(3/2) = 25/4 - 3 = 13/4.",
    difficulty: "medium",
    tags: ["algebra", "roots", "vieta"],
    status: "approved",
    origin: "syllabus",
    is_bookmarked: true,
    created_at: new Date(Date.now() - 12 * 86400000).toISOString(),
  },
  {
    id: "mcq-math-2",
    subject_id: "sub-4",
    chapter_id: "ch-400",
    source_id: "src-8",
    question: "If the roots of x² - 6x + k = 0 are real and equal, find k.",
    options: ["9", "6", "12", "36"],
    correct_index: 0,
    explanation:
      "For real and equal roots, the discriminant must equal zero: D = b² - 4ac = 0. Here (-6)² - 4(1)(k) = 0 => 36 - 4k = 0 => k = 9.",
    difficulty: "low",
    tags: ["discriminant", "quadratic", "roots"],
    status: "approved",
    origin: "syllabus",
    is_bookmarked: false,
    created_at: new Date(Date.now() - 10 * 86400000).toISOString(),
  },
  {
    id: "mcq-math-3",
    subject_id: "sub-4",
    chapter_id: "ch-400",
    source_id: "src-8",
    question: "If α, β are the roots of 3x² + 2x - 5 = 0, find the value of α³ + β³.",
    options: ["-98/27", "44/27", "-62/27", "116/27"],
    correct_index: 0,
    explanation:
      "From Vieta's relations: α + β = -2/3 and αβ = -5/3. Using the algebraic expansion: α³ + β³ = (α + β)³ - 3αβ(α + β) = (-2/3)³ - 3(-5/3)(-2/3) = -8/27 - 10/3 = (-8 - 90)/27 = -98/27.",
    difficulty: "high",
    tags: ["algebra", "polynomials", "vieta"],
    status: "approved",
    origin: "syllabus",
    is_bookmarked: true,
    created_at: new Date(Date.now() - 8 * 86400000).toISOString(),
  },
  {
    id: "mcq-math-trig-1",
    subject_id: "sub-4",
    chapter_id: "ch-404",
    source_id: "src-9",
    question: "What is the exact value of sin(75°)?",
    options: ["(√6 + √2)/4", "(√6 - √2)/4", "(√3 + 1)/2√2", "(√3 - 1)/2"],
    correct_index: 0,
    explanation:
      "sin(75°) = sin(45° + 30°) = sin(45°)cos(30°) + cos(45°)sin(30°) = (√2/2)(√3/2) + (√2/2)(1/2) = (√6 + √2)/4.",
    difficulty: "medium",
    tags: ["trigonometry", "angles", "compound-identities"],
    status: "approved",
    origin: "syllabus",
    is_bookmarked: false,
    created_at: new Date(Date.now() - 9 * 86400000).toISOString(),
  },
  {
    id: "mcq-math-trig-2",
    subject_id: "sub-4",
    chapter_id: "ch-404",
    source_id: "src-9",
    question: "If tan(θ) + cot(θ) = 2, what is the value of sin(2θ)?",
    options: ["1", "1/2", "2", "0"],
    correct_index: 0,
    explanation:
      "tan(θ) + cot(θ) = sin(θ)/cos(θ) + cos(θ)/sin(θ) = (sin²θ + cos²θ)/(sinθ cosθ) = 1/(sinθ cosθ) = 2. Hence 2 sinθ cosθ = 1 => sin(2θ) = 1.",
    difficulty: "medium",
    tags: ["trigonometry", "identities", "double-angle"],
    status: "approved",
    origin: "syllabus",
    is_bookmarked: true,
    created_at: new Date(Date.now() - 7 * 86400000).toISOString(),
  },
  // Physics: Kinematics
  {
    id: "mcq-1",
    subject_id: "sub-1",
    chapter_id: "ch-101",
    source_id: "src-1",
    question:
      "A projectile is launched from ground level at an angle θ with initial velocity v. At the peak of its trajectory, what is its acceleration?",
    options: ["Zero", "g downwards", "g cos(θ) perpendicular to path", "v² / g"],
    correct_index: 1,
    explanation:
      "Throughout the entire trajectory under ideal gravity, the only force acting is gravity, so the acceleration is always g downwards.",
    difficulty: "easy",
    tags: ["kinematics", "projectile-motion"],
    status: "approved",
    origin: "syllabus",
    created_at: new Date(Date.now() - 7 * 86400000).toISOString(),
  },
  {
    id: "mcq-2",
    subject_id: "sub-1",
    chapter_id: "ch-101",
    source_id: "src-1",
    question:
      "Two masses m1 and m2 (m1 > m2) are connected by a light inextensible string over a frictionless pulley. What is the acceleration of the system?",
    options: [
      "(m1 - m2)g / (m1 + m2)",
      "(m1 + m2)g / (m1 - m2)",
      "g / 2",
      "m1 * m2 * g / (m1 + m2)",
    ],
    correct_index: 0,
    explanation:
      "Using Atwood's machine equation: net driving force is (m1 - m2)g, total inertial mass is (m1 + m2), so a = (m1 - m2)g / (m1 + m2).",
    difficulty: "medium",
    tags: ["newton-laws", "atwood-machine"],
    status: "approved",
    origin: "syllabus",
    created_at: new Date(Date.now() - 6 * 86400000).toISOString(),
  },
  {
    id: "mcq-3",
    subject_id: "sub-1",
    chapter_id: "ch-103",
    source_id: null,
    question:
      "According to Lenz's Law, the direction of an induced electromotive force (EMF) is such that it:",
    options: [
      "Assists the change in magnetic flux that produces it",
      "Opposes the change in magnetic flux that produces it",
      "Always creates a clockwise magnetic field",
      "Is directly proportional to the resistance of the loop",
    ],
    correct_index: 1,
    explanation:
      "Lenz's law is a consequence of conservation of energy: the induced current produces a magnetic field that opposes the change in magnetic flux.",
    difficulty: "easy",
    tags: ["electromagnetism", "faraday-law"],
    status: "approved",
    origin: "syllabus",
    created_at: new Date(Date.now() - 5 * 86400000).toISOString(),
  },

  // Chemistry: Organic Mechanisms
  {
    id: "mcq-4",
    subject_id: "sub-2",
    chapter_id: "ch-203",
    source_id: "src-3",
    question:
      "Which of the following conditions most favors an SN2 nucleophilic substitution over an SN1 mechanism?",
    options: [
      "A tertiary alkyl halide in a protic solvent",
      "A primary alkyl halide with a strong, unhindered nucleophile in a polar aprotic solvent",
      "A secondary alkyl halide at elevated temperature with weak nucleophile",
      "A bulky strong base like potassium tert-butoxide",
    ],
    correct_index: 1,
    explanation:
      "SN2 proceeds via backside attack (bimolecular) with no carbocation intermediate. Minimal steric hindrance (primary substrate) and strong nucleophiles in polar aprotic solvents (like DMSO or acetone) optimize SN2 rates.",
    difficulty: "hard",
    tags: ["organic", "sn2", "substitution"],
    status: "approved",
    origin: "syllabus",
    created_at: new Date(Date.now() - 5 * 86400000).toISOString(),
  },
  {
    id: "mcq-5",
    subject_id: "sub-2",
    chapter_id: "ch-202",
    source_id: null,
    question:
      "For a reaction with negative ΔH (exothermic) and positive ΔS (increased entropy), Gibbs free energy change ΔG is:",
    options: [
      "Negative at all temperatures (always spontaneous)",
      "Positive at all temperatures (never spontaneous)",
      "Negative only at low temperatures",
      "Negative only at high temperatures",
    ],
    correct_index: 0,
    explanation:
      "Since ΔG = ΔH - TΔS, with ΔH < 0 and -TΔS < 0 (since T > 0 K and ΔS > 0), ΔG is strictly negative at all temperatures.",
    difficulty: "medium",
    tags: ["thermodynamics", "gibbs-energy"],
    status: "approved",
    origin: "syllabus",
    created_at: new Date(Date.now() - 4 * 86400000).toISOString(),
  },

  // Biology: Cell Biology
  {
    id: "mcq-6",
    subject_id: "sub-3",
    chapter_id: "ch-301",
    source_id: "src-4",
    question: "During which phase of meiosis does crossing over (homologous recombination) occur?",
    options: ["Prophase I (Pachytene)", "Metaphase I", "Anaphase II", "Telophase I"],
    correct_index: 0,
    explanation:
      "Crossing over between non-sister chromatids of homologous chromosomes occurs during Prophase I, specifically during the pachytene sub-stage.",
    difficulty: "easy",
    tags: ["genetics", "meiosis", "cell-division"],
    status: "approved",
    origin: "syllabus",
    created_at: new Date(Date.now() - 4 * 86400000).toISOString(),
  },
  {
    id: "mcq-7",
    subject_id: "sub-3",
    chapter_id: "ch-303",
    source_id: null,
    question:
      "What initiates the depolarization phase of an action potential in a mammalian myelinated axon?",
    options: [
      "Rapid efflux of K+ ions through voltage-gated potassium channels",
      "Rapid influx of Na+ ions through voltage-gated sodium channels",
      "Opening of ligand-gated chloride channels",
      "Inhibition of the Na+/K+ ATPase pump",
    ],
    correct_index: 1,
    explanation:
      "When threshold potential (-55mV) is reached, voltage-gated sodium channels open rapidly, allowing Na+ to rush into the axon down its electrochemical gradient.",
    difficulty: "medium",
    tags: ["neurobiology", "action-potential"],
    status: "approved",
    origin: "syllabus",
    created_at: new Date(Date.now() - 3 * 86400000).toISOString(),
  },

  // Mathematics: Calculus
  {
    id: "mcq-8",
    subject_id: "sub-4",
    chapter_id: "ch-401",
    source_id: "src-5",
    question: "Evaluate the derivative of f(x) = ln(cos(x)) with respect to x:",
    options: ["-tan(x)", "tan(x)", "-cot(x)", "1 / cos(x)"],
    correct_index: 0,
    explanation:
      "By the chain rule, d/dx[ln(u)] = (1/u) * du/dx. Here u = cos(x), du/dx = -sin(x). Thus f'(x) = -sin(x) / cos(x) = -tan(x).",
    difficulty: "medium",
    tags: ["calculus", "derivatives", "chain-rule"],
    status: "approved",
    origin: "syllabus",
    created_at: new Date(Date.now() - 3 * 86400000).toISOString(),
  },
  {
    id: "mcq-9",
    subject_id: "sub-4",
    chapter_id: "ch-402",
    source_id: "src-5",
    question: "What is the value of the definite integral ∫ from 0 to π of sin(x) dx?",
    options: ["0", "1", "2", "π"],
    correct_index: 2,
    explanation:
      "The antiderivative of sin(x) is -cos(x). Evaluated from 0 to π: -cos(π) - (-cos(0)) = -(-1) + 1 = 1 + 1 = 2.",
    difficulty: "easy",
    tags: ["calculus", "integration"],
    status: "approved",
    origin: "syllabus",
    created_at: new Date(Date.now() - 2 * 86400000).toISOString(),
  },

  // Computer Science: Data Structures
  {
    id: "mcq-10",
    subject_id: "sub-5",
    chapter_id: "ch-501",
    source_id: "src-6",
    question:
      "What is the worst-case time complexity of searching for an element in a balanced Binary Search Tree (such as an AVL or Red-Black tree) with n nodes?",
    options: ["O(1)", "O(log n)", "O(n)", "O(n log n)"],
    correct_index: 1,
    explanation:
      "Because self-balancing binary search trees guarantee height h ≤ c * log2(n), search operations take at most O(log n) time in the worst case.",
    difficulty: "easy",
    tags: ["data-structures", "bst", "algorithms"],
    status: "approved",
    origin: "syllabus",
    created_at: new Date(Date.now() - 2 * 86400000).toISOString(),
  },
  {
    id: "mcq-11",
    subject_id: "sub-5",
    chapter_id: "ch-502",
    source_id: "src-6",
    question:
      "Which of the following shortest-path algorithms works correctly on directed graphs with negative edge weights (provided there are no negative cycles)?",
    options: [
      "Dijkstra's algorithm",
      "Bellman-Ford algorithm",
      "Prim's algorithm",
      "Kruskal's algorithm",
    ],
    correct_index: 1,
    explanation:
      "Bellman-Ford relaxes all edges |V|-1 times and accurately computes shortest paths with negative weights, and can detect negative cycles. Dijkstra fails with negative edges.",
    difficulty: "medium",
    tags: ["algorithms", "graphs", "shortest-path"],
    status: "approved",
    origin: "syllabus",
    created_at: new Date(Date.now() - 1 * 86400000).toISOString(),
  },

  // English & Reasoning
  {
    id: "mcq-12",
    subject_id: "sub-6",
    chapter_id: "ch-602",
    source_id: "src-7",
    question:
      "Premise 1: All primates are mammals. Premise 2: Some mammals are nocturnal. Conclusion: Therefore, some primates are nocturnal. What is the logical validity of this deduction?",
    options: [
      "Valid, because primates are mammals",
      "Invalid, due to the fallacy of the undistributed middle",
      "Valid only if nocturnal animals are warm-blooded",
      "Tautological",
    ],
    correct_index: 1,
    explanation:
      "The middle term 'mammals' is not distributed in either premise. The subset of mammals that are nocturnal might not overlap at all with the subset that are primates.",
    difficulty: "hard",
    tags: ["logic", "syllogisms", "deduction"],
    status: "approved",
    origin: "syllabus",
    created_at: new Date(Date.now() - 1 * 86400000).toISOString(),
  },

  // Physics: Work, Energy & Power (ch-102)
  {
    id: "mcq-phy-102-1",
    subject_id: "sub-1",
    chapter_id: "ch-102",
    source_id: "src-102",
    question:
      "A force F = (3x² + 2x) N acts on a particle displacing it from x = 0 m to x = 2 m. What is the total work done by the force?",
    options: ["12 J", "10 J", "8 J", "14 J"],
    correct_index: 0,
    explanation:
      "Work W = ∫ F dx from 0 to 2 = ∫ (3x² + 2x) dx = [x³ + x²] from 0 to 2 = (2³ + 2²) - 0 = 8 + 4 = 12 Joules.",
    difficulty: "medium",
    tags: ["work", "variable-force", "calculus-physics"],
    status: "approved",
    origin: "syllabus",
    created_at: new Date(Date.now() - 6 * 86400000).toISOString(),
  },
  {
    id: "mcq-phy-102-2",
    subject_id: "sub-1",
    chapter_id: "ch-102",
    source_id: "src-102",
    question:
      "If the kinetic energy of a moving body is increased by 300%, by what percentage does its momentum increase?",
    options: ["100%", "200%", "50%", "150%"],
    correct_index: 0,
    explanation:
      "Kinetic energy KE = p² / (2m). If KE becomes 4 * KE (a 300% increase), then p' = √(4) * p = 2p. The momentum increases by (2p - p)/p = 100%.",
    difficulty: "easy",
    tags: ["momentum", "kinetic-energy"],
    status: "approved",
    origin: "syllabus",
    created_at: new Date(Date.now() - 5 * 86400000).toISOString(),
  },

  // Chemistry: Atomic Structure (ch-201)
  {
    id: "mcq-chem-201-1",
    subject_id: "sub-2",
    chapter_id: "ch-201",
    source_id: "src-201",
    question:
      "According to Heisenberg's Uncertainty Principle, what is the product of uncertainty in position (Δx) and uncertainty in momentum (Δp)?",
    options: ["Δx · Δp ≥ ℏ / 2", "Δx · Δp ≥ h", "Δx · Δp = 0", "Δx · Δp ≤ ℏ / 2"],
    correct_index: 0,
    explanation:
      "Heisenberg's principle dictates that Δx · Δp ≥ h / (4π) = ℏ / 2, fundamentally constraining precision in simultaneous measurement.",
    difficulty: "easy",
    tags: ["quantum", "uncertainty", "atomic-structure"],
    status: "approved",
    origin: "syllabus",
    created_at: new Date(Date.now() - 5 * 86400000).toISOString(),
  },

  // Chemistry: Inorganic & Coordination (ch-204)
  {
    id: "mcq-chem-204-1",
    subject_id: "sub-2",
    chapter_id: "ch-204",
    source_id: "src-204",
    question:
      "What is the coordination number and oxidation state of cobalt in the complex [Co(NH3)4Cl2]+?",
    options: [
      "Coordination number = 6, Oxidation state = +3",
      "Coordination number = 4, Oxidation state = +2",
      "Coordination number = 6, Oxidation state = +1",
      "Coordination number = 4, Oxidation state = +3",
    ],
    correct_index: 0,
    explanation:
      "The total number of ligand donor atoms bonded to Co is 4 (from NH3) + 2 (from Cl) = 6. With neutral NH3 and -1 for each Cl, Co + 4(0) + 2(-1) = +1 => Co = +3.",
    difficulty: "medium",
    tags: ["coordination-compounds", "oxidation-state"],
    status: "approved",
    origin: "syllabus",
    created_at: new Date(Date.now() - 4 * 86400000).toISOString(),
  },

  // Biology: Physiology & Circulation (ch-302)
  {
    id: "mcq-bio-302-1",
    subject_id: "sub-3",
    chapter_id: "ch-302",
    source_id: "src-302",
    question:
      "Which natural pacemaker generates the primary electrical impulse regulating the intrinsic heart rhythm in human cardiac tissue?",
    options: [
      "Sinoatrial (SA) node",
      "Atrioventricular (AV) node",
      "Bundle of His",
      "Purkinje fibers",
    ],
    correct_index: 0,
    explanation:
      "The Sinoatrial (SA) node located in the upper wall of the right atrium possesses the highest intrinsic pacing rate (~60-100 bpm) and functions as the primary pacemaker.",
    difficulty: "easy",
    tags: ["physiology", "cardiovascular", "heart"],
    status: "approved",
    origin: "syllabus",
    created_at: new Date(Date.now() - 4 * 86400000).toISOString(),
  },

  // Biology: Ecology & Evolution (ch-304)
  {
    id: "mcq-bio-304-1",
    subject_id: "sub-3",
    chapter_id: "ch-304",
    source_id: "src-4",
    question:
      "In a population in Hardy-Weinberg equilibrium, if allele 'A' frequency p = 0.7, what is the expected frequency of heterozygous (Aa) individuals?",
    options: ["0.42", "0.49", "0.09", "0.21"],
    correct_index: 0,
    explanation:
      "Since p = 0.7, q = 1 - p = 0.3. The frequency of heterozygotes 2pq = 2(0.7)(0.3) = 0.42 (42%).",
    difficulty: "medium",
    tags: ["evolution", "hardy-weinberg", "population-genetics"],
    status: "approved",
    origin: "syllabus",
    created_at: new Date(Date.now() - 3 * 86400000).toISOString(),
  },

  // Mathematics: Vectors & 3D (ch-403)
  {
    id: "mcq-math-403-1",
    subject_id: "sub-4",
    chapter_id: "ch-403",
    source_id: "src-8",
    question:
      "Find the value of λ such that the vectors a = 2i + 3j - k and b = 3i - 2j + λk are orthogonal.",
    options: ["0", "2", "-2", "4"],
    correct_index: 0,
    explanation:
      "Two vectors are orthogonal if their dot product equals 0: a · b = (2)(3) + (3)(-2) + (-1)(λ) = 6 - 6 - λ = 0 => λ = 0.",
    difficulty: "easy",
    tags: ["vectors", "dot-product", "orthogonality"],
    status: "approved",
    origin: "syllabus",
    created_at: new Date(Date.now() - 3 * 86400000).toISOString(),
  },

  // Computer Science: Operating Systems (ch-504)
  {
    id: "mcq-cs-504-1",
    subject_id: "sub-5",
    chapter_id: "ch-504",
    source_id: "src-503",
    question:
      "Which four conditions must hold simultaneously for a resource deadlock to occur in an operating system?",
    options: [
      "Mutual exclusion, Hold and wait, No preemption, Circular wait",
      "Mutual exclusion, Preemption, Starvation, Paging",
      "Concurrency, Context switching, Semaphore lock, Thrashing",
      "Race condition, Critical section, Mutex lock, Aging",
    ],
    correct_index: 0,
    explanation:
      "Coffman conditions for deadlock are: 1) Mutual exclusion, 2) Hold and wait, 3) No preemption, and 4) Circular wait.",
    difficulty: "easy",
    tags: ["operating-systems", "deadlock", "coffman-conditions"],
    status: "approved",
    origin: "syllabus",
    created_at: new Date(Date.now() - 2 * 86400000).toISOString(),
  },

  // English: Grammar & Modifiers (ch-601)
  {
    id: "mcq-eng-601-1",
    subject_id: "sub-6",
    chapter_id: "ch-601",
    source_id: "src-601",
    question:
      "Identify the grammatically correct sentence free of dangling or misplaced modifiers:",
    options: [
      "Walking down the garden path, the roses smelled sweet to Maria.",
      "Walking down the garden path, Maria enjoyed the sweet fragrance of the roses.",
      "Having finished the exam, the papers were collected by the proctor.",
      "To improve his vocabulary, the dictionary was read daily by Ali.",
    ],
    correct_index: 1,
    explanation:
      "The modifier 'Walking down the garden path' must logically modify the subject that performs the action (Maria), not the roses or exam papers.",
    difficulty: "medium",
    tags: ["grammar", "modifiers", "sentence-correction"],
    status: "approved",
    origin: "syllabus",
    created_at: new Date(Date.now() - 2 * 86400000).toISOString(),
  },

  // Pending MCQs for AI Studio review queue
  {
    id: "mcq-pending-1",
    subject_id: "sub-1",
    chapter_id: "ch-104",
    source_id: null,
    question:
      "In the photoelectric effect experiment, increasing the frequency of the incident light above the threshold frequency causes:",
    options: [
      "An increase in the maximum kinetic energy of emitted photoelectrons",
      "An increase in the number of emitted photoelectrons per second",
      "A decrease in stopping potential",
      "No change in emitted electron energy",
    ],
    correct_index: 0,
    explanation:
      "According to Einstein's photoelectric equation KE_max = hf - Φ, increasing frequency f linearly increases the kinetic energy of emitted electrons.",
    difficulty: "medium",
    tags: ["modern-physics", "photoelectric"],
    status: "pending",
    origin: "ai",
    created_at: new Date().toISOString(),
  },
  {
    id: "mcq-pending-2",
    subject_id: "sub-5",
    chapter_id: "ch-503",
    source_id: null,
    question:
      "In relational database transactions, which ACID property guarantees that committed transactions survive subsequent system crashes?",
    options: ["Atomicity", "Consistency", "Isolation", "Durability"],
    correct_index: 3,
    explanation:
      "Durability guarantees that once a transaction has committed, its effects are permanently recorded in non-volatile storage and will survive crashes.",
    difficulty: "easy",
    tags: ["databases", "acid", "transactions"],
    status: "pending",
    origin: "ai",
    created_at: new Date().toISOString(),
  },
  ...URDU_MCQS.map((m, i) => ({
    id: `mcq-urdu-${i + 1}`,
    created_at: new Date(Date.now() - (30 - (i % 25)) * 86400000).toISOString(),
    ...m,
  })),
];

// 0 questions attempted initially
export const INITIAL_ATTEMPTS: {
  id: string;
  is_correct: boolean;
  created_at: string;
  mode: string;
}[] = [];

export const INITIAL_SESSIONS: {
  id: string;
  mode: string;
  total: number;
  correct: number;
  duration_sec: number;
  created_at: string;
  subject_id: string | null;
}[] = [];

export const INITIAL_PLAN_SLOTS: PlanSlot[] = [];

export const INITIAL_EXAMS: Exam[] = [];

export const INITIAL_NOTE_CATEGORIES: NoteCategory[] = [
  { id: "cat-1", name: "Mathematics", color: "accent", position: 0 },
  { id: "cat-2", name: "Physics", color: "emerald", position: 1 },
  { id: "cat-3", name: "English", color: "blue", position: 2 },
  { id: "cat-4", name: "Exam Strategy", color: "amber", position: 3 },
  { id: "cat-5", name: "General", color: "rose", position: 4 },
];

export const INITIAL_NOTES: Note[] = [];

export const INITIAL_REVIEW_SCHEDULES: ReviewSchedule[] = [];

export const INITIAL_REVIEW_EVENTS: ReviewEvent[] = [];

const CURRENT_DATA_VERSION = "v10_real_account_clean";
const DATA_VERSION_KEY = "study_spark_store_version";

if (typeof window !== "undefined") {
  const currentVer = window.localStorage.getItem(DATA_VERSION_KEY);
  if (currentVer !== CURRENT_DATA_VERSION) {
    // Purge legacy demo notes, demo attempts, sessions, and reset profile to real user
    window.localStorage.removeItem(STORAGE_KEYS.NOTES);
    window.localStorage.removeItem(STORAGE_KEYS.PROFILE);
    window.localStorage.removeItem(STORAGE_KEYS.ATTEMPTS);
    window.localStorage.removeItem(STORAGE_KEYS.SESSIONS);
    window.localStorage.removeItem(STORAGE_KEYS.REVIEW_SCHEDULES);
    window.localStorage.removeItem(STORAGE_KEYS.REVIEW_EVENTS);
    window.localStorage.removeItem(STORAGE_KEYS.INCOMPLETE_SESSION);
    window.localStorage.removeItem(STORAGE_KEYS.PLAN_SLOTS);
    window.localStorage.removeItem(STORAGE_KEYS.EXAMS);
    window.localStorage.removeItem(STORAGE_KEYS.EXAM_QUESTIONS);
    window.localStorage.removeItem(STORAGE_KEYS.TOPICS);
    window.localStorage.setItem(DATA_VERSION_KEY, CURRENT_DATA_VERSION);
  }
}

// Helper to safely read from localStorage
function readStorage<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

// Helper to safely write to localStorage
function writeStorage<T>(key: string, value: T): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch (e) {
    console.error(`[LocalStore] Failed to write ${key}:`, e);
  }
}

export const localStore = {
  getProfile: (): Profile => readStorage(STORAGE_KEYS.PROFILE, INITIAL_PROFILE),
  saveProfile: (p: Profile): Profile => {
    writeStorage(STORAGE_KEYS.PROFILE, p);
    return p;
  },
  updateProfile: (patch: Partial<Profile>): Profile => {
    const current = localStore.getProfile();
    const updated = { ...current, ...patch };
    writeStorage(STORAGE_KEYS.PROFILE, updated);
    return updated;
  },

  getSubjects: (): Subject[] => {
    return readStorage(STORAGE_KEYS.SUBJECTS, INITIAL_SUBJECTS);
  },
  saveSubjects: (list: Subject[]) => writeStorage(STORAGE_KEYS.SUBJECTS, list),
  addSubject: (item: Omit<Subject, "id" | "created_at">): Subject => {
    const subjects = localStore.getSubjects();
    const newSubject: Subject = {
      id: "sub-" + Date.now().toString(36),
      created_at: new Date().toISOString(),
      ...item,
    };
    const updated = [...subjects, newSubject];
    localStore.saveSubjects(updated);
    return newSubject;
  },
  updateSubject: (id: string, patch: Partial<Subject>): Subject | null => {
    const subjects = localStore.getSubjects();
    const index = subjects.findIndex((s) => s.id === id);
    if (index === -1) return null;
    const updatedItem = { ...subjects[index], ...patch };
    subjects[index] = updatedItem;
    localStore.saveSubjects(subjects);
    return updatedItem;
  },
  deleteSubject: (id: string): void => {
    const subjects = localStore.getSubjects().filter((s) => s.id !== id);
    localStore.saveSubjects(subjects);
    const affectedChapters = localStore.getChapters().filter((c) => c.subject_id === id);
    const affectedChapterIds = new Set(affectedChapters.map((c) => c.id));
    const remainingChapters = localStore.getChapters().filter((c) => c.subject_id !== id);
    localStore.saveChapters(remainingChapters);
    const remainingTopics = localStore
      .getTopics()
      .filter((t) => !affectedChapterIds.has(t.chapter_id));
    localStore.saveTopics(remainingTopics);
    const remainingSources = localStore
      .getSources()
      .filter((s) => !affectedChapterIds.has(s.chapter_id));
    writeStorage(STORAGE_KEYS.SOURCES, remainingSources);
    const remainingMcqs = localStore
      .getMcqs()
      .filter(
        (m) => m.subject_id !== id && (!m.chapter_id || !affectedChapterIds.has(m.chapter_id)),
      );
    localStore.saveMcqs(remainingMcqs);
    // Notes survive a subject deletion so learners do not lose written work.
    const reassignedNotes = localStore
      .getNotes()
      .map((note) => (note.subject_id === id ? { ...note, subject_id: null } : note));
    localStore.saveNotes(reassignedNotes);
  },

  getChapters: (subjectId?: string): Chapter[] => {
    const chapters = readStorage(STORAGE_KEYS.CHAPTERS, INITIAL_CHAPTERS);
    if (subjectId) return chapters.filter((c) => c.subject_id === subjectId);
    return chapters;
  },
  saveChapters: (list: Chapter[]) => writeStorage(STORAGE_KEYS.CHAPTERS, list),
  addChapter: (item: Omit<Chapter, "id">): Chapter => {
    const chapters = localStore.getChapters();
    const newChapter: Chapter = {
      id: "ch-" + Date.now().toString(36),
      ...item,
    };
    const updated = [...chapters, newChapter];
    localStore.saveChapters(updated);
    return newChapter;
  },
  updateChapter: (id: string, patch: Partial<Chapter>): Chapter | null => {
    const chapters = localStore.getChapters();
    const index = chapters.findIndex((c) => c.id === id);
    if (index === -1) return null;
    const updatedItem = { ...chapters[index], ...patch };
    chapters[index] = updatedItem;
    localStore.saveChapters(chapters);
    return updatedItem;
  },
  deleteChapter: (id: string): void => {
    const chapters = localStore.getChapters().filter((c) => c.id !== id);
    localStore.saveChapters(chapters);
    const topics = localStore.getTopics().filter((t) => t.chapter_id !== id);
    localStore.saveTopics(topics);
    const remainingSources = localStore.getSources().filter((s) => s.chapter_id !== id);
    writeStorage(STORAGE_KEYS.SOURCES, remainingSources);
    const remainingMcqs = localStore.getMcqs().filter((m) => m.chapter_id !== id);
    localStore.saveMcqs(remainingMcqs);
  },

  getTopics: (chapterId?: string): Topic[] => {
    const topics = readStorage(STORAGE_KEYS.TOPICS, INITIAL_TOPICS);
    const normalized = topics.map((t) => ({
      ...t,
      status:
        t.status ||
        (t.completion === "completed"
          ? "done"
          : t.completion === "in_progress"
            ? "studying"
            : "not_studied"),
      completion:
        t.completion ||
        (t.status === "done"
          ? "completed"
          : t.status === "studying"
            ? "in_progress"
            : "not_started"),
      confidence: t.confidence || "medium",
      priority: t.priority || "med",
      due_at: t.due_at || t.due_review_at || new Date().toISOString(),
      due_review_at: t.due_review_at || t.due_at || new Date().toISOString(),
      interval_days: t.interval_days ?? 1,
      ease_factor: t.ease_factor ?? 2.5,
      repetitions: t.repetitions ?? 0,
    }));
    if (chapterId) return normalized.filter((t) => t.chapter_id === chapterId);
    return normalized;
  },
  saveTopics: (list: Topic[]) => writeStorage(STORAGE_KEYS.TOPICS, list),
  addTopic: (item: Omit<Topic, "id">): Topic => {
    const topics = localStore.getTopics();
    const nowIso = new Date().toISOString();
    const newTopic: Topic = {
      id: "top-" + Date.now().toString(36),
      status: "not_studied",
      completion: "not_started",
      confidence: "medium",
      priority: "med",
      last_studied_at: null,
      last_drilled_at: null,
      due_at: nowIso,
      due_review_at: nowIso,
      interval_days: 1,
      ease_factor: 2.5,
      repetitions: 0,
      created_at: nowIso,
      ...item,
    };
    const updated = [...topics, newTopic];
    localStore.saveTopics(updated);
    return newTopic;
  },
  updateTopic: (id: string, patch: Partial<Topic>): Topic | null => {
    const topics = localStore.getTopics();
    const index = topics.findIndex((t) => t.id === id);
    if (index === -1) return null;
    const updatedItem = { ...topics[index], ...patch };
    // Synchronize legacy and new status fields
    if (patch.status) {
      updatedItem.completion =
        patch.status === "done"
          ? "completed"
          : patch.status === "studying"
            ? "in_progress"
            : "not_started";
    } else if (patch.completion) {
      updatedItem.status =
        patch.completion === "completed"
          ? "done"
          : patch.completion === "in_progress"
            ? "studying"
            : "not_studied";
    }
    if (patch.due_at) {
      updatedItem.due_review_at = patch.due_at;
    }
    topics[index] = updatedItem;
    localStore.saveTopics(topics);
    return updatedItem;
  },
  deleteTopic: (id: string): void => {
    const topics = localStore.getTopics().filter((t) => t.id !== id);
    localStore.saveTopics(topics);
  },
  updateTopicSM2: (topicId: string, accuracyPercent: number): Topic | null => {
    const topics = localStore.getTopics();
    const topicIndex = topics.findIndex((t) => t.id === topicId);
    if (topicIndex === -1) return null;

    const topic = topics[topicIndex];
    const quality = accuracyToSM2Quality(accuracyPercent);
    const sm2Result = calculateSM2(
      quality,
      topic.interval_days || 1,
      topic.ease_factor || 2.5,
      topic.repetitions || 0,
    );

    const newConfidence = accuracyPercent >= 80 ? "high" : accuracyPercent >= 50 ? "medium" : "low";
    const newStatus =
      accuracyPercent >= 90
        ? "done"
        : accuracyPercent > 0
          ? "studying"
          : topic.status || "not_studied";

    const updated: Topic = {
      ...topic,
      status: newStatus,
      completion: newStatus === "done" ? "completed" : "in_progress",
      confidence: newConfidence,
      due_at: sm2Result.dueAt,
      due_review_at: sm2Result.dueAt,
      interval_days: sm2Result.intervalDays,
      ease_factor: sm2Result.easeFactor,
      repetitions: sm2Result.repetitions,
      last_drilled_at: new Date().toISOString(),
      last_studied_at: new Date().toISOString(),
    };

    topics[topicIndex] = updated;
    localStore.saveTopics(topics);
    return updated;
  },
  autoMigrateTagsToTopicsAndLinkMcqs: (): { topicsAdded: number; mcqsLinked: number } => {
    const topics = localStore.getTopics();
    const mcqs = localStore.getMcqs();
    let topicsAdded = 0;
    let mcqsLinked = 0;

    const topicMapByChapterAndName = new Map<string, Topic>();
    topics.forEach((t) => {
      topicMapByChapterAndName.set(`${t.chapter_id}::${t.name.toLowerCase().trim()}`, t);
    });

    // 1. Scan MCQs per chapter and collect tags
    const chapterMcqs = new Map<string, Mcq[]>();
    mcqs.forEach((m) => {
      if (!m.chapter_id) return;
      const list = chapterMcqs.get(m.chapter_id) || [];
      list.push(m);
      chapterMcqs.set(m.chapter_id, list);
    });

    chapterMcqs.forEach((mList, chapterId) => {
      const tagSet = new Set<string>();
      mList.forEach((m) => {
        (m.tags || []).forEach((tag) => {
          if (tag && tag.trim().length > 1) {
            tagSet.add(tag.trim());
          }
        });
      });

      tagSet.forEach((tagName) => {
        const formattedName = tagName
          .split("-")
          .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
          .join(" ");

        const key = `${chapterId}::${formattedName.toLowerCase()}`;
        if (!topicMapByChapterAndName.has(key)) {
          const nowIso = new Date().toISOString();
          const newTopic: Topic = {
            id: "top-migrated-" + Math.random().toString(36).slice(2, 9),
            chapter_id: chapterId,
            name: formattedName,
            status: "not_studied",
            completion: "not_started",
            confidence: "medium",
            priority: "med",
            due_at: nowIso,
            due_review_at: nowIso,
            interval_days: 1,
            ease_factor: 2.5,
            repetitions: 0,
            created_at: nowIso,
            tags: [tagName],
          };
          topics.push(newTopic);
          topicMapByChapterAndName.set(key, newTopic);
          topicsAdded++;
        }
      });
    });

    // 2. Link MCQs to their matching Topic row via topic_id if null
    mcqs.forEach((m) => {
      if (!m.chapter_id) return;
      if (m.topic_id) return;

      const mTags = m.tags || [];
      for (const tag of mTags) {
        const formattedName = tag
          .split("-")
          .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
          .join(" ");
        const key = `${m.chapter_id}::${formattedName.toLowerCase()}`;
        const foundTopic = topicMapByChapterAndName.get(key);
        if (foundTopic) {
          m.topic_id = foundTopic.id;
          mcqsLinked++;
          break;
        }
      }
    });

    if (topicsAdded > 0) {
      localStore.saveTopics(topics);
    }
    if (mcqsLinked > 0) {
      localStore.saveMcqs(mcqs);
    }

    return { topicsAdded, mcqsLinked };
  },

  getIncompleteSession: (): {
    id: string;
    type: "practice" | "exam" | "notes";
    title: string;
    subtitle: string;
    currentIdx: number;
    total: number;
    subjectId?: string;
    chapterId?: string;
    savedState?: Record<string, unknown>;
    updatedAt: string;
  } | null => {
    return readStorage(STORAGE_KEYS.INCOMPLETE_SESSION, {
      id: "sess-resume-1",
      type: "practice" as const,
      title: "Algebra & Vieta Drills",
      subtitle: "Mathematics · 4 of 10 questions answered",
      currentIdx: 4,
      total: 10,
      subjectId: "sub-4",
      chapterId: "ch-400",
      updatedAt: new Date(Date.now() - 45 * 60000).toISOString(),
    });
  },
  saveIncompleteSession: (
    session: {
      id: string;
      type: "practice" | "exam" | "notes";
      title: string;
      subtitle: string;
      currentIdx: number;
      total: number;
      subjectId?: string;
      chapterId?: string;
      savedState?: Record<string, unknown>;
      updatedAt: string;
    } | null,
  ) => {
    writeStorage(STORAGE_KEYS.INCOMPLETE_SESSION, session);
  },
  clearIncompleteSession: () => {
    if (typeof window !== "undefined") {
      window.localStorage.removeItem(STORAGE_KEYS.INCOMPLETE_SESSION);
    }
  },

  getSources: (chapterIds?: string[]): Source[] => {
    const sources = readStorage(STORAGE_KEYS.SOURCES, INITIAL_SOURCES);
    if (chapterIds && chapterIds.length > 0) {
      return sources.filter((s) => chapterIds.includes(s.chapter_id));
    }
    return sources;
  },
  addSource: (item: Omit<Source, "id">): Source => {
    const sources = readStorage(STORAGE_KEYS.SOURCES, INITIAL_SOURCES);
    const newSource: Source = {
      id: "src-" + Date.now().toString(36),
      ...item,
    };
    const updated = [...sources, newSource];
    writeStorage(STORAGE_KEYS.SOURCES, updated);
    return newSource;
  },
  deleteSource: (id: string): void => {
    const sources = localStore.getSources().filter((s) => s.id !== id);
    writeStorage(STORAGE_KEYS.SOURCES, sources);
  },
  updateSource: (id: string, patch: Partial<Source>): Source | null => {
    const sources = localStore.getSources();
    const index = sources.findIndex((s) => s.id === id);
    if (index === -1) return null;
    const updated = { ...sources[index], ...patch };
    sources[index] = updated;
    writeStorage(STORAGE_KEYS.SOURCES, sources);
    return updated;
  },

  getMcqs: (filters?: {
    status?: string;
    subjectId?: string;
    chapterId?: string;
    sourceId?: string;
  }): Mcq[] => {
    let list = readStorage(STORAGE_KEYS.MCQS, INITIAL_MCQS);
    if (!list || !Array.isArray(list) || list.length === 0) {
      list = INITIAL_MCQS;
    }
    // Deduplicate by ID to prevent duplicate React keys
    const seenIds = new Set<string>();
    const uniqueList: Mcq[] = [];
    for (const item of list) {
      if (item && item.id && !seenIds.has(item.id)) {
        seenIds.add(item.id);
        uniqueList.push(item);
      }
    }
    list = uniqueList;

    if (filters?.status && filters.status !== "all")
      list = list.filter((m) => m.status === filters.status);
    if (filters?.subjectId && filters.subjectId !== "all")
      list = list.filter((m) => m.subject_id === filters.subjectId);
    if (filters?.chapterId && filters.chapterId !== "all")
      list = list.filter((m) => m.chapter_id === filters.chapterId);
    if (filters?.sourceId && filters.sourceId !== "all")
      list = list.filter((m) => m.source_id === filters.sourceId);
    return list;
  },
  saveMcqs: (list: Mcq[]) => {
    const seenIds = new Set<string>();
    const uniqueList: Mcq[] = [];
    for (const item of list) {
      if (item && item.id && !seenIds.has(item.id)) {
        seenIds.add(item.id);
        uniqueList.push(item);
      }
    }
    writeStorage(STORAGE_KEYS.MCQS, uniqueList);
  },
  addMcq: (newRow: Omit<Mcq, "id" | "created_at"> & { id?: string }): Mcq => {
    const current = localStore.getMcqs();
    const created: Mcq = {
      id:
        newRow.id ||
        "mcq-" + Date.now().toString(36) + "-" + Math.random().toString(36).substring(2, 8),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      ...newRow,
    };
    const updated = [created, ...current.filter((m) => m.id !== created.id)];
    localStore.saveMcqs(updated);
    return created;
  },
  addMcqs: (newRows: (Omit<Mcq, "id" | "created_at"> & { id?: string })[]): Mcq[] => {
    const current = localStore.getMcqs();
    const created = newRows.map((r, i) => ({
      id:
        r.id ||
        "mcq-" +
          Date.now().toString(36) +
          "-" +
          Math.random().toString(36).substring(2, 8) +
          "-" +
          i,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      ...r,
    }));
    const newIds = new Set(created.map((c) => c.id));
    const updated = [...created, ...current.filter((m) => !newIds.has(m.id))];
    localStore.saveMcqs(updated);
    return created;
  },
  updateMcq: (id: string, patch: Partial<Mcq>): Mcq | null => {
    const list = localStore.getMcqs();
    const index = list.findIndex((m) => m.id === id);
    if (index === -1) return null;
    const updatedItem: Mcq = {
      ...list[index],
      ...patch,
      updated_at: new Date().toISOString(),
    };
    list[index] = updatedItem;
    localStore.saveMcqs(list);
    return updatedItem;
  },
  deleteMcq: (id: string): void => {
    const list = localStore.getMcqs().filter((m) => m.id !== id);
    localStore.saveMcqs(list);
  },
  duplicateMcq: (id: string): Mcq | null => {
    const original = localStore.getMcqs().find((m) => m.id === id);
    if (!original) return null;
    const copy: Mcq = {
      ...original,
      id:
        "mcq-" +
        Date.now().toString(36) +
        "-" +
        Math.random().toString(36).substring(2, 8) +
        "-copy",
      question: `${original.question} (Copy)`,
      status: "draft",
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    const updated = [copy, ...localStore.getMcqs()];
    localStore.saveMcqs(updated);
    return copy;
  },

  getAttempts: () => readStorage(STORAGE_KEYS.ATTEMPTS, INITIAL_ATTEMPTS),
  addAttempt: (item: { is_correct: boolean; mode: string }) => {
    const attempts = readStorage(STORAGE_KEYS.ATTEMPTS, INITIAL_ATTEMPTS);
    const newAttempt = {
      id: "att-" + Date.now().toString(36),
      created_at: new Date().toISOString(),
      ...item,
    };
    const updated = [newAttempt, ...attempts];
    writeStorage(STORAGE_KEYS.ATTEMPTS, updated);
    return newAttempt;
  },

  getSessions: () => readStorage(STORAGE_KEYS.SESSIONS, INITIAL_SESSIONS),
  addSession: (item: {
    mode: string;
    total: number;
    correct: number;
    duration_sec: number;
    subject_id: string | null;
  }) => {
    const sessions = readStorage(STORAGE_KEYS.SESSIONS, INITIAL_SESSIONS);
    const newSession = {
      id: "sess-" + Date.now().toString(36),
      created_at: new Date().toISOString(),
      ...item,
    };
    const updated = [newSession, ...sessions];
    writeStorage(STORAGE_KEYS.SESSIONS, updated);
    return newSession;
  },

  getPlanSlots: (): PlanSlot[] => readStorage(STORAGE_KEYS.PLAN_SLOTS, INITIAL_PLAN_SLOTS),
  savePlanSlots: (list: PlanSlot[]) => writeStorage(STORAGE_KEYS.PLAN_SLOTS, list),
  addPlanSlot: (item: Omit<PlanSlot, "id">): PlanSlot => {
    const slots = localStore.getPlanSlots();
    const newSlot: PlanSlot = {
      id: "ps-" + Date.now().toString(36),
      ...item,
    };
    const updated = [...slots, newSlot];
    localStore.savePlanSlots(updated);
    return newSlot;
  },
  updatePlanSlot: (id: string, patch: Partial<PlanSlot>): PlanSlot | null => {
    const slots = localStore.getPlanSlots();
    const index = slots.findIndex((s) => s.id === id);
    if (index === -1) return null;
    const updatedItem = { ...slots[index], ...patch };
    slots[index] = updatedItem;
    localStore.savePlanSlots(slots);
    return updatedItem;
  },
  deletePlanSlot: (id: string): void => {
    const slots = localStore.getPlanSlots().filter((s) => s.id !== id);
    localStore.savePlanSlots(slots);
  },

  getExams: (): Exam[] => readStorage(STORAGE_KEYS.EXAMS, INITIAL_EXAMS),
  saveExams: (list: Exam[]) => writeStorage(STORAGE_KEYS.EXAMS, list),
  addExam: (item: Omit<Exam, "id" | "created_at">): Exam => {
    const exams = localStore.getExams();
    const newExam: Exam = {
      id: "exam-" + Date.now().toString(36),
      created_at: new Date().toISOString(),
      ...item,
    };
    const updated = [...exams, newExam];
    localStore.saveExams(updated);
    return newExam;
  },
  deleteExam: (id: string): void => {
    const exams = localStore.getExams().filter((e) => e.id !== id);
    localStore.saveExams(exams);
  },

  getExamQuestions: (): ExamQuestion[] => readStorage(STORAGE_KEYS.EXAM_QUESTIONS, []),
  saveExamQuestions: (list: ExamQuestion[]) => writeStorage(STORAGE_KEYS.EXAM_QUESTIONS, list),
  addExamQuestion: (item: Omit<ExamQuestion, "id">): ExamQuestion => {
    const row: ExamQuestion = { id: "eq-" + Date.now().toString(36), ...item };
    localStore.saveExamQuestions([...localStore.getExamQuestions(), row]);
    return row;
  },

  getNoteCategories: (): NoteCategory[] =>
    readStorage(STORAGE_KEYS.NOTE_CATEGORIES, INITIAL_NOTE_CATEGORIES),
  saveNoteCategories: (list: NoteCategory[]) => writeStorage(STORAGE_KEYS.NOTE_CATEGORIES, list),
  addNoteCategory: (item: Omit<NoteCategory, "id">): NoteCategory => {
    const list = localStore.getNoteCategories();
    const newCat: NoteCategory = {
      id: "cat-" + Date.now().toString(36),
      ...item,
    };
    localStore.saveNoteCategories([...list, newCat]);
    return newCat;
  },
  deleteNoteCategory: (id: string): void => {
    const list = localStore.getNoteCategories().filter((c) => c.id !== id);
    localStore.saveNoteCategories(list);
  },

  getNotes: (): Note[] => readStorage(STORAGE_KEYS.NOTES, INITIAL_NOTES),
  saveNotes: (list: Note[]) => writeStorage(STORAGE_KEYS.NOTES, list),
  addNote: (item: Partial<Note>): Note => {
    const list = localStore.getNotes();
    const now = new Date().toISOString();
    const newNote: Note = {
      id: "note-" + Date.now().toString(36),
      title: item.title || "Untitled Note",
      plain_text_content: item.plain_text_content || "",
      subject_id: item.subject_id ?? null,
      chapter_id: item.chapter_id ?? null,
      category_id: item.category_id ?? null,
      is_pinned: !!item.is_pinned,
      is_archived: !!item.is_archived,
      word_count: item.word_count || 0,
      created_at: now,
      updated_at: now,
      last_opened_at: now,
      linked_mcq_ids: item.linked_mcq_ids || [],
    };
    localStore.saveNotes([newNote, ...list]);
    return newNote;
  },
  updateNote: (id: string, patch: Partial<Note>): Note | null => {
    const list = localStore.getNotes();
    const index = list.findIndex((n) => n.id === id);
    if (index === -1) return null;
    const updated = {
      ...list[index],
      ...patch,
      updated_at: new Date().toISOString(),
    };
    list[index] = updated;
    localStore.saveNotes(list);
    return updated;
  },
  deleteNote: (id: string): void => {
    const list = localStore.getNotes().filter((n) => n.id !== id);
    localStore.saveNotes(list);
  },

  getReviewSchedules: (): ReviewSchedule[] =>
    readStorage(STORAGE_KEYS.REVIEW_SCHEDULES, INITIAL_REVIEW_SCHEDULES),
  saveReviewSchedules: (list: ReviewSchedule[]) =>
    writeStorage(STORAGE_KEYS.REVIEW_SCHEDULES, list),
  addReviewSchedule: (item: Omit<ReviewSchedule, "id">): ReviewSchedule => {
    const list = localStore.getReviewSchedules();
    const newSchedule: ReviewSchedule = {
      id: "rev-" + Date.now().toString(36),
      ...item,
    };
    localStore.saveReviewSchedules([...list, newSchedule]);
    return newSchedule;
  },
  updateReviewSchedule: (id: string, patch: Partial<ReviewSchedule>): ReviewSchedule | null => {
    const list = localStore.getReviewSchedules();
    const index = list.findIndex((r) => r.id === id);
    if (index === -1) return null;
    const updated = {
      ...list[index],
      ...patch,
      updated_at: new Date().toISOString(),
    };
    list[index] = updated;
    localStore.saveReviewSchedules(list);
    return updated;
  },
  deleteReviewSchedule: (id: string): void => {
    const list = localStore.getReviewSchedules().filter((r) => r.id !== id);
    localStore.saveReviewSchedules(list);
  },

  getReviewEvents: (): ReviewEvent[] =>
    readStorage(STORAGE_KEYS.REVIEW_EVENTS, INITIAL_REVIEW_EVENTS),
  saveReviewEvents: (list: ReviewEvent[]) => writeStorage(STORAGE_KEYS.REVIEW_EVENTS, list),
  addReviewEvent: (item: Omit<ReviewEvent, "id">): ReviewEvent => {
    const list = localStore.getReviewEvents();
    const newEvent: ReviewEvent = {
      id: "rev-evt-" + Date.now().toString(36),
      ...item,
    };
    localStore.saveReviewEvents([newEvent, ...list]);
    return newEvent;
  },

  /** Exports all user-authored and app data to a standalone JSON payload */
  exportAllData: (): string => {
    const backup = {
      version: 1,
      exportedAt: new Date().toISOString(),
      profile: localStore.getProfile(),
      subjects: localStore.getSubjects(),
      chapters: localStore.getChapters(),
      topics: localStore.getTopics(),
      sources: localStore.getSources(),
      mcqs: localStore.getMcqs(),
      attempts: localStore.getAttempts(),
      sessions: localStore.getSessions(),
      planSlots: localStore.getPlanSlots(),
      exams: localStore.getExams(),
      notes: localStore.getNotes(),
      noteCategories: localStore.getNoteCategories(),
      reviewSchedules: localStore.getReviewSchedules(),
      reviewEvents: localStore.getReviewEvents(),
    };
    return JSON.stringify(backup, null, 2);
  },

  /** Imports and replaces local data from a validated JSON backup */
  importAllData: (jsonStr: string): boolean => {
    try {
      const data = JSON.parse(jsonStr);
      if (!data || typeof data !== "object") return false;

      if (data.profile) localStore.saveProfile(data.profile);
      if (Array.isArray(data.subjects)) localStore.saveSubjects(data.subjects);
      if (Array.isArray(data.chapters)) localStore.saveChapters(data.chapters);
      if (Array.isArray(data.topics)) localStore.saveTopics(data.topics);
      if (Array.isArray(data.sources)) localStore.saveSources(data.sources);
      if (Array.isArray(data.mcqs)) localStore.saveMcqs(data.mcqs);
      if (Array.isArray(data.attempts)) localStore.saveAttempts(data.attempts);
      if (Array.isArray(data.sessions)) localStore.saveSessions(data.sessions);
      if (Array.isArray(data.planSlots)) localStore.savePlanSlots(data.planSlots);
      if (Array.isArray(data.exams)) localStore.saveExams(data.exams);
      if (Array.isArray(data.notes)) localStore.saveNotes(data.notes);
      if (Array.isArray(data.noteCategories)) localStore.saveNoteCategories(data.noteCategories);
      if (Array.isArray(data.reviewSchedules)) localStore.saveReviewSchedules(data.reviewSchedules);
      if (Array.isArray(data.reviewEvents)) localStore.saveReviewEvents(data.reviewEvents);
      return true;
    } catch (e) {
      console.error("[localStore] Import error:", e);
      return false;
    }
  },

  /** Resets all collections back to clean factory initial data */
  resetAllData: (): void => {
    if (typeof window === "undefined") return;
    Object.values(STORAGE_KEYS).forEach((key) => {
      window.localStorage.removeItem(key);
    });
  },
};
