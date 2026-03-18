import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Trophy, Target, CheckCircle2, XCircle, AlertCircle, Brain, Sparkles,
  ArrowLeft, Download, Share2
} from 'lucide-react';
import MathText from '../components/MathText';

const Results = () => {
  const navigate = useNavigate();
  const [result, setResult] = useState<any>(null);
  const [activeSubject, setActiveSubject] = useState<string>('All');

  useEffect(() => {
    const lastResult = localStorage.getItem('last_exam_result');
    if (lastResult) {
      setResult(JSON.parse(lastResult));
    } else {
      navigate('/history');
    }
  }, [navigate]);

  if (!result) return null;

  const subjects = ['All', ...new Set(result.questions.map((q: any) => q.subject))];
  const filteredQuestions = activeSubject === 'All' 
    ? result.questions 
    : result.questions.filter((q: any) => q.subject === activeSubject);

  const stats = {
    correct: result.questions.filter((q: any) => q.isCorrect).length,
    incorrect: result.questions.filter((q: any) => q.userAnswer !== undefined && !q.isCorrect).length,
    unattempted: result.questions.filter((q: any) => q.userAnswer === undefined).length,
    accuracy: result.accuracy,
    score: result.score,
    totalMarks: result.total_marks
  };

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="flex items-center gap-6">
          <button 
            onClick={() => navigate('/history')}
            className="p-3 bg-white border border-slate-200 rounded-2xl text-slate-400 hover:text-slate-900 transition-all shadow-sm"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-indigo-600 font-black text-[10px] uppercase tracking-[0.2em]">
              <Sparkles className="w-3 h-3" />
              <span>Performance Analysis</span>
            </div>
            <h1 className="text-3xl font-black text-slate-900 tracking-tight">
              {result.config?.type || 'Examination'} Result
            </h1>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button className="px-6 py-3 bg-white border border-slate-200 rounded-xl text-[10px] font-black uppercase tracking-widest text-slate-600 flex items-center gap-2 hover:bg-slate-50 transition-all">
            <Download className="w-3.5 h-3.5" /> Export PDF
          </button>
          <button className="px-6 py-3 bg-slate-900 text-white rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center gap-2 hover:bg-slate-800 transition-all shadow-lg shadow-slate-900/10">
            <Share2 className="w-3.5 h-3.5" /> Share Report
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-slate-900 p-8 rounded-[2.5rem] text-white shadow-2xl shadow-slate-900/20 relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-6 opacity-10 group-hover:scale-110 transition-transform">
            <Trophy className="w-20 h-20" />
          </div>
          <div className="relative z-10">
            <p className="text-[10px] font-black text-indigo-300 uppercase tracking-widest mb-2">Final Score</p>
            <p className="text-4xl font-black">{stats.score} <span className="text-sm opacity-40">/ {stats.totalMarks}</span></p>
          </div>
        </div>

        <div className="bg-white p-8 rounded-[2.5rem] border border-slate-200 shadow-lg shadow-slate-200/50 space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Accuracy</p>
            <Target className="w-5 h-5 text-indigo-600" />
          </div>
          <p className="text-3xl font-black text-slate-900">{stats.accuracy}%</p>
          <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
            <div className="h-full bg-indigo-600 rounded-full transition-all duration-1000" style={{ width: `${stats.accuracy}%` }} />
          </div>
        </div>

        <div className="bg-white p-8 rounded-[2.5rem] border border-slate-200 shadow-lg shadow-slate-200/50 space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Correct</p>
            <CheckCircle2 className="w-5 h-5 text-emerald-500" />
          </div>
          <p className="text-3xl font-black text-slate-900">{stats.correct}</p>
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Questions</p>
        </div>

        <div className="bg-white p-8 rounded-[2.5rem] border border-slate-200 shadow-lg shadow-slate-200/50 space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Incorrect</p>
            <XCircle className="w-5 h-5 text-rose-500" />
          </div>
          <p className="text-3xl font-black text-slate-900">{stats.incorrect}</p>
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Questions</p>
        </div>
      </div>

      {/* Main Analysis */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Question Review */}
        <div className="lg:col-span-8 space-y-6">
          <div className="flex items-center justify-between bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
             <div className="flex gap-2">
                {subjects.map(sub => (
                  <button
                    key={sub}
                    onClick={() => setActiveSubject(sub)}
                    className={`px-6 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
                      activeSubject === sub ? 'bg-slate-900 text-white' : 'text-slate-400 hover:text-slate-600'
                    }`}
                  >
                    {sub}
                  </button>
                ))}
             </div>
          </div>

          <div className="space-y-6">
            {filteredQuestions.map((q: any, i: number) => (
              <div key={i} className="bg-white rounded-[2.5rem] border border-slate-200 overflow-hidden shadow-sm hover:shadow-md transition-all">
                <div className="p-8 md:p-10 space-y-8">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className="px-3 py-1 bg-slate-100 text-slate-500 text-[9px] font-black uppercase tracking-widest rounded-lg">Q{i + 1}</span>
                      <span className="text-[9px] font-black text-indigo-600 uppercase tracking-widest">{q.subject}</span>
                    </div>
                    {q.userAnswer === undefined ? (
                      <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
                        <AlertCircle className="w-3 h-3" /> Unattempted
                      </span>
                    ) : q.isCorrect ? (
                      <span className="text-[9px] font-black text-emerald-600 uppercase tracking-widest flex items-center gap-1.5">
                        <CheckCircle2 className="w-3 h-3" /> Correct
                      </span>
                    ) : (
                      <span className="text-[9px] font-black text-rose-600 uppercase tracking-widest flex items-center gap-1.5">
                        <XCircle className="w-3 h-3" /> Incorrect
                      </span>
                    )}
                  </div>

                  <div className="prose prose-slate max-w-none">
                    <MathText className="text-lg font-bold text-slate-800 leading-relaxed">
                      {q.statement}
                    </MathText>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {q.type === 'MCQ' ? (
                      Object.entries(q.options || {}).map(([key, val]: [string, any]) => {
                        const isUserAnswer = q.userAnswer === key;
                        const isCorrectAnswer = q.correctAnswer === key;
                        
                        let borderClass = 'border-slate-100 bg-slate-50/50';
                        if (isCorrectAnswer) borderClass = 'border-emerald-500 bg-emerald-50 shadow-sm';
                        else if (isUserAnswer && !isCorrectAnswer) borderClass = 'border-rose-500 bg-rose-50 shadow-sm';

                        return (
                          <div key={key} className={`p-5 rounded-2xl border-2 flex items-center gap-4 ${borderClass}`}>
                            <div className={`w-8 h-8 rounded-lg flex items-center justify-center font-black text-xs ${
                              isCorrectAnswer ? 'bg-emerald-500 text-white' : isUserAnswer ? 'bg-rose-500 text-white' : 'bg-white text-slate-400 border border-slate-200'
                            }`}>
                              {key}
                            </div>
                            <MathText className={`font-bold text-sm ${isCorrectAnswer ? 'text-emerald-900' : isUserAnswer ? 'text-rose-900' : 'text-slate-600'}`}>
                              {val}
                            </MathText>
                          </div>
                        );
                      })
                    ) : (
                      <div className="col-span-2 space-y-4">
                        <div className="flex gap-4">
                          <div className="flex-1 p-5 rounded-2xl border-2 border-rose-100 bg-rose-50/30">
                            <p className="text-[9px] font-black text-rose-400 uppercase tracking-widest mb-1">Your Answer</p>
                            <p className="text-xl font-black text-rose-900">{q.userAnswer || 'N/A'}</p>
                          </div>
                          <div className="flex-1 p-5 rounded-2xl border-2 border-emerald-100 bg-emerald-50/30">
                            <p className="text-[9px] font-black text-emerald-400 uppercase tracking-widest mb-1">Correct Answer</p>
                            <p className="text-xl font-black text-emerald-900">{q.correctAnswer}</p>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  {q.explanation && (
                    <div className="bg-indigo-50/50 border border-indigo-100 rounded-2xl p-6 space-y-3">
                       <h4 className="text-[10px] font-black text-indigo-600 uppercase tracking-widest flex items-center gap-2">
                         <Brain className="w-3.5 h-3.5" /> AI Explanation
                       </h4>
                       <MathText className="text-xs font-bold text-indigo-900/80 leading-relaxed">
                         {q.explanation}
                       </MathText>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Sidebar Insights */}
        <div className="lg:col-span-4 space-y-8">
           <div className="bg-slate-900 rounded-[2.5rem] p-8 text-white shadow-2xl shadow-slate-900/20 space-y-8 relative overflow-hidden">
              <div className="absolute top-0 right-0 p-6 opacity-10">
                <Sparkles className="w-24 h-24" />
              </div>
              <div className="relative z-10 space-y-6">
                <h3 className="text-sm font-black uppercase tracking-widest text-indigo-300">AI Cognitive Insight</h3>
                <div className="space-y-4">
                   <p className="text-sm font-medium text-white/80 leading-relaxed">
                     Based on this session, your accuracy in <span className="text-indigo-300 font-bold">{activeSubject === 'All' ? 'this set' : activeSubject}</span> is {stats.accuracy}%. 
                     {stats.accuracy > 70 ? " You're showing strong conceptual mastery." : " We recommend revisiting the fundamental concepts for this topic."}
                   </p>
                   <div className="p-4 bg-white/5 border border-white/10 rounded-2xl">
                      <p className="text-[10px] font-black text-indigo-400 uppercase tracking-widest mb-2">Strategic Tip</p>
                      <p className="text-xs font-bold text-white/60">Focus on time management in numerical questions to improve overall score by ~15%.</p>
                   </div>
                </div>
              </div>
           </div>

           <div className="bg-white rounded-[2.5rem] border border-slate-200 p-8 shadow-lg shadow-slate-200/50 space-y-6">
              <h3 className="text-sm font-black text-slate-900 uppercase tracking-widest">Subject Breakdown</h3>
              <div className="space-y-4">
                {subjects.filter(s => s !== 'All').map(sub => {
                  const subQs = result.questions.filter((q: any) => q.subject === sub);
                  const subCorrect = subQs.filter((q: any) => q.isCorrect).length;
                  const subAcc = subQs.length > 0 ? Math.round((subCorrect / subQs.length) * 100) : 0;
                  
                  return (
                    <div key={sub} className="space-y-2">
                       <div className="flex justify-between items-end">
                          <span className="text-xs font-black text-slate-900">{sub}</span>
                          <span className="text-xs font-black text-indigo-600">{subAcc}%</span>
                       </div>
                       <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                          <div className="h-full bg-indigo-600 rounded-full transition-all duration-1000" style={{ width: `${subAcc}%` }} />
                       </div>
                    </div>
                  );
                })}
              </div>
           </div>
        </div>
      </div>
    </div>
  );
};

export default Results;
