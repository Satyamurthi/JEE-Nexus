
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { BookOpen, Zap, Flame, Loader2, CheckCircle2, Trophy, Brain, Dices, Database, Sparkles, ChevronRight, Layers, Sliders, PlayCircle } from 'lucide-react';
import { Subject, Difficulty, ExamType, Question } from '../types';
import { NCERT_CHAPTERS } from '../constants';
import { generateJEEQuestions } from '../geminiService';
import { supabase, saveQuestionsToDB, fetchQuestionsFromDB } from '../supabase';
import { motion, AnimatePresence } from 'framer-motion';

const Practice = () => {
  const navigate = useNavigate();
  const [selectedSubject, setSelectedSubject] = useState<Subject>(Subject.Physics);
  const [selectedChapters, setSelectedChapters] = useState<string[]>([]);
  const [selectedTopics, setSelectedTopics] = useState<string[]>([]);
  const [isRandomMode, setIsRandomMode] = useState(true);
  const [selectedDifficulty, setSelectedDifficulty] = useState<Difficulty>(Difficulty.Medium);
  const [isGenerating, setIsGenerating] = useState(false);
  const [questionBankCount, setQuestionBankCount] = useState(0);
  const [isSyncing, setIsSyncing] = useState(false);

  useEffect(() => {
    updateBankCount();
    // Reset selections when subject changes
    setSelectedChapters([]);
    setSelectedTopics([]);
    setIsRandomMode(true);
  }, [selectedSubject]);

  const updateBankCount = async () => {
    setIsSyncing(true);
    const localBank = localStorage.getItem('nexus_question_bank');
    let localCount = 0;
    if (localBank) {
        try { localCount = JSON.parse(localBank).length; } catch(e) {}
    }
    setQuestionBankCount(localCount);

    if (supabase) {
      try {
        const { count, error } = await supabase.from('questions').select('*', { count: 'exact', head: true });
        if (!error && count !== null) setQuestionBankCount(Math.max(localCount, count));
      } catch (e) { console.error("Failed to fetch count", e); }
    }
    setIsSyncing(false);
  };

  const persistQuestions = async (newQuestions: Question[]) => {
    await saveQuestionsToDB(newQuestions);
    updateBankCount();
  };
  
  const handleChapterToggle = (chapterName: string) => {
    const newSelection = selectedChapters.includes(chapterName)
      ? selectedChapters.filter(c => c !== chapterName)
      : [...selectedChapters, chapterName];
      
    if (newSelection.length < selectedChapters.length) {
        const deselectedChapterTopics = NCERT_CHAPTERS[selectedSubject].find(c => c.name === chapterName)?.topics || [];
        setSelectedTopics(selectedTopics.filter(t => !deselectedChapterTopics.includes(t)));
    }
    setSelectedChapters(newSelection);
  };
  
  const handleTopicToggle = (topicName: string) => {
    setIsRandomMode(false);
    setSelectedTopics(prev => 
        prev.includes(topicName) ? prev.filter(t => t !== topicName) : [...prev, topicName]
    );
  };

  const handleRandomModeToggle = () => {
    setIsRandomMode(true);
    setSelectedTopics([]);
  };

  const handleSelectAllTopics = (chapterTopics: string[]) => {
    setIsRandomMode(false);
    setSelectedTopics(prev => Array.from(new Set([...prev, ...chapterTopics])));
  };

  const handleDeselectAllTopics = (chapterTopics: string[]) => {
    // If a user deselects all, it implies they are making a specific choice, so random mode should be off.
    setIsRandomMode(false);
    setSelectedTopics(prev => prev.filter(t => !chapterTopics.includes(t)));
  };

  const startPractice = async () => {
    setIsGenerating(true);
    try {
      // Logic: If Random Mode is active, pass empty topics.
      // If Random Mode is inactive but topics list is empty, treat as Random for the selected chapters (fallback)
      const topicsToSend = isRandomMode ? [] : selectedTopics;

      const questions = await generateJEEQuestions(
        selectedSubject, 
        10, 
        ExamType.Main, 
        selectedChapters, 
        selectedDifficulty,
        topicsToSend
      );
      await persistQuestions(questions);
      
      // Construct session title based on configuration
      let sessionType = `${selectedChapters[0]} Drill`;
      if (selectedChapters.length > 1) {
          sessionType = `Mixed Drill (${selectedChapters.length} Chapters)`;
      }
      if (topicsToSend.length > 0) {
          sessionType += ` - Focused (${topicsToSend.length} Topics)`;
      } else {
          sessionType += ` - Random Mix`;
      }
      
      const sessionData = {
        type: sessionType,
        questions: questions,
        startTime: Date.now(),
        durationMinutes: 45 
      };
      localStorage.setItem('active_session', JSON.stringify(sessionData));
      navigate('/exam-portal');
    } catch (err) {
      alert("AI Generation failed. Please check your network or API key.");
    } finally {
      setIsGenerating(false);
    }
  };

  const startRandomPractice = async () => {
    setIsSyncing(true);
    let selected: Question[] = [];
    if (supabase) {
      const dbQuestions = await fetchQuestionsFromDB(undefined, undefined, 50);
      if (dbQuestions && dbQuestions.length >= 5) {
        selected = [...dbQuestions].sort(() => 0.5 - Math.random()).slice(0, 10);
      }
    }
    if (selected.length < 5) {
      const bankRaw = localStorage.getItem('nexus_question_bank');
      if (bankRaw) {
        try {
          const bank: Question[] = JSON.parse(bankRaw);
          if (bank.length >= 5) selected = [...bank].sort(() => 0.5 - Math.random()).slice(0, 10);
        } catch(e) {}
      }
    }
    if (selected.length < 5) {
      alert("Vault is empty. Please generate some focused drills first to build the question bank!");
      setIsSyncing(false);
      return;
    }
    const sessionData = { type: "Rapid Fire Mix", questions: selected, startTime: Date.now(), durationMinutes: 30 };
    localStorage.setItem('active_session', JSON.stringify(sessionData));
    navigate('/exam-portal');
    setIsSyncing(false);
  };

  const subjectColors = {
      [Subject.Physics]: 'blue',
      [Subject.Chemistry]: 'emerald',
      [Subject.Mathematics]: 'fuchsia'
  };

  const currentColor = subjectColors[selectedSubject];

  return (
    <div className="max-w-[1400px] mx-auto space-y-8 pb-12">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-8 mb-4">
        <div>
          <h1 className="text-5xl font-black text-slate-900 tracking-tighter leading-none mb-4">
            Drill <span className={`text-${currentColor}-600`}>Station</span>
          </h1>
          <p className="text-slate-500 font-medium text-lg max-w-2xl">
            Precision training modules. Select your parameters and let the AI generate a targeted problem set.
          </p>
        </div>
        <div className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-xl flex items-center gap-6">
            <div className={`p-4 bg-${currentColor}-50 text-${currentColor}-600 rounded-2xl`}>
              <Database className={`w-6 h-6 ${isSyncing ? 'animate-pulse' : ''}`} />
            </div>
            <div>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Vault Capacity</p>
              <div className="flex items-baseline gap-2">
                  <p className="text-3xl font-black text-slate-900 tracking-tighter">{questionBankCount}</p>
                  <span className="text-xs font-bold text-slate-400">Questions</span>
              </div>
            </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 min-h-[600px]">
        <div className="lg:col-span-4 shrink-0">
            <div className="bg-white p-8 rounded-[3rem] border border-slate-100 shadow-premium h-full flex flex-col">
                <div className="flex items-center gap-3 mb-8">
                    <Sliders className="w-5 h-5 text-slate-400" />
                    <h3 className="text-lg font-black text-slate-900 uppercase tracking-widest">Config</h3>
                </div>
                <div className="space-y-8 flex-1">
                    <div>
                        <label className="text-xs font-black text-slate-400 uppercase tracking-widest mb-4 block">1. Domain</label>
                        <div className="flex flex-col gap-3">
                            {Object.keys(NCERT_CHAPTERS).map((sub) => (
                                <button key={sub} onClick={() => setSelectedSubject(sub as Subject)}
                                    className={`relative p-4 rounded-2xl text-left transition-all overflow-hidden group border-2 ${selectedSubject === sub ? `border-${subjectColors[sub as Subject]}-500 bg-${subjectColors[sub as Subject]}-50` : 'border-slate-100 bg-white hover:border-slate-200'}`}>
                                    <div className="relative z-10 flex items-center justify-between">
                                        <span className={`font-bold ${selectedSubject === sub ? `text-${subjectColors[sub as Subject]}-900` : 'text-slate-600'}`}>{sub}</span>
                                        {selectedSubject === sub && <CheckCircle2 className={`w-5 h-5 text-${subjectColors[sub as Subject]}-600`} />}
                                    </div>
                                    {selectedSubject === sub && <div className={`absolute left-0 top-0 bottom-0 w-1.5 bg-${subjectColors[sub as Subject]}-500`}></div>}
                                </button>
                            ))}
                        </div>
                    </div>
                    <div>
                        <label className="text-xs font-black text-slate-400 uppercase tracking-widest mb-4 block">2. Intensity</label>
                        <div className="grid grid-cols-3 gap-2">
                            {[Difficulty.Easy, Difficulty.Medium, Difficulty.Hard].map((diff) => (
                                <button key={diff} onClick={() => setSelectedDifficulty(diff)}
                                    className={`py-3 rounded-xl font-bold text-xs transition-all ${selectedDifficulty === diff ? 'bg-slate-900 text-white shadow-lg' : 'bg-slate-50 text-slate-500 hover:bg-slate-100'}`}>
                                    {diff}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>
                <div className="mt-8 pt-8 border-t border-slate-100">
                     <button onClick={startRandomPractice} className="w-full py-4 bg-white border-2 border-slate-100 text-slate-600 rounded-2xl font-black flex items-center justify-center gap-3 hover:border-indigo-200 hover:text-indigo-600 transition-all group">
                        <Dices className="w-5 h-5 group-hover:rotate-180 transition-transform duration-500" />
                        Surprise Me
                     </button>
                </div>
            </div>
        </div>

        <div className="lg:col-span-8 flex flex-col gap-8">
            <div className={`flex-1 bg-${currentColor}-50/50 p-10 rounded-[3rem] border border-${currentColor}-100/50 shadow-sm relative overflow-hidden flex flex-col`}>
                <div className="absolute top-0 right-0 p-10 opacity-10 pointer-events-none"><Layers className={`w-64 h-64 text-${currentColor}-900`} /></div>
                <h2 className="text-2xl font-black text-slate-900 mb-6 relative z-10">3. Select Target Chapter(s)</h2>
                <div className="flex-1 overflow-y-auto custom-scrollbar pr-4 relative z-10 space-y-3 max-h-[500px]">
                    {NCERT_CHAPTERS[selectedSubject].map((chap, idx) => {
                        const isSelected = selectedChapters.includes(chap.name);
                        return (
                            <motion.button key={chap.name} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: idx * 0.03 }}
                                onClick={() => handleChapterToggle(chap.name)}
                                className={`w-full text-left p-6 rounded-[1.5rem] transition-all flex items-center justify-between group border-2 ${isSelected ? `bg-white border-${currentColor}-500 shadow-xl shadow-${currentColor}-100` : 'bg-white/60 border-transparent hover:bg-white hover:border-slate-200 text-slate-500'}`}>
                                <div className="flex items-center gap-4">
                                    <div className={`w-6 h-6 rounded-md flex items-center justify-center border-2 transition-colors ${isSelected ? `bg-${currentColor}-500 border-${currentColor}-500` : 'border-slate-300 bg-white'}`}>
                                      {isSelected && <CheckCircle2 className="w-4 h-4 text-white" />}
                                    </div>
                                    <span className={`text-lg font-bold ${isSelected ? 'text-slate-900' : 'text-slate-600'}`}>{chap.name}</span>
                                </div>
                            </motion.button>
                        );
                    })}
                </div>
            </div>

            <AnimatePresence>
            {selectedChapters.length > 0 && (
                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 10 }}
                    className="bg-white p-10 rounded-[3rem] border border-slate-100 shadow-premium">
                    <h2 className="text-2xl font-black text-slate-900 mb-6 relative z-10">4. Select Target Topic(s)</h2>
                    <div className="space-y-6">
                        <div className="flex flex-wrap gap-3 border-b border-slate-100 pb-6">
                           <button onClick={handleRandomModeToggle}
                                className={`px-6 py-3 rounded-xl font-bold text-sm transition-all flex items-center gap-2 border-2 ${isRandomMode ? `bg-${currentColor}-600 text-white border-transparent shadow-lg` : `bg-white border-slate-100 text-slate-500 hover:border-${currentColor}-200`}`}>
                                <Dices className="w-4 h-4" /> Surprise Me (Mix)
                            </button>
                        </div>
                        <div className="space-y-6 max-h-64 overflow-y-auto custom-scrollbar pr-2">
                           {selectedChapters.map(chapterName => {
                               const chapter = NCERT_CHAPTERS[selectedSubject].find(c => c.name === chapterName);
                               if (!chapter) return null;
                               return (
                                   <div key={chapterName}>
                                       <div className="flex items-center justify-between mb-3">
                                          <p className="font-bold text-slate-700 text-sm uppercase tracking-wider">{chapterName}</p>
                                          <div className="flex items-center gap-2">
                                            <button onClick={() => handleSelectAllTopics(chapter.topics)} className="px-3 py-1 text-[10px] font-black bg-slate-50 text-slate-500 rounded-md hover:bg-slate-100 transition-colors">ALL</button>
                                            <button onClick={() => handleDeselectAllTopics(chapter.topics)} className="px-3 py-1 text-[10px] font-black bg-slate-50 text-slate-500 rounded-md hover:bg-slate-100 transition-colors">NONE</button>
                                          </div>
                                       </div>
                                       <div className="flex flex-wrap gap-3">
                                           {chapter.topics.map(topic => (
                                               <button key={topic} onClick={() => handleTopicToggle(topic)}
                                                   className={`px-5 py-2.5 rounded-xl font-bold text-xs transition-all border-2 ${selectedTopics.includes(topic) && !isRandomMode ? `bg-${currentColor}-600 text-white border-transparent shadow-md` : `bg-white border-slate-100 text-slate-500 hover:border-${currentColor}-200`}`}>
                                                   {topic}
                                               </button>
                                           ))}
                                       </div>
                                   </div>
                               );
                           })}
                        </div>
                    </div>
                </motion.div>
            )}
            </AnimatePresence>

            <motion.button whileHover={{ scale: 1.01, y: -2 }} whileTap={{ scale: 0.98 }}
                onClick={startPractice} disabled={isGenerating || selectedChapters.length === 0}
                className={`w-full py-8 rounded-[2.5rem] font-black text-2xl text-white shadow-2xl flex items-center justify-center gap-4 transition-all ${isGenerating || selectedChapters.length === 0 ? 'bg-slate-400 cursor-not-allowed' : `bg-gradient-to-r from-${currentColor}-500 to-${currentColor}-600 shadow-${currentColor}-500/30 hover:shadow-${currentColor}-500/50`}`}>
                {isGenerating ? (<><Loader2 className="w-8 h-8 animate-spin" /> Synthesizing Problem Set...</>) : (<><PlayCircle className="w-8 h-8" /> Initiate Simulation</>)}
            </motion.button>
        </div>
      </div>
    </div>
  );
};

export default Practice;
