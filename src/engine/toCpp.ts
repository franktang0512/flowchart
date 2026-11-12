// 「看程式」：流程圖的結構 → C++（學習目標是 C++ 時，清單的索引從 0 開始，所以位置直接照抄）。
// 給學生看「流程圖怎麼變成程式」，以好讀為主：型別照第三步學生選的 int / float / string，清單用 vector。
import { t } from '../i18n';
import { cppType } from './modules';
import { exprType, type Expr, type ExprType, type ModuleProgram, type Stmt, type VarInfo } from './structure';

const INDENT = '    ';

/** 運算子的優先順序（數字越大越先算），決定要不要加括號 */
const PREC: Record<string, number> = {
  or: 1, and: 2, '==': 3, '!=': 3, '<': 4, '<=': 4, '>': 4, '>=': 4, '+': 5, '-': 5, '*': 6, '/': 6, '%': 6,
};
const CPP_OP: Record<string, string> = { or: '||', and: '&&' };
/** 「重複直到」要寫成 while (不成立)：比較可以直接換成相反的符號 */
const NEGATE: Record<string, string> = { '==': '!=', '!=': '==', '<': '>=', '<=': '>', '>': '<=', '>=': '<' };

export function toCpp(program: Stmt[], varList: VarInfo[], modules: ModuleProgram[] = []): string {
  const globals = new Map(varList.map(v => [v.name, v]));
  /** 模組的區域變數（寫在函式裡面） */
  const localsOf = (m: ModuleProgram): VarInfo[] => (m.locals ?? []).filter(v => v.name.trim() != '').map(v => ({ name: v.name.trim(), type: v.type, init: v.init, float: v.float }));
  /** 目前寫到的地方看得到的變數：主程式是變數表；模組裡再加上參數和區域變數 */
  let vars = globals;
  /** 目前寫到哪個模組（null 是主程式） */
  let current: ModuleProgram | null = null;
  const enter = (m: ModuleProgram | null) => {
    current = m;
    vars = m ? new Map([...globals, ...m.params.map(p => [p.name, { name: p.name, type: p.type, init: '', float: p.float } as VarInfo] as const), ...localsOf(m).map(v => [v.name, v] as const)]) : globals;
  };
  /** 全部的變數（全域＋各模組的區域變數；名字不會重複，執行時會擋） */
  const allVars = [...varList, ...modules.flatMap(localsOf)];
  /** 傳給模組的值：文字參數傳數字進去要先變成文字 */
  const argCode = (name: string, a: Expr, k: number) => {
    const p = modules.find(x => x.name == name)?.params[k];
    return p?.type == '文字' && typeOf(a) != 'str' ? strPart(a, false) : expr(a);
  };
  // 用到哪些東西：最後只 #include 有用到的
  const uses = { indexOf: false, inputNumber: false, inputFloat: false, inputText: false, cmath: false, string: false };

  /** 清單裡裝什麼：學生在第三步選的 int / float / string */
  const elemType = (list: string) => {
    const init = (vars.get(list) ?? allVars.find(v => v.name == list))?.init;
    return init == '文字' ? 'string' : init == '小數' ? 'float' : 'int';
  };
  const typeOf = (e: Expr): ExprType => exprType(e, vars, modules);
  const paramOf = (name: string) => (current as ModuleProgram | null)?.params.find(p => p.name == name);
  /** 運算式是不是整數（決定 / 要不要先轉成小數） */
  const isInt = (e: Expr): boolean => {
    switch (e.t) {
      case 'num': return !e.v.includes('.');
      case 'var': {
        const p = paramOf(e.name);
        if (p) return p.type == '數字' && !p.float;
        const v = vars.get(e.name);
        return v?.type == '數字' && !v.float;
      }
      case 'idx':
        // 清單的一項、二維清單的一格（只取一個 [ ] 的二維清單是一整列，不是數字）
        if (e.obj.t == 'var') return vars.get(e.obj.name)?.type == '清單' && elemType(e.obj.name) == 'int';
        return e.obj.t == 'idx' && e.obj.obj.t == 'var' && vars.get(e.obj.obj.name)?.type == '二維清單' && elemType(e.obj.obj.name) == 'int';
      case 'call': return true;
      case 'fcall': {
        const m = modules.find(x => x.name == e.name);
        return m?.returns == '數字' && !m.returnsFloat;
      }
      case 'neg': return isInt(e.a);
      // 整數 / 整數 在 C++ 還是整數（小數去掉），流程圖執行時也一樣
      case 'bin': return ['+', '-', '*', '/', '%'].includes(e.op) && isInt(e.a) && isInt(e.b);
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
        const tmp = ({ string: 'inputText', float: 'inputFloat', int: 'inputNumber' } as const)[elemType(s.target)];
        uses[tmp] = true;
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

  // 先寫 main 和各個模組的內容，才知道要不要 cmath、indexOf、暫存變數
  enter(null);
  stmts(program, 1);
  const body = lines.splice(0);
  const paramCode = (m: ModuleProgram) => m.params.map(p => `${cppType(p.type, p.float)} ${p.name}`).join(', ');
  /** 函式的回傳型別：沒有回傳值是 void */
  const retType = (m: ModuleProgram) => (m.returns ? cppType(m.returns, m.returnsFloat) : 'void');
  const declLine = (v: VarInfo, pad: string) => {
    if (v.type == '清單') return `${pad}vector<${elemType(v.name)}> ${v.name};`;
    if (v.type == '二維清單') return `${pad}vector<vector<${elemType(v.name)}>> ${v.name};`;
    if (v.type == '文字') return `${pad}string ${v.name} = ${JSON.stringify(stripQuotes(v.init))};`;
    return `${pad}${cppType('數字', v.float)} ${v.name} = ${v.init.trim() || '0'};`;
  };
  const tmpNote = t('輸入到清單時先暫存在這裡', 'input goes here first, then into the list');
  /** 輸入到清單用的暫存變數：哪個函式（或 main）用到就宣告在那裡 */
  const tmpDecls = (code: string[], pad: string) => [
    ...(code.some(l => l.includes("inputNumber")) ? [`${pad}int inputNumber;   // ${tmpNote}`] : []),
    ...(code.some(l => l.includes("inputFloat")) ? [`${pad}float inputFloat;  // ${tmpNote}`] : []),
    ...(code.some(l => l.includes("inputText")) ? [`${pad}string inputText;  // ${tmpNote}`] : []),
  ];
  const functions = modules.flatMap(m => {
    enter(m);
    stmts(m.body, 1);
    if (m.returns == '文字') uses.string = true;
    const code = lines.splice(0);
    // 區域變數：寫在函式最上面，每次執行都重新從初始值開始，只有這個函式用得到
    const locals = [...localsOf(m).map(v => declLine(v, INDENT)), ...tmpDecls(code, INDENT)];
    const localPart = locals.length ? [`${INDENT}// ${t('區域變數：只有這個函式裡用得到', 'Local variables: only this function can use them')}`, ...locals, ''] : [];
    return [`${retType(m)} ${m.name}(${paramCode(m)}) {`, ...localPart, ...code, '}', ''];
  });
  enter(null);
  if (modules.some(m => m.params.some(p => p.type == '文字'))) uses.string = true;

  // 主流程的變數一律宣告在 main 裡面（初學先不用全域變數；模組要用的值用參數傳進去、用回傳帶出來）
  const decls = [...varList.map(v => declLine(v, INDENT)), ...tmpDecls(body, INDENT)];

  // 有文字變數、裝文字的清單或用到 string 的寫法才要 <string>；有清單才要 <vector>
  const isList = (v: VarInfo) => v.type == '清單' || v.type == '二維清單';
  const needString = uses.string || allVars.some(v => v.type == '文字' || (isList(v) && elemType(v.name) == 'string'));
  const needVector = uses.indexOf || allVars.some(isList);
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
  // 模組之間互相執行時，要先宣告才能用
  const protos = modules.length > 1 ? [...modules.map(m => `${retType(m)} ${m.name}(${paramCode(m)});`), ''] : [];
  return [...head, ...protos, ...functions, 'int main() {', ...decls, ...(decls.length ? [''] : []), ...body, `${INDENT}return 0;`, '}', ''].join('\n');
}

const stripQuotes = (s: string) => {
  const v = s.trim();
  return /^(".*"|'.*')$/.test(v) ? v.slice(1, -1) : v;
};
