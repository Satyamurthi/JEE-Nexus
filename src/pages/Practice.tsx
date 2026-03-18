
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { BookOpen, ChevronRight, Atom, Beaker, FunctionSquare, Play, Sparkles, Search, Filter } from 'lucide-react';
import { NCERT_CHAPTERS, SUBJECTS_CONFIG } from '../constants';
import { fetchQuestionsFromDB } from '../supabase';

const Practice = () => {
  const navigate = useNavigate();
  const [selectedSubject, setSelectedSubject] = useState<string | null>(null);
  const [selectedChapter, setSelectedChapter] = useState<string | null>(null);
  const [selectedTopics, setSelectedTopics] = useState<string[]>([]);
  const [mcqCount, setMcqCount] = useState(10);
  const [numericalCount, setNumericalCount] = useState(5);
  const [isPreparing, setIsPreparing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const subjects = Object.keys(NCERT_CHAPTERS);

  const handleStartPractice = async () => {
    if (!selectedSubject || !selectedChapter) return;
    
    setIsPreparing(true);
    try {
      let questions = await fetchQuestionsFromDB(
        selectedSubject, 
        selectedChapter, 
        selectedTopics, 
        mcqCount, 
        numericalCount
      );
      
      if (questions.length === 0) {
        // If no questions in DB, try generating them with AI
        console.log("No questions in DB, generating with AI...");
        try {
          const { generateJEEQuestions } = await import('../geminiService');
          const { saveQuestionsToDB } = await import('../supabase');
          const { Subject, ExamType } = await import('../types');
          
          const subjectEnum = selectedSubject === 'Physics' ? Subject.Physics : 
                             selectedSubject === 'Chemistry' ? Subject.Chemistry : 
                             Subject.Mathematics;

          questions = await generateJEEQuestions(
            subjectEnum,
            mcqCount + numericalCount,
            ExamType.Advanced,
            [selectedChapter],
            'Medium',
            selectedTopics,
            { mcq: mcqCount, numerical: numericalCount }
          );

          if (questions.length > 0) {
            // Save to DB for future use
            await saveQuestionsToDB(questions);
          }
        } catch (aiErr: any) {
          console.error("AI Generation failed:", aiErr);
          alert("No questions found in database and AI generation failed. Please check your API key or try a different selection.");
          return;
        }
      }
      
      if (questions.length === 0) {
        alert("No questions found for these criteria. Try adjusting your selection!");
        return;
      }

      localStorage.setItem('active_exam_questions', JSON.stringify(questions));
      localStorage.setItem('active_exam_config', JSON.stringify({
        type: 'Chapter Practice',
        subject: selectedSubject,
        chapter: selectedChapter,
        topics: selectedTopics,
        duration: (mcqCount + numericalCount) * 2 // 2 minutes per question
      }));
      
      navigate('/exam-portal');
    } catch (err) {
      console.error("Error starting practice:", err);
      alert("An unexpected error occurred. Please try again.");
    } finally {
      setIsPreparing(false);
    }
  };

  const filteredChapters = selectedSubject 
    ? (NCERT_CHAPTERS[selectedSubject as keyof typeof NCERT_CHAPTERS] as any[]).filter(ch => 
        ch.name.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : [];

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
      {/* Header */}
      <div className="space-y-2">
        <div className="flex items-center gap-2 text-indigo-600 font-black text-[10px] uppercase tracking-[0.2em]">
          <BookOpen className="w-3 h-3" />
          <span>Adaptive Learning</span>
        </div>
        <h1 className="text-4xl font-black text-slate-900 tracking-tight">Chapter Practice</h1>
        <p className="text-slate-500 font-medium max-w-2xl">
          Master specific topics with targeted practice sessions. Select a subject and chapter to begin your strategic drill.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Subject Selection */}
        <div className="lg:col-span-4 space-y-6">
          <div className="bg-white rounded-[2.5rem] border border-slate-200 p-8 shadow-xl shadow-slate-200/50 space-y-6">
            <h3 className="text-sm font-black text-slate-900 uppercase tracking-widest flex items-center gap-2">
              <Filter className="w-4 h-4 text-indigo-500" />
              Select Subject
            </h3>
            <div className="space-y-3">
              {subjects.map((sub) => {
                const isActive = selectedSubject === sub;
                const config = SUBJECTS_CONFIG[sub as keyof typeof SUBJECTS_CONFIG];
                return (
                  <button
                    key={sub}
                    onClick={() => {
                      setSelectedSubject(sub);
                      setSelectedChapter(null);
                    }}
                    className={`w-full flex items-center justify-between p-5 rounded-2xl border transition-all duration-300 group ${
                      isActive 
                        ? `${config.bg} ${config.border} shadow-lg shadow-indigo-100` 
                        : 'bg-slate-50 border-transparent hover:border-slate-200'
                    }`}
                  >
                    <div className="flex items-center gap-4">
                      <div className={`p-3 rounded-xl transition-colors ${
                        isActive ? 'bg-white shadow-sm' : 'bg-white'
                      }`}>
                        {sub === 'Physics' && <Atom className={`w-5 h-5 ${config.color}`} />}
                        {sub === 'Chemistry' && <Beaker className={`w-5 h-5 ${config.color}`} />}
                        {sub === 'Mathematics' && <FunctionSquare className={`w-5 h-5 ${config.color}`} />}
                      </div>
                      <span className={`font-black text-sm tracking-tight ${isActive ? config.color : 'text-slate-600'}`}>
                        {sub}
                      </span>
                    </div>
                    <ChevronRight className={`w-4 h-4 transition-transform ${isActive ? 'translate-x-1 opacity-100' : 'opacity-0'}`} />
                  </button>
                );
              })}
            </div>

            {selectedSubject && (
              <div className="pt-6 border-t border-slate-100 space-y-6">
                <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Session Config</h3>
                
                <div className="space-y-4">
                   <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-600">MCQs</span>
                      <span className="text-sm font-black text-indigo-600">{mcqCount}</span>
                   </div>
                   <input 
                      type="range" 
                      min="0" 
                      max="30" 
                      step="5"
                      value={mcqCount}
                      onChange={(e) => setMcqCount(parseInt(e.target.value))}
                      className="w-full h-1.5 bg-slate-100 rounded-lg appearance-none cursor-pointer accent-indigo-600"
                   />
                </div>

                <div className="space-y-4">
                   <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-600">Numericals</span>
                      <span className="text-sm font-black text-indigo-600">{numericalCount}</span>
                   </div>
                   <input 
                      type="range" 
                      min="0" 
                      max="20" 
                      step="5"
                      value={numericalCount}
                      onChange={(e) => setNumericalCount(parseInt(e.target.value))}
                      className="w-full h-1.5 bg-slate-100 rounded-lg appearance-none cursor-pointer accent-indigo-600"
                   />
                </div>

                <div className="bg-indigo-50 p-4 rounded-2xl border border-indigo-100">
                   <div className="flex justify-between items-center">
                      <span className="text-[10px] font-black text-indigo-400 uppercase tracking-widest">Total Questions</span>
                      <span className="text-lg font-black text-indigo-600">{mcqCount + numericalCount}</span>
                   </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Chapter Selection */}
        <div className="lg:col-span-8 space-y-6">
          <div className="bg-white rounded-[2.5rem] border border-slate-200 shadow-xl shadow-slate-200/50 flex flex-col min-h-[500px]">
            <div className="p-8 border-bottom border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-4">
              <h3 className="text-sm font-black text-slate-900 uppercase tracking-widest">
                {selectedSubject ? `${selectedSubject} Chapters` : 'Select a Subject First'}
              </h3>
              {selectedSubject && (
                <div className="relative group">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-indigo-500 transition-colors" />
                  <input 
                    type="text"
                    placeholder="Search chapters..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10 pr-4 py-2 bg-slate-50 border border-slate-100 rounded-xl text-xs font-bold outline-none focus:bg-white focus:ring-4 focus:ring-indigo-500/5 transition-all w-full md:w-64"
                  />
                </div>
              )}
            </div>

            <div className="flex-1 p-4 overflow-y-auto custom-scrollbar max-h-[600px]">
              {!selectedSubject ? (
                <div className="h-full flex flex-col items-center justify-center text-center space-y-4 opacity-40">
                  <div className="bg-slate-100 p-6 rounded-full">
                    <BookOpen className="w-12 h-12 text-slate-400" />
                  </div>
                  <p className="text-sm font-bold text-slate-500 max-w-xs">
                    Choose a subject from the left panel to explore available chapters and start practicing.
                  </p>
                </div>
              ) : filteredChapters.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {filteredChapters.map((ch) => (
                    <button
                      key={ch.name}
                      onClick={() => {
                        setSelectedChapter(ch.name);
                        setSelectedTopics([]); // Reset topics when chapter changes
                      }}
                      className={`flex flex-col items-start p-5 rounded-2xl border transition-all text-left group ${
                        selectedChapter === ch.name
                          ? 'bg-indigo-600 border-indigo-600 text-white shadow-lg shadow-indigo-200'
                          : 'bg-white border-slate-100 hover:border-indigo-200 hover:bg-indigo-50/30'
                      }`}
                    >
                      <span className={`text-xs font-black tracking-tight mb-2 ${selectedChapter === ch.name ? 'text-indigo-100' : 'text-slate-900'}`}>
                        {ch.name}
                      </span>
                      <div className="flex flex-wrap gap-1.5">
                        {ch.topics.slice(0, 2).map((topic: string) => (
                          <span key={topic} className={`text-[9px] font-bold px-2 py-0.5 rounded-md ${
                            selectedChapter === ch.name ? 'bg-white/10 text-white' : 'bg-slate-100 text-slate-400'
                          }`}>
                            {topic}
                          </span>
                        ))}
                        {ch.topics.length > 2 && (
                          <span className={`text-[9px] font-bold px-2 py-0.5 rounded-md ${
                            selectedChapter === ch.name ? 'bg-white/10 text-white' : 'bg-slate-100 text-slate-400'
                          }`}>
                            +{ch.topics.length - 2} more
                          </span>
                        )}
                      </div>
                    </button>
                  ))}
                </div>
              ) : (
                <div className="h-full flex flex-col items-center justify-center text-center space-y-4 opacity-40">
                  <p className="text-sm font-bold text-slate-500">No chapters matching your search.</p>
                </div>
              )}
            </div>

            {selectedChapter && (
              <div className="p-8 border-t border-slate-100 bg-slate-50/50 rounded-b-[2.5rem] space-y-8">
                {/* Topic Selection */}
                <div className="space-y-4">
                   <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Select Topics (Optional)</h4>
                   <div className="flex flex-wrap gap-2">
                      {((NCERT_CHAPTERS[selectedSubject as keyof typeof NCERT_CHAPTERS] as any[]).find(ch => ch.name === selectedChapter)?.topics || []).map((topic: string) => (
                        <button
                          key={topic}
                          onClick={() => {
                            setSelectedTopics(prev => 
                              prev.includes(topic) ? prev.filter(t => t !== topic) : [...prev, topic]
                            );
                          }}
                          className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all border ${
                            selectedTopics.includes(topic)
                              ? 'bg-indigo-600 border-indigo-600 text-white shadow-md'
                              : 'bg-white border-slate-200 text-slate-500 hover:border-indigo-200'
                          }`}
                        >
                          {topic}
                        </button>
                      ))}
                   </div>
                </div>

                <div className="flex flex-col md:flex-row items-center justify-between gap-6 pt-4 border-t border-slate-200">
                  <div className="flex items-center gap-4">
                    <div className="bg-white p-3 rounded-2xl shadow-sm border border-slate-100">
                      <Sparkles className="w-5 h-5 text-indigo-600" />
                    </div>
                    <div>
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Selected Chapter</p>
                      <p className="text-sm font-black text-slate-900">{selectedChapter}</p>
                    </div>
                  </div>
                  <button
                    onClick={handleStartPractice}
                    disabled={isPreparing}
                    className="w-full md:w-auto px-10 py-4 bg-slate-900 text-white rounded-2xl font-black text-sm shadow-xl shadow-slate-200 flex items-center justify-center gap-3 group transition-all hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50"
                  >
                    {isPreparing ? (
                      <>
                        <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        Preparing...
                      </>
                    ) : (
                      <>
                        Start Practice
                        <Play className="w-4 h-4 fill-current group-hover:scale-110 transition-transform" />
                      </>
                    )}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Practice;
