// 學習單主畫面：四個步驟
//   第一步 讀懂題目、第二步 想測資：同一個畫面，還不能做的那張卡片蓋上半透明灰色
//   第三步 定義變數、設計流程：左邊變數＋題目，右邊流程圖畫布
//   第四步 測試執行並除錯：逐步執行流程圖
import { useEffect, useLayoutEffect, useRef, useState, type DragEvent, type ReactNode } from 'react';
import { CodeView } from './components/CodeView';
import { ModuleDialog, type ModuleRequest } from './components/ModuleDialog';
import { NodeDialog, type DialogRequest } from './components/NodeDialog';
import { PrintView, type PrintData } from './components/PrintView';
import { QuestionPanel } from './components/QuestionPanel';
import { RunArea, type RunPane } from './components/RunArea';
import { VarTable, type VarRow } from './components/VarTable';
import { StructTable, type StructRename } from './components/StructTable';
import { setStructs as setStructRegistry, type StructDef } from './engine/structs';
import { isContainerType, type VarType } from './engine/structure';
import { connectorState, createConnectors } from './engine/connector';
import { buildRun, createVarStore, FlowError, typeLists, withParams, type RunResult } from './engine/decoder';
import { canvasPoint, Diagram, type DiagramHooks } from './engine/diagram';
import type { FromBlocks } from './engine/fromBlockly';
import { callText, cppNameProblem, cppType, GLOBAL_PREFIX, isName, parseCall, renameFieldInText, renameInText, splitId, typeLabel, usesField, usesName, type LocalVar, type ModuleInfo, type ModuleSource, type ParamInfo } from './engine/modules';
import { buildFlowchart } from './engine/toFlowchart';
import { addMainNode, editDialogFor, editMainNode } from './nodeActions';
import { allowedVarTypes, EMPTY_QUESTION, loadQuestion, questionIn, type Question } from './questions';
import { fitRowOnInput } from './textareaSizing';
import { LangToggle } from './components/LangToggle';
import { getLang, link, onLangChange, t, useLang } from './i18n';
import { getTarget, setTarget, targetName, useTarget, type Target } from './target';
import { COURSES, courseFits } from './courses';
import { useCommit } from './useCommit';
import { downloadWorkFile, makeWorkFile, parseWorkFile, pickTextFile, stashPendingImport, takePendingImport, type WorkContent, type WorkFile } from './workFile';

/** 開發測試用：true 時不用填班級座號也能交作業 */
const DEBUG_MODE = false;

const pageTitles = () => [
  t('看題目', 'Read the Problem'),
  t('想測資', 'Make Test Data'),
  t('定義變數、設計流程', 'Flowchart'),
  t('測試執行並除錯', 'Run and Check'),
];

const BLOCK_TOOLS = [
  { id: 'Circle', icon: 'start', name: () => t('開始或結束', 'Start or End') },
  { id: 'Parallelogram', icon: 'io', name: () => t('輸入或輸出', 'Input or Output') },
  { id: 'Diamond', icon: 'if', name: () => t('判斷', 'Decision') },
  { id: 'Rectangle', icon: 'cal', name: () => t('計算', 'Math') },
  { id: 'Loop', icon: 'loop', name: () => t('迴圈', 'Loop') },
  // 流程圖的「預定處理」：執行一個模組（Scratch 的自訂積木）
  { id: 'Function', icon: 'func', name: () => t('執行模組', 'Run a module') },
];

/** 一個模組：名稱、參數，和它自己的一張流程圖；id 用來切換分頁（主程式是 0） */
interface AppModule {
  id: number;
  info: ModuleInfo;
  diagram: Diagram;
}
let moduleSeq = 0;
const ARROW_TOOLS = [
  { id: 'straight', icon: 'arrow', name: () => t('直線箭頭', 'Arrow') },
  { id: 'square', icon: 'turn_arrow', name: () => t('折線箭頭', 'Bent arrow') },
];
/** 從工具列拖積木進畫布時，dataTransfer 用的資料類型（避免接受拖進來的文字、檔案） */
const DRAG_TYPE = 'application/x-flowchart-block';
/** 箭頭工具：選了才顯示積木上的連接點 */
const isArrowTool = (tool: string) => tool == 'straight' || tool == 'square';


/** 目前這一題，例如 "114/3"（網址 ?w=114&h=3） */
const urlParams = new URLSearchParams(window.location.search);
const questionPath = `${urlParams.get('w')}/${urlParams.get('h')}`;

let dialogSeq = 0;
/** 存檔裡認得的變數型別 */
const VAR_TYPES: VarType[] = ['數字', '文字', '清單', '二維清單', '陣列', '堆疊', '佇列', '結構'];
let varSeq = 0;

/** 第一步、第二步的卡片：不是目前步驟時蓋上半透明灰色，點一下切過去 */
function StepCard({ id, no, title, active, lockText, onUnlock, children }: {
  id: string; no: number; title: string; active: boolean; lockText: string; onUnlock: () => void; children: ReactNode;
}) {
  const bodyRef = useRef<HTMLDivElement>(null);
  // 蓋住時讓裡面的輸入框不能用 Tab 選到
  useEffect(() => {
    if (active) bodyRef.current?.removeAttribute('inert');
    else bodyRef.current?.setAttribute('inert', '');
  }, [active]);
  return (
    <div id={id} className="card step_card">
      <h5 className="card_title"><span className="step_badge">{no}</span>{title}</h5>
      <div ref={bodyRef}>{children}</div>
      {!active && (
        <button className="step_lock" onClick={onUnlock}><span>{lockText}</span></button>
      )}
    </div>
  );
}

export function App() {
  const [question, setQuestion] = useState<Question>(EMPTY_QUESTION);
  const [page, setPage] = useState(0);
  const [pageNonce, setPageNonce] = useState(0);
  const [tool, setToolState] = useState('none');
  const [vars, setVarsState] = useState<VarRow[]>([]);
  const [cases, setCases] = useState<string[]>(() => Array(9).fill(''));
  const [dialog, setDialog] = useState<DialogRequest | null>(null);
  /** 「看程式」視窗開著嗎 */
  const [codeOpen, setCodeOpen] = useState(false);
  const [printing, setPrinting] = useState(false);
  const [printData, setPrintData] = useState<PrintData | null>(null);
  const [printImg, setPrintImg] = useState<string>();
  const [printModules, setPrintModules] = useState<{ title: string; src: string }[]>([]);
  /** 模組（每個有自己的一張流程圖）；sheet 是畫面上這一張：0 是主程式，其他是模組的 id */
  const [modules, setModulesState] = useState<AppModule[]>([]);
  /** C++ 的 struct 定義（執行、檢查、轉程式用的是 engine/structs 裡的那份，兩邊一起改） */
  const [structs, setStructsState] = useState<StructDef[]>([]);
  const structsRef = useRef<StructDef[]>([]);
  const modulesRef = useRef<AppModule[]>([]);
  const [sheet, setSheetState] = useState(0);
  const sheetRef = useRef(0);
  const [moduleDialog, setModuleDialog] = useState<ModuleRequest | null>(null);
  /** 第四步：目前顯示哪一張流程圖（執行到模組裡時會換過去） */
  const [which, setWhich] = useState(0);
  const [run, setRun] = useState<RunResult | null>(null);
  /** 流程圖沒辦法執行時，給學生看的原因 */
  const [runError, setRunError] = useState<FlowError | null>(null);
  const [step, setStep] = useState(0);

  // 給畫布事件（不在 React 裡）讀最新值用
  const toolRef = useRef(tool);
  const varsRef = useRef(vars);
  const varStore = useRef(createVarStore()).current;
  const myMouse = useRef({ x: 0, y: 0 });

  const myCanvasRef = useRef<HTMLCanvasElement>(null);
  const noteRef = useRef<HTMLInputElement>(null);
  const classRef = useRef<HTMLInputElement>(null);
  const numberRef = useRef<HTMLInputElement>(null);
  const nameRef = useRef<HTMLInputElement>(null);

  const setTool = (t: string) => {
    toolRef.current = t;
    setToolState(t);
  };
  const setVars = (next: VarRow[]) => {
    varsRef.current = next;
    setVarsState(next);
  };
  const openDialog = (req: Omit<DialogRequest, 'id'>) => setDialog({ ...req, id: ++dialogSeq });

  // ---------------- 流程圖 ----------------
  const editNodeRef = useRef<DiagramHooks['editNode']>(() => {});
  const [hooks] = useState<DiagramHooks>(() => ({
    askLinkLabel: kind => new Promise(resolve => openDialog({
      kind,
      onYes: f => { resolve(f.radio); return true; },
      onNo: () => resolve(null),
      onDismiss: () => resolve(null),
    })),
    editNode: (d, i) => editNodeRef.current(d, i),
    selectedTool: () => toolRef.current,
  }));
  const [main] = useState(() => new Diagram(hooks));
  // 開發模式下給自動化測試讀積木位置
  if (import.meta.env.DEV) Object.assign(window, { __flowchart: { main, modules: modulesRef } });

  // ---------------- 模組 ----------------
  const setModules = (next: AppModule[]) => {
    modulesRef.current = next;
    setModulesState(next);
  };
  /** 主程式和每個模組的流程圖（順序就是執行時的編號，見 modules.ts） */
  const allDiagrams = () => [main, ...modulesRef.current.map(m => m.diagram)];
  const moduleInfos = () => modulesRef.current.map(m => m.info);
  const moduleSources = (): ModuleSource[] => modulesRef.current.map(m => ({ info: m.info, diagram: m.diagram }));
  const moduleOf = (d: Diagram) => modulesRef.current.find(m => m.diagram == d);
  /** 畫面上這一張流程圖 */
  const currentDiagram = () => (sheetRef.current == 0 ? main : moduleOf2(sheetRef.current)?.diagram ?? main);
  const moduleOf2 = (id: number) => modulesRef.current.find(m => m.id == id);
  /** 在這張流程圖裡可以用的變數：模組裡還可以用它的參數 */
  const storeFor = (d: Diagram) => ({
    ...withParams(varStore, moduleOf(d)?.info.params ?? [], moduleOf(d)?.info.locals, !!moduleOf(d)),
    // 有回傳值的模組可以寫在算式裡
    calls: modulesRef.current.filter(m => m.info.returns).map(m => m.info.name),
  });
  /** 這張流程圖是有回傳值的模組嗎（計算積木才有「回傳」） */
  const returnsIn = (d: Diagram) => !!moduleOf(d)?.info.returns;

  /** 換到另一張流程圖（第三步畫布上方的分頁） */
  const showSheet = (id: number) => {
    for (const d of allDiagrams()) {
      d.active = false;
      d.selNode = null;
      d.selLink = null;
    }
    sheetRef.current = moduleOf2(id) ? id : 0;
    setSheetState(sheetRef.current);
    const d = currentDiagram();
    d.active = true;
    d.pause = false;
    d.init(myCanvasRef.current!);
    d.draw();
  };

  /** 新的一張模組流程圖（先接到畫布上，積木才量得到字的大小）；預先放好「開始」和「結束」 */
  const newModuleDiagram = (withEnds: boolean) => {
    const d = new Diagram(hooks);
    d.active = false;
    d.init(myCanvasRef.current!);
    if (withEnds) {
      const connectors = createConnectors();
      d.addNode(d.newNode(60, 30, 120, 80, connectors, '開始', 'Circle'));
      d.addNode(d.newNode(60, 330, 120, 80, connectors, '結束', 'Circle'));
    }
    return d;
  };

  /** 模組或參數的名字能不能用：不能跟變數、其他模組、清單的函式撞名 */
  const nameProblem = (editing: AppModule | null) => (name: string, kind: 'module' | 'param'): string | null => {
    const cpp = cppNameProblem(name);
    if (cpp) return cpp;
    // 參數可以跟全域變數同名（模組裡指的是參數）；模組的名字不行
    if (kind == 'module' && varStore.var_list.name.includes(name)) return t(`「${name}」已經是變數的名字了，請換一個。`, `"${name}" is already a variable. Choose another name.`);
    if (kind == 'module' && modulesRef.current.some(m => m.info.locals?.some(v => v.name.trim() == name))) return t(`「${name}」已經是模組的區域變數了，請換一個。`, `"${name}" is already a local variable. Choose another name.`);
    if (kind == 'param' && editing?.info.locals?.some(v => v.name.trim() == name)) return t(`「${name}」已經是這個模組的區域變數了，請換一個。`, `"${name}" is already a local variable of this module. Choose another name.`);
    if (kind == 'module' && modulesRef.current.some(m => m != editing && m.info.name == name)) return t(`已經有叫「${name}」的模組了。`, `There is already a module called "${name}".`);
    if (['長度', 'length', '項目編號', 'indexof', '包含', 'contains', 'and', 'or', 'not'].includes(name)) return t(`「${name}」是保留的字，請換一個。`, `"${name}" is a reserved word. Choose another name.`);
    try {
      Function(`var ${name};`);
    }
    catch {
      return t(`「${name}」是程式保留的字，請換一個。`, `"${name}" is a reserved word. Choose another name.`);
    }
    return null;
  };

  const newModule = () => setModuleDialog({
    id: ++dialogSeq,
    nameProblem: nameProblem(null),
    onSave: info => {
      const m: AppModule = { id: ++moduleSeq, info, diagram: newModuleDiagram(true) };
      setModules([...modulesRef.current, m]);
      showSheet(m.id);
    },
  });

  /** 這張流程圖裡用到 name 的積木（列出積木上的字，給學生找） */
  const blocksUsing = (d: Diagram, name: string) => d.nodes.filter(n => n && usesName(n.text, name)).map(n => `「${n!.text.trim()}」`);
  /** 參數在模組的流程圖裡有沒有用到：有的話回傳說明（不能刪） */
  const paramUsedIn = (m: AppModule) => (name: string) => {
    const used = blocksUsing(m.diagram, name);
    return used.length
      ? t(`參數「${name}」在模組的流程圖裡還有用到：${used.join('、')}。請先把這些積木刪掉或改掉，再刪這個參數。`, `The parameter "${name}" is still used in the module's flowchart: ${used.join(', ')}. Delete or change those blocks first.`)
      : null;
  };
  /** 參數改名（模組的流程圖裡跟著改）、刪掉（執行這個模組的積木拿掉那個值） */
  const applyParamChanges = (m: AppModule, renames: [string, string][], removed: number[]) => {
    for (const [from, to] of renames) {
      for (const node of m.diagram.nodes) {
        if (node && usesName(node.text, from)) {
          node.text = renameInText(node.text, from, to);
          node.variables = node.variables?.map(v => (v == from ? to : v));
          m.diagram.fitNode(node);
        }
      }
    }
    if (removed.length) {
      for (const d of allDiagrams()) {
        for (const node of d.nodes) {
          const call = node?.figure == 'Function' ? parseCall(node.text) : null;
          if (node && call?.name == m.info.name) {
            node.text = callText(call.name, call.args.filter((_, k) => !removed.includes(k)));
            d.fitNode(node);
          }
        }
      }
    }
  };

  const editModule = (m: AppModule) => setModuleDialog({
    id: ++dialogSeq,
    initial: m.info,
    nameProblem: nameProblem(m),
    paramUsed: paramUsedIn(m),
    onSave: (info, renames, removed) => {
      applyParamChanges(m, renames, removed);
      const oldName = m.info.name;
      // 改名：每張流程圖裡執行這個模組的積木（還有算式裡用到的地方）也跟著改
      if (info.name != oldName) {
        for (const d of allDiagrams()) {
          for (const node of d.nodes) {
            if (node && usesName(node.text, oldName)) {
              node.text = renameInText(node.text, oldName, info.name);
              d.fitNode(node);
            }
          }
        }
      }
      // 區域變數不在這個視窗裡設定（在第三步的變數表），照舊留著
      setModules(modulesRef.current.map(x => (x == m ? { ...m, info: { ...info, ...(x.info.locals ? { locals: x.info.locals } : {}) } } : x)));
      currentDiagram().draw();
    },
  });

  /** 第三步參數表：改參數的名稱或型別（不能在那裡刪）；名字不能用時回傳原因 */
  const editParam = (m: AppModule, k: number, patch: Partial<ParamInfo>): string | null => {
    const old = m.info.params[k];
    if (!old) return null;
    const name = patch.name?.trim() ?? old.name;
    if (name != old.name) {
      const why = !isName(name)
        ? t(`「${name}」不能當名稱：只能用中英文、數字和底線，不能有空白，也不能用數字開頭。`, `"${name}" cannot be a name. Use letters, numbers and _ only, with no spaces, and do not start with a number.`)
        : m.info.params.some((p, i) => i != k && p.name == name) ? t('參數的名字不能重複。', 'Two parameters have the same name.')
        : name == m.info.name ? t('參數的名字不能跟模組一樣。', 'A parameter cannot have the same name as the module.')
        : nameProblem(m)(name, 'param');
      if (why) return why;
      applyParamChanges(m, [[old.name, name]], []);
    }
    const params = m.info.params.map((p, i) => {
      if (i != k) return p;
      const type = patch.type ?? p.type;
      const float = 'float' in patch ? patch.float : p.float;
      const long = 'long' in patch ? patch.long : p.long;
      const desc = patch.desc ?? p.desc;
      return { name, type, ...(type == '數字' && float ? { float: true } : {}), ...(type == '數字' && long ? { long: true } : {}), ...(desc ? { desc } : {}) };
    });
    setModules(modulesRef.current.map(x => (x.id == m.id ? { ...x, info: { ...x.info, params } } : x)));
    currentDiagram().draw();
    return null;
  };

  const deleteModule = (m: AppModule) => {
    // 還有地方執行這個模組：請學生先把那些積木刪掉
    const used = allDiagrams().filter(d => d != m.diagram).flatMap(d => blocksUsing(d, m.info.name));
    if (used.length) {
      alert(t(`模組「${m.info.name}」還有地方在用：${used.join('、')}。請先把這些積木刪掉，再刪除模組。`, `The module "${m.info.name}" is still used: ${used.join(', ')}. Delete those blocks first.`));
      return;
    }
    if (!confirm(t(`確定要刪除模組「${m.info.name}」嗎？它的流程圖也會一起刪掉。`, `Delete the module "${m.info.name}"? Its flowchart will be deleted too.`))) return;
    m.diagram.dispose();
    setModules(modulesRef.current.filter(x => x != m));
    showSheet(0);
  };

  /**
   * 變數改名：流程圖裡每個用到舊名的積木（輸入、輸出、計算、判斷、迴圈、執行模組…）都換成新名。
   * 看積木上的字找（不看 node.variables：從積木轉回來的、舊作品檔的積木不一定記了用到哪些變數）
   */
  const renameInDiagram = (d: Diagram, from: string, to: string) => {
    for (const node of d.nodes) {
      if (!node || !usesName(node.text, from)) continue;
      node.text = renameInText(node.text, from, to);
      node.variables = [...new Set([...(node.variables ?? []).filter(v => v != from), to])];
      d.fitNode(node);
    }
  };

  /** 改模組的區域變數；rename 是改名（舊名, 新名）：這個模組的流程圖裡用到的地方也跟著改 */
  const setLocals = (id: number, locals: LocalVar[], rename?: [string, string]) => {
    const m = moduleOf2(id);
    if (!m) return;
    if (rename && rename[0] && rename[1] && rename[0] != rename[1]) {
      const [from, to] = rename;
      const d = m.diagram;
      renameInDiagram(d, from, to);
      d.draw();
    }
    setModules(modulesRef.current.map(x => (x.id == id ? { ...x, info: { ...x.info, locals } } : x)));
  };

  /** 換掉全部的模組（匯入作品、積木套用回來時） */
  const replaceModules = (list: { info: ModuleInfo; fill: (d: Diagram) => void }[]) => {
    const old = modulesRef.current;
    const next = list.map(({ info, fill }) => {
      // 同名的模組沿用原本的分頁
      const same = old.find(m => m.info.name == info.name);
      const diagram = same?.diagram ?? newModuleDiagram(false);
      diagram.init(myCanvasRef.current!);
      fill(diagram);
      return { id: same?.id ?? ++moduleSeq, info, diagram };
    });
    old.filter(m => !next.some(n => n.diagram == m.diagram)).forEach(m => m.diagram.dispose());
    setModules(next);
    showSheet(sheetRef.current);
  };

  /** 變數表每一列上次確定的名字（名字不能用時改回去） */
  const committedVarNames = useRef(new Map<number, string>());
  /**
   * 全域變數的名字跟模組一樣：流程圖上分不出是哪一個，回傳原因。
   * 跟模組的參數、區域變數同名可以：模組裡寫這個名字指的是模組自己的，主流程指的是全域變數
   */
  const globalVarProblem = (name: string, id: number): string | null => {
    const cpp = cppNameProblem(name);
    if (cpp) return cpp;
    if (modulesRef.current.some(m => m.info.name == name)) return sameName(t(`「${name}」已經是模組的名字了`, `"${name}" is already a module`));
    if (structsRef.current.some(s => s.name.trim() == name)) return sameName(t(`「${name}」已經是 struct 的名字了`, `"${name}" is already a struct`));
    // 變數表裡另一個變數（不管什麼型別）已經叫這個名字
    if (varsRef.current.some(v => v.id != id && v.name.trim() == name)) return sameName(t(`已經有叫「${name}」的變數了`, `There is already a variable called "${name}"`));
    return null;
  };
  /** 區域變數的名字：不能跟模組、這個模組的參數、這個模組的其他區域變數一樣（跟全域變數一樣可以） */
  const localVarProblem = (m: AppModule, name: string, id: number, rows: LocalVar[]): string | null => {
    const cpp = cppNameProblem(name);
    if (cpp) return cpp;
    if (modulesRef.current.some(x => x.info.name == name)) return sameName(t(`「${name}」已經是模組的名字了`, `"${name}" is already a module`));
    if (m.info.params.some(p => p.name == name)) return sameName(t(`「${name}」已經是這個模組的參數了`, `"${name}" is already a parameter of this module`));
    if (rows.some(v => v.id != id && v.name.trim() == name)) return sameName(t(`已經有叫「${name}」的區域變數了`, `There is already a local variable called "${name}"`));
    return null;
  };
  // ---------------- struct（只有 C++） ----------------
  const setStructs = (next: StructDef[]) => {
    structsRef.current = next;
    setStructRegistry(next);
    setStructsState(next);
  };
  /** struct 的名稱：要是 C++ 的名稱，不能跟其他 struct、變數、模組同名 */
  const structProblem = (name: string, id: number): string | null => {
    const cpp = cppNameProblem(name);
    if (cpp) return cpp;
    if (structsRef.current.some(s => s.id != id && s.name.trim() == name)) return sameName(t(`已經有叫「${name}」的 struct 了`, `There is already a struct called "${name}"`));
    if (varsRef.current.some(v => v.name.trim() == name)) return sameName(t(`「${name}」已經是變數的名字了`, `"${name}" is already a variable`));
    if (modulesRef.current.some(m => m.info.name == name)) return sameName(t(`「${name}」已經是模組的名字了`, `"${name}" is already a module`));
    return null;
  };
  /** 欄位名稱：要是 C++ 的名稱，同一個 struct 裡不能重複 */
  const fieldProblem = (name: string, others: string[]): string | null => {
    const cpp = cppNameProblem(name);
    if (cpp) return cpp;
    if (others.includes(name)) return sameName(t(`這個 struct 已經有「${name}」這個欄位了`, `This struct already has a field "${name}"`));
    return null;
  };
  /** 用到這個 struct 的變數（主流程和每個模組的區域變數） */
  const holdsStructType = (type: VarType) => type == '結構' || isContainerType(type);
  const structUsers = (sname: string) => [
    ...varsRef.current.filter(v => v.init == sname && holdsStructType(v.type)).map(v => v.name.trim() || t('（沒有名字的變數）', '(unnamed)')),
    ...modulesRef.current.flatMap(m => (m.info.locals ?? []).filter(v => v.init == sname && holdsStructType(v.type)).map(v => v.name.trim())),
  ];
  const changeStructs = (next: StructDef[], rename?: StructRename) => {
    if (rename?.kind == 'struct') {
      // struct 改名：用到它的變數跟著改
      const fix = <T extends { init: string; type: VarType }>(v: T): T => (v.init == rename.from && holdsStructType(v.type) ? { ...v, init: rename.to } : v);
      setVars(varsRef.current.map(fix));
      setModules(modulesRef.current.map(m => (m.info.locals ? { ...m, info: { ...m.info, locals: m.info.locals.map(fix) } } : m)));
    }
    if (rename?.kind == 'field') {
      // 欄位改名：這種 struct 的變數，欄位初始值跟著改名
      const fixInit = <T extends { init: string; type: VarType; fieldInit?: Record<string, string> }>(v: T): T => {
        if (v.type != '結構' || v.init != rename.struct || !v.fieldInit || !(rename.from in v.fieldInit)) return v;
        const { [rename.from]: value, ...rest } = v.fieldInit;
        return { ...v, fieldInit: { ...rest, [rename.to]: value } };
      };
      setVars(varsRef.current.map(fixInit));
      setModules(modulesRef.current.map(m => (m.info.locals ? { ...m, info: { ...m.info, locals: m.info.locals.map(fixInit) } } : m)));
      // 流程圖裡的「.舊名」跟著改。別的 struct 也有同名欄位的話分不出是哪一個，就不自動改
      const shared = structsRef.current.some(s => s.name != rename.struct && s.fields.some(f => f.name.trim() == rename.from));
      if (shared) {
        alert(t(`別的 struct 也有「${rename.from}」這個欄位，流程圖裡的「.${rename.from}」沒有自動改名，請自己檢查。`, `Another struct also has a field "${rename.from}", so ".${rename.from}" in the flowchart was not renamed. Please check it yourself.`));
      }
      else {
        for (const d of allDiagrams()) {
          for (const node of d.nodes) {
            if (node && usesField(node.text, rename.from)) {
              node.text = renameFieldInText(node.text, rename.from, rename.to);
              d.fitNode(node);
            }
          }
          d.draw();
        }
      }
    }
    setStructs(next);
    syncVarList();
  };
  const structArea = getTarget() == 'cpp' && (
    <StructTable
      structs={structs}
      onChange={changeStructs}
      structProblem={structProblem}
      fieldProblem={fieldProblem}
      deleteProblem={s => {
        const users = s.name.trim() ? structUsers(s.name.trim()) : [];
        return users.length ? t(`變數 ${users.join('、')} 還在用 struct ${s.name}：請先把它們的型別改掉，再刪除。`, `The variables ${users.join(', ')} still use struct ${s.name}. Change their types first.`) : null;
      }}
      fieldInUse={(_, field) => allDiagrams().some(d => d.nodes.some(n => n != null && usesField(n.text, field)))}
    />
  );

  /** 撞名的說明後面加上為什麼不行 */
  const sameName = (why: string) => why + t('：名字一樣的話，流程圖上分不出是哪一個，請換一個名字。', '. With the same name you cannot tell them apart in the flowchart. Choose another name.');
  /** 變數表的輸入框確定時：名字不能用就改回原本的名字 */
  const commitVars = () => {
    // 只看這次改過名字的列（原本就撞名的舊作品，第四步執行時會說明）
    const bad = varsRef.current.find(r => r.name.trim() && r.name.trim() != committedVarNames.current.get(r.id)?.trim() && globalVarProblem(r.name.trim(), r.id));
    if (bad) {
      alert(globalVarProblem(bad.name.trim(), bad.id)!);
      const old = committedVarNames.current.get(bad.id) ?? '';
      setVars(varsRef.current.map(v => (v.id == bad.id ? { ...v, name: old.trim() == bad.name.trim() ? '' : old } : v)));
    }
    syncVarList();
  };

  /** 依變數表格重建變數清單；如果有變數改名，流程圖裡用到的地方也跟著改 */
  const syncVarList = () => {
    const oldNames = [...varStore.var_list.name];
    // 沒填名稱的列先不算（還在打字，或忘了刪）
    const rows = varsRef.current.filter(r => r.name.trim() != '');
    varStore.var_list.name = rows.map(r => r.name);
    varStore.var_list.value = rows.map(r => r.init);
    varStore.type_var_list = typeLists(rows);
    varStore.sizes = Object.fromEntries(rows.filter(r => r.type == '陣列').map(r => [r.name, r.size ?? '']));
    varStore.structInits = Object.fromEntries(rows.filter(r => r.type == '結構' && r.fieldInit).map(r => [r.name, r.fieldInit!]));
    varStore.floats = rows.filter(r => r.type == '數字' && r.float).map(r => r.name);
    varStore.longs = rows.filter(r => r.type == '數字' && r.long).map(r => r.name);
    varStore.globals = getTarget() == 'cpp' ? rows.filter(r => r.global).map(r => r.name) : [];

    rows.forEach(r => committedVarNames.current.set(r.id, r.name));
    const replaced = oldNames.filter(n => !varStore.var_list.name.includes(n));
    const added = varStore.var_list.name.filter(n => !oldNames.includes(n));
    if (replaced.length && added.length) {
      // 主程式和每個模組的流程圖都要改（模組裡有同名的參數或區域變數時，那個名字指的是模組自己的，不改）
      for (const d of allDiagrams()) {
        const m = moduleOf(d);
        if (m && (m.info.params.some(p => p.name == replaced[0]) || m.info.locals?.some(v => v.name.trim() == replaced[0]))) {
          // 只改「主流程的舊名」（Scratch）
          for (const node of d.nodes) {
            if (node?.text.includes(GLOBAL_PREFIX + replaced[0])) {
              node.text = renameInText(node.text, GLOBAL_PREFIX + replaced[0], GLOBAL_PREFIX + added[0]);
              d.fitNode(node);
            }
          }
          continue;
        }
        renameInDiagram(d, replaced[0], added[0]);
      }
      currentDiagram().draw();
    }
  };

  editNodeRef.current = (d, index) => {
    const node = d.nodes[index];
    if (!node) return;
    syncVarList();
    const { kind, initial } = editDialogFor(node, moduleInfos(), storeFor(d));
    openDialog({
      kind,
      initial,
      canReturn: returnsIn(d),
      params: moduleOf(d)?.info.params,
      locals: moduleOf(d)?.info.locals,
      inModule: !!moduleOf(d),
      onYes: f => editMainNode(node, d, storeFor(d), f, moduleInfos()),
      onNo: () => { d.pause = false; },
    });
  };

  // ---------------- 語言切換 ----------------
  const lang = useLang();
  useEffect(() => onLangChange(() => {
    for (const d of allDiagrams()) d.nodes.forEach(n => { if (n) d.fitNode(n); });
    currentDiagram().draw();
  }), []);
  useEffect(() => {
    const title = questionIn(question, lang).title;
    document.title = (title ? title + '｜' : '') + t('電子式學習單', 'Flowchart Worksheet');
  }, [question, lang]);

  // ---------------- 載入題目、記住滑鼠位置 ----------------
  useLayoutEffect(() => {
    main.init(myCanvasRef.current!);
    loadQuestion(window.location.search).then(q => {
      setQuestion(q);
    });
    // 從別題匯入、切換過來的作品
    const pending = takePendingImport();
    if (pending && pending.question == questionPath) applyWork(pending);

    // 記住滑鼠在畫布上的位置，點畫布新增積木時放在這裡
    const onMouseMove = (event: MouseEvent) => {
      const canvas = myCanvasRef.current;
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      const inside = rect.left < event.clientX && event.clientX < rect.right
        && rect.top < event.clientY && event.clientY < rect.bottom;
      const d = currentDiagram();
      if (!d.pause && inside) myMouse.current = canvasPoint(canvas, event);
      if (!inside) d.copyNode = null;
    };
    window.addEventListener('mousemove', onMouseMove);
    return () => window.removeEventListener('mousemove', onMouseMove);
  }, []);

  // ---------------- 切換步驟 ----------------
  /** 用第 n 組測資執行 */
  const runCase = (n: number) => {
    let result: RunResult | null = null;
    let error: FlowError | null = null;
    try {
      result = buildRun(main, varStore, cases[n * 3], moduleSources());
    }
    catch (e) {
      console.error(e);
      error = e instanceof FlowError ? e : new FlowError(t('執行時發生錯誤：', 'Something went wrong: ') + (e as Error).message);
    }
    setRun(result);
    setRunError(error ?? result?.error ?? null);
    setStep(0);
  };

  const clickTab = (index: number) => {
    setTool('none');
    connectorState.r = 0;
    for (const d of allDiagrams()) d.pause = false;
    if (index == 3 && !(main.hasNodeWithText('開始') && main.hasNodeWithText('結束'))) {
      alert(t('記得要加上開始跟結束！', 'Add a Start block and an End block first!'));
      return;
    }
    setPage(index);
    setPageNonce(n => n + 1);
  };

  // 畫面切換完（版面已經算好）才把流程圖接到要顯示的畫布上
  useLayoutEffect(() => {
    if (pageNonce == 0) return;
    for (const d of allDiagrams()) {
      d.selNode = null;
      d.selLink = null;
      d.stepHighlight = null;
    }
    if (page == 3) {
      // 第四步只看不改：流程圖只畫在第四步的畫布上（見 runPanes），不接滑鼠、鍵盤；要改請回第三步
      for (const d of allDiagrams()) d.active = false;
      runCase(which);
    }
    else {
      setRun(null);
      setRunError(null);
      syncVarList();
      showSheet(sheetRef.current);
    }
  }, [page, pageNonce]);

  /** 第幾張流程圖的名字：主流程、模組：xxx */
  const sheetLabel = (sheet: number) => (sheet == 0 ? t('主流程', 'Main flow') : t('模組：', 'Module: ') + (modulesRef.current[sheet - 1]?.info.name ?? ''));
  // 這一步在模組裡的話，是從哪個積木執行進來的（一層一層的最後一個）
  const callStack = run?.stack[Math.min(step, (run?.stack.length ?? 1) - 1)] ?? [];

  // 第四步：這一步標哪個積木（執行成功：目前這一步；執行到一半出錯：最後一步標出出錯的積木）
  const errorStep = runError && (!run || step == run.totalStep);
  const nowId = errorStep && runError.node != null ? runError.node : run ? run.step[step] ?? null : null;
  const nowAt = nowId == null ? { sheet: 0, node: null } : splitId(nowId);
  /**
   * 第四步並排的流程圖：主流程 → 一層一層執行進來的模組（標出執行模組的積木）→ 正在執行的。
   * 太多層（遞迴）時只放主流程和最後兩層
   */
  const runPanes: RunPane[] = (() => {
    if (page != 3) return [];
    const diagrams = allDiagrams();
    const at = (sheet: number) => diagrams[sheet] ?? main;
    const callers = callStack.map(id => ({ ...splitId(id) }));
    const shown = callers.length > 3 ? [callers[0], ...callers.slice(-2)] : callers;
    const skipped = callers.length - shown.length;
    const panes: RunPane[] = shown.map((c, k) => ({
      key: 'p' + k,
      title: (k == 1 && skipped ? t(`（中間還有 ${skipped} 層）`, `(${skipped} more levels) `) : '') + sheetLabel(c.sheet) + t('（從這裡執行進去）', ' (calls from here)'),
      running: false,
      draw: cv => at(c.sheet).drawOn(cv, c.node, true),
    }));
    panes.push({
      key: 'p' + shown.length,
      title: t('正在執行：', 'Running: ') + sheetLabel(nowAt.sheet) + (callers.length > 1 ? t(`（第 ${callers.length} 層）`, ` (level ${callers.length})`) : ''),
      running: true,
      draw: cv => at(nowAt.sheet).drawOn(cv, nowAt.node, true),
    });
    return panes;
  })();

  // ---------------- 畫布：點一下新增積木 ----------------
  const clickCanvas = () => {
    const { x, y } = myMouse.current;
    addBlockAt(toolRef.current, x, y);
  };

  /** 在畫布 (x, y) 新增一個 t 種類的積木（點畫布、或把工具拖進畫布都走這裡） */
  const addBlockAt = (t: string, x: number, y: number) => {
    const d = currentDiagram();
    if (page != 2 || t == 'none' || isArrowTool(t) || d.pause) return;
    syncVarList();
    d.pause = true;
    openDialog({
      kind: t as DialogRequest['kind'],
      canReturn: returnsIn(d),
      params: moduleOf(d)?.info.params,
      locals: moduleOf(d)?.info.locals,
      inModule: !!moduleOf(d),
      onYes: f => addMainNode(t, d, storeFor(d), f, x, y, moduleInfos()),
      onNo: () => { d.pause = false; },
    });
  };

  // ---------------- 把工具拖進畫布新增積木 ----------------
  const isBlockDrag = (e: DragEvent) => e.dataTransfer.types.includes(DRAG_TYPE);
  const dragOverCanvas = (e: DragEvent<HTMLCanvasElement>) => {
    if (page != 2 || !isBlockDrag(e) || currentDiagram().pause) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
  };
  const dropOnCanvas = (e: DragEvent<HTMLCanvasElement>) => {
    if (!isBlockDrag(e)) return;
    e.preventDefault();
    const p = canvasPoint(e.currentTarget, e.nativeEvent);
    myMouse.current = p;
    addBlockAt(e.dataTransfer.getData(DRAG_TYPE), p.x, p.y);
  };

  const clickTool = (id: string) => {
    const next = id == tool ? 'none' : id;
    setTool(next);
    connectorState.r = isArrowTool(next) ? 7 : 0;
    currentDiagram().draw();
  };

  const clickClear = () => openDialog({
    kind: 'clear',
    onYes: () => {
      // 只清空畫面上這一張（主程式或某個模組）
      const d = currentDiagram();
      d.clear();
      d.init(myCanvasRef.current!);
      d.draw();
      return true;
    },
  });

  // ---------------- 看程式：積木改好後重畫流程圖 ----------------
  const applyBlocks = (result: FromBlocks) => {
    // 變數表：積木裡的變數照積木的型別和初始值（原本的說明留著），積木沒用到的變數也留著
    const old = new Map(varsRef.current.map(v => [v.name.trim(), v]));
    const rows: VarRow[] = result.vars.map(v => ({
      id: old.get(v.name)?.id ?? ++varSeq, name: v.name, type: v.type, init: v.init, desc: old.get(v.name)?.desc ?? '',
    }));
    const names = new Set(result.vars.map(v => v.name));
    setVars([...rows, ...varsRef.current.filter(v => !names.has(v.name.trim()))]);
    syncVarList();
    buildFlowchart(main, result.program, varStore);
    // 積木裡的自訂積木／函式 → 模組（同名的沿用原本的分頁，積木裡沒有的就刪掉）
    replaceModules(result.modules.map(m => ({
      info: { name: m.name, params: m.params, ...(m.returns ? { returns: m.returns } : {}) },
      fill: d => buildFlowchart(d, m.body, withParams(varStore, m.params)),
    })));
    setCodeOpen(false);
  };

  // ---------------- 第一步：從輸入/輸出說明自動建立變數 ----------------
  const createRow = (name = '', desc = '') => {
    const row: VarRow = { id: ++varSeq, name, type: '數字', init: '0', desc };
    setVars([...varsRef.current, row]);
  };
  const autoVars = (desc: string) => (el: HTMLInputElement) => {
    for (const token of el.value.split(/[^\w一-龥]+/g)) {
      if (token && !varStore.var_list.name.includes(token)) createRow(token, desc);
    }
    syncVarList();
  };
  const hintCommit = useCommit<HTMLInputElement>(el => autoVars(t('輸入用的到', 'for input'))(el));
  const hint2Commit = useCommit<HTMLInputElement>(el => autoVars(t('輸出用的到', 'for output'))(el));

  // ---------------- 交作業 ----------------
  const downloadPDF = async () => {
    setMenuOpen(false);
    if (printing) {
      setPrinting(false);
      return;
    }
    const className = classRef.current!.value;
    const number = numberRef.current!.value;
    if (!((className && number) || DEBUG_MODE)) {
      alert(t('請填寫班級座號', 'Please fill in your class and number.'));
      return;
    }
    setPrinting(true);
    document.title = className + number;
    setPrintData({
      className,
      number,
      name: nameRef.current!.value,
      questionName: questionIn(question, getLang()).title,
      questionNote: noteRef.current!.value,
      vars: [
        ...varsRef.current.map(v => [v.name, typeLabel(v.type, v.float, v.init, v.size, v.long), v.init, v.desc]),
        // C++ 模組的區域變數：說明欄註明是哪個模組的
        ...modulesRef.current.flatMap(m => (m.info.locals ?? []).map(v => [v.name, typeLabel(v.type, v.float, v.init, v.size, v.long), v.init, `${v.desc}${t(`（模組「${m.info.name}」的區域變數）`, ` (local in "${m.info.name}")`)}`])),
      ],
      cases: [0, 1, 2].map(i => cases.slice(i * 3, i * 3 + 3)),
    });
    setPrintImg(main.toImage() ?? undefined);
    setPrintModules(modulesRef.current.flatMap(m => {
      const src = m.diagram.toImage();
      const params = m.info.params.map(p => p.name).join(', ');
      return src ? [{ title: `${m.info.name}(${params})`, src }] : [];
    }));
    await new Promise(resolve => setTimeout(resolve, 1000));
    window.print();
  };

  // ---------------- 換學習目標：每種語言能用的積木不一樣，目前的作答全部清掉重來 ----------------
  const target = useTarget() ?? getTarget();
  const course = COURSES.find(c => c.id == urlParams.get('w'));
  const switchTarget = (next: Target) => {
    if (next == getTarget()) return;
    if (!confirm(t(`換成 ${targetName(next)} 的話，目前的作答（第一步到第三步、變數、流程圖、模組）會全部清掉，確定嗎？`, `Switch to ${targetName(next)}? All your work (steps 1–3, variables, flowchart and modules) will be cleared.`))) return;
    setTarget(next);
    // 網址上有 ?target= 的話也換掉，重新整理才不會跑回原本的語言
    const url = new URL(window.location.href);
    if (url.searchParams.has('target')) {
      url.searchParams.set('target', next);
      history.replaceState(null, '', url);
    }
    applyWork(makeWorkFile({
      question: questionPath,
      questionTitle: question.title,
      page: 0,
      student: { className: classRef.current!.value, number: numberRef.current!.value, name: nameRef.current!.value },
      step1: { note: '', hint: '', hint2: '' },
      cases: [],
      variables: [],
      flowchart: { nodes: [], links: [] },
      modules: [],
      structs: [],
    }));
  };

  // ---------------- 匯出／匯入尚未完成的作品 ----------------
  const hint1Ref = useRef<HTMLInputElement>(null);
  const hint2Ref = useRef<HTMLInputElement>(null);

  const collectWork = (): WorkContent => ({
    question: questionPath,
    questionTitle: question.title,
    page,
    student: { className: classRef.current!.value, number: numberRef.current!.value, name: nameRef.current!.value },
    step1: { note: noteRef.current!.value, hint: hint1Ref.current!.value, hint2: hint2Ref.current!.value },
    cases: [0, 1, 2].map(i => cases.slice(i * 3, i * 3 + 3)),
    variables: varsRef.current.map(({ id: _id, ...v }) => v),
    flowchart: main.exportData(),
    modules: modulesRef.current.map(m => ({ ...m.info, flowchart: m.diagram.exportData() })),
    structs: structsRef.current.map(({ id: _id, ...s }) => s),
  });

  const hasWork = () => {
    const w = collectWork();
    return w.variables.length > 0 || w.flowchart.nodes.length > 0 || (w.modules?.length ?? 0) > 0 || (w.structs?.length ?? 0) > 0
      || w.cases.flat().some(Boolean) || Object.values(w.step1).some(Boolean);
  };

  /** 把存檔內容放回畫面上，並回到存檔時的步驟 */
  function applyWork(work: WorkFile) {
    classRef.current!.value = work.student?.className ?? '';
    numberRef.current!.value = work.student?.number ?? '';
    nameRef.current!.value = work.student?.name ?? '';
    noteRef.current!.value = work.step1?.note ?? '';
    hint1Ref.current!.value = work.step1?.hint ?? '';
    hint2Ref.current!.value = work.step1?.hint2 ?? '';
    setCases([0, 1, 2].flatMap(i => [0, 1, 2].map(j => String(work.cases[i]?.[j] ?? ''))));
    // struct 要先放好，變數表才認得 struct 型別
    setStructs((work.structs ?? []).map(s => ({
      id: ++varSeq,
      name: String(s.name ?? ''),
      fields: (s.fields ?? []).map(f => ({ name: String(f.name ?? ''), type: f.type == '文字' ? '文字' as const : '數字' as const, ...(f.float && f.type != '文字' ? { float: true } : {}) })),
    })));
    setVars(work.variables.map(v => ({
      id: ++varSeq,
      name: String(v.name ?? ''),
      type: VAR_TYPES.find(x => x == v.type) ?? '數字',
      init: String(v.init ?? '0'),
      desc: String(v.desc ?? ''),
      ...(v.size != null ? { size: String(v.size) } : {}),
      ...(v.fieldInit && typeof v.fieldInit == 'object' ? { fieldInit: Object.fromEntries(Object.entries(v.fieldInit).map(([k, x]) => [k, String(x)])) } : {}),
      ...(v.global ? { global: true } : {}),
      // 以前的作品沒有 int / float：C++ 初始值有小數點的當成 float
      ...(v.float || (getTarget() == 'cpp' && v.type == '數字' && String(v.init ?? '').includes('.')) ? { float: true } : {}),
      ...(v.long && v.type == '數字' ? { long: true } : {}),
    })));
    // 先清空舊的變數清單，不然會被當成「改名」而去改到流程圖裡的字
    varStore.var_list.name = [];
    syncVarList();
    main.loadData(work.flowchart);
    sheetRef.current = 0;
    replaceModules((work.modules ?? []).map(m => ({
      info: {
        name: String(m.name ?? ''),
        params: (m.params ?? []).map(p => ({ name: String(p.name ?? ''), type: p.type == '文字' ? '文字' : '數字', ...(p.float && p.type != '文字' ? { float: true } : {}), ...(p.long && p.type != '文字' ? { long: true } : {}), ...(p.desc ? { desc: String(p.desc) } : {}) })),
        ...(m.returns == '數字' || m.returns == '文字' ? { returns: m.returns } : {}),
        ...(m.returns == '數字' && m.returnsFloat ? { returnsFloat: true } : {}),
        ...(m.returns == '數字' && m.returnsLong ? { returnsLong: true } : {}),
        ...(Array.isArray(m.locals) && m.locals.length ? {
          locals: m.locals.map(v => ({
            id: ++varSeq,
            name: String(v.name ?? ''),
            type: VAR_TYPES.find(x => x == v.type) ?? '數字',
            init: String(v.init ?? ''),
            desc: String(v.desc ?? ''),
            ...(v.size != null ? { size: String(v.size) } : {}),
            ...(v.fieldInit && typeof v.fieldInit == 'object' ? { fieldInit: Object.fromEntries(Object.entries(v.fieldInit).map(([k, x]) => [k, String(x)])) } : {}),
            ...(v.float ? { float: true } : {}),
            ...(v.long ? { long: true } : {}),
          })),
        } : {}),
      },
      fill: d => d.loadData(m.flowchart),
    })));
    // 第四步要重新執行，所以最多回到第三步
    clickTab(Math.min(Math.max(work.page ?? 0, 0), 2));
  }

  const exportWork = () => {
    setMenuOpen(false);
    downloadWorkFile(makeWorkFile(collectWork()));
  };

  const importWork = async () => {
    setMenuOpen(false);
    const text = await pickTextFile();
    if (text == null) return;
    let work: WorkFile;
    try {
      work = parseWorkFile(text);
    }
    catch (e) {
      alert((e as Error).message);
      return;
    }
    if (work.question != questionPath) {
      const name = work.questionTitle || work.question;
      if (!confirm(t(`這個檔案是「${name}」這一題的作品，不是目前這一題。\n要切換到「${name}」並匯入嗎？`, `This file is for "${name}", not this problem.\nGo to "${name}" and open it?`))) return;
      if (!stashPendingImport(work)) {
        alert(t('瀏覽器不允許暫存資料，請先打開「' + name + '」那一題，再匯入一次。', 'Please open "' + name + '" first, then open the file again.'));
        return;
      }
      const [w, h] = work.question.split('/');
      window.location.href = link(`?w=${encodeURIComponent(w)}&h=${encodeURIComponent(h)}`);
      return;
    }
    if (hasWork() && !confirm(t('匯入後，目前畫面上的內容會被檔案裡的內容取代。確定要匯入嗎？', 'Your work on this page will be replaced by the file. Open it?'))) return;
    applyWork(work);
  };

  // 「檔案」選單：點選單外面或按 Esc 就收起來
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!menuOpen) return;
    const onDown = (e: MouseEvent) => { if (!menuRef.current?.contains(e.target as Node)) setMenuOpen(false); };
    const onKey = (e: KeyboardEvent) => { if (e.key == 'Escape') setMenuOpen(false); };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [menuOpen]);

  const toolButton = (t: typeof BLOCK_TOOLS[number]) => (
    <button
      key={t.id} id={t.id} title={t.name()}
      className={'toolbox_btn' + (tool == t.id ? ' selected' : '')}
      onClick={() => clickTool(t.id)}
      draggable={!isArrowTool(t.id)}
      onDragStart={e => {
        e.dataTransfer.setData(DRAG_TYPE, t.id);
        e.dataTransfer.effectAllowed = 'copy';
      }}
    >
      <img className="toolbox_img" src={`./libs/icon/${t.icon}.png`} alt={t.name()} draggable={false} />
    </button>
  );

  return (
    <div className="app">
      <div id="header">
        <div className="header_left">
        <a className="logo" href={link('./')} title={t('回到選擇課程（目前的作答不會保存）', 'Back to courses (your work will not be saved)')} onClick={e => {
          if (!confirm(t('回到選擇課程？目前的作答不會保存。', 'Go back to courses? Your work will not be saved.'))) e.preventDefault();
        }}>
          <img src="./libs/logo.png" alt="" />
          {t('電子式學習單', 'Flowchart Worksheet')}
        </a>
        <LangToggle />
        {/* 學習目標：全部列出來，換的話目前的作答全部清掉（每種語言能用的積木不一樣） */}
        <div className="lang_toggle target_toggle" role="group" aria-label={t('學習目標', 'Learning')}>
          {(['scratch', 'blockly', 'cpp'] as Target[]).map(x => {
            const fits = !course || courseFits(course, x);
            return (
              <button
                key={x} className={target == x ? 'selected' : ''} aria-pressed={target == x} disabled={!fits}
                title={fits ? undefined : t('這個課程不能用這個語言', 'This course does not use this language')}
                onClick={() => switchTarget(x)}
              >
                {targetName(x)}
              </button>
            );
          })}
          <button disabled title={t('準備中', 'Coming soon')}>Python</button>
        </div>
        </div>
        <div id="student_info">
          <label>{t('班級', 'Class')}<input id="class" placeholder={t('必填', 'Required')} ref={classRef} /></label>
          <label>{t('座號', 'No.')}<input id="number" placeholder={t('必填', 'Required')} ref={numberRef} /></label>
          <label>{t('姓名', 'Name')}<input id="name" placeholder={t('非必填', 'Optional')} ref={nameRef} /></label>
          {printing ? (
            <button className="submit-button" id="finish" onClick={downloadPDF}>{t('返回編輯', 'Back to edit')}</button>
          ) : (
            <div className="file_menu" ref={menuRef}>
              <button className="submit-button" id="file_select" aria-expanded={menuOpen} onClick={() => setMenuOpen(o => !o)}>
                {t('檔案', 'File')} ▾
              </button>
              {menuOpen && (
                <div className="file_menu_list" role="menu">
                  <button role="menuitem" onClick={exportWork}>
                    {t('匯出尚未完成的作品', 'Save my work (.json)')}
                  </button>
                  <button role="menuitem" onClick={importWork}>
                    {t('匯入作品資料', 'Open my work')}
                  </button>
                  <div className="file_menu_sep" />
                  <button role="menuitem" id="finish" onClick={downloadPDF}>
                    {t('匯出 PDF（交作業）', 'Save as PDF (hand in)')}
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      <NodeDialog
        request={dialog} onClose={() => setDialog(null)} varTypes={varStore.type_var_list} modules={modules.map(m => m.info)}
        holds={Object.fromEntries(varStore.var_list.name.map((n, k) => [n, varStore.var_list.value[k]]))}
        globals={varStore.globals}
      />
      <ModuleDialog request={moduleDialog} onClose={() => setModuleDialog(null)} />
      <CodeView
        open={codeOpen} onClose={() => setCodeOpen(false)} diagram={main} modules={moduleSources} onApply={applyBlocks}
        vars={() => varsRef.current.filter(v => v.name.trim() != '').map(v => ({ name: v.name.trim(), type: v.type, init: v.init, float: v.float, long: v.long, size: v.size, fieldInit: v.fieldInit, global: v.global }))}
      />

      <div id="workspace" style={{ display: printing ? 'none' : undefined }}>
        <div id="page_set">
          {pageTitles().map((title, i) => (
            <button key={i} className={'page_tab' + (page == i ? ' selected' : '')} onClick={() => clickTab(i)}>
              <span className="step_badge">{i + 1}</span>{title}
            </button>
          ))}
        </div>

        {/* 第一～三步：左右兩欄 */}
        <div className="stage" style={{ display: page == 3 ? 'none' : undefined }}>
          <div id="left_div" className="col">
            {page == 2 && (
              <VarTable
                rows={vars}
                allowed={allowedVarTypes(question)}
                structArea={structArea}
                onChange={(id, patch) => setVars(varsRef.current.map(v => v.id == id ? { ...v, ...patch } : v))}
                onCommit={commitVars}
                onDelete={id => { setVars(varsRef.current.filter(v => v.id != id)); syncVarList(); }}
                onCreate={() => createRow()}
                module={(() => {
                  const m = moduleOf2(sheet);
                  return m && {
                    name: m.info.name,
                    params: m.info.params,
                    // 區域變數只有 C++ 有（舊作品換了學習目標還留著的話，也列出來讓學生刪掉）
                    locals: getTarget() == 'cpp' || m.info.locals?.length ? m.info.locals ?? [] : null,
                    onLocals: (next: LocalVar[], rename?: [string, string]) => setLocals(m.id, next, rename),
                    localProblem: (name: string, id: number, rows: LocalVar[]) => localVarProblem(m, name, id, rows),
                    onParam: (k: number, patch: Partial<ParamInfo>) => editParam(m, k, patch),
                    onProblem: (why: string) => alert(why),
                  };
                })()}
              />
            )}
            <QuestionPanel question={question} />
          </div>

          {/* 第一步＋第二步 */}
          <div className="col" style={{ display: page <= 1 ? undefined : 'none' }}>
            <StepCard
              id="step1" no={1} title={t('讀懂題目', 'Understand the problem')} active={page == 0}
              lockText={t('← 點這裡回到第一步', '← Click to go back to step 1')} onUnlock={() => clickTab(0)}
            >
              <div className="step_form">
                <label htmlFor="question_note">{t('題目請你做什麼？', 'What does the problem ask?')}</label>
                <input id="question_note" ref={noteRef} />
                <label htmlFor="question_hint">{t('輸入值代表什麼？', 'What is the input?')}</label>
                <input id="question_hint" ref={hint1Ref} {...hintCommit} />
                <label htmlFor="question_hint2">{t('輸出值代表什麼？', 'What is the output?')}</label>
                <input id="question_hint2" ref={hint2Ref} {...hint2Commit} />
              </div>
            </StepCard>

            <StepCard
              id="step2" no={2} title={t('想測資', 'Make test data')} active={page == 1}
              lockText={t('完成第一步後，點這裡進入第二步 →', 'Done with step 1? Click to go to step 2 →')} onUnlock={() => clickTab(1)}
            >
              <table id="case_table" className="data_table">
                <tbody>
                  <tr>
                    <th style={{ width: '6%' }}></th>
                    <th style={{ width: '30%' }}>{t('輸入', 'Input')}</th>
                    <th style={{ width: '24%' }}>{t('輸出', 'Output')}</th>
                    <th>{t('測試重點', 'What it tests')}</th>
                  </tr>
                  {[0, 1, 2].map(r => (
                    <tr key={r}>
                      <td className="muted" style={{ textAlign: 'center' }}>{r + 1}</td>
                      {[0, 1, 2].map(c => (
                        <td key={c}>
                          <textarea
                            className="case_input" value={cases[r * 3 + c]}
                            onChange={e => {
                              const next = [...cases];
                              next[r * 3 + c] = e.target.value;
                              setCases(next);
                            }}
                            onInput={e => fitRowOnInput(e.currentTarget)}
                          ></textarea>
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </StepCard>
          </div>

          {/* 第三步：流程圖 */}
          <div id="right_div" className="card canvas_card" style={{ display: page == 2 ? undefined : 'none' }}>
            <div className="canvas_head">
              <h5 className="card_title" style={{ margin: 0 }}>{t('流程圖', 'Flowchart')}</h5>
              <button id="show_code" onClick={() => setCodeOpen(true)} title={t('看看流程圖變成程式的樣子', 'See your flowchart as code')}>
                {t('看程式', 'See code')}（{targetName(getTarget())}）
              </button>
              <span className="canvas_hint" />
              <button id="clear_canvas" onClick={clickClear}>{sheet == 0 ? t('清空流程圖', 'Clear all') : t('清空這個模組', 'Clear this module')}</button>
            </div>
            {/* 主程式和每個模組各一張流程圖 */}
            <div className="sheet_tabs" role="tablist">
              <button role="tab" aria-selected={sheet == 0} className={sheet == 0 ? 'selected' : ''} onClick={() => showSheet(0)}>{t('主流程', 'Main flow')}</button>
              {modules.map(m => (
                <button key={m.id} role="tab" aria-selected={sheet == m.id} className={sheet == m.id ? 'selected' : ''} onClick={() => showSheet(m.id)}>
                  {t('模組：', 'Module: ')}{m.info.name}
                </button>
              ))}
              <button className="sheet_add" onClick={newModule}>{t('＋ 新增模組', '+ New module')}</button>
            </div>
            {sheet != 0 && (() => {
              const m = modules.find(x => x.id == sheet);
              if (!m) return null;
              return (
                <div className="module_bar">
                  <span>
                    {t('定義', 'Define')} <b>{m.info.name}</b>
                    {m.info.params.length > 0 && <>（{t('參數：', 'parameters: ')}{m.info.params.map(p => `${p.name}${getTarget() == 'cpp' ? `［${cppType(p.type, p.float, p.long)}］` : p.type == '文字' ? t('［文字］', ' [text]') : ''}`).join('、')}）</>}
                    {m.info.returns && <>{t('，回傳', ', returns ')}{getTarget() == 'cpp' ? ' ' + cppType(m.info.returns, m.info.returnsFloat, m.info.returnsLong) : m.info.returns == '文字' ? t('文字', 'text') : t('數字', 'a number')}</>}
                  </span>
                  <span className="muted">{t('從「開始」做到「結束」，做完回到執行它的地方', 'Runs from Start to End, then goes back to where it was run')}</span>
                  <button onClick={() => editModule(m)}>{t('修改名稱、參數', 'Edit name, parameters')}</button>
                  <button onClick={() => deleteModule(m)}>{t('刪除模組', 'Delete module')}</button>
                </div>
              );
            })()}
            <div className="canvas_body">
              <div id="toolbox">
                {BLOCK_TOOLS.map(toolButton)}
                <div className="toolbox_sep" />
                {ARROW_TOOLS.map(toolButton)}
              </div>
              <div className="canvas_wrap">
                <canvas id="my_canvas" ref={myCanvasRef} onClick={clickCanvas} onDragOver={dragOverCanvas} onDrop={dropOnCanvas}></canvas>
              </div>
            </div>
          </div>
        </div>

        <RunArea
          visible={page == 3}
          panes={runPanes}
          run={run}
          error={runError?.message ?? null}
          partial={run != null && runError != null}
          step={step}
          onStep={setStep}
          which={which}
          onWhich={n => { setWhich(n); runCase(n); }}
          cases={cases}
          varNames={varStore.var_list.name}
          kinds={Object.fromEntries([...vars, ...modules.flatMap(m => m.info.locals ?? [])].filter(v => v.type == '堆疊' || v.type == '佇列' || v.type == '陣列').map(v => [v.name.trim(), v.type]))}
          sheetName={modules.length ? sheetLabel(nowAt.sheet) : ''}
          moduleVars={modules.map((m, k) => ({
            sheet: k + 1,
            name: m.info.name,
            names: [...m.info.params.map(p => p.name), ...(m.info.locals ?? []).map(v => v.name.trim()).filter(Boolean)],
          }))}
        />
      </div>

      <PrintView visible={printing} data={printData} imgSrc={printImg} modules={printModules} />

      <div id="footer">
        <div className="contact">
          <p>{t('聯絡我們：', 'Contact: ')}<a href="mailto:785@syijh.tp.edu.tw">785@syijh.tp.edu.tw</a></p>
        </div>
        <div className="copyright">
          <p>&copy; 2023 張煜. All rights reserved.</p>
        </div>
      </div>
    </div>
  );
}
