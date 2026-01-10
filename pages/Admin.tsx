
import React, { useState, useEffect, useRef } from 'react';
import { Shield, Plus, RefreshCw, Search, UserCheck, UserX, Loader2, Users, Crown, Mail, ShieldCheck, Zap, Trash2, ShieldAlert, Copy, ExternalLink, CloudOff, Activity, MoreHorizontal, X, Save, Eye, EyeOff, CheckCircle2, ChevronDown, UserPlus, Database, Calendar, CalendarClock, RotateCcw, Medal, FileUp, FileText, AlertTriangle, ArrowRight, XCircle, Key, Lock, Server, Sparkles, Sliders, Atom, Beaker, FunctionSquare, Layers, Cpu, Dices, Printer, Download, Terminal, FileSpreadsheet } from 'lucide-react';
import { getAllProfiles, updateProfileStatus, deleteProfile, saveQuestionsToDB, supabase, getAllDailyChallenges, createDailyChallenge, seedMockData, getDailyAttempts } from '../supabase';
import { generateFullJEEDailyPaper, parseDocumentToQuestions } from '../geminiService';
import { useNavigate } from 'react-router-dom';
import { NCERT_CHAPTERS } from '../constants';
import { Subject, QuestionType, Difficulty, ExamType } from '../types';
import MathText from '../components/MathText';
import { motion, AnimatePresence } from 'framer-motion';

type UserStatus = 'all' | 'pending' | 'approved' | 'rejected';

interface SubjectConfig {
    mcq: number;
    numerical: number;
    chapters: string[];
    topics: string[];
}

interface GenerationConfig {
  physics: SubjectConfig;
  chemistry: SubjectConfig;
  mathematics: SubjectConfig;
}

const ConfirmDialog = ({ isOpen, title, message, onConfirm, onCancel }: any) => {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-[2rem] p-8 w-full max-w-sm shadow-2xl scale-100 border border-slate-100">
        <h3 className="text-xl font-black text-slate-900 mb-3">{title}</h3>
        <p className="text-slate-500 font-medium mb-8 leading-relaxed text-sm">{message}</p>
        <div className="flex justify-end gap-3">
          <button onClick={onCancel} className="px-6 py-3 bg-slate-100 text-slate-500 rounded-xl font-bold text-xs hover:bg-slate-200 transition-colors">Cancel</button>
          <button onClick={onConfirm} className="px-6 py-3 bg-slate-900 text-white rounded-xl font-bold text-xs hover:bg-slate-800 shadow-lg transition-all">Confirm</button>
        </div>
      </div>
    </div>
  );
};

// ... (Rest of existing ConfirmDialog, SqlFixDialog, ToastNotification, SubjectConfigModal code remains exactly the same, I will include them to ensure file integrity)

const SqlFixDialog = ({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) => {
  if (!isOpen) return null;
  
  const sqlCode = `-- 1. Enable Crypto Extension (Required for password reset)
create extension if not exists pgcrypto;

-- 2. Fix Permissions (RLS)
alter table daily_challenges enable row level security;
alter table daily_attempts enable row level security;
alter table profiles enable row level security;

-- Policies (Drop & Recreate to ensure correctness)
drop policy if exists "Public Read Daily" on daily_challenges;
create policy "Public Read Daily" on daily_challenges for select using (true);

drop policy if exists "Public Insert Daily" on daily_challenges;
create policy "Public Insert Daily" on daily_challenges for insert with check (true);

drop policy if exists "Public Update Daily" on daily_challenges;
create policy "Public Update Daily" on daily_challenges for update using (true);

drop policy if exists "Users can insert own attempts" on daily_attempts;
create policy "Users can insert own attempts" on daily_attempts for insert with check (auth.uid() = user_id);

drop policy if exists "Users can view own attempts" on daily_attempts;
create policy "Users can view own attempts" on daily_attempts for select using (auth.uid() = user_id);

drop policy if exists "Admins view all attempts" on daily_attempts;
create policy "Admins view all attempts" on daily_attempts for select using ( 
  exists (select 1 from profiles where id = auth.uid() and role = 'admin')
);

drop policy if exists "Public profiles are viewable by everyone" on profiles;
create policy "Public profiles are viewable by everyone" on profiles for select using (true);

drop policy if exists "Users can update own profile" on profiles;
create policy "Users can update own profile" on profiles for update using (auth.uid() = id);

drop policy if exists "Admins can update all profiles" on profiles;
create policy "Admins can update all profiles" on profiles for update using (
  exists (select 1 from profiles where id = auth.uid() and role = 'admin')
);

-- 3. Auto-Create Profile Trigger
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

-- 4. FORCE SYNC: Fix Missing Profiles for Existing Users
INSERT INTO public.profiles (id, email, full_name, role, status)
SELECT id, email, raw_user_meta_data->>'full_name', 'student', 'pending'
FROM auth.users
ON CONFLICT (id) DO NOTHING;

-- 5. CRITICAL: Fix Admin User (name@admin.com)
-- This resets the password to 'admin123' if the user exists
UPDATE auth.users
SET 
    encrypted_password = crypt('admin123', gen_salt('bf')),
    email_confirmed_at = now(),
    raw_user_meta_data = jsonb_set(COALESCE(raw_user_meta_data, '{}'::jsonb), '{full_name}', '"System Admin"')
WHERE email = 'name@admin.com';

-- 6. Grant Admin Role
UPDATE public.profiles
SET role = 'admin', status = 'approved'
WHERE email = 'name@admin.com';

-- NOTE: If you still cannot login, the user 'name@admin.com' does not exist.
-- Please go to the Signup page and create it first.`;

  const [copied, setCopied] = useState(false);
  const handleCopy = () => {
      navigator.clipboard.writeText(sqlCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center bg-slate-900/90 backdrop-blur-md p-4 animate-in fade-in duration-200">
      <div className="bg-slate-950 rounded-2xl w-full max-w-3xl overflow-hidden shadow-2xl border border-slate-800 flex flex-col max-h-[90vh]">
        <div className="p-6 border-b border-slate-800 flex justify-between items-center bg-slate-900">
            <h3 className="text-xl font-bold text-red-400 flex items-center gap-3">
                <ShieldAlert className="w-6 h-6" /> Comprehensive Database Repair
            </h3>
            <button onClick={onClose}><X className="text-slate-400 hover:text-white" /></button>
        </div>
        <div className="p-8 overflow-y-auto custom-scrollbar">
            <p className="text-slate-300 mb-6 leading-relaxed">
                Run this script to fix <strong>Invalid Credentials</strong> or <strong>View Only</strong> mode.<br/>
                It performs a hard reset on the admin account settings in the database.
                <ul className="list-disc list-inside mt-2 text-slate-400 text-sm space-y-1">
                    <li className="text-yellow-400">Resets 'name@admin.com' password to 'admin123'</li>
                    <li>Auto-confirms email address (Fixes Login)</li>
                    <li>Restores Admin permissions</li>
                    <li>Fixes Row Level Security (RLS)</li>
                </ul>
            </p>
            <div className="flex items-center gap-2 mb-2 text-xs font-bold text-slate-500 uppercase tracking-widest">
                <Terminal className="w-4 h-4" /> SQL Solution
            </div>
            <div className="bg-black rounded-xl p-6 border border-slate-800 relative group">
                <pre className="text-green-400 font-mono text-sm overflow-x-auto whitespace-pre-wrap leading-relaxed">
                    {sqlCode}
                </pre>
                <button 
                    onClick={handleCopy} 
                    className="absolute top-4 right-4 px-4 py-2 bg-slate-800 hover:bg-slate-700 rounded-lg text-white text-xs font-bold transition-all flex items-center gap-2 border border-slate-700"
                >
                    {copied ? <CheckCircle2 className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4" />}
                    {copied ? 'Copied' : 'Copy SQL'}
                </button>
            </div>
            <div className="mt-6 flex gap-4 items-start p-4 bg-blue-900/20 border border-blue-900/50 rounded-xl">
                <Database className="w-5 h-5 text-blue-400 shrink-0 mt-0.5" />
                <div className="space-y-1">
                    <p className="text-blue-200 text-sm font-bold">How to apply:</p>
                    <ol className="text-blue-300/80 text-sm list-decimal pl-4 space-y-1">
                        <li>Copy the SQL above.</li>
                        <li>Go to Supabase Dashboard → <strong>SQL Editor</strong> → New Query.</li>
                        <li>Paste and Click <strong>Run</strong>.</li>
                        <li><strong>Log Out</strong> and Log In with <code>name@admin.com</code> / <code>admin123</code>.</li>
                    </ol>
                </div>
            </div>
        </div>
        <div className="p-6 border-t border-slate-800 bg-slate-900 flex justify-end">
            <button onClick={onClose} className="px-8 py-3 bg-white text-slate-950 font-bold rounded-xl hover:bg-slate-200 transition-colors">Dismiss</button>
        </div>
      </div>
    </div>
  );
};

const ToastNotification = ({ message, type, onClose }: any) => {
  useEffect(() => {
    const timer = setTimeout(onClose, 6000);
    return () => clearTimeout(timer);
  }, [onClose]);

  return (
    <div className={`fixed bottom-6 right-6 z-[100] px-6 py-4 rounded-xl shadow-2xl flex items-center gap-3 animate-in slide-in-from-bottom-10 fade-in duration-300 border ${type === 'error' ? 'bg-red-50 text-red-900 border-red-200' : 'bg-slate-900 text-white border-slate-800'}`}>
       {type === 'error' ? <AlertTriangle className="w-5 h-5 shrink-0 text-red-600" /> : <CheckCircle2 className="w-5 h-5 shrink-0 text-green-400" />}
       <span className="font-bold text-sm max-w-xs">{message}</span>
    </div>
  );
};

const SubjectConfigModal = ({ 
    isOpen, 
    onClose, 
    subject, 
    config, 
    onUpdate 
}: { 
    isOpen: boolean; 
    onClose: () => void; 
    subject: string; 
    config: SubjectConfig; 
    onUpdate: (newConfig: SubjectConfig) => void;
}) => {
    // ... (Existing modal code logic is fine)
    const chapters = NCERT_CHAPTERS[subject as keyof typeof NCERT_CHAPTERS] || [];
    const [localChapters, setLocalChapters] = useState<string[]>(config.chapters);
    const [localTopics, setLocalTopics] = useState<string[]>(config.topics);

    useEffect(() => {
        if(isOpen) {
            setLocalChapters(config.chapters);
            setLocalTopics(config.topics);
        }
    }, [isOpen, config]);

    const handleChapterToggle = (chapName: string) => {
        const newChapters = localChapters.includes(chapName) 
            ? localChapters.filter(c => c !== chapName)
            : [...localChapters, chapName];
        if (!newChapters.includes(chapName)) {
            const chapTopics = chapters.find(c => c.name === chapName)?.topics || [];
            setLocalTopics(prev => prev.filter(t => !chapTopics.includes(t)));
        }
        setLocalChapters(newChapters);
    };

    const handleTopicToggle = (topic: string) => {
        setLocalTopics(prev => prev.includes(topic) ? prev.filter(t => t !== topic) : [...prev, topic]);
    };

    const handleSelectAllTopics = (chapTopics: string[]) => {
        setLocalTopics(prev => Array.from(new Set([...prev, ...chapTopics])));
    };

    const handleClearTopics = (chapTopics: string[]) => {
        setLocalTopics(prev => prev.filter(t => !chapTopics.includes(t)));
    };
    
    const handleRandomize = () => {
        const shuffled = [...chapters].sort(() => 0.5 - Math.random());
        const selectedChaps = shuffled.slice(0, 3).map(c => c.name);
        const selectedTops: string[] = [];
        shuffled.slice(0, 3).forEach(c => {
             const randomTopic = c.topics[Math.floor(Math.random() * c.topics.length)];
             if (randomTopic) selectedTops.push(randomTopic);
        });
        setLocalChapters(selectedChaps);
        setLocalTopics(selectedTops);
    };

    const handleSave = () => {
        onUpdate({ ...config, chapters: localChapters, topics: localTopics });
        onClose();
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
            <motion.div 
                initial={{ opacity: 0, scale: 0.95 }} 
                animate={{ opacity: 1, scale: 1 }} 
                className="bg-white rounded-[2rem] w-full max-w-3xl max-h-[90vh] flex flex-col overflow-hidden shadow-2xl"
            >
                {/* ... (Existing Modal Content) ... */}
                <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50">
                    <div>
                        <h3 className="text-xl font-black text-slate-900 flex items-center gap-2">
                           <Sliders className="w-5 h-5 text-blue-600" />
                           Configure {subject}
                        </h3>
                        <p className="text-xs font-bold text-slate-500 mt-1">Select Chapters & Topics for Granular Generation</p>
                    </div>
                    <div className="flex items-center gap-2">
                         <button onClick={handleRandomize} className="px-4 py-2 bg-indigo-50 text-indigo-600 rounded-lg text-xs font-black uppercase tracking-widest hover:bg-indigo-100 flex items-center gap-2">
                            <Dices className="w-4 h-4" /> Randomize
                         </button>
                         <button onClick={onClose} className="p-2 bg-slate-200 rounded-full text-slate-500 hover:bg-slate-300"><X className="w-5 h-5" /></button>
                    </div>
                </div>
                
                <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar">
                    {chapters.map((chap) => {
                        const isChapSelected = localChapters.includes(chap.name);
                        return (
                            <div key={chap.name} className={`border-2 rounded-2xl transition-all ${isChapSelected ? 'border-blue-500 bg-blue-50/30' : 'border-slate-100 bg-white'}`}>
                                <div className="p-4 flex items-center justify-between cursor-pointer hover:bg-slate-50 rounded-t-xl" onClick={() => handleChapterToggle(chap.name)}>
                                    <div className="flex items-center gap-3">
                                        <div className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${isChapSelected ? 'bg-blue-600 border-blue-600' : 'border-slate-300 bg-white'}`}>
                                            {isChapSelected && <CheckCircle2 className="w-3.5 h-3.5 text-white" />}
                                        </div>
                                        <span className={`font-bold ${isChapSelected ? 'text-blue-900' : 'text-slate-600'}`}>{chap.name}</span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <span className="text-[10px] font-black uppercase text-slate-400 tracking-widest">{chap.topics.length} Topics</span>
                                        {isChapSelected && (
                                            <span className="px-2 py-0.5 bg-blue-100 text-blue-600 text-[9px] font-black rounded uppercase">Active</span>
                                        )}
                                    </div>
                                </div>
                                {isChapSelected && (
                                    <div className="p-4 border-t border-blue-100 bg-white rounded-b-xl animate-in fade-in">
                                        <div className="flex items-center gap-3 mb-3">
                                            <span className="text-[10px] font-black uppercase text-slate-400">Selection Mode:</span>
                                            <button onClick={() => handleSelectAllTopics(chap.topics)} className="px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-600 text-[10px] font-bold rounded">Select All</button>
                                            <button onClick={() => handleClearTopics(chap.topics)} className="px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-600 text-[10px] font-bold rounded flex items-center gap-1">
                                                <Dices className="w-3 h-3" /> Random Mix
                                            </button>
                                        </div>
                                        <div className="flex flex-wrap gap-2">
                                            {chap.topics.map(topic => (
                                                <button 
                                                    key={topic} 
                                                    onClick={() => handleTopicToggle(topic)}
                                                    className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-all ${localTopics.includes(topic) ? 'bg-blue-600 text-white border-blue-600 shadow-sm' : 'bg-slate-50 text-slate-500 border-slate-200 hover:border-blue-300'}`}
                                                >
                                                    {topic}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>

                <div className="p-6 border-t border-slate-100 bg-slate-50 flex justify-end gap-3">
                    <button onClick={onClose} className="px-6 py-3 rounded-xl font-bold text-slate-500 hover:bg-slate-200 transition-colors">Cancel</button>
                    <button onClick={handleSave} className="px-8 py-3 bg-blue-600 text-white rounded-xl font-black shadow-lg hover:bg-blue-700 transition-all">Save & Apply</button>
                </div>
            </motion.div>
        </div>
    );
};

const Admin = () => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('Daily Paper Upload');
  const [users, setUsers] = useState<any[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [dailyPapers, setDailyPapers] = useState<any[]>([]);
  
  const [analysisDate, setAnalysisDate] = useState<string>('');
  const [analysisData, setAnalysisData] = useState<any[]>([]);
  const [loadingAnalysis, setLoadingAnalysis] = useState(false);
  const printRef = useRef<HTMLDivElement>(null);

  const [confirmState, setConfirmState] = useState<{isOpen: boolean, title: string, message: string, onConfirm: () => void}>({
      isOpen: false, title: '', message: '', onConfirm: () => {}
  });
  const [toast, setToast] = useState<{message: string, type: 'success' | 'error'} | null>(null);
  const [showSqlFix, setShowSqlFix] = useState(false);

  const showToast = (msg: string, type: 'success' | 'error' = 'success') => setToast({message: msg, type});
  const closeConfirm = () => setConfirmState(prev => ({ ...prev, isOpen: false }));
  
  const getLocalToday = () => {
      const d = new Date();
      return new Date(d.getTime() - (d.getTimezoneOffset() * 60000)).toISOString().split('T')[0];
  };

  useEffect(() => { setAnalysisDate(getLocalToday()); }, []);
  const [uploadDate, setUploadDate] = useState(getLocalToday());
  const [qFile, setQFile] = useState<File | null>(null);
  const [sFile, setSFile] = useState<File | null>(null);
  const [isParsing, setIsParsing] = useState(false);
  const [parsedQuestions, setParsedQuestions] = useState<any[]>([]);
  const [parseError, setParseError] = useState<string | null>(null);
  const [isPublishing, setIsPublishing] = useState(false);
  const [isGeneratingAI, setIsGeneratingAI] = useState(false);
  const [genStatus, setGenStatus] = useState("");
  const [showGenConfig, setShowGenConfig] = useState(true);
  
  const [modalOpen, setModalOpen] = useState(false);
  const [activeConfigSubject, setActiveConfigSubject] = useState<string | null>(null);

  const [generationConfig, setGenerationConfig] = useState<GenerationConfig>({
    physics: { mcq: 8, numerical: 2, chapters: [], topics: [] },
    chemistry: { mcq: 8, numerical: 2, chapters: [], topics: [] },
    mathematics: { mcq: 4, numerical: 1, chapters: [], topics: [] },
  });

  const [supabaseUrl, setSupabaseUrl] = useState('');
  const [supabaseKey, setSupabaseKey] = useState('');
  const [geminiApiKey, setGeminiApiKey] = useState(''); // NEW STATE
  const [genModel, setGenModel] = useState('');
  const [analysisModel, setAnalysisModel] = useState('');
  const [visionModel, setVisionModel] = useState('');

  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [dbError, setDbError] = useState<any>(null);
  const [userFilter, setUserFilter] = useState<UserStatus>('all');
  const [searchQuery, setSearchQuery] = useState('');

  const loggedInProfile = JSON.parse(localStorage.getItem('user_profile') || '{}');
  const isPrimaryAdmin = (email: string) => email === 'example@gmail.com' || email === 'name@example.com' || email === 'name@admin.com';

  useEffect(() => {
    if (activeTab === 'User Management') loadUsers();
    if (activeTab === 'Daily Challenges' || activeTab === 'Daily Paper Upload') loadDailyPapers();
    if (activeTab === 'Result Analysis') loadAnalysis();
    if (activeTab === 'System Settings') {
        const customSupabase = JSON.parse(localStorage.getItem('custom_supabase_config') || '{}');
        setSupabaseUrl(customSupabase.url || '');
        setSupabaseKey(customSupabase.key || '');
        
        // Load API Config
        const customApi = JSON.parse(localStorage.getItem('nexus_api_config') || '{}');
        setGeminiApiKey(customApi.geminiApiKey || '');

        const customModels = JSON.parse(localStorage.getItem('nexus_model_config') || '{}');
        setGenModel(customModels.genModel || 'gemini-2.5-pro-preview');
        setAnalysisModel(customModels.analysisModel || 'gemini-2.5-pro-preview');
        setVisionModel(customModels.visionModel || 'gemini-2.5-pro-preview');
    }
  }, [activeTab, analysisDate]);

  // ... (Rest of existing Admin code logic for loads etc.) ... 
  // IMPORTANT: Re-implementing existing methods to maintain file validity.
  const [isLocalAdminMode, setIsLocalAdminMode] = useState(false);
  useEffect(() => {
      if (loggedInProfile.id && loggedInProfile.id.startsWith('admin-root-')) {
          if (supabase) {
              setIsLocalAdminMode(true);
          }
      }
  }, [loggedInProfile]);

  const loadUsers = async () => {
    setLoadingUsers(true);
    setDbError(null);
    try {
      const { data, error } = await getAllProfiles();
      if (error) {
        setDbError(error);
        setUsers([]);
      } else {
        setUsers(data || []);
      }
    } catch (err: any) {
      setDbError({ message: err.message, code: 'CLIENT_EXCEPTION' });
    } finally {
      setLoadingUsers(false);
    }
  };

  const loadAnalysis = async () => {
      setLoadingAnalysis(true);
      try {
          const attempts = await getDailyAttempts(analysisDate);
          // ... processing ...
          const processed = attempts.map((attempt, index) => {
              const data = attempt.attempt_data || [];
              const stats = {
                  Physics: { C: 0, W: 0, NA: 0, Score: 0 },
                  Chemistry: { C: 0, W: 0, NA: 0, Score: 0 },
                  Mathematics: { C: 0, W: 0, NA: 0, Score: 0 },
                  Neg: 0, Unatt: 0
              };
              data.forEach((q: any) => {
                  const subj = q.subject as 'Physics' | 'Chemistry' | 'Mathematics';
                  if (!stats[subj]) return;
                  if (q.isCorrect) {
                      stats[subj].C++;
                      stats[subj].Score += (q.markingScheme?.positive || 4);
                  } else if (q.userAnswer !== undefined && q.userAnswer !== '' && q.userAnswer !== null) {
                      stats[subj].W++;
                      const neg = (q.markingScheme?.negative || 1);
                      stats[subj].Score -= neg;
                      stats.Neg += neg;
                  } else {
                      stats[subj].NA++;
                      stats.Unatt++;
                  }
              });
              return {
                  rank: index + 1,
                  name: attempt.user_name || attempt.user_email?.split('@')[0]?.toUpperCase() || 'UNKNOWN',
                  regNo: attempt.user_id.substring(0, 8).toUpperCase(),
                  comb: 'PCM', stats, total: attempt.score
              };
          });
          setAnalysisData(processed);
      } catch (e) { console.error(e); } finally { setLoadingAnalysis(false); }
  };

  const loadDailyPapers = async () => {
    const papers = await getAllDailyChallenges();
    setDailyPapers(papers);
  };
  
  const handlePrintAnalysis = () => {
      const printWindow = window.open('', '', 'height=800,width=1200');
      if (printWindow && printRef.current) {
          printWindow.document.write('<!DOCTYPE html><html><head><title>Exam Analysis Report</title>');
          printWindow.document.write('<style>body{font-family: sans-serif; padding: 20px;} table{width:100%; border-collapse:collapse; font-size: 10px;} th, td{border: 1px solid #000; padding: 4px; text-align: center;} th{background: #f0f0f0;} h2, h3{text-align:center;}</style>');
          printWindow.document.write('</head><body>');
          printWindow.document.write(`<h2>JEE NEXUS - DAILY EXAM REPORT</h2><h3>DATE: ${analysisDate}</h3>`);
          printWindow.document.write(printRef.current.innerHTML);
          printWindow.document.write('</body></html>');
          printWindow.document.close();
          setTimeout(() => printWindow.print(), 500);
      }
  };
  
  const handleSaveKeys = () => {
    setConfirmState({
        isOpen: true,
        title: 'Save & Reload?',
        message: 'Saving these settings will trigger a page reload to apply changes. Do you want to proceed?',
        onConfirm: () => {
            closeConfirm();
            if (supabaseUrl && supabaseKey) {
                localStorage.setItem('custom_supabase_config', JSON.stringify({ url: supabaseUrl, key: supabaseKey }));
            } else {
                localStorage.removeItem('custom_supabase_config');
            }
            
            // SAVE GEMINI KEY
            if (geminiApiKey) {
                localStorage.setItem('nexus_api_config', JSON.stringify({ geminiApiKey: geminiApiKey }));
            } else {
                localStorage.removeItem('nexus_api_config');
            }

            localStorage.setItem('nexus_model_config', JSON.stringify({
                genModel: genModel || 'gemini-2.5-pro-preview',
                analysisModel: analysisModel || 'gemini-2.5-pro-preview',
                visionModel: visionModel || 'gemini-2.5-pro-preview'
            }));
            window.location.reload();
        }
    });
  };

  // ... (Rest of existing handlers handleParseDocument, handleGenConfigCountsChange, openSubjectModal, handleSubjectConfigUpdate, formatForPrint, handleDownloadPDF, handleAIGenerateDaily, handlePublishDaily, handleStatusChange, handleDeleteUser) ...
  
  const handleParseDocument = async () => {
    if (!qFile) { showToast("Please upload the Question Paper PDF/Image first.", 'error'); return; }
    setIsParsing(true); setParseError(null); setParsedQuestions([]);
    try {
      const questions = await parseDocumentToQuestions(qFile, sFile || undefined);
      if (!questions || questions.length === 0) throw new Error("No questions extracted. Check image clarity.");
      setParsedQuestions(questions); showToast(`Successfully parsed ${questions.length} questions!`);
    } catch (e: any) { setParseError(e.message); showToast(e.message, 'error'); } finally { setIsParsing(false); }
  };
  
  const handleGenConfigCountsChange = (subject: keyof GenerationConfig, type: 'mcq' | 'numerical', value: string) => {
    const numValue = parseInt(value, 10);
    if (isNaN(numValue) || numValue < 0 || numValue > 50) return;
    setGenerationConfig(prev => ({ ...prev, [subject]: { ...prev[subject], [type]: numValue } }));
  };
  
  const openSubjectModal = (subject: string) => { setActiveConfigSubject(subject); setModalOpen(true); };

  const handleSubjectConfigUpdate = (newConfig: SubjectConfig) => {
      if (!activeConfigSubject) return;
      setGenerationConfig(prev => ({ ...prev, [activeConfigSubject.toLowerCase()]: newConfig }));
  };

  const formatForPrint = (str: string) => {
    if (!str) return '';
    let raw = str.replace(/\\\\/g, '\\').replace(/\\\\\$/g, '$').replace(/\\\$/g, '$');
    const hasPairedDelimiters = /(\$\$[\s\S]*?\$\$)|(\\\[[\s\S]*?\\\])|(\\\([\s\S]*?\\\))|(\$[^\$]+\$)/.test(raw);
    if (!hasPairedDelimiters) {
        const cmdList = "frac|sqrt|sum|int|vec|hat|bar|pm|infty|partial|alpha|beta|gamma|delta|epsilon|zeta|eta|theta|iota|kappa|lambda|mu|nu|xi|omicron|pi|rho|sigma|tau|upsilon|phi|chi|psi|omega|Delta|Gamma|Theta|Lambda|Xi|Pi|Sigma|Phi|Psi|Omega|nabla|times|cdot|approx|leq|geq|ne|equiv|ll|gg|propto|rightarrow|leftarrow|leftrightarrow|to|mapsto|infty|deg|angle|triangle|text|mathbf|mathcal|mathrm|sin|cos|tan|cot|csc|sec|log|ln|exp|circ";
        const isLatex = new RegExp(`\\\\(${cmdList})|[\\^_]\{`).test(raw) || raw.startsWith('\\');
        if (isLatex) { return `$${raw.replace(/\$/g, '')}$`; }
    }
    return raw;
  };

  const handleDownloadPDF = () => {
    // ... same as before ...
    if (parsedQuestions.length === 0) { showToast("No questions to download.", 'error'); return; }
    const sortedQuestions = [...parsedQuestions].sort((a, b) => {
        const order = { 'Physics': 1, 'Chemistry': 2, 'Mathematics': 3 };
        return (order[a.subject as keyof typeof order] || 4) - (order[b.subject as keyof typeof order] || 4);
    });
    const printWindow = window.open('', '', 'height=800,width=900');
    if (!printWindow) { showToast("Pop-up blocked. Please allow pop-ups to download PDF.", 'error'); return; }
    // ... HTML generation logic ...
    let qHtml = ''; let sHtml = '';
    sortedQuestions.forEach((q, idx) => {
        const stmt = formatForPrint(q.statement); const sol = formatForPrint(q.solution || q.explanation);
        qHtml += `<div class="question-block"><div class="q-header"><span class="q-num">Q${idx + 1}.</span><span class="q-meta">${q.subject} (${q.type})</span></div><div class="q-statement">${stmt.replace(/\n/g, '<br/>')}</div>${q.type === 'MCQ' && q.options ? `<div class="q-options">${q.options.map((opt: string, i: number) => `<div class="q-option"><span class="opt-label">${String.fromCharCode(65 + i)})</span><span class="opt-text">${formatForPrint(opt)}</span></div>`).join('')}</div>` : ''}</div>`;
        sHtml += `<div class="solution-block"><div class="s-header"><strong>Q${idx + 1}.</strong> <span class="correct-ans">Correct Answer: ${formatForPrint(String(q.correctAnswer))}</span></div><div class="s-concept"><strong>Concept:</strong> ${q.concept}</div><div class="s-body"><strong>Explanation:</strong><br/>${sol.replace(/\n/g, '<br/>')}</div></div>`;
    });
    const fullHtml = `<!DOCTYPE html><html><head><title>JEE Nexus Paper - ${uploadDate}</title><link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/katex.min.css"><script defer src="https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/katex.min.js"></script><script defer src="https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/contrib/auto-render.min.js"></script><style>body { font-family: 'Times New Roman', serif; padding: 40px; max-width: 900px; mx-auto; } h1, h2, h3 { text-align: center; } .section-break { page-break-before: always; border-top: 2px dashed #ccc; margin-top: 40px; padding-top: 40px; } .question-block, .solution-block { margin-bottom: 25px; page-break-inside: avoid; border-bottom: 1px solid #eee; padding-bottom: 20px; } .q-header, .s-header { margin-bottom: 8px; font-weight: bold; } .q-meta { font-size: 0.8em; color: #666; margin-left: 10px; text-transform: uppercase; } .q-statement { margin-bottom: 12px; font-size: 1.1em; line-height: 1.5; } .q-options { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-top: 10px; } .q-option { display: flex; gap: 8px; } .opt-label { font-weight: bold; } .correct-ans { color: #008000; margin-left: 10px; } .s-concept { font-style: italic; color: #444; margin-bottom: 5px; font-size: 0.9em; } .s-body { background: #f9f9f9; padding: 10px; border-radius: 5px; font-size: 0.95em; line-height: 1.4; } @media print { body { padding: 0; } .no-print { display: none; } }</style></head><body><h1>JEE Nexus AI - Daily Practice Paper</h1><h3>Date: ${uploadDate} | Total Questions: ${sortedQuestions.length}</h3><hr/><h2>Part A: Question Paper</h2><div id="questions">${qHtml}</div><div class="section-break"><h2>Part B: Answer Key & Solutions</h2><div id="solutions">${sHtml}</div></div><script>document.addEventListener("DOMContentLoaded", function() { renderMathInElement(document.body, { delimiters: [ {left: '$$', right: '$$', display: true}, {left: '$', right: '$', display: false}, {left: '\\(', right: '\\)', display: false}, {left: '\\[', right: '\\]', display: true} ], throwOnError : false, trust: true }); setTimeout(() => { window.print(); }, 1000); });</script></body></html>`;
    printWindow.document.write(fullHtml); printWindow.document.close();
  };

  const handleAIGenerateDaily = async () => {
      const totalQuestions = (Object.values(generationConfig) as SubjectConfig[]).reduce((acc, curr) => acc + curr.mcq + curr.numerical, 0);
      if (totalQuestions === 0) { showToast("Please configure at least one question to generate.", 'error'); return; }
      setConfirmState({
          isOpen: true, title: 'Initiate AI Generation', message: `Generate Daily Paper for ${uploadDate}? This will use your configured AI model to create ${totalQuestions} unique questions.`,
          onConfirm: async () => {
              closeConfirm(); setIsGeneratingAI(true); setParsedQuestions([]); setGenStatus("Connecting to Gemini AI...");
              try {
                  const result = await generateFullJEEDailyPaper(generationConfig);
                  const combined = [...(result.physics || []), ...(result.chemistry || []), ...(result.mathematics || [])];
                  if (combined.length === 0) throw new Error("AI engine failed to produce questions. Check API Key or try again.");
                  const final = combined.map((q, idx) => ({ ...q, id: `daily-ai-${idx}-${Date.now()}`, subject: q.subject || 'General' }));
                  setParsedQuestions(final); showToast(`Success! Generated ${final.length} questions.`);
              } catch (e: any) { console.error("Admin Generation Error:", e); showToast("Generation Failed: " + (e.message || "Cognitive server error."), 'error'); } finally { setIsGeneratingAI(false); setGenStatus(""); }
          }
      });
  };

  const handlePublishDaily = async () => {
    if (parsedQuestions.length === 0) { showToast("Empty paper. Generate or parse some questions first.", 'error'); return; }
    const publishLogic = async () => {
        setIsPublishing(true);
        try {
          const { error } = await createDailyChallenge(uploadDate, parsedQuestions);
          if (error) throw error;
          await loadDailyPapers(); setParsedQuestions([]); setQFile(null); setSFile(null); showToast("Paper Published Successfully!"); setActiveTab('Daily Challenges');
        } catch (e: any) { console.error("Publish Error:", e); if (e.code === '42501' || (e.message && e.message.includes('policy'))) { setShowSqlFix(true); } else { showToast("Failed to publish: " + (e.message || "DB Access Denied."), 'error'); } } finally { setIsPublishing(false); }
    };
    const exists = dailyPapers.find(p => p.date === uploadDate);
    if (exists) { setConfirmState({ isOpen: true, title: 'Overwrite Existing Paper?', message: `A paper already exists for DATE: ${uploadDate}. Do you want to replace it?`, onConfirm: () => { closeConfirm(); publishLogic(); } }); } else { setConfirmState({ isOpen: true, title: 'Publish Paper?', message: `Publishing paper for DATE: ${uploadDate}. Students will see it immediately.`, onConfirm: () => { closeConfirm(); publishLogic(); } }); }
  };

  const handleStatusChange = async (userId: string, status: 'approved' | 'rejected' | 'pending') => {
    setActionLoading(userId);
    if (isLocalAdminMode) { showToast("Operation Denied: View-Only Mode.", 'error'); setActionLoading(null); return; }
    const error = await updateProfileStatus(userId, status);
    if (!error) { setUsers(prev => prev.map(u => u.id === userId ? { ...u, status } : u)); showToast(`User status updated to ${status}`); setTimeout(() => loadUsers(), 500); } else { showToast(error, 'error'); if (typeof error === 'string' && (error.includes('policy') || error.includes('permission'))) { setShowSqlFix(true); } }
    setActionLoading(null);
  };

  const handleDeleteUser = async (userId: string) => {
    setConfirmState({ isOpen: true, title: 'Delete User?', message: 'This action cannot be undone. Are you sure?', onConfirm: async () => { closeConfirm(); setActionLoading(userId); const error = await deleteProfile(userId); if (!error) { setUsers(prev => prev.filter(u => u.id !== userId)); showToast("User deleted successfully."); } else { showToast("Delete failed: " + error, 'error'); } setActionLoading(null); } });
  };

  const filteredUsers = users.filter(u => { const matchesFilter = userFilter === 'all' || u.status === userFilter; const matchesSearch = (u.email || '').toLowerCase().includes(searchQuery.toLowerCase()) || (u.full_name || '').toLowerCase().includes(searchQuery.toLowerCase()); return matchesFilter && matchesSearch; });

  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-12 relative">
      <ConfirmDialog isOpen={confirmState.isOpen} title={confirmState.title} message={confirmState.message} onConfirm={confirmState.onConfirm} onCancel={closeConfirm} />
      <SqlFixDialog isOpen={showSqlFix} onClose={() => setShowSqlFix(false)} />
      {toast && <ToastNotification message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black text-slate-900 tracking-tight flex items-center gap-3">
            Control Center
            {isPrimaryAdmin(loggedInProfile.email) && <Crown className="w-8 h-8 text-yellow-500 drop-shadow-sm" />}
          </h1>
          <p className="text-slate-500 font-medium">Administrator Dashboard • Platform Oversight</p>
        </div>
        {isLocalAdminMode && (
            <div className="p-3 bg-orange-100 border border-orange-200 text-orange-800 rounded-xl text-xs font-bold flex items-center gap-2 max-w-lg">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>View-Only Mode. To enable Write Access, run the 'Database Repair Script' (fixes login issues).</span>
            </div>
        )}
      </div>

      <div className="flex border-b border-slate-200 gap-8 overflow-x-auto no-scrollbar">
        {[
          { id: 'Daily Paper Upload', icon: <FileUp className="w-4 h-4" /> },
          { id: 'Daily Challenges', icon: <CalendarClock className="w-4 h-4" /> },
          { id: 'Result Analysis', icon: <FileSpreadsheet className="w-4 h-4" /> },
          { id: 'User Management', icon: <Users className="w-4 h-4" /> },
          { id: 'System Settings', icon: <Zap className="w-4 h-4" /> },
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`pb-4 text-sm font-black uppercase tracking-widest transition-all whitespace-nowrap relative flex items-center gap-2 ${
              activeTab === tab.id ? 'text-blue-600 border-b-2 border-blue-600' : 'text-slate-400 hover:text-slate-600'
            }`}
          >
            {tab.icon} {tab.id}
          </button>
        ))}
      </div>

      {activeTab === 'System Settings' && (
        <div className="space-y-6">
            <div className="bg-white rounded-[2.5rem] border border-slate-200 shadow-sm p-8">
                 <div className="flex items-center justify-between mb-6">
                    <h3 className="text-xl font-black text-slate-900 flex items-center gap-2">
                      <Key className="w-6 h-6 text-fuchsia-600" />
                      API & System Keys
                    </h3>
                    <button 
                        onClick={() => setShowSqlFix(true)} 
                        className="px-4 py-2 bg-slate-900 text-white rounded-lg text-xs font-bold flex items-center gap-2 hover:bg-slate-800 transition-all"
                    >
                        <Terminal className="w-4 h-4" /> Database Repair Script
                    </button>
                 </div>
                 <div className="space-y-8 max-w-2xl">
                    <div className="p-4 bg-yellow-50 border border-yellow-100 rounded-xl flex gap-3 text-yellow-800 text-sm">
                        <AlertTriangle className="w-5 h-5 shrink-0" />
                        <div>
                            <p className="font-bold">Important Warning</p>
                            <p className="opacity-80">Keys entered here are stored in your browser's local storage.</p>
                        </div>
                    </div>
                    
                    <div className="space-y-4 pt-4 border-t border-slate-100">
                        <h4 className="text-sm font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                            <Database className="w-4 h-4" /> Supabase Backend
                        </h4>
                        <div>
                            <label className="text-xs font-bold text-slate-600 mb-1 block">Project URL</label>
                            <input type="text" value={supabaseUrl} onChange={(e) => setSupabaseUrl(e.target.value)} placeholder="https://xyz.supabase.co" className="w-full p-4 bg-slate-50 border border-slate-200 rounded-xl font-mono text-sm" />
                        </div>
                        <div>
                            <label className="text-xs font-bold text-slate-600 mb-1 block">Anon Public Key</label>
                            <input type="password" value={supabaseKey} onChange={(e) => setSupabaseKey(e.target.value)} placeholder="eyJhbGciOiJIUzI1Ni..." className="w-full p-4 bg-slate-50 border border-slate-200 rounded-xl font-mono text-sm" />
                        </div>
                    </div>

                    <div className="space-y-4 pt-8 border-t border-slate-100">
                        <h4 className="text-sm font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                            <Cpu className="w-4 h-4" /> Gemini Model Configuration
                        </h4>
                        <div>
                            <label className="text-xs font-bold text-slate-600 mb-1 block">Google Gemini API Key</label>
                            <input type="password" value={geminiApiKey} onChange={(e) => setGeminiApiKey(e.target.value)} placeholder="AIzaSy..." className="w-full p-4 bg-slate-50 border border-slate-200 rounded-xl font-mono text-sm" />
                            <p className="text-[10px] text-slate-400 mt-1 font-medium">Required for question generation. Get one from Google AI Studio.</p>
                        </div>
                        <div>
                            <label className="text-xs font-bold text-slate-600 mb-1 block">Question Generation Model</label>
                            <input type="text" value={genModel} onChange={(e) => setGenModel(e.target.value)} placeholder="gemini-2.5-pro-preview" className="w-full p-4 bg-slate-50 border border-slate-200 rounded-xl font-mono text-sm" />
                        </div>
                        <div>
                            <label className="text-xs font-bold text-slate-600 mb-1 block">Analysis Model</label>
                            <input type="text" value={analysisModel} onChange={(e) => setAnalysisModel(e.target.value)} placeholder="gemini-2.5-pro-preview" className="w-full p-4 bg-slate-50 border border-slate-200 rounded-xl font-mono text-sm" />
                        </div>
                        <div>
                            <label className="text-xs font-bold text-slate-600 mb-1 block">Document Parsing Model (Vision)</label>
                            <input type="text" value={visionModel} onChange={(e) => setVisionModel(e.target.value)} placeholder="gemini-2.5-pro-preview" className="w-full p-4 bg-slate-50 border border-slate-200 rounded-xl font-mono text-sm" />
                        </div>
                    </div>

                    <button onClick={handleSaveKeys} className="px-8 py-3 bg-slate-900 text-white rounded-xl font-black shadow-lg hover:bg-slate-800 transition-all flex items-center gap-2">
                        <Save className="w-4 h-4" /> Save Configuration
                    </button>
                 </div>
            </div>
        </div>
      )}

      {/* ... (Rest of existing Tabs: Daily Paper Upload, Daily Challenges, Result Analysis, User Management) ... */}
      {/* Repeating key sections to ensure full file content is preserved in the change block */}
      {activeTab === 'Daily Paper Upload' && (
        <div className="space-y-8">
           {activeConfigSubject && (
               <SubjectConfigModal 
                    isOpen={modalOpen} 
                    onClose={() => { setModalOpen(false); setActiveConfigSubject(null); }}
                    subject={activeConfigSubject}
                    config={generationConfig[activeConfigSubject.toLowerCase() as keyof GenerationConfig]}
                    onUpdate={handleSubjectConfigUpdate}
               />
           )}
           
           <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              <div className="bg-white p-8 rounded-[2.5rem] border border-slate-200 shadow-sm space-y-6">
                 <h3 className="text-xl font-black text-slate-900 flex items-center gap-2">
                   <FileText className="w-6 h-6 text-fuchsia-600" />
                   1. Create or Upload
                 </h3>
                 
                 <div className="space-y-4">
                    <div>
                      <label className="text-xs font-black text-slate-400 uppercase tracking-widest mb-2 block">Paper Date (Target)</label>
                      <div className="flex gap-2">
                          <input type="date" value={uploadDate} onChange={(e) => setUploadDate(e.target.value)} className="w-full p-4 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-700" />
                          <button onClick={() => setUploadDate(getLocalToday())} className="px-4 py-2 bg-blue-50 text-blue-600 rounded-xl font-bold text-xs uppercase tracking-widest hover:bg-blue-100 transition-colors" title="Reset to Today">Today</button>
                      </div>
                    </div>

                    <div className="flex gap-4">
                        <button onClick={handleAIGenerateDaily} disabled={isGeneratingAI || isParsing} className="flex-1 py-4 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-xl font-bold shadow-lg hover:shadow-indigo-500/30 transition-all flex flex-col items-center gap-1 disabled:opacity-50 active:scale-95">
                             {isGeneratingAI ? <Loader2 className="w-5 h-5 animate-spin" /> : <Zap className="w-5 h-5 text-yellow-300" />}
                             <span className="text-xs font-black uppercase tracking-widest">{isGeneratingAI ? genStatus : "Auto-Generate (AI)"}</span>
                        </button>
                        <button onClick={() => setShowGenConfig(!showGenConfig)} className={`px-6 py-4 rounded-xl font-bold shadow-lg transition-all flex items-center gap-2 text-xs uppercase tracking-widest ${showGenConfig ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>
                            <Sliders className="w-4 h-4" /> {showGenConfig ? 'Hide Config' : 'Customize'}
                        </button>
                    </div>

                    <AnimatePresence>
                      {showGenConfig && (
                        <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="space-y-4">
                          {(['physics', 'chemistry', 'mathematics'] as const).map(subject => {
                            const total = generationConfig[subject].mcq + generationConfig[subject].numerical;
                            const chaptersCount = generationConfig[subject].chapters.length;
                            const topicsCount = generationConfig[subject].topics.length;
                            const isFullSyllabus = chaptersCount === 0;

                            return (
                                <div key={subject} className="flex flex-col sm:flex-row sm:items-center gap-4 p-4 bg-white rounded-xl border border-slate-100 hover:border-blue-100 transition-colors">
                                  <div className="flex items-center gap-3 w-full sm:w-1/3">
                                    {subject === 'physics' && <Atom className="w-5 h-5 text-blue-500" />}
                                    {subject === 'chemistry' && <Beaker className="w-5 h-5 text-emerald-500" />}
                                    {subject === 'mathematics' && <FunctionSquare className="w-5 h-5 text-fuchsia-500" />}
                                    <div className="flex flex-col">
                                        <span className="font-bold text-slate-700 capitalize">{subject}</span>
                                        <button onClick={() => openSubjectModal(subject.charAt(0).toUpperCase() + subject.slice(1))} className="text-[10px] font-black text-blue-600 hover:underline text-left mt-1 flex items-center gap-1">
                                            <Sliders className="w-3 h-3" />
                                            {isFullSyllabus ? 'Full Syllabus' : `Configured: ${chaptersCount} Ch / ${topicsCount} Tops`}
                                        </button>
                                    </div>
                                  </div>
                                  <div className="flex items-center gap-2 flex-1">
                                    <label className="text-xs font-bold text-slate-500 shrink-0">MCQ</label>
                                    <input type="number" value={generationConfig[subject].mcq} onChange={e => handleGenConfigCountsChange(subject, 'mcq', e.target.value)} className="w-full p-2 bg-slate-100 border border-slate-200 rounded-md text-center font-bold" />
                                  </div>
                                  <div className="flex items-center gap-2 flex-1">
                                    <label className="text-xs font-bold text-slate-500 shrink-0">Num</label>
                                    <input type="number" value={generationConfig[subject].numerical} onChange={e => handleGenConfigCountsChange(subject, 'numerical', e.target.value)} className="w-full p-2 bg-slate-100 border border-slate-200 rounded-md text-center font-bold" />
                                  </div>
                                  <div className="text-center sm:text-right w-full sm:w-20 pt-2 sm:pt-0">
                                    <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest">Total</p>
                                    <p className="font-black text-slate-800 text-lg">{total}</p>
                                  </div>
                                </div>
                            );
                          })}
                        </motion.div>
                      )}
                    </AnimatePresence>

                    <div className="relative flex py-2 items-center">
                        <div className="flex-grow border-t border-slate-200"></div>
                        <span className="flex-shrink-0 mx-4 text-slate-400 text-xs font-bold uppercase">OR Upload PDF</span>
                        <div className="flex-grow border-t border-slate-200"></div>
                    </div>
                    
                    <div>
                       <label className="text-xs font-black text-slate-400 uppercase tracking-widest mb-2 block">Question Paper (PDF/Image)</label>
                       <div className="relative group">
                          <input type="file" accept=".pdf,image/*" onChange={(e) => setQFile(e.target.files?.[0] || null)} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" />
                          <div className={`p-6 border-2 border-dashed rounded-xl flex items-center justify-center gap-3 transition-all ${qFile ? 'bg-fuchsia-50 border-fuchsia-300' : 'bg-slate-50 border-slate-200 group-hover:bg-slate-100'}`}>
                             {qFile ? <span className="text-fuchsia-700 font-bold truncate">{qFile.name}</span> : <span className="text-slate-400 font-bold flex items-center gap-2"><FileUp className="w-4 h-4" /> Upload QP</span>}
                          </div>
                       </div>
                    </div>

                    <div>
                       <label className="text-xs font-black text-slate-400 uppercase tracking-widest mb-2 block">Solution Key (Optional)</label>
                       <div className="relative group">
                          <input type="file" accept=".pdf,image/*" onChange={(e) => setSFile(e.target.files?.[0] || null)} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" />
                          <div className={`p-6 border-2 border-dashed rounded-xl flex items-center justify-center gap-3 transition-all ${sFile ? 'bg-blue-50 border-blue-300' : 'bg-slate-50 border-slate-200 group-hover:bg-slate-100'}`}>
                             {sFile ? <span className="text-blue-700 font-bold truncate">{sFile.name}</span> : <span className="text-slate-400 font-bold flex items-center gap-2"><FileText className="w-4 h-4" /> Upload Answer Key</span>}
                          </div>
                       </div>
                    </div>

                    <button onClick={handleParseDocument} disabled={!qFile || isParsing || isGeneratingAI} className="w-full py-4 bg-slate-900 text-white rounded-xl font-black shadow-lg hover:bg-slate-800 transition-all flex items-center justify-center gap-3 disabled:opacity-50">
                      {isParsing ? <Loader2 className="w-5 h-5 animate-spin" /> : <FileText className="w-5 h-5" />}
                      {isParsing ? "Parsing PDF with AI..." : "Parse Uploaded Files"}
                    </button>
                 </div>
              </div>

              <div className="bg-slate-50 p-8 rounded-[2.5rem] border border-slate-200 shadow-inner flex flex-col h-[500px]">
                 <h3 className="text-xl font-black text-slate-900 flex items-center gap-2 mb-4">
                   <Eye className="w-6 h-6 text-blue-600" />
                   2. Paper Preview
                 </h3>
                 
                 <div className="flex-1 overflow-y-auto custom-scrollbar space-y-4 pr-2">
                    {parsedQuestions.length > 0 ? (
                       parsedQuestions.map((q, idx) => (
                         <div key={idx} className="bg-white p-4 rounded-xl shadow-sm border border-slate-100">
                            <div className="flex justify-between items-start mb-2">
                               <span className="text-[10px] font-black bg-slate-100 px-2 py-1 rounded text-slate-500">Q{idx+1} • {q.subject}</span>
                               <span className="text-[10px] font-black bg-blue-50 text-blue-600 px-2 py-1 rounded">{q.type}</span>
                            </div>
                            <MathText text={q.statement.substring(0, 100) + '...'} className="text-xs font-medium text-slate-700 mb-2" />
                            <div className="text-[10px] font-bold text-green-600">Ans: {q.correctAnswer}</div>
                         </div>
                       ))
                    ) : (
                       <div className="h-full flex flex-col items-center justify-center text-slate-400">
                          {isGeneratingAI ? <Loader2 className="w-12 h-12 mb-4 animate-spin text-fuchsia-500" /> : <FileText className="w-12 h-12 mb-4 opacity-30" />}
                          <p className="font-bold">{isGeneratingAI ? "Synthesizing AI Paper..." : "No data parsed or generated"}</p>
                       </div>
                    )}
                 </div>

                 {parsedQuestions.length > 0 && (
                    <div className="mt-6 pt-6 border-t border-slate-200 flex gap-3">
                       <button onClick={handleDownloadPDF} className="px-6 py-4 bg-white border border-slate-200 text-slate-600 rounded-xl font-black hover:bg-slate-50 transition-all flex items-center justify-center gap-2" title="Download PDF with Solutions">
                         <Download className="w-5 h-5" />
                       </button>
                       <button onClick={handlePublishDaily} disabled={isPublishing} className="flex-1 py-4 bg-green-600 text-white rounded-xl font-black shadow-lg hover:bg-green-700 transition-all flex items-center justify-center gap-3 disabled:opacity-50">
                         {isPublishing ? <Loader2 className="w-5 h-5 animate-spin" /> : <CheckCircle2 className="w-5 h-5" />}
                         Publish to Students
                       </button>
                    </div>
                 )}
              </div>
           </div>
        </div>
      )}

      {activeTab === 'Daily Challenges' && (
        <div className="bg-white rounded-[2.5rem] border border-slate-200 shadow-sm overflow-hidden">
             <div className="p-8 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
                <h3 className="text-xl font-black text-slate-900 flex items-center gap-2">
                   <Calendar className="w-6 h-6 text-blue-600" />
                   Published Challenges
                </h3>
             </div>
             <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead>
                    <tr className="bg-slate-50 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100">
                      <th className="px-8 py-5">Date</th>
                      <th className="px-8 py-5">Questions</th>
                      <th className="px-8 py-5">Created At</th>
                      <th className="px-8 py-5 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {dailyPapers.length > 0 ? dailyPapers.map((paper, idx) => (
                      <tr key={idx} className="hover:bg-slate-50 transition-colors">
                        <td className="px-8 py-6 font-bold text-slate-900">{paper.date}</td>
                        <td className="px-8 py-6 text-sm text-slate-600">{paper.questions?.length || 0} Questions</td>
                        <td className="px-8 py-6 text-xs text-slate-400">{new Date(paper.created_at).toLocaleString()}</td>
                        <td className="px-8 py-6 text-right">
                           <button onClick={() => { setUploadDate(paper.date); setParsedQuestions(paper.questions); setActiveTab('Daily Paper Upload'); }} className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg"><RefreshCw className="w-4 h-4" /></button>
                        </td>
                      </tr>
                    )) : (
                      <tr><td colSpan={4} className="px-8 py-20 text-center text-slate-400 font-medium">No challenges published yet.</td></tr>
                    )}
                  </tbody>
                </table>
             </div>
        </div>
      )}

      {activeTab === 'Result Analysis' && (
        <div className="space-y-6">
           <div className="bg-white p-8 rounded-[2.5rem] border border-slate-200 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-6">
              <div className="flex items-center gap-4">
                 <div className="p-3 bg-blue-100 text-blue-600 rounded-xl"><Calendar className="w-6 h-6" /></div>
                 <div>
                    <h3 className="text-xl font-black text-slate-900">Performance Matrix</h3>
                    <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">Aggregate results per session</p>
                 </div>
              </div>
              <div className="flex items-center gap-4">
                 <input type="date" value={analysisDate} onChange={(e) => setAnalysisDate(e.target.value)} className="p-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-700 outline-none focus:ring-2 focus:ring-blue-500" />
                 <button onClick={handlePrintAnalysis} className="px-6 py-3 bg-slate-900 text-white rounded-xl font-bold flex items-center gap-2 shadow-lg hover:bg-slate-800 transition-all"><Printer className="w-4 h-4" /> Print Report</button>
              </div>
           </div>
           <div className="bg-white rounded-[2.5rem] border border-slate-200 shadow-sm overflow-hidden" ref={printRef}>
              <div className="overflow-x-auto">
                 <table className="w-full text-left border-collapse">
                    <thead className="bg-slate-50 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100">
                        <tr>
                            <th rowSpan={2} className="px-4 py-5 border-r border-slate-100">Rank</th>
                            <th rowSpan={2} className="px-6 py-5 border-r border-slate-100">Identity</th>
                            <th colSpan={4} className="px-6 py-5 text-center border-r border-slate-100 bg-blue-50/50 text-blue-600">Physics</th>
                            <th colSpan={4} className="px-6 py-5 text-center border-r border-slate-100 bg-emerald-50/50 text-emerald-600">Chemistry</th>
                            <th colSpan={4} className="px-6 py-5 text-center border-r border-slate-100 bg-fuchsia-50/50 text-fuchsia-600">Mathematics</th>
                            <th rowSpan={2} className="px-6 py-5 border-r border-slate-100">Neg</th>
                            <th rowSpan={2} className="px-6 py-5 border-r border-slate-100">Unatt</th>
                            <th rowSpan={2} className="px-8 py-5 text-center bg-slate-900 text-white">Total</th>
                        </tr>
                        <tr>
                            <th className="px-2 py-3 text-center border-r border-slate-100">C</th>
                            <th className="px-2 py-3 text-center border-r border-slate-100">W</th>
                            <th className="px-2 py-3 text-center border-r border-slate-100">NA</th>
                            <th className="px-4 py-3 text-center border-r border-slate-100">Sc</th>
                            <th className="px-2 py-3 text-center border-r border-slate-100">C</th>
                            <th className="px-2 py-3 text-center border-r border-slate-100">W</th>
                            <th className="px-2 py-3 text-center border-r border-slate-100">NA</th>
                            <th className="px-4 py-3 text-center border-r border-slate-100">Sc</th>
                            <th className="px-2 py-3 text-center border-r border-slate-100">C</th>
                            <th className="px-2 py-3 text-center border-r border-slate-100">W</th>
                            <th className="px-2 py-3 text-center border-r border-slate-100">NA</th>
                            <th className="px-4 py-3 text-center border-r border-slate-100">Sc</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-mono text-[11px]">
                        {loadingAnalysis ? (
                            <tr><td colSpan={20} className="px-8 py-20 text-center text-slate-400 font-medium">Computing Results...</td></tr>
                        ) : analysisData.length > 0 ? analysisData.map((row, i) => (
                            <tr key={i} className="hover:bg-slate-50 transition-colors">
                                <td className="px-4 py-4 text-center border-r border-slate-100 font-black">{row.rank}</td>
                                <td className="px-6 py-4 border-r border-slate-100">
                                    <div className="flex flex-col">
                                        <span className="font-black text-slate-900">{row.name}</span>
                                        <span className="text-[9px] text-slate-400">{row.regNo}</span>
                                    </div>
                                </td>
                                <td className="px-2 py-4 text-center border-r border-slate-100 text-emerald-600 font-bold">{row.stats.Physics.C}</td>
                                <td className="px-2 py-4 text-center border-r border-slate-100 text-red-600">{row.stats.Physics.W}</td>
                                <td className="px-2 py-4 text-center border-r border-slate-100 text-slate-400">{row.stats.Physics.NA}</td>
                                <td className="px-4 py-4 text-center border-r border-slate-100 bg-blue-50/30 font-black">{row.stats.Physics.Score}</td>
                                <td className="px-2 py-4 text-center border-r border-slate-100 text-emerald-600 font-bold">{row.stats.Chemistry.C}</td>
                                <td className="px-2 py-4 text-center border-r border-slate-100 text-red-600">{row.stats.Chemistry.W}</td>
                                <td className="px-2 py-4 text-center border-r border-slate-100 text-slate-400">{row.stats.Chemistry.NA}</td>
                                <td className="px-4 py-4 text-center border-r border-slate-100 bg-emerald-50/30 font-black">{row.stats.Chemistry.Score}</td>
                                <td className="px-2 py-4 text-center border-r border-slate-100 text-emerald-600 font-bold">{row.stats.Mathematics.C}</td>
                                <td className="px-2 py-4 text-center border-r border-slate-100 text-red-600">{row.stats.Mathematics.W}</td>
                                <td className="px-2 py-4 text-center border-r border-slate-100 text-slate-400">{row.stats.Mathematics.NA}</td>
                                <td className="px-4 py-4 text-center border-r border-slate-100 bg-fuchsia-50/30 font-black">{row.stats.Mathematics.Score}</td>
                                <td className="px-6 py-4 text-center border-r border-slate-100 text-red-700 font-bold">-{row.stats.Neg}</td>
                                <td className="px-6 py-4 text-center border-r border-slate-100 text-slate-500">{row.stats.Unatt}</td>
                                <td className="px-8 py-4 text-center bg-slate-50 font-black text-sm text-slate-900">{row.total}</td>
                            </tr>
                        )) : (
                            <tr><td colSpan={20} className="px-8 py-20 text-center text-slate-400 font-medium">No attempts recorded for this date.</td></tr>
                        )}
                    </tbody>
                 </table>
              </div>
           </div>
        </div>
      )}

      {activeTab === 'User Management' && (
        <div className="space-y-6">
          <div className={`bg-white rounded-[2.5rem] border border-slate-200 shadow-sm overflow-hidden animate-in fade-in`}>
              {/* User management Header and Table Code... same as original */}
              <div className="p-8 border-b border-slate-100 flex flex-col lg:flex-row lg:items-center justify-between gap-6 bg-slate-50/50">
                <div className="flex items-center gap-3">
                  <div className="p-3 bg-blue-600 rounded-2xl text-white shadow-lg"><ShieldCheck className="w-6 h-6" /></div>
                  <h3 className="text-xl font-black text-slate-900 tracking-tight">User Directory</h3>
                </div>
                <div className="flex flex-col sm:flex-row items-center gap-4 flex-1 max-w-2xl">
                  <div className="flex bg-white p-1 rounded-xl border border-slate-200 shadow-sm w-full sm:w-auto">
                    {(['all', 'pending', 'approved', 'rejected'] as UserStatus[]).map((tab) => (
                      <button key={tab} onClick={() => setUserFilter(tab)} className={`px-4 py-2 text-[10px] font-black uppercase tracking-widest rounded-lg transition-all ${userFilter === tab ? 'bg-blue-600 text-white shadow-md' : 'text-slate-400 hover:text-slate-600'}`}>{tab}</button>
                    ))}
                  </div>
                  <div className="relative flex-1 w-full">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Search name, email..." className="pl-12 pr-6 py-3 bg-white border border-slate-200 rounded-2xl text-sm outline-none focus:ring-2 focus:ring-blue-500 transition-all w-full shadow-sm" />
                  </div>
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead>
                    <tr className="bg-slate-50 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100">
                      <th className="px-8 py-5">Full Identity</th>
                      <th className="px-8 py-5">Email Address</th>
                      <th className="px-8 py-5">Role</th>
                      <th className="px-8 py-5">Status</th>
                      <th className="px-8 py-5 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredUsers.length > 0 ? filteredUsers.map((user) => (
                      <tr key={user.id} className="hover:bg-slate-50/50 transition-colors group">
                        <td className="px-8 py-6">
                          <div className="flex items-center gap-4">
                            <div className="w-10 h-10 rounded-xl bg-white border border-slate-200 flex items-center justify-center font-black text-blue-600 shadow-sm">{user.full_name?.substring(0, 1) || 'U'}</div>
                            <span className="font-bold text-slate-900">{user.full_name}</span>
                          </div>
                        </td>
                        <td className="px-8 py-6 text-sm text-slate-600">{user.email}</td>
                        <td className="px-8 py-6"><span className="bg-purple-50 text-purple-700 px-2 py-1 rounded-lg text-xs font-bold">{user.role}</span></td>
                        <td className="px-8 py-6"><span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase ${user.status === 'approved' ? 'bg-green-50 text-green-700' : 'bg-orange-50 text-orange-700'}`}>{user.status}</span></td>
                        <td className="px-8 py-6 text-right">
                           <div className="flex items-center justify-end gap-2">
                             {actionLoading === user.id ? <Loader2 className="w-4 h-4 animate-spin" /> : (
                               <>
                                 {user.status === 'pending' && (<><button onClick={() => handleStatusChange(user.id, 'approved')} className="p-2 bg-green-50 text-green-600 rounded-lg hover:bg-green-100 transition-colors"><CheckCircle2 className="w-4 h-4" /></button><button onClick={() => handleStatusChange(user.id, 'rejected')} className="p-2 bg-orange-50 text-orange-600 rounded-lg hover:bg-orange-100 transition-colors"><X className="w-4 h-4" /></button></>)}
                                 <button onClick={() => handleDeleteUser(user.id)} className="p-2 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"><Trash2 className="w-4 h-4" /></button>
                               </>
                             )}
                           </div>
                        </td>
                      </tr>
                    )) : (<tr><td colSpan={5} className="px-8 py-20 text-center text-slate-400 font-medium">No users found.</td></tr>)}
                  </tbody>
                </table>
              </div>
            </div>
        </div>
      )}
    </div>
  );
};

export default Admin;
