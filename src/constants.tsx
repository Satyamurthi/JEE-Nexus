

import { Brain, Target, History, Settings, ChevronRight, LayoutGrid, BookOpen, Clock, Activity, Award, User, LogOut, Flame, CalendarClock } from 'lucide-react';

export const APP_NAME = "JEE Nexus AI";

export const SUBJECTS_CONFIG = {
  Physics: { color: 'text-blue-600', bg: 'bg-blue-50', border: 'border-blue-200' },
  Chemistry: { color: 'text-green-600', bg: 'bg-green-50', border: 'border-green-200' },
  Mathematics: { color: 'text-purple-600', bg: 'bg-purple-50', border: 'border-purple-200' }
};

export const NCERT_CHAPTERS = {
  Physics: [
    { name: "Units and Measurements", topics: ["Dimensions", "Errors in Measurement", "Significant Figures"] },
    { name: "Kinematics", topics: ["Motion in a Straight Line", "Vectors", "Projectile Motion", "Relative Velocity"] },
    { name: "Laws of Motion", topics: ["Newton's Laws", "Friction", "Circular Motion"] },
    { name: "Work, Energy and Power", topics: ["Work-Energy Theorem", "Potential Energy", "Collisions"] },
    { name: "Rotational Motion", topics: ["Moment of Inertia", "Torque", "Angular Momentum", "Rolling Motion"] },
    { name: "Gravitation", topics: ["Kepler's Laws", "Gravitational Field", "Escape Velocity", "Satellite Motion"] },
    { name: "Thermodynamics", topics: ["Laws of Thermodynamics", "Heat Engines", "Carnot Cycle"] },
    { name: "Kinetic Theory", topics: ["Ideal Gas Equation", "Maxwell's Distribution", "Degrees of Freedom"] },
    { name: "Oscillations", topics: ["Simple Harmonic Motion", "Damped Oscillations", "Forced Oscillations"] },
    { name: "Waves", topics: ["Wave Equation", "Superposition", "Doppler Effect", "Standing Waves"] },
    { name: "Electrostatics", topics: ["Coulomb's Law", "Electric Field", "Gauss's Law", "Capacitors"] },
    { name: "Current Electricity", topics: ["Ohm's Law", "Kirchhoff's Laws", "Potentiometer"] },
    { name: "Magnetism", topics: ["Biot-Savart Law", "Ampere's Law", "Magnetic Force", "Earth's Magnetism"] },
    { name: "Optics", topics: ["Reflection & Refraction", "Interference", "Diffraction", "Polarization"] },
    { name: "Modern Physics", topics: ["Photoelectric Effect", "Bohr's Model", "Nuclei", "Semiconductors"] }
  ],
  Chemistry: [
    { name: "Basic Concepts", topics: ["Mole Concept", "Stoichiometry", "Concentration Terms"] },
    { name: "Structure of Atom", topics: ["Quantum Numbers", "Bohr's Model", "Heisenberg's Principle", "Aufbau Principle"] },
    { name: "Classification of Elements", topics: ["Periodic Trends", "Ionization Enthalpy", "Electron Gain Enthalpy"] },
    { name: "Chemical Bonding", topics: ["VSEPR Theory", "Hybridization", "Molecular Orbital Theory"] },
    { name: "States of Matter", topics: ["Gas Laws", "van der Waals Equation", "Liquid State"] },
    { name: "Thermodynamics", topics: ["Enthalpy", "Entropy", "Gibbs Free Energy"] },
    { name: "Equilibrium", topics: ["Le Chatelier's Principle", "pH and Buffers", "Solubility Product"] },
    { name: "Redox Reactions", topics: ["Oxidation Number", "Balancing Redox Reactions"] },
    { name: "Organic Chemistry Basics", topics: ["Nomenclature", "Isomerism", "Electronic Effects"] },
    { name: "Hydrocarbons", topics: ["Alkanes", "Alkenes", "Alkynes", "Aromatic Hydrocarbons"] },
    { name: "Solutions", topics: ["Colligative Properties", "Raoult's Law", "van't Hoff Factor"] },
    { name: "Electrochemistry", topics: ["Nernst Equation", "Electrolytic Cells", "Conductance"] },
    { name: "Chemical Kinetics", topics: ["Rate Law", "Arrhenius Equation", "First-Order Reactions"] },
    { name: "Coordination Compounds", topics: ["Werner's Theory", "Crystal Field Theory", "Isomerism in Coordination Compounds"] }
  ],
  Mathematics: [
    { name: "Sets and Functions", topics: ["Sets", "Relations", "Functions", "Types of Functions"] },
    { name: "Trigonometry", topics: ["Trigonometric Ratios", "Trigonometric Equations", "Inverse Trigonometry"] },
    { name: "Algebra", topics: ["Complex Numbers", "Quadratic Equations", "Matrices & Determinants"] },
    { name: "Permutations and Combinations", topics: ["Fundamental Principle of Counting", "Permutations", "Combinations"] },
    { name: "Binomial Theorem", topics: ["Binomial Expansion", "General Term", "Properties of Binomial Coefficients"] },
    { name: "Sequences and Series", topics: ["Arithmetic Progression", "Geometric Progression", "Harmonic Progression"] },
    { name: "Coordinate Geometry", topics: ["Straight Lines", "Circles", "Parabola", "Ellipse", "Hyperbola"] },
    { name: "Calculus (Limits, Derivatives)", topics: ["Limits & Continuity", "Methods of Differentiation", "Applications of Derivatives"] },
    { name: "Integration", topics: ["Indefinite Integration", "Definite Integration", "Area Under Curves"] },
    { name: "Differential Equations", topics: ["Order and Degree", "Methods of Solving", "Linear Differential Equations"] },
    { name: "Vectors and 3D Geometry", topics: ["Vectors", "Lines in 3D", "Planes in 3D"] },
    { name: "Probability", topics: ["Conditional Probability", "Bayes' Theorem", "Binomial Distribution"] },
  ]
};

export const MENU_ITEMS = [
  { id: 'dashboard', label: 'Dashboard', icon: <LayoutGrid className="w-5 h-5" />, path: '/' },
  { id: 'daily', label: 'Daily Challenge', icon: <CalendarClock className="w-5 h-5" />, path: '/daily' },
  { id: 'exam-setup', label: 'Full Exam', icon: <Target className="w-5 h-5" />, path: '/exam-setup' },
  { id: 'practice', label: 'Chapter Practice', icon: <BookOpen className="w-5 h-5" />, path: '/practice' },
  { id: 'history', label: 'History', icon: <History className="w-5 h-5" />, path: '/history' },
  { id: 'analysis', label: 'AI Analytics', icon: <Activity className="w-5 h-5" />, path: '/analytics' },
  { id: 'admin', label: 'Admin Panel', icon: <Settings className="w-5 h-5" />, path: '/admin' },
];
