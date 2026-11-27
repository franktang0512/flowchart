// 測資框的高度：打字、貼上時跟著內容長高或變矮；也可以拉右下角自己調，同一列會一起跟著變

function rowOf(el: HTMLTextAreaElement) {
  return el.parentElement?.parentElement ?? null;
}

function areasOf(el: HTMLTextAreaElement) {
  const row = rowOf(el);
  return row ? [...row.querySelectorAll('textarea')] : [el];
}

function setRowHeight(el: HTMLTextAreaElement, h: number) {
  for (const a of areasOf(el)) {
    a.style.height = h + 'px';
    a.dataset.fitted = String(h);
  }
}

/** 同一列一起變高或變矮，剛好放得下內容最多的那一格。
 *  keepPulled：學生自己拉過的列維持拉的高度（換頁、重新整理時）；打字、貼上時就不管拉過的，重新照內容排 */
export function fitRow(el: HTMLTextAreaElement, keepPulled = false) {
  const row = rowOf(el);
  // 隱藏著（不在這一步）量不到，等看得到再量
  if (!el.offsetParent) return;
  if (row && !keepPulled) delete row.dataset.pulled;
  const pulled = Number(row?.dataset.pulled ?? 0);
  if (pulled) {
    setRowHeight(el, pulled);
    return;
  }
  let h = 0;
  for (const a of areasOf(el)) {
    a.style.height = 'auto';
    // scrollHeight 不含框線；box-sizing 是 border-box，要加上去才不會出現捲軸
    h = Math.max(h, a.scrollHeight + a.offsetHeight - a.clientHeight);
  }
  setRowHeight(el, h);
}

/** 打字、貼上時 */
export const fitRowOnInput = (el: HTMLTextAreaElement) => fitRow(el, false);

/** 拉右下角：不是我們自己設的高度，就是學生拉的，整列跟著變（拉矮了內容放不下就用捲的） */
const pulledWatcher = typeof ResizeObserver == 'undefined' ? null : new ResizeObserver(entries => {
  requestAnimationFrame(() => {
    for (const { target } of entries) {
      const el = target as HTMLTextAreaElement;
      // 還沒排過高度（剛出現）的不算
      if (!el.isConnected || !el.offsetParent || el.dataset.fitted == null || el.offsetHeight == Number(el.dataset.fitted)) continue;
      const row = rowOf(el);
      if (row) row.dataset.pulled = String(el.offsetHeight);
      setRowHeight(el, el.offsetHeight);
    }
  });
});

/** 給 textarea 的 ref 用：開始注意學生有沒有拉它 */
export function watchPulled(el: HTMLTextAreaElement | null) {
  if (el) pulledWatcher?.observe(el);
}
