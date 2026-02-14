
# JEE Nexus AI - Comprehensive Setup & Deployment Guide

This guide provides step-by-step instructions to set up **JEE Nexus AI**, a full-stack examination platform featuring Google Gemini AI for question generation and Supabase for backend data persistence.

---

## 1. Prerequisites

Before you begin, ensure you have the following:
*   **Node.js** (v18 or higher) installed.
*   **Git** installed.
*   **Google Cloud Project** with the **Gemini API** enabled.
*   A **Supabase** account (Free tier is sufficient).

---

## 2. Backend Setup (Supabase)

The application relies on Supabase for Authentication, Database, and Real-time data.

### Step 2.1: Create Project
1.  Log in to [Supabase](https://supabase.com).
2.  Click **"New Project"**.
3.  Enter a Name (e.g., `jee-nexus-ai`), Database Password, and Region.
4.  Wait for the project to initialize.

### Step 2.2: Database Setup (The SQL Script)
1.  In your Supabase dashboard, go to the **SQL Editor** (icon on the left sidebar).
2.  Click **"New Query"**.
3.  **Copy and Paste** the SQL block provided in the project docs (or `pages/Admin.tsx` REPAIR_SQL constant) to set up tables and RLS policies.
4.  Click **Run**.

### Step 2.3: Auth Configuration
1.  Go to **Authentication -> Providers** in Supabase sidebar.
2.  Ensure **Email** is enabled.

---

## 3. Local Development Setup

### Step 3.1: Installation
1.  Clone the repository.
2.  Install dependencies:
    ```bash
    npm install
    ```

### Step 3.2: Environment Variables (Critical for AI Engine)
Create a file named `.env` in the root directory.

#### Supabase Configuration
Get these from Supabase -> Project Settings -> API.
```env
REACT_APP_SUPABASE_URL=your_project_url
REACT_APP_SUPABASE_ANON_KEY=your_anon_public_key
```

#### Google Gemini AI - Multi-Key Setup
To handle high-volume question generation without hitting the **Rate Limits (RPM)** of the free tier, this application uses a Multi-Key Rotation System.

**Method 1: Comma-Separated List (Recommended)**
Add all your API keys in a single variable separated by commas.
```env
API_KEY=AIzaSy...Key1,AIzaSy...Key2,AIzaSy...Key3
```

**Method 2: Indexed Variables**
Alternatively, define them individually (supported up to 10).
```env
API_KEY_1=AIzaSy...Key1
API_KEY_2=AIzaSy...Key2
API_KEY_3=AIzaSy...Key3
```

**How it works:**
The `geminiService.ts` automatically detects all available keys and creates a pool. If a request fails with a `429 Too Many Requests` or `Quota Exceeded` error, the system seamlessly switches to the next available key and retries the request. This ensures 99.9% uptime for exam generation.

### Step 3.3: Run the App
```bash
npm start
```
The app should open at `http://localhost:3000`.

---

## 4. How to Use & Verify

### 1. Log in as Admin
*   **Email:** `name@admin.com`
*   **Password:** `admin123`
*   Go to the **Admin Panel** to generate Daily Papers or approve new students.

### 2. Register as a Student
*   Go to Sign Up.
*   Create a new account.
*   **Note:** By default, new accounts are `pending`. You must log out, log in as Admin, go to "User Management", and click the **Checkmark** to approve the new student.

### 3. Generate Questions
*   Go to **Drill Station** or **Exam Setup**.
*   Select a subject and click "Generate".
*   This uses the `API_KEY` pool. If it fails, ensure your keys are valid and quotas are not exhausted.

---

## Troubleshooting

*   **"AI Generation Failed"**: Ensure you have provided valid API keys in `.env` and that you haven't exhausted the quota on ALL keys. Add more keys to fix this.
*   **"Failed to fetch"**: Check your network connection and Supabase URL in `.env`.
