
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Award, Target, TrendingUp, BookOpen, ChevronRight, Brain, Flame, Activity, Zap, Layers, Crown } from 'lucide-react';
import { motion } from 'framer-motion';

const StatCard = ({ icon, label, value, subValue, gradient, delay }: any) => (
  <motion.div 
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ delay }}
    whileHover={{ y: -8, scale: 1.02 }}
    className={`p-8 rounded-[2.5rem] shadow-2xl text-white relative overflow-hidden group ${gradient}`}
  >
    <div className="absolute top-0 right-0 p-8 opacity-20 group-hover:scale-150 transition-transform duration-700 rotate-12">
      {React.cloneElement(icon, { className: `w-40 h-40 text-white` })}
    </div>
    
    <div className="relative z-10">
        <div className="p-4 bg-white/20 backdrop-blur-md rounded-2xl w-fit mb-8 border border-white/20 shadow-lg">
           {React.cloneElement(icon, { className: `w-6 h-6 text-white` })}
        </div>
        <p className="text-6xl font-black tracking-tighter drop-shadow-sm mb-2">{value}</p>
        <p className="text-sm font-bold text-white/90 tracking-widest uppercase">{label}</p>
        <div className="mt-6 flex items-center gap-2 text-xs font-medium text-white/80 bg-black/10 w-fit px-3 py-1 rounded-full">
           <div className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
           {subValue}
        </div>
    </div>
  </motion.div>
);

const Dashboard = () => {
  const navigate = useNavigate();
  const [profile, setProfile] = useState<any>({});
  const [stats, setStats] = useState({
    avgScore: 0,
    accuracy: 0,
    percentile: 0,
    testsTaken: 0
  });
  const [recentActivity, setRecentActivity] = useState<any[]>([]);
  const [weakAreas, setWeakAreas] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // 1. Load Profile
    const profileRaw = localStorage.getItem('user_profile');
    if (profileRaw) setProfile(JSON.parse(profileRaw));

    // 2. Load and Compute Stats from History
    const historyRaw = localStorage.getItem('exam_history');
    const history = historyRaw ? JSON.parse(historyRaw) : [];

    if (history.length > 0) {
      const totalScore = history.reduce((acc: number, curr: any) => acc + (curr.score || 0), 0);
      const totalPossible = history.reduce((acc: number, curr: any) => acc + (curr.totalPossible || 0), 0);
      const avgAcc = history.reduce((acc: number, curr: any) => acc + (curr.accuracy || 0), 0) / history.length;
      
      // Mock Percentile Algorithm (Logarithmic scale based on accuracy)
      const estPercentile = Math.min(99.9, (Math.log10(avgAcc + 10) * 48)).toFixed(1);

      setStats({
        avgScore: Math.round(totalScore / history.length),
        accuracy: Math.round(avgAcc),
        percentile: parseFloat(estPercentile),
        testsTaken: history.length
      });

      // 3. Compute Weak Areas (Mock logic: finding chapters with low scores in metadata if available, else random from NCERT)
      // In a real app, we'd aggregate per-question metadata. Here we simulate using question types or subjects.
      // Let's use subjects/types that had wrong answers.
      const weaknesses = new Set<string>();
      history.slice(0, 5).forEach((h: any) => {
          if (h.accuracy < 60) weaknesses.add(`${h.type || 'General'} Concepts`);
      });
      if (weaknesses.size === 0) weaknesses.add("Advanced Mechanics"); 
      if (weaknesses.size < 3) weaknesses.add("Organic Reaction Mechanisms");
      
      setWeakAreas(Array.from(weaknesses).slice(0, 3));
      
      // 4. Set Recent Activity
      setRecentActivity(history.slice(0, 4)); // Top 4
    } else {
        // Defaults for new user
        setWeakAreas(['Kinematics', 'Chemical Bonding', 'Calculus Basics']);
    }

    setLoading(false);
  }, []);

  const getGreeting = () => {
      const hour = new Date().getHours();
      if (hour < 12) return "Good Morning";
      if (hour < 18) return "Good Afternoon";
      return "Good Evening";
  };

  return (
    <div className="space-y-12 pb-20">
      {/* Header */}
      <div className="relative flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
          <div className="flex items-center gap-3 mb-4">
             <span className="px-4 py-1.5 rounded-full bg-slate-900 text-white text-[10px] font-black uppercase tracking-widest flex items-center gap-2">
                <Crown className="w-3 h-3 text-yellow-400" />
                Premium Aspirant
             </span>
             <span className="px-4 py-1.5 rounded-full bg-green-100 text-green-700 text-[10px] font-black uppercase tracking-widest flex items-center gap-2">
                <Activity className="w-3 h-3" />
                Systems Online
             </span>
          </div>
          <h1 className="text-5xl md:text-7xl font-black text-slate-900 tracking-tighter leading-[0.9]">
            {getGreeting()}, <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-violet-600 via-fuchsia-600 to-pink-600 animate-gradient-x">
                {profile.full_name?.split(' ')[0] || 'Scholar'}
            </span>.
          </h1>
        </div>
        <div className="hidden md:block pb-2">
            <p className="text-slate-400 font-bold text-right text-lg">Current Streak</p>
            <div className="flex items-center gap-2 justify-end">
                <Flame className="w-8 h-8 text-orange-500 fill-orange-500 animate-bounce" />
                <span className="text-4xl font-black text-slate-900">12</span>
                <span className="text-xl font-bold text-slate-300">Days</span>
            </div>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        <StatCard 
            icon={<Target />} 
            label="Avg. Accuracy" 
            value={`${stats.accuracy}%`} 
            subValue={stats.testsTaken > 0 ? "Based on actual performance" : "Pending calibration"}
            gradient="bg-gradient-to-br from-violet-600 to-indigo-700"
            delay={0.1}
        />
        <StatCard 
            icon={<Award />} 
            label="Est. Percentile" 
            value={stats.percentile > 0 ? stats.percentile : '--'} 
            subValue="National Projection" 
            gradient="bg-gradient-to-br from-fuchsia-600 to-pink-600"
            delay={0.2} 
        />
        <StatCard 
            icon={<Zap />} 
            label="Total XP" 
            value={`${stats.testsTaken * 150}`} 
            subValue="Knowledge Points" 
            gradient="bg-gradient-to-br from-cyan-500 to-blue-600"
            delay={0.3} 
        />
      </div>

      {/* Main Actions - Bento Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* Large Action Card: Exam Simulator */}
        <motion.div 
          whileHover={{ y: -4, scale: 1.01 }}
          whileTap={{ scale: 0.98 }}
          className="lg:col-span-8 bg-slate-900 p-12 rounded-[3rem] text-white shadow-2xl relative overflow-hidden group cursor-pointer flex flex-col justify-between min-h-[400px]"
          onClick={() => navigate('/exam-setup')}
        >
          {/* Animated Background */}
          <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20"></div>
          <div className="absolute -right-20 -top-20 w-[500px] h-[500px] bg-indigo-500 rounded-full blur-[120px] opacity-30 group-hover:opacity-40 transition-opacity duration-700"></div>
          <div className="absolute -left-20 -bottom-20 w-[400px] h-[400px] bg-fuchsia-500 rounded-full blur-[100px] opacity-20 group-hover:opacity-30 transition-opacity duration-700"></div>
          
          <div className="relative z-10">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/10 border border-white/10 backdrop-blur-md mb-8">
                <Brain className="w-4 h-4 text-indigo-300" />
                <span className="text-xs font-black text-indigo-100 uppercase tracking-widest">Core Module</span>
            </div>
            <h2 className="text-5xl font-black tracking-tight mb-6 leading-tight">Full Syllabus <br /> Simulation</h2>
            <p className="text-indigo-200 max-w-lg text-xl font-medium leading-relaxed">
               Engage the Gemini AI engine to generate a unique, NTA-compliant examination paper tailored to your current mastery level.
            </p>
          </div>
          
          <div className="relative z-10 flex items-center gap-6 mt-12">
             <div className="h-16 w-16 rounded-full bg-white text-slate-900 flex items-center justify-center group-hover:scale-110 transition-transform shadow-lg shadow-white/20">
                <ChevronRight className="w-8 h-8" />
             </div>
             <span className="font-black text-lg tracking-wide group-hover:translate-x-2 transition-transform">Initialize Protocol</span>
          </div>
        </motion.div>

        {/* Vertical Stack */}
        <div className="lg:col-span-4 flex flex-col gap-8">
            {/* Practice Card */}
            <motion.div 
            whileHover={{ y: -4 }}
            whileTap={{ scale: 0.98 }}
            className="flex-1 bg-white p-10 rounded-[3rem] shadow-premium border border-slate-100 group cursor-pointer relative overflow-hidden"
            onClick={() => navigate('/practice')}
            >
                <div className="absolute top-0 right-0 p-8 opacity-5 group-hover:opacity-10 transition-opacity">
                    <Layers className="w-32 h-32" />
                </div>
                <div className="w-14 h-14 bg-orange-100 rounded-2xl flex items-center justify-center mb-6 text-orange-600 group-hover:scale-110 transition-transform duration-300">
                    <Flame className="w-7 h-7" />
                </div>
                <h2 className="text-3xl font-black text-slate-900 mb-2">Drill Mode</h2>
                <p className="text-slate-500 font-medium leading-relaxed">Target specific chapters for rapid-fire refinement.</p>
            </motion.div>

            {/* Daily Card */}
            <motion.div 
            whileHover={{ y: -4 }}
            whileTap={{ scale: 0.98 }}
            className="flex-1 bg-gradient-to-br from-emerald-50 to-teal-50 p-10 rounded-[3rem] border border-emerald-100 group cursor-pointer relative overflow-hidden"
            onClick={() => navigate('/daily')}
            >
                <div className="flex items-center justify-between mb-4">
                    <div className="w-14 h-14 bg-emerald-100 rounded-2xl flex items-center justify-center text-emerald-600">
                        <Activity className="w-7 h-7" />
                    </div>
                    <span className="px-3 py-1 bg-emerald-200 text-emerald-800 text-[10px] font-black uppercase tracking-widest rounded-full">Live</span>
                </div>
                <h2 className="text-3xl font-black text-emerald-900 mb-2">Daily Challenge</h2>
                <p className="text-emerald-700/80 font-medium">Compete globally.</p>
            </motion.div>
        </div>
      </div>

      {/* Analysis Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Weak Areas */}
        <div className="lg:col-span-1 bg-white p-10 rounded-[3rem] border border-slate-100 shadow-premium relative overflow-hidden">
             <div className="absolute top-0 right-0 w-32 h-32 bg-fuchsia-100 rounded-full blur-3xl opacity-50 -mr-10 -mt-10"></div>
             
             <h3 className="text-xl font-black text-slate-900 flex items-center gap-3 mb-8">
               <Brain className="w-6 h-6 text-fuchsia-500" />
               Focus Required
             </h3>
             
             <div className="space-y-4 relative z-10">
               {weakAreas.map((area, i) => (
                 <div key={i} className="flex items-center justify-between p-5 bg-slate-50 rounded-[1.5rem] border border-slate-100 hover:bg-white hover:shadow-lg hover:shadow-fuchsia-100/50 hover:border-fuchsia-100 transition-all cursor-pointer group">
                    <div className="flex items-center gap-4">
                        <span className="text-xs font-black text-slate-300">0{i+1}</span>
                        <p className="text-sm font-bold text-slate-700 group-hover:text-fuchsia-700 transition-colors line-clamp-1">{area}</p>
                    </div>
                    <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-fuchsia-500" />
                 </div>
               ))}
             </div>
             
             <button className="w-full mt-8 py-4 bg-slate-900 text-white rounded-2xl text-xs font-black uppercase tracking-widest hover:bg-slate-800 transition-all">
                Generate Remedial Plan
             </button>
        </div>

        {/* Live Feed */}
        <div className="lg:col-span-2 bg-white p-10 rounded-[3rem] border border-slate-100 shadow-premium">
            <div className="flex items-center justify-between mb-8">
                <h3 className="text-xl font-black text-slate-900 flex items-center gap-3">
                    <Activity className="w-6 h-6 text-blue-500" />
                    Activity Log
                </h3>
                <button 
                  onClick={() => navigate('/history')}
                  className="px-5 py-2 bg-slate-50 text-slate-600 rounded-xl text-xs font-black uppercase tracking-widest hover:bg-slate-100 transition-all"
                >
                  View All
                </button>
            </div>

            <div className="space-y-4">
              {recentActivity.length === 0 ? (
                  <div className="p-8 text-center bg-slate-50/50 rounded-[2rem] border border-dashed border-slate-200">
                      <p className="text-slate-400 font-medium text-sm">No recent activity detected. Start a simulation to populate data.</p>
                  </div>
              ) : (
                  recentActivity.map((item, idx) => (
                    <div key={idx} className="flex flex-col sm:flex-row sm:items-center justify-between p-6 bg-white rounded-[2rem] border border-slate-100 hover:border-blue-200 transition-all cursor-pointer group shadow-sm hover:shadow-xl hover:shadow-blue-100/50">
                      <div className="flex items-center gap-5 mb-4 sm:mb-0">
                         <div className={`w-12 h-12 rounded-2xl flex items-center justify-center text-white font-bold shadow-md ${
                            item.score > (item.totalPossible * 0.7) ? 'bg-emerald-500 shadow-emerald-200' : 'bg-indigo-500 shadow-indigo-200'
                         }`}>
                            {item.score > 0 ? Math.round((item.score/item.totalPossible)*10) : '-'}
                         </div>
                         <div>
                            <p className="font-bold text-slate-900 text-lg group-hover:text-blue-700 transition-colors">{item.type || 'Standard Drill'}</p>
                            <div className="flex items-center gap-3 mt-1">
                                <span className="text-xs text-slate-400 font-bold uppercase tracking-wide">
                                    {new Date(item.completedAt).toLocaleDateString('en-US', {month: 'short', day: 'numeric'})}
                                </span>
                                <span className="w-1 h-1 bg-slate-300 rounded-full" />
                                <span className="text-xs font-bold text-slate-500">{item.accuracy}% Acc</span>
                            </div>
                         </div>
                      </div>
                      
                      <div className="flex items-center gap-6 sm:pl-6 sm:border-l border-slate-100">
                        <div className="text-right">
                            <p className="text-2xl font-black text-slate-900">{item.score}</p>
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Score</p>
                        </div>
                        <div className="h-10 w-10 rounded-full bg-slate-50 flex items-center justify-center group-hover:bg-blue-600 group-hover:text-white transition-all">
                            <ChevronRight className="w-5 h-5" />
                        </div>
                      </div>
                    </div>
                  ))
              )}
            </div>
        </div>

      </div>
    </div>
  );
};

export default Dashboard;
