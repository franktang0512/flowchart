// 「看程式」：流程圖的結構 → Python（學習目標是 Python 時）。
// 給學生看「流程圖怎麼變成程式」，以好讀為主：
//   變數表的變數寫在最前面給初始值（Python 不用宣告型別，但要先有值）；模組寫成 def，改到主流程的變數要寫 global
//   輸入一次讀一整行：n = int(input())、a = list(map(int, input().split()))、a, b = map(int, input().split())
//   輸出：print(a, b)；整個 list 是 print(*a)（一項一項用空白隔開，跟流程圖執行的結果一樣）
import { t } from '../i18n';
import { mapParts, splitArgs } from './modules';
import { exprType, fieldOf, isFloatExpr, parseExpr, PY_NAME, type Expr, type ExprType, type ModuleProgram, type Stmt, type VarInfo } from './structure';
import { findStruct } from './structs';

const INDENT = '    ';

/** 運算子的優先順序（數字越大越先算），決定要不要加括號 */
const PREC: Record<string, number> = {
  or: 1, and: 2, in: 4, notin: 4, '==': 4, '!=': 4, '<': 4, '<=': 4, '>': 4, '>=': 4, '+': 6, '-': 6, '*': 7, '/': 7, '//': 7, '%': 7, '**': 9,
};
const PY_OP: Record<string, string> = { notin: 'not in' };
/** 「重複直到」要寫成 while 不成立：比較可以直接換成相反的符號 */
const NEGATE: Record<string, string> = { '==': '!=', '!=': '==', '<': '>=', '<=': '>', '>': '<=', '>=': '<', in: 'notin', notin: 'in' };

export interface PythonOptions {
  /** 大測資：用 sys.stdin 讀，比 input() 快很多 */
  fastInput?: boolean;
}

export function toPython(program: Stmt[], varList: VarInfo[], modules: ModuleProgram[] = [], options: PythonOptions = {}): string {
  const mainVars = new Map(varList.map(v => [v.name, v] as const));
  const localsOf = (m: ModuleProgram): VarInfo[] => (m.locals ?? []).filter(v => v.name.trim() != '').map(v => ({ name: v.name.trim(), type: v.type, init: v.init, float: v.float, fieldInit: v.fieldInit }));
  /** 目前寫到的地方看得到的變數：主程式是變數表；模組裡再加上參數和區域變數（同名時用自己的） */
  let vars = new Map(mainVars);
  let current: ModuleProgram | null = null;
  const enter = (m: ModuleProgram | null) => {
    current = m;
    vars = m ? new Map([...mainVars, ...m.params.map(p => [p.name, { name: p.name, type: p.type, init: '', float: p.float } as VarInfo] as const), ...localsOf(m).map(v => [v.name, v] as const)]) : new Map(mainVars);
  };
  const uses = { deque: false, heapq: false, math: false };
  const typeOf = (e: Expr): ExprType => exprType(e, vars, modules);
  const isFloat = (e: Expr) => isFloatExpr(e, vars, modules);
  const typeOfVar = (name: string) => vars.get(name)?.type;
  /** 容器裡裝的東西（map 是值）：文字、小數、數字，或 pair 的名稱 */
  const holdsOf = (name: string) => {
    const v = vars.get(name);
    return v?.type == '對應表' ? mapParts(v.init).value : v?.init ?? '';
  };

  /** 運算式 → Python；parent 是外層運算子的優先順序 */
  const expr = (e: Expr, parent = 0): string => {
    switch (e.t) {
      case 'num': return e.v;
      case 'str': return JSON.stringify(e.v);
      case 'bool': return e.v ? 'True' : 'False';
      case 'list': return `[${e.items.map(a => expr(a)).join(', ')}]`;
      case 'var': return e.name.replace(/^::/, '');
      case 'brace': return `(${e.items.map(a => expr(a)).join(', ')}${e.items.length == 1 ? ',' : ''})`;
      case 'raw': return e.text;
      // 指標只有 C++ 有
      case 'arrow': case 'deref': case 'addr': case 'null': case 'new': return 'None';
      case 'idx': return `${expr(e.obj, 10)}[${expr(e.index)}]`;
      case 'slice': return `${expr(e.obj, 10)}[${e.start ? expr(e.start) : ''}:${e.stop ? expr(e.stop) : ''}${e.step ? ':' + expr(e.step) : ''}]`;
      case 'method': return `${expr(e.obj, 10)}.${e.name}(${e.args.map(a => expr(a)).join(', ')})`;
      // pair 的 first、second 在 Python 是 tuple 的 [0]、[1]
      case 'field': {
        const f = fieldOf(e, vars);
        return f && (e.name == 'first' || e.name == 'second') ? `${expr(e.obj, 10)}[${e.name == 'first' ? 0 : 1}]` : `${expr(e.obj, 10)}.${e.name}`;
      }
      case 'fcall': return `${e.name}(${e.args.map((a, k) => argCode(e.name, a, k)).join(', ')})`;
      case 'neg': return wrap(`-${expr(e.a, 8)}`, 8, parent);
      case 'not': return wrap(`not ${expr(e.a, 3)}`, 3, parent);
      case 'call': return `${PY_NAME[e.fn] ?? e.fn}(${e.args.map(a => expr(a)).join(', ')})`;
      case 'chain': return wrap(e.items.map(a => expr(a, 5)).reduce((acc, x, k) => `${acc} ${PY_OP[e.ops[k - 1]] ?? e.ops[k - 1]} ${x}`), 4, parent);
      case 'bin': {
        const p = PREC[e.op] ?? 4;
        const op = PY_OP[e.op] ?? e.op;
        // ** 是右邊先算：左邊同一級要加括號
        if (e.op == '**') return wrap(`${expr(e.a, p + 1)} ** ${expr(e.b, p)}`, p, parent);
        return wrap(`${expr(e.a, p)} ${op} ${expr(e.b, p + 1)}`, p, parent);
      }
    }
  };
  const wrap = (code: string, p: number, parent: number) => (p < parent ? `(${code})` : code);

  /** 傳給模組的值：文字參數傳數字要先 str( )、float 參數傳整數先 float( )（跟流程圖執行的結果一樣） */
  const argCode = (name: string, a: Expr, k: number) => {
    const p = modules.find(x => x.name == name)?.params[k];
    if (p?.type == '文字' && typeOf(a) == 'num') return `str(${expr(a)})`;
    if (p?.type == '數字' && p.float && !isFloat(a)) return `float(${expr(a)})`;
    return expr(a);
  };

  /** 條件；negate 時寫成相反的條件（給「重複直到」用） */
  const cond = (e: Expr, negate = false): string => {
    if (!negate) return expr(e);
    if (e.t == 'not') return expr(e.a);
    if (e.t == 'bin' && NEGATE[e.op]) return expr({ ...e, op: NEGATE[e.op] });
    return `not ${expr(e, 3)}`;
  };

  /** 存進變數的值：文字變數放數字要 str( )、float 變數放整數要 float( ) */
  const valueFor = (target: string, e: Expr, code: string) => {
    const v = vars.get(target);
    if (v?.type == '文字' && typeOf(e) == 'num') return `str(${code})`;
    if (v?.type == '數字' && v.float && !isFloat(e)) return `float(${code})`;
    return code;
  };

  /** 有「一直輸入到沒有資料」的迴圈：要 import sys */
  let usesStdin = false;

  /** 讀一行變成某個變數的型別：int(input())、float(input())、input() */
  const readAs = (target: string, src = 'input()') => {
    const v = vars.get(target);
    return v?.type == '文字' ? src : v?.float ? `float(${src})` : `int(${src})`;
  };
  /** 讀一行放進容器的一格（照裡面裝的東西） */
  const readElem = (list: string) => {
    const h = holdsOf(list);
    return h == '文字' ? 'input()' : h == '小數' ? 'float(input())' : 'int(input())';
  };
  /** 一整行拆開變成 list：list(map(int, input().split())) */
  const readList = (list: string) => {
    const h = holdsOf(list);
    return h == '文字' ? 'input().split()' : `list(map(${h == '小數' ? 'float' : 'int'}, input().split()))`;
  };

  const lines: string[] = [];
  const emit = (depth: number, line: string) => lines.push(INDENT.repeat(depth) + line);
  const rounded = (round: string, code: string) => {
    if (!round) return code;
    uses.math = true;
    // 流程圖的四捨五入是 0.5 進位（Python 的 round(2.5) 是 2，不一樣），所以寫成 math.floor(x + 0.5)
    if (round == 'Math.round') return `math.floor(${code} + 0.5)`;
    return `math.${round.replace('Math.', '')}(${code})`;
  };
  /** 空的區塊要寫 pass */
  const block = (list: Stmt[], depth: number) => {
    if (!list.length) emit(depth, 'pass');
    else stmts(list, depth);
  };

  const stmts = (list: Stmt[], depth: number) => list.forEach(s => stmt(s, depth));
  const stmt = (s: Stmt, depth: number) => {
    switch (s.kind) {
      case 'input': {
        const target = s.target;
        const many = splitArgs(target);
        // 一行讀好幾個：a, b = map(int, input().split())
        if (many.length > 1) {
          const kinds = many.map(n => (vars.get(n)?.type == '文字' ? 'str' : vars.get(n)?.float ? 'float' : 'int'));
          if (kinds.every(k => k == kinds[0])) {
            emit(depth, kinds[0] == 'str' ? `${many.join(', ')} = input().split()` : `${many.join(', ')} = map(${kinds[0]}, input().split())`);
          }
          else {
            emit(depth, `${many.join(', ')} = input().split()`);
            many.forEach((n, k) => kinds[k] != 'str' && emit(depth, `${n} = ${kinds[k]}(${n})`));
          }
          break;
        }
        const v = vars.get(target);
        if (s.place == 'replace') {
          const at = `${target}[${expr(s.index!)}]${s.index2 ? `[${expr(s.index2)}]` : ''}`;
          emit(depth, `${at} = ${readElem(target)}`);
          break;
        }
        if (s.place == 'insert') {
          emit(depth, `${target}.insert(${expr(s.index!)}, ${readElem(target)})`);
          break;
        }
        if (v?.type == '清單') emit(depth, `${target} = ${readList(target)}`);
        else if (v?.type == '二維清單') emit(depth, `${target}.append(${readList(target)})`);
        else emit(depth, `${target} = ${readAs(target)}`);
        break;
      }
      case 'output': {
        const parts = s.value.t == 'raw' ? splitArgs(s.value.text).map(parseExpr) : [s.value];
        // print(..., end=" ")：印完不換行，後面加一個空白
        const end = s.noNewline ? `${parts.length ? ', ' : ''}end=" "` : '';
        const one = parts.length == 1 && parts[0].t == 'var' && !s.noNewline ? parts[0].name : null;
        const kind = one ? typeOfVar(one) : undefined;
        // 整個二維 list：一列一行；dict：一行一個「鍵 值」
        if (one && kind == '二維清單') {
          emit(depth, `for row in ${one}:`);
          emit(depth + 1, 'print(*row)');
          break;
        }
        if (one && kind == '對應表') {
          emit(depth, `for key in ${one}:`);
          emit(depth + 1, `print(key, ${one}[key])`);
          break;
        }
        const shown = parts.map(p => {
          const k = p.t == 'var' ? typeOfVar(p.name) : undefined;
          // set、heapq 的順序不是由小到大：排好再印（跟流程圖執行的結果一樣）
          if (p.t == 'var' && (k == '集合' || k == '優先佇列小' || k == '優先佇列')) return `*sorted(${p.name})`;
          if (p.t == 'var' && (k == '清單' || k == '佇列' || k == '陣列' || k == '堆疊')) return `*${p.name}`;
          return expr(p);
        });
        emit(depth, `print(${shown.join(', ')}${end})`);
        break;
      }
      case 'rect': {
        const value = s.value ? rounded(s.round, expr(s.value)) : '';
        const at = s.index ? expr(s.index) : '';
        const ty = typeOfVar(s.target);
        switch (s.action) {
          case '設為': {
            // 四捨五入過的是整數；其他照變數的型別轉
            emit(depth, `${s.target} = ${s.value && !s.round ? valueFor(s.target, s.value, value) : value}`);
            break;
          }
          case '加入': emit(depth, `${s.target}.append(${value})`); break;
          case '插入': emit(depth, `${s.target}.insert(${at}, ${value})`); break;
          case '替換': emit(depth, `${s.target}[${expr(s.index!)}]${s.index2 ? `[${expr(s.index2)}]` : ''} = ${value}`); break;
          case '建立': {
            const h = holdsOf(s.target);
            const s0 = findStruct(h) ? `(${findStruct(h)!.fields.map(f => (f.type == '文字' ? '""' : '0')).join(', ')})` : h == '文字' ? '""' : h == '小數' ? '0.0' : '0';
            if (!s.index2) {
              emit(depth, `${s.target} = [${s0}] * ${expr(s.index!, 7)}`);
              break;
            }
            // 二維 list：每一列要是不同的 list，所以用 for 一列一列做（[[0] * c] * r 每一列會是同一個）
            const empty = s.index2.t == 'num' && Number(s.index2.v) == 0;
            emit(depth, empty ? `${s.target} = [[] for _ in range(${expr(s.index!)})]` : `${s.target} = [[${s0}] * ${expr(s.index2, 7)} for _ in range(${expr(s.index!)})]`);
            break;
          }
          case '刪除':
            emit(depth, ty == '對應表' ? `del ${s.target}[${at}]` : ty == '集合' ? `${s.target}.discard(${at})` : `${s.target}.pop(${at})`);
            break;
          case '清空': emit(depth, `${s.target}.clear()`); break;
          case '放入':
            if (ty == '優先佇列小' || ty == '優先佇列') {
              uses.heapq = true;
              emit(depth, `heappush(${s.target}, ${value})`);
            }
            else emit(depth, ty == '集合' ? `${s.target}.add(${value})` : `${s.target}.append(${value})`);
            break;
          case '取出':
            if (ty == '優先佇列小' || ty == '優先佇列') {
              uses.heapq = true;
              emit(depth, `heappop(${s.target})`);
            }
            else emit(depth, ty == '佇列' ? `${s.target}.popleft()` : `${s.target}.pop()`);
            break;
        }
        break;
      }
      case 'if': {
        emit(depth, `if ${cond(s.cond)}:`);
        block(s.yes, depth + 1);
        // 否則裡面只有另一個判斷：寫成 elif
        let no = s.no;
        while (no.length == 1 && no[0].kind == 'if') {
          const inner: Extract<Stmt, { kind: 'if' }> = no[0];
          emit(depth, `elif ${cond(inner.cond)}:`);
          block(inner.yes, depth + 1);
          no = inner.no;
        }
        if (no.length) {
          emit(depth, 'else:');
          stmts(no, depth + 1);
        }
        break;
      }
      case 'repeat':
        emit(depth, `for _ in range(${expr(s.times)}):`);
        block(s.body, depth + 1);
        break;
      case 'range': {
        const start = expr(s.start), stop = expr(s.stop), step = expr(s.step);
        const args = step == '1' ? (start == '0' ? [stop] : [start, stop]) : [start, stop, step];
        withLoopVar(s.name, { name: s.name, type: '數字', init: '0' }, () => {
          emit(depth, `for ${s.name} in range(${args.join(', ')}):`);
          block(s.body, depth + 1);
        });
        break;
      }
      case 'each': {
        // 拿出來的是什麼：字串的字是 str、list 裡裝什麼就是什麼、二維 list 的每一列是 list、dict 是鍵
        const owner = s.iter.t == 'var' ? vars.get(s.iter.name) : undefined;
        const h = owner?.type == '對應表' ? mapParts(owner.init).key : owner?.init ?? '';
        const as: VarInfo = typeOf(s.iter) == 'str' ? { name: s.name, type: '文字', init: '' }
          : owner?.type == '二維清單' ? { name: s.name, type: '清單', init: h }
          : findStruct(h) ? { name: s.name, type: '結構', init: h }
          : h == '文字' ? { name: s.name, type: '文字', init: '' } : { name: s.name, type: '數字', init: '0', float: h == '小數' };
        withLoopVar(s.name, as, () => {
          emit(depth, `for ${s.name} in ${expr(s.iter)}:`);
          block(s.body, depth + 1);
        });
        break;
      }
      case 'for':
        // C++ 的 for（Python 不會有，只是寫完整）
        emit(depth, `${s.name} = ${expr(s.start)}`);
        emit(depth, `while ${cond(s.cond)}:`);
        stmts(s.body, depth + 1);
        emit(depth + 1, `${s.name} = ${expr(s.next)}`);
        break;
      case 'break': emit(depth, 'break'); break;
      case 'continue': emit(depth, 'continue'); break;
      case 'until':
        emit(depth, `while ${cond(s.cond, true)}:`);
        block(s.body, depth + 1);
        break;
      // 一直輸入到沒有資料：sys.stdin 一行一行拿，拿完就停（文字要去掉最後的換行）
      case 'eof':
        usesStdin = true;
        emit(depth, 'for line in sys.stdin:');
        const many = splitArgs(s.target);
        // 一行好幾個：a, b = map(int, line.split())
        if (many.length > 1) {
          const kinds = many.map(n => (vars.get(n)?.type == '文字' ? 'str' : vars.get(n)?.float ? 'float' : 'int'));
          if (kinds.every(k => k == kinds[0])) emit(depth + 1, kinds[0] == 'str' ? `${many.join(', ')} = line.split()` : `${many.join(', ')} = map(${kinds[0]}, line.split())`);
          else {
            emit(depth + 1, `${many.join(', ')} = line.split()`);
            many.forEach((n, k) => kinds[k] != 'str' && emit(depth + 1, `${n} = ${kinds[k]}(${n})`));
          }
        }
        else emit(depth + 1, `${s.target} = ${readAs(s.target, vars.get(s.target)?.type == '文字' ? 'line.rstrip("\\n")' : 'line')}`);
        stmts(s.body, depth + 1);
        break;
      case 'call':
        emit(depth, `${s.name}(${s.args.map((a, k) => argCode(s.name, a, k)).join(', ')})`);
        break;
      case 'sort': {
        const n = s.count ? expr(s.count) : '';
        // 只排前 n 個：a[:n] = sorted(a[:n])
        const part = n ? `${s.target}[:${n}]` : s.target;
        const reverse = s.desc ? 'reverse=True' : '';
        if (s.key) {
          // 自訂 key：每一項用 x 代表
          const owner = vars.get(s.target);
          const elem: VarInfo = { name: 'x', type: owner?.init == '文字' ? '文字' : findStruct(owner?.init) ? '結構' : '數字', init: owner?.init ?? '', float: owner?.init == '小數' };
          let key = '';
          withLoopVar('x', elem, () => { key = expr(s.key!); });
          const args = [`key=lambda x: ${key}`, ...(reverse ? [reverse] : [])].join(', ');
          emit(depth, n ? `${part} = sorted(${part}, ${args})` : `${s.target}.sort(${args})`);
        }
        else if (s.keys?.length) {
          // tuple 依欄位排：Python 的排序是穩定的，從最後一個條件排到第一個，就是「前面的一樣大才比後面的」
          const idx = (field: string) => (field == 'first' ? 0 : field == 'second' ? 1 : field);
          if (n) emit(depth, `part = ${part}`);
          const what = n ? 'part' : s.target;
          for (const k of [...s.keys].reverse()) emit(depth, `${what}.sort(key=lambda x: x[${idx(k.field)}]${k.desc ? ', reverse=True' : ''})`);
          if (n) emit(depth, `${part} = part`);
        }
        else if (n) emit(depth, `${part} = sorted(${part}${s.desc ? ', reverse=True' : ''})`);
        else emit(depth, `${s.target}.sort(${s.desc ? 'reverse=True' : ''})`);
        break;
      }
      case 'return': {
        const value = rounded(s.round, expr(s.value));
        const m = current as ModuleProgram | null;
        const conv = m?.returns == '文字' && typeOf(s.value) == 'num' ? `str(${value})` : m?.returns == '數字' && m.returnsFloat && !s.round && !isFloat(s.value) ? `float(${value})` : value;
        emit(depth, `return ${conv}`);
        break;
      }
    }
  };
  /** for 迴圈裡面：迴圈的變數是什麼型別 */
  const withLoopVar = (name: string, info: VarInfo, f: () => void) => {
    const saved = vars.get(name);
    vars.set(name, info);
    f();
    if (saved) vars.set(name, saved);
    else vars.delete(name);
  };

  /** 變數一開始的值（Python 不用宣告型別，但要先有值） */
  const initLine = (v: VarInfo, pad: string) => {
    switch (v.type) {
      case '清單': case '陣列': case '堆疊': case '二維清單': case '優先佇列': case '優先佇列小': return `${pad}${v.name} = []`;
      case '佇列':
        uses.deque = true;
        return `${pad}${v.name} = deque()`;
      case '集合': return `${pad}${v.name} = set()`;
      case '對應表': return `${pad}${v.name} = {}`;
      case '結構': {
        const s = findStruct(v.init);
        const values = (s?.fields ?? []).map(f => {
          const x = (v.fieldInit?.[f.name] ?? '').trim();
          return f.type == '文字' ? JSON.stringify(stripQuotes(x)) : x || '0';
        });
        return `${pad}${v.name} = (${values.join(', ')})`;
      }
      case '文字': return `${pad}${v.name} = ${JSON.stringify(stripQuotes(v.init))}`;
      default: {
        const x = v.init.trim() || '0';
        return `${pad}${v.name} = ${v.float && /^-?\d+$/.test(x) ? x + '.0' : x}`;
      }
    }
  };

  /** 模組裡改到主流程的變數（存值，不是改其中一項）：要寫 global */
  const assignedNames = (list: Stmt[]): string[] => list.flatMap(s => {
    if (s.kind == 'input' && s.place == 'var') return splitArgs(s.target);
    if (s.kind == 'rect' && (s.action == '設為' || s.action == '建立')) return [s.target];
    if (s.kind == 'if') return [...assignedNames(s.yes), ...assignedNames(s.no)];
    if (s.kind == 'eof') return [...splitArgs(s.target), ...assignedNames(s.body)];
    if (s.kind == 'repeat' || s.kind == 'until' || s.kind == 'for' || s.kind == 'range' || s.kind == 'each') return assignedNames(s.body);
    return [];
  });

  const functions = modules.flatMap(m => {
    enter(m);
    const own = new Set([...m.params.map(p => p.name), ...localsOf(m).map(v => v.name)]);
    const globals = [...new Set(assignedNames(m.body))].filter(n => !own.has(n) && mainVars.has(n));
    stmts(m.body, 1);
    const code = lines.splice(0);
    const locals = localsOf(m).map(v => initLine(v, INDENT));
    return [
      `def ${m.name}(${m.params.map(p => p.name).join(', ')}):`,
      ...(globals.length ? [`${INDENT}global ${globals.join(', ')}  # ${t('改的是主流程的變數', 'changes main-flow variables')}`] : []),
      ...locals,
      ...(code.length || locals.length ? code : [`${INDENT}pass`]),
      '',
      '',
    ];
  });
  enter(null);
  stmts(program, 0);
  const body = lines.splice(0);
  const decls = varList.map(v => initLine(v, ''));

  // 模組自己執行自己（或互相執行）：遞迴。Python 預設最多大約 1000 層，很深的時候要調大
  const callsOf = (list: Stmt[]): string[] => list.flatMap(s => {
    const inExpr = (e: Expr | undefined): string[] => {
      if (!e) return [];
      switch (e.t) {
        case 'fcall': return [e.name, ...e.args.flatMap(inExpr)];
        case 'bin': return [...inExpr(e.a), ...inExpr(e.b)];
        case 'not': case 'neg': return inExpr(e.a);
        case 'call': return e.args.flatMap(inExpr);
        case 'method': return [...inExpr(e.obj), ...e.args.flatMap(inExpr)];
        case 'idx': return [...inExpr(e.obj), ...inExpr(e.index)];
        case 'chain': case 'brace': case 'list': return e.items.flatMap(inExpr);
        default: return [];
      }
    };
    switch (s.kind) {
      case 'call': return [s.name, ...s.args.flatMap(inExpr)];
      case 'rect': return [...inExpr(s.value), ...inExpr(s.index)];
      case 'return': return inExpr(s.value);
      case 'output': return inExpr(s.value);
      case 'if': return [...inExpr(s.cond), ...callsOf(s.yes), ...callsOf(s.no)];
      case 'until': return [...inExpr(s.cond), ...callsOf(s.body)];
      case 'repeat': case 'for': case 'range': case 'each': case 'eof': return callsOf(s.body);
      default: return [];
    }
  });
  const recursive = modules.some(m => {
    // 從 m 出發，走得回 m 嗎
    const seen = new Set<string>();
    const walk = (name: string): boolean => {
      for (const c of callsOf(modules.find(x => x.name == name)?.body ?? [])) {
        if (c == m.name) return true;
        if (!seen.has(c)) { seen.add(c); if (walk(c)) return true; }
      }
      return false;
    };
    return walk(m.name);
  });

  const head: string[] = [];
  if (options.fastInput || recursive || usesStdin) head.push('import sys');
  if (uses.deque) head.push('from collections import deque');
  if (uses.heapq) head.push('from heapq import heappush, heappop');
  if (uses.math) head.push('import math');
  if (options.fastInput) head.push('', `# ${t('大測資：用 sys.stdin 讀一行，比 input() 快很多', 'Big input: sys.stdin reads a line much faster than input()')}`, 'input = lambda: sys.stdin.readline().rstrip("\\n")');
  if (recursive) head.push('', `# ${t('遞迴：Python 預設最多大約 1000 層，調大才不會出錯', 'Recursion: Python allows about 1000 levels by default; raise the limit')}`, 'sys.setrecursionlimit(100000)');
  if (head.length) head.push('', '');
  return [...head, ...functions, ...(decls.length ? [...decls, ''] : []), ...body, ''].join('\n');
}

const stripQuotes = (s: string) => {
  const v = s.trim();
  return /^(".*"|'.*')$/.test(v) ? v.slice(1, -1) : v;
};
