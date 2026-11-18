// 「看程式」用：把流程圖整理成結構（一般步驟、判斷、迴圈），運算式整理成語法樹，
// 再交給 toCpp / toBlockly 寫成 C++ 或積木。走訪流程圖的規則跟 decoder 的 CodeGenerator 一樣
// （判斷的兩條路走到匯合點、迴圈走到繞回自己），只是產生的是結構而不是 JavaScript。
import { t } from '../i18n';
import type { Diagram } from './diagram';
import { FlowError, tokenize, type Token } from './decoder';
import { eofVar, parseSortKeys, sortKeyExpr, splitOutput, splitRectangle, splitTarget, type RectAction, type SortKey } from './labels';
import { mapParts, parseCall, splitArgs, type ModuleInfo, type ModuleSource } from './modules';
import { findStruct, type StructField } from './structs';
import { getTarget, isPython } from '../target';
import type { FlowNode } from './node';

// ---------------- 流程圖的結構 ----------------

export type Stmt =
  /** 輸入：存到變數、添加到清單最後、插入到某個位置、替換某個位置（二維清單的一格：index2 是行） */
  | { kind: 'input'; target: string; place: 'var' | 'append' | 'insert' | 'replace'; index?: Expr; index2?: Expr }
  /** noNewline：Python 的 print(..., end=" ")（印完不換行，後面加一個空白） */
  | { kind: 'output'; value: Expr; noNewline?: boolean }
  /**
   * 計算積木（見 RectAction）；round 是 Math.round / Math.floor / Math.ceil 或空的。
   * 二維清單：「建立」的 index、index2 是列數、行數；「替換」一格時 index2 是行
   */
  | { kind: 'rect'; action: RectAction; target: string; index?: Expr; index2?: Expr; value?: Expr; round: string }
  | { kind: 'if'; cond: Expr; yes: Stmt[]; no: Stmt[] }
  /** 次數迴圈 */
  | { kind: 'repeat'; times: Expr; body: Stmt[] }
  /**
   * C++ 的 for 迴圈：for (int name = start; cond; update)；next 是每一輪之後 name 的新值（例如 i + 1），
   * update 是學生寫的第三段（轉 C++ 照抄）
   */
  | { kind: 'for'; name: string; start: Expr; cond: Expr; next: Expr; update: string; body: Stmt[] }
  /** Python 的 for i in range(start, stop, step) */
  | { kind: 'range'; name: string; start: Expr; stop: Expr; step: Expr; body: Stmt[] }
  /** Python 的 for x in 清單（或文字、set、dict 的鍵）：一個一個拿出來 */
  | { kind: 'each'; name: string; iter: Expr; body: Stmt[] }
  /** 跳出最近的迴圈、直接進入下一輪 */
  | { kind: 'break' }
  | { kind: 'continue' }
  /** 條件迴圈：重複直到條件成立 */
  | { kind: 'until'; cond: Expr; body: Stmt[] }
  /** 一直輸入到沒有資料：每一輪先讀一筆存進 target，讀不到就離開（C++ 的 while (cin >> a)） */
  | { kind: 'eof'; target: string; body: Stmt[] }
  /** 執行模組（見 modules.ts） */
  | { kind: 'call'; name: string; args: Expr[] }
  /** 模組回傳值（流程圖上後面直接接「結束」） */
  | { kind: 'return'; value: Expr; round: string }
  /** 排序（C++ 的 sort）：count 是只排前幾個（array 常用 sort(a, a + n)）；keys 是 struct 依哪些欄位排（前面一樣大才比後面） */
  /** key：Python 自訂排序的 key（x 是每一項，例如 len(x)） */
  | { kind: 'sort'; target: string; count?: Expr; keys?: SortKey[]; key?: Expr; desc: boolean };

/** C++ 的 for 迴圈積木「for (int i = 0; i < n; i++)」→ 三段；不是這種寫法回傳 null */
export function splitFor(text: string): { init: string; cond: string; update: string } | null {
  const m = /^\s*for\s*\((.*?);(.*?);(.*)\)\s*$/s.exec(text);
  return m ? { init: m[1].trim(), cond: m[2].trim(), update: m[3].trim() } : null;
}

/** 第一段「int i = 0」→ 計數變數的名稱、起始值；不是這種寫法回傳 null */
export function forInit(init: string): { name: string; start: string } | null {
  const m = /^int\s+([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.+)$/s.exec(init.trim());
  return m ? { name: m[1], start: m[2].trim() } : null;
}

/**
 * 第三段：i++、++i、i--、--i、i = 式子、i += 式子（-=、*=、/= 也可以）→ 每一輪之後 i 的新值（例如 i + 1）；
 * 不是改這個計數變數的寫法回傳 null
 */
export function forUpdate(update: string, name: string): string | null {
  const u = update.trim();
  const tight = u.replace(/\s+/g, '');
  if (tight == name + '++' || tight == '++' + name) return `${name} + 1`;
  if (tight == name + '--' || tight == '--' + name) return `${name} - 1`;
  const op = new RegExp(`^${name}\\s*([+\\-*/])=\\s*(.+)$`, 's').exec(u);
  if (op) return `${name} ${op[1]} (${op[2].trim()})`;
  const set = new RegExp(`^${name}\\s*=(?!=)\\s*(.+)$`, 's').exec(u);
  return set ? set[1].trim() : null;
}

/**
 * Python 的 for 迴圈積木：「for i in range(n)」「for i in range(1, n + 1)」「for i in range(n, 0, -1)」「for c in s」。
 * range 的三段拆好（沒寫的起點是 0、間隔是 1）；不是 range 的是走訪清單、文字…（iter）。不是這種寫法回傳 null
 */
export function pyFor(text: string): { name: string; range?: { start: string; stop: string; step: string }; iter?: string } | null {
  const m = /^\s*for\s+([A-Za-z_][A-Za-z0-9_]*)\s+in\s+(.+?)\s*:?\s*$/s.exec(text);
  if (!m) return null;
  const r = /^range\s*\((.*)\)$/s.exec(m[2].trim());
  if (!r) return { name: m[1], iter: m[2].trim() };
  const args = splitArgs(r[1]);
  if (args.length < 1 || args.length > 3 || args.some(a => !a)) return null;
  const [start, stop, step] = args.length == 1 ? ['0', args[0], '1'] : [args[0], args[1], args[2] ?? '1'];
  return { name: m[1], range: { start, stop, step } };
}

/** 流程圖上 for 迴圈用到的計數變數名稱（不用在變數表宣告） */
export function forLoopVars(nodes: (FlowNode | null)[]): string[] {
  const names = nodes.flatMap(n => {
    const py = n?.figure == 'For_Loop' && isPython() ? pyFor(n.text) : null;
    if (py) return [py.name];
    const h = n?.figure == 'For_Loop' ? splitFor(n.text) : null;
    const init = h ? forInit(h.init) : null;
    return init ? [init.name] : [];
  });
  return [...new Set(names)];
}

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

/**
 * 有幾條箭頭指進這個積木（判斷 from 的兩條路走到這裡就是匯合點）。
 * 判斷在迴圈外面時，迴圈從自己裡面繞回來的箭頭不算，不然判斷的一邊放迴圈時，迴圈會被當成匯合點、跑到判斷外面；
 * 判斷在迴圈裡面時，走回迴圈開頭就是這一圈做完了，照樣算。
 */
export function entriesInto(diagram: Diagram, n: FlowNode | undefined, from: FlowNode): number {
  if (!n) return 0;
  const nodes = diagram.nodes;
  const at = nodes.indexOf(n);
  const into = diagram.links.filter(l => l && l.to == at);
  if (n.figure != 'For_Loop' && n.figure != 'While_Loop') return into.length;
  // 迴圈裡面有哪些積木：從「進入迴圈／假」那條走，走到繞回迴圈為止
  const start = diagram.links.find(l => l && l.from == at && (l.text.includes('進入迴圈') || l.text.includes('假')));
  const body = new Set<number>();
  const todo = start ? [start.to] : [];
  while (todo.length) {
    const i = todo.pop()!;
    if (i == at || body.has(i) || !nodes[i] || nodes[i]!.text == '結束') continue;
    body.add(i);
    for (const l of diagram.links) if (l && l.from == i) todo.push(l.to);
  }
  if (body.has(nodes.indexOf(from))) return into.length;
  return into.filter(l => l && !body.has(l.from)).length;
}

/** 把流程圖整理成結構；流程圖接得不完整時丟出 FlowError */
export function structure(diagram: Diagram): Stmt[] {
  const nodes = diagram.nodes;
  const idx = (n: FlowNode) => nodes.indexOf(n);
  const nextOf = (n: FlowNode, pred: (text: string) => boolean = () => true) => {
    const link = diagram.links.find(l => l && l.from == idx(n) && pred(l.text));
    return link ? nodes[link.to] ?? undefined : undefined;
  };
  const linksInto = (n: FlowNode | undefined, from: FlowNode) => entriesInto(diagram, n, from);
  let steps = 0;
  const guard = () => {
    if (++steps > 10000) throw new FlowError(t('流程圖繞成一圈出不來：如果要重複執行，請用「迴圈」積木。', 'The flowchart goes around and never stops. To repeat, use a Loop block.'));
  };
  const broken = (n: FlowNode) => new FlowError(t('流程圖還沒接完整，先到第四步執行看看哪裡要修改。', 'The flowchart is not finished. Run it in step 4 to see what to fix.'), idx(n));

  /** 一個積木 → 結構，以及下一個要走的積木 */
  /** jumps：這條路以 break / continue 結束（後面不接箭頭） */
  const step = (n: FlowNode): { stmts: Stmt[]; next: FlowNode | undefined; jumps?: boolean } => {
    switch (n.figure) {
      case 'Circle':
        return { stmts: [], next: n.text == '開始' ? nextOf(n) : undefined };
      case 'Parallelogram':
        return { stmts: [ioStmt(n.text)], next: nextOf(n) };
      case 'Rectangle': {
        const s = rectStmt(n.text);
        if (s.kind == 'break' || s.kind == 'continue') return { stmts: [s], next: undefined, jumps: true };
        return { stmts: [s], next: nextOf(n) };
      }
      case 'Function': {
        const call = parseCall(n.text);
        if (!call) throw broken(n);
        return { stmts: [{ kind: 'call', name: call.name, args: call.args.map(parseExpr) }], next: nextOf(n) };
      }
      case 'Diamond': {
        const yes = branch(n, s => s.includes('true') || s.includes('真'));
        const no = branch(n, s => s.includes('false') || s.includes('假'));
        // 一邊是 break / continue：接下去的是另一邊
        const next = yes.next ?? (yes.jumps ? no.next : undefined);
        return { stmts: [{ kind: 'if', cond: parseExpr(n.text), yes: yes.stmts, no: no.stmts }], next, jumps: !next && yes.jumps && no.jumps };
      }
      case 'For_Loop':
      case 'While_Loop': {
        const body = loop(n);
        const exit = nextOf(n, s => s.includes('離開迴圈') || s.includes('真'));
        if (!exit) throw broken(n);
        const py = n.figure == 'For_Loop' && isPython() ? pyFor(n.text) : null;
        if (py?.range) return { stmts: [{ kind: 'range', name: py.name, start: parseExpr(py.range.start), stop: parseExpr(py.range.stop), step: parseExpr(py.range.step), body }], next: exit };
        if (py?.iter) return { stmts: [{ kind: 'each', name: py.name, iter: parseExpr(py.iter), body }], next: exit };
        const header = n.figure == 'For_Loop' ? splitFor(n.text) : null;
        const init = header ? forInit(header.init) : null;
        const next = header && init ? forUpdate(header.update, init.name) : null;
        const stmt: Stmt = header && init && next != null
          ? { kind: 'for', name: init.name, start: parseExpr(init.start), cond: parseExpr(header.cond), next: parseExpr(next), update: header.update, body }
          : n.figure == 'For_Loop'
          ? { kind: 'repeat', times: parseExpr(n.text.slice(0, -1)), body }
          : eofVar(n.text) ? { kind: 'eof', target: eofVar(n.text)!, body }
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
      if (!r.next) {
        if (r.jumps) break;
        throw broken(next);
      }
      next = r.next;
    }
    return body;
  };

  /** 判斷的一條路：走到匯合點（有兩條以上箭頭指進來的積木）為止 */
  const branch = (n: FlowNode, pred: (text: string) => boolean) => {
    let next = nextOf(n, pred);
    if (!next) throw broken(n);
    const stmts: Stmt[] = [];
    let num = linksInto(next, n);
    while (next && ((next.figure != 'Diamond' && num == 1) || (next.figure == 'Diamond' && num < 2))) {
      guard();
      const r = step(next);
      stmts.push(...r.stmts);
      if (r.jumps) return { stmts, next: undefined, jumps: true };
      if (!r.next && next.text != '結束') throw broken(next);
      next = r.next;
      num = linksInto(next, n);
    }
    return { stmts, next, jumps: false };
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
  if (!text.startsWith('輸入')) {
    const out = isPython() ? splitOutput(rest) : { what: rest, noNewline: false };
    return { kind: 'output', value: parseExpr(out.what), ...(out.noNewline ? { noNewline: true } : {}) };
  }
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
  if (action == '跳出') return { kind: 'break' };
  if (action == '下一輪') return { kind: 'continue' };
  if (action == '回傳') return { kind: 'return', value: parseExpr(expr), round };
  if (action == '排序') {
    const key = index2 ? sortKeyExpr(index2) : null;
    return { kind: 'sort', target, ...(index ? { count: parseExpr(index) } : {}), ...(index2 && !key ? { keys: parseSortKeys(index2) } : {}), ...(key ? { key: parseExpr(key) } : {}), desc: expr == '由大到小' };
  }
  return {
    kind: 'rect', action, target, round,
    index: index ? parseExpr(index) : undefined,
    ...(index2 ? { index2: parseExpr(index2) } : {}),
    value: action == '刪除' || action == '清空' || action == '建立' || action == '取出' ? undefined : parseExpr(expr),
  };
}

// ---------------- 運算式的語法樹 ----------------

export type Expr =
  | { t: 'num'; v: string }
  /** 字串（已經去掉引號）；ch 是用單引號寫的一個字 'a'（C++ 的 char） */
  | { t: 'str'; v: string; ch?: boolean }
  /** Python 的 True、False */
  | { t: 'bool'; v: boolean }
  /** Python 的 list：[1, -1, 0, 0]、[] */
  | { t: 'list'; items: Expr[] }
  /** Python 的切片：s[a:b]、s[::-1]（沒寫的是 undefined） */
  | { t: 'slice'; obj: Expr; start?: Expr; stop?: Expr; step?: Expr }
  /** Python 連在一起的比較：0 <= x < 10（ops[k] 在 items[k] 和 items[k + 1] 中間） */
  | { t: 'chain'; items: Expr[]; ops: string[] }
  | { t: 'var'; name: string }
  /** 清單或文字的某一項：obj[index] */
  | { t: 'idx'; obj: Expr; index: Expr }
  /** 長度( )、項目編號( )、包含( ) */
  | { t: 'call'; fn: CallFn; args: Expr[] }
  /** C++ 容器的函式：s.top()、q.front()、q.back()、v.size()、v.empty()（見 decoder 的 METHODS） */
  | { t: 'method'; obj: Expr; name: string; args: Expr[] }
  /** struct 的欄位：e.from、edges[i].w */
  | { t: 'field'; obj: Expr; name: string }
  /** 有回傳值的模組：找最大(x, y) */
  | { t: 'fcall'; name: string; args: Expr[] }
  /** + - * / % 、比較（== != < <= > >=）、and or；Python 還有 // ** in notin（not in） */
  /** span（只有 * / %）：[開頭, 運算子, 結尾後面] 是第幾個 token（C++ 的整數除法要包起來，見 decoder） */
  | { t: 'bin'; op: string; a: Expr; b: Expr; span?: [number, number, number] }
  | { t: 'not'; a: Expr }
  | { t: 'neg'; a: Expr }
  /** 大括號 {a, b}：一整筆 pair / struct（例如 q.push({x, y})），欄位照順序 */
  | { t: 'brace'; items: Expr[] }
  /** 看不懂的寫法：原樣保留 */
  | { t: 'raw'; text: string };

/** 函式：長度( )、項目編號( )、包含( )；C++ 還有 stoi( )（文字變整數）、to_string( )（數字變文字） */
export type CallFn = 'len' | 'find' | 'has' | 'stoi' | 'tostr' | 'max' | 'min'
  /** C++ 的字元：char(數字) 變成字、toupper / tolower 換大小寫、isdigit… 判斷是哪一種字 */
  | 'chr' | 'toupper' | 'tolower' | 'isdigit' | 'isalpha' | 'isupper' | 'islower'
  /** Python：float( )、abs( )、sum( )、ord( )、round( )（int( ) 是 stoi、str( ) 是 tostr、chr( ) 是 chr） */
  | 'float' | 'abs' | 'sum' | 'ord' | 'round';
const CALLS: Record<string, CallFn> = {
  長度: 'len', length: 'len', 項目編號: 'find', indexof: 'find', 包含: 'has', contains: 'has', stoi: 'stoi', to_string: 'tostr',
  // C++：max(a, b)、min(a, b) 比大小；max(v)、min(v) 是整個 vector / array 裡最大、最小的
  max: 'max', min: 'min',
  char: 'chr', toupper: 'toupper', tolower: 'tolower', isdigit: 'isdigit', isalpha: 'isalpha', isupper: 'isupper', islower: 'islower',
};

/** Python 的函式名稱 */
export const PY_CALLS: Record<string, CallFn> = {
  len: 'len', int: 'stoi', str: 'tostr', float: 'float', max: 'max', min: 'min', abs: 'abs', sum: 'sum', ord: 'ord', chr: 'chr', round: 'round',
};
/** 函式在 Python 寫成什麼（「看程式」、對話框的說明用） */
export const PY_NAME: Partial<Record<CallFn, string>> = { len: 'len', stoi: 'int', tostr: 'str', float: 'float', max: 'max', min: 'min', abs: 'abs', sum: 'sum', ord: 'ord', chr: 'chr', round: 'round' };

/** 判斷是哪一種字的函式（回傳真／假） */
export const CHAR_TESTS: CallFn[] = ['isdigit', 'isalpha', 'isupper', 'islower'];

/**
 * 運算式的語法樹，加上每個運算元（數字、變數、s[i]、括號…）是第幾個到第幾個 token（[開頭, 結尾後面]）。
 * C++ 的字元要變成數字來算（'a' + 1），執行時要知道把哪一段包起來（見 decoder）
 */
export function parseExprSpans(text: string): { e: Expr; spans: Map<Expr, [number, number]>; marks: Map<Expr, number[]> } {
  try {
    const p = new Parser(tokenize(text));
    const e = p.or();
    if (!p.done()) throw new Error('extra');
    return { e, spans: p.spans, marks: p.marks };
  }
  catch {
    return { e: { t: 'raw', text: text.trim() }, spans: new Map(), marks: new Map() };
  }
}

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
  /** 每個運算元是第幾個到第幾個 token（見 parseExprSpans） */
  readonly spans = new Map<Expr, [number, number]>();
  /**
   * Python：每個運算式重要的 token 是第幾個（執行時要換掉那些 token，見 decoder 的 rewrites）：
   * 運算子（<= 這種是兩個 token，都記下來）、not、函式的 . 名稱 ( )、tuple 的 ( )、切片的 [ : : ]、True / False
   */
  readonly marks = new Map<Expr, number[]>();
  private readonly py = isPython();
  constructor(private readonly tokens: Token[]) {}
  /** 記下這個運算式是第 from 到現在的 token（Python 才需要每一層都記；C++ 只記 unary） */
  private mark<T extends Expr>(from: number, e: T, at?: number[]): T {
    if (this.py && !this.spans.has(e)) this.spans.set(e, [from, this.k]);
    if (at) this.marks.set(e, at);
    return e;
  }

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
    const from = this.k;
    let a = this.and();
    while (this.is('or', '或')) { const at = this.k; this.take(); a = this.mark(from, { t: 'bin', op: 'or', a, b: this.and() }, [at]); }
    return a;
  }
  private and(): Expr {
    const from = this.k;
    let a = this.not();
    while (this.is('and', '且')) { const at = this.k; this.take(); a = this.mark(from, { t: 'bin', op: 'and', a, b: this.not() }, [at]); }
    return a;
  }
  private not(): Expr {
    const from = this.k;
    if (this.is('not', '非')) { this.take(); return this.mark(from, { t: 'not', a: this.not() }, [from]); }
    return this.compare();
  }
  /** 比較的符號（符號是一個一個字元切開的，這裡把 <= >= != == <> 接回來）；Python 還有 in、not in。不是比較回傳 null */
  private compareOp(): { op: string; at: number[] } | null {
    const at = this.k;
    const c = this.peek()?.text;
    if (this.py && this.peek()?.type == 'name') {
      if (c == 'in') { this.take(); return { op: 'in', at: [at] }; }
      if (c == 'not' && this.peek(1)?.text == 'in') { this.take(); this.take(); return { op: 'notin', at: [at, at + 1] }; }
      return null;
    }
    if (c == null || this.peek()?.type != 'op' || !'=<>!'.includes(c)) return null;
    this.take();
    const d = this.peek()?.text;
    let op = c;
    if ((c == '<' || c == '>' || c == '!' || c == '=') && d == '=') { this.take(); op = c + '='; }
    else if (c == '<' && d == '>') { this.take(); op = '!='; }
    if (op == '=' || op == '==') op = '==';
    if (op == '!') throw new Error('bad op');
    return { op, at: Array.from({ length: this.k - at }, (_, j) => at + j) };
  }
  private compare(): Expr {
    const from = this.k;
    const a = this.add();
    const first = this.compareOp();
    if (!first) return a;
    const b = this.add();
    // Python 可以連著比：0 <= x < 10（每一段都成立才是真；中間的 x 只算一次）
    if (this.py && this.is('<', '>', '=', '!', 'in', 'not')) {
      const items = [a, b];
      const ops = [first.op];
      const at = [...first.at];
      for (let next = this.compareOp(); next; next = this.compareOp()) {
        ops.push(next.op);
        at.push(...next.at);
        items.push(this.add());
      }
      // 每個符號的 token 位置都記下來，執行時換成逗號（見 decoder）
      return this.mark(from, { t: 'chain', items, ops }, at);
    }
    return this.mark(from, { t: 'bin', op: first.op, a, b }, first.at);
  }
  private add(): Expr {
    const from = this.k;
    let a = this.mul();
    while (this.is('+', '-')) { const at = this.k; const op = this.take().text; a = this.mark(from, { t: 'bin', op, a, b: this.mul() }, [at]); }
    return a;
  }
  private mul(): Expr {
    const from = this.k;
    let a = this.unary();
    while (this.is('*', '/', '%') || (this.py && this.is('//'))) {
      const at = this.k;
      const op = this.take().text;
      const b = this.unary();
      a = this.mark(from, { t: 'bin', op, a, b, span: [from, at, this.k] }, [at]);
    }
    return a;
  }
  private unary(): Expr {
    const from = this.k;
    const e = this.unaryInner();
    this.spans.set(e, [from, this.k]);
    return e;
  }
  private unaryInner(): Expr {
    if (this.is('-')) { this.take(); return { t: 'neg', a: this.unary() }; }
    if (this.is('+')) { this.take(); return this.unary(); }
    const from = this.k;
    const e = this.postfix();
    // Python 的次方：2 ** 3（右邊先算：2 ** 3 ** 2 是 2 ** 9；-2 ** 2 是 -(2 ** 2)）
    if (this.py && this.is('**')) {
      const at = this.k;
      this.take();
      return this.mark(from, { t: 'bin', op: '**', a: e, b: this.unary(), span: [from, at, this.k] }, [at]);
    }
    return e;
  }
  private postfix(): Expr {
    const from = this.k;
    let e = this.primary();
    while (this.is('[', '.')) {
      const dot = this.k;
      if (this.take().text == '.') {
        // s.top()：點後面是函式名稱，再接空的括號；沒有括號是 struct 的欄位（e.from）
        const name = this.take();
        if (name.type != 'name') throw new Error('method');
        if (!this.is('(')) {
          e = { t: 'field', obj: e, name: name.text };
          continue;
        }
        // 函式可以有引數：s.substr(1, 3)
        this.expect('(');
        const args: Expr[] = [];
        if (!this.is(')')) {
          args.push(this.or());
          while (this.is(',')) { this.take(); args.push(this.or()); }
        }
        this.expect(')');
        // 記下 . 名稱 ( ) 的位置（Python 的函式執行時要換掉）
        e = this.mark(from, { t: 'method', obj: e, name: name.text, args }, [dot, dot + 1, dot + 2, this.k - 1]);
        continue;
      }
      // Python 的切片：s[a:b]、s[:k]、s[::-1]
      if (this.py && (this.is(':') || this.sliceAhead())) {
        const at = [dot];
        const parts: (Expr | undefined)[] = [];
        let cur: Expr | undefined = this.is(':') || this.is(']') ? undefined : this.or();
        while (this.is(':')) {
          parts.push(cur);
          at.push(this.k);
          this.take();
          cur = this.is(':') || this.is(']') ? undefined : this.or();
        }
        parts.push(cur);
        if (parts.length > 3) throw new Error('slice');
        at.push(this.k);
        this.expect(']');
        e = this.mark(from, { t: 'slice', obj: e, start: parts[0], stop: parts[1], step: parts[2] }, at);
        continue;
      }
      const index = this.or();
      this.expect(']');
      e = this.mark(from, { t: 'idx', obj: e, index }, [dot, this.k - 1]);
    }
    return e;
  }
  /** [ 後面（同一層）有沒有 :（Python 的切片） */
  private sliceAhead(): boolean {
    let depth = 0;
    for (let j = this.k; j < this.tokens.length; j++) {
      const x = this.tokens[j].text;
      if (x == '[' || x == '(' || x == '{') depth++;
      else if (x == ']' || x == ')' || x == '}') { if (depth-- == 0) return false; }
      else if (x == ':' && depth == 0) return true;
    }
    return false;
  }
  private primary(): Expr {
    const from = this.k;
    const tk = this.take();
    if (this.py && tk.type == 'name' && (tk.text == 'True' || tk.text == 'False')) return this.mark(from, { t: 'bool', v: tk.text == 'True' }, [from]);
    // C++ 的 ::a：全域的 a（main 裡有同名的 a 蓋住它時用）
    if (tk.text == ':' && this.is(':')) {
      this.take();
      const name = this.take();
      if (name.type != 'name') throw new Error('scope');
      return { t: 'var', name: '::' + name.text };
    }
    if (tk.type == 'number') return { t: 'num', v: tk.text };
    if (tk.type == 'string') {
      const v = tk.text.slice(1, -1);
      // 'a'：單引號裡一個字（C++ 的 char）
      return tk.text[0] == "'" && [...v].length == 1 ? { t: 'str', v, ch: true } : { t: 'str', v };
    }
    // Python 的 list：[1, -1, 0, 0]
    if (this.py && tk.text == '[') {
      const items: Expr[] = [];
      while (!this.is(']')) {
        items.push(this.or());
        if (!this.is(',')) break;
        this.take();
      }
      this.expect(']');
      return this.mark(from, { t: 'list', items });
    }
    if (tk.text == '(') {
      const e = this.or();
      // Python 的 tuple：(a, b)
      if (this.py && this.is(',')) {
        const items = [e];
        while (this.is(',')) {
          this.take();
          if (this.is(')')) break;
          items.push(this.or());
        }
        this.expect(')');
        return this.mark(from, { t: 'brace', items }, [from, this.k - 1]);
      }
      this.expect(')');
      return e;
    }
    // {a, b}：一整筆 pair / struct
    if (tk.text == '{') {
      const items: Expr[] = [];
      if (!this.is('}')) {
        items.push(this.or());
        while (this.is(',')) { this.take(); items.push(this.or()); }
      }
      this.expect('}');
      return { t: 'brace', items };
    }
    if (tk.type == 'name') {
      const calls = this.py ? PY_CALLS : CALLS;
      const fn = Object.prototype.hasOwnProperty.call(calls, tk.text) ? calls[tk.text] : undefined;
      if (this.is('(')) {
        this.take();
        const args: Expr[] = [];
        if (!this.is(')')) {
          args.push(this.or());
          while (this.is(',')) { this.take(); args.push(this.or()); }
        }
        this.expect(')');
        // 其他名稱後面接 ( )：有回傳值的模組
        return this.mark(from, fn ? { t: 'call', fn, args } : { t: 'fcall', name: tk.text, args }, [from]);
      }
      // Python：記下變數是第幾個 token（t[0]、h[0] 執行時要換掉變數那個 token）
      return this.mark(from, { t: 'var', name: tk.text });
    }
    throw new Error('unexpected ' + tk.text);
  }
}

// ---------------- 變數表 ----------------

/**
 * 變數的型別。清單在 C++ 是 vector；二維清單、陣列（array）、堆疊（stack）、佇列（queue）只有學習目標是 C++ 時才有
 */
export type VarType = '數字' | '文字' | '清單' | '二維清單' | '陣列' | '堆疊' | '佇列' | '結構'
  /** C++ 的 set（不重複、由小到大）、map（鍵 → 值）、priority_queue（大的先出來；「小」是小的先出來） */
  | '集合' | '對應表' | '優先佇列' | '優先佇列小';

/** 容器：初始值欄是「裡面裝什麼」，不是一個值 */
export const isContainerType = (type: VarType | undefined) => type == '清單' || type == '二維清單' || type == '陣列' || type == '堆疊' || type == '佇列'
  || type == '集合' || type == '對應表' || type == '優先佇列' || type == '優先佇列小';

/** priority_queue（大的先、小的先） */
export const isPqType = (type: VarType | undefined) => type == '優先佇列' || type == '優先佇列小';

/** 只有 C++ 有的型別（Scratch / Blockly 畫不出來） */
export const isCppOnlyType = (type: VarType | undefined) => type != undefined && type != '數字' && type != '文字' && type != '清單';

export interface VarInfo {
  name: string;
  type: VarType;
  /**
   * 數字/文字的初始值；容器（清單、陣列…）是裡面裝「數字」、「小數」（C++ 的 float）、「文字」或某個 struct 的名稱；
   * struct 變數是它的 struct 名稱
   */
  init: string;
  /** C++：數字變數是 float（小數）；沒有就是 int（整數） */
  float?: boolean;
  /** C++：數字變數是 long long（很大的整數）；int 超過約 21 億會溢位 */
  long?: boolean;
  /** C++：文字變數是 char（一個字）：算的時候是字的編號，跟 s[i] 一樣 */
  char?: boolean;
  /** 陣列（array）的大小：宣告時就決定，之後不能改 */
  size?: string;
  /** array 的大小在流程圖中用計算積木「建立」決定（例如先輸入 n，再 int a[n];） */
  sizeLater?: boolean;
  /** struct 變數每個欄位的初始值（欄位名稱 → 值；沒填是 0 或空的文字），跟 C++ 的 Edge e = {1, 2, 7}; 一樣 */
  fieldInit?: Record<string, string>;
  /** C++：全域變數（宣告在 main 外面，每個模組都用得到） */
  global?: boolean;
}

/** 運算式最後是什麼型別（判斷要怎麼寫成 C++ / 積木用）；struct 是一整筆資料（例如 e、edges[i]） */
export type ExprType = 'num' | 'str' | 'char' | 'bool' | 'list' | 'struct';

/**
 * 運算式是哪一種 struct 的一整筆資料：struct 變數 e、裝 struct 的 array / vector 的一格 edges[i]、
 * 二維 vector 的一格 g[u][k]、stack / queue 的 s.top()、q.front()；不是的話 null
 */
export function structOf(e: Expr, vars: Map<string, VarInfo>): string | null {
  if (e.t == 'var') {
    const v = vars.get(e.name);
    return v?.type == '結構' && findStruct(v.init) ? v.init : null;
  }
  if (e.t == 'idx' && e.obj.t == 'var') {
    const v = vars.get(e.obj.name);
    if (v?.type == '對應表') return findStruct(mapParts(v.init).value) ? mapParts(v.init).value : null;
    // Python 的 deque、heapq 也用 [ ] 看：q[0]、h[0]
    return (v?.type == '清單' || v?.type == '陣列' || v?.type == '佇列' || v?.type == '優先佇列小') && findStruct(v.init) ? v.init : null;
  }
  // Python 的 d.get(k)：map 的值
  if (e.t == 'method' && e.name == 'get' && e.obj.t == 'var') {
    const v = vars.get(e.obj.name);
    return v?.type == '對應表' && findStruct(mapParts(v.init).value) ? mapParts(v.init).value : null;
  }
  // 二維 vector 的一格：g[u][k]（例如有權重的鄰接串列 vector<vector<Edge>>）
  if (e.t == 'idx' && e.obj.t == 'idx' && e.obj.obj.t == 'var') {
    const v = vars.get(e.obj.obj.name);
    return v?.type == '二維清單' && findStruct(v.init) ? v.init : null;
  }
  // stack 的 top()、queue 的 front()、back()
  if (e.t == 'method' && e.obj.t == 'var' && ['top', 'front', 'back'].includes(e.name)) {
    const v = vars.get(e.obj.name);
    return (v?.type == '堆疊' || v?.type == '佇列' || isPqType(v?.type)) && findStruct(v!.init) ? v!.init : null;
  }
  return null;
}

/** struct 欄位 e.from 的定義；前面不是 struct 或沒有這個欄位時 undefined */
export function fieldOf(e: Expr & { t: 'field' }, vars: Map<string, VarInfo>): StructField | undefined {
  return findStruct(structOf(e.obj, vars) ?? undefined)?.fields.find(f => f.name == e.name);
}

/** Python 的 tuple（內建的 pair）用 t[0]、t[1] 拿：第幾個欄位；不是的話 undefined */
export function tupleField(e: Expr, vars: Map<string, VarInfo>): StructField | undefined {
  if (e.t != 'idx' || e.index.t != 'num') return undefined;
  const s = findStruct(structOf(e.obj, vars) ?? undefined);
  return s?.fields[Number(e.index.v)];
}

export function exprType(e: Expr, vars: Map<string, VarInfo>, modules: ModuleInfo[] = []): ExprType {
  if (structOf(e, vars)) return 'struct';
  const tf = isPython() ? tupleField(e, vars) : undefined;
  if (tf) return tf.type == '文字' ? 'str' : 'num';
  switch (e.t) {
    case 'bool': return 'bool';
    case 'list': return 'list';
    case 'chain': return 'bool';
    case 'slice': return exprType(e.obj, vars, modules) == 'str' ? 'str' : 'list';
    case 'brace': return 'struct';
    case 'field': return fieldOf(e, vars)?.type == '文字' ? 'str' : 'num';
    case 'fcall': return modules.find(m => m.name == e.name)?.returns == '文字' ? 'str' : 'num';
    case 'num': return 'num';
    // C++ 的 'a' 是一個字（char）
    case 'str': return e.ch && getTarget() == 'cpp' ? 'char' : 'str';
    case 'var': {
      const v = vars.get(e.name);
      return isContainerType(v?.type) ? 'list' : v?.type == '文字' ? (v.char && getTarget() == 'cpp' ? 'char' : 'str') : 'num';
    }
    case 'method': {
      if (isPython()) {
        if (['upper', 'lower', 'strip', 'replace'].includes(e.name)) return 'str';
        if (['isdigit', 'isalpha', 'isupper', 'islower', 'startswith', 'endswith'].includes(e.name)) return 'bool';
        if (['find', 'count', 'index'].includes(e.name)) return 'num';
        if (e.name == 'split') return 'list';
        if (e.name == 'get' && e.obj.t == 'var') return mapParts(vars.get(e.obj.name)?.init).value == '文字' ? 'str' : 'num';
      }
      if (e.name == 'size' || e.name == 'length' || e.name == 'count') return 'num';
      if (e.name == 'empty') return 'bool';
      if (e.name == 'substr') return 'str';
      // top()、front()、back()：容器裡裝的東西
      return e.obj.t == 'var' && vars.get(e.obj.name)?.init == '文字' ? 'str' : 'num';
    }
    case 'idx': {
      const o = exprType(e.obj, vars, modules);
      // C++ 的 s[i] 是一個字（char）；Python 的一個字也是文字
      if (o == 'str') return isPython() ? 'str' : 'char';
      if (e.obj.t == 'var') {
        const v = vars.get(e.obj.name);
        // map 的一格：值的型別
        if (v?.type == '對應表') return mapParts(v.init).value == '文字' ? 'str' : 'num';
        // 二維清單只取一個 [ ]：是一整列
        if (v?.type == '二維清單') return 'list';
        return v?.init == '文字' ? 'str' : 'num';
      }
      // 二維清單的一格：表[a][b]
      if (e.obj.t == 'idx' && e.obj.obj.t == 'var') return vars.get(e.obj.obj.name)?.init == '文字' ? 'str' : 'num';
      return 'num';
    }
    case 'call': {
      if (e.fn == 'max' || e.fn == 'min') {
        const a = e.args[0];
        // max(v)：容器裡裝什麼就是什麼；max(a, b)：跟 a 一樣
        if (e.args.length == 1 && a?.t == 'var') return vars.get(a.name)?.init == '文字' ? 'str' : 'num';
        return a ? exprType(a, vars, modules) : 'num';
      }
      if (e.fn == 'chr' && isPython()) return 'str';
      if (e.fn == 'chr' || e.fn == 'toupper' || e.fn == 'tolower') return 'char';
      if (CHAR_TESTS.includes(e.fn)) return 'bool';
      return e.fn == 'has' ? 'bool' : e.fn == 'tostr' ? 'str' : 'num';
    }
    case 'bin':
      if (['==', '!=', '<', '<=', '>', '>=', 'and', 'or', 'in', 'notin'].includes(e.op)) return 'bool';
      // Python："-" * 10 是 10 個 -；[0] * n 是 n 個 0；list + list 接起來
      if (e.op == '*' && isPython() && (exprType(e.a, vars, modules) == 'str' || exprType(e.b, vars, modules) == 'str')) return 'str';
      if ((e.op == '*' || e.op == '+') && isPython() && (exprType(e.a, vars, modules) == 'list' || exprType(e.b, vars, modules) == 'list')) return 'list';
      if (e.op == '+') {
        const a = exprType(e.a, vars, modules), b = exprType(e.b, vars, modules);
        if (a == 'str' || b == 'str') return 'str';
        // C++：字 + 字、字 + 數字 都是數字（'a' + 1 是 98）；積木把兩個字接起來
        if (a == 'char' && b == 'char' && getTarget() != 'cpp') return 'str';
      }
      return 'num';
    case 'not': return 'bool';
    case 'neg': return 'num';
    default: return 'num';
  }
}

/**
 * Python：運算式算出來一定是小數（float）嗎——/ 一定是小數（6 / 2 是 3.0）、float 變數、有小數點的數字、float( )…；
 * 不確定的當成不是。輸出時決定要不要印成 3.0、存進 int 變數時擋下來用
 */
export function isFloatExpr(e: Expr, vars: Map<string, VarInfo>, modules: ModuleInfo[] = []): boolean {
  const f = (x: Expr) => isFloatExpr(x, vars, modules);
  /** 容器裡裝的是 float（map 看值） */
  const holdsFloat = (name: string) => {
    const v = vars.get(name);
    return !!v && (v.type == '對應表' ? mapParts(v.init).value : v.init) == '小數';
  };
  const tf = tupleField(e, vars);
  if (tf) return tf.type == '數字' && !!tf.float;
  switch (e.t) {
    case 'num': return e.v.includes('.');
    case 'var': {
      const v = vars.get(e.name);
      return v?.type == '數字' && !!v.float;
    }
    case 'field': return !!fieldOf(e, vars)?.float;
    case 'idx': {
      const o = e.obj.t == 'idx' ? e.obj.obj : e.obj;
      return o.t == 'var' && holdsFloat(o.name);
    }
    case 'method': return e.name == 'get' && e.obj.t == 'var' && holdsFloat(e.obj.name);
    case 'call':
      if (e.fn == 'float') return true;
      if (e.fn == 'abs') return !!e.args[0] && f(e.args[0]);
      if (e.fn == 'sum' || ((e.fn == 'max' || e.fn == 'min') && e.args.length == 1)) return e.args[0]?.t == 'var' && holdsFloat(e.args[0].name);
      if (e.fn == 'max' || e.fn == 'min') return e.args.every(f);
      // round(x, 2) 還是小數；round(x) 是整數
      if (e.fn == 'round') return e.args.length == 2;
      return false;
    case 'fcall': return !!modules.find(m => m.name == e.name)?.returnsFloat;
    case 'neg': return f(e.a);
    case 'bin':
      if (e.op == '/') return true;
      if (['+', '-', '*', '//', '%', '**'].includes(e.op)) return f(e.a) || f(e.b);
      return false;
    default: return false;
  }
}
