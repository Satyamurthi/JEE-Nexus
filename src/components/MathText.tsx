
import { FC } from 'react';

interface MathTextProps {
  children: string;
  className?: string;
}

const MathText: FC<MathTextProps> = ({ children, className = '' }) => {
  // Simple implementation: just render the text. 
  // In a real app, this would use KaTeX or MathJax to render LaTeX.
  return (
    <span className={`math-text ${className}`}>
      {children}
    </span>
  );
};

export default MathText;
