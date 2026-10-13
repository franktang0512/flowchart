// textarea 高度跟著內容長

/** 打字時：同一列（祖父元素底下）的 textarea 一起長高，表格每格才會等高 */
export function fitRowOnInput(el: HTMLTextAreaElement) {
  el.style.height = 'auto';
  const h = el.scrollHeight + 'px';
  el.parentElement?.parentElement?.querySelectorAll('textarea').forEach(t => { t.style.height = h; });
}
