// 節點上下左右的連接點（拉箭頭用）

// 舊版的全域 connector_r：只有選了箭頭工具時連接點才有半徑（才看得到、點得到）
// hit：點得到的範圍是 r 的幾倍（縮小畫面時連接點變小，點得到的範圍維持在螢幕上差不多大）
// grab：用手指操作時是 3（手指比滑鼠粗，縮放把手、箭頭上的點也一起放大好按），滑鼠是 1
export const connectorState = { r: 0, hit: 1, grab: 1 };

export interface ConnectorDecoration {
  fillStyle: string;
  strokeStyle: string;
  highlightStrokeStyle: string;
  highlightText: string;
}

export interface ConnectorOptions {
  dropAllowed: boolean;
  dragAllowed: boolean;
  radius: number;
}

export class Connector {
  x: number;
  y: number;
  mode: string;
  options: ConnectorOptions;
  title: string;
  decoration: ConnectorDecoration;

  constructor(x: number, y: number, mode: string, title: string, decoration: Partial<ConnectorDecoration>, options?: ConnectorOptions) {
    this.x = x;
    this.y = y;
    this.mode = mode;
    this.options = options ?? { dropAllowed: true, dragAllowed: true, radius: 7 };
    this.title = title;
    this.decoration = {
      fillStyle: decoration.fillStyle ?? 'black',
      strokeStyle: decoration.strokeStyle ?? 'black',
      highlightStrokeStyle: decoration.highlightStrokeStyle ?? 'black',
      highlightText: decoration.highlightText ?? 'black',
    };
  }

  draw(ctx: CanvasRenderingContext2D, originX: number, originY: number, width: number, height: number) {
    ctx.beginPath();
    ctx.lineWidth = 1;
    ctx.fillStyle = this.decoration.fillStyle;
    ctx.strokeStyle = this.decoration.strokeStyle;
    ctx.arc(this.x * width + originX, this.y * height + originY, connectorState.r, 0, 2 * Math.PI, false);
    ctx.fill();
    ctx.stroke();
  }

  highlight(ctx: CanvasRenderingContext2D, originX: number, originY: number, width: number, height: number) {
    ctx.beginPath();
    ctx.lineWidth = 2;
    ctx.strokeStyle = this.decoration.highlightStrokeStyle;
    const oX = this.x * width + originX;
    const oY = this.y * height + originY;
    ctx.arc(oX, oY, connectorState.r, 0, 2 * Math.PI, false);
    ctx.stroke();
    if (this.title != null) {
      ctx.fillStyle = this.decoration.highlightText;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      ctx.fillText(this.title, oX, oY + connectorState.r);
    }
  }

  distance(x: number, y: number, originX: number, originY: number, width: number, height: number) {
    return (x - this.x * width - originX) * (x - this.x * width - originX) + (y - this.y * height - originY) * (y - this.y * height - originY);
  }

  isInside(x: number, y: number, originX: number, originY: number, width: number, height: number) {
    const r = connectorState.r * connectorState.hit;
    return this.distance(x, y, originX, originY, width, height) <= r * r;
  }
}

const connectorDecoration = {
  fillStyle: 'white', strokeStyle: 'black',
  highlightStrokeStyle: 'red', highlightText: 'black',
};
const options = { dropAllowed: true, dragAllowed: true, radius: 7 };

// 左、上、右、下（順序就是 link 的 anchorFrom / anchorTo 編號）
export const createConnectors = () => [
  new Connector(0, 0.5, 'mixed', '', connectorDecoration, options),
  new Connector(0.5, 0, 'mixed', '', connectorDecoration, options),
  new Connector(1, 0.5, 'mixed', '', connectorDecoration, options),
  new Connector(0.5, 1, 'mixed', '', connectorDecoration, options),
];
