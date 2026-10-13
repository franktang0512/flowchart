// 題目資料：src/questions/<w>/<h>.json，網址 ?w=114&h=3 就載入 questions/114/3.json（跟舊版的網址一樣）
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
