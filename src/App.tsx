import React, { useState, useEffect } from 'react';
import type { ReactNode, FC } from 'react';
import { Routes, Route, useNavigate, useLocation, Navigate } from 'react-router-dom';
import { LogOut, Bell, Search, Menu, Brain, ChevronLeft, Sparkles, Download, WifiOff, RefreshCw, AlertTriangle, CloudRain } from 'lucide-react';
import { MENU_ITEMS, APP_NAME } from './constants';
import { supabase } from './supabase';

// Direct imports for all pages to ensure stability and avoid context issues
import Dashboard from './pages/Dashboard';
import Login from './pages/Login';
import Signup from './pages/Signup';
import ExamSetup from './pages/ExamSetup';
import ExamPortal from './pages/ExamPortal';
import Analytics from './pages/Analytics';
import History from './pages/History';
import Admin from './pages/Admin';
import Practice from './pages/Practice';
import Daily from './pages/Daily';

interface ErrorBoundaryProps {
  children?: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  errorType?: 'network' | 'logic';
}

const ProtectedRoute: FC<{ children: ReactNode }> = ({ children }) => {
  const profileRaw = localStorage.getItem('user_profile');
  if (!profileRaw) return <Navigate to="/login" replace />;
  const profile = JSON.parse(profileRaw);
  if (profile.status !== 'approved') return <Navigate to="/login" replace />;
  return <>{children}</>;
};

const AdminRoute: FC<{ children: ReactNode }> = ({ children }) => {
  const profileRaw = localStorage.getItem('user_profile');
  if (!profileRaw) return <Navigate to="/login" replace />;
  const profile = JSON.parse(profileRaw);
  if (profile.role !== 'admin') return <Navigate to="/" replace />;
  return <>{children}</>;
};

const Sidebar = ({ isOpen, toggle, installPrompt, onInstall }: { isOpen: boolean, toggle: () => void, installPrompt: any, onInstall: () => void }) => {
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
      {isOpen && (
        <div 
          className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-40 lg:hidden"
          onClick={toggle}
        />
      )}
      
      <div 
        className={`fixed inset-y-0 left-0 z-50 w-[280px] bg-slate-900/95 backdrop-blur-2xl border-r border-white/5 shadow-2xl transform ${isOpen ? 'translate-x-0' : '-translate-x-full'} lg:translate-x-0 transition-transform duration-500 ease-[cubic-bezier(0.23,1,0.32,1)] flex flex-col`}
      >
        <div className="p-8 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 p-2.5 rounded-xl shadow-lg shadow-indigo-500/20">
              <Brain className="w-6 h-6 text-white" />
            </div>
            <span className="text-xl font-black text-white tracking-tight">{APP_NAME}</span>
          </div>
          <button onClick={toggle} className="lg:hidden p-2 text-slate-400 hover:text-white rounded-full transition-colors">
            <ChevronLeft className="w-6 h-6" />
          </button>
        </div>

        <nav className="flex-1 px-4 space-y-1.5 overflow-y-auto custom-scrollbar pt-4">
          {MENU_ITEMS.map((item) => {
            if (item.id === 'admin' && profile.role !== 'admin') return null;
            const isActive = location.pathname === item.path;
            return (
              <button
                key={item.id}
                onClick={() => {
                  navigate(item.path);
                  if (window.innerWidth < 1024) toggle();
                }}
                className={`flex items-center w-full px-5 py-3.5 text-sm font-bold rounded-2xl transition-all group relative overflow-hidden ${
                  isActive
                    ? 'text-white shadow-lg shadow-indigo-900/50 bg-gradient-to-r from-indigo-600 to-violet-600'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                {!isActive && (
                  <div className="absolute inset-0 bg-white/5 opacity-0 group-hover:opacity-100 transition-opacity rounded-2xl" />
                )}
                
                <span className={`relative z-10 mr-4 transition-transform group-hover:scale-110 ${isActive ? 'text-indigo-200' : 'text-slate-500 group-hover:text-indigo-400'}`}>
                  {item.icon}
                </span>
                <span className="relative z-10 tracking-wide font-extrabold uppercase text-[11px]">{item.label}</span>
              </button>
            );
          })}
        </nav>

        <div className="p-6 space-y-4 bg-slate-900/50 border-t border-white/5">
          {installPrompt && (
            <button
              onClick={onInstall}
              className="flex items-center justify-center w-full px-4 py-3 text-[10px] font-black text-indigo-100 bg-indigo-600/20 border border-indigo-500/30 rounded-xl hover:bg-indigo-600 hover:text-white transition-all shadow-sm group animate-in fade-in"
            >
              <Download className="w-3.5 h-3.5 mr-2" />
              Install App
            </button>
          )}

          <div className="bg-white/5 rounded-[1.5rem] p-4 border border-white/5 backdrop-blur-md">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-indigo-400 to-cyan-400 flex items-center justify-center text-slate-900 font-black shadow-lg shadow-emerald-900/20">
                 {(profile.full_name || 'U').substring(0, 1).toUpperCase()}
              </div>
              <div className="flex-1 overflow-hidden">
                <p className="text-[11px] font-black text-white truncate tracking-tight">{profile.full_name}</p>
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
      </div>
    </>
  );
};

const Header = ({ toggleSidebar }: { toggleSidebar: () => void }) => {
  const profile = JSON.parse(localStorage.getItem('user_profile') || '{}');
  return (
    <header className="sticky top-0 z-30 lg:ml-[280px] transition-all pt-4 px-6 sm:px-10 pb-2">
      <div className="glass-panel rounded-[2rem] px-6 h-20 flex items-center justify-between shadow-sm shadow-slate-200/50">
        <div className="flex items-center gap-6 flex-1">
          <button onClick={toggleSidebar} className="lg:hidden p-3 bg-white text-slate-600 border border-slate-100 rounded-xl shadow-sm active:scale-95 transition-all">
            <Menu className="w-5 h-5" />
          </button>
          
          <div className="hidden lg:flex items-center w-[360px]">
            <div className="relative w-full group">
              <Search className="absolute left-5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-indigo-500 transition-colors" />
              <input
                type="text"
                placeholder="Search topics, modules, insights..."
                className="w-full pl-12 pr-6 py-3 bg-white/50 border border-slate-200 focus:bg-white focus:ring-4 focus:ring-indigo-500/5 focus:border-indigo-500/50 rounded-2xl text-xs font-bold outline-none transition-all placeholder:text-slate-400"
              />
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3 sm:gap-6">
          <div className="flex items-center gap-2 bg-gradient-to-r from-violet-600/5 to-indigo-600/5 px-4 py-2 rounded-full border border-indigo-200/30 hidden sm:flex">
             <Sparkles className="w-3 h-3 text-indigo-600 fill-indigo-600 animate-pulse" />
             <span className="text-[9px] font-black text-indigo-700 uppercase tracking-widest">Cognitive Sync</span>
          </div>
          <button className="p-3 text-slate-400 hover:bg-white hover:text-indigo-600 rounded-2xl relative transition-all border border-transparent hover:border-slate-100">
            <Bell className="w-5 h-5" />
            <span className="absolute top-3 right-3 w-2 h-2 bg-red-500 rounded-full border-2 border-white"></span>
          </button>
          <div className="w-[1px] h-8 bg-slate-200 hidden sm:block mx-2" />
          <div className="flex items-center gap-4 pl-1">
            <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-slate-900 to-slate-800 flex items-center justify-center text-white font-black shadow-lg shadow-slate-900/20 ring-4 ring-white">
              {(profile.full_name || 'U').substring(0, 1).toUpperCase()}
            </div>
          </div>
        </div>
      </div>
    </header>
  );
};

const BackgroundBlobs = () => (
  <div className="fixed inset-0 overflow-hidden pointer-events-none -z-10 select-none">
    <div className="absolute top-0 left-1/4 w-[600px] h-[600px] bg-indigo-200/40 rounded-full mix-blend-multiply filter blur-[120px] opacity-40 animate-blob"></div>
    <div className="absolute top-0 right-1/4 w-[600px] h-[600px] bg-cyan-200/40 rounded-full mix-blend-multiply filter blur-[120px] opacity-40 animate-blob animation-delay-2000"></div>
    <div className="absolute -bottom-32 left-1/3 w-[600px] h-[600px] bg-pink-200/40 rounded-full mix-blend-multiply filter blur-[120px] opacity-40 animate-blob animation-delay-4000"></div>
  </div>
);

const AppContent = () => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isOffline, setIsOffline] = useState(!navigator.onLine);
  const location = useLocation();
  const isAuth = location.pathname.startsWith('/login') || location.pathname.startsWith('/signup');
  const isExamPortal = location.pathname.startsWith('/exam-portal');

  useEffect(() => {
    setSidebarOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    const handleBeforeInstallPrompt = (e: any) => { e.preventDefault(); setDeferredPrompt(e); };
    const handleOnline = () => setIsOffline(false);
    const handleOffline = () => setIsOffline(true);

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const handleInstallClick = () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      deferredPrompt.userChoice.then((choiceResult: any) => { setDeferredPrompt(null); });
    }
  };

  return (
    <div className="min-h-screen bg-[#f1f5f9] text-[#0f172a] selection:bg-indigo-100 selection:text-indigo-900">
        {isOffline && (
          <div 
             className="fixed bottom-8 left-1/2 -translate-x-1/2 z-[60] px-8 py-4 bg-slate-900 text-white rounded-[1.5rem] shadow-2xl flex items-center gap-4 border border-white/10"
          >
             <div className="bg-red-500 p-1.5 rounded-lg animate-pulse"><WifiOff className="w-4 h-4 text-white" /></div>
             <div className="flex flex-col">
                <span className="text-[11px] font-black uppercase tracking-widest">Network Interrupted</span>
                <span className="text-[10px] font-bold text-slate-400">Operating on local cache. Reconnect to sync.</span>
             </div>
          </div>
        )}

        {isAuth ? (
          <div className="w-full min-h-screen">
            <Routes>
              <Route path="/login" element={<Login />} />
              <Route path="/signup" element={<Signup />} />
              <Route path="*" element={<Navigate to="/login" replace />} />
            </Routes>
          </div>
        ) : isExamPortal ? (
          <div className="w-full h-full">
            <ProtectedRoute>
              <Routes>
                <Route path="/exam-portal" element={<ExamPortal />} />
              </Routes>
            </ProtectedRoute>
          </div>
        ) : (
          <ProtectedRoute>
            <div className="min-h-screen relative flex">
              <BackgroundBlobs />
              <Sidebar 
                  isOpen={sidebarOpen} 
                  toggle={() => setSidebarOpen(false)} 
                  installPrompt={deferredPrompt}
                  onInstall={handleInstallClick}
              />
              <div className="flex-1 flex flex-col min-w-0">
                <Header toggleSidebar={() => setSidebarOpen(true)} />
                <main className="flex-1 lg:ml-[280px] p-4 sm:p-6 lg:p-10 transition-all overflow-x-hidden pt-4">
                    <div className="w-full">
                      <Routes>
                        <Route path="/" element={<Dashboard />} />
                        <Route path="/daily" element={<Daily />} />
                        <Route path="/exam-setup" element={<ExamSetup />} />
                        <Route path="/practice" element={<Practice />} />
                        <Route path="/analytics" element={<Analytics />} />
                        <Route path="/history" element={<History />} />
                        <Route path="/admin" element={<AdminRoute><Admin /></AdminRoute>} />
                        <Route path="*" element={<Navigate to="/" replace />} />
                      </Routes>
                    </div>
                </main>
              </div>
            </div>
          </ProtectedRoute>
        )}
    </div>
  );
};

const App = () => {
  return (
    <AppContent />
  );
};

export default App;
