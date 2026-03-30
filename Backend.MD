# Supabase Backend Setup Guide for JEE Nexus AI

This guide provides the complete SQL script to initialize your Supabase database, set up all required tables, configure Row Level Security (RLS) policies, and provision the default admin account.

## Prerequisites
1. Create a new project on [Supabase](https://supabase.com/).
2. Navigate to the **SQL Editor** in your Supabase dashboard.
3. Click on **New Query**.

## Step 1: Execute the Initialization Script

Copy and paste the following SQL script into the SQL Editor and click **Run**. This will create all necessary tables, configure security, and create the admin user (`satyu000@gmail.com` / `admin123`).

```sql
-- ==========================================
-- JEE NEXUS AI - COMPLETE DATABASE SETUP
-- ==========================================

-- 1. EXTENSIONS
create extension if not exists pgcrypto;

-- 2. CORE TABLES

-- Profiles Table
create table if not exists public.profiles (
  id uuid references auth.users on delete cascade not null primary key,
  email text unique not null,
  full_name text,
  role text default 'student' check (role in ('student', 'admin')),
  status text default 'pending' check (status in ('pending', 'approved', 'rejected')),
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Questions Table
create table if not exists public.questions (
  id uuid default gen_random_uuid() primary key,
  subject text not null,
  chapter text,
  type text,
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

-- Daily Challenges Table
create table if not exists public.daily_challenges (
  date date primary key,
  questions jsonb not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Daily Attempts Table
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

-- Exam Attempts Table
create table if not exists public.exam_attempts (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  user_name text,
  score integer,
  total_marks integer,
  accuracy integer,
  config jsonb,
  questions jsonb,
  submitted_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 3. ADMIN PROVISIONING
-- Creates the requested admin user: satyu000@gmail.com / admin123
DO $$
DECLARE
  new_user_id UUID := gen_random_uuid();
BEGIN
  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE email = 'satyu000@gmail.com') THEN
    INSERT INTO auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
    VALUES ('00000000-0000-0000-0000-000000000000', new_user_id, 'authenticated', 'authenticated', 'satyu000@gmail.com', crypt('admin123', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{"full_name": "System Admin"}', now(), now());
  END IF;
  
  INSERT INTO public.profiles (id, email, full_name, role, status)
  SELECT id, email, 'System Admin', 'admin', 'approved' FROM auth.users WHERE email = 'satyu000@gmail.com'
  ON CONFLICT (id) DO UPDATE SET role = 'admin', status = 'approved';
END $$;

-- 4. ROW LEVEL SECURITY (RLS) POLICIES

-- Profiles RLS
alter table public.profiles enable row level security;
drop policy if exists "Public profiles are viewable by everyone" on profiles;
create policy "Public profiles are viewable by everyone" on profiles for select using (true);

drop policy if exists "Users can update own profile" on profiles;
create policy "Users can update own profile" on profiles for update using (auth.uid() = id);

drop policy if exists "Admins can update all profiles" on profiles;
create policy "Admins can update all profiles" on profiles for update using (exists (select 1 from profiles where id = auth.uid() and role = 'admin'));

-- Questions RLS
alter table public.questions enable row level security;
drop policy if exists "Read questions" on questions;
create policy "Read questions" on questions for select using (true);

drop policy if exists "Insert questions" on questions;
create policy "Insert questions" on questions for insert with check (true);

-- Daily Challenges RLS
alter table public.daily_challenges enable row level security;
drop policy if exists "Public Read Daily" on daily_challenges;
create policy "Public Read Daily" on daily_challenges for select using (true);

drop policy if exists "Public Insert Daily" on daily_challenges;
create policy "Public Insert Daily" on daily_challenges for insert with check (true);

drop policy if exists "Public Update Daily" on daily_challenges;
create policy "Public Update Daily" on daily_challenges for update using (true);

-- Daily Attempts RLS
alter table public.daily_attempts enable row level security;
drop policy if exists "Users can insert own attempts" on daily_attempts;
create policy "Users can insert own attempts" on daily_attempts for insert with check (auth.uid() = user_id);

drop policy if exists "Users can view own attempts" on daily_attempts;
create policy "Users can view own attempts" on daily_attempts for select using (auth.uid() = user_id);

drop policy if exists "Admins view all attempts" on daily_attempts;
create policy "Admins view all attempts" on daily_attempts for select using (exists (select 1 from profiles where id = auth.uid() and role = 'admin'));

-- Exam Attempts RLS
alter table public.exam_attempts enable row level security;
drop policy if exists "Users can insert own exam attempts" on exam_attempts;
create policy "Users can insert own exam attempts" on exam_attempts for insert with check (auth.uid() = user_id);

drop policy if exists "Users can view own exam attempts" on exam_attempts;
create policy "Users can view own exam attempts" on exam_attempts for select using (auth.uid() = user_id);

drop policy if exists "Admins view all exam attempts" on exam_attempts;
create policy "Admins view all exam attempts" on exam_attempts for select using (exists (select 1 from profiles where id = auth.uid() and role = 'admin'));
```

## Step 2: Connect the App

After running the script, retrieve your Supabase credentials:
1. Go to **Project Settings** -> **API**.
2. Copy the **Project URL** and the **anon / public** key.

Add these to your `.env` file or configure them in the Admin Panel's "Database Utility" section:

```env
VITE_SUPABASE_URL=your_supabase_project_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
```

## Step 3: Login

You can now log in to the application using the admin credentials you just provisioned:

- **Email:** `satyu000@gmail.com`
- **Password:** `admin123`
