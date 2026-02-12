import React, { useState, useEffect, useRef } from 'react';
import { Shield, RefreshCw, Search, Loader2, Users, Crown, ShieldCheck, Zap, Trash2, ShieldAlert, Copy, Activity, X, Eye, CheckCircle2, Sliders, Atom, Beaker, FunctionSquare, FileUp, FileText, AlertTriangle, Printer, Terminal, FileSpreadsheet, Download } from 'lucide-react';
import { getAllProfiles, updateProfileStatus, deleteProfile, createDailyChallenge, getDailyAttempts } from '../supabase';
import { generateFullJEEDailyPaper, parseDocumentToQuestions } from '../geminiService';
import { useNavigate } from 'react-router-dom';
import { NCERT_CHAPTERS } from '../constants';
import { Subject, ExamType } from '../types';
import MathText from '../components/MathText';
import { motion, AnimatePresence } from 'framer-motion';

// Note: API Key management sections removed to comply with environment-only key requirements.

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

const SqlFixDialog = ({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) => {
  if (!isOpen) return null;
  
  const sqlCode = `-- Enable Crypto and Fix Permissions
create extension if not exists pgcrypto;
alter table daily_challenges enable row level security;
alter table daily_attempts enable row level security;
alter table profiles enable row level security;

create policy "Public Read Daily" on daily_challenges for select using (true);
create policy "Public Insert Daily" on daily_challenges for insert with check (true);
create policy "Public Update Daily" on daily_challenges for update using (true);

-- Ensure admin account is correctly set
UPDATE public.profiles SET role = 'admin', status = 'approved' WHERE email = 'name@admin.com';`;

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
                <ShieldAlert className="w-6 h-6" /> Database Sync Repair
            </h3>
            <button onClick={onClose}><X className="text-slate-400 hover:text-white" /></button>
        </div>
        <div className="p-8 overflow-y-auto custom-scrollbar">
            <p className="text-slate-300 mb-6 leading-relaxed">
                Execute this script in your Supabase SQL console to resolve RLS policy issues and finalize admin roles.
            </p>
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
        setLocalChapters(newChapters);
    };

    const handleTopicToggle = (topic: string) => {
        setLocalTopics(prev => prev.includes(topic) ? prev.filter(t => t !== topic) : [...prev, topic]);
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
                <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50">
                    <h3 className="text-xl font-black text-slate-900">Configure {subject}</h3>
                    <button onClick={onClose} className="p-2 bg-slate-200 rounded-full text-slate-500"><X className="w-5 h-5" /></button>
                </div>
                
                <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar">
                    {chapters.map((chap) => {
                        const isChapSelected = localChapters.includes(chap.name);
                        return (
                            <div key={chap.name} className={`border-2 rounded-2xl ${isChapSelected ? 'border-blue-500 bg-blue-50/30' : 'border-slate-100'}`}>
                                <div className="p-4 flex items-center justify-between cursor-pointer" onClick={() => handleChapterToggle(chap.name)}>
                                    <span className="font-bold">{chap.name}</span>
                                    {isChapSelected && <CheckCircle2 className="w-5 h-5 text-blue-600" />}
                                </div>
                                {isChapSelected && (
                                    <div className="p-4 border-t border-blue-100 bg-white rounded-b-xl flex flex-wrap gap-2">
                                        {chap.topics.map(topic => (
                                            <button 
                                                key={topic} 
                                                onClick={() => handleTopicToggle(topic)}
                                                className={`px-3 py-1.5 rounded-lg text-xs font-bold border ${localTopics.includes(topic) ? 'bg-blue-600 text-white border-blue-600' : 'bg-slate-50 text-slate-500'}`}
                                            >
                                                {topic}
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>

                <div className="p-6 border-t border-slate-100 bg-slate-50 flex justify-end gap-3">
                    <button onClick={onClose} className="px-6 py-3 rounded-xl font-bold text-slate-500">Cancel</button>
                    <button onClick={handleSave} className="px-8 py-3 bg-blue-600 text-white rounded-xl font-black shadow-lg">Save Selection</button>
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

  useEffect(() => { 
    setAnalysisDate(getLocalToday()); 
    setUploadDate(getLocalToday());
  }, []);

  const [uploadDate, setUploadDate] = useState('');
  const [qFile, setQFile] = useState<File | null>(null);
  const [sFile, setSFile] = useState<File | null>(null);
  const [isParsing, setIsParsing] = useState(false);
  const [parsedQuestions, setParsedQuestions] = useState<any[]>([]);
  const [isPublishing, setIsPublishing] = useState(false);
  const [isGeneratingAI, setIsGeneratingAI] = useState(false);
  const [genStatus, setGenStatus] = useState("");
  
  const [modalOpen, setModalOpen] = useState(false);
  const [activeConfigSubject, setActiveConfigSubject] = useState<string | null>(null);

  const [generationConfig, setGenerationConfig] = useState<GenerationConfig>({
    physics: { mcq: 8, numerical: 2, chapters: [], topics: [] },
    chemistry: { mcq: 8, numerical: 2, chapters: [], topics: [] },
    mathematics: { mcq: 8, numerical: 2, chapters: [], topics: [] },
  });

  const [actionLoading, setActionLoading] = useState<string | null>(null);

  useEffect(() => {
    if (activeTab === 'User Management') loadUsers();
    if (activeTab === 'Daily Challenges' || activeTab === 'Daily Paper Upload') loadDailyPapers();
    if (activeTab === 'Result Analysis') loadAnalysis();
  }, [activeTab, analysisDate]);

  const loadUsers = async () => {
    setLoadingUsers(true);
    try {
      const { data, error } = await getAllProfiles();
      if (!error) setUsers(data || []);
    } catch (err) {} finally { setLoadingUsers(false); }
  };

  const loadAnalysis = async () => {
      setLoadingAnalysis(true);
      try {
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
              return { rank: index + 1, name: attempt.user_name || 'Aspiring Scholar', stats, total: attempt.score };
          });
          setAnalysisData(processed);
      } catch (e) {} finally { setLoadingAnalysis(false); }
  };

  const loadDailyPapers = async () => {
    const papers = await getAllDailyChallenges();
    setDailyPapers(papers);
  };

  const handleParseDocument = async () => {
    if (!qFile) { showToast("Upload file first", 'error'); return; }
    setIsParsing(true);
    try {
      const questions = await parseDocumentToQuestions(qFile, sFile || undefined);
      setParsedQuestions(questions);
      showToast("Parsing complete!");
    } catch (e: any) { showToast(e.message, 'error'); } finally { setIsParsing(false); }
  };

  const handleAIGenerateDaily = async () => {
      setIsGeneratingAI(true); setGenStatus("Synthesizing JEE paper via Gemini...");
      try {
          const result = await generateFullJEEDailyPaper(generationConfig);
          const final = [...(result.physics || []), ...(result.chemistry || []), ...(result.mathematics || [])];
          setParsedQuestions(final);
          showToast("Generation complete!");
      } catch (e: any) { showToast("Generation failed", 'error'); } finally { setIsGeneratingAI(false); setGenStatus(""); }
  };

  const handlePublishDaily = async () => {
    setIsPublishing(true);
    try {
      await createDailyChallenge(uploadDate, parsedQuestions);
      loadDailyPapers(); setParsedQuestions([]); showToast("Paper Published!");
    } catch (e: any) { showToast("Publish failed", 'error'); } finally { setIsPublishing(false); }
  };

  const handleStatusChange = async (userId: string, status: 'approved' | 'rejected') => {
    setActionLoading(userId);
    const error = await updateProfileStatus(userId, status);
    if (!error) { setUsers(prev => prev.map(u => u.id === userId ? { ...u, status } : u)); showToast("Status updated"); }
    else showToast(error, 'error');
    setActionLoading(null);
  };

  const handleDeleteUser = async (userId: string) => {
    setConfirmState({ isOpen: true, title: 'Delete User?', message: 'This action cannot be undone.', onConfirm: async () => { closeConfirm(); const error = await deleteProfile(userId); if (!error) setUsers(prev => prev.filter(u => u.id !== userId)); } });
  };

  return (
    <div className="space-y-8 pb-12">
      <ConfirmDialog isOpen={confirmState.isOpen} title={confirmState.title} message={confirmState.message} onConfirm={confirmState.onConfirm} onCancel={closeConfirm} />
      <SqlFixDialog isOpen={showSqlFix} onClose={() => setShowSqlFix(false)} />
      {toast && <ToastNotification message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black text-slate-900 tracking-tight flex items-center gap-3">
            Control Center <ShieldCheck className="w-8 h-8 text-blue-600" />
          </h1>
          <p className="text-slate-500 font-medium">Administration & content oversight.</p>
        </div>
        <button onClick={() => setShowSqlFix(true)} className="px-6 py-3 bg-slate-900 text-white rounded-xl text-xs font-bold flex items-center gap-2 shadow-lg">
           <Terminal className="w-4 h-4" /> SQL Repair Script
        </button>
      </div>

      <div className="flex border-b border-slate-200 gap-8 overflow-x-auto no-scrollbar">
        {['Daily Paper Upload', 'Daily Challenges', 'Result Analysis', 'User Management'].map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`pb-4 text-sm font-black uppercase tracking-widest transition-all whitespace-nowrap ${
              activeTab === tab ? 'text-blue-600 border-b-2 border-blue-600' : 'text-slate-400'
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {activeTab === 'Daily Paper Upload' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <div className="bg-white p-8 rounded-[2.5rem] border border-slate-200 shadow-sm space-y-6">
                 <h3 className="text-xl font-black text-slate-900 flex items-center gap-2"><FileUp className="w-6 h-6" /> Create Daily Paper</h3>
                 <div className="space-y-4">
                    <input type="date" value={uploadDate} onChange={(e) => setUploadDate(e.target.value)} className="w-full p-4 bg-slate-50 border rounded-xl" />
                    <button onClick={handleAIGenerateDaily} disabled={isGeneratingAI} className="w-full py-4 bg-blue-600 text-white rounded-xl font-bold flex items-center justify-center gap-3">
                        {isGeneratingAI ? <Loader2 className="animate-spin" /> : <Zap className="w-4 h-4" />} {isGeneratingAI ? genStatus : "Generate Daily Paper (AI)"}
                    </button>
                    <div className="relative py-4 text-center text-xs font-bold text-slate-400 uppercase">OR Upload PDF</div>
                    <input type="file" onChange={(e) => setQFile(e.target.files?.[0] || null)} className="w-full p-4 bg-slate-50 border border-dashed rounded-xl" />
                    <button onClick={handleParseDocument} disabled={!qFile || isParsing} className="w-full py-4 bg-slate-900 text-white rounded-xl font-bold flex items-center justify-center gap-3">
                        {isParsing ? <Loader2 className="animate-spin" /> : <FileText />} Parse Document
                    </button>
                 </div>
            </div>
            <div className="bg-slate-50 p-8 rounded-[2.5rem] border border-slate-200 h-[500px] overflow-y-auto">
                <h3 className="text-xl font-black text-slate-900 flex items-center gap-2 mb-4">Preview</h3>
                {parsedQuestions.length > 0 ? (
                    <div className="space-y-4">
                        {parsedQuestions.map((q, i) => (
                            <div key={i} className="bg-white p-4 rounded-xl border">
                                <p className="text-xs font-bold text-blue-600 mb-1">{q.subject}</p>
                                <MathText text={q.statement.substring(0, 150) + '...'} className="text-sm" />
                            </div>
                        ))}
                        <button onClick={handlePublishDaily} disabled={isPublishing} className="w-full py-6 bg-green-600 text-white rounded-2xl font-black mt-4">
                            {isPublishing ? "Publishing..." : "Finalize & Publish"}
                        </button>
                    </div>
                ) : <div className="h-full flex items-center justify-center text-slate-400 font-bold uppercase tracking-widest text-xs">No questions loaded</div>}
            </div>
        </div>
      )}

      {activeTab === 'Daily Challenges' && (
        <div className="bg-white rounded-[2.5rem] border overflow-hidden">
             <table className="w-full text-left">
                <thead className="bg-slate-50 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                    <tr><th className="px-8 py-5">Scheduled Date</th><th className="px-8 py-5">Count</th><th className="px-8 py-5 text-right">Actions</th></tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                    {dailyPapers.map((p, i) => (
                        <tr key={i}><td className="px-8 py-6 font-bold">{p.date}</td><td className="px-8 py-6">{p.questions?.length} Qs</td><td className="px-8 py-6 text-right"><button className="text-blue-600 hover:scale-110 transition-transform"><RefreshCw className="w-4 h-4" /></button></td></tr>
                    ))}
                </tbody>
             </table>
        </div>
      )}

      {activeTab === 'Result Analysis' && (
        <div className="space-y-6">
            <input type="date" value={analysisDate} onChange={(e) => setAnalysisDate(e.target.value)} className="p-4 border rounded-xl" />
            <div className="bg-white rounded-[2.5rem] border overflow-x-auto" ref={printRef}>
                <table className="w-full text-left text-xs border-collapse">
                    <thead className="bg-slate-50 font-black text-slate-400 uppercase">
                        <tr><th className="px-4 py-4">Rank</th><th className="px-6 py-4">Student</th><th className="px-4 py-4">Physics</th><th className="px-4 py-4">Chem</th><th className="px-4 py-4">Math</th><th className="px-8 py-4">Total</th></tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {analysisData.map((r, i) => (
                            <tr key={i}><td className="px-4 py-4 font-bold">{r.rank}</td><td className="px-6 py-4">{r.name}</td><td className="px-4 py-4">{r.stats.Physics.Score}</td><td className="px-4 py-4">{r.stats.Chemistry.Score}</td><td className="px-4 py-4">{r.stats.Mathematics.Score}</td><td className="px-8 py-4 font-black">{r.total}</td></tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
      )}

      {activeTab === 'User Management' && (
        <div className="bg-white rounded-[2.5rem] border overflow-hidden">
             <table className="w-full text-left">
                <thead className="bg-slate-50 text-[10px] font-black text-slate-400 uppercase">
                    <tr><th className="px-8 py-5">Identity</th><th className="px-8 py-5">Role</th><th className="px-8 py-5">Status</th><th className="px-8 py-5 text-right">Actions</th></tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                    {users.map((u) => (
                        <tr key={u.id}>
                            <td className="px-8 py-6">
                                <div className="flex flex-col"><span className="font-bold">{u.full_name}</span><span className="text-[10px] text-slate-400">{u.email}</span></div>
                            </td>
                            <td className="px-8 py-6"><span className="text-xs font-bold text-slate-500">{u.role}</span></td>
                            <td className="px-8 py-6"><span className={`px-2 py-1 rounded text-[10px] font-black uppercase ${u.status === 'approved' ? 'bg-green-100 text-green-700' : 'bg-orange-100 text-orange-700'}`}>{u.status}</span></td>
                            <td className="px-8 py-6 text-right">
                                <div className="flex justify-end gap-2">
                                    {u.status === 'pending' && <button onClick={() => handleStatusChange(u.id, 'approved')} className="p-2 text-green-600 bg-green-50 rounded-lg"><CheckCircle2 className="w-4 h-4" /></button>}
                                    <button onClick={() => handleDeleteUser(u.id)} className="p-2 text-red-400 bg-red-50 rounded-lg"><Trash2 className="w-4 h-4" /></button>
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