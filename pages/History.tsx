
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Calendar, Award, Target, ChevronRight, TrendingUp, Trash2, Clock, Zap, Star, ArrowUpRight, History as HistoryIcon, Sparkles } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const History = () => {
  const navigate = useNavigate();
  const [history, setHistory] = useState<any[]>([]);
  const [stats, setStats] = useState({
    totalAttempts: 0,
    avgAccuracy: 0,
    bestScore: 0,
    totalQuestions: 0
  });

  useEffect(() => {
    const raw = localStorage.getItem('exam_history');
    if (raw) {
      try {
        const parsed = JSON.parse(raw);
        // Sort by date descending
        parsed.sort((a: any, b: any) => b.completedAt - a.completedAt);
        setHistory(parsed);

        // Calculate Stats
        if (parsed.length > 0) {
          const totalAcc = parsed.reduce((acc: number, curr: any) => acc + (curr.accuracy || 0), 0);
          const maxScore = Math.max(...parsed.map((p: any) => p.score));
          const totalQs = parsed.reduce((acc: number, curr: any) => acc + (curr.totalPossible / 4), 0);
          
          setStats({
            totalAttempts: parsed.length,
            avgAccuracy: Math.round(totalAcc / parsed.length),
            bestScore: maxScore,
            totalQuestions: totalQs
          });
        }
      } catch (e) {
        console.error("Failed to parse history", e);
      }
    }
  }, []);

  const handleViewAnalytics = (result: any) => {
    localStorage.setItem('last_result', JSON.stringify(result));
    navigate('/analytics');
  };

  const clearHistory = () => {
    if (confirm("Are you sure you want to clear your exam history? This action cannot be undone.")) {
      localStorage.removeItem('exam_history');
      setHistory([]);
      setStats({ totalAttempts: 0, avgAccuracy: 0, bestScore: 0, totalQuestions: 0 });
    }
  };

  const formatDate = (timestamp: number) => {
    const date = new Date(timestamp);
    return {
      day: date.getDate(),
      month: date.toLocaleDateString('en-US', { month: 'short' }),
      year: date.getFullYear(),
      time: date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
    };
  };

  const getGrade = (accuracy: number) => {
    if (accuracy >= 90) return { label: 'Legendary', gradient: 'from-fuchsia-500 to-pink-500', bg: 'bg-fuchsia-50', text: 'text-fuchsia-600', border: 'border-fuchsia-200' };
    if (accuracy >= 75) return { label: 'Excellent', gradient: 'from-emerald-400 to-teal-500', bg: 'bg-emerald-50', text: 'text-emerald-600', border: 'border-emerald-200' };
    if (accuracy >= 50) return { label: 'Good', gradient: 'from-blue-400 to-indigo-500', bg: 'bg-blue-50', text: 'text-blue-600', border: 'border-blue-200' };
    return { label: 'Needs Focus', gradient: 'from-orange-400 to-red-500', bg: 'bg-orange-50', text: 'text-orange-600', border: 'border-orange-200' };
  };

  return (
    <div className="max-w-7xl mx-auto space-y-12 pb-24">
      {/* Header Section */}
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-8">
        <div className="space-y-4">
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-50 rounded-full border border-indigo-100">
             <HistoryIcon className="w-4 h-4 text-indigo-600" />
             <span className="text-xs font-black text-indigo-700 uppercase tracking-widest">Performance Archives</span>
          </div>
          <h1 className="text-5xl md:text-6xl font-black text-slate-900 tracking-tight leading-none">
            Your <span className="text-transparent bg-clip-text bg-gradient-to-r from-violet-600 to-fuchsia-600">Legacy</span>
          </h1>
          <p className="text-slate-500 font-medium text-lg max-w-xl">
            Every simulation is a stepping stone. Track your evolution from novice to expert through detailed chronological logs.
          </p>
        </div>

        {history.length > 0 && (
          <div className="flex gap-4">
             <button 
               onClick={clearHistory}
               className="px-6 py-4 bg-white border-2 border-slate-100 text-slate-400 rounded-2xl font-bold hover:border-red-200 hover:text-red-500 hover:bg-red-50 transition-all flex items-center gap-2"
             >
               <Trash2 className="w-5 h-5" />
             </button>
             <button 
               onClick={() => navigate('/exam-setup')}
               className="px-8 py-4 bg-slate-900 text-white rounded-2xl font-black shadow-xl shadow-slate-200 hover:bg-slate-800 transition-all flex items-center gap-3 hover:-translate-y-1 active:translate-y-0"
             >
               <Zap className="w-5 h-5 text-yellow-400 fill-yellow-400" />
               Start New Simulation
             </button>
          </div>
        )}
      </div>

      {/* Aggregate Stats Cards */}
      {history.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="p-8 rounded-[2.5rem] bg-gradient-to-br from-indigo-500 to-violet-600 text-white shadow-2xl relative overflow-hidden"
          >
            <div className="absolute top-0 right-0 p-8 opacity-20">
               <Target className="w-32 h-32" />
            </div>
            <div className="relative z-10">
              <div className="w-12 h-12 bg-white/20 backdrop-blur-md rounded-2xl flex items-center justify-center mb-6">
                <Target className="w-6 h-6 text-white" />
              </div>
              <p className="text-5xl font-black tracking-tight mb-2">{stats.totalAttempts}</p>
              <p className="text-indigo-100 font-bold uppercase tracking-widest text-xs">Total Simulations</p>
            </div>
          </motion.div>

          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="p-8 rounded-[2.5rem] bg-white border border-slate-100 shadow-premium relative overflow-hidden group"
          >
            <div className="relative z-10">
              <div className="w-12 h-12 bg-emerald-100 rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                <TrendingUp className="w-6 h-6 text-emerald-600" />
              </div>
              <div className="flex items-baseline gap-2 mb-2">
                <p className="text-5xl font-black text-slate-900 tracking-tight">{stats.avgAccuracy}%</p>
                <span className="text-sm font-bold text-emerald-600">Avg.</span>
              </div>
              <p className="text-slate-400 font-bold uppercase tracking-widest text-xs">Global Accuracy</p>
            </div>
            {/* Decorative BG */}
            <div className="absolute -bottom-10 -right-10 w-40 h-40 bg-emerald-50 rounded-full blur-3xl opacity-50"></div>
          </motion.div>

          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="p-8 rounded-[2.5rem] bg-white border border-slate-100 shadow-premium relative overflow-hidden group"
          >
            <div className="relative z-10">
              <div className="w-12 h-12 bg-amber-100 rounded-2xl flex items-center justify-center mb-6 group-hover:rotate-12 transition-transform">
                <Award className="w-6 h-6 text-amber-600" />
              </div>
              <p className="text-5xl font-black text-slate-900 tracking-tight mb-2">{stats.bestScore}</p>
              <p className="text-slate-400 font-bold uppercase tracking-widest text-xs">Personal Best Score</p>
            </div>
            {/* Decorative BG */}
            <div className="absolute -bottom-10 -right-10 w-40 h-40 bg-amber-50 rounded-full blur-3xl opacity-50"></div>
          </motion.div>
        </div>
      )}

      {/* History List */}
      <div className="space-y-6">
        {history.length === 0 ? (
          <div className="bg-white/50 backdrop-blur-xl border border-white p-20 rounded-[3rem] text-center shadow-premium">
             <div className="w-24 h-24 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-8 animate-pulse">
                <Clock className="w-10 h-10 text-slate-400" />
             </div>
             <h3 className="text-2xl font-black text-slate-900 mb-4">Timeline Empty</h3>
             <p className="text-slate-500 max-w-md mx-auto mb-10 leading-relaxed">
               Your journey to mastery begins with a single step. Complete a practice drill or full exam to generate your first data point.
             </p>
             <button 
               onClick={() => navigate('/exam-setup')}
               className="px-10 py-4 bg-gradient-to-r from-indigo-600 to-violet-600 text-white rounded-2xl font-black shadow-xl shadow-indigo-200 hover:shadow-2xl hover:-translate-y-1 transition-all"
             >
               Initialize First Exam
             </button>
          </div>
        ) : (
          <div className="grid gap-6">
             <h2 className="text-xl font-black text-slate-900 flex items-center gap-3 px-4">
               <Sparkles className="w-5 h-5 text-fuchsia-500" />
               Recent Timeline
             </h2>
             <AnimatePresence>
              {history.map((item, index) => {
                const date = formatDate(item.completedAt);
                const grade = getGrade(item.accuracy);
                
                return (
                  <motion.div
                    key={item.id || index}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.05 }}
                    whileHover={{ y: -4, scale: 1.005 }}
                    onClick={() => handleViewAnalytics(item)}
                    className="group relative bg-white rounded-[2rem] border border-slate-100 p-6 sm:p-8 shadow-sm hover:shadow-2xl hover:shadow-indigo-500/10 transition-all cursor-pointer overflow-hidden"
                  >
                    {/* Hover Gradient Border Effect */}
                    <div className={`absolute inset-0 bg-gradient-to-r ${grade.gradient} opacity-0 group-hover:opacity-5 transition-opacity`}></div>
                    <div className={`absolute left-0 top-0 bottom-0 w-2 bg-gradient-to-b ${grade.gradient}`}></div>

                    <div className="flex flex-col lg:flex-row lg:items-center gap-8 relative z-10">
                      
                      {/* Date Block */}
                      <div className="flex items-center gap-6 min-w-[180px]">
                        <div className="flex flex-col items-center justify-center w-20 h-20 rounded-2xl bg-slate-50 border border-slate-100 group-hover:bg-white group-hover:shadow-md transition-all">
                           <span className="text-xs font-black text-slate-400 uppercase tracking-widest">{date.month}</span>
                           <span className="text-3xl font-black text-slate-900">{date.day}</span>
                           <span className="text-[10px] font-bold text-slate-400">{date.year}</span>
                        </div>
                        <div>
                           <div className="flex items-center gap-2 mb-1">
                              <span className="w-2 h-2 rounded-full bg-slate-300"></span>
                              <p className="text-xs font-bold text-slate-400">{date.time}</p>
                           </div>
                           <h3 className="text-lg font-black text-slate-900 group-hover:text-indigo-600 transition-colors line-clamp-1">
                             {item.type || 'Practice Session'}
                           </h3>
                           <p className="text-xs font-bold text-slate-500 mt-1">ID: #{item.id?.substring(0, 6)}</p>
                        </div>
                      </div>

                      {/* Stats Block */}
                      <div className="flex-1 grid grid-cols-2 sm:grid-cols-3 gap-8 items-center border-t lg:border-t-0 lg:border-l border-slate-100 pt-6 lg:pt-0 lg:pl-8">
                         <div>
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Score</p>
                            <div className="flex items-baseline gap-1">
                               <span className="text-3xl font-black text-slate-900">{item.score}</span>
                               <span className="text-sm font-bold text-slate-400">/ {item.totalPossible}</span>
                            </div>
                         </div>
                         
                         <div>
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Accuracy</p>
                            <div className="flex items-center gap-3">
                               <div className="relative w-12 h-12">
                                  <svg className="w-full h-full transform -rotate-90">
                                     <circle cx="24" cy="24" r="20" stroke="currentColor" strokeWidth="4" fill="transparent" className="text-slate-100" />
                                     <circle 
                                        cx="24" cy="24" r="20" 
                                        stroke="currentColor" strokeWidth="4" fill="transparent" 
                                        strokeDasharray={126}
                                        strokeDashoffset={126 - (126 * item.accuracy) / 100}
                                        className={`${grade.text}`}
                                     />
                                  </svg>
                                  <div className="absolute inset-0 flex items-center justify-center text-[10px] font-black text-slate-700">
                                     {item.accuracy}%
                                  </div>
                               </div>
                               <span className={`text-[10px] font-black uppercase tracking-widest px-2 py-1 rounded-md ${grade.bg} ${grade.text} border ${grade.border}`}>
                                 {grade.label}
                               </span>
                            </div>
                         </div>
                         
                         <div className="flex justify-end">
                            <div className="w-12 h-12 rounded-full bg-slate-50 group-hover:bg-slate-900 flex items-center justify-center transition-colors">
                               <ArrowUpRight className="w-5 h-5 text-slate-400 group-hover:text-white transition-colors" />
                            </div>
                         </div>
                      </div>

                    </div>
                  </motion.div>
                );
              })}
             </AnimatePresence>
          </div>
        )}
      </div>
    </div>
  );
};

export default History;
