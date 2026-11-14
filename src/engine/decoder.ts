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
import { displayLinkText, displayNodeText, parseSortKeys, splitRectangle, splitTarget } from './labels';
import { cppNameProblem, elemCppType, GLOBAL_PREFIX, parseCall, sheetId, type LocalVar, type ModuleInfo, type ModuleSource, type ParamInfo } from './modules';
import type { FlowNode } from './node';
import { exprType, fieldOf, forInit, forLoopVars, forUpdate, parseExpr, splitFor, structOf, type Expr, type ExprType, type VarInfo, type VarType } from './structure';
import { fieldCppType, fieldInit, findStruct, getStructs } from './structs';

/** 第三步「變數」表格整理出來的變數清單 */
export interface VarStore {
  var_list: { name: string[]; value: string[] };
  /**
   * array：清單（C++ 的 vector）和陣列（C++ 的 array，也在 fixed 裡）——都可以用 [索引]。
   * 只有學習目標是 C++ 時才有：grid 二維清單、fixed 陣列（大小固定，不能加入或刪除）、stack 堆疊、queue 佇列
   */
  type_var_list: { number: string[]; text: string[]; array: string[]; grid: string[]; fixed: string[]; stack: string[]; queue: string[]; record: string[] };
  /** 陣列的大小（變數表填的） */
  sizes?: Record<string, string>;
  /** struct 變數每個欄位的初始值（變數名稱 → 欄位 → 值） */
  structInits?: Record<string, Record<string, string>>;
  /** 在模組裡：模組的參數（也放在 number / text 裡，算式可以用） */
  params?: string[];
  /** 參數不能存值進去（Scratch 的自訂積木參數不能改；Blockly、C++ 可以） */
  paramsReadOnly?: boolean;
  /** 在模組裡：這個模組的區域變數（只有 C++；也放在 var_list、type_var_list 裡） */
  locals?: string[];
  /** 有回傳值的模組名稱：算式裡可以寫「名稱(引數)」 */
  calls?: string[];
  /** C++：宣告成 float（小數）的數字變數、參數；其他數字是 int（整數），存值時小數會被去掉（跟 C++ 一樣） */
  floats?: string[];
  /** C++：宣告成 long long 的數字變數、參數；int 超過範圍會溢位（跟 C++ 一樣），long long 不會 */
  longs?: string[];
  /** C++：全域變數（宣告在 main 外面，模組也用得到） */
  globals?: string[];
  /**
   * C++：只有全域變數的那一份（模組裡用的就是這一份）。全域變數可以跟 main 的變數同名（不同的作用域）：
   * 這時 main 用自己的，模組用全域的，這一份的名字指的就是全域的
   */
  globalVars?: VarStore;
  /** C++：被 main 的同名變數蓋住的全域變數（main 裡看不到，模組看得到） */
  shadowed?: string[];
  /** C++：這張流程圖的 for 迴圈計數變數（例如 i；不用在變數表宣告，算式裡可以用） */
  loopVars?: string[];
}

/** 區域變數照型別分好（給下拉選單、型別檢查用） */
export function localTypes(locals: LocalVar[] = []): VarStore['type_var_list'] {
  const named = locals.filter(v => v.name.trim() != '');
  const of = (type: VarType) => named.filter(v => v.type == type).map(v => v.name.trim());
  return { number: of('數字'), text: of('文字'), array: [...of('清單'), ...of('陣列')], grid: of('二維清單'), fixed: of('陣列'), stack: of('堆疊'), queue: of('佇列'), record: of('結構') };
}

/** 變數表的每一列（名稱、型別）→ 依型別分好的名稱 */
export function typeLists(rows: { name: string; type: VarType }[]): VarStore['type_var_list'] {
  const of = (type: VarType) => rows.filter(r => r.type == type).map(r => r.name);
  return { number: of('數字'), text: of('文字'), array: [...of('清單'), ...of('陣列')], grid: of('二維清單'), fixed: of('陣列'), stack: of('堆疊'), queue: of('佇列'), record: of('結構') };
}

/** 兩組依型別分好的名稱接起來 */
export function joinTypes(a: VarStore['type_var_list'], b: VarStore['type_var_list']): VarStore['type_var_list'] {
  return {
    number: [...a.number, ...b.number], text: [...a.text, ...b.text], array: [...a.array, ...b.array], grid: [...a.grid, ...b.grid],
    fixed: [...a.fixed, ...b.fixed], stack: [...a.stack, ...b.stack], queue: [...a.queue, ...b.queue], record: [...a.record, ...b.record],
  };
}

/** 每一種依型別分好的名稱都套用 f（例如把模組裡看不到的拿掉） */
export function mapTypes(a: VarStore['type_var_list'], f: (list: string[]) => string[]): VarStore['type_var_list'] {
  return { number: f(a.number), text: f(a.text), array: f(a.array), grid: f(a.grid), fixed: f(a.fixed), stack: f(a.stack), queue: f(a.queue), record: f(a.record) };
}

/**
 * C++ 容器在算式裡可以用的函式（點了對話框的按鈕就填進去，不用自己打）：
 * stack：top() 最上面那個、size()、empty()；queue：front() 最前面、back() 最後面、size()、empty()；
 * vector：size()、empty()（array 的大小是固定的，沒有這些函式）
 */
export const METHODS = {
  stack: ['top', 'size', 'empty'],
  queue: ['front', 'back', 'size', 'empty'],
  vector: ['size', 'empty'],
  // string：s.length()、s.size()、s.substr(從哪個索引, 幾個字)
  string: ['length', 'size', 'substr'],
} as const;

/** 要填引數的函式：幾個到幾個 */
const METHOD_ARGS: Record<string, [number, number]> = { substr: [1, 2] };

/** 這個名稱是哪一種容器（用來決定可以用哪些函式）；不是容器回傳 null */
export function containerKind(vars: VarStore, name: string): 'stack' | 'queue' | 'vector' | 'array' | 'grid' | null {
  const ty = vars.type_var_list;
  return ty.stack.includes(name) ? 'stack' : ty.queue.includes(name) ? 'queue' : ty.fixed.includes(name) ? 'array'
    : ty.array.includes(name) ? 'vector' : ty.grid.includes(name) ? 'grid' : null;
}

/** C++ 型別的名稱（給學生看的說明用），例如 stack<int> */
export function cppContainerName(vars: VarStore, name: string): string {
  const holds = vars.var_list.value[vars.var_list.name.indexOf(name)];
  const elem = elemCppType(holds);
  const kind = containerKind(vars, name);
  if (kind == 'array') return `${elem} ${name}[${vars.sizes?.[name] ?? ''}]`;
  if (kind == 'grid') return `vector<vector<${elem}>>`;
  return `${kind ?? 'vector'}<${elem}>`;
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
  // C++ 的模組只看得到全域變數（主流程其他的變數寫在 main 裡面）：用只有全域變數的那一份
  const base = target == 'cpp' ? vars.globalVars ?? createVarStore() : vars;
  const visible = (n: string) => !own.has(n);
  // Scratch：被蓋住的主流程變數改叫「主流程的a」
  const renamed = (n: string) => (target == 'scratch' && own.has(n) ? [GLOBAL_PREFIX + n] : []);
  const g = (list: string[]) => list.flatMap(n => (visible(n) ? [n] : renamed(n)));
  const globalNames = g(base.var_list.name);
  const valueOf = (n: string) => base.var_list.value[base.var_list.name.indexOf(n.startsWith(GLOBAL_PREFIX) ? n.slice(GLOBAL_PREFIX.length) : n)];
  return {
    var_list: {
      name: [...globalNames, ...named.map(v => v.name.trim())],
      value: [...globalNames.map(valueOf), ...named.map(v => v.init)],
    },
    type_var_list: joinTypes(mapTypes(base.type_var_list, g), {
      ...lt,
      number: [...params.filter(p => p.type == '數字').map(p => p.name), ...lt.number],
      text: [...params.filter(p => p.type == '文字').map(p => p.name), ...lt.text],
    }),
    sizes: { ...base.sizes, ...Object.fromEntries(named.filter(v => v.type == '陣列').map(v => [v.name.trim(), v.size ?? ''])) },
    structInits: { ...base.structInits, ...Object.fromEntries(named.filter(v => v.type == '結構' && v.fieldInit).map(v => [v.name.trim(), v.fieldInit!])) },
    globals: vars.globals,
    params: params.map(p => p.name),
    paramsReadOnly: getTarget() == 'scratch',
    locals: named.map(v => v.name.trim()),
    calls: vars.calls,
    floats: [...g(base.floats ?? []), ...params.filter(p => p.type == '數字' && p.float).map(p => p.name), ...named.filter(v => v.type == '數字' && v.float).map(v => v.name.trim())],
    longs: [...g(base.longs ?? []), ...params.filter(p => p.type == '數字' && p.long).map(p => p.name), ...named.filter(v => v.type == '數字' && v.long).map(v => v.name.trim())],
  };
}

export const createVarStore = (): VarStore => ({
  var_list: { name: [], value: [] },
  type_var_list: { number: [], text: [], array: [], grid: [], fixed: [], stack: [], queue: [], record: [] },
});

/** 變數（或容器）裡裝的 struct 名稱：struct 變數、裝 struct 的 array / vector；不是的話 undefined */
export function structNameOf(vars: VarStore, name: string): string | undefined {
  const holds = vars.var_list.value[vars.var_list.name.indexOf(name)];
  return findStruct(holds) ? holds : undefined;
}

/** 第四步顯示被 main 同名變數蓋住的全域變數：「x（全域）」 */
export const shadowLabel = (name: string) => t(`${name}（全域）`, `${name} (global)`);

/** 欄位當存值的地方：「e.from」「edges[i].w」→ 前面那段和欄位名稱；不是這種寫法回傳 null */
export function splitField(str: string): { base: string; field: string } | null {
  const m = /^\s*(.+?)\s*\.\s*([^\s.[\]()]+)\s*$/s.exec(str);
  return m ? { base: m[1], field: m[2] } : null;
}

const isNumeric = (s: string) => !isNaN(parseFloat(s)) && isFinite(s as unknown as number);

/** 取清單長度的寫法：長度(成績) 或 length(成績) */
/** 算式裡可以用的清單/文字函式（名稱跟 Scratch 一樣）→ 執行時的小工具 */
const FUNCTIONS: Record<string, string> = {
  長度: '__len', length: '__len',
  項目編號: '__find', indexof: '__find',
  包含: '__has', contains: '__has',
  // C++：文字變整數、數字變文字
  stoi: '__stoi', to_string: '__tostr',
  max: '__max', min: '__min',
};
const isFunc = (name: string) => Object.prototype.hasOwnProperty.call(FUNCTIONS, name);
/** 第 i 個積木的程式有沒有用到上面的函式 */
const FUNC_CALL = (i: number) => new RegExp(`__(len|find|has|stoi|tostr|max|min)_${i}\\(`);

/**
 * 二維 vector 某一列的 size()、empty()：g[u].size() → 長度(g[u])、g[u].empty() → (長度(g[u]) == 0)，
 * 執行時就跟一般的長度( ) 一樣（鄰接串列常用：g[u] 有幾個鄰居）
 */
export function rowMethods(text: string): string {
  let out = text;
  for (let guard = 0; guard < 50; guard++) {
    const m = /\]\s*\.\s*(size|empty)\s*\(\s*\)/.exec(out);
    if (!m) break;
    // 往前找配對的 [ ，再往前是名稱
    let depth = 0;
    let k = m.index;
    for (; k >= 0; k--) {
      if (out[k] == ']') depth++;
      else if (out[k] == '[' && --depth == 0) break;
    }
    const name = /([\p{L}_$][\p{L}\p{N}_$]*)\s*$/u.exec(out.slice(0, Math.max(k, 0)));
    if (k < 0 || !name) break;
    const start = k - name[0].length;
    const obj = out.slice(start, m.index + 1);
    const repl = m[1] == 'size' ? `長度(${obj})` : `(長度(${obj}) == 0)`;
    out = out.slice(0, start) + repl + out.slice(m.index + m[0].length);
  }
  return out;
}
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
  const defined = (name: string) => Object.values(type_var_list).some(list => list.includes(name)) || !!vars.loopVars?.includes(name);

  if (!can_number) {
    // ::a：全域的數字、文字變數
    const scoped = scopedName(str);
    if (scoped != null) return scopedOk(vars, scoped) && checkVar(vars.globalVars!, scoped, false);
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
    // struct 的欄位：e.from、edges[i].w
    const field = splitField(str);
    if (field) return fieldTargetOk(vars, field.base, field.field);
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
  const tokens = tokenize(str);
  for (const [k, tk] of tokens.entries()) {
    // ::a：全域的 a
    if (tk.text == ':' && tk.type == 'op') {
      if (tokens[k + 1]?.text == ':' && tokens[k + 2]?.type == 'name') {
        if (!scopedOk(vars, tokens[k + 2].text)) return false;
      }
      else if (tokens[k - 1]?.text != ':') {
        alert(t('「:」只能寫成 ::名稱（全域的那個變數），例如 ::a。', 'Use ":" only as ::name (the global variable), like ::a.'));
        return false;
      }
      continue;
    }
    if (tokens[k - 1]?.text == ':' && tokens[k - 2]?.text == ':') continue;
    // s.top()：點後面的名稱是容器的函式；後面沒有括號的是 struct 的欄位（最後一起檢查）
    if (tk.text == '.' && tk.type == 'op') {
      if (tokens[k + 2]?.text == '(' && !methodOk(vars, tokens, k)) return false;
      continue;
    }
    // stoi、to_string 只有 C++ 有
    if ((tk.text == 'stoi' || tk.text == 'to_string') && tokens[k + 1]?.text == '(' && getTarget() != 'cpp' && !defined(tk.text)) {
      alert(t(`${tk.text}( ) 是 C++ 的寫法：積木裡數字和文字會自己轉換，不用 ${tk.text}。`, `${tk.text}( ) is C++ only. In blocks, numbers and text convert by themselves.`));
      return false;
    }
    if ((tk.text == 'max' || tk.text == 'min') && tokens[k + 1]?.text == '(' && getTarget() != 'cpp' && !defined(tk.text)) {
      alert(t(`${tk.text}( ) 是 C++ 的寫法：積木請用判斷或迴圈找最大、最小的值。`, `${tk.text}( ) is C++ only. In blocks, use a decision or a loop to find the largest or smallest value.`));
      return false;
    }
    if (tokens[k - 1]?.text == '.' && tokens[k - 1].type == 'op') continue;
    if (tk.type != 'name' || defined(tk.text) || LOGIC_WORDS.includes(tk.text) || isFunc(tk.text) || vars.calls?.includes(tk.text)) continue;
    alert(t(`「${tk.text}」沒有定義：請先在變數表新增這個變數。如果是文字，要用 "雙引號" 括起來。`, `"${tk.text}" is not a variable yet. Add it to the variable table first. For words, use "quotes".`));
    return false;
  }
  return fieldsOk(vars, parseExpr(str));
}

/** ::a：只有 C++ 的全域數字、文字變數可以這樣寫；不行時跳出提示 */
function scopedOk(vars: VarStore, name: string): boolean {
  const gv = vars.globalVars;
  if (getTarget() != 'cpp' || !gv || !gv.var_list.name.includes(name)) {
    alert(t(`「::${name}」是全域的 ${name}，可是沒有叫「${name}」的全域變數。`, `"::${name}" means the global ${name}, but there is no global variable called "${name}".`));
    return false;
  }
  if (!gv.type_var_list.number.includes(name) && !gv.type_var_list.text.includes(name)) {
    alert(t(`「::${name}」目前只能用在全域的數字、文字變數。`, `"::${name}" works only for global number and text variables for now.`));
    return false;
  }
  return true;
}

/** 寫成說明用：struct 有哪些欄位，例如 from、to、w */
const fieldList = (sname: string) => (findStruct(sname)?.fields ?? []).map(f => f.name).join(t('、', ', '));

/** 算式裡每個「.欄位」前面都要是 struct，而且有這個欄位；不行時跳出提示 */
function fieldsOk(vars: VarStore, e: Expr): boolean {
  const map = varInfoMap(vars);
  const visit = (x: Expr): boolean => {
    switch (x.t) {
      case 'field': {
        if (!visit(x.obj)) return false;
        const sname = structOf(x.obj, map);
        if (!sname) {
          alert(t(`「.${x.name}」前面要是 struct 變數，或裝 struct 的 array / vector 的一格（例如 edges[i].${x.name}）。`, `Put a struct variable, or one item of an array / vector of structs, before ".${x.name}" (like edges[i].${x.name}).`));
          return false;
        }
        if (!fieldOf(x, map)) {
          alert(t(`struct ${sname} 沒有「${x.name}」這個欄位，它的欄位有：${fieldList(sname)}。`, `The struct ${sname} has no field "${x.name}". Its fields are: ${fieldList(sname)}.`));
          return false;
        }
        return true;
      }
      case 'idx': return visit(x.obj) && visit(x.index);
      case 'method': return visit(x.obj);
      case 'call': case 'fcall': return x.args.every(visit);
      case 'bin': return visit(x.a) && visit(x.b);
      case 'not': case 'neg': return visit(x.a);
      default: return true;
    }
  };
  return visit(e);
}

/** 存值到 struct 的欄位：前面要是 struct 變數或「裝 struct 的容器[索引]」，而且有這個欄位 */
function fieldTargetOk(vars: VarStore, base: string, field: string): boolean {
  // 二維 vector 的一格：g[u][k].w
  const cell = splitTarget(base);
  if (cell?.indexes.length == 2 && vars.type_var_list.grid.includes(cell.name)) {
    const sname = structNameOf(vars, cell.name);
    if (!sname) {
      alert(t(`「${cell.name}」裡面裝的不是 struct，不能用「.${field}」。`, `"${cell.name}" does not hold structs, so you cannot use ".${field}".`));
      return false;
    }
    if (!findStruct(sname)!.fields.some(f => f.name == field)) {
      alert(t(`struct ${sname} 沒有「${field}」這個欄位，它的欄位有：${fieldList(sname)}。`, `The struct ${sname} has no field "${field}". Its fields are: ${fieldList(sname)}.`));
      return false;
    }
    return checkVar(vars, cell.indexes[0], true) && checkVar(vars, cell.indexes[1], true);
  }
  const item = listItemTarget(base);
  const owner = item ? item.list : base.trim();
  const sname = structNameOf(vars, owner);
  const isRecord = vars.type_var_list.record.includes(owner);
  const isContainer = item != null && vars.type_var_list.array.includes(owner);
  if (!sname || !(isRecord || isContainer)) {
    alert(t(`「${base.trim()}.${field}」：「.${field}」前面要是 struct 變數，或裝 struct 的 array / vector 的一格（例如 edges[i].${field}）。`, `"${base.trim()}.${field}": put a struct variable, or one item of an array / vector of structs, before ".${field}".`));
    return false;
  }
  if (!findStruct(sname)!.fields.some(f => f.name == field)) {
    alert(t(`struct ${sname} 沒有「${field}」這個欄位，它的欄位有：${fieldList(sname)}。`, `The struct ${sname} has no field "${field}". Its fields are: ${fieldList(sname)}.`));
    return false;
  }
  return !item || checkVar(vars, item.index, true);
}

/** 容器可以用的函式，寫成說明用的一串，例如 s.top()、s.size()、s.empty() */
const methodList = (name: string, kind: keyof typeof METHODS) => METHODS[kind].map(m => `${name}.${m}(${METHOD_ARGS[m] ? '…' : ''})`).join(t('、', ', '));

/** 算式裡 tokens[k] 是 ( ：到配對的 ) 中間有幾個引數 */
function countArgs(tokens: Token[], k: number): number {
  let depth = 0;
  let n = 0;
  for (let j = k; j < tokens.length; j++) {
    const s = tokens[j].text;
    if (s == '(' || s == '[') depth++;
    else if (s == ')' || s == ']') {
      if (--depth == 0) return j == k + 1 ? 0 : n + 1;
    }
    else if (s == ',' && depth == 1) n++;
  }
  return n + 1;
}

/** 算式裡 tokens[k] 是一個點：前面要是容器，後面要是它有的函式再接 ( )；不行時跳出提示 */
function methodOk(vars: VarStore, tokens: Token[], k: number): boolean {
  const method = tokens[k + 1];
  // 二維 vector 的某一列：g[u].size()、g[u].empty()
  if (tokens[k - 1]?.text == ']') {
    let depth = 0;
    let j = k - 1;
    for (; j >= 0; j--) {
      if (tokens[j].text == ']') depth++;
      else if (tokens[j].text == '[' && --depth == 0) break;
    }
    const owner = tokens[j - 1];
    const oneIndex = tokens[j - 2]?.text != ']';
    if (owner?.type == 'name' && vars.type_var_list.grid.includes(owner.text) && oneIndex && (method?.text == 'size' || method?.text == 'empty') && tokens[k + 3]?.text == ')') return true;
    alert(t('「].」後面只能接二維 vector 某一列的 size() 或 empty()，例如 g[u].size()。', 'After "].", you can only use size() or empty() of one row of a 2D vector, like g[u].size().'));
    return false;
  }
  const obj = tokens[k - 1];
  const kind = obj?.type != 'name' ? null : vars.type_var_list.text.includes(obj.text) ? 'string' : containerKind(vars, obj.text);
  if (!obj || obj.type != 'name' || !kind || kind == 'grid') {
    alert(t(`「.」前面要是 vector、stack、queue 或 string，例如 s.top()、name.length()。`, `Put a vector, stack, queue or string before ".", like s.top() or name.length().`));
    return false;
  }
  if (kind == 'array') {
    alert(t(`「${obj.text}」是 array（陣列）：大小是固定的 ${vars.sizes?.[obj.text] ?? ''}，沒有 .${method?.text ?? ''}() 這種函式。要用第幾格請寫 ${obj.text}[索引]。`, `"${obj.text}" is an array. Its size is fixed (${vars.sizes?.[obj.text] ?? ''}), so it has no .${method?.text ?? ''}(). Use ${obj.text}[index] to get one item.`));
    return false;
  }
  const allowed: readonly string[] = METHODS[kind];
  const kindName = kind == 'vector' ? 'vector' : kind;
  if (method?.type != 'name' || !allowed.includes(method.text)) {
    alert(t(`「${obj.text}」是 ${kindName}，可以用：${methodList(obj.text, kind)}。`, `"${obj.text}" is a ${kindName}. You can use: ${methodList(obj.text, kind)}.`));
    return false;
  }
  if (tokens[k + 2]?.text != '(') {
    alert(t(`${obj.text}.${method.text} 後面要加上 ( )，寫成 ${obj.text}.${method.text}()。`, `Add ( ) after ${obj.text}.${method.text}: write ${obj.text}.${method.text}().`));
    return false;
  }
  const [min, max] = METHOD_ARGS[method.text] ?? [0, 0];
  const n = countArgs(tokens, k + 2);
  if (n < min || n > max) {
    alert(method.text == 'substr'
      ? t(`${obj.text}.substr( ) 的括號裡要寫「從哪個索引開始, 取幾個字」，例如 ${obj.text}.substr(0, 3)。`, `Write ${obj.text}.substr(start, count), like ${obj.text}.substr(0, 3).`)
      : t(`${obj.text}.${method.text}() 的括號裡不用填東西。`, `${obj.text}.${method.text}() takes nothing in ( ).`));
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
    // 型別要對：數字參數不能放文字（例如 "haha 6767"）、清單、判斷式；文字參數不能放清單（數字可以，會變成文字）
    const p = m.params[k];
    let type: ExprType;
    try {
      type = exprType(parseExpr(args[k]), varInfoMap(vars), modules);
    }
    catch {
      continue;
    }
    const what = { str: t('文字', 'text'), char: t('文字', 'text'), list: t('清單', 'a list'), bool: t('判斷式（是或否）', 'a true/false condition'), num: t('數字', 'a number'), struct: t('一整筆 struct 資料', 'a whole struct') }[type];
    if ((p.type == '數字' && type != 'num') || (p.type == '文字' && (type == 'list' || type == 'struct'))) {
      alert(t(`參數「${p.name}」是${p.type}，但填的「${args[k].trim()}」是${what}：請改成${p.type}。`, `"${p.name}" is ${p.type == '數字' ? 'a number' : 'text'}, but "${args[k].trim()}" is ${what}. Change it.`));
      return false;
    }
  }
  return true;
}

/**
 * 計算積木要存進去的值，型別要對（按「確認」時檢查）：
 * - 數字變數（C++ 的 int、float）不能存文字、清單、判斷式；文字變數不能存清單、判斷式（數字可以，會變成文字）
 * - C++ 的清單有型別：vector<int>、vector<float> 只能放數字；vector<string> 只能放文字
 *   （Scratch、Blockly 的清單什麼都能放）
 * where 是「變數」或「清單（含二維清單的一格）」
 */
export function checkValueType(vars: VarStore, modules: ModuleInfo[], target: string, value: string, where: 'var' | 'item'): boolean {
  let type: ExprType;
  try {
    type = exprType(parseExpr(value), varInfoMap(vars), modules);
  }
  catch {
    return true;
  }
  const cpp = getTarget() == 'cpp';
  const floats = vars.floats ?? [];
  const what = { str: t('文字', 'text'), char: t('文字', 'text'), list: t('清單', 'a list'), bool: t('判斷式（是或否）', 'a true/false condition'), num: t('數字', 'a number'), struct: t('一整筆 struct 資料', 'a whole struct') }[type];
  const v = value.trim();
  // 存到 ::a：照全域 a 的型別
  const scoped = where == 'var' ? scopedName(target) : null;
  if (scoped != null && vars.globalVars) {
    const g = vars.globalVars;
    if (g.type_var_list.number.includes(scoped) && type != 'num') {
      alert(t(`全域變數「${scoped}」是數字，但「${v}」是${what}，不能存進去。`, `The global "${scoped}" holds a number, but "${v}" is ${what}. It cannot go in.`));
      return false;
    }
    if (g.type_var_list.text.includes(scoped) && (type == 'list' || type == 'bool' || type == 'struct')) {
      alert(t(`全域變數「${scoped}」是文字，但「${v}」是${what}，不能存進去。`, `The global "${scoped}" holds text, but "${v}" is ${what}. It cannot go in.`));
      return false;
    }
    return true;
  }
  // 存到 struct 的欄位：照欄位的型別
  const field = where == 'var' ? splitField(target) : null;
  if (field) {
    const f = fieldOf(parseExpr(target) as Expr & { t: 'field' }, varInfoMap(vars));
    if (f?.type == '數字' && type != 'num') {
      alert(t(`欄位「${target}」是 ${fieldCppType(f)}，但「${v}」是${what}，不能存進去。`, `"${target}" is ${fieldCppType(f)}, but "${v}" is ${what}. It cannot go in.`));
      return false;
    }
    if (f?.type == '文字' && (type == 'list' || type == 'bool' || type == 'struct')) {
      alert(t(`欄位「${target}」是 string，但「${v}」是${what}，不能存進去。`, `"${target}" is a string, but "${v}" is ${what}. It cannot go in.`));
      return false;
    }
    return true;
  }
  if (where == 'var') {
    if (vars.type_var_list.number.includes(target) && type != 'num') {
      const kind = cpp ? (floats.includes(target) ? ' float（小數）' : ' int（整數）') : t('數字', 'a number');
      alert(t(`變數「${target}」是${kind}，但「${v}」是${what}，不能存進去。`, `"${target}" holds ${kind}, but "${v}" is ${what}. It cannot go in.`));
      return false;
    }
    if (vars.type_var_list.text.includes(target) && (type == 'list' || type == 'bool' || type == 'struct')) {
      alert(t(`變數「${target}」是${cpp ? ' string（文字）' : '文字'}，但「${v}」是${what}，不能存進去。`, `"${target}" holds text, but "${v}" is ${what}. It cannot go in.`));
      return false;
    }
    return true;
  }
  if (!cpp) return true;
  const holds = vars.var_list.value[vars.var_list.name.indexOf(target)];
  // 二維 vector 的某一列 g[u]：看 g 裡裝什麼
  const row = listItemTarget(target);
  if (row && vars.type_var_list.grid.includes(row.list)) return checkValueType(vars, modules, row.list, value, where);
  // 裝 struct 的容器：要放同一種 struct 的一整筆資料（例如 edges.push_back(e)）
  if (findStruct(holds)) {
    let sname: string | null = null;
    try {
      sname = structOf(parseExpr(value), varInfoMap(vars));
    }
    catch {
      sname = null;
    }
    if (sname != holds) {
      alert(t(`「${target}」裡面裝的是 struct ${holds}，要放一個 ${holds} 變數（例如先把欄位一個一個填好，再整個放進去），但「${v}」是${sname ? ` struct ${sname}` : what}。要改其中一個欄位，請選「替換」再選欄位。`, `"${target}" holds struct ${holds}. Put a ${holds} variable in it, but "${v}" is ${sname ? `struct ${sname}` : what}. To change one field, choose "Replace" and then the field.`));
      return false;
    }
    return true;
  }
  const elem = elemCppType(holds);
  const ok = elem == 'string' ? type == 'str' || type == 'char' : type == 'num';
  if (!ok) {
    const fix = elem == 'string' && type == 'num'
      ? t(`要放文字請加上引號，例如 "${v}"。`, `For text, add quotes, like "${v}".`)
      : t(`請改放${elem == 'string' ? '文字' : '數字'}，或到第三步把清單改成裝 ${type == 'num' ? 'int / float' : 'string'}。`, `Put ${elem == 'string' ? 'text' : 'a number'} instead, or change what the list holds (step 3).`);
    const kind = cppContainerName(vars, target);
    alert(t(`「${target}」是 ${kind}，只能放${elem == 'string' ? '文字' : '數字'}，但「${v}」是${what}。${fix}`, `"${target}" is ${kind}, so it holds ${elem == 'string' ? 'text' : 'numbers'} only, but "${v}" is ${what}. ${fix}`));
    return false;
  }
  return true;
}

/** 變數清單 → 名稱對到型別（判斷算式是數字還是文字用） */
function varInfoMap(vars: VarStore): Map<string, VarInfo> {
  const map = new Map<string, VarInfo>();
  const add = (list: string[], type: VarInfo['type']) => list.forEach(name => map.set(name, { name, type, init: vars.var_list.value[vars.var_list.name.indexOf(name)] ?? '' }));
  add(vars.type_var_list.number, '數字');
  add(vars.type_var_list.text, '文字');
  add(vars.type_var_list.array, '清單');
  add(vars.type_var_list.grid, '二維清單');
  add(vars.type_var_list.fixed, '陣列');
  add(vars.type_var_list.stack, '堆疊');
  add(vars.type_var_list.queue, '佇列');
  add(vars.type_var_list.record, '結構');
  // ::a：全域的 a（照全域變數那一份的型別）
  if (vars.globalVars) for (const [name, info] of varInfoMap(vars.globalVars)) map.set('::' + name, { ...info, name: '::' + name });
  return map;
}

/** 「::a」→ a；不是這種寫法回傳 null */
export const scopedName = (s: string) => (/^\s*::\s*[^\s:]+\s*$/.test(s) ? s.trim().slice(2).trim() : null);

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
  textToNumList: t('「{v}」是文字，不能放進清單「{name}」：它是 vector<{elem}>，只能放數字。', '"{v}" is text. It cannot go into "{name}", a vector<{elem}> that holds numbers only.'),
  numToTextList: t('{v} 是數字，不能放進清單「{name}」：它是 vector<string>，只能放文字。', '{v} is a number. It cannot go into "{name}", a vector<string> that holds text only.'),
  intDivZero: t('整數除以 0：C++ 的整數不能除以 0，請檢查除數。', 'Whole-number division by 0. In C++ an int cannot be divided by 0. Check the number you divide by.'),
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
  tooManyLoops: t('迴圈一共跑了超過 100 萬次，可能停不下來：檢查條件迴圈的條件會不會成立、次數是不是太大。', 'The loops ran more than 1,000,000 times in all. Maybe a loop never stops. Check the loop condition and the number of times.'),
  gridEmpty: t('二維清單「{name}」還沒有建立大小：先用計算積木「建立 幾 列 幾 行」。', 'The 2D list "{name}" has no size yet. First use a Math block to make it (rows × columns).'),
  gridRow: t('二維清單「{name}」有 {len} 列，列的索引只能是 0 到 {max}，沒有索引 {k}。', 'The 2D list "{name}" has {len} rows. The row index must be 0 to {max}. There is no row {k}.'),
  gridCol: t('二維清單「{name}」每列有 {len} 行，行的索引只能是 0 到 {max}，沒有索引 {k}。', 'The 2D list "{name}" has {len} columns. The column index must be 0 to {max}. There is no column {k}.'),
  gridSize: t('二維清單「{name}」的列數和行數要是 0 以上的整數，現在是 {r} 列 {c} 行。', 'The rows and columns of "{name}" must be whole numbers 0 or more. Now it is {r} × {c}.'),
  notGrid: t('「{name}」不是二維清單，不能用 [列][行]。', '"{name}" is not a 2D list. You cannot use [row][column].'),
  stackEmpty: t('stack「{name}」是空的，不能用 {m}()：裡面要先有東西（push），可以先用 {name}.empty() 檢查是不是空的。', 'The stack "{name}" is empty, so you cannot use {m}(). Push something first, or check with {name}.empty().'),
  queueEmpty: t('queue「{name}」是空的，不能用 {m}()：裡面要先有東西（push），可以先用 {name}.empty() 檢查是不是空的。', 'The queue "{name}" is empty, so you cannot use {m}(). Push something first, or check with {name}.empty().'),
  sortRange: t('排序「{name}」：要排前 {n} 個，可是只有 {len} 個（要是 0 到 {len} 的整數）。', 'Sorting "{name}": you want the first {n}, but there are only {len} (it must be a whole number from 0 to {len}).'),
  substrRange: t('「{name}」只有 {len} 個字，substr 的開始位置只能是 0 到 {len}，現在是 {k}。', '"{name}" has only {len} letters. The start of substr must be 0 to {len}. Now it is {k}.'),
  maxArgs: t('max( )、min( ) 的括號裡要放兩個以上的值（例如 max(a, b)），或一個 vector / array（例如 max(v)）。', 'Put two or more values in max( ) / min( ) (like max(a, b)), or one vector / array (like max(v)).'),
  maxEmpty: t('max( )、min( ) 裡的「{name}」是空的，沒有最大、最小的值。', 'The list in max( ) / min( ) is empty, so there is no largest or smallest value.'),
  maxStruct: t('max( )、min( ) 不能比 struct：請比某個欄位，或自己用迴圈找。', 'max( ) / min( ) cannot compare structs. Compare one field, or use a loop.'),
  stoiBad: t('stoi( ) 要把文字變成整數，可是「{v}」開頭不是數字。', 'stoi( ) turns text into a whole number, but "{v}" does not start with a number.'),
  showStruct: t('struct 不能整筆一起輸出（C++ 的 cout 不會印 struct），請一個欄位一個欄位輸出，例如 e.from。', 'A whole struct cannot be printed (cout cannot print a struct). Print one field at a time, like e.from.'),
  fixedRange: t('array「{name}」有 {len} 格，索引只能是 0 到 {max}，沒有索引 {k}（array 的大小是固定的，不會自己變大）。', 'The array "{name}" has {len} items. The index must be 0 to {max}. There is no index {k}. (An array has a fixed size.)'),
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
function __idiv(a, b, i) {
  if (b == 0) __err('intDivZero', i, {});
  return Math.trunc(a / b);
}
// C++ 的 int 只有 32 位元：超過 2147483647 會溢位變成負的（| 0 就是這樣繞回去）；long long 不會
function __int(v, i, name) { return Math.trunc(__num(v, i, name)) | 0; }
function __long(v, i, name) { return Math.trunc(__num(v, i, name)); }
function __listItem(v, i, name, elem) {
  if (elem == 'string') {
    if (typeof v != 'string') __err('numToTextList', i, { v: v, name: name });
    return v;
  }
  if (typeof v == 'string') __err('textToNumList', i, { v: v, name: name, elem: elem });
  if (!__isNum(v)) __err('nanToNum', i, { name: name });
  return elem == 'int' ? Math.trunc(v) | 0 : elem == 'long long' ? Math.trunc(v) : v;
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
    // C++ 的 array（__FIXED 是 array 的名稱）：大小固定，說明不一樣
    var key = isText ? (list.length ? 'textOutOfRange' : 'emptyText') : __FIXED[name] ? 'fixedRange' : (list.length ? 'outOfRange' : 'emptyList');
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
function __grid(name, i, r, c, fill, sname) {
  if (!(Number.isInteger(r) && r >= 0 && Number.isInteger(c) && c >= 0)) __err('gridSize', i, { name: name, r: r, c: c });
  var g = [];
  for (var k = 0; k < r; k++) { var row = []; for (var j = 0; j < c; j++) row.push(sname ? __new(sname) : fill); g.push(row); }
  return g;
}
// C++ 的 struct：__STRUCTS 是每種 struct 一開始的樣子（數字欄位 0、文字欄位 ""）
function __new(sname) { return JSON.parse(JSON.stringify(__STRUCTS[sname])); }
// 放進容器或存到另一個 struct 變數時複製一份（C++ 的 struct 是整筆複製，改原本的不會影響放進去的）
function __rec(v, i, name, sname) { return JSON.parse(JSON.stringify(v)); }
// C++ 的 stack、queue（都用陣列存：stack 最後一個是頂端；queue 第一個是最前面）
function __method(c, name, i, m, kind, a, b) {
  // string：s.substr(從哪個索引, 幾個字)；開始的位置超過長度時 C++ 會出錯，取的字太多只會取到最後
  if (m == 'substr') {
    if (!(Number.isInteger(a) && a >= 0 && a <= c.length)) __err('substrRange', i, { name: name, len: c.length, k: a });
    return b === undefined ? c.substr(a) : c.substr(a, Math.max(0, b));
  }
  if (m == 'size' || m == 'length') return c.length;
  if (m == 'empty') return c.length == 0;
  if (!c.length) __err(kind == 'stack' ? 'stackEmpty' : 'queueEmpty', i, { name: name, m: m });
  return m == 'front' ? c[0] : c[c.length - 1];
}
// C++ 的 sort：只排前 n 個（沒給就是全部）；desc 由大到小
// keys 是 struct 的排序條件 [[欄位, 由大到小嗎], …]：前面的一樣大，才比下一個；全部一樣大照原本的順序（stable_sort）
function __sort(list, name, i, n, keys, desc) {
  if (n === null) n = list.length;
  if (!(Number.isInteger(n) && n >= 0 && n <= list.length)) __err('sortRange', i, { name: name, n: n, len: list.length });
  var part = list.slice(0, n);
  var cmp = function (x, y, down) { var c = x < y ? -1 : x > y ? 1 : 0; return down ? -c : c; };
  part.sort(function (p, q) {
    if (!keys) return cmp(p, q, desc);
    for (var k = 0; k < keys.length; k++) {
      var c = cmp(p[keys[k][0]], q[keys[k][0]], keys[k][1]);
      if (c != 0) return c;
    }
    return 0;
  });
  for (var k = 0; k < n; k++) list[k] = part[k];
}
// max(a, b, ...)、min(a, b, ...)；只放一個 vector / array 時找裡面最大、最小的（C++ 的 *max_element）
function __maxmin(args, i, big) {
  var list = args.length == 1 ? args[0] : Array.prototype.slice.call(args);
  if (!Array.isArray(list) || (args.length == 1 && list.length && Array.isArray(list[0])) || list.length == 0 && args.length != 1) __err('maxArgs', i, {});
  if (!list.length) __err('maxEmpty', i, { name: '' });
  var best = list[0];
  for (var k = 0; k < list.length; k++) {
    if (list[k] && typeof list[k] == 'object') __err('maxStruct', i, {});
    if (big ? list[k] > best : list[k] < best) best = list[k];
  }
  return best;
}
// stoi：跟 C++ 一樣讀開頭的整數（"12abc" 是 12），開頭不是數字就出錯
function __stoi(v, i) {
  var m = /^\\s*[+-]?\\d+/.exec(String(v));
  if (!m) __err('stoiBad', i, { v: v });
  return parseInt(m[0], 10) | 0;
}
// to_string：整數照原樣；有小數的跟 C++ 一樣寫到小數點後 6 位
function __tostr(v) { return typeof v == 'number' && !Number.isInteger(v) ? v.toFixed(6) : String(v); }
function __pop(c, name, i, kind) {
  if (!c.length) __err(kind == 'stack' ? 'stackEmpty' : 'queueEmpty', i, { name: name, m: 'pop' });
  if (kind == 'stack') c.pop(); else c.shift();
}
// 輸出清單：一項一項用空白隔開；二維清單一列一行
function __show(v) {
  // C++ 的 cout 印 true / false 是 1 / 0（例如 s.empty()）
  if (typeof v == 'boolean' && __BASE == 0) return v ? 1 : 0;
  if (v && typeof v == 'object' && !Array.isArray(v)) __err('showStruct', -1, {});
  if (!Array.isArray(v)) return v;
  if (v.length && v[0] && typeof v[0] == 'object' && !Array.isArray(v[0])) __err('showStruct', -1, {});
  if (v.some(function (row) { return Array.isArray(row) && row.some(function (x) { return x && typeof x == 'object'; }); })) __err('showStruct', -1, {});
  if (v.length && Array.isArray(v[0])) return v.map(function (row) { return row.join(' '); }).join('\\n');
  return v.join(' ');
}
`;

interface CodeResult {
  code: string;
  next: FlowNode | undefined;
  /** 這條路以 break / continue 結束（積木後面不接箭頭） */
  jumps?: boolean;
}

/** 把流程圖逐一走訪，產生對應的 JavaScript 程式碼 */
class CodeGenerator {
  private readonly nodes: (FlowNode | null)[];
  private readonly diagram: Diagram;
  private vars: VarStore;
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
  /** 主程式：「開始」後面先宣告 main 自己的變數（C++，見 buildRun） */
  mainPrelude = '';
  /** 正在哪些 for 迴圈裡面（計數變數的名稱，外層在前） */
  private loopStack: string[] = [];
  /** 在幾層迴圈裡面（break / continue 只能用在迴圈裡） */
  private loopDepth = 0;

  /** 在 for 迴圈裡面：計數變數當成 int 變數（算式、整數除法才認得它） */
  private withLoopVar<T>(name: string, f: () => T): T {
    const saved = this.vars;
    this.vars = {
      ...saved,
      var_list: { name: [...saved.var_list.name, name], value: [...saved.var_list.value, '0'] },
      type_var_list: { ...saved.type_var_list, number: [...saved.type_var_list.number, name] },
    };
    this.loopStack.push(name);
    try {
      return f();
    }
    finally {
      this.loopStack.pop();
      this.vars = saved;
    }
  }

  /** 迴圈裡面不能改 for 的計數變數（由第三段 i++ 來改） */
  private checkLoopVarChange(node: FlowNode, target: string) {
    const name = target.trim();
    if (this.loopStack.includes(name)) {
      this.fail(t(`${label(node)}：「${name}」是 for 迴圈的計數變數，要靠迴圈的第三段（例如 ${name}++）來改，迴圈裡面不能改它。`, `${label(node)}: "${name}" is the counter of a for loop. Change it in the third part of the loop (like ${name}++), not inside the loop.`), node);
    }
  }

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
    // 正在執行的模組（一層一層）的參數和區域變數在 __frames，Update_output 時一起記下來（見 frameGetter）
    this.varStr = '__globals()';
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

  /** C++ 的 array：大小固定，不能加入、插入、刪除 */
  private isFixed(name: string) {
    return this.vars.type_var_list.fixed.includes(name);
  }

  /** C++ 的 stack、queue：只能從一端放入、取出 */
  private containerKind(name: string): 'stack' | 'queue' | null {
    return this.vars.type_var_list.stack.includes(name) ? 'stack' : this.vars.type_var_list.queue.includes(name) ? 'queue' : null;
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

  /** C++ 的 int 變數（或參數）：存進去的值小數會被去掉 */
  private isIntVar(name: string) {
    return getTarget() == 'cpp' && this.vars.type_var_list.number.includes(name) && !(this.vars.floats ?? []).includes(name);
  }

  /** C++ 的 long long：不會溢位 */
  private isLongVar(name: string) {
    return getTarget() == 'cpp' && (this.vars.longs ?? []).includes(name);
  }

  /** 存進數字變數用的檢查：int（會溢位）、long long、float */
  private numConv(name: string) {
    return this.isLongVar(name) ? '__long' : this.isIntVar(name) ? '__int' : '__num';
  }

  /**
   * C++ 的清單、二維清單有型別：裝 int / float 的只能放數字（int 去掉小數），裝 string 的只能放文字。
   * Scratch、Blockly 的清單什麼都能放，照原樣
   */
  private item(list: string, value: string, i: number) {
    if (getTarget() != 'cpp' || !(this.isList(list) || this.isGrid(list) || this.containerKind(list))) return value;
    const holds = this.vars.var_list.value[this.vars.var_list.name.indexOf(list)];
    // 裝 struct：複製一份放進去
    if (findStruct(holds)) return `__rec(${value}, ${i}, ${JSON.stringify(list)}, ${JSON.stringify(holds)})`;
    const elem = elemCppType(holds);
    return `__listItem(${value}, ${i}, ${JSON.stringify(list)}, ${JSON.stringify(elem)})`;
  }

  /** 輸入到清單：C++ 裝 string 的清單讀成文字（"5" 也是文字），其他照 Scratch（看起來是數字就當數字） */
  private listReader(list: string) {
    return getTarget() == 'cpp' && this.vars.var_list.value[this.vars.var_list.name.indexOf(list)] == '文字' ? '__inText' : '__inList';
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
  /** C++：運算式是不是整數（int）——整數 / 整數 要照 C++ 去掉小數 */
  private isIntExpr(e: Expr): boolean {
    const { array, grid, stack, queue } = this.vars.type_var_list;
    const holdsInt = (name: string) => (array.includes(name) || grid.includes(name) || stack.includes(name) || queue.includes(name)) && ['數字', '長整數'].includes(this.vars.var_list.value[this.vars.var_list.name.indexOf(name)]);
    switch (e.t) {
      case 'num': return !e.v.includes('.');
      case 'method': return e.name == 'size' || e.name == 'length' || (e.name != 'empty' && e.name != 'substr' && e.obj.t == 'var' && holdsInt(e.obj.name));
      case 'field': {
        const f = fieldOf(e, varInfoMap(this.vars));
        return f?.type == '數字' && !f.float;
      }
      case 'var': {
        // ::a：照全域 a 的型別
        const scoped = scopedName(e.name);
        if (scoped != null) {
          const g = this.vars.globalVars;
          return !!g && g.type_var_list.number.includes(scoped) && !(g.floats ?? []).includes(scoped);
        }
        return this.isIntVar(e.name);
      }
      case 'idx':
        if (e.obj.t == 'var') return array.includes(e.obj.name) && holdsInt(e.obj.name);
        return e.obj.t == 'idx' && e.obj.obj.t == 'var' && grid.includes(e.obj.obj.name) && holdsInt(e.obj.obj.name);
      case 'call':
        // max(v)：容器裝整數就是整數；max(a, b)：每個都是整數才是
        if (e.fn == 'max' || e.fn == 'min') return e.args.length == 1 ? e.args[0].t == 'var' && holdsInt(e.args[0].name) : e.args.every(a => this.isIntExpr(a));
        return e.fn == 'len' || e.fn == 'find' || e.fn == 'stoi';
      case 'fcall': {
        const m = this.modules.find(x => x.name == e.name);
        return m?.returns == '數字' && !m.returnsFloat;
      }
      case 'neg': return this.isIntExpr(e.a);
      case 'bin': return ['+', '-', '*', '/', '%'].includes(e.op) && this.isIntExpr(e.a) && this.isIntExpr(e.b);
      default: return false;
    }
  }

  /**
   * C++：哪些「整數 / 整數」要改成 __idiv(a, b)（去掉小數，跟 C++ 一樣）。
   * 回傳每個 token 前面要加幾個「__idiv(」、哪些 / 換成逗號、後面要加幾個「)」
   */
  private intDivisions(text: string) {
    const open = new Map<number, number>();
    const close = new Map<number, number>();
    const ops = new Set<number>();
    if (getTarget() != 'cpp') return { open, close, ops };
    const visit = (e: Expr) => {
      switch (e.t) {
        case 'bin':
          visit(e.a);
          visit(e.b);
          if (e.op == '/' && e.span && this.isIntExpr(e.a) && this.isIntExpr(e.b)) {
            const [from, at, to] = e.span;
            open.set(from, (open.get(from) ?? 0) + 1);
            ops.add(at);
            close.set(to - 1, (close.get(to - 1) ?? 0) + 1);
          }
          break;
        case 'idx': visit(e.obj); visit(e.index); break;
        case 'method': visit(e.obj); e.args.forEach(visit); break;
        case 'field': visit(e.obj); break;
        case 'call': case 'fcall': e.args.forEach(visit); break;
        case 'neg': case 'not': visit(e.a); break;
      }
    };
    visit(parseExpr(text));
    return { open, close, ops };
  }

  private expr(text: string, i: number, condition = false): string {
    text = rowMethods(text);
    const tokens = tokenize(text);
    const div = this.intDivisions(text);
    // 每個 [ 是哪一種：清單的一項、二維清單的第一個／第二個 [ 、一般的中括號
    const stack: ('item' | 'cell1' | 'cell2' | 'raw')[] = [];
    let secondBracket = false;
    let out = '';
    let prevWord = false;
    for (let k = 0; k < tokens.length; k++) {
      const t = tokens[k];
      let word = t.type != 'op';
      let piece = t.text;
      /** s.top()、s.substr(1, 2) 這種寫法：「名稱 . 函式 (」變成 __method(名稱, …, 後面的引數和 ) 照原樣 */
      let skip = 0;
      const method = tokens[k + 2];
      // ::a → 全域的 a（main 裡同名的 a 蓋住了它，要透過 __GL 拿）
      if (t.text == ':' && tokens[k + 1]?.text == ':' && tokens[k + 2]?.type == 'name') {
        piece = `__GL[${JSON.stringify(tokens[k + 2].text)}]`;
        word = true;
        skip = 2;
      }
      else
      if (t.type == 'name' && this.isVar(t.text) && tokens[k + 1]?.text == '.' && method?.type == 'name' && tokens[k + 3]?.text == '(') {
        const ty = this.vars.type_var_list;
        const kind = ty.stack.includes(t.text) ? 'stack' : ty.queue.includes(t.text) ? 'queue' : ty.text.includes(t.text) ? 'string' : 'vector';
        piece = `__method(${t.text}, ${JSON.stringify(t.text)}, ${i}, ${JSON.stringify(method.text)}, ${JSON.stringify(kind)}${tokens[k + 4]?.text == ')' ? '' : ', '}`;
        skip = 3;
      }
      else if (t.type == 'name' && this.isVar(t.text) && tokens[k + 1]?.text == '[') {
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
      // C++ 的整數除法：a / b → __idiv(a, b, 積木編號)
      if (div.ops.has(k)) piece = ', ';
      // 用掉的 token 上如果有整數除法的結尾，也要補上
      let closes = 0;
      for (let j = k; j <= k + skip; j++) closes += div.close.get(j) ?? 0;
      piece = '__idiv('.repeat(div.open.get(k) ?? 0) + piece + `, ${i})`.repeat(closes);
      out += (word && prevWord ? ' ' : '') + piece;
      prevWord = word && closes == 0;
      k += skip;
    }
    // 長度( )、項目編號( )、包含( ) 要把積木編號傳進去，錯誤時才能標出積木
    out = out.replace(/__(len|find|has|stoi|tostr|max|min)\(/g, `__$1_${i}(`);
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
    // ::a：全域的 a
    const scoped = scopedName(target);
    if (scoped != null) {
      const g = this.vars.globalVars;
      const conv = g?.type_var_list.text.includes(scoped) ? '__text'
        : (g?.longs ?? []).includes(scoped) ? '__long' : (g?.floats ?? []).includes(scoped) ? '__num' : '__int';
      return `__GL[${JSON.stringify(scoped)}] = ${conv}(${value}, ${i}, ${JSON.stringify(target.trim())});\n`;
    }
    // struct 的欄位：e.from、edges[i].w（照欄位的型別檢查）
    const field = splitField(target);
    if (field) return `${this.expr(field.base, i)}.${field.field} = ${this.fieldValue(target, value, i)};\n`;
    // 二維清單的一格：表[a][b]
    const cell = splitTarget(target);
    if (cell && cell.indexes.length == 2 && this.isVar(cell.name)) {
      return `__set2(${cell.name}, ${JSON.stringify(cell.name)}, ${i}, (${this.expr(cell.indexes[0], i)}), (${this.expr(cell.indexes[1], i)}), ${this.item(cell.name, value, i)});\n`;
    }
    const item = listItemTarget(target);
    // 文字、數字變數接 [ ] 也交給 __set，執行時會說明為什麼不行
    if (item && this.isVar(item.list)) {
      return `__set(${item.list}, ${JSON.stringify(item.list)}, ${i}, (${this.expr(item.index, i)}), ${this.item(item.list, value, i)});\n`;
    }
    const { number, text } = this.vars.type_var_list;
    const name = JSON.stringify(target);
    if (number.includes(target)) return `${target} = ${this.numConv(target)}(${value}, ${i}, ${name});\n`;
    if (text.includes(target)) return `${target} = __text(${value}, ${i}, ${name});\n`;
    if (this.isList(target)) return `${target} = __list(${value}, ${i}, ${name});\n`;
    if (this.vars.type_var_list.record.includes(target)) return `${target} = __rec(${value}, ${i}, ${name});\n`;
    return `${target} = ${value};\n`;
  }

  /** 要存進 struct 欄位的值：int 去掉小數、float 要是數字、string 變成文字 */
  private fieldValue(target: string, value: string, i: number) {
    const f = fieldOf(parseExpr(target) as Expr & { t: 'field' }, varInfoMap(this.vars));
    const name = JSON.stringify(target.trim());
    if (f?.type == '文字') return `__text(${value}, ${i}, ${name})`;
    return `${getTarget() == 'cpp' && f && !f.float ? '__int' : '__num'}(${value}, ${i}, ${name})`;
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
              + this.params.map(p => `${p.name} = ${p.type == '文字' ? '__text' : this.numConv(p.name)}(${p.name}, ${i}, ${JSON.stringify(p.name)});\n`).join('')
              // 區域變數：每次執行模組都重新從初始值開始（遞迴時每一層有自己的一份）
              + this.locals.map(v => `var ${v.name.trim()} = ${initialValue(this.vars, v.name.trim(), v.init)};\n`).join('')
              + 'var __ret;\n';
            // Scratch：模組裡的「主流程的a」透過 __G 讀寫主流程的 a（參數 a 把它蓋住了，直接寫 a 拿不到）
            const open = this.globalRefs ? 'with (__G) {\n' : '';
            // 這一層的參數和區域變數：第四步每個模組分開列出來（遞迴時每一層各一份）
            const own = [...this.params.map(p => p.name), ...this.locals.map(v => v.name.trim())];
            const loopVars = forLoopVars(this.nodes);
            const frame = `__frames.push({ sheet: ${this.sheet}, get: function () { var o = {${own.map(n => JSON.stringify(n) + ': ' + n).join(', ')}}; ${loopVars.map(n => `if (typeof ${n} != 'undefined') o[${JSON.stringify(n)}] = ${n};`).join(' ')} return o; } });\n`;
            return { code: head + frame + open + `if (++__depth > 500) __err('tooDeep', ${i}, {});\ntotal_step ++;\n` + update, next: this.nextOf(node) };
          }
          // 有回傳值的模組：走到結束時一定要已經「回傳」過
          const check = m.returns ? `if (__ret === undefined) __err('noReturn', ${i}, { name: ${name} });\n` : '';
          return { code: 'total_step ++;\n' + update + check + '__depth--;\n__frames.pop();\nreturn __ret;\n' + (this.globalRefs ? '}\n' : '') + '}\n', next: undefined };
        }
        if (node.text == '開始') {
          return { code: 'function flowchart_code(){\n' + this.mainPrelude + update, next: this.nextOf(node) };
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
          this.checkLoopVarChange(node, v);
          const name = JSON.stringify(v);
          const item = listItemTarget(v);
          const insert = /^(.*?) 插入第 (.*) 項$/s.exec(v);
          const cell = splitTarget(v);
          const field = splitField(v);
          const scoped = scopedName(v);
          // 輸入 ::a：全域的 a
          if (scoped != null) {
            const g = this.vars.globalVars;
            const conv = (g?.longs ?? []).includes(scoped) ? '__long' : (g?.floats ?? []).includes(scoped) ? '__num' : '__int';
            code = g?.type_var_list.text.includes(scoped)
              ? `__GL[${JSON.stringify(scoped)}] = __inText(input_list, ${i}, ${name});\n`
              : `__GL[${JSON.stringify(scoped)}] = ${conv}(__inNum(input_list, ${i}, ${name}), ${i}, ${name});\n`;
          }
          // 輸入 e.from、輸入 edges[i].w：照欄位的型別讀
          else if (field) {
            const f = fieldOf(parseExpr(v) as Expr & { t: 'field' }, varInfoMap(this.vars));
            const read = f?.type == '文字' ? '__inText' : `${getTarget() == 'cpp' && f && !f.float ? 'Math.trunc' : ''}(__inNum`;
            code = `${expr(field.base)}.${field.field} = ${read}(input_list, ${i}, ${name})${f?.type == '文字' ? '' : ')'};\n`;
          }
          // 輸入 表[a][b]：二維清單的一格
          else if (cell && cell.indexes.length == 2 && this.isVar(cell.name)) {
            const g = JSON.stringify(cell.name);
            const read = this.gridHoldsText(cell.name) ? '__inText' : '__inNum';
            code = `__set2(${cell.name}, ${g}, ${i}, (${expr(cell.indexes[0])}), (${expr(cell.indexes[1])}), ${this.item(cell.name, `${read}(input_list, ${i}, ${g})`, i)});\n`;
          }
          // 輸入 成績 插入第 k 項：跟計算積木的「插入」一樣，k 可以是 1 到 長度+1
          else if (insert) {
            const list = insert[1].trim();
            const listName = JSON.stringify(list);
            code = `__insert(${list}, ${listName}, ${i}, (${expr(insert[2])}), ${this.item(list, `${this.listReader(list)}(input_list, ${i}, ${listName})`, i)});\n`;
          }
          // 輸入 成績[k]：替換第 k 項，跟計算積木一樣從第 1 項開始，超出範圍會提示
          else if (item && this.isVar(item.list)) {
            const list = JSON.stringify(item.list);
            code = `__set(${item.list}, ${list}, ${i}, (${expr(item.index)}), ${this.item(item.list, `${this.listReader(item.list)}(input_list, ${i}, ${list})`, i)});\n`;
          }
          else if (this.isFixed(v)) {
            this.fail(t(`${label(node)}：「${v}」是 array，大小是固定的，不能把值加到最後面。請雙擊積木，選要存到第幾格（索引）。`, `${label(node)}: "${v}" is an array with a fixed size. You cannot add to the end. Double-click the block and choose an index.`), node);
          }
          // stack、queue：輸入的值 push 進去
          else if (this.isList(v) || this.containerKind(v)) code = `${v}.push(${this.item(v, `${this.listReader(v)}(input_list, ${i}, ${name})`, i)});\n`;
          else if (this.vars.type_var_list.text.includes(v)) code = `${v} = __inText(input_list, ${i}, ${name});\n`;
          // C++ 的 int：讀到小數時小數去掉
          else code = `${v} = ${this.isIntVar(v) ? `${this.numConv(v)}(` : '('}__inNum(input_list, ${i}, ${name})${this.isIntVar(v) ? `, ${i}, ${name}` : ''});\n`;
        }
        else {
          const what = parts.slice(1).join(' ').trim();
          // 輸出整個 stack：跟 C++ 一樣從頂端（最後放進去的）開始一個一個拿出來
          const shown = this.containerKind(what) == 'stack' ? `${what}.slice().reverse()` : expr(what);
          code = 'output_result += (__show(' + shown + ') + "\\n");\n';
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
        const next = ie.next ?? (ie.jumps ? el.next : undefined);
        return { code: code + 'total_step ++;\n', next, jumps: !next && ie.jumps && el.jumps };
      }
      case 'For_Loop': {
        // C++ 的 for (int i = 0; i < n; i++)
        const header = splitFor(node.text);
        if (header) return this.forLoop(node, header, i, update);
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
        // break：跳出最近的迴圈；continue：直接進入下一輪（後面不接箭頭）
        if (action == '跳出' || action == '下一輪') {
          if (this.loopDepth == 0) {
            this.fail(t(`${label(node)} 只能用在迴圈裡面：用判斷接到它，例如「找到了 → 真 → break」。`, `${label(node)} can only be used inside a loop. Connect it from a decision, like "found → Yes → break".`), node);
          }
          return { code: 'total_step ++;\n' + update + (action == '跳出' ? 'break;\n' : 'continue;\n'), next: undefined, jumps: true };
        }
        this.checkLoopVarChange(node, splitTarget(target)?.name ?? target);
        const value = (node.data || '') + '(' + expr(rest.split('(取')[0]) + ')';
        if (action == '回傳') {
          // 回傳：只能在有回傳值的模組裡，而且後面直接接「結束」（回傳完就離開模組）
          const m = this.modules[this.sheet - 1];
          if (!m?.returns) this.fail(t(`${label(node)}：只有「有回傳值」的模組裡才能用「回傳」。`, `${label(node)}: "Return" can only be used in a module that returns a value.`), node);
          const next = this.nextOf(node);
          if (next && !(next.figure == 'Circle' && next.text == '結束')) {
            this.fail(t(`${label(node)} 後面要直接接「結束」：回傳之後就離開模組，後面的積木不會做。`, `${label(node)} must go straight to "End". After returning, the module stops.`), node);
          }
          const code = `__ret = ${m.returns == '文字' ? '__text' : getTarget() == 'cpp' && m.returnsLong ? '__long' : getTarget() == 'cpp' && !m.returnsFloat ? '__int' : '__num'}(${value}, ${i}, ${JSON.stringify(t('回傳值', 'return value'))});\n`;
          this.checkSyntax(node, code);
          return { code: code + 'total_step ++;' + update, next };
        }
        const name = JSON.stringify(target);
        const kind = this.containerKind(target);
        // array 大小固定；stack、queue 只能 push、pop（積木是用對話框選的，這裡擋舊作品或型別改過的情況）
        if (this.isFixed(target) && ['加入', '插入', '刪除', '清空'].includes(action)) {
          this.fail(t(`${label(node)}：「${target}」是 array，大小是固定的，不能加入、插入或刪除，只能替換某一格。`, `${label(node)}: "${target}" is an array with a fixed size. You cannot add, insert or delete. You can only change one item.`), node);
        }
        if (kind && action != '放入' && action != '取出') {
          this.fail(t(`${label(node)}：「${target}」是 ${kind}，只能用 push（放入）和 pop（取出）。請雙擊積木重新選。`, `${label(node)}: "${target}" is a ${kind}. You can only push and pop. Double-click the block to choose again.`), node);
        }
        if (!kind && (action == '放入' || action == '取出')) {
          this.fail(t(`${label(node)}：「${target}」不是 stack 或 queue，不能 push、pop。請雙擊積木重新選。`, `${label(node)}: "${target}" is not a stack or queue, so it cannot push or pop. Double-click the block to choose again.`), node);
        }
        // 二維 vector 的某一列：g[u] 加入 v（鄰接串列）
        const row = action == '加入' ? listItemTarget(target) : null;
        if (row && this.isGrid(row.list)) {
          const code = `__push(${expr(target)}, ${name}, ${i}, ${this.item(row.list, value, i)});\n`;
          this.checkSyntax(node, code);
          return { code: code + 'total_step ++;' + update, next: this.nextOf(node) };
        }
        const code = action == '排序' ? `__sort(${target}, ${name}, ${i}, ${index ? `(${expr(index)})` : 'null'}, ${index2 ? JSON.stringify(parseSortKeys(index2).map(k => [k.field, k.desc])) : 'null'}, ${rest == '由大到小'});\n`
          : action == '放入' ? `__push(${target}, ${name}, ${i}, ${this.item(target, value, i)});\n`
          : action == '取出' ? `__pop(${target}, ${name}, ${i}, ${JSON.stringify(kind)});\n`
          : action == '加入' ? `__push(${target}, ${name}, ${i}, ${this.item(target, value, i)});\n`
          : action == '插入' ? `__insert(${target}, ${name}, ${i}, (${expr(index)}), ${this.item(target, value, i)});\n`
          : action == '刪除' ? `__remove(${target}, ${name}, ${i}, (${expr(index)}));\n`
          : action == '清空' ? `__clear(${target}, ${name}, ${i});\n`
          // 二維清單設定大小：每一格放 0（裝文字的放空的文字）
          : action == '建立' ? `${target} = __grid(${name}, ${i}, (${expr(index)}), (${expr(index2)}), ${this.gridHoldsText(target) ? '""' : '0'}, ${JSON.stringify(structNameOf(this.vars, target) ?? null)});\n`
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

  /** C++ 的 for 迴圈：計數變數只在迴圈裡面有（離開後拿掉，第四步就不會再列出來） */
  private forLoop(node: FlowNode, header: { init: string; cond: string; update: string }, i: number, update: string): CodeResult {
    const init = forInit(header.init);
    if (!init) {
      this.fail(t(`${label(node)} 的第一段要寫成「int i = 0」這樣（int、變數名稱、= 起始值）。`, `The first part of ${label(node)} must look like "int i = 0".`), node);
    }
    const name = init.name;
    if (this.isVar(name)) {
      this.fail(t(`${label(node)}：迴圈的計數變數「${name}」跟變數表（或參數、區域變數）的「${name}」同名。for 的計數變數不用在變數表宣告，請換一個名字，或刪掉變數表裡的「${name}」。`, `${label(node)}: the loop counter "${name}" has the same name as a variable in the table (or a parameter). A for counter needs no declaration. Rename it, or delete "${name}" from the table.`), node);
    }
    if (this.loopStack.includes(name)) {
      this.fail(t(`${label(node)} 在另一個也用「${name}」的 for 迴圈裡面：裡面的迴圈請換一個名字，例如 j。`, `${label(node)} is inside another for loop that uses "${name}". Use another name for the inner loop, like j.`), node);
    }
    const nextValue = forUpdate(header.update, name);
    if (nextValue == null) {
      this.fail(t(`${label(node)} 的第三段要改「${name}」，例如 ${name}++、${name}--、${name} = ${name} + 1、${name} += 2。`, `The third part of ${label(node)} must change "${name}", like ${name}++, ${name}--, ${name} = ${name} + 1 or ${name} += 2.`), node);
    }
    const nm = JSON.stringify(name);
    const start = this.expr(init.start, i);
    return this.withLoopVar(name, () => {
      const cond = this.expr(header.cond, i, true);
      const step = this.expr(nextValue, i);
      const head = `for (var ${name} = __int((${start}), ${i}, ${nm}); ${cond}; ${name} = __int((${step}), ${i}, ${nm})) {\n`;
      this.checkSyntax(node, head + '}');
      const l = this.loop(node, '進入迴圈', '離開迴圈');
      const code = head + 'total_step ++;' + update + `if(--__loopTrap < 0) __err('tooManyLoops', ${i}, {});\n` + l.code + '\n}\n'
        // 離開迴圈：計數變數就沒有了（跟 C++ 一樣）
        + `${name} = undefined;\n` + 'total_step ++;' + update;
      return { code, next: l.next };
    });
  }

  /** 迴圈：先走「進入迴圈/假」那條直到繞回自己，出口是「離開迴圈/真」那條 */
  private loop(node: FlowNode, enter: string, exit: string): CodeResult {
    this.loopDepth++;
    try {
      return this.loopBody(node, enter, exit);
    }
    finally {
      this.loopDepth--;
    }
  }

  private loopBody(node: FlowNode, enter: string, exit: string): CodeResult {
    const isEnter = (t: string) => t.includes('進入迴圈') || t.includes('假');
    const isExit = (t: string) => t.includes('離開迴圈') || t.includes('真');
    let next = this.nextOf(node, isEnter);
    if (!next) this.fail(t(`迴圈${label(node)} 少了「${enter}」的箭頭（迴圈裡要做的事）。`, `The loop ${label(node)} needs a "${arrowName(enter)}" arrow (what to repeat).`), node);
    let code = '';
    while (next != node) {
      guard(this.counter);
      const r = this.toCode(next);
      code += r.code;
      // break / continue：這條路到這裡結束
      if (!r.next && r.jumps) break;
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
      if (r.jumps) return { code, next: undefined, jumps: true };
      if (!r.next && next.text != '結束') this.noNext(next);
      next = r.next;
      num = this.linksInto(next);
    }
    return { code, next, jumps: false };
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
      + `function __has_${i}(l, v) { return __has(l, v, ${i}); }\n`
      + `function __stoi_${i}(v) { return __stoi(v, ${i}); }\n`
      + `function __tostr_${i}(v) { return __tostr(v); }\n`
      + `function __max_${i}() { return __maxmin(arguments, ${i}, true); }\n`
      + `function __min_${i}() { return __maxmin(arguments, ${i}, false); }\n`).join('')
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
  /** 步驟太多：中間略過幾步沒有記下來（只記前 MAX_STEPS 步和最後一步） */
  skipped?: number;
}

/** 所有迴圈加起來最多跑幾次（超過就當成停不下來） */
const MAX_LOOPS = 1_000_000;
/** 第四步最多記幾步（太多瀏覽器會卡住）；之後的只記最後一步 */
export const MAX_STEPS = 3000;

/** 變數的初始值：清單一開始是空的；文字變數沒加引號時自動加上；數字變數要是數字 */
function initialValue(vars: VarStore, name: string, raw: string | undefined): string {
  // struct 變數：每個欄位是 0（string 是空的），跟 Edge e = {}; 一樣
  if (vars.type_var_list.record.includes(name)) {
    const s = findStruct(raw);
    if (!s) throw new FlowError(t(`變數「${name}」的 struct「${raw ?? ''}」不存在：請到第三步重新選型別。`, `The struct "${raw ?? ''}" of "${name}" does not exist. Choose the type again in step 3.`));
    // 每個欄位的初始值：數字要是數字（int 不能有小數），文字沒加引號時自動加上
    const init = vars.structInits?.[name] ?? {};
    const parts = s.fields.flatMap(f => {
      const v = (init[f.name] ?? '').trim();
      if (!v) return [];
      if (f.type == '文字') return [`${JSON.stringify(f.name)}: ${/^(".*"|'.*')$/.test(v) ? JSON.stringify(v.slice(1, -1)) : JSON.stringify(v)}`];
      if (!isNumeric(v)) throw new FlowError(t(`變數「${name}」的欄位 ${f.name} 是數字，但初始值「${v}」不是數字：請到第三步的變數表修改。`, `The field ${f.name} of "${name}" is a number, but its start value "${v}" is not. Change it in the variable table (step 3).`));
      if (getTarget() == 'cpp' && !f.float && !Number.isInteger(Number(v))) {
        throw new FlowError(t(`變數「${name}」的欄位 ${f.name} 是 int（整數），但初始值「${v}」有小數：請到第三步的變數表改成整數。`, `The field ${f.name} of "${name}" is an int, but its start value "${v}" has a decimal part. Change it in step 3.`));
      }
      return [`${JSON.stringify(f.name)}: ${Number(v)}`];
    });
    return parts.length ? `Object.assign(__new(${JSON.stringify(raw)}), {${parts.join(', ')}})` : `__new(${JSON.stringify(raw)})`;
  }
  // C++ 的 array：一開始就有固定的格數，每格是 0（裝 string 的是空的文字），跟 int a[5] = {}; 一樣
  if (vars.type_var_list.fixed.includes(name)) {
    const size = (vars.sizes?.[name] ?? '').trim();
    if (!/^\d+$/.test(size) || Number(size) < 1 || Number(size) > 1000) {
      throw new FlowError(t(`array「${name}」的大小要是 1 到 1000 的整數，現在是「${size}」：請到第三步的變數表修改。`, `The size of the array "${name}" must be a whole number from 1 to 1000. Now it is "${size}". Change it in the variable table (step 3).`));
    }
    if (findStruct(raw)) return `Array.from({ length: ${Number(size)} }, function () { return __new(${JSON.stringify(raw)}); })`;
    return `Array(${Number(size)}).fill(${raw == '文字' ? '""' : '0'})`;
  }
  if (vars.type_var_list.array.includes(name) || vars.type_var_list.grid.includes(name) || vars.type_var_list.stack.includes(name) || vars.type_var_list.queue.includes(name)) return '[]';
  const value = (raw ?? '').trim();
  if (vars.type_var_list.text.includes(name)) {
    return /^(".*"|'.*')$/.test(value) ? value : JSON.stringify(value);
  }
  if (value == '') return '0';
  if (!isNumeric(value)) throw new FlowError(t(`變數「${name}」是數字，但初始值「${value}」不是數字：請到第三步的變數表修改。`, `"${name}" is a number variable, but its start value "${value}" is not a number. Change it in the variable table (step 3).`));
  if (getTarget() == 'cpp' && !(vars.floats ?? []).includes(name) && !Number.isInteger(Number(value))) {
    throw new FlowError(t(`變數「${name}」是 int（整數），但初始值「${value}」有小數：請到第三步的變數表改成整數，或把型別改成 float（小數）。`, `"${name}" is an int, but its start value "${value}" has a decimal part. Change it to a whole number, or make the type float (step 3).`));
  }
  return value;
}

/** 用某一組測資執行流程圖，記錄每一步；沒辦法執行時丟出 FlowError（附上給學生看的說明） */
export function buildRun(diagram: Diagram, vars: VarStore, inputText: string, modules: ModuleSource[] = []): RunResult {
  // 測資的輸入用空白、換行或逗號分開，每一項先當文字，存進變數時再依型別轉換
  const input_list = inputText.split(/[\n\s,]+/g).filter(s => s != '');

  // 變數表裡沒填名稱的列不算
  const names = vars.var_list.name.filter(n => n.trim() != '');
  // C++：全域變數一份、main 的一份（可以同名：不同的作用域）
  const cpp = getTarget() == 'cpp';
  const gv = cpp ? vars.globalVars ?? createVarStore() : null;
  const globalNames = gv ? gv.var_list.name.filter(n => n.trim() != '') : [];
  const shadowed = new Set(vars.shadowed ?? []);
  /** main 自己的變數（C++ 宣告在 main 裡面）；不是 C++ 時全部都放在最外層 */
  const mainNames = cpp ? names.filter(n => !globalNames.includes(n) || shadowed.has(n)) : names;
  // 同一個作用域裡有兩個變數同名（舊作品，或匯入的作品）：流程圖上分不出是哪一個
  const twice = [names, globalNames].map(list => list.find((n, k) => list.indexOf(n) != k)).find(Boolean);
  if (twice) throw new FlowError(t(`變數表裡有兩個變數都叫「${twice}」：流程圖上分不出是哪一個，請到第三步把其中一個改名。`, `Two variables are both called "${twice}". You cannot tell them apart in the flowchart. Rename one of them in step 3.`));
  // C++：名稱只能用英文（舊作品、從別的語言換過來的還留著中文名稱時，在這裡說明）
  const cppNames: [string, string][] = [
    ...[...names, ...globalNames.filter(n => !names.includes(n))].map(n => [t('變數', 'Variable'), n] as [string, string]),
    ...modules.flatMap(m => [
      [t('模組', 'Module'), m.info.name] as [string, string],
      ...m.info.params.map(p => [t(`模組「${m.info.name}」的參數`, `Parameter of "${m.info.name}"`), p.name] as [string, string]),
      ...(m.info.locals ?? []).filter(v => v.name.trim()).map(v => [t(`模組「${m.info.name}」的區域變數`, `Local variable of "${m.info.name}"`), v.name.trim()] as [string, string]),
    ]),
  ];
  for (const [what, n] of cppNames) {
    const why = cppNameProblem(n);
    if (why) throw new FlowError(`${what}：${why}${t('請到第三步改名字（流程圖裡用到的地方會跟著改）。', ' Rename it in step 3 (the flowchart changes with it).')}`);
  }
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
    // C++：主流程的變數寫在 main 裡面，模組用不到（要用值就用參數傳進來，要帶回去就用回傳）；全域變數可以
    if (getTarget() == 'cpp') {
      const own = new Set([...m.info.params.map(p => p.name), ...locals, ...(vars.globals ?? [])]);
      const sheet = modules.indexOf(m) + 1;
      m.diagram.nodes.forEach((node, k) => {
        const tokens = node ? tokenize(node.text) : [];
        const used = tokens.find((tk, j) => tk.type == 'name' && names.includes(tk.text) && !own.has(tk.text) && tokens[j - 1]?.text != '.');
        if (used) {
          throw new FlowError(t(
            `模組「${m.info.name}」裡用了主流程的變數「${used.text}」：C++ 的主流程變數寫在 main 裡面，模組用不到。要用它的值，請加一個參數傳進來；要把結果帶回主流程，請用回傳。或是到第三步把「${used.text}」勾成「全域」，每個模組就都用得到。`,
            `The module "${m.info.name}" uses "${used.text}" from the main flow. In C++ those variables are inside main, so a module cannot use them. Pass the value in as a parameter, and use a return value to bring a result back. Or mark "${used.text}" as Global in step 3 so every module can use it.`,
          ), sheetId(sheet, k));
        }
      });
    }
  }
  // 測資的輸入放在外面，主程式和模組都讀同一份；__depth 是模組執行自己的層數
  let code = `var total_step = 0;\nvar output_result = "";\nvar step_list = {step: [], var: [], output: [], stack: []};\nvar __loopTrap = ${MAX_LOOPS};\nvar __depth = 0;\nvar __stack = [];\nvar __frames = [];\n`;
  code += 'var input_list = ' + JSON.stringify(input_list) + ';\n';
  const fixedNames = [...vars.type_var_list.fixed, ...(gv?.type_var_list.fixed ?? []), ...modules.flatMap(m => (m.info.locals ?? []).filter(v => v.type == '陣列').map(v => v.name.trim()))];
  code += 'var __FIXED = ' + JSON.stringify(Object.fromEntries(fixedNames.map(n => [n, true]))) + ';\n';
  for (const s of getStructs()) {
    if (!s.fields.length) throw new FlowError(t(`struct ${s.name} 還沒有欄位：請到第三步替它加上欄位，或把它刪掉。`, `The struct ${s.name} has no fields yet. Add fields in step 3, or delete it.`));
  }
  code += 'var __STRUCTS = ' + JSON.stringify(Object.fromEntries(getStructs().map(s => [s.name, Object.fromEntries(s.fields.map(f => [f.name, fieldInit(f)]))]))) + ';\n';
  code += runtime();
  const declare = (store: VarStore, name: string) => {
    const decl = 'var ' + name + ' = ' + initialValue(store, name, store.var_list.value[store.var_list.name.indexOf(name)]) + ';\n';
    if (!syntaxOk(decl)) throw new FlowError(t(`變數名稱「${name}」不能用：名稱裡不能有空白或符號，也不能用數字開頭。`, `"${name}" cannot be a variable name. Do not use spaces or symbols, and do not start with a number.`));
    return decl;
  };
  /** 寫在最外層的變數（模組看得到）：C++ 是全域變數；其他語言是全部的變數 */
  const topNames = cpp ? globalNames : names;
  for (const name of topNames) code += declare(gv ?? vars, name);
  // C++ 的 main 自己的變數：宣告在 flowchart_code 裡面（模組看不到；跟全域變數同名時蓋住全域的）
  const mainPrelude = cpp
    ? mainNames.map(n => declare(vars, n)).join('') + 'var __mainNow = function(){ var o = {' + mainNames.map(n => JSON.stringify(n) + ': ' + n).join(',') + '}; '
      + forLoopVars(diagram.nodes).map(n => `if (typeof ${n} != 'undefined') o[${JSON.stringify(n)}] = ${n};`).join(' ') + ' return o; };\n__mainSnap = __mainNow;\n'
    : '';
  // 「主流程的a」：模組裡讀寫主流程的 a（Scratch；見 withParams）
  if (!cpp) {
    code += 'var __G = {' + names.map(n => {
      const key = JSON.stringify(GLOBAL_PREFIX + n);
      return `get ${key}() { return ${n}; }, set ${key}(v) { ${n} = v; }`;
    }).join(', ') + '};\n';
  }
  // 第四步要看的變數：最外層的（被 main 同名變數蓋住的全域變數叫「x（全域）」）＋ main 自己的
  if (cpp) code += 'var __GL = {' + globalNames.map(n => `get ${JSON.stringify(n)}() { return ${n}; }, set ${JSON.stringify(n)}(v) { ${n} = v; }`).join(', ') + '};\n';
  code += 'var __mainSnap = null;\n';
  code += 'function __globals(){ var o = {' + topNames.map(n => JSON.stringify(shadowed.has(n) ? shadowLabel(n) : n) + ': ' + n).join(',') + '}; if (__mainSnap) { var m = __mainSnap(); for (var k in m) o[k] = m[k]; } return o; }\n';
  // 每一步都記下來給第四步看；步驟太多時（大的測資、排序）只記前 MAX_STEPS 步，之後只記住最後一步，執行完再補上，瀏覽器才不會卡住
  code += 'function __record(a,b){\nstep_list.output.push(output_result);\nstep_list.step.push(a);\nif (b && typeof b == "object" && __frames.length) b.__frames = __frames.slice(-20).map(function (f, k, all) { return { sheet: f.sheet, depth: __frames.length - all.length + k + 1, vals: f.get() }; });\nstep_list.var.push(typeof b=="object" ? JSON.parse(JSON.stringify(b)) : b);\nstep_list.stack.push(__stack.slice());\n}\n';
  code += `var __skipped = 0;\nvar __last = null;\nfunction Update_output(a,b){\nif (step_list.step.length < ${MAX_STEPS}) { __record(a, b); return; }\n__skipped++;\n__last = [a, b];\n}\n`;
  const infos = modules.map(m => m.info);
  const mainGen = new CodeGenerator(diagram, vars, 0, infos);
  mainGen.mainPrelude = mainPrelude;
  code += mainGen.program();
  // 模組：每個模組一個函式（__mod1、__mod2…）
  modules.forEach((m, k) => {
    code += new CodeGenerator(m.diagram, vars, k + 1, infos, m.info.params, m.info.locals).program();
  });
  // 執行到一半出錯時，保留出錯前的每一步，學生才看得到變數是怎麼變的
  code += 'var __error = null;\ntry { flowchart_code(); } catch (e) { __error = e; }\n';
  // 略過的步驟裡最後一步（執行結束或出錯的那一步）補上
  code += 'if (__last) { __skipped--; __record(__last[0], __last[1]); }\n';
  code += 'return {totalStep: total_step, step: step_list.step, var: step_list.var, output: step_list.output, stack: step_list.stack, skipped: __skipped, error: __error};\n';

  console.log('code = \n', code);
  const diagrams = [diagram, ...modules.map(m => m.diagram)];
  let result: Omit<RunResult, 'error'> & { error: unknown };
  try {
    result = Function('__FlowError', code)(FlowError);
  }
  catch (e) {
    throw explainError(e, diagrams);
  }
  // 有略過步驟時，第四步的最後一步就是記下來的最後一筆
  if (result.skipped) result.totalStep = result.step.length - 1;
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
