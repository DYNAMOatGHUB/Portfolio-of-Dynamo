// Single source of truth for portfolio content. Sourced from the October 2026 resume,
// github.com/DYNAMOatGHUB, github.com/LLM-project-Team and huggingface.co/DYNAMOatHUGGINGFACE.

export const PROFILE = {
  name: 'Dhyanesh Mahendiran',
  first: 'Dhyanesh',
  last: 'Mahendiran',
  role: 'AI Engineer',
  location: 'Coimbatore, India',
  college: 'Sri Shakthi Institute of Engineering & Technology',
  degree: 'B.Tech Artificial Intelligence & Data Science, 2024 - 2028',
  email: 'dhyanshm23@gmail.com',
  github: 'https://github.com/DYNAMOatGHUB',
  linkedin: 'https://www.linkedin.com/in/dhyaneshmahendiran272307/',
  linkedinHandle: '/in/dhyaneshmahendiran272307',
  leetcode: 'https://leetcode.com/u/Dhyanesh_M_07/',
  huggingface: 'https://huggingface.co/DYNAMOatHUGGINGFACE',
  resume: '/resume.pdf',
  statement:
    'I build AI that runs where the data already lives: a laptop CPU, an 8B model on a local GPU, a webcam feed. Most of my projects start with a model that is almost good enough and end with the unglamorous parts that make it trustworthy: which page the answer came from, whether a tool call is safe to run, and whether that rep actually counted.',
};

export type Metric = { value: string; label: string };

export type Flagship = {
  slug: 'pdf-knowledge' | 'slmrouter' | 'posefit';
  path: string;
  index: string;
  name: string;
  kicker: string;
  tagline: string;
  summary: string;
  role: string;
  stack: string[];
  metrics: Metric[];
  repo: string;
  live?: string;
  accent: string;
  bg: string;
  fg: string;
  /** Light-background theme: switches hairlines and muted text to dark variants. */
  light?: boolean;
  /** Muted text colour on a light theme. */
  muted?: string;
};

export const FLAGSHIPS: Flagship[] = [
  {
    slug: 'pdf-knowledge',
    path: '/pdf-knowledge',
    index: '01',
    name: 'PDF Knowledge',
    kicker: 'Hybrid-search RAG over your PDFs',
    tagline: 'Ask a PDF. Get the page, not a guess.',
    summary:
      'Drop in any PDF, scanned or not, and query it by meaning. Pages are parsed with PyMuPDF (Tesseract when there is no text layer), split into overlapping chunks, embedded with BGE on OpenVINO and stored in ChromaDB. BM25 keyword scores are blended with vector similarity, and when nothing clears the bar it says so instead of making something up.',
    role: 'Lead Developer: retrieval pipeline, hybrid search, deployment',
    stack: ['Python', 'FastAPI', 'LangChain', 'ChromaDB', 'BGE-small', 'OpenVINO', 'PyMuPDF', 'Tesseract', 'Docker'],
    metrics: [
      { value: 'BM25+', label: 'dense hybrid retrieval' },
      { value: '30', label: 'word chunk overlap' },
      { value: '0', label: 'external API calls' },
    ],
    repo: 'https://huggingface.co/spaces/DYNAMOatHUGGINGFACE/pdf-knowledge-tool/tree/main',
    live: 'https://dynamoathuggingface-pdf-knowledge-tool.hf.space/',
    accent: '#F2D04B',
    bg: '#0E0E10',
    fg: '#EFEDE6',
  },
  {
    slug: 'slmrouter',
    path: '/slmrouter',
    index: '02',
    name: 'SLMRouter',
    kicker: 'Reliable tool calling for small local LLMs',
    tagline: 'An 8B model that calls the right function, once.',
    summary:
      'SLMRouter is a zero-dependency Python library that lets a 7B or 8B model on Ollama or llama.cpp call your Python functions. Instead of asking a small model to write JSON and fix its own mistakes, it treats the model as a deterministic router: one short prompt, one line back, parsed and type-checked in code. A query makes at most 1 + max_repairs model calls, so a retry loop cannot run away.',
    role: 'Lead Developer in a team of four: orchestrator, simulator and evaluation, CLI and release',
    stack: ['Python 3.10+', 'stdlib only', 'Ollama', 'llama.cpp', 'Llama 3 8B', 'Mistral 7B', 'GitHub Actions', 'PyPI'],
    metrics: [
      { value: '50/50', label: 'tool + argument picks' },
      { value: '795', label: 'injected faults' },
      { value: '0.003', label: 'ms p99 parse time' },
    ],
    repo: 'https://github.com/DYNAMOatGHUB/SLM-Router',
    live: 'https://pypi.org/project/slmrouter/',
    accent: '#C2410C',
    bg: '#ECE8DF',
    fg: '#1B1814',
    light: true,
    muted: '#5E574D',
  },
  {
    slug: 'posefit',
    path: '/posefit',
    index: '03',
    name: 'POSE_FIT',
    kicker: 'Computer-vision fitness tracker',
    tagline: 'A rep counter that knows a half-squat when it sees one.',
    summary:
      'Built for Smart India Hackathon 2025, where it made the finals. A webcam recognises who stepped up, MediaPipe tracks 33 body landmarks, and joint angles at the knee, hip and torso decide whether a rep counts and how well it was done. Sessions go to MongoDB and sync to a Firebase-backed Vite dashboard.',
    role: 'Machine Learning Engineer: pose engine, scoring, data pipeline',
    stack: ['Python', 'OpenCV', 'MediaPipe', 'face-api.js', 'JavaScript', 'Vite', 'MongoDB', 'Firebase'],
    metrics: [
      { value: '33', label: 'tracked landmarks' },
      { value: '3', label: 'joint angles per frame' },
      { value: 'SIH', label: '2025 finalist' },
    ],
    repo: 'https://github.com/DYNAMOatGHUB/POSE_FIT',
    live: 'https://dynamoatghub.github.io/POSE_FIT/',
    accent: '#B8F23A',
    bg: '#0B0F0C',
    fg: '#ECF3EC',
  },
];

export const flagshipBySlug = (slug: Flagship['slug']) => FLAGSHIPS.find((f) => f.slug === slug)!;

export type WorkKind = 'LLM' | 'Vision' | 'ML' | 'Web';

export type Work = {
  name: string;
  kind: WorkKind;
  blurb: string;
  stack: string[];
  year: string;
  href: string;
  org?: string;
  route?: string;
};

const GH = 'https://github.com/DYNAMOatGHUB';

export const WORKS: Work[] = [
  { name: 'PDF Knowledge', kind: 'LLM', route: '/pdf-knowledge', year: '2026',
    blurb: 'RAG over uploaded PDFs with OCR fallback, BM25 + vector hybrid retrieval and a refusal when the document does not hold the answer.',
    stack: ['FastAPI', 'ChromaDB', 'OpenVINO'], href: 'https://dynamoathuggingface-pdf-knowledge-tool.hf.space/' },
  { name: 'SLMRouter', kind: 'LLM', route: '/slmrouter', year: '2026',
    blurb: 'Zero-dependency Python library that lets a local 7B/8B model call your functions reliably. One bounded decision per query; 50/50 correct picks on Llama 3 8B and Mistral 7B.',
    stack: ['Python stdlib', 'Ollama', 'llama.cpp'], href: 'https://github.com/DYNAMOatGHUB/SLM-Router' },
  { name: 'POSE_FIT', kind: 'Vision', route: '/posefit', year: '2025',
    blurb: 'Face-identified, pose-scored squat tracker. Smart India Hackathon 2025 finalist.',
    stack: ['OpenCV', 'MediaPipe', 'Firebase'], href: `${GH}/POSE_FIT` },
  { name: 'CLARA.AI', kind: 'LLM', org: 'LLM-project-Team', year: '2026',
    blurb: 'Academic admin platform: circulars drafted by a local Llama, mark-sheet PDFs parsed into PostgreSQL, and a chat bar that answers with a table, a chart or a paragraph.',
    stack: ['Django', 'PostgreSQL', 'Ollama'], href: 'https://github.com/LLM-project-Team/CLARA.AI' },
  { name: 'Business Entity Resolution', kind: 'ML', year: '2026',
    blurb: 'Amazon ML Challenge 2026 entry: five blockers, pair features, LightGBM plus a cross-encoder, tuned for macro F0.5.',
    stack: ['LightGBM', 'FAISS', 'MiniLM'], href: `${GH}/Business_Entity_Resolution` },
  { name: 'Civic Pulse', kind: 'Web', year: '2026',
    blurb: 'Citizens drop a pin, Gemini reads the text and the photo, and ward officers get a ranked, de-duplicated queue instead of 50 WhatsApp messages.',
    stack: ['JavaScript', 'Gemini', 'Maps'], href: 'https://civic-pulse-frontend-gamma.vercel.app' },
  { name: 'Medical Prescription Analyzer', kind: 'Vision', year: '2026',
    blurb: 'Reads handwritten prescriptions with a local Qwen2.5-VL and returns medicine, dosage, frequency and duration as JSON.',
    stack: ['Qwen2.5-VL', 'FastAPI', 'Streamlit'], href: `${GH}/Medical-Prescription-Analyzer` },
  { name: 'TraceFace-Web3', kind: 'Vision', year: '2026',
    blurb: 'Face crop, reverse image search, then a SHA-256 of what was found written to a local Ethereum chain. Built for HH Goa 2026.',
    stack: ['dlib', 'FastAPI', 'Hardhat'], href: `${GH}/TraceFace-Web3` },
  { name: 'Voice RAG (Tamil)', kind: 'LLM', year: '2026',
    blurb: 'Speak a question in Tamil, get a grounded JSON answer over MS MARCO passages, with relevance and groundedness gates and per-stage timings.',
    stack: ['LangGraph', 'Qdrant', 'Sarvam STT'], href: `${GH}/Voice_RAG` },
  { name: 'Dayflow HRMS', kind: 'Web', year: '2026',
    blurb: 'Odoo hackathon HRMS: attendance, leave and payroll, where an approved unpaid leave automatically lands as a payroll deduction.',
    stack: ['React 19', 'PostgreSQL', 'Cron'], href: 'https://dayflow-hrms-pi.vercel.app' },
  { name: 'ExamGuard AI', kind: 'Vision', year: '2026',
    blurb: 'Watches CCTV feeds in an exam hall with YOLOv11, pose and an LSTM, and emails the invigilator evidence when confidence is high.',
    stack: ['YOLOv11', 'Celery', 'Django'], href: `${GH}/Realtime-Exam-Malpractice-Detection` },
  { name: 'BoardSYNC', kind: 'Vision', year: '2026',
    blurb: 'Turns a lecture recording into a teaching report: SSIM-stable board frames read by a VLM, Whisper transcripts, and an Android capture app.',
    stack: ['Qwen2.5-VL', 'Whisper', 'Kotlin'], href: `${GH}/BoardSYNC` },
  { name: 'EduHelm', kind: 'Web', year: '2025',
    blurb: 'Django learning platform with courses, mentors, study tracking, groups and leaderboards.',
    stack: ['Django', 'MongoDB'], href: `${GH}/EduHelm.2025` },
];

export const STATS: Metric[] = [
  { value: String(WORKS.length), label: 'projects on this page' },
  { value: 'Top 8%', label: 'Amazon ML Challenge, 4,000+ teams' },
  { value: 'SIH', label: 'Smart India Hackathon finalist' },
  { value: '8.12', label: 'CGPA' },
];

export const CAPABILITIES: { title: string; items: string[] }[] = [
  { title: 'Generative AI', items: ['Llama 3.1 / 3.2 on Ollama', 'SLM tool calling', 'RAG pipelines', 'LangChain / LangGraph', 'Hybrid search (BM25 + dense)', 'ChromaDB / Qdrant'] },
  { title: 'Computer Vision', items: ['OpenCV', 'MediaPipe Pose', 'YOLOv11', 'Face recognition', 'Qwen2.5-VL'] },
  { title: 'Backend & Data', items: ['Python', 'SQL', 'FastAPI', 'Django', 'PostgreSQL', 'MongoDB / MySQL / Firebase'] },
  { title: 'Tools & Platforms', items: ['Docker', 'Git', 'Vercel', 'Hugging Face Spaces', 'PyMuPDF', 'Ollama / llama.cpp'] },
];

export const PATH: { year: string; title: string; detail: string }[] = [
  { year: '2026', title: 'Lead developer, SLMRouter', detail: 'Led a team of four to publish a zero-dependency tool-calling library for local 7B/8B models: 50/50 correct tool and argument picks on Llama 3 8B and Mistral 7B, and zero false executions across 795 injected faults.' },
  { year: '2026', title: 'Amazon ML Challenge, top 8%', detail: 'Placed in the top 8% of more than 4,000 teams.' },
  { year: '2026', title: 'Lead developer, PDF Knowledge', detail: 'December 2025 to March 2026. Built the hybrid BM25 and vector retrieval pipeline and shipped it as a Docker Space on Hugging Face.' },
  { year: '2025', title: 'Smart India Hackathon finalist', detail: 'POSE_FIT made the finals: face ID, MediaPipe pose and angle-based rep scoring.' },
  { year: '2025', title: 'MobilityX 2.0 at the TN Global Startup Summit', detail: 'Showed an ML-based EV battery digital twin for health prediction and lifecycle decisions, software track, at Codissia, Coimbatore.' },
  { year: '2025', title: 'Tech Lead, Research & AI Innovation', detail: 'Department of AI & DS, Sri Shakthi Institute of Engineering and Technology, through 2028.' },
  { year: '2024', title: 'B.Tech AI & DS, Sri Shakthi', detail: 'CGPA 8.12. Before that, HSC at Kids Club Senior Secondary School, Tirupur, with 86%.' },
];
