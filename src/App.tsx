
import React, { useState, useEffect, Suspense, Component } from 'react';
import { HashRouter, Routes, Route, useNavigate, useLocation, Navigate } from 'react-router-dom';
// Fixed: Removed 'Layout' as it is not a valid export from lucide-react
import { LogOut, User, Bell, Search, Menu, X, Brain, ShieldCheck, ChevronLeft, Sparkles, LayoutGrid, Download, WifiOff, Loader2, RefreshCw, AlertTriangle, CloudRain } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { MENU_ITEMS, APP_NAME } from './constants';
import { supabase } from './supabase';

// Lazy Load Pages for Performance Optimization
const Dashboard = React.lazy(() => import('./pages/Dashboard'));
const ExamSetup = React.lazy(() => import('./pages/ExamSetup'));
const ExamPortal = React.lazy(() => import('./pages/ExamPortal'));
const Analytics = React.lazy(() => import('./pages/Analytics'));
const History = React.lazy(() => import('./pages/History'));
const Admin = React.lazy(() => import('./pages/Admin'));
const Practice = React.lazy(() => import('./pages/Practice'));
const Daily = React.lazy(() => import('./pages/Daily'));
const Login = React.lazy(() => import('./pages/Login'));
const Signup = React.lazy(() => import('./pages/Signup'));

interface ErrorBoundaryProps {
  children?: React.ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  errorType?: 'network' | 'logic';
}

// Change: Updated NetworkErrorBoundary to explicitly extend Component to fix type errors regarding setState and props.
class NetworkErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(error: any): ErrorBoundaryState {
    const isNetwork = error.message?.includes('network') || error.name === 'ChunkLoadError';
    return { hasError: true, errorType: isNetwork ? 'network' : 'logic' };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center min-h-[60vh] p-8 text-center bg-white/50 backdrop-blur-xl rounded-[3rem] border border-slate-100 shadow-premium m-4 animate-in fade-in zoom-in-95 duration-500">
          <div className={`p-5 rounded-3xl mb-6 ${this.state.errorType === 'network' ? 'bg-blue-50 text-blue-600' : 'bg-red-50 text-red-600'}`}>
             {this.state.errorType === 'network' ? <CloudRain className="w-10 h-10" /> : <AlertTriangle className="w-10 h-10" />}
          </div>
          <h2 className="text-2xl font-black text-slate-900 mb-3 tracking-tight">
            {this.state.errorType === 'network' ? 'Connection Interrupted' : 'Module Loading Error'}
          </h2>
          <p className="text-slate-500 text-sm mb-8 max-w-sm leading-relaxed mx-auto font-medium">
            {this.state.errorType === 'network' 
              ? 'Your internet connection dropped while loading this module. Reconnect to resume.' 
              : 'A cognitive processing error occurred while initializing this section.'}
          </p>
          <div className="flex flex-col sm:flex-row gap-3">
              <button 
                onClick={() => this.setState({ hasError: false })}
                className="px-8 py-4 bg-slate-900 text-white rounded-2xl font-black text-xs uppercase tracking-widest flex items-center justify-center gap-3 hover:bg-slate-800 transition-all shadow-xl shadow-slate-900/10"
              >
                <RefreshCw className="w-4 h-4" />
                Reload Application
              </button>
              <button 
                onClick={() => this.setState({ hasError: false })}
                className="px-8 py-4 bg-white text-slate-500 border border-slate-100 rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-slate-50 transition-all"
              >
                Dismiss
              </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

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

const PageLoader = () => (
  <div className="flex flex-col items-center justify-center min-h-[50vh] animate-in fade-in duration-500">
    <div className="relative">
      <div className="w-14 h-14 border-[3px] border-slate-100 rounded-full"></div>
      <div className="absolute top-0 left-0 w-14 h-14 border-[3px] border-indigo-500 rounded-full border-t-transparent animate-spin"></div>
    </div>
    <div className="mt-6 flex flex-col items-center gap-1">
        <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] animate-pulse">Syncing Cognitive Layer</p>
        <p className="text-[9px] font-bold text-slate-300 uppercase tracking-widest">Optimizing for bandwidth...</p>
    </div>
  </div>
);

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
      <AnimatePresence>
        {isOpen && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-40 lg:hidden"
            onClick={toggle}
          />
        )}
      </AnimatePresence>
      
      <motion.div 
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
              <motion.button
                key={item.id}
                onClick={() => {
                  navigate(item.path);
                  if (window.innerWidth < 1024) toggle();
                }}
                className={`flex items-center w-full px-5 py-3.5 text-sm font-bold rounded-2xl transition-all group relative overflow-hidden ${
                  isActive
                    ? 'text-white shadow-lg shadow-indigo-900/50'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                {isActive && (
                  <motion.div 
                    layoutId="nav-pill" 
                    className="absolute inset-0 bg-gradient-to-r from-indigo-600 to-violet-600 rounded-2xl"
                    transition={{ type: "spring", stiffness: 350, damping: 30 }}
                  />
                )}
                {!isActive && (
                  <div className="absolute inset-0 bg-white/5 opacity-0 group-hover:opacity-100 transition-opacity rounded-2xl" />
                )}
                
                <span className={`relative z-10 mr-4 transition-transform group-hover:scale-110 ${isActive ? 'text-indigo-200' : 'text-slate-500 group-hover:text-indigo-400'}`}>
                  {item.icon}
                </span>
                <span className="relative z-10 tracking-wide font-extrabold uppercase text-[11px]">{item.label}</span>
              </motion.button>
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
      </motion.div>
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
      <AnimatePresence mode="wait">
        {isOffline && (
          <motion.div 
             initial={{ y: 50, opacity: 0 }}
             animate={{ y: 0, opacity: 1 }}
             exit={{ y: 50, opacity: 0 }}
             className="fixed bottom-8 left-1/2 -translate-x-1/2 z-[60] px-8 py-4 bg-slate-900 text-white rounded-[1.5rem] shadow-2xl flex items-center gap-4 border border-white/10"
          >
             <div className="bg-red-500 p-1.5 rounded-lg animate-pulse"><WifiOff className="w-4 h-4 text-white" /></div>
             <div className="flex flex-col">
                <span className="text-[11px] font-black uppercase tracking-widest">Network Interrupted</span>
                <span className="text-[10px] font-bold text-slate-400">Operating on local cache. Reconnect to sync.</span>
             </div>
          </motion.div>
        )}

        {isAuth ? (
          <motion.div key="auth-wrapper" className="w-full min-h-screen" initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}}>
              <NetworkErrorBoundary>
                <Suspense fallback={<PageLoader />}>
                  <Routes location={location}>
                    <Route path="/login" element={<Login />} />
                    <Route path="/signup" element={<Signup />} />
                    <Route path="*" element={<Navigate to="/login" replace />} />
                  </Routes>
                </Suspense>
              </NetworkErrorBoundary>
          </motion.div>
        ) : isExamPortal ? (
          <motion.div key="exam-portal-wrapper" className="w-full h-full" initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}}>
              <ProtectedRoute>
                <NetworkErrorBoundary>
                  <Suspense fallback={<PageLoader />}>
                    <Routes location={location}>
                      <Route path="/exam-portal" element={<ExamPortal />} />
                    </Routes>
                  </Suspense>
                </NetworkErrorBoundary>
              </ProtectedRoute>
          </motion.div>
        ) : (
          <ProtectedRoute key="main-app-wrapper">
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
                <main className="flex-1 lg:ml-[280px] p-6 sm:p-10 transition-all overflow-x-hidden pt-4">
                  <AnimatePresence mode="wait" initial={false}>
                    <motion.div
                      key={location.pathname}
                      initial={{ opacity: 0, y: 12, filter: 'blur(8px)' }}
                      animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
                      exit={{ opacity: 0, y: -12, filter: 'blur(8px)' }}
                      transition={{ duration: 0.35, ease: [0.23, 1, 0.32, 1] }}
                      className="w-full"
                    >
                      <NetworkErrorBoundary>
                        <Suspense fallback={<PageLoader />}>
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
                        </Suspense>
                      </NetworkErrorBoundary>
                    </motion.div>
                  </AnimatePresence>
                </main>
              </div>
            </div>
          </ProtectedRoute>
        )}
      </AnimatePresence>
    </div>
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
