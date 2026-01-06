
import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Brain, Mail, Lock, Loader2, ChevronRight, ShieldCheck, ShieldAlert, Sparkles, Database } from 'lucide-react';
import { supabase, getProfile } from '../supabase';

// Hardcoded batch of allowed students for offline demo resilience
const PRE_APPROVED_BATCH = [
    'SAMARTH@ABC.COM', 'SAMVITH@ABC.COM', 'PARTHA@ABC.COM', 
    'TEJAS@ABC.COM', 'KUSHAL@ABC.COM', 'APEKSHA@ABC.COM', 
    'YUKTHI@ABC.COM', 'NANDITHA@ABC.COM', 'CHANDU@ABC.COM',
    'NAME@ADMIN.COM' // Added offline support for admin
];

const Login = () => {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const lowerEmail = email.toLowerCase();
    let cloudAuthAttempted = false;

    // 1. Try Supabase Login FIRST (if available)
    if (supabase) {
      cloudAuthAttempted = true;
      try {
        const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
          email: email, // Supabase usually handles case, but best to be safe
          password,
        });

        if (!authError && authData.user) {
            // Successful Cloud Login
            const profile = await getProfile(authData.user.id);
            
            if (!profile) {
                await supabase.auth.signOut();
                throw new Error("Profile not found. Please contact support.");
            }

            if (profile.status !== 'approved') {
                await supabase.auth.signOut();
                setError(`Access Denied: Your account is currently '${profile.status}'. Please wait for an administrator to approve your request.`);
                setLoading(false);
                return;
            }

            localStorage.setItem('user_profile', JSON.stringify(profile));
            navigate('/');
            return;
        }
        
        // Log failure but allow fallback
        if (authError) {
            console.warn("Supabase Login Failed (Attempting Fallback):", authError.message);
        }

      } catch (err: any) {
          console.warn("Supabase Exception (Attempting Fallback):", err.message);
      }
    }

    // 2. Root Admin Bypass (Fallback if Supabase login failed or offline)
    // Only works for specific emails - Case Insensitive Check
    const isHardcodedAdmin = (lowerEmail === 'example@gmail.com' || lowerEmail === 'name@example.com' || lowerEmail === 'name@admin.com') && password === 'admin123';
    
    if (isHardcodedAdmin) {
      const adminProfile = {
        id: `admin-root-${lowerEmail.split('@')[0]}`,
        email: email, // Keep original case for display
        full_name: 'System Admin (Local)',
        role: 'admin',
        status: 'approved',
        created_at: new Date().toISOString()
      };
      localStorage.setItem('user_profile', JSON.stringify(adminProfile));
      
      if (supabase) {
          console.warn("Logged in via Admin Bypass (Cloud Login Failed).");
      }

      setTimeout(() => {
        setLoading(false);
        navigate('/');
      }, 800);
      return;
    }

    // 3. Local/Demo Mode Login (Fallback)
    // Runs if Cloud failed or isn't configured
    
    // Simulate network delay if we didn't try cloud (offline mode feel)
    if (!cloudAuthAttempted) await new Promise(r => setTimeout(r, 800));
      
    try {
      const profiles = JSON.parse(localStorage.getItem('nexus_profiles') || '[]');
      let user = profiles.find((p: any) => p.email.toLowerCase() === lowerEmail);

      // AUTO-PROVISION FALLBACK for Demo Batch
      if (!user && PRE_APPROVED_BATCH.includes(email.toUpperCase())) {
          const name = email.split('@')[0];
          user = {
              id: `auto-${Date.now()}`,
              email: email.toUpperCase(),
              full_name: name.charAt(0).toUpperCase() + name.slice(1).toLowerCase(),
              role: 'student',
              status: 'approved',
              created_at: new Date().toISOString()
          };
          profiles.push(user);
          localStorage.setItem('nexus_profiles', JSON.stringify(profiles));
      }

      if (user) {
          if (user.status !== 'approved') {
            throw new Error(`Your account status is '${user.status}'. Please wait for admin approval.`);
          }

          // In Local/Demo mode, we trust the email existence as "auth" for simplicity, 
          // or we could check a mock password. Assuming Open Access for Demo Batch.
          localStorage.setItem('user_profile', JSON.stringify(user));
          navigate('/');
          return;
      }
    } catch (err: any) {
      setError(err.message);
      setLoading(false);
      return;
    }
    
    // 4. Final Failure (Neither Cloud nor Local User found)
    if (lowerEmail.includes('admin') || lowerEmail.includes('example')) {
        setError("Admin Login Failed: Cloud rejected credentials and Local Bypass failed (Password must be 'admin123').");
    } else {
        setError("Invalid login credentials. User not found in Cloud or Local directory.");
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen w-full bg-slate-50 flex items-center justify-center p-4 relative overflow-hidden">
       <div className="absolute -top-1/2 -left-1/4 w-[80vw] h-[80vw] bg-gradient-to-r from-indigo-200 to-blue-200 rounded-full opacity-40 blur-3xl animate-pulse"></div>
       <div className="absolute -bottom-1/2 -right-1/4 w-[70vw] h-[70vw] bg-gradient-to-r from-purple-200 to-indigo-200 rounded-full opacity-30 blur-3xl animate-pulse animation-delay-4000"></div>

      <div className="w-full max-w-md mx-auto z-10">
        <div className="text-center mb-10">
            <div className="inline-block p-4 bg-white/80 backdrop-blur-md rounded-3xl border border-white/50 shadow-lg mb-4">
                <div className="p-3 bg-gradient-to-br from-indigo-500 to-blue-500 text-white rounded-2xl shadow-lg">
                    <Brain className="w-8 h-8" />
                </div>
            </div>
            <h1 className="text-3xl font-black text-slate-900 tracking-tight flex items-center justify-center gap-2">
                JEE Nexus AI
                <Sparkles className="w-5 h-5 text-indigo-500" />
            </h1>
            <p className="text-sm font-bold text-slate-500 mt-2">Strategic Portal Access</p>
        </div>
        
        <div className="bg-white/60 backdrop-blur-xl p-8 rounded-[2.5rem] border border-white/50 shadow-2xl shadow-slate-200/50">
            {!supabase && (
              <div className="mb-6 p-4 bg-blue-50 border border-blue-100 rounded-2xl flex items-center gap-3">
                 <Database className="w-5 h-5 text-blue-600" />
                 <p className="text-xs font-bold text-blue-700">Offline Mode: Using local storage for authentication.</p>
              </div>
            )}

            <form onSubmit={handleLogin} className="space-y-6">
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
                            placeholder="••••••••"
                        />
                    </div>
                </div>

                <button
                    type="submit"
                    disabled={loading}
                    className="w-full py-4 bg-gradient-to-r from-indigo-500 to-blue-500 text-white rounded-xl font-bold text-sm shadow-lg shadow-indigo-200 hover:shadow-xl hover:-translate-y-0.5 transition-all flex items-center justify-center gap-3 active:scale-95 disabled:opacity-50"
                >
                    {loading ? (
                        <Loader2 className="w-5 h-5 animate-spin" />
                    ) : (
                        <>
                            Authorize Access
                            <ChevronRight className="w-4 h-4" />
                        </>
                    )}
                </button>
            </form>
            
            {error && (
                <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3 text-red-700 animate-in zoom-in duration-200">
                    <ShieldAlert className="w-5 h-5 shrink-0 mt-0.5" />
                    <p className="text-xs font-bold leading-relaxed">{error}</p>
                </div>
            )}
        </div>
        
        <p className="text-sm text-center text-slate-600 mt-8">
            New Aspirant?{' '}
            <Link to="/signup" className="text-indigo-600 font-bold hover:underline">Enroll Now</Link>
        </p>

      </div>
    </div>
  );
};

export default Login;
