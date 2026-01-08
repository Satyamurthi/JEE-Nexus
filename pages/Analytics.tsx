
import React, { useState, useEffect } from 'react';
import { Award, Target, TrendingUp, Clock, AlertCircle, Sparkles, ChevronRight, BookOpen, Brain, CheckCircle2, XCircle, ChevronDown, ChevronUp, BarChart3, PieChart as PieIcon, Info, Download } from 'lucide-react';
import { PieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';
import { motion, AnimatePresence } from 'framer-motion';
import { getDeepAnalysis } from '../geminiService';
import MathText from '../components/MathText';

const Analytics = () => {
  const [result, setResult] = useState<any>(null);
  const [aiInsight, setAiInsight] = useState('');
  const [loadingAi, setLoadingAi] = useState(false);
  const [showReview, setShowReview] = useState(false);
  const [expandedQuestion, setExpandedQuestion] = useState<number | null>(null);
  const [priorityTraining, setPriorityTraining] = useState<any[]>([]);

  useEffect(() => {
    const raw = localStorage.getItem('last_result');
    if (raw) {
      const parsed = JSON.parse(raw);
      setResult(parsed);
      
      // Calculate dynamic priority training data from this specific result
      if (parsed.questions) {
          const chapterStats: Record<string, { total: number, correct: number }> = {};
          parsed.questions.forEach((q: any) => {
              // Try chapter first, then concept, then subject
              const key = q.chapter || q.concept || q.subject || 'General';
              if (!chapterStats[key]) chapterStats[key] = { total: 0, correct: 0 };
              chapterStats[key].total++;
              if (q.isCorrect) chapterStats[key].correct++;
          });

          const trainingData = Object.entries(chapterStats).map(([chapter, stats]) => {
              const acc = (stats.correct / stats.total) * 100;
              let status = 'Expert';
              let color = 'text-green-600';
              let bg = 'bg-green-50';
              
              if (acc < 50) {
                  status = 'Critical';
                  color = 'text-red-600';
                  bg = 'bg-red-50';
              } else if (acc < 80) {
                  status = 'Insecure';
                  color = 'text-orange-600';
                  bg = 'bg-orange-50';
              }
              
              return { chapter, status, score: Math.round(acc), color, bg };
          }).sort((a, b) => a.score - b.score).slice(0, 3); // Top 3 weakest areas
          
          setPriorityTraining(trainingData);
      }

      fetchAIAnalysis(parsed);
    }
  }, []);

  const fetchAIAnalysis = async (res: any) => {
    setLoadingAi(true);
    try {
      const insight = await getDeepAnalysis(res);
      setAiInsight(insight);
    } catch (e) {
      setAiInsight("Unable to generate AI insights. Our cognitive servers are currently busy.");
    } finally {
      setLoadingAi(false);
    }
  };

  const handleDownloadReport = () => {
    if (!result) return;

    const printWindow = window.open('', '', 'height=800,width=900');
    if (!printWindow) {
        alert("Pop-up blocked. Please allow pop-ups to download the report.");
        return;
    }

    const userProfile = JSON.parse(localStorage.getItem('user_profile') || '{}');
    const userName = userProfile.full_name || 'Aspirant';
    const dateStr = new Date(result.completedAt).toLocaleString();

    let contentHtml = '';

    // Sort questions by subject order for cleaner output
    const sortedQuestions = [...(result.questions || [])].sort((a, b) => {
        const order = { 'Physics': 1, 'Chemistry': 2, 'Mathematics': 3 };
        return (order[a.subject as keyof typeof order] || 4) - (order[b.subject as keyof typeof order] || 4);
    });

    sortedQuestions.forEach((q: any, idx: number) => {
        const isCorrect = q.isCorrect;
        const isSkipped = q.userAnswer === undefined || q.userAnswer === '';
        
        let statusColor = '#64748b'; // Slate (Skipped)
        let statusText = 'NOT ATTEMPTED';
        if (!isSkipped) {
            statusColor = isCorrect ? '#16a34a' : '#dc2626'; // Green or Red
            statusText = isCorrect ? 'CORRECT' : 'WRONG';
        }

        let optionsHtml = '';
        if (q.type === 'MCQ' && q.options) {
            optionsHtml = `<div class="options-grid">
                ${q.options.map((opt: string, i: number) => {
                    const isUserSel = q.userAnswer?.toString() === i.toString();
                    const isCorrectSel = q.correctAnswer?.toString() === i.toString();
                    
                    let optClass = 'opt';
                    if (isCorrectSel) optClass += ' opt-correct';
                    if (isUserSel && !isCorrectSel) optClass += ' opt-wrong';
                    if (isUserSel && isCorrectSel) optClass += ' opt-user-correct';

                    return `<div class="${optClass}">
                        <span class="opt-label">${String.fromCharCode(65 + i)})</span> ${opt}
                        ${isUserSel ? '<span style="margin-left:5px; font-weight:bold;">(You)</span>' : ''}
                        ${isCorrectSel ? '<span style="float:right; font-weight:bold;">✓</span>' : ''}
                    </div>`;
                }).join('')}
            </div>`;
        } else {
            // Numerical
            optionsHtml = `<div class="numerical-box">
                <p><strong>Your Answer:</strong> ${isSkipped ? '--' : q.userAnswer}</p>
                <p><strong>Correct Answer:</strong> ${q.correctAnswer}</p>
            </div>`;
        }

        contentHtml += `
            <div class="q-block">
                <div class="q-header">
                    <span class="q-badge">${q.subject}</span>
                    <span class="q-badge" style="background:#f1f5f9; color:#475569;">${q.type}</span>
                    <span class="q-status" style="color:${statusColor}; border-color:${statusColor}">${statusText}</span>
                </div>
                <div class="q-statement"><strong>Q${idx + 1}.</strong> ${q.statement}</div>
                ${optionsHtml}
                <div class="solution-box">
                    <div class="sol-title">Explanation & Solution:</div>
                    <div class="sol-body">${q.solution || q.explanation}</div>
                </div>
            </div>
        `;
    });

    const fullHtml = `<!DOCTYPE html>
        <html>
        <head>
            <title>Exam Report - ${userName}</title>
            <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/katex.min.css">
            <script defer src="https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/katex.min.js"></script>
            <script defer src="https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/contrib/mhchem.min.js"></script>
            <script defer src="https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/contrib/auto-render.min.js"></script>
            <style>
                body { font-family: 'Segoe UI', sans-serif; padding: 40px; max-width: 900px; margin: 0 auto; color: #1e293b; }
                h1, h2, h3 { margin: 0; }
                .header { text-align: center; border-bottom: 2px solid #e2e8f0; padding-bottom: 20px; margin-bottom: 30px; }
                .meta { display: flex; justify-content: space-between; margin-top: 15px; font-size: 0.9rem; color: #64748b; font-weight: bold; }
                .score-card { background: #f8fafc; border: 1px solid #e2e8f0; padding: 20px; border-radius: 12px; text-align: center; margin-bottom: 30px; display: flex; justify-content: space-around; }
                .sc-item h2 { font-size: 2rem; color: #0f172a; }
                .sc-item p { font-size: 0.8rem; text-transform: uppercase; letter-spacing: 1px; color: #64748b; }
                
                .q-block { margin-bottom: 30px; border: 1px solid #e2e8f0; padding: 25px; border-radius: 16px; page-break-inside: avoid; }
                .q-header { display: flex; align-items: center; gap: 10px; margin-bottom: 15px; }
                .q-badge { font-size: 0.7rem; font-weight: bold; text-transform: uppercase; background: #e0f2fe; color: #0369a1; padding: 4px 8px; border-radius: 6px; }
                .q-status { margin-left: auto; font-size: 0.7rem; font-weight: bold; border: 1px solid; padding: 4px 8px; border-radius: 6px; }
                
                .q-statement { font-size: 1.05rem; margin-bottom: 20px; line-height: 1.6; }
                
                .options-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
                .opt { padding: 10px 15px; border: 1px solid #e2e8f0; border-radius: 8px; font-size: 0.9rem; }
                .opt-label { font-weight: bold; margin-right: 5px; }
                .opt-correct { background-color: #dcfce7; border-color: #86efac; color: #14532d; }
                .opt-wrong { background-color: #fee2e2; border-color: #fca5a5; color: #7f1d1d; }
                .opt-user-correct { background-color: #dcfce7; border-color: #16a34a; border-width: 2px; }
                
                .numerical-box { background: #f8fafc; padding: 15px; border-radius: 8px; border: 1px dashed #cbd5e1; }
                
                .solution-box { margin-top: 20px; background: #f0f9ff; padding: 20px; border-radius: 12px; border-left: 4px solid #3b82f6; }
                .sol-title { font-weight: bold; font-size: 0.8rem; text-transform: uppercase; color: #1e40af; margin-bottom: 10px; }
                .sol-body { font-size: 0.95rem; line-height: 1.6; }
                
                /* Math specific styles */
                .katex-display { overflow-x: auto; overflow-y: hidden; padding: 5px 0; }
                .katex { font-size: 1.1em; }

                @media print {
                    body { padding: 0; }
                    .no-print { display: none; }
                    .q-block { break-inside: avoid; }
                }
            </style>
        </head>
        <body>
            <div class="header">
                <h1>JEE Nexus Analysis Report</h1>
                <div class="meta">
                    <span>Candidate: ${userName}</span>
                    <span>Date: ${dateStr}</span>
                    <span>Exam ID: ${result.id?.substring(0,8).toUpperCase()}</span>
                </div>
            </div>

            <div class="score-card">
                <div class="sc-item">
                    <h2>${result.score} / ${result.totalPossible}</h2>
                    <p>Total Score</p>
                </div>
                <div class="sc-item">
                    <h2>${result.accuracy}%</h2>
                    <p>Accuracy</p>
                </div>
                <div class="sc-item">
                    <h2>${sortedQuestions.length}</h2>
                    <p>Questions</p>
                </div>
            </div>

            <div class="questions-list">
                ${contentHtml}
            </div>

            <script>
                document.addEventListener("DOMContentLoaded", function() {
                    renderMathInElement(document.body, {
                      delimiters: [
                          {left: '$$', right: '$$', display: true},
                          {left: '$', right: '$', display: false},
                          {left: '\\(', right: '\\)', display: false},
                          {left: '\\[', right: '\\]', display: true}
                      ],
                      throwOnError : false,
                      trust: true
                    });
                    setTimeout(() => {
                        window.print();
                    }, 1500);
                });
            </script>
        </body>
        </html>
    `;

    printWindow.document.write(fullHtml);
    printWindow.document.close();
  };

  if (!result) return (
    <div className="flex flex-col items-center justify-center h-[70vh] text-slate-300">
      <div className="p-12 bg-white rounded-[3rem] border border-slate-100 shadow-premium flex flex-col items-center text-center max-w-md">
        <div className="p-6 bg-slate-50 rounded-full mb-8 animate-pulse">
           <BarChart3 className="w-16 h-16 opacity-20" />
        </div>
        <p className="text-2xl font-black text-slate-900 mb-2">No Data Available</p>
        <p className="text-slate-500 font-medium leading-relaxed">The analytics engine is waiting for your first attempt. Complete a simulation to unlock this module.</p>
      </div>
    </div>
  );

  const subjectData = [
    { name: 'Physics', score: result.questions?.filter((q: any) => q.subject === 'Physics' && q.isCorrect).length * 4 || 0 },
    { name: 'Chemistry', score: result.questions?.filter((q: any) => q.subject === 'Chemistry' && q.isCorrect).length * 4 || 0 },
    { name: 'Maths', score: result.questions?.filter((q: any) => q.subject === 'Mathematics' && q.isCorrect).length * 4 || 0 },
  ];

  const accuracyData = [
    { name: 'Correct', value: result.accuracy },
    { name: 'Incorrect', value: 100 - result.accuracy },
  ];

  return (
    <div className="space-y-10 pb-24">
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-8">
        <div>
          <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-blue-50 rounded-full border border-blue-100 mb-6">
             <Info className="w-3.5 h-3.5 text-blue-600" />
             <span className="text-[10px] font-black text-blue-700 uppercase tracking-widest">Cognitive Performance Summary</span>
          </div>
          <h1 className="text-5xl font-black text-slate-900 tracking-tight leading-none mb-4">Post-Exam Intelligence</h1>
          <p className="text-slate-500 font-medium">Attempt ID: <span className="text-slate-900 font-black">NEX-#{result.id?.substring(0,6) || 'GEN'}</span> • {result.type}</p>
        </div>
        
        <div className="flex flex-wrap gap-4">
           <button 
             onClick={handleDownloadReport}
             className="px-6 py-5 bg-white text-slate-700 border-2 border-slate-100 rounded-[2rem] font-bold hover:bg-slate-50 hover:border-slate-200 transition-all flex items-center gap-2"
             title="Download PDF Report"
           >
             <Download className="w-5 h-5" />
             <span className="hidden sm:inline">Download Paper</span>
           </button>
           <button 
             onClick={() => setShowReview(!showReview)}
             className="px-10 py-5 bg-slate-900 text-white rounded-[2rem] font-black shadow-2xl shadow-slate-200 hover:bg-slate-800 transition-all flex items-center gap-3 active:scale-95"
           >
             <BookOpen className="w-5 h-5" />
             {showReview ? "Back to Analytics" : "Verify All Solutions"}
           </button>
        </div>
      </header>

      {!showReview ? (
        <div className="animate-in fade-in slide-in-from-bottom-6 duration-700">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 mb-12">
            <motion.div whileHover={{ y: -8 }} className="bg-gradient-to-br from-blue-600 via-indigo-700 to-violet-800 p-10 rounded-[2.5rem] text-white shadow-2xl relative overflow-hidden group">
               <Award className="w-32 h-32 absolute -bottom-6 -right-6 opacity-10 group-hover:scale-125 transition-transform duration-700 rotate-12" />
               <div className="relative z-10">
                 <p className="text-blue-100 text-[10px] font-black uppercase tracking-widest mb-2 opacity-70">Calculated Score</p>
                 <h3 className="text-7xl font-black tracking-tighter mb-1">{result.score}</h3>
                 <p className="text-blue-200 font-medium text-sm">out of {result.totalPossible}</p>
               </div>
            </motion.div>

            <motion.div whileHover={{ y: -8 }} className="bg-white p-10 rounded-[2.5rem] border border-slate-100 shadow-premium relative overflow-hidden">
               <div className="flex items-center justify-between mb-8 relative z-10">
                  <div className="p-4 bg-emerald-50 text-emerald-600 rounded-2xl"><Target className="w-6 h-6" /></div>
                  <span className="text-4xl font-black text-slate-900">{result.accuracy}%</span>
               </div>
               <p className="text-slate-400 text-[10px] font-black uppercase tracking-widest mb-4">Global Accuracy</p>
               <div className="h-3 w-full bg-slate-50 rounded-full overflow-hidden border border-slate-100 p-0.5">
                 <div className="h-full bg-emerald-500 rounded-full transition-all duration-1000" style={{ width: `${result.accuracy}%` }}></div>
               </div>
            </motion.div>

            <motion.div whileHover={{ y: -8 }} className="bg-white p-10 rounded-[2.5rem] border border-slate-100 shadow-premium">
               <div className="flex items-center justify-between mb-8">
                  <div className="p-4 bg-orange-50 text-orange-600 rounded-2xl"><Clock className="w-6 h-6" /></div>
                  <span className="text-3xl font-black text-slate-900">2h 45m</span>
               </div>
               <p className="text-slate-400 text-[10px] font-black uppercase tracking-widest mb-2">Duration Used</p>
               <span className="text-[10px] font-black text-orange-500 bg-orange-50 px-3 py-1 rounded-full uppercase tracking-widest">Efficiency: 82%</span>
            </motion.div>

            <motion.div whileHover={{ y: -8 }} className="bg-white p-10 rounded-[2.5rem] border border-slate-100 shadow-premium">
               <div className="flex items-center justify-between mb-8">
                  <div className="p-4 bg-fuchsia-50 text-fuchsia-600 rounded-2xl"><TrendingUp className="w-6 h-6" /></div>
                  <span className="text-3xl font-black text-slate-900">~12.4k</span>
               </div>
               <p className="text-slate-400 text-[10px] font-black uppercase tracking-widest mb-2">Est. Percentile</p>
               <span className="text-[10px] font-black text-fuchsia-500 bg-fuchsia-50 px-3 py-1 rounded-full uppercase tracking-widest">Top 8% Bracket</span>
            </motion.div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
            <div className="lg:col-span-2 space-y-10">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                <div className="bg-white p-10 rounded-[2.5rem] border border-slate-100 shadow-premium">
                   <h3 className="text-xl font-black text-slate-900 mb-10 flex items-center gap-3">
                     <PieIcon className="w-5 h-5 text-indigo-500" />
                     Error Distribution
                   </h3>
                   <div className="h-[280px]">
                     <ResponsiveContainer width="100%" height="100%">
                       <PieChart>
                         <Pie data={accuracyData} innerRadius={80} outerRadius={110} paddingAngle={8} dataKey="value" stroke="none">
                            <Cell fill="#10b981" />
                            <Cell fill="#ef4444" />
                         </Pie>
                         <Tooltip 
                            contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 30px rgba(0,0,0,0.1)', padding: '12px 20px', fontWeight: 'bold' }}
                         />
                       </PieChart>
                     </ResponsiveContainer>
                   </div>
                   <div className="flex justify-center gap-8 mt-4">
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 bg-emerald-500 rounded-full shadow-lg shadow-emerald-200" />
                        <span className="text-xs font-black text-slate-500 uppercase tracking-widest">Correct</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 bg-red-500 rounded-full shadow-lg shadow-red-200" />
                        <span className="text-xs font-black text-slate-500 uppercase tracking-widest">Mistakes</span>
                      </div>
                   </div>
                </div>

                <div className="bg-white p-10 rounded-[2.5rem] border border-slate-100 shadow-premium">
                   <h3 className="text-xl font-black text-slate-900 mb-10 flex items-center gap-3">
                     <BarChart3 className="w-5 h-5 text-blue-500" />
                     Subject Strengths
                   </h3>
                   <div className="h-[300px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={subjectData}>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                          <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 11, fontWeight: 800}} dy={15} />
                          <YAxis hide />
                          <Tooltip cursor={{fill: '#f8fafc', radius: 10}} contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 30px rgba(0,0,0,0.1)' }} />
                          <Bar dataKey="score" radius={[12, 12, 12, 12]} barSize={40}>
                            {subjectData.map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={['#3b82f6', '#10b981', '#d946ef'][index]} />
                            ))}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                   </div>
                </div>
              </div>

              {/* AI Insight Section */}
              <div className="bg-slate-900 p-12 rounded-[3rem] text-white shadow-2xl relative overflow-hidden group">
                 <div className="absolute top-0 right-0 p-12 opacity-5 pointer-events-none group-hover:scale-110 transition-transform duration-1000">
                   <Sparkles className="w-48 h-48" />
                 </div>
                 <div className="relative z-10">
                    <div className="flex items-center gap-4 mb-10">
                      <div className="bg-blue-600 p-3 rounded-2xl shadow-[0_0_30px_rgba(37,99,235,0.4)]">
                        <Brain className="w-8 h-8 text-white" />
                      </div>
                      <div>
                        <h3 className="text-2xl font-black tracking-tight">Gemini Deep Insight</h3>
                        <p className="text-blue-300 text-xs font-black uppercase tracking-[0.2em] mt-1">AI Cognitive Layer Active</p>
                      </div>
                    </div>
                    {loadingAi ? (
                      <div className="space-y-6 animate-pulse">
                        <div className="h-4 bg-white/5 rounded-full w-3/4"></div>
                        <div className="h-4 bg-white/5 rounded-full w-full"></div>
                        <div className="h-4 bg-white/5 rounded-full w-5/6"></div>
                        <div className="h-4 bg-white/5 rounded-full w-2/3"></div>
                      </div>
                    ) : (
                      <div className="prose prose-invert max-w-none text-slate-300 font-medium leading-[1.8] text-lg">
                        <MathText text={aiInsight || "Aggregating performance metrics for synthesis..."} />
                      </div>
                    )}
                 </div>
              </div>
            </div>

            <div className="space-y-10">
              <div className="bg-white p-10 rounded-[3rem] border border-slate-100 shadow-premium">
                 <h3 className="text-xl font-black text-slate-900 mb-8 tracking-tight">Priority Training</h3>
                 {priorityTraining.length > 0 ? (
                    <div className="space-y-8">
                    {priorityTraining.map((item, i) => (
                        <div key={i} className="group cursor-pointer">
                            <div className="flex items-center justify-between mb-3">
                            <span className="text-sm font-black text-slate-800 tracking-tight group-hover:text-blue-600 transition-colors capitalize">{item.chapter}</span>
                            <span className={`text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-full ${item.bg} ${item.color}`}>{item.status}</span>
                            </div>
                            <div className="h-2.5 w-full bg-slate-50 rounded-full overflow-hidden p-0.5 border border-slate-100">
                            <div className={`h-full ${item.color.replace('text', 'bg')} rounded-full opacity-80 shadow-sm`} style={{ width: `${item.score}%` }} />
                            </div>
                        </div>
                    ))}
                    </div>
                 ) : (
                    <div className="text-center text-slate-400 py-10">
                        <p className="font-bold text-sm">Needs More Data</p>
                        <p className="text-xs mt-1">Complete the exam to identify weak chapters.</p>
                    </div>
                 )}
                 <button className="w-full mt-10 py-5 bg-slate-50 text-slate-500 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-100 transition-all flex items-center justify-center gap-3">
                   View Subject Map
                   <ChevronRight className="w-4 h-4" />
                 </button>
              </div>

              <div className="bg-gradient-to-br from-fuchsia-600 to-purple-700 p-10 rounded-[3rem] text-white shadow-2xl relative overflow-hidden">
                 <div className="absolute -bottom-10 -right-10 w-40 h-40 bg-white opacity-10 rounded-full blur-3xl"></div>
                 <div className="p-4 bg-white/10 backdrop-blur-md rounded-2xl w-fit mb-8">
                   <Target className="w-8 h-8" />
                 </div>
                 <h3 className="text-2xl font-black tracking-tight mb-4">Improve Strategy</h3>
                 <p className="text-fuchsia-100/80 text-sm font-medium leading-relaxed mb-10">AI has identified specific weak points. Resolve these to boost predicted score by ~12%.</p>
                 <button className="w-full py-5 bg-white text-purple-900 rounded-2xl font-black text-sm shadow-xl shadow-purple-900/20 hover:scale-[1.02] active:scale-95 transition-all">Start Revision Drill</button>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="max-w-5xl mx-auto space-y-8 animate-in fade-in slide-in-from-right-10 duration-500">
          <div className="bg-white p-8 rounded-[2rem] border border-slate-100 shadow-premium flex items-center justify-between">
             <div className="flex gap-12">
                <div className="flex items-center gap-3">
                   <CheckCircle2 className="w-6 h-6 text-emerald-500" />
                   <div className="flex flex-col">
                     <span className="text-xl font-black text-slate-900">{result.questions?.filter((q: any) => q.isCorrect).length}</span>
                     <span className="text-xs font-black text-slate-400 uppercase tracking-widest">Correct</span>
                   </div>
                </div>
                <div className="flex items-center gap-3">
                   <XCircle className="w-6 h-6 text-red-500" />
                   <div className="flex flex-col">
                     <span className="text-xl font-black text-slate-900">{result.questions?.filter((q: any) => q.userAnswer !== undefined && !q.isCorrect).length}</span>
                     <span className="text-xs font-black text-slate-400 uppercase tracking-widest">Incorrect</span>
                   </div>
                </div>
             </div>
             <p className="text-[10px] text-slate-400 font-black uppercase tracking-[0.2em] hidden sm:block">Full Solution Explorer v2.0</p>
          </div>

          <div className="space-y-6">
            {result.questions?.map((q: any, idx: number) => (
              <motion.div 
                key={idx} 
                layout
                className="bg-white rounded-[2.5rem] border border-slate-100 shadow-premium overflow-hidden transition-all hover:border-blue-200"
              >
                <div 
                  className="p-10 cursor-pointer hover:bg-slate-50 transition-all"
                  onClick={() => setExpandedQuestion(expandedQuestion === idx ? null : idx)}
                >
                  <div className="flex items-start justify-between gap-10">
                     <div className="flex-1">
                        <div className="flex items-center gap-5 mb-6">
                           <span className={`w-12 h-12 rounded-2xl flex items-center justify-center text-lg font-black ${q.isCorrect ? 'bg-emerald-100 text-emerald-700 shadow-lg shadow-emerald-50' : q.userAnswer === undefined ? 'bg-slate-100 text-slate-400' : 'bg-red-100 text-red-700 shadow-lg shadow-red-50'}`}>
                              {idx + 1}
                           </span>
                           <div className="flex flex-col">
                             <span className="text-[10px] font-black uppercase text-slate-400 tracking-[0.2em]">{q.subject} • {q.type}</span>
                             <span className="text-xs font-bold text-slate-900 mt-1">{q.concept}</span>
                           </div>
                        </div>
                        <MathText text={q.statement} className="text-xl font-medium text-slate-800 leading-[1.6]" />
                     </div>
                     <div className="shrink-0 pt-4">
                        {expandedQuestion === idx ? <ChevronUp className="w-6 h-6 text-slate-300" /> : <ChevronDown className="w-6 h-6 text-slate-300" />}
                     </div>
                  </div>
                </div>

                <AnimatePresence>
                  {expandedQuestion === idx && (
                    <motion.div 
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.4, ease: [0.23, 1, 0.32, 1] }}
                    >
                      <div className="px-10 pb-12 pt-4 border-t border-slate-50 bg-[#fdfdfe]">
                         <div className="grid grid-cols-1 md:grid-cols-2 gap-12 mb-12">
                            <div className="space-y-6">
                               <h5 className="text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100 pb-3">Option Analysis</h5>
                               {q.type === 'MCQ' ? (
                                 <div className="space-y-3">
                                   {q.options.map((opt: string, i: number) => (
                                     <div 
                                       key={i} 
                                       className={`p-6 rounded-2xl border-2 text-sm flex items-center gap-6 transition-all ${
                                         i.toString() === q.correctAnswer.toString() 
                                         ? 'bg-emerald-50 border-emerald-200 text-emerald-900 font-bold shadow-xl shadow-emerald-50 scale-[1.02]' 
                                         : i.toString() === q.userAnswer?.toString()
                                         ? 'bg-red-50 border-red-200 text-red-900 font-bold'
                                         : 'bg-white border-slate-100 text-slate-600'
                                       }`}
                                     >
                                       <span className={`w-10 h-10 rounded-full flex items-center justify-center text-xs font-black shadow-sm ${i.toString() === q.correctAnswer.toString() ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-400'}`}>{String.fromCharCode(65 + i)}</span>
                                       <MathText text={opt} className="flex-1" />
                                     </div>
                                   ))}
                                 </div>
                               ) : (
                                 <div className="space-y-6">
                                    <div className="p-8 bg-emerald-50 border-2 border-emerald-200 rounded-[2rem] shadow-lg shadow-emerald-50">
                                       <p className="text-[10px] text-emerald-600 font-black uppercase tracking-widest mb-3">Target Solution</p>
                                       <MathText text={String(q.correctAnswer)} className="text-4xl font-black text-emerald-900" />
                                    </div>
                                    <div className={`p-8 border-2 rounded-[2rem] ${q.isCorrect ? 'bg-emerald-50 border-emerald-200' : 'bg-red-50 border-red-200 shadow-lg shadow-red-50'}`}>
                                       <p className={`text-[10px] font-black uppercase tracking-widest mb-3 ${q.isCorrect ? 'text-emerald-600' : 'text-red-600'}`}>Aspirant Input</p>
                                       <MathText text={String(q.userAnswer || 'N/A')} className={`text-4xl font-black ${q.isCorrect ? 'text-emerald-900' : 'text-red-900'}`} />
                                    </div>
                                 </div>
                               )}
                            </div>

                            <div className="space-y-6">
                              <h5 className="text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100 pb-3">Expert Explanation</h5>
                              <div className="p-8 bg-white border-2 border-slate-50 rounded-[2.5rem] shadow-premium">
                                 <div className="flex items-center gap-4 mb-6">
                                   <div className="p-3 bg-blue-50 text-blue-600 rounded-xl"><Brain className="w-5 h-5" /></div>
                                   <span className="text-sm font-black text-slate-800 tracking-tight leading-none uppercase">{q.concept}</span>
                                 </div>
                                 <MathText text={q.explanation} className="text-sm text-slate-500 leading-relaxed font-medium" />
                              </div>
                            </div>
                         </div>

                         <div className="p-12 bg-blue-50 rounded-[3rem] border-2 border-blue-100 relative group overflow-hidden">
                            <div className="absolute -bottom-10 -right-10 opacity-5 pointer-events-none group-hover:scale-110 transition-transform duration-1000">
                               <Sparkles className="w-48 h-48 text-blue-900" />
                            </div>
                            <h4 className="text-xs font-black text-blue-900 mb-8 flex items-center gap-3 uppercase tracking-[0.2em]">
                               Step-by-Step Working & Solution
                            </h4>
                            <div className="prose prose-blue max-w-none text-blue-900/80 font-medium text-lg leading-[1.8]">
                               <MathText text={q.solution} className="math-font whitespace-pre-wrap" />
                            </div>
                         </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default Analytics;
