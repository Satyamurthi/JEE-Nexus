
import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, ChevronRight, Clock, HelpCircle, RotateCcw, Monitor, Send, CheckCircle2, Menu, X, LayoutGrid, AlertCircle, Brain } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Question } from '../types';
import MathText from '../components/MathText';
import { submitDailyAttempt } from '../supabase';

const AnimatedTimer = ({ timeLeft, durationMinutes }: { timeLeft: number, durationMinutes: number }) => {
  const formatTime = (s: number) => {
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = s % 60;
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}`;
  };

  const RADIUS = 36;
  const CIRCUMFERENCE = 2 * Math.PI * RADIUS;
  const totalDuration = durationMinutes * 60;
  const progress = Math.max(0, (timeLeft / totalDuration));
  const strokeDashoffset = CIRCUMFERENCE * (1 - progress);
  const isCritical = timeLeft < 300; 

  return (
    <div className="relative w-24 h-24 flex items-center justify-center">
      <svg className="absolute w-full h-full transform -rotate-90" viewBox="0 0 80 80">
        <circle className="text-slate-100" stroke="currentColor" strokeWidth="6" fill="transparent" r={RADIUS} cx="40" cy="40" />
        <motion.circle
          className={isCritical ? "text-red-500" : "text-blue-600"}
          stroke="currentColor" strokeWidth="6" strokeLinecap="round" fill="transparent" r={RADIUS} cx="40" cy="40"
          style={{ strokeDasharray: CIRCUMFERENCE }}
          animate={{ strokeDashoffset, opacity: isCritical ? [1, 0.6, 1] : 1 }}
          transition={{ strokeDashoffset: { duration: 1, ease: "linear" }, opacity: isCritical ? { duration: 1.5, repeat: Infinity } : { duration: 0.3 } }}
        />
      </svg>
      <div className="relative flex flex-col items-center">
        <span className={`font-mono text-xl font-black tracking-tight ${isCritical ? 'text-red-600' : 'text-slate-900'}`}>{formatTime(timeLeft)}</span>
        <span className={`text-[8px] font-black uppercase tracking-widest ${isCritical ? 'text-red-400' : 'text-slate-400'}`}>Remaining</span>
      </div>
    </div>
  );
};

// Helper for fuzzy comparison of answers (handles "0,1" vs "1,0" vs "0, 1")
const normalizeAnswer = (val: string | number | undefined) => {
    if (val === undefined || val === null || val === '') return '';
    const s = val.toString();
    // If numerical (no commas), return trimmed
    if (!s.includes(',')) return s.trim();
    // If list, sort and join
    return s.split(',').map(p => p.trim()).sort().join(',');
};

const ExamPortal = () => {
  const navigate = useNavigate();
  const [session, setSession] = useState<any>(null);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [responses, setResponses] = useState<Record<string, string | number>>({});
  const [markedForReview, setMarkedForReview] = useState<Set<string>>(new Set());
  const [visited, setVisited] = useState<Set<string>>(new Set(['0']));
  const [timeLeft, setTimeLeft] = useState(0);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Refs to track latest state for the timer interval
  const responsesRef = useRef(responses);
  const sessionRef = useRef(session);
  const isSubmittingRef = useRef(isSubmitting);

  // Sync refs with state
  useEffect(() => { responsesRef.current = responses; }, [responses]);
  useEffect(() => { sessionRef.current = session; }, [session]);
  useEffect(() => { isSubmittingRef.current = isSubmitting; }, [isSubmitting]);
  
  const SESSION_KEY = 'active_session';
  const userProfile = JSON.parse(localStorage.getItem('user_profile') || '{}');

  const performSubmission = async () => {
    if (isSubmittingRef.current) return;
    setIsSubmitting(true);
    
    const currentSession = sessionRef.current;
    const currentResponses = responsesRef.current;

    let score = 0;
    const questionResults = currentSession.questions.map((q: Question, idx: number) => {
      const resp = currentResponses[idx];
      const normResp = normalizeAnswer(resp);
      const normCorrect = normalizeAnswer(q.correctAnswer);
      
      const isCorrect = normResp !== '' && normResp === normCorrect;
      
      if (normResp !== '') {
        if (isCorrect) score += q.markingScheme.positive;
        else score -= q.markingScheme.negative;
      }
      return { ...q, userAnswer: resp, isCorrect };
    });
    
    const totalPossible = currentSession.questions.length * 4;
    const accuracy = Math.round((score / Math.max(1, totalPossible)) * 100);
    const results = {
      id: Date.now().toString(36),
      score, totalPossible, accuracy,
      completedAt: Date.now(),
      questions: questionResults,
      type: currentSession.type
    };
    
    try {
        const historyRaw = localStorage.getItem('exam_history');
        const history = historyRaw ? JSON.parse(historyRaw) : [];
        localStorage.setItem('exam_history', JSON.stringify([results, ...history].slice(0, 50)));
    } catch (e) {}

    if (currentSession.isDaily && currentSession.dailyDate && userProfile.id) {
        try { 
          await submitDailyAttempt(userProfile.id, currentSession.dailyDate, score, totalPossible, { accuracy, completedAt: results.completedAt }, questionResults); 
        } catch(e) {
          console.error("Failed to submit daily", e);
        }
    }
    localStorage.setItem('last_result', JSON.stringify(results));
    localStorage.removeItem(SESSION_KEY);
    navigate('/analytics');
  };

  useEffect(() => {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) {
      navigate('/exam-setup');
      return;
    }
    const data = JSON.parse(raw);
    setSession(data);
    sessionRef.current = data; // Immediate ref update

    if (data.responses) {
        setResponses(data.responses);
        responsesRef.current = data.responses;
    }
    if (data.currentQuestionIndex) setCurrentIdx(data.currentQuestionIndex);
    if (data.markedForReview) setMarkedForReview(new Set(data.markedForReview));
    if (data.visited) setVisited(new Set(data.visited));
    
    // Resume Timer Logic
    const now = Date.now();
    const elapsedSeconds = Math.floor((now - data.startTime) / 1000);
    const totalSeconds = data.durationMinutes * 60;
    const remaining = Math.max(0, totalSeconds - elapsedSeconds);
    setTimeLeft(remaining);

    // If time has already expired while the user was away/closed tab
    if (remaining <= 0) {
        // We use setTimeout to ensure state is fully hydrated before submitting
        setTimeout(() => performSubmission(), 500);
        return;
    }

    const timer = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          clearInterval(timer);
          performSubmission(); // Uses refs to get latest state
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, []); // Run once on mount

  // Sync state to local storage for persistence
  useEffect(() => {
    if (!session) return;
    const updatedSession = { ...session, responses, currentQuestionIndex: currentIdx, markedForReview: Array.from(markedForReview), visited: Array.from(visited) };
    localStorage.setItem(SESSION_KEY, JSON.stringify(updatedSession));
  }, [responses, currentIdx, markedForReview, visited, session]);
  
  const handleSubmitButton = () => {
      performSubmission();
  };

  const handleOptionClick = (optionIdx: number) => {
      const current = responses[currentIdx];
      let selected: string[] = [];
      
      if (current !== undefined && current !== '') {
          selected = current.toString().split(',').map(s => s.trim());
      }
      
      const optStr = optionIdx.toString();
      if (selected.includes(optStr)) {
          selected = selected.filter(s => s !== optStr);
      } else {
          selected.push(optStr);
      }
      
      // Sort to ensure consistency (0, 1 instead of 1, 0)
      selected.sort((a,b) => parseInt(a) - parseInt(b));
      
      if (selected.length === 0) {
          const newR = {...responses};
          delete newR[currentIdx];
          setResponses(newR);
      } else {
          setResponses({ ...responses, [currentIdx]: selected.join(', ') });
      }
  };

  const isOptionSelected = (optionIdx: number) => {
      const current = responses[currentIdx];
      if (current === undefined || current === '') return false;
      const selected = current.toString().split(',').map(s => s.trim());
      return selected.includes(optionIdx.toString());
  };

  if (!session) return null;
  const currentQuestion: Question = session.questions[currentIdx];
  const isOptionsQuestion = currentQuestion.type === 'MCQ' || (currentQuestion.options && currentQuestion.options.length > 0);
  
  const getPaletteStatus = (idx: number) => {
    const id = idx.toString();
    const isAnswered = responses[idx] !== undefined && responses[idx] !== '';
    if (markedForReview.has(id)) return isAnswered ? 'bg-purple-600 text-white' : 'bg-purple-100 text-purple-700';
    if (isAnswered) return 'bg-green-600 text-white';
    if (visited.has(id)) return 'bg-red-500 text-white';
    return 'bg-white text-slate-400 border-slate-200';
  };

  return (
    <div className="fixed inset-0 bg-[#f8fafc] flex flex-col font-sans overflow-hidden">
      <header className="h-20 bg-white border-b border-slate-100 flex items-center justify-between px-8 shrink-0 z-50 shadow-sm">
        <div className="flex items-center gap-6">
          <div className="bg-slate-900 p-2.5 rounded-2xl text-white shadow-xl"><Monitor className="w-6 h-6" /></div>
          <div>
            <h1 className="text-xl font-black text-slate-900 uppercase">JEE Simulator</h1>
            <p className="text-[10px] font-black text-blue-600 uppercase tracking-[0.2em] mt-1.5 flex items-center gap-2">
              <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" /> Intelligence Layer v4
            </p>
          </div>
        </div>
        <div className="flex items-center gap-8">
          <AnimatedTimer timeLeft={timeLeft} durationMinutes={session.durationMinutes} />
          <button onClick={() => setPaletteOpen(!paletteOpen)} className="lg:hidden p-3 bg-slate-50 border border-slate-100 rounded-2xl"><LayoutGrid className="w-6 h-6" /></button>
          <motion.button whileTap={{ scale: 0.95 }} onClick={() => { if(confirm("Finish exam?")) handleSubmitButton() }} disabled={isSubmitting} className="hidden sm:flex px-8 py-3.5 bg-red-600 text-white rounded-2xl font-black text-sm hover:bg-red-700 transition-all shadow-xl items-center gap-2 disabled:opacity-50">
            {isSubmitting ? "Submitting..." : "Submit Exam"}
          </motion.button>
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden relative">
        <div className="flex-1 flex flex-col bg-white overflow-hidden w-full relative">
          <div className="px-10 py-5 bg-slate-50 border-b border-slate-100 flex justify-between items-center shrink-0">
             <div className="flex items-center gap-5">
                <span className="bg-slate-900 text-white px-5 py-2 rounded-xl text-sm font-black shadow-lg">Question {currentIdx + 1}</span>
                <span className="text-slate-500 text-[10px] font-black uppercase tracking-[0.2em]">{currentQuestion.subject}</span>
             </div>
             <div className="flex gap-3">
                <span className="text-green-700 text-[10px] font-black px-4 py-1.5 bg-green-50 rounded-xl border border-green-200">+{currentQuestion.markingScheme.positive}</span>
                <span className="text-red-700 text-[10px] font-black px-4 py-1.5 bg-red-50 rounded-xl border border-red-200">-{currentQuestion.markingScheme.negative}</span>
             </div>
          </div>

          <div className="flex-1 overflow-y-auto p-10 lg:p-20 custom-scrollbar">
            <AnimatePresence mode="wait" initial={false}>
              <motion.div key={currentIdx} initial={{ opacity: 0, x: 50 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -50 }} className="max-w-4xl mx-auto">
                <div className="mb-16">
                  <div className="flex justify-between items-start">
                    <MathText text={currentQuestion.statement} className="text-xl sm:text-2xl lg:text-3xl leading-[1.6] text-slate-800 font-medium border-l-8 border-blue-600 pl-10 flex-1" />
                  </div>
                </div>

                {isOptionsQuestion ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {currentQuestion.options?.map((opt, i) => {
                      const selected = isOptionSelected(i);
                      return (
                        <motion.button key={i} whileHover={{ y: -4 }} onClick={() => handleOptionClick(i)}
                          className={`group flex items-center gap-8 p-8 rounded-[2rem] border-2 transition-all text-left ${selected ? 'border-blue-600 bg-blue-50' : 'border-slate-100 hover:border-slate-300 bg-white'}`}>
                          <span className={`w-12 h-12 rounded-full flex-shrink-0 flex items-center justify-center font-black text-xl transition-all ${selected ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-400'}`}>
                              {selected ? <CheckCircle2 className="w-6 h-6" /> : String.fromCharCode(65 + i)}
                          </span>
                          <MathText text={opt} className="text-slate-700 font-bold text-lg flex-1" />
                        </motion.button>
                      );
                    })}
                  </div>
                ) : (
                  <div className="max-w-xl bg-slate-900 p-12 rounded-[3rem] border-4 border-slate-800 mx-auto lg:mx-0 shadow-2xl relative">
                    <label className="block text-[10px] font-black text-blue-400 uppercase tracking-[0.3em] mb-6">Numerical Value Output</label>
                    <input type="text" inputMode="decimal" value={responses[currentIdx] || ''} onChange={(e) => { if (/^-?\d*\.?\d*$/.test(e.target.value)) setResponses({...responses, [currentIdx]: e.target.value}); }} placeholder="0.00" className="w-full py-8 text-6xl font-black bg-transparent border-b-4 border-slate-700 outline-none focus:border-blue-500 text-blue-100 text-center placeholder:text-slate-800" />
                  </div>
                )}
              </motion.div>
            </AnimatePresence>
          </div>

          <footer className="h-28 bg-white border-t border-slate-100 px-12 flex items-center justify-between shrink-0 shadow-[0_-10px_40px_rgba(0,0,0,0.02)]">
            <div className="flex gap-4">
              <motion.button whileTap={{ scale: 0.95 }} onClick={() => { const s = new Set(markedForReview); const id = currentIdx.toString(); s.has(id) ? s.delete(id) : s.add(id); setMarkedForReview(s); }} className={`px-8 py-4 rounded-2xl font-black transition-all flex items-center gap-3 border-2 ${markedForReview.has(currentIdx.toString()) ? 'bg-purple-600 text-white border-purple-700' : 'bg-white text-slate-700 border-slate-100'}`}>
                <HelpCircle className="w-5 h-5" /> Mark for Review
              </motion.button>
              <motion.button whileTap={{ scale: 0.95 }} onClick={() => { const r = {...responses}; delete r[currentIdx]; setResponses(r); }} className="px-8 py-4 rounded-2xl font-black text-slate-400 bg-white border border-slate-100 hover:text-red-500 hover:bg-red-50 flex items-center gap-3"><RotateCcw className="w-5 h-5" /> Clear</motion.button>
            </div>
            <div className="flex gap-6">
              <motion.button whileTap={{ scale: 0.9 }} disabled={currentIdx === 0} onClick={() => setCurrentIdx(prev => prev - 1)} className="w-20 h-16 rounded-2xl border-2 border-slate-100 text-slate-300 hover:text-slate-900 disabled:opacity-10 flex items-center justify-center"><ChevronLeft className="w-8 h-8" /></motion.button>
              <motion.button whileTap={{ scale: 0.98 }} onClick={() => { if (currentIdx < session.questions.length - 1) { setCurrentIdx(prev => prev + 1); setVisited(prev => new Set([...prev, (currentIdx + 1).toString()])); } else { if(confirm("End of paper?")) handleSubmitButton(); } }} className="px-16 py-4 bg-slate-900 text-white rounded-2xl font-black text-lg flex items-center gap-4 hover:bg-slate-800 shadow-2xl">Save & Next <ChevronRight className="w-5 h-5" /></motion.button>
            </div>
          </footer>
        </div>

        {/* Updated Aside for Scrolling */}
        <aside className={`fixed inset-y-0 right-0 w-full sm:w-[380px] bg-white border-l border-slate-100 flex flex-col shadow-2xl z-50 transform transition-transform duration-500 lg:relative lg:translate-x-0 h-full ${paletteOpen ? 'translate-x-0' : 'translate-x-full'}`}>
          <div className="p-8 pb-4 border-b border-slate-50 relative flex-shrink-0">
            <button onClick={() => setPaletteOpen(false)} className="lg:hidden absolute top-8 right-8 p-2.5 bg-slate-50 rounded-full text-slate-400"><X className="w-5 h-5" /></button>
            <h2 className="text-[11px] font-black text-slate-400 uppercase tracking-[0.3em] mb-4 text-center lg:text-left">Examination Roadmap</h2>
          </div>
          
          <div className="flex-grow overflow-y-auto custom-scrollbar p-8 pt-4" style={{ height: '0px' }}>
            <div className="grid grid-cols-5 gap-3 pb-20">
              {session.questions.map((_: any, idx: number) => (
                <motion.button key={idx} whileHover={{ scale: 1.1 }} onClick={() => { setCurrentIdx(idx); setVisited(prev => new Set([...prev, idx.toString()])); if(window.innerWidth < 1024) setPaletteOpen(false); }} className={`aspect-square rounded-[1rem] flex items-center justify-center font-black text-xs transition-all border-2 ${currentIdx === idx ? 'ring-4 ring-blue-500/10 scale-110 z-10' : ''} ${getPaletteStatus(idx)}`}>{(idx + 1).toString()}</motion.button>
              ))}
            </div>
          </div>

          <div className="p-8 bg-slate-50 border-t border-slate-100 mt-auto flex-shrink-0">
            <motion.button whileTap={{ scale: 0.98 }} onClick={() => { if(confirm("Confirm Final Submission?")) handleSubmitButton() }} disabled={isSubmitting} className="w-full py-5 bg-blue-600 text-white rounded-2xl font-black text-sm flex items-center justify-center gap-3 hover:bg-blue-700 shadow-2xl disabled:opacity-50"><Send className="w-4 h-4" /> Finalize Paper</motion.button>
          </div>
        </aside>
      </div>
    </div>
  );
};

export default ExamPortal;
