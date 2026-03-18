import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Clock, ChevronLeft, ChevronRight, CheckCircle2, Flag, 
  RotateCcw, Send, Menu, X, Brain
} from 'lucide-react';
import { submitExamAttempt } from '../supabase';
import MathText from '../components/MathText';

const ExamPortal = () => {
  const navigate = useNavigate();
  const [questions, setQuestions] = useState<any[]>([]);
  const [config, setConfig] = useState<any>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<number, any>>({});
  const [status, setStatus] = useState<Record<number, 'answered' | 'marked' | 'marked-answered' | 'not-visited' | 'not-answered'>>({});
  const [timeLeft, setTimeLeft] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showPalette, setShowPalette] = useState(false);
  const [showSubmitConfirm, setShowSubmitConfirm] = useState(false);

  const profile = JSON.parse(localStorage.getItem('user_profile') || '{}');

  // Load Exam Data
  useEffect(() => {
    const activeSession = localStorage.getItem('active_session');
    const dailyChallenge = localStorage.getItem('active_exam_questions');
    const dailyConfig = localStorage.getItem('active_exam_config');

    let examQuestions = [];
    let examConfig = null;

    if (activeSession) {
      const session = JSON.parse(activeSession);
      examQuestions = session.questions;
      examConfig = { type: session.type, duration: session.durationMinutes };
    } else if (dailyChallenge && dailyConfig) {
      examQuestions = JSON.parse(dailyChallenge);
      examConfig = JSON.parse(dailyConfig);
    }

    if (!examQuestions || examQuestions.length === 0) {
      navigate('/');
      return;
    }

    setQuestions(examQuestions);
    setConfig(examConfig);
    setTimeLeft((examConfig.duration || 180) * 60);

    // Initialize status
    const initialStatus: any = {};
    examQuestions.forEach((_: any, i: number) => {
      initialStatus[i] = 'not-visited';
    });
    initialStatus[0] = 'not-answered';
    setStatus(initialStatus);
  }, [navigate]);

  // Timer Logic
  useEffect(() => {
    if (timeLeft <= 0) {
      if (questions.length > 0) handleSubmit();
      return;
    }

    const timer = setInterval(() => {
      setTimeLeft(prev => prev - 1);
    }, 1000);

    return () => clearInterval(timer);
  }, [timeLeft, questions.length, handleSubmit]);

  const formatTime = (seconds: number) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    return `${h > 0 ? h + ':' : ''}${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const currentQuestion = questions[currentIndex];

  const handleAnswer = (val: any) => {
    setAnswers(prev => ({ ...prev, [currentIndex]: val }));
    if (status[currentIndex] === 'marked' || status[currentIndex] === 'marked-answered') {
        setStatus(prev => ({ ...prev, [currentIndex]: 'marked-answered' }));
    } else {
        setStatus(prev => ({ ...prev, [currentIndex]: 'answered' }));
    }
  };

  const handleMarkForReview = () => {
    if (answers[currentIndex] !== undefined) {
        setStatus(prev => ({ ...prev, [currentIndex]: 'marked-answered' }));
    } else {
        setStatus(prev => ({ ...prev, [currentIndex]: 'marked' }));
    }
    handleNext();
  };

  const handleClear = () => {
    const newAnswers = { ...answers };
    delete newAnswers[currentIndex];
    setAnswers(newAnswers);
    setStatus(prev => ({ ...prev, [currentIndex]: 'not-answered' }));
  };

  const handleNext = () => {
    if (currentIndex < questions.length - 1) {
      const nextIdx = currentIndex + 1;
      setCurrentIndex(nextIdx);
      if (status[nextIdx] === 'not-visited') {
        setStatus(prev => ({ ...prev, [nextIdx]: 'not-answered' }));
      }
    }
  };

  const handlePrev = () => {
    if (currentIndex > 0) {
      setCurrentIndex(currentIndex - 1);
    }
  };

  const handleSubmit = useCallback(async () => {
    setIsSubmitting(true);
    try {
      let score = 0;
      const results = questions.map((q, i) => {
        const userAnswer = answers[i];
        const isCorrect = userAnswer === q.correctAnswer;
        if (isCorrect) score += 4;
        else if (userAnswer !== undefined) score -= 1;
        
        return {
          ...q,
          userAnswer,
          isCorrect
        };
      });

      const attemptData = {
        user_id: profile.id,
        user_name: profile.full_name,
        score,
        total_marks: questions.length * 4,
        accuracy: Math.round((results.filter(r => r.isCorrect).length / questions.length) * 100),
        config,
        questions: results,
        submitted_at: new Date().toISOString()
      };

      await submitExamAttempt(attemptData);
      
      // Clear session
      localStorage.removeItem('active_session');
      localStorage.removeItem('active_exam_questions');
      localStorage.removeItem('active_exam_config');
      
      // Store result for analytics page
      localStorage.setItem('last_exam_result', JSON.stringify(attemptData));
      
      navigate('/results');
    } catch (err) {
      console.error("Submission failed:", err);
      alert("Submission failed. Please check your connection.");
    } finally {
      setIsSubmitting(false);
    }
  }, [questions, answers, config, profile, navigate]);

  if (questions.length === 0) return null;

  const subjects = ['Physics', 'Chemistry', 'Mathematics'];
  const currentSubject = currentQuestion.subject;

  return (
    <div className="fixed inset-0 bg-slate-50 flex flex-col z-[100] overflow-hidden">
      {/* Top Header */}
      <header className="bg-slate-900 text-white h-16 px-6 flex items-center justify-between shrink-0 shadow-xl">
        <div className="flex items-center gap-4">
          <div className="bg-indigo-600 p-1.5 rounded-lg">
            <Brain className="w-5 h-5" />
          </div>
          <h1 className="font-black text-sm uppercase tracking-widest hidden sm:block">
            {config?.type || 'JEE Simulation'}
          </h1>
        </div>

        <div className="flex items-center gap-6">
          <div className={`flex items-center gap-3 px-4 py-1.5 rounded-full border ${
            timeLeft < 300 ? 'bg-red-500/20 border-red-500 text-red-400 animate-pulse' : 'bg-white/10 border-white/10 text-indigo-300'
          }`}>
            <Clock className="w-4 h-4" />
            <span className="font-mono font-bold text-lg">{formatTime(timeLeft)}</span>
          </div>
          
          <button 
            onClick={() => setShowSubmitConfirm(true)}
            className="bg-emerald-600 hover:bg-emerald-500 text-white px-6 py-2 rounded-xl font-black text-xs uppercase tracking-widest transition-all shadow-lg shadow-emerald-900/20"
          >
            Submit
          </button>
        </div>
      </header>

      {/* Subject Bar */}
      <div className="bg-white border-b border-slate-200 h-12 flex items-center px-4 gap-2 shrink-0 overflow-x-auto no-scrollbar">
        {subjects.map(sub => {
          const subQuestions = questions.filter(q => q.subject === sub);
          if (subQuestions.length === 0) return null;
          const isActive = currentSubject === sub;
          return (
            <button
              key={sub}
              onClick={() => {
                const firstIdx = questions.findIndex(q => q.subject === sub);
                setCurrentIndex(firstIdx);
              }}
              className={`px-6 h-full text-[10px] font-black uppercase tracking-widest transition-all border-b-2 ${
                isActive ? 'text-indigo-600 border-indigo-600 bg-indigo-50/50' : 'text-slate-400 border-transparent hover:text-slate-600'
              }`}
            >
              {sub}
            </button>
          );
        })}
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* Question Area */}
        <div className="flex-1 overflow-y-auto p-6 md:p-10 custom-scrollbar">
          <div className="max-w-4xl mx-auto space-y-8">
            <div className="flex items-center justify-between">
               <span className="px-4 py-1 bg-slate-900 text-white text-[10px] font-black uppercase tracking-widest rounded-lg">
                 Question {currentIndex + 1}
               </span>
               <div className="flex items-center gap-4 text-[10px] font-black uppercase tracking-widest text-slate-400">
                  <span className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-emerald-500" /> +4 Correct</span>
                  <span className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-rose-500" /> -1 Wrong</span>
               </div>
            </div>

            <div className="bg-white p-8 md:p-12 rounded-[2.5rem] shadow-sm border border-slate-200 space-y-10">
               <div className="prose prose-slate max-w-none">
                  <MathText className="text-xl font-bold text-slate-800 leading-relaxed">
                    {currentQuestion.statement}
                  </MathText>
               </div>

               {currentQuestion.type === 'MCQ' ? (
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                   {Object.entries(currentQuestion.options || {}).map(([key, val]: [string, any]) => (
                     <button
                       key={key}
                       onClick={() => handleAnswer(key)}
                       className={`p-6 rounded-2xl border-2 text-left transition-all flex items-center gap-4 group ${
                         answers[currentIndex] === key
                           ? 'border-indigo-600 bg-indigo-50 shadow-md'
                           : 'border-slate-100 hover:border-slate-200 bg-slate-50/50'
                       }`}
                     >
                       <div className={`w-8 h-8 rounded-lg flex items-center justify-center font-black text-xs transition-colors ${
                         answers[currentIndex] === key ? 'bg-indigo-600 text-white' : 'bg-white text-slate-400 border border-slate-200'
                       }`}>
                         {key}
                       </div>
                       <MathText className={`font-bold text-sm ${answers[currentIndex] === key ? 'text-indigo-900' : 'text-slate-600'}`}>
                         {val}
                       </MathText>
                     </button>
                   ))}
                 </div>
               ) : (
                 <div className="space-y-4">
                   <p className="text-xs font-black text-slate-400 uppercase tracking-widest">Numerical Answer</p>
                   <input 
                     type="number"
                     step="any"
                     value={answers[currentIndex] || ''}
                     onChange={(e) => handleAnswer(e.target.value)}
                     placeholder="Enter your numerical response..."
                     className="w-full p-6 bg-slate-50 border-2 border-slate-100 rounded-2xl font-black text-2xl text-slate-900 focus:border-indigo-500 focus:bg-white outline-none transition-all"
                   />
                 </div>
               )}
            </div>
          </div>
        </div>

        {/* Question Palette - Desktop Sidebar */}
        <aside className={`fixed inset-y-0 right-0 z-40 w-80 bg-white border-l border-slate-200 transform ${showPalette ? 'translate-x-0' : 'translate-x-full'} lg:translate-x-0 transition-transform duration-300 flex flex-col shadow-2xl lg:shadow-none`}>
          <div className="p-6 border-b border-slate-100 flex items-center justify-between">
             <h3 className="text-xs font-black text-slate-900 uppercase tracking-widest">Palette</h3>
             <button onClick={() => setShowPalette(false)} className="lg:hidden p-2 text-slate-400 hover:text-slate-600">
               <X className="w-5 h-5" />
             </button>
          </div>

          <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">
            <div className="grid grid-cols-5 gap-3">
              {questions.map((_, i) => {
                const s = status[i];
                let bg = 'bg-slate-100 text-slate-400';
                if (s === 'answered') bg = 'bg-emerald-500 text-white shadow-lg shadow-emerald-200';
                if (s === 'marked') bg = 'bg-indigo-600 text-white shadow-lg shadow-indigo-200 rounded-full';
                if (s === 'marked-answered') bg = 'bg-indigo-600 text-white shadow-lg shadow-indigo-200 relative after:content-[""] after:absolute after:bottom-0 after:right-0 after:w-3 after:h-3 after:bg-emerald-500 after:rounded-full after:border-2 after:border-white';
                if (s === 'not-answered') bg = 'bg-rose-500 text-white shadow-lg shadow-rose-200';
                
                return (
                  <button
                    key={i}
                    onClick={() => setCurrentIndex(i)}
                    className={`w-10 h-10 rounded-xl flex items-center justify-center text-xs font-black transition-all hover:scale-110 ${bg} ${
                      currentIndex === i ? 'ring-4 ring-indigo-600/20 scale-110' : ''
                    }`}
                  >
                    {i + 1}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="p-6 bg-slate-50 border-t border-slate-200 space-y-4">
             <div className="grid grid-cols-2 gap-3">
                <div className="flex items-center gap-2 text-[9px] font-black text-slate-500 uppercase">
                   <div className="w-3 h-3 bg-emerald-500 rounded-md" /> Answered
                </div>
                <div className="flex items-center gap-2 text-[9px] font-black text-slate-500 uppercase">
                   <div className="w-3 h-3 bg-rose-500 rounded-md" /> Not Answered
                </div>
                <div className="flex items-center gap-2 text-[9px] font-black text-slate-500 uppercase">
                   <div className="w-3 h-3 bg-indigo-600 rounded-full" /> Marked
                </div>
                <div className="flex items-center gap-2 text-[9px] font-black text-slate-500 uppercase">
                   <div className="w-3 h-3 bg-slate-200 rounded-md" /> Not Visited
                </div>
             </div>
          </div>
        </aside>
      </div>

      {/* Bottom Controls */}
      <footer className="bg-white border-t border-slate-200 p-4 md:px-8 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <button 
            onClick={handleMarkForReview}
            className="px-6 py-3 bg-indigo-50 text-indigo-600 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-indigo-100 transition-all border border-indigo-100 hidden sm:flex items-center gap-2"
          >
            <Flag className="w-3.5 h-3.5" /> Mark for Review
          </button>
          <button 
            onClick={handleClear}
            className="px-6 py-3 text-slate-400 hover:text-rose-500 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-2"
          >
            <RotateCcw className="w-3.5 h-3.5" /> Clear
          </button>
        </div>

        <div className="flex items-center gap-3">
          <button 
            onClick={() => setShowPalette(true)}
            className="lg:hidden p-3 bg-slate-100 text-slate-600 rounded-xl"
          >
            <Menu className="w-5 h-5" />
          </button>
          
          <div className="flex items-center gap-2">
            <button 
              onClick={handlePrev}
              disabled={currentIndex === 0}
              className="p-3 bg-slate-100 text-slate-600 rounded-xl disabled:opacity-30"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <button 
              onClick={handleNext}
              disabled={currentIndex === questions.length - 1}
              className="px-8 py-3 bg-slate-900 text-white rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-slate-800 transition-all flex items-center gap-2 shadow-lg shadow-slate-900/10"
            >
              Save & Next <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </footer>

      {/* Submit Confirmation Modal */}
      {showSubmitConfirm && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md">
          <div className="bg-white rounded-[2.5rem] w-full max-w-md p-10 space-y-8 shadow-2xl border border-slate-200 animate-in zoom-in duration-300">
            <div className="text-center space-y-4">
              <div className="w-20 h-20 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto shadow-inner">
                <Send className="w-10 h-10" />
              </div>
              <h3 className="text-2xl font-black text-slate-900 tracking-tight">Final Submission</h3>
              <p className="text-slate-500 font-medium">Are you sure you want to end the examination? Your responses will be analyzed by AI.</p>
            </div>

            <div className="grid grid-cols-2 gap-4 bg-slate-50 p-6 rounded-3xl border border-slate-100">
               <div className="text-center">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Answered</p>
                  <p className="text-2xl font-black text-slate-900">{Object.keys(answers).length}</p>
               </div>
               <div className="text-center">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Remaining</p>
                  <p className="text-2xl font-black text-slate-900">{questions.length - Object.keys(answers).length}</p>
               </div>
            </div>

            <div className="flex flex-col gap-3">
              <button 
                onClick={handleSubmit}
                disabled={isSubmitting}
                className="w-full py-5 bg-emerald-600 text-white rounded-2xl font-black text-sm uppercase tracking-widest shadow-xl shadow-emerald-100 flex items-center justify-center gap-3 hover:bg-emerald-500 transition-all"
              >
                {isSubmitting ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                Confirm Submission
              </button>
              <button 
                onClick={() => setShowSubmitConfirm(false)}
                className="w-full py-4 text-slate-400 font-black text-xs uppercase tracking-widest hover:text-slate-600 transition-all"
              >
                Return to Exam
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ExamPortal;
