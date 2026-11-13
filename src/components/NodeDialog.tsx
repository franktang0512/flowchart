// 新增/編輯積木、選箭頭標籤、清空流程圖時跳出的對話框（舊版 shapes.js 的 node_model）。
// 版面要跟舊版一模一樣，所以元素之間的空白（{' '}）與 <p> 的巢狀方式都照舊版 HTML 被瀏覽器解析後的結果。
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { localTypes, type VarStore } from '../engine/decoder';
import type { RectAction } from '../engine/labels';
import { cppType, GLOBAL_PREFIX, type LocalVar, type ModuleInfo, type ParamInfo } from '../engine/modules';
import { t, useLang } from '../i18n';
import { byTarget, canReturn as canReturnTarget, getTarget, itemWord } from '../target';

export type DialogKind =
  | 'Circle' | 'Parallelogram' | 'Diamond' | 'Loop' | 'For_Loop' | 'While_Loop'
  | 'Function' | 'Rectangle' | 'link_tf' | 'link_for' | 'clear';

export interface DialogForm {
  radio: string;
  varSelect: string;
  varSelectOutput: string;
  code: string;
  forNumber: string;
  doingSomething: string;
  /** 輸入/輸出積木的提示文字：「變數：」或「變數或字串：」 */
  ioText: string;
  /** undefined = 預設（行內）；舊版切換後會設成 inline-block / none */
  varSelectDisplay?: 'inline-block' | 'none';
  varSelectOutputDisplay: 'inline-block' | 'none';
  /** 迴圈：顯示「達成某個條件」(while) 還是「執行完幾次」(for) 的輸入欄 */
  showWhile: boolean;
  /**
   * 計算積木先選要改什麼（跟輸入積木一樣先選類型）：變數、清單、二維清單（C++）、回傳（有回傳值的模組）、
   * 接收（執行有回傳值的模組，把回傳值存進變數：「a 設為 aaa(x)」，模組和參數用 moduleName、moduleArgs）；
   * '' = 還沒選。選了清單、二維清單再選 rectAction（添加、插入…）
   */
  rectKind: '' | '變數' | '清單' | '二維清單' | '回傳' | '接收';
  /** 計算積木：「設為」一般的設定，其他是清單的操作（見 RectAction） */
  rectAction: RectAction;
  /** 變數：true 是「改變」（Scratch「變數改變」、Blockly「將變數的值加」），code 填加多少；存成「x 設為 x + 多少」 */
  varChange: boolean;
  /** 第幾項：計算積木的「插入」「替換」「刪除」，輸入到清單的「插入」「替換」；二維清單是第幾列（建立時是幾列） */
  rectIndex: string;
  /** 二維清單：第幾行（建立時是幾行） */
  rectIndex2: string;
  /** 輸入積木要存到變數、清單還是二維清單的一格；'' = 還沒選（先選類型才出現下拉選單） */
  ioTarget: '' | '變數' | '清單' | '二維清單';
  /** 輸入到清單時放在哪裡：添加到最後、插入到第幾項、替換第幾項（對應 Scratch 的清單積木） */
  ioPlace: '加入' | '插入' | '替換';
  /** 輸出積木輸出什麼：'' 是變數或字串（自己打）；'回傳' 是執行有回傳值的模組、輸出回傳值（moduleName、moduleArgs） */
  outputKind: '' | '回傳';
  /** 執行模組：哪個模組、每個參數要用的值 */
  moduleName: string;
  moduleArgs: string[];
}

// 清單操作的名稱照 Scratch 的清單積木，下一堂改用 Scratch 時說法一樣
const RECT_ACTIONS: [RectAction, () => string][] = [
  ['設為', () => t('設定變數', 'Set')],
  ['加入', () => t('添加', 'Add')],
  ['插入', () => t('插入', 'Insert')],
  ['替換', () => t('替換', 'Replace')],
  ['刪除', () => byTarget(t('刪除第幾項', 'Delete item'), t('刪除某個索引', 'Delete at index'))],
  ['清空', () => t('刪除所有項目', 'Delete all')],
  // 只有變數表裡有二維清單（C++）時才出現
  ['建立', () => t('建立二維清單', 'Make 2D list')],
  // 只有在有回傳值的模組裡才出現
  ['回傳', () => t('回傳', 'Return')],
];

const RECT_HINT: Record<RectAction, () => string> = {
  設為: () => t('將變數內的值設為...', 'Set a variable to...'),
  加入: () => t('把值添加到清單的最後面...', 'Add a value to the end of a list...'),
  插入: () => t(`把值插到清單的${byTarget('第幾項', '某個索引')}，原本那項和後面的都往後移...`, 'Put a value into a list. The items after it move back...'),
  替換: () => t(`把清單的${byTarget('第幾項', '某個索引')}換成新的值...`, 'Change one item of a list...'),
  刪除: () => t(`刪除清單的${byTarget('第幾項', '某個索引')}，後面的都往前移...`, 'Delete one item from a list. The items after it move up...'),
  清空: () => t('刪除清單的所有項目，清單會變成空的...', 'Delete all items. The list will be empty...'),
  建立: () => t('設定二維清單有幾列、幾行，每一格先放 0（裝文字的放空的文字）...', 'Set how many rows and columns. Every cell starts as 0 (or empty text)...'),
  回傳: () => t('把這個值交回給執行模組的地方，然後離開模組（後面直接接「結束」）...', 'Give this value back and leave the module (go straight to "End")...'),
};

/** 「第幾項」欄位前面的字（沒有這欄的是 null）；C++ 說「索引」 */
const RECT_INDEX: Record<RectAction, (() => string) | null> = {
  設為: null,
  加入: null,
  插入: () => byTarget(t('插到第', 'At item'), t('插到索引', 'At index')),
  替換: () => byTarget(t('替換第', 'Item'), t('替換索引', 'Index')),
  刪除: () => byTarget(t('刪除第', 'Delete item'), t('刪除索引', 'Delete index')),
  清空: null,
  建立: () => t('列數', 'Rows'),
  回傳: null,
};

/** 「第幾項」欄位後面的字：積木是「項」，C++ 沒有 */
const indexSuffix = () => byTarget(t('項', ''), '');

/** 值的輸入欄前面的字（沒有值的是 null） */
const RECT_VERB: Record<RectAction, (() => string) | null> = {
  設為: () => t('設為', 'to'),
  加入: () => t('添加', 'add'),
  插入: () => t('插入', 'insert'),
  替換: () => t('換成', 'with'),
  刪除: null,
  清空: null,
  建立: null,
  回傳: () => t('回傳', 'return'),
};

const DEFAULT_RADIO: Partial<Record<DialogKind, string>> = {
  Circle: '開始',
  Parallelogram: '輸入',
  Loop: 'for',
  For_Loop: 'for',
  While_Loop: 'for',
  Rectangle: '',
  link_tf: '真',
  link_for: '進入迴圈',
};

export const defaultForm = (kind: DialogKind): DialogForm => ({
  radio: DEFAULT_RADIO[kind] ?? '',
  varSelect: '',
  varSelectOutput: '',
  code: '',
  forNumber: '',
  doingSomething: '',
  ioText: '變數：',
  varSelectOutputDisplay: 'none',
  showWhile: false,
  rectKind: '',
  rectAction: '設為',
  varChange: false,
  rectIndex: '',
  rectIndex2: '',
  ioTarget: '',
  ioPlace: '加入',
  outputKind: '',
  moduleName: '',
  moduleArgs: [],
});

export interface DialogRequest {
  /** 每次開對話框都不同，用來重設表單 */
  id: number;
  kind: DialogKind;
  initial?: Partial<DialogForm>;
  /** 按「確認」；回傳 true 才關閉（檢查沒過就留著讓學生改） */
  onYes: (form: DialogForm) => boolean;
  /** 按「取消」 */
  onNo?: () => void;
  /** 按 Esc 關掉 */
  onDismiss?: () => void;
  /** 在有回傳值的模組裡：計算積木可以選「回傳」 */
  canReturn?: boolean;
  /** 在模組裡：這個模組的參數（「設定變數」「輸入到變數」的下拉選單也列出來） */
  params?: ParamInfo[];
  /** 在模組裡：這個模組的區域變數（只有 C++） */
  locals?: LocalVar[];
  /** 這個積木在模組的流程圖裡 */
  inModule?: boolean;
}

/** 變數表裡各型別的變數名稱，給下拉選單用 */
export type VarTypes = VarStore['type_var_list'];

interface Props {
  request: DialogRequest | null;
  onClose: () => void;
  varTypes: VarTypes;
  /** 可以執行的模組（「執行模組」積木的下拉選單） */
  modules: ModuleInfo[];
}

/**
 * 選變數的下拉選單（像 Scratch 一樣用選的，不會打錯字），只列出一種類型的變數。
 * 舊作品裡填的值不在選項裡時，也放進選項，打開修改才不會被清掉。
 */
function VarPicker({ id, value, onChange, names, params = [], locals = [] }: { id: string; value: string; onChange: (v: string) => void; names: string[]; params?: string[]; locals?: string[] }) {
  // 參數：Blockly、C++ 可以改，Scratch 不行（列出來但不能選，學生才知道參數也是一種變數）
  const readOnly = getTarget() == 'scratch';
  const all = [...names, ...params, ...locals];
  // 在模組裡才分組：全域變數、參數、區域變數（C++）
  const grouped = params.length + locals.length > 0;
  return (
    <select className="var_select" id={id} value={value} onChange={e => onChange(e.target.value)}>
      <option value="" disabled>{all.length ? t('請選擇', 'Choose one') : t('請先到左邊的變數表新增', 'Add one in the variable table first')}</option>
      {value && !all.includes(value) && <option value={value}>{value}</option>}
      {grouped && names.length > 0 && <option disabled>{t('── 主流程的變數 ──', '── Main-flow variables ──')}</option>}
      {names.map(name => <option key={name} value={name}>{name}</option>)}
      {params.length > 0 && <option disabled>{readOnly ? t('── 參數（Scratch 的參數不能改）──', '── Parameters (cannot change in Scratch) ──') : t('── 這個模組的參數 ──', '── Parameters of this module ──')}</option>}
      {params.map(name => <option key={'p_' + name} value={name} disabled={readOnly}>{name}</option>)}
      {locals.length > 0 && <option disabled>{t('── 這個模組的區域變數 ──', '── Local variables of this module ──')}</option>}
      {locals.map(name => <option key={'l_' + name} value={name}>{name}</option>)}
    </select>
  );
}

/** 輸入到清單時，下面那行說明 */
const IO_NOTE: Record<DialogForm['ioPlace'], (list: string, k: string) => string> = {
  加入: list => t(`輸入的值會添加到清單「${list}」的最後面`, `The value goes to the end of the list "${list}".`),
  插入: (list, k) => t(`輸入的值會插到清單「${list}」的${itemWord(k || '?')}，原本那項和後面的都往後移`, `The value goes to ${itemWord(k || '?')} of "${list}". The items after it move back.`),
  替換: (list, k) => t(`輸入的值會換掉清單「${list}」的${itemWord(k || '?')}`, `The value replaces ${itemWord(k || '?')} of "${list}".`),
};

export function NodeDialog({ request, onClose, varTypes, modules }: Props) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = ref.current!;
    if (request && !dialog.open) dialog.showModal();
    if (!request && dialog.open) dialog.close();
  }, [request]);

  return (
    <dialog
      id="node_info"
      ref={ref}
      onCancel={() => {
        // 按 Esc：舊版只是關掉對話框，不會執行「取消」的動作
        request?.onDismiss?.();
        onClose();
      }}
    >
      {request && <DialogBody key={request.id} request={request} onClose={onClose} varTypes={varTypes} modules={modules} />}
    </dialog>
  );
}

function DialogBody({ request, onClose, varTypes, modules }: { request: DialogRequest; onClose: () => void; varTypes: VarTypes; modules: ModuleInfo[] }) {
  const { kind } = request;
  useLang();
  /** 在模組裡：區域變數照型別分好；allTypes 是全域加區域（判斷選到的是哪一種用） */
  const localT = localTypes(request.locals);
  // 跟參數、區域變數同名的全域變數：在模組裡被蓋住，選單不列出來
  // 在模組裡，主流程的變數：C++ 用不到（寫在 main 裡）；跟參數、區域變數同名的被蓋住——
  // Scratch 改列成「主流程的a」（Scratch 分得開），Blockly 就不列
  const own = new Set([...(request.params ?? []).map(p => p.name), ...Object.values(localT).flat()]);
  const target = getTarget();
  const shown = (list: string[]) => (!request.inModule ? list
    : target == 'cpp' ? []
    : list.flatMap(n => (!own.has(n) ? [n] : target == 'scratch' ? [GLOBAL_PREFIX + n] : [])));
  varTypes = { number: shown(varTypes.number), text: shown(varTypes.text), array: shown(varTypes.array), grid: shown(varTypes.grid) };
  const allTypes: VarTypes = {
    number: [...varTypes.number, ...localT.number],
    text: [...varTypes.text, ...localT.text],
    array: [...varTypes.array, ...localT.array],
    grid: [...varTypes.grid, ...localT.grid],
  };
  const [f, setF] = useState<DialogForm>(() => {
    const form = { ...defaultForm(kind), ...request.initial };
    // 打開已經畫好的輸入積木：依變數表判斷原本存到變數還是清單
    if (form.radio == '輸入' && !form.ioTarget && form.varSelect) {
      form.ioTarget = allTypes.grid.includes(form.varSelect) ? '二維清單' : form.ioPlace != '加入' || allTypes.array.includes(form.varSelect) ? '清單' : '變數';
    }
    return form;
  });
  const set = (patch: Partial<DialogForm>) => setF(prev => ({ ...prev, ...patch }));
  /** 在模組裡：這個模組的參數（數字、文字都可以設定） */
  const paramNames = (request.params ?? []).map(p => p.name);
  /** 輸入積木「存到」選的那一類變數 */
  const ioNames = (ty: VarTypes) => (f.ioTarget == '清單' ? ty.array : f.ioTarget == '二維清單' ? ty.grid : [...ty.number, ...ty.text]);

  const yes = () => {
    if (request.onYes(f)) onClose();
  };
  const no = () => {
    request.onNo?.();
    onClose();
  };
  const buttons = (
    <>
      <button id="hint_yes" onClick={yes}>{t('確認', 'OK')}</button>{' '}
      <button id="hint_no" onClick={no}>{t('取消', 'Cancel')}</button>
    </>
  );
  const radio = (value: string, label: string, onPick?: () => void) => (
    <>
      <input
        type="radio" name="radio" value={value}
        checked={f.radio == value}
        onChange={() => { set({ radio: value }); onPick?.(); }}
      />{label}
    </>
  );
  // 只有 id="code" 的欄位按 Enter 會直接確認
  const codeInput = (
    <input
      id="code" style={{ width: '80%' }} value={f.code}
      onChange={e => set({ code: e.target.value })}
      onKeyDown={e => { if (e.key == 'Enter') { e.preventDefault(); yes(); } }}
    />
  );
  /** 執行模組時每個參數要填的值（執行模組、接收模組回傳值共用） */
  const argFields = (m: ModuleInfo) => (m.params.length == 0
    ? <p className="dialog_note">{t('這個模組沒有參數。', 'This module has no parameters.')}</p>
    : (
      <div className="module_args">
        {m.params.map((p, k) => (
          <p key={p.name}>
            <label>
              {p.name}<span className="muted">（{getTarget() == 'cpp' ? cppType(p.type, p.float) : p.type == '文字' ? t('文字', 'text') : t('數字', 'number')}）</span>{' = '}
              <input
                value={f.moduleArgs[k] ?? ''}
                onChange={e => {
                  const args = [...f.moduleArgs];
                  args[k] = e.target.value;
                  set({ moduleArgs: args });
                }}
              />
            </label>
          </p>
        ))}
        <span className="dialog_note">{t('可以填數字、"文字"、變數或算式', 'Use a number, "text", a variable or math')}</span>
      </div>
    ));
  /** 有回傳值的模組（Scratch 的模組不能回傳） */
  const returningModules = modules.filter(x => x.returns);
  /** 回傳值的型別（給學生看） */
  const returnLabel = (m: ModuleInfo) => (m.returns == null ? ''
    : getTarget() == 'cpp' ? ' ' + cppType(m.returns, m.returnsFloat)
    : m.returns == '文字' ? t('文字', 'text') : t('數字', 'a number'));
  const conditionHint = <p id="hint">{t('請輸入邏輯判斷式，', 'Write a condition: ')}and, or, not &lt; &gt; = </p>;

  let body: ReactNode;
  switch (kind) {
    case 'Circle':
      body = (
        <>
          <p id="hint">{t('請選擇開始或結束', 'Start or End?')}</p>{' '}
          {radio('開始', t('開始', 'Start'))}{' '}
          {radio('結束', t('結束', 'End'))}{' '}
          <br />{buttons}
        </>
      );
      break;
    case 'Parallelogram':
      body = (
        <>
          {radio('輸入', t('輸入', 'Input'), () => set({ ioText: '變數：', varSelectDisplay: 'inline-block', varSelectOutput: '', varSelectOutputDisplay: 'none' }))}{' '}
          {radio('輸出', t('輸出', 'Output'), () => set({ ioText: '變數或字串：', varSelectDisplay: 'none', varSelect: '', varSelectOutputDisplay: 'inline-block' }))}{' '}
          <br /><br />
          {f.radio == '輸入'
            ? (
              // 輸入：先選存到變數還是清單，才出現那一類的下拉選單；清單還可以選放在哪裡
              <>
                <p className="io_choice">
                  {t('存到：', 'Save to: ')}
                  <label><input type="radio" name="io_target" checked={f.ioTarget == '變數'} onChange={() => set({ ioTarget: '變數', varSelect: '' })} />{t('變數', 'Variable')}</label>
                  <label><input type="radio" name="io_target" checked={f.ioTarget == '清單'} onChange={() => set({ ioTarget: '清單', varSelect: '' })} />{t('清單', 'List')}</label>
                  {(allTypes.grid.length > 0 || f.ioTarget == '二維清單') && (
                    <label><input type="radio" name="io_target" checked={f.ioTarget == '二維清單'} onChange={() => set({ ioTarget: '二維清單', varSelect: '' })} />{t('二維清單的一格', 'A 2D list cell')}</label>
                  )}
                </p>
                {f.ioTarget && (
                  <p>
                    <VarPicker
                      id="var_select" value={f.varSelect} onChange={v => set({ varSelect: v })}
                      names={ioNames(varTypes)}
                      params={f.ioTarget == '變數' ? paramNames : []}
                      locals={ioNames(localT)}
                    />
                  </p>
                )}
                {f.ioTarget == '二維清單' && (
                  <p>
                    {t('列（索引）', 'Row index')} <input id="rect_index" style={{ width: '20%' }} value={f.rectIndex} onChange={e => set({ rectIndex: e.target.value })} />{' '}
                    {t('行（索引）', 'Column index')} <input id="rect_index2" style={{ width: '20%' }} value={f.rectIndex2} onChange={e => set({ rectIndex2: e.target.value })} />
                  </p>
                )}
                {f.ioTarget == '清單' && (
                  <>
                    <p className="io_choice">
                      {t('放在：', 'Put it: ')}
                      <label><input type="radio" name="io_place" checked={f.ioPlace == '加入'} onChange={() => set({ ioPlace: '加入' })} />{t('最後面', 'at the end')}</label>
                      <label><input type="radio" name="io_place" checked={f.ioPlace == '插入'} onChange={() => set({ ioPlace: '插入' })} />{byTarget(t('插入到第幾項', 'insert at item'), t('插入到某個索引', 'insert at index'))}</label>
                      <label><input type="radio" name="io_place" checked={f.ioPlace == '替換'} onChange={() => set({ ioPlace: '替換' })} />{byTarget(t('替換第幾項', 'replace item'), t('替換某個索引', 'replace index'))}</label>
                    </p>
                    {f.ioPlace != '加入' && (
                      <p>
                        {byTarget(t('第', 'Item'), t('索引', 'Index'))} <input id="rect_index" style={{ width: '25%' }} value={f.rectIndex} onChange={e => set({ rectIndex: e.target.value })} /> {indexSuffix()}
                      </p>
                    )}
                    {f.varSelect && <span className="dialog_note">{IO_NOTE[f.ioPlace](f.varSelect, f.rectIndex.trim())}</span>}
                  </>
                )}
              </>
            )
            : (
              <>
                {/* 有回傳值的模組（Blockly、C++）：可以選「模組回傳值」，選模組、填參數就好，不用自己打 */}
                {canReturnTarget() && (returningModules.length > 0 || f.outputKind == '回傳') && (
                  <p className="io_choice output_kind">
                    {t('輸出：', 'Output: ')}
                    <label><input type="radio" name="output_kind" checked={f.outputKind == ''} onChange={() => set({ outputKind: '' })} />{t('變數或字串', 'A variable or "text"')}</label>
                    <label><input type="radio" name="output_kind" checked={f.outputKind == '回傳'} onChange={() => set({ outputKind: '回傳' })} />{t('模組回傳值', "A module's return value")}</label>
                  </p>
                )}
                {f.outputKind == '回傳'
                  ? (
                    <>
                      <p>
                        {t('模組：', 'Module: ')}
                        <select className="var_select" id="module_select" value={f.moduleName} onChange={e => set({ moduleName: e.target.value, moduleArgs: [] })}>
                          <option value="" disabled>{t('請選擇', 'Choose one')}</option>
                          {f.moduleName && !returningModules.some(x => x.name == f.moduleName) && <option value={f.moduleName}>{f.moduleName}</option>}
                          {returningModules.map(x => <option key={x.name} value={x.name}>{x.name}{t(`（回傳${returnLabel(x)}）`, ` (returns ${returnLabel(x)})`)}</option>)}
                        </select>
                      </p>
                      {(() => {
                        const m = returningModules.find(x => x.name == f.moduleName);
                        return m && argFields(m);
                      })()}
                    </>
                  )
                  : (
                    <>
                      <p id="io_text">{t('變數或字串：', 'Variable or "text": ')}</p>
                      <p>
                        <input
                          className="var_select" id="var_select_output" value={f.varSelectOutput}
                          onChange={e => set({ varSelectOutput: e.target.value })}
                        />
                      </p>
                    </>
                  )}
              </>
            )}
          <p>
            {buttons}
          </p>
        </>
      );
      break;
    case 'Diamond':
      body = (
        <>
          {conditionHint}{' '}
          {codeInput}{' '}
          <br />{buttons}
        </>
      );
      break;
    case 'Loop':
    case 'For_Loop':
    case 'While_Loop':
      body = (
        <>
          <p id="hint">{t('離開迴圈的條件是？', 'When does the loop stop?')}</p>{' '}
          {radio('for', t('執行完幾次', 'After some times'), () => set({ showWhile: false }))}{' '}
          {radio('while', t('達成某個條件', 'When something is true'), () => set({ showWhile: true }))}{' '}
          <br /><br />{' '}
          <div id="while_div" style={{ display: f.showWhile ? 'block' : 'none' }}>{' '}
            {conditionHint}{' '}
            {codeInput}{' '}
          </div>{' '}
          <div id="for_div" style={{ display: f.showWhile ? 'none' : 'block' }}>{' '}
            <p id="hint">{t('請輸入次數', 'How many times?')}</p>{' '}
            <input id="for_number" style={{ width: '80%' }} value={f.forNumber} onChange={e => set({ forNumber: e.target.value })} />{' '}
          </div>{' '}
          <br />{buttons}
        </>
      );
      break;
    case 'Function': {
      // 執行模組：選一個模組，每個參數填要用的值（跟 Scratch 執行自訂積木一樣）
      const m = modules.find(x => x.name == f.moduleName);
      body = (
        <>
          <p id="hint">{t('要執行哪一個模組？', 'Which module do you want to run?')}</p>
          {modules.length
            ? (
              <select className="var_select" id="module_select" value={f.moduleName} onChange={e => set({ moduleName: e.target.value, moduleArgs: [] })}>
                <option value="" disabled>{t('請選擇', 'Choose one')}</option>
                {f.moduleName && !m && <option value={f.moduleName}>{f.moduleName}</option>}
                {modules.map(x => <option key={x.name} value={x.name}>{x.name}</option>)}
              </select>
            )
            : <p className="dialog_note">{t('還沒有模組：請先按流程圖上方的「＋ 新增模組」。', 'There are no modules yet. Click "+ New module" above the flowchart first.')}</p>}
          {m && argFields(m)}
          {m?.returns && (
            <p className="dialog_note return_tip">
              {t(`「${m.name}」會回傳一個${returnLabel(m)}，但這個積木會把回傳值丟掉。要用回傳值，請改用計算積木的「接收模組回傳值」。`,
                `"${m.name}" returns ${returnLabel(m)}, but this block throws it away. To keep it, use the Math block option "Get a module's return value".`)}
            </p>
          )}
          <p><br />{buttons}</p>
        </>
      );
      break;
    }
    case 'Rectangle': {
      // 先選要改什麼（變數、清單、二維清單、回傳），清單、二維清單再選怎麼改；每一類可以選的變數
      const kind = f.rectKind;
      const namesFor = (k: DialogForm['rectKind'], ty: VarTypes = allTypes) => (k == '變數' || k == '接收' ? [...ty.number, ...ty.text]
        : k == '清單' ? ty.array
        : k == '二維清單' ? ty.grid
        : []);
      const cell = kind == '二維清單' && f.rectAction == '替換';
      const indexLabel = !kind ? null : cell ? () => t('列（索引）', 'Row index') : RECT_INDEX[f.rectAction];
      const index2Label = !kind ? null : f.rectAction == '建立' ? t('行數', 'Columns') : cell ? t('行（索引）', 'Column index') : null;
      const verb = kind && kind != '接收' ? RECT_VERB[f.rectAction] : null;
      // 有回傳值的模組（Scratch 的模組不能回傳，看不到這個選項）
      const returning = modules.filter(x => x.returns);
      const recvModule = returning.find(x => x.name == f.moduleName);
      const noLists = allTypes.array.length == 0;
      /** 變數「改變」：只能選數字變數，值是加多少、沒有捨去進位 */
      const change = kind == '變數' && f.varChange;
      /** 選了一類：動作換成這一類的第一個，原本選的變數不能用就清掉 */
      const pickKind = (k: DialogForm['rectKind']) => set({
        rectKind: k,
        varChange: false,
        rectAction: k == '變數' || k == '接收' ? '設為' : k == '回傳' ? '回傳' : k == '二維清單' ? '建立' : '加入',
        ...([...namesFor(k), ...(k == '變數' || k == '接收' ? paramNames : [])].includes(f.varSelect) ? {} : { varSelect: '' }),
      });
      const actionRadio = (action: RectAction, label: string) => (
        <label key={action}><input type="radio" name="rect_action" checked={f.rectAction == action} onChange={() => set({ rectAction: action })} />{label}</label>
      );
      body = (
        <>
          <p id="hint">{change ? t('將數字變數的值加上多少（減少就填負數）...', 'Add an amount to a number variable (use a negative number to take away)...') : kind == '接收' ? t('執行有回傳值的模組，把回傳的值存進變數...', 'Run a module and save the value it returns...') : kind ? RECT_HINT[f.rectAction]() : t('要改什麼？先選一種：', 'What do you want to change? Choose one:')}</p>{' '}
          <p className="io_choice rect_kind">
            {t('要改：', 'Change: ')}
            <label><input type="radio" name="rect_kind" checked={kind == '變數'} onChange={() => pickKind('變數')} />{t('變數', 'A variable')}</label>
            <label title={noLists ? t('變數表還沒有清單：要用清單，請先到變數表新增', 'No lists yet. Add one in the variable table first.') : undefined} className={noLists && kind != '清單' ? 'disabled_choice' : undefined}>
              <input type="radio" name="rect_kind" checked={kind == '清單'} disabled={noLists && kind != '清單'} onChange={() => pickKind('清單')} />{t('清單', 'A list')}
              {noLists && kind != '清單' && <span className="muted">{t('（變數表還沒有清單）', ' (no lists yet)')}</span>}
            </label>
            {(allTypes.grid.length > 0 || kind == '二維清單') && (
              <label><input type="radio" name="rect_kind" checked={kind == '二維清單'} onChange={() => pickKind('二維清單')} />{t('二維清單', 'A 2D list')}</label>
            )}
            {(request.canReturn || kind == '回傳') && (
              <label><input type="radio" name="rect_kind" checked={kind == '回傳'} onChange={() => pickKind('回傳')} />{t('回傳值', 'Return a value')}</label>
            )}
            {(canReturnTarget() || kind == '接收') && (
              <label
                title={returning.length ? undefined : t('還沒有有回傳值的模組：到模組上方的「修改名稱、參數」設定回傳值', 'No module returns a value yet. Set a return value in "Edit name, parameters".')}
                className={!returning.length && kind != '接收' ? 'disabled_choice' : undefined}
              >
                <input type="radio" name="rect_kind" checked={kind == '接收'} disabled={!returning.length && kind != '接收'} onChange={() => pickKind('接收')} />{t('接收模組回傳值', "A module's return value")}
                {!returning.length && kind != '接收' && <span className="muted">{t('（還沒有有回傳值的模組）', ' (no module returns a value yet)')}</span>}
              </label>
            )}
          </p>
          {kind == '接收' && (
            <>
              <p>
                {t('模組：', 'Module: ')}
                <select className="var_select" id="module_select" value={f.moduleName} onChange={e => set({ moduleName: e.target.value, moduleArgs: [] })}>
                  <option value="" disabled>{t('請選擇', 'Choose one')}</option>
                  {f.moduleName && !recvModule && <option value={f.moduleName}>{f.moduleName}</option>}
                  {returning.map(x => <option key={x.name} value={x.name}>{x.name}{t(`（回傳${returnLabel(x)}）`, ` (returns ${returnLabel(x)})`)}</option>)}
                </select>
              </p>
              {recvModule && argFields(recvModule)}
            </>
          )}
          {kind == '清單' && (
            <p className="rect_action">
              {t('怎麼改：', 'How: ')}
              {RECT_ACTIONS.filter(([action]) => ['加入', '插入', '替換', '刪除', '清空'].includes(action)).map(([action, label]) => actionRadio(action, label()))}
            </p>
          )}
          {kind == '變數' && (
            <p className="rect_action">
              {t('怎麼改：', 'How: ')}
              <label><input type="radio" name="var_action" checked={!f.varChange} onChange={() => set({ varChange: false })} />{t('設為', 'Set to')}</label>
              <label><input type="radio" name="var_action" checked={f.varChange} onChange={() => set({ varChange: true, radio: '' })} />{t('改變（加多少）', 'Change by')}</label>
            </p>
          )}
          {kind == '二維清單' && (
            <p className="rect_action">
              {t('怎麼改：', 'How: ')}
              {actionRadio('建立', t('建立（幾列幾行）', 'Make (rows × columns)'))}
              {actionRadio('替換', t('替換一格', 'Change one cell'))}
            </p>
          )}
          {kind && kind != '回傳' && (
            <>
              {kind == '變數' ? t('變數：', 'Variable: ') : kind == '接收' ? t('回傳值存到變數：', 'Save it in: ') : kind == '二維清單' ? t('二維清單：', '2D list: ') : t('清單：', 'List: ')}
              <VarPicker id="var_select" value={f.varSelect} onChange={v => set({ varSelect: v })} names={change ? varTypes.number : namesFor(kind, varTypes)} params={kind == '變數' || kind == '接收' ? paramNames : []} locals={change ? localT.number : namesFor(kind, localT)} />
            </>
          )}
          {indexLabel && (
            <>
              <br /><br /> {indexLabel()}{' '}
              <input id="rect_index" style={{ width: '25%' }} value={f.rectIndex} onChange={e => set({ rectIndex: e.target.value })} />{' '}
              {!cell && f.rectAction != '建立' && indexSuffix()}
            </>
          )}
          {index2Label && (
            <>
              {' '}{index2Label}{' '}
              <input id="rect_index2" style={{ width: '25%' }} value={f.rectIndex2} onChange={e => set({ rectIndex2: e.target.value })} />
            </>
          )}
          {verb && change && (
            <>
              <br /><br /> {t('改變', 'by')} {codeInput}
              <p className="dialog_note">{t('填 1 就是加 1，填 -1 就是減 1', '1 adds one, -1 takes one away')}</p>
            </>
          )}
          {verb && !change && (
            <>
              <br /><br /> {verb()} {codeInput}{' '}
              <br /><br />
              <p>{t('捨去進位？', 'Round?')}{' '}
                {radio('', t('不需要', 'No'))}{' '}
                {radio('Math.round', t('四捨五入', 'Round'))}{' '}
                <br />{radio('Math.floor', t('無條件捨去', 'Round down'))}{' '}
                {radio('Math.ceil', t('無條件進位', 'Round up'))}{' '}
              </p>
            </>
          )}
          <p><br />{buttons}</p>
        </>
      );
      break;
    }
    case 'link_tf':
      body = (
        <>
          <p id="hint">{t('請選擇', 'Choose one')}</p>{' '}
          {radio('真', t('真', 'Yes'))}{' '}
          {radio('假', t('假', 'No'))}{' '}
          <br />{buttons}
        </>
      );
      break;
    case 'link_for':
      body = (
        <>
          <p id="hint">{t('請選擇', 'Choose one')}</p>{' '}
          {radio('進入迴圈', t('進入迴圈', 'Repeat'))}{' '}
          {radio('離開迴圈', t('離開迴圈', 'Done'))}{' '}
          <br />{buttons}
        </>
      );
      break;
    case 'clear':
      body = (
        <>
          <p id="hint">{t('將清空流程圖', 'Clear the whole flowchart?')}</p>{' '}
          <br />{buttons}
        </>
      );
      break;
  }
  return <>{body}</>;
}
