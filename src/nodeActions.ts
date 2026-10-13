// 對話框按「確認」之後：新增或修改積木。檢查條件的順序與舊版相同（會影響跳出哪個提示）。
import type { DialogForm, DialogKind } from './components/NodeDialog';
import { createConnectors } from './engine/connector';
import { checkVar, getCodeVar, type VarStore } from './engine/decoder';
import type { Diagram } from './engine/diagram';
import type { FlowNode } from './engine/node';

const ROUNDING_TEXT: Record<string, string> = {
  'Math.round': '(取四捨五入)',
  'Math.ceil': '(取無條件進位)',
  'Math.floor': '(取無條件捨去)',
};

const sharedConnectors = createConnectors();

/** 計算積木：「 x 設為 運算式(取…)」以及它用到的變數 */
function rectangleText(vars: VarStore, f: DialogForm) {
  let text = (f.varSelect ? ' ' + f.varSelect : '') + ' 設為 ' + f.code;
  const nodeVar = getCodeVar(vars, text);
  if (!nodeVar.includes(f.varSelect || '')) nodeVar.push(f.varSelect || '');
  text += ROUNDING_TEXT[f.radio] ?? '';
  return { text, nodeVar };
}

const rectangleValid = (vars: VarStore, f: DialogForm) =>
  checkVar(vars, f.code, true) && checkVar(vars, f.varSelect, false);

/** 輸入/輸出積木：回傳積木文字，檢查沒過回傳 null */
function ioText(vars: VarStore, f: DialogForm): string | null {
  if (f.radio == '輸入' && checkVar(vars, f.varSelect, false)) {
    return f.radio + (f.varSelect ? ' ' + f.varSelect : '');
  }
  if (checkVar(vars, f.varSelectOutput, true)) {
    return f.radio + (f.varSelectOutput ? ' ' + f.varSelectOutput : '');
  }
  return null;
}

/** 在 (x, y) 新增積木 */
export function addMainNode(tool: string, d: Diagram, vars: VarStore, f: DialogForm, x: number, y: number): boolean {
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
    default:
      return false;
  }
}

/** 雙擊後修改積木 */
export function editMainNode(node: FlowNode, d: Diagram, vars: VarStore, f: DialogForm): boolean {
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
            ? { radio, ioText: '變數或字串：', varSelectOutput: rest, varSelectOutputDisplay: 'block', varSelectDisplay: 'none' }
            : { radio, ioText: '變數或字串：' },
        };
      }
      return {
        kind: 'Parallelogram',
        initial: rest ? { radio, varSelect: rest, varSelectDisplay: 'block', varSelectOutputDisplay: 'none' } : { radio },
      };
    }
    case 'Diamond':
      return { kind: 'Diamond', initial: { code: text } };
    case 'For_Loop':
      return { kind: 'For_Loop', initial: { radio: 'for', forNumber: text.substring(0, text.length - 1), showWhile: false } };
    case 'While_Loop':
      return { kind: 'While_Loop', initial: { radio: 'while', code: text, showWhile: true } };
    case 'Rectangle': {
      const t = text.split(' 設為 ');
      return {
        kind: 'Rectangle',
        initial: {
          // 舊資料沒有取整方式時，維持預設的「不需要」
          ...(node.data != null ? { radio: node.data } : {}),
          varSelect: t[0] ? t[0].trim() : '',
          code: (t[1] ?? '').split('(取')[0],
        },
      };
    }
    default:
      return { kind: 'Circle', initial: { radio: text.substring(0, 2) } };
  }
}
