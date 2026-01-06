
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { CalendarClock, Zap, Trophy, Loader2, Sparkles, AlertTriangle, ArrowRight, Target, Flame, Users, Layers, Lock, Globe, CheckCircle2, ShieldAlert, Clock, RefreshCw, Wifi, WifiOff } from 'lucide-react';
import { motion } from 'framer-motion';
import { getDailyChallenge, getUserDailyAttempt, isSupabaseConfigured } from '../supabase';
import { Subject, ExamType } from '../types';

const Daily = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [paper, setPaper] = useState<any>(null);
  const [userAttempt, setUserAttempt] = useState<any>(null);
  const [timeLeft, setTimeLeft] = useState('');
  const [isLocked, setIsLocked] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<'online' | 'offline'>('online');

  // Helper to get consistent local date YYYY-MM-DD
  const getLocalToday = () => {
    const d = new Date();
    // Offset in milliseconds
    const offsetMs = d.getTimezoneOffset() * 60000;
    // Local date object
    const local = new Date(d.getTime() - offsetMs);
    return local.toISOString().split('T')[0];
  };

  const today = getLocalToday();
  const userProfile = JSON.parse(localStorage.getItem('user_profile') || '{}');
  const isAdmin = userProfile.role === 'admin';
  
  useEffect(() => {
    setConnectionStatus(isSupabaseConfigured() ? 'online' : 'offline');
    loadDailyData();
    checkTimeLock();
    
    const timer = setInterval(() => {
      // Countdown to next day
      const now = new Date();
      const tomorrow = new Date(now);
      tomorrow.setDate(tomorrow.getDate() + 1);
      tomorrow.setHours(0, 0, 0, 0);
      
      const diff = tomorrow.getTime() - now.getTime();
      const h = Math.floor(diff / (1000 * 60 * 60));
      const m = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const s = Math.floor((diff % (1000 * 60)) / 1000);
      
      setTimeLeft(`${h}h ${m}m ${s}s`);
      checkTimeLock();
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  const checkTimeLock = () => {
      // Logic: Paper opens at 8:30 AM IST (UTC +5:30)
      const now = new Date();
      // Current Time in IST
      const istTime = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }));
      
      // Target 8:30 AM IST Today
      const openTime = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }));
      openTime.setHours(8, 30, 0, 0);

      // Lock logic
      if (istTime.getTime() < openTime.getTime()) {
          setIsLocked(true);
      } else {
          setIsLocked(false);
      }
  };

  const loadDailyData = async () => {
    setLoading(true);
    try {
      // 1. Fetch the Global Paper for Today (using local YYYY-MM-DD)
      const dailyData = await getDailyChallenge(today);
      setPaper(dailyData);

      // 2. Check if THIS user has already attempted it
      if (dailyData && userProfile.id) {
         const attempt = await getUserDailyAttempt(userProfile.id, today);
         setUserAttempt(attempt);
      }
    } catch (e) {
      console.error("Failed to load daily challenge data", e);
    } finally {
      setLoading(false);
    }
  };

  const startChallenge = () => {
    if (!paper) return;
    if (isLocked && !isAdmin) {
        alert("The Daily Challenge opens at 8:30 AM IST.");
        return;
    }
    
    // Calculate duration: 2.4 mins per question
    const duration = Math.ceil(paper.questions.length * 2.4);

    const sessionData = {
      type: `Daily Mock • ${today}`,
      isDaily: true,        // Flag for ExamPortal
      dailyDate: today,     // Date Key
      questions: paper.questions,
      startTime: Date.now(),
      durationMinutes: duration
    };
    
    localStorage.setItem('active_session', JSON.stringify(sessionData));
    navigate('/exam-portal');
  };

  const viewResult = () => {
      if(!userAttempt) return;
      
      // Reconstruct result object for Analytics
      const totalPossible = paper.questions.length * 4;
      const resultData = {
          id: userAttempt.id || `daily-${today}`,
          score: userAttempt.score,
          totalPossible: totalPossible,
          accuracy: userAttempt.stats?.accuracy || 0,
          completedAt: userAttempt.submitted_at || Date.now(),
          type: `Daily Mock • ${today}`,
          questions: (userAttempt.attempt_data && userAttempt.attempt_data.length > 0) 
            ? userAttempt.attempt_data 
            : paper.questions // Fallback if old data format
      };
      
      localStorage.setItem('last_result', JSON.stringify(resultData));
      navigate('/analytics');
  };

  return (
    <div className="max-w-6xl mx-auto space-y-8 pb-12 relative">
      {/* Connection Indicator */}
      <div className="absolute top-0 right-0 flex items-center gap-2 px-3 py-1.5 bg-white rounded-full border border-slate-200 shadow-sm text-[10px] font-black uppercase tracking-widest">
         {connectionStatus === 'online' ? (
             <><Wifi className="w-3 h-3 text-green-500" /><span className="text-slate-500">Connected</span></>
         ) : (
             <><WifiOff className="w-3 h-3 text-slate-400" /><span className="text-slate-400">Offline Mode</span></>
         )}
      </div>

      <div className="text-center space-y-4 mb-12 pt-6">
        <div className="inline-flex items-center gap-2 px-4 py-2 bg-fuchsia-100 text-fuchsia-600 rounded-full mb-4">
           <CalendarClock className="w-4 h-4" />
           <span className="text-xs font-black uppercase tracking-widest">Global Event • {today}</span>
        </div>
        <h1 className="text-5xl md:text-6xl font-black text-slate-900 tracking-tight">
           Daily <span className="text-transparent bg-clip-text bg-gradient-to-r from-fuchsia-600 to-purple-600">Gauntlet</span>
        </h1>
        <p className="text-slate-500 text-lg font-medium max-w-2xl mx-auto">
          One Paper. One Day. One Attempt.
        </p>
        <p className="text-xs font-black text-slate-400 uppercase tracking-widest">
           Standardized NTA Paper ID: #{paper?.id?.substring(0,8) || 'PENDING'}
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 items-center">
         {/* Left: Hero Card */}
         <motion.div 
           initial={{ opacity: 0, x: -20 }}
           animate={{ opacity: 1, x: 0 }}
           className="relative group"
         >
            <div className="absolute inset-0 bg-gradient-to-r from-fuchsia-600 to-purple-600 rounded-[3rem] blur-2xl opacity-30 group-hover:opacity-50 transition-opacity duration-1000"></div>
            <div className="bg-slate-900 rounded-[3rem] p-12 text-white relative overflow-hidden border border-white/10 shadow-2xl min-h-[500px] flex flex-col justify-between">
                <div className="absolute top-0 right-0 w-64 h-64 bg-fuchsia-500 rounded-full mix-blend-overlay filter blur-3xl opacity-20"></div>
                
                <div className="relative z-10">
                   {loading ? (
                       <div className="flex flex-col items-center justify-center h-64 space-y-6">
                           <Loader2 className="w-12 h-12 animate-spin text-fuchsia-400" />
                           <div className="text-center">
                               <p className="text-white text-lg font-bold mb-2">
                                   Retrieving Global Paper...
                               </p>
                               <p className="text-slate-400 text-xs font-bold uppercase tracking-widest">
                                   Syncing
                               </p>
                           </div>
                       </div>
                   ) : paper ? (
                       userAttempt ? (
                           <>
                              <div className="flex items-center gap-3 mb-8">
                                 <div className="p-3 bg-green-500/20 rounded-2xl border border-green-500/30">
                                    <CheckCircle2 className="w-8 h-8 text-green-400" />
                                 </div>
                                 <span className="text-green-300 font-black uppercase tracking-widest text-sm">Challenge Completed</span>
                              </div>
                              <h2 className="text-4xl font-black mb-4 leading-tight">
                                Score: {userAttempt.score} / {userAttempt.total_marks}
                              </h2>
                              <p className="text-slate-400 text-lg leading-relaxed mb-8">
                                You have successfully submitted your attempt for {today}. Analysis and solutions are now available.
                              </p>
                           </>
                       ) : (
                           <>
                              {isLocked && !isAdmin ? (
                                  <>
                                    <div className="flex items-center gap-3 mb-8">
                                        <div className="p-3 bg-red-500/20 rounded-2xl border border-red-500/30">
                                            <Clock className="w-8 h-8 text-red-400" />
                                        </div>
                                        <span className="text-red-300 font-black uppercase tracking-widest text-sm">Gate Locked</span>
                                    </div>
                                    <h2 className="text-4xl font-black mb-6 leading-tight">
                                        Starts at 08:30 AM IST
                                    </h2>
                                    <p className="text-slate-400 text-lg leading-relaxed mb-8">
                                        The daily challenge paper has been generated but is currently locked for fairness.
                                    </p>
                                  </>
                              ) : (
                                  <>
                                    <div className="flex items-center gap-3 mb-8">
                                        <div className="p-3 bg-fuchsia-500/20 rounded-2xl border border-fuchsia-500/30">
                                            <Flame className="w-8 h-8 text-fuchsia-400" />
                                        </div>
                                        <span className="text-fuchsia-300 font-black uppercase tracking-widest text-sm">Active Now</span>
                                    </div>
                                    <h2 className="text-4xl font-black mb-6 leading-tight">
                                        NTA Pattern Full Mock
                                    </h2>
                                    <p className="text-slate-400 text-lg leading-relaxed mb-8">
                                        This paper is live for {today}. Contains exactly {paper.questions.length} questions.
                                        Uniform for all candidates.
                                    </p>
                                  </>
                              )}
                           </>
                       )
                   ) : (
                       <>
                          <div className="flex items-center gap-3 mb-8">
                             <div className="p-3 bg-slate-700 rounded-2xl border border-slate-600">
                                <Lock className="w-8 h-8 text-slate-400" />
                             </div>
                             <span className="text-slate-400 font-black uppercase tracking-widest text-sm">Locked</span>
                          </div>
                          <h2 className="text-4xl font-black mb-6 leading-tight">
                             Paper Not Released
                          </h2>
                          <p className="text-slate-400 text-sm leading-relaxed mb-8">
                             The daily challenge for <span className="text-white font-mono">{today}</span> has not been published by the Admin yet.
                             Please check back later.
                          </p>
                          <button 
                             onClick={() => { setPaper(null); loadDailyData(); }}
                             className="px-6 py-3 bg-slate-800 text-slate-300 rounded-xl font-bold text-xs flex items-center gap-2 hover:bg-slate-700 transition-colors"
                          >
                             <RefreshCw className="w-4 h-4" /> Force Refresh
                          </button>
                       </>
                   )}
                </div>

                <div className="space-y-6 relative z-10">
                    {paper && !userAttempt && (
                        <>
                           <div className="flex items-center gap-8">
                              <div>
                                 <p className="text-slate-500 text-xs font-black uppercase tracking-widest mb-1">Questions</p>
                                 <p className="text-3xl font-black text-white">{paper.questions.length}</p>
                              </div>
                              <div className="w-[1px] h-10 bg-white/10"></div>
                              <div>
                                 <p className="text-slate-500 text-xs font-black uppercase tracking-widest mb-1">Duration</p>
                                 <p className="text-3xl font-black text-white">{Math.ceil(paper.questions.length * 2.4)}m</p>
                              </div>
                              <div className="w-[1px] h-10 bg-white/10"></div>
                              <div>
                                 <p className="text-slate-500 text-xs font-black uppercase tracking-widest mb-1">Expires In</p>
                                 <p className="text-3xl font-black text-fuchsia-400 font-mono">{timeLeft}</p>
                              </div>
                           </div>

                           <button 
                             onClick={startChallenge}
                             disabled={isLocked && !isAdmin}
                             className={`w-full py-6 bg-white text-slate-900 rounded-2xl font-black text-xl hover:bg-fuchsia-50 transition-all flex items-center justify-center gap-4 group/btn ${isLocked && !isAdmin ? 'opacity-50 cursor-not-allowed' : ''}`}
                           >
                             {isLocked && !isAdmin ? "Locked until 8:30 AM IST" : "Start Examination"}
                             {!isLocked && <ArrowRight className="w-6 h-6 group-hover/btn:translate-x-1 transition-transform" />}
                           </button>
                        </>
                    )}
                    {userAttempt && (
                        <button 
                            onClick={viewResult}
                            className="w-full py-6 bg-green-500 text-white rounded-2xl font-bold text-lg flex items-center justify-center gap-4 hover:bg-green-600 transition-all shadow-lg"
                        >
                            <Trophy className="w-6 h-6" />
                            View Analysis & Solutions
                        </button>
                    )}
                    {!paper && !loading && isAdmin && (
                         <div className="w-full py-6 bg-slate-800 rounded-2xl text-slate-400 font-bold text-center border border-slate-700 flex flex-col items-center">
                            <AlertTriangle className="w-6 h-6 mb-2 text-yellow-500" />
                            <span>Go to Admin Panel to upload/generate paper</span>
                         </div>
                    )}
                </div>
            </div>
         </motion.div>

         {/* Right: Info & Stats */}
         <div className="space-y-6">
            <div className="glass-panel p-8 rounded-[2.5rem] flex items-center gap-6">
               <div className="w-16 h-16 rounded-2xl bg-orange-100 flex items-center justify-center text-orange-600 shadow-sm">
                  <Globe className="w-8 h-8" />
               </div>
               <div>
                  <h3 className="text-xl font-black text-slate-900">Synchronized Testing</h3>
                  <p className="text-slate-500 text-sm mt-1">Every aspirant sees the same questions today.</p>
               </div>
            </div>

            <div className="glass-panel p-8 rounded-[2.5rem] flex items-center gap-6">
               <div className="w-16 h-16 rounded-2xl bg-blue-100 flex items-center justify-center text-blue-600 shadow-sm">
                  <Clock className="w-8 h-8" />
               </div>
               <div>
                  <h3 className="text-xl font-black text-slate-900">Strict Schedule</h3>
                  <p className="text-slate-500 text-sm mt-1">
                     Opens exactly at 08:30 AM IST.
                  </p>
               </div>
            </div>

            {isAdmin && (
                <div className="bg-slate-900 p-8 rounded-[2.5rem] text-white shadow-xl relative overflow-hidden border border-slate-800">
                    <ShieldAlert className="absolute top-4 right-4 w-24 h-24 opacity-5" />
                    <h3 className="text-lg font-black uppercase tracking-widest mb-4 flex items-center gap-2">
                    <ShieldAlert className="w-5 h-5 text-fuchsia-500" /> Admin Access
                    </h3>
                    <p className="text-slate-400 text-sm mb-4">You can generate or upload today's paper in the Admin Panel.</p>
                </div>
            )}
         </div>
      </div>
    </div>
  );
};

export default Daily;
