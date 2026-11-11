// 程式學習目標：積木（Scratch / Blockly）或 C++。進入課程前在首頁選。
// 兩者最大的差別是清單的位置：積木從第 1 項開始，C++ 的索引從 0 開始。
// 網址加 ?target=cpp 或 ?target=blocks 可以直接指定（老師發給學生的連結用）。
import { useSyncExternalStore } from 'react';
import { t } from './i18n';

export type Target = 'blocks' | 'cpp';

const KEY = 'flowchart-target';

const isTarget = (v: string | null): v is Target => v == 'blocks' || v == 'cpp';

function load(): Target | null {
  const fromUrl = new URLSearchParams(window.location.search).get('target');
  if (isTarget(fromUrl)) {
    save(fromUrl);
    return fromUrl;
  }
  try {
    const v = localStorage.getItem(KEY);
    return isTarget(v) ? v : null;
  }
  catch {
    return null;
  }
}

function save(target: Target) {
  try {
    localStorage.setItem(KEY, target);
  }
  catch {
    // 不能存也沒關係，只是下次打開要再選一次
  }
}

/** null = 還沒選過（首頁會先請學生選） */
let current: Target | null = load();
const listeners = new Set<() => void>();

export const getChosenTarget = () => current;
/** 還沒選過就當作積木（直接打開題目連結的情況） */
export const getTarget = (): Target => current ?? 'blocks';

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

/** 清單/文字的第一個位置：積木是 1，C++ 是 0 */
export const indexBase = () => (getTarget() == 'cpp' ? 0 : 1);

/** 依學習目標選說法：積木（第幾項）或 C++（索引） */
export const byTarget = (blocks: string, cpp: string) => (getTarget() == 'cpp' ? cpp : blocks);

/** 學習目標的名稱 */
export const targetName = (target: Target) => (target == 'cpp' ? 'C++' : t('積木', 'Blocks'));

/**
 * 「第幾項」的說法：積木說「第 k 項」，C++ 說「索引 k」。
 * 例如 itemWord('3') → 積木「第 3 項」/ "item 3"，C++「索引 3」/ "index 3"
 */
export function itemWord(k: string): string {
  return getTarget() == 'cpp' ? t(`索引 ${k}`, `index ${k}`) : t(`第 ${k} 項`, `item ${k}`);
}
