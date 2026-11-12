// 「看程式」：把目前的流程圖轉成程式給學生看（只能看、不能改）。
// 學習目標是積木 → 畫成積木，可以切換 Scratch / Blockly 兩種外觀（跟全國賽練習網頁 individual_demo 一樣）；
// 是 C++ → 顯示 C++ 程式碼，可以複製。
import { useEffect, useRef, useState } from 'react';
import type { Diagram } from '../engine/diagram';
import { FlowError } from '../engine/decoder';
import { BlockError, fromBlockly, type FromBlocks } from '../engine/fromBlockly';
import { blocklyToolbox, defineBlocks, scratchToolbox, setupScratchEditing } from '../engine/scratchBlocks';
import type { ModuleSource } from '../engine/modules';
import { structure, structureModules, type ModuleProgram, type Stmt, type VarInfo } from '../engine/structure';
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

function loadBlockly(): Promise<Loaded> {
  blocklyPromise ??= (async () => {
    const w = window as unknown as { Blockly?: BlocklyModule };
    if (!w.Blockly) {
      // 順序不能換：核心 → 內建積木 → 積木上的字（中文或英文；核心本身不含英文字）
      await loadScript(`${BLOCKLY}/blockly_compressed.js`);
      await loadScript(`${BLOCKLY}/blocks_compressed.js`);
      await loadScript(`${BLOCKLY}/msg/${getLang() == 'en' ? 'en' : 'zh-hant'}.js`);
    }
    const Blockly = w.Blockly;
    return { Blockly, themes: defineBlocks(Blockly, getLang() != 'en') };
  })();
  blocklyPromise.catch(() => { blocklyPromise = null; });
  return blocklyPromise;
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
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  const target = getTarget();
  return (
    <dialog id="code_view" ref={ref} onCancel={onClose}>
      <div className="code_view_head">
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
  return (
    <div className="code_view_body">
      <button className="code_copy" onClick={copy}>{copied ? t('已複製', 'Copied') : t('複製', 'Copy')}</button>
      <pre className="code_cpp"><code>{code}</code></pre>
    </div>
  );
}

/** 流程圖還沒接完整時，編輯模式從空的開始（Scratch 只放一個「當綠旗被點擊」） */
const emptyBlocks = (mode: BlockMode) => ({
  blocks: { languageVersion: 0, blocks: mode == 'scratch' ? [{ type: 'event_whenflagclicked', x: 20, y: 20 }] : [] },
});

/** 積木：學習目標是 Scratch 就只畫 Scratch，是 Blockly 就只畫 Blockly（兩種能做的事不一樣，例如回傳值） */
function BlocklyCode({ mode, diagram, vars, modules, onApply }: { mode: BlockMode; diagram: Diagram; vars: VarInfo[]; modules: ModuleSource[]; onApply: (result: FromBlocks) => void }) {
  const { program, modules: mods, error } = programOf(diagram, modules);
  const infos = modules.map(m => m.info);
  const boxRef = useRef<HTMLDivElement>(null);
  /** 出錯的說明：下載不到 Blockly，或積木畫不出來（附上原因，才知道要修哪裡） */
  const [loadError, setLoadError] = useState<string | null>(null);
  /** 編輯模式：可以拖積木修改，改好按「套用到流程圖」 */
  const [editing, setEditing] = useState(false);
  /** 套用時積木有問題的說明 */
  const [applyError, setApplyError] = useState<string | null>(null);
  const live = useRef<{ Blockly: BlocklyModule; workspace: BlocklyModule } | null>(null);
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
        if (editing && mode == 'scratch') setupScratchEditing(Blockly, workspace);
        Blockly.serialization.workspaces.load(JSON.parse(json), workspace);
        // 有模組（好幾串積木）時排整齊，不然寬的積木會疊在一起
        if (workspace.getTopBlocks(false).length > 1) workspace.cleanUp();
        live.current = { Blockly, workspace };
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
  }, [json, mode, editing]);

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

  // 二維清單只有 C++ 有（Scratch 沒有），積木畫不出來
  if (vars.some(v => v.type == '二維清單')) {
    return <p className="run_error">{t('Scratch / Blockly 沒有二維清單：用到二維清單的流程圖，請把學習目標換成 C++ 再看程式。', 'Scratch / Blockly have no 2D lists. To see this flowchart as code, change the learning goal to C++.')}</p>;
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
    </>
  );
}
