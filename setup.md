
# JEE Nexus AI - Setup & Deployment Guide

This guide covers setting up the project locally, deploying to GitHub/Netlify, and configuring the Supabase backend.

## 1. Prerequisites
- **Node.js** (v18+)
- **NPM** or **Yarn**
- A **Google Cloud Project** with Gemini API enabled.
- A **Supabase** account.

---

## 2. Local Development

1.  **Clone/Download** the project files.
2.  Open a terminal in the project root.
3.  **Install Dependencies**:
    ```bash
    npm install
    ```
4.  **Environment Setup**:
    Create a `.env` file in the root (optional, you can also use the Admin Panel to set keys later):
    ```env
    REACT_APP_SUPABASE_URL=your_supabase_url
    REACT_APP_SUPABASE_ANON_KEY=your_supabase_anon_key
    API_KEY=your_google_gemini_key
    ```
5.  **Start the Dev Server**:
    ```bash
    npm start
    ```
    The app will open at `http://localhost:3000`.

---

## 3. Backend (Supabase) Setup

1.  Create a new project in [Supabase](https://supabase.com).
2.  Go to the **SQL Editor** and run the following script to create the necessary tables:

```sql
-- 1. Profiles Table (Extends Auth)
create table profiles (
  id uuid references auth.users on delete cascade not null primary key,
  email text unique not null,
  full_name text,
  role text default 'student' check (role in ('student', 'admin')),
  status text default 'pending' check (status in ('pending', 'approved', 'rejected')),
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 2. Questions Bank
create table questions (
  id uuid default uuid_generate_v4() primary key,
  subject text not null,
  chapter text,
  type text check (type in ('MCQ', 'Numerical')),
  difficulty text,
  statement text not null,
  options jsonb, -- Array of strings
  "correctAnswer" text not null,
  solution text,
  explanation text,
  concept text,
  "markingScheme" jsonb default '{"positive": 4, "negative": 1}',
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 3. Daily Challenges (One paper per day)
create table daily_challenges (
  date date primary key, -- YYYY-MM-DD
  questions jsonb not null, -- Array of question objects
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 4. Daily Attempts (Student submissions)
create table daily_attempts (
  user_id uuid references profiles(id) on delete cascade not null,
  date date references daily_challenges(date) on delete cascade not null,
  score integer,
  total_marks integer,
  stats jsonb, -- { accuracy, timeTaken, etc }
  attempt_data jsonb, -- Detailed question-wise analysis
  submitted_at timestamp with time zone default timezone('utc'::text, now()) not null,
  primary key (user_id, date)
);

-- 5. Enable Row Level Security (RLS) - Optional but recommended
alter table profiles enable row level security;
alter table questions enable row level security;
alter table daily_challenges enable row level security;
alter table daily_attempts enable row level security;

-- Simple Policies (Adjust for production)
create policy "Public profiles are viewable by everyone" on profiles for select using (true);
create policy "Users can insert their own profile" on profiles for insert with check (auth.uid() = id);
create policy "Read questions" on questions for select using (true);
create policy "Read daily challenges" on daily_challenges for select using (true);
create policy "Insert attempts" on daily_attempts for insert with check (auth.uid() = user_id);
create policy "Read own attempts" on daily_attempts for select using (auth.uid() = user_id);
```

3.  **Authentication Settings**:
    *   Go to **Authentication -> Providers**. Enable Email/Password.
    *   Disable "Confirm email" if you want instant login for testing.

---

## 4. Deployment

### GitHub
1.  Initialize git: `git init`
2.  Add files: `git add .`
3.  Commit: `git commit -m "Initial commit"`
4.  Push to a new GitHub repository.

### Netlify
1.  Log in to [Netlify](https://netlify.com).
2.  Click **"Add new site"** -> **"Import from Git"**.
3.  Select your GitHub repository.
4.  **Build Settings**:
    *   Build Command: `npm run build`
    *   Publish Directory: `build` (or `dist` depending on Vite/CRA)
5.  **Environment Variables**:
    *   Click "Show advanced" or go to Site Settings -> Environment variables after creation.
    *   Add `REACT_APP_SUPABASE_URL`, `REACT_APP_SUPABASE_ANON_KEY`, and `API_KEY`.
6.  Click **Deploy**.

---

## 5. Post-Deployment Configuration (Admin Panel)

1.  Log in to your live site using the **Root Admin Credentials**:
    *   Email: `example@gmail.com`
    *   Password: `admin123`
2.  Navigate to **Admin Panel** -> **System Settings**.
3.  Enter your **Supabase URL**, **Supabase Anon Key**, and **Google Gemini API Key**.
4.  Click **Save Configuration**. The app will reload and use these keys for all operations.
