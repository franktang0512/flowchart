// 對話框按「確認」之後：新增或修改積木。檢查條件的順序與舊版相同（會影響跳出哪個提示）。
import type { DialogForm, DialogKind } from './components/NodeDialog';
import { createConnectors } from './engine/connector';
import { checkCall, checkVar, getCodeVar, type VarStore } from './engine/decoder';
import { splitRectangle, splitTarget } from './engine/labels';
import { callText, parseCall, type ModuleInfo } from './engine/modules';
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

/** 刪除第幾項、刪除所有項目、建立二維清單不用填值 */
const hasValue = (f: DialogForm) => f.rectAction != '刪除' && f.rectAction != '清空' && f.rectAction != '建立';

function rectangleValid(vars: VarStore, f: DialogForm) {
  if (f.rectAction == '設為') return checkVar(vars, f.code, true) && checkVar(vars, f.varSelect, false);
  if (f.rectAction == '回傳') return checkVar(vars, f.code, true);
  const list = f.varSelect.trim();
  // 二維清單：建立（幾列幾行）、替換一格（第幾列第幾行）
  if (vars.type_var_list.grid.includes(list) && (f.rectAction == '建立' || f.rectAction == '替換')) {
    if (!checkVar(vars, f.rectIndex, true) || !checkVar(vars, f.rectIndex2, true)) return false;
    return !hasValue(f) || checkVar(vars, f.code, true);
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
  return !hasValue(f) || checkVar(vars, f.code, true);
}

/**
 * 輸入/輸出積木：回傳積木文字，檢查沒過回傳 null。輸入到清單的寫法：
 *   「輸入 清單」添加到最後、「輸入 清單 插入第 k 項」、「輸入 清單[k]」替換第 k 項
 */
function ioText(vars: VarStore, f: DialogForm): string | null {
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
      const text = ioText(vars, f);
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
      if (rectangleValid(vars, f)) {
        const { text, nodeVar } = rectangleText(vars, f);
        return add(text, 'Rectangle', nodeVar, f.radio);
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
      const text = ioText(vars, f);
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
      if (!rectangleValid(vars, f)) return false;
      const { text, nodeVar } = rectangleText(vars, f);
      node.text = text;
      node.data = f.radio;
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

/** 雙擊積木時：對話框種類與預先填好的內容 */
export function editDialogFor(node: FlowNode): { kind: DialogKind; initial: Partial<DialogForm> } {
  const text = node.text ?? '';
  switch (node.figure) {
    case 'Parallelogram': {
      const radio = text.substring(0, 2);
      const rest = text.substring(3);
      if (radio == '輸出') {
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
      return {
        kind: 'Rectangle',
        initial: {
          // 舊資料沒有取整方式時，維持預設的「不需要」
          ...(node.data != null ? { radio: node.data } : {}),
          rectAction: action,
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
