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
2.  Go to the **SQL Editor** and run the following script. This script will create all tables, set up permissions (RLS), and **automatically create your Admin account**.

**Run this entire block at once:**

```sql
-- ==========================================
-- 1. EXTENSIONS & CORE TABLES
-- ==========================================
create extension if not exists pgcrypto;

-- PROFILES TABLE (Extends Auth)
create table if not exists public.profiles (
  id uuid references auth.users on delete cascade not null primary key,
  email text unique not null,
  full_name text,
  role text default 'student' check (role in ('student', 'admin')),
  status text default 'pending' check (status in ('pending', 'approved', 'rejected')),
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- ==========================================
-- 2. ADMIN PROVISIONING (CRITICAL)
-- ==========================================
-- This block creates name@admin.com with password admin123
-- If user already exists, it updates their status to admin.

DO $$
DECLARE
  new_user_id UUID := gen_random_uuid();
BEGIN
  -- Check if admin exists in auth.users
  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE email = 'name@admin.com') THEN
    INSERT INTO auth.users (
      instance_id, id, aud, role, email, 
      encrypted_password, email_confirmed_at, 
      raw_app_meta_data, raw_user_meta_data, 
      created_at, updated_at, confirmation_token, 
      recovery_token
    )
    VALUES (
      '00000000-0000-0000-0000-000000000000',
      new_user_id,
      'authenticated',
      'authenticated',
      'name@admin.com',
      crypt('admin123', gen_salt('bf')), -- Generates hashed 'admin123'
      now(),
      '{"provider":"email","providers":["email"]}',
      '{"full_name": "System Admin"}',
      now(), now(), '', ''
    );
  END IF;

  -- Ensure the record exists in public.profiles and set as approved admin
  INSERT INTO public.profiles (id, email, full_name, role, status)
  SELECT id, email, 'System Admin', 'admin', 'approved'
  FROM auth.users WHERE email = 'name@admin.com'
  ON CONFLICT (id) DO UPDATE 
  SET role = 'admin', status = 'approved', full_name = 'System Admin';

END $$;

-- ==========================================
-- 3. PERMISSIONS & TRIGGERS
-- ==========================================
alter table public.profiles enable row level security;

-- RESET PROFILE POLICIES
drop policy if exists "Public profiles are viewable by everyone" on profiles;
create policy "Public profiles are viewable by everyone" on profiles for select using (true);

drop policy if exists "Users can update own profile" on profiles;
create policy "Users can update own profile" on profiles for update using (auth.uid() = id);

drop policy if exists "Admins can update all profiles" on profiles;
create policy "Admins can update all profiles" on profiles for update using (
  exists (select 1 from profiles where id = auth.uid() and role = 'admin')
);

-- AUTO-CREATE PROFILE FUNCTION
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, email, full_name, role, status)
  values (new.id, new.email, new.raw_user_meta_data->>'full_name', 'student', 'pending')
  on conflict (id) do nothing;
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ==========================================
-- 4. APPLICATION DATA TABLES
-- ==========================================

-- QUESTIONS BANK
create table if not exists public.questions (
  id uuid default gen_random_uuid() primary key,
  subject text not null,
  chapter text,
  type text check (type in ('MCQ', 'Numerical')),
  difficulty text,
  statement text not null,
  options jsonb, 
  "correctAnswer" text not null,
  solution text,
  explanation text,
  concept text,
  "markingScheme" jsonb default '{"positive": 4, "negative": 1}',
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);
alter table public.questions enable row level security;
create policy "Read questions" on questions for select using (true);
create policy "Insert questions" on questions for insert with check (true);

-- DAILY CHALLENGES
create table if not exists public.daily_challenges (
  date date primary key,
  questions jsonb not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);
alter table public.daily_challenges enable row level security;
create policy "Public Read Daily" on daily_challenges for select using (true);
create policy "Public Insert Daily" on daily_challenges for insert with check (true);
create policy "Public Update Daily" on daily_challenges for update using (true);

-- DAILY ATTEMPTS
create table if not exists public.daily_attempts (
  user_id uuid references public.profiles(id) on delete cascade not null,
  date date references public.daily_challenges(date) on delete cascade not null,
  score integer,
  total_marks integer,
  stats jsonb,
  attempt_data jsonb,
  submitted_at timestamp with time zone default timezone('utc'::text, now()) not null,
  primary key (user_id, date)
);
alter table public.daily_attempts enable row level security;
create policy "Users can insert own attempts" on daily_attempts for insert with check (auth.uid() = user_id);
create policy "Users can view own attempts" on daily_attempts for select using (auth.uid() = user_id);
create policy "Admins view all attempts" on daily_attempts for select using ( 
  exists (select 1 from profiles where id = auth.uid() and role = 'admin')
);
```

3.  **Authentication Settings**:
    *   Go to **Authentication -> Providers**. Enable Email/Password.
    *   **Disable "Confirm email"** in Supabase settings if you want to login immediately with `admin123`.

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
    *   Publish Directory: `build`
5.  **Environment Variables**:
    *   Add `REACT_APP_SUPABASE_URL`, `REACT_APP_SUPABASE_ANON_KEY`, and `API_KEY`.
6.  Click **Deploy**.

---

## 5. First Login

1.  Navigate to your live URL.
2.  Go to the **Login** page.
3.  Login with:
    *   Email: **name@admin.com**
    *   Password: **admin123**
4.  Navigate to the **Admin Panel** to configure your API keys and manage other students.
