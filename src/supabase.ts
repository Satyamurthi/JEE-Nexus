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

const generateId = () => {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
  return Math.random().toString(36).substring(2, 15);
};

export const saveQuestionsToDB = async (questions: any[]) => {
  const formattedQuestions = questions.map(q => ({ ...q, id: q.id || generateId() }));
  if (!supabase) return;
  try {
    await supabase.from('questions').upsert(formattedQuestions, { onConflict: 'statement' });
  } catch (e) {
    console.warn("Supabase upsert failed:", e);
  }
};

export const fetchQuestionsFromDB = async (subject?: string, chapter?: string, topics?: string[], mcqCount: number = 10, numericalCount: number = 0) => {
  if (!supabase) return [];
  try {
    const fetchByType = async (type: string, count: number) => {
        if (count <= 0) return [];
        let query = supabase.from('questions').select('*').eq('type', type);
        if (subject) query = query.eq('subject', subject);
        if (chapter) query = query.eq('chapter', chapter);
        if (topics && topics.length > 0) query = query.in('concept', topics); // Assuming 'concept' is used for topics in DB
        const { data, error } = await query.limit(count).order('created_at', { ascending: false });
        if (error) throw error;
        return data || [];
    };

    const [mcqs, numericals] = await Promise.all([
        fetchByType('MCQ', mcqCount),
        fetchByType('Numerical', numericalCount)
    ]);

    return [...mcqs, ...numericals];
  } catch (e) {
    console.warn("Supabase fetch failed:", e);
    return [];
  }
};

export const submitExamAttempt = async (attempt: any) => {
  if (!supabase) return { data: null, error: "Supabase not configured" };
  try {
    const { data, error } = await supabase.from('exam_attempts').insert(attempt).select().single();
    return { data, error };
  } catch (e) {
    return { data: null, error: e };
  }
};

export const getUserExamAttempts = async (userId: string) => {
  if (!supabase) return [];
  try {
    const { data, error } = await supabase.from('exam_attempts').select('*').eq('user_id', userId).order('submitted_at', { ascending: false });
    if (error) return [];
    return data;
  } catch (e) {
    return [];
  }
};

export const getUserAllDailyAttempts = async (userId: string) => {
    if (!supabase) return [];
    try {
      const { data, error } = await supabase.from('daily_attempts').select('*').eq('user_id', userId).order('submitted_at', { ascending: false });
      if (error) return [];
      return data;
    } catch (e) {
      return [];
    }
};

export const getAllProfiles = async () => {
  if (!supabase) return { data: [], error: "Supabase not configured" };
  try {
    const response = await supabase.from('profiles').select('*').order('created_at', { ascending: false });
    return response;
  } catch (e: any) {
    return { data: [], error: e };
  }
};

export const getProfile = async (userId: string) => {
  if (!supabase) return null;
  try {
    const { data } = await supabase.from('profiles').select('*').eq('id', userId).single();
    return data;
  } catch (e) {
    return null;
  }
};

export const updateProfileStatus = async (userId: string, status: string) => {
  if (!supabase) return "Supabase not configured";

  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return "Cloud session required for cloud updates. Please sign in to Cloud in the Admin panel.";

    const { data, error } = await supabase.from('profiles').update({ status }).eq('id', userId).select();
    if (error) {
      console.error("Supabase update error:", error);
      return error.message;
    }
    if (!data || data.length === 0) {
      return "Update failed: Permission denied or Profile not found in Cloud.";
    }
    return null;
  } catch (e: any) {
    return e.message || "Network error during profile update.";
  }
};

export const deleteProfile = async (userId: string) => {
  if (!supabase) return "Supabase not configured";

  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return "Cloud session required for cloud updates.";

    const { error } = await supabase.from('profiles').delete().eq('id', userId);
    if (error) {
      console.error("Supabase delete error:", error);
      return error.message;
    }
    return null;
  } catch (e: any) {
    return e.message || "Network error during profile deletion.";
  }
};

export const syncLocalProfilesToSupabase = async () => {
  return { success: true, message: "Local sync disabled. System is Cloud-only." };
};

export const getDailyChallenge = async (date: string) => {
  if (!supabase) return null;
  try {
    const { data, error } = await supabase.from('daily_challenges').select('*').eq('date', date).single();
    if (error && error.code !== 'PGRST116') console.warn("Daily fetch error:", error);
    return data;
  } catch (e) { 
    return null; 
  }
};

export const getAllDailyChallenges = async () => {
    if (!supabase) return [];
    try {
        const { data } = await supabase.from('daily_challenges').select('*').order('date', { ascending: false });
        return data || [];
    } catch (e) {
        return [];
    }
};

export const createDailyChallenge = async (date: string, questions: any[]) => {
  const newChallenge = { date: date, questions: questions, created_at: new Date().toISOString() };
  if (!supabase) return { data: null, error: "Supabase not configured" };
  try {
    const { data, error } = await supabase.from('daily_challenges').upsert(newChallenge, { onConflict: 'date' }).select().single();
    return { data, error };
  } catch (e) { 
    return { data: null, error: e }; 
  }
};

export const submitDailyAttempt = async (attempt: any) => {
  if (!supabase) return { data: null, error: "Supabase not configured" };
  try {
    const { data, error } = await supabase.from('daily_attempts').upsert(attempt, { onConflict: 'user_id, date' }).select().single();
    return { data, error };
  } catch (e) {
    return { data: null, error: e };
  }
};

export const getUserDailyAttempt = async (userId: string, date: string) => {
  if (!supabase) return null;
  try {
    const { data, error } = await supabase.from('daily_attempts').select('*').eq('user_id', userId).eq('date', date).single();
    if (error && error.code !== 'PGRST116') return null;
    return data;
  } catch (e) {
    return null;
  }
};

export const getDailyAttempts = async (date: string) => {
  if (!supabase) return [];
  try {
    const { data, error } = await supabase.from('daily_attempts').select('*, profiles:user_id ( email, full_name )').eq('date', date).order('score', { ascending: false });
    if (error) return [];
    return data.map((item: any) => ({ ...item, user_email: item.profiles?.email, user_name: item.profiles?.full_name }));
  } catch (e) {
    return [];
  }
};
