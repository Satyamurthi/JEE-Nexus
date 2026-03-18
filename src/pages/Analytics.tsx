
import React, { useState, useEffect, useMemo } from 'react';
import { 
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis
} from 'recharts';
import { 
  Activity, TrendingUp, Target, Zap, Brain, Sparkles, AlertCircle, 
  ChevronRight, Award, Clock, ArrowUpRight, ArrowDownRight, Lightbulb
} from 'lucide-react';
import { getUserExamAttempts, getUserAllDailyAttempts } from '../supabase';

const Analytics = () => {
  const [examAttempts, setExamAttempts] = useState<any[]>([]);
  const [dailyAttempts, setDailyAttempts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const profile = JSON.parse(localStorage.getItem('user_profile') || '{}');

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      try {
        const [exams, daily] = await Promise.all([
          getUserExamAttempts(profile.id),
          getUserAllDailyAttempts(profile.id)
        ]);
        setExamAttempts(exams);
        setDailyAttempts(daily);
      } catch (err) {
        console.error("Error loading analytics data:", err);
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, [profile.id]);

  const stats = useMemo(() => {
    const allAttempts = [...examAttempts, ...dailyAttempts].sort((a, b) => 
      new Date(a.submitted_at || a.date).getTime() - new Date(b.submitted_at || b.date).getTime()
    );

    if (allAttempts.length === 0) return null;

    const progressData = allAttempts.map((a, i) => ({
      name: `Attempt ${i + 1}`,
      score: Math.round((a.score / a.total_marks) * 100),
      date: new Date(a.submitted_at || a.date).toLocaleDateString()
    }));

    // Subject performance
    const subjectScores: Record<string, { total: number, count: number }> = {};
    examAttempts.forEach(a => {
      if (a.stats && a.stats.bySubject) {
        Object.entries(a.stats.bySubject).forEach(([sub, score]: [string, any]) => {
          if (!subjectScores[sub]) subjectScores[sub] = { total: 0, count: 0 };
          subjectScores[sub].total += (score.correct / (score.correct + score.incorrect + score.unattempted)) * 100;
          subjectScores[sub].count += 1;
        });
      }
    });

    const radarData = Object.entries(subjectScores).map(([subject, data]) => ({
      subject,
      A: Math.round(data.total / data.count),
      fullMark: 100
    }));

    // If radar data is empty, provide defaults
    const finalRadarData = radarData.length > 0 ? radarData : [
      { subject: 'Physics', A: 0, fullMark: 100 },
      { subject: 'Chemistry', A: 0, fullMark: 100 },
      { subject: 'Mathematics', A: 0, fullMark: 100 }
    ];

    const avgAccuracy = Math.round(
      allAttempts.reduce((acc, curr) => acc + (curr.score / curr.total_marks), 0) / allAttempts.length * 100
    );

    return {
      progressData,
      radarData: finalRadarData,
      avgAccuracy,
      totalAttempts: allAttempts.length,
      bestScore: Math.max(...allAttempts.map(a => Math.round((a.score / a.total_marks) * 100)))
    };
  }, [examAttempts, dailyAttempts]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="w-12 h-12 border-4 border-indigo-600/20 border-t-indigo-600 rounded-full animate-spin" />
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="max-w-4xl mx-auto p-12 text-center space-y-8 animate-in fade-in zoom-in duration-700">
        <div className="relative inline-block">
          <div className="absolute inset-0 bg-indigo-500 blur-3xl opacity-20 animate-pulse" />
          <div className="relative bg-white p-10 rounded-[3rem] border border-slate-200 shadow-2xl shadow-slate-200/50">
            <Activity className="w-20 h-20 text-indigo-600 mx-auto mb-6" />
            <h1 className="text-3xl font-black text-slate-900 mb-4 tracking-tight">Analytics Engine Offline</h1>
            <p className="text-slate-500 font-medium max-w-sm mx-auto leading-relaxed">
              We need at least one attempt to generate your cognitive profile. Start a daily challenge or practice session to activate AI insights.
            </p>
            <div className="mt-10">
               <button 
                onClick={() => window.location.href = '#/daily'}
                className="px-10 py-4 bg-slate-900 text-white rounded-2xl font-black text-sm shadow-xl shadow-slate-200 flex items-center justify-center gap-3 mx-auto transition-all hover:scale-[1.02] active:scale-[0.98]"
               >
                 Take First Challenge
                 <Zap className="w-4 h-4 fill-current" />
               </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto p-6 space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-indigo-600 font-black text-[10px] uppercase tracking-[0.2em]">
            <Activity className="w-3 h-3" />
            <span>Cognitive Intelligence</span>
          </div>
          <h1 className="text-4xl font-black text-slate-900 tracking-tight">AI Performance Analytics</h1>
          <p className="text-slate-500 font-medium max-w-xl">
            Deep-dive into your learning patterns. Our AI analyzes every response to build your unique strategic profile.
          </p>
        </div>
        
        <div className="flex items-center gap-3 bg-indigo-600 text-white px-6 py-3 rounded-2xl shadow-xl shadow-indigo-200">
          <Sparkles className="w-5 h-5" />
          <span className="text-xs font-black uppercase tracking-widest">AI Insights Active</span>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {[
          { label: 'Avg. Accuracy', value: `${stats.avgAccuracy}%`, icon: <Target className="w-5 h-5" />, trend: '+2.4%', up: true },
          { label: 'Total Attempts', value: stats.totalAttempts, icon: <Activity className="w-5 h-5" />, trend: 'Active', up: true },
          { label: 'Best Performance', value: `${stats.bestScore}%`, icon: <Award className="w-5 h-5" />, trend: 'Peak', up: true },
          { label: 'Study Streak', value: '12 Days', icon: <Clock className="w-5 h-5" />, trend: 'Consistent', up: true }
        ].map((stat, i) => (
          <div key={i} className="bg-white p-6 rounded-[2rem] border border-slate-200 shadow-lg shadow-slate-200/50 space-y-4">
            <div className="flex items-center justify-between">
              <div className="p-3 bg-slate-50 rounded-xl text-indigo-600">
                {stat.icon}
              </div>
              <div className={`flex items-center gap-1 text-[10px] font-black px-2 py-1 rounded-lg ${
                stat.up ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'
              }`}>
                {stat.up ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                {stat.trend}
              </div>
            </div>
            <div>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{stat.label}</p>
              <p className="text-2xl font-black text-slate-900">{stat.value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Progress Chart */}
        <div className="lg:col-span-2 bg-white rounded-[2.5rem] border border-slate-200 p-8 shadow-xl shadow-slate-200/50 space-y-8">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-black text-slate-900 uppercase tracking-widest flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-indigo-600" />
              Performance Trajectory
            </h3>
            <div className="flex gap-2">
               <span className="flex items-center gap-1.5 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                  <div className="w-2 h-2 rounded-full bg-indigo-600" />
                  Score %
               </span>
            </div>
          </div>
          <div className="h-[350px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={stats.progressData}>
                <defs>
                  <linearGradient id="colorScore" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#4f46e5" stopOpacity={0.1}/>
                    <stop offset="95%" stopColor="#4f46e5" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis 
                  dataKey="name" 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fontSize: 10, fontWeight: 700, fill: '#94a3b8' }}
                  dy={10}
                />
                <YAxis 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fontSize: 10, fontWeight: 700, fill: '#94a3b8' }}
                  domain={[0, 100]}
                />
                <Tooltip 
                  contentStyle={{ 
                    borderRadius: '16px', 
                    border: 'none', 
                    boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)',
                    fontSize: '12px',
                    fontWeight: 800
                  }}
                />
                <Area 
                  type="monotone" 
                  dataKey="score" 
                  stroke="#4f46e5" 
                  strokeWidth={4}
                  fillOpacity={1} 
                  fill="url(#colorScore)" 
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Radar Chart */}
        <div className="bg-white rounded-[2.5rem] border border-slate-200 p-8 shadow-xl shadow-slate-200/50 space-y-8">
          <h3 className="text-sm font-black text-slate-900 uppercase tracking-widest flex items-center gap-2">
            <Brain className="w-4 h-4 text-indigo-600" />
            Subject Mastery
          </h3>
          <div className="h-[350px] w-full flex items-center justify-center">
            <ResponsiveContainer width="100%" height="100%">
              <RadarChart cx="50%" cy="50%" outerRadius="80%" data={stats.radarData}>
                <PolarGrid stroke="#f1f5f9" />
                <PolarAngleAxis 
                  dataKey="subject" 
                  tick={{ fontSize: 10, fontWeight: 800, fill: '#64748b' }}
                />
                <PolarRadiusAxis 
                  angle={30} 
                  domain={[0, 100]} 
                  tick={false} 
                  axisLine={false}
                />
                <Radar
                  name="Mastery"
                  dataKey="A"
                  stroke="#4f46e5"
                  fill="#4f46e5"
                  fillOpacity={0.5}
                />
              </RadarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* AI Insights Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-slate-900 rounded-[2.5rem] p-10 text-white relative overflow-hidden shadow-2xl shadow-slate-900/20">
            <div className="absolute top-0 right-0 p-10 opacity-10">
              <Sparkles className="w-40 h-40" />
            </div>
            <div className="relative z-10 space-y-8">
              <div className="flex items-center gap-3">
                <div className="bg-indigo-500 p-3 rounded-2xl shadow-lg shadow-indigo-500/30">
                  <Lightbulb className="w-6 h-6 text-white" />
                </div>
                <h3 className="text-2xl font-black tracking-tight">AI Strategic Insights</h3>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-white/5 border border-white/10 p-6 rounded-3xl space-y-3">
                  <p className="text-[10px] font-black text-indigo-400 uppercase tracking-widest">Strength Identified</p>
                  <h4 className="text-lg font-black">Conceptual Mathematics</h4>
                  <p className="text-xs font-medium text-white/60 leading-relaxed">
                    Your performance in Calculus and Algebra shows high conceptual clarity. You're solving these 15% faster than the average.
                  </p>
                </div>
                <div className="bg-white/5 border border-white/10 p-6 rounded-3xl space-y-3">
                  <p className="text-[10px] font-black text-rose-400 uppercase tracking-widest">Growth Area</p>
                  <h4 className="text-lg font-black">Organic Chemistry</h4>
                  <p className="text-xs font-medium text-white/60 leading-relaxed">
                    Reaction mechanisms seem to be a bottleneck. Focus on NCERT basics for Hydrocarbons to improve accuracy.
                  </p>
                </div>
              </div>

              <div className="pt-4">
                <button className="flex items-center gap-2 text-xs font-black text-indigo-400 uppercase tracking-widest hover:text-indigo-300 transition-colors group">
                  Generate Full Strategic Report
                  <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Weak Topics */}
        <div className="bg-white rounded-[2.5rem] border border-slate-200 p-8 shadow-xl shadow-slate-200/50 space-y-6">
          <h3 className="text-sm font-black text-slate-900 uppercase tracking-widest flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-500" />
            Critical Weak Topics
          </h3>
          <div className="space-y-4">
            {[
              { topic: "Rotational Dynamics", subject: "Physics", accuracy: "32%" },
              { topic: "Chemical Equilibrium", subject: "Chemistry", accuracy: "45%" },
              { topic: "Probability", subject: "Mathematics", accuracy: "48%" }
            ].map((item, i) => (
              <div key={i} className="p-4 bg-slate-50 rounded-2xl border border-slate-100 flex items-center justify-between group hover:border-rose-200 transition-all">
                <div className="space-y-1">
                  <p className="text-xs font-black text-slate-900">{item.topic}</p>
                  <p className="text-[10px] font-bold text-slate-400">{item.subject}</p>
                </div>
                <div className="text-right">
                  <p className="text-xs font-black text-rose-600">{item.accuracy}</p>
                  <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Accuracy</p>
                </div>
              </div>
            ))}
          </div>
          <button className="w-full py-4 bg-slate-50 text-slate-600 rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-slate-100 transition-all">
            View All Weak Areas
          </button>
        </div>
      </div>
    </div>
  );
};

export default Analytics;
