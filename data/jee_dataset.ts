
import { Question, Subject, QuestionType, Difficulty } from "../types";

// Helper functions for random generation
const randomInt = (min: number, max: number) => Math.floor(Math.random() * (max - min + 1)) + min;
const randomFloat = (min: number, max: number, decimals: number = 2) => parseFloat((Math.random() * (max - min) + min).toFixed(decimals));
const randomChoice = <T>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)];

// --- PHYSICS GENERATORS ---

const generateKinematicsQuestion = (): Question => {
  const u = randomInt(0, 20);
  const a = randomInt(1, 10);
  const t = randomInt(2, 10);
  const v = u + a * t;
  const s = u * t + 0.5 * a * t * t;
  
  const type = Math.random() > 0.5 ? 'velocity' : 'displacement';
  
  if (type === 'velocity') {
    return {
      id: `phy-kinematics-${Date.now()}-${Math.random()}`,
      subject: Subject.Physics,
      chapter: "Kinematics",
      type: QuestionType.Numerical,
      difficulty: "Easy",
      statement: `A particle starts with an initial velocity of $${u} \\, m/s$ and accelerates uniformly at $${a} \\, m/s^2$. What is its velocity after $${t}$ seconds?`,
      correctAnswer: v.toString(),
      solution: `Using $v = u + at$: $$v = ${u} + (${a})(${t}) = ${v} \\, m/s$$`,
      explanation: "Equation of motion for constant acceleration.",
      concept: "Kinematics 1D",
      markingScheme: { positive: 4, negative: 0 }
    };
  } else {
    return {
      id: `phy-kinematics-${Date.now()}-${Math.random()}`,
      subject: Subject.Physics,
      chapter: "Kinematics",
      type: QuestionType.Numerical,
      difficulty: "Medium",
      statement: `A car moving with initial velocity $${u} \\, m/s$ accelerates at $${a} \\, m/s^2$ for $${t}$ seconds. Calculate the distance covered.`,
      correctAnswer: s.toString(),
      solution: `Using $s = ut + \\frac{1}{2}at^2$: $$s = (${u})(${t}) + 0.5(${a})(${t}^2) = ${u*t} + ${0.5*a*t*t} = ${s} \\, m$$`,
      explanation: "Second equation of motion.",
      concept: "Kinematics 1D",
      markingScheme: { positive: 4, negative: 0 }
    };
  }
};

const generateElectrostaticsQuestion = (): Question => {
  const q1 = randomInt(2, 10); // microC
  const q2 = randomInt(2, 10); // microC
  const r = randomInt(1, 10); // cm
  // F = 9e9 * q1*e-6 * q2*e-6 / (r*e-2)^2
  // F = 9 * q1 * q2 * 10^-3 / (r^2 * 10^-4) * 10^-9 ?? 
  // F = 9 * 10^9 * q1 * 10^-6 * q2 * 10^-6 / (r * 10^-2)^2
  // F = 9 * q1 * q2 * 10^-3 / (r^2 * 10^-4)
  // F = 90 * q1 * q2 / r^2 Newtons
  
  const F = (90 * q1 * q2) / (r * r);
  const F_rounded = parseFloat(F.toFixed(1));

  return {
    id: `phy-electro-${Date.now()}-${Math.random()}`,
    subject: Subject.Physics,
    chapter: "Electrostatics",
    type: QuestionType.Numerical,
    difficulty: "Medium",
    statement: `Two point charges $q_1 = ${q1} \\mu C$ and $q_2 = ${q2} \\mu C$ are placed $${r} \\, cm$ apart in vacuum. Calculate the electrostatic force between them (in Newtons, rounded to 1 decimal place).`,
    correctAnswer: F_rounded.toString(),
    solution: `$$F = \\frac{k q_1 q_2}{r^2}$$ $$F = \\frac{9 \\times 10^9 \\times ${q1} \\times 10^{-6} \\times ${q2} \\times 10^{-6}}{(${r} \\times 10^{-2})^2}$$ $$F = \\frac{90 \\times ${q1} \\times ${q2}}{${r}^2} = ${F_rounded} N$$`,
    explanation: "Coulomb's Law application.",
    concept: "Coulomb's Law",
    markingScheme: { positive: 4, negative: 0 }
  };
};

// --- CHEMISTRY GENERATORS ---

const generateThermodynamicsQuestion = (): Question => {
  const dH = randomInt(-200, -50); // kJ
  const dS = randomInt(-100, 100); // J/K
  const T = 298; // K
  // dG = dH - TdS
  // dG = dH * 1000 - T * dS (in Joules)
  const dG_J = (dH * 1000) - (T * dS);
  const dG_kJ = dG_J / 1000;
  const dG_rounded = Math.round(dG_kJ);

  return {
    id: `chem-thermo-${Date.now()}-${Math.random()}`,
    subject: Subject.Chemistry,
    chapter: "Thermodynamics",
    type: QuestionType.Numerical,
    difficulty: "Medium",
    statement: `For a reaction at $298 K$, $\\Delta H = ${dH} \\, kJ$ and $\\Delta S = ${dS} \\, J/K$. Calculate $\\Delta G$ in $kJ$ (rounded to nearest integer).`,
    correctAnswer: dG_rounded.toString(),
    solution: `$$\\Delta G = \\Delta H - T\\Delta S$$ $$\\Delta G = ${dH} \\times 1000 - 298 \\times ${dS}$$ $$\\Delta G = ${dH * 1000} - ${298 * dS} = ${dG_J} J$$ $$\\Delta G \\approx ${dG_rounded} kJ$$`,
    explanation: "Gibbs Free Energy equation.",
    concept: "Chemical Thermodynamics",
    markingScheme: { positive: 4, negative: 0 }
  };
};

const generateSolutionsQuestion = (): Question => {
  const massSolute = randomInt(2, 20); // g
  const molarMass = randomChoice([40, 60, 180, 342]); // NaOH, Urea, Glucose, Sucrose
  const volSol = randomInt(100, 500); // mL
  
  // M = (mass / molarMass) / (vol / 1000)
  const moles = massSolute / molarMass;
  const M = moles / (volSol / 1000);
  const M_rounded = parseFloat(M.toFixed(2));

  return {
    id: `chem-sol-${Date.now()}-${Math.random()}`,
    subject: Subject.Chemistry,
    chapter: "Solutions",
    type: QuestionType.Numerical,
    difficulty: "Easy",
    statement: `Calculate the molarity of a solution containing $${massSolute} g$ of a solute (Molar Mass = $${molarMass} g/mol$) in $${volSol} mL$ of solution.`,
    correctAnswer: M_rounded.toString(),
    solution: `$$M = \\frac{n}{V(L)} = \\frac{${massSolute}/${molarMass}}{${volSol}/1000} = \\frac{${moles.toFixed(3)}}{${volSol / 1000}} = ${M_rounded} M$$`,
    explanation: "Definition of Molarity.",
    concept: "Concentration Terms",
    markingScheme: { positive: 4, negative: 0 }
  };
};

// --- MATH GENERATORS ---

const generateQuadraticQuestion = (): Question => {
  const alpha = randomInt(-5, 5);
  const beta = randomInt(-5, 5);
  // x^2 - (alpha+beta)x + alpha*beta = 0
  const sum = alpha + beta;
  const prod = alpha * beta;
  
  const askSum = Math.random() > 0.5;

  return {
    id: `math-quad-${Date.now()}-${Math.random()}`,
    subject: Subject.Mathematics,
    chapter: "Quadratic Equations",
    type: QuestionType.Numerical,
    difficulty: "Easy",
    statement: `If $\\alpha$ and $\\beta$ are the roots of the equation $x^2 - (${sum})x + (${prod}) = 0$, find the value of ${askSum ? '$\\alpha + \\beta$' : '$\\alpha \\beta$'}.`,
    correctAnswer: (askSum ? sum : prod).toString(),
    solution: `For $ax^2 + bx + c = 0$, sum of roots = $-b/a$ and product = $c/a$. Here $a=1, b=-(${sum}), c=${prod}$. So sum = ${sum}, product = ${prod}.`,
    explanation: "Properties of roots of quadratic equation.",
    concept: "Quadratic Equations",
    markingScheme: { positive: 4, negative: 0 }
  };
};

const generateAPQuestion = (): Question => {
  const a = randomInt(1, 10);
  const d = randomInt(2, 5);
  const n = randomInt(5, 20);
  // Tn = a + (n-1)d
  const Tn = a + (n - 1) * d;

  return {
    id: `math-ap-${Date.now()}-${Math.random()}`,
    subject: Subject.Mathematics,
    chapter: "Sequences and Series",
    type: QuestionType.Numerical,
    difficulty: "Easy",
    statement: `Find the $${n}^{th}$ term of the Arithmetic Progression: $${a}, ${a+d}, ${a+2*d}, ...$`,
    correctAnswer: Tn.toString(),
    solution: `$$T_n = a + (n-1)d$$ $$T_{${n}} = ${a} + (${n}-1)(${d}) = ${a} + ${n-1} \\times ${d} = ${Tn}$$`,
    explanation: "Nth term of an AP.",
    concept: "Arithmetic Progression",
    markingScheme: { positive: 4, negative: 0 }
  };
};

// --- MAIN GENERATOR FUNCTION ---

export const getLocalQuestions = (subject: Subject, count: number): Question[] => {
  const questions: Question[] = [];
  
  for (let i = 0; i < count; i++) {
    let q: Question;
    switch (subject) {
      case Subject.Physics:
        q = Math.random() > 0.5 ? generateKinematicsQuestion() : generateElectrostaticsQuestion();
        break;
      case Subject.Chemistry:
        q = Math.random() > 0.5 ? generateThermodynamicsQuestion() : generateSolutionsQuestion();
        break;
      case Subject.Mathematics:
        q = Math.random() > 0.5 ? generateQuadraticQuestion() : generateAPQuestion();
        break;
      default:
        q = generateKinematicsQuestion(); // Fallback
    }
    questions.push(q);
  }
  
  return questions;
};

// Keep a minimal static export if needed for type compatibility, but it's effectively replaced
export const STATIC_QUESTION_BANK: Question[] = []; 
