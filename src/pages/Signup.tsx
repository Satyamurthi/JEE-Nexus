import React, { useState, FormEvent } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Brain, Sparkles, User, Mail, Lock, ChevronRight, AlertCircle, CheckCircle2 } from 'lucide-react';
import { supabase, isSupabaseConfigured } from '../supabase';
import { APP_NAME } from '../constants';

const Signup = () => {
  const navigate = useNavigate();
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  const handleSignup = async (e: FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      setIsLoading(false);
      return;
    }

    // Simulate a small delay
    await new Promise(resolve => setTimeout(resolve, 1000));

    try {
      // Generate a proper UUID for Supabase compatibility
      const uuid = crypto.randomUUID ? crypto.randomUUID() : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
      });

      const newUser = {
        id: uuid,
        email: email.toLowerCase(),
        full_name: fullName,
        password: password, // Store password for custom enrollment flow
        role: 'student',
        status: 'pending', // Set to pending for admin approval
        created_at: new Date().toISOString()
      };

      // 1. Try to save to Supabase if configured
      if (supabase) {
        const { error: dbError } = await supabase
          .from('profiles')
          .insert(newUser);
        
        if (dbError) {
          console.error("Supabase signup failed:", dbError);
          setError(`Enrollment failed: ${dbError.message}. Please ensure the Database Repair Script has been run in Supabase.`);
          setIsLoading(false);
          return;
        }
      }

      // 2. Always save to local storage as fallback/primary for demo
      const profiles = JSON.parse(localStorage.getItem('nexus_profiles') || '[]');
      
      // Check if user already exists
      if (profiles.some((p: any) => p.email.toLowerCase() === email.toLowerCase())) {
        setError("An account with this email already exists.");
        setIsLoading(false);
        return;
      }

      profiles.push(newUser);
      localStorage.setItem('nexus_profiles', JSON.stringify(profiles));

      setIsSuccess(true);
      setTimeout(() => {
        navigate('/login');
      }, 2000);
    } catch (err) {
      console.error("Signup error:", err);
      setError("An unexpected error occurred during enrollment.");
    } finally {
      setIsLoading(false);
    }
  };

  if (isSuccess) {
    return (
      <div className="min-h-screen bg-[#f8faff] flex flex-col items-center justify-center p-6">
        <div className="bg-white p-12 rounded-[3rem] shadow-2xl shadow-indigo-100 flex flex-col items-center text-center space-y-6 animate-in zoom-in duration-500">
          <div className="bg-emerald-100 p-6 rounded-full">
            <CheckCircle2 className="w-16 h-16 text-emerald-600" />
          </div>
          <h1 className="text-3xl font-black text-slate-900 tracking-tight">Enrollment Initialized</h1>
          <p className="text-slate-500 font-medium max-w-xs">
            Your strategic profile has been created and is awaiting administrator approval. Redirecting to login portal...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f8faff] flex flex-col items-center justify-center p-6 relative overflow-hidden">
      {/* Background Blobs */}
      <div className="absolute top-0 right-1/4 w-[500px] h-[500px] bg-indigo-100/50 rounded-full mix-blend-multiply filter blur-[100px] opacity-70 animate-blob"></div>
      <div className="absolute bottom-0 left-1/4 w-[500px] h-[500px] bg-purple-100/50 rounded-full mix-blend-multiply filter blur-[100px] opacity-70 animate-blob animation-delay-2000"></div>

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
          <p className="text-slate-500 font-bold text-sm uppercase tracking-[0.2em]">Strategic Enrollment</p>
        </div>

        {/* Signup Card */}
        <div className="w-full bg-white rounded-[3rem] shadow-[0_32px_64px_-16px_rgba(79,70,229,0.1)] p-10 border border-indigo-50/50 backdrop-blur-sm">
          <form onSubmit={handleSignup} className="space-y-5">
            <div className="space-y-2">
              <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest ml-1">Full Name</label>
              <div className="relative group">
                <User className="absolute left-5 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-300 group-focus-within:text-indigo-500 transition-colors" />
                <input 
                  type="text" 
                  placeholder="Aspirant Name" 
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="w-full pl-14 pr-6 py-4 bg-slate-50/50 border border-slate-100 focus:bg-white focus:ring-4 focus:ring-indigo-500/5 focus:border-indigo-500/30 rounded-[1.5rem] text-sm font-bold outline-none transition-all placeholder:text-slate-300"
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest ml-1">Email Address</label>
              <div className="relative group">
                <Mail className="absolute left-5 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-300 group-focus-within:text-indigo-500 transition-colors" />
                <input 
                  type="email" 
                  placeholder="email@example.com" 
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full pl-14 pr-6 py-4 bg-slate-50/50 border border-slate-100 focus:bg-white focus:ring-4 focus:ring-indigo-500/5 focus:border-indigo-500/30 rounded-[1.5rem] text-sm font-bold outline-none transition-all placeholder:text-slate-300"
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
                  className="w-full pl-14 pr-6 py-4 bg-slate-50/50 border border-slate-100 focus:bg-white focus:ring-4 focus:ring-indigo-500/5 focus:border-indigo-500/30 rounded-[1.5rem] text-sm font-bold outline-none transition-all placeholder:text-slate-300"
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest ml-1">Confirm Key</label>
              <div className="relative group">
                <Lock className="absolute left-5 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-300 group-focus-within:text-indigo-500 transition-colors" />
                <input 
                  type="password" 
                  placeholder="••••••••" 
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full pl-14 pr-6 py-4 bg-slate-50/50 border border-slate-100 focus:bg-white focus:ring-4 focus:ring-indigo-500/5 focus:border-indigo-500/30 rounded-[1.5rem] text-sm font-bold outline-none transition-all placeholder:text-slate-300"
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
                  Initialize Enrollment
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
          Already Enrolled? <Link to="/login" className="text-indigo-600 hover:underline">Authorize Access</Link>
        </p>
      </div>
    </div>
  );
};

export default Signup;
