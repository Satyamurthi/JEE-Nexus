import { createClient } from '@supabase/supabase-js';

const getEnv = (key: string) => {
  try {
    if (typeof process !== 'undefined' && process.env && process.env[key]) {
      return process.env[key];
    }
    // Check for VITE_ prefixed variables in import.meta.env
    if (typeof import.meta !== 'undefined' && (import.meta as any).env) {
        if ((import.meta as any).env[key]) return (import.meta as any).env[key];
        if ((import.meta as any).env[`VITE_${key}`]) return (import.meta as any).env[`VITE_${key}`];
    }
  } catch (e) {}
  return '';
};

// --- CONFIGURATION ---
const PROVIDED_URL = process.env.SUPABASE_URL || '';
const PROVIDED_KEY = process.env.SUPABASE_ANON_KEY || '';

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

export const isSupabaseConfigured = () => !!supabase;

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
  try {
    await supabase.from('questions').upsert(formattedQuestions, { onConflict: 'statement' });
  } catch (e) {
    console.warn("Supabase upsert failed:", e);
  }
};

export const fetchQuestionsFromDB = async (subject?: string, chapter?: string, limit: number = 10) => {
  if (!supabase) {
    let all = getLocal('nexus_question_bank');
    if (subject) all = all.filter((q: any) => q.subject === subject);
    if (chapter) all = all.filter((q: any) => q.chapter === chapter);
    return all.reverse().slice(0, limit);
  }
  try {
    let query = supabase.from('questions').select('*');
    if (subject) query = query.eq('subject', subject);
    if (chapter) query = query.eq('chapter', chapter);
    const { data, error } = await query.limit(limit).order('created_at', { ascending: false });
    if (error) throw error;
    return data || [];
  } catch (e) {
    console.warn("Supabase fetch failed:", e);
    return [];
  }
};

export const getAllProfiles = async () => {
  if (!supabase) return { data: getLocal('nexus_profiles'), error: null };
  try {
    const response = await supabase.from('profiles').select('*').order('created_at', { ascending: false });
    return response;
  } catch (e: any) {
    return { data: null, error: e };
  }
};

export const getProfile = async (userId: string) => {
  if (!supabase) return getLocal('nexus_profiles').find((p: any) => p.id === userId) || null;
  try {
    const { data } = await supabase.from('profiles').select('*').eq('id', userId).single();
    return data;
  } catch (e) {
    return null;
  }
};

export const updateProfileStatus = async (userId: string, status: string) => {
  if (!supabase) {
    const profiles = getLocal('nexus_profiles');
    setLocal('nexus_profiles', profiles.map((p: any) => p.id === userId ? { ...p, status } : p));
    return null;
  }
  try {
    const { data, error } = await supabase.from('profiles').update({ status }).eq('id', userId).select();
    if (error) return error.message;
    if (!data || data.length === 0) return "Update failed: Permission denied or Profile not found.";
    return null;
  } catch (e: any) {
    return e.message || "Network error during profile update.";
  }
};

export const deleteProfile = async (userId: string) => {
  if (!supabase) {
    const profiles = getLocal('nexus_profiles');
    setLocal('nexus_profiles', profiles.filter((p: any) => p.id !== userId));
    return null;
  }
  try {
    const { error } = await supabase.from('profiles').delete().eq('id', userId);
    return error ? error.message : null;
  } catch (e: any) {
    return e.message;
  }
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
  } catch (e) { 
    return null; 
  }
};

export const getAllDailyChallenges = async () => {
    if (!supabase) return getLocal('nexus_daily_challenges');
    try {
        const { data } = await supabase.from('daily_challenges').select('*').order('date', { ascending: false });
        return data || [];
    } catch (e) {
        return [];
    }
};

export const createDailyChallenge = async (date: string, questions: any[]) => {
  const newChallenge = { date: date, questions: questions, created_at: new Date().toISOString() };
  if (!supabase) {
    const papers = getLocal('nexus_daily_challenges');
    const existingIdx = papers.findIndex((p: any) => p.date === date);
    if (existingIdx >= 0) papers[existingIdx] = newChallenge;
    else papers.push(newChallenge);
    setLocal('nexus_daily_challenges', papers);
    return { data: newChallenge, error: null };
  }
  try {
    const { data, error } = await supabase.from('daily_challenges').upsert(newChallenge, { onConflict: 'date' }).select().single();
    return { data, error };
  } catch (e) { 
    return { data: null, error: e }; 
  }
};

export const submitDailyAttempt = async (userId: string, date: string, score: number, total: number, stats: any, attemptData: any[]) => {
  const attempt = { 
      user_id: userId, 
      date: date, 
      score, 
      total_marks: total, 
      stats, 
      attempt_data: attemptData, 
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
  try {
    const { data, error } = await supabase.from('daily_attempts').upsert(attempt, { onConflict: 'user_id, date' }).select().single();
    return { data, error };
  } catch (e) {
    return { data: null, error: e };
  }
};

export const getUserDailyAttempt = async (userId: string, date: string) => {
  if (!supabase) {
      const attempts = getLocal('nexus_daily_attempts');
      return attempts.find((a: any) => a.user_id === userId && a.date === date) || null;
  }
  try {
    const { data, error } = await supabase.from('daily_attempts').select('*').eq('user_id', userId).eq('date', date).single();
    if (error && error.code !== 'PGRST116') return null;
    return data;
  } catch (e) {
    return null;
  }
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
  try {
    const { data, error } = await supabase.from('daily_attempts').select('*, profiles:user_id ( email, full_name )').eq('date', date).order('score', { ascending: false });
    if (error) return [];
    return data.map((item: any) => ({ ...item, user_email: item.profiles?.email, user_name: item.profiles?.full_name }));
  } catch (e) {
    return [];
  }
};