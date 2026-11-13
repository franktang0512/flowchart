// C++ 的 struct（結構）：學生在第三步定義，例如 Edge 有 from、to、w 三個欄位。
// 基礎版：欄位只能是 int、float、string；struct 可以當變數的型別，也可以裝在 array、vector 裡。
// 目前定義了哪些 struct 放在這裡（跟學習目標一樣是全域的），執行、檢查、轉程式都從這裡查。

export interface StructField {
  name: string;
  /** 數字（C++ 的 int，float 時是 float）或文字（string） */
  type: '數字' | '文字';
  float?: boolean;
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

export const findStruct = (name: string | undefined) => (name ? current.find(s => s.name == name) : undefined);

/** 欄位的 C++ 型別 */
export const fieldCppType = (f: StructField) => (f.type == '文字' ? 'string' : f.float ? 'float' : 'int');

/** 欄位一開始的值：數字是 0，文字是空的 */
export const fieldInit = (f: StructField) => (f.type == '文字' ? '' : 0);
