import React, { useState, useEffect, useRef } from 'react';
import { Shield, RefreshCw, Search, Loader2, Users, Crown, ShieldCheck, Zap, Trash2, ShieldAlert, Copy, Activity, X, Eye, CheckCircle2, Sliders, Atom, Beaker, FunctionSquare, FileUp, FileText, AlertTriangle, Printer, Terminal, FileSpreadsheet, Download, Edit3, File, Settings2 } from 'lucide-react';
import { getAllProfiles, updateProfileStatus, deleteProfile, createDailyChallenge, getDailyAttempts, getAllDailyChallenges } from '../supabase';
import { generateFullJEEDailyPaper, parseDocumentToQuestions } from '../geminiService';
import { useNavigate } from 'react-router-dom';
import { NCERT_CHAPTERS } from '../constants';
import { Subject, ExamType } from '../types';
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

const SqlFixDialog = ({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) => {
  if (!isOpen) return null;
  const sqlCode = `-- Fix Permissions
alter table daily_challenges enable row level security;
create policy "Public Read Daily" on daily_challenges for select using (true);
create policy "Public Insert Daily" on daily_challenges for insert with check (true);
UPDATE public.profiles SET role = 'admin', status = 'approved' WHERE email = 'name@admin.com';`;

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center bg-slate-900/90 backdrop-blur-md p-4">
      <div className="bg-slate-950 rounded-2xl w-full max-w-3xl overflow-hidden shadow-2xl border border-slate-800 flex flex-col">
        <div className="p-6 border-b border-slate-800 flex justify-between items-center bg-slate-900 text-white">
            <h3 className="text-xl font-bold text-red-400">Database Sync Repair</h3>
            <button onClick={onClose}><X /></button>
        </div>
        <div className="p-8 bg-black text-green-400 font-mono text-sm">
            <pre>{sqlCode}</pre>
        </div>
        <div className="p-6 border-t border-slate-800 bg-slate-900 flex justify-end">
            <button onClick={onClose} className="px-8 py-3 bg-white text-slate-950 font-bold rounded-xl">Dismiss</button>
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
    <div className={`fixed bottom-6 right-6 z-[100] px-6 py-4 rounded-xl shadow-2xl flex items-center gap-3 animate-in slide-in-from-bottom-10 border ${type === 'error' ? 'bg-red-50 text-red-900 border-red-200' : 'bg-slate-900 text-white border-slate-800'}`}>
       {type === 'error' ? <AlertTriangle className="w-5 h-5 shrink-0" /> : <CheckCircle2 className="w-5 h-5 shrink-0" />}
       <span className="font-bold text-sm">{message}</span>
    </div>
  );
};

const SubjectConfigModal = ({ isOpen, onClose, subject, config, onUpdate }: { isOpen: boolean; onClose: () => void; subject: string; config: SubjectConfig; onUpdate: (newConfig: SubjectConfig) => void; }) => {
    const chapters = NCERT_CHAPTERS[subject as keyof typeof NCERT_CHAPTERS] || [];
    const [localChapters, setLocalChapters] = useState<string[]>(config.chapters);
    const [localTopics, setLocalTopics] = useState<string[]>(config.topics);

    useEffect(() => { if(isOpen) { setLocalChapters(config.chapters); setLocalTopics(config.topics); } }, [isOpen, config]);

    const handleChapterToggle = (chapName: string) => {
        setLocalChapters(prev => prev.includes(chapName) ? prev.filter(c => c !== chapName) : [...prev, chapName]);
    };

    const handleSave = () => { onUpdate({ ...config, chapters: localChapters, topics: localTopics }); onClose(); };

    if (!isOpen) return null;
    return (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="bg-white rounded-[2rem] w-full max-w-2xl max-h-[80vh] flex flex-col overflow-hidden shadow-2xl">
                <div className="p-6 border-b flex items-center justify-between bg-slate-50">
                    <h3 className="text-xl font-black text-slate-900">Syllabus Selection: {subject}</h3>
                    <button onClick={onClose}><X className="text-slate-400" /></button>
                </div>
                <div className="flex-1 overflow-y-auto p-6 space-y-4">
                    <p className="text-xs font-bold text-slate-400 uppercase">Select Target Chapters</p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {chapters.map(c => (
                            <button key={c.name} onClick={() => handleChapterToggle(c.name)} className={`p-4 rounded-xl text-left text-xs font-bold border-2 transition-all ${localChapters.includes(c.name) ? 'border-indigo-500 bg-indigo-50 text-indigo-900' : 'border-slate-100 text-slate-500'}`}>
                                {c.name}
                            </button>
                        ))}
                    </div>
                </div>
                <div className="p-6 border-t bg-slate-50 flex justify-end gap-3">
                    <button onClick={onClose} className="px-6 py-3 font-bold text-slate-500">Cancel</button>
                    <button onClick={handleSave} className="px-8 py-3 bg-slate-900 text-white rounded-xl font-bold">Apply Selection</button>
                </div>
            </motion.div>
        </div>
    );
};

const Admin = () => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('Daily Paper Upload');
  const [users, setUsers] = useState<any[]>([]);
  const [dailyPapers, setDailyPapers] = useState<any[]>([]);
  const [analysisDate, setAnalysisDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [analysisData, setAnalysisData] = useState<any[]>([]);
  const [loadingAnalysis, setLoadingAnalysis] = useState(false);
  const [showSqlFix, setShowSqlFix] = useState(false);
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

  const [generationConfig, setGenerationConfig] = useState<GenerationConfig>({
    physics: { mcq: 8, numerical: 2, chapters: [], topics: [] },
    chemistry: { mcq: 8, numerical: 2, chapters: [], topics: [] },
    mathematics: { mcq: 8, numerical: 2, chapters: [], topics: [] },
  });

  useEffect(() => {
    if (activeTab === 'User Management') loadUsers();
    if (activeTab === 'Daily Challenges' || activeTab === 'Daily Paper Upload') loadDailyPapers();
    if (activeTab === 'Result Analysis') loadAnalysis();
  }, [activeTab]);

  const loadUsers = async () => {
    const { data } = await getAllProfiles();
    setUsers(data || []);
  };

  const loadAnalysis = async () => {
      setLoadingAnalysis(true);
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
      setLoadingAnalysis(false);
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
    <div className="space-y-8 pb-12">
      {toast && <ToastNotification message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
      <SqlFixDialog isOpen={showSqlFix} onClose={() => setShowSqlFix(false)} />
      
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
      </AnimatePresence>

      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black text-slate-900 tracking-tight flex items-center gap-3">
             Admin Hub <ShieldCheck className="w-8 h-8 text-blue-600" />
          </h1>
          <p className="text-slate-500 font-medium">Global Examination Controls</p>
        </div>
        <button onClick={() => setShowSqlFix(true)} className="px-6 py-3 bg-slate-900 text-white rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center gap-2">
           <Terminal className="w-4 h-4" /> Database Utility
        </button>
      </div>

      <div className="flex border-b border-slate-100 gap-8 overflow-x-auto no-scrollbar">
        {['Daily Paper Upload', 'Daily Challenges', 'Result Analysis', 'User Management', 'System Settings'].map(tab => (
          <button key={tab} onClick={() => setActiveTab(tab)} className={`pb-4 text-[10px] font-black uppercase tracking-widest transition-all whitespace-nowrap border-b-2 ${activeTab === tab ? 'text-blue-600 border-blue-600' : 'text-slate-400 border-transparent'}`}>
            {tab}
          </button>
        ))}
      </div>

      {activeTab === 'Daily Paper Upload' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* 1. Create or Upload */}
            <div className="bg-white p-8 rounded-[2rem] border border-slate-200 shadow-sm space-y-8">
                <div className="flex items-center gap-3 mb-2">
                    <FileText className="w-6 h-6 text-indigo-500" />
                    <h3 className="text-xl font-black text-slate-900">1. Create or Upload</h3>
                </div>

                <div className="space-y-6">
                    <div>
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block">Paper Date (Target)</label>
                        <div className="flex gap-2">
                            <input type="date" value={uploadDate} onChange={(e) => setUploadDate(e.target.value)} className="flex-1 p-4 bg-slate-50 border border-slate-100 rounded-xl font-bold text-sm outline-none focus:border-indigo-500" />
                            <button onClick={() => setUploadDate(new Date().toISOString().split('T')[0])} className="px-6 bg-blue-50 text-blue-600 rounded-xl text-[10px] font-black uppercase tracking-widest border border-blue-100">Today</button>
                        </div>
                    </div>

                    <div className="flex gap-3">
                        <button onClick={handleAIGenerateDaily} disabled={isGeneratingAI} className="flex-1 py-5 bg-indigo-600 text-white rounded-xl font-black text-[11px] uppercase tracking-widest shadow-lg shadow-indigo-200 flex items-center justify-center gap-2 hover:bg-indigo-700 transition-all disabled:opacity-50">
                            {isGeneratingAI ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
                            Auto-Generate (AI)
                        </button>
                        <button onClick={() => setHideConfig(!hideConfig)} className="px-6 py-5 bg-slate-900 text-white rounded-xl font-black text-[11px] uppercase tracking-widest flex items-center gap-2">
                            <Settings2 className="w-4 h-4" /> {hideConfig ? "Show Config" : "Hide Config"}
                        </button>
                    </div>

                    <AnimatePresence>
                        {!hideConfig && (
                            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="space-y-4 overflow-hidden">
                                {(['Physics', 'Chemistry', 'Mathematics']).map((s) => {
                                    const key = s.toLowerCase() as keyof GenerationConfig;
                                    const iconMap = { Physics: <Atom />, Chemistry: <Beaker />, Mathematics: <FunctionSquare /> };
                                    return (
                                        <div key={s} className="flex items-center gap-4 p-4 bg-slate-50 rounded-2xl border border-slate-100">
                                            <div className="p-2 bg-white rounded-lg shadow-sm text-slate-500">{iconMap[s as keyof typeof iconMap]}</div>
                                            <div className="flex-1">
                                                <p className="text-xs font-black text-slate-900">{s}</p>
                                                <button onClick={() => { setActiveConfigSubject(s); setModalOpen(true); }} className="text-[9px] font-black text-blue-600 uppercase flex items-center gap-1 hover:underline">
                                                    <Edit3 className="w-2.5 h-2.5" /> {generationConfig[key].chapters.length === 0 ? "Full Syllabus" : `${generationConfig[key].chapters.length} Chapters`}
                                                </button>
                                            </div>
                                            <div className="flex items-center gap-6">
                                                <div className="flex flex-col items-center">
                                                    <span className="text-[9px] font-black text-slate-400 uppercase mb-1">MCQ</span>
                                                    <input type="text" value={generationConfig[key].mcq} onChange={(e) => updateSubConfig(key, 'mcq', e.target.value)} className="w-16 p-2 bg-white border rounded-lg text-center font-bold text-xs" />
                                                </div>
                                                <div className="flex flex-col items-center">
                                                    <span className="text-[9px] font-black text-slate-400 uppercase mb-1">Num</span>
                                                    <input type="text" value={generationConfig[key].numerical} onChange={(e) => updateSubConfig(key, 'numerical', e.target.value)} className="w-16 p-2 bg-white border rounded-lg text-center font-bold text-xs" />
                                                </div>
                                                <div className="flex flex-col items-end min-w-[40px]">
                                                    <span className="text-[9px] font-black text-slate-400 uppercase mb-1">Total</span>
                                                    <span className="text-sm font-black text-slate-900">{generationConfig[key].mcq + generationConfig[key].numerical}</span>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </motion.div>
                        )}
                    </AnimatePresence>

                    <div className="relative py-4">
                        <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-slate-100"></div></div>
                        <div className="relative flex justify-center"><span className="bg-white px-4 text-[10px] font-black text-slate-300 uppercase tracking-widest">Or Upload PDF</span></div>
                    </div>

                    <div className="space-y-4">
                         <div>
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block">Question Paper (PDF/Image)</label>
                            <label className="flex flex-col items-center justify-center p-6 border-2 border-dashed border-slate-200 rounded-2xl cursor-pointer hover:bg-slate-50 transition-all">
                                <div className="flex items-center gap-3 text-slate-500 font-bold text-sm">
                                    <FileUp className="w-5 h-5" /> {qFile ? qFile.name : "Upload QP"}
                                </div>
                                <input type="file" className="hidden" onChange={(e) => setQFile(e.target.files?.[0] || null)} />
                            </label>
                         </div>
                         <div>
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block">Solution Key (Optional)</label>
                            <label className="flex flex-col items-center justify-center p-6 border-2 border-dashed border-slate-200 rounded-2xl cursor-pointer hover:bg-slate-50 transition-all">
                                <div className="flex items-center gap-3 text-slate-500 font-bold text-sm">
                                    <FileUp className="w-5 h-5" /> {sFile ? sFile.name : "Upload Answer Key"}
                                </div>
                                <input type="file" className="hidden" onChange={(e) => setSFile(e.target.files?.[0] || null)} />
                            </label>
                         </div>
                         <button onClick={handleParseDocument} disabled={!qFile || isParsing} className="w-full py-5 bg-slate-400 text-white rounded-xl font-black text-[11px] uppercase tracking-widest flex items-center justify-center gap-2 hover:bg-slate-500 transition-all disabled:opacity-30">
                            {isParsing ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileText className="w-4 h-4" />}
                            Parse Uploaded Files
                         </button>
                    </div>
                </div>
            </div>

            {/* 2. Paper Preview */}
            <div className="bg-slate-50 p-8 rounded-[2rem] border border-slate-200 shadow-sm flex flex-col h-full min-h-[600px]">
                <div className="flex items-center gap-3 mb-8">
                    <Eye className="w-6 h-6 text-indigo-500" />
                    <h3 className="text-xl font-black text-slate-900">2. Paper Preview</h3>
                </div>

                <div className="flex-1 flex flex-col">
                    {parsedQuestions.length > 0 ? (
                        <div className="flex flex-col h-full space-y-4">
                            <div className="flex-1 overflow-y-auto space-y-4 pr-2 custom-scrollbar max-h-[500px]">
                                {parsedQuestions.map((q, i) => (
                                    <div key={i} className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm">
                                        <div className="flex items-center justify-between mb-3">
                                            <span className="text-[10px] font-black text-blue-600 uppercase tracking-widest bg-blue-50 px-2 py-1 rounded-md">{q.subject}</span>
                                            <span className="text-[10px] font-bold text-slate-400">{q.type}</span>
                                        </div>
                                        <MathText text={q.statement.substring(0, 150) + '...'} className="text-sm font-medium text-slate-700" />
                                    </div>
                                ))}
                            </div>
                            <div className="pt-6 border-t">
                                <div className="bg-blue-600 p-6 rounded-3xl text-white shadow-xl shadow-blue-200">
                                    <div className="flex justify-between items-center mb-6">
                                        <div>
                                            <p className="text-[10px] font-black text-blue-200 uppercase tracking-widest">Paper Statistics</p>
                                            <p className="text-2xl font-black">{parsedQuestions.length} Questions Loaded</p>
                                        </div>
                                        <div className="text-right">
                                            <p className="text-[10px] font-black text-blue-200 uppercase tracking-widest">Total Marks</p>
                                            <p className="text-2xl font-black">{parsedQuestions.length * 4}</p>
                                        </div>
                                    </div>
                                    <button onClick={handlePublishDaily} disabled={isPublishing} className="w-full py-5 bg-white text-blue-600 rounded-2xl font-black text-sm uppercase tracking-widest hover:scale-[1.02] active:scale-95 transition-all shadow-lg flex items-center justify-center gap-2 disabled:opacity-50">
                                        {isPublishing ? <Loader2 className="animate-spin" /> : <CheckCircle2 />}
                                        {isPublishing ? "Publishing..." : "Finalize & Publish Paper"}
                                    </button>
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="flex-1 flex flex-col items-center justify-center text-slate-400 space-y-4">
                            <div className="p-6 bg-white rounded-full shadow-sm">
                                <File className="w-12 h-12 opacity-20" />
                            </div>
                            <p className="text-sm font-bold uppercase tracking-widest">No data parsed or generated</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
      )}

      {activeTab === 'Daily Challenges' && (
        <div className="bg-white rounded-[2rem] border border-slate-200 overflow-hidden shadow-sm">
             <table className="w-full text-left">
                <thead className="bg-slate-50 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b">
                    <tr><th className="px-8 py-5">Scheduled Date</th><th className="px-8 py-5">Question Count</th><th className="px-8 py-5 text-right">Actions</th></tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                    {dailyPapers.map((p, i) => (
                        <tr key={i} className="hover:bg-slate-50 transition-colors">
                            <td className="px-8 py-6"><span className="font-black text-slate-900">{p.date}</span></td>
                            <td className="px-8 py-6 font-bold text-slate-500">{p.questions?.length} Target Qs</td>
                            <td className="px-8 py-6 text-right"><button className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg"><RefreshCw className="w-4 h-4" /></button></td>
                        </tr>
                    ))}
                </tbody>
             </table>
        </div>
      )}

      {activeTab === 'Result Analysis' && (
        <div className="space-y-6">
            <div className="flex items-center gap-4 p-4 bg-white rounded-2xl border">
                <label className="text-[10px] font-black uppercase text-slate-400">Analysis Snapshot</label>
                <input type="date" value={analysisDate} onChange={(e) => setAnalysisDate(e.target.value)} className="p-2 border rounded-xl font-bold" />
                <button onClick={loadAnalysis} className="p-2 bg-blue-600 text-white rounded-lg"><RefreshCw className="w-4 h-4" /></button>
            </div>
            <div className="bg-white rounded-[2rem] border overflow-x-auto shadow-sm">
                <table className="w-full text-left text-xs border-collapse">
                    <thead className="bg-slate-50 font-black text-slate-400 uppercase tracking-widest border-b">
                        <tr><th className="px-6 py-5">Rank</th><th className="px-8 py-5">Candidate</th><th className="px-6 py-5">Phy</th><th className="px-6 py-5">Chem</th><th className="px-6 py-5">Math</th><th className="px-8 py-5">Score</th></tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {analysisData.map((r, i) => (
                            <tr key={i} className="hover:bg-slate-50 transition-colors">
                                <td className="px-6 py-5 font-black text-slate-400">#0{r.rank}</td>
                                <td className="px-8 py-5 font-bold text-slate-900">{r.name}</td>
                                <td className="px-6 py-5 font-bold text-blue-600">{r.stats.Physics.Score}</td>
                                <td className="px-6 py-5 font-bold text-emerald-600">{r.stats.Chemistry.Score}</td>
                                <td className="px-6 py-5 font-bold text-fuchsia-600">{r.stats.Mathematics.Score}</td>
                                <td className="px-8 py-5 font-black text-slate-900">{r.total}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
      )}

      {activeTab === 'User Management' && (
        <div className="bg-white rounded-[2rem] border border-slate-200 overflow-hidden shadow-sm">
             <table className="w-full text-left">
                <thead className="bg-slate-50 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b">
                    <tr><th className="px-8 py-5">Student Identity</th><th className="px-8 py-5">Role</th><th className="px-8 py-5">Status</th><th className="px-8 py-5 text-right">Actions</th></tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                    {users.map((u) => (
                        <tr key={u.id} className="hover:bg-slate-50 transition-colors">
                            <td className="px-8 py-6">
                                <div className="flex flex-col"><span className="font-black text-slate-900">{u.full_name}</span><span className="text-[10px] font-bold text-slate-400">{u.email}</span></div>
                            </td>
                            <td className="px-8 py-6"><span className="text-[10px] font-black uppercase text-slate-400 px-2 py-1 bg-slate-100 rounded-md">{u.role}</span></td>
                            <td className="px-8 py-6"><span className={`px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest ${u.status === 'approved' ? 'bg-green-100 text-green-700' : 'bg-orange-100 text-orange-700'}`}>{u.status}</span></td>
                            <td className="px-8 py-6 text-right">
                                <div className="flex justify-end gap-2">
                                    <button onClick={() => updateProfileStatus(u.id, 'approved')} className="p-2 text-green-600 bg-green-50 rounded-lg hover:scale-110 transition-transform"><CheckCircle2 className="w-4 h-4" /></button>
                                    <button onClick={() => deleteProfile(u.id)} className="p-2 text-red-400 bg-red-50 rounded-lg hover:scale-110 transition-transform"><Trash2 className="w-4 h-4" /></button>
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