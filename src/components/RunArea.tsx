// 第四步：逐步執行流程圖，看每一步的變數與輸出
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { RunResult } from '../engine/decoder';
import { t, useLang } from '../i18n';
import { indexBase } from '../target';

/** 第四步的一張流程圖：主流程、一層一層執行進來的模組，最後一張是正在執行的 */
export interface RunPane {
  key: string;
  title: string;
  /** 正在執行的那一張（其他張標出「執行模組」的積木） */
  running: boolean;
  /** 畫到這張畫布上（只是畫，不能改） */
  draw: (canvas: HTMLCanvasElement) => void;
}

interface Props {
  visible: boolean;
  panes: RunPane[];
  run: RunResult | null;
  /** 流程圖沒辦法執行的原因 */
  error: string | null;
  /** 執行到一半才出錯（前面的步驟還看得到） */
  partial: boolean;
  step: number;
  onStep: (n: number) => void;
  /** 選第幾組測資（0~2） */
  which: number;
  onWhich: (n: number) => void;
  /** 學生在第二步填的測資：[輸入, 輸出, 測試重點] × 3 */
  cases: string[];
  varNames: string[];
  /** 有模組時：畫布上現在是哪一張流程圖（主流程或某個模組） */
  sheetName: string;
  /** 每個模組（sheet 是第幾張流程圖）和它的參數、區域變數名稱：第四步每個模組分開列出來 */
  moduleVars: { sheet: number; name: string; names: string[] }[];
}

/** 執行到模組裡時，每一層的參數和區域變數（decoder 的 Update_output 記下來的） */
interface Frame {
  sheet: number;
  /** 第幾層（從主流程執行進來是第 1 層） */
  depth: number;
  vals: Record<string, unknown>;
}

export function RunArea({ visible, panes, run, error, partial, step, onStep, which, onWhich, cases, varNames, sheetName, moduleVars }: Props) {
  useLang();
  const split = useSplit(panes, visible);
  const total = run?.totalStep ?? 0;
  const output = run?.output[step] ?? '';
  const atEnd = run != null && step == total;
  const expected = cases[which * 3 + 1];
  const correct = atEnd && output.replaceAll(/\s/g, '') == expected.replaceAll(/\s/g, '');
  const values = run?.var[step];
  // 上一步的值：清單跟它比較，才知道這一步改了哪一格
  const prevValues = step > 0 ? run?.var[step - 1] : undefined;
  type Values = Record<string, unknown>;
  // 正在執行的模組（一層一層）：每一層的參數和區域變數
  const frames = (values?.__frames ?? []) as Frame[];
  const prevFrames = (prevValues?.__frames ?? []) as Frame[];
  const running = frames[frames.length - 1];
  /**
   * 一個變數的格子（清單、二維清單畫成表格）。
   * now / before：這一步、上一步的值；kind：主流程的、模組的（參數、區域變數）、模組現在沒有在執行（沒有值）
   */
  const varBox = (name: string, now: Values | undefined, before: Values | undefined, kind: 'main' | 'module' | 'idle' = 'main') => {
    const v = now?.[name];
    const extra = kind == 'module' ? ' is_param' : kind == 'idle' ? ' is_idle' : '';
    const isList = Array.isArray(v);
    const isGrid = isList && v.length > 0 && Array.isArray(v[0]);
    return (
      <div key={name} className={'var_box' + (isList ? ' is_list' : '') + extra}>
        <span className="var_box_name">{name}</span>
        <span className={'var_box_value' + (isList ? ' is_list' : '')}>
          {kind == 'idle' ? '—' : isGrid ? <GridValue rows={v as unknown[][]} prev={before?.[name]} /> : isList ? <ListValue items={v} prev={before?.[name]} /> : String(v)}
        </span>
      </div>
    );
  };
  /** 一個模組的參數和區域變數：沒有在執行時只列名字；遞迴時每一層各一排（最多列最後三層） */
  const moduleSection = (m: Props['moduleVars'][number]) => {
    const own = frames.filter(f => f.sheet == m.sheet);
    const isRunning = running?.sheet == m.sheet;
    const status = isRunning ? t('（正在執行）', ' (running)')
      : own.length ? t('（等裡面執行的模組做完）', ' (waiting for a module it ran)')
      : t('（現在沒有在執行）', ' (not running now)');
    const empty = m.names.length == 0 && <span className="muted">{t('（沒有參數和區域變數）', '(none)')}</span>;
    return (
      <div key={m.sheet} className={'run_module_vars' + (isRunning ? ' is_running' : own.length ? '' : ' is_idle')}>
        <p className="section_label">{t(`模組：${m.name} 的參數和區域變數`, `Module ${m.name}: parameters and local variables`)}<span className="run_module_status">{status}</span></p>
        {own.length == 0 && <div className="var_boxes">{m.names.map(n => varBox(n, undefined, undefined, 'idle'))}{empty}</div>}
        {own.slice(-3).map(f => {
          const before = prevFrames.find(p => p.sheet == f.sheet && p.depth == f.depth)?.vals;
          return (
            <div key={f.depth} className="run_frame">
              {own.length > 1 && <span className="run_frame_depth">{t(`第 ${f.depth} 層`, `Level ${f.depth}`)}</span>}
              <div className="var_boxes">{m.names.map(n => varBox(n, f.vals, before, 'module'))}{empty}</div>
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <div id="run_code_area" className="stage" style={{ display: visible ? undefined : 'none' }}>
      <div className="card canvas_card run_canvas_card">
        <div className="canvas_head">
          <h5 className="card_title" style={{ margin: 0 }}><span className="step_badge">4</span>{t('測試執行並除錯', 'Run and Check')}</h5>
          {sheetName && <span className="run_sheet">{t('現在在', 'Now in')}：{sheetName}</span>}
          <span className="muted run_readonly">{t('這裡只能看；要修改流程圖，請回到第三步。', 'View only. To change the flowchart, go back to step 3.')}</span>
        </div>
        {/* 一層一層執行進來的流程圖並排（左邊是主流程，最右邊是正在執行的）；中間的分隔線可以拖曳調整寬度 */}
        <div className="canvas_body run_split" ref={split.box}>
          {panes.map((p, k) => (
            <div key={p.key} className="run_pane_group" style={{ flex: `${split.weight(k)} 1 0` }}>
              {k > 0 && (
                <div
                  className="run_divider" role="separator" aria-orientation="vertical"
                  title={t('拖曳調整寬度', 'Drag to resize')}
                  onPointerDown={e => split.startDrag(e, k - 1)}
                />
              )}
              <div className={'run_pane' + (p.running ? '' : ' run_caller')}>
                {panes.length > 1 && <span className="run_pane_title">{p.title}</span>}
                <div className="canvas_wrap">
                  <canvas ref={el => { split.canvases.current[k] = el; }}></canvas>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="run_side">
        {error && (
          <div className="card run_error" role="alert">
            <p className="run_error_title">{partial ? t(`執行到第 ${total + 1} 步時出錯了`, `Something went wrong at step ${total + 1}`) : t('流程圖沒辦法執行', 'The flowchart cannot run')}</p>
            <p>{error}</p>
          </div>
        )}
        <div className="card">
          <div className="run_steps">
            <p id="stepCount">{t('步數：', 'Step: ')}{step}</p>
            <span className="muted">/ {total}</span>
            <input
              type="range" id="stepSlider" min="0" max={total} step="1" value={step}
              onChange={e => onStep(Number(e.target.value))}
            />
            <button id="preStep" disabled={step == 0} onClick={() => onStep(step - 1)}>{t('上一步', 'Back')}</button>
            <button id="postStep" disabled={step >= total} onClick={() => onStep(step + 1)}>{t('下一步', 'Next')}</button>
          </div>
        </div>

        <div className="card">
          <p className="section_label" style={{ marginTop: 0 }}>{t('輸出', 'Output')}</p>
          {/* 只是給學生看的輸出畫面；最後一步跟預期輸出一樣變綠色、不一樣變紅色 */}
          <div id="output_area" className={'output_screen' + (atEnd && !error ? (correct ? ' ok' : ' bad') : '')}>{output}</div>
        </div>

        <div className="card">
          <p className="section_label" style={{ marginTop: 0 }}>{t('測試資料', 'Test data')}</p>
          <div className="case_picker">
            {[0, 1, 2].map(i => (
              <label key={i}>
                <input type="radio" name="which_testdata" value={i} checked={which == i} onChange={() => onWhich(i)} />
                {t('測資', 'Test ')}{i + 1}
              </label>
            ))}
          </div>
          <table id="run_case_table" className="data_table">
            <tbody>
              <tr>
                <th style={{ width: '30%' }}>{t('輸入', 'Input')}</th>
                <th style={{ width: '25%' }}>{t('輸出', 'Output')}</th>
                <th>{t('測試重點', 'What it tests')}</th>
              </tr>
              <tr>
                <td style={{ whiteSpace: 'pre-wrap' }}>{cases[which * 3]}</td>
                <td style={{ whiteSpace: 'pre-wrap' }}>{cases[which * 3 + 1]}</td>
                <td style={{ whiteSpace: 'pre-wrap' }}>{cases[which * 3 + 2]}</td>
              </tr>
            </tbody>
          </table>
        </div>

        <div className="card">
          {/* 主流程的變數、每個模組的參數和區域變數分開列（模組沒有在執行時只列名字） */}
          <p className="section_label" style={{ marginTop: 0 }}>{moduleVars.length ? t('主流程的變數', 'Main-flow variables') : t('變數', 'Variables')}</p>
          <div id="variableTable" className="var_boxes">
            {values && varNames.map(name => varBox(name, values, prevValues))}
            {values && varNames.length == 0 && <span className="muted">{t('（沒有變數）', '(none)')}</span>}
          </div>
          {values && moduleVars.map(moduleSection)}
        </div>
      </div>
    </div>
  );
}

/**
 * 這一步改了清單的哪一格：跟上一步比，第一個不一樣的格子（添加、插入、替換、刪除都適用）。
 * 刪掉最後一項時前面都一樣，回傳最後一格；沒有改變回傳 -1。
 */
function changedIndex(items: unknown[], prev: unknown): number {
  if (!Array.isArray(prev)) return -1;
  for (let k = 0; k < items.length; k++) {
    if (k >= prev.length || items[k] !== prev[k]) return k;
  }
  return items.length < prev.length ? items.length - 1 : -1;
}

/** 二維清單的值：畫成表格，上面和左邊標索引（從 0 開始）；這一步改到的格子標出來，太大可以捲動 */
function GridValue({ rows, prev }: { rows: unknown[][]; prev: unknown }) {
  const old = Array.isArray(prev) ? prev as unknown[][] : null;
  // 剛建立（大小變了）就不標；不然標出跟上一步不一樣的格子
  const sameShape = old != null && old.length == rows.length && old.every((r, i) => Array.isArray(r) && r.length == rows[i].length);
  const cols = Math.max(0, ...rows.map(r => r.length));
  return (
    <span className="grid_value">
      <table>
        <thead>
          <tr><th></th>{Array.from({ length: cols }, (_, c) => <th key={c}>{c}</th>)}</tr>
        </thead>
        <tbody>
          {rows.map((row, r) => (
            <tr key={r}>
              <th>{r}</th>
              {row.map((cell, c) => <td key={c} className={sameShape && old![r][c] !== cell ? 'changed' : ''}>{String(cell)}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </span>
  );
}

/** 清單的值：一列排開，每一項標上位置（積木從 1、C++ 從 0 開始）；太長可以左右捲，改到的格子會標出來並捲到看得到的地方 */
function ListValue({ items, prev }: { items: unknown[]; prev: unknown }) {
  const scrollerRef = useRef<HTMLSpanElement>(null);
  const changedRef = useRef<HTMLSpanElement>(null);
  const changed = changedIndex(items, prev);

  useEffect(() => {
    const box = scrollerRef.current;
    const cell = changedRef.current;
    if (!box || !cell) return;
    // 只捲清單這一列（不用 scrollIntoView，才不會連整頁一起捲動）
    const left = cell.offsetLeft;
    const right = left + cell.offsetWidth;
    if (left < box.scrollLeft || right > box.scrollLeft + box.clientWidth) {
      box.scrollTo({ left: left - (box.clientWidth - cell.offsetWidth) / 2, behavior: 'smooth' });
    }
  });

  if (!items.length) return <span className="muted">{t('（空清單）', '(empty list)')}</span>;
  return (
    <span className="list_value" ref={scrollerRef}>
      {items.map((item, k) => (
        <span key={k} ref={k == changed ? changedRef : undefined} className={'list_item' + (k == changed ? ' changed' : '')}>
          <small>{k + indexBase()}</small>{String(item)}
        </span>
      ))}
    </span>
  );
}

/**
 * 並排的流程圖：每張的寬度比例（拖曳分隔線調整）、畫布、換步驟或改大小時重畫。
 * 比例記在第幾張（不是哪一個模組），跳進跳出模組時調好的寬度不會一直被重設
 */
function useSplit(panes: RunPane[], visible: boolean) {
  const box = useRef<HTMLDivElement>(null);
  const canvases = useRef<(HTMLCanvasElement | null)[]>([]);
  const [weights, setWeights] = useState<number[]>([]);
  const weight = (k: number) => weights[k] ?? 1;
  const latest = useRef(panes);
  latest.current = panes;
  const redraw = () => latest.current.forEach((p, k) => {
    const c = canvases.current[k];
    if (c && c.clientWidth > 0) p.draw(c);
  });
  // 每次畫面更新（換步驟、換測資、拖曳寬度）都重畫
  useLayoutEffect(redraw);
  // 視窗或分隔線改變大小時重畫
  useEffect(() => {
    if (!box.current) return;
    const ro = new ResizeObserver(redraw);
    ro.observe(box.current);
    return () => ro.disconnect();
  }, []);
  useEffect(() => { if (visible) redraw(); }, [visible]);

  /** 拖曳第 k 張和第 k+1 張中間的分隔線 */
  const startDrag = (e: React.PointerEvent<HTMLDivElement>, k: number) => {
    const groups = box.current?.children;
    const a = groups?.[k] as HTMLElement | undefined, b = groups?.[k + 1] as HTMLElement | undefined;
    if (!a || !b) return;
    e.preventDefault();
    const handle = e.currentTarget;
    handle.setPointerCapture(e.pointerId);
    const x0 = e.clientX;
    const wa = a.getBoundingClientRect().width, wb = b.getBoundingClientRect().width;
    const sum = weight(k) + weight(k + 1);
    const base = [...weights];
    const move = (ev: PointerEvent) => {
      // 每張至少留 60px
      const da = Math.min(Math.max(wa + ev.clientX - x0, 60), wa + wb - 60);
      const next = [...base];
      for (let i = 0; i <= k + 1; i++) next[i] ??= 1;
      next[k] = (sum * da) / (wa + wb);
      next[k + 1] = sum - next[k];
      setWeights(next);
    };
    const up = () => {
      handle.removeEventListener('pointermove', move);
      handle.removeEventListener('pointerup', up);
      handle.removeEventListener('pointercancel', up);
    };
    handle.addEventListener('pointermove', move);
    handle.addEventListener('pointerup', up);
    handle.addEventListener('pointercancel', up);
  };
  return { box, canvases, weight, startDrag };
}
