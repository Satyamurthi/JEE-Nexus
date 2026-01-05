
import React, { useState, useEffect } from 'react';
import { HashRouter, Routes, Route, useNavigate, useLocation, Navigate } from 'react-router-dom';
import { Layout, LogOut, User, Bell, Search, Menu, X, Brain, ShieldCheck, ChevronLeft, Sparkles, LayoutGrid } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import Dashboard from './pages/Dashboard';
import ExamSetup from './pages/ExamSetup';
import ExamPortal from './pages/ExamPortal';
import Analytics from './pages/Analytics';
import History from './pages/History';
import Admin from './pages/Admin';
import Practice from './pages/Practice';
import Daily from './pages/Daily';
import Login from './pages/Login';
import Signup from './pages/Signup';
import { MENU_ITEMS, APP_NAME } from './constants';
import { supabase } from './supabase';

const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const profileRaw = localStorage.getItem('user_profile');
  if (!profileRaw) return <Navigate to="/login" replace />;
  const profile = JSON.parse(profileRaw);
  if (profile.status !== 'approved') return <Navigate to="/login" replace />;
  return <>{children}</>;
};

const AdminRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const profileRaw = localStorage.getItem('user_profile');
  if (!profileRaw) return <Navigate to="/login" replace />;
  const profile = JSON.parse(profileRaw);
  if (profile.role !== 'admin') return <Navigate to="/" replace />;
  return <>{children}</>;
};

const Sidebar = ({ isOpen, toggle }: { isOpen: boolean, toggle: () => void }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const profile = JSON.parse(localStorage.getItem('user_profile') || '{}');

  const handleLogout = async () => {
    if (supabase) await supabase.auth.signOut();
    localStorage.removeItem('user_profile');
    navigate('/login');
  };

  return (
    <>
      <AnimatePresence>
        {isOpen && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 lg:hidden"
            onClick={toggle}
          />
        )}
      </AnimatePresence>
      
      <motion.div 
        className={`fixed inset-y-0 left-0 z-50 w-[280px] bg-slate-900/95 backdrop-blur-2xl border-r border-white/10 shadow-2xl transform ${isOpen ? 'translate-x-0' : '-translate-x-full'} lg:translate-x-0 transition-transform duration-500 ease-[cubic-bezier(0.23,1,0.32,1)] flex flex-col`}
      >
        <div className="p-8 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 p-2.5 rounded-xl shadow-lg shadow-indigo-500/20">
              <Brain className="w-6 h-6 text-white" />
            </div>
            <span className="text-xl font-black text-white tracking-tight">{APP_NAME}</span>
          </div>
          <button onClick={toggle} className="lg:hidden p-2 text-slate-400 hover:text-white rounded-full">
            <ChevronLeft className="w-6 h-6" />
          </button>
        </div>

        <nav className="flex-1 px-4 space-y-2 overflow-y-auto custom-scrollbar">
          {MENU_ITEMS.map((item) => {
            if (item.id === 'admin' && profile.role !== 'admin') return null;
            const isActive = location.pathname === item.path;
            return (
              <motion.button
                key={item.id}
                onClick={() => {
                  navigate(item.path);
                  if (window.innerWidth < 1024) toggle();
                }}
                className={`flex items-center w-full px-5 py-4 text-sm font-bold rounded-2xl transition-all group relative overflow-hidden ${
                  isActive
                    ? 'text-white'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                {isActive && (
                  <motion.div 
                    layoutId="nav-pill" 
                    className="absolute inset-0 bg-gradient-to-r from-indigo-600 to-violet-600 rounded-2xl shadow-lg shadow-indigo-900/50"
                    transition={{ type: "spring", stiffness: 300, damping: 30 }}
                  />
                )}
                {/* Hover effect for non-active */}
                {!isActive && (
                  <div className="absolute inset-0 bg-white/5 opacity-0 group-hover:opacity-100 transition-opacity rounded-2xl" />
                )}
                
                <span className={`relative z-10 mr-4 transition-transform group-hover:scale-110 ${isActive ? 'text-indigo-200' : 'text-slate-500 group-hover:text-indigo-400'}`}>
                  {item.icon}
                </span>
                <span className="relative z-10 tracking-wide">{item.label}</span>
              </motion.button>
            );
          })}
        </nav>

        <div className="p-6">
          <div className="bg-white/5 rounded-[1.5rem] p-5 border border-white/10 backdrop-blur-md">
            <div className="flex items-center gap-4 mb-5">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-emerald-400 to-cyan-400 flex items-center justify-center text-slate-900 font-black shadow-lg shadow-emerald-900/20">
                 {(profile.full_name || 'U').substring(0, 1).toUpperCase()}
              </div>
              <div className="flex-1 overflow-hidden">
                <p className="text-xs font-black text-white truncate tracking-tight">{profile.full_name}</p>
                <p className="text-[9px] text-slate-400 font-bold uppercase tracking-widest">{profile.role}</p>
              </div>
            </div>
            <button 
              onClick={handleLogout}
              className="flex items-center justify-center w-full px-4 py-3 text-[10px] font-black text-red-300 bg-red-500/10 border border-red-500/20 rounded-xl hover:bg-red-500 hover:text-white transition-all shadow-sm group"
            >
              <LogOut className="w-3.5 h-3.5 mr-2 group-hover:animate-pulse" />
              Sign Out
            </button>
          </div>
        </div>
      </motion.div>
    </>
  );
};

const Header = ({ toggleSidebar }: { toggleSidebar: () => void }) => {
  const profile = JSON.parse(localStorage.getItem('user_profile') || '{}');
  return (
    <header className="sticky top-0 z-30 lg:ml-[280px] transition-all pt-4 px-6 sm:px-10 pb-2">
      <div className="glass-panel rounded-[2rem] px-6 h-20 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-6 flex-1">
          <button onClick={toggleSidebar} className="lg:hidden p-2.5 bg-slate-100 text-slate-600 hover:bg-slate-200 rounded-xl">
            <Menu className="w-6 h-6" />
          </button>
          
          <div className="hidden lg:flex items-center w-[400px]">
            <div className="relative w-full group">
              <Search className="absolute left-5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-indigo-500 transition-colors" />
              <input
                type="text"
                placeholder="Search topics, drills, resources..."
                className="w-full pl-12 pr-6 py-3 bg-slate-50/50 border border-slate-200 focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500/50 rounded-2xl text-sm font-semibold outline-none transition-all"
              />
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 sm:gap-6">
          <div className="flex items-center gap-2 bg-gradient-to-r from-violet-600/10 to-indigo-600/10 px-3 py-1.5 rounded-full border border-indigo-200 hidden sm:flex">
             <Sparkles className="w-3.5 h-3.5 text-indigo-600 fill-indigo-600 animate-pulse" />
             <span className="text-[10px] font-black text-indigo-700 uppercase tracking-widest">Premium</span>
          </div>
          <button className="p-3 text-slate-400 hover:bg-slate-100 hover:text-slate-900 rounded-2xl relative transition-all">
            <Bell className="w-5 h-5" />
            <span className="absolute top-3 right-3 w-2 h-2 bg-red-500 rounded-full border-2 border-white ring-2 ring-red-100"></span>
          </button>
          <div className="w-[1px] h-8 bg-slate-200 hidden sm:block" />
          <div className="flex items-center gap-4 pl-2">
            <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-violet-500 to-fuchsia-500 flex items-center justify-center text-white font-black shadow-lg shadow-violet-500/30 ring-2 ring-white">
              {(profile.full_name || 'U').substring(0, 1).toUpperCase()}
            </div>
          </div>
        </div>
      </div>
    </header>
  );
};

const BackgroundBlobs = () => (
  <div className="fixed inset-0 overflow-hidden pointer-events-none -z-10">
    <div className="absolute top-0 left-1/4 w-[500px] h-[500px] bg-purple-300 rounded-full mix-blend-multiply filter blur-[128px] opacity-40 animate-blob"></div>
    <div className="absolute top-0 right-1/4 w-[500px] h-[500px] bg-cyan-300 rounded-full mix-blend-multiply filter blur-[128px] opacity-40 animate-blob animation-delay-2000"></div>
    <div className="absolute -bottom-32 left-1/3 w-[500px] h-[500px] bg-pink-300 rounded-full mix-blend-multiply filter blur-[128px] opacity-40 animate-blob animation-delay-4000"></div>
  </div>
);

const AppContent = () => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const location = useLocation();
  const isAuth = location.pathname.startsWith('/login') || location.pathname.startsWith('/signup');
  const isExamPortal = location.pathname.startsWith('/exam-portal');

  useEffect(() => {
    setSidebarOpen(false);
  }, [location.pathname]);

  return (
    <AnimatePresence mode="wait" initial={false}>
      {isAuth ? (
        <Routes key="auth">
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<Signup />} />
        </Routes>
      ) : isExamPortal ? (
        <ProtectedRoute key="exam">
          <Routes>
            <Route path="/exam-portal" element={<ExamPortal />} />
          </Routes>
        </ProtectedRoute>
      ) : (
        <ProtectedRoute key="main">
          <div className="min-h-screen relative flex">
            <BackgroundBlobs />
            <Sidebar isOpen={sidebarOpen} toggle={() => setSidebarOpen(false)} />
            <div className="flex-1 flex flex-col min-w-0">
              <Header toggleSidebar={() => setSidebarOpen(true)} />
              <main className="flex-1 lg:ml-[280px] p-6 sm:p-10 transition-all">
                <motion.div
                  key={location.pathname}
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -15 }}
                  transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
                >
                  <Routes location={location}>
                    <Route path="/" element={<Dashboard />} />
                    <Route path="/daily" element={<Daily />} />
                    <Route path="/exam-setup" element={<ExamSetup />} />
                    <Route path="/practice" element={<Practice />} />
                    <Route path="/analytics" element={<Analytics />} />
                    <Route path="/history" element={<History />} />
                    <Route path="/admin" element={<AdminRoute><Admin /></AdminRoute>} />
                    <Route path="*" element={<Navigate to="/" replace />} />
                  </Routes>
                </motion.div>
              </main>
            </div>
          </div>
        </ProtectedRoute>
      )}
    </AnimatePresence>
  );
};

const App = () => {
  return (
    <HashRouter>
      <AppContent />
    </HashRouter>
  );
};

export default App;
