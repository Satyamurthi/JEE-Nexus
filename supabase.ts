
import { createClient } from '@supabase/supabase-js';

const getEnv = (key: string) => {
  try {
    // Check process.env (Standard in this environment)
    if (typeof process !== 'undefined' && process.env && process.env[key]) {
      return process.env[key];
    }
    // Check import.meta.env (Vite standard)
    if (typeof import.meta !== 'undefined' && (import.meta as any).env && (import.meta as any).env[key]) {
      return (import.meta as any).env[key];
    }
  } catch (e) {}
  return '';
};

// --- CONFIGURATION ---
// Credentials for Satyamurthi's Project
const PROVIDED_URL = 'https://phhknvfsvppxxrtzmccx.supabase.co';
const PROVIDED_KEY = 'sb_publishable_iiPlmfG0VopNWz0R41rL6A_CpgXXveh';

// Check for Custom Admin Override First
const getCustomConfig = () => {
  if (typeof window === 'undefined') return { url: '', key: '' };
  try {
    const custom = JSON.parse(localStorage.getItem('custom_supabase_config') || '{}');
    return custom;
  } catch(e) { return { url: '', key: '' }; }
};

const customConfig = getCustomConfig();

const supabaseUrl = customConfig.url || getEnv('SUPABASE_URL') || getEnv('VITE_SUPABASE_URL') || getEnv('REACT_APP_SUPABASE_URL') || PROVIDED_URL;
const supabaseAnonKey = customConfig.key || getEnv('SUPABASE_ANON_KEY') || getEnv('VITE_SUPABASE_ANON_KEY') || getEnv('REACT_APP_SUPABASE_ANON_KEY') || PROVIDED_KEY;

export const supabase = (supabaseUrl && supabaseAnonKey) 
  ? createClient(supabaseUrl, supabaseAnonKey) 
  : null;

// --- LOCAL STORAGE MOCK HELPERS ---
// Used as fallback if Supabase connection fails or for offline resilience

const getLocal = (key: string) => {
  if (typeof window === 'undefined') return [];
  try { return JSON.parse(localStorage.getItem(key) || '[]'); } catch (e) { return []; }
};

const setLocal = (key: string, data: any) => {
  if (typeof window === 'undefined') return;
  localStorage.setItem(key, JSON.stringify(data));
};

const generateId = () => {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
  return Math.random().toString(36).substring(2, 15);
};

// --- SEEDING LOGIC ---

export const seedMockData = () => {
  if (typeof window === 'undefined') return;
  
  const currentProfiles = getLocal('nexus_profiles');
  
  const studentBatch = [
    { email: 'SAMARTH@ABC.COM', name: 'SAMARTH' },
    { email: 'SAMVITH@ABC.COM', name: 'SAMVITH' },
    { email: 'PARTHA@ABC.COM', name: 'PARTHA' },
    { email: 'TEJAS@ABC.COM', name: 'TEJAS' },
    { email: 'KUSHAL@ABC.COM', name: 'KUSHAL' },
    { email: 'APEKSHA@ABC.COM', name: 'APEKSHA' },
    { email: 'YUKTHI@ABC.COM', name: 'YUKTHI' },
    { email: 'NANDITHA@ABC.COM', name: 'NANDITHA' },
    { email: 'CHANDU@ABC.COM', name: 'CHANDU' }
  ];

  let hasChanges = false;

  if (currentProfiles.length === 0) {
    currentProfiles.push(
      { id: 'mock-1', email: 'demo@nexus.com', full_name: 'Demo Aspirant', role: 'student', status: 'approved', created_at: new Date().toISOString() },
      { id: 'admin-root-nexus', email: 'example@gmail.com', full_name: 'System Admin', role: 'admin', status: 'approved', created_at: new Date().toISOString() }
    );
    hasChanges = true;
  }

  studentBatch.forEach((s, idx) => {
      const exists = currentProfiles.find((p: any) => p.email.toLowerCase() === s.email.toLowerCase());
      if (!exists) {
          currentProfiles.push({
              id: `batch-student-${idx}`,
              email: s.email,
              full_name: s.name,
              role: 'student',
              status: 'approved',
              created_at: new Date().toISOString()
          });
          hasChanges = true;
      } else if (exists.status !== 'approved') {
          exists.status = 'approved';
          hasChanges = true;
      }
  });

  if (hasChanges) setLocal('nexus_profiles', currentProfiles);
  return hasChanges;
};

if (typeof window !== 'undefined' && !supabase) {
    seedMockData();
}

// --- CORE FUNCTIONS ---

export const saveQuestionsToDB = async (questions: any[]) => {
  const formattedQuestions = questions.map(q => ({ ...q, id: q.id || generateId() }));
  if (!supabase) {
    const currentBank = getLocal('nexus_question_bank');
    const merged = [...currentBank];
    formattedQuestions.forEach(q => {
      const idx = merged.findIndex(existing => existing.statement === q.statement);
      if (idx >= 0) merged[idx] = q;
      else merged.push(q);
    });
    setLocal('nexus_question_bank', merged);
    return;
  }
  await supabase.from('questions').upsert(formattedQuestions, { onConflict: 'statement' });
};

export const fetchQuestionsFromDB = async (subject?: string, chapter?: string, limit: number = 10) => {
  if (!supabase) {
    let all = getLocal('nexus_question_bank');
    if (subject) all = all.filter((q: any) => q.subject === subject);
    if (chapter) all = all.filter((q: any) => q.chapter === chapter);
    return all.reverse().slice(0, limit);
  }
  let query = supabase.from('questions').select('*');
  if (subject) query = query.eq('subject', subject);
  if (chapter) query = query.eq('chapter', chapter);
  const { data } = await query.limit(limit).order('created_at', { ascending: false });
  return data || [];
};

export const getAllProfiles = async () => {
  if (!supabase) return { data: getLocal('nexus_profiles'), error: null };
  return await supabase.from('profiles').select('*').order('created_at', { ascending: false });
};

export const getProfile = async (userId: string) => {
  if (!supabase) return getLocal('nexus_profiles').find((p: any) => p.id === userId) || null;
  const { data } = await supabase.from('profiles').select('*').eq('id', userId).single();
  return data;
};

export const updateProfileStatus = async (userId: string, status: string) => {
  if (!supabase) {
    const profiles = getLocal('nexus_profiles');
    setLocal('nexus_profiles', profiles.map((p: any) => p.id === userId ? { ...p, status } : p));
    return null;
  }
  const { error } = await supabase.from('profiles').update({ status }).eq('id', userId);
  return error ? error.message : null;
};

export const deleteProfile = async (userId: string) => {
  if (!supabase) {
    const profiles = getLocal('nexus_profiles');
    setLocal('nexus_profiles', profiles.filter((p: any) => p.id !== userId));
    return null;
  }
  const { error } = await supabase.from('profiles').delete().eq('id', userId);
  return error ? error.message : null;
};

export const getDailyChallenge = async (date: string) => {
  if (!supabase) {
    const papers = getLocal('nexus_daily_challenges');
    return papers.find((p: any) => p.date === date) || null;
  }
  try {
    const { data, error } = await supabase.from('daily_challenges').select('*').eq('date', date).single();
    if (error && error.code !== 'PGRST116') console.warn("Daily fetch error:", error);
    return data;
  } catch (e) { return null; }
};

export const getAllDailyChallenges = async () => {
    if (!supabase) return getLocal('nexus_daily_challenges');
    const { data } = await supabase.from('daily_challenges').select('*').order('date', { ascending: false });
    return data || [];
};

export const createDailyChallenge = async (date: string, questions: any[]) => {
  const newChallenge = { date: date, questions: questions, created_at: new Date().toISOString() };
  if (!supabase) {
    const papers = getLocal('nexus_daily_challenges');
    const existingIdx = papers.findIndex((p: any) => p.date === date);
    if (existingIdx >= 0) {
        // Overwrite if requested (handled by UI logic mostly, but here for safety)
        papers[existingIdx] = newChallenge;
    } else {
        papers.push(newChallenge);
    }
    setLocal('nexus_daily_challenges', papers);
    return newChallenge;
  }
  try {
    const { data, error } = await supabase.from('daily_challenges').upsert(newChallenge, { onConflict: 'date' }).select().single();
    if (error) throw error;
    return data;
  } catch (e) { return null; }
};

export const submitDailyAttempt = async (userId: string, date: string, score: number, total: number, stats: any, attemptData: any[]) => {
  const attempt = { 
      user_id: userId, 
      date: date, 
      score, 
      total_marks: total, 
      stats, 
      attempt_data: attemptData, // The detailed questions array with user answers
      submitted_at: new Date().toISOString() 
  };

  if (!supabase) {
      const attempts = getLocal('nexus_daily_attempts');
      const existingIdx = attempts.findIndex((a: any) => a.user_id === userId && a.date === date);
      if (existingIdx >= 0) attempts[existingIdx] = attempt;
      else attempts.push(attempt);
      setLocal('nexus_daily_attempts', attempts);
      return attempt;
  }
  
  const { data, error } = await supabase.from('daily_attempts').upsert(attempt, { onConflict: 'user_id, date' }).select().single();
  if (error) console.error("Submit Error", error);
  return { data, error };
};

export const getUserDailyAttempt = async (userId: string, date: string) => {
  if (!supabase) {
      const attempts = getLocal('nexus_daily_attempts');
      return attempts.find((a: any) => a.user_id === userId && a.date === date) || null;
  }
  const { data, error } = await supabase.from('daily_attempts').select('*').eq('user_id', userId).eq('date', date).single();
  if (error && error.code !== 'PGRST116') return null;
  return data;
};

export const getDailyAttempts = async (date: string) => {
  if (!supabase) {
      const attempts = getLocal('nexus_daily_attempts');
      const profiles = getLocal('nexus_profiles');
      return attempts.filter((a: any) => a.date === date).map((a: any) => {
          const user = profiles.find((p: any) => p.id === a.user_id);
          return { ...a, user_email: user?.email || 'Deleted User', user_name: user?.full_name || 'Unknown' };
      }).sort((a: any, b: any) => b.score - a.score);
  }
  const { data, error } = await supabase.from('daily_attempts').select('*, profiles:user_id ( email, full_name )').eq('date', date).order('score', { ascending: false });
  if (error) return [];
  return data.map((item: any) => ({ ...item, user_email: item.profiles?.email, user_name: item.profiles?.full_name }));
};
