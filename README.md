# SkillSync AI

**An AI-powered career guidance platform for people who don't know where to start.**

Most AI career tools assume you already know your target role and just need a polished resume. SkillSync AI starts a step earlier — guiding users from zero career clarity through to job-readiness, backed by real job-market data at every step. It reads live job postings, compares them against your actual resume, and shows you precisely what's missing — then helps you close that gap, materials and all.

---

## Table of Contents

- [Introduction](#introduction)
- [Demo](#demo)
- [UI Preview](#ui-preview)
- [Problem Statement](#problem-statement)
- [Solution](#solution)
- [Feature Modules](#feature-modules)
  - [1. SkillSync Radar](#1-skillsync-radar)
  - [2. SkillSync Parser](#2-skillsync-parser)
  - [3. SkillSync GapMap](#3-skillsync-gapmap)
  - [4. Skill Assessment](#4-skill-assessment)
  - [5. Career Mentor](#5-career-mentor)
  - [6. Roadmap Generator](#6-roadmap-generator)
  - [7. Resume Tools](#7-resume-tools)
  - [8. Interview Preparation](#8-interview-preparation)
  - [9. Syncy — In-App Assistant](#9-syncy--in-app-assistant)
- [Tech Stack](#tech-stack)
- [System Architecture](#system-architecture)
- [Matching Evaluation](#matching-evaluation)
- [API Reference](#api-reference)
- [Security & Compliance](#security--compliance)
- [Setup Guide](#setup-guide)
- [Troubleshooting](#troubleshooting)
- [Credits](#credits)
- [Contributing](#contributing)
- [License](#license)

---

## Introduction

SkillSync AI is a full-stack career platform that takes a user from "I don't know what I want to do" to "I'm ready to walk into the interview." Every tool is grounded in live job-market data rather than static advice — job postings, salary ranges, and in-demand skills are pulled and scored in real time, and every recommendation traces back to that data.

The platform is organized around three stages users naturally move through: **Discover → Build → Prove**.

---

## Demo

[![Landing Page & Syncy Demo](https://img.youtube.com/vi/7PqDUtXiae4/0.jpg)](https://youtu.be/7PqDUtXiae4)
**Landing Page & Syncy** — [Watch on YouTube](https://youtu.be/7PqDUtXiae4)

[![Skill Assessment Demo](https://img.youtube.com/vi/QfERaD_cMY8/0.jpg)](https://youtu.be/QfERaD_cMY8)
**Skill Assessment** — [Watch on YouTube](https://youtu.be/QfERaD_cMY8)

[![Roadmap Generator Demo](https://img.youtube.com/vi/gt4HsI-LhWk/0.jpg)](https://youtu.be/gt4HsI-LhWk)
**Roadmap Generator** — [Watch on YouTube](https://youtu.be/gt4HsI-LhWk)

[![Resume Tools Demo](https://img.youtube.com/vi/VduDCwGdow4/0.jpg)](https://youtu.be/VduDCwGdow4)
**Resume Tools** — [Watch on YouTube](https://youtu.be/VduDCwGdow4)

[![SkillSync Radar Demo](https://img.youtube.com/vi/FUM2ydsgNHk/0.jpg)](https://youtu.be/FUM2ydsgNHk)
**SkillSync Radar** — [Watch on YouTube](https://youtu.be/FUM2ydsgNHk)

[![SkillSync Parser Demo](https://img.youtube.com/vi/jPPV134pN2c/0.jpg)](https://youtu.be/jPPV134pN2c)
**SkillSync Parser** — [Watch on YouTube](https://youtu.be/jPPV134pN2c)

[![Interview Preparation Demo](https://img.youtube.com/vi/cV_mXom-tOY/0.jpg)](https://youtu.be/cV_mXom-tOY)
**Interview Preparation** — [Watch on YouTube](https://youtu.be/cV_mXom-tOY)

[![SkillSync GapMap Demo](https://img.youtube.com/vi/WLDYaX5wkbw/0.jpg)](https://youtu.be/WLDYaX5wkbw)
**SkillSync GapMap** — [Watch on YouTube](https://youtu.be/WLDYaX5wkbw)

[![Career Mentor Demo](https://img.youtube.com/vi/-qOdwym_3Ko/0.jpg)](https://youtu.be/-qOdwym_3Ko)
**Career Mentor** — [Watch on YouTube](https://youtu.be/-qOdwym_3Ko)

---

## UI Preview

| Landing Page | Dashboard |
| --- | --- |
| [![Landing Page](SkillSync%20AI%20%E2%80%94%20Skill%20Landing%20Page-1.png)](SkillSync%20AI%20%E2%80%94%20Skill%20Landing%20Page-1.png) | [![Dashboard](SkillSync%20AI%20%E2%80%94%20Skill%20Dashboard.png)](SkillSync%20AI%20%E2%80%94%20Skill%20Dashboard.png) |
| [![Landing Page](SkillSync%20AI%20%E2%80%94%20Skill%20Landing%20Page-2.png)](SkillSync%20AI%20%E2%80%94%20Skill%20Landing%20Page-2.png) | |

| SkillSync Radar | SkillSync Parser |
| --- | --- |
| [![Radar](SkillSync%20AI%20%E2%80%94%20Skill%20Radar.png)](SkillSync%20AI%20%E2%80%94%20Skill%20Radar.png) | [![Parser](SkillSync%20AI%20%E2%80%94%20Skill%20Parser-1.png)](SkillSync%20AI%20%E2%80%94%20Skill%20Parser-1.png) |

| SkillSync GapMap | Skill Assessment |
| --- | --- |
| [![GapMap](SkillSync%20AI%20%E2%80%94%20Skill%20Gapmap.png)](SkillSync%20AI%20%E2%80%94%20Skill%20Gapmap.png) | [![Skill Assessment](SkillSync%20AI%20%E2%80%94%20Skill%20Assessment-1.png)](SkillSync%20AI%20%E2%80%94%20Skill%20Assessment-1.png) |

| Career Mentor | Roadmap Generator |
| --- | --- |
| [![Career Mentor](SkillSync%20AI%20%E2%80%94%20Skill%20Career%20Mentor-1.png)](SkillSync%20AI%20%E2%80%94%20Skill%20Career%20Mentor-1.png) | [![Roadmap](SkillSync%20AI%20%E2%80%94%20Skill%20Roadmap-1.png)](SkillSync%20AI%20%E2%80%94%20Skill%20Roadmap-1.png) |

| Resume Tools | Interview Preparation |
| --- | --- |
| [![Resume Tools](SkillSync%20AI%20%E2%80%94%20Skill%20Resume%20Tools-1.png)](SkillSync%20AI%20%E2%80%94%20Skill%20Resume%20Tools-1.png) | [![Interview Prep](SkillSync%20AI%20%E2%80%94%20Skill%20Interview%20Prep-1.png)](SkillSync%20AI%20%E2%80%94%20Skill%20Interview%20Prep-1.png) |

> Screenshots live at the repo root; demo videos live under `public/demos/`.

---

## Problem Statement

Most career tools fall into one of two traps:

- **They assume clarity you don't have** — "upload your resume, we'll optimize it" is useless if you don't know what role to target in the first place.
- **They give generic advice** — reading lists and static "top skills" articles that don't reflect what's actually being hired for right now, in your market.

This leaves people without a clear starting point stuck between vague self-help content and tools built for people who are already halfway there.

---

## Solution

SkillSync AI closes that gap end-to-end:

- **Reads live job postings** to show what skills are actually in demand for a target role, right now.
- **Scores your real resume** against that live market data, not a static checklist.
- **Builds a personalized, phased roadmap** from your current skill level to your target role.
- **Rewrites your materials** — resume bullets and cover letters — with measurable ATS score improvements.
- **Runs interview practice** using questions generated from real listings for your target role, not a generic question bank.

---

## Feature Modules

### 1. SkillSync Radar

Type in a target role and country to analyze live job postings and see the most requested technical skills, soft skills, and salary range right now, broken into High / Medium / Low demand tiers.

![Radar](SkillSync%20AI%20%E2%80%94%20Skill%20Radar.png)

**How it works:** Queries JSearch (RapidAPI) for live postings matching the role and location, extracts and ranks required skills with code (no AI call needed for extraction), and calls an AI model only for salary intelligence normalization when structured data isn't available. Falls back to a secondary API key if the primary is rate-limited.

---

### 2. SkillSync Parser

Upload a resume (or enter details manually) and get back a clean extraction of current skills, role, and experience level — plus a live-matched job list scored on ATS compatibility, keyword match, experience match, and skill match.

![Parser](SkillSync%20AI%20%E2%80%94%20Skill%20Parser-1.png)
![Parser](SkillSync%20AI%20%E2%80%94%20Skill%20Parser-2.png)

**How it works:** A cost-optimized, three-tier pipeline — code-based extraction first (free), AI (Gemini Flash) fallback only if code extraction yields too few results, and a final raw-text fallback if AI fails. Only the top-scoring matches are sent to a second AI pass for final scoring, keeping token usage low.

---

### 3. SkillSync GapMap

A visual heatmap comparing your current skills against a target role's requirements, with a gap score and a generated learning path for each missing skill.

![GapMap](SkillSync%20AI%20%E2%80%94%20Skill%20Gapmap.png)

**How it works:** Built on the same skill-extraction pipeline as the Parser, cross-referenced against Radar's live demand data to compute the gap score and prioritize which skills to learn first.

---

### 4. Skill Assessment

An adaptive, multi-stage quiz tailored to education level, field of study, and country. Produces a skill-level score, a category-by-category radar chart (tech literacy, logical thinking, problem solving, soft skills, career awareness), and personalized mentor feedback.

![Skill Assessment](SkillSync%20AI%20%E2%80%94%20Skill%20Assessment-1.png)
![Skill Assessment](SkillSync%20AI%20%E2%80%94%20Skill%20Assessment-2.png)

**How it works:** Stage 1 generates an initial question set and scores it locally; Stage 2 branches into harder or different questions based on Stage 1 performance; the final submission merges both stages, grades everything, and clears the session so it can't leak into a future assessment. Results can be exported to JSON or CSV.

---

### 5. Career Mentor

Personalized career path recommendations weighed against your skills, education, and where the market is actually moving — each with a match percentage, salary range, career progression path, and real transition stories sourced from the web.

![Career Mentor](SkillSync%20AI%20%E2%80%94%20Skill%20Career%20Mentor-1.png)
![Career Mentor](SkillSync%20AI%20%E2%80%94%20Skill%20Career%20Mentor-2.png)

**How it works:** Combines user-entered skills/background with live market data, calls an AI model to generate ranked recommendations, and separately surfaces real career-transition stories relevant to each suggested path.

---

### 6. Roadmap Generator

Turns a career goal into a phased, step-by-step learning plan — prerequisites, topics, tools, and milestones per phase — tailored to weekly time commitment, current level, and target industry.

![Roadmap](SkillSync%20AI%20%E2%80%94%20Skill%20Roadmap-1.png)
![Roadmap](SkillSync%20AI%20%E2%80%94%20Skill%20Roadmap-2.png)

**How it works:** Roadmap generation is proxied through a Supabase Edge Function for heavier processing, with results cached and resumable — users can pick up a previously generated roadmap instead of regenerating from scratch. Phase explanations use a persistent cache since many users request explanations for near-identical phase content, reducing AI calls to mostly free cache hits.

---

### 7. Resume Tools

Rewrites vague resume bullets into achievement-driven language, shows an ATS compatibility score before/after with a visual diff, and drafts a full tailored cover letter with a keyword match breakdown.

![Resume Tools](SkillSync%20AI%20%E2%80%94%20Skill%20Resume%20Tools-1.png)
![Resume Tools](SkillSync%20AI%20%E2%80%94%20Skill%20Resume%20Tools-2.png)

**How it works:** Takes resume text and a target job description, runs it through an AI rewrite pass that highlights exactly what changed and why (added keywords, quantified impact), and generates a matching cover letter scored against the same job description.

---

### 8. Interview Preparation

Mock quizzes and deep-dive interview questions generated from real listing data for a target role, with ideal answers, likely follow-ups, red flags to avoid, and what interviewers are actually looking for. Includes a searchable question library organized by category (Technical, Behavioral, Situational, Conceptual, System Design).

![Interview Prep](SkillSync%20AI%20%E2%80%94%20Skill%20Interview%20Prep-1.png)

**How it works:** Generates questions scoped to target role, experience level, difficulty, and specific skills to focus on. Question sets are cached per-role so repeated requests for the same role/level combination don't re-trigger a full AI generation.

---

### 9. Syncy — In-App Assistant

A persistent chat assistant available throughout the platform to route users to the right tool based on what they're trying to do.

![Syncy](SkillSync%20AI%20%E2%80%94%20Skill%20Syncy.png)

---

## Tech Stack

| Layer | Technology |
| --- | --- |
| Frontend | React + TypeScript, Vite, Tailwind CSS |
| Backend | Node.js + Express (`server.ts`), served alongside Vite in development |
| Authentication | Firebase Auth + Firebase Admin SDK (server-side token verification) |
| Database | Firestore (user data, usage limits, rate-limit store) |
| Workflow / Heavy Compute | Supabase Edge Functions (roadmap generation, interview question generation/evaluation, resource suggestions) |
| AI / LLM | Google Gemini (primary), OpenAI (resume tools, job-match scoring) — with provider fallback logic |
| Job Market Data | RapidAPI — JSearch, with fallback API keys |
| Learning Resources | YouTube — resource suggestions for identified skill gaps |

---

## System Architecture

```
Client (React / Vite)
      │
      ▼
Express server (server.ts)
      ├── Firebase Admin — verifies auth tokens, reads/writes Firestore
      ├── Firestore-backed rate limiters — heavy / medium / light, per route
      ├── /api/resume-tools, /api/parse-resume, /api/career-mentor   → OpenAI + Gemini
      ├── /api/generate-roadmap, /api/supabase/:function            → Supabase Edge Functions
      └── /api/radar (via radarService)                             → RapidAPI (JSearch) + Gemini/OpenAI scoring
```

**Data Flow:**

1. User action triggers a request from the client to the Express backend.
2. `requireAuth` / `optionalAuth` middleware verifies the Firebase ID token.
3. Per-route rate limiting checks usage against Firestore before proceeding.
4. The route calls the relevant service — live job data (RapidAPI), an AI provider (Gemini/OpenAI), or a Supabase Edge Function for heavier workflows.
5. Results are returned to the client; only extracted, non-sensitive data (e.g. skills list) is persisted — raw resume text is never stored.

---

## Matching Evaluation

The Parser's job matching is measured against a labelled set, so changes to it can be checked with numbers instead of by eye.

**Dataset** (`evals/matching/dataset.json`, all fictional): 20 resumes (students to staff engineers, plus career changers), 30 job postings (with and without clear "Required / Preferred" sections), and 71 resume–job pairs labelled **strong**, **partial** or **poor** fit. Each resume and posting also has the skills and years of experience a human reviewer would extract. Skills use the names in `KNOWN_SKILLS`; years are left unlabelled where the answer is debatable (career changers, a PhD).

### Offline (code-based stages, runs in CI)

`tests/matchingEval.test.ts` runs the evaluation on every push and fails if any result drops below the table. To print the full report:

```bash
npx tsx evals/matching/run.ts
```

| Stage | Metric | Before | Now |
|---|---|---|---|
| Resume skills | precision / recall | 99.3% / 95.2% | 99.3% / 98.6% |
| Job skills | precision / recall | 98.3% / 95.6% | 98.4% / 98.4% |
| Resume experience | within ±1 year (17 labelled) | 15/17 | 17/17 |
| Job years required | exact | 30/30 | 30/30 |
| Required vs preferred | skills in the right bucket | 115/123 | 118/123 |
| Pre-score | same-resume pairs ordered correctly | 75/81 (92.6%) | 76.5/81 (94.4%) |
| Pre-score | mean score, strong / partial / poor | 87.9 / 39.2 / 4.8 | 88.4 / 38.5 / 3.0 |
| Top-8 cut | strong fits that reach the AI step | 100% | 100% |

**What the first run found, and what changed:**

- *Experience detection* counted a student's degree years ("BS Computer Science (2022 – 2026)") as four years of work, which removed the experience penalty and let a "4+ years" job rank level with student-appropriate roles. It also missed ranges written with months ("Mar 2020 – Feb 2025"). Date ranges next to education words on the same line are now skipped, and month-name ranges are read.
- *Skill matching* missed plurals ("REST APIs", "webhooks", "WebSockets", "API integrations", "data pipelines"). `skillPattern()` now accepts a plural `s`/`es`, except for everyday words that are also skill names ("make", "express", "go"), so "makes" or "goes" don't become skills.

**Known limits** (left as they are, reported here):

- Aliases outside the keyword list are missed: "Hugging Face" (with a space), "Postgres", "Node".
- A few false positives remain: "Azure OpenAI" also counts as "OpenAI", "We go fast" as Go, "make sure" as Make.
- The pre-score only compares keywords. It can't see that a React developer is a partial fit for a Vue role, and it doesn't reward a junior role for a junior candidate, which accounts for most of the remaining ordering errors.
- The fixes were made after looking at this set, and there is no separate held-out set, so the "Now" column is an optimistic estimate.

### Live (AI scoring step)

`evals/matching/live.ts` sends each resume's labelled jobs through the AI scoring step (`analyzeWithAI`, on whichever provider `services/aiClient.ts` selects) and reports how well its `matchScore` agrees with the labels: pairs ordered correctly, mean score per label, strong fits scored 70+, and poor fits scored below 50 (the prompt's own threshold). It makes one call per resume (20 in total) and refuses to run without an AI key. It has been run on gpt-4o-mini and on Gemini 3.5 Flash-Lite, the model the app now uses.

```bash
GEMINI_API_KEY=... npx tsx evals/matching/live.ts
```

In GitHub, it runs only when started manually (Actions → *Matching live evaluation*) with the `GEMINI_API_KEY` (or `OPENAI_API_KEY`) secret and the `ENABLE_LIVE_EVAL` variable set; the report is kept as a run artifact.

| Model | Date | Pairs ordered correctly | Mean score, strong / partial / poor | Strong 70+ | Poor < 50 |
|---|---|---|---|---|---|
| gpt-4o-mini | 2026-11-20 | 79.5/81 (98.1%) | 87.4 / 43.2 / 14.8 | 20/21 | 25/25 |
| gemini-3.5-flash-lite | 2026-11-22 | 81/81 (100%) | 85.9 / 46.7 / 17.2 | 20/21 | 25/25 |

First run ([workflow run](https://github.com/MaryumAkram16/Skillsync-AI/actions/runs/44757739307), ratings kept as the `matching-live-report` artifact): all 71 labelled pairs were rated, none left out. The AI step orders same-resume pairs correctly 98.1% of the time against 94.4% for the code pre-score that feeds it, and keeps the three labels far apart on average. Every poor fit scored below 50 as the prompt instructs; one strong fit fell short of 70. One run at temperature 0.2 on 71 pairs labelled by the same person who wrote the evaluation, so treat these as indicative, not a benchmark.

Gemini run ([workflow run](https://github.com/MaryumAkram16/Skillsync-AI/actions/runs/45032188306)), after the app moved to Gemini 3.5 Flash-Lite with low thinking: all 20 calls succeeded with no retries or fallbacks, all 71 pairs were rated, and every same-resume pair was ordered correctly. The labels stay well apart, with partial fits scored a little higher than on gpt-4o-mini; again one strong fit fell short of 70, and every poor fit scored below 50. Each call scores 3–5 jobs at once and took 1.7–22.6 s (median about 5 s). The same limits apply: one run, 71 pairs, the same labels the scoring rules were tuned against.

---

## API Reference

| Method | Endpoint | Auth | Description |
| --- | --- | --- | --- |
| `GET` | `/api/health` | None | Reports Firestore, Gemini, and Supabase connectivity |
| `POST` | `/api/resume-tools` | `requireAuth` | Resume rewrite + cover letter generation |
| `POST` | `/api/parse-resume` | `requireAuth` | Resume parsing + live job matching |
| `POST` | `/api/career-mentor` | `requireAuth` | Career path recommendations |
| `POST` | `/api/generate-roadmap` | `requireAuth` | Phased learning roadmap generation |
| `POST` | `/api/suggest-resources` | `requireAuth` | Learning resource suggestions for a roadmap |
| `POST` | `/api/explain-phase` | `requireAuth` | Cached explanation for a roadmap phase |
| `POST` | `/api/supabase/:function` | `requireAuth` | Generic proxy to Supabase Edge Functions (interview generation, evaluation, etc.) |
| `POST` | `/api/chatbot` | `optionalAuth` | Syncy assistant chat |
| `GET` | `/api/verify-database` | `requireAuth` | Verifies Supabase connectivity |

**Example — Generate Roadmap Request Body:**

```json
{
  "userId": "abc123",
  "goal": "AI Engineer",
  "level": "Beginner",
  "timeCommitment": "10 hours per week",
  "existingSkills": "Python, Excel",
  "targetIndustry": "Healthcare",
  "learningStyle": "Mixed"
}
```

---

## Security & Compliance

- **Firebase Auth verification** — all sensitive routes require a verified Firebase ID token via `requireAuth`; `optionalAuth` routes proceed without blocking but flag missing/invalid tokens.
- **Firestore-backed rate limiting** — heavy (5/hr), medium (20/hr), and light (60/hr) tiers per route, keyed by user or IP.
- **No raw resume storage** — resume text is processed in memory and discarded; only extracted skills are persisted.
- **Usage limits** — per-user, per-feature usage tracking (`checkAndIncrementUsage`) to control AI API costs and prevent abuse.
- **Data in transit** — all traffic over HTTPS/TLS.

---

## Setup Guide

### Prerequisites

- Node.js 18+
- A Firebase project (Auth + Firestore enabled) with an Admin SDK service account
- API keys for Gemini, OpenAI, and RapidAPI (JSearch)
- Access to the project's Supabase Edge Functions

### 1. Clone & Install

```bash
git clone https://github.com/MaryumAkram16/Skillsync-AI.git
cd Skillsync-AI
npm install
```

### 2. Environment Variables

Create a `.env` file in the project root:

```env
# AI providers — Gemini does all the AI work whenever GEMINI_API_KEY is set
GEMINI_API_KEY=your_gemini_key
CAREER_MENTOR_GEMINI_API_KEY=your_gemini_key      # optional, falls back to GEMINI_API_KEY
GEMINI_MODEL=gemini-3.5-flash-lite                # optional, this is the default
OPENAI_API_KEY=your_openai_key                    # optional, used only without a Gemini key
AI_PROVIDER=                                      # optional: "openai" to force OpenAI

# Job data
RAPIDAPI_KEY=your_rapidapi_key
RAPIDAPI_KEY_2=your_backup_rapidapi_key           # optional fallback

# Supabase (Edge Functions)
SUPABASE_ANON_KEY=your_supabase_anon_key

# Firebase Admin
# Either Application Default Credentials (Cloud Run, or GOOGLE_APPLICATION_CREDENTIALS
# pointing to a service-account JSON file), or the key itself in one variable:
FIREBASE_SERVICE_ACCOUNT=           # service-account key JSON, raw or base64 (required on Vercel)
```

### 3. Run Locally

```bash
npm run dev
```

This starts the Express server, which also boots Vite for the frontend — the app is served from a single process in development.

### Deploy on Vercel

The repository deploys to Vercel as-is (`vercel.json`):

- The React app is built with `vite build` and served from `dist/` by Vercel's CDN, with every non-API path falling back to `index.html`.
- Every `/api/*` request goes to one Vercel Function, `api/index.ts`, which runs the same Express app as `npm run dev` (`createApp("none")` in `server.ts`). It may run for up to 300 s, the same time the frontend waits for the slowest AI routes.

To set it up:

1. Import the repository in Vercel. The framework (Vite) and build settings come from `vercel.json`.
2. Add the environment variables from step 2 in **Project Settings → Environment Variables**, including `FIREBASE_SERVICE_ACCOUNT`: Vercel has no Application Default Credentials, so Firebase Admin needs the service-account key (Firebase console → Project settings → Service accounts → Generate new private key). Paste the file's JSON, or its base64.
3. Add the Vercel domain (e.g. `your-project.vercel.app`) under Firebase console → Authentication → Settings → **Authorized domains**, or Google sign-in is blocked there.
4. Deploy, then open `/api/health`: `"firestore": "ok"` confirms the Firebase credentials work.

Cloud Run keeps working unchanged: without `FIREBASE_SERVICE_ACCOUNT`, Firebase Admin uses Application Default Credentials as before.

### 4. Verify Setup

Once running, `GET /api/health` reports whether Firestore, Gemini, and Supabase are reachable and correctly configured.

---

## Troubleshooting

| Issue | Possible Cause | Solution |
| --- | --- | --- |
| `/api/health` shows Gemini "missing" | `GEMINI_API_KEY` not set | Add the key to `.env` and restart the server |
| 401 on any `requireAuth` route | Missing/expired Firebase ID token | Re-authenticate on the client and resend the request |
| 429 "Rate limit reached" | Feature usage cap hit for the hour | Wait for the limiter window to reset, or check the tier (heavy/medium/light) for that route |
| Radar returns no results | JSearch API key rate-limited | Add `RAPIDAPI_KEY_2` as a fallback, or wait for the primary key's limit to reset |
| Roadmap/Interview requests hang | Supabase Edge Function unreachable | Check `SUPABASE_ANON_KEY` and confirm the target function is deployed |
| Firebase Admin fails to initialize | Missing/invalid service account credentials | Confirm `GOOGLE_APPLICATION_CREDENTIALS` points to a valid service account JSON |

---

## Credits

This project was built independently by me, with two exceptions:
- **Roadmap** and **Interview Preparation** were built by **Misbah**.

Every other feature — Radar, Parser, GapMap, Skill Assessment, Career Mentor, Resume Tools, the backend, and the overall architecture — was built by me.

---

## Contributing

1. Fork the repository.
2. Create a new branch (`feature/your-feature` or `fix/issue-description`).
3. Make your changes with clear, descriptive commit messages.
4. Test affected routes end-to-end before submitting.
5. Open a Pull Request with a detailed description of your changes.

---

## License

This project is licensed under the MIT License — see the LICENSE file for details.
