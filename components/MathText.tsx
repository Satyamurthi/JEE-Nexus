
import React, { useMemo } from 'react';

interface MathTextProps {
  text: string;
  className?: string;
  isBlock?: boolean;
}

/**
 * Robust MathText component that manually parses and renders LaTeX using KaTeX.
 * Optimized with useMemo to prevent unnecessary re-renders.
 * Supports $...$, $$...$$, \(...\), \[...\].
 * Auto-detects raw LaTeX commands (like \frac) even if delimiters are missing or malformed.
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
      // 1. Normalize line breaks
      let sanitizedText = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

      // 2. Fix common AI latex escape issues
      // Often AI sends "\\frac" (double backslash in string) which renders as literal \frac
      // We safely reduce double backslashes for common commands
      sanitizedText = sanitizedText
        .replace(/\\\\(frac|sqrt|sum|int|vec|hat|bar|pm|infty|partial|alpha|beta|gamma|theta|pi|sigma|Delta|nabla|times|cdot|approx|leq|geq|ne|text|mathbf|mathcal)/g, '\\$1')
        .replace(/\\\\\[/g, '\\[')
        .replace(/\\\\\]/g, '\\]')
        .replace(/\\\\\(/g, '\\(')
        .replace(/\\\\\)/g, '\\)');

      // 3. Regex to split content by VALID math delimiters
      const delimiterRegex = /((?:\$\$[\s\S]*?\$\$)|(?:\\\[[\s\S]*?\\\])|(?:\\begin\{[a-zA-Z0-9*]+\}[\s\S]*?\\end\{[a-zA-Z0-9*]+\})|(?:\$[\s\S]*?\$)|(?:\\\([\s\S]*?\\\)))/g;
      
      const hasValidDelimiters = delimiterRegex.test(sanitizedText);
      delimiterRegex.lastIndex = 0; // Reset regex index

      // 4. Auto-wrap raw LaTeX if no valid delimiters found
      if (!hasValidDelimiters) {
          let raw = sanitizedText.trim();
          
          // Fix partial/malformed delimiters (e.g., "x^2$" or "$x^2")
          let modified = false;
          if (raw.endsWith('$') && !raw.startsWith('$')) {
              raw = raw.slice(0, -1);
              modified = true;
          } else if (raw.startsWith('$') && !raw.endsWith('$')) {
              raw = raw.slice(1);
              modified = true;
          }

          // Heuristic: If it contains backslash commands or {} groups with math symbols
          const isLatex = /\\(frac|sqrt|sum|int|vec|hat|bar|pm|infty|partial|alpha|beta|gamma|theta|pi|sigma|Delta|nabla|times|cdot|approx|leq|geq|ne|circ|angle|triangle|text|mathbf|mathcal)/.test(raw) || 
                          (/[\^_]/.test(raw) && /[{}]/.test(raw)) ||
                          raw.startsWith('\\');
          
          if (isLatex || modified) {
              sanitizedText = `$${raw}$`;
          }
      }
      
      const parts = sanitizedText.split(delimiterRegex);
      
      return parts.map((part) => {
        if (!part) return '';
        
        // Determine if this part is a math block
        const isDisplayMath = 
          (part.startsWith('$$') && part.endsWith('$$')) ||
          (part.startsWith('\\[') && part.endsWith('\\]')) ||
          (part.startsWith('\\begin') && part.endsWith('}')); 

        const isInlineMath = 
          (part.startsWith('$') && part.endsWith('$')) ||
          (part.startsWith('\\(') && part.endsWith('\\)'));

        if (isDisplayMath || isInlineMath) {
            let content = part;
            
            if (part.startsWith('$$')) content = part.slice(2, -2);
            else if (part.startsWith('\\[')) content = part.slice(2, -2);
            else if (part.startsWith('$')) content = part.slice(1, -1);
            else if (part.startsWith('\\(')) content = part.slice(2, -2);
            
            // Render
            const renderOptions = {
                 throwOnError: false, 
                 trust: true, 
                 strict: false,
                 output: 'html', 
                 displayMode: isDisplayMath || isBlock,
                 globalGroup: true,
                 macros: {
                    "\\RR": "\\mathbb{R}",
                    "\\NN": "\\mathbb{N}",
                    "\\ZZ": "\\mathbb{Z}",
                    "\\QQ": "\\mathbb{Q}",
                    "\\CC": "\\mathbb{C}"
                 }
            };

            try {
                return katex.renderToString(content, renderOptions);
            } catch (katexErr) {
                // console.warn("KaTeX render error:", katexErr);
                return `<span class="text-red-500 font-mono text-xs break-all" title="Render Error">${part}</span>`;
            }
        }
        
        // Plain Text - escape HTML and handle newlines
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
