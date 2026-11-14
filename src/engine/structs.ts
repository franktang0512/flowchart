// C++ 的 struct（結構）：學生在第三步定義，例如 Edge 有 from、to、w 三個欄位。
// 基礎版：欄位只能是 int、float、string；struct 可以當變數的型別，也可以裝在 array、vector 裡。
// 目前定義了哪些 struct 放在這裡（跟學習目標一樣是全域的），執行、檢查、轉程式都從這裡查。

export interface StructField {
  name: string;
  /** 數字（C++ 的 int，float 時是 float）或文字（string） */
  type: '數字' | '文字';
  float?: boolean;
  /** long long（只有內建的 pair 會用到） */
  long?: boolean;
}

export interface StructDef {
  /** 表格用的編號（存檔不用） */
  id: number;
  name: string;
  fields: StructField[];
}

let current: StructDef[] = [];

export const getStructs = () => current;

/** 名稱、欄位名稱有填的才算 */
export function setStructs(defs: StructDef[]) {
  current = defs
    .filter(d => d.name.trim() != '')
    .map(d => ({ ...d, name: d.name.trim(), fields: d.fields.filter(f => f.name.trim() != '').map(f => ({ ...f, name: f.name.trim() })) }));
}

/**
 * C++ 的 pair：內建的，不用自己定義，欄位是 first、second（例如 BFS 的座標、Dijkstra 的 {距離, 點}）。
 * 跟 struct 一樣用（p.first、q.front().second），也可以裝在每一種容器裡
 */
export const PAIR_TYPES = ['pair<int,int>', 'pair<long long,int>', 'pair<int,string>', 'pair<string,int>'];
const CPP_FIELD = /^pair<(int|long long|float|string),(int|long long|float|string)>$/;
const pairField = (name: string, cpp: string): StructField => ({ name, type: cpp == 'string' ? '文字' : '數字', ...(cpp == 'float' ? { float: true } : {}), ...(cpp == 'long long' ? { long: true } : {}) });
function pairOf(name: string): StructDef | undefined {
  const m = CPP_FIELD.exec(name.replace(/\s+/g, ' ').replace(/\s*([<>,])\s*/g, '$1'));
  return m ? { id: -1, name, fields: [pairField('first', m[1]), pairField('second', m[2])] } : undefined;
}
/** 是不是內建的 pair */
export const isPair = (name: string | undefined) => !!name && pairOf(name) != null;

export const findStruct = (name: string | undefined) => (name ? current.find(s => s.name == name) ?? pairOf(name) : undefined);

/** 自己定義的 struct 加上內建的 pair（執行時要知道每一種的欄位） */
export const allStructs = (): StructDef[] => [...current, ...PAIR_TYPES.map(n => pairOf(n)!)];

/** 欄位的 C++ 型別 */
export const fieldCppType = (f: StructField) => (f.type == '文字' ? 'string' : f.float ? 'float' : f.long ? 'long long' : 'int');

/** 欄位一開始的值：數字是 0，文字是空的 */
export const fieldInit = (f: StructField) => (f.type == '文字' ? '' : 0);
