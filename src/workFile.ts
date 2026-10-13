// 「尚未完成的作品」存檔格式：學生下載成 .json，下次匯入就能接著做
import type { VarRow } from './components/VarTable';
import { t } from './i18n';
import type { DiagramData } from './engine/diagram';

const APP = 'flowchart-worksheet';
const VERSION = 1;

export interface WorkFile {
  app: typeof APP;
  version: number;
  savedAt: string;
  /** 題目位置，例如 "114/3"（對應網址 ?w=114&h=3） */
  question: string;
  questionTitle: string;
  /** 存檔時在第幾步（0~3） */
  page: number;
  student: { className: string; number: string; name: string };
  /** 第一步：題目請你做什麼？／輸入值代表什麼？／輸出值代表什麼？ */
  step1: { note: string; hint: string; hint2: string };
  /** 第二步：三組測資，每組 [輸入, 輸出, 測試重點] */
  cases: string[][];
  /** 第三步：變數表 */
  variables: Omit<VarRow, 'id'>[];
  /** 第三步：流程圖 */
  flowchart: DiagramData;
}

export type WorkContent = Omit<WorkFile, 'app' | 'version' | 'savedAt'>;

export function makeWorkFile(content: WorkContent): WorkFile {
  return { app: APP, version: VERSION, savedAt: new Date().toISOString(), ...content };
}

/** 讀檔並檢查格式；不對時丟出看得懂的錯誤訊息 */
export function parseWorkFile(text: string): WorkFile {
  let data: unknown;
  try {
    data = JSON.parse(text);
  }
  catch {
    throw new Error(t('這不是作品檔（檔案內容不是 JSON）。', 'This is not a work file.'));
  }
  const w = data as Partial<WorkFile>;
  if (!w || w.app !== APP) throw new Error(t('這不是這個學習單匯出的作品檔。', 'This file is not from this worksheet.'));
  if (typeof w.version != 'number' || w.version > VERSION) throw new Error(t('這個作品檔的版本比網頁新，請重新整理網頁後再試一次。', 'This file is newer than this page. Reload the page and try again.'));
  if (!Array.isArray(w.cases) || !Array.isArray(w.variables) || !w.flowchart || !Array.isArray(w.flowchart.nodes)) {
    throw new Error(t('作品檔內容不完整，可能已經損壞。', 'This work file is broken.'));
  }
  return w as WorkFile;
}

/** 把作品存成 .json 下載 */
export function downloadWorkFile(work: WorkFile) {
  const who = work.student.className + work.student.number;
  const name = [work.questionTitle || work.question, who, t('未完成', 'unfinished')].filter(Boolean).join('_');
  const blob = new Blob([JSON.stringify(work, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name.replace(/[\\/:*?"<>|]/g, '') + '.json';
  a.click();
  URL.revokeObjectURL(url);
}

/** 選一個檔案並讀出文字；取消時回傳 null */
export function pickTextFile(): Promise<string | null> {
  return new Promise(resolve => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json,application/json';
    input.onchange = () => {
      const file = input.files?.[0];
      if (!file) return resolve(null);
      file.text().then(resolve, () => resolve(null));
    };
    input.oncancel = () => resolve(null);
    input.click();
  });
}

// 匯入別題的作品時，先暫存起來，切換到那一題後再讀進來
const PENDING_KEY = 'flowchart-pending-import';

export function stashPendingImport(work: WorkFile) {
  try {
    sessionStorage.setItem(PENDING_KEY, JSON.stringify(work));
    return true;
  }
  catch {
    return false;
  }
}

export function takePendingImport(): WorkFile | null {
  try {
    const text = sessionStorage.getItem(PENDING_KEY);
    if (!text) return null;
    sessionStorage.removeItem(PENDING_KEY);
    return parseWorkFile(text);
  }
  catch {
    return null;
  }
}
