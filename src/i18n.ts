// 中英切換。用法：t('中文', 'English')，兩種語言寫在一起，改字時不用到處找。
// 英文給國中生看（pre-A1 / A1），請用短句、常用字。
import { useSyncExternalStore } from 'react';

export type Lang = 'zh' | 'en';

const KEY = 'flowchart-lang';

/** 網址加 ?lang=en：固定英文、不顯示中／英切換（給學生的連結用） */
export const LOCKED_EN = new URLSearchParams(window.location.search).get('lang') == 'en';

function load(): Lang {
  if (LOCKED_EN) return 'en';
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

/** 站內連結：固定英文時把 lang=en 帶到下一頁，例如 link('?course=114')、link('./') */
/** 連結要多帶的參數（目前的學習目標 ?target=，由 target.ts 設定；這裡不 import target.ts，避免互相引用） */
let extraParams: () => Record<string, string> = () => ({});
export const setLinkParams = (f: () => Record<string, string>) => { extraParams = f; };

/** 站內連結：帶上 ?target=（學習目標）、?lang=en（固定英文），複製網址給學生時就不用自己加 */
export function link(href: string) {
  const params: Record<string, string> = { ...extraParams(), ...(LOCKED_EN ? { lang: 'en' } : {}) };
  const add = Object.entries(params)
    .filter(([k]) => !new RegExp(`[?&]${k}=`).test(href))
    .map(([k, v]) => `${k}=${encodeURIComponent(v)}`)
    .join('&');
  if (!add) return href;
  return href + (href.includes('?') ? '&' : '?') + add;
}

/** 依目前語言回傳中文或英文 */
export const t = (zh: string, en: string) => (current == 'en' ? en : zh);

document.documentElement.lang = current == 'en' ? 'en' : 'zh-Hant';
