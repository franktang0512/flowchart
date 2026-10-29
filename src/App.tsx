// 學習單主畫面：四個步驟
//   第一步 讀懂題目、第二步 想測資：同一個畫面，還不能做的那張卡片蓋上半透明灰色
//   第三步 定義變數、設計流程：左邊變數＋題目，右邊流程圖畫布
//   第四步 測試執行並除錯：逐步執行流程圖
import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { NodeDialog, type DialogRequest } from './components/NodeDialog';
import { PrintView, type PrintData } from './components/PrintView';
import { QuestionPanel } from './components/QuestionPanel';
import { RunArea } from './components/RunArea';
import { VarTable, type VarRow } from './components/VarTable';
import { connectorState } from './engine/connector';
import { buildRun, createVarStore, FlowError, type RunResult } from './engine/decoder';
import { canvasPoint, Diagram, type DiagramHooks } from './engine/diagram';
import { addMainNode, editDialogFor, editMainNode } from './nodeActions';
import { EMPTY_QUESTION, loadQuestion, questionIn, type Question } from './questions';
import { fitRowOnInput } from './textareaSizing';
import { LangToggle } from './components/LangToggle';
import { getLang, link, onLangChange, t, useLang } from './i18n';
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
];
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
  const [printing, setPrinting] = useState(false);
  const [printData, setPrintData] = useState<PrintData | null>(null);
  const [printImg, setPrintImg] = useState<string>();
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
  const [main] = useState(() => new Diagram({
    askLinkLabel: kind => new Promise(resolve => openDialog({
      kind,
      onYes: f => { resolve(f.radio); return true; },
      onNo: () => resolve(null),
      onDismiss: () => resolve(null),
    })),
    editNode: (d, i) => editNodeRef.current(d, i),
    selectedTool: () => toolRef.current,
  }));
  // 開發模式下給自動化測試讀積木位置
  if (import.meta.env.DEV) Object.assign(window, { __flowchart: { main } });

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

    const replaced = oldNames.filter(n => !varStore.var_list.name.includes(n));
    const added = varStore.var_list.name.filter(n => !oldNames.includes(n));
    if (replaced.length && added.length) {
      for (const node of main.nodes) {
        if (node?.variables?.includes(replaced[0])) {
          node.variables = node.variables.map(v => v == replaced[0] ? added[0] : v);
          node.text = node.text.replaceAll(replaced[0], added[0]);
          main.fitNode(node);
        }
      }
      main.draw();
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
      onYes: f => editMainNode(node, d, varStore, f),
      onNo: () => { d.pause = false; },
    });
  };

  // ---------------- 語言切換 ----------------
  const lang = useLang();
  useEffect(() => onLangChange(() => {
    main.nodes.forEach(n => { if (n) main.fitNode(n); });
    main.draw();
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
      if (!main.pause && inside) myMouse.current = canvasPoint(canvas, event);
      if (!inside) main.copyNode = null;
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
      result = buildRun(main, varStore, cases[n * 3]);
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
    main.pause = false;
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
    main.selNode = null;
    main.selLink = null;
    if (page == 3) {
      main.init(showCanvasRef.current!);
      runCase(which);
    }
    else {
      main.stepHighlight = null;
      main.init(myCanvasRef.current!);
      main.draw();
      setRun(null);
      setRunError(null);
      syncVarList();
    }
  }, [page, pageNonce]);

  // 逐步執行：標出目前執行到的積木
  useLayoutEffect(() => {
    if (page != 3) return;
    // 執行成功：標出目前這一步；失敗：標出有問題的積木
    // 執行到一半出錯時，最後一步標出出錯的積木
    const errorStep = runError && (!run || step == run.totalStep);
    main.stepHighlight = errorStep && runError.node != null ? runError.node : run ? run.step[step] ?? null : null;
    main.draw();
  }, [run, runError, step, page]);

  // ---------------- 畫布：點一下新增積木 ----------------
  const clickCanvas = () => {
    const t = toolRef.current;
    if (page != 2 || t == 'none' || isArrowTool(t) || main.pause) return;
    syncVarList();
    main.pause = true;
    const { x, y } = myMouse.current;
    openDialog({
      kind: t as DialogRequest['kind'],
      onYes: f => addMainNode(t, main, varStore, f, x, y),
      onNo: () => { main.pause = false; },
    });
  };

  const clickTool = (id: string) => {
    const next = id == tool ? 'none' : id;
    setTool(next);
    connectorState.r = isArrowTool(next) ? 7 : 0;
    main.draw();
  };

  const clickClear = () => openDialog({
    kind: 'clear',
    onYes: () => {
      main.clear();
      main.init(myCanvasRef.current!);
      main.draw();
      return true;
    },
  });

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
  });

  const hasWork = () => {
    const w = collectWork();
    return w.variables.length > 0 || w.flowchart.nodes.length > 0
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
      type: v.type == '文字' || v.type == '清單' ? v.type : '數字',
      init: String(v.init ?? '0'),
      desc: String(v.desc ?? ''),
    })));
    // 先清空舊的變數清單，不然會被當成「改名」而去改到流程圖裡的字
    varStore.var_list.name = [];
    syncVarList();
    main.loadData(work.flowchart);
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

      <NodeDialog request={dialog} onClose={() => setDialog(null)} />

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
              <span className="canvas_hint" />
              <button id="clear_canvas" onClick={clickClear}>{t('清空流程圖', 'Clear all')}</button>
            </div>
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
        />
      </div>

      <PrintView visible={printing} data={printData} imgSrc={printImg} />

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
