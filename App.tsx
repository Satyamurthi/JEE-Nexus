import React, { useState, useEffect, Suspense } from 'react';
import { HashRouter, Routes, Route, useNavigate, useLocation, Navigate } from 'react-router-dom';
import { Layout, LogOut, User, Bell, Search, Menu, X, Brain, ShieldCheck, ChevronLeft, Sparkles, LayoutGrid, Download, WifiOff, Loader2, RefreshCw, AlertTriangle } from 'lucide-react';
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
  children: React.ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
}

class NetworkErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: any) {
    return { hasError: true };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center min-h-[60vh] p-6 text-center">
          <div className="p-4 bg-red-50 rounded-full mb-4">
             <AlertTriangle className="w-8 h-8 text-red-500" />
          </div>
          <h2 className="text-lg font-black text-slate-900 mb-2">Module Load Failed</h2>
          <p className="text-slate-500 text-sm mb-6 max-w-xs">
            A network interruption prevented this section from loading.
          </p>
          <button 
            onClick={() => window.location.reload()}
            className="px-6 py-3 bg-slate-900 text-white rounded-xl font-bold text-sm flex items-center gap-2 hover:bg-slate-800 transition-all"
          >
            <RefreshCw className="w-4 h-4" />
            Reload Application
          </button>
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
  <div className="flex flex-col items-center justify-center min-h-[60vh] animate-in fade-in duration-300">
    <div className="relative">
      <div className="w-12 h-12 border-4 border-indigo-100 rounded-full"></div>
      <div className="absolute top-0 left-0 w-12 h-12 border-4 border-indigo-500 rounded-full border-t-transparent animate-spin"></div>
    </div>
    <p className="mt-4 text-xs font-bold text-slate-400 uppercase tracking-widest animate-pulse">Loading Module...</p>
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

        <div className="p-6 space-y-4">
          {installPrompt && (
            <button
              onClick={onInstall}
              className="flex items-center justify-center w-full px-4 py-3 text-[10px] font-black text-indigo-100 bg-indigo-600/20 border border-indigo-500/30 rounded-xl hover:bg-indigo-600 hover:text-white transition-all shadow-sm group animate-in fade-in slide-in-from-bottom-2"
            >
              <Download className="w-3.5 h-3.5 mr-2" />
              Install App
            </button>
          )}

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
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isOffline, setIsOffline] = useState(!navigator.onLine);
  const location = useLocation();
  const isAuth = location.pathname.startsWith('/login') || location.pathname.startsWith('/signup');
  const isExamPortal = location.pathname.startsWith('/exam-portal');

  useEffect(() => {
    setSidebarOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    // PWA Install Prompt Logic
    const handleBeforeInstallPrompt = (e: any) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };

    // Offline Detection Logic
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
      deferredPrompt.userChoice.then((choiceResult: any) => {
        if (choiceResult.outcome === 'accepted') {
          console.log('User accepted the install prompt');
        }
        setDeferredPrompt(null);
      });
    }
  };

  return (
    <AnimatePresence mode="wait" initial={false}>
      {/* Offline Toast */}
      {isOffline && (
        <motion.div 
           initial={{ y: 50, opacity: 0 }}
           animate={{ y: 0, opacity: 1 }}
           exit={{ y: 50, opacity: 0 }}
           className="fixed bottom-6 left-6 z-[60] px-6 py-4 bg-slate-900 text-white rounded-xl shadow-2xl flex items-center gap-3 border border-slate-700"
        >
           <WifiOff className="w-5 h-5 text-red-400 animate-pulse" />
           <span className="text-sm font-bold">You are offline. Cached mode active.</span>
        </motion.div>
      )}

      {isAuth ? (
        <motion.div key="auth-wrapper" className="w-full min-h-screen bg-slate-50" initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}}>
            <NetworkErrorBoundary>
              <Suspense fallback={<div className="h-screen w-full flex items-center justify-center bg-slate-50"><Loader2 className="w-8 h-8 animate-spin text-indigo-500" /></div>}>
                <Routes location={location}>
                  <Route path="/login" element={<Login />} />
                  <Route path="/signup" element={<Signup />} />
                </Routes>
              </Suspense>
            </NetworkErrorBoundary>
        </motion.div>
      ) : isExamPortal ? (
        <motion.div key="exam-portal-wrapper" className="w-full h-full" initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}}>
            <ProtectedRoute>
              <NetworkErrorBoundary>
                <Suspense fallback={<div className="h-screen w-full flex items-center justify-center bg-slate-50"><Loader2 className="w-8 h-8 animate-spin text-indigo-500" /></div>}>
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
              <main className="flex-1 lg:ml-[280px] p-6 sm:p-10 transition-all overflow-x-hidden">
                <AnimatePresence mode="wait">
                  <motion.div
                    key={location.pathname}
                    initial={{ opacity: 0, y: 15 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -15 }}
                    transition={{ duration: 0.25, ease: "easeOut" }}
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