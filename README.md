# KendraBind AI 🚀

AI-powered recruitment automation platform that helps users intelligently apply for jobs using AI, resume analysis, recruiter targeting, and automated email workflows.

---

# 📌 Project Objective

KendraBind AI aims to automate the entire job application process using Artificial Intelligence.

The platform helps users:
- Analyze resumes
- Match jobs intelligently
- Find recruiters
- Generate personalized emails
- Send applications automatically
- Track application progress

The goal is to reduce manual effort and improve interview conversion rates.

---

# 🧠 Core Features

## ✅ Resume Analyzer
AI-based resume analysis system that:
- Checks ATS compatibility
- Finds missing keywords
- Suggests improvements
- Matches skills with job descriptions

---

## ✅ Job Matching AI
Smart recommendation engine that:
- Matches jobs with resume skills
- Suggests relevant openings
- Filters roles based on experience and technology

---

## ✅ Recruiter Finder
Automatically identifies:
- Recruiter names
- HR emails
- Hiring managers
- Company details

Sources may include:
- LinkedIn
- Job portals
- Company websites

---

## ✅ AI Email Generator
Automatically generates:
- Personalized recruiter emails
- Cover letters
- Professional outreach messages

---

## ✅ Email Automation
System automatically:
1. Generates email
2. Attaches resume
3. Sends email using SMTP

Supported providers:
- Gmail SMTP
- Outlook SMTP
- SendGrid
- AWS SES

---

# 🏗️ Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React.js + Tailwind CSS |
| Backend | Python + Flask/FastAPI |
| Database | PostgreSQL / MongoDB |
| AI/ML | OpenAI APIs / Transformers |
| Authentication | JWT/Auth0 |
| Email Service | SMTP / SendGrid |
| Deployment | Docker + AWS |

---

# 📂 Project Structure

```bash
KendraBind-AI/
│
├── frontend/
│   ├── src/
│   ├── components/
│   ├── pages/
│   ├── services/
│   └── utils/
│
├── backend/
│   ├── api/
│   ├── models/
│   ├── services/
│   ├── ai/
│   ├── mail/
│   ├── scraper/
│   └── utils/
│
├── database/
│
├── docs/
│
├── README.md
│
└── requirements.txt
```

---

# ⚙️ Development Phases

## 🚀 Phase 1
- Resume Upload
- Resume Parser
- Dashboard UI
- Authentication
- Recruiter Email Sender

---

## 🚀 Phase 2
- AI Job Recommendations
- ATS Optimization
- Smart Personalization
- Application Tracking

---

## 🚀 Phase 3
- Auto Apply System
- ML Recommendation Engine
- Browser Automation
- Interview Preparation AI

---

# 🔥 Git Workflow Rules

## ❌ Never Push Directly to Main

All developers must work only on feature branches.

---

# ✅ Branch Structure

```bash
main
 └── feature/*
```

Examples:

```bash
feature/frontend-dashboard
feature/resume-parser
feature/job-matching-ai
feature/email-automation
```

---

# 🚀 Setup Instructions

## 1️⃣ Clone Repository

```bash
git clone <repository-url>
```

---

## 2️⃣ Move Into Project

```bash
cd KendraBind-AI
```

---

## 3️⃣ Create Feature Branch

```bash
git checkout -b feature/your-feature-name
```

Example:

```bash
git checkout -b feature/resume-analyzer
```

---

## 4️⃣ Install Frontend Dependencies

```bash
cd frontend
npm install
```

---

## 5️⃣ Install Backend Dependencies

```bash
cd backend
pip install -r requirements.txt
```

---

# 🚀 Running the Project

## Frontend

```bash
npm start
```

---

## Backend

```bash
python app.py
```

OR

```bash
uvicorn main:app --reload
```

---

# 📌 Contribution Guidelines

Before contributing:
- Create a feature branch
- Write clean and modular code
- Add comments where necessary
- Test before pushing
- Create Pull Request for merge

---

# 👨‍💻 Team Responsibilities

| Team | Responsibility |
|---|---|
| Frontend Team | UI & Dashboard |
| Backend Team | APIs & Business Logic |
| AI Team | Resume AI & ML |
| DevOps | Deployment & CI/CD |
| QA Team | Testing |

---

# 🔐 Security Notes

- Store credentials in `.env`
- Never expose SMTP passwords
- Protect recruiter/user data
- Use JWT Authentication
- Encrypt sensitive information

---

# 📅 Suggested Timeline

| Week | Goal |
|---|---|
| Week 1 | Frontend Setup |
| Week 2 | Backend APIs |
| Week 3 | Resume Parser |
| Week 4 | AI Integration |
| Week 5 | Email Automation |
| Week 6 | Testing & Deployment |

---

# 📌 Important Notes

- Same email with different profiles should be supported
- ATS-friendly keyword extraction required
- System should remain scalable
- Keep modules independent

---

# 🎯 Initial Priority Tasks

## Frontend
- Dashboard UI
- Login/Register
- Resume Upload

---

## Backend
- Resume Parser API
- Email Sender API
- Recruiter Finder API

---

## AI
- Keyword Extraction
- Job Matching
- Email Generation

---

# 🚀 Future Scope

Future improvements:
- LinkedIn Auto Apply
- AI Resume Builder
- AI Mock Interviews
- Chrome Extension
- Candidate Ranking System
- AI Career Assistant

---

# 📜 License

MIT License

---

# 🙌 Final Vision

Build a complete AI-powered hiring ecosystem that automates job applications and helps users land better opportunities faster.
