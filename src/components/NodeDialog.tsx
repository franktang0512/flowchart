// 新增/編輯積木、選箭頭標籤、清空流程圖時跳出的對話框（舊版 shapes.js 的 node_model）。
// 版面要跟舊版一模一樣，所以元素之間的空白（{' '}）與 <p> 的巢狀方式都照舊版 HTML 被瀏覽器解析後的結果。
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { joinTypes, localTypes, mapTypes, METHODS, type VarStore } from '../engine/decoder';
import { pyElemName } from '../engine/modules';
import type { RectAction, SortKey } from '../engine/labels';
import { cppType, fieldDefaultText, GLOBAL_PREFIX, newExprText, type LocalVar, type ModuleInfo, type ParamInfo } from '../engine/modules';
import { t, useLang } from '../i18n';
import { byTarget, canReturn as canReturnTarget, getTarget, isCode, isPython, itemWord, moduleWord } from '../target';
import { forInit, INT_PTR, parseExpr, ptrOf, pyFor, type VarInfo } from '../engine/structure';
import { fieldCppType, findStruct, getStructs, type StructDef } from '../engine/structs';

export type DialogKind =
  | 'Circle' | 'Parallelogram' | 'Diamond' | 'Loop' | 'For_Loop' | 'While_Loop'
  | 'Function' | 'Rectangle' | 'link_tf' | 'link_for' | 'link_until' | 'link_while' | 'clear';

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
  rectKind: '' | '變數' | '清單' | '二維清單' | '回傳' | '接收' | '陣列' | '堆疊' | '佇列' | '結構' | '迴圈控制' | '集合' | '對應表' | '優先佇列' | '指標';
  /** C++ 的指標（rectKind 是 '指標'）：要存到哪裡（p、p->next、p->val、*pp），或 delete 哪一個 */
  ptrTarget: string;
  /** C++ 的指標「建立新的一筆」：建立哪一種 struct、每個欄位放什麼（空的放 0、""、nullptr） */
  ptrStruct: string;
  ptrFields: string[];
  /** 計算積木：「設為」一般的設定，其他是清單的操作（見 RectAction） */
  rectAction: RectAction;
  /** 變數：true 是「改變」（Scratch「變數改變」、Blockly「將變數的值加」），code 填加多少；存成「x 設為 x + 多少」 */
  varChange: boolean;
  /** 第幾項：計算積木的「插入」「替換」「刪除」，輸入到清單的「插入」「替換」；二維清單是第幾列（建立時是幾列） */
  rectIndex: string;
  /** 二維清單：第幾行（建立時是幾行） */
  rectIndex2: string;
  /** 輸入積木要存到變數、清單還是二維清單的一格；'' = 還沒選（先選類型才出現下拉選單） */
  ioTarget: '' | '變數' | '清單' | '二維清單' | '陣列' | '堆疊' | '佇列' | '結構' | '集合' | '對應表' | '優先佇列' | '多個';
  /** Python：一行讀好幾個變數（ioTarget 是 '多個'）：a, b = map(int, input().split()) */
  ioMany: string[];
  /** Python 的 for 迴圈（radio 是 'pyfor'）：整行「for i in range(n)」「for x in a」 */
  pyFor: string;
  /** Python 的輸出不換行：print(..., end=" ") */
  noNewline: boolean;
  /** Python 排序的 key：lambda x: 後面的算式（空白是比每一項本身） */
  sortKey: string;
  /** struct 的欄位：struct 變數的 e.from，或裝 struct 的容器那一格的 edges[i].w；'' 是一整筆（只有容器可以） */
  rectField: string;
  /** 排序：由大到小（false 是由小到大） */
  sortDesc: boolean;
  /** 排序裝 struct 的：依哪些欄位，前面的一樣大才比後面的（例如分數由大到小、一樣再比名字） */
  sortKeys: SortKey[];
  /** C++ 的 for 迴圈（radio 是 'cfor'）：for (第一段; 第二段; 第三段)，例如 int i = 0、i < n、i++ */
  forInit: string;
  forCond: string;
  forUpdate: string;
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
  ['刪除', () => byTarget(t('刪除第幾項', 'Delete item'), t('刪除某個索引', 'Delete at index'), t('pop(索引)（拿掉某一項）', 'pop(index)'))],
  ['清空', () => byTarget(t('刪除所有項目', 'Delete all'), t('刪除所有項目', 'Delete all'), 'clear()')],
  // 只有變數表裡有二維清單（C++）時才出現
  ['建立', () => t('建立二維清單', 'Make 2D list')],
  // 只有在有回傳值的模組裡才出現
  ['回傳', () => t('回傳', 'Return')],
  // stack、queue（C++）
  ['放入', () => t('push（放進去）', 'push')],
  ['取出', () => t('pop（拿掉一個）', 'pop')],
  // C++：vector、array 排序
  ['排序', () => t('排序（sort）', 'Sort')],
  // C++：迴圈裡用
  ['跳出', () => t('break（跳出迴圈）', 'break (leave the loop)')],
  ['下一輪', () => t('continue（直接進入下一輪）', 'continue (go to the next round)')],
];

const RECT_HINT: Record<RectAction, () => string> = {
  設為: () => t('將變數內的值設為...', 'Set a variable to...'),
  加入: () => byTarget(t('把值添加到清單的最後面...', 'Add a value to the end of a list...'), t('把值添加到清單的最後面...', 'Add a value to the end of a list...'), t('append：把值加到 list 的最後面（當 stack 用就是放到最上面）...', 'append: add a value to the end of the list (the top, if you use it as a stack)...')),
  插入: () => t(`把值插到清單的${byTarget('第幾項', '某個索引')}，原本那項和後面的都往後移...`, 'Put a value into a list. The items after it move back...'),
  替換: () => t(`把清單的${byTarget('第幾項', '某個索引')}換成新的值...`, 'Change one item of a list...'),
  刪除: () => t(`刪除清單的${byTarget('第幾項', '某個索引')}，後面的都往前移...`, 'Delete one item from a list. The items after it move up...'),
  清空: () => t('刪除清單的所有項目，清單會變成空的...', 'Delete all items. The list will be empty...'),
  建立: () => t('設定二維清單有幾列、幾行，每一格先放 0（裝文字的放空的文字）...', 'Set how many rows and columns. Every cell starts as 0 (or empty text)...'),
  // Python 的 list 也可以建立：a = [0] * n（見 DialogBody）
  回傳: () => t('把這個值交回給執行模組的地方，然後離開模組（後面直接接「結束」）...', 'Give this value back and leave the module (go straight to "End")...'),
  放入: () => t('push：把值放進 stack（放在最上面），或放進 queue（排在最後面）...', 'push: put a value on top of a stack, or at the back of a queue...'),
  取出: () => byTarget(
    t('pop：拿掉 stack 最上面的，或 queue 最前面的（要先確定裡面不是空的）。要用那個值，請先用 top() 或 front() 讀出來...', 'pop: remove the top of a stack, or the front of a queue (it must not be empty). To use the value, read it first with top() or front()...'),
    t('pop：拿掉 stack 最上面的，或 queue 最前面的（要先確定裡面不是空的）。要用那個值，請先用 top() 或 front() 讀出來...', 'pop: remove the top of a stack, or the front of a queue (it must not be empty). To use the value, read it first with top() or front()...'),
    t('pop()：拿掉 list 最後一個（stack 的頂端；要先確定不是空的）。要用那個值，請先用 a[-1] 讀出來...', 'pop(): remove the last item (the top of a stack; it must not be empty). To use it, read it first with a[-1]...')),
  排序: () => byTarget(t('sort：把 vector 或 array 由小到大（或由大到小）排好...', 'sort: put a vector or array in order, small to large (or large to small)...'), t('sort：把 vector 或 array 由小到大（或由大到小）排好...', 'sort: put a vector or array in order, small to large (or large to small)...'), t('sort()：把 list 由小到大（或由大到小）排好...', 'sort(): put the list in order, small to large (or large to small)...')),
  跳出: () => t('break：馬上跳出最近的迴圈（這個積木後面不用接箭頭）...', 'break: leave the nearest loop right away (no arrow after this block)...'),
  下一輪: () => t('continue：這一輪後面的不做了，直接進入下一輪（這個積木後面不用接箭頭）...', 'continue: skip the rest of this round and go to the next round (no arrow after this block)...'),
  釋放: () => t('delete：把 new 出來的那一筆還回去（之後不能再用它）...', 'delete: give back what you made with new (you cannot use it after this)...'),
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
  跳出: null,
  下一輪: null,
  釋放: null,
};

/** 「第幾項」欄位後面的字：積木是「項」，C++ 沒有 */
const indexSuffix = () => byTarget(t('項', ''), '');

/** 值的輸入欄前面的字（沒有值的是 null） */
const RECT_VERB: Record<RectAction, (() => string) | null> = {
  設為: () => t('設為', 'to'),
  加入: () => byTarget(t('添加', 'add'), t('添加', 'add'), 'append'),
  插入: () => t('插入', 'insert'),
  替換: () => t('換成', 'with'),
  刪除: null,
  清空: null,
  建立: null,
  回傳: () => t('回傳', 'return'),
  放入: () => 'push',
  取出: null,
  排序: null,
  跳出: null,
  下一輪: null,
  釋放: null,
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
  link_until: '假',
  link_while: '真',
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
  ptrTarget: '',
  ptrStruct: '',
  ptrFields: [],
  sortDesc: false,
  sortKeys: [],
  forInit: '',
  forCond: '',
  forUpdate: '',
  ioTarget: '',
  ioMany: ['', ''],
  pyFor: '',
  noNewline: false,
  sortKey: '',
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
  const items: [string, keyof typeof METHODS | 'array' | 'struct' | 'grid' | 'ptr' | 'ptr2'][] = [
    // 指標（linked list）放最前面
    ...types.ptr.map(n => [n, 'ptr'] as [string, 'ptr']),
    ...types.ptr2.map(n => [n, 'ptr2'] as [string, 'ptr2']),
    ...types.record.map(n => [n, 'struct'] as [string, 'struct']),
    ...types.stack.map(n => [n, 'stack'] as [string, 'stack']),
    ...types.queue.map(n => [n, 'queue'] as [string, 'queue']),
    ...types.pq.map(n => [n, 'pq'] as [string, 'pq']),
    ...types.set.map(n => [n, 'set'] as [string, 'set']),
    ...types.map.map(n => [n, 'map'] as [string, 'map']),
    ...vectorsOf(types).map(n => [n, 'vector'] as [string, 'vector']),
    ...types.fixed.map(n => [n, 'array'] as [string, 'array']),
    ...types.grid.map(n => [n, 'grid'] as [string, 'grid']),
    ...types.text.map(n => [n, 'string'] as [string, 'string']),
  ];
  const [pick, setPick] = useState(items[0]?.[0] ?? '');
  if (!isCode() || !items.length) return null;
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
    count: kind == 'map' ? t('有沒有這個鍵（1 是有、0 是沒有）', 'Is this key in it? (1 yes, 0 no)') : t('有沒有這個值（1 是有、0 是沒有）', 'Is this value in it? (1 yes, 0 no)'),
  };
  if (kind == 'pq') hints.top = t('最大的（小的先出來的是最小的）', 'The largest (or the smallest, for smallest-first)');
  let snippets: Snippet[];
  if (isPython()) snippets = pySnippets(name, kind, !!struct);
  // int* p：它指到的那個 int *p；int** pp：它指到的 int* *pp，再往下的 int **pp
  else if (kind == 'ptr' && holds[name] == INT_PTR) {
    snippets = [
      { key: 'deref', text: `*${name}`, hint: t(`${name} 指到的那個 int`, `The int ${name} points to`) },
      { key: 'notnull', text: `${name} != nullptr`, hint: t(`${name} 有沒有指到東西（真／假）`, `Does ${name} point to something? (true / false)`) },
      { key: 'null', text: 'nullptr', hint: t('沒有指到任何東西', 'Points to nothing') },
      { key: 'addr', text: `&${name}`, hint: t(`指到 ${name} 這個指標的指標（int**）`, `A pointer to the pointer ${name} (int**)`) },
    ];
  }
  else if (kind == 'ptr2' && holds[name] == INT_PTR) {
    snippets = [
      { key: 'deref', text: `*${name}`, hint: t(`${name} 指到的那個 int*`, `The int* ${name} points to`) },
      { key: 'deref2', text: `**${name}`, hint: t(`再往下一層：最後指到的那個 int`, `One more level: the int at the end`) },
      { key: 'notnull', text: `*${name} != nullptr`, hint: t(`*${name} 有沒有指到東西（真／假）`, `Does *${name} point to something? (true / false)`) },
    ];
  }
  else if (kind == 'ptr') {
    // Node* p：指到的欄位 p->val、有沒有指到東西、要一筆新的、指到 p 的指標 &p
    const fields = struct?.fields ?? [];
    snippets = [
      ...fields.map(f => ({ key: `arrow:${f.name}`, text: `${name}->${f.name}`, hint: t(`${name} 指到的那一筆的 ${f.name}`, `The ${f.name} of what ${name} points to`) })),
      { key: 'notnull', text: `${name} != nullptr`, hint: t(`${name} 有沒有指到東西（真／假）`, `Does ${name} point to something? (true / false)`) },
      { key: 'null', text: 'nullptr', hint: t('沒有指到任何東西', 'Points to nothing') },
      ...(struct ? [{ key: 'new', text: `new ${struct.name}{}`, label: `new ${struct.name}{ ${fields.map(f => f.name).join(', ')} }`, caret: `new ${struct.name}{`.length, hint: t(`要一筆新的 ${struct.name}：照順序填每個欄位，得到指到它的指標`, `Make a new ${struct.name}: fill each field in order. You get a pointer to it`) }] : []),
      { key: 'addr', text: `&${name}`, hint: t(`指到 ${name} 這個指標的指標（${struct?.name ?? ''}**）`, `A pointer to the pointer ${name} (${struct?.name ?? ''}**)`) },
      ...fields.filter(f => f.type == '指標').map(f => ({ key: `addr:${f.name}`, text: `&${name}->${f.name}`, hint: t(`指到 ${name}->${f.name} 這個指標的指標`, `A pointer to the pointer ${name}->${f.name}`) })),
    ];
  }
  else if (kind == 'ptr2') {
    // Node** pp：它指到的那個指標 *pp、再往下的欄位 (*pp)->val、往後走 &(*pp)->next
    const fields = struct?.fields ?? [];
    snippets = [
      { key: 'deref', text: `*${name}`, hint: t(`${name} 指到的那個指標（${struct?.name ?? ''}*）`, `The pointer ${name} points to (${struct?.name ?? ''}*)`) },
      ...fields.map(f => ({ key: `arrow:${f.name}`, text: `(*${name})->${f.name}`, hint: t(`*${name} 指到的那一筆的 ${f.name}`, `The ${f.name} of what *${name} points to`) })),
      ...fields.filter(f => f.type == '指標').map(f => ({ key: `addr:${f.name}`, text: `&(*${name})->${f.name}`, hint: t(`往後走一個：指到下一個 ${f.name} 指標`, `Move on: point to the next ${f.name} pointer`) })),
      { key: 'notnull', text: `*${name} != nullptr`, hint: t(`*${name} 有沒有指到東西（真／假）`, `Does *${name} point to something? (true / false)`) },
    ];
  }
  else if (kind == 'struct') {
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
      // 一個字（char）：數字的字變數字、判斷是哪一種字、換大小寫
      { key: 'digit', text: `${name}[] - '0'`, label: `${name}[ ] - '0'`, caret: name.length + 1, hint: t("數字的字變成數字：'7' - '0' 是 7", "Turn a digit letter into a number: '7' - '0' is 7") },
      { key: 'isdigit', text: `isdigit(${name}[])`, label: `isdigit(${name}[ ])`, caret: name.length + 9, hint: t('這個字是不是 0～9（真／假）', 'Is this letter 0-9? (true / false)') },
      { key: 'isalpha', text: `isalpha(${name}[])`, label: `isalpha(${name}[ ])`, caret: name.length + 9, hint: t('這個字是不是英文字母（真／假）', 'Is this an English letter? (true / false)') },
      { key: 'toupper', text: `toupper(${name}[])`, label: `toupper(${name}[ ])`, caret: name.length + 9, hint: t('變成大寫的字', 'The capital letter') },
      { key: 'tolower', text: `tolower(${name}[])`, label: `tolower(${name}[ ])`, caret: name.length + 9, hint: t('變成小寫的字', 'The small letter') },
      { key: 'char', text: 'char()', label: 'char( )', caret: 5, hint: t("數字變成字：char(97) 是 'a'、char('a' + 2) 是 'c'", "Number to letter: char(97) is 'a', char('a' + 2) is 'c'") },
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
      // map 的一格：m[鍵]
      ...(kind == 'map' ? [{ key: 'index', text: `${name}[]`, label: `${name}[ ]`, caret: name.length + 1, hint: t('某個鍵的值（還沒有這個鍵時，C++ 會先放一個 0 進去）', 'The value of a key (if the key is not there yet, C++ puts a 0 in first)') }] : []),
      ...(kind == 'array' ? [] : METHODS[kind].map(m => ({ key: m, text: `${name}.${m}()`, caret: m == 'count' ? name.length + 7 : undefined, hint: hints[m] }))),
      ...(kind == 'array' || kind == 'vector' ? [{ key: 'index', text: `${name}[]`, label: `${name}[ ]`, caret: name.length + 1, hint: t('某一格：在 [ ] 裡填索引（從 0 開始）', 'One item: put the index (from 0) in [ ]') }] : []),
      // 整個 vector / array 裡最大、最小的（裝 struct 的不能直接比）
      ...((kind == 'array' || kind == 'vector') && !struct ? [
        { key: 'max', text: `max(${name})`, hint: t('裡面最大的值', 'The largest value in it') },
        { key: 'min', text: `min(${name})`, hint: t('裡面最小的值', 'The smallest value in it') },
      ] : []),
      // 裝 struct 的容器：vector / array 某一格的欄位 edges[ ].w；stack 頂端、queue 最前面的欄位 s.top().w、q.front().w
      ...(kind == 'set' || kind == 'map' ? [] : struct?.fields ?? []).flatMap(f => (kind == 'array' || kind == 'vector'
        ? [{ key: `field:${f.name}`, text: `${name}[].${f.name}`, label: `${name}[ ].${f.name}`, caret: name.length + 1, hint: fieldHint }]
        : (kind == 'stack' || kind == 'pq' ? ['top'] : ['front', 'back']).map(m => ({ key: `field:${m}:${f.name}`, text: `${name}.${m}().${f.name}`, hint: fieldHint })))),
      // 裝 pair / struct：放進去的一整筆 {x, y}
      ...(struct ? [{ key: 'brace', text: '{}', label: `{ ${struct.fields.map(f => f.name).join(', ')} }`, caret: 1, hint: t(`一整筆 ${struct.name}：照順序填每個欄位，例如 {${struct.fields.map(f => f.name).join(', ')}}`, `A whole ${struct.name}: fill each field in order`) }] : []),
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
  const kindName = (k: string, n: string) => (isPython() ? pyKindName(k) : k == 'grid' ? t('二維 vector', '2D vector') : k == 'pq' ? 'priority_queue'
    : k == 'ptr' ? `${holds[n] ?? ''}*` : k == 'ptr2' ? `${holds[n] ?? ''}**` : k);
  return (
    <p className="expr_helper">
      <span className="muted">{t('點一下填入：', 'Click to insert: ')}</span>
      {items.length > 1 && (
        <select className="var_select" value={name} onChange={e => setPick(e.target.value)} aria-label={t('選一個變數', 'Choose a variable')}>
          {items.map(([n, k]) => <option key={n} value={n}>{n}（{kindName(k, n)}）</option>)}
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

/** Python 的容器名稱（選單上看的） */
const pyKindName = (k: string) => ({ vector: 'list', grid: t('二維 list', '2D list'), queue: 'deque', pq: 'heapq', set: 'set', map: 'dict', string: 'str', struct: 'tuple', stack: 'list', array: 'list' } as Record<string, string>)[k] ?? k;

/** Python 的「點一下填入」：len( )、a[-1]、q[0]、h[0]、d.get( )、s.upper()、s[::-1]… */
function pySnippets(name: string, kind: string, tuples: boolean): Snippet[] {
  const idx = (hint: string): Snippet => ({ key: 'index', text: `${name}[]`, label: `${name}[ ]`, caret: name.length + 1, hint });
  const len: Snippet = { key: 'len', text: `len(${name})`, hint: t('裡面有幾個（字串是有幾個字）', 'How many items (letters, for a string)') };
  const inside: Snippet = { key: 'in', text: ` in ${name}`, label: `… in ${name}`, caret: 0, hint: t('有沒有在裡面（真／假），在前面寫要找的值，例如 x in a', 'Is it in there? (True / False). Write the value first, like x in a') };
  const tupleParts = (base: string, label: string): Snippet[] => (tuples ? [
    { key: 'first', text: `${base}[0]`, label: `${label}[0]`, caret: base.endsWith('[]') ? base.length - 1 : undefined, hint: t('tuple 的第一個值', 'The first value of the tuple') },
    { key: 'second', text: `${base}[1]`, label: `${label}[1]`, caret: base.endsWith('[]') ? base.length - 1 : undefined, hint: t('tuple 的第二個值', 'The second value of the tuple') },
  ] : []);
  switch (kind) {
    case 'string':
      return [
        len,
        idx(t('第幾個字（索引從 0 開始，-1 是最後一個）', 'One letter (index from 0; -1 is the last)')),
        { key: 'slice', text: `${name}[:]`, label: `${name}[${t('開始', 'start')}:${t('結束', 'end')}]`, caret: name.length + 1, hint: t('取一段：s[0:3] 是前 3 個字（不含索引 3）', 'A part: s[0:3] is the first 3 letters (not index 3)') },
        { key: 'rev', text: `${name}[::-1]`, hint: t('倒過來的字串', 'The string backwards') },
        { key: 'int', text: `int(${name})`, hint: t('把文字變成整數，例如 "123" 變成 123', 'Turn text into a whole number, like "123" into 123') },
        { key: 'isdigit', text: `${name}[].isdigit()`, label: `${name}[ ].isdigit()`, caret: name.length + 1, hint: t('這個字是不是 0～9（真／假）', 'Is this letter 0-9? (True / False)') },
        { key: 'isalpha', text: `${name}[].isalpha()`, label: `${name}[ ].isalpha()`, caret: name.length + 1, hint: t('這個字是不是字母（真／假）', 'Is this a letter? (True / False)') },
        { key: 'upper', text: `${name}.upper()`, hint: t('全部變大寫', 'All capital letters') },
        { key: 'lower', text: `${name}.lower()`, hint: t('全部變小寫', 'All small letters') },
        { key: 'ord', text: `ord(${name}[])`, label: `ord(${name}[ ])`, caret: name.length + 5, hint: t("字的編號：ord('a') 是 97", "The code of a letter: ord('a') is 97") },
        { key: 'chr', text: 'chr()', label: 'chr( )', caret: 4, hint: t("編號變成字：chr(97) 是 'a'", "Code to letter: chr(97) is 'a'") },
        { key: 'split', text: `${name}.split()`, hint: t('用空白切開，變成一個 list', 'Cut at spaces into a list') },
        { key: 'find', text: `${name}.find()`, label: `${name}.find( )`, caret: name.length + 6, hint: t('在第幾個字找到（找不到是 -1）', 'Where it is found (-1 if not found)') },
        { key: 'str', text: 'str()', label: 'str( )', caret: 4, hint: t('數字變成文字（才能跟文字用 + 接起來）', 'Turn a number into text (to join with +)') },
      ];
    case 'grid':
      return [
        { key: 'cell', text: `${name}[][]`, label: `${name}[ ][ ]`, caret: name.length + 1, hint: t('某一格：[列][行]', 'One cell: [row][column]') },
        { key: 'rowlen', text: `len(${name}[])`, label: `len(${name}[ ])`, caret: name.length + 5, hint: t('某一列有幾個（例如 g[u] 有幾個鄰居）', 'How many in one row (like how many neighbors g[u] has)') },
        { key: 'rows', text: `len(${name})`, hint: t('有幾列', 'How many rows') },
      ];
    case 'queue':
      return [
        { key: 'front', text: `${name}[0]`, hint: t('最前面的（最早放進去的）', 'The front (the first one in)') },
        { key: 'back', text: `${name}[-1]`, hint: t('最後面的（最後放進去的）', 'The back (the last one in)') },
        len, inside, ...tupleParts(`${name}[0]`, `${name}[0]`),
      ];
    case 'pq':
      return [
        { key: 'top', text: `${name}[0]`, hint: t('最小的那一個（heapq 只能看 h[0]）', 'The smallest one (with heapq you can only look at h[0])') },
        len, ...tupleParts(`${name}[0]`, `${name}[0]`),
      ];
    case 'set': return [inside, len];
    case 'map':
      return [
        idx(t('某個鍵的值（沒有這個鍵會出錯，可以先用 k in d 檢查）', 'The value of a key (error if the key is missing; check k in d first)')),
        { key: 'get', text: `${name}.get(, 0)`, label: `${name}.get(${t('鍵', 'key')}, 0)`, caret: name.length + 5, hint: t('某個鍵的值；沒有這個鍵就是 0', 'The value of a key; 0 if the key is missing') },
        inside, len,
      ];
    case 'struct':
      return tupleParts(name, name);
    default:
      // list
      return [
        idx(t('某一項：在 [ ] 裡填索引（從 0 開始，-1 是最後一個）', 'One item: put the index in [ ] (from 0; -1 is the last)')),
        { key: 'last', text: `${name}[-1]`, hint: t('最後一個（當 stack 用就是最上面的）', 'The last one (the top, if you use it as a stack)') },
        len, inside,
        ...(tuples ? tupleParts(`${name}[]`, `${name}[ ]`) : [
          { key: 'max', text: `max(${name})`, hint: t('裡面最大的值', 'The largest value in it') },
          { key: 'min', text: `min(${name})`, hint: t('裡面最小的值', 'The smallest value in it') },
          { key: 'sum', text: `sum(${name})`, hint: t('全部加起來', 'All added up') },
          { key: 'index', text: `${name}.index()`, label: `${name}.index( )`, caret: name.length + 7, hint: t('這個值在第幾個（索引；不在裡面會出錯）', 'The index of this value (error if it is not there)') },
        ]),
        ...(tuples ? [{ key: 'tuple', text: '(, )', label: '(a, b)', caret: 1, hint: t('一個 tuple：(a, b)', 'A tuple: (a, b)') }] : []),
      ];
  }
}

/** Python 的 for 迴圈：直接寫一整行，旁邊有常用的寫法可以點 */
function PyForEditor({ f, set }: { f: DialogForm; set: (patch: Partial<DialogForm>) => void }) {
  const presets = ['for i in range(n)', 'for i in range(1, n + 1)', 'for i in range(n - 1, -1, -1)', 'for x in a'];
  const fill = (p: string) => {
    set({ pyFor: p });
    requestAnimationFrame(() => {
      const el = document.getElementById('py_for') as HTMLInputElement | null;
      el?.focus();
      el?.setSelectionRange(el.value.length, el.value.length);
    });
  };
  const ok = !f.pyFor.trim() || pyFor(f.pyFor) != null;
  return (
    <div className="for_editor">
      <p className="for_row">
        <input id="py_for" className="for_input" style={{ width: '60%' }} value={f.pyFor} placeholder={t('點下面的寫法，再改成你要的', 'Pick one below, then change it')} onChange={e => set({ pyFor: e.target.value })} />
      </p>
      <p className="for_row">
        {presets.map(p => <button type="button" key={p} className="snippet" onClick={() => fill(p)}>{p}</button>)}
      </p>
      <p className="dialog_note">
        {ok
          ? t('range(n) 是 0, 1, …, n - 1；range(a, b) 是 a 到 b - 1；range(a, b, -1) 是倒著數。for x in a 是把 a 裡面的一個一個拿出來（a 可以是 list、字串、set、dict）', 'range(n) is 0, 1, …, n - 1; range(a, b) is a to b - 1; range(a, b, -1) counts down. for x in a takes the items of a one by one (a list, string, set or dict).')
          : t('寫法要像「for i in range(n)」或「for x in a」。', 'Write it like "for i in range(n)" or "for x in a".')}
      </p>
    </div>
  );
}

/**
 * C++ 的 for 迴圈：三段一開始是空的、不能打字，點旁邊常用的寫法補上之後，才可以自己改。
 * 上面一行即時顯示整個 for (…; …; …)
 */
function ForEditor({ f, set, helper }: { f: DialogForm; set: (patch: Partial<DialogForm>) => void; helper: (id: string, value: string, onChange: (v: string) => void) => ReactNode }) {
  // 第二、三段的常用寫法照第一段的變數名稱（還沒選就是 i）
  const v = forInit(f.forInit)?.name ?? 'i';
  /** 點常用寫法：補上，游標放到最後面接著打 */
  const fill = (id: string, patch: Partial<DialogForm>) => {
    set(patch);
    requestAnimationFrame(() => {
      const el = document.getElementById(id) as HTMLInputElement | null;
      el?.focus();
      el?.setSelectionRange(el.value.length, el.value.length);
    });
  };
  const row = (n: string, label: string, id: string, field: 'forInit' | 'forCond' | 'forUpdate', presets: string[]) => (
    <p className="for_row">
      <span className="for_label">{n} {label}</span>
      <input
        id={id} className="for_input" value={f[field]} disabled={!f[field]}
        placeholder={t('點右邊的寫法', 'pick one →')}
        onChange={e => set({ [field]: e.target.value })}
      />
      {presets.map(p => (
        <button type="button" key={p} className="snippet" onClick={() => fill(id, { [field]: p })}>{p.trim()}</button>
      ))}
    </p>
  );
  return (
    <div className="for_editor">
      <p className="for_preview"><code>for ({f.forInit || '①'}; {f.forCond || '②'}; {f.forUpdate || '③'})</code></p>
      {row('①', t('開始', 'start'), 'for_init', 'forInit', ['int i = 0', 'int j = 0', 'int k = 0'])}
      {row('②', t('條件', 'while'), 'for_cond', 'forCond', [`${v} < `, `${v} <= `, `${v} > `, `${v} >= `])}
      {f.forCond && helper('for_cond', f.forCond, x => set({ forCond: x }))}
      {row('③', t('每次', 'each time'), 'for_update', 'forUpdate', [`${v}++`, `${v} = ${v} + 1`, `${v}--`, `${v} += 2`])}
    </div>
  );
}

/** 輸入到清單時，下面那行說明 */
const IO_NOTE: Record<DialogForm['ioPlace'], (list: string, k: string) => string> = {
  加入: list => (isPython()
    ? t(`讀一整行：用空白分開的每個值變成 list「${list}」（原本的會被換掉），就是 ${list} = list(map(int, input().split()))`, `Read a whole line: the values (split by spaces) become the list "${list}" (it replaces the old one), like ${list} = list(map(int, input().split()))`)
    : t(`輸入的值會添加到清單「${list}」的最後面`, `The value goes to the end of the list "${list}".`)),
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
  /** 指標變數和 int 變數（判斷「存到」的地方是哪一種指標用） */
  const ptrVars = (): Map<string, VarInfo> => new Map<string, VarInfo>([
    ...allTypes.number.map(n => [n, { name: n, type: '數字', init: '0' }] as [string, VarInfo]),
    ...allTypes.ptr.map(n => [n, { name: n, type: '指標', init: holds[n] ?? '' }] as [string, VarInfo]),
    ...allTypes.ptr2.map(n => [n, { name: n, type: '指標的指標', init: holds[n] ?? '' }] as [string, VarInfo]),
  ]);
  /** 寫的是哪一種指標（Node*、Node**、int*、int**）；不是指標、還沒寫好時 null */
  const ptrTypeOf = (text: string): { s: string; level: 1 | 2 } | null => {
    if (!text.trim()) return null;
    try {
      const p = ptrOf(parseExpr(text), ptrVars());
      return p && p != 'null' ? p : null;
    }
    catch {
      return null;
    }
  };
  /**
   * 「指到」選單：這種指標可以指到哪些地方（nullptr、同一種的指標變數、指標欄位、&x…），
   * 選了就填進值的欄位；自己（存到的地方）不列
   */
  const ptrChoices = (tp: { s: string; level: 1 | 2 }, self: string): { text: string; label: string }[] => {
    const out: { text: string; label: string }[] = [{ text: 'nullptr', label: t('nullptr（不指到任何東西）', 'nullptr (points to nothing)') }];
    const add = (text: string, label: string) => {
      if (text != self && !out.some(c => c.text == text)) out.push({ text, label: `${text}（${label}）` });
    };
    const ptrs = allTypes.ptr.filter(n => holds[n] == tp.s);
    const ptr2s = allTypes.ptr2.filter(n => holds[n] == tp.s);
    /** Node* 變數 v 指到的那一筆裡，型別是 to* 的欄位（例如 next） */
    const linkFields = (v: string) => (findStruct(holds[v])?.fields ?? []).filter(x => x.type == '指標' && x.to == tp.s);
    if (tp.s == INT_PTR && tp.level == 1) {
      allTypes.number.forEach(n => add('&' + n, t(`指到變數 ${n}`, `points to the variable ${n}`)));
      ptrs.forEach(n => add(n, t(`跟 ${n} 指到同一個`, `same as ${n}`)));
      ptr2s.forEach(n => add('*' + n, t(`${n} 指到的那個 int*`, `the int* that ${n} points to`)));
      allTypes.ptr.filter(n => findStruct(holds[n])).forEach(v => (findStruct(holds[v])?.fields ?? []).filter(x => x.type == '數字' && !x.float && !x.long)
        .forEach(x => add(`&${v}->${x.name}`, t(`指到 ${v} 那一筆的 ${x.name}`, `points to ${x.name} of what ${v} points to`))));
    }
    else if (tp.s == INT_PTR) {
      allTypes.ptr.filter(n => holds[n] == INT_PTR).forEach(n => add('&' + n, t(`指到指標 ${n}`, `points to the pointer ${n}`)));
      ptr2s.forEach(n => add(n, t(`跟 ${n} 指到同一個`, `same as ${n}`)));
    }
    else if (tp.level == 1) {
      ptrs.forEach(n => add(n, t(`跟 ${n} 指到同一筆`, `same as ${n}`)));
      allTypes.ptr.forEach(v => linkFields(v).forEach(x => add(`${v}->${x.name}`, t(`${v} 那一筆的 ${x.name}`, `the ${x.name} of what ${v} points to`))));
      ptr2s.forEach(n => add('*' + n, t(`${n} 指到的那個指標`, `the pointer ${n} points to`)));
    }
    else {
      allTypes.ptr.filter(n => holds[n] == tp.s).forEach(n => add('&' + n, t(`指到指標 ${n}`, `points to the pointer ${n}`)));
      allTypes.ptr.forEach(v => linkFields(v).forEach(x => add(`&${v}->${x.name}`, t(`指到 ${v} 那一筆的 ${x.name}`, `points to ${x.name} of what ${v} points to`))));
      ptr2s.forEach(n => add(n, t(`跟 ${n} 指到同一個`, `same as ${n}`)));
      ptr2s.forEach(pp => (findStruct(tp.s)?.fields ?? []).filter(x => x.type == '指標' && x.to == tp.s)
        .forEach(x => add(`&(*${pp})->${x.name}`, t(`往後走一個：指到下一個 ${x.name}`, `move on to the next ${x.name}`))));
    }
    return out;
  };
  const [f, setF] = useState<DialogForm>(() => {
    const form = { ...defaultForm(kind), ...request.initial };
    // C++：新的迴圈預設用 for (int i = 0; i < n; i++)
    if (kind == 'Loop' && getTarget() == 'cpp' && !request.initial?.radio) form.radio = 'cfor';
    // Python：新的迴圈預設用 for i in range(n)
    if (kind == 'Loop' && isPython() && !request.initial?.radio) form.radio = 'pyfor';
    // 打開已經畫好的輸入積木：依變數表判斷原本存到變數還是清單
    if (form.radio == '輸入' && !form.ioTarget && form.varSelect) {
      const v = form.varSelect;
      form.ioTarget = allTypes.record.includes(v) ? '結構' : allTypes.grid.includes(v) ? '二維清單' : allTypes.fixed.includes(v) ? '陣列' : allTypes.stack.includes(v) ? '堆疊' : allTypes.queue.includes(v) ? '佇列'
        : allTypes.map.includes(v) ? '對應表' : allTypes.set.includes(v) ? '集合' : allTypes.pq.includes(v) ? '優先佇列'
        : form.ioPlace != '加入' || allTypes.array.includes(v) ? '清單' : '變數';
    }
    return form;
  });
  const set = (patch: Partial<DialogForm>) => setF(prev => ({ ...prev, ...patch }));
  /** 在模組裡：這個模組的參數（數字、文字都可以設定） */
  const paramNames = (request.params ?? []).map(p => p.name);
  /** 輸入積木「存到」選的那一類變數 */
  const ioNames = (ty: VarTypes) => (f.ioTarget == '清單' ? vectorsOf(ty) : f.ioTarget == '二維清單' ? ty.grid
    : f.ioTarget == '集合' ? ty.set : f.ioTarget == '對應表' ? ty.map : f.ioTarget == '優先佇列' ? ty.pq
    : f.ioTarget == '陣列' ? ty.fixed : f.ioTarget == '堆疊' ? ty.stack : f.ioTarget == '佇列' ? ty.queue : f.ioTarget == '結構' ? ty.record
    : [...ty.number, ...ty.text]);
  /** C++ 的容器在選項上的名字（積木還是叫「清單」） */
  const listWord = byTarget(t('清單', 'List'), 'vector', 'list');
  const py = isPython();
  /** C++、Python 各自的名稱（選項上看的） */
  const kindWord = (cpp: string, python: string) => (py ? python : cpp);
  /** 只有變數表裡有這種容器（或原本就選了）才列出來 */
  const hasKind = (k: 'fixed' | 'stack' | 'queue' | 'record' | 'map' | 'set' | 'pq', chosen: boolean) => allTypes[k].length > 0 || chosen;
  /**
   * 選 struct 的欄位。whole：可以選「一整筆」（容器的一格整個換掉，例如換成 struct 變數 e）；
   * 選了容器或 struct 變數之後才出現
   */
  // Python 的 tuple 不能只改其中一個值（要整個換掉），所以不列欄位
  const fieldPicker = (s: StructDef | undefined, whole: boolean) => s && !py && (
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
              {p.name}<span className="muted">（{py ? (p.type == '文字' ? 'str' : p.float ? 'float' : 'int') : getTarget() == 'cpp' ? cppType(p.type, p.float) : p.type == '文字' ? t('文字', 'text') : t('數字', 'number')}）</span>{' = '}
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
    : py ? ' ' + (m.returns == '文字' ? 'str' : m.returnsFloat ? 'float' : 'int')
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
                  {py && (
                    <label><input type="radio" name="io_target" checked={f.ioTarget == '多個'} onChange={() => set({ ioTarget: '多個', varSelect: '' })} />{t('一行讀好幾個變數', 'Many variables from one line')}</label>
                  )}
                  {py
                    ? <>
                      {/* Python：一行用空白切開存進 list，跟改 list 的某一格分成兩個選項 */}
                      <label><input type="radio" name="io_target" checked={f.ioTarget == '清單' && f.ioPlace == '加入'} onChange={() => set({ ioTarget: '清單', ioPlace: '加入', varSelect: '' })} />{t('一行照空白切開，存進 list', 'One line split by spaces into a list')}</label>
                      <label><input type="radio" name="io_target" checked={f.ioTarget == '清單' && f.ioPlace != '加入'} onChange={() => set({ ioTarget: '清單', ioPlace: '替換', varSelect: '' })} />{t('list 的一格', 'A list item')}</label>
                    </>
                    : <label><input type="radio" name="io_target" checked={f.ioTarget == '清單'} onChange={() => set({ ioTarget: '清單', varSelect: '' })} />{listWord}</label>}
                  {(allTypes.grid.length > 0 || f.ioTarget == '二維清單') && (
                    <label><input type="radio" name="io_target" checked={f.ioTarget == '二維清單'} onChange={() => set({ ioTarget: '二維清單', varSelect: '', ioPlace: py ? '加入' : f.ioPlace })} />{py ? t('二維 list', 'A 2D list') : t('二維清單的一格', 'A 2D list cell')}</label>
                  )}
                  {!py && hasKind('fixed', f.ioTarget == '陣列') && (
                    <label><input type="radio" name="io_target" checked={f.ioTarget == '陣列'} onChange={() => set({ ioTarget: '陣列', ioPlace: '替換', varSelect: '' })} />{t('array 的一格', 'An array item')}</label>
                  )}
                  {!py && hasKind('stack', f.ioTarget == '堆疊') && (
                    <label><input type="radio" name="io_target" checked={f.ioTarget == '堆疊'} onChange={() => set({ ioTarget: '堆疊', ioPlace: '加入', varSelect: '' })} />stack</label>
                  )}
                  {!py && hasKind('queue', f.ioTarget == '佇列') && (
                    <label><input type="radio" name="io_target" checked={f.ioTarget == '佇列'} onChange={() => set({ ioTarget: '佇列', ioPlace: '加入', varSelect: '' })} />queue</label>
                  )}
                  {!py && hasKind('pq', f.ioTarget == '優先佇列') && (
                    <label><input type="radio" name="io_target" checked={f.ioTarget == '優先佇列'} onChange={() => set({ ioTarget: '優先佇列', ioPlace: '加入', varSelect: '' })} />priority_queue</label>
                  )}
                  {!py && hasKind('set', f.ioTarget == '集合') && (
                    <label><input type="radio" name="io_target" checked={f.ioTarget == '集合'} onChange={() => set({ ioTarget: '集合', ioPlace: '加入', varSelect: '' })} />set</label>
                  )}
                  {hasKind('map', f.ioTarget == '對應表') && (
                    <label><input type="radio" name="io_target" checked={f.ioTarget == '對應表'} onChange={() => set({ ioTarget: '對應表', ioPlace: '替換', varSelect: '' })} />{py ? t('dict 的一格', 'A dict item') : t('map 的一格', 'A map item')}</label>
                  )}
                  {!py && hasKind('record', f.ioTarget == '結構') && (
                    <label><input type="radio" name="io_target" checked={f.ioTarget == '結構'} onChange={() => set({ ioTarget: '結構', varSelect: '', rectField: '' })} />{t('struct 的欄位', 'A struct field')}</label>
                  )}
                </p>
                {f.ioTarget == '多個' && (
                  <>
                    <p>
                      {f.ioMany.map((v, k) => (
                        <span key={k}>
                          {k > 0 && ', '}
                          <VarPicker
                            id={k == 0 ? 'var_select' : `var_select_${k}`} value={v} onChange={x => set({ ioMany: f.ioMany.map((y, j) => (j == k ? x : y)) })}
                            names={[...varTypes.number, ...varTypes.text]} params={paramNames} locals={[...localT.number, ...localT.text]}
                          />
                          {f.ioMany.length > 2 && <button type="button" className="snippet" title={t('拿掉', 'Remove')} onClick={() => set({ ioMany: f.ioMany.filter((_, j) => j != k) })}>✕</button>}
                        </span>
                      ))}{' '}
                      <button type="button" className="snippet" onClick={() => set({ ioMany: [...f.ioMany, ''] })}>{t('＋ 再一個', '+ One more')}</button>
                    </p>
                    <span className="dialog_note">{t('這一行用空白分開，照順序存進每個變數，例如 a, b = map(int, input().split())', 'The line is split by spaces into each variable in order, like a, b = map(int, input().split())')}</span>
                  </>
                )}
                {f.ioTarget && f.ioTarget != '多個' && (
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
                {f.ioTarget == '二維清單' && py && (
                  <p className="io_choice">
                    {t('放在：', 'Put it: ')}
                    <label><input type="radio" name="io_place" checked={f.ioPlace == '加入'} onChange={() => set({ ioPlace: '加入' })} />{t('一行照空白切開，變成新的一列（append）', 'One line split by spaces as a new row (append)')}</label>
                    <label><input type="radio" name="io_place" checked={f.ioPlace == '替換'} onChange={() => set({ ioPlace: '替換' })} />{t('某一格', 'One cell')}</label>
                  </p>
                )}
                {f.ioTarget == '二維清單' && (!py || f.ioPlace == '替換') && (
                  <p>
                    {t('列（索引）', 'Row index')} <input id="rect_index" style={{ width: '20%' }} value={f.rectIndex} onChange={e => set({ rectIndex: e.target.value })} />{' '}
                    {t('行（索引）', 'Column index')} <input id="rect_index2" style={{ width: '20%' }} value={f.rectIndex2} onChange={e => set({ rectIndex2: e.target.value })} />
                    {/* 裝 struct：一次輸入一個欄位 */}
                    {fieldPicker(structOfVar(f.varSelect), false)}
                  </p>
                )}
                {f.ioTarget == '對應表' && (
                  <>
                    <p>
                      {t('鍵', 'Key')} <input id="rect_index" style={{ width: '30%' }} value={f.rectIndex} onChange={e => set({ rectIndex: e.target.value })} />
                    </p>
                    {f.varSelect && <span className="dialog_note">{t(`輸入的值會存進 ${f.varSelect}[${f.rectIndex.trim() || '?'}]`, `The value goes into ${f.varSelect}[${f.rectIndex.trim() || '?'}].`)}</span>}
                  </>
                )}
                {(f.ioTarget == '集合' || f.ioTarget == '優先佇列') && f.varSelect && !structOfVar(f.varSelect) && (
                  <span className="dialog_note">{f.ioTarget == '集合'
                    ? t(`輸入的值會放進 set「${f.varSelect}」（已經有了就不會再放）`, `The value is inserted into the set "${f.varSelect}" (no repeats).`)
                    : t(`輸入的值會 push 進 priority_queue「${f.varSelect}」`, `The value is pushed into the priority_queue "${f.varSelect}".`)}</span>
                )}
                {(f.ioTarget == '堆疊' || f.ioTarget == '佇列' || f.ioTarget == '集合' || f.ioTarget == '優先佇列') && structOfVar(f.varSelect) && (
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
                    <p className="io_choice" style={py && f.ioPlace == '加入' ? { display: 'none' } : undefined}>
                      {t('放在：', 'Put it: ')}
                      {!py && <label><input type="radio" name="io_place" checked={f.ioPlace == '加入'} onChange={() => set({ ioPlace: '加入' })} />{t('最後面', 'at the end')}</label>}
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
                    <label><input type="radio" name="output_kind" checked={f.outputKind == '回傳'} onChange={() => set({ outputKind: '回傳' })} />{t(`${moduleWord()}回傳值`, `A ${moduleWord()}'s return value`)}</label>
                  </p>
                )}
                {f.outputKind == '回傳'
                  ? (
                    <>
                      <p>
                        {t(`${moduleWord()}：`, `${moduleWord('Module')}: `)}
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
                      <p id="io_text">{py ? t('變數或字串（好幾個用逗號隔開，例如 a, b；整個 list 會一項一項用空白隔開）：', 'Variable or "text" (separate many with commas, like a, b; a whole list prints its items with spaces): ') : t('變數或字串：', 'Variable or "text": ')}</p>
                      <p>
                        <input
                          className="var_select" id="var_select_output" value={f.varSelectOutput}
                          onChange={e => set({ varSelectOutput: e.target.value })}
                        />
                      </p>
                      {helper('var_select_output', f.varSelectOutput, v => set({ varSelectOutput: v }))}
                      {py && (
                        <>
                          <p className="io_choice">
                            <label><input type="checkbox" id="no_newline" checked={f.noNewline} onChange={e => set({ noNewline: e.target.checked })} />{t('不換行：印完加一個空白，下一次接著印在同一行（print(..., end=" ")）', 'No new line: add a space and keep printing on the same line (print(..., end=" "))')}</label>
                          </p>
                          <span className="dialog_note">{t('什麼都不填就是只換行（print()），例如同一行印完之後換到下一行。', 'Leave it empty to just start a new line (print()), for example after printing a row.')}</span>
                        </>
                      )}
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
          <p id="hint">{t('迴圈要重複到什麼時候？', 'How does the loop repeat?')}</p>{' '}
          {/* C++：次數迴圈是 for (int i = 0; i < n; i++)；舊的「執行完幾次」只在打開舊積木時列出來 */}
          {getTarget() == 'cpp' && radio('cfor', t('for 迴圈（計數）', 'for loop (counting)'), () => set({ showWhile: false }))}{' '}
          {py && radio('pyfor', t('for 迴圈（range、一個一個拿）', 'for loop (range, or each item)'), () => set({ showWhile: false }))}{' '}
          {(!isCode() || f.radio == 'for') && radio('for', t('執行完幾次', 'After some times'), () => set({ showWhile: false }))}{' '}
          {/* 條件迴圈兩種：whiletrue（C++、Python 的 while）、while（Scratch 的重複直到；舊的積木都是這種） */}
          {radio('whiletrue', t('條件成立才執行', 'Run while true'), () => set({ showWhile: true }))}{' '}
          {radio('while', t('達成條件就離開', 'Stop when true'), () => set({ showWhile: true }))}{' '}
          {isCode() && radio('eof', t('一直輸入到沒有資料', 'Input until there is no more data'), () => set({ showWhile: false }))}{' '}
          <br /><br />{' '}
          {f.radio == 'eof' && (
            <>
              <p className="io_choice">
                {t('每一輪讀：', 'Each round reads: ')}
                <label><input type="radio" name="eof_target" checked={f.ioTarget != '多個'} onChange={() => set({ ioTarget: '變數' })} />{t('一個變數', 'One variable')}</label>
                <label><input type="radio" name="eof_target" checked={f.ioTarget == '多個'} onChange={() => set({ ioTarget: '多個' })} />{py ? t('一行好幾個變數', 'Many variables from one line') : t('好幾個變數', 'Many variables')}</label>
              </p>
              {f.ioTarget == '多個'
                ? (
                  <p>
                    {f.ioMany.map((v, k) => (
                      <span key={k}>
                        {k > 0 && (py ? ', ' : ' >> ')}
                        <VarPicker
                          marked={globalMarks}
                          id={k == 0 ? 'var_select' : `var_select_${k}`} value={v} onChange={x => set({ ioMany: f.ioMany.map((y, j) => (j == k ? x : y)) })}
                          names={[...varTypes.number, ...varTypes.text]} params={paramNames} locals={[...localT.number, ...localT.text]}
                        />
                        {f.ioMany.length > 2 && <button type="button" className="snippet" title={t('拿掉', 'Remove')} onClick={() => set({ ioMany: f.ioMany.filter((_, j) => j != k) })}>✕</button>}
                      </span>
                    ))}{' '}
                    <button type="button" className="snippet" onClick={() => set({ ioMany: [...f.ioMany, ''] })}>{t('＋ 再一個', '+ One more')}</button>
                  </p>
                )
                : (
                  <p>
                    {t('輸入到：', 'Input into: ')}
                    <VarPicker
                      marked={globalMarks}
                      id="var_select" value={f.varSelect} onChange={v => set({ varSelect: v })}
                      names={[...varTypes.number, ...varTypes.text]} params={paramNames} locals={[...localT.number, ...localT.text]}
                    />
                  </p>
                )}
              <span className="dialog_note">{py
                ? t('每一輪讀一行存進變數（一行好幾個就照空白切開），讀完了（沒有下一行）就離開迴圈。Python 寫成 for line in sys.stdin:，題目說「輸入到檔案結束」就用這個。', 'Each round reads a line into the variable (many variables: split by spaces). When there are no more lines, the loop ends. In Python: for line in sys.stdin:. Use it when the input goes "until end of file".')
                : t('每一輪讀一個存進變數（好幾個就照順序讀），讀不到（測資用完了）就離開迴圈。C++ 寫成 while (cin >> a) 或 while (cin >> a >> b)，題目說「輸入到檔案結束」就用這個。', 'Each round reads into the variable (many: in order). When nothing is left to read, the loop ends. In C++: while (cin >> a) or while (cin >> a >> b). Use it when the input goes "until end of file".')}</span>
            </>
          )}
          {f.radio == 'cfor' && <ForEditor f={f} set={set} helper={helper} />}
          {f.radio == 'pyfor' && <PyForEditor f={f} set={set} />}
          <div id="while_div" style={{ display: f.showWhile ? 'block' : 'none' }}>{' '}
            <p className="dialog_note">
              {f.radio == 'whiletrue'
                ? t('條件成立（真）就做一次迴圈裡的積木，不成立（假）就離開迴圈。例如 C++ 的 while (n > 0)。', 'While the condition is true (Yes), do the blocks inside. When it is false (No), leave. Like while (n > 0).')
                : t('條件還沒達成（假）就再做一次，達成了（真）就離開迴圈。例如 Scratch 的「重複直到」。', 'Until the condition is true, do it again (No). When it is true (Yes), leave. Like Scratch "repeat until".')}
            </p>{' '}
            {conditionHint}{' '}
            {codeInput}{' '}
            {f.showWhile && helper('code', f.code, v => set({ code: v }))}
          </div>{' '}
          <div id="for_div" style={{ display: f.showWhile || f.radio == 'cfor' || f.radio == 'pyfor' || f.radio == 'eof' ? 'none' : 'block' }}>{' '}
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
          <p id="hint">{t(`要執行哪一個${moduleWord()}？`, `Which ${moduleWord()} do you want to run?`)}</p>
          {modules.length
            ? (
              <select className="var_select" id="module_select" value={f.moduleName} onChange={e => set({ moduleName: e.target.value, moduleArgs: [] })}>
                <option value="" disabled>{t('請選擇', 'Choose one')}</option>
                {f.moduleName && !m && <option value={f.moduleName}>{f.moduleName}</option>}
                {modules.map(x => <option key={x.name} value={x.name}>{x.name}</option>)}
              </select>
            )
            : <p className="dialog_note">{t(`還沒有${moduleWord()}：請先按流程圖上方的「＋ 新增${moduleWord()}」。`, `There are none yet. Click "+ New ${moduleWord()}" above the flowchart first.`)}</p>}
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
      // Python 的 tuple 不能改其中一個值，整個換掉就是一般的「變數」
      const namesFor = (k: DialogForm['rectKind'], ty: VarTypes = allTypes) => (k == '變數' ? [...ty.number, ...ty.text, ...(py ? ty.record : [])] : k == '接收' ? [...ty.number, ...ty.text]
        : k == '清單' ? vectorsOf(ty)
        : k == '二維清單' ? ty.grid
        : k == '陣列' ? ty.fixed
        : k == '堆疊' ? ty.stack
        : k == '佇列' ? ty.queue
        : k == '集合' ? ty.set
        : k == '對應表' ? ty.map
        : k == '優先佇列' ? ty.pq
        : k == '結構' ? ty.record
        : []);
      const cell = kind == '二維清單' && f.rectAction == '替換';
      /** 二維 vector 的某一列後面添加（鄰接串列 g[u].push_back(v)） */
      const rowPush = kind == '二維清單' && f.rectAction == '加入';
      /** 在流程圖中建立 array：填大小 */
      const makeArray = (kind == '陣列' || (py && kind == '清單')) && f.rectAction == '建立';
      /** map、set：用鍵（或值）找，不是索引 */
      const byKey = (kind == '對應表' && (f.rectAction == '替換' || f.rectAction == '刪除')) || (kind == '集合' && f.rectAction == '刪除');
      const indexLabel = !kind ? null : makeArray ? () => t('大小', 'Size') : cell || rowPush ? () => t('列（索引）', 'Row index')
        : byKey ? () => (kind == '集合' ? t('要刪除的值', 'Value to erase') : t('鍵', 'Key'))
        : kind == '集合' || kind == '對應表' || kind == '指標' ? null : RECT_INDEX[f.rectAction];
      const index2Label = !kind ? null : f.rectAction == '建立' && kind == '二維清單' ? t('行數', 'Columns') : cell ? t('行（索引）', 'Column index') : null;
      const verb = !kind || kind == '接收' || (kind == '指標' && f.rectAction == '建立') ? null
        : kind == '集合' && f.rectAction == '放入' ? () => (py ? 'add' : 'insert')
        : py && kind == '佇列' && f.rectAction == '放入' ? () => 'append'
        : py && kind == '優先佇列' && f.rectAction == '放入' ? () => 'heappush'
        : kind == '對應表' && f.rectAction == '替換' ? () => t('設為', 'to')
        : kind == '集合' || kind == '對應表' ? (f.rectAction == '放入' || f.rectAction == '替換' ? RECT_VERB[f.rectAction] : null)
        : RECT_VERB[f.rectAction];
      /** map、set、priority_queue 的說明 */
      const dsHint = py && kind ? pyHint(kind, f.rectAction) ?? undefined : kind == '集合' ? ({ 放入: t('insert：放進 set（已經有了就不會再放），set 會自動由小到大排好...', 'insert: put a value into the set (no repeats). A set keeps itself in order...'), 刪除: t('erase：把這個值從 set 拿掉（沒有這個值就什麼都不做）...', 'erase: take this value out of the set (nothing happens if it is not there)...'), 清空: t('clear：把 set 全部清空...', 'clear: empty the set...') } as Record<string, string>)[f.rectAction]
        : kind == '對應表' ? ({ 替換: t('設定某個鍵的值：m[鍵] = 值（還沒有這個鍵就新增一個）...', 'Set the value of a key: m[key] = value (adds the key if it is new)...'), 刪除: t('erase：把這個鍵（和它的值）拿掉...', 'erase: remove this key (and its value)...'), 清空: t('clear：把 map 全部清空...', 'clear: empty the map...') } as Record<string, string>)[f.rectAction]
        : kind == '優先佇列' ? ({ 放入: t('push：放進 priority_queue，最大的（小的先出來的是最小的）會在 top...', 'push: put a value in. The largest (or smallest) is at the top...'), 取出: t('pop：拿掉 top（最大的或最小的；要先確定裡面不是空的）。要用那個值，請先用 top() 讀出來...', 'pop: remove the top (it must not be empty). To use the value, read it first with top()...') } as Record<string, string>)[f.rectAction]
        : undefined;
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
        rectAction: k == '迴圈控制' ? '跳出' : k == '變數' || k == '接收' || k == '結構' || k == '指標' ? '設為' : k == '回傳' ? '回傳' : k == '二維清單' ? '建立' : k == '陣列' || k == '對應表' ? '替換' : k == '堆疊' || k == '佇列' || k == '集合' || k == '優先佇列' ? '放入' : '加入',
        rectField: '',
        ...([...namesFor(k), ...(k == '變數' || k == '接收' ? paramNames : [])].includes(f.varSelect) ? {} : { varSelect: '' }),
      });
      const actionRadio = (action: RectAction, label: string) => (
        <label key={action}><input type="radio" name="rect_action" checked={f.rectAction == action} onChange={() => set({ rectAction: action })} />{label}</label>
      );
      body = (
        <>
          <p id="hint">{kind == '指標' ? (f.rectAction == '釋放'
            ? t('delete：把 new 出來的那一筆還回去，之後就不能再用它（用了會出錯）...', 'delete: give back what you made with new. You cannot use it after this...')
            : f.rectAction == '建立' ? t('建立新的一筆（new）：選一種 struct，填每個欄位，再用一個指標記住它...', 'Make a new one (new): choose a struct, fill its fields, and keep it in a pointer...')
            : t('用指標改：例如 head 設為 new Node{x, head}、p 設為 p->next、*pp 設為 p->next...', 'Change with pointers: like head to new Node{x, head}, p to p->next, *pp to p->next...'))
            : change ? t('將數字變數的值加上多少（減少就填負數）...', 'Add an amount to a number variable (use a negative number to take away)...') : kind == '接收' ? t('執行有回傳值的模組，把回傳的值存進變數...', 'Run a module and save the value it returns...') : makeArray && py ? t('建立 n 格的 list：a = [0] * n（每一格先放 0，裝文字的放 ""）...', 'Make a list with n items: a = [0] * n (each starts as 0, or "" for text)...') : makeArray ? t('建立 array：決定大小，例如輸入 n 之後，建立大小 n...', 'Make the array: set its size, like size n after you input n...') : dsHint ? dsHint : kind ? RECT_HINT[f.rectAction]() : t('要改什麼？先選一種：', 'What do you want to change? Choose one:')}</p>{' '}
          <p className="io_choice rect_kind">
            {t('要改：', 'Change: ')}
            <label><input type="radio" name="rect_kind" checked={kind == '變數'} onChange={() => pickKind('變數')} />{t('變數', 'A variable')}</label>
            <label title={noLists ? t('變數表還沒有清單：要用清單，請先到變數表新增', 'No lists yet. Add one in the variable table first.') : undefined} className={noLists && kind != '清單' ? 'disabled_choice' : undefined}>
              <input type="radio" name="rect_kind" checked={kind == '清單'} disabled={noLists && kind != '清單'} onChange={() => pickKind('清單')} />{byTarget(t('清單', 'A list'), 'vector', 'list')}
              {noLists && kind != '清單' && <span className="muted">{byTarget(t('（變數表還沒有清單）', ' (no lists yet)'), t('（變數表還沒有 vector）', ' (no vectors yet)'), t('（變數表還沒有 list）', ' (no lists yet)'))}</span>}
            </label>
            {hasKind('fixed', kind == '陣列') && (
              <label><input type="radio" name="rect_kind" checked={kind == '陣列'} onChange={() => pickKind('陣列')} />array</label>
            )}
            {hasKind('stack', kind == '堆疊') && (
              <label><input type="radio" name="rect_kind" checked={kind == '堆疊'} onChange={() => pickKind('堆疊')} />stack</label>
            )}
            {hasKind('queue', kind == '佇列') && (
              <label><input type="radio" name="rect_kind" checked={kind == '佇列'} onChange={() => pickKind('佇列')} />{kindWord('queue', 'deque')}</label>
            )}
            {hasKind('pq', kind == '優先佇列') && (
              <label><input type="radio" name="rect_kind" checked={kind == '優先佇列'} onChange={() => pickKind('優先佇列')} />{kindWord('priority_queue', 'heapq')}</label>
            )}
            {hasKind('set', kind == '集合') && (
              <label><input type="radio" name="rect_kind" checked={kind == '集合'} onChange={() => pickKind('集合')} />set</label>
            )}
            {hasKind('map', kind == '對應表') && (
              <label><input type="radio" name="rect_kind" checked={kind == '對應表'} onChange={() => pickKind('對應表')} />{kindWord('map', 'dict')}</label>
            )}
            {(isCode() || kind == '迴圈控制') && (
              <label><input type="radio" name="rect_kind" checked={kind == '迴圈控制'} onChange={() => pickKind('迴圈控制')} />break / continue</label>
            )}
            {!py && hasKind('record', kind == '結構') && (
              <label><input type="radio" name="rect_kind" checked={kind == '結構'} onChange={() => pickKind('結構')} />{t('struct 的欄位', 'A struct field')}</label>
            )}
            {/* C++ 的指標（linked list）：變數表有指標才出現 */}
            {getTarget() == 'cpp' && (allTypes.ptr.length + allTypes.ptr2.length > 0 || kind == '指標') && (
              <label><input type="radio" name="rect_kind" checked={kind == '指標'} onChange={() => pickKind('指標')} />{t('指標（->、*、delete）', 'Pointers (->, *, delete)')}</label>
            )}
            {(allTypes.grid.length > 0 || kind == '二維清單') && (
              <label><input type="radio" name="rect_kind" checked={kind == '二維清單'} onChange={() => pickKind('二維清單')} />{py ? t('二維 list', 'A 2D list') : t('二維清單', 'A 2D list')}</label>
            )}
            {(request.canReturn || kind == '回傳') && (
              <label><input type="radio" name="rect_kind" checked={kind == '回傳'} onChange={() => pickKind('回傳')} />{t('回傳值', 'Return a value')}</label>
            )}
            {(canReturnTarget() || kind == '接收') && (
              <label
                title={returning.length ? undefined : t('還沒有有回傳值的模組：到模組上方的「修改名稱、參數」設定回傳值', 'No module returns a value yet. Set a return value in "Edit name, parameters".')}
                className={!returning.length && kind != '接收' ? 'disabled_choice' : undefined}
              >
                <input type="radio" name="rect_kind" checked={kind == '接收'} disabled={!returning.length && kind != '接收'} onChange={() => pickKind('接收')} />{t(`接收${moduleWord()}回傳值`, `A ${moduleWord()}'s return value`)}
                {!returning.length && kind != '接收' && <span className="muted">{t('（還沒有有回傳值的模組）', ' (no module returns a value yet)')}</span>}
              </label>
            )}
          </p>
          {kind == '接收' && (
            <>
              <p>
                {t(`${moduleWord()}：`, `${moduleWord('Module')}: `)}
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
              {py
                ? <>
                  {actionRadio('加入', t('append（加到最後）', 'append (to the end)'))}
                  {actionRadio('插入', 'insert')}
                  {actionRadio('替換', t('替換某一項', 'Replace one item'))}
                  {actionRadio('刪除', t('pop(索引)（拿掉某一項）', 'pop(index)'))}
                  {actionRadio('取出', t('pop()（拿掉最後一個）', 'pop() (remove the last)'))}
                  {actionRadio('清空', 'clear()')}
                  {actionRadio('排序', 'sort()')}
                  {actionRadio('設為', t('整個換掉（例如 [1, 2, 3]）', 'Replace it all (like [1, 2, 3])'))}
                  {actionRadio('建立', t('建立 n 格（[0] * n）', 'Make n items ([0] * n)'))}
                </>
                : RECT_ACTIONS.filter(([action]) => ['加入', '插入', '替換', '刪除', '清空', ...(getTarget() == 'cpp' ? ['排序'] : [])].includes(action)).map(([action, label]) => actionRadio(action, label()))}
            </p>
          )}
          {kind == '變數' && (
            <p className="rect_action">
              {t('怎麼改：', 'How: ')}
              <label><input type="radio" name="var_action" checked={!f.varChange} onChange={() => set({ varChange: false })} />{t('設為', 'Set to')}</label>
              <label><input type="radio" name="var_action" checked={f.varChange} onChange={() => set({ varChange: true, radio: '' })} />{t('改變（加多少）', 'Change by')}</label>
            </p>
          )}
          {py && kind == '佇列' && (
            <p className="rect_action">
              {t('怎麼改：', 'How: ')}
              {actionRadio('放入', t('append（排到最後面）', 'append (to the back)'))}
              {actionRadio('取出', t('popleft()（拿掉最前面的）', 'popleft() (remove the front)'))}
            </p>
          )}
          {py && kind == '優先佇列' && (
            <p className="rect_action">
              {t('怎麼改：', 'How: ')}
              {actionRadio('放入', t('heappush（放進去）', 'heappush'))}
              {actionRadio('取出', t('heappop（拿掉最小的）', 'heappop (remove the smallest)'))}
            </p>
          )}
          {py && kind == '集合' && (
            <p className="rect_action">
              {t('怎麼改：', 'How: ')}
              {actionRadio('放入', t('add（放進去）', 'add'))}
              {actionRadio('刪除', t('discard（拿掉某個值）', 'discard (a value)'))}
              {actionRadio('清空', 'clear()')}
            </p>
          )}
          {py && kind == '對應表' && (
            <p className="rect_action">
              {t('怎麼改：', 'How: ')}
              {actionRadio('替換', t('設定某個鍵的值 d[k] = …', 'Set the value of a key d[k] = …'))}
              {actionRadio('刪除', t('del（拿掉某個鍵）', 'del (a key)'))}
              {actionRadio('清空', 'clear()')}
            </p>
          )}
          {!py && (kind == '堆疊' || kind == '佇列') && (
            <p className="rect_action">
              {t('怎麼改：', 'How: ')}
              {actionRadio('放入', kind == '堆疊' ? t('push（放到最上面）', 'push (on top)') : t('push（排到最後面）', 'push (to the back)'))}
              {actionRadio('取出', kind == '堆疊' ? t('pop（拿掉最上面的）', 'pop (remove the top)') : t('pop（拿掉最前面的）', 'pop (remove the front)'))}
            </p>
          )}
          {!py && kind == '優先佇列' && (
            <p className="rect_action">
              {t('怎麼改：', 'How: ')}
              {actionRadio('放入', t('push（放進去）', 'push'))}
              {actionRadio('取出', t('pop（拿掉 top）', 'pop (remove the top)'))}
            </p>
          )}
          {!py && kind == '集合' && (
            <p className="rect_action">
              {t('怎麼改：', 'How: ')}
              {actionRadio('放入', t('insert（放進去）', 'insert'))}
              {actionRadio('刪除', t('erase（拿掉某個值）', 'erase (a value)'))}
              {actionRadio('清空', t('clear（全部清空）', 'clear'))}
            </p>
          )}
          {!py && kind == '對應表' && (
            <p className="rect_action">
              {t('怎麼改：', 'How: ')}
              {actionRadio('替換', t('設定某個鍵的值', 'Set the value of a key'))}
              {actionRadio('刪除', t('erase（拿掉某個鍵）', 'erase (a key)'))}
              {actionRadio('清空', t('clear（全部清空）', 'clear'))}
            </p>
          )}
          {kind == '二維清單' && (
            <p className="rect_action">
              {t('怎麼改：', 'How: ')}
              {actionRadio('建立', t('建立（幾列幾行）', 'Make (rows × columns)'))}
              {actionRadio('替換', t('替換一格', 'Change one cell'))}
              {actionRadio('加入', py ? t('在某一列後面添加（g[u].append）', 'Add to the end of a row (g[u].append)') : t('在某一列後面添加（push_back）', 'Add to the end of a row (push_back)'))}
            </p>
          )}
          {rowPush && <p className="dialog_note">{py ? t('鄰接串列：先「建立 n 列 0 行」，每一列一開始是空的，再把鄰居一個一個添加到那一列，例如 g[u].append(v)。', 'Adjacency list: first make n rows × 0 columns (every row starts empty), then add neighbors to a row, like g[u].append(v).') : t('鄰接串列：先「建立 n 列 0 行」，每一列一開始是空的，再把鄰居一個一個添加到那一列，例如 g[u].push_back(v)。', 'Adjacency list: first make n rows × 0 columns (every row starts empty), then add neighbors to a row, like g[u].push_back(v).')}</p>}
          {kind == '陣列' && getTarget() == 'cpp' && (
            <p className="rect_action">
              {t('怎麼改：', 'How: ')}
              {actionRadio('替換', t('替換某一格', 'Change one item'))}
              {actionRadio('排序', t('排序（sort）', 'Sort'))}
              {actionRadio('建立', t('建立（設定大小）', 'Make (set the size)'))}
            </p>
          )}
          {kind == '指標' && (() => {
            const making = f.rectAction == '建立';
            const freeing = f.rectAction == '釋放';
            const tp = ptrTypeOf(f.ptrTarget);
            // 建立哪一種 struct：選過的；沒選過就照存到的指標（Node* 就是 Node）；只有一種就是那一種
            const structs = getStructs();
            const sname = f.ptrStruct || (tp && tp.level == 1 && findStruct(tp.s) ? tp.s : structs.length == 1 ? structs[0].name : '');
            const made = findStruct(sname);
            const choices = !making && !freeing && tp ? ptrChoices(tp, f.ptrTarget.trim()) : [];
            const setField = (k: number, v: string) => set({ ptrStruct: sname, ptrFields: (made?.fields ?? []).map((_, j) => (j == k ? v : f.ptrFields[j] ?? '')) });
            return (
              <>
                <p className="rect_action">
                  {t('怎麼改：', 'How: ')}
                  {structs.length > 0 && actionRadio('建立', t('建立新的一筆（new）', 'Make a new one (new)'))}
                  {actionRadio('設為', t('指到別的地方、存一個值（=）', 'Point somewhere else, store a value (=)'))}
                  {actionRadio('釋放', t('delete（還回去）', 'delete (give it back)'))}
                </p>
                <p>
                  {freeing ? 'delete ' : making ? t('用哪個指標記住它：', 'Keep it in the pointer: ') : t('存到：', 'Store into: ')}
                  <input
                    id="ptr_target" style={{ width: '50%' }} value={f.ptrTarget}
                    placeholder={freeing ? 'p' : making ? t('例如 p、head、p->next', 'like p, head, p->next') : t('例如 p、p->next、*pp、*p', 'like p, p->next, *pp, *p')}
                    onChange={e => set({ ptrTarget: e.target.value })}
                  />
                </p>
                {helper('ptr_target', f.ptrTarget, v => set({ ptrTarget: v }))}
                {making && (
                  <>
                    <p>
                      {t('建立哪一種 struct：', 'Which struct: ')}
                      <select className="var_select" value={sname} onChange={e => set({ ptrStruct: e.target.value, ptrFields: [] })}>
                        <option value="" disabled>{t('請選擇', 'Choose one')}</option>
                        {structs.map(x => <option key={x.name} value={x.name}>{x.name}</option>)}
                      </select>
                    </p>
                    {made && (
                      <table className="new_fields">
                        <tbody>
                          {made.fields.map((field, k) => {
                            const fieldChoices = field.type == '指標' && field.to ? ptrChoices({ s: field.to, level: 1 }, '') : [];
                            return (
                              <tr key={field.name}>
                                <th>{field.name}<span className="muted">（{fieldCppType(field)}）</span></th>
                                <td>
                                  <input
                                    id={'ptr_field_' + k} value={f.ptrFields[k] ?? ''}
                                    placeholder={fieldDefaultText(field.type)}
                                    onChange={e => setField(k, e.target.value)}
                                  />
                                  {fieldChoices.length > 1 && (
                                    <select className="var_select" value="" aria-label={t('指到哪裡', 'Points to')} onChange={e => setField(k, e.target.value)}>
                                      <option value="" disabled>{t('指到…', 'Points to…')}</option>
                                      {fieldChoices.map(c => <option key={c.text} value={c.text}>{c.label}</option>)}
                                    </select>
                                  )}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    )}
                    <p className="dialog_note">
                      {t('沒填的欄位先放 0（文字是 ""、指標是 nullptr）。可以現在一次填好，也可以先空著，之後再用「存一個值」改，例如 p->val 設為 x。',
                        'Empty fields start as 0 ("" for text, nullptr for pointers). Fill them all now, or leave them empty and change them later with "store a value", like p->val to x.')}
                    </p>
                    {made && f.ptrTarget.trim() && <p className="muted">C++：<code>{f.ptrTarget.trim()} = {newExprText(sname, f.ptrFields)};</code></p>}
                  </>
                )}
                {choices.length > 0 && (
                  <p>
                    {t('指到：', 'Point to: ')}
                    <select className="var_select" value="" aria-label={t('指到哪裡', 'Points to')} onChange={e => set({ code: e.target.value })}>
                      <option value="" disabled>{t('選一個（會填到下面的「設為」）', 'Choose one (fills "to" below)')}</option>
                      {choices.map(c => <option key={c.text} value={c.text}>{c.label}</option>)}
                    </select>
                  </p>
                )}
              </>
            );
          })()}
          {kind == '迴圈控制' && (
            <p className="rect_action">
              {actionRadio('跳出', t('break（跳出迴圈）', 'break (leave the loop)'))}
              {actionRadio('下一輪', t('continue（直接進入下一輪）', 'continue (next round)'))}
            </p>
          )}
          {kind && kind != '回傳' && kind != '迴圈控制' && kind != '指標' && (
            <>
              {kind == '變數' ? t('變數：', 'Variable: ') : kind == '接收' ? t('回傳值存到變數：', 'Save it in: ') : kind == '二維清單' ? t('二維清單：', '2D list: ')
                : kind == '陣列' ? 'array：' : kind == '堆疊' ? 'stack：' : kind == '佇列' ? kindWord('queue：', 'deque：') : kind == '優先佇列' ? kindWord('priority_queue：', 'heapq：') : kind == '集合' ? 'set：' : kind == '對應表' ? kindWord('map：', 'dict：') : kind == '結構' ? 'struct：' : byTarget(t('清單：', 'List: '), 'vector：', 'list：')}
              <VarPicker marked={globalMarks} id="var_select" value={f.varSelect} onChange={v => pickVar(v, kind == '結構')} names={change ? varTypes.number : namesFor(kind, varTypes)} params={kind == '變數' || kind == '接收' ? paramNames : []} locals={change ? localT.number : namesFor(kind, localT)} />
            </>
          )}
          {kind == '變數' && !change && getTarget() == 'cpp' && allTypes.text.includes(f.varSelect) && (
            <p className="char_index">
              {t('只改其中一個字：索引', 'Change one letter only: index')}{' '}
              <input id="rect_index" style={{ width: '20%' }} value={f.rectIndex} placeholder={t('空白就是整個', 'empty = whole')} onChange={e => set({ rectIndex: e.target.value })} />
              {f.rectIndex.trim() && <span className="muted">{' '}{f.varSelect}[{f.rectIndex.trim()}] = {t("一個字，例如 'a'", "one letter, like 'a'")}</span>}
            </p>
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
          {/* Python：順序，再加上可以不填的 key（lambda x: …） */}
          {f.rectAction == '排序' && kind == '清單' && py && (
            <>
              <p className="rect_action">
                {t('順序：', 'Order: ')}
                <label><input type="radio" name="sort_dir" checked={!f.sortDesc} onChange={() => set({ sortDesc: false })} />{t('由小到大', 'Small → large')}</label>
                <label><input type="radio" name="sort_dir" checked={f.sortDesc} onChange={() => set({ sortDesc: true })} />{t('由大到小', 'Large → small')}</label>
              </p>
              <p>
                {t('依什麼排（key，可以不填）：', 'Sort by (key, optional): ')}<code>lambda x:</code>{' '}
                <input id="sort_key" style={{ width: '40%' }} value={f.sortKey} placeholder={t('例如 len(x)、x[1]', 'like len(x), x[1]')} onChange={e => set({ sortKey: e.target.value })} />
              </p>
              <span className="dialog_note">{t('x 代表 list 的每一項。不填就比每一項本身（tuple 先比第一個，一樣再比第二個）；len(x) 是依長度、x[1] 是依 tuple 的第二個、-x[0] 是第一個由大到小。', 'x is each item of the list. Empty: compare the items themselves (tuples compare the first value, then the second). len(x) sorts by length, x[1] by the second value of a tuple, -x[0] by the first value from large to small.')}</span>
            </>
          )}
          {f.rectAction == '排序' && (kind == '清單' || kind == '陣列') && !py && (
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
                            {s.fields.map((x, k) => <option key={x.name} value={x.name}>{py ? `[${k}]（${pyElemName(x.type == '文字' ? '文字' : x.float ? '小數' : '數字')}）` : `${x.name}（${fieldCppType(x)}）`}</option>)}
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
              {kind != '指標' && <p>{t('捨去進位？', 'Round?')}{' '}
                {radio('', t('不需要', 'No'))}{' '}
                {radio('Math.round', t('四捨五入', 'Round'))}{' '}
                <br />{radio('Math.floor', t('無條件捨去', 'Round down'))}{' '}
                {radio('Math.ceil', t('無條件進位', 'Round up'))}{' '}
              </p>}
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
    // 條件迴圈：箭頭上還是寫真、假，選項寫清楚在這種迴圈是進去做還是離開
    case 'link_until':
      body = (
        <>
          <p id="hint">{t('這個迴圈是「達成條件就離開」，這條箭頭是：', 'This loop stops when the condition is true. This arrow is:')}</p>{' '}
          {radio('假', t('假（還沒達成：做迴圈裡的積木）', 'No (not yet: do the blocks inside)'))}{' '}
          {radio('真', t('真（達成了：離開迴圈）', 'Yes (done: leave the loop)'))}{' '}
          <br />{buttons}
        </>
      );
      break;
    case 'link_while':
      body = (
        <>
          <p id="hint">{t('這個迴圈是「條件成立才執行」，這條箭頭是：', 'This loop runs while the condition is true. This arrow is:')}</p>{' '}
          {radio('真', t('真（成立：做迴圈裡的積木）', 'Yes (true: do the blocks inside)'))}{' '}
          {radio('假', t('假（不成立：離開迴圈）', 'No (false: leave the loop)'))}{' '}
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

/** Python 的容器怎麼改的說明（計算積木最上面那行） */
function pyHint(kind: DialogForm['rectKind'], action: RectAction): string | null {
  const hints: Partial<Record<DialogForm['rectKind'], Partial<Record<RectAction, string>>>> = {
    清單: {
      刪除: t('pop(索引)：拿掉 list 的某一項，後面的都往前移...', 'pop(index): remove one item; the items after it move up...'),
      清空: t('clear()：把 list 全部清空...', 'clear(): empty the list...'),
    },
    佇列: {
      放入: t('append：排到 deque 的最後面...', 'append: join the back of the deque...'),
      取出: t('popleft()：拿掉 deque 最前面的（要先確定不是空的）。要用那個值，請先用 q[0] 讀出來...', 'popleft(): remove the front (it must not be empty). To use it, read it first with q[0]...'),
    },
    優先佇列: {
      放入: t('heappush：放進 heap，最小的會在 h[0]...', 'heappush: put a value in. The smallest is at h[0]...'),
      取出: t('heappop：拿掉最小的（要先確定不是空的）。要用那個值，請先用 h[0] 讀出來...', 'heappop: remove the smallest (it must not be empty). To use it, read it first with h[0]...'),
    },
    集合: {
      放入: t('add：放進 set（已經有了就不會再放）...', 'add: put a value into the set (no repeats)...'),
      刪除: t('discard：把這個值從 set 拿掉（沒有這個值就什麼都不做）...', 'discard: take this value out of the set (nothing happens if it is not there)...'),
      清空: t('clear()：把 set 全部清空...', 'clear(): empty the set...'),
    },
    對應表: {
      替換: t('設定某個鍵的值：d[鍵] = 值（還沒有這個鍵就新增一個）...', 'Set the value of a key: d[key] = value (adds the key if it is new)...'),
      刪除: t('del d[鍵]：把這個鍵（和它的值）拿掉（沒有這個鍵會出錯）...', 'del d[key]: remove this key and its value (error if the key is missing)...'),
      清空: t('clear()：把 dict 全部清空...', 'clear(): empty the dict...'),
    },
  };
  return hints[kind]?.[action] ?? null;
}
