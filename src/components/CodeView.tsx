// 「看程式」：把目前的流程圖轉成程式給學生看（只能看、不能改）。
// 學習目標是積木 → 畫成積木，可以切換 Scratch / Blockly 兩種外觀（跟全國賽練習網頁 individual_demo 一樣）；
// 是 C++ → 顯示 C++ 程式碼，可以複製。
import { useEffect, useRef, useState } from 'react';
import type { Diagram } from '../engine/diagram';
import { FlowError } from '../engine/decoder';
import { BlockError, fromBlockly, type FromBlocks } from '../engine/fromBlockly';
import { applyBlocklyMessages, blocklyToolbox, defineBlocks, scratchToolbox, setupScratchEditing } from '../engine/scratchBlocks';
import { ScratchProcDialog } from './ScratchProcDialog';
import { cppNameProblem, GLOBAL_PREFIX, type ParamInfo } from '../engine/modules';
import type { ModuleSource } from '../engine/modules';
import { isCppOnlyType, structure, structureModules, type ModuleProgram, type Stmt, type VarInfo } from '../engine/structure';
import { blocklyLoadError, toBlockly, type BlockMode } from '../engine/toBlockly';
import { toCpp } from '../engine/toCpp';
import { getLang, t, useLang } from '../i18n';
import { getTarget, targetName } from '../target';

// Blockly 只有打開「看程式」時才從 CDN 載入（不放進打包檔，網站一開始比較快）；版本跟練習網頁一樣。
// 用 Blockly 官方的 <script> 檔（掛在全域的 window.Blockly），不用 jsDelivr 的 +esm：
// +esm 打包的內建積木（blocks）自己帶了一份 Blockly 核心，註冊到別的地方，載入 variables_set 等內建積木會失敗。
const BLOCKLY = 'https://cdn.jsdelivr.net/npm/blockly@11.2.1';
type BlocklyModule = any;
interface Loaded {
  Blockly: BlocklyModule;
  themes: { scratch: unknown; blockly: unknown };
}
let blocklyPromise: Promise<Loaded> | null = null;

/** 載入一個 <script>，載完才繼續 */
function loadScript(src: string) {
  return new Promise<void>((resolve, reject) => {
    const el = document.createElement('script');
    el.src = src;
    el.onload = () => resolve();
    el.onerror = () => {
      el.remove();
      reject(new Error(t(`下載失敗：${src}`, `Could not download ${src}`)));
    };
    document.head.appendChild(el);
  });
}

/** 現在載入的是哪一種語言的積木文字（Blockly.Msg） */
let msgLang: string | null = null;

function loadBlockly(): Promise<Loaded> {
  blocklyPromise ??= (async () => {
    const w = window as unknown as { Blockly?: BlocklyModule };
    if (!w.Blockly) {
      // 順序不能換：核心 → 內建積木 → 積木上的字（核心本身不含英文字）
      await loadScript(`${BLOCKLY}/blockly_compressed.js`);
      await loadScript(`${BLOCKLY}/blocks_compressed.js`);
    }
    const Blockly = w.Blockly;
    return { Blockly, themes: defineBlocks(Blockly) };
  })();
  blocklyPromise.catch(() => { blocklyPromise = null; });
  // 積木上的字跟著網頁的語言：換了語言就重新載入那個語言的字（中文 ↔ 英文會互相蓋掉）
  return blocklyPromise.then(async loaded => {
    const lang = getLang() == 'en' ? 'en' : 'zh-hant';
    if (msgLang != lang) {
      await loadScript(`${BLOCKLY}/msg/${lang}.js`);
      msgLang = lang;
      applyBlocklyMessages(loaded.Blockly, lang == 'zh-hant');
    }
    return loaded;
  });
}

const BLOCKLY_LAYER = 'blockly_layer';

interface Props {
  open: boolean;
  onClose: () => void;
  diagram: Diagram;
  /** 變數表（沒填名稱的列不算） */
  vars: () => VarInfo[];
  /** 模組（名稱、參數、各自的流程圖） */
  modules: () => ModuleSource[];
  /** 積木改好、按「套用到流程圖」：用積木重畫流程圖、更新變數表 */
  onApply: (result: FromBlocks) => void;
}

export function CodeView({ open, onClose, diagram, vars, modules, onApply }: Props) {
  useLang();
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = ref.current!;
    if (open && !dialog.open) {
      // 每次打開都從畫面中間開始（上次拖到哪裡、拉多大都不留）
      dialog.style.left = dialog.style.top = dialog.style.margin = dialog.style.width = dialog.style.height = '';
      dialog.showModal();
    }
    if (!open && dialog.open) dialog.close();
  }, [open]);

  /** 拖曳標題列移動視窗：學生可以把程式移到旁邊，對照流程圖看 */
  const startDrag = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button != 0 || (e.target as HTMLElement).closest('button')) return;
    const dialog = ref.current!;
    const head = e.currentTarget;
    const box = dialog.getBoundingClientRect();
    const dx = e.clientX - box.left, dy = e.clientY - box.top;
    // 改成用 left / top 決定位置（原本是置中的 margin: auto）
    dialog.style.margin = '0';
    dialog.style.left = box.left + 'px';
    dialog.style.top = box.top + 'px';
    head.setPointerCapture(e.pointerId);
    const move = (ev: PointerEvent) => {
      // 標題列至少留一點在畫面裡，才拉得回來
      const x = Math.min(Math.max(ev.clientX - dx, 80 - box.width), window.innerWidth - 80);
      const y = Math.min(Math.max(ev.clientY - dy, 0), window.innerHeight - 40);
      dialog.style.left = x + 'px';
      dialog.style.top = y + 'px';
    };
    const up = () => {
      head.removeEventListener('pointermove', move);
      head.removeEventListener('pointerup', up);
      head.removeEventListener('pointercancel', up);
    };
    head.addEventListener('pointermove', move);
    head.addEventListener('pointerup', up);
    head.addEventListener('pointercancel', up);
  };

  const target = getTarget();
  return (
    <dialog id="code_view" ref={ref} onCancel={onClose}>
      <div className="code_view_head" onPointerDown={startDrag} title={t('拖曳這裡可以移動視窗；右下角可以拉大縮小', 'Drag here to move. Drag the bottom-right corner to resize.')}>
        <h5 className="card_title" style={{ margin: 0 }}>
          {t('看程式', 'See the code')}<span className="target_badge">{targetName(target)}</span>
        </h5>
        <span className="muted">
          {target == 'cpp' ? t('流程圖變成程式的樣子（只能看，不能改）', 'Your flowchart as code (read only)') : t('流程圖變成積木的樣子', 'Your flowchart as blocks')}
        </span>
        <button onClick={onClose}>{t('關閉', 'Close')}</button>
      </div>
      {open && (target == 'cpp'
        ? <CppCode diagram={diagram} vars={vars()} modules={modules()} />
        : <BlocklyCode mode={target} diagram={diagram} vars={vars()} modules={modules()} onApply={onApply} />)}
      {/* Blockly 的輸入框、下拉選單放這裡：蓋滿整個畫面、不擋滑鼠（見 .blockly_layer） */}
      <div id={BLOCKLY_LAYER} className="blockly_layer" />
    </dialog>
  );
}

/** 模組裡有改參數值的地方：回傳「模組名稱」「參數名稱」（Scratch 的參數不能改，轉積木時要說明） */
function changedParam(mods: ModuleProgram[]): { module: string; param: string } | null {
  for (const m of mods) {
    const names = new Set(m.params.map(p => p.name));
    const find = (list: Stmt[]): string | null => {
      for (const s of list) {
        if (s.kind == 'input' && s.place == 'var' && names.has(s.target)) return s.target;
        if (s.kind == 'rect' && s.action == '設為' && s.index == undefined && names.has(s.target)) return s.target;
        const inner = s.kind == 'if' ? find(s.yes) ?? find(s.no) : s.kind == 'repeat' || s.kind == 'until' ? find(s.body) : null;
        if (inner) return inner;
      }
      return null;
    };
    const param = find(m.body);
    if (param) return { module: m.name, param };
  }
  return null;
}

/** 流程圖 → 結構；接得不完整時回傳錯誤說明 */
function programOf(diagram: Diagram, modules: ModuleSource[]) {
  try {
    return { program: structure(diagram), modules: structureModules(modules), error: null };
  }
  catch (e) {
    return { program: null, modules: [], error: e instanceof FlowError ? e.message : String(e) };
  }
}

function CppCode({ diagram, vars, modules }: { diagram: Diagram; vars: VarInfo[]; modules: ModuleSource[] }) {
  const { program, modules: mods, error } = programOf(diagram, modules);
  const [copied, setCopied] = useState(false);
  if (!program) return <p className="run_error">{error}</p>;
  const code = toCpp(program, vars, mods);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    }
    catch {
      alert(t('瀏覽器不允許複製，請自己選取程式碼再按 Ctrl+C。', 'The browser blocked copying. Select the code and press Ctrl+C.'));
    }
  };
  // C++ 的名稱只能用英文（第三步改名時會擋；這裡提醒還留著中文名稱的舊作品）
  const badNames = [...vars.map(v => v.name), ...mods.flatMap(m => [m.name, ...m.params.map(p => p.name), ...(m.locals ?? []).map(v => v.name.trim()).filter(Boolean)])]
    .filter(n => cppNameProblem(n));
  return (
    <div className="code_view_body">
      {badNames.length > 0 && (
        <p className="run_error code_name_warning">
          {t(`這些名稱 C++ 不能用：${badNames.join('、')}。C++ 的名稱只能用英文字母、數字和底線，請到第三步改名字（流程圖裡用到的地方會跟著改）。`, `C++ cannot use these names: ${badNames.join(', ')}. Use English letters, numbers and _ only. Rename them in step 3.`)}
        </p>
      )}
      <div className="code_cpp_wrap">
        <button className="code_copy" onClick={copy}>{copied ? t('已複製', 'Copied') : t('複製', 'Copy')}</button>
        <pre className="code_cpp"><code>{code}</code></pre>
      </div>
    </div>
  );
}

/** 流程圖還沒接完整時，編輯模式從空的開始（Scratch 只放一個「當綠旗被點擊」） */
const emptyBlocks = (mode: BlockMode) => ({
  blocks: { languageVersion: 0, blocks: mode == 'scratch' ? [{ type: 'event_whenflagclicked', x: 20, y: 20 }] : [] },
});

/** 積木：學習目標是 Scratch 就只畫 Scratch，是 Blockly 就只畫 Blockly（兩種能做的事不一樣，例如回傳值） */
function BlocklyCode({ mode, diagram, vars, modules, onApply }: { mode: BlockMode; diagram: Diagram; vars: VarInfo[]; modules: ModuleSource[]; onApply: (result: FromBlocks) => void }) {
  const lang = useLang();
  const { program, modules: mods, error } = programOf(diagram, modules);
  const infos = modules.map(m => m.info);
  const boxRef = useRef<HTMLDivElement>(null);
  /** 出錯的說明：下載不到 Blockly，或積木畫不出來（附上原因，才知道要修哪裡） */
  const [loadError, setLoadError] = useState<string | null>(null);
  /** 編輯模式：可以拖積木修改，改好按「套用到流程圖」 */
  const [editing, setEditing] = useState(false);
  /** 套用時積木有問題的說明 */
  const [applyError, setApplyError] = useState<string | null>(null);
  const live = useRef<{ Blockly: BlocklyModule; workspace: BlocklyModule; theme: BlocklyModule } | null>(null);
  /** 「建立函式」的視窗開著時：已經有的函式名稱、按確定要做的事 */
  const [procDialog, setProcDialog] = useState<{ existing: string[]; add: (name: string, params: ParamInfo[]) => void } | null>(null);
  const json = program ? JSON.stringify(toBlockly(program, vars, mode, mods)) : editing ? JSON.stringify(emptyBlocks(mode)) : null;

  useEffect(() => {
    if (!json) return;
    let workspace: BlocklyModule = null;
    let cancelled = false;
    setLoadError(null);
    setApplyError(null);
    loadBlockly().then(({ Blockly, themes }) => {
      if (cancelled || !boxRef.current) return;
      try {
        // 下拉選單、輸入框要放在視窗（dialog）裡面，不然會被視窗蓋住看不到；
        // 但 Blockly 用整個畫面的座標擺它們，所以放在蓋滿畫面的那一層（直接放 dialog 裡會偏掉 dialog 的位置）。
        // Blockly 只在第一次 inject 前設定有效，之後都是同一層
        Blockly.setParentContainer(document.getElementById(BLOCKLY_LAYER) ?? document.body);
        const zh = getLang() != 'en';
        workspace = Blockly.inject(boxRef.current, {
          // 看的時候 readOnly：不能拖積木、沒有工具箱；編輯時才有工具箱和垃圾桶
          readOnly: !editing,
          ...(editing ? { toolbox: mode == 'scratch' ? scratchToolbox() : blocklyToolbox(zh), trashcan: true } : {}),
          renderer: mode == 'scratch' ? 'zelos' : 'geras',
          theme: mode == 'scratch' ? themes.scratch : themes.blockly,
          move: { scrollbars: true, drag: true, wheel: true },
          zoom: { controls: true, startScale: 0.8 },
        });
        if (editing && mode == 'scratch') setupScratchEditing(Blockly, workspace, (existing, add) => setProcDialog({ existing, add }));
        Blockly.serialization.workspaces.load(JSON.parse(json), workspace);
        // 有模組（好幾串積木）時排整齊，不然寬的積木會疊在一起
        if (workspace.getTopBlocks(false).length > 1) workspace.cleanUp();
        live.current = { Blockly, workspace, theme: mode == 'scratch' ? themes.scratch : themes.blockly };
      }
      catch (e) {
        console.error(e);
        setLoadError(t('積木畫不出來：', 'Could not draw the blocks: ') + (e instanceof Error ? e.message : String(e)));
      }
    }, e => {
      console.error(e);
      setLoadError(blocklyLoadError() + (e instanceof Error ? `（${e.message}）` : ''));
    });
    return () => {
      cancelled = true;
      live.current = null;
      workspace?.dispose();
    };
    // 換語言時重畫（積木上的字跟著換）；正在編輯時不重畫，不然還沒套用的積木會不見
  }, [json, mode, editing, editing ? null : lang]);

  const stopEditing = () => setEditing(false);

  /** 改好的積木 → 流程圖 */
  const apply = () => {
    const ws = live.current;
    if (!ws) return;
    try {
      const result = fromBlockly(ws.Blockly.serialization.workspaces.save(ws.workspace), mode, vars, infos);
      setApplyError(null);
      if (!confirm(t('目前的流程圖會被換成這些積木畫出來的流程圖，確定嗎？', 'Your flowchart will be replaced by one made from these blocks. Continue?'))) return;
      onApply(result);
    }
    catch (e) {
      if (!(e instanceof BlockError)) throw e;
      setApplyError(e.message);
    }
  };

  // 二維清單、array、stack、queue 只有 C++ 有（Scratch 沒有），積木畫不出來
  if (vars.some(v => isCppOnlyType(v.type))) {
    return <p className="run_error">{t('Scratch / Blockly 沒有二維清單、array、stack、queue：用到這些的流程圖，請把學習目標換成 C++ 再看程式。', 'Scratch / Blockly have no 2D lists, arrays, stacks or queues. To see this flowchart as code, change the learning goal to C++.')}</p>;
  }
  // 「主流程的a」只有 Scratch 分得出來（Blockly 的參數跟同名變數是同一個）
  const withGlobalRef = mode == 'blockly' && modules.find(m => m.diagram.nodes.some(n => n?.text.includes(GLOBAL_PREFIX)));
  if (withGlobalRef) {
    return <p className="run_error">{t(`模組「${withGlobalRef.info.name}」裡用了「${GLOBAL_PREFIX}…」：Blockly 的參數跟同名的變數是同一個，分不出來。請把參數或變數改一個名字。`, `The module "${withGlobalRef.info.name}" uses "${GLOBAL_PREFIX}…". In Blockly a parameter and a variable with the same name are the same thing. Rename one of them.`)}</p>;
  }
  // 區域變數只有 C++ 有
  const withLocals = modules.find(m => (m.info.locals ?? []).some(v => v.name.trim() != ''));
  if (withLocals) {
    return <p className="run_error">{t(`模組「${withLocals.info.name}」有區域變數：Scratch / Blockly 沒有區域變數（在模組裡建的變數也是全域的），請把學習目標換成 C++ 再看程式，或把區域變數改到變數表。`, `The module "${withLocals.info.name}" has local variables. Scratch and Blockly have none, so change the learning goal to C++, or move them to the variable table.`)}</p>;
  }
  // Scratch 的自訂積木不能回傳值
  if (mode == 'scratch' && modules.some(m => m.info.returns)) {
    return <p className="run_error">{t('Scratch 的自訂積木不能回傳值：有回傳值的模組，請把學習目標換成 Blockly 或 C++ 再看程式。', 'Scratch My Blocks cannot return a value. To see modules with a return value, change the learning goal to Blockly or C++.')}</p>;
  }
  // Scratch 的自訂積木參數不能改（「變數 設為」只能放變數）
  const changed = mode == 'scratch' ? changedParam(mods) : null;
  if (changed) {
    return <p className="run_error">{t(
      `模組「${changed.module}」裡改了參數「${changed.param}」的值。流程圖可以這樣做，但 Scratch 的自訂積木參數不能改，所以轉不成 Scratch 積木。想看 Scratch 積木：先在變數表新增一個變數，把「${changed.param}」的值存進去，再改那個變數。`,
      `Module "${changed.module}" changes the parameter "${changed.param}". Flowcharts allow this, but Scratch My Block parameters cannot be changed, so it cannot become Scratch blocks. To see Scratch blocks, add a variable, save "${changed.param}" in it, and change the variable instead.`)}</p>;
  }
  if (!program && !editing) {
    return (
      <>
        <p className="run_error">{error}</p>
        <p><button className="code_edit" onClick={() => setEditing(true)}>{t('改用積木寫', 'Write with blocks')}</button></p>
      </>
    );
  }
  return (
    <>
      <div className="code_toolbar">
        {editing
          ? (
            <>
              <span className="muted">{t('拖拉積木修改，改好後按「套用到流程圖」', 'Drag blocks to change the program, then click "Use for flowchart".')}</span>
              <button className="code_apply" onClick={apply}>{t('套用到流程圖', 'Use for flowchart')}</button>
              <button className="code_edit" onClick={stopEditing}>{t('取消', 'Cancel')}</button>
            </>
          )
          : <button className="code_edit" onClick={() => setEditing(true)}>{t('編輯積木', 'Edit blocks')}</button>}
      </div>
      {applyError && <p className="run_error">{applyError}</p>}
      {loadError && <p className="run_error">{loadError}</p>}
      {/* 換外觀、進出編輯時整個重建，Blockly 才不會留著上一個工作區 */}
      <div key={mode + editing} className="code_blockly" ref={boxRef} style={loadError ? { display: 'none' } : undefined} />
      {procDialog && live.current && (
        <ScratchProcDialog
          Blockly={live.current.Blockly} theme={live.current.theme} existing={procDialog.existing}
          onConfirm={(name, params) => { procDialog.add(name, params); setProcDialog(null); }}
          onCancel={() => setProcDialog(null)}
        />
      )}
    </>
  );
}
