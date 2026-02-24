
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ShieldCheck, Zap, BookOpen, Clock, AlertTriangle, CheckCircle2, Loader2, PlayCircle, Atom, Sliders, Hash, RotateCcw, Database } from 'lucide-react';
import { ExamType, Subject } from '../types';
import { generateJEEQuestions } from '../geminiService';
import { motion } from 'framer-motion';

const ExamSetup = () => {
  const navigate = useNavigate();
  const [examType, setExamType] = useState<ExamType>(ExamType.Main);
  const [isPreparing, setIsPreparing] = useState(false);
  const [preparedQuestions, setPreparedQuestions] = useState<any[]>([]);
  const [selectedSubjects, setSelectedSubjects] = useState<Subject[]>([Subject.Physics, Subject.Chemistry, Subject.Mathematics]);
  const [questionCounts, setQuestionCounts] = useState({ mcq: 25, numerical: 5 });
  const [preparationLogs, setPreparationLogs] = useState<string[]>([]);
  
  const [progress, setProgress] = useState<Record<string, 'pending' | 'loading' | 'done' | 'error'>>({
    Physics: 'pending',
    Chemistry: 'pending',
    Mathematics: 'pending'
  });

  const preparePaper = async () => {
    setIsPreparing(true);
    setPreparedQuestions([]);
    setPreparationLogs(["Initializing AI Engine..."]);
    
    const resetProgress = { ...progress };
    selectedSubjects.forEach(s => resetProgress[s] = 'pending');
    setProgress(resetProgress);
    
    try {
      const allPrepared: any[] = [];
      const totalPerSubject = questionCounts.mcq + questionCounts.numerical;

      for (const sub of selectedSubjects) {
        setProgress(prev => ({ ...prev, [sub]: 'loading' }));
        setPreparationLogs(prev => [...prev, `Requesting ${sub} questions...`]);
        
        const questions = await generateJEEQuestions(
            sub, 
            totalPerSubject, 
            examType,
            undefined,
            undefined,
            undefined,
            { mcq: questionCounts.mcq, numerical: questionCounts.numerical }
        );
        
        if (questions && questions.length > 0) {
            allPrepared.push(...questions);
            const source = questions[0].id.startsWith('ai') ? 'AI engine' : questions[0].id.startsWith('hf') ? 'Hugging Face Dataset' : 'Local Archive';
            setPreparationLogs(prev => [...prev, `✅ ${sub} prepared via ${source}`]);
            setProgress(prev => ({ ...prev, [sub]: 'done' }));
        } else {
            setPreparationLogs(prev => [...prev, `❌ ${sub} failed completely.`]);
            setProgress(prev => ({ ...prev, [sub]: 'error' }));
        }
      }
      
      setPreparedQuestions(allPrepared);
      setPreparationLogs(prev => [...prev, "Paper Synthesis Complete."]);
    } catch (err: any) {
      console.error(err);
      setPreparationLogs(prev => [...prev, `Critical Error: ${err.message}`]);
    } finally {
      setIsPreparing(false);
    }
  };

  const launchExam = () => {
    const qCount = preparedQuestions.length;
    const duration = Math.ceil(qCount * 2.4);
    const sessionData = {
      type: examType,
      questions: preparedQuestions,
      startTime: Date.now(),
      durationMinutes: duration
    };
    localStorage.setItem('active_session', JSON.stringify(sessionData));
    navigate('/exam-portal');
  };

  const applyPreset = (mcq: number, num: number) => {
      setQuestionCounts({ mcq, numerical: num });
  };

  const totalQuestions = selectedSubjects.length * (questionCounts.mcq + questionCounts.numerical);
  const estimatedTime = Math.ceil(totalQuestions * 2.4);

  return (
    <div className="max-w-6xl mx-auto space-y-10 pb-12">
      <div className="text-center space-y-4">
        <h1 className="text-4xl md:text-5xl font-black text-slate-900 tracking-tight">Paper Configuration</h1>
        <p className="text-slate-500 text-lg font-medium">Powered by Gemini AI.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        <div className="lg:col-span-7 space-y-8">
          <div className={`glass-panel p-8 rounded-[2.5rem] transition-opacity ${isPreparing ? 'opacity-50 pointer-events-none' : ''}`}>
            <h2 className="text-lg font-black text-slate-900 mb-6 flex items-center gap-3">
              <div className="p-2 bg-blue-100 text-blue-600 rounded-lg"><Zap className="w-5 h-5" /></div>
              Target Exam
            </h2>
            <div className="grid grid-cols-2 gap-4">
              {[ExamType.Main, ExamType.Advanced].map((type) => (
                <motion.button
                  key={type}
                  whileHover={{ scale: 1.02 }}
                  onClick={() => setExamType(type)}
                  className={`p-6 rounded-3xl border-2 transition-all text-center ${examType === type ? 'border-blue-500 bg-blue-600 text-white shadow-xl shadow-blue-500/30' : 'border-slate-100 bg-white hover:border-blue-200 text-slate-600'}`}
                >
                  <span className="block font-black text-lg">{type}</span>
                  <span className={`text-xs font-bold uppercase tracking-widest ${examType === type ? 'text-blue-200' : 'text-slate-400'}`}>Official Pattern</span>
                </motion.button>
              ))}
            </div>
          </div>

          <div className={`glass-panel p-8 rounded-[2.5rem] transition-opacity ${isPreparing ? 'opacity-50 pointer-events-none' : ''}`}>
            <h2 className="text-lg font-black text-slate-900 mb-6 flex items-center gap-3">
              <div className="p-2 bg-purple-100 text-purple-600 rounded-lg"><BookOpen className="w-5 h-5" /></div>
              Subjects
            </h2>
            <div className="space-y-3">
              {[Subject.Physics, Subject.Chemistry, Subject.Mathematics].map((sub) => {
                const isSelected = selectedSubjects.includes(sub);
                return (
                    <motion.div key={sub} onClick={() => { if (isSelected && selectedSubjects.length > 1) setSelectedSubjects(selectedSubjects.filter(s => s !== sub)); else if (!isSelected) setSelectedSubjects([...selectedSubjects, sub]); }}
                        className={`p-4 rounded-2xl border-2 cursor-pointer transition-all flex items-center gap-4 ${isSelected ? 'bg-purple-50 border-purple-500 shadow-md' : 'bg-white border-slate-100 hover:bg-slate-50'}`}>
                        <div className={`w-6 h-6 rounded-md flex items-center justify-center border-2 transition-colors ${isSelected ? 'bg-purple-500 border-purple-500' : 'border-slate-300 bg-white'}`}>
                            {isSelected && <CheckCircle2 className="w-4 h-4 text-white" />}
                        </div>
                        <span className={`font-bold ${isSelected ? 'text-purple-900' : 'text-slate-600'}`}>{sub}</span>
                    </motion.div>
                );
              })}
            </div>
          </div>

           <div className={`glass-panel p-8 rounded-[2.5rem] transition-opacity ${isPreparing ? 'opacity-50 pointer-events-none' : ''}`}>
            <div className="flex items-center justify-between mb-6">
                <h2 className="text-lg font-black text-slate-900 flex items-center gap-3">
                    <div className="p-2 bg-orange-100 text-orange-600 rounded-lg"><Sliders className="w-5 h-5" /></div>
                    Pattern (Per Subject)
                </h2>
                <div className="flex gap-2">
                    <button onClick={() => applyPreset(10, 2)} className="px-3 py-1 bg-slate-100 hover:bg-slate-200 text-slate-600 text-[10px] font-black uppercase rounded-lg">Mini</button>
                    <button onClick={() => applyPreset(25, 5)} className="px-3 py-1 bg-slate-900 text-white text-[10px] font-black uppercase rounded-lg">Standard</button>
                </div>
            </div>
            <div className="flex gap-6">
                <div className="flex-1">
                    <label className="text-xs font-black text-slate-400 uppercase tracking-widest mb-2 block">MCQs</label>
                    <input type="number" min="5" max="30" value={questionCounts.mcq} onChange={(e) => setQuestionCounts({...questionCounts, mcq: parseInt(e.target.value) || 0})} className="w-full p-4 bg-slate-50 border border-slate-200 rounded-xl font-black text-xl text-slate-800 text-center focus:border-blue-500 outline-none" />
                </div>
                <div className="flex-1">
                    <label className="text-xs font-black text-slate-400 uppercase tracking-widest mb-2 block">Numericals</label>
                    <input type="number" min="0" max="10" value={questionCounts.numerical} onChange={(e) => setQuestionCounts({...questionCounts, numerical: parseInt(e.target.value) || 0})} className="w-full p-4 bg-slate-50 border border-slate-200 rounded-xl font-black text-xl text-slate-800 text-center focus:border-blue-500 outline-none" />
                </div>
            </div>
          </div>
        </div>

        <div className="lg:col-span-5 space-y-8">
          <div className="glass-panel p-8 rounded-[2.5rem] h-full flex flex-col">
            <h2 className="text-lg font-black text-slate-900 mb-6 flex items-center gap-3">
              <div className="p-2 bg-emerald-100 text-emerald-600 rounded-lg"><ShieldCheck className="w-5 h-5" /></div>
              Generation Protocol
            </h2>
            
            <div className="space-y-4 flex-1">
              {selectedSubjects.map(sub => (
                <div key={sub} className="flex items-center justify-between p-4 bg-white/60 rounded-2xl border border-white/40">
                  <span className="text-sm font-bold text-slate-700">{sub}</span>
                  <div className="flex items-center gap-3">
                    {progress[sub] === 'loading' ? <Loader2 className="w-5 h-5 text-blue-500 animate-spin" /> : progress[sub] === 'done' ? <div className="w-5 h-5 bg-emerald-500 rounded-full flex items-center justify-center"><CheckCircle2 className="w-3 h-3 text-white" /></div> : progress[sub] === 'error' ? <div className="w-5 h-5 bg-red-500 rounded-full flex items-center justify-center"><AlertTriangle className="w-3 h-3 text-white" /></div> : <div className="w-5 h-5 border-2 border-slate-200 rounded-full" />}
                  </div>
                </div>
              ))}
              
              <div className="mt-4 p-4 bg-slate-900 rounded-2xl border border-slate-800 font-mono text-[10px] text-emerald-400 space-y-1 overflow-y-auto max-h-32 custom-scrollbar">
                {preparationLogs.map((log, i) => (
                    <div key={i} className="flex gap-2">
                        <span className="opacity-30">[{new Date().toLocaleTimeString([], {hour12:false, hour:'2-digit', minute:'2-digit'})}]</span>
                        <span>{log}</span>
                    </div>
                ))}
              </div>
            </div>

            <div className="mt-8 pt-8 border-t border-slate-100">
                <div className="flex justify-between items-center mb-6">
                    <div>
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Total Load</p>
                        <p className="text-2xl font-black text-slate-900">{totalQuestions} Questions</p>
                    </div>
                    <div className="text-right">
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Exam Duration</p>
                        <p className="text-2xl font-black text-slate-900">~{estimatedTime} Mins</p>
                    </div>
                </div>

                {!preparedQuestions.length ? (
                    <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.95 }} onClick={preparePaper} disabled={isPreparing || selectedSubjects.length === 0}
                    className="w-full py-6 bg-slate-900 text-white rounded-[2rem] font-black text-xl shadow-2xl flex items-center justify-center gap-4 disabled:opacity-50">
                    {isPreparing ? <Loader2 className="w-6 h-6 animate-spin" /> : <Atom className="w-6 h-6 text-fuchsia-400" />}
                    {isPreparing ? "Initializing..." : "Generate Paper"}
                    </motion.button>
                ) : (
                    <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.95 }} onClick={launchExam}
                    className="w-full py-6 bg-gradient-to-r from-emerald-500 to-teal-500 text-white rounded-[2rem] font-black text-xl shadow-2xl items-center justify-center gap-4 flex">
                    <PlayCircle className="w-7 h-7" />
                    Begin Examination
                    </motion.button>
                )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ExamSetup;
