// textarea 高度跟著內容長；也可以拉右下角自己拉高

/** 同一列（祖父元素底下）的 textarea 一起變高：內容最多的那一格放得下，也不比學生自己拉的矮，表格每格才會等高 */
export function fitRow(el: HTMLTextAreaElement) {
  const row = el.parentElement?.parentElement;
  const areas = row ? [...row.querySelectorAll('textarea')] : [el];
  // 隱藏著（不在這一步）量不到，等看得到再量
  if (!el.offsetParent) return;
  let h = Number(row?.dataset.pulled ?? 0);
  for (const a of areas) {
    a.style.height = 'auto';
    // scrollHeight 不含框線；box-sizing 是 border-box，要加上去才不會出現捲軸
    h = Math.max(h, a.scrollHeight + a.offsetHeight - a.clientHeight);
  }
  areas.forEach(a => {
    a.style.height = h + 'px';
    a.dataset.fitted = String(h);
  });
}

/** 打字、貼上時 */
export const fitRowOnInput = fitRow;

/** 學生拉了右下角：記住拉到多高，同一列一起變高 */
export function rememberPulled(el: HTMLTextAreaElement) {
  const row = el.parentElement?.parentElement;
  if (!row || el.offsetHeight == Number(el.dataset.fitted ?? 0)) return;
  row.dataset.pulled = String(el.offsetHeight);
  fitRow(el);
}
