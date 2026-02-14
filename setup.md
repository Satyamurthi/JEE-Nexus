
# JEE Nexus AI - Comprehensive Setup & Deployment Guide

This guide provides step-by-step instructions to set up **JEE Nexus AI**, a full-stack examination platform featuring Google Gemini AI for question generation and Supabase for backend data persistence.

---

## 1. Prerequisites

Before you begin, ensure you have the following:
*   **Node.js** (v18 or higher) installed.
*   **Git** installed.
*   A **Google Cloud Project** with the **Gemini API** enabled.
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
3.  **Copy and Paste** the entire SQL block below. This script handles:
    *   **Tables**: Creates `profiles`, `questions`, `daily_challenges`, etc.
    *   **Security**: Enables Row Level Security (RLS) so users can't delete each other's data.
    *   **Automation**: Sets up a trigger to automatically create a public profile when a user signs up.
    *   **Admin Seeding**: Automatically creates a root admin account (`name@admin.com` / `admin123`).

```sql
-- ==============================================================================
-- 1. ENABLE CRYPTO EXTENSION
-- Required for generating secure IDs and hashing passwords for the seed admin.
-- ==============================================================================
create extension if not exists pgcrypto;

-- ==============================================================================
-- 2. PUBLIC PROFILES TABLE
-- Extends the default auth.users to store application specific data like role/name.
-- ==============================================================================
create table if not exists public.profiles (
  id uuid references auth.users on delete cascade not null primary key,
  email text unique not null,
  full_name text,
  role text default 'student' check (role in ('student', 'admin')),
  status text default 'pending' check (status in ('pending', 'approved', 'rejected')),
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- RLS: Security Policies for Profiles
alter table public.profiles enable row level security;

-- Policy: Everyone can read basic profile info (needed for leaderboards)
create policy "Public profiles are viewable by everyone" 
on profiles for select using (true);

-- Policy: Users can update their own name
create policy "Users can update own profile" 
on profiles for update using (auth.uid() = id);

-- Policy: Admins can update anyone (to approve/reject students)
create policy "Admins can update all profiles" 
on profiles for update using (
  exists (select 1 from profiles where id = auth.uid() and role = 'admin')
);

-- ==============================================================================
-- 3. USER MANAGEMENT TRIGGERS
-- Automatically creates a row in 'public.profiles' when a user signs up via Auth.
-- ==============================================================================
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, email, full_name, role, status)
  values (
    new.id, 
    new.email, 
    new.raw_user_meta_data->>'full_name', 
    'student', 
    'pending' -- Default status is pending approval
  )
  on conflict (id) do nothing;
  return new;
end;
$$ language plpgsql security definer;

-- Bind the trigger to the auth.users table
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ==============================================================================
-- 4. QUESTION BANK TABLE
-- Stores AI-generated questions to build a community repository.
-- ==============================================================================
create table if not exists public.questions (
  id uuid default gen_random_uuid() primary key,
  subject text not null,
  chapter text,
  type text check (type in ('MCQ', 'Numerical')),
  difficulty text,
  statement text not null,
  options jsonb, -- Array of strings for MCQ options
  "correctAnswer" text not null,
  solution text,
  explanation text,
  concept text,
  "markingScheme" jsonb default '{"positive": 4, "negative": 1}',
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- RLS: Security Policies for Questions
alter table public.questions enable row level security;

-- Policy: Everyone can read questions
create policy "Read questions" 
on questions for select using (true);

-- Policy: Authenticated users can contribute questions (crowdsourcing)
create policy "Insert questions" 
on questions for insert with check (auth.role() = 'authenticated');

-- ==============================================================================
-- 5. DAILY CHALLENGES
-- Stores the specific set of questions for the "Daily Gauntlet".
-- ==============================================================================
create table if not exists public.daily_challenges (
  date date primary key, -- One challenge per day
  questions jsonb not null, -- Stores the array of Question objects
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- RLS: Security Policies for Daily Challenges
alter table public.daily_challenges enable row level security;

create policy "Public Read Daily" 
on daily_challenges for select using (true);

-- Only admins can create/update daily challenges
create policy "Admins Insert Daily" 
on daily_challenges for insert with check (
  exists (select 1 from profiles where id = auth.uid() and role = 'admin')
);

create policy "Admins Update Daily" 
on daily_challenges for update using (
  exists (select 1 from profiles where id = auth.uid() and role = 'admin')
);

-- ==============================================================================
-- 6. DAILY ATTEMPTS
-- Stores student results for the daily challenge.
-- ==============================================================================
create table if not exists public.daily_attempts (
  user_id uuid references public.profiles(id) on delete cascade not null,
  date date references public.daily_challenges(date) on delete cascade not null,
  score integer,
  total_marks integer,
  stats jsonb, -- Stores accuracy, time taken, etc.
  attempt_data jsonb, -- Stores user's specific answers
  submitted_at timestamp with time zone default timezone('utc'::text, now()) not null,
  primary key (user_id, date) -- User can only submit once per day
);

-- RLS: Security Policies for Attempts
alter table public.daily_attempts enable row level security;

create policy "Users can insert own attempts" 
on daily_attempts for insert with check (auth.uid() = user_id);

create policy "Users can view own attempts" 
on daily_attempts for select using (auth.uid() = user_id);

create policy "Admins view all attempts" 
on daily_attempts for select using ( 
  exists (select 1 from profiles where id = auth.uid() and role = 'admin')
);

-- ==============================================================================
-- 7. ADMIN SEEDING (AUTO-CREATE ADMIN)
-- Creates 'name@admin.com' / 'admin123' if it doesn't exist.
-- ==============================================================================
DO $$
DECLARE
  new_user_id UUID := gen_random_uuid();
BEGIN
  -- 1. Insert into auth.users (The Supabase Auth Table)
  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE email = 'name@admin.com') THEN
    INSERT INTO auth.users (
      instance_id, id, aud, role, email, 
      encrypted_password, email_confirmed_at, 
      raw_app_meta_data, raw_user_meta_data, 
      created_at, updated_at, confirmation_token, recovery_token
    )
    VALUES (
      '00000000-0000-0000-0000-000000000000', -- Default Supabase instance ID
      new_user_id,
      'authenticated',
      'authenticated',
      'name@admin.com',
      crypt('admin123', gen_salt('bf')), -- Hashes the password 'admin123'
      now(),
      '{"provider":"email","providers":["email"]}',
      '{"full_name": "System Admin"}',
      now(), now(), '', ''
    );
  END IF;

  -- 2. Upsert into public.profiles to ensure Admin Role
  INSERT INTO public.profiles (id, email, full_name, role, status)
  SELECT id, email, 'System Admin', 'admin', 'approved'
  FROM auth.users WHERE email = 'name@admin.com'
  ON CONFLICT (id) DO UPDATE 
  SET role = 'admin', status = 'approved';

END $$;
```

4.  Click **Run** (bottom right). Ensure the query runs successfully (returns "Success" or "No rows returned").

### Step 2.3: Auth Configuration
1.  Go to **Authentication -> Providers** in Supabase sidebar.
2.  Ensure **Email** is enabled.
3.  (Optional) Disable **Confirm email** if you want to allow users to login immediately without email verification during testing.

---

## 3. Local Development Setup

### Step 3.1: Installation
1.  Clone the repository.
2.  Install dependencies:
    ```bash
    npm install
    ```

### Step 3.2: Environment Variables
Create a file named `.env` in the root directory. Add the following keys:

```env
# Supabase Configuration (Get from Supabase -> Project Settings -> API)
REACT_APP_SUPABASE_URL=your_project_url
REACT_APP_SUPABASE_ANON_KEY=your_anon_public_key

# Google Gemini AI - Multi-Key Setup
# To avoid rate limits, you can provide multiple keys separated by commas,
# OR use indexed variables. The app automatically rotates them.
API_KEY=primary_key_here,secondary_key_here,tertiary_key_here

# Alternative way to define keys (Optional):
# API_KEY_1=key_one
# API_KEY_2=key_two
```

**Note on Multi-API Keys:**
The system is architected to handle high-volume question generation by automatically rotating through available API keys. If one key hits a Rate Limit (429) or Quota error, the system seamlessly switches to the next available key, ensuring uninterrupted exam generation.

*Note: If you are deploying to Vercel/Netlify, add these in their respective "Environment Variables" settings UI.*

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
*   This uses the `API_KEY` pool to call Google Gemini. If it fails, check your API quota or key validity.

---

## 5. Deployment (Netlify/Vercel)

1.  Push your code to **GitHub**.
2.  Go to **Netlify** or **Vercel** and import the project.
3.  **Build Settings:**
    *   **Build Command:** `npm run build`
    *   **Output Directory:** `build`
4.  **Environment Variables:**
    *   Copy the values from your local `.env` file into the deployment platform's environment variable settings. Ensure you add all your API keys.
5.  Deploy.

---

## Troubleshooting

*   **"Failed to fetch"**: Usually means the API Key is missing or the Supabase URL is incorrect. Check `.env`.
*   **"All API keys failed"**: Ensure you have valid keys in your `.env` file and that you haven't exhausted the quota on all of them.
*   **Login fails**: If the seeded admin login fails, ensure you ran the SQL script *after* enabling Email Auth. You can manually delete the user in Supabase Auth and re-run the seeding SQL block.
*   **White Screen**: Check the console (`F12`) for errors. Ensure `react-router-dom` matches the version in `package.json`.
