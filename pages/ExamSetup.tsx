
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ShieldCheck, Zap, BookOpen, Clock, AlertTriangle, CheckCircle2, Loader2, PlayCircle, Atom, Sliders, Hash, RotateCcw } from 'lucide-react';
import { ExamType, Subject } from '../types';
import { generateJEEQuestions } from '../geminiService';
import { motion } from 'framer-motion';

const ExamSetup = () => {
  const navigate = useNavigate();
  const [examType, setExamType] = useState<ExamType>(ExamType.Main);
  const [isPreparing, setIsPreparing] = useState(false);
  const [preparedQuestions, setPreparedQuestions] = useState<any[]>([]);
  const [selectedSubjects, setSelectedSubjects] = useState<Subject[]>([Subject.Physics, Subject.Chemistry, Subject.Mathematics]);
  
  // Customizable Pattern Configuration (Default: JEE Standard 25+5)
  const [questionCounts, setQuestionCounts] = useState({ mcq: 25, numerical: 5 });
  
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
      
      const totalPerSubject = questionCounts.mcq + questionCounts.numerical;

      for (const sub of selectedSubjects) {
        setProgress(prev => ({ ...prev, [sub]: 'loading' }));
        
        // Pass specific distribution to the generator
        const questions = await generateJEEQuestions(
            sub, 
            totalPerSubject, 
            examType,
            undefined, // chapters (full syllabus)
            undefined, // difficulty (default)
            undefined, // topics
            { mcq: questionCounts.mcq, numerical: questionCounts.numerical } // Explicit Distribution
        );
        
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
    // Calculate duration based on standard JEE timing (approx 2.4 mins per question)
    const qCount = preparedQuestions.length;
    // Standard JEE is 180 mins for 75 questions. 180/75 = 2.4
    const duration = Math.ceil(qCount * 2.4);

    const sessionData = {
      type: examType,
      questions: preparedQuestions,
      startTime: Date.now(), // Anchors the exam start time for resume functionality
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
        <p className="text-slate-500 text-lg font-medium">Customize your simulation parameters for the Gemini AI engine.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left Column: Configuration */}
        <div className="lg:col-span-7 space-y-8">
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
                            if (isSelected && selectedSubjects.length > 1) setSelectedSubjects(selectedSubjects.filter(s => s !== sub));
                            else if (!isSelected) setSelectedSubjects([...selectedSubjects, sub]);
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

           {/* Question Pattern Config */}
           <div className={`glass-panel p-8 rounded-[2.5rem] transition-opacity ${isPreparing ? 'opacity-50 pointer-events-none' : ''}`}>
            <div className="flex items-center justify-between mb-6">
                <h2 className="text-lg font-black text-slate-900 flex items-center gap-3">
                    <div className="p-2 bg-orange-100 text-orange-600 rounded-lg"><Sliders className="w-5 h-5" /></div>
                    Pattern (Per Subject)
                </h2>
                <div className="flex gap-2">
                    <button onClick={() => applyPreset(10, 2)} className="px-3 py-1 bg-slate-100 hover:bg-slate-200 text-slate-600 text-[10px] font-black uppercase rounded-lg">Mini</button>
                    <button onClick={() => applyPreset(25, 5)} className="px-3 py-1 bg-slate-900 text-white text-[10px] font-black uppercase rounded-lg">Standard</button>
                    <button onClick={() => applyPreset(30, 10)} className="px-3 py-1 bg-slate-100 hover:bg-slate-200 text-slate-600 text-[10px] font-black uppercase rounded-lg">Max</button>
                </div>
            </div>
            
            <div className="flex gap-6">
                <div className="flex-1">
                    <label className="text-xs font-black text-slate-400 uppercase tracking-widest mb-2 block">MCQs</label>
                    <div className="relative">
                        <input 
                            type="number" 
                            min="5" 
                            max="30" 
                            value={questionCounts.mcq}
                            onChange={(e) => setQuestionCounts({...questionCounts, mcq: parseInt(e.target.value) || 0})}
                            className="w-full p-4 bg-slate-50 border border-slate-200 rounded-xl font-black text-xl text-slate-800 text-center focus:border-blue-500 outline-none"
                        />
                        <div className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-300 pointer-events-none font-bold">Q</div>
                    </div>
                </div>
                <div className="flex-1">
                    <label className="text-xs font-black text-slate-400 uppercase tracking-widest mb-2 block">Numericals</label>
                    <div className="relative">
                        <input 
                            type="number" 
                            min="0" 
                            max="10" 
                            value={questionCounts.numerical}
                            onChange={(e) => setQuestionCounts({...questionCounts, numerical: parseInt(e.target.value) || 0})}
                            className="w-full p-4 bg-slate-50 border border-slate-200 rounded-xl font-black text-xl text-slate-800 text-center focus:border-blue-500 outline-none"
                        />
                        <div className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-300 pointer-events-none font-bold">Q</div>
                    </div>
                </div>
            </div>
            <p className="mt-4 text-center text-xs font-bold text-slate-400">
                Total: <span className="text-slate-900">{questionCounts.mcq + questionCounts.numerical}</span> questions per subject
            </p>
          </div>
        </div>

        {/* Right Column: Status & Action */}
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
                    <span className="text-[10px] font-black bg-slate-100 px-2 py-1 rounded text-slate-500">
                         {questionCounts.mcq + questionCounts.numerical} Qs
                    </span>
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

            <div className="mt-8 pt-8 border-t border-slate-100">
                <div className="flex justify-between items-center mb-6">
                    <div>
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Total Load</p>
                        <p className="text-2xl font-black text-slate-900">{totalQuestions} Questions</p>
                    </div>
                    <div className="text-right">
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Est. Duration</p>
                        <p className="text-2xl font-black text-slate-900">~{estimatedTime} Mins</p>
                    </div>
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
                
                <div className="flex justify-center gap-2 text-slate-400 text-xs font-bold mt-4">
                    <AlertTriangle className="w-4 h-4" />
                    <span>AI Model: Gemini 3.0 Flash • Latency: ~1.8s/Subject</span>
                </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ExamSetup;
