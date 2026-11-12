// 檢查學生輸入的運算式，並把流程圖轉成 JavaScript 逐步執行
//
// 學生的寫法 → 產生的程式：
//   數字/文字變數        n、name            → 一般的 JavaScript 變數，存值時會檢查型別
// 清單和文字的位置：學習目標是積木時從 1 開始，C++ 時從 0 開始（執行時的 __BASE，見 target.ts）
//   清單                 成績[i]           → __at(成績, "成績", 積木編號, i)
//                       成績[i] 設為 x     → __set(成績, "成績", 積木編號, i, x)
//                       長度(成績)         → __len(...)
//                       項目編號(成績, x)   → __find(...)：x 在第幾項，找不到是 0（跟 Scratch 一樣）
//                       包含(成績, x)       → __has(...)：真/假
//                       成績 加入 x        → __push(...)：把 x 加到清單最後
//                       成績 在第 k 項插入 x → __insert(...)：k 可以是 1 到 長度+1
//                       成績 刪除第 k 項    → __remove(...)
//                       成績 刪除所有項目   → __clear(...)
//                       輸入 成績          → 把讀到的值加到清單最後
//                       輸入 成績[k]       → 把讀到的值存進第 k 項（替換，第 k 項要已經存在）
//                       輸入 成績 插入第 k 項 → 把讀到的值插到第 k 項
//   文字（從第 1 個字開始） 名字[i]、長度(名字) → 跟清單一樣用 __at、__len，但不能改其中一個字
//   判斷式               = and or not 且 或 非 → == && || !
import { t } from '../i18n';
import { getTarget, indexBase } from '../target';
import type { Diagram } from './diagram';
import { displayLinkText, displayNodeText, splitRectangle, splitTarget } from './labels';
import { GLOBAL_PREFIX, parseCall, sheetId, type LocalVar, type ModuleInfo, type ModuleSource, type ParamInfo } from './modules';
import type { FlowNode } from './node';

/** 第三步「變數」表格整理出來的變數清單 */
export interface VarStore {
  var_list: { name: string[]; value: string[] };
  /** grid：二維清單（只有學習目標是 C++ 時才有） */
  type_var_list: { number: string[]; text: string[]; array: string[]; grid: string[] };
  /** 在模組裡：模組的參數（也放在 number / text 裡，算式可以用） */
  params?: string[];
  /** 參數不能存值進去（Scratch 的自訂積木參數不能改；Blockly、C++ 可以） */
  paramsReadOnly?: boolean;
  /** 在模組裡：這個模組的區域變數（只有 C++；也放在 var_list、type_var_list 裡） */
  locals?: string[];
  /** 有回傳值的模組名稱：算式裡可以寫「名稱(引數)」 */
  calls?: string[];
}

/** 區域變數照型別分好（給下拉選單、型別檢查用） */
export function localTypes(locals: LocalVar[] = []): VarStore['type_var_list'] {
  const named = locals.filter(v => v.name.trim() != '');
  const of = (type: LocalVar['type']) => named.filter(v => v.type == type).map(v => v.name.trim());
  return { number: of('數字'), text: of('文字'), array: of('清單'), grid: of('二維清單') };
}

/**
 * 模組裡用的變數清單：主流程的變數，再加上這個模組的參數和區域變數。
 * - 跟參數、區域變數同名的主流程變數在模組裡被蓋住（寫這個名字指的是參數或區域變數）；
 *   Scratch 可以寫「主流程的a」指主流程的 a（Scratch 本來就分得開：變數積木是主流程的，參數積木是參數）
 * - C++：主流程的變數宣告在 main 裡面，模組用不到（要用的值用參數傳進來，用回傳帶出去）
 * inModule 是 false（主流程）時照原樣
 */
export function withParams(vars: VarStore, params: ParamInfo[], locals: LocalVar[] = [], inModule = true): VarStore {
  const named = locals.filter(v => v.name.trim() != '');
  if (!inModule) return vars;
  const target = getTarget();
  const lt = localTypes(named);
  const own = new Set([...params.map(p => p.name), ...named.map(v => v.name.trim())]);
  const visible = (n: string) => target != 'cpp' && !own.has(n);
  // Scratch：被蓋住的主流程變數改叫「主流程的a」
  const renamed = (n: string) => (target == 'scratch' && own.has(n) ? [GLOBAL_PREFIX + n] : []);
  const g = (list: string[]) => list.flatMap(n => (visible(n) ? [n] : renamed(n)));
  const globalNames = g(vars.var_list.name);
  const valueOf = (n: string) => vars.var_list.value[vars.var_list.name.indexOf(n.startsWith(GLOBAL_PREFIX) ? n.slice(GLOBAL_PREFIX.length) : n)];
  return {
    var_list: {
      name: [...globalNames, ...named.map(v => v.name.trim())],
      value: [...globalNames.map(valueOf), ...named.map(v => v.init)],
    },
    type_var_list: {
      number: [...g(vars.type_var_list.number), ...params.filter(p => p.type == '數字').map(p => p.name), ...lt.number],
      text: [...g(vars.type_var_list.text), ...params.filter(p => p.type == '文字').map(p => p.name), ...lt.text],
      array: [...g(vars.type_var_list.array), ...lt.array],
      grid: [...g(vars.type_var_list.grid), ...lt.grid],
    },
    params: params.map(p => p.name),
    paramsReadOnly: getTarget() == 'scratch',
    locals: named.map(v => v.name.trim()),
    calls: vars.calls,
  };
}

export const createVarStore = (): VarStore => ({
  var_list: { name: [], value: [] },
  type_var_list: { number: [], text: [], array: [], grid: [] },
});

const isNumeric = (s: string) => !isNaN(parseFloat(s)) && isFinite(s as unknown as number);

/** 取清單長度的寫法：長度(成績) 或 length(成績) */
/** 算式裡可以用的清單/文字函式（名稱跟 Scratch 一樣）→ 執行時的小工具 */
const FUNCTIONS: Record<string, string> = {
  長度: '__len', length: '__len',
  項目編號: '__find', indexof: '__find',
  包含: '__has', contains: '__has',
};
const isFunc = (name: string) => Object.prototype.hasOwnProperty.call(FUNCTIONS, name);
/** 第 i 個積木的程式有沒有用到上面的函式 */
const FUNC_CALL = (i: number) => new RegExp(`__(len|find|has)_${i}\\(`);
const LOGIC_WORDS = ['and', 'or', 'not'];

export type Token = { type: 'string' | 'number' | 'name' | 'op'; text: string };

/** 把運算式切成一個一個的單位：字串、數字、名稱、符號（且、或、非 當成符號） */
export function tokenize(str: string): Token[] {
  const tokens: Token[] = [];
  const re = /\s+|("[^"]*"|'[^']*')|(\d+(?:\.\d+)?)|((?:(?![且或非])[\p{L}_$])(?:(?![且或非])[\p{L}\p{N}_$])*)|(.)/gu;
  for (const m of str.matchAll(re)) {
    if (m[1]) tokens.push({ type: 'string', text: m[1] });
    else if (m[2]) tokens.push({ type: 'number', text: m[2] });
    else if (m[3]) tokens.push({ type: 'name', text: m[3] });
    else if (m[4]) tokens.push({ type: 'op', text: m[4] });
  }
  return tokens;
}

/** 「清單[第幾項]」：回傳清單名稱與中括號裡的運算式；不是這種寫法回傳 null */
function listItemTarget(str: string): { list: string; index: string } | null {
  const m = /^\s*([^\s[\]]+)\s*\[(.*)\]\s*$/.exec(str);
  return m ? { list: m[1], index: m[2] } : null;
}

/**
 * 檢查運算式裡的名稱是否都是已定義的變數（can_number 為 true 時也接受數字與 "字串"）。
 * can_number 為 false 時（要存進去的地方）只能是一個變數，或「清單[第幾項]」。
 * 不合法會跳出提示並回傳 false。
 */
export function checkVar(vars: VarStore, str: string | undefined, can_number: boolean): boolean {
  if (!str || !str.trim()) return false;
  const { type_var_list } = vars;
  const defined = (name: string) =>
    type_var_list.number.includes(name) || type_var_list.text.includes(name) || type_var_list.array.includes(name) || type_var_list.grid.includes(name);

  if (!can_number) {
    if (vars.paramsReadOnly && vars.params?.includes(str.trim())) {
      alert(t(`「${str.trim()}」是模組的參數：Scratch 的參數只能拿來算，不能改。要存結果請用變數表裡的變數。`, `"${str.trim()}" is a parameter. In Scratch you can use it, but you cannot change it. Use a variable from the variable table instead.`));
      return false;
    }
    // 二維清單的一格：表[i][j]
    const cell = splitTarget(str);
    if (cell && cell.indexes.length == 2) {
      if (!type_var_list.grid.includes(cell.name)) {
        alert(t(`「${cell.name}」不是二維清單：只有型別是「二維清單」的變數才能用 [列][行]。`, `"${cell.name}" is not a 2D list. Only 2D list variables can use [row][column].`));
        return false;
      }
      return checkVar(vars, cell.indexes[0], true) && checkVar(vars, cell.indexes[1], true);
    }
    const item = listItemTarget(str);
    if (item) {
      if (type_var_list.text.includes(item.list)) {
        alert(t(`「${item.list}」是文字，不能只改其中一個字：可以用 + 把字接起來，存成新的文字。`, `"${item.list}" is text. You cannot change one letter. Use + to join letters into new text.`));
        return false;
      }
      if (!type_var_list.array.includes(item.list)) {
        alert(t(`「${item.list}」不是清單：只有型別是「清單」的變數才能用 [第幾項]。`, `"${item.list}" is not a list. Only list variables can use [ ].`));
        return false;
      }
      return checkVar(vars, item.index, true);
    }
    const tokens = tokenize(str);
    if (tokens.length == 1 && tokens[0].type == 'name' && defined(tokens[0].text)) return true;
    alert(t(`「${str.trim()}」不是變數：請填一個在變數表裡的變數名稱。`, `"${str.trim()}" is not a variable. Write a variable name from the variable table.`));
    return false;
  }
  for (const tk of tokenize(str)) {
    if (tk.type != 'name' || defined(tk.text) || LOGIC_WORDS.includes(tk.text) || isFunc(tk.text) || vars.calls?.includes(tk.text)) continue;
    alert(t(`「${tk.text}」沒有定義：請先在變數表新增這個變數。如果是文字，要用 "雙引號" 括起來。`, `"${tk.text}" is not a variable yet. Add it to the variable table first. For words, use "quotes".`));
    return false;
  }
  return true;
}

/** 找出文字裡出現了哪些變數 */
export function getCodeVar(vars: VarStore, str: string): string[] {
  return vars.var_list.name.filter(name => str.includes(name));
}

/** 執行模組的積木有沒有問題：選了模組、每個參數都填了看得懂的值；不行時跳出提示 */
export function checkCall(vars: VarStore, modules: ModuleInfo[], name: string, args: string[]): boolean {
  const m = modules.find(x => x.name == name);
  if (!m) {
    alert(t('請先選一個模組。', 'Choose a module first.'));
    return false;
  }
  for (let k = 0; k < m.params.length; k++) {
    if (!args[k]?.trim()) {
      alert(t(`請填參數「${m.params[k].name}」要用的值。`, `Fill in the value for "${m.params[k].name}".`));
      return false;
    }
    if (!checkVar(vars, args[k], true)) return false;
  }
  return true;
}

/** 判斷式轉成 JavaScript：= 變 ==、and/or/not（且/或/非）變 && || !，字串裡的字不動 */
function toCondition(str: string) {
  return str.split(/("[^"]*"|'[^']*')/).map((part, i) => i % 2 ? part : part
    .replace(/(?<![<>!=])=(?!=)/g, '==')
    .replace(/\band\b|且/g, '&&')
    .replace(/\bor\b|或/g, '||')
    .replace(/\bnot\b|非/g, '!'),
  ).join('');
}

/** 流程圖沒辦法執行的原因（給學生看的說明），node 是有問題的積木 index（可以在畫面上標出來） */
export class FlowError extends Error {
  readonly node: number | null;
  constructor(message: string, node: number | null = null) {
    super(message);
    this.node = node;
  }
}

const MAX_WALK = 10000;
function guard(counter: { n: number }) {
  if (++counter.n > MAX_WALK) throw new FlowError(t('流程圖繞成一圈出不來：如果要重複執行，請用「迴圈」積木。', 'The flowchart goes around and never stops. To repeat, use a Loop block.'));
}

/** 這段程式語法對不對（只檢查，不執行） */
function syntaxOk(code: string) {
  try {
    Function(code);
    return true;
  }
  catch (e) {
    return !(e instanceof SyntaxError);
  }
}

/** 積木在說明裡的稱呼，例如「輸入 n」（英文模式用英文的積木文字） */
const label = (node: FlowNode) => {
  const text = displayNodeText(node.text ?? '', node.figure).trim();
  return t('「' + (text || '空白的積木') + '」', '"' + (text || 'empty block') + '"');
};

/** 箭頭標籤在說明裡的寫法（英文模式顯示 Yes/No/Repeat/Done） */
const arrowName = (text: string) => displayLinkText(text);

/** 執行時錯誤訊息的範本：{name} {v} {len} {k} 會換成實際的值 */
// 位置超出範圍的說明：積木說「第 k 項」（從 1 開始），C++ 說「索引 k」（從 0 開始）。{max} 是最後一個可以用的位置
const BLOCKS_RANGE_MESSAGES = () => ({
  outOfRange: t('清單「{name}」只有 {len} 項，沒有第 {k} 項（清單從第 1 項開始）。', 'The list "{name}" has only {len} items. There is no item {k}. (Lists start at item 1.)'),
  emptyList: t('清單「{name}」是空的，沒有第 {k} 項。', 'The list "{name}" is empty. There is no item {k}.'),
  textOutOfRange: t('文字「{name}」只有 {len} 個字，沒有第 {k} 個字（從第 1 個字開始）。', 'The text "{name}" has only {len} letters. There is no letter {k}. (Start at letter 1.)'),
  emptyText: t('文字「{name}」是空的，沒有第 {k} 個字。', 'The text "{name}" is empty. There is no letter {k}.'),
  insertRange: t('清單「{name}」現在有 {len} 項，只能插在第 1 到第 {max} 項，沒有第 {k} 項（插在第 {max} 項就是加到最後）。', 'The list "{name}" has {len} items. You can insert at item 1 to item {max}. There is no item {k}.'),
});
const CPP_RANGE_MESSAGES = () => ({
  outOfRange: t('清單「{name}」有 {len} 項，索引只能是 0 到 {max}，沒有索引 {k}（C++ 的索引從 0 開始）。', 'The list "{name}" has {len} items. The index must be 0 to {max}. There is no index {k}. (In C++, the index starts at 0.)'),
  emptyList: t('清單「{name}」是空的，沒有索引 {k}。', 'The list "{name}" is empty. There is no index {k}.'),
  textOutOfRange: t('文字「{name}」有 {len} 個字，索引只能是 0 到 {max}，沒有索引 {k}（C++ 的索引從 0 開始）。', 'The text "{name}" has {len} letters. The index must be 0 to {max}. There is no index {k}. (In C++, the index starts at 0.)'),
  emptyText: t('文字「{name}」是空的，沒有索引 {k}。', 'The text "{name}" is empty. There is no index {k}.'),
  insertRange: t('清單「{name}」現在有 {len} 項，插入的索引只能是 0 到 {max}，沒有索引 {k}（插在索引 {max} 就是加到最後）。', 'The list "{name}" has {len} items. You can insert at index 0 to {max}. There is no index {k}.'),
});

const runtimeMessages = () => ({
  noInput: t('測資的輸入不夠：執行到「輸入 {name}」時，已經沒有資料可以讀了。', 'Not enough test input: nothing is left to read at "Input {name}".'),
  inputNotNum: t('測資裡的「{v}」不是數字，不能存進數字變數「{name}」。如果要存文字，請把「{name}」的型別改成文字。', '"{v}" in the test input is not a number. It cannot go into the number variable "{name}". To keep words, change the type of "{name}" to Text.'),
  listToNum: t('清單不能直接存進數字變數「{name}」。', 'A list cannot go into the number variable "{name}".'),
  textToNum: t('「{v}」是文字，不能存進數字變數「{name}」。', '"{v}" is text. It cannot go into the number variable "{name}".'),
  nanToNum: t('計算結果不是數字，不能存進數字變數「{name}」：檢查運算式裡是不是用到了文字。', 'The answer is not a number, so it cannot go into the number variable "{name}". Check if the math uses text.'),
  listToText: t('清單不能直接存進文字變數「{name}」。', 'A list cannot go into the text variable "{name}".'),
  wholeList: t('「{name}」是清單，要改其中一項請寫 {name}[第幾項]。', '"{name}" is a list. To change one item, write {name}[item number].'),
  notList: t('「{name}」不是清單也不是文字，不能用 [第幾項]。', '"{name}" is not a list or text. You cannot use [ ].'),
  ...(getTarget() == 'cpp' ? CPP_RANGE_MESSAGES() : BLOCKS_RANGE_MESSAGES()),
  textItemSet: t('「{name}」是文字，不能只改其中一個字：可以用 + 把字接起來，存成新的文字。', '"{name}" is text. You cannot change one letter. Use + to join letters into new text.'),
  notListEdit: t('「{name}」不是清單，不能加入、插入或刪除。', '"{name}" is not a list. You cannot add, insert or remove.'),
  listInList: t('不能把整個清單加進清單「{name}」，請一次加一項。', 'You cannot add a whole list to "{name}". Add one item at a time.'),
  lenNotList: t('長度( ) 的括號裡要放清單或文字。', 'Put a list or text inside length( ).'),
  findNotList: t('項目編號( ) 和 包含( ) 的括號裡，第一個要放清單或文字，例如 包含(名單, "Amy")。', 'The first thing inside indexof( ) or contains( ) must be a list or text. Example: contains(names, "Amy").'),
  countNotNum: t('迴圈的次數不是數字。', 'The loop count is not a number.'),
  tooManyLoops: t('迴圈一共跑了超過 20000 次，可能停不下來：檢查條件迴圈的條件會不會成立、次數是不是太大。', 'The loops ran more than 20000 times in all. Maybe a loop never stops. Check the loop condition and the number of times.'),
  gridEmpty: t('二維清單「{name}」還沒有建立大小：先用計算積木「建立 幾 列 幾 行」。', 'The 2D list "{name}" has no size yet. First use a Math block to make it (rows × columns).'),
  gridRow: t('二維清單「{name}」有 {len} 列，列的索引只能是 0 到 {max}，沒有索引 {k}。', 'The 2D list "{name}" has {len} rows. The row index must be 0 to {max}. There is no row {k}.'),
  gridCol: t('二維清單「{name}」每列有 {len} 行，行的索引只能是 0 到 {max}，沒有索引 {k}。', 'The 2D list "{name}" has {len} columns. The column index must be 0 to {max}. There is no column {k}.'),
  gridSize: t('二維清單「{name}」的列數和行數要是 0 以上的整數，現在是 {r} 列 {c} 行。', 'The rows and columns of "{name}" must be whole numbers 0 or more. Now it is {r} × {c}.'),
  notGrid: t('「{name}」不是二維清單，不能用 [列][行]。', '"{name}" is not a 2D list. You cannot use [row][column].'),
  noReturn: t('模組「{name}」要回傳值，可是這次走到「結束」都沒有經過「回傳」：每一條路在「結束」前都要有「回傳」。', 'The module "{name}" must return a value, but it reached "End" without "Return". Every path needs a "Return" before "End".'),
  argCount: t('執行模組「{name}」時給了 {got} 個值，可是它有 {n} 個參數。', 'The module "{name}" got {got} values, but it has {n} parameters.'),
  tooDeep: t('模組一直執行自己（或互相執行）停不下來：檢查模組裡是不是在某個時候就不再執行自己。', 'A module keeps running itself and never stops. Check that it stops at some point.'),
});

// 執行時用到的小工具：存值時檢查型別、清單的位置從 __BASE 開始（積木 1、C++ 0）。錯誤會標出是哪個積木（i）
const runtime = () => `
var __M = ${JSON.stringify(runtimeMessages())};
var __BASE = ${indexBase()};
function __err(key, i, vars) {
  var m = __M[key];
  for (var k in vars) m = m.split('{' + k + '}').join(vars[k]);
  throw new __FlowError(m, i);
}
function __isNum(v) { return typeof v == 'number' && isFinite(v); }
function __read(input, i, name) {
  if (!input.length) __err('noInput', i, { name: name });
  return input.shift();
}
function __inNum(input, i, name) {
  var v = __read(input, i, name);
  if (!(v.trim() != '' && isFinite(v))) __err('inputNotNum', i, { v: v, name: name });
  return Number(v);
}
function __inText(input, i, name) { return __read(input, i, name); }
function __inList(input, i, name) {
  var v = __read(input, i, name);
  return (v.trim() != '' && isFinite(v)) ? Number(v) : v;
}
function __num(v, i, name) {
  if (Array.isArray(v)) __err('listToNum', i, { name: name });
  if (typeof v == 'string') __err('textToNum', i, { v: v, name: name });
  if (!__isNum(v)) __err('nanToNum', i, { name: name });
  return v;
}
function __text(v, i, name) {
  if (Array.isArray(v)) __err('listToText', i, { name: name });
  return String(v);
}
function __list(v, i, name) {
  if (!Array.isArray(v)) __err('wholeList', i, { name: name });
  return v.slice();
}
function __index(list, name, i, k) {
  var isText = typeof list == 'string';
  if (!Array.isArray(list) && !isText) __err('notList', i, { name: name });
  if (!(Number.isInteger(k) && k >= __BASE && k < list.length + __BASE)) {
    var key = isText ? (list.length ? 'textOutOfRange' : 'emptyText') : (list.length ? 'outOfRange' : 'emptyList');
    __err(key, i, { name: name, len: list.length, max: list.length - 1 + __BASE, k: k });
  }
  return k - __BASE;
}
function __at(list, name, i, k) { return list[__index(list, name, i, k)]; }
function __set(list, name, i, k, v) {
  if (typeof list == 'string') __err('textItemSet', i, { name: name });
  list[__index(list, name, i, k)] = v;
}
function __push(list, name, i, v) {
  if (!Array.isArray(list)) __err('notListEdit', i, { name: name });
  if (Array.isArray(v)) __err('listInList', i, { name: name });
  list.push(v);
}
function __insert(list, name, i, k, v) {
  if (!Array.isArray(list)) __err('notListEdit', i, { name: name });
  if (Array.isArray(v)) __err('listInList', i, { name: name });
  if (!(Number.isInteger(k) && k >= __BASE && k <= list.length + __BASE)) {
    __err('insertRange', i, { name: name, len: list.length, max: list.length + __BASE, k: k });
  }
  list.splice(k - __BASE, 0, v);
}
function __remove(list, name, i, k) {
  if (!Array.isArray(list)) __err('notListEdit', i, { name: name });
  list.splice(__index(list, name, i, k), 1);
}
function __len(v, i) {
  if (!Array.isArray(v) && typeof v != 'string') __err('lenNotList', i, {});
  return v.length;
}
// 找不到：積木回傳 0（跟 Scratch 一樣），C++ 回傳 -1（0 是第一個索引）
function __find(list, v, i) {
  if (typeof list == 'string') return list.indexOf(String(v)) + __BASE;
  if (!Array.isArray(list)) __err('findNotList', i, {});
  for (var k = 0; k < list.length; k++) if (list[k] == v) return k + __BASE;
  return __BASE - 1;
}
function __has(list, v, i) { return __find(list, v, i) >= __BASE; }
function __clear(list, name, i) {
  if (!Array.isArray(list)) __err('notListEdit', i, { name: name });
  list.length = 0;
}
function __count(v, i) {
  if (!__isNum(v)) __err('countNotNum', i, {});
  return v;
}
// 二維清單（C++ 的 vector<vector<...>>）：表[r][c]，索引一律從 0 開始
function __cell(g, name, i, r, c) {
  if (!Array.isArray(g) || (g.length && !Array.isArray(g[0]))) __err('notGrid', i, { name: name });
  if (!g.length) __err('gridEmpty', i, { name: name });
  if (!(Number.isInteger(r) && r >= 0 && r < g.length)) __err('gridRow', i, { name: name, len: g.length, max: g.length - 1, k: r });
  var row = g[r];
  if (!(Number.isInteger(c) && c >= 0 && c < row.length)) __err('gridCol', i, { name: name, len: row.length, max: row.length - 1, k: c });
  return row;
}
function __at2(g, name, i, r, c) { return __cell(g, name, i, r, c)[c]; }
function __set2(g, name, i, r, c, v) { __cell(g, name, i, r, c)[c] = v; }
function __grid(name, i, r, c, fill) {
  if (!(Number.isInteger(r) && r >= 0 && Number.isInteger(c) && c >= 0)) __err('gridSize', i, { name: name, r: r, c: c });
  var g = [];
  for (var k = 0; k < r; k++) { var row = []; for (var j = 0; j < c; j++) row.push(fill); g.push(row); }
  return g;
}
// 輸出清單：一項一項用空白隔開；二維清單一列一行
function __show(v) {
  if (!Array.isArray(v)) return v;
  if (v.length && Array.isArray(v[0])) return v.map(function (row) { return row.join(' '); }).join('\\n');
  return v.join(' ');
}
`;

interface CodeResult {
  code: string;
  next: FlowNode | undefined;
}

/** 把流程圖逐一走訪，產生對應的 JavaScript 程式碼 */
class CodeGenerator {
  private readonly nodes: (FlowNode | null)[];
  private readonly diagram: Diagram;
  private readonly vars: VarStore;
  private readonly varStr: string;
  private readonly counter = { n: 0 };
  /** 第幾張流程圖：0 是主程式，模組依序是 1、2… */
  private readonly sheet: number;
  private readonly modules: ModuleInfo[];
  /** 在模組裡：這個模組的參數 */
  private readonly params: ParamInfo[];
  /** 在模組裡：這個模組的區域變數（只有 C++） */
  private readonly locals: LocalVar[];
  /** Scratch 的模組：可以用「主流程的a」（見 withParams） */
  private readonly globalRefs: boolean;

  constructor(diagram: Diagram, vars: VarStore, sheet = 0, modules: ModuleInfo[] = [], params: ParamInfo[] = [], locals: LocalVar[] = []) {
    this.diagram = diagram;
    this.nodes = diagram.nodes;
    this.vars = withParams(vars, params, locals, sheet > 0);
    this.sheet = sheet;
    this.modules = modules;
    this.params = params;
    this.locals = locals.filter(v => v.name.trim() != '');
    this.globalRefs = sheet > 0 && getTarget() == 'scratch';
    // 每一步都把所有變數的值記下來。全域變數用 __globals()（寫在最外層，模組裡同名的參數蓋不到它）；
    // 在模組裡，參數和區域變數另外放在 __scope，第四步才分得開（名字可以跟全域變數一樣）
    const own = [...params.map(p => p.name), ...this.locals.map(v => v.name.trim())];
    this.varStr = sheet == 0 ? '__globals()'
      : 'Object.assign(__globals(), {__scope: {' + own.map(n => JSON.stringify(n) + ': ' + n).join(',') + '}})';
  }

  /** 積木在這張流程圖裡的 index（找箭頭用） */
  private idx(node: FlowNode) {
    return this.nodes.indexOf(node);
  }

  /** 積木在整個程式裡的編號（逐步執行、錯誤訊息標出積木用；見 modules.ts） */
  private gid(node: FlowNode) {
    return sheetId(this.sheet, this.idx(node));
  }

  /** 錯誤訊息前面加上「在模組「X」裡」，學生才知道是哪一張流程圖 */
  private where(message: string) {
    return this.sheet == 0 ? message : t(`模組「${this.moduleName()}」裡：`, `In the module "${this.moduleName()}": `) + message;
  }

  private moduleName() {
    return this.modules[this.sheet - 1]?.name ?? '';
  }

  private fail(message: string, node: FlowNode | null): never {
    throw new FlowError(this.where(message), node ? this.gid(node) : null);
  }

  private isList(name: string) {
    return this.vars.type_var_list.array.includes(name);
  }

  /** 變數後面接 [ ] 一律交給 __at/__set 檢查：清單是第幾項、文字是第幾個字，數字會提示不能用 */
  private isVar(name: string) {
    return this.vars.var_list.name.includes(name);
  }

  private isGrid(name: string) {
    return this.vars.type_var_list.grid.includes(name);
  }

  /** 二維清單裡裝的是文字嗎（變數表的初始值欄選「裝文字」） */
  private gridHoldsText(name: string) {
    return this.vars.var_list.value[this.vars.var_list.name.indexOf(name)] == '文字';
  }

  /** 二維清單的一格「表[a][b]」：名稱後面的 [ 是第 k 個，配對的 ] 後面緊接著另一個 [ */
  private isCell(tokens: Token[], k: number) {
    const name = tokens[k - 1];
    if (name?.type != 'name' || !this.isGrid(name.text)) return false;
    let depth = 0;
    for (let j = k; j < tokens.length; j++) {
      if (tokens[j].text == '[') depth++;
      else if (tokens[j].text == ']' && --depth == 0) return tokens[j + 1]?.text == '[';
    }
    return false;
  }

  /** 學生寫的運算式 → JavaScript：清單或文字[第幾項]、二維清單[列][行]、長度(清單或文字)、判斷式的 and/or/= */
  private expr(text: string, i: number, condition = false): string {
    const tokens = tokenize(text);
    // 每個 [ 是哪一種：清單的一項、二維清單的第一個／第二個 [ 、一般的中括號
    const stack: ('item' | 'cell1' | 'cell2' | 'raw')[] = [];
    let secondBracket = false;
    let out = '';
    let prevWord = false;
    tokens.forEach((t, k) => {
      const word = t.type != 'op';
      let piece = t.text;
      if (t.type == 'name' && this.isVar(t.text) && tokens[k + 1]?.text == '[') {
        piece = this.isCell(tokens, k + 1)
          ? `__at2(${t.text}, ${JSON.stringify(t.text)}, ${i}, `
          : `__at(${t.text}, ${JSON.stringify(t.text)}, ${i}, `;
      }
      else if (t.type == 'name' && isFunc(t.text) && !this.isVar(t.text) && tokens[k + 1]?.text == '(') {
        piece = FUNCTIONS[t.text];
      }
      // 有回傳值的模組寫在算式裡：找最大(x, y) → __mod2(x, y)
      else if (t.type == 'name' && !this.isVar(t.text) && tokens[k + 1]?.text == '(' && this.modules.some(m => m.name == t.text && m.returns)) {
        // 每個積木一個版本（__mod2_at7），執行時才記得是哪個積木執行了模組（第四步左邊標出來）
        const k = this.modules.findIndex(m => m.name == t.text) + 1;
        this.callHelpers.add(`${k}:${i}`);
        piece = `__mod${k}_at${i}`;
      }
      else if (t.text == '[') {
        if (secondBracket) {
          // 表[a][b] 的第二個 [：前面已經寫了「, (」
          secondBracket = false;
          stack.push('cell2');
          piece = '';
        }
        else {
          const isItem = tokens[k - 1]?.type == 'name' && this.isVar(tokens[k - 1].text);
          stack.push(!isItem ? 'raw' : this.isCell(tokens, k) ? 'cell1' : 'item');
          piece = isItem ? '(' : '[';
        }
      }
      else if (t.text == ']') {
        const kind = stack.pop();
        piece = kind == 'cell1' ? '), (' : kind == 'raw' || kind == null ? ']' : '))';
        if (kind == 'cell1') secondBracket = true;
      }
      out += (word && prevWord ? ' ' : '') + piece;
      prevWord = word;
    });
    // 長度( )、項目編號( )、包含( ) 要把積木編號傳進去，錯誤時才能標出積木
    out = out.replace(/__(len|find|has)\(/g, `__$1_${i}(`);
    return condition ? toCondition(out) : out;
  }

  /** 積木內容寫錯（程式看不懂）時，指出是哪一個積木 */
  private checkSyntax(node: FlowNode, code: string) {
    if (!syntaxOk(code)) {
      this.fail(label(node) + t(' 的寫法程式看不懂：請檢查變數名稱有沒有打錯、括號和引號有沒有成對。', ' cannot be read. Check the variable names, and check that ( ) and " " come in pairs.'), node);
    }
  }

  /** 不是「結束」卻沒有往下接的箭頭 */
  private noNext(node: FlowNode): never {
    this.fail(label(node) + t(' 後面沒有接箭頭：每個積木都要用箭頭接到下一個積木，最後接到「結束」。', ' has no arrow to the next block. Every block needs an arrow to the next block. The last one goes to "End".'), node);
  }

  /** 把 value 存進 target（變數或 清單[第幾項]），依型別檢查 */
  private assign(target: string, value: string, i: number) {
    // 二維清單的一格：表[a][b]
    const cell = splitTarget(target);
    if (cell && cell.indexes.length == 2 && this.isVar(cell.name)) {
      return `__set2(${cell.name}, ${JSON.stringify(cell.name)}, ${i}, (${this.expr(cell.indexes[0], i)}), (${this.expr(cell.indexes[1], i)}), ${value});\n`;
    }
    const item = listItemTarget(target);
    // 文字、數字變數接 [ ] 也交給 __set，執行時會說明為什麼不行
    if (item && this.isVar(item.list)) {
      return `__set(${item.list}, ${JSON.stringify(item.list)}, ${i}, (${this.expr(item.index, i)}), ${value});\n`;
    }
    const { number, text } = this.vars.type_var_list;
    const name = JSON.stringify(target);
    if (number.includes(target)) return `${target} = __num(${value}, ${i}, ${name});\n`;
    if (text.includes(target)) return `${target} = __text(${value}, ${i}, ${name});\n`;
    if (this.isList(target)) return `${target} = __list(${value}, ${i}, ${name});\n`;
    return `${target} = ${value};\n`;
  }

  /** 用到 長度( )、項目編號( )、包含( ) 的積木編號 */
  private funcHelpers = new Set<number>();

  toCode(node: FlowNode): CodeResult {
    const i = this.gid(node);
    const update = 'Update_output(' + i + ', ' + this.varStr + ');\n';
    const expr = (text: string, condition = false) => {
      const js = this.expr(text, i, condition);
      if (FUNC_CALL(i).test(js)) this.funcHelpers.add(i);
      return js;
    };
    switch (node.figure) {
      case 'Circle':
        if (this.sheet > 0) {
          // 模組：一個 JavaScript 函式，參數就是模組的參數；一直執行自己停不下來時要提醒
          const m = this.modules[this.sheet - 1];
          const name = JSON.stringify(m.name);
          if (node.text == '開始') {
            const head = `function __mod${this.sheet}(${this.params.map(p => p.name).join(', ')}){\n`
              + `if (arguments.length != ${this.params.length}) __err('argCount', ${i}, { name: ${name}, got: arguments.length, n: ${this.params.length} });\n`
              // 傳進來的值照參數的型別檢查
              + this.params.map(p => `${p.name} = ${p.type == '文字' ? '__text' : '__num'}(${p.name}, ${i}, ${JSON.stringify(p.name)});\n`).join('')
              // 區域變數：每次執行模組都重新從初始值開始（遞迴時每一層有自己的一份）
              + this.locals.map(v => `var ${v.name.trim()} = ${initialValue(this.vars, v.name.trim(), v.init)};\n`).join('')
              + 'var __ret;\n';
            // Scratch：模組裡的「主流程的a」透過 __G 讀寫主流程的 a（參數 a 把它蓋住了，直接寫 a 拿不到）
            const open = this.globalRefs ? 'with (__G) {\n' : '';
            return { code: head + open + `if (++__depth > 500) __err('tooDeep', ${i}, {});\ntotal_step ++;\n` + update, next: this.nextOf(node) };
          }
          // 有回傳值的模組：走到結束時一定要已經「回傳」過
          const check = m.returns ? `if (__ret === undefined) __err('noReturn', ${i}, { name: ${name} });\n` : '';
          return { code: 'total_step ++;\n' + update + check + '__depth--;\nreturn __ret;\n' + (this.globalRefs ? '}\n' : '') + '}\n', next: undefined };
        }
        if (node.text == '開始') {
          return { code: 'function flowchart_code(){\n' + update, next: this.nextOf(node) };
        }
        return { code: 'total_step ++;\n' + update + '}\n', next: undefined };
      case 'Function': {
        // 執行模組：先標出這個積木，再跳進模組的流程圖；引數照參數的型別檢查
        const call = parseCall(node.text);
        const k = call ? this.modules.findIndex(m => m.name == call.name) : -1;
        if (!call || k < 0) {
          this.fail(t(`${label(node)} 要執行的模組「${call?.name ?? node.text}」不存在：請雙擊這個積木重新選一個模組。`, `${label(node)} runs the module "${call?.name ?? node.text}", but it does not exist. Double-click the block and choose a module.`), node);
        }
        const m = this.modules[k];
        if (call.args.length != m.params.length) {
          this.fail(t(`${label(node)} 的參數個數不對：模組「${m.name}」要 ${m.params.length} 個參數。請雙擊這個積木重新填。`, `${label(node)} has the wrong number of values. The module "${m.name}" needs ${m.params.length}. Double-click the block to fix it.`), node);
        }
        // 型別在模組的「開始」檢查；有回傳值也沒關係，不用就丟掉
        // __stack 記住現在是從哪個積木執行進來的（第四步左邊標出來）
        const code = `__stack.push(${i});\n__mod${k + 1}(${call.args.map(a => `(${expr(a)})`).join(', ')});\n__stack.pop();\n`;
        this.checkSyntax(node, code);
        return { code: 'total_step ++;\n' + update + code, next: this.nextOf(node) };
      }
      case 'Parallelogram': {
        const parts = node.text.split(' ');
        let code: string;
        if (parts[0].includes('輸入')) {
          const v = parts.slice(1).join(' ').trim();
          if (!v) this.fail(label(node) + t(' 沒有寫要存到哪個變數。', ' needs a variable name.'), node);
          const name = JSON.stringify(v);
          const item = listItemTarget(v);
          const insert = /^(.*?) 插入第 (.*) 項$/s.exec(v);
          const cell = splitTarget(v);
          // 輸入 表[a][b]：二維清單的一格
          if (cell && cell.indexes.length == 2 && this.isVar(cell.name)) {
            const g = JSON.stringify(cell.name);
            const read = this.gridHoldsText(cell.name) ? '__inText' : '__inNum';
            code = `__set2(${cell.name}, ${g}, ${i}, (${expr(cell.indexes[0])}), (${expr(cell.indexes[1])}), ${read}(input_list, ${i}, ${g}));\n`;
          }
          // 輸入 成績 插入第 k 項：跟計算積木的「插入」一樣，k 可以是 1 到 長度+1
          else if (insert) {
            const list = insert[1].trim();
            const listName = JSON.stringify(list);
            code = `__insert(${list}, ${listName}, ${i}, (${expr(insert[2])}), __inList(input_list, ${i}, ${listName}));\n`;
          }
          // 輸入 成績[k]：替換第 k 項，跟計算積木一樣從第 1 項開始，超出範圍會提示
          else if (item && this.isVar(item.list)) {
            const list = JSON.stringify(item.list);
            code = `__set(${item.list}, ${list}, ${i}, (${expr(item.index)}), __inList(input_list, ${i}, ${list}));\n`;
          }
          else if (this.isList(v)) code = `${v}.push(__inList(input_list, ${i}, ${name}));\n`;
          else if (this.vars.type_var_list.text.includes(v)) code = `${v} = __inText(input_list, ${i}, ${name});\n`;
          else code = `${v} = __inNum(input_list, ${i}, ${name});\n`;
        }
        else {
          code = 'output_result += (__show(' + expr(parts.slice(1).join(' ')) + ') + "\\n");\n';
        }
        this.checkSyntax(node, code);
        return { code: code + 'total_step ++;\n' + update, next: this.nextOf(node) };
      }
      case 'Diamond': {
        const cond = expr(node.text, true);
        this.checkSyntax(node, 'return (' + cond + ');');
        const ie = this.branch(node, t => t.includes('true') || t.includes('真'), '真');
        const el = this.branch(node, t => t.includes('false') || t.includes('假'), '假');
        const code = 'if(' + cond + '){\n' + update + ie.code
          + '}else{\n' + update + el.code + '}\n';
        return { code: code + 'total_step ++;\n', next: ie.next };
      }
      case 'For_Loop': {
        const times = '__count(' + expr(node.text.substring(0, node.text.length - 1)) + ', ' + i + ')';
        this.checkSyntax(node, 'return (' + times + ');');
        const c = 'counter' + i;
        let code = 'for(let ' + c + '=0; ' + c + '<' + times + ';' + c + '++){\ntotal_step ++;' + update;
        const l = this.loop(node, '進入迴圈', '離開迴圈');
        // 所有迴圈加起來跑太多次：多半是停不下來，直接告訴學生（不要悄悄停掉，答案會錯得莫名其妙）
        code += `if(--__loopTrap < 0) __err('tooManyLoops', ${i}, {});\n` + l.code + '\n}\n';
        code += 'total_step ++;' + update;
        return { code, next: l.next };
      }
      case 'While_Loop': {
        const cond = expr(node.text, true);
        this.checkSyntax(node, 'return (' + cond + ');');
        let code = 'while(!(' + cond + ')){\ntotal_step ++;' + update;
        const l = this.loop(node, '假', '真');
        code += `if(--__loopTrap < 0) __err('tooManyLoops', ${i}, {});\n` + l.code + '\n}\n';
        code += 'total_step ++;' + update;
        return { code, next: l.next };
      }
      case 'Rectangle': {
        const { target, action, index, index2, expr: rest } = splitRectangle(node.text);
        const value = (node.data || '') + '(' + expr(rest.split('(取')[0]) + ')';
        if (action == '回傳') {
          // 回傳：只能在有回傳值的模組裡，而且後面直接接「結束」（回傳完就離開模組）
          const m = this.modules[this.sheet - 1];
          if (!m?.returns) this.fail(t(`${label(node)}：只有「有回傳值」的模組裡才能用「回傳」。`, `${label(node)}: "Return" can only be used in a module that returns a value.`), node);
          const next = this.nextOf(node);
          if (next && !(next.figure == 'Circle' && next.text == '結束')) {
            this.fail(t(`${label(node)} 後面要直接接「結束」：回傳之後就離開模組，後面的積木不會做。`, `${label(node)} must go straight to "End". After returning, the module stops.`), node);
          }
          const code = `__ret = ${m.returns == '文字' ? '__text' : '__num'}(${value}, ${i}, ${JSON.stringify(t('回傳值', 'return value'))});\n`;
          this.checkSyntax(node, code);
          return { code: code + 'total_step ++;' + update, next };
        }
        const name = JSON.stringify(target);
        const code = action == '加入' ? `__push(${target}, ${name}, ${i}, ${value});\n`
          : action == '插入' ? `__insert(${target}, ${name}, ${i}, (${expr(index)}), ${value});\n`
          : action == '刪除' ? `__remove(${target}, ${name}, ${i}, (${expr(index)}));\n`
          : action == '清空' ? `__clear(${target}, ${name}, ${i});\n`
          // 二維清單設定大小：每一格放 0（裝文字的放空的文字）
          : action == '建立' ? `${target} = __grid(${name}, ${i}, (${expr(index)}), (${expr(index2)}), ${this.gridHoldsText(target) ? '""' : '0'});\n`
          : this.assign(action == '替換' ? `${target}[${index}]${index2 ? `[${index2}]` : ''}` : target, value, i);
        this.checkSyntax(node, code);
        return { code: code + 'total_step ++;' + update, next: this.nextOf(node) };
      }
      default:
        return { code: '', next: undefined };
    }
  }

  private nextOf(node: FlowNode, pred: (text: string) => boolean = () => true) {
    const link = this.diagram.links.find(l => l && l.from == this.idx(node) && pred(l.text));
    return link ? this.nodes[link.to] ?? undefined : undefined;
  }

  private linksInto(node: FlowNode | undefined) {
    return this.diagram.links.filter(l => l && node && l.to == this.idx(node)).length;
  }

  /** 迴圈：先走「進入迴圈/假」那條直到繞回自己，出口是「離開迴圈/真」那條 */
  private loop(node: FlowNode, enter: string, exit: string): CodeResult {
    const isEnter = (t: string) => t.includes('進入迴圈') || t.includes('假');
    const isExit = (t: string) => t.includes('離開迴圈') || t.includes('真');
    let next = this.nextOf(node, isEnter);
    if (!next) this.fail(t(`迴圈${label(node)} 少了「${enter}」的箭頭（迴圈裡要做的事）。`, `The loop ${label(node)} needs a "${arrowName(enter)}" arrow (what to repeat).`), node);
    let code = '';
    while (next != node) {
      guard(this.counter);
      const r = this.toCode(next);
      code += r.code;
      if (!r.next) {
        if (next.text == '結束') this.fail(t(`迴圈${label(node)} 裡面的積木要接回迴圈，不能直接接到「結束」。`, `Blocks inside the loop ${label(node)} must go back to the loop, not to "End".`), next);
        this.fail(label(next) + t(' 後面沒有接箭頭：迴圈裡最後一個積木要用箭頭接回迴圈。', ' has no arrow. The last block in a loop needs an arrow back to the loop.'), next);
      }
      next = r.next;
    }
    const after = this.nextOf(node, isExit);
    if (!after) this.fail(t(`迴圈${label(node)} 少了「${exit}」的箭頭（迴圈結束後要做的事）。`, `The loop ${label(node)} needs a "${arrowName(exit)}" arrow (what to do after the loop).`), node);
    return { code, next: after };
  }

  /** 判斷的一個分支：一路走到匯合點（有兩條以上箭頭指進來的積木）為止 */
  private branch(node: FlowNode, pred: (text: string) => boolean, name: string): CodeResult {
    let next = this.nextOf(node, pred);
    if (!next) this.fail(t(`判斷${label(node)} 少了「${name}」的箭頭。`, `The decision ${label(node)} needs a "${arrowName(name)}" arrow.`), node);
    let code = '';
    let num = this.linksInto(next);
    while (next && ((next.figure != 'Diamond' && num == 1) || (next.figure == 'Diamond' && num < 2))) {
      guard(this.counter);
      const r = this.toCode(next);
      code += r.code;
      if (!r.next && next.text != '結束') this.noNext(next);
      next = r.next;
      num = this.linksInto(next);
    }
    return { code, next };
  }

  /** 從「開始」走到「結束」 */
  program(): string {
    let start = this.nodes.find(n => n && n.text == '開始');
    if (!start) this.fail(t('流程圖少了「開始」。', 'The flowchart needs a "Start" block.'), null);
    let code = '';
    while (start.text != '結束') {
      guard(this.counter);
      const r = this.toCode(start);
      code += r.code;
      if (!r.next) this.noNext(start);
      start = r.next;
    }
    code += this.toCode(start).code;
    // 每個用到這些函式的積木各一個版本，錯誤時才知道是哪個積木
    const helpers = [...this.funcHelpers].map(i =>
      `function __len_${i}(v) { return __len(v, ${i}); }\n`
      + `function __find_${i}(l, v) { return __find(l, v, ${i}); }\n`
      + `function __has_${i}(l, v) { return __has(l, v, ${i}); }\n`).join('')
      // 算式裡執行有回傳值的模組
      + [...this.callHelpers].map(key => {
        const [k, i] = key.split(':');
        return `function __mod${k}_at${i}() { __stack.push(${i}); var r = __mod${k}.apply(null, arguments); __stack.pop(); return r; }\n`;
      }).join('');
    return helpers + code;
  }

  /** 算式裡執行模組的積木：「模組編號:積木編號」 */
  private callHelpers = new Set<string>();
}

export interface RunResult {
  totalStep: number;
  /** 每一步正在執行的積木 index */
  step: number[];
  /** 每一步所有變數的值（清單是陣列） */
  var: Record<string, unknown>[];
  /** 每一步為止的輸出 */
  output: string[];
  /** 每一步在模組裡的話：是從哪些積木一層一層執行進來的（最後一個是最近的那一層）；在主流程是空的 */
  stack: number[][];
  /** 執行到一半出錯：前面的步驟照樣保留，最後一步之後就是這個錯誤 */
  error?: FlowError;
}

/** 變數的初始值：清單一開始是空的；文字變數沒加引號時自動加上；數字變數要是數字 */
function initialValue(vars: VarStore, name: string, raw: string | undefined): string {
  if (vars.type_var_list.array.includes(name) || vars.type_var_list.grid.includes(name)) return '[]';
  const value = (raw ?? '').trim();
  if (vars.type_var_list.text.includes(name)) {
    return /^(".*"|'.*')$/.test(value) ? value : JSON.stringify(value);
  }
  if (value == '') return '0';
  if (!isNumeric(value)) throw new FlowError(t(`變數「${name}」是數字，但初始值「${value}」不是數字：請到第三步的變數表修改。`, `"${name}" is a number variable, but its start value "${value}" is not a number. Change it in the variable table (step 3).`));
  return value;
}

/** 用某一組測資執行流程圖，記錄每一步；沒辦法執行時丟出 FlowError（附上給學生看的說明） */
export function buildRun(diagram: Diagram, vars: VarStore, inputText: string, modules: ModuleSource[] = []): RunResult {
  // 測資的輸入用空白、換行或逗號分開，每一項先當文字，存進變數時再依型別轉換
  const input_list = inputText.split(/[\n\s,]+/g).filter(s => s != '');

  // 變數表裡沒填名稱的列不算
  const names = vars.var_list.name.filter(n => n.trim() != '');
  // 變數跟模組或參數同名：流程圖上分不出是哪一個，請學生改名（建立模組時會擋，但之後才新增的變數要在這裡擋）
  for (const m of modules) {
    if (names.includes(m.info.name)) {
      throw new FlowError(t(`變數表裡的「${m.info.name}」跟模組同名：請把變數或模組改一個名字。`, `The variable "${m.info.name}" has the same name as a module. Rename one of them.`));
    }
    // 參數、區域變數可以跟全域變數同名（模組裡指的是自己的）；但不能跟模組同名，彼此也不能重複
    const own = [...m.info.params.map(p => p.name), ...(m.info.locals ?? []).map(v => v.name.trim()).filter(Boolean)];
    const clash = own.find((n, k) => modules.some(x => x.info.name == n) || own.indexOf(n) != k);
    if (clash) {
      throw new FlowError(t(`模組「${m.info.name}」的「${clash}」跟模組名稱、參數或另一個區域變數同名，流程圖上分不出是哪一個：請改一個名字。`, `"${clash}" in "${m.info.name}" has the same name as a module, parameter or another local variable. Rename it.`));
    }
    const locals = (m.info.locals ?? []).map(v => v.name.trim()).filter(Boolean);
    for (const n of locals) {
      if (!syntaxOk(`var ${n};`)) throw new FlowError(t(`模組「${m.info.name}」的區域變數名稱「${n}」不能用：名稱裡不能有空白或符號，也不能用數字開頭。`, `"${n}" cannot be a variable name. Do not use spaces or symbols, and do not start with a number.`));
    }
    // C++：主流程的變數寫在 main 裡面，模組用不到（要用值就用參數傳進來，要帶回去就用回傳）
    if (getTarget() == 'cpp') {
      const own = new Set([...m.info.params.map(p => p.name), ...locals]);
      const sheet = modules.indexOf(m) + 1;
      m.diagram.nodes.forEach((node, k) => {
        const used = node && tokenize(node.text).find(tk => tk.type == 'name' && names.includes(tk.text) && !own.has(tk.text));
        if (used) {
          throw new FlowError(t(
            `模組「${m.info.name}」裡用了主流程的變數「${used.text}」：C++ 的主流程變數寫在 main 裡面，模組用不到。要用它的值，請加一個參數傳進來；要把結果帶回主流程，請用回傳。`,
            `The module "${m.info.name}" uses "${used.text}" from the main flow. In C++ those variables are inside main, so a module cannot use them. Pass the value in as a parameter, and use a return value to bring a result back.`,
          ), sheetId(sheet, k));
        }
      });
    }
  }
  // 測資的輸入放在外面，主程式和模組都讀同一份；__depth 是模組執行自己的層數
  let code = 'var total_step = 0;\nvar output_result = "";\nvar step_list = {step: [], var: [], output: [], stack: []};\nvar __loopTrap = 20000;\nvar __depth = 0;\nvar __stack = [];\n';
  code += 'var input_list = ' + JSON.stringify(input_list) + ';\n';
  code += runtime();
  for (const name of names) {
    const decl = 'var ' + name + ' = ' + initialValue(vars, name, vars.var_list.value[vars.var_list.name.indexOf(name)]) + '\n';
    if (!syntaxOk(decl)) throw new FlowError(t(`變數名稱「${name}」不能用：名稱裡不能有空白或符號，也不能用數字開頭。`, `"${name}" cannot be a variable name. Do not use spaces or symbols, and do not start with a number.`));
    code += decl;
  }
  // 「主流程的a」：模組裡讀寫主流程的 a（Scratch；見 withParams）
  code += 'var __G = {' + names.map(n => {
    const key = JSON.stringify(GLOBAL_PREFIX + n);
    return `get ${key}() { return ${n}; }, set ${key}(v) { ${n} = v; }`;
  }).join(', ') + '};\n';
  // 全域變數的值（寫在最外層：模組裡就算有同名的參數，這裡拿到的還是全域的）
  code += 'function __globals(){ return {' + names.map(n => JSON.stringify(n) + ': ' + n).join(',') + '}; }\n';
  code += 'function Update_output(a,b){\nstep_list.output.push(output_result);\nstep_list.step.push(a);\nstep_list.var.push(typeof b=="object" ? JSON.parse(JSON.stringify(b)) : b);\nstep_list.stack.push(__stack.slice());\n}\n';
  const infos = modules.map(m => m.info);
  code += new CodeGenerator(diagram, vars, 0, infos).program();
  // 模組：每個模組一個函式（__mod1、__mod2…）
  modules.forEach((m, k) => {
    code += new CodeGenerator(m.diagram, vars, k + 1, infos, m.info.params, m.info.locals).program();
  });
  // 執行到一半出錯時，保留出錯前的每一步，學生才看得到變數是怎麼變的
  code += 'var __error = null;\ntry { flowchart_code(); } catch (e) { __error = e; }\n';
  code += 'return {totalStep: total_step, step: step_list.step, var: step_list.var, output: step_list.output, stack: step_list.stack, error: __error};\n';

  console.log('code = \n', code);
  const diagrams = [diagram, ...modules.map(m => m.diagram)];
  let result: Omit<RunResult, 'error'> & { error: unknown };
  try {
    result = Function('__FlowError', code)(FlowError);
  }
  catch (e) {
    throw explainError(e, diagrams);
  }
  if (result.error == null) return { ...result, error: undefined };
  // 連第一步都沒跑到就出錯：當成整個沒辦法執行
  if (result.step.length == 0) throw explainError(result.error, diagrams);
  return { ...result, totalStep: result.step.length - 1, error: explainError(result.error, diagrams) };
}

/** 執行時的錯誤換成給學生看的說明；diagrams 是主程式和各個模組的流程圖 */
function explainError(e: unknown, diagrams: Diagram[]): FlowError {
  if (e instanceof FlowError) return e;
  // 模組執行自己太多層，JavaScript 自己的堆疊先滿了
  if (e instanceof RangeError) return new FlowError(runtimeMessages().tooDeep);
  const missing = e instanceof ReferenceError && /^(.+) is not defined$/.exec(e.message);
  if (missing) {
    const name = missing[1];
    let at: number | null = null;
    diagrams.forEach((d, sheet) => {
      const k = d.nodes.findIndex(n => n != null && n.text.includes(name));
      if (at == null && k >= 0) at = sheetId(sheet, k);
    });
    return new FlowError(t(`「${name}」沒有定義：請到第三步的變數表新增這個變數，或檢查積木裡是不是打錯字。`, `"${name}" is not a variable. Add it to the variable table (step 3), or check the spelling in your blocks.`), at);
  }
  if (e instanceof SyntaxError) {
    return new FlowError(t('有積木的寫法程式看不懂：請檢查變數名稱、運算式的括號和引號。', 'A block cannot be read. Check the variable names, ( ) and " ".'));
  }
  return new FlowError(t('執行時發生錯誤：', 'Something went wrong: ') + (e as Error).message);
}
