// 「看程式」：流程圖的結構 → Blockly 積木（Blockly 的 JSON 存檔格式，只用 Blockly 內建的積木）。
// Blockly 的清單也是從第 1 項開始，跟學習目標「積木」一樣，所以位置直接照抄。
import { t } from '../i18n';
import { exprType, type Expr, type Stmt, type VarInfo } from './structure';

type Block = {
  type: string;
  fields?: Record<string, unknown>;
  inputs?: Record<string, { block: Block }>;
  next?: { block: Block };
  extraState?: Record<string, unknown>;
  x?: number;
  y?: number;
};

const ARITH: Record<string, string> = { '+': 'ADD', '-': 'MINUS', '*': 'MULTIPLY', '/': 'DIVIDE' };
const COMPARE: Record<string, string> = { '==': 'EQ', '!=': 'NEQ', '<': 'LT', '<=': 'LTE', '>': 'GT', '>=': 'GTE' };
const ROUND: Record<string, string> = { 'Math.round': 'ROUND', 'Math.floor': 'ROUNDDOWN', 'Math.ceil': 'ROUNDUP' };

/** 回傳 Blockly.serialization.workspaces.load 可以讀的 JSON */
export function toBlockly(program: Stmt[], varList: VarInfo[]) {
  const vars = new Map(varList.map(v => [v.name, v]));
  const varId = (name: string) => 'var_' + name;
  const isList = (name: string) => vars.get(name)?.type == '清單';
  const isText = (e: Expr) => exprType(e, vars) == 'str';

  const get = (name: string): Block => ({ type: 'variables_get', fields: { VAR: { id: varId(name) } } });
  const num = (v: number | string): Block => ({ type: 'math_number', fields: { NUM: Number(v) } });
  const input = (block: Block) => ({ block });

  /** 運算式 → 積木 */
  const expr = (e: Expr): Block => {
    switch (e.t) {
      case 'num': return num(e.v);
      case 'str': return { type: 'text', fields: { TEXT: e.v } };
      case 'var': return get(e.name);
      case 'raw': return { type: 'text', fields: { TEXT: e.text } };
      case 'idx':
        // 文字的第幾個字 / 清單的第幾項
        return isText(e.obj)
          ? { type: 'text_charAt', fields: { WHERE: 'FROM_START' }, inputs: { VALUE: input(expr(e.obj)), AT: input(expr(e.index)) } }
          : { type: 'lists_getIndex', fields: { MODE: 'GET', WHERE: 'FROM_START' }, inputs: { VALUE: input(expr(e.obj)), AT: input(expr(e.index)) } };
      case 'neg': return { type: 'math_single', fields: { OP: 'NEG' }, inputs: { NUM: input(expr(e.a)) } };
      case 'not': return { type: 'logic_negate', inputs: { BOOL: input(expr(e.a)) } };
      case 'call': {
        const [a, b] = e.args;
        if (!a) return num(0);
        const text = isText(a);
        if (e.fn == 'len') return { type: text ? 'text_length' : 'lists_length', inputs: { VALUE: input(expr(a)) } };
        if (!b) return num(0);
        const find: Block = { type: text ? 'text_indexOf' : 'lists_indexOf', fields: { END: 'FIRST' }, inputs: { VALUE: input(expr(a)), FIND: input(expr(b)) } };
        // 包含：Blockly 沒有這個積木，寫成「找到的位置 ≠ 0」
        return e.fn == 'find' ? find : { type: 'logic_compare', fields: { OP: 'NEQ' }, inputs: { A: input(find), B: input(num(0)) } };
      }
      case 'bin': {
        if (e.op == '+' && exprType(e, vars) == 'str') {
          // 文字接起來：攤平成一個「建立字串使用」積木
          const parts = joinParts(e);
          return {
            type: 'text_join', extraState: { itemCount: parts.length },
            inputs: Object.fromEntries(parts.map((p, i) => ['ADD' + i, input(expr(p))])),
          };
        }
        if (ARITH[e.op]) return { type: 'math_arithmetic', fields: { OP: ARITH[e.op] }, inputs: { A: input(expr(e.a)), B: input(expr(e.b)) } };
        if (e.op == '%') return { type: 'math_modulo', inputs: { DIVIDEND: input(expr(e.a)), DIVISOR: input(expr(e.b)) } };
        if (COMPARE[e.op]) return { type: 'logic_compare', fields: { OP: COMPARE[e.op] }, inputs: { A: input(expr(e.a)), B: input(expr(e.b)) } };
        return { type: 'logic_operation', fields: { OP: e.op == 'and' ? 'AND' : 'OR' }, inputs: { A: input(expr(e.a)), B: input(expr(e.b)) } };
      }
    }
  };
  const joinParts = (e: Expr): Expr[] => (e.t == 'bin' && e.op == '+' && exprType(e, vars) == 'str' ? [...joinParts(e.a), ...joinParts(e.b)] : [e]);
  const rounded = (round: string, block: Block): Block => (ROUND[round] ? { type: 'math_round', fields: { OP: ROUND[round] }, inputs: { NUM: input(block) } } : block);

  /** 輸入：Blockly 用「輸入數字/文字並顯示訊息」 */
  const prompt = (asText: boolean): Block => ({ type: 'text_prompt', fields: { TYPE: asText ? 'TEXT' : 'NUMBER', TEXT: '' } });
  /** 清單的「設定/插入」積木；where 是 FROM_START（第幾項）或 LAST（最後面） */
  const setIndex = (list: string, mode: 'SET' | 'INSERT', where: 'FROM_START' | 'LAST', value: Block, at?: Block): Block => ({
    type: 'lists_setIndex', fields: { MODE: mode, WHERE: where },
    inputs: { LIST: input(get(list)), ...(at ? { AT: input(at) } : {}), TO: input(value) },
  });

  const stmt = (s: Stmt): Block => {
    switch (s.kind) {
      case 'input': {
        const v = vars.get(s.target);
        if (v?.type != '清單') return { type: 'variables_set', fields: { VAR: { id: varId(s.target) } }, inputs: { VALUE: input(prompt(v?.type == '文字')) } };
        const value = prompt(v.init == '文字');
        if (s.place == 'insert') return setIndex(s.target, 'INSERT', 'FROM_START', value, expr(s.index!));
        if (s.place == 'replace') return setIndex(s.target, 'SET', 'FROM_START', value, expr(s.index!));
        return setIndex(s.target, 'INSERT', 'LAST', value);
      }
      case 'output':
        return { type: 'text_print', inputs: { TEXT: input(expr(s.value)) } };
      case 'rect': {
        const value = s.value ? rounded(s.round, expr(s.value)) : num(0);
        switch (s.action) {
          case '加入': return setIndex(s.target, 'INSERT', 'LAST', value);
          case '插入': return setIndex(s.target, 'INSERT', 'FROM_START', value, expr(s.index!));
          case '替換': return setIndex(s.target, 'SET', 'FROM_START', value, expr(s.index!));
          case '刪除':
            return {
              type: 'lists_getIndex', extraState: { isStatement: true }, fields: { MODE: 'REMOVE', WHERE: 'FROM_START' },
              inputs: { VALUE: input(get(s.target)), AT: input(expr(s.index!)) },
            };
          case '清空':
            return { type: 'variables_set', fields: { VAR: { id: varId(s.target) } }, inputs: { VALUE: input({ type: 'lists_create_empty' }) } };
          default:
            return { type: 'variables_set', fields: { VAR: { id: varId(s.target) } }, inputs: { VALUE: input(value) } };
        }
      }
      case 'if': {
        const block: Block = { type: 'controls_if', inputs: { IF0: input(expr(s.cond)) } };
        const yes = chain(s.yes);
        const no = chain(s.no);
        if (yes) block.inputs!.DO0 = input(yes);
        if (no) {
          block.extraState = { hasElse: true };
          block.inputs!.ELSE = input(no);
        }
        return block;
      }
      case 'repeat': {
        const body = chain(s.body);
        return { type: 'controls_repeat_ext', inputs: { TIMES: input(expr(s.times)), ...(body ? { DO: input(body) } : {}) } };
      }
      case 'until': {
        const body = chain(s.body);
        return { type: 'controls_whileUntil', fields: { MODE: 'UNTIL' }, inputs: { BOOL: input(expr(s.cond)), ...(body ? { DO: input(body) } : {}) } };
      }
    }
  };

  /** 一串積木用 next 接起來，回傳第一個 */
  const chain = (list: Stmt[]): Block | undefined => {
    const blocks = list.map(stmt);
    for (let i = 0; i < blocks.length - 1; i++) blocks[i].next = { block: blocks[i + 1] };
    return blocks[0];
  };

  // 變數的初始值：Blockly 沒有變數表，在最前面用「設定變數」放好
  const inits: Stmt[] = varList.map((v): Stmt => (v.type == '清單'
    ? { kind: 'rect', action: '清空', target: v.name, round: '' }
    : { kind: 'rect', action: '設為', target: v.name, round: '', value: v.type == '文字' ? { t: 'str', v: v.init.trim().replace(/^(["'])(.*)\1$/s, '$2') } : { t: 'num', v: v.init.trim() || '0' } }));

  const first = chain([...inits, ...program]);
  return {
    blocks: { languageVersion: 0, blocks: first ? [{ ...first, x: 20, y: 20 }] : [] },
    variables: varList.map(v => ({ name: v.name, id: varId(v.name) })),
  };
}

/** 讀不到 Blockly（沒有網路）時的說明 */
export const blocklyLoadError = () => t('積木載入失敗：需要網路才能顯示積木。', 'Could not load the blocks. The internet is needed to show them.');
