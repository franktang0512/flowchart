// 第三步左邊的「變數」表格
import { useEffect, useRef, useState } from 'react';
import type { LocalVar, ParamInfo } from '../engine/modules';
import { isContainerType, type VarType } from '../engine/structure';
import { findStruct, getStructs } from '../engine/structs';
import { t, useLang } from '../i18n';
import { getTarget } from '../target';
import { useCommit } from '../useCommit';

export interface VarRow {
  id: number;
  name: string;
  /** 二維清單、陣列、堆疊、佇列只有學習目標是 C++ 時可以選（Scratch 沒有） */
  type: VarType;
  init: string;
  desc: string;
  /** C++：數字是 float（小數）；沒有就是 int（整數）。Scratch、Blockly 不分 */
  float?: boolean;
  /** C++ 的 array：大小（宣告時就決定） */
  size?: string;
  /** C++：數字是 long long（很大的整數）；int 超過約 21 億會溢位 */
  long?: boolean;
  /** struct 變數每個欄位的初始值（欄位名稱 → 值；沒填是 0 或空的文字） */
  fieldInit?: Record<string, string>;
  /** C++：全域變數（宣告在 main 外面，每個模組都用得到，例如 DFS 要用的圖和 visited） */
  global?: boolean;
}

/** 容器（清單、陣列、堆疊…）：初始值欄改成選裡面裝什麼 */
const isListType = isContainerType;

/** C++ 的容器在型別選單裡的名字（滑鼠移上去看說明） */
const CPP_CONTAINERS: [VarType, () => string, () => string][] = [
  ['清單', () => 'vector', () => t('vector：可以變長變短的清單', 'vector: a list that can grow')],
  ['二維清單', () => t('二維 vector', '2D vector'), () => t('二維 vector：表格', '2D vector: a table')],
  // 跟 int（整數）、string（文字）一樣，C++ 的名字後面加中文
  ['陣列', () => t('array（陣列）', 'array'), () => t('array（陣列）：大小固定', 'array: fixed size')],
  ['堆疊', () => 'stack', () => t('stack（堆疊）：後放進去的先拿出來', 'stack: last in, first out')],
  ['佇列', () => 'queue', () => t('queue（佇列）：先放進去的先拿出來', 'queue: first in, first out')],
];

interface Props {
  rows: VarRow[];
  /** C++：變數表上面的 struct 定義（只在主流程顯示） */
  structArea?: React.ReactNode;
  /** 這一題可以用的容器（題目的 var_types）；沒有就是都可以 */
  allowed?: VarType[];
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
    /** 改參數的名稱或型別；名字不能用時回傳原因 */
    onParam: (k: number, patch: Partial<ParamInfo>) => string | null;
    onProblem: (why: string) => void;
  };
}

let localSeq = 1_000_000;

export function VarTable({ rows, structArea, allowed, onChange, onCommit, onDelete, onCreate, module }: Props) {
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
    <div id="step3" className={getTarget() == 'cpp' ? 'card cpp_types' : 'card'}>
      <h5 className="card_title"><span className="step_badge">3</span>{t('定義變數', 'Variables')}</h5>
      {module && (
        // 模組的參數：名稱、型別可以在這裡改，但不能在這裡刪（要刪請到模組上方的「修改名稱、參數」）
        <>
          <p className="section_label var_section">{t(`模組「${module.name}」的參數（要刪除參數，請到模組上方的「修改名稱、參數」）`, `Parameters of "${module.name}" (to remove one, use "Edit name, parameters" above the module)`)}</p>
          {module.params.length == 0
            ? <p className="muted param_none">{t('這個模組沒有參數。', 'This module has no parameters.')}</p>
            : (
              <table id="param_table" className="data_table">
                <tbody>
                  {head}
                  {module.params.map((p, k) => (
                    <tr key={k + ':' + p.name} className="param_row">
                      <td><ParamName name={p.name} onCommit={name => module.onParam(k, { name })} /></td>
                      <td>
                        <select className="var_input" value={typeValue(p.type, p.float, p.long)} onChange={e => module.onParam(k, fromTypeValue(e.target.value) as Partial<ParamInfo>)}>
                          <TypeOptions />
                        </select>
                      </td>
                      {/* 初始值：參數的值由「執行模組」積木傳進來（C++ 其實可以給預設值，這裡先只練習傳參數） */}
                      <td className="param_init" title={getTarget() == 'cpp'
                        ? t('C++ 其實可以替參數設預設值（例如 int a = 0），這裡先練習在執行模組時把值傳進來。', 'C++ can give a parameter a default value (like int a = 0). Here, practice passing the value in when the module runs.')
                        : t('參數的值由「執行模組」積木傳進來。', 'The value comes from the "Run module" block.')}>
                        <span className="muted">{t('由執行模組傳入', 'Passed in')}</span>
                      </td>
                      <td><ParamDesc desc={p.desc ?? ''} onCommit={desc => module.onParam(k, { desc })} /></td>
                      <td></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          {module.params.length > 0 && (
            <p className="muted param_rule">{getTarget() == 'scratch'
              ? t('參數在模組裡只能拿來算，不能改（Scratch 的規定）。', 'Inside the module you can use a parameter but not change it (a Scratch rule).')
              : getTarget() == 'cpp'
              ? t('參數的值由「執行模組」傳進來。C++ 其實可以替參數設預設值，這裡先專心練習傳參數。參數也是變數：流程裡可以改它的值，但只改到模組自己的那一份。', 'The value is passed in by "Run module". C++ can give a parameter a default value, but here we practice passing values. You can change a parameter in the flow; only the module\'s own copy changes.')
              : t('參數也是變數：流程裡可以改它的值，但只改到模組自己的那一份。', 'A parameter is a variable too. You can change it in the flow, but only the module\'s own copy changes.')}</p>
          )}
          {module.locals && <LocalTable module={module.name} rows={module.locals} allowed={allowed} onLocals={module.onLocals} problem={module.localProblem} onProblem={module.onProblem} head={head} />}
          {/* 全域變數只在主流程顯示；模組這裡只列這個模組自己的 */}
          <p className="muted global_note">{getTarget() == 'cpp'
            ? t('C++ 的主流程變數寫在 main 裡面，模組用不到：要用的值請加參數傳進來，要把結果帶回主流程請用回傳。主流程的變數勾了「全域」的話，每個模組都用得到（例如遞迴要用的陣列、圖）。', 'In C++ the main-flow variables are inside main, so a module cannot use them. Pass values in as parameters, and use a return value to bring a result back. Main-flow variables marked "Global" can be used by every module (like an array or graph for recursion).')
            : getTarget() == 'scratch'
            ? t('Scratch 沒有只屬於函式的變數：要用變數，請回到「主流程」新增，模組裡也能用。主流程的變數跟參數同名時，選單裡會寫成「主流程的a」，指的是主流程的那個 a。', 'Scratch has no variables that belong only to a function. Add them in the main flow; modules can use them too. If one has the same name as a parameter, the menu shows it as "主流程的a".')
            : t('Blockly 沒有只屬於函式的變數：要用變數，請回到「主流程」新增，模組裡也能用。', 'Blockly has no variables that belong only to a function. Add them in the main flow; modules can use them too.')}</p>
        </>
      )}
      {!module && (
        <>
          {structArea}
          <table id="var_table" className="data_table">
            <tbody>
              {head}
              {rows.map(row => (
                <VarRowView key={row.id} row={row} allowed={allowed} canGlobal={getTarget() == 'cpp'} onChange={onChange} onCommit={onCommit} onDelete={onDelete} />
              ))}
            </tbody>
          </table>
          <button id="createRow" onClick={onCreate}>＋ {t('新增變數', 'Add a variable')}</button>
        </>
      )}
    </div>
  );
}

/**
 * 型別下拉選單的值：C++ 的數字分 int（'數字'）、float（'float'）；文字是 string。
 * Scratch、Blockly 只有數字、文字
 */
/** struct 變數收起來時顯示的初始值，照 C++ 的寫法：{1, 2, "Amy"}；全部沒填是 {} */
function structInitText(row: VarRow): string {
  const fields = findStruct(row.init)?.fields ?? [];
  if (!fields.some(f => (row.fieldInit?.[f.name] ?? '').trim())) return '{}';
  return '{' + fields.map(f => {
    const v = (row.fieldInit?.[f.name] ?? '').trim();
    if (f.type != '文字') return v || '0';
    return /^(".*"|'.*')$/.test(v) ? v : JSON.stringify(v);
  }).join(', ') + '}';
}

/** 型別選單裡 struct 的值：「struct:Edge」 */
const STRUCT_PREFIX = 'struct:';

export const typeValue =(type: string, float?: boolean, long?: boolean) => (type == '數字' && getTarget() == 'cpp' ? (float ? 'float' : long ? 'long' : type) : type);
export const fromTypeValue = (value: string) => (value == 'float'
  ? { type: '數字' as const, float: true, long: undefined }
  : value == 'long'
  ? { type: '數字' as const, float: undefined, long: true }
  : { type: value as VarRow['type'], float: undefined, long: undefined });

/** 數字、文字的選項（C++ 寫成 int、float、string）；beforeString 放在 float 和 string 中間（變數表的 array） */
export function TypeOptions({ beforeString }: { beforeString?: React.ReactNode } = {}) {
  if (getTarget() == 'cpp') {
    return (
      <>
        <option value="數字">{t('int（整數）', 'int')}</option>
        {/* 很大的整數：int 超過約 21 億會溢位 */}
        <option value="long" title={t('int 最大大約 21 億，超過會溢位變成負的；要存更大的整數用 long long', 'An int goes up to about 2.1 billion; bigger numbers overflow. Use long long for bigger whole numbers.')}>{t('long long（大整數）', 'long long')}</option>
        <option value="float">{t('float（小數）', 'float')}</option>
        {beforeString}
        <option value="文字">{t('string（文字）', 'string')}</option>
      </>
    );
  }
  return (
    <>
      <option value="數字">{t('數字', 'Number')}</option>
      <option value="文字">{t('文字', 'Text')}</option>
    </>
  );
}

/** 參數的說明（像註解，學生自己寫）：離開或按 Enter 才存 */
function ParamDesc({ desc, onCommit }: { desc: string; onCommit: (desc: string) => void }) {
  const [draft, setDraft] = useState(desc);
  useEffect(() => setDraft(desc), [desc]);
  return (
    <input
      className="var_input param_desc" value={draft} placeholder={t('這個參數是做什麼用的', 'What is it for?')}
      onChange={e => setDraft(e.target.value)}
      onBlur={() => { if (draft != desc) onCommit(draft); }}
      onKeyDown={e => { if (e.key == 'Enter') e.currentTarget.blur(); }}
    />
  );
}

/** 參數名稱的輸入框：離開或按 Enter 才改（改名時模組流程圖裡用到的地方跟著改）；名字不能用就改回原本的 */
function ParamName({ name, onCommit }: { name: string; onCommit: (name: string) => string | null }) {
  const [draft, setDraft] = useState(name);
  useEffect(() => setDraft(name), [name]);
  const commit = () => {
    if (draft.trim() == name) {
      setDraft(name);
      return;
    }
    const why = onCommit(draft.trim());
    if (why) {
      alert(why);
      setDraft(name);
    }
  };
  return (
    <input
      className="var_input param_name" value={draft} onChange={e => setDraft(e.target.value)}
      onBlur={commit} onKeyDown={e => { if (e.key == 'Enter') e.currentTarget.blur(); }}
    />
  );
}

/** C++ 模組的區域變數：只有這個模組用得到，每次執行模組都重新從初始值開始 */
function LocalTable({ module, rows, allowed, onLocals, problem, onProblem, head }: {
  module: string;
  rows: LocalVar[];
  allowed?: VarType[];
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
                key={row.id} row={row} allowed={allowed} className="local_row"
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

function VarRowView({ row, allowed, canGlobal = false, onChange, onCommit, onDelete, className }: { row: VarRow; allowed?: VarType[]; canGlobal?: boolean; className?: string } & Pick<Props, 'onChange' | 'onCommit' | 'onDelete'>) {
  const commit = useCommit<HTMLInputElement>(onCommit);
  const cpp = getTarget() == 'cpp';
  /**
   * C++ 容器的選項（照 types 的順序）。題目可以限制能用哪些容器
   * （例如「用 array 自己做 stack」的題目就不給 stack）；已經選了的照樣列出來
   */
  const containerOptions = (types: VarType[]) => types
    .filter(type => !allowed || allowed.includes(type) || row.type == type)
    .map(type => {
      const [, short, long] = CPP_CONTAINERS.find(c => c[0] == type)!;
      return <option key={type} value={type} title={long()}>{short()}</option>;
    });
  const text = (field: 'name' | 'init' | 'desc' | 'size') => ({
    className: 'var_input',
    value: row[field] ?? '',
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => onChange(row.id, { [field]: e.target.value }),
    ...commit,
  });
  return (
    <tr className={className}>
      <td>
        <input {...text('name')} />
        {/* C++：勾了就是全域變數，模組（函式）也用得到；舊作品勾過的照樣顯示，才能取消 */}
        {(canGlobal || row.global) && (
          <label className="global_flag" title={t('全域變數：宣告在 main 外面，每個模組都用得到（例如遞迴的 DFS 要用的圖、visited）', 'Global: declared outside main, so every module can use it (like the graph and visited for a recursive DFS)')}>
            <input type="checkbox" checked={!!row.global} onChange={e => { onChange(row.id, { global: e.target.checked || undefined }); onCommit(); }} />
            {t('全域', 'Global')}
          </label>
        )}
      </td>
      <td>
        <select
          className="var_input" value={row.type == '結構' ? STRUCT_PREFIX + row.init : typeValue(row.type, row.float, row.long)}
          onChange={e => {
            // 選了某個 struct（例如 Edge）：型別是 struct，初始值欄記是哪一個
            const structName = e.target.value.startsWith(STRUCT_PREFIX) ? e.target.value.slice(STRUCT_PREFIX.length) : null;
            if (structName != null) {
              onChange(row.id, { type: '結構', init: structName, float: undefined, long: undefined, fieldInit: undefined });
              onCommit();
              return;
            }
            const { type, float, long } = fromTypeValue(e.target.value);
            // 預設的初始值跟著型別換：數字是 0，文字是空的，清單預設裝數字；改成 int 時初始值的小數去掉
            // 換成別的容器時，原本裝的 struct 照樣留著
            const keepStruct = isListType(type) && findStruct(row.init);
            let init = isListType(type) ? (row.init == '文字' || row.init == '小數' || row.init == '長整數' || keepStruct ? row.init : '數字')
              : row.type == '結構' ? (type == '數字' ? '0' : '')
              : isListType(row.type) ? (type == '數字' ? '0' : '')
              : type == '文字' && row.init == '0' ? '' : type == '數字' && row.init == '' ? '0' : row.init;
            if (type == '數字' && !float && /^\s*-?\d+\.\d*\s*$/.test(init)) init = String(Math.trunc(Number(init)));
            // array 要先有大小：預設 5 格
            onChange(row.id, { type, init, float, long, ...(type == '陣列' && !row.size?.trim() ? { size: '5' } : {}) });            onCommit();
          }}
        >
          {/* C++：array 放在 float 和 string 中間，其他容器放在後面 */}
          <TypeOptions beforeString={cpp && containerOptions(['陣列'])} />
          {cpp
            ? <>
                {containerOptions(['清單', '二維清單', '堆疊', '佇列'])}
                {/* 定義好的 struct 直接當型別（跟 C++ 寫 Edge e; 一樣）；題目也可以不給 struct */}
                {(!allowed || allowed.includes('結構') || row.type == '結構') && getStructs().length > 0 && (
                  <optgroup label={t('自己定義的 struct', 'Your structs')}>
                    {getStructs().map(s => <option key={s.name} value={STRUCT_PREFIX + s.name}>{s.name}（struct）</option>)}
                  </optgroup>
                )}
                {/* 選的 struct 被刪掉或改名了：照樣列出來，才看得出原本是什麼 */}
                {row.type == '結構' && !findStruct(row.init) && <option value={STRUCT_PREFIX + row.init} disabled>{row.init || 'struct'}（{t('不存在', 'missing')}）</option>}
              </>
            : <>
                <option value="清單">{t('清單', 'List')}</option>
                {/* 從 C++ 換過來的舊作品：只有 C++ 有的型別照樣列出來，才不會被悄悄改掉 */}
                {CPP_CONTAINERS.filter(([type]) => type != '清單' && row.type == type).map(([type, short]) => <option key={type} value={type}>{short()}</option>)}
              </>}
        </select>
      </td>
      <td>
        {row.type == '清單' && getTarget() != 'cpp'
          // 積木（Scratch / Blockly）的清單跟 Scratch 一樣，數字、文字都能放，不用先決定型別（C++ 才要選）
          ? <span className="muted list_any" title={t('清單一開始是空的，數字和文字都可以放', 'The list starts empty. It can hold numbers and text.')}>{t('數字、文字都可以', 'Numbers or text')}</span>
          : row.type == '結構'
          // struct 變數：型別欄已經選了是哪一個 struct；每個欄位一開始是 0（string 是空的）
          ? (
            // struct 變數：每個欄位填初始值（跟 C++ 的 Edge e = {1, 2, 7}; 一樣），沒填是 0（string 是空的）
            // 平常只顯示一行 {1, 2, 7}，點一下展開才改每個欄位（欄位多的 struct 這一列才不會太高）
            <details className="struct_init">
              <summary title={t('點一下展開，修改每個欄位的初始值；沒填就是 0（string 是空的）', 'Click to edit the start value of each field. Empty means 0 (or empty text).')}>
                <code>{structInitText(row)}</code>
              </summary>
              <span className="struct_init_fields">
                {(findStruct(row.init)?.fields ?? []).map(f => (
                  <label key={f.name}>
                    <span className="muted">{f.name}</span>
                    <input
                      className="var_input" value={row.fieldInit?.[f.name] ?? ''} placeholder={f.type == '文字' ? '""' : '0'}
                      onChange={e => onChange(row.id, { fieldInit: { ...row.fieldInit, [f.name]: e.target.value } })}
                      {...commit}
                    />
                  </label>
                ))}
              </span>
            </details>
          )
          : isListType(row.type)
          ? (
            // 清單一開始是空的；這一欄改成選清單裡裝什麼（C++ 要寫成 vector<int> 還是 vector<string>，或 vector<Edge>）
            <select
              className="var_input" value={row.init == '文字' || row.init == '小數' || row.init == '長整數' || findStruct(row.init) ? row.init : '數字'}
              title={row.type == '二維清單'
                ? t('二維清單一開始是空的，要先用計算積木「建立 幾 列 幾 行」；這裡選裡面要裝什麼', 'The 2D list starts empty. Make it with a Math block (rows × columns). Choose what it holds.')
                : row.type == '陣列'
                ? t('array 一開始就有固定的格數，每格是 0（string 是空的）；這裡選裡面要裝什麼', 'An array has a fixed number of items from the start. Each is 0 (or empty text). Choose what it holds.')
                : t('一開始是空的，這裡選裡面要裝什麼', 'It starts empty. Choose what it holds.')}
              onChange={e => { onChange(row.id, { init: e.target.value }); onCommit(); }}
            >
              {getTarget() == 'cpp'
                ? <>
                    <option value="數字">{t('裝 int', 'int')}</option>
                    <option value="長整數">{t('裝 long long', 'long long')}</option>
                    <option value="小數">{t('裝 float', 'float')}</option>
                    <option value="文字">{t('裝 string', 'string')}</option>
                    {/* 每一種容器都可以裝自己定義的 struct，例如 vector<vector<Edge>>（有權重的鄰接串列）、queue<Node> */}
                    {getStructs().map(s => <option key={s.name} value={s.name}>{t(`裝 ${s.name}`, s.name)}</option>)}
                  </>
                : <>
                    <option value="數字">{t('裝數字', 'Numbers')}</option>
                    <option value="文字">{t('裝文字', 'Text')}</option>
                  </>}
            </select>
          )
          : <input {...text('init')} />}
        {row.type == '陣列' && (
          // array 的大小：C++ 宣告時就要寫，例如 int a[5]
          <label className="array_size" title={t('array 有幾格（宣告時就決定，之後不能改）', 'How many items (fixed when declared)')}>
            {t('大小', 'Size')} <input {...text('size')} inputMode="numeric" />
          </label>
        )}
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
