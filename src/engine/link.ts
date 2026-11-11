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
/** 箭頭上可以拖的點，滑鼠離它多近算點到 */
const HANDLE_R = 8;
/** 拖折點時，跟前後的點差不到這麼多就對齊成水平/垂直 */
const SNAP = 10;

/** 選取箭頭後可以拖的地方：折點、線段中間（拖了會多一個折點）、兩端（換接到積木的另一邊） */
export type LinkHandle =
  | { kind: 'point'; index: number }
  | { kind: 'mid'; index: number }
  | { kind: 'end'; which: 'from' | 'to' };

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
  /** 學生自己拉的折點（畫布座標）；有的話就照這些點畫，不用自動算的路線 */
  points: Point[] = [];
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
    if (!this.points.length) {
      reSegment(this, this.getNodes());
      return;
    }
    const nodes = this.getNodes();
    const a = nodes[this.from]!.connectorCoords(this.anchorFrom);
    const b = nodes[this.to]!.connectorCoords(this.anchorTo);
    this.segments = [{ x: a.x, y: a.y }, ...this.points.map(p => ({ x: p.x, y: p.y })), { x: b.x, y: b.y }];
    // 文字放在最長的那一段
    let longest = 0;
    for (let index = 1; index < this.segments.length; index++) {
      const d = this.distance(this.segments[index - 1], this.segments[index]);
      if (d > longest) {
        longest = d;
        this.indexText = index;
      }
    }
  }

  /** 滑鼠在哪個可以拖的地方上（選取箭頭之後才用得到） */
  handleAt(p: Point): LinkHandle | null {
    const near = (q: Point) => this.distance(p, q) <= HANDLE_R;
    const s = this.segments;
    if (s.length < 2) return null;
    // 自動算的路線裡的轉折點，拖了也一樣變成自己的折點
    for (let index = 1; index < s.length - 1; index++) {
      if (near(s[index])) return { kind: 'point', index: index - 1 };
    }
    if (near(s[0])) return { kind: 'end', which: 'from' };
    if (near(s[s.length - 1])) return { kind: 'end', which: 'to' };
    for (let index = 0; index < s.length - 1; index++) {
      if (near(this.midpoint(index))) return { kind: 'mid', index };
    }
    return null;
  }

  /** 自動算的路線第一次被拖：把它的轉折點變成自己的折點，之後就照這些點畫 */
  private adoptRoute() {
    if (!this.points.length) this.points = this.segments.slice(1, -1).map(p => ({ x: p.x, y: p.y }));
  }

  /** 在第 index 段的中間加一個折點，回傳它是第幾個折點 */
  addPoint(index: number): number {
    this.adoptRoute();
    this.points.splice(index, 0, this.midpoint(index));
    this.reSegment();
    return index;
  }

  /** 把第 index 個折點拖到 p；跟前後的點差不多對齊時，吸成水平/垂直 */
  movePoint(index: number, p: Point) {
    this.adoptRoute();
    const prev = this.segments[index];
    const next = this.segments[index + 2];
    let { x, y } = p;
    if (Math.abs(x - prev.x) < SNAP) x = prev.x;
    else if (next && Math.abs(x - next.x) < SNAP) x = next.x;
    if (Math.abs(y - prev.y) < SNAP) y = prev.y;
    else if (next && Math.abs(y - next.y) < SNAP) y = next.y;
    this.points[index] = { x, y };
    this.reSegment();
  }

  /** 刪掉一個折點；全部刪光就回到自動算的路線 */
  removePoint(index: number) {
    this.adoptRoute();
    this.points.splice(index, 1);
    this.reSegment();
  }

  /** 第 index 段的中點 */
  private midpoint(index: number): Point {
    const a = this.segments[index];
    const b = this.segments[index + 1];
    return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
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
    this.drawHandles(ctx);
  }

  /** 選取時畫出可以拖的地方：兩端是方塊、折點是圓點、線段中間是淡淡的小圓點 */
  private drawHandles(ctx: CanvasRenderingContext2D) {
    const s = this.segments;
    ctx.save();
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = this.strokeStyleHighlight;
    for (let index = 0; index < s.length - 1; index++) {
      const m = this.midpoint(index);
      ctx.beginPath();
      ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
      ctx.globalAlpha = 0.6;
      ctx.arc(m.x, m.y, 4, 0, 2 * Math.PI);
      ctx.fill();
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
    ctx.fillStyle = 'white';
    for (let index = 1; index < s.length - 1; index++) {
      ctx.beginPath();
      ctx.arc(s[index].x, s[index].y, 5, 0, 2 * Math.PI);
      ctx.fill();
      ctx.stroke();
    }
    for (const p of [s[0], s[s.length - 1]]) {
      ctx.beginPath();
      ctx.rect(p.x - 5, p.y - 5, 10, 10);
      ctx.fill();
      ctx.stroke();
    }
    ctx.restore();
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
