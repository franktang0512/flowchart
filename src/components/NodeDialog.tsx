// 新增/編輯積木、選箭頭標籤、清空流程圖時跳出的對話框（舊版 shapes.js 的 node_model）。
// 版面要跟舊版一模一樣，所以元素之間的空白（{' '}）與 <p> 的巢狀方式都照舊版 HTML 被瀏覽器解析後的結果。
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { t, useLang } from '../i18n';

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
  /** undefined = 預設（行內）；舊版切換後會設成 block / none */
  varSelectDisplay?: 'block' | 'none';
  varSelectOutputDisplay: 'block' | 'none';
  /** 迴圈：顯示「達成某個條件」(while) 還是「執行完幾次」(for) 的輸入欄 */
  showWhile: boolean;
}

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

interface Props {
  request: DialogRequest | null;
  onClose: () => void;
}

export function NodeDialog({ request, onClose }: Props) {
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
      {request && <DialogBody key={request.id} request={request} onClose={onClose} />}
    </dialog>
  );
}

function DialogBody({ request, onClose }: { request: DialogRequest; onClose: () => void }) {
  const { kind } = request;
  useLang();
  const [f, setF] = useState<DialogForm>(() => ({ ...defaultForm(kind), ...request.initial }));
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
          {radio('輸入', t('輸入', 'Input'), () => set({ ioText: '變數：', varSelectDisplay: 'block', varSelectOutput: '', varSelectOutputDisplay: 'none' }))}{' '}
          {radio('輸出', t('輸出', 'Output'), () => set({ ioText: '變數或字串：', varSelectDisplay: 'none', varSelect: '', varSelectOutputDisplay: 'block' }))}{' '}
          <br /><br />
          <p id="io_text">{f.ioText == '變數或字串：' ? t('變數或字串：', 'Variable or "text": ') : t('變數：', 'Variable: ')}</p>
          <p>
            <input
              className="var_select" id="var_select" value={f.varSelect}
              style={f.varSelectDisplay ? { display: f.varSelectDisplay } : undefined}
              onChange={e => set({ varSelect: e.target.value })}
            />
            <input
              className="var_select" id="var_select_output" value={f.varSelectOutput}
              style={{ display: f.varSelectOutputDisplay }}
              onChange={e => set({ varSelectOutput: e.target.value })}
            />{' '}
            <br /><br />{buttons}
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
    case 'Rectangle':
      body = (
        <>
          <p id="hint">{t('將變數內的值設為...', 'Set a variable to...')}</p>{' '}
          <br />{t('變數：', 'Variable: ')}<input className="var_select" id="var_select" style={{ width: '50%' }} value={f.varSelect} onChange={e => set({ varSelect: e.target.value })} />
          <br /><br /> {t('設為', 'to')} {codeInput}{' '}
          <br /><br />
          <p>{t('捨去進位？', 'Round?')}{' '}
            {radio('', t('不需要', 'No'))}{' '}
            {radio('Math.round', t('四捨五入', 'Round'))}{' '}
            <br />{radio('Math.floor', t('無條件捨去', 'Round down'))}{' '}
            {radio('Math.ceil', t('無條件進位', 'Round up'))}{' '}
          </p>
          <p><br />{buttons}</p>
        </>
      );
      break;
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
