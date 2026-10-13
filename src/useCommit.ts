import { useRef } from 'react';

/**
 * 模擬原生 change 事件：輸入框「離開或按 Enter 且內容有變」才觸發。
 * React 的 onChange 是每打一個字就觸發，用在改變數名稱會把流程圖裡的字一路替換壞掉。
 */
export function useCommit<T extends HTMLInputElement>(onCommit: (el: T) => void) {
  const focusValue = useRef<string | null>(null);
  const commit = (el: T) => {
    if (el.value !== focusValue.current) {
      focusValue.current = el.value;
      onCommit(el);
    }
  };
  return {
    onFocus: (e: React.FocusEvent<T>) => { focusValue.current = e.currentTarget.value; },
    onBlur: (e: React.FocusEvent<T>) => commit(e.currentTarget),
    onKeyDown: (e: React.KeyboardEvent<T>) => { if (e.key == 'Enter') commit(e.currentTarget); },
  };
}
