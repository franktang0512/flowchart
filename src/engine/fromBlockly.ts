// 「看程式」的編輯模式：學生改好的積木（Blockly 的 JSON 存檔格式）→ 流程圖的結構。
// 是 toBlockly 的反方向；Scratch（scratch_* 積木）和 Blockly（內建積木）兩種都看得懂。
// 流程圖做不到的積木（例如中斷循環、函式）會丟出 BlockError，說明是哪個積木、要怎麼改。
import { t } from '../i18n';
import type { ModuleInfo, ParamInfo } from './modules';
import type { Expr, ModuleProgram, Stmt, VarInfo } from './structure';
import type { BlockMode } from './toBlockly';

type Json = {
  type: string;
  fields?: Record<string, unknown>;
  inputs?: Record<string, { block?: Json; shadow?: Json }>;
  next?: { block?: Json; shadow?: Json };
  extraState?: Record<string, unknown>;
};
type Saved = {
  blocks?: { blocks?: Json[] };
  variables?: { name: string; id: string; type?: string }[];
};

/** 積木轉不成流程圖的原因（給學生看） */
export class BlockError extends Error {}

/** 錯誤訊息裡積木的名字 */
const BLOCK_NAME: Record<string, string> = {
  event_askandwait: '詢問並等待', event_answer: '詢問的答案', event_say: '說出', text_print: '輸出',
  scratch_if: '如果', scratch_ifElse: '如果…否則', controls_if: '如果',
  scratch_repeat_ext: '重複幾次', controls_repeat_ext: '重複幾次', controls_repeat: '重複幾次',
  scratch_whileUntil: '重複直到', scratch_while: '重複當', controls_whileUntil: '重複當/直到',
  scratch_variables_set: '變數設為', variables_set: '設定變數', math_round: '四捨五入',
  text_prompt_ext: '輸入', text_prompt: '輸入',
  scratch_proc_def: '定義', scratch_proc_call: '自訂積木', procedures_defnoreturn: '函式', procedures_callnoreturn: '執行函式',
};
/** 會回傳值的函式：流程圖的模組沒有回傳值 */
const RETURN_BLOCKS = new Set(['procedures_defreturn', 'procedures_callreturn', 'procedures_ifreturn']);
const nameOf = (type: string) => BLOCK_NAME[type] ?? type;

const ARITH: Record<string, string> = { ADD: '+', MINUS: '-', MULTIPLY: '*', DIVIDE: '/' };
const COMPARE: Record<string, string> = { EQ: '==', NEQ: '!=', LT: '<', LTE: '<=', GT: '>', GTE: '>=' };
const ROUND: Record<string, string> = { ROUND: 'Math.round', ROUNDDOWN: 'Math.floor', ROUNDUP: 'Math.ceil' };
const isNumber = (s: string) => /^-?\d+(\.\d+)?$/.test(s.trim());

export interface FromBlocks {
  program: Stmt[];
  /** 積木裡的變數（型別、初始值）；變數表會照這個更新 */
  vars: VarInfo[];
  /** 積木裡的自訂積木／函式 → 流程圖的模組 */
  modules: ModuleProgram[];
}

/**
 * 積木 → 流程圖的結構；current 是目前的變數表（判斷型別用，沒有的再從用法猜），
 * currentModules 是目前的模組（參數的型別照原本的，新的參數再從用法猜）
 */
export function fromBlockly(saved: Saved, mode: BlockMode, current: VarInfo[], currentModules: ModuleInfo[] = []): FromBlocks {
  const scratch = mode == 'scratch';
  /** 每次執行自訂積木傳了什麼值（猜參數是數字還是文字用） */
  const callArgs = new Map<string, Expr[][]>();
  const varById = new Map((saved.variables ?? []).map(v => [v.id, v]));
  /** 從用法看出來的型別：用在清單積木的是清單，存文字的是文字 */
  const usedAsList = new Set<string>();
  const usedAsText = new Set<string>();

  const field = (b: Json, name: string) => b.fields?.[name];
  /** 變數欄位（存的是 { id }）→ 變數名稱 */
  const varName = (b: Json, name: string): string => {
    const f = field(b, name) as { id?: string; name?: string } | undefined;
    const v = f?.id ? varById.get(f.id) : undefined;
    const n = v?.name ?? f?.name;
    if (!n) throw new BlockError(t(`「${nameOf(b.type)}」積木還沒有選變數。`, `The "${nameOf(b.type)}" block needs a variable.`));
    return n;
  };
  /** 輸入格裡的積木；空格裡只有預設的白色小積木（shadow）也算 */
  const inputBlock = (b: Json, name: string): Json | undefined => b.inputs?.[name]?.block ?? b.inputs?.[name]?.shadow;
  const need = (b: Json, name: string): Json => {
    const v = inputBlock(b, name);
    if (!v) throw new BlockError(t(`「${nameOf(b.type)}」積木的空格還沒填。`, `The "${nameOf(b.type)}" block has an empty space.`));
    return v;
  };
  const chain = (b: Json | undefined): Json[] => {
    const list: Json[] = [];
    for (let cur = b; cur; cur = cur.next?.block) list.push(cur);
    return list;
  };
  const listOf = (b: Json, name: string) => {
    const n = varName(b, name);
    usedAsList.add(n);
    return n;
  };
  /** Blockly 內建清單積木的清單放在輸入格（一個「變數」積木），不是欄位 */
  const listInput = (b: Json, name: string): string => {
    const v = need(b, name);
    if (v.type != 'variables_get') throw new BlockError(t('清單積木裡要直接放一個清單變數。', 'Put a list variable directly in the list block.'));
    const n = varName(v, 'VAR');
    usedAsList.add(n);
    return n;
  };

  // ---------------- 運算式 ----------------
  const expr = (b: Json): Expr => {
    switch (b.type) {
      case 'scratch_text': {
        const v = String(field(b, 'TEXT') ?? '');
        return isNumber(v) ? { t: 'num', v: v.trim() } : { t: 'str', v };
      }
      case 'text': return { t: 'str', v: String(field(b, 'TEXT') ?? '') };
      case 'math_number': return { t: 'num', v: String(field(b, 'NUM') ?? 0) };
      case 'scratch_variables_get':
      case 'variables_get':
        return { t: 'var', name: varName(b, 'VAR') };
      case 'scratch_list_get': return { t: 'var', name: listOf(b, 'LIST') };
      case 'scratch_proc_arg': return { t: 'var', name: String(field(b, 'NAME') ?? '') };
      case 'scratch_math_arithmetic':
      case 'math_arithmetic': {
        const op = ARITH[String(field(b, 'OP'))];
        if (!op) throw new BlockError(t('流程圖沒有次方，請改用乘法。', 'The flowchart has no power. Use multiply instead.'));
        return { t: 'bin', op, a: expr(need(b, 'A')), b: expr(need(b, 'B')) };
      }
      case 'math_modulo': return { t: 'bin', op: '%', a: expr(need(b, 'DIVIDEND')), b: expr(need(b, 'DIVISOR')) };
      case 'math_single':
        if (field(b, 'OP') != 'NEG') throw new BlockError(t('流程圖只支援「負號」這種數學函式。', 'The flowchart only has the minus sign from this block.'));
        return { t: 'neg', a: expr(need(b, 'NUM')) };
      case 'scratch_logic_compare':
      case 'logic_compare':
        return { t: 'bin', op: COMPARE[String(field(b, 'OP'))] ?? '==', a: expr(need(b, 'A')), b: expr(need(b, 'B')) };
      case 'logic_operation':
        return { t: 'bin', op: field(b, 'OP') == 'OR' ? 'or' : 'and', a: expr(need(b, 'A')), b: expr(need(b, 'B')) };
      case 'logic_negate': return { t: 'not', a: expr(need(b, 'BOOL')) };
      case 'scratch_string_join': {
        const join: Expr = { t: 'bin', op: '+', a: expr(need(b, 'TEXT0')), b: expr(need(b, 'TEXT1')) };
        return join;
      }
      case 'text_join': {
        const count = Number(b.extraState?.itemCount ?? 0);
        const parts: Expr[] = [];
        for (let i = 0; i < count; i++) {
          const p = inputBlock(b, 'ADD' + i);
          if (p) parts.push(expr(p));
        }
        if (!parts.length) return { t: 'str', v: '' };
        return parts.slice(1).reduce<Expr>((a, p) => ({ t: 'bin', op: '+', a, b: p }), parts[0]);
      }
      case 'scratch_string_char_at': return { t: 'idx', obj: expr(need(b, 'STRING')), index: expr(need(b, 'INDEX')) };
      case 'text_charAt':
        if (field(b, 'WHERE') != 'FROM_START') throw new BlockError(t('取字元請用「第 # 個」。', 'Use "letter #" to get a letter.'));
        return { t: 'idx', obj: expr(need(b, 'VALUE')), index: expr(need(b, 'AT')) };
      case 'scratch_list_get_item': return { t: 'idx', obj: { t: 'var', name: listOf(b, 'LIST') }, index: expr(need(b, 'INDEX')) };
      case 'lists_getIndex':
        if (field(b, 'MODE') != 'GET' || field(b, 'WHERE') != 'FROM_START') throw new BlockError(t('取清單的項目請用「取得 第 # 項」。', 'Use "get # " to get a list item.'));
        return { t: 'idx', obj: { t: 'var', name: listInput(b, 'VALUE') }, index: expr(need(b, 'AT')) };
      case 'scratch_length':
      case 'text_length':
        return { t: 'call', fn: 'len', args: [expr(need(b, 'VALUE'))] };
      case 'lists_length': return { t: 'call', fn: 'len', args: [{ t: 'var', name: listInput(b, 'VALUE') }] };
      case 'scratch_list_length': return { t: 'call', fn: 'len', args: [{ t: 'var', name: listOf(b, 'LIST') }] };
      case 'scratch_list_indexof': return { t: 'call', fn: 'find', args: [{ t: 'var', name: listOf(b, 'LIST') }, expr(need(b, 'ITEM'))] };
      case 'lists_indexOf': return { t: 'call', fn: 'find', args: [{ t: 'var', name: listInput(b, 'VALUE') }, expr(need(b, 'FIND'))] };
      case 'text_indexOf': return { t: 'call', fn: 'find', args: [expr(need(b, 'VALUE')), expr(need(b, 'FIND'))] };
      case 'scratch_list_contain': return { t: 'call', fn: 'has', args: [{ t: 'var', name: listOf(b, 'LIST') }, expr(need(b, 'ITEM'))] };
      case 'scratch_string_contains': return { t: 'call', fn: 'has', args: [expr(need(b, 'STRING1')), expr(need(b, 'STRING2'))] };
      case 'math_round':
        throw new BlockError(t('「四捨五入」只能放在「設為」積木的最外面（整個值四捨五入）。', '"Round" can only be the whole value of a "set" block.'));
      case 'event_answer':
        throw new BlockError(t('「詢問的答案」要放在「詢問並等待」的下一個積木裡，直接存到變數或清單。', 'Put "answer" in the block right after "ask and wait", and save it to a variable or list.'));
      default:
        if (RETURN_BLOCKS.has(b.type)) throw returnError();
        throw new BlockError(t(`流程圖沒有「${nameOf(b.type)}」這種積木。`, `The flowchart has no "${nameOf(b.type)}" block.`));
    }
  };
  const returnError = () => new BlockError(t('流程圖的模組不會回傳值：請用「沒有回傳值」的函式，要帶回去的結果存到變數裡。', 'Flowchart modules do not return a value. Use a function with no return, and save the result in a variable.'));

  /** 執行自訂積木／函式：名稱在 extraState，引數在 ARG0、ARG1… */
  const callStmt = (b: Json): Stmt => {
    const name = String(b.extraState?.name ?? '');
    const count = Array.isArray(b.extraState?.params) ? (b.extraState.params as unknown[]).length : 0;
    if (!name) throw new BlockError(t(`「${nameOf(b.type)}」積木還沒有選要執行哪一個。`, `The "${nameOf(b.type)}" block does not say what to run.`));
    const args: Expr[] = [];
    for (let k = 0; k < count; k++) args.push(expr(need(b, 'ARG' + k)));
    callArgs.set(name, [...(callArgs.get(name) ?? []), args]);
    return { kind: 'call', name, args };
  };

  /** 「設為」的值：最外面可以是四捨五入 */
  const valueWithRound = (b: Json): { value: Expr; round: string } => {
    if (b.type == 'math_round') return { value: expr(need(b, 'NUM')), round: ROUND[String(field(b, 'OP'))] ?? 'Math.round' };
    return { value: expr(b), round: '' };
  };
  /** Blockly 的「輸入數字/文字」積木 */
  const isPrompt = (b: Json | undefined) => b != null && (b.type == 'text_prompt_ext' || b.type == 'text_prompt');
  const promptIsText = (b: Json) => field(b, 'TYPE') == 'TEXT';

  // ---------------- 積木串 ----------------
  const stmts = (list: Json[]): Stmt[] => {
    const out: Stmt[] = [];
    for (let i = 0; i < list.length; i++) {
      const b = list[i];
      // Scratch 的輸入：「詢問並等待」+ 下一個積木把「詢問的答案」存起來
      if (b.type == 'event_askandwait') {
        const next = list[i + 1];
        const input = next && scratchInput(next);
        if (!input) throw new BlockError(t('「詢問並等待」的下一個積木，要把「詢問的答案」存到變數或清單。', 'After "ask and wait", save "answer" to a variable or a list.'));
        out.push(input);
        i++;
        continue;
      }
      out.push(...stmt(b));
    }
    return out;
  };
  const answer = (b: Json, name: string) => inputBlock(b, name)?.type == 'event_answer';
  /** 「詢問並等待」的下一個積木是不是把答案存起來 */
  const scratchInput = (b: Json): Stmt | null => {
    switch (b.type) {
      case 'scratch_variables_set': return answer(b, 'VALUE') ? { kind: 'input', target: varName(b, 'VAR'), place: 'var' } : null;
      case 'scratch_list_add': return answer(b, 'ITEM') ? { kind: 'input', target: listOf(b, 'LIST'), place: 'var' } : null;
      case 'scratch_list_insert': return answer(b, 'ITEM') ? { kind: 'input', target: listOf(b, 'LIST'), place: 'insert', index: expr(need(b, 'INDEX')) } : null;
      case 'scratch_list_set': return answer(b, 'ITEM') ? { kind: 'input', target: listOf(b, 'LIST'), place: 'replace', index: expr(need(b, 'INDEX')) } : null;
      default: return null;
    }
  };
  const body = (b: Json, name: string, what: string): Stmt[] => {
    const list = stmts(chain(b.inputs?.[name]?.block));
    if (!list.length) throw new BlockError(t(`「${what}」裡面還沒有積木。`, `There are no blocks inside "${what}".`));
    return list;
  };
  const optionalBody = (b: Json, name: string) => stmts(chain(b.inputs?.[name]?.block));

  const stmt = (b: Json): Stmt[] => {
    switch (b.type) {
      case 'event_say':
      case 'text_print':
        return [{ kind: 'output', value: expr(need(b, 'TEXT')) }];
      case 'scratch_variables_set':
      case 'variables_set': {
        const target = varName(b, 'VAR');
        const v = need(b, 'VALUE');
        if (isPrompt(v)) {
          if (promptIsText(v)) usedAsText.add(target);
          return [{ kind: 'input', target, place: 'var' }];
        }
        if (v.type == 'lists_create_empty') {
          usedAsList.add(target);
          return [{ kind: 'rect', action: '清空', target, round: '' }];
        }
        const { value, round } = valueWithRound(v);
        if (value.t == 'str') usedAsText.add(target);
        return [{ kind: 'rect', action: '設為', target, value, round }];
      }
      case 'scratch_variables_change':
      case 'math_change': {
        const target = varName(b, 'VAR');
        return [{ kind: 'rect', action: '設為', target, round: '', value: { t: 'bin', op: '+', a: { t: 'var', name: target }, b: expr(need(b, 'DELTA')) } }];
      }
      case 'scratch_if':
        return [{ kind: 'if', cond: expr(need(b, 'IF0')), yes: optionalBody(b, 'DO0'), no: [] }];
      case 'scratch_ifElse':
        return [{ kind: 'if', cond: expr(need(b, 'IF0')), yes: optionalBody(b, 'DO0'), no: optionalBody(b, 'ELSE') }];
      case 'controls_if': {
        // 「否則如果」寫成一層一層的「如果…否則」
        const elseIfs = Number(b.extraState?.elseIfCount ?? 0);
        let no = b.extraState?.hasElse ? optionalBody(b, 'ELSE') : [];
        for (let k = elseIfs; k >= 1; k--) {
          no = [{ kind: 'if', cond: expr(need(b, 'IF' + k)), yes: optionalBody(b, 'DO' + k), no }];
        }
        return [{ kind: 'if', cond: expr(need(b, 'IF0')), yes: optionalBody(b, 'DO0'), no }];
      }
      case 'scratch_repeat_ext':
      case 'controls_repeat_ext':
        return [{ kind: 'repeat', times: expr(need(b, 'TIMES')), body: body(b, 'DO', nameOf(b.type)) }];
      case 'controls_repeat':
        return [{ kind: 'repeat', times: { t: 'num', v: String(field(b, 'TIMES') ?? 10) }, body: body(b, 'DO', nameOf(b.type)) }];
      case 'scratch_whileUntil':
      case 'scratch_while':
      case 'controls_whileUntil': {
        // 流程圖的條件迴圈是「重複直到」；「重複當」寫成「重複直到 不成立」
        const cond = expr(need(b, 'BOOL'));
        const until = field(b, 'MODE') == 'UNTIL';
        return [{ kind: 'until', cond: until ? cond : { t: 'not', a: cond }, body: body(b, 'DO', nameOf(b.type)) }];
      }
      case 'scratch_list_add': return [{ kind: 'rect', action: '加入', target: listOf(b, 'LIST'), value: expr(need(b, 'ITEM')), round: '' }];
      case 'scratch_list_insert': return [{ kind: 'rect', action: '插入', target: listOf(b, 'LIST'), index: expr(need(b, 'INDEX')), value: expr(need(b, 'ITEM')), round: '' }];
      case 'scratch_list_set': return [{ kind: 'rect', action: '替換', target: listOf(b, 'LIST'), index: expr(need(b, 'INDEX')), value: expr(need(b, 'ITEM')), round: '' }];
      case 'scratch_list_remove': return [{ kind: 'rect', action: '刪除', target: listOf(b, 'LIST'), index: expr(need(b, 'INDEX')), round: '' }];
      case 'scratch_list_empty': return [{ kind: 'rect', action: '清空', target: listOf(b, 'LIST'), round: '' }];
      case 'lists_setIndex': {
        const list = listInput(b, 'LIST');
        const to = need(b, 'TO');
        const where = field(b, 'WHERE');
        const insert = field(b, 'MODE') == 'INSERT';
        if (where == 'LAST' && insert) {
          return [isPrompt(to) ? { kind: 'input', target: list, place: 'var' } : { kind: 'rect', action: '加入', target: list, value: expr(to), round: '' }];
        }
        if (where != 'FROM_START') throw new BlockError(t('清單的位置請用「第 # 項」或「最後一筆」。', 'Use "#" or "last" for the list position.'));
        const index = expr(need(b, 'AT'));
        if (isPrompt(to)) return [{ kind: 'input', target: list, place: insert ? 'insert' : 'replace', index }];
        return [{ kind: 'rect', action: insert ? '插入' : '替換', target: list, index, value: expr(to), round: '' }];
      }
      case 'lists_getIndex':
        if (field(b, 'MODE') == 'REMOVE' && field(b, 'WHERE') == 'FROM_START') {
          return [{ kind: 'rect', action: '刪除', target: listInput(b, 'VALUE'), index: expr(need(b, 'AT')), round: '' }];
        }
        throw new BlockError(t('刪除清單的項目請用「移除 第 # 項」。', 'Use "remove #" to delete a list item.'));
      case 'scratch_proc_call':
      case 'procedures_callnoreturn':
        return [callStmt(b)];
      case 'event_whenflagclicked':
        throw new BlockError(t('「當綠旗被點擊」只能有一個，而且要放在最上面。', 'There can be only one "when flag clicked", at the top.'));
      case 'scratch_proc_def':
      case 'procedures_defnoreturn':
        throw new BlockError(t('「定義」積木（函式）要自己放一串，不能接在別的積木下面。', 'A "define" block (function) must be on its own, not under other blocks.'));
      default:
        if (RETURN_BLOCKS.has(b.type)) throw returnError();
        throw new BlockError(t(`流程圖沒有「${nameOf(b.type)}」這種積木。`, `The flowchart has no "${nameOf(b.type)}" block.`));
    }
  };

  // ---------------- 從哪裡開始 ----------------
  const allTops = saved.blocks?.blocks ?? [];
  if (allTops.some(b => RETURN_BLOCKS.has(b.type))) throw returnError();
  // 自訂積木／函式的定義各自一串，其他的是主程式
  const isDef = (b: Json) => b.type == 'scratch_proc_def' || b.type == 'procedures_defnoreturn';
  const defBlocks = allTops.filter(isDef);
  const tops = allTops.filter(b => !isDef(b));
  let first: Json | undefined;
  if (scratch) {
    const hats = tops.filter(b => b.type == 'event_whenflagclicked');
    if (hats.length != 1) throw new BlockError(t('要有一個「當綠旗被點擊」，程式接在它下面。', 'You need one "when flag clicked" block, with the program under it.'));
    if (tops.length > 1) throw new BlockError(t('有積木沒有接在「當綠旗被點擊」或「定義」下面：請接上去，或把它拖到左邊刪掉。', 'Some blocks are not under "when flag clicked" or "define". Connect them, or drag them to the left to delete.'));
    first = hats[0].next?.block;
  }
  else {
    if (tops.length > 1) throw new BlockError(t('積木要接成一整串：有積木沒有接上。', 'All blocks must be in one stack. Some blocks are not connected.'));
    first = tops[0];
  }
  // 積木裡看到的每個積木都畫成流程圖的節點（包括最前面「變數設為 …」），學生看到的跟流程圖一樣
  const program = stmts(chain(first));

  // 模組：名稱、參數（Scratch 存在 extraState；Blockly 的參數是變數，存 { name, id }）、裡面的積木
  const known = new Map(current.map(v => [v.name, v]));
  const knownModules = new Map(currentModules.map(m => [m.name, m]));
  const defs = defBlocks.map(b => {
    const name = String(scratch ? b.extraState?.name ?? '' : field(b, 'NAME') ?? '').trim();
    const raw = (b.extraState?.params ?? []) as ({ name: string } | string)[];
    const names = raw.map(p => (typeof p == 'string' ? p : p.name));
    const list = scratch ? chain(b.next?.block) : chain(b.inputs?.STACK?.block);
    return { name, names, list };
  });
  const seen = new Set<string>();
  for (const d of defs) {
    if (!d.name) throw new BlockError(t('有「定義」積木還沒有名字。', 'A "define" block has no name.'));
    if (seen.has(d.name)) throw new BlockError(t(`有兩個都叫「${d.name}」的積木（函式）。`, `Two blocks (functions) are both called "${d.name}".`));
    seen.add(d.name);
  }
  const modules: ModuleProgram[] = defs.map(d => ({ name: d.name, params: [], body: stmts(d.list) }));
  // 執行的自訂積木要有定義，參數個數也要一樣
  for (const [name, calls] of callArgs) {
    const d = defs.find(x => x.name == name);
    if (!d) throw new BlockError(t(`「${name}」這個積木（函式）沒有定義。`, `"${name}" is used but never defined.`));
    if (calls.some(a => a.length != d.names.length)) throw new BlockError(t(`執行「${name}」時參數的個數不對。`, `"${name}" is run with the wrong number of values.`));
  }
  /** 參數是數字還是文字：原本的模組有的照原本；沒有的看執行時傳了什麼（有傳文字就是文字） */
  const isTextValue = (e: Expr) => e.t == 'str' || (e.t == 'var' && (known.get(e.name)?.type == '文字' || usedAsText.has(e.name)));
  modules.forEach((m, k) => {
    const old = knownModules.get(m.name);
    m.params = defs[k].names.map((p, i): ParamInfo => {
      const type = old?.params.find(x => x.name == p)?.type
        ?? ((callArgs.get(m.name) ?? []).some(a => a[i] && isTextValue(a[i])) ? '文字' : '數字');
      return { name: p, type };
    });
  });
  // Blockly 的函式參數也是變數，但不是變數表的變數
  const paramNames = new Set(defs.flatMap(d => d.names));

  // 變數表：原本就有的照原本的型別；新的看用法（清單積木 → 清單，存文字 → 文字，其他 → 數字）。
  // 初始值一律用預設值（數字 0、文字空的）：toBlockly 把不是預設值的初始值寫成了最前面的積木，
  // 現在那些積木變成流程圖上的節點，變數表再留著初始值的話，下次轉成積木會重複
  const names = [...new Set([...(saved.variables ?? []).map(v => v.name), ...usedAsList])].filter(n => !paramNames.has(n));
  const vars: VarInfo[] = names.map(name => {
    const old = known.get(name);
    const listType = (saved.variables ?? []).find(v => v.name == name)?.type == 'list' || usedAsList.has(name);
    const type: VarInfo['type'] = old?.type ?? (listType ? '清單' : usedAsText.has(name) ? '文字' : '數字');
    if (type == '清單') return { name, type, init: old?.type == '清單' ? old.init : '數字' };
    return { name, type, init: type == '數字' ? '0' : '' };
  });
  return { program, vars, modules };
}
