
# Cursor-App: Autonomous AI Coding Agent

This is a Next.js-based autonomous AI coding assistant integrated with Firebase Studio and GitHub.

## 🤖 AI Features (The 5 Core Agents)

- **Gemini Code Assist**: High-level reasoning for repository-wide logic optimization. Deeply analyzes entire codebase to solve complex architectural issues. **Default behavior for all instructions.**
- **Analyze UI & Designs**: Visual feedback and design optimization via multimodal analysis.
- **Device Context**: Direct file/content injection from device storage for rapid context sharing.
- **DeepWiki Analysis**: Transforms file lists into a structured technical tutorial and knowledge base.
- **Milestone Agent**: Automatically generates development roadmaps and project-specific milestones from specifications.

## 🚀 Key Workflows

- **Autonomous Debugging**: AI simulates and validates code changes before applying them to GitHub.
- **Universal Sandbox Forge**: Build and preview your application for Web, Android, iOS, Desktop, and **Fly.io (Server Resource)**.
- **Visual Fallback Preview**: Automatically generates UI snapshots when compute resources are limited.
- **Fly.io Integration**: Autonomous generation of Dockerfile, fly.toml, and deployment pipelines for server-side resources.
- **GitHub Integrity**: SHA-based rollback (Revert), autonomous commits, PR creation, and repository-level feedback.
- **ZIP Import Engine**: Client-side ZIP extraction and batch GitHub push for rapid project initialization.
- **Google CLI**: Integrated terminal for full repository synchronization with "Pending Files" visualization.

## 🛠 Tech Stack

- **Framework**: Next.js 15 (App Router)
- **Styling**: Tailwind CSS, ShadCN UI
- **AI Engine**: Genkit, Gemini 3.1 Flash / Gemini 2.5 Flash
- **Database/Auth**: Firebase Firestore & Authentication
- **Integration**: GitHub API v3, Fly.io

## 💳 Business Model & Monetization

- **Tiered SaaS Model**: Free (Limited), Pro (Full Assist), and Enterprise (Agency Scaling) tiers.
- **Usage-Based Billing**: Pay-per-token for Gemini reasoning and pay-per-minute for Sandbox compute resources.
- **Agency Licensing**: Custom white-label solutions for software development agencies.
