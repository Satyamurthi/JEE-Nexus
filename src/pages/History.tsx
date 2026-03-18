
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { History as HistoryIcon, Search, Target, Zap, ChevronRight, Award, BookOpen } from 'lucide-react';
import { getUserExamAttempts, getUserAllDailyAttempts } from '../supabase';

const History = () => {
  const navigate = useNavigate();
  const [examAttempts, setExamAttempts] = useState<any[]>([]);
  const [dailyAttempts, setDailyAttempts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'exams' | 'daily'>('exams');
  const [searchQuery, setSearchQuery] = useState('');
  
  const profile = JSON.parse(localStorage.getItem('user_profile') || '{}');

  useEffect(() => {
    const loadHistory = async () => {
      setLoading(true);
      try {
        const [exams, daily] = await Promise.all([
          getUserExamAttempts(profile.id),
          getUserAllDailyAttempts(profile.id)
        ]);
        setExamAttempts(exams);
        setDailyAttempts(daily);
      } catch (err) {
        console.error("Error loading history:", err);
      } finally {
        setLoading(false);
      }
    };
    loadHistory();
  }, [profile.id]);

  const filteredExams = examAttempts.filter(a => 
    a.config.type.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (a.config.subject && a.config.subject.toLowerCase().includes(searchQuery.toLowerCase())) ||
    (a.config.chapter && a.config.chapter.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const filteredDaily = dailyAttempts.filter(a => 
    a.date.includes(searchQuery)
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="w-12 h-12 border-4 border-indigo-600/20 border-t-indigo-600 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-indigo-600 font-black text-[10px] uppercase tracking-[0.2em]">
            <HistoryIcon className="w-3 h-3" />
            <span>Learning Journey</span>
          </div>
          <h1 className="text-4xl font-black text-slate-900 tracking-tight">Attempt History</h1>
          <p className="text-slate-500 font-medium max-w-xl">
            Review your past performances, track your progress, and analyze your growth over time.
          </p>
        </div>

        <div className="flex bg-slate-100 p-1.5 rounded-2xl border border-slate-200">
          <button
            onClick={() => setActiveTab('exams')}
            className={`px-6 py-2.5 rounded-xl text-xs font-black transition-all ${
              activeTab === 'exams' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            Exams & Practice
          </button>
          <button
            onClick={() => setActiveTab('daily')}
            className={`px-6 py-2.5 rounded-xl text-xs font-black transition-all ${
              activeTab === 'daily' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            Daily Challenges
          </button>
        </div>
      </div>

      {/* Search & Filter */}
      <div className="relative group">
        <Search className="absolute left-6 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 group-focus-within:text-indigo-500 transition-colors" />
        <input 
          type="text"
          placeholder={`Search ${activeTab === 'exams' ? 'exams, subjects or chapters' : 'dates'}...`}
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full pl-14 pr-6 py-5 bg-white border border-slate-200 rounded-[2rem] text-sm font-bold outline-none focus:ring-4 focus:ring-indigo-500/5 shadow-sm transition-all"
        />
      </div>

      {/* History List */}
      <div className="space-y-4">
        {activeTab === 'exams' ? (
          filteredExams.length > 0 ? (
            filteredExams.map((attempt, i) => (
              <div 
                key={i}
                className="bg-white border border-slate-200 rounded-[2rem] p-6 flex flex-col md:flex-row md:items-center justify-between gap-6 hover:shadow-xl hover:shadow-slate-200/50 transition-all group"
              >
                <div className="flex items-center gap-6">
                  <div className={`p-4 rounded-2xl ${
                    attempt.config.type === 'Full Exam' ? 'bg-amber-50 text-amber-600' : 'bg-indigo-50 text-indigo-600'
                  }`}>
                    {attempt.config.type === 'Full Exam' ? <Target className="w-6 h-6" /> : <BookOpen className="w-6 h-6" />}
                  </div>
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                       <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">{attempt.config.type}</span>
                       <span className="w-1 h-1 rounded-full bg-slate-200" />
                       <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                         {new Date(attempt.submitted_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                       </span>
                    </div>
                    <h3 className="text-lg font-black text-slate-900">
                      {attempt.config.chapter || attempt.config.subject || 'Full Syllabus Mock'}
                    </h3>
                  </div>
                </div>

                <div className="flex items-center gap-8">
                  <div className="text-right">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Score</p>
                    <p className="text-xl font-black text-slate-900">
                      {attempt.score} <span className="text-xs text-slate-400">/ {attempt.total_marks}</span>
                    </p>
                  </div>
                  <div className="h-10 w-px bg-slate-100 hidden md:block" />
                  <div className="text-right">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Accuracy</p>
                    <p className="text-xl font-black text-emerald-600">
                      {Math.round((attempt.score / attempt.total_marks) * 100)}%
                    </p>
                  </div>
                  <button 
                    onClick={() => {
                      localStorage.setItem('last_exam_result', JSON.stringify(attempt));
                      navigate('/results');
                    }}
                    className="p-3 bg-slate-50 rounded-xl text-slate-400 hover:bg-indigo-600 hover:text-white transition-all group-hover:translate-x-1"
                  >
                    <ChevronRight className="w-5 h-5" />
                  </button>
                </div>
              </div>
            ))
          ) : (
            <EmptyState message="No exam attempts found. Start your first practice session!" />
          )
        ) : (
          filteredDaily.length > 0 ? (
            filteredDaily.map((attempt, i) => (
              <div 
                key={i}
                className="bg-white border border-slate-200 rounded-[2rem] p-6 flex flex-col md:flex-row md:items-center justify-between gap-6 hover:shadow-xl hover:shadow-slate-200/50 transition-all group"
              >
                <div className="flex items-center gap-6">
                  <div className="p-4 rounded-2xl bg-violet-50 text-violet-600">
                    <Zap className="w-6 h-6" />
                  </div>
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                       <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Daily Challenge</span>
                       <span className="w-1 h-1 rounded-full bg-slate-200" />
                       <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                         {new Date(attempt.date).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
                       </span>
                    </div>
                    <h3 className="text-lg font-black text-slate-900">Strategic Drill Attempt</h3>
                  </div>
                </div>

                <div className="flex items-center gap-8">
                  <div className="text-right">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Score</p>
                    <p className="text-xl font-black text-slate-900">
                      {attempt.score} <span className="text-xs text-slate-400">/ {attempt.total_marks}</span>
                    </p>
                  </div>
                  <div className="h-10 w-px bg-slate-100 hidden md:block" />
                  <div className="text-right">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Status</p>
                    <div className="flex items-center gap-2 text-emerald-600 font-black text-sm">
                       <Award className="w-4 h-4" />
                       Completed
                    </div>
                  </div>
                  <button 
                    onClick={() => {
                        // Daily attempts usually have a similar structure to exam attempts
                        localStorage.setItem('last_exam_result', JSON.stringify({
                            ...attempt,
                            config: { type: 'Daily Challenge', date: attempt.date }
                        }));
                        navigate('/results');
                    }}
                    className="p-3 bg-slate-50 rounded-xl text-slate-400 hover:bg-indigo-600 hover:text-white transition-all group-hover:translate-x-1"
                  >
                    <ChevronRight className="w-5 h-5" />
                  </button>
                </div>
              </div>
            ))
          ) : (
            <EmptyState message="No daily challenges completed yet. Take today's challenge!" />
          )
        )}
      </div>
    </div>
  );
};

const EmptyState = ({ message }: { message: string }) => (
  <div className="flex flex-col items-center justify-center py-20 text-center space-y-6 opacity-40">
    <div className="bg-slate-100 p-8 rounded-full">
      <HistoryIcon className="w-16 h-16 text-slate-400" />
    </div>
    <p className="text-lg font-black text-slate-500 max-w-xs">{message}</p>
  </div>
);

export default History;
