// 第三步左邊的「變數」表格
import { t, useLang } from '../i18n';
import { useCommit } from '../useCommit';

export interface VarRow {
  id: number;
  name: string;
  type: '數字' | '文字' | '清單';
  init: string;
  desc: string;
}

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
            // 清單功能先關閉：就算用別的方式選到也不接受
            if (e.target.value == '清單') return;
            const type = e.target.value as VarRow['type'];
            // 預設的初始值跟著型別換：數字是 0，文字是空的
            const init = type == '文字' && row.init == '0' ? '' : type == '數字' && row.init == '' ? '0' : row.init;
            onChange(row.id, { type, init });
            onCommit();
          }}
        >
          <option value="數字">{t('數字', 'Number')}</option>
          <option value="文字">{t('文字', 'Text')}</option>
          {/* 清單功能先關閉（程式都在，拿掉 disabled 就能用） */}
          <option value="清單" disabled>{t('清單', 'List')}</option>
        </select>
      </td>
      <td>{row.type == '清單' ? <input className="var_input" disabled placeholder={t('空清單', 'Empty list')} /> : <input {...text('init')} />}</td>
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
