# Dhyanesh Mahendiran | Portfolio

[![GitHub](https://img.shields.io/badge/GitHub-DYNAMOatGHUB-111?style=for-the-badge&logo=github)](https://github.com/DYNAMOatGHUB)
[![LinkedIn](https://img.shields.io/badge/LinkedIn-Dhyanesh_Mahendiran-0077B5?style=for-the-badge&logo=linkedin&logoColor=white)](https://www.linkedin.com/in/dhyaneshmahendiran272307/)
[![Hugging Face](https://img.shields.io/badge/Hugging_Face-DYNAMOatHUGGINGFACE-FFD21E?style=for-the-badge&logo=huggingface&logoColor=black)](https://huggingface.co/DYNAMOatHUGGINGFACE)

An editorial, motion-led portfolio with a dedicated, interactive page for each flagship project.

## Routes

| Route | What it is |
| --- | --- |
| `/` | Hero shader, statement, pinned horizontal flagship reel, filterable index of all work, capabilities, path, contact |
| `/pdf-knowledge` | PDF Knowledge: hybrid-search RAG. A retrieval lab running the ported chunker, BM25, a hybrid blend and a relevance gate in the browser |
| `/slmrouter` | SLMRouter: reliable tool calling for small local LLMs. A router lab running the ported parser, coercion and bounded repair loop against the 16 fault classes |
| `/posefit` | POSE_FIT: computer-vision fitness. A squat lab driven by a 1:1 port of the rep state machine and angle maths from `squat.js` |

## Design system

- Type: Instrument Serif (display), Geist (text), Geist Mono (metadata)
- Motion: Lenis smooth scroll driven by the GSAP ticker, ScrollTrigger reveals, a pinned horizontal reel, and a clip-path curtain between routes
- WebGL: one fullscreen contour shader (three.js). Scroll velocity bends it, the cursor lenses it, and it pauses when off-screen or when the tab is hidden
- Accessibility: skip link, keyboard-operable demos, `prefers-reduced-motion` respected throughout

## Structure

```
src/content.ts            all copy, flagships, works, capabilities, path
src/lib/router.tsx        history router + curtain transitions
src/lib/smooth.ts         Lenis + GSAP wiring, scroll velocity
src/lib/motion.tsx        reveal / split-text hooks, page meta
src/lib/retrieval.ts      chunker port, BM25, dense stand-in, hybrid search (PDF Knowledge lab)
src/lib/slmrouter.ts      parser, coercion, executor and agent loop port (SLMRouter lab)
src/components/           Field (shader), Chrome (nav, cursor, preloader, footer), ProductShell, FlagVisual
src/pages/                Home, PdfKnowledge (+ pdfSample), SlmRouter (+ SlmRouterParts, slmLive), PoseFit
```

Edit `src/content.ts` to add or change work. `FLAGSHIPS` drives the reel and the nav; projects with a `route` link to their demo page.

## Contact form (SMTP)

`POST /api/contact` sends mail through Nodemailer. It's in `api/contact.ts`, which runs as a Vercel function and is also mounted on the Express dev server. Set these env vars (Vercel project settings, or `.env` locally):

| Var | Example |
| --- | --- |
| `SMTP_HOST` | `smtp.gmail.com` |
| `SMTP_PORT` | `465` |
| `SMTP_USER` | your Gmail address |
| `SMTP_PASS` | a Gmail App Password (not your login password) |
| `CONTACT_TO` | inbox to deliver to (defaults to `SMTP_USER`) |

It validates input, strips newlines from headers, sets Reply-To to the sender, rate-limits each IP to 3 messages per 10 minutes, and drops bot submissions with a honeypot field.

## Resume

The PDF lives at `public/resume.pdf`. Every Resume button links to `/resume.pdf`.

## Run

```bash
npm install
npm run dev      # Express + Vite on http://localhost:4580 (override with PORT=...)
npm run build    # static bundle in dist/ + dist/server.cjs
npm run lint     # tsc --noEmit
```

Deploys on Vercel. `vercel.json` rewrites every non-asset path to the SPA.

---

## About me

I'm **Dhyanesh Mahendiran**, an AI engineer and third-year Artificial Intelligence & Data Science student at **Sri Shakthi Institute of Engineering & Technology**, Coimbatore (CGPA **8.12**).

- **Generative AI**: RAG pipelines with LangChain and FastAPI, hybrid BM25 + vector retrieval, reliable tool calling for local 7B/8B models with Ollama and llama.cpp.
- **Computer vision**: OpenCV and MediaPipe pose estimation, YOLO-based detection, vision-language models.
- Top 8% in the Amazon ML Challenge (4,000+ teams), Smart India Hackathon finalist, Tech Lead of Research & AI Innovation in the AI & DS department.

## Featured projects

| Project | Description | Stack |
|---|---|---|
| **[PDF Knowledge](https://dynamoathuggingface-pdf-knowledge-tool.hf.space/)** | RAG over PDFs with OCR fallback, hybrid search and grounded answers | FastAPI, ChromaDB, OpenVINO |
| **[SLMRouter](https://github.com/DYNAMOatGHUB/SLM-Router)** | Zero-dependency tool calling for local 7B/8B models: 50/50 correct picks on Llama 3 8B and Mistral 7B, 0 false executions across 795 faults | Python stdlib, Ollama, llama.cpp |
| **[POSE_FIT](https://github.com/DYNAMOatGHUB/POSE_FIT)** | Face-identified, pose-scored fitness tracker, SIH 2025 finalist | OpenCV, MediaPipe, Firebase |

## Contact

- **Email**: [dhyanshm23@gmail.com](mailto:dhyanshm23@gmail.com)
- **LinkedIn**: [linkedin.com/in/dhyaneshmahendiran272307](https://www.linkedin.com/in/dhyaneshmahendiran272307/)
- **GitHub**: [github.com/DYNAMOatGHUB](https://github.com/DYNAMOatGHUB)
- **LeetCode**: [leetcode.com/u/Dhyanesh_M_07](https://leetcode.com/u/Dhyanesh_M_07/)
- **Location**: Coimbatore, Tamil Nadu, India
