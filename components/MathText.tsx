
import React, { useMemo } from 'react';

interface MathTextProps {
  text: string;
  className?: string;
  isBlock?: boolean;
}

/**
 * Robust MathText component that manually parses and renders LaTeX using KaTeX.
 * Supports $...$, $$...$$, \(...\), \[...\].
 * Auto-detects and renders raw LaTeX commands in text (like \frac, \int) even if delimiters are missing.
 */
const MathText: React.FC<MathTextProps> = ({ text, className, isBlock = false }) => {
  const htmlContent = useMemo(() => {
    if (!text) return '';

    const katex = (window as any).katex;
    // Fallback if KaTeX isn't loaded
    if (!katex) {
        return text.replace(/\n/g, '<br/>');
    }

    try {
      // 1. Normalize line breaks and unescape dollars
      let sanitizedText = text
        .replace(/\r\n/g, '\n')
        .replace(/\r/g, '\n')
        .replace(/\\\\\$/g, '$') // Unescape \\$ -> $
        .replace(/\\\$/g, '$');  // Unescape \$ -> $

      // Comprehensive list of LaTeX commands to detect/fix
      const cmdList = "frac|sqrt|sum|int|vec|hat|bar|pm|infty|partial|alpha|beta|gamma|delta|epsilon|zeta|eta|theta|iota|kappa|lambda|mu|nu|xi|omicron|pi|rho|sigma|tau|upsilon|phi|chi|psi|omega|Delta|Gamma|Theta|Lambda|Xi|Pi|Sigma|Phi|Psi|Omega|nabla|times|cdot|approx|leq|geq|ne|equiv|ll|gg|propto|rightarrow|leftarrow|leftrightarrow|to|mapsto|infty|deg|angle|triangle|text|mathbf|mathcal|mathrm|sin|cos|tan|cot|csc|sec|log|ln|exp|circ";

      // 2. Fix common AI latex escape issues (double backslashes)
      const doubleEscapeRegex = new RegExp(`\\\\\\\\(${cmdList})`, 'g');
      sanitizedText = sanitizedText
        .replace(doubleEscapeRegex, '\\$1')
        .replace(/\\\\\[/g, '\\[')
        .replace(/\\\\\]/g, '\\]')
        .replace(/\\\\\(/g, '\\(')
        .replace(/\\\\\)/g, '\\)');

      // 3. Regex to split content by VALID math delimiters
      // Matches: $$...$$, \[...\], \begin{}...\end{}, $...$, \(...\)
      const delimiterRegex = /((?:\$\$[\s\S]*?\$\$)|(?:\\\[[\s\S]*?\\\])|(?:\\begin\{[a-zA-Z0-9*]+\}[\s\S]*?\\end\{[a-zA-Z0-9*]+\})|(?:\$[\s\S]*?\$)|(?:\\\([\s\S]*?\\\)))/g;
      
      const parts = sanitizedText.split(delimiterRegex);
      
      // Regex to detect "naked" LaTeX in text parts
      const isLatexRegex = new RegExp(`\\\\(${cmdList})|[\\^_]\{`);

      return parts.map((part) => {
        if (!part) return '';
        
        // A. If this part is a delimiter-wrapped block, render it
        if (part.match(/^(\$\$|\\\[|\\\(|\$|\\begin)/)) {
            let content = part;
            let displayMode = part.startsWith('$$') || part.startsWith('\\[');
            
            if (part.startsWith('$$')) content = part.slice(2, -2);
            else if (part.startsWith('\\[')) content = part.slice(2, -2);
            else if (part.startsWith('$')) content = part.slice(1, -1);
            else if (part.startsWith('\\(')) content = part.slice(2, -2);
            else if (part.startsWith('\\begin')) displayMode = true;

            try {
                return katex.renderToString(content, { 
                    throwOnError: false, 
                    trust: true, 
                    strict: false, 
                    displayMode: displayMode || isBlock,
                    globalGroup: true
                });
            } catch (katexErr) {
                // Return escaped raw text instead of red error block to keep UI clean
                return part
                  .replace(/&/g, '&amp;')
                  .replace(/</g, '&lt;')
                  .replace(/>/g, '&gt;');
            }
        }
        
        // B. If it's a Text part, check for un-delimited LaTeX
        let raw = part;
        
        // Heuristic: If it contains LaTeX commands but wasn't caught by delimiter regex, it's likely missing delimiters.
        // We also clean up "orphan" dollars (e.g. "Value is $50" -> keep as is unless latex found. "Equation $ x^2" -> fix).
        
        // Check for latex patterns
        if (isLatexRegex.test(raw)) {
             // It has LaTeX commands. Treat this whole text chunk as math.
             // Remove ALL orphan/broken delimiters (like single $) that confuse KaTeX or indicate broken generation
             let cleanRaw = raw.replace(/\$/g, '');
             
             try {
                 return katex.renderToString(cleanRaw, { 
                    throwOnError: false, 
                    trust: true, 
                    strict: false,
                    displayMode: false 
                 });
             } catch (e) {
                 // If rendering fails, fallback to text
             }
        }

        // C. Plain text - HTML escape
        return part
          .replace(/&/g, '&amp;')
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;')
          .replace(/\n/g, '<br />');
      }).join('');
    } catch (e) {
      console.warn("Math processing error:", e);
      return text.replace(/\n/g, '<br/>');
    }
  }, [text, isBlock]);

  return (
    <div 
      className={`math-content prose prose-slate max-w-none ${className || ''}`} 
      dangerouslySetInnerHTML={{ __html: htmlContent }} 
    />
  );
};

export default MathText;
