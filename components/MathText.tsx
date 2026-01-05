import React, { useMemo } from 'react';

interface MathTextProps {
  text: string;
  className?: string;
}

/**
 * Robust MathText component that manually parses and renders LaTeX using KaTeX.
 * Optimized with useMemo to prevent unnecessary re-renders.
 * Supports $...$, $$...$$, \(...\), and \[...\] delimiters.
 * Handles escaped backslashes from JSON and mhchem \ce{} commands.
 */
const MathText: React.FC<MathTextProps> = ({ text, className }) => {
  const htmlContent = useMemo(() => {
    if (!text) return '';

    const katex = (window as any).katex;
    // Fallback if KaTeX isn't loaded (e.g. network error on CDN)
    if (!katex) {
        return text.replace(/\n/g, '<br/>');
    }

    try {
      // Common LaTeX/LLM cleanup:
      // Replace double backslashes that might be escaped in JSON (\\ -> \)
      // This is crucial because Gemini JSON output often escapes backslashes (e.g. \\frac)
      let sanitizedText = text.replace(/\\\\/g, '\\');

      // Split text by math delimiters: 
      // $$...$$ (Display)
      // $...$ (Inline)
      // \[...\] (Display)
      // \(...\) (Inline)
      const parts = sanitizedText.split(/(\$\$.*?\$\$|\$.*?\$|\\\[.*?\\\]|\\\(.*?\\\))/gs);
      
      return parts.map((part) => {
        if (!part) return '';
        
        // Default options for KaTeX
        const renderOptions = {
             throwOnError: false, 
             trust: true, // Allows \ce and other macros
             strict: false,
             globalGroup: true
        };

        try {
          // Display Math $$...$$
          if (part.startsWith('$$') && part.endsWith('$$')) {
            const formula = part.slice(2, -2);
            return katex.renderToString(formula, { ...renderOptions, displayMode: true });
          } 
          // Inline Math $...$
          else if (part.startsWith('$') && part.endsWith('$')) {
            const formula = part.slice(1, -1);
            return katex.renderToString(formula, { ...renderOptions, displayMode: false });
          }
          // Display Math \[...\]
          else if (part.startsWith('\\[') && part.endsWith('\\]')) {
            const formula = part.slice(2, -2);
            return katex.renderToString(formula, { ...renderOptions, displayMode: true });
          }
          // Inline Math \(...\)
          else if (part.startsWith('\\(') && part.endsWith('\\)')) {
            const formula = part.slice(2, -2);
            return katex.renderToString(formula, { ...renderOptions, displayMode: false });
          }
        } catch (katexErr) {
          console.warn("KaTeX render error for part:", part, katexErr);
          // Fallback: return the raw LaTeX code if rendering fails
          return `<span class="text-red-500 font-mono text-xs" title="${String(katexErr)}">${part}</span>`;
        }
        
        // Plain Text - escape HTML and handle newlines
        // We do NOT process LaTeX here, only plain text surrounding it
        return part
          .replace(/&/g, '&amp;')
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;')
          .replace(/\n/g, '<br />');
      }).join('');
    } catch (e) {
      console.warn("Math rendering error:", e);
      return text.replace(/\n/g, '<br/>');
    }
  }, [text]);

  return (
    <div 
      className={className} 
      dangerouslySetInnerHTML={{ __html: htmlContent }} 
    />
  );
};

export default MathText;