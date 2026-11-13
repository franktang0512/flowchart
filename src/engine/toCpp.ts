// 「看程式」：流程圖的結構 → C++（學習目標是 C++ 時，清單的索引從 0 開始，所以位置直接照抄）。
// 給學生看「流程圖怎麼變成程式」，以好讀為主：型別照第三步學生選的 int / float / string，清單用 vector。
import { t } from '../i18n';
import { cppType, elemCppType } from './modules';
import { exprType, fieldOf, isContainerType, parseExpr, type Expr, type ExprType, type ModuleProgram, type Stmt, type VarInfo } from './structure';
import { fieldCppType, findStruct, getStructs } from './structs';

const INDENT = '    ';

/** 運算子的優先順序（數字越大越先算），決定要不要加括號 */
const PREC: Record<string, number> = {
  or: 1, and: 2, '==': 3, '!=': 3, '<': 4, '<=': 4, '>': 4, '>=': 4, '+': 5, '-': 5, '*': 6, '/': 6, '%': 6,
};
const CPP_OP: Record<string, string> = { or: '||', and: '&&' };
/** 「重複直到」要寫成 while (不成立)：比較可以直接換成相反的符號 */
const NEGATE: Record<string, string> = { '==': '!=', '!=': '==', '<': '>=', '<=': '>', '>': '<=', '>=': '<' };

export function toCpp(program: Stmt[], varList: VarInfo[], modules: ModuleProgram[] = []): string {
  // main 看得到全域變數和自己的變數（同名時用自己的）；模組只看得到全域變數
  const globalOnly = varList.filter(v => v.global);
  const globals = new Map([...globalOnly, ...varList.filter(v => !v.global)].map(v => [v.name, v]));
  /** 模組的區域變數（寫在函式裡面） */
  const localsOf = (m: ModuleProgram): VarInfo[] => (m.locals ?? []).filter(v => v.name.trim() != '').map(v => ({ name: v.name.trim(), type: v.type, init: v.init, float: v.float, long: v.long, size: v.size, fieldInit: v.fieldInit }));
  /** 目前寫到的地方看得到的變數：主程式是變數表；模組裡再加上參數和區域變數 */
  let vars = globals;
  /** 目前寫到哪個模組（null 是主程式） */
  let current: ModuleProgram | null = null;
  const enter = (m: ModuleProgram | null) => {
    current = m;
    vars = m ? new Map([...globalOnly.map(v => [v.name, v] as const), ...m.params.map(p => [p.name, { name: p.name, type: p.type, init: '', float: p.float, long: p.long } as VarInfo] as const), ...localsOf(m).map(v => [v.name, v] as const)]) : globals;
  };
  /** 全部的變數（全域＋各模組的區域變數；名字不會重複，執行時會擋） */
  const allVars = [...varList, ...modules.flatMap(localsOf)];
  /** 傳給模組的值：文字參數傳數字進去要先變成文字 */
  const argCode = (name: string, a: Expr, k: number) => {
    const p = modules.find(x => x.name == name)?.params[k];
    return p?.type == '文字' && typeOf(a) != 'str' ? strPart(a, false) : expr(a);
  };
  // 用到哪些東西：最後只 #include 有用到的
  const uses = { indexOf: false, indexOfArray: false, inputNumber: false, inputLong: false, inputFloat: false, inputText: false, cmath: false, string: false, sort: false, greater: false };
  /** 排序 struct 用的比較函式：名稱 → 程式 */
  const comparators = new Map<string, string[]>();
  const typeOfVar = (name: string) => (vars.get(name) ?? allVars.find(v => v.name == name))?.type;

  /** 清單裡裝什麼：學生在第三步選的 int / float / string */
  const elemType = (list: string) => {
    // 裝 struct：型別就是 struct 的名稱，例如 vector<Edge>；long long 也可以
    return elemCppType((vars.get(list) ?? allVars.find(v => v.name == list))?.init);
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
        if (e.obj.t == 'var') return (vars.get(e.obj.name)?.type == '清單' || vars.get(e.obj.name)?.type == '陣列') && isIntType(elemType(e.obj.name));
        return e.obj.t == 'idx' && e.obj.obj.t == 'var' && vars.get(e.obj.obj.name)?.type == '二維清單' && isIntType(elemType(e.obj.obj.name));
      case 'call':
        if (e.fn == 'max' || e.fn == 'min') return e.args.length == 1 ? e.args[0].t == 'var' && isIntType(elemType(e.args[0].name)) : e.args.every(isInt);
        return e.fn == 'len' || e.fn == 'find' || e.fn == 'stoi';
      case 'method': return e.name == 'size' || e.name == 'length' || (e.name != 'empty' && e.name != 'substr' && e.obj.t == 'var' && isIntType(elemType(e.obj.name)));
      case 'field': {
        const f = fieldOf(e, vars);
        return f?.type == '數字' && !f.float;
      }
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

  /** int 和 long long 都是整數 */
  function isIntType(type: string) {
    return type == 'int' || type == 'long long';
  }

  /** 運算式 → C++；parent 是外層運算子的優先順序 */
  const expr = (e: Expr, parent = 0): string => {
    switch (e.t) {
      case 'num': return e.v;
      case 'str': return JSON.stringify(e.v);
      case 'var': return e.name;
      case 'raw': return `/* ${e.text} */`;
      case 'idx': return `${expr(e.obj, 9)}[${expr(e.index)}]`;
      case 'method': return `${expr(e.obj, 9)}.${e.name}(${e.args.map(a => expr(a)).join(', ')})`;
      case 'field': return `${expr(e.obj, 9)}.${e.name}`;
      case 'fcall': return `${e.name}(${e.args.map((a, k) => argCode(e.name, a, k)).join(', ')})`;
      case 'neg': return `-${expr(e.a, 7)}`;
      case 'not': return `!${expr(e.a, 7)}`;
      case 'call': {
        const [a, b] = e.args;
        if (!a) return '0';
        // max(a, b)；三個以上是 max({a, b, c})；max(v) 是 *max_element(v.begin(), v.end())（array：a, a + 大小）
        if (e.fn == 'max' || e.fn == 'min') {
          uses.sort = true;
          if (e.args.length == 1) {
            const v = a.t == 'var' ? vars.get(a.name) ?? allVars.find(x => x.name == a.name) : undefined;
            const range = v?.type == '陣列' ? `${a.t == 'var' ? a.name : expr(a, 9)}, ${expr(a, 9)} + ${v.size?.trim() || '0'}` : `${expr(a, 9)}.begin(), ${expr(a, 9)}.end()`;
            return `*${e.fn}_element(${range})`;
          }
          const args = e.args.map(x => expr(x)).join(', ');
          return e.args.length == 2 ? `${e.fn}(${args})` : `${e.fn}({${args}})`;
        }
        // 文字變整數、數字變文字
        if (e.fn == 'stoi' || e.fn == 'tostr') {
          uses.string = true;
          return `${e.fn == 'stoi' ? 'stoi' : 'to_string'}(${expr(a)})`;
        }
        const isText = typeOf(a) == 'str';
        // array 沒有 size()：大小就是宣告時寫的數字
        const array = a.t == 'var' && typeOfVar(a.name) == '陣列' ? (vars.get(a.name) ?? allVars.find(v => v.name == a.name)) : undefined;
        if (e.fn == 'len') return array ? (array.size?.trim() || '0') : `${expr(a, 9)}.${isText ? 'length' : 'size'}()`;
        if (!b) return '0';
        if (isText) {
          uses.string = true;
          return e.fn == 'find' ? `(int) ${expr(a, 9)}.find(${expr(b)})` : wrap(`${expr(a, 9)}.find(${expr(b)}) != string::npos`, 3, parent);
        }
        // 在 array 裡找要另一個版本的 indexOf（不用 vector）
        if (array) uses.indexOfArray = true;
        else uses.indexOf = true;
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
        const container = v?.type == '堆疊' || v?.type == '佇列';
        if (v?.type != '清單' && v?.type != '陣列' && !container) {
          emit(depth, `cin >> ${s.target};`);
          break;
        }
        if (s.place == 'replace') {
          emit(depth, `cin >> ${s.target}[${expr(s.index!)}];`);
          break;
        }
        // 輸入到清單：先讀進暫存的變數，再放進 vector
        // （裝 struct 的容器不能直接輸入一整筆，對話框只給輸入到某個欄位）
        const tmp = ({ string: 'inputText', float: 'inputFloat', int: 'inputNumber', 'long long': 'inputLong' } as const)[elemType(s.target) as 'string' | 'float' | 'int' | 'long long'] ?? 'inputNumber';
        uses[tmp] = true;
        emit(depth, `cin >> ${tmp};`);
        emit(depth, container ? `${s.target}.push(${tmp});`
          : s.place == 'insert' ? `${s.target}.insert(${s.target}.begin() + ${expr(s.index!, 5)}, ${tmp});` : `${s.target}.push_back(${tmp});`);
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
        if (typeOf(s.value) == 'struct' || (s.value.t == 'var' && findStruct(vars.get(s.value.name)?.init) && isContainerType(vars.get(s.value.name)?.type))) {
          emit(depth, `// ${t('struct 不能整筆輸出，請一個欄位一個欄位輸出', 'A struct cannot be printed. Print one field at a time.')}`);
          break;
        }
        // 整個 stack、queue：不能用 for 一個一個看，要複製一份，一個一個拿出來
        const kind = s.value.t == 'var' ? vars.get(s.value.name)?.type : undefined;
        if (s.value.t == 'var' && (kind == '堆疊' || kind == '佇列')) {
          const name = s.value.name;
          const cppKind = kind == '堆疊' ? 'stack' : 'queue';
          emit(depth, `for (${cppKind}<${elemType(name)}> copy = ${name}; !copy.empty(); copy.pop()) cout << copy.${kind == '堆疊' ? 'top' : 'front'}() << " ";`);
          emit(depth, 'cout << endl;');
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
            const target = parseExpr(s.target);
            const textField = target.t == 'field' && fieldOf(target, vars)?.type == '文字';
            const numToText = (v?.type == '文字' || textField) && s.value && typeOf(s.value) == 'num';
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
            // 0 行：每一列先是空的（鄰接串列，之後再 g[u].push_back(v)）
            const empty = s.index2?.t == 'num' && Number(s.index2.v) == 0;
            emit(depth, empty
              ? `${s.target}.assign(${expr(s.index!)}, vector<${elemType(s.target)}>());`
              // 裝 struct：每一格是一筆全部是 0 的 struct（vector<Edge>(c) 就會這樣）
              : findStruct(elemType(s.target)) ? `${s.target}.assign(${expr(s.index!)}, vector<${elemType(s.target)}>(${expr(s.index2!)}));`
              : `${s.target}.assign(${expr(s.index!)}, vector<${elemType(s.target)}>(${expr(s.index2!)}, ${text ? '""' : '0'}));`);
            break;
          }
          case '刪除': emit(depth, `${s.target}.erase(${s.target}.begin() + ${at});`); break;
          case '清空': emit(depth, `${s.target}.clear();`); break;
          case '放入': emit(depth, `${s.target}.push(${value});`); break;
          case '取出': emit(depth, `${s.target}.pop();`); break;
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
      case 'sort': {
        // vector：sort(v.begin(), v.end())；array：sort(a, a + n)；只排前 n 個：v.begin() + n
        uses.sort = true;
        const v = vars.get(s.target) ?? allVars.find(x => x.name == s.target);
        const elem = elemType(s.target);
        const isArray = v?.type == '陣列';
        const n = s.count ? expr(s.count, 5) : isArray ? (v?.size?.trim() || '0') : '';
        const range = isArray ? `${s.target}, ${s.target} + ${n}` : `${s.target}.begin(), ${s.count ? `${s.target}.begin() + ${n}` : `${s.target}.end()`}`;
        if (s.keys?.length) {
          // struct 依欄位排：寫一個比較函式，前面的欄位不一樣就比前面的，一樣才比下一個；
          // 用 stable_sort，全部一樣大的照原本的順序（跟流程圖執行的結果一樣）
          const keys = s.keys;
          const name = 'by_' + keys.map(k => `${k.field}${k.desc ? '_desc' : ''}`).join('_');
          const op = (desc: boolean) => (desc ? '>' : '<');
          const dir = (desc: boolean) => (desc ? t('由大到小', 'large to small') : t('由小到大', 'small to large'));
          if (!comparators.has(name)) {
            comparators.set(name, [
              `// ${t(`排序 ${elem} 用：`, `Sort ${elem}: `)}${keys.map(k => `${k.field} ${dir(k.desc)}`).join(t('，一樣大再比 ', ', then '))}`,
              `bool ${name}(${elem} a, ${elem} b) {`,
              ...keys.slice(0, -1).map(k => `${INDENT}if (a.${k.field} != b.${k.field}) return a.${k.field} ${op(k.desc)} b.${k.field};`),
              `${INDENT}return a.${keys[keys.length - 1].field} ${op(keys[keys.length - 1].desc)} b.${keys[keys.length - 1].field};`,
              '}',
              '',
            ]);
          }
          emit(depth, `stable_sort(${range}, ${name});`);
        }
        else {
          if (s.desc) uses.greater = true;
          emit(depth, `sort(${range}${s.desc ? `, greater<${elem}>()` : ''});`);
        }
        break;
      }
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
  const paramCode = (m: ModuleProgram) => m.params.map(p => `${cppType(p.type, p.float, p.long)} ${p.name}`).join(', ');
  /** 函式的回傳型別：沒有回傳值是 void */
  const retType = (m: ModuleProgram) => (m.returns ? cppType(m.returns, m.returnsFloat, m.returnsLong) : 'void');
  const declLine = (v: VarInfo, pad: string) => {
    if (v.type == '清單') return `${pad}vector<${elemType(v.name)}> ${v.name};`;
    if (v.type == '二維清單') return `${pad}vector<vector<${elemType(v.name)}>> ${v.name};`;
    // array：每一格先放 0（string 本來就是空的）
    if (v.type == '陣列') return `${pad}${elemType(v.name)} ${v.name}[${v.size?.trim() || '0'}]${elemType(v.name) == 'string' ? '' : ' = {}'};`;
    if (v.type == '堆疊') return `${pad}stack<${elemType(v.name)}> ${v.name};`;
    // struct 變數：每個欄位先是 0（string 是空的）
    if (v.type == '結構') {
      // 有填欄位初始值：照欄位的順序寫，沒填的是 0（string 是 ""）
      const s = findStruct(v.init);
      const filled = s && s.fields.some(f => (v.fieldInit?.[f.name] ?? '').trim() != '');
      if (!s || !filled) return `${pad}${v.init} ${v.name} = {};`;
      const values = s.fields.map(f => {
        const x = (v.fieldInit?.[f.name] ?? '').trim();
        if (f.type == '文字') return JSON.stringify(stripQuotes(x));
        return x || '0';
      });
      return `${pad}${v.init} ${v.name} = {${values.join(', ')}};`;
    }
    if (v.type == '佇列') return `${pad}queue<${elemType(v.name)}> ${v.name};`;
    if (v.type == '文字') return `${pad}string ${v.name} = ${JSON.stringify(stripQuotes(v.init))};`;
    return `${pad}${cppType('數字', v.float, v.long)} ${v.name} = ${v.init.trim() || '0'};`;
  };
  const tmpNote = t('輸入到清單時先暫存在這裡', 'input goes here first, then into the list');
  /** 輸入到清單用的暫存變數：哪個函式（或 main）用到就宣告在那裡 */
  const tmpDecls = (code: string[], pad: string) => [
    ...(code.some(l => l.includes("inputNumber")) ? [`${pad}int inputNumber;   // ${tmpNote}`] : []),
    ...(code.some(l => l.includes("inputLong")) ? [`${pad}long long inputLong;  // ${tmpNote}`] : []),
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

  // 主流程的變數宣告在 main 裡面；勾了「全域」的宣告在 main 外面（每個函式都用得到）
  const decls = [...varList.filter(v => !v.global).map(v => declLine(v, INDENT)), ...tmpDecls(body, INDENT)];
  const globalDecls = varList.filter(v => v.global).map(v => declLine(v, ''));

  // 用到才 #include：文字變數、裝文字的容器或用到 string 的寫法才要 <string>；有 vector 才要 <vector>；stack、queue 也一樣
  const isList = (v: VarInfo) => v.type == '清單' || v.type == '二維清單';
  const holdsText = (v: VarInfo) => isContainerType(v.type) && elemType(v.name) == 'string';
  const structs = getStructs();
  const needString = uses.string || allVars.some(v => v.type == '文字' || holdsText(v)) || structs.some(s => s.fields.some(f => f.type == '文字'));
  const needVector = uses.indexOf || allVars.some(isList);
  const head = ['#include <iostream>'];
  if (needString) head.push('#include <string>');
  if (needVector) head.push('#include <vector>');
  if (allVars.some(v => v.type == '堆疊')) head.push('#include <stack>');
  if (allVars.some(v => v.type == '佇列')) head.push('#include <queue>');
  if (uses.cmath) head.push('#include <cmath>');
  if (uses.sort) head.push('#include <algorithm>');
  if (uses.greater) head.push('#include <functional>');
  head.push('using namespace std;', '');
  // 學生定義的 struct：寫在最前面，後面的函式和 main 才能用
  for (const s of structs) {
    head.push(`struct ${s.name} {`, ...s.fields.map(f => `${INDENT}${fieldCppType(f)} ${f.name};`), '};', '');
  }
  // 排序 struct 用的比較函式
  for (const lines of comparators.values()) head.push(...lines);
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
  if (uses.indexOfArray) {
    head.push(
      '// ' + t('在 array 裡找 x，回傳它的索引；找不到回傳 -1', 'Find x in the array. Return its index, or -1 if it is not there.'),
      'template <typename T, int N, typename U>',
      'int indexOf(const T (&list)[N], const U& x) {',
      `${INDENT}for (int i = 0; i < N; i++) {`,
      `${INDENT}${INDENT}if (list[i] == x) return i;`,
      `${INDENT}}`,
      `${INDENT}return -1;`,
      '}',
      '',
    );
  }
  if (globalDecls.length) head.push('// ' + t('全域變數：main 和每個函式都用得到', 'Global variables: main and every function can use them'), ...globalDecls, '');
  // 模組之間互相執行時，要先宣告才能用
  const protos = modules.length > 1 ? [...modules.map(m => `${retType(m)} ${m.name}(${paramCode(m)});`), ''] : [];
  return [...head, ...protos, ...functions, 'int main() {', ...decls, ...(decls.length ? [''] : []), ...body, `${INDENT}return 0;`, '}', ''].join('\n');
}

const stripQuotes = (s: string) => {
  const v = s.trim();
  return /^(".*"|'.*')$/.test(v) ? v.slice(1, -1) : v;
};
