// 中英切換。用法：t('中文', 'English')，兩種語言寫在一起，改字時不用到處找。
// 英文給國中生看（pre-A1 / A1），請用短句、常用字。
import { useSyncExternalStore } from 'react';

export type Lang = 'zh' | 'en';

const KEY = 'flowchart-lang';

function load(): Lang {
  try {
    return localStorage.getItem(KEY) == 'en' ? 'en' : 'zh';
  }
  catch {
    return 'zh';
  }
}

let current: Lang = load();
const listeners = new Set<() => void>();

export const getLang = () => current;

export function setLang(lang: Lang) {
  if (lang == current) return;
  current = lang;
  try {
    localStorage.setItem(KEY, lang);
  }
  catch {
    // 不能存也沒關係，只是下次打開會回到中文
  }
  document.documentElement.lang = lang == 'en' ? 'en' : 'zh-Hant';
  listeners.forEach(f => f());
}

export function onLangChange(f: () => void) {
  listeners.add(f);
  return () => { listeners.delete(f); };
}

/** React 元件裡用：語言切換時重新畫面 */
export function useLang(): Lang {
  return useSyncExternalStore(onLangChange, getLang);
}

/** 依目前語言回傳中文或英文 */
export const t = (zh: string, en: string) => (current == 'en' ? en : zh);

document.documentElement.lang = current == 'en' ? 'en' : 'zh-Hant';
