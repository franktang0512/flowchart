// 程式學習目標：Scratch、Blockly、C++ 或 Python。進入課程前在首頁選。
// 流程圖能用的功能照那個語言的性質：
//   Scratch：清單從第 1 項開始、數字文字混著放；模組（自訂積木）沒有回傳值
//   Blockly：跟 Scratch 一樣，但模組（函式）可以回傳值
//   C++：索引從 0 開始、清單要選型別、有二維清單；模組（函式）可以回傳值
//   Python：跟 C++ 一樣索引從 0 開始、變數表選型別；運算式照 Python 的寫法（//、len( )、x in s），
//     輸入一次讀一整行（input()），模組看得到主流程的變數（跟 Python 的全域變數一樣）
// 網址加 ?target=scratch / blockly / cpp / python 可以直接指定（老師發給學生的連結用），就不會問。
// 舊的 ?target=blocks 當作 Scratch。
// 沒指定的話，每次打開網站都會先問一次；選了之後只記在這個分頁（sessionStorage），
// 重新整理、在課程之間切換都不用再選，關掉分頁下次再來會再問。
import { useSyncExternalStore } from 'react';
import { t } from './i18n';

export type Target = 'scratch' | 'blockly' | 'cpp' | 'python';

const KEY = 'flowchart-target';

/** 文字 → 學習目標；舊的 'blocks'（以前積木不分 Scratch / Blockly）當作 Scratch */
const parse = (v: string | null): Target | null => (v == 'scratch' || v == 'blockly' || v == 'cpp' || v == 'python' ? v : v == 'blocks' ? 'scratch' : null);

function load(): Target | null {
  const fromUrl = parse(new URLSearchParams(window.location.search).get('target'));
  if (fromUrl) {
    save(fromUrl);
    return fromUrl;
  }
  try {
    // 以前記在 localStorage（永遠不再問），清掉
    localStorage.removeItem(KEY);
    return parse(sessionStorage.getItem(KEY));
  }
  catch {
    return null;
  }
}

function save(target: Target) {
  try {
    sessionStorage.setItem(KEY, target);
  }
  catch {
    // 不能存也沒關係，只是重新整理要再選一次
  }
}

/** null = 還沒選過（首頁會先請學生選） */
let current: Target | null = load();
const listeners = new Set<() => void>();

export const getChosenTarget = () => current;
/** 還沒選過就當作 Scratch（直接打開題目連結的情況） */
export const getTarget = (): Target => current ?? 'scratch';

export function setTarget(target: Target) {
  if (target == current) return;
  current = target;
  save(target);
  listeners.forEach(f => f());
}

function onTargetChange(f: () => void) {
  listeners.add(f);
  return () => { listeners.delete(f); };
}

/** React 元件裡用：換學習目標時重新畫面；回傳 null 代表還沒選 */
export function useTarget(): Target | null {
  return useSyncExternalStore(onTargetChange, getChosenTarget);
}

/** 是積木（Scratch 或 Blockly）嗎 */
export const isBlocks = (target: Target = getTarget()) => target == 'scratch' || target == 'blockly';

/** 是寫程式的語言（C++ 或 Python）嗎：索引從 0 開始、變數表要選型別 */
export const isCode = (target: Target = getTarget()) => target == 'cpp' || target == 'python';

/** 是 Python 嗎 */
export const isPython = (target: Target = getTarget()) => target == 'python';

/** 模組可以回傳值嗎（Scratch 的自訂積木不行） */
export const canReturn = (target: Target = getTarget()) => target != 'scratch';

/** 清單/文字的第一個位置：積木是 1，C++ 是 0 */
export const indexBase = () => (isCode() ? 0 : 1);

/** 依學習目標選說法：積木（第幾項）、C++（索引）或 Python（沒給就跟 C++ 一樣） */
export const byTarget = (blocks: string, cpp: string, python: string = cpp) => (isPython() ? python : isCode() ? cpp : blocks);

/** 學習目標的名稱 */
export const targetName = (target: Target) => ({ scratch: 'Scratch', blockly: 'Blockly', cpp: 'C++', python: 'Python' })[target];

/**
 * 「第幾項」的說法：積木說「第 k 項」，C++ 說「索引 k」。
 * 例如 itemWord('3') → 積木「第 3 項」/ "item 3"，C++「索引 3」/ "index 3"
 */
export function itemWord(k: string): string {
  return isCode() ? t(`索引 ${k}`, `index ${k}`) : t(`第 ${k} 項`, `item ${k}`);
}
