// 積木和箭頭上的字：存起來的一律是中文（程式靠它判斷怎麼執行），英文模式只在畫的時候換成英文。
// 計算積木的清單操作，中英文都在畫的時候換成 Scratch 積木的說法。
import { getLang } from '../i18n';
import { itemWord } from '../target';
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
export type RectAction = '設為' | '加入' | '插入' | '替換' | '刪除' | '清空' | '建立' | '回傳' | '放入' | '取出' | '排序';

/** struct 排序的一個條件：依哪個欄位、由大到小嗎（前面的一樣大，才比後面的） */
export interface SortKey {
  field: string;
  desc: boolean;
}

/** 排序條件寫成積木上的字：「score 由大到小、name 由小到大」 */
export const sortKeysText = (keys: SortKey[]) => keys.map(k => `${k.field} ${k.desc ? '由大到小' : '由小到大'}`).join('、');

/** 「score 由大到小、name 由小到大」→ 排序條件（看不懂的那段略過） */
export function parseSortKeys(spec: string): SortKey[] {
  return spec.split('、').flatMap(part => {
    const m = /^\s*(\S+)\s+(由小到大|由大到小)\s*$/.exec(part);
    return m ? [{ field: m[1], desc: m[2] == '由大到小' }] : [];
  });
}

/**
 * 「名稱[a]」「名稱[a][b]」拆成名稱和中括號裡的東西（中括號裡還有中括號也沒關係，例如 表[a[1]][b]）；
 * 不是這種寫法回傳 null
 */
export function splitTarget(s: string): { name: string; indexes: string[] } | null {
  const text = s.trim();
  const open = text.indexOf('[');
  if (open <= 0 || !text.endsWith(']')) return null;
  const name = text.slice(0, open).trim();
  if (!name || /[\s\]]/.test(name)) return null;
  const indexes: string[] = [];
  let depth = 0;
  let cur = '';
  for (const ch of text.slice(open)) {
    if (ch == '[') {
      if (depth++ == 0) { cur = ''; continue; }
    }
    else if (ch == ']') {
      if (--depth == 0) { indexes.push(cur.trim()); continue; }
      if (depth < 0) return null;
    }
    else if (depth == 0) return null;
    cur += ch;
  }
  return depth == 0 && indexes.length ? { name, indexes } : null;
}

/**
 * 計算積木的文字拆開，存起來的格式是：
 *   「 x 設為 運算式」「 清單[位置] 設為 運算式」（替換）「 清單 加入 運算式」
 *   「 清單 在第 位置 項插入 運算式」「 清單 刪除第 位置 項」「 清單 刪除所有項目」
 *   堆疊、佇列（C++）：「 s 放入 運算式」（push）「 s 取出」（pop）
 *   排序（C++）：「 a 排序 [前 n 個] 由小到大|由大到小」；struct 依欄位：「 a 排序 [前 n 個] 依 score 由大到小、name 由小到大」
 *   二維清單的某一列（C++ 的鄰接串列）：「 g[u] 加入 運算式」（g[u].push_back）
 *   二維清單（C++）：「 表 建立 r 列 c 行」（設定大小，每格都是 0 或空的文字）「 表[i][j] 設為 運算式」（替換一格，index2 是第二個位置）
 */
export function splitRectangle(text: string): { target: string; action: RectAction; index: string; index2: string; expr: string } {
  // 模組的回傳值：「 回傳 運算式」（後面一定直接接「結束」）
  let m = /^\s*回傳 (.*)$/s.exec(text);
  if (m) return { target: '', action: '回傳', index: '', index2: '', expr: m[1] };
  m = /^(.*?) 在第 (.*?) 項插入 (.*)$/s.exec(text);
  if (m) return { target: m[1].trim(), action: '插入', index: m[2].trim(), index2: '', expr: m[3] };
  m = /^(.*?) 刪除所有項目$/s.exec(text);
  if (m) return { target: m[1].trim(), action: '清空', index: '', index2: '', expr: '' };
  m = /^(.*?) 刪除第 (.*) 項$/s.exec(text);
  if (m) return { target: m[1].trim(), action: '刪除', index: m[2].trim(), index2: '', expr: '' };
  m = /^(.*?) 建立 (.*?) 列 (.*) 行$/s.exec(text);
  if (m) return { target: m[1].trim(), action: '建立', index: m[2].trim(), index2: m[3].trim(), expr: '' };
  // 排序（C++ 的 sort）：「 a 排序 由小到大」「 a 排序 前 n 個 由小到大」「 edges 排序 依 w 由大到小」
  //   「 s 排序 依 score 由大到小、name 由小到大」（分數一樣時再比名字）
  //   index 是只排前幾個（沒有就是全部），index2 是 struct 的排序條件（見 parseSortKeys），expr 是最後一個由小到大 / 由大到小
  m = /^(.*?) 排序(?: 前 (.*?) 個)?(?: 依 (.+?))? (由小到大|由大到小)$/s.exec(text);
  if (m) return { target: m[1].trim(), action: '排序', index: (m[2] ?? '').trim(), index2: m[3] ? `${m[3]} ${m[4]}` : '', expr: m[4] };
  // 堆疊、佇列（C++ 的 stack、queue）：「 s 放入 x」是 push，「 s 取出」是 pop
  m = /^(.*?) 取出$/s.exec(text);
  if (m) return { target: m[1].trim(), action: '取出', index: '', index2: '', expr: '' };
  m = /^(.*?) (設為|加入|放入) (.*)$/s.exec(text);
  if (!m) return { target: text.trim(), action: '設為', index: '', index2: '', expr: '' };
  const target = m[1].trim();
  const item = m[2] == '設為' ? splitTarget(target) : null;
  if (item) return { target: item.name, action: '替換', index: item.indexes[0], index2: item.indexes[1] ?? '', expr: m[3] };
  return { target, action: m[2] as RectAction, index: '', index2: '', expr: m[3] };
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
  const { target, action, index, index2, expr } = splitRectangle(rest);
  const value = expr.trim() + round;
  // 二維清單（只有 C++ 用）：照 C++ 的寫法
  if (action == '替換' && index2) return en ? `${target}[${index}][${index2}] = ${value}` : text;
  if (action == '建立') return en ? `make ${target} ${index} rows × ${index2} columns` : `${target} 建立 ${index} 列 × ${index2} 行`;
  if (action == '回傳') return en ? `return ${value}` : `回傳 ${value}`;
  if (action == '排序') {
    const dirText = (desc: boolean) => (desc ? (en ? 'large → small' : '由大到小') : (en ? 'small → large' : '由小到大'));
    const first = index ? (en ? ` first ${index}` : `前 ${index} 個`) : '';
    // struct：依每個條件「score 由大到小、name 由小到大」
    const keys = index2 ? parseSortKeys(index2) : [];
    if (keys.length) {
      return en
        ? `sort ${target}${first} by ${keys.map(k => `${k.field} (${dirText(k.desc)})`).join(', then ')}`
        : `排序 ${target}${first ? `（${first}）` : ''} 依 ${keys.map(k => `${k.field} ${dirText(k.desc)}`).join('，再依 ')}`;
    }
    return en ? `sort ${target}${first} (${dirText(expr == '由大到小')})` : `排序 ${target}${first ? `（${first}）` : ''} ${dirText(expr == '由大到小')}`;
  }
  // stack、queue：照 C++ 的寫法
  if (action == '放入') return `${target}.push(${value})`;
  if (action == '取出') return `${target}.pop()`;
  switch (action) {
    case '加入': return en ? `add ${value} to ${target}` : `添加 ${value} 到 ${target}`;
    case '插入': return en ? `insert ${value} at ${itemWord(index)} of ${target}` : `插入 ${value} 到 ${target} 的${itemWord(index)}`;
    case '替換': return en ? `replace ${itemWord(index)} of ${target} with ${value}` : `替換 ${target} 的${itemWord(index)} 為 ${value}`;
    case '刪除': return en ? `delete ${itemWord(index)} of ${target}` : `刪除 ${target} 的${itemWord(index)}`;
    case '清空': return en ? `delete all of ${target}` : `刪除 ${target} 的所有項目`;
    default: return en ? `set ${target} to ${value}` : text;
  }
}

/** 輸入積木上顯示的字：輸入到清單某一項時，照 Scratch 的說法寫出插入/替換 */
function ioLabel(text: string, en: boolean): string {
  // 輸入到二維清單的一格：照 C++ 的寫法
  if (text.startsWith('輸入') && (splitTarget(text.substring(3))?.indexes.length ?? 0) > 1) return en ? text.replace(/^輸入/, 'Input') : text;
  const insert = /^輸入 (.*?) 插入第 (.*) 項$/s.exec(text);
  if (insert) return en ? `Input → insert at ${itemWord(insert[2])} of ${insert[1]}` : `輸入 → 插入到 ${insert[1]} 的${itemWord(insert[2])}`;
  const item = /^輸入 (.+?)\[(.*)\]$/s.exec(text);
  if (item) return en ? `Input → replace ${itemWord(item[2])} of ${item[1]}` : `輸入 → 替換 ${item[1]} 的${itemWord(item[2])}`;
  return en ? text.replace(/^輸入/, 'Input').replace(/^輸出/, 'Output') : text;
}

/** 積木上顯示的字 */
export function displayNodeText(text: string, figure: FigureName): string {
  if (!text) return text;
  if (figure == 'Rectangle') return rectangleLabel(text, getLang() == 'en');
  if (figure == 'Parallelogram') return ioLabel(text, getLang() == 'en');
  // 執行模組：跟 Scratch 的自訂積木一樣，積木上就是模組的名字和參數
  if (figure == 'Function') return text;
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
