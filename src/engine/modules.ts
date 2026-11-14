// 模組（Scratch 的「自訂積木」、Blockly 的「函式」、C++ 的 void 函式）共用的小工具。
//
// 流程圖裡：每個模組有自己一張流程圖（從「開始」到「結束」），主程式或其他模組用「預定處理」積木
// （figure 'Function'，長方形兩邊各多一條直線）執行它，積木上的字是「模組名稱(引數, 引數)」。
// 模組可以有參數（Scratch 只能讀；Blockly、C++ 可以改，只改到自己的那一份）、回傳值（Blockly、C++）、
// 區域變數（只有 C++）。要把結果帶回來也可以存到全域變數（變數表的變數大家都能用）。
import { t } from '../i18n';
import { getTarget } from '../target';
import type { Diagram } from './diagram';
import type { VarType } from './structure';
import { findStruct } from './structs';

export interface ParamInfo {
  name: string;
  /** 參數的型別：學生跟變數表的變數一樣自己決定（三種語言都一樣） */
  type: '數字' | '文字';
  /** C++：數字是 float（小數）；沒有就是 int（整數）。Scratch、Blockly 不分 */
  float?: boolean;
  /** C++：數字是 long long（很大的整數） */
  long?: boolean;
  /** 說明：學生自己寫這個參數是做什麼用的（像註解） */
  desc?: string;
}

export interface ModuleInfo {
  name: string;
  params: ParamInfo[];
  /**
   * 回傳值的型別；沒有就是不回傳（Scratch 只能這樣）。
   * 有回傳值的模組（Blockly、C++）：模組裡用計算積木「回傳 值」，後面直接接「結束」；
   * 用的地方可以寫在算式裡，例如「答案 設為 找最大(x, y)」
   */
  returns?: '數字' | '文字';
  /** C++：回傳的數字是 float（小數）；沒有就是 int */
  returnsFloat?: boolean;
  /** C++：回傳的數字是 long long */
  returnsLong?: boolean;
  /**
   * 區域變數（只有 C++ 有：寫在函式裡面，每次執行模組都重新從初始值開始，別的地方用不到）。
   * Scratch、Blockly 沒有區域變數（在模組裡建的變數也是全域的），所以只有學習目標是 C++ 時才能新增
   */
  locals?: LocalVar[];
}

/** 區域變數：跟第三步變數表的一列一樣（id 是表格用的） */
export interface LocalVar {
  id: number;
  name: string;
  type: VarType;
  init: string;
  desc: string;
  /** C++：數字是 float（小數）；沒有就是 int（整數） */
  float?: boolean;
  /** C++ 的 array：大小 */
  size?: string;
  /** array 的大小在流程圖中建立 */
  sizeLater?: boolean;
  /** C++：數字是 long long */
  long?: boolean;
  /** struct 變數每個欄位的初始值 */
  fieldInit?: Record<string, string>;
}

/**
 * C++ 的型別名稱（給學生看的）：數字分 int（整數）、float（小數），文字是 string。
 * 只是過渡用，不讓學生碰太多型別：清單只能裝這三種
 */
export const cppType = (type: '數字' | '文字', float?: boolean, long?: boolean) => (type == '文字' ? 'string' : float ? 'float' : long ? 'long long' : 'int');

/** 容器裡裝的東西（變數表「初始值」欄選的）→ C++ 的型別：int、long long、float、string，或 struct 的名稱 */
export const elemCppType = (init: string | undefined) => (findStruct(init) ? init!
  : init == '文字' ? 'string' : init == '小數' ? 'float' : init == '長整數' ? 'long long' : 'int');

/** 給學生看的型別名稱：C++ 寫 int / float / string、vector<int>…；Scratch、Blockly 寫數字、文字、清單 */
export function typeLabel(type: string, float?: boolean, init?: string, size?: string, long?: boolean): string {
  if (getTarget() == 'cpp') {
    const elem = elemCppType(init);
    if (type == '清單') return `vector<${elem}>`;
    if (type == '二維清單') return `vector<vector<${elem}>>`;
    if (type == '陣列') return `${elem}[${size ?? ''}]`;
    if (type == '堆疊') return `stack<${elem}>`;
    if (type == '佇列') return `queue<${elem}>`;
    if (type == '結構') return init ?? 'struct';
    return cppType(type == '文字' ? '文字' : '數字', float, long);
  }
  return type == '文字' ? t('文字', 'Text') : type == '清單' ? t('清單', 'List') : type == '二維清單' ? t('二維清單', '2D list') : t('數字', 'Number');
}

/**
 * Scratch：模組裡「主流程的a」指的是主流程的變數 a（參數也叫 a 的時候用來分辨；
 * Scratch 的「變數 a 設為」選的是主流程的變數，紅色參數積木 a 才是參數）
 */
export const GLOBAL_PREFIX = '主流程的';
/** 「主流程的a」→ a；不是這種寫法的名字照原樣 */
export const bareName = (name: string) => (name.startsWith(GLOBAL_PREFIX) ? name.slice(GLOBAL_PREFIX.length) : name);

/** 執行、轉程式時用：模組的資料加上它的流程圖 */
export interface ModuleSource {
  info: ModuleInfo;
  diagram: Diagram;
}

/** 積木文字裡完整的名稱 name（前後不是名稱的字，也不在 "引號" 裡）；回呼 f 換掉每一段引號外的文字 */
function outsideQuotes(text: string, f: (part: string) => string) {
  return text.split(/("[^"]*"|'[^']*')/).map((part, i) => (i % 2 ? part : f(part))).join('');
}
// 名稱只有中英文、數字、底線（見 isName），不用跳脫
const wordRe = (name: string) => new RegExp(`(?<![\\p{L}\\p{N}_$])${name}(?![\\p{L}\\p{N}_$])`, 'gu');
/** 把積木文字裡的變數名稱 from 換成 to（只換完整的名稱：改 a 不會動到 abc、主流程的a） */
export const renameInText = (text: string, from: string, to: string) => outsideQuotes(text, part => part.replace(wordRe(from), to));
/** struct 的欄位改名：把「.from」換成「.to」（後面接括號的是 s.top() 這種函式，不動） */
export const renameFieldInText = (text: string, from: string, to: string) =>
  outsideQuotes(text, part => part.replace(new RegExp(`\\.(\\s*)${from}(?![\\p{L}\\p{N}_$(])`, 'gu'), `.$1${to}`));
/** 積木文字裡有沒有用到欄位「.name」 */
export const usesField = (text: string, name: string) => renameFieldInText(text, name, '\u0000') != text;
/** 積木文字裡有沒有用到名稱 name */
export const usesName = (text: string, name: string) => {
  let found = false;
  outsideQuotes(text, part => {
    if (wordRe(name).test(part)) found = true;
    return part;
  });
  return found;
};

/** C++ 已經用掉的字（關鍵字、會寫進程式的名稱），不能拿來當變數、模組、參數的名字 */
const CPP_RESERVED = new Set([
  'and', 'auto', 'bool', 'break', 'case', 'catch', 'char', 'cin', 'class', 'const', 'continue', 'cout', 'default', 'delete', 'do',
  'double', 'else', 'endl', 'enum', 'false', 'float', 'for', 'fmod', 'if', 'include', 'indexOf', 'inputFloat', 'inputNumber', 'inputText',
  'int', 'long', 'main', 'namespace', 'new', 'not', 'or', 'private', 'public', 'return', 'short', 'signed', 'sizeof', 'static', 'std',
  'string', 'struct', 'switch', 'template', 'this', 'throw', 'to_string', 'true', 'try', 'typename', 'unsigned', 'using', 'vector', 'void', 'while',
  'stack', 'queue', 'sort', 'stoi', 'greater',
]);

/**
 * C++ 的名稱：只能用英文字母、數字、底線，不能用數字開頭，也不能是 C++ 已經用掉的字。
 * 新的編譯器可以用中文，但很多學校的環境（舊版 Dev-C++、線上評測）會錯，所以 C++ 一律不給用中文。
 * 沒問題（或學習目標不是 C++）回傳 null
 */
export function cppNameProblem(name: string): string | null {
  if (getTarget() != 'cpp' || !name) return null;
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(name)) {
    return t(`「${name}」不能當 C++ 的名稱：C++ 只能用英文字母、數字和底線（_），不能用中文或空白，也不能用數字開頭。例如 money、distance、total_fee。`,
      `"${name}" cannot be a C++ name. Use English letters, numbers and _ only (no spaces), and do not start with a number. For example: money, distance, total_fee.`);
  }
  if (CPP_RESERVED.has(name)) return t(`「${name}」是 C++ 已經用掉的字，請換一個名字。`, `"${name}" is already used by C++. Choose another name.`);
  return null;
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
