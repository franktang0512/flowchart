// 課程與題目清單：首頁列出課程，點進去依單元列出題目。
// 題目寫成 "資料夾/檔名"，對應 src/questions/資料夾/檔名.json，網址是 ?w=資料夾&h=檔名。
// 要調整課程名稱、單元、題目順序、隱藏某題，都只要改這個檔案。
import { link } from './i18n';
import type { Target } from './target';

export interface Unit {
  name: string;
  nameEn: string;
  questions: string[];
}

export interface Course {
  /** 網址用的代號：?course=<id> */
  id: string;
  name: string;
  nameEn: string;
  description?: string;
  /** 只給某個學習目標看（例如題目提示寫的是從第 1 項開始）；沒寫就是兩種都適用 */
  target?: Target;
  units: Unit[];
}

export const COURSES: Course[] = [
  {
    id: 'life',
    name: '生活中的解題', nameEn: 'Everyday Problem Solving',
    units: [
      { name: '輸出與輸入', nameEn: 'Output and input', questions: ['life/o1', 'life/io1', 'life/io2', 'life/io3'] },
      { name: '選擇結構（if、if / else）', nameEn: 'Decisions (if, if / else)', questions: ['life/if1', 'life/if2'] },
      { name: '多重條件（and、or）', nameEn: 'More than one condition (and, or)', questions: ['life/if3', 'life/if4'] },
      { name: '巢狀條件', nameEn: 'If inside if', questions: ['life/if5'] },
      { name: '次數迴圈', nameEn: 'Repeat n times', questions: ['life/f1', 'life/f2', 'life/f3'] },
      { name: '條件迴圈', nameEn: 'Repeat until', questions: ['life/w1', 'life/w2', 'life/w3'] },
      { name: '巢狀迴圈', nameEn: 'Loop inside a loop', questions: ['life/n1', 'life/n2'] },
      { name: '排序：泡泡排序', nameEn: 'Sorting: bubble sort', questions: ['life/sort1'] },
      { name: '搜尋：一個一個找、二分搜尋', nameEn: 'Searching: one by one, binary search', questions: ['life/find1', 'life/find2'] },
      { name: '挑戰：怎麼買最划算（背包問題）', nameEn: 'Challenge: the best plan (knapsack)', questions: ['life/bag1'] },
    ],
  },
  {
    // 高中進階：題目寫的是索引從 0 開始（C++）
    id: 'adv',
    name: '生活中的演算法', nameEn: 'Algorithms in Everyday Life',
    target: 'cpp',
    units: [
      { name: 'Stack（後進先出）', nameEn: 'Stack (last in, first out)', questions: ['adv/st1', 'adv/st2'] },
      { name: 'Queue（先進先出）', nameEn: 'Queue (first in, first out)', questions: ['adv/q1', 'adv/q2'] },
      { name: '排序', nameEn: 'Sorting', questions: ['adv/so1', 'adv/so2'] },
      { name: '搜尋', nameEn: 'Searching', questions: ['adv/se1'] },
      { name: '窮舉', nameEn: 'Brute force', questions: ['adv/b1', 'adv/b2'] },
      { name: '貪心', nameEn: 'Greedy', questions: ['adv/g1', 'adv/g2'] },
      { name: '動態規劃', nameEn: 'Dynamic programming', questions: ['adv/d1', 'adv/d2'] },
      { name: '樹', nameEn: 'Trees', questions: ['adv/t1'] },
      { name: '圖', nameEn: 'Graphs', questions: ['adv/gr1'] },
    ],
  },
  {
    id: '114',
    name: '信義國中 114 上學期', nameEn: 'Sinyi JHS · Fall 2025',
    units: [
      { name: '入門：輸出、四則運算、輸入與變數', nameEn: 'Start: output, math, input and variables', questions: ['114/0', '114/1', '114/2'] },
      { name: '循序結構（輸入、變數、四則運算）', nameEn: 'Step by step (input, variables, math)', questions: ['114/3', '114/4', '114/5', '114/6', '114/7'] },
      { name: '選擇結構（if / else）', nameEn: 'Decisions (if / else)', questions: ['114/8', '114/9', '114/10'] },
      { name: '巢狀條件', nameEn: 'If inside if', questions: ['114/11', '114/12', '114/13'] },
      { name: '迴圈', nameEn: 'Loops', questions: ['114/14', '114/15', '114/16', '114/17'] },
    ],
  },
  {
    id: 'list',
    name: '清單', nameEn: 'Lists',
    target: 'blocks',
    units: [
      { name: '認識清單', nameEn: 'Meet the list', questions: ['list/l1', 'list/l2'] },
      { name: '清單與迴圈', nameEn: 'Lists and loops', questions: ['list/l3', 'list/l4'] },
      { name: '插入與刪除', nameEn: 'Insert and remove', questions: ['list/l6', 'list/l7'] },
      { name: '文字也是一串字', nameEn: 'Text is a list of letters', questions: ['list/s1', 'list/s2'] },
      { name: '挑戰題', nameEn: 'Challenge', questions: ['list/l5', 'list/l8'] },
    ],
  },
  {
    id: 'nnjh',
    name: '暖暖高中', nameEn: 'Nuannuan High School',
    units: [
      { name: '變數與運算', nameEn: 'Variables and math', questions: ['nnjh/d1v1', 'nnjh/d1v2', 'nnjh/d1v3'] },
      { name: '輸入與輸出', nameEn: 'Input and output', questions: ['nnjh/d1p1', 'nnjh/d1p3'] },
      { name: '選擇結構', nameEn: 'Decisions', questions: ['nnjh/d1c1', 'nnjh/d1c2', 'nnjh/d1c3'] },
      { name: '巢狀條件', nameEn: 'If inside if', questions: ['nnjh/d1cn1', 'nnjh/d1cn2', 'nnjh/d1cn3'] },
      { name: '迴圈', nameEn: 'Loops', questions: ['nnjh/d1rc1', 'nnjh/d1rc2', 'nnjh/d1rc3'] },
      { name: '迴圈進階', nameEn: 'More loops', questions: ['nnjh/d1rcn1', 'nnjh/d1rcn2'] },
      { name: '挑戰題（一）', nameEn: 'Challenge 1', questions: ['nnjh/d2p11', 'nnjh/d2p12', 'nnjh/d2p13'] },
      { name: '挑戰題（二）', nameEn: 'Challenge 2', questions: ['nnjh/d2p21', 'nnjh/d2p22', 'nnjh/d2p23'] },
    ],
  },
  {
    id: '113',
    name: '113 上學期', nameEn: 'Fall 2024',
    units: [
      { name: '入門', nameEn: 'Start', questions: ['113-w1/h1', '113-w1/h2', '113-w1/h4', '113-w1/h3'] },
      { name: '成績及格判斷（11/06）', nameEn: 'Pass or fail (11/06)', questions: ['113-w1/h1106'] },
      { name: '選擇結構（11/27）', nameEn: 'Decisions (11/27)', questions: ['113-w1/h1127'] },
      { name: '巢狀結構（12/11）', nameEn: 'If inside if (12/11)', questions: ['113-w1/h12110', '113-w1/h12111'] },
    ],
  },
  {
    id: 'bank',
    name: '題庫', nameEn: 'Question Bank',
    units: [
      { name: '循序結構', nameEn: 'Step by step', questions: ['w1/h1', 'w1/h2', 'w1/h3'] },
      { name: '選擇結構', nameEn: 'Decisions', questions: ['w2/h1', 'w2/h2', 'w2/h3'] },
      { name: '巢狀條件', nameEn: 'If inside if', questions: ['w3/h1', 'w3/h2', 'w3/h3'] },
      { name: '迴圈（一）', nameEn: 'Loops 1', questions: ['ww1/h1', 'ww1/h2', 'ww1/h3'] },
      { name: '迴圈（二）', nameEn: 'Loops 2', questions: ['ww2/h1', 'ww2/h2'] },
      { name: '迴圈（三）', nameEn: 'Loops 3', questions: ['ww3/h1', 'ww3/h2', 'ww3/h3'] },
      { name: '迴圈（四）', nameEn: 'Loops 4', questions: ['ww4/h1', 'ww4/h2'] },
      { name: '期末', nameEn: 'Final', questions: ['final/h1', 'final/h2', 'final/h3', 'final/h4'] },
    ],
  },
];

/** 題目的網址 */
export const questionHref = (path: string) => {
  const [w, h] = path.split('/');
  return link(`?w=${encodeURIComponent(w)}&h=${encodeURIComponent(h)}`);
};
