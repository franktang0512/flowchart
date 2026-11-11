// 第三步左邊的「變數」表格
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
}

export function VarTable({ rows, onChange, onCommit, onDelete, onCreate }: Props) {
  useLang();
  return (
    <div id="step3" className="card">
      <h5 className="card_title"><span className="step_badge">3</span>{t('定義變數', 'Variables')}</h5>
      <table id="var_table" className="data_table">
        <tbody>
          <tr>
            <th style={{ width: '24%' }}>{t('名稱', 'Name')}</th>
            <th style={{ width: '1%' }}>{t('型別', 'Type')}</th>
            <th style={{ width: '18%' }}>{t('初始值', 'Start')}</th>
            <th>{t('說明', 'Note')}</th>
            <th style={{ width: '1%' }}></th>
          </tr>
          {rows.map(row => (
            <VarRowView key={row.id} row={row} onChange={onChange} onCommit={onCommit} onDelete={onDelete} />
          ))}
        </tbody>
      </table>
      <button id="createRow" onClick={onCreate}>＋ {t('新增變數', 'Add a variable')}</button>
    </div>
  );
}

function VarRowView({ row, onChange, onCommit, onDelete }: { row: VarRow } & Pick<Props, 'onChange' | 'onCommit' | 'onDelete'>) {
  const commit = useCommit<HTMLInputElement>(onCommit);
  const text = (field: 'name' | 'init' | 'desc') => ({
    className: 'var_input',
    value: row[field],
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => onChange(row.id, { [field]: e.target.value }),
    ...commit,
  });
  return (
    <tr>
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
        {isListType(row.type)
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
