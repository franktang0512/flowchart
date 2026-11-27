// 跳出來的視窗都可以拖曳移動、拉邊和角調大小（看程式、積木設定、模組、Scratch 建立積木共用）
import type { PointerEvent as ReactPointerEvent } from 'react';

type RefObject<T> = { readonly current: T | null };
import { t } from '../i18n';

/** 改成用 left / top 決定位置（原本是置中） */
function pin(el: HTMLElement) {
  const box = el.getBoundingClientRect();
  Object.assign(el.style, { position: 'fixed', margin: '0', left: box.left + 'px', top: box.top + 'px' });
  return box;
}

/** 按住之後一直跟著指標，放開就停 */
function follow(handle: HTMLElement, pointerId: number, move: (ev: PointerEvent) => void) {
  try {
    handle.setPointerCapture(pointerId);
  }
  catch {
    // 指標已經放開了（很快的點一下）：不用跟
  }
  const up = () => {
    handle.removeEventListener('pointermove', move);
    handle.removeEventListener('pointerup', up);
    handle.removeEventListener('pointercancel', up);
  };
  handle.addEventListener('pointermove', move);
  handle.addEventListener('pointerup', up);
  handle.addEventListener('pointercancel', up);
}

/** 拖曳移動視窗（按在按鈕、輸入框上不算） */
export function startDrag(el: HTMLElement | null, e: ReactPointerEvent<HTMLElement>) {
  if (!el || e.button != 0 || (e.target as HTMLElement).closest('button, input, select, textarea, a')) return;
  e.preventDefault();
  const box = pin(el);
  const dx = e.clientX - box.left, dy = e.clientY - box.top;
  follow(e.currentTarget, e.pointerId, ev => {
    // 至少留一點在畫面裡，才拉得回來
    el.style.left = Math.min(Math.max(ev.clientX - dx, 80 - box.width), window.innerWidth - 80) + 'px';
    el.style.top = Math.min(Math.max(ev.clientY - dy, 0), window.innerHeight - 40) + 'px';
  });
}

/** 打開時：回到畫面中間，大小照內容（每個積木要設定的東西不一樣多，不沿用上次拉的大小） */
export function placeDialog(el: HTMLElement) {
  Object.assign(el.style, { position: '', left: '', top: '', margin: '', width: '', height: '', maxWidth: '', maxHeight: '' });
}

const DIRS = ['n', 's', 'w', 'e', 'nw', 'ne', 'sw', 'se'];

/** 四個邊、四個角都可以拉（dir：n 上、s 下、w 左、e 右）；視窗要是 position: fixed / relative 之類的 */
export function ResizeHandles({ target, minWidth = 300, minHeight = 160 }: { target: RefObject<HTMLElement>; minWidth?: number; minHeight?: number }) {
  const start = (dir: string) => (e: ReactPointerEvent<HTMLDivElement>) => {
    const el = target.current;
    if (!el || e.button != 0) return;
    e.preventDefault();
    const box = pin(el);
    const x0 = e.clientX, y0 = e.clientY;
    const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(v, hi));
    follow(e.currentTarget, e.pointerId, ev => {
      const dx = ev.clientX - x0, dy = ev.clientY - y0;
      let { left, top, width, height } = box;
      if (dir.includes('e')) width = clamp(box.width + dx, minWidth, window.innerWidth - box.left);
      if (dir.includes('w')) { width = clamp(box.width - dx, minWidth, box.right); left = box.right - width; }
      if (dir.includes('s')) height = clamp(box.height + dy, minHeight, window.innerHeight - box.top);
      if (dir.includes('n')) { height = clamp(box.height - dy, minHeight, box.bottom); top = box.bottom - height; }
      Object.assign(el.style, { left: left + 'px', top: top + 'px', width: width + 'px', height: height + 'px', maxWidth: 'none', maxHeight: 'none' });
    });
  };
  return (
    <>
      {DIRS.map(d => (
        <div key={d} className={`dlg_resize dlg_resize_${d}`} onPointerDown={start(d)} title={t('拉這裡調大小', 'Drag to resize')} />
      ))}
    </>
  );
}

/** 視窗最上面的一條：按住拖曳可以移動 */
export function DragBar({ target }: { target: RefObject<HTMLElement> }) {
  return (
    <div className="dlg_drag" onPointerDown={e => startDrag(target.current, e)} title={t('按住這裡拖曳可以移動視窗；拉視窗的邊或角可以調大小', 'Drag here to move. Drag an edge or corner to resize.')}>
      <span />
    </div>
  );
}
