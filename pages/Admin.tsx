
import React, { useState, useEffect } from 'react';
import { Shield, Plus, RefreshCw, Search, UserCheck, UserX, Loader2, Users, Crown, Mail, ShieldCheck, Zap, Trash2, ShieldAlert, Copy, ExternalLink, CloudOff, Activity, MoreHorizontal, X, Save, Eye, EyeOff, CheckCircle2, ChevronDown, UserPlus, Database, Calendar, CalendarClock, RotateCcw, Medal, FileUp, FileText, AlertTriangle, ArrowRight, XCircle, Key, Lock, Server, Sparkles, Sliders, Atom, Beaker, FunctionSquare, Layers, Cpu } from 'lucide-react';
import { getAllProfiles, updateProfileStatus, deleteProfile, saveQuestionsToDB, supabase, getAllDailyChallenges, createDailyChallenge, seedMockData, getDailyAttempts } from '../supabase';
import { generateFullJEEDailyPaper, parseDocumentToQuestions } from '../geminiService';
import { useNavigate } from 'react-router-dom';
import { NCERT_CHAPTERS } from '../constants';
import { Subject, QuestionType, Difficulty, ExamType } from '../types';
import MathText from '../components/MathText';
import { motion, AnimatePresence } from 'framer-motion';
import { PieChart, Pie, Cell, Tooltip as RechartsTooltip, ResponsiveContainer } from 'recharts';

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
    
    // Internal state to manage selections before saving
    const [localChapters, setLocalChapters] = useState<string[]>(config.chapters);
    const [localTopics, setLocalTopics] = useState<string[]>(config.topics);

    // Sync when opening
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
        
        // Remove topics if chapter deselected
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
                className="bg-white rounded-[2rem] w-full max-w-2xl max-h-[85vh] flex flex-col overflow-hidden shadow-2xl"
            >
                <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50">
                    <div>
                        <h3 className="text-xl font-black text-slate-900 flex items-center gap-2">
                           <Sliders className="w-5 h-5 text-blue-600" />
                           Configure {subject}
                        </h3>
                        <p className="text-xs font-bold text-slate-500 mt-1">Select Chapters & Topics for Generation</p>
                    </div>
                    <button onClick={onClose} className="p-2 bg-slate-200 rounded-full text-slate-500 hover:bg-slate-300"><X className="w-5 h-5" /></button>
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
                                    <span className="text-[10px] font-black uppercase text-slate-400 tracking-widest">{chap.topics.length} Topics</span>
                                </div>
                                
                                {isChapSelected && (
                                    <div className="p-4 border-t border-blue-100 bg-white rounded-b-xl">
                                        <div className="flex items-center gap-3 mb-3">
                                            <span className="text-[10px] font-black uppercase text-slate-400">Selection Mode:</span>
                                            <button onClick={() => handleSelectAllTopics(chap.topics)} className="px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-600 text-[10px] font-bold rounded">All Topics</button>
                                            <button onClick={() => handleClearTopics(chap.topics)} className="px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-600 text-[10px] font-bold rounded">Random Mix</button>
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
                    <button onClick={handleSave} className="px-8 py-3 bg-blue-600 text-white rounded-xl font-black shadow-lg hover:bg-blue-700 transition-all">Save Configuration</button>
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
  
  // Daily Paper Upload State
  const [uploadDate, setUploadDate] = useState(new Date().toISOString().split('T')[0]);
  const [qFile, setQFile] = useState<File | null>(null);
  const [sFile, setSFile] = useState<File | null>(null);
  const [isParsing, setIsParsing] = useState(false);
  const [parsedQuestions, setParsedQuestions] = useState<any[]>([]);
  const [parseError, setParseError] = useState<string | null>(null);
  const [isPublishing, setIsPublishing] = useState(false);
  const [isGeneratingAI, setIsGeneratingAI] = useState(false);
  const [genStatus, setGenStatus] = useState("");
  const [showGenConfig, setShowGenConfig] = useState(false);
  
  // Modal State
  const [modalOpen, setModalOpen] = useState(false);
  const [activeConfigSubject, setActiveConfigSubject] = useState<string | null>(null);

  const [generationConfig, setGenerationConfig] = useState<GenerationConfig>({
    physics: { mcq: 8, numerical: 2, chapters: [], topics: [] },
    chemistry: { mcq: 8, numerical: 2, chapters: [], topics: [] },
    mathematics: { mcq: 4, numerical: 1, chapters: [], topics: [] },
  });

  // Key Management State
  const [supabaseUrl, setSupabaseUrl] = useState('');
  const [supabaseKey, setSupabaseKey] = useState('');

  // Model Config State
  const [genModel, setGenModel] = useState('');
  const [analysisModel, setAnalysisModel] = useState('');
  const [visionModel, setVisionModel] = useState('');

  // Leaderboard State
  const [viewingAttemptsDate, setViewingAttemptsDate] = useState<string | null>(null);
  const [leaderboardData, setLeaderboardData] = useState<any[]>([]);
  const [loadingLeaderboard, setLoadingLeaderboard] = useState(false);
  
  // General State
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [dbError, setDbError] = useState<any>(null);
  const [userFilter, setUserFilter] = useState<UserStatus>('all');
  const [searchQuery, setSearchQuery] = useState('');

  const loggedInProfile = JSON.parse(localStorage.getItem('user_profile') || '{}');
  const isPrimaryAdmin = (email: string) => email === 'example@gmail.com' || email === 'name@example.com' || email === 'name@admin.com';

  useEffect(() => {
    if (activeTab === 'User Management') loadUsers();
    if (activeTab === 'Daily Challenges' || activeTab === 'Daily Paper Upload') loadDailyPapers();
    if (activeTab === 'System Settings') {
        const customSupabase = JSON.parse(localStorage.getItem('custom_supabase_config') || '{}');
        setSupabaseUrl(customSupabase.url || '');
        setSupabaseKey(customSupabase.key || '');
        
        const customModels = JSON.parse(localStorage.getItem('nexus_model_config') || '{}');
        setGenModel(customModels.genModel || 'gemini-3-flash-preview');
        setAnalysisModel(customModels.analysisModel || 'gemini-3-flash-preview');
        setVisionModel(customModels.visionModel || 'gemini-2.0-flash-exp');
    }
  }, [activeTab]);

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

  const loadDailyPapers = async () => {
    const papers = await getAllDailyChallenges();
    setDailyPapers(papers);
  };
  
  const handleSaveKeys = () => {
    if (confirm("Saving these settings will reload the application to apply changes. Continue?")) {
        if (supabaseUrl && supabaseKey) {
            localStorage.setItem('custom_supabase_config', JSON.stringify({ url: supabaseUrl, key: supabaseKey }));
        } else {
            localStorage.removeItem('custom_supabase_config');
        }

        localStorage.setItem('nexus_model_config', JSON.stringify({
            genModel: genModel || 'gemini-3-flash-preview',
            analysisModel: analysisModel || 'gemini-3-flash-preview',
            visionModel: visionModel || 'gemini-2.0-flash-exp'
        }));

        window.location.reload();
    }
  };

  const handleParseDocument = async () => {
    if (!qFile) {
      alert("Please upload the Question Paper PDF/Image first.");
      return;
    }
    
    setIsParsing(true);
    setParseError(null);
    setParsedQuestions([]);

    try {
      const questions = await parseDocumentToQuestions(qFile, sFile || undefined);
      if (!questions || questions.length === 0) throw new Error("No questions extracted. Check image clarity.");
      setParsedQuestions(questions);
    } catch (e: any) {
      setParseError(e.message);
    } finally {
      setIsParsing(false);
    }
  };
  
  const handleGenConfigCountsChange = (subject: keyof GenerationConfig, type: 'mcq' | 'numerical', value: string) => {
    const numValue = parseInt(value, 10);
    if (isNaN(numValue) || numValue < 0 || numValue > 50) return;

    setGenerationConfig(prev => ({
        ...prev,
        [subject]: {
            ...prev[subject],
            [type]: numValue
        }
    }));
  };
  
  const openSubjectModal = (subject: string) => {
      setActiveConfigSubject(subject);
      setModalOpen(true);
  };

  const handleSubjectConfigUpdate = (newConfig: SubjectConfig) => {
      if (!activeConfigSubject) return;
      setGenerationConfig(prev => ({
          ...prev,
          [activeConfigSubject.toLowerCase()]: newConfig
      }));
  };

  const handleAIGenerateDaily = async () => {
      const totalQuestions = (Object.values(generationConfig) as SubjectConfig[]).reduce((acc, curr) => acc + curr.mcq + curr.numerical, 0);
      if (totalQuestions === 0) {
        alert("Please configure at least one question to generate.");
        return;
      }
      
      const confirmMsg = `Generate Daily Paper for ${uploadDate}?\n` +
          `• Physics: ${generationConfig.physics.mcq + generationConfig.physics.numerical} Qs (${generationConfig.physics.chapters.length || 'All'} Chapters)\n` +
          `• Chemistry: ${generationConfig.chemistry.mcq + generationConfig.chemistry.numerical} Qs (${generationConfig.chemistry.chapters.length || 'All'} Chapters)\n` +
          `• Maths: ${generationConfig.mathematics.mcq + generationConfig.mathematics.numerical} Qs (${generationConfig.mathematics.chapters.length || 'All'} Chapters)`;
          
      if(!confirm(confirmMsg)) return;
      
      setIsGeneratingAI(true);
      setParsedQuestions([]); 
      setGenStatus("Initializing Granular Generation...");
      
      try {
          // Pass the full detailed config to the service
          const result = await generateFullJEEDailyPaper(generationConfig);
          
          const failedSubjects: string[] = [];
          if (!result.physics || result.physics.length === 0) failedSubjects.push("Physics");
          if (!result.chemistry || result.chemistry.length === 0) failedSubjects.push("Chemistry");
          if (!result.mathematics || result.mathematics.length === 0) failedSubjects.push("Mathematics");

          const combined = [
            ...(result.physics || []),
            ...(result.chemistry || []),
            ...(result.mathematics || [])
          ];

          if (combined.length === 0) {
              throw new Error("AI engine failed to produce questions. Check API Key or try again.");
          }

          const final = combined.map((q, idx) => ({
              ...q, 
              id: `daily-ai-${idx}-${Date.now()}`,
              subject: q.subject || 'General' 
          }));
          
          setParsedQuestions(final);
          
          if (failedSubjects.length > 0) {
             alert(`Generated ${final.length} questions. Warning: Failed to generate for ${failedSubjects.join(", ")}.`);
          } else {
             alert(`Success! Generated ${final.length} questions strictly following your configuration.`);
          }
      } catch (e: any) {
          console.error("Admin Generation Error:", e);
          alert("Generation Failed: " + (e.message || "Cognitive server error."));
      } finally {
          setIsGeneratingAI(false);
          setGenStatus("");
      }
  };

  const handlePublishDaily = async () => {
    if (parsedQuestions.length === 0) {
        alert("Empty paper. Generate or parse some questions first.");
        return;
    }
    if (!confirm(`Publish paper for ${uploadDate}?`)) return;
    
    setIsPublishing(true);
    try {
      const exists = dailyPapers.find(p => p.date === uploadDate);
      if (exists) {
        if(!confirm(`A paper already exists for ${uploadDate}. Replace it?`)) {
            setIsPublishing(false);
            return;
        }
      }

      await createDailyChallenge(uploadDate, parsedQuestions);
      await loadDailyPapers();
      setParsedQuestions([]);
      setQFile(null);
      setSFile(null);
      alert("Paper Published Successfully!");
      setActiveTab('Daily Challenges');
    } catch (e) {
      alert("Failed to publish paper to database.");
    } finally {
      setIsPublishing(false);
    }
  };

  const handleStatusChange = async (userId: string, status: 'approved' | 'rejected' | 'pending') => {
    setActionLoading(userId);
    const error = await updateProfileStatus(userId, status);
    if (!error) {
      setUsers(prev => prev.map(u => u.id === userId ? { ...u, status } : u));
    } else {
      alert("Status update failed: " + error);
    }
    setActionLoading(null);
  };

  const handleDeleteUser = async (userId: string) => {
    if (!confirm("Permanently remove this user?")) return;
    setActionLoading(userId);
    const error = await deleteProfile(userId);
    if (!error) setUsers(prev => prev.filter(u => u.id !== userId));
    else alert("Delete failed: " + error);
    setActionLoading(null);
  };

  const filteredUsers = users.filter(u => {
    const matchesFilter = userFilter === 'all' || u.status === userFilter;
    const matchesSearch = (u.email || '').toLowerCase().includes(searchQuery.toLowerCase()) || (u.full_name || '').toLowerCase().includes(searchQuery.toLowerCase());
    return matchesFilter && matchesSearch;
  });

  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-12 relative">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black text-slate-900 tracking-tight flex items-center gap-3">
            Control Center
            {isPrimaryAdmin(loggedInProfile.email) && <Crown className="w-8 h-8 text-yellow-500 drop-shadow-sm" />}
          </h1>
          <p className="text-slate-500 font-medium">Administrator Dashboard • Platform Oversight</p>
        </div>
      </div>

      <div className="flex border-b border-slate-200 gap-8 overflow-x-auto no-scrollbar">
        {[
          { id: 'Daily Paper Upload', icon: <FileUp className="w-4 h-4" /> },
          { id: 'Daily Challenges', icon: <CalendarClock className="w-4 h-4" /> },
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
                 <h3 className="text-xl font-black text-slate-900 flex items-center gap-2 mb-6">
                   <Key className="w-6 h-6 text-fuchsia-600" />
                   API & System Keys
                 </h3>
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
                            <label className="text-xs font-bold text-slate-600 mb-1 block">Question Generation Model</label>
                            <input type="text" value={genModel} onChange={(e) => setGenModel(e.target.value)} placeholder="gemini-3-flash-preview" className="w-full p-4 bg-slate-50 border border-slate-200 rounded-xl font-mono text-sm" />
                            <p className="text-[10px] text-slate-400 mt-1 font-medium">Used for question generation, refinement, and hints.</p>
                        </div>
                        <div>
                            <label className="text-xs font-bold text-slate-600 mb-1 block">Analysis Model</label>
                            <input type="text" value={analysisModel} onChange={(e) => setAnalysisModel(e.target.value)} placeholder="gemini-3-flash-preview" className="w-full p-4 bg-slate-50 border border-slate-200 rounded-xl font-mono text-sm" />
                             <p className="text-[10px] text-slate-400 mt-1 font-medium">Used for providing deep pedagogical feedback.</p>
                        </div>
                        <div>
                            <label className="text-xs font-bold text-slate-600 mb-1 block">Document Parsing Model (Vision)</label>
                            <input type="text" value={visionModel} onChange={(e) => setVisionModel(e.target.value)} placeholder="gemini-2.0-flash-exp" className="w-full p-4 bg-slate-50 border border-slate-200 rounded-xl font-mono text-sm" />
                             <p className="text-[10px] text-slate-400 mt-1 font-medium">Used for extracting questions from PDFs/Images. Must support vision.</p>
                        </div>
                    </div>

                    <button onClick={handleSaveKeys} className="px-8 py-3 bg-slate-900 text-white rounded-xl font-black shadow-lg hover:bg-slate-800 transition-all flex items-center gap-2">
                        <Save className="w-4 h-4" /> Save Configuration
                    </button>
                 </div>
            </div>
        </div>
      )}

      {/* Rest of the component ... (Daily Paper Upload & User Management tabs) */}
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
                      <input 
                        type="date" 
                        value={uploadDate}
                        onChange={(e) => setUploadDate(e.target.value)}
                        className="w-full p-4 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-700"
                      />
                    </div>

                    <div className="flex gap-4">
                        <button 
                             onClick={handleAIGenerateDaily}
                             disabled={isGeneratingAI || isParsing}
                             className="flex-1 py-4 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-xl font-bold shadow-lg hover:shadow-indigo-500/30 transition-all flex flex-col items-center gap-1 disabled:opacity-50 active:scale-95"
                        >
                             {isGeneratingAI ? <Loader2 className="w-5 h-5 animate-spin" /> : <Zap className="w-5 h-5 text-yellow-300" />}
                             <span className="text-xs font-black uppercase tracking-widest">{isGeneratingAI ? genStatus : "Auto-Generate (AI)"}</span>
                        </button>
                        <button
                             onClick={() => setShowGenConfig(!showGenConfig)}
                             className={`px-6 py-4 rounded-xl font-bold shadow-lg transition-all flex items-center gap-2 text-xs uppercase tracking-widest ${showGenConfig ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
                        >
                            <Sliders className="w-4 h-4" /> Customize
                        </button>
                    </div>

                    <AnimatePresence>
                      {showGenConfig && (
                        <motion.div
                          initial={{ opacity: 0, y: -10 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -10 }}
                          className="p-6 bg-slate-50 border border-slate-200 rounded-2xl space-y-4"
                        >
                          {(['physics', 'chemistry', 'mathematics'] as const).map(subject => {
                            const total = generationConfig[subject].mcq + generationConfig[subject].numerical;
                            const hasConstraints = generationConfig[subject].chapters.length > 0;
                            return (
                                <div key={subject} className="flex flex-col sm:flex-row sm:items-center gap-4 p-4 bg-white rounded-xl border border-slate-100">
                                  <div className="flex items-center gap-3 w-full sm:w-1/3">
                                    {subject === 'physics' && <Atom className="w-5 h-5 text-blue-500" />}
                                    {subject === 'chemistry' && <Beaker className="w-5 h-5 text-emerald-500" />}
                                    {subject === 'mathematics' && <FunctionSquare className="w-5 h-5 text-fuchsia-500" />}
                                    <div className="flex flex-col">
                                        <span className="font-bold text-slate-700 capitalize">{subject}</span>
                                        <button onClick={() => openSubjectModal(subject.charAt(0).toUpperCase() + subject.slice(1))} className="text-[10px] font-black text-blue-600 hover:underline text-left mt-1">
                                            {hasConstraints ? `Filtered (${generationConfig[subject].chapters.length} Ch)` : 'Full Syllabus'}
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
                          <input 
                            type="file" 
                            accept=".pdf,image/*"
                            onChange={(e) => setQFile(e.target.files?.[0] || null)}
                            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                          />
                          <div className={`p-6 border-2 border-dashed rounded-xl flex items-center justify-center gap-3 transition-all ${qFile ? 'bg-fuchsia-50 border-fuchsia-300' : 'bg-slate-50 border-slate-200 group-hover:bg-slate-100'}`}>
                             {qFile ? (
                               <span className="text-fuchsia-700 font-bold truncate">{qFile.name}</span>
                             ) : (
                               <span className="text-slate-400 font-bold flex items-center gap-2"><FileUp className="w-4 h-4" /> Upload QP</span>
                             )}
                          </div>
                       </div>
                    </div>

                    <div>
                       <label className="text-xs font-black text-slate-400 uppercase tracking-widest mb-2 block">Solution Key (Optional)</label>
                       <div className="relative group">
                          <input 
                            type="file" 
                            accept=".pdf,image/*"
                            onChange={(e) => setSFile(e.target.files?.[0] || null)}
                            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                          />
                          <div className={`p-6 border-2 border-dashed rounded-xl flex items-center justify-center gap-3 transition-all ${sFile ? 'bg-blue-50 border-blue-300' : 'bg-slate-50 border-slate-200 group-hover:bg-slate-100'}`}>
                             {sFile ? (
                               <span className="text-blue-700 font-bold truncate">{sFile.name}</span>
                             ) : (
                               <span className="text-slate-400 font-bold flex items-center gap-2"><FileText className="w-4 h-4" /> Upload Answer Key</span>
                             )}
                          </div>
                       </div>
                    </div>

                    <button 
                      onClick={handleParseDocument}
                      disabled={!qFile || isParsing || isGeneratingAI}
                      className="w-full py-4 bg-slate-900 text-white rounded-xl font-black shadow-lg hover:bg-slate-800 transition-all flex items-center justify-center gap-3 disabled:opacity-50"
                    >
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
                          {isGeneratingAI ? (
                              <Loader2 className="w-12 h-12 mb-4 animate-spin text-fuchsia-500" />
                          ) : (
                              <FileText className="w-12 h-12 mb-4 opacity-30" />
                          )}
                          <p className="font-bold">{isGeneratingAI ? "Synthesizing AI Paper..." : "No data parsed or generated"}</p>
                       </div>
                    )}
                 </div>

                 {parsedQuestions.length > 0 && (
                    <div className="mt-6 pt-6 border-t border-slate-200">
                       <button 
                         onClick={handlePublishDaily}
                         disabled={isPublishing}
                         className="w-full py-4 bg-green-600 text-white rounded-xl font-black shadow-lg hover:bg-green-700 transition-all flex items-center justify-center gap-3 disabled:opacity-50"
                       >
                         {isPublishing ? <Loader2 className="w-5 h-5 animate-spin" /> : <CheckCircle2 className="w-5 h-5" />}
                         Publish to Students
                       </button>
                    </div>
                 )}
              </div>
           </div>
        </div>
      )}

      {activeTab === 'User Management' && (
        <div className="space-y-6">
          <div className={`bg-white rounded-[2.5rem] border border-slate-200 shadow-sm overflow-hidden animate-in fade-in`}>
              <div className="p-8 border-b border-slate-100 flex flex-col lg:flex-row lg:items-center justify-between gap-6 bg-slate-50/50">
                <div className="flex items-center gap-3">
                  <div className="p-3 bg-blue-600 rounded-2xl text-white shadow-lg"><ShieldCheck className="w-6 h-6" /></div>
                  <h3 className="text-xl font-black text-slate-900 tracking-tight">User Directory</h3>
                </div>

                <div className="flex flex-col sm:flex-row items-center gap-4 flex-1 max-w-2xl">
                  <div className="flex bg-white p-1 rounded-xl border border-slate-200 shadow-sm w-full sm:w-auto">
                    {(['all', 'pending', 'approved', 'rejected'] as UserStatus[]).map((tab) => (
                      <button
                        key={tab}
                        onClick={() => setUserFilter(tab)}
                        className={`px-4 py-2 text-[10px] font-black uppercase tracking-widest rounded-lg transition-all ${
                          userFilter === tab ? 'bg-blue-600 text-white shadow-md' : 'text-slate-400 hover:text-slate-600'
                        }`}
                      >
                        {tab}
                      </button>
                    ))}
                  </div>
                  <div className="relative flex-1 w-full">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input 
                      type="text" 
                      value={searchQuery} 
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Search name, email..." 
                      className="pl-12 pr-6 py-3 bg-white border border-slate-200 rounded-2xl text-sm outline-none focus:ring-2 focus:ring-blue-500 transition-all w-full shadow-sm" 
                    />
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
                            <div className="w-10 h-10 rounded-xl bg-white border border-slate-200 flex items-center justify-center font-black text-blue-600 shadow-sm">
                              {user.full_name?.substring(0, 1) || 'U'}
                            </div>
                            <span className="font-bold text-slate-900">{user.full_name}</span>
                          </div>
                        </td>
                        <td className="px-8 py-6 text-sm text-slate-600">{user.email}</td>
                        <td className="px-8 py-6"><span className="bg-purple-50 text-purple-700 px-2 py-1 rounded-lg text-xs font-bold">{user.role}</span></td>
                        <td className="px-8 py-6"><span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase ${user.status === 'approved' ? 'bg-green-50 text-green-700' : 'bg-orange-50 text-orange-700'}`}>{user.status}</span></td>
                        <td className="px-8 py-6 text-right">
                           <div className="flex items-center justify-end gap-2">
                             {actionLoading === user.id ? (
                               <Loader2 className="w-4 h-4 animate-spin" />
                             ) : (
                               <>
                                 {user.status === 'pending' && (
                                    <>
                                        <button onClick={() => handleStatusChange(user.id, 'approved')} className="p-2 bg-green-50 text-green-600 rounded-lg hover:bg-green-100 transition-colors"><CheckCircle2 className="w-4 h-4" /></button>
                                        <button onClick={() => handleStatusChange(user.id, 'rejected')} className="p-2 bg-orange-50 text-orange-600 rounded-lg hover:bg-orange-100 transition-colors"><X className="w-4 h-4" /></button>
                                    </>
                                 )}
                                 <button onClick={() => handleDeleteUser(user.id)} className="p-2 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"><Trash2 className="w-4 h-4" /></button>
                               </>
                             )}
                           </div>
                        </td>
                      </tr>
                    )) : (
                      <tr><td colSpan={5} className="px-8 py-20 text-center text-slate-400 font-medium">No users found.</td></tr>
                    )}
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
