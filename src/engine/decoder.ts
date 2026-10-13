// 檢查學生輸入的運算式，並把流程圖轉成 JavaScript 逐步執行
//
// 學生的寫法 → 產生的程式：
//   數字/文字變數        n、name            → 一般的 JavaScript 變數，存值時會檢查型別
//   清單（從第 1 項開始） 成績[i]           → __at(成績, "成績", 積木編號, i)
//                       成績[i] 設為 x     → __set(成績, "成績", 積木編號, i, x)
//                       長度(成績)         → __len(...)
//                       輸入 成績          → 把讀到的值加到清單最後
//   判斷式               = and or not 且 或 非 → == && || !
import { t } from '../i18n';
import type { Diagram } from './diagram';
import { displayLinkText, displayNodeText } from './labels';
import type { FlowNode } from './node';

/** 第三步「變數」表格整理出來的變數清單 */
export interface VarStore {
  var_list: { name: string[]; value: string[] };
  type_var_list: { number: string[]; text: string[]; array: string[] };
}

export const createVarStore = (): VarStore => ({
  var_list: { name: [], value: [] },
  type_var_list: { number: [], text: [], array: [] },
});

const isNumeric = (s: string) => !isNaN(parseFloat(s)) && isFinite(s as unknown as number);

/** 取清單長度的寫法：長度(成績) 或 length(成績) */
const LENGTH_WORDS = ['長度', 'length'];
const LOGIC_WORDS = ['and', 'or', 'not'];

type Token = { type: 'string' | 'number' | 'name' | 'op'; text: string };

/** 把運算式切成一個一個的單位：字串、數字、名稱、符號（且、或、非 當成符號） */
function tokenize(str: string): Token[] {
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
    type_var_list.number.includes(name) || type_var_list.text.includes(name) || type_var_list.array.includes(name);

  if (!can_number) {
    const item = listItemTarget(str);
    if (item) {
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
    if (tk.type != 'name' || defined(tk.text) || LOGIC_WORDS.includes(tk.text) || LENGTH_WORDS.includes(tk.text)) continue;
    alert(t(`「${tk.text}」沒有定義：請先在變數表新增這個變數。如果是文字，要用 "雙引號" 括起來。`, `"${tk.text}" is not a variable yet. Add it to the variable table first. For words, use "quotes".`));
    return false;
  }
  return true;
}

/** 找出文字裡出現了哪些變數 */
export function getCodeVar(vars: VarStore, str: string): string[] {
  return vars.var_list.name.filter(name => str.includes(name));
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
const runtimeMessages = () => ({
  noInput: t('測資的輸入不夠：執行到「輸入 {name}」時，已經沒有資料可以讀了。', 'Not enough test input: nothing is left to read at "Input {name}".'),
  inputNotNum: t('測資裡的「{v}」不是數字，不能存進數字變數「{name}」。如果要存文字，請把「{name}」的型別改成文字。', '"{v}" in the test input is not a number. It cannot go into the number variable "{name}". To keep words, change the type of "{name}" to Text.'),
  listToNum: t('清單不能直接存進數字變數「{name}」。', 'A list cannot go into the number variable "{name}".'),
  textToNum: t('「{v}」是文字，不能存進數字變數「{name}」。', '"{v}" is text. It cannot go into the number variable "{name}".'),
  nanToNum: t('計算結果不是數字，不能存進數字變數「{name}」：檢查運算式裡是不是用到了文字。', 'The answer is not a number, so it cannot go into the number variable "{name}". Check if the math uses text.'),
  listToText: t('清單不能直接存進文字變數「{name}」。', 'A list cannot go into the text variable "{name}".'),
  wholeList: t('「{name}」是清單，要改其中一項請寫 {name}[第幾項]。', '"{name}" is a list. To change one item, write {name}[item number].'),
  notList: t('「{name}」不是清單，不能用 [第幾項]。', '"{name}" is not a list. You cannot use [ ].'),
  outOfRange: t('清單「{name}」只有 {len} 項，沒有第 {k} 項（清單從第 1 項開始）。', 'The list "{name}" has only {len} items. There is no item {k}. (Lists start at item 1.)'),
  emptyList: t('清單「{name}」是空的，沒有第 {k} 項。', 'The list "{name}" is empty. There is no item {k}.'),
  lenNotList: t('長度( ) 的括號裡要放清單。', 'Put a list inside length( ).'),
  countNotNum: t('迴圈的次數不是數字。', 'The loop count is not a number.'),
});

// 執行時用到的小工具：存值時檢查型別、清單從第 1 項開始。錯誤會標出是哪個積木（i）
const runtime = () => `
var __M = ${JSON.stringify(runtimeMessages())};
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
  if (!Array.isArray(list)) __err('notList', i, { name: name });
  if (!(Number.isInteger(k) && k >= 1 && k <= list.length)) {
    __err(list.length ? 'outOfRange' : 'emptyList', i, { name: name, len: list.length, k: k });
  }
  return k - 1;
}
function __at(list, name, i, k) { return list[__index(list, name, i, k)]; }
function __set(list, name, i, k, v) { list[__index(list, name, i, k)] = v; }
function __len(v, i) {
  if (!Array.isArray(v)) __err('lenNotList', i, {});
  return v.length;
}
function __count(v, i) {
  if (!__isNum(v)) __err('countNotNum', i, {});
  return v;
}
function __show(v) { return Array.isArray(v) ? v.join(' ') : v; }
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

  constructor(diagram: Diagram, vars: VarStore, names: string[]) {
    this.diagram = diagram;
    this.nodes = diagram.nodes;
    this.vars = vars;
    // 每一步都把所有變數的值記下來：{"a": a,"b": b}
    this.varStr = '{' + names.map(n => '"' + n + '": ' + n).join(',') + '}';
  }

  private idx(node: FlowNode) {
    return this.nodes.indexOf(node);
  }

  private isList(name: string) {
    return this.vars.type_var_list.array.includes(name);
  }

  /** 學生寫的運算式 → JavaScript：清單[第幾項]、長度(清單)、判斷式的 and/or/= */
  private expr(text: string, i: number, condition = false): string {
    const tokens = tokenize(text);
    const stack: boolean[] = [];
    let out = '';
    let prevWord = false;
    tokens.forEach((t, k) => {
      const word = t.type != 'op';
      let piece = t.text;
      if (t.type == 'name' && this.isList(t.text) && tokens[k + 1]?.text == '[') {
        piece = `__at(${t.text}, ${JSON.stringify(t.text)}, ${i}, `;
      }
      else if (t.type == 'name' && LENGTH_WORDS.includes(t.text) && !this.vars.var_list.name.includes(t.text) && tokens[k + 1]?.text == '(') {
        piece = '__len';
      }
      else if (t.text == '[') {
        const isItem = tokens[k - 1]?.type == 'name' && this.isList(tokens[k - 1].text);
        stack.push(isItem);
        piece = isItem ? '(' : '[';
      }
      else if (t.text == ']') {
        piece = stack.pop() ? '))' : ']';
      }
      out += (word && prevWord ? ' ' : '') + piece;
      prevWord = word;
    });
    // 長度(清單) 要把積木編號傳進去，錯誤時才能標出積木
    out = out.replace(/__len\(/g, `__len_${i}(`);
    return condition ? toCondition(out) : out;
  }

  /** 積木內容寫錯（程式看不懂）時，指出是哪一個積木 */
  private checkSyntax(node: FlowNode, code: string) {
    if (!syntaxOk(code)) {
      throw new FlowError(label(node) + t(' 的寫法程式看不懂：請檢查變數名稱有沒有打錯、括號和引號有沒有成對。', ' cannot be read. Check the variable names, and check that ( ) and " " come in pairs.'), this.idx(node));
    }
  }

  /** 不是「結束」卻沒有往下接的箭頭 */
  private noNext(node: FlowNode): never {
    throw new FlowError(label(node) + t(' 後面沒有接箭頭：每個積木都要用箭頭接到下一個積木，最後接到「結束」。', ' has no arrow to the next block. Every block needs an arrow to the next block. The last one goes to "End".'), this.idx(node));
  }

  /** 把 value 存進 target（變數或 清單[第幾項]），依型別檢查 */
  private assign(target: string, value: string, i: number) {
    const item = listItemTarget(target);
    if (item && this.isList(item.list)) {
      return `__set(${item.list}, ${JSON.stringify(item.list)}, ${i}, (${this.expr(item.index, i)}), ${value});\n`;
    }
    const { number, text } = this.vars.type_var_list;
    const name = JSON.stringify(target);
    if (number.includes(target)) return `${target} = __num(${value}, ${i}, ${name});\n`;
    if (text.includes(target)) return `${target} = __text(${value}, ${i}, ${name});\n`;
    if (this.isList(target)) return `${target} = __list(${value}, ${i}, ${name});\n`;
    return `${target} = ${value};\n`;
  }

  /** 長度(清單) 用到的積木編號版本 */
  private lenHelpers = new Set<number>();

  toCode(node: FlowNode): CodeResult {
    const i = this.idx(node);
    const update = 'Update_output(' + i + ', ' + this.varStr + ');\n';
    const expr = (text: string, condition = false) => {
      const js = this.expr(text, i, condition);
      if (js.includes(`__len_${i}(`)) this.lenHelpers.add(i);
      return js;
    };
    switch (node.figure) {
      case 'Circle':
        if (node.text == '開始') {
          return { code: 'function flowchart_code(input_list){\n' + update, next: this.nextOf(node) };
        }
        return { code: 'total_step ++;\n' + update + '}\n', next: undefined };
      case 'Parallelogram': {
        const parts = node.text.split(' ');
        let code: string;
        if (parts[0].includes('輸入')) {
          const v = parts.slice(1).join(' ').trim();
          if (!v) throw new FlowError(label(node) + t(' 沒有寫要存到哪個變數。', ' needs a variable name.'), i);
          const name = JSON.stringify(v);
          if (this.isList(v)) code = `${v}.push(__inList(input_list, ${i}, ${name}));\n`;
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
        code += 'if(--__loopTrap < 0){\n break;\n}\n' + l.code + '\n}\n';
        code += 'total_step ++;' + update;
        return { code, next: l.next };
      }
      case 'While_Loop': {
        const cond = expr(node.text, true);
        this.checkSyntax(node, 'return (' + cond + ');');
        let code = 'while(!(' + cond + ')){\ntotal_step ++;' + update;
        const l = this.loop(node, '假', '真');
        code += 'if(--__loopTrap < 0){\n break;\n}\n' + l.code + '\n}\n';
        code += 'total_step ++;' + update;
        return { code, next: l.next };
      }
      case 'Rectangle': {
        const [target, rest = ''] = node.text.split(' 設為 ');
        const value = (node.data || '') + '(' + expr(rest.split('(取')[0]) + ')';
        const code = this.assign(target.trim(), value, i);
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
    if (!next) throw new FlowError(t(`迴圈${label(node)} 少了「${enter}」的箭頭（迴圈裡要做的事）。`, `The loop ${label(node)} needs a "${arrowName(enter)}" arrow (what to repeat).`), this.idx(node));
    let code = '';
    while (next != node) {
      guard(this.counter);
      const r = this.toCode(next);
      code += r.code;
      if (!r.next) {
        if (next.text == '結束') throw new FlowError(t(`迴圈${label(node)} 裡面的積木要接回迴圈，不能直接接到「結束」。`, `Blocks inside the loop ${label(node)} must go back to the loop, not to "End".`), this.idx(next));
        throw new FlowError(label(next) + t(' 後面沒有接箭頭：迴圈裡最後一個積木要用箭頭接回迴圈。', ' has no arrow. The last block in a loop needs an arrow back to the loop.'), this.idx(next));
      }
      next = r.next;
    }
    const after = this.nextOf(node, isExit);
    if (!after) throw new FlowError(t(`迴圈${label(node)} 少了「${exit}」的箭頭（迴圈結束後要做的事）。`, `The loop ${label(node)} needs a "${arrowName(exit)}" arrow (what to do after the loop).`), this.idx(node));
    return { code, next: after };
  }

  /** 判斷的一個分支：一路走到匯合點（有兩條以上箭頭指進來的積木）為止 */
  private branch(node: FlowNode, pred: (text: string) => boolean, name: string): CodeResult {
    let next = this.nextOf(node, pred);
    if (!next) throw new FlowError(t(`判斷${label(node)} 少了「${name}」的箭頭。`, `The decision ${label(node)} needs a "${arrowName(name)}" arrow.`), this.idx(node));
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
    if (!start) throw new FlowError(t('流程圖少了「開始」。', 'The flowchart needs a "Start" block.'));
    let code = '';
    while (start.text != '結束') {
      guard(this.counter);
      const r = this.toCode(start);
      code += r.code;
      if (!r.next) this.noNext(start);
      start = r.next;
    }
    code += this.toCode(start).code;
    // 每個用到 長度( ) 的積木各一個版本，錯誤時才知道是哪個積木
    const helpers = [...this.lenHelpers].map(i => `function __len_${i}(v) { return __len(v, ${i}); }\n`).join('');
    return helpers + code;
  }
}

export interface RunResult {
  totalStep: number;
  /** 每一步正在執行的積木 index */
  step: number[];
  /** 每一步所有變數的值（清單是陣列） */
  var: Record<string, unknown>[];
  /** 每一步為止的輸出 */
  output: string[];
  /** 執行到一半出錯：前面的步驟照樣保留，最後一步之後就是這個錯誤 */
  error?: FlowError;
}

/** 變數的初始值：清單一開始是空的；文字變數沒加引號時自動加上；數字變數要是數字 */
function initialValue(vars: VarStore, name: string, raw: string | undefined): string {
  if (vars.type_var_list.array.includes(name)) return '[]';
  const value = (raw ?? '').trim();
  if (vars.type_var_list.text.includes(name)) {
    return /^(".*"|'.*')$/.test(value) ? value : JSON.stringify(value);
  }
  if (value == '') return '0';
  if (!isNumeric(value)) throw new FlowError(t(`變數「${name}」是數字，但初始值「${value}」不是數字：請到第三步的變數表修改。`, `"${name}" is a number variable, but its start value "${value}" is not a number. Change it in the variable table (step 3).`));
  return value;
}

/** 用某一組測資執行流程圖，記錄每一步；沒辦法執行時丟出 FlowError（附上給學生看的說明） */
export function buildRun(diagram: Diagram, vars: VarStore, inputText: string): RunResult {
  // 測資的輸入用空白、換行或逗號分開，每一項先當文字，存進變數時再依型別轉換
  const input_list = inputText.split(/[\n\s,]+/g).filter(s => s != '');

  // 變數表裡沒填名稱的列不算
  const names = vars.var_list.name.filter(n => n.trim() != '');
  let code = 'var total_step = 0;\nvar output_result = "";\nvar step_list = {step: [], var: [], output: []};\nvar __loopTrap = 1000;\n';
  code += runtime();
  for (const name of names) {
    const decl = 'var ' + name + ' = ' + initialValue(vars, name, vars.var_list.value[vars.var_list.name.indexOf(name)]) + '\n';
    if (!syntaxOk(decl)) throw new FlowError(t(`變數名稱「${name}」不能用：名稱裡不能有空白或符號，也不能用數字開頭。`, `"${name}" cannot be a variable name. Do not use spaces or symbols, and do not start with a number.`));
    code += decl;
  }
  code += 'function Update_output(a,b){\nstep_list.output.push(output_result);\nstep_list.step.push(a);\nstep_list.var.push(typeof b=="object" ? JSON.parse(JSON.stringify(b)) : b);\n}\n';
  code += new CodeGenerator(diagram, vars, names).program();
  // 執行到一半出錯時，保留出錯前的每一步，學生才看得到變數是怎麼變的
  code += 'var __error = null;\ntry { flowchart_code(' + JSON.stringify(input_list) + '); } catch (e) { __error = e; }\n';
  code += 'return {totalStep: total_step, step: step_list.step, var: step_list.var, output: step_list.output, error: __error};\n';

  console.log('code = \n', code);
  let result: Omit<RunResult, 'error'> & { error: unknown };
  try {
    result = Function('__FlowError', code)(FlowError);
  }
  catch (e) {
    throw explainError(e, diagram);
  }
  if (result.error == null) return { ...result, error: undefined };
  // 連第一步都沒跑到就出錯：當成整個沒辦法執行
  if (result.step.length == 0) throw explainError(result.error, diagram);
  return { ...result, totalStep: result.step.length - 1, error: explainError(result.error, diagram) };
}

/** 執行時的錯誤換成給學生看的說明 */
function explainError(e: unknown, diagram: Diagram): FlowError {
  if (e instanceof FlowError) return e;
  const missing = e instanceof ReferenceError && /^(.+) is not defined$/.exec(e.message);
  if (missing) {
    const name = missing[1];
    const at = diagram.nodes.findIndex(n => n != null && n.text.includes(name));
    return new FlowError(t(`「${name}」沒有定義：請到第三步的變數表新增這個變數，或檢查積木裡是不是打錯字。`, `"${name}" is not a variable. Add it to the variable table (step 3), or check the spelling in your blocks.`), at >= 0 ? at : null);
  }
  if (e instanceof SyntaxError) {
    return new FlowError(t('有積木的寫法程式看不懂：請檢查變數名稱、運算式的括號和引號。', 'A block cannot be read. Check the variable names, ( ) and " ".'));
  }
  return new FlowError(t('執行時發生錯誤：', 'Something went wrong: ') + (e as Error).message);
}
