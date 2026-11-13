// 第三步變數表上面的「struct（結構）」：先定義 struct 有哪些欄位，變數表才能選這個型別（只有 C++）
import { useEffect, useState } from 'react';
import type { StructDef, StructField } from '../engine/structs';
import { t, useLang } from '../i18n';

/** 改名：struct 改名要改變數表；欄位改名要改流程圖裡的「.欄位」 */
export type StructRename = { kind: 'struct'; from: string; to: string } | { kind: 'field'; struct: string; from: string; to: string };

interface Props {
  structs: StructDef[];
  /** 存起來；rename 是這次的改名 */
  onChange: (next: StructDef[], rename?: StructRename) => void;
  /** struct 名稱不能用的原因（跟變數、模組、其他 struct 撞名，或不是 C++ 的名稱） */
  structProblem: (name: string, id: number) => string | null;
  /** 欄位名稱不能用的原因 */
  fieldProblem: (name: string, others: string[]) => string | null;
  /** 刪除 struct 前檢查：還有變數在用的話回傳原因 */
  deleteProblem: (s: StructDef) => string | null;
  /** 刪除欄位前：流程圖有用到這個欄位的話要先問 */
  fieldInUse: (s: StructDef, field: string) => boolean;
}

let structSeq = 2_000_000;

/** 欄位名稱的灰色範例：一條邊 Edge 有 from、to、w */
const FIELD_EXAMPLES = ['from', 'to', 'w'];

export function StructTable({ structs, onChange, structProblem, fieldProblem, deleteProblem, fieldInUse }: Props) {
  useLang();
  const update = (s: StructDef, patch: Partial<StructDef>, rename?: StructRename) => onChange(structs.map(x => (x.id == s.id ? { ...x, ...patch } : x)), rename);
  return (
    // 不放說明文字（還沒教到 struct 的學生看了會混淆），只用灰色的範例提示怎麼寫
    <div className="struct_area">
      {structs.map(s => (
        <div key={s.id} className="struct_card">
          <div className="struct_head">
            <span className="struct_kw">struct</span>
            <NameInput
              value={s.name} placeholder="Edge" className="struct_name"
              onCommit={name => {
                const why = name && structProblem(name, s.id);
                if (why) {
                  alert(why);
                  return false;
                }
                update(s, { name }, s.name && name ? { kind: 'struct', from: s.name, to: name } : undefined);
                return true;
              }}
            />
            <button
              className="delete_var" title={t('刪除這個 struct', 'Delete this struct')} aria-label={t('刪除', 'Delete')}
              onClick={() => {
                const why = deleteProblem(s);
                if (why) alert(why);
                else onChange(structs.filter(x => x.id != s.id));
              }}
            >✕</button>
          </div>
          <table className="data_table struct_fields">
            <tbody>
              <tr><th>{t('欄位', 'Field')}</th><th style={{ width: '1%' }}>{t('型別', 'Type')}</th><th style={{ width: '1%' }}></th></tr>
              {s.fields.map((f, k) => {
                const setField = (patch: Partial<StructField>, rename?: StructRename) => update(s, { fields: s.fields.map((x, j) => (j == k ? { ...x, ...patch } : x)) }, rename);
                return (
                  <tr key={k}>
                    <td>
                      <NameInput
                        value={f.name} placeholder={FIELD_EXAMPLES[k] ?? ''}
                        onCommit={name => {
                          const why = name && fieldProblem(name, s.fields.filter((_, j) => j != k).map(x => x.name.trim()));
                          if (why) {
                            alert(why);
                            return false;
                          }
                          setField({ name }, f.name && name && s.name ? { kind: 'field', struct: s.name, from: f.name, to: name } : undefined);
                          return true;
                        }}
                      />
                    </td>
                    <td>
                      <select
                        className="var_input" value={f.type == '文字' ? 'string' : f.float ? 'float' : 'int'}
                        onChange={e => setField(e.target.value == 'string' ? { type: '文字', float: undefined } : { type: '數字', float: e.target.value == 'float' || undefined })}
                      >
                        <option value="int">{t('int（整數）', 'int')}</option>
                        <option value="float">{t('float（小數）', 'float')}</option>
                        <option value="string">{t('string（文字）', 'string')}</option>
                      </select>
                    </td>
                    <td>
                      <button
                        className="delete_var" title={t('刪除這個欄位', 'Delete this field')} aria-label={t('刪除', 'Delete')}
                        onClick={() => {
                          if (f.name && fieldInUse(s, f.name) && !confirm(t(`流程圖裡有用到「.${f.name}」，刪掉後那些積木執行時會出錯。確定要刪除嗎？`, `The flowchart uses ".${f.name}". Those blocks will fail after you delete it. Delete anyway?`))) return;
                          update(s, { fields: s.fields.filter((_, j) => j != k) });
                        }}
                      >✕</button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <button className="create_field" onClick={() => update(s, { fields: [...s.fields, { name: '', type: '數字' }] })}>＋ {t('新增欄位', 'Add a field')}</button>
        </div>
      ))}
      <button className="create_struct" onClick={() => onChange([...structs, { id: ++structSeq, name: '', fields: [{ name: '', type: '數字' }] }])}>
        ＋ {t('新增 struct', 'Add a struct')}
      </button>
    </div>
  );
}

/** 名稱的輸入框：離開或按 Enter 才確定；不能用（onCommit 回傳 false）就改回原本的 */
function NameInput({ value, placeholder, className, onCommit }: { value: string; placeholder: string; className?: string; onCommit: (name: string) => boolean }) {
  const [draft, setDraft] = useState(value);
  useEffect(() => setDraft(value), [value]);
  const commit = () => {
    const name = draft.trim();
    if (name == value) return;
    if (!onCommit(name)) setDraft(value);
  };
  return (
    <input
      className={'var_input' + (className ? ' ' + className : '')} value={draft} placeholder={placeholder}
      onChange={e => setDraft(e.target.value)} onBlur={commit}
      onKeyDown={e => { if (e.key == 'Enter') e.currentTarget.blur(); }}
    />
  );
}
