// 「看程式」的編輯模式：流程圖的結構 → 畫出流程圖（取代目前的流程圖）。
// 自動排版：由上往下；判斷的「真」往左下、「假」往右下，在下面匯合；
// 迴圈裡的積木排在迴圈下面，最後用左邊的線繞回迴圈，「離開迴圈」從右邊繞到下一個積木。
// 線都是直角折線（用箭頭自己的折點 points 畫），學生之後可以再拖折點調整。
// 積木上的字照各積木存的格式（見 nodeActions 的 ioText / rectangleText），流程圖才能照常執行和編輯。
import { createConnectors } from './connector';
import { getCodeVar, type VarStore } from './decoder';
import type { Diagram } from './diagram';
import type { FigureName } from './figures';
import type { Point } from './link';
import { callText } from './modules';
import type { FlowNode } from './node';
import type { Expr, Stmt } from './structure';

const GAP_Y = 50;
const GAP_X = 60;
/** 迴圈左右留給繞回去/離開的線的空間 */
const LOOP_MARGIN = 40;
/** 判斷某一邊沒有積木時，那一邊的寬度 */
const EMPTY_BRANCH = 40;

// 連接點：0 左、1 上、2 右、3 下（見 connector.ts）
const LEFT = 0, TOP = 1, RIGHT = 2, BOTTOM = 3;

const ROUNDING_TEXT: Record<string, string> = {
  'Math.round': '(取四捨五入)',
  'Math.ceil': '(取無條件進位)',
  'Math.floor': '(取無條件捨去)',
};

/** 運算子的優先順序，決定要不要加括號 */
const PREC: Record<string, number> = {
  or: 1, and: 2, '==': 3, '!=': 3, '<': 4, '<=': 4, '>': 4, '>=': 4, '+': 5, '-': 5, '*': 6, '/': 6, '%': 6,
};

/** 語法樹 → 學生寫的運算式；cond 時「等於」寫成 =（判斷、條件迴圈裡學生習慣的寫法） */
export function exprText(e: Expr, cond = false, parent = 0): string {
  switch (e.t) {
    case 'num': return e.v;
    case 'str': return e.v.includes('"') ? `'${e.v}'` : `"${e.v}"`;
    case 'var': return e.name;
    case 'raw': return e.text;
    case 'idx': return `${exprText(e.obj, cond, 9)}[${exprText(e.index, cond)}]`;
    case 'method': return `${exprText(e.obj, cond, 9)}.${e.name}(${e.args.map(a => exprText(a, cond)).join(', ')})`;
    case 'field': return `${exprText(e.obj, cond, 9)}.${e.name}`;
    case 'fcall': return `${e.name}(${e.args.map(a => exprText(a, cond)).join(', ')})`;
    case 'neg': return `-${exprText(e.a, cond, 7)}`;
    // not 後面除了單一個值都加括號：not (a > 5)，不然會被當成 (not a) > 5
    case 'not': return wrap(`not ${exprText(e.a, cond, 7)}`, 2.5, parent);
    case 'call': {
      const name = { len: '長度', find: '項目編號', has: '包含', stoi: 'stoi', tostr: 'to_string', max: 'max', min: 'min' }[e.fn];
      return `${name}(${e.args.map(a => exprText(a, cond)).join(', ')})`;
    }
    case 'bin': {
      const p = PREC[e.op];
      const op = e.op == '==' && cond ? '=' : e.op;
      return wrap(`${exprText(e.a, cond, p)} ${op} ${exprText(e.b, cond, p + 1)}`, p, parent);
    }
  }
}
const wrap = (code: string, p: number, parent: number) => (p < parent ? `(${code})` : code);

/** 還沒接上的線：從哪個積木的哪個連接點出去、線上的字，以及怎麼走到下一個積木（t 是目標上方的點） */
interface End {
  from: FlowNode;
  conn: number;
  label: string;
  route: (t: Point) => Point[];
}

type Item =
  /** ret：「回傳」積木，直接接到最後的「結束」 */
  | { kind: 'node'; node: FlowNode; ret?: boolean }
  | { kind: 'if'; dia: FlowNode; yes: Item[]; no: Item[] }
  | { kind: 'loop'; loop: FlowNode; body: Item[]; enter: string; exit: string };

/** 用結構重畫整個流程圖（會先清空）；變數表要先更新好，積木才記得用到哪些變數 */
export function buildFlowchart(d: Diagram, program: Stmt[], vars: VarStore) {
  d.clear();
  const connectors = createConnectors();

  const node = (text: string, figure: FigureName, data?: string): FlowNode => {
    const n = d.newNode(0, 0, 120, 80, connectors, text, figure, getCodeVar(vars, text), data);
    d.addNode(n);
    d.fitNode(n);
    return n;
  };

  // ---- 1. 建立積木（大小照字的長度） ----
  const items = (list: Stmt[]): Item[] => list.map(item);
  const item = (s: Stmt): Item => {
    switch (s.kind) {
      case 'input': {
        const k = s.index ? exprText(s.index) : '';
        const k2 = s.index2 ? `[${exprText(s.index2)}]` : '';
        const text = s.place == 'insert' ? `輸入 ${s.target} 插入第 ${k} 項` : s.place == 'replace' ? `輸入 ${s.target}[${k}]${k2}` : `輸入 ${s.target}`;
        return { kind: 'node', node: node(text, 'Parallelogram') };
      }
      case 'output':
        return { kind: 'node', node: node(`輸出 ${exprText(s.value)}`, 'Parallelogram') };
      case 'rect': {
        const v = s.value ? exprText(s.value) : '';
        const k = s.index ? exprText(s.index) : '';
        const k2 = s.index2 ? exprText(s.index2) : '';
        const text = {
          設為: ` ${s.target} 設為 ${v}`,
          加入: ` ${s.target} 加入 ${v}`,
          插入: ` ${s.target} 在第 ${k} 項插入 ${v}`,
          替換: ` ${s.target}[${k}]${k2 ? `[${k2}]` : ''} 設為 ${v}`,
          刪除: ` ${s.target} 刪除第 ${k} 項`,
          清空: ` ${s.target} 刪除所有項目`,
          建立: ` ${s.target} 建立 ${k} 列 ${k2} 行`,
          回傳: ` 回傳 ${v}`,
          放入: ` ${s.target} 放入 ${v}`,
          取出: ` ${s.target} 取出`,
          // 排序是另一種結構（kind: 'sort'），不會走到這裡
          排序: '',
        }[s.action] + (ROUNDING_TEXT[s.round] ?? '');
        return { kind: 'node', node: node(text, 'Rectangle', s.round) };
      }
      case 'if':
        return { kind: 'if', dia: node(exprText(s.cond, true), 'Diamond'), yes: items(s.yes), no: items(s.no) };
      case 'repeat':
        return { kind: 'loop', loop: node(`${exprText(s.times)}次`, 'For_Loop'), body: items(s.body), enter: '進入迴圈', exit: '離開迴圈' };
      case 'until':
        return { kind: 'loop', loop: node(exprText(s.cond, true), 'While_Loop'), body: items(s.body), enter: '假', exit: '真' };
      case 'call':
        return { kind: 'node', node: node(callText(s.name, s.args.map(a => exprText(a))), 'Function') };
      case 'return':
        return { kind: 'node', ret: true, node: node(` 回傳 ${exprText(s.value)}` + (ROUNDING_TEXT[s.round] ?? ''), 'Rectangle', s.round) };
      case 'sort':
        return { kind: 'node', node: node(` ${s.target} 排序${s.count ? ` 前 ${exprText(s.count)} 個` : ''}${s.field ? ` 依 ${s.field}` : ''} ${s.desc ? '由大到小' : '由小到大'}`, 'Rectangle') };
    }
  };
  /** 「回傳」積木：最後都接到「結束」 */
  const returnEnds: End[] = [];

  // ---- 2. 算每一塊要多寬 ----
  const seqWidth = (list: Item[]) => Math.max(0, ...list.map(width));
  /** 判斷左右兩邊各要多寬（從中線算起） */
  const sides = (it: Extract<Item, { kind: 'if' }>) => {
    const wy = it.yes.length ? seqWidth(it.yes) : EMPTY_BRANCH;
    const wn = it.no.length ? seqWidth(it.no) : EMPTY_BRANCH;
    // 兩邊的中線至少離開菱形的角，線才不會從菱形裡面穿過去
    const yesOffset = Math.max(it.dia.w / 2 + 20, wy / 2 + GAP_X / 2);
    const noOffset = Math.max(it.dia.w / 2 + 20, wn / 2 + GAP_X / 2);
    return { wy, wn, yesOffset, noOffset };
  };
  const width = (it: Item): number => {
    if (it.kind == 'node') return it.node.w;
    if (it.kind == 'loop') return Math.max(it.loop.w, seqWidth(it.body)) + 2 * LOOP_MARGIN;
    const s = sides(it);
    return 2 * Math.max(s.yesOffset + s.wy / 2, s.noOffset + s.wn / 2);
  };

  // ---- 3. 擺位置、接線 ----
  const at = (n: FlowNode, cx: number, y: number) => {
    n.x = cx - n.w / 2;
    n.y = y;
  };
  const mid = (n: FlowNode) => n.y + n.h / 2;
  const link = (from: FlowNode, fromConn: number, to: FlowNode, toConn: number, label: string, points: Point[]) => {
    const l = d.newLink(d.nodes.indexOf(from), d.nodes.indexOf(to), fromConn, toConn, label, 'straight');
    l.points = points;
    l.reSegment();
    d.links.push(l);
  };
  /** 從積木下方出去：同一條直線就直接往下，不然先往下、再橫著走到目標上方 */
  const fromBottom = (n: FlowNode) => (t: Point): Point[] => {
    const x = n.x + n.w / 2;
    return Math.abs(x - t.x) < 1 ? [] : [{ x, y: t.y }, { x: t.x, y: t.y }];
  };
  /** 把還沒接上的線都接到 n 的上方 */
  const connect = (ends: End[], n: FlowNode) => {
    const target = { x: n.x + n.w / 2, y: n.y - GAP_Y / 2 };
    for (const e of ends) link(e.from, e.conn, n, TOP, e.label, e.route(target));
  };

  /** 一串積木從 y 開始往下排，中線是 cx；回傳第一個積木、最後還沒接上的線、最下面的位置 */
  const placeSeq = (list: Item[], cx: number, y: number): { entry: FlowNode | null; ends: End[]; bottom: number } => {
    let entry: FlowNode | null = null;
    let ends: End[] = [];
    let bottom = y - GAP_Y;
    for (const it of list) {
      const r = place(it, cx, bottom + GAP_Y);
      if (!entry) entry = r.entry;
      else connect(ends, r.entry);
      ends = r.ends;
      bottom = r.bottom;
    }
    return { entry, ends, bottom };
  };

  const place = (it: Item, cx: number, y: number): { entry: FlowNode; ends: End[]; bottom: number } => {
    if (it.kind == 'node') {
      at(it.node, cx, y);
      const out: End = { from: it.node, conn: BOTTOM, label: '', route: fromBottom(it.node) };
      // 回傳：不接下一個積木，最後接到「結束」
      if (it.ret) {
        returnEnds.push(out);
        return { entry: it.node, ends: [], bottom: y + it.node.h };
      }
      return { entry: it.node, ends: [out], bottom: y + it.node.h };
    }

    if (it.kind == 'if') {
      const { dia } = it;
      at(dia, cx, y);
      const s = sides(it);
      const my = mid(dia);
      const branchY = y + dia.h + GAP_Y;
      const ends: End[] = [];
      let bottom = y + dia.h;
      const branch = (list: Item[], bx: number, conn: number, label: string) => {
        if (!list.length) {
          // 這一邊沒有積木：從菱形的角直接繞到匯合的地方
          ends.push({ from: dia, conn, label, route: t => [{ x: bx, y: my }, { x: bx, y: t.y }, { x: t.x, y: t.y }] });
          return;
        }
        const r = placeSeq(list, bx, branchY);
        link(dia, conn, r.entry!, TOP, label, [{ x: bx, y: my }]);
        ends.push(...r.ends);
        bottom = Math.max(bottom, r.bottom);
      };
      branch(it.yes, cx - s.yesOffset, LEFT, '真');
      branch(it.no, cx + s.noOffset, RIGHT, '假');
      return { entry: dia, ends, bottom };
    }

    // 迴圈
    const { loop } = it;
    at(loop, cx, y);
    const w = width(it);
    const my = mid(loop);
    const leftX = cx - w / 2 + 10;
    const rightX = cx + w / 2 - 10;
    const r = placeSeq(it.body, cx, y + loop.h + GAP_Y);
    link(loop, BOTTOM, r.entry!, TOP, it.enter, []);
    // 迴圈裡最後的積木：往下、往左、往上，接回迴圈的左邊
    const backY = r.bottom + GAP_Y / 2;
    for (const e of r.ends) {
      link(e.from, e.conn, loop, LEFT, e.label, [...e.route({ x: leftX, y: backY }), { x: leftX, y: my }]);
    }
    // 離開迴圈：從右邊出去，繞到下一個積木上方
    const exit: End = { from: loop, conn: RIGHT, label: it.exit, route: t => [{ x: rightX, y: my }, { x: rightX, y: t.y }, { x: t.x, y: t.y }] };
    return { entry: loop, ends: [exit], bottom: r.bottom + GAP_Y };
  };

  const body = items(program);
  const start = node('開始', 'Circle');
  const end = node('結束', 'Circle');
  const cx = Math.max(start.w, seqWidth(body)) / 2 + 40;
  at(start, cx, 30);
  const r = placeSeq(body, cx, 30 + start.h + GAP_Y);
  const startEnds: End[] = [{ from: start, conn: BOTTOM, label: '', route: fromBottom(start) }];
  if (r.entry) {
    connect(startEnds, r.entry);
    at(end, cx, r.bottom + GAP_Y);
    connect([...r.ends, ...returnEnds], end);
  }
  else {
    at(end, cx, 30 + start.h + GAP_Y);
    connect(startEnds, end);
  }
}
