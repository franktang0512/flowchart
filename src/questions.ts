// 題目資料：src/questions/<w>/<h>.json，網址 ?w=114&h=3 就載入 questions/114/3.json（跟舊版的網址一樣）
import type { VarType } from './engine/structure';
export interface TestCase {
  input: string;
  output: string;
  note: string;
}

export interface QuestionText {
  title: string;
  question: string;
  /** 題目附的表格（第一列通常是標題列） */
  array: string[][];
  /** 範例輸入輸出 */
  test_case: TestCase[];
}

export interface Question extends QuestionText {
  /** 英文版（國中 pre-A1 / A1 程度的英文） */
  en?: QuestionText;
  /**
   * C++：第三步變數表可以選哪些容器，例如 ["array"]（用 array 自己做 stack 的題目）、["stack", "queue"]。
   * 可以寫 "vector"、"2d_vector"、"array"、"stack"、"queue"、"struct"；沒寫就是都可以。數字、文字一定可以選
   */
  var_types?: string[];
}

const VAR_TYPE_KEYS: Record<string, VarType> = { vector: '清單', '2d_vector': '二維清單', array: '陣列', stack: '堆疊', queue: '佇列', struct: '結構' };

/** 這一題變數表可以選的容器；undefined 是都可以 */
export function allowedVarTypes(q: Question): VarType[] | undefined {
  if (!q.var_types) return undefined;
  return q.var_types.map(k => VAR_TYPE_KEYS[k.trim().toLowerCase()]).filter((x): x is VarType => x != null);
}

/** 依語言取題目內容，沒有英文就用中文 */
export const questionIn = (q: Question, lang: 'zh' | 'en'): QuestionText => (lang == 'en' && q.en ? q.en : q);

const files = import.meta.glob<Question>('./questions/**/*.json', { import: 'default' });

export const EMPTY_QUESTION: Question = { title: '', question: '', array: [], test_case: [] };

/** 依 "資料夾/檔名" 載入題目，找不到時回傳空題目 */
export async function loadQuestionByPath(path: string): Promise<Question> {
  const key = `./questions/${path}.json`;
  const load = files[key];
  if (!load) {
    console.error('找不到題目：' + key);
    return EMPTY_QUESTION;
  }
  return load();
}

export function loadQuestion(search: string): Promise<Question> {
  const params = new URLSearchParams(search);
  const w = params.get('w');
  const h = params.get('h');
  return loadQuestionByPath(w && h ? `${w}/${h}` : 'example');
}
