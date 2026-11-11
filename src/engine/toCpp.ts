// 「看程式」：流程圖的結構 → C++（學習目標是 C++ 時，清單的索引從 0 開始，所以位置直接照抄）。
// 給學生看「流程圖怎麼變成程式」，以好讀為主：數字變數用 int，會算出小數的才用 double，清單用 vector。
import { t } from '../i18n';
import { exprType, type Expr, type ExprType, type ModuleProgram, type Stmt, type VarInfo } from './structure';

const INDENT = '    ';
const paramKey = (m: string, p: string) => m + '\u0000' + p;

/** 運算子的優先順序（數字越大越先算），決定要不要加括號 */
const PREC: Record<string, number> = {
  or: 1, and: 2, '==': 3, '!=': 3, '<': 4, '<=': 4, '>': 4, '>=': 4, '+': 5, '-': 5, '*': 6, '/': 6, '%': 6,
};
const CPP_OP: Record<string, string> = { or: '||', and: '&&' };
/** 「重複直到」要寫成 while (不成立)：比較可以直接換成相反的符號 */
const NEGATE: Record<string, string> = { '==': '!=', '!=': '==', '<': '>=', '<=': '>', '>': '<=', '>=': '<' };

export function toCpp(program: Stmt[], varList: VarInfo[], modules: ModuleProgram[] = []): string {
  const globals = new Map(varList.map(v => [v.name, v]));
  /** 目前寫到的地方看得到的變數：主程式是變數表；模組裡再加上參數 */
  let vars = globals;
  /** 目前寫到哪個模組（null 是主程式） */
  let current: ModuleProgram | null = null;
  const enter = (m: ModuleProgram | null) => {
    current = m;
    vars = m ? new Map([...globals, ...m.params.map(p => [p.name, { name: p.name, type: p.type, init: '' } as VarInfo] as const)]) : globals;
  };
  const doubles = findDoubles([program, ...modules.map(m => m.body)], varList);
  /** 數字參數有沒有被傳過小數（有的話用 double） */
  const paramDouble = new Set<string>();
  /** 回傳數字的模組，回傳值會不會有小數（有的話回傳 double） */
  const returnDouble = new Set<string>();
  /** 傳給模組的值：文字參數傳數字進去要先變成文字 */
  const argCode = (name: string, a: Expr, k: number) => {
    const p = modules.find(x => x.name == name)?.params[k];
    return p?.type == '文字' && typeOf(a) != 'str' ? strPart(a, false) : expr(a);
  };
  // 用到哪些東西：最後只 #include 有用到的
  const uses = { indexOf: false, inputNumber: false, inputText: false, cmath: false, string: false };

  /** 數字變數是 int 還是 double */
  const numType = (name: string) => (doubles.has(name) ? 'double' : 'int');
  const elemType = (list: string) => (vars.get(list)?.init == '文字' ? 'string' : 'int');
  const typeOf = (e: Expr): ExprType => exprType(e, vars, modules);
  const paramOf = (name: string) => (current as ModuleProgram | null)?.params.find(p => p.name == name);
  /** 運算式是不是整數（決定 / 要不要先轉成小數） */
  const isInt = (e: Expr): boolean => {
    switch (e.t) {
      case 'num': return !e.v.includes('.');
      case 'var': {
        const p = paramOf(e.name);
        if (p) return p.type == '數字' && !paramDouble.has(paramKey(current!.name, p.name));
        return vars.get(e.name)?.type == '數字' && !doubles.has(e.name);
      }
      case 'idx':
        // 清單的一項、二維清單的一格（只取一個 [ ] 的二維清單是一整列，不是數字）
        if (e.obj.t == 'var') return vars.get(e.obj.name)?.type == '清單' && elemType(e.obj.name) == 'int';
        return e.obj.t == 'idx' && e.obj.obj.t == 'var' && vars.get(e.obj.obj.name)?.type == '二維清單' && elemType(e.obj.obj.name) == 'int';
      case 'call': return true;
      case 'fcall': {
        const m = modules.find(x => x.name == e.name);
        return m?.returns == '數字' && !returnDouble.has(m.name);
      }
      case 'neg': return isInt(e.a);
      case 'bin': return ['+', '-', '*', '%'].includes(e.op) && isInt(e.a) && isInt(e.b);
      default: return false;
    }
  };

  /** 運算式 → C++；parent 是外層運算子的優先順序 */
  const expr = (e: Expr, parent = 0): string => {
    switch (e.t) {
      case 'num': return e.v;
      case 'str': return JSON.stringify(e.v);
      case 'var': return e.name;
      case 'raw': return `/* ${e.text} */`;
      case 'idx': return `${expr(e.obj, 9)}[${expr(e.index)}]`;
      case 'fcall': return `${e.name}(${e.args.map((a, k) => argCode(e.name, a, k)).join(', ')})`;
      case 'neg': return `-${expr(e.a, 7)}`;
      case 'not': return `!${expr(e.a, 7)}`;
      case 'call': {
        const [a, b] = e.args;
        if (!a) return '0';
        const isText = typeOf(a) == 'str';
        if (e.fn == 'len') return `${expr(a, 9)}.${isText ? 'length' : 'size'}()`;
        if (!b) return '0';
        if (isText) {
          uses.string = true;
          return e.fn == 'find' ? `(int) ${expr(a, 9)}.find(${expr(b)})` : wrap(`${expr(a, 9)}.find(${expr(b)}) != string::npos`, 3, parent);
        }
        uses.indexOf = true;
        return e.fn == 'find' ? `indexOf(${expr(a)}, ${expr(b)})` : wrap(`indexOf(${expr(a)}, ${expr(b)}) != -1`, 3, parent);
      }
      case 'bin': {
        const p = PREC[e.op];
        const ta = typeOf(e.a), tb = typeOf(e.b);
        // 文字跟文字接起來：左邊是 "..." 的話要先變成 string，數字要用 to_string
        if (e.op == '+' && (ta == 'str' || tb == 'str')) {
          return wrap(`${strPart(e.a, true)} + ${strPart(e.b, false)}`, p, parent);
        }
        // 文字的一個字（char）跟 "a" 比較：寫成 'a'
        if ((e.op == '==' || e.op == '!=') && (ta == 'char' || tb == 'char')) {
          return wrap(`${charSide(e.a)} ${e.op} ${charSide(e.b)}`, p, parent);
        }
        // 整數除以整數在 C++ 會捨去小數，流程圖裡不會，所以先轉成 double
        if (e.op == '/' && isInt(e.a) && isInt(e.b)) {
          return wrap(`(double) ${expr(e.a, 7)} / ${expr(e.b, p + 1)}`, p, parent);
        }
        if (e.op == '%' && !(isInt(e.a) && isInt(e.b))) {
          uses.cmath = true;
          return `fmod(${expr(e.a)}, ${expr(e.b)})`;
        }
        const op = CPP_OP[e.op] ?? e.op;
        return wrap(`${expr(e.a, p)} ${op} ${expr(e.b, p + 1)}`, p, parent);
      }
    }
  };
  const wrap = (code: string, p: number, parent: number) => (p < parent ? `(${code})` : code);
  /** 接文字的一邊 */
  const strPart = (e: Expr, left: boolean) => {
    const ty = typeOf(e);
    uses.string = true;
    if (ty == 'num') return `to_string(${expr(e)})`;
    if (ty == 'char') return `string(1, ${expr(e)})`;
    if (left && e.t == 'str') return `string(${expr(e)})`;
    return expr(e, 6);
  };
  const charSide = (e: Expr) => (e.t == 'str' && e.v.length == 1 ? `'${e.v == "'" ? "\\'" : e.v}'` : expr(e, 4));

  /** 條件；negate 時寫成相反的條件（給「重複直到」用） */
  const cond = (e: Expr, negate = false): string => {
    if (!negate) return expr(e);
    if (e.t == 'not') return expr(e.a);
    if (e.t == 'bin' && NEGATE[e.op]) return expr({ ...e, op: NEGATE[e.op] });
    return `!(${expr(e)})`;
  };

  /** 輸出：文字用 + 接起來的，改成一段一段 << */
  const outputParts = (e: Expr): Expr[] => (e.t == 'bin' && e.op == '+' && exprType(e, vars, modules) == 'str' ? [...outputParts(e.a), ...outputParts(e.b)] : [e]);

  const lines: string[] = [];
  const emit = (depth: number, line: string) => lines.push(INDENT.repeat(depth) + line);
  const loopNames: string[] = [];
  /** 次數迴圈的計數變數：i、j、k…，不跟變數表的名字或外層迴圈重複 */
  const counterName = () => {
    const taken = (n: string) => vars.has(n) || loopNames.includes(n);
    for (const n of ['i', 'j', 'k', 'm', 'n']) if (!taken(n)) return n;
    let k = 1;
    while (taken('count' + k)) k++;
    return 'count' + k;
  };
  const rounded = (round: string, code: string) => {
    if (!round) return code;
    uses.cmath = true;
    return `${round.replace('Math.', '')}(${code})`;
  };

  const stmts = (list: Stmt[], depth: number) => list.forEach(s => stmt(s, depth));
  const stmt = (s: Stmt, depth: number) => {
    switch (s.kind) {
      case 'input': {
        const v = vars.get(s.target);
        if (v?.type == '二維清單' && s.index && s.index2) {
          emit(depth, `cin >> ${s.target}[${expr(s.index)}][${expr(s.index2)}];`);
          break;
        }
        if (v?.type != '清單') {
          emit(depth, `cin >> ${s.target};`);
          break;
        }
        if (s.place == 'replace') {
          emit(depth, `cin >> ${s.target}[${expr(s.index!)}];`);
          break;
        }
        // 輸入到清單：先讀進暫存的變數，再放進 vector
        const tmp = elemType(s.target) == 'string' ? 'inputText' : 'inputNumber';
        if (tmp == 'inputText') uses.inputText = true;
        else uses.inputNumber = true;
        emit(depth, `cin >> ${tmp};`);
        emit(depth, s.place == 'insert' ? `${s.target}.insert(${s.target}.begin() + ${expr(s.index!, 5)}, ${tmp});` : `${s.target}.push_back(${tmp});`);
        break;
      }
      case 'output': {
        // 整個二維清單：一列一行
        if (s.value.t == 'var' && vars.get(s.value.name)?.type == '二維清單') {
          emit(depth, `for (auto row : ${s.value.name}) {`);
          emit(depth + 1, 'for (auto item : row) cout << item << " ";');
          emit(depth + 1, 'cout << endl;');
          emit(depth, '}');
          break;
        }
        if (typeOf(s.value) == 'list') {
          emit(depth, `for (auto item : ${expr(s.value)}) cout << item << " ";`);
          emit(depth, 'cout << endl;');
          break;
        }
        emit(depth, `cout << ${outputParts(s.value).map(p => expr(p, 6)).join(' << ')} << endl;`);
        break;
      }
      case 'rect': {
        const value = s.value ? rounded(s.round, expr(s.value)) : '';
        const at = s.index ? expr(s.index, 5) : '';
        switch (s.action) {
          case '設為': {
            const v = vars.get(s.target);
            const numToText = v?.type == '文字' && s.value && typeOf(s.value) == 'num';
            if (numToText) uses.string = true;
            emit(depth, `${s.target} = ${numToText ? `to_string(${value})` : value};`);
            break;
          }
          case '加入': emit(depth, `${s.target}.push_back(${value});`); break;
          case '插入': emit(depth, `${s.target}.insert(${s.target}.begin() + ${at}, ${value});`); break;
          case '替換': emit(depth, `${s.target}[${expr(s.index!)}]${s.index2 ? `[${expr(s.index2)}]` : ''} = ${value};`); break;
          case '建立': {
            // 二維清單設定大小：r 列，每列 c 格，都先放 0（文字放 ""）
            const text = elemType(s.target) == 'string';
            emit(depth, `${s.target}.assign(${expr(s.index!)}, vector<${elemType(s.target)}>(${expr(s.index2!)}, ${text ? '""' : '0'}));`);
            break;
          }
          case '刪除': emit(depth, `${s.target}.erase(${s.target}.begin() + ${at});`); break;
          case '清空': emit(depth, `${s.target}.clear();`); break;
        }
        break;
      }
      case 'if':
        emit(depth, `if (${cond(s.cond)}) {`);
        stmts(s.yes, depth + 1);
        if (s.no.length) {
          emit(depth, '} else {');
          stmts(s.no, depth + 1);
        }
        emit(depth, '}');
        break;
      case 'repeat': {
        const c = counterName();
        emit(depth, `for (int ${c} = 0; ${c} < ${expr(s.times, 4)}; ${c}++) {`);
        loopNames.push(c);
        stmts(s.body, depth + 1);
        loopNames.pop();
        emit(depth, '}');
        break;
      }
      case 'until':
        emit(depth, `while (${cond(s.cond, true)}) {`);
        stmts(s.body, depth + 1);
        emit(depth, '}');
        break;
      case 'call':
        emit(depth, `${s.name}(${s.args.map((a, k) => argCode(s.name, a, k)).join(', ')});`);
        break;
      case 'return': {
        // 回傳文字的模組回傳數字：先變成文字
        const value = rounded(s.round, expr(s.value));
        const toText = (current as ModuleProgram | null)?.returns == '文字' && typeOf(s.value) == 'num';
        if (toText) uses.string = true;
        emit(depth, `return ${toText ? `to_string(${value})` : value};`);
        break;
      }
    }
  };

  // 每個運算式（含裡面的）都看一次
  const visitExpr = (e: Expr | undefined, f: (e: Expr) => void) => {
    if (!e) return;
    f(e);
    switch (e.t) {
      case 'idx': visitExpr(e.obj, f); visitExpr(e.index, f); break;
      case 'call': case 'fcall': e.args.forEach(a => visitExpr(a, f)); break;
      case 'bin': visitExpr(e.a, f); visitExpr(e.b, f); break;
      case 'not': case 'neg': visitExpr(e.a, f); break;
    }
  };
  const exprsOf = (s: Stmt): Expr[] => {
    switch (s.kind) {
      case 'input': return [s.index, s.index2].filter((x): x is Expr => !!x);
      case 'output': return [s.value];
      case 'rect': return [s.index, s.index2, s.value].filter((x): x is Expr => !!x);
      case 'if': return [s.cond];
      case 'repeat': return [s.times];
      case 'until': return [s.cond];
      case 'call': return s.args;
      case 'return': return [s.value];
    }
  };
  /** 模組裡的每個步驟（包括判斷、迴圈裡面的） */
  const eachStmt = (list: Stmt[], f: (s: Stmt) => void) => list.forEach(s => {
    f(s);
    if (s.kind == 'if') { eachStmt(s.yes, f); eachStmt(s.no, f); }
    if (s.kind == 'repeat' || s.kind == 'until') eachStmt(s.body, f);
  });
  // 先看每個模組的數字參數有沒有被傳過小數、回傳值會不會有小數（模組之間互相用的，要多看幾次）
  const findDoubleTypes = (list: Stmt[]) => eachStmt(list, s => {
    const args = (name: string, list: Expr[]) => modules.find(x => x.name == name)?.params.forEach((p, k) => {
      if (p.type == '數字' && list[k] && !isInt(list[k])) paramDouble.add(paramKey(name, p.name));
    });
    if (s.kind == 'call') args(s.name, s.args);
    exprsOf(s).forEach(e => visitExpr(e, x => { if (x.t == 'fcall') args(x.name, x.args); }));
    const m = current as ModuleProgram | null;
    if (s.kind == 'return' && m?.returns == '數字' && !s.round && !isInt(s.value)) returnDouble.add(m.name);
  });
  for (let pass = 0; pass < 3; pass++) {
    enter(null);
    findDoubleTypes(program);
    for (const m of modules) {
      enter(m);
      findDoubleTypes(m.body);
    }
  }

  // 先寫 main 和各個模組的內容，才知道要不要 cmath、indexOf、暫存變數
  enter(null);
  stmts(program, 1);
  const body = lines.splice(0);
  const paramCode = (m: ModuleProgram) => m.params.map(p => `${p.type == '文字' ? 'string' : paramDouble.has(paramKey(m.name, p.name)) ? 'double' : 'int'} ${p.name}`).join(', ');
  /** 函式的回傳型別：沒有回傳值是 void */
  const retType = (m: ModuleProgram) => (m.returns == '文字' ? 'string' : m.returns == '數字' ? (returnDouble.has(m.name) ? 'double' : 'int') : 'void');
  const functions = modules.flatMap(m => {
    enter(m);
    stmts(m.body, 1);
    if (m.returns == '文字') uses.string = true;
    return [`${retType(m)} ${m.name}(${paramCode(m)}) {`, ...lines.splice(0), '}', ''];
  });
  enter(null);
  if (modules.some(m => m.params.some(p => p.type == '文字'))) uses.string = true;

  // 有模組時，變數表的變數主程式和模組都要用，所以放在 main 外面（全域變數）
  const shared = modules.length > 0;
  const pad = shared ? '' : INDENT;
  const decls = varList.map(v => {
    if (v.type == '清單') return `${pad}vector<${elemType(v.name)}> ${v.name};`;
    if (v.type == '二維清單') return `${pad}vector<vector<${elemType(v.name)}>> ${v.name};`;
    if (v.type == '文字') return `${pad}string ${v.name} = ${JSON.stringify(stripQuotes(v.init))};`;
    return `${pad}${numType(v.name)} ${v.name} = ${v.init.trim() || '0'};`;
  });
  const tmpNote = t('輸入到清單時先暫存在這裡', 'input goes here first, then into the list');
  if (uses.inputNumber) decls.push(`${pad}int inputNumber;   // ${tmpNote}`);
  if (uses.inputText) decls.push(`${pad}string inputText;  // ${tmpNote}`);

  // 有文字變數、裝文字的清單或用到 string 的寫法才要 <string>；有清單才要 <vector>
  const isList = (v: VarInfo) => v.type == '清單' || v.type == '二維清單';
  const needString = uses.string || varList.some(v => v.type == '文字' || (isList(v) && elemType(v.name) == 'string'));
  const needVector = uses.indexOf || varList.some(isList);
  const head = ['#include <iostream>'];
  if (needString) head.push('#include <string>');
  if (needVector) head.push('#include <vector>');
  if (uses.cmath) head.push('#include <cmath>');
  head.push('using namespace std;', '');
  if (uses.indexOf) {
    head.push(
      '// ' + t('在清單裡找 x，回傳它的索引；找不到回傳 -1', 'Find x in the list. Return its index, or -1 if it is not there.'),
      'template <typename T, typename U>',
      'int indexOf(const vector<T>& list, const U& x) {',
      `${INDENT}for (int i = 0; i < list.size(); i++) {`,
      `${INDENT}${INDENT}if (list[i] == x) return i;`,
      `${INDENT}}`,
      `${INDENT}return -1;`,
      '}',
      '',
    );
  }
  if (shared) {
    const globalsPart = decls.length ? ['// ' + t('變數表的變數：主程式和模組都會用到，所以放在 main 外面', 'Variables from the table: main and the modules all use them, so they are outside main'), ...decls, ''] : [];
    // 模組之間互相執行時，要先宣告才能用
    const protos = modules.length > 1 ? [...modules.map(m => `${retType(m)} ${m.name}(${paramCode(m)});`), ''] : [];
    return [...head, ...globalsPart, ...protos, ...functions, 'int main() {', ...body, `${INDENT}return 0;`, '}', ''].join('\n');
  }
  return [...head, 'int main() {', ...decls, ...(decls.length ? [''] : []), ...body, `${INDENT}return 0;`, '}', ''].join('\n');
}

const stripQuotes = (s: string) => {
  const v = s.trim();
  return /^(".*"|'.*')$/.test(v) ? v.slice(1, -1) : v;
};

/** 哪些數字變數要用 double：初始值有小數點，或被設成會算出小數的值（有 / 而且沒有捨去進位） */
function findDoubles(programs: Stmt[][], varList: VarInfo[]): Set<string> {
  const doubles = new Set(varList.filter(v => v.type == '數字' && v.init.includes('.')).map(v => v.name));
  const hasDivide = (e: Expr): boolean => {
    switch (e.t) {
      case 'bin': return e.op == '/' || hasDivide(e.a) || hasDivide(e.b);
      case 'neg': case 'not': return hasDivide(e.a);
      case 'num': return e.v.includes('.');
      case 'var': return doubles.has(e.name);
      default: return false;
    }
  };
  // 重複幾次，讓「用到小數變數算出來的」也跟著變成小數
  for (let pass = 0; pass < 3; pass++) {
    const visit = (list: Stmt[]) => list.forEach(s => {
      if (s.kind == 'rect' && s.action == '設為' && s.value && !s.round && hasDivide(s.value)) doubles.add(s.target);
      if (s.kind == 'if') { visit(s.yes); visit(s.no); }
      if (s.kind == 'repeat' || s.kind == 'until') visit(s.body);
    });
    programs.forEach(visit);
  }
  return doubles;
}
