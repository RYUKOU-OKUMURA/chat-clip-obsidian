import React, { useState, useEffect, useMemo } from 'react';
import {
  RECENT_COUNT_MIN,
  RECENT_COUNT_MAX,
  clampRecentCount,
  isValidRecentCount
} from './recentCount';

const ChatModeSelector = ({
  onModeChange,
  onCountChange,
  onCountValidityChange,
  defaultMode = 'single',
  defaultCount = 30,
  darkMode = false
}) => {
  const [selectedMode, setSelectedMode] = useState(defaultMode);
  const [messageCountInput, setMessageCountInput] = useState(String(clampRecentCount(defaultCount)));
  const isCountValid = useMemo(() => isValidRecentCount(messageCountInput), [messageCountInput]);

  const modes = [
    {
      id: 'single',
      name: '最新メッセージ',
      description: '最新の1件を保存',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" />
        </svg>
      )
    },
    {
      id: 'selection',
      name: '選択テキスト',
      description: 'ハイライトしたテキストのみ保存',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
      )
    },
    {
      id: 'recent',
      name: '最新N件',
      description: '最新のN件のメッセージを保存',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
        </svg>
      ),
      hasCount: true
    },
    {
      id: 'full',
      name: '全会話',
      description: 'チャット全体を保存',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
      )
    }
  ];

  useEffect(() => {
    if (onModeChange) {
      onModeChange(selectedMode);
    }
  }, [selectedMode, onModeChange]);

  useEffect(() => {
    const valid = selectedMode !== 'recent' || isCountValid;
    if (onCountValidityChange) {
      onCountValidityChange(valid);
    }
    if (onCountChange && selectedMode === 'recent' && isCountValid) {
      onCountChange(Number(messageCountInput));
    }
  }, [isCountValid, messageCountInput, selectedMode, onCountChange, onCountValidityChange]);

  useEffect(() => {
    setSelectedMode(defaultMode);
  }, [defaultMode]);

  useEffect(() => {
    setMessageCountInput(String(clampRecentCount(defaultCount)));
  }, [defaultCount]);

  const handleModeSelect = (modeId) => {
    setSelectedMode(modeId);
  };

  const handleCountChange = (e) => {
    setMessageCountInput(e.target.value);
  };

  const handleCountBlur = () => {
    if (!isCountValid) return;
    setMessageCountInput(String(clampRecentCount(messageCountInput)));
  };

  return (
    <div className="space-y-4">
      <h3 id="save-mode-heading" className={`text-lg font-semibold mb-3 ${darkMode ? 'text-white' : 'text-gray-900'}`}>保存モード</h3>
      
      <div 
        className="grid grid-cols-2 gap-3"
        role="radiogroup"
        aria-labelledby="save-mode-heading"
        aria-describedby="save-mode-description"
      >
        {modes.map((mode) => (
          <button
            key={mode.id}
            onClick={() => handleModeSelect(mode.id)}
            role="radio"
            aria-checked={selectedMode === mode.id}
            aria-describedby={`${mode.id}-description`}
            tabIndex={selectedMode === mode.id ? 0 : -1}
            onKeyDown={(e) => {
              if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
                e.preventDefault();
                const currentIndex = modes.findIndex(m => m.id === selectedMode);
                const nextIndex = (currentIndex + 1) % modes.length;
                handleModeSelect(modes[nextIndex].id);
              } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
                e.preventDefault();
                const currentIndex = modes.findIndex(m => m.id === selectedMode);
                const prevIndex = (currentIndex - 1 + modes.length) % modes.length;
                handleModeSelect(modes[prevIndex].id);
              } else if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                handleModeSelect(mode.id);
              }
            }}
            className={`
              relative p-4 rounded-lg border-2 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${darkMode ? 'focus:ring-offset-gray-900' : 'focus:ring-offset-gray-100'}
              ${selectedMode === mode.id 
                ? (darkMode ? 'border-blue-500 bg-blue-500/20 text-white' : 'border-blue-500 bg-blue-50 text-blue-900') 
                : (darkMode ? 'border-gray-600 bg-gray-800 text-gray-300 hover:border-gray-500 hover:bg-gray-700' : 'border-gray-300 bg-white text-gray-700 hover:border-gray-400 hover:bg-gray-50')
              }
            `}
          >
            <div className="flex flex-col items-center space-y-2">
              <div 
                className={`${selectedMode === mode.id ? 'text-blue-400' : 'text-gray-400'}`}
                aria-hidden="true"
              >
                {mode.icon}
              </div>
              <div className={`text-sm font-medium ${darkMode ? 'text-gray-100' : 'text-gray-800'}`}>{mode.name}</div>
              <div 
                id={`${mode.id}-description`} 
                className={`text-xs text-center ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}
              >
                {mode.description}
              </div>
            </div>
            
            {selectedMode === mode.id && (
              <div className="absolute top-2 right-2">
                <svg className="w-5 h-5 text-blue-500" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
              </div>
            )}
          </button>
        ))}
      </div>

      {selectedMode === 'recent' && (
        <div className={`mt-4 p-4 rounded-lg ${darkMode ? 'bg-gray-800' : 'bg-gray-50'}`}>
          <label 
            htmlFor="message-count-input" 
            className={`block text-sm font-medium mb-2 ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}
          >
            保存するメッセージ数
          </label>
          <div className="flex items-center space-x-3">
            <input
              id="message-count-input"
              type="number"
              min={RECENT_COUNT_MIN}
              max={RECENT_COUNT_MAX}
              value={messageCountInput}
              onChange={handleCountChange}
              onBlur={handleCountBlur}
              aria-describedby={!isCountValid ? "count-error" : "count-help"}
              aria-invalid={!isCountValid}
              className={`
                flex-1 px-3 py-2 border rounded-md 
                ${darkMode ? 'bg-gray-700 text-white focus:ring-offset-gray-800 border-gray-600' : 'bg-white text-gray-900 focus:ring-offset-gray-100 border-gray-300'}
                focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2
                ${!isCountValid ? 'border-red-500' : ''}
              `}
            />
            <span id="count-help" className={`${darkMode ? 'text-gray-400' : 'text-gray-500'} text-sm`} aria-live="polite">件</span>
          </div>
          {!isCountValid && (
            <p id="count-error" className="mt-1 text-xs text-red-400" role="alert">
              1から100の範囲で数値を入力してください
            </p>
          )}
        </div>
      )}

      <div id="save-mode-description" className={`mt-4 p-3 rounded-lg ${darkMode ? 'bg-gray-800/50' : 'bg-gray-100'}`}>
        <div className="flex items-start space-x-2">
          <svg 
            className={`w-4 h-4 mt-0.5 ${darkMode ? 'text-blue-400' : 'text-blue-600'}`} 
            fill="currentColor" 
            viewBox="0 0 20 20"
            aria-hidden="true"
          >
            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
          </svg>
          <div className={`text-xs ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>
            <p className={`font-medium ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>コツ:</p>
            <p>最新の返答には「最新メッセージ」、文脈のためには「最新N件」、完全な記録のためには「全会話」を使用してください。</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ChatModeSelector;

// CommonJS compatibility for testing
if (typeof module !== 'undefined' && module.exports) {
  module.exports = ChatModeSelector;
  module.exports.default = ChatModeSelector;
}
