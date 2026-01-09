
import React, { useMemo } from 'react';

interface MathTextProps {
  text: string;
  className?: string;
  isBlock?: boolean;
}

/**
 * Robust MathText component that manually parses and renders LaTeX using KaTeX.
 * Optimized with useMemo to prevent unnecessary re-renders.
 * Supports $...$, $$...$$, \(...\), \[...\], and generic \begin{env}...\end{env} blocks.
 * Also auto-detects raw LaTeX commands (like \frac) missing delimiters.
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

      // 2. Fix common AI latex escape issues (delimiters)
      sanitizedText = sanitizedText
        .replace(/\\\\\[/g, '\\[')
        .replace(/\\\\\]/g, '\\]')
        .replace(/\\\\\(/g, '\\(')
        .replace(/\\\\\)/g, '\\)');

      // 3. Auto-detect raw LaTeX patterns if no delimiters found
      // This fixes cases where AI returns raw "\frac{x}{y}" without "$"
      const hasDelimiters = /\$\$|\\\[|\\\(|\$/.test(sanitizedText);
      if (!hasDelimiters) {
          // Heuristic: If it contains backslash commands or {} groups with math symbols
          const isLatex = /\\(frac|sqrt|sum|int|vec|hat|bar|pm|infty|partial|alpha|beta|gamma|theta|pi|sigma|Delta|nabla|times|cdot|approx|leq|geq|ne)/.test(sanitizedText) || 
                          (/[\^_]/.test(sanitizedText) && /[{}]/.test(sanitizedText));
          
          if (isLatex) {
              sanitizedText = `$${sanitizedText}$`;
          }
      }
      
      // 4. Regex to split content by math delimiters
      const regex = /((?:\$\$[\s\S]*?\$\$)|(?:\\\[[\s\S]*?\\\])|(?:\\begin\{[a-zA-Z0-9*]+\}[\s\S]*?\\end\{[a-zA-Z0-9*]+\})|(?:\$[\s\S]*?\$)|(?:\\\([\s\S]*?\\\)))/g;
      
      const parts = sanitizedText.split(regex);
      
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
            
            // Critical: Ensure throwOnError is false and trust is true to prevent errors in quirks mode or with unknown macros
            const renderOptions = {
                 throwOnError: false, 
                 trust: true, 
                 strict: false,
                 output: 'html', // Ensure HTML output for maximum compatibility
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
                console.warn("KaTeX render error:", katexErr);
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
