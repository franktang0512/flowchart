// 對話框按「確認」之後：新增或修改積木。檢查條件的順序與舊版相同（會影響跳出哪個提示）。
import type { DialogForm, DialogKind } from './components/NodeDialog';
import { createConnectors } from './engine/connector';
import { checkCall, checkValueType, checkVar, getCodeVar, type VarStore } from './engine/decoder';
import { splitRectangle, splitTarget } from './engine/labels';
import { callText, parseCall, type ModuleInfo } from './engine/modules';
import { parseExpr } from './engine/structure';
import type { Diagram } from './engine/diagram';
import type { FlowNode } from './engine/node';
import { t } from './i18n';

const ROUNDING_TEXT: Record<string, string> = {
  'Math.round': '(取四捨五入)',
  'Math.ceil': '(取無條件進位)',
  'Math.floor': '(取無條件捨去)',
};

const sharedConnectors = createConnectors();

/** 計算積木的文字（格式見 splitRectangle）以及它用到的變數 */
function rectangleText(vars: VarStore, f: DialogForm) {
  const target = f.varSelect ? ' ' + f.varSelect : '';
  // 二維清單的一格：表[列][行]
  const cell = vars.type_var_list.grid.includes(f.varSelect.trim()) ? `[${f.rectIndex.trim()}][${f.rectIndex2.trim()}]` : `[${f.rectIndex}]`;
  let text = f.rectAction == '插入' ? `${target} 在第 ${f.rectIndex} 項插入 ${f.code}`
    : f.rectAction == '替換' ? `${target}${cell} 設為 ${f.code}`
    : f.rectAction == '刪除' ? `${target} 刪除第 ${f.rectIndex} 項`
    : f.rectAction == '清空' ? `${target} 刪除所有項目`
    : f.rectAction == '建立' ? `${target} 建立 ${f.rectIndex.trim()} 列 ${f.rectIndex2.trim()} 行`
    : f.rectAction == '回傳' ? ` 回傳 ${f.code}`
    : `${target} ${f.rectAction} ${f.code}`;
  const nodeVar = getCodeVar(vars, text);
  if (!nodeVar.includes(f.varSelect || '')) nodeVar.push(f.varSelect || '');
  // 刪除沒有值，不用捨去進位
  if (hasValue(f)) text += ROUNDING_TEXT[f.radio] ?? '';
  return { text, nodeVar };
}

/** 接收模組回傳值：變成一般的計算積木「a 設為 aaa(x)」（不捨去進位） */
function receiveForm(f: DialogForm, modules: ModuleInfo[]): DialogForm {
  if (f.rectKind != '接收') return f;
  const m = modules.find(x => x.name == f.moduleName);
  const args = m ? m.params.map((_, k) => (f.moduleArgs[k] ?? '').trim()) : [];
  return { ...f, rectAction: '設為', radio: '', code: callText(f.moduleName, args) };
}

/** 變數「改變」：變成「x 設為 x + 多少」（不捨去進位）；多少是算式時加括號，看程式時轉回「改變」積木 */
function changeForm(f: DialogForm): DialogForm {
  if (f.rectKind != '變數' || !f.varChange) return f;
  const by = f.code.trim();
  const simple = parseExpr(by).t != 'bin';
  return { ...f, rectAction: '設為', radio: '', code: `${f.varSelect.trim()} + ${simple ? by : `(${by})`}` };
}

/** 刪除第幾項、刪除所有項目、建立二維清單不用填值 */
const hasValue = (f: DialogForm) => f.rectAction != '刪除' && f.rectAction != '清空' && f.rectAction != '建立';

function rectangleValid(vars: VarStore, f: DialogForm, modules: ModuleInfo[]) {
  if (!f.rectKind) {
    alert(t('請先選要改什麼：變數還是清單。', 'First choose what to change: a variable or a list.'));
    return false;
  }
  // 接收模組回傳值：模組、參數照「執行模組」的檢查，回傳值的型別要跟變數一樣
  if (f.rectKind == '接收') {
    const m = modules.find(x => x.name == f.moduleName && x.returns);
    if (!m) {
      alert(t('請選一個有回傳值的模組。', 'Choose a module that returns a value.'));
      return false;
    }
    const args = m.params.map((_, k) => (f.moduleArgs[k] ?? '').trim());
    if (!checkCall(vars, modules, m.name, args)) return false;
    if (!f.varSelect.trim()) {
      alert(t('請選回傳值要存到哪個變數。', 'Choose the variable to save the value in.'));
      return false;
    }
    return checkVar(vars, f.varSelect, false) && checkValueType(vars, modules, f.varSelect.trim(), callText(m.name, args), 'var');
  }
  if (f.rectKind == '變數' && f.varChange) {
    const name = f.varSelect.trim();
    if (!checkVar(vars, f.varSelect, false)) return false;
    if (!vars.type_var_list.number.includes(name)) {
      alert(t(`「${name}」不是數字變數：只有數字變數可以「改變」。`, `"${name}" is not a number variable. Only number variables can change by an amount.`));
      return false;
    }
    if (!f.code.trim()) {
      alert(t('請填要加多少。', 'Enter how much to add.'));
      return false;
    }
    return checkVar(vars, f.code, true) && checkValueType(vars, modules, name, f.code, 'var');
  }
  if (f.rectAction == '設為') return checkVar(vars, f.code, true) && checkVar(vars, f.varSelect, false) && checkValueType(vars, modules, f.varSelect.trim(), f.code, 'var');
  if (f.rectAction == '回傳') return checkVar(vars, f.code, true);
  const list = f.varSelect.trim();
  // 二維清單：建立（幾列幾行）、替換一格（第幾列第幾行）
  if (vars.type_var_list.grid.includes(list) && (f.rectAction == '建立' || f.rectAction == '替換')) {
    if (!checkVar(vars, f.rectIndex, true) || !checkVar(vars, f.rectIndex2, true)) return false;
    return !hasValue(f) || (checkVar(vars, f.code, true) && checkValueType(vars, modules, list, f.code, 'item'));
  }
  if (f.rectAction == '建立') {
    alert(t('請選一個二維清單。', 'Choose a 2D list.'));
    return false;
  }
  if (!vars.type_var_list.array.includes(list)) {
    alert(t(`「${list}」不是清單：只有型別是「清單」的變數才能添加、插入、替換或刪除。`, `"${list}" is not a list. Only list variables can add, insert, replace or delete.`));
    return false;
  }
  const needIndex = f.rectAction == '插入' || f.rectAction == '替換' || f.rectAction == '刪除';
  if (needIndex && !checkVar(vars, f.rectIndex, true)) return false;
  return !hasValue(f) || (checkVar(vars, f.code, true) && checkValueType(vars, modules, list, f.code, 'item'));
}

/**
 * 輸入/輸出積木：回傳積木文字，檢查沒過回傳 null。輸入到清單的寫法：
 *   「輸入 清單」添加到最後、「輸入 清單 插入第 k 項」、「輸入 清單[k]」替換第 k 項
 */
function ioText(vars: VarStore, f: DialogForm, modules: ModuleInfo[] = []): string | null {
  if (f.radio == '輸入') {
    // 二維清單的一格：輸入 表[列][行]
    if (f.ioTarget == '二維清單') {
      const text = `${f.varSelect.trim()}[${f.rectIndex.trim()}][${f.rectIndex2.trim()}]`;
      return checkVar(vars, text, false) ? '輸入 ' + text : null;
    }
    if (!checkVar(vars, f.varSelect, false)) return null;
    if (f.ioTarget != '清單' || f.ioPlace == '加入') return '輸入 ' + f.varSelect;
    if (!checkVar(vars, f.rectIndex, true)) return null;
    const k = f.rectIndex.trim();
    return f.ioPlace == '插入' ? `輸入 ${f.varSelect} 插入第 ${k} 項` : `輸入 ${f.varSelect}[${k}]`;
  }
  // 輸出模組回傳值：模組、參數照「執行模組」的檢查
  if (f.outputKind == '回傳') {
    const m = modules.find(x => x.name == f.moduleName && x.returns);
    if (!m) {
      alert(t('請選一個有回傳值的模組。', 'Choose a module that returns a value.'));
      return null;
    }
    const args = m.params.map((_, k) => (f.moduleArgs[k] ?? '').trim());
    return checkCall(vars, modules, m.name, args) ? '輸出 ' + callText(m.name, args) : null;
  }
  if (checkVar(vars, f.varSelectOutput, true)) {
    return f.radio + (f.varSelectOutput ? ' ' + f.varSelectOutput : '');
  }
  return null;
}

/** 執行模組積木的文字「模組名稱(引數, …)」；檢查沒過回傳 null */
function callNodeText(vars: VarStore, modules: ModuleInfo[], f: DialogForm): string | null {
  const m = modules.find(x => x.name == f.moduleName);
  const args = m ? m.params.map((_, k) => (f.moduleArgs[k] ?? '').trim()) : [];
  return checkCall(vars, modules, f.moduleName, args) ? callText(f.moduleName, args) : null;
}

/** 在 (x, y) 新增積木 */
export function addMainNode(tool: string, d: Diagram, vars: VarStore, f: DialogForm, x: number, y: number, modules: ModuleInfo[] = []): boolean {
  const add = (text: string, figure: FlowNode['figure'], nodeVars?: string[], data?: string) => {
    const node = d.newNode(x, y, 120, 80, sharedConnectors, text, figure, nodeVars, data);
    d.addNode(node);
    d.fitNode(node);
    d.pause = false;
    d.draw();
    return true;
  };
  switch (tool) {
    case 'Circle':
      return add(f.radio, 'Circle');
    case 'Parallelogram': {
      const text = ioText(vars, f, modules);
      return text != null && add(text, 'Parallelogram', getCodeVar(vars, text));
    }
    case 'Diamond':
      return checkVar(vars, f.code, true) && add(f.code, 'Diamond', getCodeVar(vars, f.code));
    case 'Loop':
      if (checkVar(vars, f.forNumber, true) || checkVar(vars, f.code, true)) {
        const text = f.radio == 'while' ? f.code : f.forNumber + '次';
        return add(text, f.radio == 'for' ? 'For_Loop' : 'While_Loop', getCodeVar(vars, text));
      }
      return false;
    case 'Rectangle':
      if (rectangleValid(vars, f, modules)) {
        const g = changeForm(receiveForm(f, modules));
        const { text, nodeVar } = rectangleText(vars, g);
        return add(text, 'Rectangle', nodeVar, g.radio);
      }
      return false;
    case 'Function': {
      const text = callNodeText(vars, modules, f);
      return text != null && add(text, 'Function', getCodeVar(vars, text));
    }
    default:
      return false;
  }
}

/** 雙擊後修改積木 */
export function editMainNode(node: FlowNode, d: Diagram, vars: VarStore, f: DialogForm, modules: ModuleInfo[] = []): boolean {
  const done = () => {
    d.fitNode(node);
    d.pause = false;
    d.draw();
    return true;
  };
  switch (node.figure) {
    case 'Circle':
      node.text = f.radio;
      return done();
    case 'Parallelogram': {
      const text = ioText(vars, f, modules);
      if (text == null) return false;
      node.text = text;
      node.variables = getCodeVar(vars, text);
      return done();
    }
    case 'Diamond':
      if (!checkVar(vars, f.code, true)) return false;
      node.text = f.code;
      node.variables = getCodeVar(vars, f.code);
      return done();
    case 'For_Loop':
    case 'While_Loop': {
      const text = f.radio == 'while' ? f.code : f.forNumber + '次';
      node.figure = f.radio == 'for' ? 'For_Loop' : 'While_Loop';
      node.text = text;
      node.variables = getCodeVar(vars, text);
      return done();
    }
    case 'Rectangle': {
      if (!rectangleValid(vars, f, modules)) return false;
      const g = changeForm(receiveForm(f, modules));
      const { text, nodeVar } = rectangleText(vars, g);
      node.text = text;
      node.data = g.radio;
      node.variables = nodeVar;
      return done();
    }
    case 'Function': {
      const text = callNodeText(vars, modules, f);
      if (text == null) return false;
      node.text = text;
      node.variables = getCodeVar(vars, text);
      return done();
    }
    default:
      return false;
  }
}

/** 「x + 多少」：回傳多少（外面的括號拿掉）；不是這種寫法回傳 null */
function changeAmount(target: string, expr: string): string | null {
  const e = parseExpr(expr);
  if (e.t != 'bin' || e.op != '+' || e.a.t != 'var' || e.a.name != target) return null;
  const m = new RegExp('^\\s*' + target.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\s*\\+\\s*(.*)$', 's').exec(expr);
  if (!m) return null;
  const by = m[1].trim();
  return /^\(.*\)$/s.test(by) && parseExpr(by.slice(1, -1)).t == 'bin' ? by.slice(1, -1).trim() : by;
}

/** 整個算式就是執行一個有回傳值的模組（例如 aaa(x)）：回傳模組名稱和參數；不是的話 null */
function returningCall(expr: string, modules: ModuleInfo[]) {
  const call = parseCall(expr);
  if (!call || !modules.some(m => m.name == call.name && m.returns)) return null;
  if (call.args.some(a => parseExpr(a).t == 'raw')) return null;
  return callText(call.name, call.args).replace(/\s/g, '') == expr.replace(/\s/g, '') ? call : null;
}

/** 雙擊積木時：對話框種類與預先填好的內容 */
export function editDialogFor(node: FlowNode, modules: ModuleInfo[] = [], vars?: VarStore): { kind: DialogKind; initial: Partial<DialogForm> } {
  const text = node.text ?? '';
  switch (node.figure) {
    case 'Parallelogram': {
      const radio = text.substring(0, 2);
      const rest = text.substring(3);
      if (radio == '輸出') {
        const call = returningCall(rest, modules);
        if (call) return { kind: 'Parallelogram', initial: { radio, ioText: '變數或字串：', outputKind: '回傳', moduleName: call.name, moduleArgs: call.args, varSelectOutputDisplay: 'inline-block', varSelectDisplay: 'none' } };
        return {
          kind: 'Parallelogram',
          initial: rest
            ? { radio, ioText: '變數或字串：', varSelectOutput: rest, varSelectOutputDisplay: 'inline-block', varSelectDisplay: 'none' }
            : { radio, ioText: '變數或字串：' },
        };
      }
      // 輸入到清單的某一項：拆出清單和第幾項（存到變數還是清單，對話框再依變數表判斷）
      const insert = /^(.*?) 插入第 (.*) 項$/s.exec(rest);
      const item = splitTarget(rest);
      const place: Partial<DialogForm> = insert ? { varSelect: insert[1].trim(), ioPlace: '插入', rectIndex: insert[2].trim() }
        : item?.indexes.length == 2 ? { varSelect: item.name, ioTarget: '二維清單', rectIndex: item.indexes[0], rectIndex2: item.indexes[1] }
        : item ? { varSelect: item.name, ioPlace: '替換', rectIndex: item.indexes[0] }
        : { varSelect: rest };
      return {
        kind: 'Parallelogram',
        initial: rest ? { radio, ...place, varSelectDisplay: 'inline-block', varSelectOutputDisplay: 'none' } : { radio },
      };
    }
    case 'Diamond':
      return { kind: 'Diamond', initial: { code: text } };
    case 'Function': {
      const call = parseCall(text);
      return { kind: 'Function', initial: call ? { moduleName: call.name, moduleArgs: call.args } : {} };
    }
    case 'For_Loop':
      return { kind: 'For_Loop', initial: { radio: 'for', forNumber: text.substring(0, text.length - 1), showWhile: false } };
    case 'While_Loop':
      return { kind: 'While_Loop', initial: { radio: 'while', code: text, showWhile: true } };
    case 'Rectangle': {
      const { target, action, index, index2, expr } = splitRectangle(text);
      // 「a 設為 aaa(x)」：整個值就是執行一個有回傳值的模組（沒有捨去進位）→ 接收模組回傳值
      const call = action == '設為' && !node.data && !expr.includes('(取') ? returningCall(expr, modules) : null;
      // 「x 設為 x + 多少」（數字變數、沒有捨去進位）→ 變數「改變」
      const by = action == '設為' && !node.data && !expr.includes('(取') ? changeAmount(target, expr) : null;
      if (by != null && vars?.type_var_list.number.includes(target)) {
        return { kind: 'Rectangle', initial: { rectKind: '變數', rectAction: '設為', varChange: true, varSelect: target, code: by } };
      }
      if (call) {
        return { kind: 'Rectangle', initial: { rectKind: '接收', rectAction: '設為', varSelect: target, moduleName: call.name, moduleArgs: call.args } };
      }
      return {
        kind: 'Rectangle',
        initial: {
          // 舊資料沒有取整方式時，維持預設的「不需要」
          ...(node.data != null ? { radio: node.data } : {}),
          rectAction: action,
          // 先選的那一層：變數、清單、二維清單（建立，或替換一格 表[列][行]）、回傳
          rectKind: action == '設為' ? '變數' : action == '回傳' ? '回傳' : action == '建立' || (action == '替換' && index2) ? '二維清單' : '清單',
          rectIndex: index,
          rectIndex2: index2,
          varSelect: target,
          code: expr.split('(取')[0],
        },
      };
    }
    default:
      return { kind: 'Circle', initial: { radio: text.substring(0, 2) } };
  }
}
