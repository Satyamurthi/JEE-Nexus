import React, { useState, FormEvent } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Brain, Sparkles, Database, Mail, Lock, ChevronRight, AlertCircle } from 'lucide-react';
import { supabase, isSupabaseConfigured } from '../supabase';
import { APP_NAME } from '../constants';

const Login = () => {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const isOffline = !isSupabaseConfigured();

  const handleLogin = async (e: FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    // Simulate a small delay for "Strategic Portal Access" feel
    await new Promise(resolve => setTimeout(resolve, 800));

    try {
      let user = null;

      // 1. Try to fetch from Supabase backend if configured
      if (supabase) {
        const { data: dbUser } = await supabase
          .from('profiles')
          .select('*')
          .or(`email.eq."${email}",full_name.eq."${email}"`)
          .maybeSingle();
        
        if (dbUser) {
          user = dbUser;
        }
      }

      // 2. Fallback to local storage if not found in backend
      if (!user) {
        const profiles = JSON.parse(localStorage.getItem('nexus_profiles') || '[]');
        user = profiles.find((p: any) => 
          p.email.toLowerCase() === email.toLowerCase() || 
          (p.full_name && p.full_name.toLowerCase() === email.toLowerCase())
        );
      }

      if (!user) {
        setError("User not found in directory. Please sign up first.");
        setIsLoading(false);
        return;
      }

      // In this version, we'll allow access if the user exists in either directory.
      // For a real production app, we would use supabase.auth.signInWithPassword here.
      localStorage.setItem('user_profile', JSON.stringify(user));
      navigate('/');
    } catch (err) {
      console.error("Login error:", err);
      setError("An unexpected error occurred during authorization.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#f8faff] flex flex-col items-center justify-center p-6 relative overflow-hidden">
      {/* Background Blobs */}
      <div className="absolute top-0 left-1/4 w-[500px] h-[500px] bg-indigo-100/50 rounded-full mix-blend-multiply filter blur-[100px] opacity-70 animate-blob"></div>
      <div className="absolute bottom-0 right-1/4 w-[500px] h-[500px] bg-purple-100/50 rounded-full mix-blend-multiply filter blur-[100px] opacity-70 animate-blob animation-delay-2000"></div>

      <div className="relative z-10 w-full max-w-[480px] flex flex-col items-center">
        {/* Logo Section */}
        <div className="mb-8 flex flex-col items-center">
          <div className="bg-white p-4 rounded-[2rem] shadow-2xl shadow-indigo-100 mb-6 group transition-transform hover:scale-105 duration-500">
            <div className="bg-gradient-to-br from-indigo-500 to-blue-600 p-4 rounded-[1.5rem] shadow-inner">
              <Brain className="w-10 h-10 text-white" />
            </div>
          </div>
          <div className="flex items-center gap-2 mb-1">
            <h1 className="text-4xl font-black text-slate-900 tracking-tight">{APP_NAME}</h1>
            <Sparkles className="w-6 h-6 text-indigo-500 animate-pulse" />
          </div>
          <p className="text-slate-500 font-bold text-sm uppercase tracking-[0.2em]">Strategic Portal Access</p>
        </div>

        {/* Login Card */}
        <div className="w-full bg-white rounded-[3rem] shadow-[0_32px_64px_-16px_rgba(79,70,229,0.1)] p-10 border border-indigo-50/50 backdrop-blur-sm">
          {/* Offline Mode Alert */}
          {isOffline && (
            <div className="mb-8 flex items-center gap-3 bg-indigo-50/50 border border-indigo-100/50 p-4 rounded-2xl">
              <Database className="w-5 h-5 text-indigo-600" />
              <span className="text-[11px] font-bold text-indigo-700 tracking-tight">
                Offline Mode: Using local storage for authentication.
              </span>
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-6">
            <div className="space-y-2">
              <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest ml-1">Identity Access</label>
              <div className="relative group">
                <Mail className="absolute left-5 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-300 group-focus-within:text-indigo-500 transition-colors" />
                <input 
                  type="text" 
                  placeholder="User Name" 
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full pl-14 pr-6 py-5 bg-slate-50/50 border border-slate-100 focus:bg-white focus:ring-4 focus:ring-indigo-500/5 focus:border-indigo-500/30 rounded-[1.5rem] text-sm font-bold outline-none transition-all placeholder:text-slate-300"
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest ml-1">Security Key</label>
              <div className="relative group">
                <Lock className="absolute left-5 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-300 group-focus-within:text-indigo-500 transition-colors" />
                <input 
                  type="password" 
                  placeholder="••••••••" 
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-14 pr-6 py-5 bg-slate-50/50 border border-slate-100 focus:bg-white focus:ring-4 focus:ring-indigo-500/5 focus:border-indigo-500/30 rounded-[1.5rem] text-sm font-bold outline-none transition-all placeholder:text-slate-300"
                  required
                />
              </div>
            </div>

            <button 
              type="submit" 
              disabled={isLoading}
              className="w-full py-5 bg-gradient-to-r from-indigo-600 to-blue-600 text-white rounded-[1.5rem] font-black text-sm shadow-xl shadow-indigo-200 hover:shadow-2xl hover:shadow-indigo-300 hover:-translate-y-0.5 active:translate-y-0 transition-all flex items-center justify-center gap-2 group disabled:opacity-70 disabled:cursor-not-allowed"
            >
              {isLoading ? (
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  Authorize Access
                  <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                </>
              )}
            </button>
          </form>

          {/* Error Message */}
          {error && (
            <div className="mt-6 flex items-center gap-3 bg-red-50 border border-red-100 p-4 rounded-2xl animate-in fade-in slide-in-from-top-2">
              <AlertCircle className="w-5 h-5 text-red-500 shrink-0" />
              <span className="text-[11px] font-bold text-red-600 tracking-tight leading-relaxed">
                {error}
              </span>
            </div>
          )}
        </div>

        {/* Footer */}
        <p className="mt-10 text-slate-400 font-bold text-xs tracking-tight">
          New Aspirant? <Link to="/signup" className="text-indigo-600 hover:underline">Enroll Now</Link>
        </p>
      </div>
    </div>
  );
};

export default Login;
