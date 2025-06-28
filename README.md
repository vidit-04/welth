<h1 align="center">💰 Welth - AI Powered Personal Finance Management Platform</h1>



<p align="center"><img src="https://img.shields.io/badge/Next.js-13+-black?style=for-the-badge&logo=next.js" /><img src="https://img.shields.io/badge/Tailwind-CSS-blue?style=for-the-badge&logo=tailwindcss" /><img src="https://img.shields.io/badge/Gemini-AI-purple?style=for-the-badge" /><img src="https://img.shields.io/badge/Postgres-DB-336791?style=for-the-badge&logo=postgresql&logoColor=white" /></p>

<p align="center">An advanced platform built using modern technologies like Next.js, Tailwind, Gemini AI, Prisma, and Postgres, designed to simplify personal finance management, deliver AI-powered insights, and help users grow their savings.</p>
<p align="center">
  <img width="1470" alt="Screenshot 2024-12-10 at 9 45 45 AM" src="https://github.com/user-attachments/assets/1bc50b85-b421-4122-8ba4-ae68b2b61432">
</p>


## 🌍 Live Demo
🔗 [Welth Deployment Link](https://welth-omega.vercel.app/)

## ✨ Features & Justifications

<img src="https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExZzgzdnRudDhpdjJ5MXIxY2QzcGI5Z2MwZzFmMnhvNWhuZzZuZGpueCZlcD12MV9naWZzX3NlYXJjaCZjdD1n/jBOOXxSJfG8kqMxT11/giphy.gif" alt="Ninja Brainstorming" width="400"/>

- 🔐 **Google Login & Sign In**: Offers secure, familiar access using Google, improving trust and removing the barrier of password creation.
- ⚙️ **User Settings Management**: Allows changing preferences, security configurations, and personal details, ensuring flexibility and customization.
- 🗃️ **PostgreSQL Database**: A robust, scalable relational DB to store transactions, accounts, and user data securely and reliably.
- ⏱️ **Inngest & Cron Jobs**: Runs automated background tasks for reports, alerts, AI analysis, and threshold checks, keeping users informed and engaged.
- 📊 **Graphical Monthly Expenditure Overview**: Provides users with visual, actionable insights into their monthly spending patterns to encourage better habits.
- 📜 **Listed Transactions**: A clear, organized list showing each transaction with filter/search capability to easily find and verify records.
- 📝 **Edit Transactions**: Enables corrections or updates to existing transactions, ensuring records remain accurate and useful.
- 📷 **Upload Receipt Image with Gemini AI Extraction**: Users can simply upload a picture of a receipt or bill, and Gemini AI will parse and fill transaction details automatically, reducing manual effort.
- 👥 **Multiple Accounts Management**: Lets users create multiple accounts (personal, business, family) to manage finances separately and track them effectively.
- 🔔 **80% Budget Threshold Alerts**: When users reach 80% of their set monthly budget, the system triggers a warning, encouraging mindful spending.
- 📧 **Monthly Email Reports with AI Insights**: Every month, Welth emails detailed reports summarizing expenses, savings, and custom AI suggestions on how to improve spending habits and save more.

<img src="https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExYjhnbTlqb2pjZTd2dHdxazJ1ZnlocGEwcjR4emRldmc1a3cxZWdlNyZlcD12MV9naWZzX3NlYXJjaCZjdD1n/Ca2QkI07acScyHS7aV/giphy.gif" alt="Duck Coffee" width="400"/>

## 🛠️ Tech Stack

| Tech | Role |
|------|------|
| **Next.js** | Frontend & Server-Side Rendering |
| **Tailwind CSS** | Rapid, customizable UI styling |
| **Gemini AI** | Receipt parsing, transaction detail extraction |
| **PostgreSQL** | Relational DB for storing user data, transactions |
| **Prisma** | Type-safe ORM for DB operations |
| **Shadcn UI** | Modern UI component library |
| **Arcjet** | Security & edge protection |
| **Inngest** | Background job orchestration and cron tasks |

## 🧠 Why Welth?

Welth combines intuitive design, strong security, background automation, and powerful AI features to become your smart personal finance assistant. Instead of just tracking transactions, Welth analyzes your spending patterns, surfaces insights, and proactively guides you toward better budgeting and savings habits.

<img src="https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExZ3NtNHFxdnBsYWI1c2NwdnMzN3JtbXV4b28zM3c0b2F6a3Z2anRiYyZlcD12MV9naWZzX3NlYXJjaCZjdD1n/2IudUHdI075HL02Pkk/giphy.gif" alt="Duck Coding" width="400"/>

## 🚀 Getting Started

```bash
# Clone the repository
git clone https://github.com/your-username/welth.git
cd welth

# Install dependencies
npm install

# Setup environment variables
cp .env.example .env
# Fill in Google OAuth keys, Postgres connection string, Gemini API keys

# Run locally
npm run dev
