// 新增／修改模組的對話框：模組名稱、參數（名稱和型別）。
// 參數跟 Scratch 自訂積木的參數一樣：模組裡只能拿來用，不能改；型別是數字或文字（C++ 要知道型別）。
import { useEffect, useRef, useState } from 'react';
import { isName, type ModuleInfo, type ParamInfo } from '../engine/modules';
import { t, useLang } from '../i18n';
import { canReturn } from '../target';

export interface ModuleRequest {
  /** 每次開對話框都不同，用來重設表單 */
  id: number;
  /** 修改時是原本的模組；新增時沒有 */
  initial?: ModuleInfo;
  /** 這個名字（模組或參數）能不能用；不能用時回傳原因 */
  nameProblem: (name: string, kind: 'module' | 'param') => string | null;
  onSave: (info: ModuleInfo) => void;
}

export function ModuleDialog({ request, onClose }: { request: ModuleRequest | null; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current!;
    if (request && !dialog.open) dialog.showModal();
    if (!request && dialog.open) dialog.close();
  }, [request]);
  return (
    <dialog id="module_dialog" ref={ref} onCancel={onClose}>
      {request && <ModuleForm key={request.id} request={request} onClose={onClose} />}
    </dialog>
  );
}

function ModuleForm({ request, onClose }: { request: ModuleRequest; onClose: () => void }) {
  useLang();
  const [name, setName] = useState(request.initial?.name ?? '');
  const [params, setParams] = useState<ParamInfo[]>(request.initial?.params.map(p => ({ ...p })) ?? []);
  const [returns, setReturns] = useState<'' | '數字' | '文字'>(request.initial?.returns ?? '');
  const [problem, setProblem] = useState<string | null>(null);

  const setParam = (k: number, patch: Partial<ParamInfo>) => setParams(params.map((p, i) => (i == k ? { ...p, ...patch } : p)));

  const save = () => {
    const n = name.trim();
    const list = params.map(p => ({ ...p, name: p.name.trim() })).filter(p => p.name);
    const bad = (s: string, kind: 'module' | 'param') => {
      if (!isName(s)) return t(`「${s}」不能當名稱：只能用中英文、數字和底線，不能有空白，也不能用數字開頭。`, `"${s}" cannot be a name. Use letters, numbers and _ only, with no spaces, and do not start with a number.`);
      return request.nameProblem(s, kind);
    };
    const why = !n ? t('請替模組取一個名字。', 'Give the module a name.')
      : bad(n, 'module')
      ?? list.map(p => bad(p.name, 'param')).find(Boolean)
      ?? (new Set(list.map(p => p.name)).size < list.length ? t('參數的名字不能重複。', 'Two parameters have the same name.') : null)
      ?? (list.some(p => p.name == n) ? t('參數的名字不能跟模組一樣。', 'A parameter cannot have the same name as the module.') : null);
    if (why) {
      setProblem(why);
      return;
    }
    request.onSave({ name: n, params: list, ...(returns && canReturn() ? { returns } : {}) });
    onClose();
  };

  return (
    <>
      <h5 className="card_title" style={{ marginTop: 0 }}>{request.initial ? t('修改模組', 'Edit module') : t('新增模組', 'New module')}</h5>
      <p className="dialog_note">{t('模組就是 Scratch 的「自訂積木」：把一段常用的步驟包起來取個名字，需要時用「執行模組」積木執行它。', 'A module is like a Scratch "My Block": a group of steps with a name. Use the "Run module" block to run it.')}</p>
      <p>
        <label>{t('名稱：', 'Name: ')}<input id="module_name" value={name} onChange={e => setName(e.target.value)} autoFocus /></label>
      </p>
      <p className="section_label">{t('參數（執行時再決定的值，例如要畫幾顆星星）', 'Parameters (values given when it runs, like how many stars)')}</p>
      {params.map((p, k) => (
        <p key={k} className="module_param">
          <input value={p.name} placeholder={t('參數名稱', 'name')} onChange={e => setParam(k, { name: e.target.value })} />
          <select value={p.type} onChange={e => setParam(k, { type: e.target.value as ParamInfo['type'] })}>
            <option value="數字">{t('數字', 'Number')}</option>
            <option value="文字">{t('文字', 'Text')}</option>
          </select>
          <button onClick={() => setParams(params.filter((_, i) => i != k))}>{t('刪除', 'Remove')}</button>
        </p>
      ))}
      <p><button onClick={() => setParams([...params, { name: '', type: '數字' }])}>{t('＋ 加一個參數', '+ Add a parameter')}</button></p>
      {canReturn()
        ? (
          // Blockly、C++：可以回傳值（Scratch 的自訂積木不行，所以不出現）
          <>
            <p className="section_label">{t('回傳值', 'Return value')}</p>
            <p className="module_param">
              <select value={returns} onChange={e => setReturns(e.target.value as typeof returns)}>
                <option value="">{t('沒有回傳值', 'No return value')}</option>
                <option value="數字">{t('回傳數字', 'Returns a number')}</option>
                <option value="文字">{t('回傳文字', 'Returns text')}</option>
              </select>
            </p>
            <p className="dialog_note">{t('有回傳值的模組：在模組裡用計算積木「回傳」，後面直接接「結束」；用的時候可以寫在算式裡，例如「答案 設為 找最大(x, y)」。參數也是變數，在模組裡可以改，但只改到模組自己的那一份，不會影響外面。', 'With a return value: inside the module, use the Math block "Return", then go straight to "End". You can use it in math, like "answer = biggest(x, y)". Parameters are variables too. You can change them inside the module; it does not change anything outside.')}</p>
          </>
        )
        : <p className="dialog_note">{t('參數在模組裡只能拿來用、不能改。Scratch 的自訂積木不能回傳值，要把結果帶回主流程，請存到變數表裡的變數。', 'Inside the module you can use a parameter but not change it. Scratch My Blocks cannot return a value. To bring a result back, save it in a variable from the table.')}</p>}
      {problem && <p className="run_error">{problem}</p>}
      <p>
        <button id="hint_yes" onClick={save}>{t('確認', 'OK')}</button>{' '}
        <button id="hint_no" onClick={onClose}>{t('取消', 'Cancel')}</button>
      </p>
    </>
  );
}
