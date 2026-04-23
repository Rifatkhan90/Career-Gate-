# CareerGate System Documentation

CareerGate is a modern, AI-powered job marketplace and career development platform built with React, TypeScript, and Firebase.

## 🆕 Recent Updates (March 27, 2026)

### 1. Authentication Fixes
- **Role Selection**: Added role selection (Candidate/Employer) to the signup form in `AuthModal`. This ensures users are correctly assigned their intended role from the start.
- **Improved Auth Flow**: Refined the signup logic to correctly initialize user documents in Firestore with the selected role.

### 2. Resume Builder Enhancements
- **Functional Sections**: Added missing handlers for "Add Experience", "Add Education", and "Add Skills".
- **UI Completion**: Implemented the missing UI sections for Education and Skills, allowing users to build a complete professional profile.
- **AI Suggestions**: Verified the integration with Gemini AI for ATS-optimized resume suggestions.

### 3. Job Posting & Application
- **Employer Job Posting**: Implemented a "Post New Job" modal in the `EmployerDashboard`. Employers can now publish job openings directly to the platform.
- **Candidate Job Application**: Added "Apply Now" functionality to `JobCard` and `JobFeed`. Candidates can now submit applications, which are stored in the `applications` collection.

### 4. Admin Dashboard Improvements
- **User Management**: Added "Promote to Admin" and "Delete User Data" actions for admins to manage the user base more effectively.
- **Job Moderation**: Implemented "Delete" functionality for job postings, allowing admins to remove inappropriate or expired listings.

### 5. Stripe Payment Refinements
- **Public Key Validation**: Added checks for `VITE_STRIPE_PUBLIC_KEY` to prevent checkout errors when Stripe is not configured.
- **Auth Check**: Integrated authentication checks before initiating checkout to ensure only logged-in users can upgrade their plans.
- **Error Handling**: Improved error reporting for failed checkout sessions.

### 6. Firestore Security & Error Handling
- **Comprehensive Rules**: Updated `firestore.rules` with detailed validation and access control for all collections (`posts`, `notifications`, `interviews`, `jobs`, `applications`, etc.).
- **Centralized Error Handling**: Implemented `handleFirestoreError` in `firebase.ts` and integrated it across all components to provide better debugging information for permission-related issues.

---

### 6. Payment Gateway (Stripe)
*   **Integration**: Stripe Checkout is used for subscription payments.
*   **Tiers**: Basic (Free), Pro (2,900 BDT), Enterprise (9,900 BDT).
*   **Flow**:
    1.  User selects a plan in the `Subscription` view.
    2.  Frontend calls `/api/create-checkout-session` on the backend.
    3.  Backend creates a Stripe Checkout Session and returns the ID.
    4.  Frontend redirects to Stripe's hosted checkout page.
    5.  After payment, Stripe redirects back to the app with `?payment=success` or `?payment=cancel`.
    6.  `App.tsx` handles these parameters to show the appropriate success/failure view.
*   **Setup**:
    1.  Obtain Stripe API keys from the Stripe Dashboard.
    2.  Set `VITE_STRIPE_PUBLIC_KEY` and `STRIPE_SECRET_KEY` in the environment variables.
    3.  Ensure `APP_URL` is correctly set in the environment.

## 🚀 Getting Started

### Prerequisites
- Node.js (v18+)
- npm or yarn
- Firebase Project

### Installation
1. Clone the repository.
2. Install dependencies:
   ```bash
   npm install
   ```
3. Set up environment variables in `.env`:
   - `GEMINI_API_KEY`: Your Google Gemini API key.
   - `VITE_STRIPE_PUBLIC_KEY`: Your Stripe public key.
4. Start the development server:
   ```bash
   npm run dev
   ```

## 🛠 Core Functions

### 1. Authentication (`App.tsx`, `firebase.ts`)
- **Email/Password**: Secure signup and login with password management.
- **Google OAuth**: One-click social login.
- **Role-Based Access**: Users are assigned roles (Candidate, Employer, Admin) which determine their dashboard and permissions.

### 2. AI Resume Builder (`ResumeBuilder.tsx`)
- Generates professional, ATS-friendly resumes using Gemini AI.
- Real-time preview and customization.

### 3. Skill Assessments (`SkillAssessment.tsx`)
- Interactive tests to verify user expertise.
- Earn badges and scores to showcase on profiles.

### 4. Live Job Feed (`JobFeed.tsx`, `JobCard.tsx`)
- Real-time job listings from Firestore.
- Advanced search and filtering by job type and company.
- AI-powered "Match Score" for each job.

### 5. Professional Newsfeed (`Newsfeed.tsx`)
- Social platform for career updates.
- Support for text and image posts.
- Real-time interactions (likes, comments).

### 6. AI Summarizer (`AISummarizer.tsx`)
- Summarizes long job descriptions or articles into key bullet points.

### 7. Subscription & Payments (`Subscription.tsx`)
- Integrated with Stripe for premium plan upgrades.
- Tiered pricing (Basic, Pro, Enterprise).

### 8. Real-time Notification System (`NotificationSystem.tsx`)
- Built using Firestore `onSnapshot` for real-time updates.
- Notifies users about job matches, application status changes, new messages, and scheduled interviews.
- Includes an unread counter and mark-as-read functionality.

### 9. Interview Management (`Interview.tsx`)
- Dedicated portal for scheduling and managing interviews.
- **Employers**: Can schedule meetings with candidates, providing date, time, and meeting links.
- **Candidates**: Can view upcoming interviews and join virtual meetings directly from the app.
- Integrated with the notification system to alert candidates of new invitations.

## 👥 User Roles & Dashboards

### Candidate Dashboard (`CandidateDashboard.tsx`)
- Track job applications and interview status.
- View recommended jobs and AI career coaching tips.

### Employer Dashboard (`EmployerDashboard.tsx`)
- Post new job openings.
- Manage applicants and track hiring pipeline.

### Admin Dashboard (`AdminDashboard.tsx`)
- **User Management**: Assign or revoke roles (Candidate, Employer, Admin).
- **Job Moderation**: Monitor and manage all job postings.
- **System Stats**: Real-time overview of users and jobs.

## 🎨 Design & UI
- **Neo-Brutalist Aesthetic**: Bold borders, high contrast, and intentional spacing.
- **3D Animations**: Immersive transitions and hover effects using Framer Motion.
- **Dark Mode**: Global theme toggle for comfortable viewing in low light.
- **Responsive Design**: Fully optimized for mobile, tablet, and desktop.

## 🏗 System Architecture
- **Frontend**: React 18, Vite, Tailwind CSS v4.
- **Backend**: Firebase (Authentication, Firestore, Storage).
- **AI Engine**: Google Gemini API.
- **Payments**: Stripe API.

---
*Built with ❤️ by the CareerGate Team.*
