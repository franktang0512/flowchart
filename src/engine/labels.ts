// 積木和箭頭上的字：存起來的一律是中文（程式靠它判斷怎麼執行），英文模式只在畫的時候換成英文
import { getLang } from '../i18n';
import type { FigureName } from './figures';

const ROUNDING: [string, string][] = [
  ['(取四捨五入)', ' (round)'],
  ['(取無條件捨去)', ' (round down)'],
  ['(取無條件進位)', ' (round up)'],
];

/** 計算積木做的事：「設為」一般的設定；清單才有的「加入」（加到最後）、「插入」、「刪除」 */
export type RectAction = '設為' | '加入' | '插入' | '刪除';

/**
 * 計算積木的文字拆開，可能是：
 *   「 x 設為 運算式」「 清單 加入 運算式」「 清單 在第 位置 項插入 運算式」「 清單 刪除第 位置 項」
 */
export function splitRectangle(text: string): { target: string; action: RectAction; index: string; expr: string } {
  let m = /^(.*?) 在第 (.*?) 項插入 (.*)$/s.exec(text);
  if (m) return { target: m[1].trim(), action: '插入', index: m[2].trim(), expr: m[3] };
  m = /^(.*?) 刪除第 (.*) 項$/s.exec(text);
  if (m) return { target: m[1].trim(), action: '刪除', index: m[2].trim(), expr: '' };
  m = /^(.*?) (設為|加入) (.*)$/s.exec(text);
  if (!m) return { target: text.trim(), action: '設為', index: '', expr: '' };
  return { target: m[1].trim(), action: m[2] as RectAction, index: '', expr: m[3] };
}

/** 積木上顯示的字 */
export function displayNodeText(text: string, figure: FigureName): string {
  if (getLang() != 'en' || !text) return text;
  switch (figure) {
    case 'Circle':
      return text == '開始' ? 'Start' : text == '結束' ? 'End' : text;
    case 'Parallelogram':
      return text.replace(/^輸入/, 'Input').replace(/^輸出/, 'Output');
    case 'Rectangle': {
      // 「 x 設為 運算式(取四捨五入)」→「set x to 運算式 (round)」；清單的加入、插入、刪除也換成英文
      let rest = text;
      let round = '';
      for (const [zh, en] of ROUNDING) {
        if (rest.endsWith(zh)) {
          rest = rest.slice(0, -zh.length);
          round = en;
        }
      }
      const { target, action, index, expr } = splitRectangle(rest);
      switch (action) {
        case '加入': return `add ${expr.trim()}${round} to ${target}`;
        case '插入': return `insert ${expr.trim()}${round} at item ${index} in ${target}`;
        case '刪除': return `remove item ${index} from ${target}`;
        default: return `set ${target} to ${expr.trim()}${round}`;
      }
    }
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
