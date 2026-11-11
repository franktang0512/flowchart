// 積木和箭頭上的字：存起來的一律是中文（程式靠它判斷怎麼執行），英文模式只在畫的時候換成英文。
// 計算積木的清單操作，中英文都在畫的時候換成 Scratch 積木的說法。
import { getLang } from '../i18n';
import type { FigureName } from './figures';

const ROUNDING: [string, string][] = [
  ['(取四捨五入)', ' (round)'],
  ['(取無條件捨去)', ' (round down)'],
  ['(取無條件進位)', ' (round up)'],
];

/**
 * 計算積木做的事：「設為」一般的設定；清單才有的（名稱對應 Scratch 的清單積木）
 * 「加入」添加到最後、「插入」、「替換」第幾項、「刪除」第幾項、「清空」刪除所有項目
 */
export type RectAction = '設為' | '加入' | '插入' | '替換' | '刪除' | '清空';

/**
 * 計算積木的文字拆開，存起來的格式是：
 *   「 x 設為 運算式」「 清單[位置] 設為 運算式」（替換）「 清單 加入 運算式」
 *   「 清單 在第 位置 項插入 運算式」「 清單 刪除第 位置 項」「 清單 刪除所有項目」
 */
export function splitRectangle(text: string): { target: string; action: RectAction; index: string; expr: string } {
  let m = /^(.*?) 在第 (.*?) 項插入 (.*)$/s.exec(text);
  if (m) return { target: m[1].trim(), action: '插入', index: m[2].trim(), expr: m[3] };
  m = /^(.*?) 刪除所有項目$/s.exec(text);
  if (m) return { target: m[1].trim(), action: '清空', index: '', expr: '' };
  m = /^(.*?) 刪除第 (.*) 項$/s.exec(text);
  if (m) return { target: m[1].trim(), action: '刪除', index: m[2].trim(), expr: '' };
  m = /^(.*?) (設為|加入) (.*)$/s.exec(text);
  if (!m) return { target: text.trim(), action: '設為', index: '', expr: '' };
  const target = m[1].trim();
  const item = m[2] == '設為' ? /^(.+?)\[(.*)\]$/s.exec(target) : null;
  if (item) return { target: item[1].trim(), action: '替換', index: item[2].trim(), expr: m[3] };
  return { target, action: m[2] as RectAction, index: '', expr: m[3] };
}

/** 計算積木上顯示的字：清單的操作照 Scratch 積木的說法，下一堂改用 Scratch 時看得懂 */
function rectangleLabel(text: string, en: boolean): string {
  let rest = text;
  let round = '';
  for (const [zh, roundEn] of ROUNDING) {
    if (rest.endsWith(zh)) {
      rest = rest.slice(0, -zh.length);
      round = en ? roundEn : zh;
    }
  }
  const { target, action, index, expr } = splitRectangle(rest);
  const value = expr.trim() + round;
  switch (action) {
    case '加入': return en ? `add ${value} to ${target}` : `添加 ${value} 到 ${target}`;
    case '插入': return en ? `insert ${value} at ${index} of ${target}` : `插入 ${value} 到 ${target} 的第 ${index} 項`;
    case '替換': return en ? `replace item ${index} of ${target} with ${value}` : `替換 ${target} 的第 ${index} 項為 ${value}`;
    case '刪除': return en ? `delete ${index} of ${target}` : `刪除 ${target} 的第 ${index} 項`;
    case '清空': return en ? `delete all of ${target}` : `刪除 ${target} 的所有項目`;
    default: return en ? `set ${target} to ${value}` : text;
  }
}

/** 輸入積木上顯示的字：輸入到清單某一項時，照 Scratch 的說法寫出插入/替換 */
function ioLabel(text: string, en: boolean): string {
  const insert = /^輸入 (.*?) 插入第 (.*) 項$/s.exec(text);
  if (insert) return en ? `Input → insert at ${insert[2]} of ${insert[1]}` : `輸入 → 插入到 ${insert[1]} 的第 ${insert[2]} 項`;
  const item = /^輸入 (.+?)\[(.*)\]$/s.exec(text);
  if (item) return en ? `Input → replace item ${item[2]} of ${item[1]}` : `輸入 → 替換 ${item[1]} 的第 ${item[2]} 項`;
  return en ? text.replace(/^輸入/, 'Input').replace(/^輸出/, 'Output') : text;
}

/** 積木上顯示的字 */
export function displayNodeText(text: string, figure: FigureName): string {
  if (!text) return text;
  if (figure == 'Rectangle') return rectangleLabel(text, getLang() == 'en');
  if (figure == 'Parallelogram') return ioLabel(text, getLang() == 'en');
  if (getLang() != 'en') return text;
  switch (figure) {
    case 'Circle':
      return text == '開始' ? 'Start' : text == '結束' ? 'End' : text;
    case 'For_Loop':
      return text.endsWith('次') ? `repeat ${text.slice(0, -1)}` : text;
    default:
      return text;
  }
}

const LINK_EN: Record<string, string> = { 真: 'Yes', 假: 'No', 進入迴圈: 'Repeat', 離開迴圈: 'Done' };

/** 箭頭上顯示的字（真／假、進入／離開迴圈） */
export function displayLinkText(text: string): string {
  if (getLang() != 'en' || !text) return text;
  return LINK_EN[text] ?? text;
}
