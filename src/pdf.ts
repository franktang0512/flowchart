// 交作業：把列印畫面（PrintView）直接存成 PDF 下載，不用經過瀏覽器的列印視窗。
// 做法：整個列印畫面先畫成一張圖，再切成一頁一頁的 A4；只在「表格的列和列中間」、
// 「流程圖兩個積木中間」換頁，不會把字或積木切成兩半。流程圖照原本的大小，可以跨好幾頁，
// 接在前面的內容後面畫，不會因為一頁放不下就整張推到下一頁、空出大半頁。
// html2canvas、jsPDF 比較大，按下「下載 PDF」時才載入。

/** A4 直式，四周留 10mm */
const PAGE_W = 210;
const PAGE_H = 297;
const MARGIN = 10;

/**
 * 可以換頁的位置（從 el 頂端算起的 px）：班級座號那一行、每個大表格的列、
 * 表格裡面的小表格（變數、測資）每一列的下緣
 */
function breakPoints(el: HTMLElement): number[] {
  const top = el.getBoundingClientRect().top;
  const rows = el.querySelectorAll<HTMLElement>('.print_head, .my_table > tbody > tr, .print_table tr, .print_question');
  const points = [...rows].map(r => r.getBoundingClientRect().bottom - top);
  // 流程圖：兩個積木中間的空隙
  for (const img of el.querySelectorAll<HTMLImageElement>('img[data-cuts]')) {
    const box = img.getBoundingClientRect();
    for (const f of (img.dataset.cuts ?? '').split(',').filter(Boolean).map(Number)) points.push(box.top - top + f * box.height);
  }
  return [...new Set(points.map(Math.round))].sort((a, b) => a - b);
}

/** 圖片都載入了才畫（流程圖是剛產生的圖片） */
async function imagesReady(el: HTMLElement) {
  await Promise.all([...el.querySelectorAll('img')].map(img => (img.complete ? null : new Promise(r => { img.onload = img.onerror = r; }))));
}

/** 把 el 存成 PDF 下載 */
export async function savePdf(el: HTMLElement, fileName: string) {
  const [{ default: html2canvas }, { jsPDF }] = await Promise.all([import('html2canvas'), import('jspdf')]);
  await imagesReady(el);
  const breaks = breakPoints(el);
  const cssW = el.offsetWidth;
  const cssH = el.offsetHeight;
  const scale = 2;
  const canvas = await html2canvas(el, { scale, backgroundColor: '#ffffff', useCORS: true });

  const pdf = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' });
  const contentW = PAGE_W - MARGIN * 2;
  const mmPerPx = contentW / cssW;
  /** 一頁放得下幾 px（畫面上的大小） */
  const pagePx = (PAGE_H - MARGIN * 2) / mmPerPx;

  let y = 0;
  let first = true;
  while (y < cssH - 1) {
    let end = Math.min(y + pagePx, cssH);
    if (end < cssH) {
      // 換頁位置：這一頁放得下的最後一個可以切開的地方；太前面（不到三分之一頁）的話寧可照頁面高度切
      const ok = breaks.filter(b => b > y + pagePx / 3 && b <= end);
      if (ok.length) end = ok[ok.length - 1];
    }
    const h = end - y;
    const slice = document.createElement('canvas');
    slice.width = canvas.width;
    slice.height = Math.ceil(h * scale);
    const ctx = slice.getContext('2d')!;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, slice.width, slice.height);
    ctx.drawImage(canvas, 0, Math.floor(y * scale), canvas.width, slice.height, 0, 0, canvas.width, slice.height);
    if (!first) pdf.addPage();
    first = false;
    // JPEG 檔案比較小；白底的表格和流程圖看起來一樣清楚
    pdf.addImage(slice.toDataURL('image/jpeg', 0.92), 'JPEG', MARGIN, MARGIN, contentW, h * mmPerPx);
    y = end;
  }
  pdf.save(fileName);
}
