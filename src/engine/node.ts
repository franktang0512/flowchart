// 流程圖上的一個積木
import { Anchor } from './anchor';
import type { Connector } from './connector';
import { Figures, type FigureName } from './figures';
import { displayNodeText } from './labels';
import type { Point } from './link';

const FONT = '20px Arial';
const LINE_HEIGHT = 24;

export class FlowNode {
  x: number;
  y: number;
  w: number;
  h: number;
  /** 計算積木的取整方式："" / "Math.round" / "Math.floor" / "Math.ceil" */
  data: string | undefined;
  connectors: Connector[];
  anchors = [
    new Anchor(0, 0, 'nw-resize'),
    new Anchor(1, 0, 'ne-resize'),
    new Anchor(1, 1, 'se-resize'),
    new Anchor(0, 1, 'sw-resize'),
  ];
  strokeStyle = 'black';
  strokeStyleHighlight = 'red';
  fillStyle: string;
  text: string;
  figure: FigureName;
  /** 積木文字裡用到的變數名稱，改變數名稱時用來同步替換 */
  variables: string[] | undefined;

  constructor(
    x: number, y: number, w: number, h: number, connectors: Connector[], text: string,
    fillStyle: string, figure: FigureName, variables?: string[], data?: string,
  ) {
    this.x = Number(x);
    this.y = Number(y);
    this.w = Number(w);
    this.h = Number(h);
    this.data = data;
    this.connectors = connectors;
    this.fillStyle = fillStyle;
    this.text = text;
    this.figure = figure;
    this.variables = variables;
  }

  /** 形狀裡可以放字的範圍（菱形、橢圓的可用空間比方框小） */
  private textBox(w: number, h: number) {
    switch (this.figure) {
      case 'Diamond': return { w: w * 0.6 - 8, h: h * 0.6 - 4 };
      case 'Circle': return { w: w * 0.75 - 8, h: h * 0.75 - 6 };
      case 'Parallelogram': return { w: w - 30, h: h - 12 };
      case 'For_Loop':
      case 'While_Loop': return { w: w * 0.66 - 8, h: h - 14 };
      case 'Function': return { w: w * 0.8 - 12, h: h - 12 };
      default: return { w: w - 16, h: h - 12 };
    }
  }

  /** 依寬度把文字斷成好幾行：盡量在空白處斷，空白太前面就直接切 */
  private wrap(ctx: CanvasRenderingContext2D, maxWidth: number): string[] {
    const lines: string[] = [];
    let rest = displayNodeText(this.text ?? '', this.figure).trim();
    while (rest.length) {
      let i = rest.length;
      while (i > 1 && ctx.measureText(rest.substring(0, i)).width > maxWidth) i--;
      if (i < rest.length) {
        const space = rest.lastIndexOf(' ', i);
        if (space > 0 && ctx.measureText(rest.substring(0, space)).width >= maxWidth * 0.4) i = space;
      }
      lines.push(rest.substring(0, i).trim());
      rest = rest.substring(i).trimStart();
    }
    return lines;
  }

  /** 文字放不下時把積木放大（先加寬、再加高），只會變大不會縮小 */
  fitToText(ctx: CanvasRenderingContext2D) {
    ctx.font = FONT;
    let w = this.w;
    const widest = (lines: string[]) => Math.max(0, ...lines.map(l => ctx.measureText(l).width));
    // 短的字加寬到一行放得下；長的字加寬到最多兩行；單一個字太長放不下時再加寬一點
    const lines = (width: number) => this.wrap(ctx, this.textBox(width, this.h).w).length;
    let one = w;
    while (one < 200 && lines(one) > 1) one += 10;
    if (lines(one) == 1) w = one;
    while (w < 240 && lines(w) > 2) w += 10;
    while (w < 360 && widest(this.wrap(ctx, this.textBox(w, this.h).w)) > this.textBox(w, this.h).w) w += 10;
    let h = this.h;
    const lineCount = this.wrap(ctx, this.textBox(w, h).w).length;
    while (h < 600 && this.textBox(w, h).h < lineCount * LINE_HEIGHT) h += 5;
    this.w = Math.max(this.w, w);
    this.h = Math.max(this.h, h);
  }

  /** 把文字自動換行，水平、垂直都置中畫在積木裡 */
  textfill(ctx: CanvasRenderingContext2D) {
    ctx.font = FONT;
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'center';
    ctx.fillStyle = this.strokeStyle || 'black';
    const lines = this.wrap(ctx, this.textBox(this.w, this.h).w);
    const cx = this.x + this.w / 2;
    const top = this.y + this.h / 2 - (lines.length - 1) * LINE_HEIGHT / 2;
    lines.forEach((line, i) => ctx.fillText(line, cx, top + i * LINE_HEIGHT));
  }

  draw(ctx: CanvasRenderingContext2D, color: string = this.strokeStyle) {
    if (Figures[this.figure]) Figures[this.figure](ctx, this, color);
    else this.figure = 'Rectangle';
    this.connectors?.forEach(c => c.draw(ctx, this.x, this.y, this.w, this.h));
  }

  /** 逐步執行時，正在執行的積木用紅框標出 */
  stepHighlight(ctx: CanvasRenderingContext2D) {
    this.draw(ctx, this.strokeStyleHighlight);
  }

  connectorCoords(connectorIndex: number): Point {
    return {
      x: this.x + this.connectors[connectorIndex].x * this.w,
      y: this.y + this.connectors[connectorIndex].y * this.h,
    };
  }

  isInside(x: number, y: number) {
    return x >= this.x && x <= this.x + this.w && y >= this.y && y <= this.y + this.h;
  }

  isInsideConnectors(point: Point): number | null {
    if (this.connectors) {
      for (let index = 0; index < this.connectors.length; index++) {
        if (this.connectors[index].isInside(point.x, point.y, this.x, this.y, this.w, this.h)) return index;
      }
    }
    return null;
  }

  isInsideAnchors(x: number, y: number): number | null {
    for (let index = 0; index < this.anchors.length; index++) {
      if (this.anchors[index].isInside(x, y, this.x, this.y, this.w, this.h)) return index;
    }
    return null;
  }

  nearestAnchor(mouseC: Point): number | null {
    let dMin = 999999;
    let sel: number | null = null;
    for (let index = 0; index < this.anchors.length; index++) {
      const element = this.anchors[index];
      const d = element.distance(mouseC.x, mouseC.y, this.x, this.y, this.w, this.h);
      if (d < dMin && element.cursorClass != 'move') {
        dMin = d;
        sel = index;
      }
    }
    return sel;
  }

  highlight(ctx: CanvasRenderingContext2D) {
    this.anchors.forEach(a => a.draw(ctx, this.x, this.y, this.w, this.h));
  }
}
