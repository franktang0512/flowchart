// 模組（Scratch 的「自訂積木」、Blockly 的「函式」、C++ 的 void 函式）共用的小工具。
//
// 流程圖裡：每個模組有自己一張流程圖（從「開始」到「結束」），主程式或其他模組用「預定處理」積木
// （figure 'Function'，長方形兩邊各多一條直線）執行它，積木上的字是「模組名稱(引數, 引數)」。
// 模組可以有參數（只能讀、不能改，跟 Scratch 自訂積木的參數一樣），沒有回傳值；
// 要把結果帶回來就存到變數（變數表的變數大家都能用）。這是 Scratch 和 Blockly 都做得到的部分。
import type { Diagram } from './diagram';

export interface ParamInfo {
  name: string;
  type: '數字' | '文字';
}

export interface ModuleInfo {
  name: string;
  params: ParamInfo[];
}

/** 執行、轉程式時用：模組的資料加上它的流程圖 */
export interface ModuleSource {
  info: ModuleInfo;
  diagram: Diagram;
}

/** 名稱可以用的字：中英文、數字、底線，不能用數字開頭 */
export const isName = (s: string) => /^[\p{L}_][\p{L}\p{N}_]*$/u.test(s);

/** 用逗號分開引數：括號、中括號、引號裡的逗號不算 */
export function splitArgs(s: string): string[] {
  const out: string[] = [];
  let depth = 0;
  let quote = '';
  let cur = '';
  for (const ch of s) {
    if (quote) {
      if (ch == quote) quote = '';
    }
    else if (ch == '"' || ch == "'") quote = ch;
    else if (ch == '(' || ch == '[') depth++;
    else if (ch == ')' || ch == ']') depth--;
    else if (ch == ',' && depth == 0) {
      out.push(cur.trim());
      cur = '';
      continue;
    }
    cur += ch;
  }
  if (cur.trim() || out.length) out.push(cur.trim());
  return out;
}

/** 「模組名稱(引數, 引數)」→ 名稱和引數；不是這種寫法回傳 null */
export function parseCall(text: string): { name: string; args: string[] } | null {
  const m = /^\s*([^\s(]+)\s*\((.*)\)\s*$/s.exec(text);
  return m ? { name: m[1], args: splitArgs(m[2]) } : null;
}

export const callText = (name: string, args: string[]) => `${name}(${args.join(', ')})`;

// 執行時每個積木的編號：主程式是 0 號流程圖，模組依序是 1、2…。
// 編號 = 第幾張流程圖 × SHEET + 積木在那張圖裡的 index，逐步執行時才知道要標哪一張圖的哪個積木
export const SHEET = 100000;
export const sheetId = (sheet: number, node: number) => sheet * SHEET + node;
export const splitId = (id: number) => ({ sheet: Math.floor(id / SHEET), node: id % SHEET });
