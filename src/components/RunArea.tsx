// 第四步：逐步執行流程圖，看每一步的變數與輸出
import { useEffect, useRef, type Ref } from 'react';
import type { RunResult } from '../engine/decoder';
import { t, useLang } from '../i18n';
import { indexBase } from '../target';

interface Props {
  visible: boolean;
  canvasRef: Ref<HTMLCanvasElement>;
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
}

export function RunArea({ visible, canvasRef, run, error, partial, step, onStep, which, onWhich, cases, varNames }: Props) {
  useLang();
  const total = run?.totalStep ?? 0;
  const output = run?.output[step] ?? '';
  const atEnd = run != null && step == total;
  const expected = cases[which * 3 + 1];
  const correct = atEnd && output.replaceAll(/\s/g, '') == expected.replaceAll(/\s/g, '');
  const values = run?.var[step];
  // 上一步的值：清單跟它比較，才知道這一步改了哪一格
  const prevValues = step > 0 ? run?.var[step - 1] : undefined;

  return (
    <div id="run_code_area" className="stage" style={{ display: visible ? undefined : 'none' }}>
      <div className="card canvas_card run_canvas_card">
        <div className="canvas_head">
          <h5 className="card_title" style={{ margin: 0 }}><span className="step_badge">4</span>{t('測試執行並除錯', 'Run and Check')}</h5>
        </div>
        <div className="canvas_body">
          <div className="canvas_wrap">
            <canvas id="my_canvas_show" ref={canvasRef}></canvas>
          </div>
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
          <p className="section_label" style={{ marginTop: 0 }}>{t('變數', 'Variables')}</p>
          <div id="variableTable" className="var_boxes">
            {values && varNames.map(name => {
              const v = values[name];
              const isList = Array.isArray(v);
              return (
                <div key={name} className={'var_box' + (isList ? ' is_list' : '')}>
                  <span className="var_box_name">{name}</span>
                  <span className={'var_box_value' + (isList ? ' is_list' : '')}>{isList ? <ListValue items={v} prev={prevValues?.[name]} /> : String(v)}</span>
                </div>
              );
            })}
          </div>
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
