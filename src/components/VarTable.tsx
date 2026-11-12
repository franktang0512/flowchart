// 第三步左邊的「變數」表格
import { useRef } from 'react';
import type { LocalVar, ParamInfo } from '../engine/modules';
import { t, useLang } from '../i18n';
import { getTarget } from '../target';
import { useCommit } from '../useCommit';

export interface VarRow {
  id: number;
  name: string;
  /** 二維清單只有學習目標是 C++ 時可以選（Scratch 沒有） */
  type: '數字' | '文字' | '清單' | '二維清單';
  init: string;
  desc: string;
}

/** 清單、二維清單：一開始是空的，初始值欄改成選裡面裝什麼 */
const isListType = (type: VarRow['type']) => type == '清單' || type == '二維清單';

interface Props {
  rows: VarRow[];
  onChange: (id: number, patch: Partial<VarRow>) => void;
  /** 輸入框內容確定（離開或 Enter）時，重新整理變數清單 */
  onCommit: () => void;
  onDelete: (id: number) => void;
  onCreate: () => void;
  /**
   * 正在畫模組時：這個模組的參數（名稱、型別在「修改名稱、參數」設定，這裡不能改）、
   * 區域變數（只有 C++；null 是這個語言沒有區域變數）。onLocals 的 rename 是改名（舊名, 新名）
   */
  module?: {
    name: string;
    params: ParamInfo[];
    locals: LocalVar[] | null;
    onLocals: (next: LocalVar[], rename?: [string, string]) => void;
    /** 區域變數的名字不能用時的原因（跟全域變數、參數、模組、其他區域變數撞名） */
    localProblem: (name: string, id: number, rows: LocalVar[]) => string | null;
    onProblem: (why: string) => void;
  };
}

let localSeq = 1_000_000;

export function VarTable({ rows, onChange, onCommit, onDelete, onCreate, module }: Props) {
  useLang();
  const head = (
    <tr>
      <th style={{ width: '24%' }}>{t('名稱', 'Name')}</th>
      <th style={{ width: '1%' }}>{t('型別', 'Type')}</th>
      <th style={{ width: '18%' }}>{t('初始值', 'Start')}</th>
      <th>{t('說明', 'Note')}</th>
      <th style={{ width: '1%' }}></th>
    </tr>
  );
  return (
    <div id="step3" className="card">
      <h5 className="card_title"><span className="step_badge">3</span>{t('定義變數', 'Variables')}</h5>
      {module && (
        // 模組的參數：跟著模組設定走，名稱和型別不能在這裡改，所以跟自己建的變數分開列
        <>
          <p className="section_label var_section">{t(`模組「${module.name}」的參數（🔒 要改名稱或刪除，請到模組上方的「修改名稱、參數」）`, `Parameters of "${module.name}" (🔒 to rename or remove, use "Edit name, parameters" above the module)`)}</p>
          {module.params.length == 0
            ? <p className="muted param_none">{t('這個模組沒有參數。', 'This module has no parameters.')}</p>
            : (
              <table id="param_table" className="data_table">
                <tbody>
                  {head}
                  {module.params.map(p => (
                    <tr key={p.name} className="param_row">
                      <td><span className="param_name" title={t('參數的名稱要在模組的「修改名稱、參數」裡改', 'Change the name in "Edit name, parameters"')}>🔒 {p.name}</span></td>
                      <td><span className="param_fixed">{p.type == '數字' ? t('數字', 'Number') : t('文字', 'Text')}</span></td>
                      <td><span className="muted">{t('執行時傳進來', 'Given when it runs')}</span></td>
                      <td><span className="muted">{getTarget() == 'scratch'
                        ? t('只能拿來算，不能改（Scratch 的規定）', 'Use it, but do not change it (Scratch rule)')
                        : t('流程裡可以改它的值，只改到模組自己的那一份', 'You can change its value; only this module sees it')}</span></td>
                      <td></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          {module.locals && <LocalTable module={module.name} rows={module.locals} onLocals={module.onLocals} problem={module.localProblem} onProblem={module.onProblem} head={head} />}
          {/* 全域變數只在主流程顯示；模組這裡只列這個模組自己的 */}
          <p className="muted global_note">{module.locals
            ? t('主流程的變數（全域變數）在模組裡也能用，要新增或修改請回到「主流程」。', 'Main-flow (global) variables can be used here too. To add or change them, go back to the main flow.')
            : t('Scratch / Blockly 沒有只屬於函式的變數：要用變數，請回到「主流程」新增（主流程的變數在模組裡也能用）。', 'Scratch / Blockly have no variables that belong only to a function. To use one, add it in the main flow (main-flow variables work here too).')}</p>
        </>
      )}
      {!module && (
        <>
          <table id="var_table" className="data_table">
            <tbody>
              {head}
              {rows.map(row => (
                <VarRowView key={row.id} row={row} onChange={onChange} onCommit={onCommit} onDelete={onDelete} />
              ))}
            </tbody>
          </table>
          <button id="createRow" onClick={onCreate}>＋ {t('新增變數', 'Add a variable')}</button>
        </>
      )}
    </div>
  );
}

/** C++ 模組的區域變數：只有這個模組用得到，每次執行模組都重新從初始值開始 */
function LocalTable({ module, rows, onLocals, problem, onProblem, head }: {
  module: string;
  rows: LocalVar[];
  onLocals: (next: LocalVar[], rename?: [string, string]) => void;
  problem: (name: string, id: number, rows: LocalVar[]) => string | null;
  onProblem: (why: string) => void;
  head: React.ReactNode;
}) {
  // 上次確定的名字：改名確定時，流程圖裡用到的地方也跟著改
  const committed = useRef(new Map<number, string>());
  for (const r of rows) if (!committed.current.has(r.id)) committed.current.set(r.id, r.name.trim());
  // 最新的內容（改型別時 onChange 之後馬上 onCommit，還沒重新 render）
  const latest = useRef(rows);
  latest.current = rows;
  const update = (next: LocalVar[], rename?: [string, string]) => {
    latest.current = next;
    onLocals(next, rename);
  };
  const commit = () => {
    let now = latest.current;
    // 名字不能用（撞名）：提醒，改回原本的名字
    const bad = now.find(r => r.name.trim() && r.name.trim() != committed.current.get(r.id) && problem(r.name.trim(), r.id, now));
    if (bad) {
      onProblem(problem(bad.name.trim(), bad.id, now)!);
      const old = committed.current.get(bad.id) ?? '';
      now = now.map(r => (r.id == bad.id ? { ...r, name: old == bad.name.trim() ? '' : old } : r));
    }
    const changed = now.find(r => committed.current.get(r.id) != r.name.trim());
    const rename = changed ? [committed.current.get(changed.id) ?? '', changed.name.trim()] as [string, string] : undefined;
    now.forEach(r => committed.current.set(r.id, r.name.trim()));
    update(now, rename);
  };
  return (
    <>
      <p className="section_label var_section">{t(`模組「${module}」的區域變數（只有這個模組用得到，每次執行都從初始值開始）`, `Local variables of "${module}" (only this module can use them; they start over each run)`)}</p>
      {rows.length > 0 && (
        <table id="local_table" className="data_table">
          <tbody>
            {head}
            {rows.map(row => (
              <VarRowView
                key={row.id} row={row} className="local_row"
                onChange={(id, patch) => update(latest.current.map(r => (r.id == id ? { ...r, ...patch } : r)))}
                onCommit={commit}
                onDelete={id => update(latest.current.filter(r => r.id != id))}
              />
            ))}
          </tbody>
        </table>
      )}
      <button className="create_local" onClick={() => update([...latest.current, { id: ++localSeq, name: '', type: '數字', init: '0', desc: '' }])}>＋ {t('新增區域變數', 'Add a local variable')}</button>
    </>
  );
}

function VarRowView({ row, onChange, onCommit, onDelete, className }: { row: VarRow; className?: string } & Pick<Props, 'onChange' | 'onCommit' | 'onDelete'>) {
  const commit = useCommit<HTMLInputElement>(onCommit);
  const text = (field: 'name' | 'init' | 'desc') => ({
    className: 'var_input',
    value: row[field],
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => onChange(row.id, { [field]: e.target.value }),
    ...commit,
  });
  return (
    <tr className={className}>
      <td><input {...text('name')} /></td>
      <td>
        <select
          className="var_input" value={row.type}
          onChange={e => {
            const type = e.target.value as VarRow['type'];
            // 預設的初始值跟著型別換：數字是 0，文字是空的，清單預設裝數字
            const init = isListType(type) ? (row.init == '文字' ? '文字' : '數字')
              : isListType(row.type) ? (type == '數字' ? '0' : '')
              : type == '文字' && row.init == '0' ? '' : type == '數字' && row.init == '' ? '0' : row.init;
            onChange(row.id, { type, init });
            onCommit();
          }}
        >
          <option value="數字">{t('數字', 'Number')}</option>
          <option value="文字">{t('文字', 'Text')}</option>
          <option value="清單">{t('清單', 'List')}</option>
          {(getTarget() == 'cpp' || row.type == '二維清單') && <option value="二維清單">{t('二維清單', '2D list')}</option>}
        </select>
      </td>
      <td>
        {row.type == '清單' && getTarget() != 'cpp'
          // 積木（Scratch / Blockly）的清單跟 Scratch 一樣，數字、文字都能放，不用先決定型別（C++ 才要選）
          ? <span className="muted list_any" title={t('清單一開始是空的，數字和文字都可以放', 'The list starts empty. It can hold numbers and text.')}>{t('數字、文字都可以', 'Numbers or text')}</span>
          : isListType(row.type)
          ? (
            // 清單一開始是空的；這一欄改成選清單裡裝什麼（C++ 要寫成 vector<int> 還是 vector<string>）
            <select
              className="var_input" value={row.init == '文字' ? '文字' : '數字'}
              title={row.type == '二維清單'
                ? t('二維清單一開始是空的，要先用計算積木「建立 幾 列 幾 行」；這裡選裡面要裝什麼', 'The 2D list starts empty. Make it with a Math block (rows × columns). Choose what it holds.')
                : t('清單一開始是空的，這裡選裡面要裝什麼', 'The list starts empty. Choose what it holds.')}
              onChange={e => { onChange(row.id, { init: e.target.value }); onCommit(); }}
            >
              <option value="數字">{t('裝數字', 'Numbers')}</option>
              <option value="文字">{t('裝文字', 'Text')}</option>
            </select>
          )
          : <input {...text('init')} />}
      </td>
      <td><input {...text('desc')} /></td>
      <td><button className="delete_var" title={t('刪除這個變數', 'Delete this variable')} aria-label={t('刪除', 'Delete')} onClick={() => onDelete(row.id)}><TrashIcon /></button></td>
    </tr>
  );
}

function TrashIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M3 6h18" />
      <path d="M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2" />
      <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
      <path d="M10 11v6M14 11v6" />
    </svg>
  );
}
