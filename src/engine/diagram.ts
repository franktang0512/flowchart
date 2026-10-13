// 流程圖畫布：資料（積木、箭頭）＋滑鼠鍵盤操作（舊版的 model + mouse）。
// 第三步畫流程圖、第四步逐步執行都是同一份資料，只是畫在不同的 canvas 上。
import type { Anchor } from './anchor';
import { connectorState, createConnectors, type Connector } from './connector';
import type { FigureName } from './figures';
import { Link, type Point } from './link';
import { FlowNode } from './node';

export type LinkLabelKind = 'link_tf' | 'link_for';

export interface DiagramHooks {
  /** 從判斷或迴圈積木拉出箭頭時，詢問箭頭上的標籤；回傳 null 代表取消 */
  askLinkLabel(kind: LinkLabelKind): Promise<string | null>;
  /** 雙擊積木：開啟編輯視窗 */
  editNode(diagram: Diagram, index: number): void;
  /** 目前在工具列選的工具，用來決定新箭頭是直線(straight)還是直角(square) */
  selectedTool(): string;
}

/** 滑鼠在畫布上的座標（扣掉邊框，並換算成畫布內部的像素座標） */
export function canvasPoint(c: HTMLCanvasElement, ev: MouseEvent): Point {
  const rect = c.getBoundingClientRect();
  const scaleX = c.clientWidth ? c.width / c.clientWidth : 1;
  const scaleY = c.clientHeight ? c.height / c.clientHeight : 1;
  return {
    x: (ev.clientX - rect.left - c.clientLeft) * scaleX,
    y: (ev.clientY - rect.top - c.clientTop) * scaleY,
  };
}

export interface SavedNode {
  x: number;
  y: number;
  w: number;
  h: number;
  text: string;
  figure: FigureName;
  variables?: string[];
  data?: string;
}

export interface SavedLink {
  from: number;
  to: number;
  anchorFrom: number;
  anchorTo: number;
  text: string;
  mode: string;
  /** 直角箭頭的折點位置 */
  bends?: Point[];
}

export interface DiagramData {
  nodes: SavedNode[];
  links: SavedLink[];
}

type Dragging ='all' | 'newlink' | 'move' | 'anchor' | 'linkedit' | null | false;

interface NodeToMove {
  index: number;
  elemDragOrigin: Point;
}

export class Diagram {
  ctx!: CanvasRenderingContext2D;
  myCanvas!: HTMLCanvasElement;
  nodes: (FlowNode | null)[] = [];
  links: (Link | null)[] = [];
  copyNode: FlowNode | null = null;
  /** 逐步執行時要標紅的積木 index */
  stepHighlight: number | null = null;

  // ---- 滑鼠狀態（舊版的 mouse 物件）----
  dragging: Dragging = false;
  dragOrigin: Point = { x: 0, y: 0 };
  selNode: number | null = null;
  selAnchor: number | null = null;
  selConnector: number | null = null;
  selConnectorNode: number | null = null;
  selLink: number | null = null;
  linkDestNode: number | null = null;
  linkDestConnector: number | null = null;
  editText = false;
  /** 正在操作（拖曳、開著對話框）時為 true，此時點畫布不會新增積木 */
  pause = false;
  private nodesToMove: NodeToMove[] = [];
  private linksToMove: number[] = [];

  private readonly hooks: DiagramHooks;
  private readonly attached = new WeakSet<HTMLCanvasElement>();
  readonly getNodes = () => this.nodes;

  constructor(hooks: DiagramHooks) {
    this.hooks = hooks;
    document.addEventListener('keydown', this.keydown);
    // 畫布在畫面上的大小會跟著版面變（例如左邊變數表變長），
    // 內部像素大小要跟著改，不然圖會被拉伸，滑鼠也會對不到連接點
    this.resizeObserver = new ResizeObserver(() => {
      if (this.myCanvas && this.fitCanvasSize()) this.draw();
    });
  }

  private readonly resizeObserver: ResizeObserver;

  /** 讓畫布的內部像素大小等於畫面上的大小（不含邊框）；有改變時回傳 true */
  private fitCanvasSize() {
    const c = this.myCanvas;
    if (c.width == c.clientWidth && c.height == c.clientHeight) return false;
    c.width = c.clientWidth;
    c.height = c.clientHeight;
    return true;
  }

  // ---------------- 資料 ----------------

  newNode(x: number, y: number, w: number, h: number, connectors: Connector[], text: string, figure: FigureName, variables?: string[], data?: string) {
    return new FlowNode(x, y, w, h, connectors, text, 'white', figure, variables, data);
  }

  newLink(from: number, to: number, anchorFrom: number, anchorTo: number, text: string, mode?: string | null) {
    return new Link(this.getNodes, from, to, anchorFrom, anchorTo, text, mode);
  }

  addNode(node: FlowNode) {
    this.nodes.push(node);
  }

  addLink(link: Link) {
    for (const l of this.links) {
      if (l == null) continue;
      if (l.from == link.from && l.to == link.to && l.anchorFrom == link.anchorFrom && l.anchorTo == link.anchorTo) {
        console.log('There is already a link here!');
        return;
      }
    }
    const figure = this.nodes[link.from]?.figure;
    if ((figure == 'For_Loop' || figure == 'Diamond' || figure == 'While_Loop')) {
      this.hooks.askLinkLabel(figure == 'For_Loop' ? 'link_for' : 'link_tf').then(label => {
        if (label == null) return;
        link.text = label;
        this.links.push(link);
        this.draw();
      });
    }
    else {
      this.links.push(link);
    }
  }

  clean() {
    this.ctx.beginPath();
    const grd = this.ctx.createLinearGradient(0, this.myCanvas.height, this.myCanvas.width, 0);
    grd.addColorStop(0, '#eeeeee');
    grd.addColorStop(1, 'white');
    this.ctx.fillStyle = grd;
    this.ctx.fillRect(0, 0, this.myCanvas.width, this.myCanvas.height);
    this.ctx.stroke();
    // 線寬會殘留上一次畫的箭頭（2），不重設的話第一個積木的框線會比較粗
    this.ctx.lineWidth = 1;
  }

  clear() {
    this.nodes = [];
    this.links = [];
    this.clearMouse();
  }

  draw() {
    if (!this.ctx) return;
    this.clean();
    for (const node of this.nodes) {
      if (node) node.draw(this.ctx);
    }
    for (const link of this.links) {
      if (link) link.draw(this.ctx);
    }
    if (this.selNode != null && this.nodes[this.selNode] != null) {
      this.nodes[this.selNode]!.highlight(this.ctx);
    }
    if (this.stepHighlight != null) {
      this.nodes[this.stepHighlight]?.stepHighlight(this.ctx);
    }
  }

  /** 綁定（或換到）某個 canvas，並依外框大小設定畫布尺寸 */
  init(canvas: HTMLCanvasElement) {
    this.myCanvas = canvas;
    this.ctx = canvas.getContext('2d')!;
    if (!this.attached.has(canvas)) {
      this.attached.add(canvas);
      canvas.addEventListener('mousedown', this.down);
      canvas.addEventListener('mousemove', this.move);
      canvas.addEventListener('mouseup', this.up);
      canvas.addEventListener('dblclick', this.dblclick);
      canvas.ondragstart = () => false;
      this.resizeObserver.observe(canvas);
    }
    // 舊版每次切換步驟都會重設畫布（同時清空畫面），這裡維持一樣
    canvas.width = canvas.clientWidth;
    canvas.height = canvas.clientHeight;
  }

  findNode(mouseC: Point): number | null {
    let minArea = 34435345345344;
    let selIndex: number | null = null;
    this.nodes.forEach((node, index) => {
      if (node == null) return;
      if (node.isInside(mouseC.x, mouseC.y)) {
        const calcArea = node.w * node.h;
        if (calcArea < minArea) {
          selIndex = index;
          minArea = calcArea;
        }
      }
    });
    return selIndex;
  }

  /** 把流程圖畫成圖片（只裁出有東西的範圍，白底、不含選取框），交作業列印用；沒有積木時回傳 null */
  toImage(): string | null {
    const nodes = this.nodes.filter((n): n is FlowNode => n != null);
    if (!nodes.length) return null;
    const pad = 30;
    const points = this.links.flatMap(l => (l ? l.segments : []));
    const xs = [...nodes.flatMap(n => [n.x, n.x + n.w]), ...points.map(p => p.x)];
    const ys = [...nodes.flatMap(n => [n.y, n.y + n.h]), ...points.map(p => p.y)];
    const minX = Math.min(...xs) - pad, minY = Math.min(...ys) - pad;
    const c = document.createElement('canvas');
    c.width = Math.ceil(Math.max(...xs) + pad - minX);
    c.height = Math.ceil(Math.max(...ys) + pad - minY);
    const ctx = c.getContext('2d')!;
    ctx.fillStyle = 'white';
    ctx.fillRect(0, 0, c.width, c.height);
    ctx.translate(-minX, -minY);
    // 不畫連接點（選了箭頭工具時連接點才有半徑）
    const r = connectorState.r;
    connectorState.r = 0;
    nodes.forEach(n => n.draw(ctx));
    this.links.forEach(l => l?.draw(ctx));
    connectorState.r = r;
    return c.toDataURL('image/png');
  }

  /** 積木文字改了之後：放不下就把積木放大，相連的箭頭跟著重新計算 */
  fitNode(node: FlowNode) {
    if (!this.ctx) return;
    node.fitToText(this.ctx);
    const index = this.nodes.indexOf(node);
    this.links.forEach(l => { if (l && (l.from == index || l.to == index)) l.reSegment(); });
  }

  /** 匯出流程圖（存檔用）：刪掉的積木不存，箭頭的兩端改成新的編號 */
  exportData(): DiagramData {
    const newIndex = new Map<number, number>();
    const nodes: SavedNode[] = [];
    this.nodes.forEach((n, i) => {
      if (!n) return;
      newIndex.set(i, nodes.length);
      nodes.push({ x: n.x, y: n.y, w: n.w, h: n.h, text: n.text, figure: n.figure, variables: n.variables, data: n.data });
    });
    const links: SavedLink[] = [];
    for (const l of this.links) {
      if (!l || !newIndex.has(l.from) || !newIndex.has(l.to)) continue;
      links.push({
        from: newIndex.get(l.from)!, to: newIndex.get(l.to)!,
        anchorFrom: l.anchorFrom, anchorTo: l.anchorTo,
        text: l.text, mode: l.mode,
        bends: l.anchors.map(a => ({ x: a.x, y: a.y })),
      });
    }
    return { nodes, links };
  }

  /** 讀回存檔的流程圖（取代目前的內容） */
  loadData(data: DiagramData) {
    this.clear();
    const connectors = createConnectors();
    for (const n of data.nodes) {
      this.nodes.push(this.newNode(n.x, n.y, n.w, n.h, connectors, n.text, n.figure, n.variables, n.data));
    }
    for (const s of data.links) {
      if (!this.nodes[s.from] || !this.nodes[s.to]) continue;
      // 直接放進去，不經過 addLink（那裡會跳出選真假的對話框）
      const link = this.newLink(s.from, s.to, s.anchorFrom, s.anchorTo, s.text, s.mode);
      // 直角箭頭被學生拖過的折點，數量對得上才套用
      if (s.bends?.length && s.bends.length == link.anchors.length) {
        s.bends.forEach((b, i) => { link.anchors[i].x = b.x; link.anchors[i].y = b.y; });
        link.reSegment();
      }
      this.links.push(link);
    }
  }

  hasNodeWithText(text: string) {
    return this.nodes.some(n => n && n.text == text);
  }

  // ---------------- 滑鼠 ----------------

  clearMouse() {
    this.dragging = false;
    this.dragOrigin = { x: 0, y: 0 };
    this.selNode = null;
    this.selAnchor = null;
    this.selConnector = null;
    this.selLink = null;
    this.editText = false;
    this.pause = false;
  }

  private mouseCoords(ev: MouseEvent): Point {
    return canvasPoint(this.myCanvas, ev);
  }

  /** 畫布座標 → 螢幕座標（反向換算，給浮在畫布上的文字框定位用） */
  private toScreen(p: Point): Point {
    const c = this.myCanvas;
    const rect = c.getBoundingClientRect();
    return {
      x: rect.left + c.clientLeft + p.x * (c.width ? c.clientWidth / c.width : 1),
      y: rect.top + c.clientTop + p.y * (c.height ? c.clientHeight / c.height : 1),
    };
  }

  private down = (ev: MouseEvent) => {
    this.pause = true;
    if (this.editText) {
      this.editText = false;
      const ed = document.getElementById('tmpTextEdit');
      if (ed) ed.style.display = 'none';
    }
    const mouseC = this.mouseCoords(ev);
    const newselNode = this.findNode(mouseC);

    if (this.selConnector != null) {
      this.dragging = 'newlink';
      return;
    }
    if (this.selAnchor != null) {
      this.dragging = 'anchor';
      this.draw();
      return;
    }
    if (newselNode != null) {
      this.selNode = newselNode;
      const sel = this.nodes[this.selNode]!;
      this.dragOrigin = { x: mouseC.x - sel.x, y: mouseC.y - sel.y };
      sel.highlight(this.ctx);
      this.selAnchor = sel.nearestAnchor(mouseC);
      this.dragging = 'move';

      // 拖曳積木時，一起移動相連的箭頭，以及完全被它包住的其他積木
      this.nodesToMove = [];
      this.linksToMove = [];
      this.links.forEach((l, j) => {
        if (l && (l.to == this.selNode || l.from == this.selNode)) this.linksToMove.push(j);
      });
      this.nodes.forEach((element, i) => {
        if (element == null) return;
        const elemDragOrigin = { x: mouseC.x - element.x, y: mouseC.y - element.y };
        if (i != this.selNode && element.x >= sel.x && element.x + element.w <= sel.x + sel.w && element.y >= sel.y && element.y + element.h <= sel.y + sel.h) {
          this.nodesToMove.push({ index: i, elemDragOrigin });
          this.links.forEach((l, j) => {
            if (l && (l.to == i || l.from == i)) this.linksToMove.push(j);
          });
        }
      });
      this.draw();
    }
    else {
      if (this.selAnchor == null) {
        // 取消選取
        this.selNode = null;
        this.dragging = null;
        this.draw();
        setTimeout(() => { this.pause = false; }, 10);

        // 點到箭頭？
        for (let index = 0; index < this.links.length; index++) {
          const link = this.links[index];
          if (link == null) continue;
          if (link.isOverLink(mouseC)) {
            link.highlight(this.ctx);
            this.dragging = 'linkedit';
            this.selLink = index;
            break;
          }
        }
      }
      else {
        this.dragging = 'anchor';
        this.draw();
      }
    }

    if (this.dragging == null) {
      // 點在空白處：拖曳整張圖
      this.dragging = 'all';
      this.nodesToMove = [];
      this.nodes.forEach((element, i) => {
        if (element == null) return;
        this.nodesToMove.push({ index: i, elemDragOrigin: { x: mouseC.x - element.x, y: mouseC.y - element.y } });
      });
      this.links.forEach(link => {
        if (!link) return;
        link.anchors.forEach((anchor: Anchor) => {
          anchor.dragOrigin = { x: mouseC.x - anchor.x, y: mouseC.y - anchor.y };
        });
        link.reSegment();
      });
    }
  };

  private move = (ev: MouseEvent) => {
    const mouseC = this.mouseCoords(ev);
    switch (this.dragging) {
      case 'all':
        this.pause = true;
        this.nodesToMove.forEach(n => {
          const element = this.nodes[n.index]!;
          element.x = mouseC.x - n.elemDragOrigin.x;
          element.y = mouseC.y - n.elemDragOrigin.y;
        });
        this.links.forEach(link => {
          if (!link) return;
          link.anchors.forEach(anchor => {
            anchor.x = mouseC.x - anchor.dragOrigin.x;
            anchor.y = mouseC.y - anchor.dragOrigin.y;
          });
          link.reSegment();
        });
        this.draw();
        break;
      case 'newlink': {
        this.draw();
        this.ctx.beginPath();
        const aC = this.nodes[this.selConnectorNode!]!.connectorCoords(this.selConnector!);
        this.ctx.moveTo(aC.x, aC.y);
        this.ctx.lineTo(mouseC.x, mouseC.y);
        this.ctx.stroke();

        this.linkDestNode = null;
        // 找終點的連接點
        for (let j = 0; j < this.nodes.length; j++) {
          if (j == this.selConnectorNode) continue;
          const element = this.nodes[j];
          if (element == null) continue;
          const i = element.isInsideConnectors(mouseC);
          if (i != null) {
            const src = this.nodes[this.selConnectorNode!]!.connectors[this.selConnector!];
            if (element.connectors[i].options.dropAllowed && (element.connectors[i].mode != src.mode || element.connectors[i].mode == 'mixed')) {
              this.linkDestNode = j;
              this.linkDestConnector = i;
              element.connectors[i].highlight(this.ctx, element.x, element.y, element.w, element.h);
            }
            break;
          }
        }
        break;
      }
      case 'move': {
        const sel = this.nodes[this.selNode!]!;
        sel.x = mouseC.x - this.dragOrigin.x;
        sel.y = mouseC.y - this.dragOrigin.y;
        this.nodesToMove.forEach(n => {
          const element = this.nodes[n.index]!;
          element.x = mouseC.x - n.elemDragOrigin.x;
          element.y = mouseC.y - n.elemDragOrigin.y;
        });
        this.linksToMove.forEach(j => this.links[j]?.reSegment());
        this.draw();
        break;
      }
      case 'anchor':
        if (this.selNode != null) {
          this.resizeNode(this.nodes[this.selNode]!, mouseC);
        }
        else if (this.selLink != null) {
          const link = this.links[this.selLink]!;
          const anchor = link.anchors[this.selAnchor!];
          switch (anchor.cursorClass) {
            case 'w-resize':
              anchor.x = mouseC.x;
              break;
            case 'n-resize':
              anchor.y = mouseC.y;
              break;
          }
          link.reSegment();
        }
        this.links.forEach(l => {
          if (l && (l.to == this.selNode || l.from == this.selNode)) l.reSegment();
        });
        this.draw();
        break;
      default:
        if (this.selNode != null) {
          const element = this.nodes[this.selNode]!;
          // 滑鼠在縮放把手上？
          const i = element.isInsideAnchors(mouseC.x, mouseC.y);
          if (i != null) {
            this.selAnchor = i;
            this.myCanvas.style.cursor = element.anchors[i].cursorClass;
            element.anchors[i].highlight(this.ctx, element.x, element.y, element.w, element.h);
          }
          else {
            if (this.selAnchor != null) this.draw();
            this.selAnchor = null;
            this.dragging = null;
            this.myCanvas.style.cursor = 'auto';
          }
          this.hoverConnectors(mouseC);
        }
        else if (this.selLink != null) {
          const link = this.links[this.selLink];
          if (!link) break;
          const i = link.isInsideAnchors(mouseC.x, mouseC.y);
          if (i != null) {
            this.selAnchor = i;
            this.myCanvas.style.cursor = link.anchors[i].cursorClass;
          }
          else {
            if (this.selAnchor != null) this.draw();
            this.selAnchor = null;
            this.dragging = null;
            this.myCanvas.style.cursor = 'auto';
          }
        }
        else {
          this.hoverConnectors(mouseC);
        }
        break;
    }
  };

  /** 滑鼠移到連接點上就標出來，按下去就能拉箭頭 */
  private hoverConnectors(mouseC: Point) {
    for (let j = 0; j < this.nodes.length; j++) {
      const element = this.nodes[j];
      if (element == null) continue;
      const i = element.isInsideConnectors(mouseC);
      if (i != null && element.connectors[i].options.dragAllowed) {
        this.selConnector = i;
        this.selConnectorNode = j;
        element.connectors[i].highlight(this.ctx, element.x, element.y, element.w, element.h);
        return;
      }
    }
    this.selConnector = null;
    this.selConnectorNode = null;
    this.draw();
  }

  /** 拖曳四角把手縮放積木，最小 120x80 */
  private resizeNode(node: FlowNode, mouseC: Point) {
    const growLeft = () => {
      if (node.x - mouseC.x + node.w > 120) {
        node.w = node.x - mouseC.x + node.w;
        node.x = mouseC.x;
      }
    };
    const growRight = () => {
      if (mouseC.x - node.x > 120) node.w = mouseC.x - node.x;
    };
    const growUp = () => {
      if (node.y - mouseC.y + node.h > 80) {
        node.h = node.y - mouseC.y + node.h;
        node.y = mouseC.y;
      }
    };
    const growDown = () => {
      if (mouseC.y - node.y > 80) node.h = mouseC.y - node.y;
    };
    switch (node.anchors[this.selAnchor!].cursorClass) {
      case 'move':
        node.x = mouseC.x - this.dragOrigin.x;
        node.y = mouseC.y - this.dragOrigin.y;
        break;
      case 'w-resize': growLeft(); break;
      case 'e-resize': growRight(); break;
      case 'ne-resize': growRight(); growUp(); break;
      case 'se-resize': growRight(); growDown(); break;
      case 's-resize': growDown(); break;
      case 'sw-resize': growLeft(); growDown(); break;
      case 'nw-resize': growLeft(); growUp(); break;
      case 'n-resize': growUp(); break;
    }
  }

  private up = () => {
    if (this.dragging != null) {
      if (this.dragging == 'newlink') {
        if (this.linkDestNode != null) {
          this.addLink(this.newLink(this.selConnectorNode!, this.linkDestNode, this.selConnector!, this.linkDestConnector!, '', this.hooks.selectedTool()));
        }
        this.linkDestNode = null;
        this.selConnectorNode = null;
        this.selConnector = null;
        this.linkDestConnector = null;
        this.draw();
      }
      this.dragging = null;
      this.dragOrigin = { x: 0, y: 0 };
      this.selAnchor = null;
      this.selConnector = null;
    }
  };

  private keydown = (ev: KeyboardEvent) => {
    if (ev.keyCode == 46) {
      // Delete：刪除選取的積木（連同它的箭頭）或箭頭。
      // 刪掉的位置留 null，其他積木的 index 才不會跑掉（箭頭是用 index 記住兩端積木的）
      if (this.selNode != null) {
        this.links.forEach((l, index) => {
          if (l && (l.from == this.selNode || l.to == this.selNode)) this.links[index] = null;
        });
        this.nodes[this.selNode] = null;
        this.selNode = null;
        this.draw();
      }
      if (this.selLink != null) {
        this.links[this.selLink] = null;
        this.selLink = null;
        this.draw();
      }
    }
    if (ev.key == 'c' && ev.ctrlKey) {
      this.copyNode = this.selNode != null ? this.nodes[this.selNode] : null;
    }
    if (ev.key == 'v' && ev.ctrlKey && this.copyNode) {
      const c = this.copyNode;
      this.addNode(this.newNode(c.x + 30, c.y + 30, c.w, c.h, c.connectors, c.text, c.figure, c.variables ? [...c.variables] : undefined, c.data));
    }
  };

  private dblclick = () => {
    if (this.selNode != null) {
      this.pause = true;
      this.hooks.editNode(this, this.selNode);
    }
    if (this.selLink != null) {
      // 在箭頭文字的位置放一個小文字框直接改
      this.editText = true;
      const link = this.links[this.selLink];
      if (!link) return;
      const t = link.segments[link.indexText];
      const t0 = link.segments[link.indexText - 1];
      const x = (t.x + t0.x) / 2;
      const y = (t.y + t0.y) / 2;

      let ed = document.getElementById('tmpTextEdit') as HTMLTextAreaElement | null;
      if (!ed) {
        ed = document.createElement('textarea');
        ed.id = 'tmpTextEdit';
        ed.addEventListener('keyup', () => {
          const l = this.selLink != null ? this.links[this.selLink] : null;
          if (l) l.text = ed!.value;
        });
        document.body.appendChild(ed);
      }
      const s = this.toScreen({ x, y });
      Object.assign(ed.style, {
        display: 'block', position: 'absolute', margin: '0', padding: '0',
        left: s.x + window.scrollX - 100 + 'px', top: s.y + window.scrollY - 10 + 'px', width: '200px', height: '20px',
      });
      ed.value = link.text;
    }
  };
}
