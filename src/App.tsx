// 學習單主畫面：四個步驟
//   第一步 讀懂題目、第二步 想測資：同一個畫面，還不能做的那張卡片蓋上半透明灰色
//   第三步 定義變數、設計流程：左邊變數＋題目，右邊流程圖畫布
//   第四步 測試執行並除錯：逐步執行流程圖
import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { CodeView } from './components/CodeView';
import { ModuleDialog, type ModuleRequest } from './components/ModuleDialog';
import { NodeDialog, type DialogRequest } from './components/NodeDialog';
import { PrintView, type PrintData } from './components/PrintView';
import { QuestionPanel } from './components/QuestionPanel';
import { RunArea } from './components/RunArea';
import { VarTable, type VarRow } from './components/VarTable';
import { connectorState, createConnectors } from './engine/connector';
import { buildRun, createVarStore, FlowError, withParams, type RunResult } from './engine/decoder';
import { canvasPoint, Diagram, type DiagramHooks } from './engine/diagram';
import type { FromBlocks } from './engine/fromBlockly';
import { callText, parseCall, splitId, type ModuleInfo, type ModuleSource } from './engine/modules';
import { buildFlowchart } from './engine/toFlowchart';
import { addMainNode, editDialogFor, editMainNode } from './nodeActions';
import { EMPTY_QUESTION, loadQuestion, questionIn, type Question } from './questions';
import { fitRowOnInput } from './textareaSizing';
import { LangToggle } from './components/LangToggle';
import { getLang, link, onLangChange, t, useLang } from './i18n';
import { getTarget, targetName } from './target';
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
/** 箭頭工具：選了才顯示積木上的連接點 */
const isArrowTool = (tool: string) => tool == 'straight' || tool == 'square';


/** 目前這一題，例如 "114/3"（網址 ?w=114&h=3） */
const urlParams = new URLSearchParams(window.location.search);
const questionPath = `${urlParams.get('w')}/${urlParams.get('h')}`;

let dialogSeq = 0;
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
  const modulesRef = useRef<AppModule[]>([]);
  const [sheet, setSheetState] = useState(0);
  const sheetRef = useRef(0);
  const [moduleDialog, setModuleDialog] = useState<ModuleRequest | null>(null);
  /** 第四步：目前顯示哪一張流程圖（執行到模組裡時會換過去） */
  const [runSheetName, setRunSheetName] = useState('');
  const shownRef = useRef<Diagram | null>(null);
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
  const showCanvasRef = useRef<HTMLCanvasElement>(null);
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
    ...withParams(varStore, moduleOf(d)?.info.params ?? []),
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
    if (varStore.var_list.name.includes(name)) return t(`「${name}」已經是變數的名字了，請換一個。`, `"${name}" is already a variable. Choose another name.`);
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

  const editModule = (m: AppModule) => setModuleDialog({
    id: ++dialogSeq,
    initial: m.info,
    nameProblem: nameProblem(m),
    onSave: info => {
      const oldName = m.info.name;
      // 改名：每張流程圖裡執行這個模組的積木也跟著改
      if (info.name != oldName) {
        for (const d of allDiagrams()) {
          for (const node of d.nodes) {
            const call = node?.figure == 'Function' ? parseCall(node.text) : null;
            if (node && call?.name == oldName) {
              node.text = callText(info.name, call.args);
              d.fitNode(node);
            }
          }
        }
      }
      setModules(modulesRef.current.map(x => (x == m ? { ...m, info } : x)));
      currentDiagram().draw();
    },
  });

  const deleteModule = (m: AppModule) => {
    if (!confirm(t(`確定要刪除模組「${m.info.name}」嗎？它的流程圖也會一起刪掉。`, `Delete the module "${m.info.name}"? Its flowchart will be deleted too.`))) return;
    m.diagram.dispose();
    setModules(modulesRef.current.filter(x => x != m));
    showSheet(0);
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

  /** 依變數表格重建變數清單；如果有變數改名，流程圖裡用到的地方也跟著改 */
  const syncVarList = () => {
    const oldNames = [...varStore.var_list.name];
    // 沒填名稱的列先不算（還在打字，或忘了刪）
    const rows = varsRef.current.filter(r => r.name.trim() != '');
    varStore.var_list.name = rows.map(r => r.name);
    varStore.var_list.value = rows.map(r => r.init);
    varStore.type_var_list.number = rows.filter(r => r.type == '數字').map(r => r.name);
    varStore.type_var_list.text = rows.filter(r => r.type == '文字').map(r => r.name);
    varStore.type_var_list.array = rows.filter(r => r.type == '清單').map(r => r.name);
    varStore.type_var_list.grid = rows.filter(r => r.type == '二維清單').map(r => r.name);

    const replaced = oldNames.filter(n => !varStore.var_list.name.includes(n));
    const added = varStore.var_list.name.filter(n => !oldNames.includes(n));
    if (replaced.length && added.length) {
      // 主程式和每個模組的流程圖都要改
      for (const d of allDiagrams()) {
        for (const node of d.nodes) {
          if (node?.variables?.includes(replaced[0])) {
            node.variables = node.variables.map(v => v == replaced[0] ? added[0] : v);
            node.text = node.text.replaceAll(replaced[0], added[0]);
            d.fitNode(node);
          }
        }
      }
      currentDiagram().draw();
    }
  };

  editNodeRef.current = (d, index) => {
    const node = d.nodes[index];
    if (!node) return;
    syncVarList();
    const { kind, initial } = editDialogFor(node);
    openDialog({
      kind,
      initial,
      canReturn: returnsIn(d),
      params: moduleOf(d)?.info.params,
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
      // 第四步從主程式開始顯示；執行到模組裡時再換（見下面）
      for (const d of allDiagrams()) d.active = false;
      main.active = true;
      main.init(showCanvasRef.current!);
      shownRef.current = main;
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
  const caller = callStack.length ? { id: callStack[callStack.length - 1], depth: callStack.length } : null;
  const callerCanvasRef = useRef<HTMLCanvasElement>(null);

  // 逐步執行：標出目前執行到的積木；執行到模組裡時，畫布換成那個模組的流程圖
  useLayoutEffect(() => {
    if (page != 3) return;
    // 執行成功：標出目前這一步；失敗：標出有問題的積木
    // 執行到一半出錯時，最後一步標出出錯的積木
    const errorStep = runError && (!run || step == run.totalStep);
    const id = errorStep && runError.node != null ? runError.node : run ? run.step[step] ?? null : null;
    const where = id == null ? { sheet: 0, node: null } : splitId(id);
    const diagrams = allDiagrams();
    const d = diagrams[where.sheet] ?? main;
    for (const x of diagrams) {
      x.stepHighlight = null;
      x.active = false;
    }
    d.active = true;
    if (shownRef.current != d) {
      d.init(showCanvasRef.current!);
      shownRef.current = d;
    }
    d.stepHighlight = where.node;
    d.draw();
    setRunSheetName(sheetLabel(where.sheet));
    // 在模組裡：左邊畫出執行進來的那張流程圖，標出執行模組的積木
    if (caller && callerCanvasRef.current) {
      const c = splitId(caller.id);
      (diagrams[c.sheet] ?? main).drawOn(callerCanvasRef.current, c.node);
    }
  }, [run, runError, step, page, lang]);

  // ---------------- 畫布：點一下新增積木 ----------------
  const clickCanvas = () => {
    const t = toolRef.current;
    const d = currentDiagram();
    if (page != 2 || t == 'none' || isArrowTool(t) || d.pause) return;
    syncVarList();
    d.pause = true;
    const { x, y } = myMouse.current;
    openDialog({
      kind: t as DialogRequest['kind'],
      canReturn: returnsIn(d),
      params: moduleOf(d)?.info.params,
      onYes: f => addMainNode(t, d, storeFor(d), f, x, y, moduleInfos()),
      onNo: () => { d.pause = false; },
    });
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
      vars: varsRef.current.map(v => [v.name, v.type, v.init, v.desc]),
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
  });

  const hasWork = () => {
    const w = collectWork();
    return w.variables.length > 0 || w.flowchart.nodes.length > 0 || (w.modules?.length ?? 0) > 0
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
    setVars(work.variables.map(v => ({
      id: ++varSeq,
      name: String(v.name ?? ''),
      type: v.type == '文字' || v.type == '清單' || v.type == '二維清單' ? v.type : '數字',
      init: String(v.init ?? '0'),
      desc: String(v.desc ?? ''),
    })));
    // 先清空舊的變數清單，不然會被當成「改名」而去改到流程圖裡的字
    varStore.var_list.name = [];
    syncVarList();
    main.loadData(work.flowchart);
    sheetRef.current = 0;
    replaceModules((work.modules ?? []).map(m => ({
      info: {
        name: String(m.name ?? ''),
        params: (m.params ?? []).map(p => ({ name: String(p.name ?? ''), type: p.type == '文字' ? '文字' : '數字' })),
        ...(m.returns == '數字' || m.returns == '文字' ? { returns: m.returns } : {}),
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
    >
      <img className="toolbox_img" src={`./libs/icon/${t.icon}.png`} alt={t.name()} />
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
        {/* 目前的學習目標（清單從 1 還是 0 開始）；要換請回首頁 */}
        <span className="target_badge" title={t('要更換請回到首頁', 'Change it on the home page')}>{targetName(getTarget())}</span>
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

      <NodeDialog request={dialog} onClose={() => setDialog(null)} varTypes={varStore.type_var_list} modules={modules.map(m => m.info)} />
      <ModuleDialog request={moduleDialog} onClose={() => setModuleDialog(null)} />
      <CodeView
        open={codeOpen} onClose={() => setCodeOpen(false)} diagram={main} modules={moduleSources} onApply={applyBlocks}
        vars={() => varsRef.current.filter(v => v.name.trim() != '').map(v => ({ name: v.name.trim(), type: v.type, init: v.init }))}
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
                onChange={(id, patch) => setVars(varsRef.current.map(v => v.id == id ? { ...v, ...patch } : v))}
                onCommit={syncVarList}
                onDelete={id => { setVars(varsRef.current.filter(v => v.id != id)); syncVarList(); }}
                onCreate={() => createRow()}
                module={(() => {
                  const m = moduleOf2(sheet);
                  return m && { name: m.info.name, params: m.info.params, onEdit: () => editModule(m) };
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
                    {m.info.params.length > 0 && <>（{t('參數：', 'parameters: ')}{m.info.params.map(p => `${p.name}${p.type == '文字' ? t('［文字］', ' [text]') : ''}`).join('、')}）</>}
                    {m.info.returns && <>{t('，回傳', ', returns ')}{m.info.returns == '文字' ? t('文字', 'text') : t('數字', 'a number')}</>}
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
                <canvas id="my_canvas" ref={myCanvasRef} onClick={clickCanvas}></canvas>
              </div>
            </div>
          </div>
        </div>

        <RunArea
          visible={page == 3}
          canvasRef={showCanvasRef}
          run={run}
          error={runError?.message ?? null}
          partial={run != null && runError != null}
          step={step}
          onStep={setStep}
          which={which}
          onWhich={n => { setWhich(n); runCase(n); }}
          cases={cases}
          varNames={varStore.var_list.name}
          sheetName={modules.length ? runSheetName : ''}
          callerName={caller ? sheetLabel(splitId(caller.id).sheet) + (caller.depth > 1 ? t(`（第 ${caller.depth} 層）`, ` (level ${caller.depth})`) : '') : null}
          callerCanvasRef={callerCanvasRef}
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
