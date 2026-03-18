
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Calendar, Zap, CheckCircle2, Lock, Play, Trophy, Clock, ChevronRight, Brain, Target, Sparkles } from 'lucide-react';
import { getDailyChallenge, getUserDailyAttempt } from '../supabase';

const Daily = () => {
  const navigate = useNavigate();
  const [challenge, setChallenge] = useState<any>(null);
  const [attempt, setAttempt] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const profile = JSON.parse(localStorage.getItem('user_profile') || '{}');

  const today = new Date().toISOString().split('T')[0];

  useEffect(() => {
    const loadDaily = async () => {
      setLoading(true);
      try {
        const [challengeData, attemptData] = await Promise.all([
          getDailyChallenge(today),
          getUserDailyAttempt(profile.id, today)
        ]);
        setChallenge(challengeData);
        setAttempt(attemptData);
      } catch (err) {
        console.error("Error loading daily challenge:", err);
      } finally {
        setLoading(false);
      }
    };
    loadDaily();
  }, [today, profile.id]);

  const handleStart = () => {
    if (!challenge) return;
    // Store challenge questions in local storage for the exam portal
    localStorage.setItem('active_exam_questions', JSON.stringify(challenge.questions));
    localStorage.setItem('active_exam_config', JSON.stringify({
        type: 'Daily Challenge',
        date: today,
        duration: 30 // 30 minutes for daily challenge
    }));
    navigate('/exam-portal');
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="w-12 h-12 border-4 border-indigo-600/20 border-t-indigo-600 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto p-6 space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
      {/* Header Section */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-indigo-600 font-black text-[10px] uppercase tracking-[0.2em]">
            <Calendar className="w-3 h-3" />
            <span>{new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</span>
          </div>
          <h1 className="text-4xl font-black text-slate-900 tracking-tight">Daily Challenge</h1>
          <p className="text-slate-500 font-medium max-w-xl">
            Sharpen your skills with a curated set of high-impact JEE questions. Resetting every 24 hours.
          </p>
        </div>
        
        {attempt && (
          <div className="bg-emerald-50 border border-emerald-100 px-6 py-3 rounded-2xl flex items-center gap-4 shadow-sm">
            <div className="bg-emerald-500 p-2 rounded-xl shadow-lg shadow-emerald-200">
              <CheckCircle2 className="w-5 h-5 text-white" />
            </div>
            <div>
              <p className="text-[10px] font-black text-emerald-600 uppercase tracking-widest">Completed</p>
              <p className="text-lg font-black text-emerald-900">Score: {attempt.score}/{attempt.total_marks}</p>
            </div>
          </div>
        )}
      </div>

      {/* Main Content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Challenge Card */}
        <div className="lg:col-span-2 space-y-6">
          <div className={`relative overflow-hidden rounded-[2.5rem] border transition-all duration-500 ${
            challenge 
              ? 'bg-white border-slate-200 shadow-xl shadow-slate-200/50' 
              : 'bg-slate-50 border-slate-200 border-dashed'
          }`}>
            {challenge && (
              <div className="absolute top-0 right-0 p-8 opacity-5">
                <Brain className="w-48 h-48" />
              </div>
            )}

            <div className="p-10 relative z-10">
              {challenge ? (
                <div className="space-y-8">
                  <div className="flex items-start justify-between">
                    <div className="space-y-4">
                      <div className="flex items-center gap-3">
                        <div className="bg-indigo-600 p-3 rounded-2xl shadow-xl shadow-indigo-200">
                          <Zap className="w-6 h-6 text-white" />
                        </div>
                        <h2 className="text-2xl font-black text-slate-900">Today's Strategic Set</h2>
                      </div>
                      <div className="flex flex-wrap gap-4">
                        <div className="flex items-center gap-2 bg-slate-100 px-4 py-2 rounded-full border border-slate-200">
                          <Target className="w-4 h-4 text-slate-600" />
                          <span className="text-xs font-bold text-slate-700">{challenge.questions.length} Questions</span>
                        </div>
                        <div className="flex items-center gap-2 bg-slate-100 px-4 py-2 rounded-full border border-slate-200">
                          <Clock className="w-4 h-4 text-slate-600" />
                          <span className="text-xs font-bold text-slate-700">30 Minutes</span>
                        </div>
                        <div className="flex items-center gap-2 bg-indigo-50 px-4 py-2 rounded-full border border-indigo-100">
                          <Sparkles className="w-4 h-4 text-indigo-600" />
                          <span className="text-xs font-bold text-indigo-700">AI Generated</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-4">
                    {['Physics', 'Chemistry', 'Mathematics'].map(sub => {
                      const count = challenge.questions.filter((q: any) => q.subject === sub).length;
                      return (
                        <div key={sub} className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">{sub}</p>
                          <p className="text-xl font-black text-slate-900">{count} <span className="text-xs font-bold text-slate-400">Q</span></p>
                        </div>
                      );
                    })}
                  </div>

                  <div className="pt-4">
                    {attempt ? (
                      <button 
                        onClick={() => navigate('/history')}
                        className="w-full py-5 bg-slate-900 text-white rounded-[1.5rem] font-black text-sm shadow-xl shadow-slate-200 flex items-center justify-center gap-3 group transition-all hover:scale-[1.02] active:scale-[0.98]"
                      >
                        View Detailed Analysis
                        <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                      </button>
                    ) : (
                      <button 
                        onClick={handleStart}
                        className="w-full py-5 bg-gradient-to-r from-indigo-600 to-violet-600 text-white rounded-[1.5rem] font-black text-sm shadow-xl shadow-indigo-200 flex items-center justify-center gap-3 group transition-all hover:scale-[1.02] active:scale-[0.98]"
                      >
                        Start Challenge Now
                        <Play className="w-4 h-4 fill-current group-hover:scale-110 transition-transform" />
                      </button>
                    )}
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-12 text-center space-y-6">
                  <div className="bg-slate-100 p-6 rounded-full">
                    <Lock className="w-12 h-12 text-slate-300" />
                  </div>
                  <div className="space-y-2">
                    <h2 className="text-xl font-black text-slate-900">Challenge Not Available</h2>
                    <p className="text-slate-500 text-sm max-w-xs font-medium">
                      The daily challenge for today hasn't been published yet. Check back soon!
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Guidelines */}
          <div className="bg-amber-50 border border-amber-100 rounded-[2rem] p-8 space-y-4">
            <h3 className="text-sm font-black text-amber-900 uppercase tracking-widest flex items-center gap-2">
              <AlertCircle className="w-4 h-4" />
              Challenge Rules
            </h3>
            <ul className="space-y-3">
              {[
                "One attempt allowed per day for score tracking.",
                "Strict 30-minute timer applies once started.",
                "Questions are curated to cover high-weightage JEE topics.",
                "Detailed AI analysis available immediately after submission."
              ].map((rule, i) => (
                <li key={i} className="flex items-start gap-3 text-xs font-bold text-amber-800/80 leading-relaxed">
                  <div className="w-1.5 h-1.5 rounded-full bg-amber-400 mt-1.5 shrink-0" />
                  {rule}
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Sidebar Stats */}
        <div className="space-y-6">
          <div className="bg-white rounded-[2.5rem] border border-slate-200 p-8 shadow-lg shadow-slate-200/50 space-y-6">
            <h3 className="text-sm font-black text-slate-900 uppercase tracking-widest">Global Leaderboard</h3>
            <div className="space-y-4">
              {[
                { name: "Aryan S.", score: 40, time: "12m" },
                { name: "Priya K.", score: 38, time: "15m" },
                { name: "Rahul M.", score: 36, time: "14m" }
              ].map((user, i) => (
                <div key={i} className="flex items-center justify-between p-3 rounded-2xl hover:bg-slate-50 transition-colors">
                  <div className="flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center font-black text-xs ${
                      i === 0 ? 'bg-amber-100 text-amber-600' : 'bg-slate-100 text-slate-500'
                    }`}>
                      {i + 1}
                    </div>
                    <div>
                      <p className="text-xs font-black text-slate-900">{user.name}</p>
                      <p className="text-[10px] font-bold text-slate-400">{user.time}</p>
                    </div>
                  </div>
                  <p className="text-sm font-black text-indigo-600">{user.score}</p>
                </div>
              ))}
            </div>
            <button className="w-full py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest hover:text-indigo-600 transition-colors">
              View Full Leaderboard
            </button>
          </div>

          <div className="bg-gradient-to-br from-indigo-600 to-violet-700 rounded-[2.5rem] p-8 text-white shadow-xl shadow-indigo-200 space-y-6 relative overflow-hidden">
            <div className="absolute top-0 right-0 p-4 opacity-10">
              <Trophy className="w-24 h-24" />
            </div>
            <div className="relative z-10 space-y-4">
              <h3 className="text-sm font-black uppercase tracking-widest opacity-80">Your Streak</h3>
              <div className="flex items-end gap-2">
                <span className="text-5xl font-black">12</span>
                <span className="text-lg font-bold mb-1 opacity-80">Days</span>
              </div>
              <p className="text-xs font-bold leading-relaxed opacity-70">
                You're in the top 5% of consistent learners this month. Keep it up!
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

const AlertCircle = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10" />
    <line x1="12" y1="8" x2="12" y2="12" />
    <line x1="12" y1="16" x2="12.01" y2="16" />
  </svg>
);

export default Daily;
