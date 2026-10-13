// 各種積木的形狀（舊版 shapes.js 的 Figures）
import type { FlowNode } from './node';

export type FigureName =
  | 'Rectangle' | 'Function' | 'Circle' | 'Diamond'
  | 'For_Loop' | 'While_Loop' | 'Parallelogram';

const setStroke = (ctx: CanvasRenderingContext2D, color: string) => {
  ctx.strokeStyle = color;
};

type Figure = (ctx: CanvasRenderingContext2D, node: FlowNode, color: string) => void;

export const Figures: Record<FigureName, Figure> = {
  Rectangle(ctx, node, color) {
    setStroke(ctx, color);
    ctx.beginPath();
    ctx.moveTo(node.x, node.y + node.h);
    ctx.lineTo(node.x + node.w, node.y + node.h);
    ctx.lineTo(node.x + node.w, node.y);
    ctx.lineTo(node.x, node.y);
    ctx.closePath();
    ctx.stroke();
    ctx.font = '20px Verdana';
    ctx.textBaseline = 'middle';
    node.textfill(ctx);
  },
  Function(ctx, node, color) {
    ctx.beginPath();
    setStroke(ctx, color);
    ctx.moveTo(node.x, node.y + node.h);
    ctx.lineTo(node.x + node.w, node.y + node.h);
    ctx.lineTo(node.x + node.w, node.y);
    ctx.lineTo(node.x, node.y);
    ctx.lineTo(node.x, node.y + node.h);
    ctx.moveTo(node.x + node.w * 0.1, node.y + node.h);
    ctx.lineTo(node.x + node.w * 0.9, node.y + node.h);
    ctx.lineTo(node.x + node.w * 0.9, node.y);
    ctx.lineTo(node.x + node.w * 0.1, node.y);
    ctx.closePath();
    ctx.stroke();
    ctx.font = '20px Verdana';
    ctx.textBaseline = 'middle';
    node.textfill(ctx);
  },
  Circle(ctx, node, color) {
    const step = (node.w > node.h) ? 1 / node.w : 1 / node.h;
    ctx.beginPath();
    setStroke(ctx, color);
    ctx.moveTo(node.x + node.w, node.y + node.h / 2);
    for (let i = 0; i < 2 * Math.PI; i += step) {
      ctx.lineTo(node.x + node.w / 2 + node.w / 2 * Math.cos(i), node.y + node.h / 2 + node.h / 2 * Math.sin(i));
    }
    ctx.closePath();
    ctx.stroke();
    node.textfill(ctx);
  },
  Diamond(ctx, node, color) {
    ctx.beginPath();
    setStroke(ctx, color);
    ctx.moveTo(node.x, node.y + node.h / 2);
    ctx.lineTo(node.x + node.w / 2, node.y);
    ctx.lineTo(node.x + node.w, node.y + node.h / 2);
    ctx.lineTo(node.x + node.w / 2, node.y + node.h);
    ctx.closePath();
    ctx.stroke();
    node.textfill(ctx);
  },
  For_Loop(ctx, node, color) {
    ctx.beginPath();
    setStroke(ctx, color);
    ctx.moveTo(node.x, node.y + node.h / 2);
    ctx.lineTo(node.x + node.w / 3, node.y);
    ctx.lineTo(node.x + node.w * 2 / 3, node.y);
    ctx.lineTo(node.x + node.w, node.y + node.h / 2);
    ctx.lineTo(node.x + node.w * 2 / 3, node.y + node.h);
    ctx.lineTo(node.x + node.w / 3, node.y + node.h);
    ctx.closePath();
    ctx.stroke();

    // 中間的循環箭頭
    ctx.beginPath();
    const step = (node.w > node.h) ? 1 / node.w : 1 / node.h;
    ctx.moveTo(node.x + 0.5 * node.w + 0.3 * node.w * Math.cos(0.1 * Math.PI), node.y + node.h / 2 + 0.4 * node.h * Math.sin(0.1 * Math.PI));
    for (let i = 0.1 * Math.PI; i < 2 * Math.PI; i += step) {
      ctx.lineTo(node.x + node.w / 2 + 0.6 * node.w / 2 * Math.cos(i), node.y + node.h / 2 + 0.4 * node.h * Math.sin(i));
    }
    ctx.stroke();
    ctx.beginPath();
    ctx.lineTo(node.x + 0.8 * node.w + 8, node.y + 0.5 * node.h - 10);
    ctx.lineTo(node.x + 0.8 * node.w, node.y + 0.5 * node.h);
    ctx.lineTo(node.x + 0.8 * node.w - 8, node.y + 0.5 * node.h - 10);
    ctx.lineTo(node.x + 0.8 * node.w + 8, node.y + 0.5 * node.h - 10);
    ctx.stroke();
    ctx.fill();

    node.textfill(ctx);
  },
  While_Loop(ctx, node, color) {
    ctx.beginPath();
    setStroke(ctx, color);
    ctx.moveTo(node.x, node.y + node.h / 2);
    ctx.lineTo(node.x + node.w / 3, node.y);
    ctx.lineTo(node.x + node.w * 2 / 3, node.y);
    ctx.lineTo(node.x + node.w, node.y + node.h / 2);
    ctx.lineTo(node.x + node.w * 2 / 3, node.y + node.h);
    ctx.lineTo(node.x + node.w / 3, node.y + node.h);
    ctx.closePath();
    ctx.stroke();
    node.textfill(ctx);
  },
  Parallelogram(ctx, node, color) {
    ctx.beginPath();
    setStroke(ctx, color);
    ctx.moveTo(node.x - 10, node.y + node.h);
    ctx.lineTo(node.x + node.w - 10, node.y + node.h);
    ctx.lineTo(node.x + node.w + 10, node.y);
    ctx.lineTo(node.x + 10, node.y);
    ctx.closePath();
    ctx.stroke();
    node.textfill(ctx);
  },
};
