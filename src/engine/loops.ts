// 迴圈的兩條箭頭哪一條是「進去做」、哪一條是「離開」
//
// 條件迴圈（While_Loop）有兩種，存在積木的 data：
// - 沒寫（舊的、預設）：達成條件就離開（Scratch 的「重複直到」）。假：再做一次；真：離開
// - 'while'：條件成立才執行（C++、Python 的 while）。真：執行；假：離開
// 次數迴圈（For_Loop）是「進入迴圈／離開迴圈」。
import type { FigureName } from './figures';

type LoopLike = { figure: FigureName; data?: string };

/** 這個條件迴圈是不是「條件成立才執行」 */
export const isWhileMode = (n: LoopLike) => n.figure == 'While_Loop' && n.data == 'while';

/** 迴圈的兩條箭頭上寫的字 */
export function loopLabels(n: LoopLike): { enter: string; exit: string } {
  if (n.figure == 'For_Loop') return { enter: '進入迴圈', exit: '離開迴圈' };
  return isWhileMode(n) ? { enter: '真', exit: '假' } : { enter: '假', exit: '真' };
}

/** 這條箭頭是走進迴圈裡面的那條 */
export function isEnterLink(n: LoopLike, text: string): boolean {
  if (text.includes('進入迴圈')) return true;
  if (text.includes('離開迴圈')) return false;
  return text.includes(isWhileMode(n) ? '真' : '假');
}

/** 這條箭頭是離開迴圈的那條 */
export function isExitLink(n: LoopLike, text: string): boolean {
  if (text.includes('離開迴圈')) return true;
  if (text.includes('進入迴圈')) return false;
  return text.includes(isWhileMode(n) ? '假' : '真');
}
