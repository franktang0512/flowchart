// 新增/編輯積木、選箭頭標籤、清空流程圖時跳出的對話框（舊版 shapes.js 的 node_model）。
// 版面要跟舊版一模一樣，所以元素之間的空白（{' '}）與 <p> 的巢狀方式都照舊版 HTML 被瀏覽器解析後的結果。
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { joinTypes, localTypes, mapTypes, METHODS, type VarStore } from '../engine/decoder';
import type { RectAction, SortKey } from '../engine/labels';
import { cppType, GLOBAL_PREFIX, type LocalVar, type ModuleInfo, type ParamInfo } from '../engine/modules';
import { t, useLang } from '../i18n';
import { byTarget, canReturn as canReturnTarget, getTarget, itemWord } from '../target';
import { fieldCppType, findStruct, type StructDef } from '../engine/structs';

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
  rectKind: '' | '變數' | '清單' | '二維清單' | '回傳' | '接收' | '陣列' | '堆疊' | '佇列' | '結構';
  /** 計算積木：「設為」一般的設定，其他是清單的操作（見 RectAction） */
  rectAction: RectAction;
  /** 變數：true 是「改變」（Scratch「變數改變」、Blockly「將變數的值加」），code 填加多少；存成「x 設為 x + 多少」 */
  varChange: boolean;
  /** 第幾項：計算積木的「插入」「替換」「刪除」，輸入到清單的「插入」「替換」；二維清單是第幾列（建立時是幾列） */
  rectIndex: string;
  /** 二維清單：第幾行（建立時是幾行） */
  rectIndex2: string;
  /** 輸入積木要存到變數、清單還是二維清單的一格；'' = 還沒選（先選類型才出現下拉選單） */
  ioTarget: '' | '變數' | '清單' | '二維清單' | '陣列' | '堆疊' | '佇列' | '結構';
  /** struct 的欄位：struct 變數的 e.from，或裝 struct 的容器那一格的 edges[i].w；'' 是一整筆（只有容器可以） */
  rectField: string;
  /** 排序：由大到小（false 是由小到大） */
  sortDesc: boolean;
  /** 排序裝 struct 的：依哪些欄位，前面的一樣大才比後面的（例如分數由大到小、一樣再比名字） */
  sortKeys: SortKey[];
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
  // stack、queue（C++）
  ['放入', () => t('push（放進去）', 'push')],
  ['取出', () => t('pop（拿掉一個）', 'pop')],
  // C++：vector、array 排序
  ['排序', () => t('排序（sort）', 'Sort')],
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
  放入: () => t('push：把值放進 stack（放在最上面），或放進 queue（排在最後面）...', 'push: put a value on top of a stack, or at the back of a queue...'),
  取出: () => t('pop：拿掉 stack 最上面的，或 queue 最前面的（要先確定裡面不是空的）。要用那個值，請先用 top() 或 front() 讀出來...', 'pop: remove the top of a stack, or the front of a queue (it must not be empty). To use the value, read it first with top() or front()...'),
  排序: () => t('sort：把 vector 或 array 由小到大（或由大到小）排好...', 'sort: put a vector or array in order, small to large (or large to small)...'),
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
  放入: null,
  取出: null,
  排序: null,
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
  放入: () => 'push',
  取出: null,
  排序: null,
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
  rectField: '',
  sortDesc: false,
  sortKeys: [],
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
  /** 每個變數裝什麼（struct 變數、裝 struct 的容器是 struct 的名稱；找欄位用） */
  holds?: Record<string, string>;
  /** C++ 的全域變數：模組裡也列出來 */
  globals?: string[];
  /** C++：被 main 同名變數蓋住的全域變數（主流程的選單不標「全域」） */
  shadowed?: string[];
  /** C++：只有全域變數的那一份（可能跟 main 的變數同名、型別不一樣），模組裡用這一份 */
  globalTypes?: VarTypes;
  globalHolds?: Record<string, string>;
}

/**
 * 選變數的下拉選單（像 Scratch 一樣用選的，不會打錯字），只列出一種類型的變數。
 * 舊作品裡填的值不在選項裡時，也放進選項，打開修改才不會被清掉。
 */
function VarPicker({ id, value, onChange, names, params = [], locals = [], marked }: { id: string; value: string; onChange: (v: string) => void; names: string[]; params?: string[]; locals?: string[]; marked?: Set<string> }) {
  /** C++ 的全域變數標出來：「g（全域）」 */
  const label = (name: string) => (marked?.has(name) ? name + t('（全域）', ' (global)') : name);
  // 參數：Blockly、C++ 可以改，Scratch 不行（列出來但不能選，學生才知道參數也是一種變數）
  const readOnly = getTarget() == 'scratch';
  const all = [...names, ...params, ...locals];
  // 在模組裡才分組：全域變數、參數、區域變數（C++）
  const grouped = params.length + locals.length > 0;
  return (
    <select className="var_select" id={id} value={value} onChange={e => onChange(e.target.value)}>
      <option value="" disabled>{all.length ? t('請選擇', 'Choose one') : t('請先到左邊的變數表新增', 'Add one in the variable table first')}</option>
      {value && !all.includes(value) && <option value={value}>{value}</option>}
      {grouped && names.length > 0 && <option disabled>{getTarget() == 'cpp' ? t('── 全域變數 ──', '── Global variables ──') : t('── 主流程的變數 ──', '── Main-flow variables ──')}</option>}
      {names.map(name => <option key={name} value={name}>{label(name)}</option>)}
      {params.length > 0 && <option disabled>{readOnly ? t('── 參數（Scratch 的參數不能改）──', '── Parameters (cannot change in Scratch) ──') : t('── 這個模組的參數 ──', '── Parameters of this module ──')}</option>}
      {params.map(name => <option key={'p_' + name} value={name} disabled={readOnly}>{name}</option>)}
      {locals.length > 0 && <option disabled>{t('── 這個模組的區域變數 ──', '── Local variables of this module ──')}</option>}
      {locals.map(name => <option key={'l_' + name} value={name}>{name}</option>)}
    </select>
  );
}

/** vector（可以變長變短的清單）：清單裡拿掉 array（array 也可以用 [索引]，但大小固定） */
const vectorsOf = (ty: VarTypes) => ty.array.filter(n => !ty.fixed.includes(n));

/** 算式欄位下面「點一下填入」的說明 */

/**
 * 算式欄位下面的「點一下填入」（只有 C++）：選一個 vector、array、stack 或 queue，
 * 點按鈕就把 s.top()、q.front()、v.size()、a[ ] 這些寫法填到游標的位置，不用自己打。
 * inputId 是要填進去的輸入框（記得游標在哪裡）
 */
/** 「點一下填入」的一個按鈕：填進去的字、按鈕上的字、填完游標停在第幾個字（沒有就是最後面）、說明 */
interface Snippet {
  key: string;
  text: string;
  label?: string;
  caret?: number;
  hint: string;
}

/** 填完游標停在第一個「[]」或「()」中間（接著打索引或引數） */
const caretInside = (text: string, pair: '[]' | '()') => (text.includes(pair) ? text.indexOf(pair) + 1 : undefined);

/**
 * 算式欄位下面的「點一下填入」（只有 C++）：選一個 vector、array、stack、queue、string、二維 vector 或 struct，
 * 點按鈕就把 s.top()、q.front()、v.size()、a[ ]、name.substr( )、g[ ].size() 這些寫法填到游標的位置，不用自己打。
 * inputId 是要填進去的輸入框（記得游標在哪裡）
 */
function ExprHelper({ inputId, types, holds, value, onChange }: { inputId: string; types: VarTypes; holds: Record<string, string>; value: string; onChange: (v: string) => void }) {
  const items: [string, keyof typeof METHODS | 'array' | 'struct' | 'grid'][] = [
    ...types.record.map(n => [n, 'struct'] as [string, 'struct']),
    ...types.stack.map(n => [n, 'stack'] as [string, 'stack']),
    ...types.queue.map(n => [n, 'queue'] as [string, 'queue']),
    ...vectorsOf(types).map(n => [n, 'vector'] as [string, 'vector']),
    ...types.fixed.map(n => [n, 'array'] as [string, 'array']),
    ...types.grid.map(n => [n, 'grid'] as [string, 'grid']),
    ...types.text.map(n => [n, 'string'] as [string, 'string']),
  ];
  const [pick, setPick] = useState(items[0]?.[0] ?? '');
  if (getTarget() != 'cpp' || !items.length) return null;
  const [name, kind] = items.find(x => x[0] == pick) ?? items[0];
  const struct = findStruct(holds[name]);
  const fieldHint = t('struct 的欄位', 'A struct field');
  const hints: Record<string, string> = {
    top: t('stack 最上面的值（最後放進去的）', 'The top of the stack (the last one in)'),
    front: t('queue 最前面的值（最早放進去的）', 'The front of the queue (the first one in)'),
    back: t('queue 最後面的值（最後放進去的）', 'The back of the queue (the last one in)'),
    size: t('裡面有幾個', 'How many items'),
    length: t('有幾個字', 'How many letters'),
    empty: t('是不是空的（真／假）', 'Is it empty? (true / false)'),
  };
  let snippets: Snippet[];
  if (kind == 'struct') {
    // struct 變數：每個欄位 e.from
    snippets = (struct?.fields ?? []).map(f => ({ key: `field:${f.name}`, text: `${name}.${f.name}`, hint: fieldHint }));
  }
  else if (kind == 'string') {
    // string：長度、取一段、變成整數
    snippets = [
      { key: 'length', text: `${name}.length()`, hint: hints.length },
      { key: 'index', text: `${name}[]`, label: `${name}[ ]`, caret: name.length + 1, hint: t('第幾個字（索引從 0 開始）', 'One letter (index from 0)') },
      { key: 'substr', text: `${name}.substr()`, label: `${name}.substr(${t('開始', 'start')}, ${t('幾個字', 'count')})`, caret: caretInside(`${name}.substr()`, '()'), hint: t('從某個索引開始取幾個字，例如 s.substr(0, 3) 是前 3 個字', 'Take some letters from an index, like s.substr(0, 3) for the first 3') },
      { key: 'stoi', text: `stoi(${name})`, hint: t('把文字變成整數，例如 "123" 變成 123', 'Turn text into a whole number, like "123" into 123') },
    ];
  }
  else if (kind == 'grid') {
    // 二維 vector：某一格、某一列有幾個（鄰接串列：g[u] 有幾個鄰居）
    snippets = [
      { key: 'cell', text: `${name}[][]`, label: `${name}[ ][ ]`, caret: name.length + 1, hint: t('某一格：[列][行]', 'One cell: [row][column]') },
      { key: 'rowsize', text: `${name}[].size()`, label: `${name}[ ].size()`, caret: name.length + 1, hint: t('某一列有幾個（例如 g[u] 有幾個鄰居）', 'How many in one row (like how many neighbors g[u] has)') },
      { key: 'rows', text: `${name}.size()`, hint: t('有幾列', 'How many rows') },
      // 裝 struct：某一格的欄位 g[u][k].to
      ...(struct?.fields ?? []).map(f => ({ key: `field:${f.name}`, text: `${name}[][].${f.name}`, label: `${name}[ ][ ].${f.name}`, caret: name.length + 1, hint: fieldHint })),
    ];
  }
  else {
    snippets = [
      ...(kind == 'array' ? [] : METHODS[kind].map(m => ({ key: m, text: `${name}.${m}()`, hint: hints[m] }))),
      ...(kind == 'array' || kind == 'vector' ? [{ key: 'index', text: `${name}[]`, label: `${name}[ ]`, caret: name.length + 1, hint: t('某一格：在 [ ] 裡填索引（從 0 開始）', 'One item: put the index (from 0) in [ ]') }] : []),
      // 整個 vector / array 裡最大、最小的（裝 struct 的不能直接比）
      ...((kind == 'array' || kind == 'vector') && !struct ? [
        { key: 'max', text: `max(${name})`, hint: t('裡面最大的值', 'The largest value in it') },
        { key: 'min', text: `min(${name})`, hint: t('裡面最小的值', 'The smallest value in it') },
      ] : []),
      // 裝 struct 的容器：vector / array 某一格的欄位 edges[ ].w；stack 頂端、queue 最前面的欄位 s.top().w、q.front().w
      ...(struct?.fields ?? []).flatMap(f => (kind == 'array' || kind == 'vector'
        ? [{ key: `field:${f.name}`, text: `${name}[].${f.name}`, label: `${name}[ ].${f.name}`, caret: name.length + 1, hint: fieldHint }]
        : (kind == 'stack' ? ['top'] : ['front', 'back']).map(m => ({ key: `field:${m}:${f.name}`, text: `${name}.${m}().${f.name}`, hint: fieldHint })))),
    ];
  }
  const insert = (s: Snippet) => {
    const el = document.getElementById(inputId) as HTMLInputElement | null;
    const start = el?.selectionStart ?? value.length;
    const end = el?.selectionEnd ?? start;
    onChange(value.slice(0, start) + s.text + value.slice(end));
    // a[ ]、s.substr( )：游標放在括號裡面，接著打索引或引數
    const caret = start + (s.caret ?? s.text.length);
    requestAnimationFrame(() => {
      el?.focus();
      el?.setSelectionRange(caret, caret);
    });
  };
  const kindName = (k: string) => (k == 'grid' ? t('二維 vector', '2D vector') : k);
  return (
    <p className="expr_helper">
      <span className="muted">{t('點一下填入：', 'Click to insert: ')}</span>
      {items.length > 1 && (
        <select className="var_select" value={name} onChange={e => setPick(e.target.value)} aria-label={t('選一個變數', 'Choose a variable')}>
          {items.map(([n, k]) => <option key={n} value={n}>{n}（{kindName(k)}）</option>)}
        </select>
      )}
      {snippets.map(s => (
        <button type="button" key={s.key} className="snippet" title={s.hint} onClick={() => insert(s)}>
          {s.label ?? s.text}
        </button>
      ))}
    </p>
  );
}

/** 輸入到清單時，下面那行說明 */
const IO_NOTE: Record<DialogForm['ioPlace'], (list: string, k: string) => string> = {
  加入: list => t(`輸入的值會添加到清單「${list}」的最後面`, `The value goes to the end of the list "${list}".`),
  插入: (list, k) => t(`輸入的值會插到清單「${list}」的${itemWord(k || '?')}，原本那項和後面的都往後移`, `The value goes to ${itemWord(k || '?')} of "${list}". The items after it move back.`),
  替換: (list, k) => t(`輸入的值會換掉清單「${list}」的${itemWord(k || '?')}`, `The value replaces ${itemWord(k || '?')} of "${list}".`),
};

export function NodeDialog({ request, onClose, varTypes, modules, holds = {}, globals = [], shadowed = [], globalTypes, globalHolds }: Props) {
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
      {request && <DialogBody key={request.id} request={request} onClose={onClose} varTypes={request.inModule && getTarget() == 'cpp' && globalTypes ? globalTypes : varTypes} modules={modules} holds={request.inModule && getTarget() == 'cpp' && globalHolds ? globalHolds : holds} globals={globals} shadowed={shadowed} globalTypes={globalTypes} />}
    </dialog>
  );
}

function DialogBody({ request, onClose, varTypes, modules, holds: globalHolds, globals, shadowed, globalTypes }: { request: DialogRequest; onClose: () => void; varTypes: VarTypes; modules: ModuleInfo[]; holds: Record<string, string>; globals: string[]; shadowed: string[]; globalTypes?: VarTypes }) {
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
    // C++：模組裡用的是只有全域變數的那一份（見 NodeDialog 傳進來的 varTypes）
    : target == 'cpp' ? list.filter(n => globals.includes(n) && !own.has(n))
    : list.flatMap(n => (!own.has(n) ? [n] : target == 'scratch' ? [GLOBAL_PREFIX + n] : [])));
  varTypes = mapTypes(varTypes, shown);
  // C++ 的主流程：被 main 同名變數蓋住的全域數字、文字變數，用 ::a 選得到
  if (target == 'cpp' && !request.inModule && globalTypes) {
    const scoped = (list: string[]) => list.filter(n => shadowed.includes(n)).map(n => '::' + n);
    varTypes = { ...varTypes, number: [...varTypes.number, ...scoped(globalTypes.number)], text: [...varTypes.text, ...scoped(globalTypes.text)] };
  }
  const allTypes: VarTypes = joinTypes(varTypes, localT);
  /**
   * 選單裡標「（全域）」的變數（C++）：主流程裡是沒有被 main 同名變數蓋住的全域變數（被蓋住的話，選單裡那個名字是 main 自己的）；
   * 模組裡列出來的主流程變數都是全域變數
   */
  const globalMarks = new Set(target != 'cpp' ? [] : request.inModule ? globals : [...globals.filter(n => !shadowed.includes(n)), ...shadowed.map(n => '::' + n)]);
  /** 每個變數裝什麼（區域變數蓋過全域的） */
  const holds: Record<string, string> = { ...globalHolds, ...Object.fromEntries((request.locals ?? []).map(v => [v.name.trim(), v.init])) };
  /** 這個變數（struct 變數或裝 struct 的容器）是哪一種 struct */
  const structOfVar = (name: string): StructDef | undefined => findStruct(holds[name]);
  const [f, setF] = useState<DialogForm>(() => {
    const form = { ...defaultForm(kind), ...request.initial };
    // 打開已經畫好的輸入積木：依變數表判斷原本存到變數還是清單
    if (form.radio == '輸入' && !form.ioTarget && form.varSelect) {
      const v = form.varSelect;
      form.ioTarget = allTypes.record.includes(v) ? '結構' : allTypes.grid.includes(v) ? '二維清單' : allTypes.fixed.includes(v) ? '陣列' : allTypes.stack.includes(v) ? '堆疊' : allTypes.queue.includes(v) ? '佇列'
        : form.ioPlace != '加入' || allTypes.array.includes(v) ? '清單' : '變數';
    }
    return form;
  });
  const set = (patch: Partial<DialogForm>) => setF(prev => ({ ...prev, ...patch }));
  /** 在模組裡：這個模組的參數（數字、文字都可以設定） */
  const paramNames = (request.params ?? []).map(p => p.name);
  /** 輸入積木「存到」選的那一類變數 */
  const ioNames = (ty: VarTypes) => (f.ioTarget == '清單' ? vectorsOf(ty) : f.ioTarget == '二維清單' ? ty.grid
    : f.ioTarget == '陣列' ? ty.fixed : f.ioTarget == '堆疊' ? ty.stack : f.ioTarget == '佇列' ? ty.queue : f.ioTarget == '結構' ? ty.record
    : [...ty.number, ...ty.text]);
  /** C++ 的容器在選項上的名字（積木還是叫「清單」） */
  const listWord = byTarget(t('清單', 'List'), 'vector');
  /** 只有變數表裡有這種容器（或原本就選了）才列出來 */
  const hasKind = (k: 'fixed' | 'stack' | 'queue' | 'record', chosen: boolean) => allTypes[k].length > 0 || chosen;
  /**
   * 選 struct 的欄位。whole：可以選「一整筆」（容器的一格整個換掉，例如換成 struct 變數 e）；
   * 選了容器或 struct 變數之後才出現
   */
  const fieldPicker = (s: StructDef | undefined, whole: boolean) => s && (
    <>
      {' '}{t('欄位', 'Field')}{' '}
      <select className="var_select field_select" id="field_select" value={f.rectField} onChange={e => set({ rectField: e.target.value })}>
        {whole ? <option value="">{t(`一整筆 ${s.name}`, `A whole ${s.name}`)}</option> : <option value="" disabled>{t('請選擇', 'Choose one')}</option>}
        {s.fields.map(x => <option key={x.name} value={x.name}>{x.name}（{fieldCppType(x)}）</option>)}
      </select>
    </>
  );
  /** 選了變數：是 struct 變數的話先選第一個欄位 */
  const pickVar = (v: string, recordKind: boolean) => set({ varSelect: v, rectField: recordKind ? structOfVar(v)?.fields[0]?.name ?? '' : '' });
  /** 算式欄位下面的「點一下填入」 */
  const helper = (inputId: string, value: string, onChange: (v: string) => void) => (
    <ExprHelper inputId={inputId} types={allTypes} holds={holds} value={value} onChange={onChange} />
  );

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
    : getTarget() == 'cpp' ? ' ' + cppType(m.returns, m.returnsFloat, m.returnsLong)
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
                  <label><input type="radio" name="io_target" checked={f.ioTarget == '清單'} onChange={() => set({ ioTarget: '清單', varSelect: '' })} />{listWord}</label>
                  {(allTypes.grid.length > 0 || f.ioTarget == '二維清單') && (
                    <label><input type="radio" name="io_target" checked={f.ioTarget == '二維清單'} onChange={() => set({ ioTarget: '二維清單', varSelect: '' })} />{t('二維清單的一格', 'A 2D list cell')}</label>
                  )}
                  {hasKind('fixed', f.ioTarget == '陣列') && (
                    <label><input type="radio" name="io_target" checked={f.ioTarget == '陣列'} onChange={() => set({ ioTarget: '陣列', ioPlace: '替換', varSelect: '' })} />{t('array 的一格', 'An array item')}</label>
                  )}
                  {hasKind('stack', f.ioTarget == '堆疊') && (
                    <label><input type="radio" name="io_target" checked={f.ioTarget == '堆疊'} onChange={() => set({ ioTarget: '堆疊', ioPlace: '加入', varSelect: '' })} />stack</label>
                  )}
                  {hasKind('queue', f.ioTarget == '佇列') && (
                    <label><input type="radio" name="io_target" checked={f.ioTarget == '佇列'} onChange={() => set({ ioTarget: '佇列', ioPlace: '加入', varSelect: '' })} />queue</label>
                  )}
                  {hasKind('record', f.ioTarget == '結構') && (
                    <label><input type="radio" name="io_target" checked={f.ioTarget == '結構'} onChange={() => set({ ioTarget: '結構', varSelect: '', rectField: '' })} />{t('struct 的欄位', 'A struct field')}</label>
                  )}
                </p>
                {f.ioTarget && (
                  <p>
                    <VarPicker
                      marked={globalMarks}
                      id="var_select" value={f.varSelect} onChange={v => pickVar(v, f.ioTarget == '結構' || !!structOfVar(v))}
                      names={ioNames(varTypes)}
                      params={f.ioTarget == '變數' ? paramNames : []}
                      locals={ioNames(localT)}
                    />
                    {/* struct 變數：選要輸入到哪個欄位 */}
                    {f.ioTarget == '結構' && fieldPicker(structOfVar(f.varSelect), false)}
                  </p>
                )}
                {f.ioTarget == '結構' && f.varSelect && f.rectField && (
                  <span className="dialog_note">{t(`輸入的值會存進 ${f.varSelect}.${f.rectField}`, `The value goes into ${f.varSelect}.${f.rectField}.`)}</span>
                )}
                {f.ioTarget == '二維清單' && (
                  <p>
                    {t('列（索引）', 'Row index')} <input id="rect_index" style={{ width: '20%' }} value={f.rectIndex} onChange={e => set({ rectIndex: e.target.value })} />{' '}
                    {t('行（索引）', 'Column index')} <input id="rect_index2" style={{ width: '20%' }} value={f.rectIndex2} onChange={e => set({ rectIndex2: e.target.value })} />
                    {/* 裝 struct：一次輸入一個欄位 */}
                    {fieldPicker(structOfVar(f.varSelect), false)}
                  </p>
                )}
                {(f.ioTarget == '堆疊' || f.ioTarget == '佇列') && structOfVar(f.varSelect) && (
                  <span className="dialog_note">{t(`裡面裝的是 struct ${holds[f.varSelect]}，不能一次輸入一整筆：請先輸入到 struct 變數的欄位，再用計算積木 push 進去。`, `It holds struct ${holds[f.varSelect]}. Input into a struct variable's fields first, then push it with a Math block.`)}</span>
                )}
                {f.ioTarget == '陣列' && (
                  <>
                    <p>
                      {t('索引', 'Index')} <input id="rect_index" style={{ width: '25%' }} value={f.rectIndex} onChange={e => set({ rectIndex: e.target.value })} />
                      {/* 裝 struct 的 array：一次輸入一個欄位 */}
                      {fieldPicker(structOfVar(f.varSelect), false)}
                    </p>
                    {f.varSelect && <span className="dialog_note">{t(`輸入的值會存進 array「${f.varSelect}」的索引 ${f.rectIndex.trim() || '?'}${f.rectField ? ` 的 .${f.rectField}` : ''}`, `The value goes into index ${f.rectIndex.trim() || '?'}${f.rectField ? ` (.${f.rectField})` : ''} of the array "${f.varSelect}".`)}</span>}
                  </>
                )}
                {(f.ioTarget == '堆疊' || f.ioTarget == '佇列') && f.varSelect && (
                  <span className="dialog_note">{f.ioTarget == '堆疊'
                    ? t(`輸入的值會 push 到 stack「${f.varSelect}」的最上面`, `The value is pushed on top of the stack "${f.varSelect}".`)
                    : t(`輸入的值會 push 到 queue「${f.varSelect}」的最後面`, `The value is pushed to the back of the queue "${f.varSelect}".`)}</span>
                )}
                {f.ioTarget == '清單' && structOfVar(f.varSelect) && (
                  // 裝 struct 的 vector：不能一次輸入一整筆，只能輸入某一格的某個欄位（要加新的一筆：先輸入到 struct 變數，再用計算積木 push_back）
                  <>
                    <p>
                      {t('索引', 'Index')} <input id="rect_index" style={{ width: '25%' }} value={f.rectIndex} onChange={e => set({ rectIndex: e.target.value, ioPlace: '替換' })} />
                      {fieldPicker(structOfVar(f.varSelect), false)}
                    </p>
                    <span className="dialog_note">{t(`vector<${holds[f.varSelect]}> 不能一次輸入一整筆：要加新的一筆，請先輸入到 struct 變數的欄位，再用計算積木「添加」把它放進去。`, `You cannot input a whole ${holds[f.varSelect]}. To add one, input into a struct variable's fields, then add it with a Math block.`)}</span>
                  </>
                )}
                {f.ioTarget == '清單' && !structOfVar(f.varSelect) && (
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
                      {helper('var_select_output', f.varSelectOutput, v => set({ varSelectOutput: v }))}
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
          {helper('code', f.code, v => set({ code: v }))}
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
            {f.showWhile && helper('code', f.code, v => set({ code: v }))}
          </div>{' '}
          <div id="for_div" style={{ display: f.showWhile ? 'none' : 'block' }}>{' '}
            <p id="hint">{t('請輸入次數', 'How many times?')}</p>{' '}
            <input id="for_number" style={{ width: '80%' }} value={f.forNumber} onChange={e => set({ forNumber: e.target.value })} />{' '}
            {!f.showWhile && helper('for_number', f.forNumber, v => set({ forNumber: v }))}
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
        : k == '清單' ? vectorsOf(ty)
        : k == '二維清單' ? ty.grid
        : k == '陣列' ? ty.fixed
        : k == '堆疊' ? ty.stack
        : k == '佇列' ? ty.queue
        : k == '結構' ? ty.record
        : []);
      const cell = kind == '二維清單' && f.rectAction == '替換';
      /** 二維 vector 的某一列後面添加（鄰接串列 g[u].push_back(v)） */
      const rowPush = kind == '二維清單' && f.rectAction == '加入';
      const indexLabel = !kind ? null : cell || rowPush ? () => t('列（索引）', 'Row index') : RECT_INDEX[f.rectAction];
      const index2Label = !kind ? null : f.rectAction == '建立' ? t('行數', 'Columns') : cell ? t('行（索引）', 'Column index') : null;
      const verb = kind && kind != '接收' ? RECT_VERB[f.rectAction] : null;
      // 有回傳值的模組（Scratch 的模組不能回傳，看不到這個選項）
      const returning = modules.filter(x => x.returns);
      const recvModule = returning.find(x => x.name == f.moduleName);
      const noLists = vectorsOf(allTypes).length == 0;
      /** 變數「改變」：只能選數字變數，值是加多少、沒有捨去進位 */
      const change = kind == '變數' && f.varChange;
      /** 選了一類：動作換成這一類的第一個，原本選的變數不能用就清掉 */
      const pickKind = (k: DialogForm['rectKind']) => set({
        rectKind: k,
        varChange: false,
        rectAction: k == '變數' || k == '接收' || k == '結構' ? '設為' : k == '回傳' ? '回傳' : k == '二維清單' ? '建立' : k == '陣列' ? '替換' : k == '堆疊' || k == '佇列' ? '放入' : '加入',
        rectField: '',
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
              <input type="radio" name="rect_kind" checked={kind == '清單'} disabled={noLists && kind != '清單'} onChange={() => pickKind('清單')} />{byTarget(t('清單', 'A list'), 'vector')}
              {noLists && kind != '清單' && <span className="muted">{byTarget(t('（變數表還沒有清單）', ' (no lists yet)'), t('（變數表還沒有 vector）', ' (no vectors yet)'))}</span>}
            </label>
            {hasKind('fixed', kind == '陣列') && (
              <label><input type="radio" name="rect_kind" checked={kind == '陣列'} onChange={() => pickKind('陣列')} />array</label>
            )}
            {hasKind('stack', kind == '堆疊') && (
              <label><input type="radio" name="rect_kind" checked={kind == '堆疊'} onChange={() => pickKind('堆疊')} />stack</label>
            )}
            {hasKind('queue', kind == '佇列') && (
              <label><input type="radio" name="rect_kind" checked={kind == '佇列'} onChange={() => pickKind('佇列')} />queue</label>
            )}
            {hasKind('record', kind == '結構') && (
              <label><input type="radio" name="rect_kind" checked={kind == '結構'} onChange={() => pickKind('結構')} />{t('struct 的欄位', 'A struct field')}</label>
            )}
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
              {RECT_ACTIONS.filter(([action]) => ['加入', '插入', '替換', '刪除', '清空', ...(getTarget() == 'cpp' ? ['排序'] : [])].includes(action)).map(([action, label]) => actionRadio(action, label()))}
            </p>
          )}
          {kind == '變數' && (
            <p className="rect_action">
              {t('怎麼改：', 'How: ')}
              <label><input type="radio" name="var_action" checked={!f.varChange} onChange={() => set({ varChange: false })} />{t('設為', 'Set to')}</label>
              <label><input type="radio" name="var_action" checked={f.varChange} onChange={() => set({ varChange: true, radio: '' })} />{t('改變（加多少）', 'Change by')}</label>
            </p>
          )}
          {(kind == '堆疊' || kind == '佇列') && (
            <p className="rect_action">
              {t('怎麼改：', 'How: ')}
              {actionRadio('放入', kind == '堆疊' ? t('push（放到最上面）', 'push (on top)') : t('push（排到最後面）', 'push (to the back)'))}
              {actionRadio('取出', kind == '堆疊' ? t('pop（拿掉最上面的）', 'pop (remove the top)') : t('pop（拿掉最前面的）', 'pop (remove the front)'))}
            </p>
          )}
          {kind == '二維清單' && (
            <p className="rect_action">
              {t('怎麼改：', 'How: ')}
              {actionRadio('建立', t('建立（幾列幾行）', 'Make (rows × columns)'))}
              {actionRadio('替換', t('替換一格', 'Change one cell'))}
              {actionRadio('加入', t('在某一列後面添加（push_back）', 'Add to the end of a row (push_back)'))}
            </p>
          )}
          {rowPush && <p className="dialog_note">{t('鄰接串列：先「建立 n 列 0 行」，每一列一開始是空的，再把鄰居一個一個添加到那一列，例如 g[u].push_back(v)。', 'Adjacency list: first make n rows × 0 columns (every row starts empty), then add neighbors to a row, like g[u].push_back(v).')}</p>}
          {kind == '陣列' && getTarget() == 'cpp' && (
            <p className="rect_action">
              {t('怎麼改：', 'How: ')}
              {actionRadio('替換', t('替換某一格', 'Change one item'))}
              {actionRadio('排序', t('排序（sort）', 'Sort'))}
            </p>
          )}
          {kind && kind != '回傳' && (
            <>
              {kind == '變數' ? t('變數：', 'Variable: ') : kind == '接收' ? t('回傳值存到變數：', 'Save it in: ') : kind == '二維清單' ? t('二維清單：', '2D list: ')
                : kind == '陣列' ? 'array：' : kind == '堆疊' ? 'stack：' : kind == '佇列' ? 'queue：' : kind == '結構' ? 'struct：' : byTarget(t('清單：', 'List: '), 'vector：')}
              <VarPicker marked={globalMarks} id="var_select" value={f.varSelect} onChange={v => pickVar(v, kind == '結構')} names={change ? varTypes.number : namesFor(kind, varTypes)} params={kind == '變數' || kind == '接收' ? paramNames : []} locals={change ? localT.number : namesFor(kind, localT)} />
            </>
          )}
          {indexLabel && (
            <>
              <br /><br /> {indexLabel()}{' '}
              <input id="rect_index" style={{ width: '25%' }} value={f.rectIndex} onChange={e => set({ rectIndex: e.target.value })} />{' '}
              {!cell && f.rectAction != '建立' && indexSuffix()}
              {/* 裝 struct 的 vector、array：替換一整筆，或只改某個欄位 */}
              {f.rectAction == '替換' && (kind == '清單' || kind == '陣列') && fieldPicker(structOfVar(f.varSelect), true)}
            </>
          )}
          {/* struct 變數：選要改哪個欄位 */}
          {kind == '結構' && fieldPicker(structOfVar(f.varSelect), false)}
          {f.rectAction == '排序' && (kind == '清單' || kind == '陣列') && (
            <>
              {structOfVar(f.varSelect)
                // 裝 struct：一層一層選欄位和順序，前面的一樣大才比下一個
                ? (() => {
                  const s = structOfVar(f.varSelect)!;
                  const keys = f.sortKeys.length ? f.sortKeys : [{ field: '', desc: false }];
                  const setKey = (k: number, patch: Partial<SortKey>) => set({ sortKeys: keys.map((x, j) => (j == k ? { ...x, ...patch } : x)) });
                  return (
                    <div className="sort_keys">
                      {keys.map((key, k) => (
                        <p key={k}>
                          {k == 0 ? t('先依', 'Sort by') : t('一樣大時再依', 'If equal, by')}{' '}
                          <select className="var_select field_select" value={key.field} onChange={e => setKey(k, { field: e.target.value })}>
                            <option value="" disabled>{t('請選擇欄位', 'Choose a field')}</option>
                            {s.fields.map(x => <option key={x.name} value={x.name}>{x.name}（{fieldCppType(x)}）</option>)}
                          </select>{' '}
                          <select className="var_select field_select" value={key.desc ? 'desc' : 'asc'} onChange={e => setKey(k, { desc: e.target.value == 'desc' })}>
                            <option value="asc">{t('由小到大', 'small → large')}</option>
                            <option value="desc">{t('由大到小', 'large → small')}</option>
                          </select>
                          {k > 0 && <button type="button" className="snippet" title={t('拿掉這個條件', 'Remove')} onClick={() => set({ sortKeys: keys.filter((_, j) => j != k) })}>✕</button>}
                        </p>
                      ))}
                      {keys.length < s.fields.length && (
                        <button type="button" className="snippet" onClick={() => set({ sortKeys: [...keys, { field: '', desc: false }] })}>
                          {t('＋ 一樣大的時候，再依另一個欄位排', '+ If equal, sort by another field')}
                        </button>
                      )}
                    </div>
                  );
                })()
                : (
                  <p className="rect_action">
                    {t('順序：', 'Order: ')}
                    <label><input type="radio" name="sort_dir" checked={!f.sortDesc} onChange={() => set({ sortDesc: false })} />{t('由小到大', 'Small → large')}</label>
                    <label><input type="radio" name="sort_dir" checked={f.sortDesc} onChange={() => set({ sortDesc: true })} />{t('由大到小', 'Large → small')}</label>
                  </p>
                )}
              {/* array 常常只用到前 n 格：sort(a, a + n) */}
              {kind == '陣列' && (
                <p>
                  {t('只排前', 'Only the first')} <input id="rect_index" style={{ width: '20%' }} value={f.rectIndex} placeholder={t('全部', 'all')} onChange={e => set({ rectIndex: e.target.value })} /> {t('個（空白就是全部）', '(empty = all)')}
                </p>
              )}
            </>
          )}
          {index2Label && (
            <>
              {' '}{index2Label}{' '}
              <input id="rect_index2" style={{ width: '25%' }} value={f.rectIndex2} onChange={e => set({ rectIndex2: e.target.value })} />
              {/* 裝 struct 的二維 vector：替換一整筆，或只改某個欄位 */}
              {cell && fieldPicker(structOfVar(f.varSelect), true)}
            </>
          )}
          {verb && change && (
            <>
              <br /><br /> {t('改變', 'by')} {codeInput}
              {helper('code', f.code, v => set({ code: v }))}
              <p className="dialog_note">{t('填 1 就是加 1，填 -1 就是減 1', '1 adds one, -1 takes one away')}</p>
            </>
          )}
          {verb && !change && (
            <>
              <br /><br /> {verb()} {codeInput}{' '}
              {helper('code', f.code, v => set({ code: v }))}
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
