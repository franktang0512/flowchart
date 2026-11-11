// 新增/編輯積木、選箭頭標籤、清空流程圖時跳出的對話框（舊版 shapes.js 的 node_model）。
// 版面要跟舊版一模一樣，所以元素之間的空白（{' '}）與 <p> 的巢狀方式都照舊版 HTML 被瀏覽器解析後的結果。
import { useEffect, useRef, useState, type ReactNode } from 'react';
import type { VarStore } from '../engine/decoder';
import type { RectAction } from '../engine/labels';
import { t, useLang } from '../i18n';
import { byTarget, itemWord } from '../target';

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
  /** 計算積木：「設為」一般的設定，其他是清單的操作（見 RectAction） */
  rectAction: RectAction;
  /** 第幾項：計算積木的「插入」「替換」「刪除」，輸入到清單的「插入」「替換」 */
  rectIndex: string;
  /** 輸入積木要存到變數還是清單；'' = 還沒選（先選類型才出現下拉選單） */
  ioTarget: '' | '變數' | '清單';
  /** 輸入到清單時放在哪裡：添加到最後、插入到第幾項、替換第幾項（對應 Scratch 的清單積木） */
  ioPlace: '加入' | '插入' | '替換';
}

// 清單操作的名稱照 Scratch 的清單積木，下一堂改用 Scratch 時說法一樣
const RECT_ACTIONS: [RectAction, () => string][] = [
  ['設為', () => t('設定變數', 'Set')],
  ['加入', () => t('添加', 'Add')],
  ['插入', () => t('插入', 'Insert')],
  ['替換', () => t('替換', 'Replace')],
  ['刪除', () => byTarget(t('刪除第幾項', 'Delete item'), t('刪除某個索引', 'Delete at index'))],
  ['清空', () => t('刪除所有項目', 'Delete all')],
];

const RECT_HINT: Record<RectAction, () => string> = {
  設為: () => t('將變數內的值設為...', 'Set a variable to...'),
  加入: () => t('把值添加到清單的最後面...', 'Add a value to the end of a list...'),
  插入: () => t(`把值插到清單的${byTarget('第幾項', '某個索引')}，原本那項和後面的都往後移...`, 'Put a value into a list. The items after it move back...'),
  替換: () => t(`把清單的${byTarget('第幾項', '某個索引')}換成新的值...`, 'Change one item of a list...'),
  刪除: () => t(`刪除清單的${byTarget('第幾項', '某個索引')}，後面的都往前移...`, 'Delete one item from a list. The items after it move up...'),
  清空: () => t('刪除清單的所有項目，清單會變成空的...', 'Delete all items. The list will be empty...'),
};

/** 「第幾項」欄位前面的字（沒有這欄的是 null）；C++ 說「索引」 */
const RECT_INDEX: Record<RectAction, (() => string) | null> = {
  設為: null,
  加入: null,
  插入: () => byTarget(t('插到第', 'At item'), t('插到索引', 'At index')),
  替換: () => byTarget(t('替換第', 'Item'), t('替換索引', 'Index')),
  刪除: () => byTarget(t('刪除第', 'Delete item'), t('刪除索引', 'Delete index')),
  清空: null,
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
  rectAction: '設為',
  rectIndex: '',
  ioTarget: '',
  ioPlace: '加入',
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
}

/** 變數表裡各型別的變數名稱，給下拉選單用 */
export type VarTypes = VarStore['type_var_list'];

interface Props {
  request: DialogRequest | null;
  onClose: () => void;
  varTypes: VarTypes;
}

/**
 * 選變數的下拉選單（像 Scratch 一樣用選的，不會打錯字），只列出一種類型的變數。
 * 舊作品裡填的值不在選項裡時，也放進選項，打開修改才不會被清掉。
 */
function VarPicker({ id, value, onChange, names }: { id: string; value: string; onChange: (v: string) => void; names: string[] }) {
  return (
    <select className="var_select" id={id} value={value} onChange={e => onChange(e.target.value)}>
      <option value="" disabled>{names.length ? t('請選擇', 'Choose one') : t('請先到左邊的變數表新增', 'Add one in the variable table first')}</option>
      {value && !names.includes(value) && <option value={value}>{value}</option>}
      {names.map(name => <option key={name} value={name}>{name}</option>)}
    </select>
  );
}

/** 輸入到清單時，下面那行說明 */
const IO_NOTE: Record<DialogForm['ioPlace'], (list: string, k: string) => string> = {
  加入: list => t(`輸入的值會添加到清單「${list}」的最後面`, `The value goes to the end of the list "${list}".`),
  插入: (list, k) => t(`輸入的值會插到清單「${list}」的${itemWord(k || '?')}，原本那項和後面的都往後移`, `The value goes to ${itemWord(k || '?')} of "${list}". The items after it move back.`),
  替換: (list, k) => t(`輸入的值會換掉清單「${list}」的${itemWord(k || '?')}`, `The value replaces ${itemWord(k || '?')} of "${list}".`),
};

export function NodeDialog({ request, onClose, varTypes }: Props) {
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
      {request && <DialogBody key={request.id} request={request} onClose={onClose} varTypes={varTypes} />}
    </dialog>
  );
}

function DialogBody({ request, onClose, varTypes }: { request: DialogRequest; onClose: () => void; varTypes: VarTypes }) {
  const { kind } = request;
  useLang();
  const [f, setF] = useState<DialogForm>(() => {
    const form = { ...defaultForm(kind), ...request.initial };
    // 打開已經畫好的輸入積木：依變數表判斷原本存到變數還是清單
    if (form.radio == '輸入' && !form.ioTarget && form.varSelect) {
      form.ioTarget = form.ioPlace != '加入' || varTypes.array.includes(form.varSelect) ? '清單' : '變數';
    }
    return form;
  });
  const set = (patch: Partial<DialogForm>) => setF(prev => ({ ...prev, ...patch }));

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
                </p>
                {f.ioTarget && (
                  <p>
                    <VarPicker
                      id="var_select" value={f.varSelect} onChange={v => set({ varSelect: v })}
                      names={f.ioTarget == '清單' ? varTypes.array : [...varTypes.number, ...varTypes.text]}
                    />
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
                <p id="io_text">{t('變數或字串：', 'Variable or "text": ')}</p>
                <p>
                  <input
                    className="var_select" id="var_select_output" value={f.varSelectOutput}
                    onChange={e => set({ varSelectOutput: e.target.value })}
                  />
                </p>
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
    case 'Function':
      body = (
        <>
          <p id="hint">{t('請說明步驟內要做什麼？', 'What does this step do?')}</p>{' '}
          <input id="doing_something" style={{ width: '80%' }} value={f.doingSomething} onChange={e => set({ doingSomething: e.target.value })} />{' '}
          <br />{buttons}
        </>
      );
      break;
    case 'Rectangle': {
      const indexLabel = RECT_INDEX[f.rectAction];
      const verb = RECT_VERB[f.rectAction];
      body = (
        <>
          <p id="hint">{RECT_HINT[f.rectAction]()}</p>{' '}
          <p className="rect_action">
            {RECT_ACTIONS.map(([action, label]) => (
              <label key={action}><input type="radio" name="rect_action" checked={f.rectAction == action} onChange={() => set({
                rectAction: action,
                // 「設定變數」選數字/文字，其他選清單：換到另一種時，原本選的已經不適用
                ...((action == '設為') != (f.rectAction == '設為') ? { varSelect: '' } : {}),
              })} />{label()}</label>
            ))}
          </p>
          {f.rectAction == '設為' ? t('變數：', 'Variable: ') : t('清單：', 'List: ')}
          <VarPicker
            id="var_select" value={f.varSelect} onChange={v => set({ varSelect: v })}
            names={f.rectAction == '設為' ? [...varTypes.number, ...varTypes.text] : varTypes.array}
          />
          {indexLabel && (
            <>
              <br /><br /> {indexLabel()}{' '}
              <input id="rect_index" style={{ width: '25%' }} value={f.rectIndex} onChange={e => set({ rectIndex: e.target.value })} />{' '}
              {indexSuffix()}
            </>
          )}
          {verb && (
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
