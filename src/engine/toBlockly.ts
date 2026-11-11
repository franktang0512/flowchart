// 「看程式」：流程圖的結構 → 積木（Blockly 的 JSON 存檔格式）。
// 兩種外觀跟 individual_demo（全國賽練習網頁）一樣：
//   scratch：Scratch 風格的自訂積木（見 scratchBlocks.ts），程式從「當綠旗被點擊」開始，輸入用「詢問並等待」
//   blockly：Blockly 內建積木，輸入用「輸入數字/文字並顯示訊息」
// 兩種的清單都從第 1 項開始，跟學習目標「積木」一樣，所以位置直接照抄。
import { t } from '../i18n';
import { exprType, type Expr, type ModuleProgram, type Stmt, type VarInfo } from './structure';

export type BlockMode = 'scratch' | 'blockly';

type Block = {
  type: string;
  fields?: Record<string, unknown>;
  inputs?: Record<string, { block: Block }>;
  next?: { block: Block };
  extraState?: Record<string, unknown> | string;
  x?: number;
  y?: number;
};

const ARITH: Record<string, string> = { '+': 'ADD', '-': 'MINUS', '*': 'MULTIPLY', '/': 'DIVIDE' };
const COMPARE: Record<string, string> = { '==': 'EQ', '!=': 'NEQ', '<': 'LT', '<=': 'LTE', '>': 'GT', '>=': 'GTE' };
const ROUND: Record<string, string> = { 'Math.round': 'ROUND', 'Math.floor': 'ROUNDDOWN', 'Math.ceil': 'ROUNDUP' };

/** 回傳 Blockly.serialization.workspaces.load 可以讀的 JSON */
export function toBlockly(program: Stmt[], varList: VarInfo[], mode: BlockMode, modules: ModuleProgram[] = []) {
  const globals = new Map(varList.map(v => [v.name, v]));
  /** 目前看得到的變數：主程式是變數表；模組裡再加上參數 */
  let vars = globals;
  /** 目前這個模組的參數（Scratch 要用粉紅色的參數積木，不是變數積木） */
  let params = new Set<string>();
  const enter = (m: ModuleProgram | null) => {
    params = new Set(m?.params.map(p => p.name) ?? []);
    vars = m ? new Map([...globals, ...m.params.map(p => [p.name, { name: p.name, type: p.type, init: '' } as VarInfo] as const)]) : globals;
  };
  const scratch = mode == 'scratch';
  const varId = (name: string) => 'var_' + name;
  const isList = (name: string) => vars.get(name)?.type == '清單';
  const isText = (e: Expr) => exprType(e, vars, modules) == 'str';
  const input = (block: Block) => ({ block });
  const field = (name: string) => ({ id: varId(name) });

  // ---- 共用的小積木 ----
  const literal = (v: string, isNum: boolean): Block => (scratch
    ? { type: 'scratch_text', fields: { TEXT: v } }
    : isNum ? { type: 'math_number', fields: { NUM: Number(v) } } : { type: 'text', fields: { TEXT: v } });
  const getVar = (name: string): Block => (scratch
    ? (isList(name) ? { type: 'scratch_list_get', fields: { LIST: field(name) } } : { type: 'scratch_variables_get', fields: { VAR: field(name) } })
    : { type: 'variables_get', fields: { VAR: field(name) } });
  const setVar = (name: string, value: Block): Block => ({ type: scratch ? 'scratch_variables_set' : 'variables_set', fields: { VAR: field(name) }, inputs: { VALUE: input(value) } });
  /** 清單運算的對象：Scratch 的清單積木要直接選清單（欄位），不是放一個積木進去 */
  const listName = (e: Expr) => (e.t == 'var' && isList(e.name) ? e.name : null);

  /** 運算式 → 積木 */
  const expr = (e: Expr): Block => {
    switch (e.t) {
      case 'num': return literal(e.v, true);
      case 'str': return literal(e.v, false);
      case 'raw': return literal(e.text, false);
      case 'var':
        if (scratch && params.has(e.name)) return { type: 'scratch_proc_arg', fields: { NAME: e.name } };
        return getVar(e.name);
      case 'fcall': {
        // 有回傳值的函式（只有 Blockly；Scratch 的自訂積木不能回傳，「看程式」會先擋下來）
        const m = modules.find(x => x.name == e.name);
        const names = m ? m.params.map(p => p.name) : e.args.map((_, k) => 'x' + (k + 1));
        return { type: 'procedures_callreturn', extraState: { name: e.name, params: names }, inputs: Object.fromEntries(e.args.map((a, k) => ['ARG' + k, input(expr(a))])) };
      }
      case 'idx': {
        const list = listName(e.obj);
        if (scratch) {
          return list
            ? { type: 'scratch_list_get_item', fields: { LIST: field(list) }, inputs: { INDEX: input(expr(e.index)) } }
            : { type: 'scratch_string_char_at', inputs: { STRING: input(expr(e.obj)), INDEX: input(expr(e.index)) } };
        }
        return isText(e.obj)
          ? { type: 'text_charAt', fields: { WHERE: 'FROM_START' }, inputs: { VALUE: input(expr(e.obj)), AT: input(expr(e.index)) } }
          : { type: 'lists_getIndex', fields: { MODE: 'GET', WHERE: 'FROM_START' }, inputs: { VALUE: input(expr(e.obj)), AT: input(expr(e.index)) } };
      }
      case 'neg':
        return scratch
          ? { type: 'scratch_math_arithmetic', fields: { OP: 'MINUS' }, inputs: { A: input(literal('0', true)), B: input(expr(e.a)) } }
          : { type: 'math_single', fields: { OP: 'NEG' }, inputs: { NUM: input(expr(e.a)) } };
      case 'not': return { type: 'logic_negate', inputs: { BOOL: input(expr(e.a)) } };
      case 'call': return call(e.fn, e.args);
      case 'bin': {
        if (e.op == '+' && exprType(e, vars, modules) == 'str') return join(joinParts(e));
        if (ARITH[e.op]) return { type: scratch ? 'scratch_math_arithmetic' : 'math_arithmetic', fields: { OP: ARITH[e.op] }, inputs: { A: input(expr(e.a)), B: input(expr(e.b)) } };
        if (e.op == '%') return { type: 'math_modulo', inputs: { DIVIDEND: input(expr(e.a)), DIVISOR: input(expr(e.b)) } };
        if (COMPARE[e.op]) return { type: scratch ? 'scratch_logic_compare' : 'logic_compare', fields: { OP: COMPARE[e.op] }, inputs: { A: input(expr(e.a)), B: input(expr(e.b)) } };
        return { type: 'logic_operation', fields: { OP: e.op == 'and' ? 'AND' : 'OR' }, inputs: { A: input(expr(e.a)), B: input(expr(e.b)) } };
      }
    }
  };

  /** 長度( )、項目編號( )、包含( ) */
  const call = (fn: 'len' | 'find' | 'has', [a, b]: Expr[]): Block => {
    if (!a) return literal('0', true);
    const list = listName(a);
    const text = isText(a);
    if (fn == 'len') {
      if (scratch) return list ? { type: 'scratch_list_length', fields: { LIST: field(list) } } : { type: 'scratch_length', inputs: { VALUE: input(expr(a)) } };
      return { type: text ? 'text_length' : 'lists_length', inputs: { VALUE: input(expr(a)) } };
    }
    if (!b) return literal('0', true);
    if (scratch && list) {
      return fn == 'find'
        ? { type: 'scratch_list_indexof', fields: { LIST: field(list) }, inputs: { ITEM: input(expr(b)) } }
        : { type: 'scratch_list_contain', fields: { LIST: field(list) }, inputs: { ITEM: input(expr(b)) } };
    }
    if (scratch && fn == 'has' && text) return { type: 'scratch_string_contains', inputs: { STRING1: input(expr(a)), STRING2: input(expr(b)) } };
    const find: Block = { type: text ? 'text_indexOf' : 'lists_indexOf', fields: { END: 'FIRST' }, inputs: { VALUE: input(expr(a)), FIND: input(expr(b)) } };
    // 包含：Blockly 沒有這個積木，寫成「找到的位置 ≠ 0」
    return fn == 'find' ? find : { type: scratch ? 'scratch_logic_compare' : 'logic_compare', fields: { OP: 'NEQ' }, inputs: { A: input(find), B: input(literal('0', true)) } };
  };

  /** 文字接起來：Scratch 的「字串組合」一次接兩個，Blockly 的「建立字串使用」可以接很多個 */
  const join = (parts: Expr[]): Block => {
    if (scratch) {
      return parts.slice(1).reduce<Block>((acc, p) => ({ type: 'scratch_string_join', inputs: { TEXT0: input(acc), TEXT1: input(expr(p)) } }), expr(parts[0]));
    }
    return { type: 'text_join', extraState: { itemCount: parts.length }, inputs: Object.fromEntries(parts.map((p, i) => ['ADD' + i, input(expr(p))])) };
  };
  const joinParts = (e: Expr): Expr[] => (e.t == 'bin' && e.op == '+' && exprType(e, vars, modules) == 'str' ? [...joinParts(e.a), ...joinParts(e.b)] : [e]);
  const rounded = (round: string, block: Block): Block => (ROUND[round] ? { type: 'math_round', fields: { OP: ROUND[round] }, inputs: { NUM: input(block) } } : block);

  // ---- 清單的操作 ----
  const listAdd = (list: string, value: Block): Block => (scratch
    ? { type: 'scratch_list_add', fields: { LIST: field(list) }, inputs: { ITEM: input(value) } }
    : { type: 'lists_setIndex', fields: { MODE: 'INSERT', WHERE: 'LAST' }, inputs: { LIST: input(getVar(list)), TO: input(value) } });
  const listInsert = (list: string, at: Block, value: Block): Block => (scratch
    ? { type: 'scratch_list_insert', fields: { LIST: field(list) }, inputs: { ITEM: input(value), INDEX: input(at) } }
    : { type: 'lists_setIndex', fields: { MODE: 'INSERT', WHERE: 'FROM_START' }, inputs: { LIST: input(getVar(list)), AT: input(at), TO: input(value) } });
  const listSet = (list: string, at: Block, value: Block): Block => (scratch
    ? { type: 'scratch_list_set', fields: { LIST: field(list) }, inputs: { INDEX: input(at), ITEM: input(value) } }
    : { type: 'lists_setIndex', fields: { MODE: 'SET', WHERE: 'FROM_START' }, inputs: { LIST: input(getVar(list)), AT: input(at), TO: input(value) } });
  const listRemove = (list: string, at: Block): Block => (scratch
    ? { type: 'scratch_list_remove', fields: { LIST: field(list) }, inputs: { INDEX: input(at) } }
    : { type: 'lists_getIndex', extraState: { isStatement: true }, fields: { MODE: 'REMOVE', WHERE: 'FROM_START' }, inputs: { VALUE: input(getVar(list)), AT: input(at) } });
  const listEmpty = (list: string): Block => (scratch
    ? { type: 'scratch_list_empty', fields: { LIST: field(list) } }
    : setVar(list, { type: 'lists_create_empty' }));

  /**
   * 輸入：Scratch 是「詢問 ( ) 並等待」再用「詢問的答案」，所以是兩個積木；
   * Blockly 是一個「輸入數字/文字並顯示訊息」積木
   */
  const inputBlocks = (asText: boolean, use: (answer: Block) => Block): Block[] => {
    if (scratch) {
      return [{ type: 'event_askandwait', inputs: { TEXT: input(literal('', false)) } }, use({ type: 'event_answer' })];
    }
    return [use({ type: 'text_prompt_ext', fields: { TYPE: asText ? 'TEXT' : 'NUMBER' }, inputs: { TEXT: input(literal('', false)) } })];
  };

  const stmt = (s: Stmt): Block[] => {
    switch (s.kind) {
      case 'input': {
        const v = vars.get(s.target);
        if (v?.type != '清單') return inputBlocks(v?.type == '文字', answer => setVar(s.target, answer));
        const asText = v.init == '文字';
        if (s.place == 'insert') return inputBlocks(asText, answer => listInsert(s.target, expr(s.index!), answer));
        if (s.place == 'replace') return inputBlocks(asText, answer => listSet(s.target, expr(s.index!), answer));
        return inputBlocks(asText, answer => listAdd(s.target, answer));
      }
      case 'output':
        return [{ type: scratch ? 'event_say' : 'text_print', inputs: { TEXT: input(expr(s.value)) } }];
      case 'rect': {
        const value = s.value ? rounded(s.round, expr(s.value)) : literal('0', true);
        switch (s.action) {
          case '加入': return [listAdd(s.target, value)];
          case '插入': return [listInsert(s.target, expr(s.index!), value)];
          case '替換': return [listSet(s.target, expr(s.index!), value)];
          case '刪除': return [listRemove(s.target, expr(s.index!))];
          case '清空': return [listEmpty(s.target)];
          default: return [setVar(s.target, value)];
        }
      }
      case 'if': {
        const yes = chain(s.yes);
        const no = chain(s.no);
        const block: Block = { type: scratch ? (no ? 'scratch_ifElse' : 'scratch_if') : 'controls_if', inputs: { IF0: input(expr(s.cond)) } };
        if (yes) block.inputs!.DO0 = input(yes);
        if (no) {
          if (!scratch) block.extraState = { hasElse: true };
          block.inputs!.ELSE = input(no);
        }
        return [block];
      }
      case 'repeat': {
        const body = chain(s.body);
        return [{ type: scratch ? 'scratch_repeat_ext' : 'controls_repeat_ext', inputs: { TIMES: input(expr(s.times)), ...(body ? { DO: input(body) } : {}) } }];
      }
      case 'until': {
        const body = chain(s.body);
        return [{ type: scratch ? 'scratch_whileUntil' : 'controls_whileUntil', fields: { MODE: 'UNTIL' }, inputs: { BOOL: input(expr(s.cond)), ...(body ? { DO: input(body) } : {}) } }];
      }
      case 'call': {
        // 執行模組：Scratch 的自訂積木、Blockly 的「執行函式」；參數照模組定義的順序
        const m = modules.find(x => x.name == s.name);
        const names = m ? m.params.map(p => p.name) : s.args.map((_, k) => 'x' + (k + 1));
        const inputs = Object.fromEntries(s.args.map((a, k) => ['ARG' + k, input(expr(a))]));
        return [{ type: scratch ? 'scratch_proc_call' : 'procedures_callnoreturn', extraState: { name: s.name, params: names }, inputs }];
      }
      case 'return':
        // 回傳在判斷裡面：Blockly 的「如果 成立 則回傳」積木（條件放「真」）；放在最後的回傳見下面 defs
        return [{
          type: 'procedures_ifreturn', extraState: '<mutation value="1"></mutation>',
          inputs: { CONDITION: input({ type: 'logic_boolean', fields: { BOOL: 'TRUE' } }), VALUE: input(rounded(s.round, expr(s.value))) },
        }];
    }
  };

  /** 一串積木用 next 接起來，回傳第一個 */
  const link = (blocks: Block[]): Block | undefined => {
    for (let i = 0; i < blocks.length - 1; i++) blocks[i].next = { block: blocks[i + 1] };
    return blocks[0];
  };
  const chain = (list: Stmt[]): Block | undefined => link(list.flatMap(stmt));

  // 變數的初始值：積木沒有變數表，不是預設值（數字 0、空的文字）的才在最前面用「設定變數」放好；
  // 清單一開始本來就是空的。積木改回流程圖時，這些積木會變成流程圖上的節點（見 fromBlockly）
  const initValue = (v: VarInfo) => (v.type == '文字' ? v.init.trim().replace(/^(["'])(.*)\1$/s, '$2') : v.init.trim() || '0');
  const inits = varList
    .filter(v => v.type != '清單' && initValue(v) != (v.type == '文字' ? '' : '0'))
    .map(v => setVar(v.name, literal(initValue(v), v.type != '文字')));

  enter(null);
  const all = [...inits, ...program.flatMap(stmt)];
  // Scratch 的程式從「當綠旗被點擊」開始
  if (scratch) all.unshift({ type: 'event_whenflagclicked' });
  const first = link(all);

  // 模組：Scratch 是「定義」帽子積木，Blockly 是「函式」積木；排在主程式右邊
  const defs = modules.map((m, k): Block => {
    enter(m);
    const at = { x: 20 + 460 * (k + 1), y: 20 };
    if (scratch) {
      const body = chain(m.body);
      return { type: 'scratch_proc_def', extraState: { name: m.name, params: m.params }, ...(body ? { next: { block: body } } : {}), ...at };
    }
    // 有回傳值：最後一步是「回傳」的話，放進函式積木下面的「回傳」格子
    const last = m.body[m.body.length - 1];
    const tail = m.returns && last?.kind == 'return' ? last : null;
    const body = chain(tail ? m.body.slice(0, -1) : m.body);
    const inputs: Record<string, { block: Block }> = {};
    if (body) inputs.STACK = input(body);
    if (tail) inputs.RETURN = input(rounded(tail.round, expr(tail.value)));
    return {
      type: m.returns ? 'procedures_defreturn' : 'procedures_defnoreturn', fields: { NAME: m.name },
      extraState: { params: m.params.map(p => ({ name: p.name, id: varId(p.name) })) },
      inputs, ...at,
    };
  });
  enter(null);

  // Blockly 的函式參數也是變數（Scratch 的參數不是，不用放）
  const paramVars = scratch ? [] : [...new Set(modules.flatMap(m => m.params.map(p => p.name)))].filter(n => !globals.has(n)).map(n => ({ name: n, id: varId(n) }));
  return {
    blocks: { languageVersion: 0, blocks: [...(first ? [{ ...first, x: 20, y: 20 }] : []), ...defs] },
    variables: [...varList.map(v => ({ name: v.name, id: varId(v.name), ...(scratch && v.type == '清單' ? { type: 'list' } : {}) })), ...paramVars],
  };
}

/** 讀不到 Blockly（沒有網路）時的說明 */
export const blocklyLoadError = () => t('積木載入失敗：需要網路才能顯示積木。', 'Could not load the blocks. The internet is needed to show them.');
