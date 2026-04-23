# 🚀 CareerGate Platform Documentation

## 1. Project Overview
**CareerGate** is an elite, high-performance SaaS platform built to unify job seekers, employers, and administrators into a single ecosystem. Driven by a powerful combination of real-time local AI, intelligent resume parsing, and beautiful React-driven environmental interfaces, CareerGate offers a world-class user experience.

---

## 2. Core Architecture
- **Frontend Framework:** React 18 (Bootstrapped with Vite)
- **Animation Engine:** `motion/react` (Framer Motion)
- **Styling:** Tailwind CSS (Custom Dark Mode / Light Mode with CSS Variables)
- **Icons:** Lucide React
- **Local AI Engine:** LM Studio (Port `1234`) connected via local Node.js proxy `/api/v1/chat`.
- **State Management:** Localized dynamic store via `src/lib/store.ts`.

---

## 3. User Personas & Access Roles

The platform dynamically restricts and shapes the UI based on three user tiers:

### 🎓 Candidate (Job Seeker)
**Capabilities:**
- **Resume Builder:** Construct ATS-friendly resumes using a smart-form interface.
- **AI Co-Pilot:** Real-time AI consultation for crafting summaries, bullets, and interview strategies.
- **Job Feed:** View, filter, and apply to job postings.
- **Skill Assessments:** Take industry-standard quizzes to earn verifications.
- **Community Feed:** Discuss and post network updates.

### 🏢 Employer
**Capabilities:**
- **Job Posting:** Submit rigorous job listings with descriptions and tags.
- **Candidate Polling:** Browse candidates who have applied for jobs.
- **Application Viewing:** View the active resumes of candidates.
- **Interview Scheduling:** Coordinate direct interviews.

### 🛡️ System Admin
**Capabilities:**
- **Platform Oversight:** Monitor total analytics, users, and server loads.
- **Pricing Configuration:** Dynamically update standard/premium tier pricing. Overrides immediately sync globally via `store.ts`.
- **System Logs:** Live view of backend activity and metrics.

---

## 4. File-by-File Breakdown

### App Core Layers
| File Path | Responsibility & Features |
| :--- | :--- |
| `src/App.tsx` | The central router and authentication provider constraint boundary. It intercepts URL views (`view`), manages `AuthMode`, renders global assets like `<AIFloatingChat />` and `<EnvironmentFX />` (sky animation elements), and controls the `min-h-screen` viewport. |
| `src/index.css` | The global stylesheet driving the elite user experience. Manages Light/Dark mode CSS variables. Contains `@keyframes` for the complex 20-flock Bird flights, dual Airplane flights, and Dark Mode Meteor Showers. |
| `server.ts` | The backend tunnel server written in Node.js/Express. It handles `CORS` rules and securely bridges the React frontend to the local AI running on LM Studio (`localhost:1234`). |

### Core Components
| File Path | Responsibility & Features |
| :--- | :--- |
| `src/components/ResumeBuilder.tsx` | Advanced form layout that binds candidate state to a live JSON template. Equipped with a `"callLocalAI"` pipeline that deeply parses arrays from LM Studio to prevent React UI parsing crashes. |
| `src/components/AIFloatingChat.tsx` | The global persistent Co-Pilot. Found across the entire app, it is a fixed overlay that intercepts user text and pushes it to `qwen2.5-7b` via the backend proxy. Fully stylized with `whitespace-pre-wrap` for strict formatting visibility. |
| `src/components/NotificationSystem.tsx` | Bound inside `Navbar.tsx`. Interactively manages match updates and interview pings. Strictly formatted in high-contrast `bg-zinc-950`/`bg-white` to prevent illegible overlapping text against the animated background. |
| `src/components/Navbar.tsx` | The universal header routing system. Handles profile popovers, theme toggling, routing states, and login intercepts. Matches physical button bounding metrics strictly for visual consistency between the My Profile and System Admin toggles. |

### Dashboards & Views
| File Path | Responsibility |
| :--- | :--- |
| `src/components/AdminDashboard.tsx` | Handles system telemetry and config overrides. Interacts with `setPricing()` from `store.ts` to globally re-align payment gateways instantly. |
| `src/components/EmployerDashboard.tsx` | Allows employers to track the state of their job requests and view linked application PDFs. |
| `src/components/Subscription.tsx` | Renders the primary payment pricing structures statically pulled from `store.ts` configurations. |

### Libraries
| File Path | Responsibility |
| :--- | :--- |
| `src/lib/store.ts` | Acts as the pseudo-database using LocalStorage pipelines. It mimics real network sync by propagating state arrays for Users, Roles, and Application Data dynamically across sessions. |

---

## 5. Elite UI & Environmental Capabilities

CareerGate abandons stale, traditional design elements by adopting a hyper-modern dynamic background architecture utilizing `motion/react` and massive `@keyframes` loops:

### 🌤️ Day Mode (Light Interface)
- **Deep Sky Gradient:** Translates from `#38bdf8` to `#ffffff`.
- **Dynamic Flocks:** `EnvironmentFX` generates 20 total flying black bird silhouettes acting natively across physical screen horizons. 
- **Air Traffic:** Two separate planes follow delayed infinite loops across `html:not(.dark) #root::before` and `::after`.
- **Floating Clouds:** Box-shadow rendering constructs cloud masses moving against the environment.

### 🌌 Night Mode (Dark Interface)
- **Gala Gradient:** Utilizes a `#050510` baseline coupled with complex radial dot matrices simulating thousands of stars.
- **Meteor Shower:** The background injects 20 massive Shooting Stars bursting from the top right axis to the bottom left axis simultaneously utilizing randomized `animation-delay` vectors. 
- **Moon Traversal:** A glowing lunar box-shadow sphere orbits the background indefinitely at a slow, subtle rate.

---

## 6. Local AI Configuration
The application connects strictly via local LM Studio interfaces to ensure zero-cost processing overhead.
- **Target Endpoint:** `http://localhost:1234/api/v1/chat/completions`
- **Recommended Model Space:** `qwen2.5-7b-instruct-1m`
- **Fallback Logic:** If LM Studio fails or closes, the AI proxy automatically aborts and triggers a safe user warning (`System Offline`) instead of permanently crashing the component state. Object arrays thrown by older LM Studio versions are now automatically caught and mapped via custom array sanitizing.
