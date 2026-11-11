// 「看程式」的 Scratch / Blockly 積木外觀，照 individual_demo（資訊科技全國賽個人賽練習網頁）的積木定義：
// https://github.com/franktang0512/individual_demo/blob/main/src/lib/blockly-workspace/scratch.ts
// 學生在流程圖看到的積木，跟比賽練習環境裡的長得一樣。這裡只需要「長相」（只能看），
// 所以沒有搬執行用的 JavaScript 產生器；積木的欄位名稱（VAR、LIST、ITEM、INDEX…）要跟原本的一樣。
//
// Blockly 是從 CDN 載入的模組（見 CodeView），所以這裡用參數拿到它。

// 綠旗（自己畫的簡單圖示）
const FLAG = 'data:image/svg+xml,' + encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20"><path d="M4 2v17" stroke="#3f7a1f" stroke-width="2" stroke-linecap="round"/><path d="M5 3c4-2 6 2 11 0v8c-5 2-7-2-11 0z" fill="#4cbf2b" stroke="#3f7a1f" stroke-width="1"/></svg>',
);

type B = any;

/** 註冊 Scratch 積木，並建立 Scratch / Blockly 兩種外觀（主題）；回傳兩個主題。zh：Blockly 內建積木是不是用中文 */
export function defineBlocks(Blockly: B, zh: boolean): { scratch: B; blockly: B } {
  const blocks = Blockly.Blocks;
  const listField = () => new Blockly.FieldVariable('', undefined, ['list'], 'list');
  const varField = () => new Blockly.FieldVariable('', undefined, ['']);
  /** 一般積木（上下可以接） */
  const statement = (b: B, style: string) => {
    b.setInputsInline(true);
    b.setPreviousStatement(true, null);
    b.setNextStatement(true, null);
    b.setStyle(style);
  };
  /** 有值的積木（圓的、六角形的） */
  const reporter = (b: B, style: string, check: string | null = null) => {
    b.setInputsInline(true);
    b.setOutput(true, check);
    b.setStyle(style);
  };

  blocks.event_whenflagclicked = {
    init(this: B) {
      this.appendDummyInput().appendField('當').appendField(new Blockly.FieldImage(FLAG, 20, 20, '*')).appendField('被點擊');
      this.setNextStatement(true, null);
      this.setColour('#FFBF00');
    },
  };
  blocks.scratch_text = {
    init(this: B) {
      this.appendDummyInput().appendField(new Blockly.FieldTextInput(''), 'TEXT');
      this.setOutput(true, ['Number', 'String']);
      this.setColour('#FFFFFF');
    },
  };
  blocks.event_askandwait = {
    init(this: B) {
      this.appendValueInput('TEXT').setCheck(null).appendField('詢問');
      this.appendDummyInput().appendField('並等待');
      statement(this, 'event_category');
      this.setColour('#5CB1D6');
    },
  };
  blocks.event_answer = {
    init(this: B) {
      this.appendDummyInput().appendField('詢問的答案');
      reporter(this, 'event_category');
      this.setColour('#5CB1D6');
    },
  };
  blocks.event_say = {
    init(this: B) {
      this.appendValueInput('TEXT').setCheck(null).appendField('說出');
      statement(this, 'event_category');
      this.setColour('#9966FF');
    },
  };

  blocks.scratch_string_join = {
    init(this: B) {
      this.appendValueInput('TEXT0').setCheck(null).appendField('字串組合');
      this.appendValueInput('TEXT1').setCheck(null);
      reporter(this, 'calculation_blocks', 'String');
      this.setColour('#36BF36');
    },
  };
  blocks.scratch_string_char_at = {
    init(this: B) {
      this.appendValueInput('STRING').setCheck(null).appendField('字串');
      this.appendValueInput('INDEX').setCheck(null).appendField('的第');
      this.appendDummyInput().appendField('字');
      reporter(this, 'calculation_blocks', 'String');
    },
  };
  blocks.scratch_string_contains = {
    init(this: B) {
      this.appendValueInput('STRING1').setCheck(null).appendField('字串');
      this.appendValueInput('STRING2').setCheck(null).appendField('包含');
      reporter(this, 'calculation_blocks', 'Boolean');
    },
  };
  blocks.scratch_length = {
    init(this: B) {
      this.appendValueInput('VALUE').setCheck(null).appendField('取得');
      this.appendDummyInput().appendField('的長度');
      reporter(this, 'calculation_blocks', 'Number');
    },
  };

  blocks.scratch_if = {
    init(this: B) {
      this.appendValueInput('IF0').setCheck('Boolean').appendField('如果');
      this.appendDummyInput().appendField('那麼');
      this.appendStatementInput('DO0').setCheck(null);
      this.setPreviousStatement(true, null);
      this.setNextStatement(true, null);
      this.setStyle('control_blocks');
    },
  };
  blocks.scratch_ifElse = {
    init(this: B) {
      this.appendValueInput('IF0').setCheck('Boolean').appendField('如果');
      this.appendDummyInput().appendField('那麼');
      this.appendStatementInput('DO0').setCheck(null);
      this.appendDummyInput().appendField('否則');
      this.appendStatementInput('ELSE').setCheck(null);
      statement(this, 'control_blocks');
    },
  };
  blocks.scratch_repeat_ext = {
    init(this: B) {
      this.appendValueInput('TIMES').setCheck(null).appendField('重複');
      this.appendDummyInput().appendField('次');
      this.appendStatementInput('DO').setCheck(null);
      statement(this, 'control_blocks');
    },
  };
  blocks.scratch_whileUntil = {
    init(this: B) {
      this.appendValueInput('BOOL').setCheck('Boolean').appendField('重複')
        .appendField(new Blockly.FieldDropdown([['直到', 'UNTIL'], ['當', 'WHILE']]), 'MODE');
      this.appendStatementInput('DO').setCheck(null);
      statement(this, 'control_blocks');
    },
  };

  blocks.scratch_math_arithmetic = {
    init(this: B) {
      this.appendValueInput('A').setCheck(null);
      this.appendValueInput('B').setCheck(null)
        .appendField(new Blockly.FieldDropdown([['+', 'ADD'], ['-', 'MINUS'], ['*', 'MULTIPLY'], ['/', 'DIVIDE']]), 'OP');
      reporter(this, 'calculation_blocks', 'Number');
      this.setColour('#36BF36');
    },
  };
  blocks.scratch_logic_compare = {
    init(this: B) {
      this.appendValueInput('A').setCheck(null);
      this.appendValueInput('B').setCheck(null)
        .appendField(new Blockly.FieldDropdown([['=', 'EQ'], ['≠', 'NEQ'], ['<', 'LT'], ['>', 'GT'], ['≤', 'LTE'], ['≥', 'GTE']]), 'OP');
      reporter(this, 'calculation_blocks', 'Boolean');
    },
  };

  blocks.scratch_variables_set = {
    init(this: B) {
      this.appendDummyInput().appendField('變數').appendField(varField(), 'VAR').appendField('設為');
      this.appendValueInput('VALUE').setCheck(null);
      statement(this, 'variable_blocks');
    },
  };
  blocks.scratch_variables_get = {
    init(this: B) {
      this.appendDummyInput().appendField(varField(), 'VAR');
      reporter(this, 'variable_blocks');
      this.setColour('#FF9900');
    },
  };

  blocks.scratch_list_get = {
    init(this: B) {
      this.appendDummyInput().appendField(listField(), 'LIST');
      reporter(this, 'list_blocks');
    },
  };
  blocks.scratch_list_add = {
    init(this: B) {
      this.appendValueInput('ITEM').setCheck(null).appendField('添加');
      this.appendDummyInput().appendField('到').appendField(listField(), 'LIST');
      statement(this, 'list_blocks');
    },
  };
  blocks.scratch_list_get_item = {
    init(this: B) {
      this.appendDummyInput().appendField(listField(), 'LIST');
      this.appendValueInput('INDEX').setCheck(null).appendField('的第');
      this.appendDummyInput().appendField('項');
      reporter(this, 'list_blocks');
    },
  };
  blocks.scratch_list_empty = {
    init(this: B) {
      this.appendDummyInput().appendField('刪除').appendField(listField(), 'LIST').appendField('的所有項目');
      statement(this, 'list_blocks');
    },
  };
  blocks.scratch_list_length = {
    init(this: B) {
      this.appendDummyInput().appendField('清單').appendField(listField(), 'LIST').appendField('的長度');
      reporter(this, 'list_blocks', 'Number');
    },
  };
  blocks.scratch_list_insert = {
    init(this: B) {
      this.appendValueInput('ITEM').setCheck(null).appendField('插入');
      this.appendDummyInput().appendField('到').appendField(listField(), 'LIST');
      this.appendValueInput('INDEX').setCheck(null).appendField('的第');
      this.appendDummyInput().appendField('項');
      statement(this, 'list_blocks');
    },
  };
  blocks.scratch_list_set = {
    init(this: B) {
      this.appendDummyInput().appendField('替換').appendField(listField(), 'LIST');
      this.appendValueInput('INDEX').setCheck(null).appendField('的第');
      this.appendValueInput('ITEM').setCheck(null).appendField('項為');
      statement(this, 'list_blocks');
    },
  };
  blocks.scratch_list_remove = {
    init(this: B) {
      this.appendDummyInput().appendField('刪除').appendField(listField(), 'LIST');
      this.appendValueInput('INDEX').setCheck(null).appendField('的第');
      this.appendDummyInput().appendField('項');
      statement(this, 'list_blocks');
    },
  };
  blocks.scratch_list_contain = {
    init(this: B) {
      this.appendDummyInput().appendField('清單').appendField(listField(), 'LIST').appendField('包含');
      this.appendValueInput('ITEM').setCheck(null);
      this.appendDummyInput().appendField('?');
      reporter(this, 'list_blocks', 'Boolean');
    },
  };
  blocks.scratch_list_indexof = {
    init(this: B) {
      this.appendValueInput('ITEM').setCheck(null);
      this.appendDummyInput().appendField('在').appendField(listField(), 'LIST').appendField('裡的項目編號');
      reporter(this, 'list_blocks', 'Number');
    },
  };

  // Blockly 模式：內建積木，「設定變數」改成跟練習網頁一樣的說法
  if (zh) {
    Blockly.Msg.VARIABLES_SET = '將 %1 設為 %2';
    Blockly.Msg.MATH_CHANGE_TITLE = '將 %1 的值加 %2';
  }

  // 主題的顏色照練習網頁（Scratch 的配色：https://github.com/scratchfoundation/scratch-blocks/wiki/Colors）
  const style = (primary: string, secondary: string, tertiary: string) => ({ colourPrimary: primary, colourSecondary: secondary, colourTertiary: tertiary });
  const control = style('#FFAB19', '#EC9C13', '#CC9900');
  const calculation = style('#59C059', '#46B946', '#389438');
  const workspace = { workspaceBackgroundColour: '#f9fafb', scrollbarColour: '#d1d5db', scrollbarOpacity: 0.4 };
  const scratch = Blockly.Theme.defineTheme('flowchart_scratch', {
    name: 'flowchart_scratch',
    base: Blockly.Themes.Classic,
    blockStyles: {
      event_category: style('#5CB1D6', '#4AA8C4', '#4098B0'),
      control_blocks: control,
      loop_blocks: control,
      calculation_blocks: calculation,
      math_blocks: calculation,
      logic_blocks: calculation,
      variable_blocks: style('#FF8C1A', '#FF8000', '#DB6E00'),
      list_blocks: style('#FD6723', '#ea580c', '#c2410c'),
    },
    // 編輯模式的工具箱分類顏色
    categoryStyles: {
      event_category: { colour: '#5CB1D6' },
      control_category: { colour: '#FFAB19' },
      calculation_category: { colour: '#59C059' },
      variable_category: { colour: '#FF8C1A' },
      list_category: { colour: '#FD6723' },
    },
    componentStyles: workspace,
    fontStyle: { weight: 'bold' },
    startHats: true,
  });
  const blockly = Blockly.Theme.defineTheme('flowchart_blockly', {
    name: 'flowchart_blockly',
    base: Blockly.Themes.Classic,
    componentStyles: workspace,
    fontStyle: { weight: 'normal' },
    startHats: false,
  });
  return { scratch, blockly };
}

// ---------------- 編輯模式的工具箱（只放流程圖做得到的積木） ----------------

/** 空格裡預設的白色小積木 */
const text = (v: string) => ({ shadow: { type: 'scratch_text', fields: { TEXT: v } } });
const num = (v: number) => ({ shadow: { type: 'math_number', fields: { NUM: v } } });
const block = (type: string, inputs?: Record<string, unknown>) => ({ kind: 'block', type, ...(inputs ? { inputs } : {}) });

/** Scratch 的工具箱：分類跟練習網頁一樣；變數、清單是動態的（看目前有哪些變數） */
export const scratchToolbox = () => ({
  kind: 'categoryToolbox',
  contents: [
    {
      kind: 'category', name: '事件', categorystyle: 'event_category', contents: [
        block('event_whenflagclicked'),
        block('event_askandwait', { TEXT: text('') }),
        block('event_answer'),
        block('event_say', { TEXT: text('Hello!') }),
      ],
    },
    {
      kind: 'category', name: '控制', categorystyle: 'control_category', contents: [
        block('scratch_if'),
        block('scratch_ifElse'),
        block('scratch_repeat_ext', { TIMES: text('10') }),
        block('scratch_whileUntil'),
      ],
    },
    {
      kind: 'category', name: '運算', categorystyle: 'calculation_category', contents: [
        block('scratch_math_arithmetic', { A: text(''), B: text('') }),
        block('math_modulo', { DIVIDEND: text(''), DIVISOR: text('') }),
        block('math_round', { NUM: text('') }),
        block('scratch_logic_compare', { A: text(''), B: text('50') }),
        block('logic_operation'),
        block('logic_negate'),
        block('scratch_string_join', { TEXT0: text('apple'), TEXT1: text('banana') }),
        block('scratch_string_char_at', { STRING: text('apple'), INDEX: text('1') }),
        block('scratch_string_contains', { STRING1: text('apple'), STRING2: text('a') }),
        block('scratch_length', { VALUE: text('apple') }),
      ],
    },
    { kind: 'category', name: '變數', categorystyle: 'variable_category', custom: 'SCRATCH_VARIABLES' },
    { kind: 'category', name: '清單', categorystyle: 'list_category', custom: 'SCRATCH_LISTS' },
  ],
});

/** Blockly 的工具箱：內建積木（變數用 Blockly 內建的變數分類） */
export const blocklyToolbox = (zh: boolean) => ({
  kind: 'categoryToolbox',
  contents: [
    { kind: 'category', name: zh ? '邏輯' : 'Logic', categorystyle: 'logic_category', contents: [block('controls_if'), block('logic_compare'), block('logic_operation'), block('logic_negate')] },
    { kind: 'category', name: zh ? '迴圈' : 'Loops', categorystyle: 'loop_category', contents: [block('controls_repeat_ext', { TIMES: num(10) }), block('controls_whileUntil')] },
    {
      kind: 'category', name: zh ? '數學' : 'Math', categorystyle: 'math_category', contents: [
        block('math_number'), block('math_arithmetic', { A: num(1), B: num(1) }), block('math_modulo', { DIVIDEND: num(64), DIVISOR: num(10) }),
        block('math_round', { NUM: num(3.1) }), block('math_single', { NUM: num(9) }),
      ],
    },
    {
      kind: 'category', name: zh ? '文字' : 'Text', categorystyle: 'text_category', contents: [
        block('text'), block('text_join'), block('text_length'), block('text_indexOf'), block('text_charAt'),
        block('text_print', { TEXT: { shadow: { type: 'text', fields: { TEXT: 'abc' } } } }),
        block('text_prompt_ext', { TEXT: { shadow: { type: 'text', fields: { TEXT: '' } } } }),
      ],
    },
    {
      kind: 'category', name: zh ? '清單' : 'Lists', categorystyle: 'list_category', contents: [
        block('lists_create_empty'), block('lists_length'), block('lists_indexOf'), block('lists_getIndex'), block('lists_setIndex'),
      ],
    },
    { kind: 'category', name: zh ? '變數' : 'Variables', categorystyle: 'variable_category', custom: 'VARIABLE' },
  ],
});

/** 編輯模式：Scratch 的「變數」「清單」分類列出目前的變數，並有「建立變數」「建立清單」按鈕 */
export function setupScratchEditing(Blockly: B, workspace: B) {
  const create = (type: string) => (button: B) => Blockly.Variables.createVariableButtonHandler(button.getTargetWorkspace(), undefined, type);
  workspace.registerButtonCallback('CREATE_SCRATCH_VARIABLE', create(''));
  workspace.registerButtonCallback('CREATE_SCRATCH_LIST', create('list'));
  const ref = (v: B, type: string) => ({ name: v.name, type });

  workspace.registerToolboxCategoryCallback('SCRATCH_VARIABLES', (ws: B) => {
    const vars: B[] = ws.getVariablesOfType('');
    const items: unknown[] = [{ kind: 'button', text: '建立變數', callbackkey: 'CREATE_SCRATCH_VARIABLE' }];
    if (vars.length) items.push({ kind: 'block', type: 'scratch_variables_set', fields: { VAR: ref(vars[0], '') }, inputs: { VALUE: text('0') } });
    for (const v of vars) items.push({ kind: 'block', type: 'scratch_variables_get', fields: { VAR: ref(v, '') } });
    return items;
  });

  workspace.registerToolboxCategoryCallback('SCRATCH_LISTS', (ws: B) => {
    const lists: B[] = ws.getVariablesOfType('list');
    const items: unknown[] = [{ kind: 'button', text: '建立清單', callbackkey: 'CREATE_SCRATCH_LIST' }];
    if (!lists.length) return items;
    const LIST = ref(lists[0], 'list');
    for (const v of lists) items.push({ kind: 'block', type: 'scratch_list_get', fields: { LIST: ref(v, 'list') } });
    items.push(
      { kind: 'block', type: 'scratch_list_add', fields: { LIST }, inputs: { ITEM: text('thing') } },
      { kind: 'block', type: 'scratch_list_remove', fields: { LIST }, inputs: { INDEX: text('1') } },
      { kind: 'block', type: 'scratch_list_empty', fields: { LIST } },
      { kind: 'block', type: 'scratch_list_insert', fields: { LIST }, inputs: { ITEM: text('thing'), INDEX: text('1') } },
      { kind: 'block', type: 'scratch_list_set', fields: { LIST }, inputs: { INDEX: text('1'), ITEM: text('thing') } },
      { kind: 'block', type: 'scratch_list_get_item', fields: { LIST }, inputs: { INDEX: text('1') } },
      { kind: 'block', type: 'scratch_list_indexof', fields: { LIST }, inputs: { ITEM: text('thing') } },
      { kind: 'block', type: 'scratch_list_length', fields: { LIST } },
      { kind: 'block', type: 'scratch_list_contain', fields: { LIST }, inputs: { ITEM: text('thing') } },
    );
    return items;
  });
}
