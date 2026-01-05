
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ShieldCheck, Zap, BookOpen, Clock, AlertTriangle, CheckCircle2, Loader2, PlayCircle, Atom } from 'lucide-react';
import { ExamType, Subject } from '../types';
import { generateJEEQuestions } from '../geminiService';
import { motion } from 'framer-motion';

const ExamSetup = () => {
  const navigate = useNavigate();
  const [examType, setExamType] = useState<ExamType>(ExamType.Main);
  const [isPreparing, setIsPreparing] = useState(false);
  const [preparedQuestions, setPreparedQuestions] = useState<any[]>([]);
  const [selectedSubjects, setSelectedSubjects] = useState<Subject[]>([Subject.Physics, Subject.Chemistry, Subject.Mathematics]);
  const [progress, setProgress] = useState<Record<string, 'pending' | 'loading' | 'done' | 'error'>>({
    Physics: 'pending',
    Chemistry: 'pending',
    Mathematics: 'pending'
  });

  const preparePaper = async () => {
    setIsPreparing(true);
    setPreparedQuestions([]);
    
    // Reset progress
    const resetProgress = { ...progress };
    selectedSubjects.forEach(s => resetProgress[s] = 'pending');
    setProgress(resetProgress);
    
    try {
      const allPrepared: any[] = [];
      let failureCount = 0;
      
      for (const sub of selectedSubjects) {
        setProgress(prev => ({ ...prev, [sub]: 'loading' }));
        
        // Request 10 questions per subject (30 total) for stability
        const questions = await generateJEEQuestions(sub, 10, examType);
        
        if (questions && questions.length > 0) {
            allPrepared.push(...questions);
            setProgress(prev => ({ ...prev, [sub]: 'done' }));
        } else {
            setProgress(prev => ({ ...prev, [sub]: 'error' }));
            failureCount++;
        }
      }
      
      if (failureCount > 0 && allPrepared.length === 0) {
          alert("AI Generation failed. Please check your internet connection or API Key.");
      } else {
          setPreparedQuestions(allPrepared);
      }
    } catch (err: any) {
      console.error(err);
      alert("System Error: " + (err.message || "Unknown error occurred"));
    } finally {
      setIsPreparing(false);
    }
  };

  const launchExam = () => {
    const sessionData = {
      type: examType,
      questions: preparedQuestions,
      startTime: Date.now(),
      durationMinutes: 180
    };
    
    localStorage.setItem('active_session', JSON.stringify(sessionData));
    navigate('/exam-portal');
  };

  return (
    <div className="max-w-5xl mx-auto space-y-10 pb-12">
      <div className="text-center space-y-4">
        <h1 className="text-4xl md:text-5xl font-black text-slate-900 tracking-tight">Paper Configuration</h1>
        <p className="text-slate-500 text-lg font-medium">Customize your simulation parameters for the Gemini AI engine.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="space-y-8">
          {/* Exam Type Selection */}
          <div className={`glass-panel p-8 rounded-[2.5rem] transition-opacity ${isPreparing ? 'opacity-50 pointer-events-none' : ''}`}>
            <h2 className="text-lg font-black text-slate-900 mb-6 flex items-center gap-3">
              <div className="p-2 bg-blue-100 text-blue-600 rounded-lg"><Zap className="w-5 h-5" /></div>
              Target Exam
            </h2>
            <div className="grid grid-cols-2 gap-4">
              {[ExamType.Main, ExamType.Advanced].map((type) => (
                <motion.button
                  key={type}
                  whileHover={{ scale: 1.02, y: -2 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => setExamType(type)}
                  className={`p-6 rounded-3xl border-2 transition-all text-center relative overflow-hidden ${
                    examType === type 
                    ? 'border-blue-500 bg-blue-600 text-white shadow-xl shadow-blue-500/30' 
                    : 'border-slate-100 bg-white hover:border-blue-200 text-slate-600'
                  }`}
                >
                  <span className="block font-black text-lg relative z-10">{type}</span>
                  <span className={`text-xs font-bold uppercase tracking-widest relative z-10 ${examType === type ? 'text-blue-200' : 'text-slate-400'}`}>Official Pattern</span>
                  {examType === type && <div className="absolute top-0 right-0 w-20 h-20 bg-white opacity-10 blur-2xl rounded-full -mr-10 -mt-10"></div>}
                </motion.button>
              ))}
            </div>
          </div>

          {/* Subject Selection */}
          <div className={`glass-panel p-8 rounded-[2.5rem] transition-opacity ${isPreparing ? 'opacity-50 pointer-events-none' : ''}`}>
            <h2 className="text-lg font-black text-slate-900 mb-6 flex items-center gap-3">
              <div className="p-2 bg-purple-100 text-purple-600 rounded-lg"><BookOpen className="w-5 h-5" /></div>
              Subjects
            </h2>
            <div className="space-y-3">
              {[Subject.Physics, Subject.Chemistry, Subject.Mathematics].map((sub) => {
                const isSelected = selectedSubjects.includes(sub);
                return (
                    <motion.div
                        key={sub}
                        whileTap={{ scale: 0.98 }}
                        onClick={() => {
                            if (isSelected) setSelectedSubjects(selectedSubjects.filter(s => s !== sub));
                            else setSelectedSubjects([...selectedSubjects, sub]);
                        }}
                        className={`p-4 rounded-2xl border-2 cursor-pointer transition-all flex items-center gap-4 ${
                            isSelected 
                            ? 'bg-purple-50 border-purple-500 shadow-md' 
                            : 'bg-white border-slate-100 hover:bg-slate-50'
                        }`}
                    >
                        <div className={`w-6 h-6 rounded-md flex items-center justify-center border-2 transition-colors ${isSelected ? 'bg-purple-500 border-purple-500' : 'border-slate-300 bg-white'}`}>
                            {isSelected && <CheckCircle2 className="w-4 h-4 text-white" />}
                        </div>
                        <span className={`font-bold ${isSelected ? 'text-purple-900' : 'text-slate-600'}`}>{sub}</span>
                    </motion.div>
                );
              })}
            </div>
          </div>
        </div>

        <div className="space-y-8">
            {/* Status Panel */}
          <div className="glass-panel p-8 rounded-[2.5rem]">
            <h2 className="text-lg font-black text-slate-900 mb-6 flex items-center gap-3">
              <div className="p-2 bg-emerald-100 text-emerald-600 rounded-lg"><ShieldCheck className="w-5 h-5" /></div>
              Generation Protocol
            </h2>
            
            <div className="space-y-4">
              {selectedSubjects.map(sub => (
                <div key={sub} className="flex items-center justify-between p-4 bg-white/60 rounded-2xl border border-white/40">
                  <span className="text-sm font-bold text-slate-700">{sub}</span>
                  <div className="flex items-center gap-3">
                    <span className="text-[10px] font-black bg-slate-100 px-2 py-1 rounded text-slate-500">10 Qs</span>
                    {progress[sub] === 'loading' ? (
                      <Loader2 className="w-5 h-5 text-blue-500 animate-spin" />
                    ) : progress[sub] === 'done' ? (
                      <div className="w-5 h-5 bg-emerald-500 rounded-full flex items-center justify-center">
                          <CheckCircle2 className="w-3 h-3 text-white" />
                      </div>
                    ) : progress[sub] === 'error' ? (
                      <div className="w-5 h-5 bg-red-500 rounded-full flex items-center justify-center">
                          <AlertTriangle className="w-3 h-3 text-white" />
                      </div>
                    ) : (
                      <div className="w-5 h-5 border-2 border-slate-200 rounded-full" />
                    )}
                  </div>
                </div>
              ))}
            </div>

            {preparedQuestions.length > 0 ? (
              <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="mt-6 p-5 bg-emerald-500 text-white rounded-3xl shadow-lg shadow-emerald-500/30">
                <p className="text-xs font-black uppercase tracking-widest mb-1 opacity-80">System Ready</p>
                <p className="text-lg font-bold">{preparedQuestions.length} Questions Synthesized.</p>
              </motion.div>
            ) : (
              <div className="mt-6 p-5 bg-slate-100 text-slate-500 rounded-3xl border border-slate-200">
                <p className="text-sm font-medium">Waiting for initiation command...</p>
              </div>
            )}
          </div>

          {!preparedQuestions.length ? (
            <motion.button
              whileHover={{ scale: 1.02, y: -2 }}
              whileTap={{ scale: 0.95 }}
              onClick={preparePaper}
              disabled={isPreparing || selectedSubjects.length === 0}
              className="w-full py-6 bg-slate-900 text-white rounded-[2rem] font-black text-xl shadow-2xl hover:shadow-slate-900/40 transition-all flex items-center justify-center gap-4 disabled:opacity-50 disabled:shadow-none"
            >
              {isPreparing ? <Loader2 className="w-6 h-6 animate-spin" /> : <Atom className="w-6 h-6 text-fuchsia-400" />}
              {isPreparing ? "AI Synthesizing..." : "Generate Paper"}
            </motion.button>
          ) : (
            <motion.button
              whileHover={{ scale: 1.02, y: -2 }}
              whileTap={{ scale: 0.95 }}
              onClick={launchExam}
              className="w-full py-6 bg-gradient-to-r from-emerald-500 to-teal-500 text-white rounded-[2rem] font-black text-xl shadow-2xl shadow-emerald-500/40 transition-all flex items-center justify-center gap-4"
            >
              <PlayCircle className="w-7 h-7" />
              Begin Examination
            </motion.button>
          )}

          <div className="flex justify-center gap-2 text-slate-400 text-xs font-bold">
            <AlertTriangle className="w-4 h-4" />
            <span>AI Model: Gemini 3.0 Flash • Latency: ~1.8s</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ExamSetup;
