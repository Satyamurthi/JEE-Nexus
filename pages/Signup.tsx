
import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Brain, Mail, Lock, User, Loader2, AlertCircle, CheckCircle2, Sparkles, Database } from 'lucide-react';
import { supabase } from '../supabase';

const Signup = () => {
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    // 1. Offline Mode Signup
    if (!supabase) {
        await new Promise(r => setTimeout(r, 1000));
        
        try {
            const profiles = JSON.parse(localStorage.getItem('nexus_profiles') || '[]');
            
            // Check for duplicates
            if (profiles.find((p: any) => p.email.toLowerCase() === email.toLowerCase())) {
                throw new Error("This email is already registered (Local Directory).");
            }
            
            const newProfile = {
                id: `mock-${Date.now()}`,
                email,
                full_name: name,
                role: 'student',
                status: 'pending', // Pending approval from Admin
                created_at: new Date().toISOString()
            };
            
            profiles.push(newProfile);
            localStorage.setItem('nexus_profiles', JSON.stringify(profiles));
            
            setSuccess(true);
            setTimeout(() => navigate('/login'), 4000);
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
        return;
    }

    // 2. Supabase Cloud Signup
    try {
      const { data, error: signUpError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: name, // CRITICAL: This allows the SQL trigger to grab the name
          }
        }
      });

      if (signUpError) throw signUpError;
      
      // If auto-confirm is off, data.user might be null if email confirmation is required.
      // However, usually basic signup returns the user object.
      
      setSuccess(true);
      setTimeout(() => navigate('/login'), 4000);
    } catch (err: any) {
      setError(err.message || "An unexpected error occurred.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full bg-slate-50 flex items-center justify-center p-4 relative overflow-hidden">
        <div className="absolute -top-1/2 -left-1/4 w-[80vw] h-[80vw] bg-gradient-to-r from-purple-200 to-indigo-200 rounded-full opacity-30 blur-3xl animate-pulse"></div>
        <div className="absolute -bottom-1/2 -right-1/4 w-[70vw] h-[70vw] bg-gradient-to-r from-indigo-200 to-blue-200 rounded-full opacity-40 blur-3xl animate-pulse animation-delay-4000"></div>

      <div className="w-full max-w-md mx-auto z-10">
        {success ? (
          <div className="w-full max-w-md mx-auto text-center bg-white/80 backdrop-blur-xl p-12 rounded-[3rem] border border-white/50 shadow-2xl animate-in zoom-in-95 duration-500">
            <div className="inline-flex p-5 bg-green-100 text-green-600 rounded-full mb-8 ring-8 ring-green-50">
              <CheckCircle2 className="w-12 h-12" />
            </div>
            <h2 className="text-2xl font-black text-slate-900 mb-3">Enrollment Submitted</h2>
            <p className="text-slate-500 font-medium leading-relaxed">
               Your account has been created successfully. <br/><br/>
               <span className="font-bold text-slate-700">Status: Pending Approval</span>
               <br/>
               An administrator must verify your credentials before you can access the examination portal.
            </p>
          </div>
        ) : (
          <>
            <div className="text-center mb-10">
                <h1 className="text-3xl font-black text-slate-900 tracking-tight flex items-center justify-center gap-2">
                Aspirant Enrollment
                <Sparkles className="w-5 h-5 text-indigo-500" />
                </h1>
                <p className="text-sm font-bold text-slate-500 mt-2">Create your secure account to begin.</p>
            </div>

            <div className="bg-white/60 backdrop-blur-xl p-8 rounded-[2.5rem] border border-white/50 shadow-2xl shadow-slate-200/50">
                {!supabase && (
                  <div className="mb-6 p-4 bg-purple-50 border border-purple-100 rounded-2xl flex items-center gap-3">
                     <Database className="w-5 h-5 text-purple-600" />
                     <p className="text-xs font-bold text-purple-700">Offline Mode: Creating local account.</p>
                  </div>
                )}

                <form onSubmit={handleSignup} className="space-y-5">
                    <div className="space-y-2">
                        <label className="text-xs font-bold text-slate-600">Full Name</label>
                        <div className="relative">
                            <User className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                            <input
                            type="text"
                            required
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            className="w-full pl-12 pr-4 py-4 bg-white/50 border-2 border-slate-200 focus:border-indigo-300 focus:bg-white rounded-xl outline-none transition-all font-semibold text-slate-800 placeholder:text-slate-400"
                            placeholder="John Doe"
                            />
                        </div>
                    </div>
                    <div className="space-y-2">
                        <label className="text-xs font-bold text-slate-600">Identity Access</label>
                        <div className="relative">
                            <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                            <input
                            type="email"
                            required
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            className="w-full pl-12 pr-4 py-4 bg-white/50 border-2 border-slate-200 focus:border-indigo-300 focus:bg-white rounded-xl outline-none transition-all font-semibold text-slate-800 placeholder:text-slate-400"
                            placeholder="name@nexus.com"
                            />
                        </div>
                    </div>
                    <div className="space-y-2">
                        <label className="text-xs font-bold text-slate-600">Security Key</label>
                        <div className="relative">
                            <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                            <input
                            type="password"
                            required
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            className="w-full pl-12 pr-4 py-4 bg-white/50 border-2 border-slate-200 focus:border-indigo-300 focus:bg-white rounded-xl outline-none transition-all font-semibold text-slate-800 placeholder:text-slate-400"
                            placeholder="Minimum 6 characters"
                            />
                        </div>
                    </div>
                    
                    {error && (
                    <div className="p-3 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3 text-red-700 animate-in zoom-in duration-200">
                        <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
                        <p className="text-xs font-bold leading-relaxed">{error}</p>
                    </div>
                    )}

                    <button
                    type="submit"
                    disabled={loading}
                    className="w-full py-4 bg-gradient-to-r from-indigo-500 to-blue-500 text-white rounded-xl font-bold text-sm shadow-lg shadow-indigo-200 hover:shadow-xl hover:-translate-y-0.5 transition-all flex items-center justify-center gap-3 active:scale-95 disabled:opacity-50"
                    >
                    {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : "Request Access"}
                    </button>
                </form>
            </div>
            <p className="text-sm text-slate-600 mt-8 text-center">
                Already enrolled?{' '}
                <Link to="/login" className="text-indigo-600 font-bold hover:underline">Access Portal</Link>
            </p>
          </>
        )}
      </div>
    </div>
  );
};

export default Signup;
