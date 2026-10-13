// 兩個積木之間的箭頭
import { Anchor } from './anchor';
import { displayLinkText } from './labels';
import type { FlowNode } from './node';
import { reSegment } from './routing';

export interface Point {
  x: number;
  y: number;
}

const ARROW_HEAD = 15;

export class Link {
  from: number;
  to: number;
  anchorFrom: number;
  anchorTo: number;
  segments: Point[] = [];
  strokeStyle = 'black';
  strokeStyleHighlight = 'red';
  indexText = 0;
  text: string;
  /** 直角連線可拖曳的折點 */
  anchors: Anchor[] = [];
  new_anchors: Anchor[] = [];
  /** "straight"（直線）或 "square"（直角折線） */
  mode: string;
  private readonly getNodes: () => (FlowNode | null)[];

  constructor(
    getNodes: () => (FlowNode | null)[],
    from: number, to: number, anchorIndexFrom: number, anchorIndexTo: number, text: string, mode?: string | null,
  ) {
    this.getNodes = getNodes;
    this.from = from;
    this.to = to;
    this.anchorFrom = anchorIndexFrom;
    this.anchorTo = anchorIndexTo;
    this.text = text;
    this.mode = mode != null ? mode.toLowerCase() : 'straight';
    this.reSegment();
  }

  reSegment() {
    reSegment(this, this.getNodes());
  }

  private arrow(ctx: CanvasRenderingContext2D, fromx: number, fromy: number, tox: number, toy: number) {
    const angle = Math.atan2(toy - fromy, tox - fromx);
    ctx.beginPath();
    ctx.moveTo(fromx, fromy);
    ctx.lineTo(tox, toy);
    ctx.stroke();

    ctx.beginPath();
    ctx.fillStyle = 'black';
    ctx.moveTo(tox, toy);
    ctx.lineTo(tox - ARROW_HEAD * Math.cos(angle - Math.PI / 10), toy - ARROW_HEAD * Math.sin(angle - Math.PI / 10));
    ctx.lineTo(tox - ARROW_HEAD * Math.cos(angle + Math.PI / 10), toy - ARROW_HEAD * Math.sin(angle + Math.PI / 10));
    ctx.fill();
  }

  draw(ctx: CanvasRenderingContext2D) {
    if (this.segments.length < 2) return;
    // 線段（最後一段交給 arrow 畫）
    ctx.beginPath();
    ctx.lineWidth = 2;
    ctx.strokeStyle = this.strokeStyle || 'black';
    ctx.moveTo(this.segments[0].x, this.segments[0].y);
    for (let index = 1; index < this.segments.length - 1; index++) {
      ctx.lineTo(this.segments[index].x, this.segments[index].y);
    }
    ctx.stroke();
    // 文字（真/假、進入/離開迴圈）
    const t = this.segments[this.indexText];
    const t0 = this.segments[this.indexText - 1];
    ctx.beginPath();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(displayLinkText(this.text), (t.x + t0.x) / 2, (t.y + t0.y) / 2);
    ctx.fill();

    const a = this.segments[this.segments.length - 2];
    const b = this.segments[this.segments.length - 1];
    this.arrow(ctx, a.x, a.y, b.x, b.y);
  }

  highlight(ctx: CanvasRenderingContext2D) {
    ctx.beginPath();
    ctx.strokeStyle = this.strokeStyleHighlight;
    ctx.moveTo(this.segments[0].x, this.segments[0].y);
    for (let index = 1; index < this.segments.length; index++) {
      ctx.lineTo(this.segments[index].x, this.segments[index].y);
    }
    const end = this.segments[this.segments.length - 1];
    ctx.stroke();
    ctx.beginPath();
    ctx.fillStyle = this.strokeStyleHighlight;
    ctx.strokeStyle = this.strokeStyleHighlight;
    ctx.arc(end.x, end.y, 2 * 2, 0, 2 * Math.PI, false);
    ctx.fill();

    this.anchors.forEach(a => a.draw(ctx, a.x, a.y, 0, 0));
  }

  private distance(a: Point, b: Point) {
    return Math.sqrt((a.x - b.x) * (a.x - b.x) + (a.y - b.y) * (a.y - b.y));
  }

  private isBetween(a: Point, c: Point, b: Point) {
    return this.distance(a, c) + this.distance(c, b) - this.distance(a, b) < 1;
  }

  isOverLink(point: Point) {
    for (let index = 1; index < this.segments.length; index++) {
      if (this.isBetween(this.segments[index - 1], point, this.segments[index])) return true;
    }
    return false;
  }

  isInsideAnchors(x: number, y: number): number | null {
    for (let index = 0; index < this.anchors.length; index++) {
      const a = this.anchors[index];
      if (a.isInside(x, y, a.x, a.y, 0, 0)) return index;
    }
    return null;
  }
}
