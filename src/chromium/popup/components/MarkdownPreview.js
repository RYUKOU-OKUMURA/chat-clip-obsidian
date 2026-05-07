import React, { useMemo, useState } from 'react';

const escapeHtml = (text) => {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
};

const MarkdownPreview = ({ content, isLoading = false, maxHeight = '400px', darkMode = false }) => {
  const [isExpanded, setIsExpanded] = useState(false);

  const formattedContent = useMemo(() => {
    // Simple markdown formatting for preview
    if (!content) return '';

    let formatted = content;

    // Headers
    formatted = formatted.replace(/^### (.+)$/gm, `<h3 class=\"text-lg font-semibold mt-4 mb-2 ${darkMode ? 'text-gray-200' : 'text-gray-800'}\">$1</h3>`);
    formatted = formatted.replace(/^## (.+)$/gm, `<h2 class=\"text-xl font-bold mt-4 mb-2 ${darkMode ? 'text-gray-100' : 'text-gray-900'}\">$1</h2>`);
    formatted = formatted.replace(/^# (.+)$/gm, `<h1 class=\"text-2xl font-bold mt-4 mb-3 ${darkMode ? 'text-white' : 'text-gray-900'}\">$1</h1>`);

    // Code blocks
    formatted = formatted.replace(/```(\w+)?\n([\s\S]*?)```/g, (match, lang, code) => {
      return `<div class=\"rounded-md p-3 my-2 overflow-x-auto ${darkMode ? 'bg-gray-900' : 'bg-gray-100'}\">
          <code class=\"text-sm font-mono ${darkMode ? 'text-gray-300' : 'text-gray-800'}\">${escapeHtml(code.trim())}</code>
        </div>`;
    });

    // Inline code
    formatted = formatted.replace(/`([^`]+)`/g, `<code class=\"px-1 py-0.5 rounded text-sm ${darkMode ? 'bg-gray-700 text-gray-300' : 'bg-gray-100 text-gray-800'}\">$1</code>`);

    // Bold
    formatted = formatted.replace(/\*\*([^\*]+)\*\*/g, `<strong class=\"font-semibold ${darkMode ? 'text-gray-100' : 'text-gray-900'}\">$1</strong>`);

    // Italic
    formatted = formatted.replace(/\*([^\*]+)\*/g, '<em class="italic">$1</em>');

    // Links
    formatted = formatted.replace(/\[([^\]]+)\]\(([^)]+)\)/g, `<a href=\"$2\" class=\"hover:underline ${darkMode ? 'text-blue-400' : 'text-blue-600'}\">$1</a>`);

    // Line breaks
    formatted = formatted.replace(/\n/g, '<br />');

    // Math blocks (basic support)
    formatted = formatted.replace(/\$\$([\s\S]*?)\$\$/g, `<div class=\"p-2 my-2 rounded font-mono text-sm ${darkMode ? 'bg-gray-800 text-green-400' : 'bg-gray-100 text-green-700'}\">$1</div>`);

    return formatted;
  }, [content, darkMode]);

  if (isLoading) {
    return (
      <div className={`rounded-lg p-4 animate-pulse ${darkMode ? 'bg-gray-800' : 'bg-gray-100'}`}>
        <div className={`h-4 rounded w-3/4 mb-2 ${darkMode ? 'bg-gray-700' : 'bg-gray-200'}`}></div>
        <div className={`h-4 rounded w-full mb-2 ${darkMode ? 'bg-gray-700' : 'bg-gray-200'}`}></div>
        <div className={`h-4 rounded w-5/6 ${darkMode ? 'bg-gray-700' : 'bg-gray-200'}`}></div>
      </div>
    );
  }

  if (!content) {
    return (
      <div className={`rounded-lg p-4 text-center ${darkMode ? 'bg-gray-800 text-gray-500' : 'bg-gray-50 text-gray-600'}`}>
        <svg className={`w-12 h-12 mx-auto mb-2 ${darkMode ? 'text-gray-600' : 'text-gray-400'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
        <p className="text-sm">プレビューするコンテンツがありません</p>
        <p className={`text-xs mt-1 ${darkMode ? 'text-gray-600' : 'text-gray-500'}`}>保存モードを選択してプレビューを表示</p>
      </div>
    );
  }

  return (
    <div className={`rounded-lg overflow-hidden ${darkMode ? 'bg-gray-800' : 'bg-white border border-gray-200'}`}>
      <div className={`px-4 py-3 flex justify-between items-center border-b ${darkMode ? 'bg-gray-900 border-gray-700' : 'bg-gray-50 border-gray-200'}`}>
        <h4 id="preview-heading" className={`text-sm font-medium ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>Markdown プレビュー</h4>
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          aria-expanded={isExpanded}
          aria-controls="preview-content"
          aria-label={isExpanded ? "プレビューを折りたたむ" : "プレビューを展開"}
          className={`transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 rounded ${darkMode ? 'text-gray-400 hover:text-white focus:ring-offset-gray-900' : 'text-gray-500 hover:text-gray-700 focus:ring-offset-gray-100'}`}
        >
          {isExpanded ? (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          ) : (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
            </svg>
          )}
        </button>
      </div>
      
      <div 
        id="preview-content"
        role="region"
        aria-labelledby="preview-heading"
        aria-live="polite"
        className={`p-4 overflow-y-auto transition-all duration-300 ${
          isExpanded ? 'max-h-none' : ''
        }`}
        style={{ maxHeight: isExpanded ? 'none' : maxHeight }}
      >
        <div className={`prose prose-sm max-w-none ${darkMode ? 'prose-invert' : ''}`}>
          <div 
            className="text-gray-300 break-words"
            dangerouslySetInnerHTML={{ __html: formattedContent }}
          />
        </div>
      </div>

      {!isExpanded && content.length > 500 && (
        <div className="px-4 py-2 bg-gradient-to-t from-gray-800 to-transparent">
                  <button
          onClick={() => setIsExpanded(true)}
          aria-label="プレビューの全内容を表示"
          className="text-xs text-blue-400 hover:text-blue-300 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-gray-800 rounded"
        >
          もっと表示...
        </button>
        </div>
      )}

      <div className="px-4 py-2 bg-gray-900 border-t border-gray-700">
        <div className="flex items-center justify-between text-xs text-gray-500">
          <span>{content.length} 文字</span>
          <span>{content.split('\n').length} 行</span>
        </div>
      </div>
    </div>
  );
};

export default MarkdownPreview;
