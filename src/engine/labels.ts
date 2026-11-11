// 積木和箭頭上的字：存起來的一律是中文（程式靠它判斷怎麼執行），英文模式只在畫的時候換成英文
import { getLang } from '../i18n';
import type { FigureName } from './figures';

const ROUNDING: [string, string][] = [
  ['(取四捨五入)', ' (round)'],
  ['(取無條件捨去)', ' (round down)'],
  ['(取無條件進位)', ' (round up)'],
];

/** 計算積木的文字「 x 設為 運算式」或「 清單 加入 運算式」拆成三段 */
export function splitRectangle(text: string): { target: string; action: '設為' | '加入'; expr: string } {
  const m = /^(.*?) (設為|加入) (.*)$/s.exec(text);
  if (!m) return { target: text.trim(), action: '設為', expr: '' };
  return { target: m[1].trim(), action: m[2] as '設為' | '加入', expr: m[3] };
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
      // 「 x 設為 運算式(取四捨五入)」→「set x to 運算式 (round)」；「 清單 加入 運算式」→「add 運算式 to 清單」
      let rest = text;
      let round = '';
      for (const [zh, en] of ROUNDING) {
        if (rest.endsWith(zh)) {
          rest = rest.slice(0, -zh.length);
          round = en;
        }
      }
      const { target, action, expr } = splitRectangle(rest);
      return action == '加入' ? `add ${expr.trim()}${round} to ${target}` : `set ${target} to ${expr.trim()}${round}`;
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
