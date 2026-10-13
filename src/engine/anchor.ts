// 節點四角的縮放把手，以及直角連線上可拖曳的折點
export class Anchor {
  x: number;
  y: number;
  radius = 5;
  cursorClass: string;
  strokeStyle = 'gray';
  strokeStyleHighlight = 'red';
  dragOrigin: { x: number; y: number } = { x: 0, y: 0 };
  // 舊版 draw/highlight 用的是建構時的 x、y（閉包），不是之後被改過的 this.x，這裡照樣保留
  private readonly ox: number;
  private readonly oy: number;

  constructor(x: number, y: number, cursorClass: string) {
    this.x = x;
    this.y = y;
    this.ox = x;
    this.oy = y;
    this.cursorClass = cursorClass;
  }

  draw(ctx: CanvasRenderingContext2D, originX: number, originY: number, width: number, height: number) {
    ctx.beginPath();
    ctx.strokeStyle = this.strokeStyle;
    ctx.lineWidth = 1;
    ctx.rect(this.ox * width + originX - this.radius, this.oy * height + originY - this.radius, this.radius * 2, this.radius * 2);
    ctx.stroke();
  }

  highlight(ctx: CanvasRenderingContext2D, originX: number, originY: number, width: number, height: number) {
    ctx.beginPath();
    ctx.strokeStyle = this.strokeStyleHighlight;
    const r = this.radius * 1.5;
    ctx.rect(this.ox * width + originX - r, this.oy * height + originY - r, r * 2, r * 2);
    ctx.stroke();
  }

  distance(x: number, y: number, originX: number, originY: number, width: number, height: number) {
    return (x - this.x * width - originX) * (x - this.x * width - originX) + (y - this.y * height - originY) * (y - this.y * height - originY);
  }

  isInside(x: number, y: number, originX: number, originY: number, width: number, height: number) {
    return this.distance(x, y, originX, originY, width, height) <= this.radius * this.radius;
  }
}
