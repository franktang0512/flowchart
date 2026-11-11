// 「看程式」：把目前的流程圖轉成程式給學生看（只能看、不能改）。
// 學習目標是積木 → 畫成積木，可以切換 Scratch / Blockly 兩種外觀（跟全國賽練習網頁 individual_demo 一樣）；
// 是 C++ → 顯示 C++ 程式碼，可以複製。
import { useEffect, useRef, useState } from 'react';
import type { Diagram } from '../engine/diagram';
import { FlowError } from '../engine/decoder';
import { defineBlocks } from '../engine/scratchBlocks';
import { structure, type VarInfo } from '../engine/structure';
import { blocklyLoadError, toBlockly, type BlockMode } from '../engine/toBlockly';
import { toCpp } from '../engine/toCpp';
import { getLang, t, useLang } from '../i18n';
import { getTarget, targetName } from '../target';

// Blockly 只有打開「看程式」時才從 CDN 載入（不放進打包檔，網站一開始比較快）；版本跟練習網頁一樣
const BLOCKLY = 'https://cdn.jsdelivr.net/npm/blockly@11.2.1';
type BlocklyModule = any;
interface Loaded {
  Blockly: BlocklyModule;
  themes: { scratch: unknown; blockly: unknown };
}
let blocklyPromise: Promise<Loaded> | null = null;

/** 依序試幾個網址，第一個載得到的就用 */
async function importFirst(urls: string[]) {
  for (const url of urls) {
    try {
      return await import(/* @vite-ignore */ url);
    }
    catch {
      // 試下一個
    }
  }
  return null;
}

function loadBlockly(): Promise<Loaded> {
  blocklyPromise ??= (async () => {
    const mod = await import(/* @vite-ignore */ `${BLOCKLY}/+esm`);
    const Blockly = mod.default ?? mod;
    let zh = null;
    if (getLang() != 'en') {
      // Blockly 內建積木的字用繁體中文；載入失敗就維持英文（Scratch 積木本來就是中文）
      zh = await importFirst([`${BLOCKLY}/msg/zh-hant/+esm`, `${BLOCKLY}/msg/zh-hant.js/+esm`]);
      if (zh) Blockly.setLocale(zh.default ?? zh);
    }
    return { Blockly, themes: defineBlocks(Blockly, zh != null) };
  })();
  blocklyPromise.catch(() => { blocklyPromise = null; });
  return blocklyPromise;
}

const BLOCK_MODES: [BlockMode, string][] = [['scratch', 'Scratch'], ['blockly', 'Blockly']];
const MODE_KEY = 'flowchart-block-mode';

interface Props {
  open: boolean;
  onClose: () => void;
  diagram: Diagram;
  /** 變數表（沒填名稱的列不算） */
  vars: () => VarInfo[];
}

export function CodeView({ open, onClose, diagram, vars }: Props) {
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
        <span className="muted">{t('流程圖變成程式的樣子（只能看，不能改）', 'Your flowchart as code (read only)')}</span>
        <button onClick={onClose}>{t('關閉', 'Close')}</button>
      </div>
      {open && (target == 'cpp' ? <CppCode diagram={diagram} vars={vars()} /> : <BlocklyCode diagram={diagram} vars={vars()} />)}
    </dialog>
  );
}

/** 流程圖 → 結構；接得不完整時回傳錯誤說明 */
function programOf(diagram: Diagram) {
  try {
    return { program: structure(diagram), error: null };
  }
  catch (e) {
    return { program: null, error: e instanceof FlowError ? e.message : String(e) };
  }
}

function CppCode({ diagram, vars }: { diagram: Diagram; vars: VarInfo[] }) {
  const { program, error } = programOf(diagram);
  const [copied, setCopied] = useState(false);
  if (!program) return <p className="run_error">{error}</p>;
  const code = toCpp(program, vars);
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

function BlocklyCode({ diagram, vars }: { diagram: Diagram; vars: VarInfo[] }) {
  const { program, error } = programOf(diagram);
  const boxRef = useRef<HTMLDivElement>(null);
  const [loadError, setLoadError] = useState(false);
  const [mode, setMode] = useState<BlockMode>(() => {
    try {
      return localStorage.getItem(MODE_KEY) == 'blockly' ? 'blockly' : 'scratch';
    }
    catch {
      return 'scratch';
    }
  });
  const json = program ? JSON.stringify(toBlockly(program, vars, mode)) : null;

  const pick = (m: BlockMode) => {
    setMode(m);
    try {
      localStorage.setItem(MODE_KEY, m);
    }
    catch {
      // 記不住也沒關係
    }
  };

  useEffect(() => {
    if (!json) return;
    let workspace: { dispose(): void } | null = null;
    let cancelled = false;
    loadBlockly().then(({ Blockly, themes }) => {
      if (cancelled || !boxRef.current) return;
      // 只能看：readOnly 不能拖積木、沒有工具箱；可以拖動畫面、放大縮小
      workspace = Blockly.inject(boxRef.current, {
        readOnly: true,
        renderer: mode == 'scratch' ? 'zelos' : 'geras',
        theme: mode == 'scratch' ? themes.scratch : themes.blockly,
        move: { scrollbars: true, drag: true, wheel: true },
        zoom: { controls: true, startScale: 0.8 },
      });
      Blockly.serialization.workspaces.load(JSON.parse(json), workspace);
    }).catch(() => setLoadError(true));
    return () => {
      cancelled = true;
      workspace?.dispose();
    };
  }, [json, mode]);

  if (!program) return <p className="run_error">{error}</p>;
  if (loadError) return <p className="run_error">{blocklyLoadError()}</p>;
  return (
    <>
      <div className="lang_toggle code_mode" role="group" aria-label={t('積木的樣子', 'Block style')}>
        {BLOCK_MODES.map(([m, name]) => (
          <button key={m} className={mode == m ? 'selected' : ''} aria-pressed={mode == m} onClick={() => pick(m)}>{name}</button>
        ))}
      </div>
      {/* 換外觀時整個重建，Blockly 才不會留著上一個工作區 */}
      <div key={mode} className="code_blockly" ref={boxRef} />
    </>
  );
}
