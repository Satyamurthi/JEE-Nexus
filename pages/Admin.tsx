import React, { useState, useEffect, useRef } from 'react';
import { Shield, RefreshCw, Search, Loader2, Users, Crown, ShieldCheck, Zap, Trash2, ShieldAlert, Copy, Activity, X, Eye, CheckCircle2, Sliders, Atom, Beaker, FunctionSquare, FileUp, FileText, AlertTriangle, Printer, Terminal, FileSpreadsheet, Download, Edit3, File, Settings2, Settings, Info, ChevronRight, Sparkles, ClipboardCheck, ArrowRight } from 'lucide-react';
import { getAllProfiles, updateProfileStatus, deleteProfile, createDailyChallenge, getDailyAttempts, getAllDailyChallenges } from '../supabase';
import { generateFullJEEDailyPaper, parseDocumentToQuestions } from '../geminiService';
import { useNavigate } from 'react-router-dom';
import { NCERT_CHAPTERS } from '../constants';
import { Subject, ExamType } from '../types';
import MathText from '../components/MathText';
import { motion, AnimatePresence } from 'framer-motion';

const REPAIR_SQL = `-- 1. ENABLE CRYPTO EXTENSION
create extension if not exists pgcrypto;

-- 2. PUBLIC PROFILES TABLE
create table if not exists public.profiles (
  id uuid references auth.users on delete cascade not null primary key,
  email text unique not null,
  full_name text,
  role text default 'student' check (role in ('student', 'admin')),
  status text default 'pending' check (status in ('pending', 'approved', 'rejected')),
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 3. ENABLE RLS
alter table public.profiles enable row level security;

-- 4. POLICIES (Drop existing to avoid conflicts)
drop policy if exists "Public profiles are viewable by everyone" on profiles;
create policy "Public profiles are viewable by everyone" on profiles for select using (true);

drop policy if exists "Users can update own profile" on profiles;
create policy "Users can update own profile" on profiles for update using (auth.uid() = id);

drop policy if exists "Admins can update all profiles" on profiles;
create policy "Admins can update all profiles" on profiles for update using (
  exists (select 1 from profiles where id = auth.uid() and role = 'admin')
);

-- 5. USER MANAGEMENT TRIGGER
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

-- 6. CONTENT TABLES
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
alter table public.questions enable row level security;
drop policy if exists "Read questions" on questions;
create policy "Read questions" on questions for select using (true);
drop policy if exists "Insert questions" on questions;
create policy "Insert questions" on questions for insert with check (auth.role() = 'authenticated');

create table if not exists public.daily_challenges (
  date date primary key,
  questions jsonb not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);
alter table public.daily_challenges enable row level security;
drop policy if exists "Public Read Daily" on daily_challenges;
create policy "Public Read Daily" on daily_challenges for select using (true);
drop policy if exists "Admins Manage Daily" on daily_challenges;
create policy "Admins Manage Daily" on daily_challenges for all using (
  exists (select 1 from profiles where id = auth.uid() and role = 'admin')
);

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
drop policy if exists "Users manage own attempts" on daily_attempts;
create policy "Users manage own attempts" on daily_attempts for all using (auth.uid() = user_id);
drop policy if exists "Admins view all attempts" on daily_attempts;
create policy "Admins view all attempts" on daily_attempts for select using (
  exists (select 1 from profiles where id = auth.uid() and role = 'admin')
);

-- 7. PROMOTE CURRENT USER TO ADMIN (Run this part only if needed)
-- UPDATE public.profiles SET role = 'admin', status = 'approved' WHERE email = 'YOUR_EMAIL_HERE';
`;

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

const SubjectConfigModal = ({ isOpen, onClose, subject, config, onUpdate }: { isOpen: boolean; onClose: () => void; subject: string; config: SubjectConfig; onUpdate: (newConfig: SubjectConfig) => void; }) => {
    const chapters = NCERT_CHAPTERS[subject as keyof typeof NCERT_CHAPTERS] || [];
    const [localChapters, setLocalChapters] = useState<string[]>(config.chapters);

    useEffect(() => { if(isOpen) { setLocalChapters(config.chapters); } }, [isOpen, config]);

    const handleChapterToggle = (chapName: string) => {
        setLocalChapters(prev => prev.includes(chapName) ? prev.filter(c => c !== chapName) : [...prev, chapName]);
    };

    const handleSave = () => { onUpdate({ ...config, chapters: localChapters, topics: [] }); onClose(); };

    if (!isOpen) return null;
    return (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="bg-white rounded-[2rem] w-full max-w-xl max-h-[80vh] flex flex-col overflow-hidden shadow-2xl">
                <div className="p-6 border-b flex items-center justify-between bg-slate-50">
                    <h3 className="text-xl font-black text-slate-900 uppercase tracking-tight">Syllabus: {subject}</h3>
                    <button onClick={onClose} className="p-2 hover:bg-slate-200 rounded-full transition-colors"><X className="text-slate-400 w-5 h-5" /></button>
                </div>
                <div className="flex-1 overflow-y-auto p-6 space-y-3 custom-scrollbar">
                    {chapters.map(c => (
                        <button key={c.name} onClick={() => handleChapterToggle(c.name)} className={`w-full p-4 rounded-xl text-left text-xs font-bold border-2 transition-all flex items-center justify-between ${localChapters.includes(c.name) ? 'border-indigo-500 bg-indigo-50 text-indigo-900' : 'border-slate-100 text-slate-500 hover:border-slate-200'}`}>
                            {c.name}
                            {localChapters.includes(c.name) && <CheckCircle2 className="w-4 h-4" />}
                        </button>
                    ))}
                </div>
                <div className="p-6 border-t bg-slate-50 flex justify-end gap-3">
                    <button onClick={onClose} className="px-6 py-3 font-bold text-slate-400 text-xs uppercase tracking-widest">Cancel</button>
                    <button onClick={handleSave} className="px-8 py-3 bg-slate-900 text-white rounded-xl font-black text-xs uppercase tracking-widest shadow-lg">Apply Selection</button>
                </div>
            </motion.div>
        </div>
    );
};

const DatabaseUtilityModal = ({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) => {
    const [copied, setCopied] = useState(false);

    const handleCopy = () => {
        navigator.clipboard.writeText(REPAIR_SQL);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/60 backdrop-blur-md p-4">
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="bg-slate-900 rounded-[2rem] w-full max-w-3xl max-h-[85vh] flex flex-col overflow-hidden shadow-2xl border border-white/10">
                <div className="p-8 border-b border-white/10 flex items-start justify-between bg-slate-900">
                    <div>
                        <div className="flex items-center gap-3 mb-2">
                            <div className="p-2 bg-indigo-500 rounded-lg"><Terminal className="w-5 h-5 text-white" /></div>
                            <h3 className="text-2xl font-black text-white tracking-tight">Database Repair Utility</h3>
                        </div>
                        <p className="text-slate-400 text-sm font-medium">Execute this script in your Supabase SQL Editor to fix permissions and schema.</p>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-full transition-colors"><X className="text-slate-400 w-6 h-6" /></button>
                </div>
                
                <div className="flex-1 overflow-hidden relative group">
                    <div className="absolute top-4 right-6 z-10">
                        <button onClick={handleCopy} className="px-4 py-2 bg-white/10 hover:bg-white/20 backdrop-blur-md text-white rounded-lg text-xs font-bold flex items-center gap-2 transition-all border border-white/5">
                            {copied ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                            {copied ? "COPIED TO CLIPBOARD" : "COPY SCRIPT"}
                        </button>
                    </div>
                    <pre className="h-full overflow-auto p-6 bg-[#0f172a] text-emerald-400 font-mono text-xs leading-relaxed custom-scrollbar select-all">
                        {REPAIR_SQL}
                    </pre>
                </div>

                <div className="p-6 bg-slate-900 border-t border-white/10 flex justify-between items-center">
                    <div className="flex items-center gap-2 text-slate-500 text-[10px] uppercase font-bold tracking-widest">
                        <Info className="w-3 h-3" />
                        <span>Requires SQL Editor Access</span>
                    </div>
                    <a href="https://supabase.com/dashboard/project/_/sql" target="_blank" rel="noreferrer" className="px-6 py-3 bg-indigo-600 text-white rounded-xl font-black text-xs uppercase tracking-widest hover:bg-indigo-500 transition-all shadow-lg shadow-indigo-500/20 flex items-center gap-2">
                        Open Supabase <ArrowRight className="w-3.5 h-3.5" />
                    </a>
                </div>
            </motion.div>
        </div>
    );
};

const Admin = () => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('DAILY PAPER UPLOAD');
  const [users, setUsers] = useState<any[]>([]);
  const [dailyPapers, setDailyPapers] = useState<any[]>([]);
  const [analysisDate, setAnalysisDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [analysisData, setAnalysisData] = useState<any[]>([]);
  const [toast, setToast] = useState<{message: string, type: 'success' | 'error'} | null>(null);

  // Daily Paper Upload State
  const [uploadDate, setUploadDate] = useState(new Date().toISOString().split('T')[0]);
  const [hideConfig, setHideConfig] = useState(false);
  const [qFile, setQFile] = useState<File | null>(null);
  const [sFile, setSFile] = useState<File | null>(null);
  const [isGeneratingAI, setIsGeneratingAI] = useState(false);
  const [isParsing, setIsParsing] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);
  const [parsedQuestions, setParsedQuestions] = useState<any[]>([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [activeConfigSubject, setActiveConfigSubject] = useState<string | null>(null);
  
  // Database Utility Modal State
  const [showDbUtility, setShowDbUtility] = useState(false);

  const [generationConfig, setGenerationConfig] = useState<GenerationConfig>({
    physics: { mcq: 8, numerical: 2, chapters: [], topics: [] },
    chemistry: { mcq: 8, numerical: 2, chapters: [], topics: [] },
    mathematics: { mcq: 8, numerical: 2, chapters: [], topics: [] },
  });

  useEffect(() => {
    if (activeTab === 'USER MANAGEMENT') loadUsers();
    if (activeTab === 'DAILY CHALLENGES' || activeTab === 'DAILY PAPER UPLOAD') loadDailyPapers();
    if (activeTab === 'RESULT ANALYSIS') loadAnalysis();
  }, [activeTab]);

  const loadUsers = async () => {
    const { data } = await getAllProfiles();
    setUsers(data || []);
  };

  const loadAnalysis = async () => {
      const attempts = await getDailyAttempts(analysisDate);
      const processed = attempts.map((attempt, index) => {
          const data = attempt.attempt_data || [];
          const stats = { Physics: { Score: 0 }, Chemistry: { Score: 0 }, Mathematics: { Score: 0 } };
          data.forEach((q: any) => {
              if (!q) return; 
              const subj = q.subject as 'Physics' | 'Chemistry' | 'Mathematics';
              if (q.isCorrect) stats[subj].Score += 4;
              else if (q.userAnswer) stats[subj].Score -= 1;
          });
          return { rank: index + 1, name: attempt.user_name || 'Scholar', stats, total: attempt.score };
      });
      setAnalysisData(processed);
  };

  const loadDailyPapers = async () => {
    const papers = await getAllDailyChallenges();
    setDailyPapers(papers);
  };

  const handleAIGenerateDaily = async () => {
      setIsGeneratingAI(true);
      try {
          const result = await generateFullJEEDailyPaper(generationConfig);
          setParsedQuestions([...result.physics, ...result.chemistry, ...result.mathematics]);
          setToast({ message: "Generation Complete!", type: 'success' });
      } catch (e) { setToast({ message: "Generation Failed", type: 'error' }); }
      finally { setIsGeneratingAI(false); }
  };

  const handleParseDocument = async () => {
    if (!qFile) return;
    setIsParsing(true);
    try {
      const qs = await parseDocumentToQuestions(qFile, sFile || undefined);
      setParsedQuestions(qs);
      setToast({ message: "Parsing Complete!", type: 'success' });
    } catch (e: any) { setToast({ message: e.message, type: 'error' }); }
    finally { setIsParsing(false); }
  };

  const handlePublishDaily = async () => {
    setIsPublishing(true);
    try {
      await createDailyChallenge(uploadDate, parsedQuestions);
      setParsedQuestions([]);
      loadDailyPapers();
      setToast({ message: "Paper Published!", type: 'success' });
    } catch (e) { setToast({ message: "Publish Failed", type: 'error' }); }
    finally { setIsPublishing(false); }
  };

  const updateSubConfig = (subj: keyof GenerationConfig, key: 'mcq' | 'numerical', val: string) => {
      const num = parseInt(val) || 0;
      setGenerationConfig(prev => ({ ...prev, [subj]: { ...prev[subj], [key]: num } }));
  };

  return (
    <div className="space-y-6 pb-20">
      {/* Subject Config Modal */}
      <AnimatePresence>
          {modalOpen && activeConfigSubject && (
              <SubjectConfigModal 
                isOpen={modalOpen} 
                onClose={() => setModalOpen(false)} 
                subject={activeConfigSubject} 
                config={generationConfig[activeConfigSubject.toLowerCase() as keyof GenerationConfig]}
                onUpdate={(newCfg) => setGenerationConfig(prev => ({ ...prev, [activeConfigSubject.toLowerCase() as keyof GenerationConfig]: newCfg }))}
              />
          )}
          {/* Database Utility Modal */}
          {showDbUtility && (
              <DatabaseUtilityModal isOpen={showDbUtility} onClose={() => setShowDbUtility(false)} />
          )}
      </AnimatePresence>

      {/* Header Info Banner */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black text-slate-900 tracking-tight flex items-center gap-3">
             Control Center <Crown className="w-6 h-6 text-amber-500" />
          </h1>
          <p className="text-slate-500 font-bold text-sm">Administrator Dashboard • Platform Oversight</p>
        </div>
        
        {/* Warning Banner from Image - Clickable to open utility */}
        <div 
            onClick={() => setShowDbUtility(true)}
            className="bg-orange-50 border border-orange-100 p-3 px-4 rounded-2xl flex items-center gap-3 max-w-md shadow-sm cursor-pointer hover:bg-orange-100 transition-colors group"
        >
           <AlertTriangle className="w-4 h-4 text-orange-600 shrink-0 group-hover:animate-pulse" />
           <p className="text-[10px] font-bold text-orange-800 leading-tight">
             View-Only Mode. To enable Write Access, run the 'Database Repair Script' (fixes login issues).
           </p>
        </div>
      </div>

      {/* Database Utility Button (Top Right Absolute style) - Wired Up */}
      <div className="absolute top-10 right-10 hidden lg:block">
         <button 
            onClick={() => setShowDbUtility(true)}
            className="px-6 py-3 bg-slate-900 text-white rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center gap-2 hover:bg-slate-800 transition-all shadow-xl shadow-slate-900/10"
         >
            <Terminal className="w-4 h-4" /> DATABASE UTILITY
         </button>
      </div>

      {/* Tabs Menu */}
      <div className="flex border-b border-slate-100 gap-8 overflow-x-auto no-scrollbar pt-2">
        {['DAILY PAPER UPLOAD', 'DAILY CHALLENGES', 'RESULT ANALYSIS', 'USER MANAGEMENT', 'SYSTEM SETTINGS'].map(tab => (
          <button 
            key={tab} 
            onClick={() => setActiveTab(tab)} 
            className={`pb-4 text-[10px] font-black uppercase tracking-[0.1em] transition-all whitespace-nowrap border-b-2 ${activeTab === tab ? 'text-indigo-600 border-indigo-600' : 'text-slate-400 border-transparent hover:text-slate-600'}`}
          >
            {tab}
          </button>
        ))}
      </div>

      {activeTab === 'DAILY PAPER UPLOAD' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 pt-4">
            {/* 1. Create or Upload */}
            <div className="bg-white p-10 rounded-[2.5rem] border border-slate-200 shadow-sm space-y-10">
                <div className="flex items-center gap-3">
                    <FileUp className="w-6 h-6 text-indigo-500" />
                    <h3 className="text-xl font-black text-slate-900">1. Create or Upload</h3>
                </div>

                <div className="space-y-8">
                    {/* Paper Date Section */}
                    <div>
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 block">PAPER DATE (TARGET)</label>
                        <div className="flex gap-3">
                            <input 
                              type="date" 
                              value={uploadDate} 
                              onChange={(e) => setUploadDate(e.target.value)} 
                              className="flex-1 p-4 bg-slate-50 border border-slate-100 rounded-xl font-bold text-sm text-slate-700 outline-none focus:border-indigo-500 focus:bg-white transition-all" 
                            />
                            <button onClick={() => setUploadDate(new Date().toISOString().split('T')[0])} className="px-6 bg-indigo-50 text-indigo-600 rounded-xl text-[10px] font-black uppercase tracking-widest border border-indigo-100 hover:bg-indigo-100 transition-colors">Today</button>
                        </div>
                    </div>

                    {/* AI Generation Control */}
                    <div className="flex gap-3">
                        <button 
                          onClick={handleAIGenerateDaily} 
                          disabled={isGeneratingAI} 
                          className="flex-1 py-5 bg-gradient-to-r from-indigo-500 to-violet-600 text-white rounded-xl font-black text-[11px] uppercase tracking-[0.15em] shadow-xl shadow-indigo-100 flex items-center justify-center gap-3 hover:scale-[1.01] active:scale-95 transition-all disabled:opacity-50"
                        >
                            {isGeneratingAI ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
                            AUTO-GENERATE (AI)
                        </button>
                        <button 
                          onClick={() => setHideConfig(!hideConfig)} 
                          className="px-6 py-5 bg-slate-900 text-white rounded-xl font-black text-[10px] uppercase tracking-widest flex items-center gap-3 hover:bg-slate-800 transition-all shadow-xl shadow-slate-900/10"
                        >
                            <Settings2 className="w-4 h-4 text-slate-400" /> {hideConfig ? "SHOW CONFIG" : "HIDE CONFIG"}
                        </button>
                    </div>

                    {/* Config Rows - Restored exact style from image */}
                    <AnimatePresence>
                        {!hideConfig && (
                            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="space-y-4 overflow-hidden">
                                {(['Physics', 'Chemistry', 'Mathematics']).map((s) => {
                                    const key = s.toLowerCase() as keyof GenerationConfig;
                                    const icons = { Physics: <Atom />, Chemistry: <Beaker />, Mathematics: <FunctionSquare /> };
                                    const iconBg = { Physics: 'bg-blue-50 text-blue-500', Chemistry: 'bg-emerald-50 text-emerald-500', Mathematics: 'bg-fuchsia-50 text-fuchsia-500' };
                                    return (
                                        <div key={s} className="flex items-center gap-5 p-5 bg-white rounded-2xl border border-slate-100 shadow-sm hover:shadow-md transition-all">
                                            <div className={`p-3 rounded-xl ${iconBg[s as keyof typeof iconBg]} shadow-sm`}>{icons[s as keyof typeof icons]}</div>
                                            <div className="flex-1">
                                                <p className="text-sm font-black text-slate-900">{s}</p>
                                                <button onClick={() => { setActiveConfigSubject(s); setModalOpen(true); }} className="text-[9px] font-black text-indigo-600 uppercase flex items-center gap-1.5 hover:underline tracking-tighter">
                                                    <Sliders className="w-2.5 h-2.5" /> {generationConfig[key].chapters.length === 0 ? "Full Syllabus" : `${generationConfig[key].chapters.length} Chapters`}
                                                </button>
                                            </div>
                                            <div className="flex items-center gap-6">
                                                <div className="flex flex-col items-center gap-1">
                                                    <span className="text-[8px] font-black text-slate-400 uppercase tracking-tighter">MCQ</span>
                                                    <input type="text" value={generationConfig[key].mcq} onChange={(e) => updateSubConfig(key, 'mcq', e.target.value)} className="w-14 p-2 bg-slate-50 border border-slate-100 rounded-lg text-center font-black text-xs text-slate-700 outline-none focus:border-indigo-500 focus:bg-white" />
                                                </div>
                                                <div className="flex flex-col items-center gap-1">
                                                    <span className="text-[8px] font-black text-slate-400 uppercase tracking-tighter">Num</span>
                                                    <input type="text" value={generationConfig[key].numerical} onChange={(e) => updateSubConfig(key, 'numerical', e.target.value)} className="w-14 p-2 bg-slate-50 border border-slate-100 rounded-lg text-center font-black text-xs text-slate-700 outline-none focus:border-indigo-500 focus:bg-white" />
                                                </div>
                                                <div className="flex flex-col items-end min-w-[50px] gap-1">
                                                    <span className="text-[8px] font-black text-slate-400 uppercase tracking-tighter">TOTAL</span>
                                                    <span className="text-sm font-black text-slate-900">{generationConfig[key].mcq + generationConfig[key].numerical}</span>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </motion.div>
                        )}
                    </AnimatePresence>

                    {/* Separator Restored */}
                    <div className="relative py-4 flex items-center justify-center">
                        <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-slate-100"></div></div>
                        <span className="relative bg-white px-4 text-[10px] font-black text-slate-300 uppercase tracking-[0.2em]">OR UPLOAD PDF</span>
                    </div>

                    {/* PDF Upload Sections Restored */}
                    <div className="space-y-6">
                         <div>
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 block">QUESTION PAPER (PDF/IMAGE)</label>
                            <label className="flex flex-col items-center justify-center p-8 border-2 border-dashed border-slate-200 rounded-[1.5rem] cursor-pointer hover:bg-slate-50 hover:border-indigo-300 transition-all group">
                                <div className="flex items-center gap-3 text-slate-400 font-bold text-sm group-hover:text-indigo-500 transition-colors">
                                    <FileUp className="w-5 h-5" /> {qFile ? <span className="text-slate-700">{qFile.name}</span> : "Upload QP"}
                                </div>
                                <input type="file" className="hidden" onChange={(e) => setQFile(e.target.files?.[0] || null)} />
                            </label>
                         </div>
                         <div>
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 block">SOLUTION KEY (OPTIONAL)</label>
                            <label className="flex flex-col items-center justify-center p-8 border-2 border-dashed border-slate-200 rounded-[1.5rem] cursor-pointer hover:bg-slate-50 hover:border-indigo-300 transition-all group">
                                <div className="flex items-center gap-3 text-slate-400 font-bold text-sm group-hover:text-indigo-500 transition-colors">
                                    <FileUp className="w-5 h-5" /> {sFile ? <span className="text-slate-700">{sFile.name}</span> : "Upload Answer Key"}
                                </div>
                                <input type="file" className="hidden" onChange={(e) => setSFile(e.target.files?.[0] || null)} />
                            </label>
                         </div>
                         <button onClick={handleParseDocument} disabled={!qFile || isParsing} className="w-full py-5 bg-slate-400 text-white rounded-xl font-black text-[10px] uppercase tracking-[0.15em] flex items-center justify-center gap-3 hover:bg-slate-500 transition-all disabled:opacity-30 shadow-lg shadow-slate-100">
                            {isParsing ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileText className="w-4 h-4" />}
                            PARSE UPLOADED FILES
                         </button>
                    </div>
                </div>
            </div>

            {/* 2. Paper Preview - Restored exact style from image */}
            <div className="bg-slate-50 p-10 rounded-[2.5rem] border border-slate-200 shadow-sm flex flex-col min-h-[700px]">
                <div className="flex items-center gap-3 mb-10">
                    <Eye className="w-6 h-6 text-indigo-500" />
                    <h3 className="text-xl font-black text-slate-900">2. Paper Preview</h3>
                </div>

                <div className="flex-1 flex flex-col">
                    {parsedQuestions.length > 0 ? (
                        <div className="flex flex-col h-full space-y-6">
                            <div className="flex-1 overflow-y-auto space-y-4 pr-3 custom-scrollbar max-h-[550px]">
                                {parsedQuestions.map((q, i) => (
                                    <div key={i} className="bg-white p-6 rounded-[1.5rem] border border-slate-100 shadow-sm hover:shadow-md transition-shadow">
                                        <div className="flex items-center justify-between mb-4">
                                            <span className="text-[9px] font-black text-indigo-600 uppercase tracking-[0.2em] bg-indigo-50 px-3 py-1 rounded-full">{q.subject}</span>
                                            <span className="text-[9px] font-black text-slate-300 uppercase tracking-widest">{q.type}</span>
                                        </div>
                                        <MathText text={q.statement.substring(0, 200) + (q.statement.length > 200 ? '...' : '')} className="text-sm font-bold text-slate-700 leading-relaxed" />
                                    </div>
                                ))}
                            </div>
                            <div className="pt-6">
                                <div className="bg-indigo-600 p-8 rounded-[2rem] text-white shadow-2xl shadow-indigo-200 relative overflow-hidden group">
                                    <Sparkles className="absolute top-0 right-0 p-8 w-32 h-32 opacity-10 group-hover:scale-125 transition-transform duration-1000" />
                                    <div className="flex justify-between items-end mb-8">
                                        <div>
                                            <p className="text-[10px] font-black text-indigo-200 uppercase tracking-[0.2em] mb-2">PAPER SUMMARY</p>
                                            <p className="text-3xl font-black">{parsedQuestions.length} Questions Ready</p>
                                        </div>
                                        <div className="text-right">
                                            <p className="text-[10px] font-black text-indigo-200 uppercase tracking-[0.2em] mb-2">AGGREGATE SCORE</p>
                                            <p className="text-3xl font-black">{parsedQuestions.length * 4}</p>
                                        </div>
                                    </div>
                                    <button onClick={handlePublishDaily} disabled={isPublishing} className="w-full py-5 bg-white text-indigo-600 rounded-2xl font-black text-xs uppercase tracking-[0.2em] hover:bg-slate-50 active:scale-[0.98] transition-all shadow-xl flex items-center justify-center gap-3 disabled:opacity-50">
                                        {isPublishing ? <Loader2 className="animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                                        {isPublishing ? "PUBLISHING..." : "FINALIZE & PUBLISH PAPER"}
                                    </button>
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="flex-1 flex flex-col items-center justify-center text-slate-300 space-y-6">
                            <div className="p-8 bg-white rounded-full shadow-sm">
                                <File className="w-16 h-16 opacity-10" />
                            </div>
                            <p className="text-xs font-black uppercase tracking-[0.3em]">No data parsed or generated</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
      )}

      {/* Rest of the Tabs (Kept for functionality) */}
      {activeTab === 'DAILY CHALLENGES' && (
        <div className="bg-white rounded-[2.5rem] border border-slate-200 overflow-hidden shadow-sm pt-4">
             <table className="w-full text-left">
                <thead className="bg-slate-50 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b">
                    <tr><th className="px-8 py-5">Scheduled Date</th><th className="px-8 py-5">Question Count</th><th className="px-8 py-5 text-right">Actions</th></tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                    {dailyPapers.map((p, i) => (
                        <tr key={i} className="hover:bg-slate-50/50 transition-colors">
                            <td className="px-8 py-6 font-black text-slate-900">{p.date}</td>
                            <td className="px-8 py-6 font-bold text-slate-500">{p.questions?.length} Target Qs</td>
                            <td className="px-8 py-6 text-right"><button className="p-2 text-indigo-600 hover:scale-110 transition-transform"><RefreshCw className="w-4 h-4" /></button></td>
                        </tr>
                    ))}
                </tbody>
             </table>
        </div>
      )}

      {activeTab === 'RESULT ANALYSIS' && (
        <div className="space-y-6 pt-4">
            <div className="flex items-center gap-4 p-5 bg-white rounded-[1.5rem] border border-slate-100 shadow-sm max-w-md">
                <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Select Snapshot</label>
                <input type="date" value={analysisDate} onChange={(e) => setAnalysisDate(e.target.value)} className="flex-1 p-2 bg-slate-50 border rounded-xl font-bold text-xs" />
                <button onClick={loadAnalysis} className="p-2.5 bg-indigo-600 text-white rounded-xl shadow-lg shadow-indigo-100"><RefreshCw className="w-4 h-4" /></button>
            </div>
            <div className="bg-white rounded-[2.5rem] border border-slate-100 overflow-x-auto shadow-sm">
                <table className="w-full text-left text-xs border-collapse">
                    <thead className="bg-slate-50 font-black text-slate-400 uppercase tracking-[0.15em] border-b">
                        <tr><th className="px-8 py-5">Rank</th><th className="px-10 py-5">Candidate</th><th className="px-6 py-5">Physics</th><th className="px-6 py-5">Chemistry</th><th className="px-6 py-5">Mathematics</th><th className="px-10 py-5">Global Score</th></tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                        {analysisData.map((r, i) => (
                            <tr key={i} className="hover:bg-slate-50 transition-colors font-bold">
                                <td className="px-8 py-6 font-black text-slate-400">#0{r.rank}</td>
                                <td className="px-10 py-6 text-slate-900">{r.name}</td>
                                <td className="px-6 py-6 text-blue-600">{r.stats.Physics.Score}</td>
                                <td className="px-6 py-6 text-emerald-600">{r.stats.Chemistry.Score}</td>
                                <td className="px-6 py-6 text-fuchsia-600">{r.stats.Mathematics.Score}</td>
                                <td className="px-10 py-6 font-black text-slate-900 text-base">{r.total}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
      )}

      {activeTab === 'USER MANAGEMENT' && (
        <div className="bg-white rounded-[2.5rem] border border-slate-200 overflow-hidden shadow-sm pt-4">
             <table className="w-full text-left">
                <thead className="bg-slate-50 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b">
                    <tr><th className="px-8 py-5">Identity Protocol</th><th className="px-8 py-5">Domain Role</th><th className="px-8 py-5">Verification Status</th><th className="px-8 py-5 text-right">Administrative Actions</th></tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                    {users.map((u) => (
                        <tr key={u.id} className="hover:bg-slate-50 transition-colors">
                            <td className="px-8 py-6">
                                <div className="flex flex-col"><span className="font-black text-slate-900">{u.full_name}</span><span className="text-[10px] font-bold text-slate-400 tracking-tight">{u.email}</span></div>
                            </td>
                            <td className="px-8 py-6"><span className="text-[10px] font-black uppercase text-slate-500 px-3 py-1 bg-slate-100 rounded-lg">{u.role}</span></td>
                            <td className="px-8 py-6"><span className={`px-4 py-1.5 rounded-full text-[9px] font-black uppercase tracking-widest border ${u.status === 'approved' ? 'bg-green-50 text-green-700 border-green-100' : 'bg-amber-50 text-amber-700 border-amber-100'}`}>{u.status}</span></td>
                            <td className="px-8 py-6 text-right">
                                <div className="flex justify-end gap-3">
                                    <button onClick={() => updateProfileStatus(u.id, 'approved')} className="p-2.5 text-green-600 bg-green-50 rounded-xl hover:scale-110 transition-transform"><CheckCircle2 className="w-4 h-4" /></button>
                                    <button onClick={() => deleteProfile(u.id)} className="p-2.5 text-red-400 bg-red-50 rounded-xl hover:scale-110 transition-transform"><Trash2 className="w-4 h-4" /></button>
                                </div>
                            </td>
                        </tr>
                    ))}
                </tbody>
             </table>
        </div>
      )}
    </div>
  );
};

export default Admin;