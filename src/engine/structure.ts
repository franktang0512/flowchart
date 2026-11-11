// 「看程式」用：把流程圖整理成結構（一般步驟、判斷、迴圈），運算式整理成語法樹，
// 再交給 toCpp / toBlockly 寫成 C++ 或積木。走訪流程圖的規則跟 decoder 的 CodeGenerator 一樣
// （判斷的兩條路走到匯合點、迴圈走到繞回自己），只是產生的是結構而不是 JavaScript。
import { t } from '../i18n';
import type { Diagram } from './diagram';
import { FlowError, tokenize, type Token } from './decoder';
import { splitRectangle, splitTarget, type RectAction } from './labels';
import { parseCall, type ModuleInfo, type ModuleSource } from './modules';
import type { FlowNode } from './node';

// ---------------- 流程圖的結構 ----------------

export type Stmt =
  /** 輸入：存到變數、添加到清單最後、插入到某個位置、替換某個位置（二維清單的一格：index2 是行） */
  | { kind: 'input'; target: string; place: 'var' | 'append' | 'insert' | 'replace'; index?: Expr; index2?: Expr }
  | { kind: 'output'; value: Expr }
  /**
   * 計算積木（見 RectAction）；round 是 Math.round / Math.floor / Math.ceil 或空的。
   * 二維清單：「建立」的 index、index2 是列數、行數；「替換」一格時 index2 是行
   */
  | { kind: 'rect'; action: RectAction; target: string; index?: Expr; index2?: Expr; value?: Expr; round: string }
  | { kind: 'if'; cond: Expr; yes: Stmt[]; no: Stmt[] }
  /** 次數迴圈 */
  | { kind: 'repeat'; times: Expr; body: Stmt[] }
  /** 條件迴圈：重複直到條件成立 */
  | { kind: 'until'; cond: Expr; body: Stmt[] }
  /** 執行模組（見 modules.ts） */
  | { kind: 'call'; name: string; args: Expr[] };

/** 一個模組：名稱、參數、裡面的步驟 */
export interface ModuleProgram extends ModuleInfo {
  body: Stmt[];
}

/** 每個模組的流程圖 → 結構；接得不完整時丟出 FlowError（訊息前面寫是哪個模組） */
export function structureModules(modules: ModuleSource[]): ModuleProgram[] {
  return modules.map(m => {
    try {
      return { ...m.info, body: structure(m.diagram) };
    }
    catch (e) {
      if (e instanceof FlowError) throw new FlowError(t(`模組「${m.info.name}」裡：`, `In the module "${m.info.name}": `) + e.message);
      throw e;
    }
  });
}

const ROUND_OF: Record<string, string> = { '(取四捨五入)': 'Math.round', '(取無條件捨去)': 'Math.floor', '(取無條件進位)': 'Math.ceil' };

/** 把流程圖整理成結構；流程圖接得不完整時丟出 FlowError */
export function structure(diagram: Diagram): Stmt[] {
  const nodes = diagram.nodes;
  const idx = (n: FlowNode) => nodes.indexOf(n);
  const nextOf = (n: FlowNode, pred: (text: string) => boolean = () => true) => {
    const link = diagram.links.find(l => l && l.from == idx(n) && pred(l.text));
    return link ? nodes[link.to] ?? undefined : undefined;
  };
  const linksInto = (n: FlowNode | undefined) => diagram.links.filter(l => l && n && l.to == idx(n)).length;
  let steps = 0;
  const guard = () => {
    if (++steps > 10000) throw new FlowError(t('流程圖繞成一圈出不來：如果要重複執行，請用「迴圈」積木。', 'The flowchart goes around and never stops. To repeat, use a Loop block.'));
  };
  const broken = (n: FlowNode) => new FlowError(t('流程圖還沒接完整，先到第四步執行看看哪裡要修改。', 'The flowchart is not finished. Run it in step 4 to see what to fix.'), idx(n));

  /** 一個積木 → 結構，以及下一個要走的積木 */
  const step = (n: FlowNode): { stmts: Stmt[]; next: FlowNode | undefined } => {
    switch (n.figure) {
      case 'Circle':
        return { stmts: [], next: n.text == '開始' ? nextOf(n) : undefined };
      case 'Parallelogram':
        return { stmts: [ioStmt(n.text)], next: nextOf(n) };
      case 'Rectangle':
        return { stmts: [rectStmt(n.text)], next: nextOf(n) };
      case 'Function': {
        const call = parseCall(n.text);
        if (!call) throw broken(n);
        return { stmts: [{ kind: 'call', name: call.name, args: call.args.map(parseExpr) }], next: nextOf(n) };
      }
      case 'Diamond': {
        const yes = branch(n, s => s.includes('true') || s.includes('真'));
        const no = branch(n, s => s.includes('false') || s.includes('假'));
        return { stmts: [{ kind: 'if', cond: parseExpr(n.text), yes: yes.stmts, no: no.stmts }], next: yes.next };
      }
      case 'For_Loop':
      case 'While_Loop': {
        const body = loop(n);
        const exit = nextOf(n, s => s.includes('離開迴圈') || s.includes('真'));
        if (!exit) throw broken(n);
        const stmt: Stmt = n.figure == 'For_Loop'
          ? { kind: 'repeat', times: parseExpr(n.text.slice(0, -1)), body }
          : { kind: 'until', cond: parseExpr(n.text), body };
        return { stmts: [stmt], next: exit };
      }
      default:
        return { stmts: [], next: nextOf(n) };
    }
  };

  /** 迴圈裡面：走「進入迴圈/假」那條直到繞回迴圈 */
  const loop = (n: FlowNode): Stmt[] => {
    let next = nextOf(n, s => s.includes('進入迴圈') || s.includes('假'));
    const body: Stmt[] = [];
    while (next != n) {
      guard();
      if (!next) throw broken(n);
      const r = step(next);
      body.push(...r.stmts);
      if (!r.next) throw broken(next);
      next = r.next;
    }
    return body;
  };

  /** 判斷的一條路：走到匯合點（有兩條以上箭頭指進來的積木）為止 */
  const branch = (n: FlowNode, pred: (text: string) => boolean) => {
    let next = nextOf(n, pred);
    if (!next) throw broken(n);
    const stmts: Stmt[] = [];
    let num = linksInto(next);
    while (next && ((next.figure != 'Diamond' && num == 1) || (next.figure == 'Diamond' && num < 2))) {
      guard();
      const r = step(next);
      stmts.push(...r.stmts);
      if (!r.next && next.text != '結束') throw broken(next);
      next = r.next;
      num = linksInto(next);
    }
    return { stmts, next };
  };

  let node = nodes.find(n => n && n.text == '開始') ?? undefined;
  if (!node) throw new FlowError(t('流程圖少了「開始」。', 'The flowchart needs a "Start" block.'));
  const program: Stmt[] = [];
  while (node.text != '結束') {
    guard();
    const r = step(node);
    program.push(...r.stmts);
    if (!r.next) throw broken(node);
    node = r.next;
  }
  return program;
}

/** 輸入/輸出積木的文字 → 結構（格式見 nodeActions 的 ioText） */
function ioStmt(text: string): Stmt {
  const rest = text.substring(3).trim();
  if (!text.startsWith('輸入')) return { kind: 'output', value: parseExpr(rest) };
  const insert = /^(.*?) 插入第 (.*) 項$/s.exec(rest);
  if (insert) return { kind: 'input', target: insert[1].trim(), place: 'insert', index: parseExpr(insert[2]) };
  const item = splitTarget(rest);
  if (item) {
    const [a, b] = item.indexes;
    return { kind: 'input', target: item.name, place: 'replace', index: parseExpr(a), ...(b != null ? { index2: parseExpr(b) } : {}) };
  }
  // 存到變數還是添加到清單，要看變數表；這裡先記成 var，產生程式時再依型別決定
  return { kind: 'input', target: rest, place: 'var' };
}

/** 計算積木的文字 → 結構（格式見 labels 的 splitRectangle） */
function rectStmt(text: string): Stmt {
  let rest = text;
  let round = '';
  for (const [zh, fn] of Object.entries(ROUND_OF)) {
    if (rest.endsWith(zh)) {
      rest = rest.slice(0, -zh.length);
      round = fn;
    }
  }
  const { target, action, index, index2, expr } = splitRectangle(rest);
  return {
    kind: 'rect', action, target, round,
    index: index ? parseExpr(index) : undefined,
    ...(index2 ? { index2: parseExpr(index2) } : {}),
    value: action == '刪除' || action == '清空' || action == '建立' ? undefined : parseExpr(expr),
  };
}

// ---------------- 運算式的語法樹 ----------------

export type Expr =
  | { t: 'num'; v: string }
  /** 字串（已經去掉引號） */
  | { t: 'str'; v: string }
  | { t: 'var'; name: string }
  /** 清單或文字的某一項：obj[index] */
  | { t: 'idx'; obj: Expr; index: Expr }
  /** 長度( )、項目編號( )、包含( ) */
  | { t: 'call'; fn: 'len' | 'find' | 'has'; args: Expr[] }
  /** + - * / % 、比較（== != < <= > >=）、and or */
  | { t: 'bin'; op: string; a: Expr; b: Expr }
  | { t: 'not'; a: Expr }
  | { t: 'neg'; a: Expr }
  /** 看不懂的寫法：原樣保留 */
  | { t: 'raw'; text: string };

const CALLS: Record<string, 'len' | 'find' | 'has'> = {
  長度: 'len', length: 'len', 項目編號: 'find', indexof: 'find', 包含: 'has', contains: 'has',
};

/** 學生寫的運算式 → 語法樹；看不懂就整段當成 raw */
export function parseExpr(text: string): Expr {
  try {
    const p = new Parser(tokenize(text));
    const e = p.or();
    if (!p.done()) throw new Error('extra');
    return e;
  }
  catch {
    return { t: 'raw', text: text.trim() };
  }
}

class Parser {
  private k = 0;
  constructor(private readonly tokens: Token[]) {}

  done() { return this.k >= this.tokens.length; }
  private peek(n = 0) { return this.tokens[this.k + n]; }
  private take() {
    const tk = this.tokens[this.k++];
    if (!tk) throw new Error('end');
    return tk;
  }
  private is(...texts: string[]) {
    const tk = this.peek();
    return tk != null && texts.includes(tk.text);
  }
  private expect(text: string) {
    if (this.take().text != text) throw new Error('expect ' + text);
  }

  or(): Expr {
    let a = this.and();
    while (this.is('or', '或')) { this.take(); a = { t: 'bin', op: 'or', a, b: this.and() }; }
    return a;
  }
  private and(): Expr {
    let a = this.not();
    while (this.is('and', '且')) { this.take(); a = { t: 'bin', op: 'and', a, b: this.not() }; }
    return a;
  }
  private not(): Expr {
    if (this.is('not', '非')) { this.take(); return { t: 'not', a: this.not() }; }
    return this.compare();
  }
  /** 比較：符號是一個一個字元切開的，這裡把 <= >= != == <> 接回來 */
  private compare(): Expr {
    const a = this.add();
    const c = this.peek()?.text;
    if (c == null || !'=<>!'.includes(c)) return a;
    this.take();
    const d = this.peek()?.text;
    let op = c;
    if ((c == '<' || c == '>' || c == '!' || c == '=') && d == '=') { this.take(); op = c + '='; }
    else if (c == '<' && d == '>') { this.take(); op = '!='; }
    if (op == '=' || op == '==') op = '==';
    if (op == '!') throw new Error('bad op');
    return { t: 'bin', op, a, b: this.add() };
  }
  private add(): Expr {
    let a = this.mul();
    while (this.is('+', '-')) { const op = this.take().text; a = { t: 'bin', op, a, b: this.mul() }; }
    return a;
  }
  private mul(): Expr {
    let a = this.unary();
    while (this.is('*', '/', '%')) { const op = this.take().text; a = { t: 'bin', op, a, b: this.unary() }; }
    return a;
  }
  private unary(): Expr {
    if (this.is('-')) { this.take(); return { t: 'neg', a: this.unary() }; }
    if (this.is('+')) { this.take(); return this.unary(); }
    return this.postfix();
  }
  private postfix(): Expr {
    let e = this.primary();
    while (this.is('[')) {
      this.take();
      const index = this.or();
      this.expect(']');
      e = { t: 'idx', obj: e, index };
    }
    return e;
  }
  private primary(): Expr {
    const tk = this.take();
    if (tk.type == 'number') return { t: 'num', v: tk.text };
    if (tk.type == 'string') return { t: 'str', v: tk.text.slice(1, -1) };
    if (tk.text == '(') {
      const e = this.or();
      this.expect(')');
      return e;
    }
    if (tk.type == 'name') {
      const fn = Object.prototype.hasOwnProperty.call(CALLS, tk.text) ? CALLS[tk.text] : undefined;
      if (fn && this.is('(')) {
        this.take();
        const args: Expr[] = [];
        if (!this.is(')')) {
          args.push(this.or());
          while (this.is(',')) { this.take(); args.push(this.or()); }
        }
        this.expect(')');
        return { t: 'call', fn, args };
      }
      return { t: 'var', name: tk.text };
    }
    throw new Error('unexpected ' + tk.text);
  }
}

// ---------------- 變數表 ----------------

export interface VarInfo {
  name: string;
  /** 二維清單只有學習目標是 C++ 時才有 */
  type: '數字' | '文字' | '清單' | '二維清單';
  /** 數字/文字的初始值；清單、二維清單是裡面裝「數字」還是「文字」 */
  init: string;
}

/** 運算式最後是什麼型別（判斷要怎麼寫成 C++ / 積木用） */
export type ExprType = 'num' | 'str' | 'char' | 'bool' | 'list';

export function exprType(e: Expr, vars: Map<string, VarInfo>): ExprType {
  switch (e.t) {
    case 'num': return 'num';
    case 'str': return 'str';
    case 'var': {
      const v = vars.get(e.name);
      return v?.type == '清單' || v?.type == '二維清單' ? 'list' : v?.type == '文字' ? 'str' : 'num';
    }
    case 'idx': {
      const o = exprType(e.obj, vars);
      if (o == 'str') return 'char';
      if (e.obj.t == 'var') {
        const v = vars.get(e.obj.name);
        // 二維清單只取一個 [ ]：是一整列
        if (v?.type == '二維清單') return 'list';
        return v?.init == '文字' ? 'str' : 'num';
      }
      // 二維清單的一格：表[a][b]
      if (e.obj.t == 'idx' && e.obj.obj.t == 'var') return vars.get(e.obj.obj.name)?.init == '文字' ? 'str' : 'num';
      return 'num';
    }
    case 'call': return e.fn == 'has' ? 'bool' : 'num';
    case 'bin':
      if (['==', '!=', '<', '<=', '>', '>=', 'and', 'or'].includes(e.op)) return 'bool';
      if (e.op == '+') {
        const a = exprType(e.a, vars), b = exprType(e.b, vars);
        if (a == 'str' || b == 'str' || (a == 'char' && b == 'char')) return 'str';
      }
      return 'num';
    case 'not': return 'bool';
    case 'neg': return 'num';
    default: return 'num';
  }
}
