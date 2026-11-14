# 電子式學習單（流程圖）

學生依四個步驟完成一題：看題目 → 想測資 → 定義變數、設計流程 → 測試執行並除錯，最後列印成 PDF 交作業。第一步和第二步在同一個畫面，還不能做的那一塊會用半透明灰色蓋住。

學習目標可以選 **Scratch**、**Blockly** 或 **C++**（首頁選，或網址加 `?target=scratch` / `blockly` / `cpp`）。三種的積木操作一樣，但可以用的型別和寫法照那個語言的規則；C++ 的功能最多，見下面「C++ 可以用的功能」。

流程圖的積木可以點選工具再點畫布，也可以直接從左邊的工具列拖進畫布。

流程圖太大時可以縮小：第三步、第四步的畫布右下角有「－ / 比例 / ＋」（30%～200%），第三步也可以按住 Ctrl 滾動滑鼠滾輪。第四步只能看、不能改，但可以拖曳把流程圖移到想看的位置；換下一步時，正在執行的積木跑出畫面會自動移過去。

## 變數型別與清單

變數表的型別有「數字」「文字」「清單」（C++ 還有更多，見下面），第四步執行時會檢查：

- 文字存進數字變數（例如測資輸入 `abc`）→ 顯示錯誤並標出積木；數字存進文字變數 → 自動轉成文字。
- 文字變數的初始值沒加引號會自動加上。
- 同一個地方的變數不能同名（C++ 的全域變數和 main 的變數可以同名，見下面）。
- 清單一開始是空的，Scratch / Blockly 從第 1 項開始，C++ 從索引 0 開始：
  - `輸入 成績`：把讀到的值加到清單最後
  - `成績[i]`：讀第 i 項；計算積木 `成績[i] 設為 0`：改第 i 項
  - `長度(成績)`：清單有幾項，例如迴圈「長度(成績) 次」
  - `輸出 成績`：輸出清單裡全部的值（用空白隔開）

執行到一半出錯時，出錯前的每一步都還看得到，最後一步會標出出錯的積木。所有迴圈加起來最多跑 100 萬次（超過就當成停不下來）；第四步最多記錄 3000 步加上最後一步，步驟更多時會顯示「中間略過幾步」。

## C++ 可以用的功能

學生大多用點的選，不用自己打：對話框選型別、選動作；算式欄位下面有「點一下填入」，選一個變數就列出 `s.top()`、`v.size()`、`e.from` 這些寫法。第三步「看程式」會把流程圖轉成 C++，只有用到才 `#include`。

### 型別

| 型別 | 變數表怎麼設定 | 說明 |
| --- | --- | --- |
| `int`、`long long`、`float`、`string` | 選型別，填初始值 | `int` 跟 C++ 一樣會溢位（超過約 21 億變成負的），`long long` 不會 |
| `array` | 選裝什麼、填大小 | 大小固定，一開始每格是 0；不能加入、刪除 |
| `vector` | 選裝什麼 | 可以添加、插入、替換、刪除、排序 |
| 二維 `vector` | 選裝什麼 | 「建立 n 列 m 行」；也可以「建立 n 列 0 行」再往某一列 `push_back`（鄰接串列） |
| `stack`、`queue` | 選裝什麼 | `push`、`pop`、`top()`、`front()`、`back()`、`size()`、`empty()` |
| `priority_queue` | 選「大的先」或「小的先」、選裝什麼 | `push`、`pop`、`top()`、`size()`、`empty()`；小的先轉成 C++ 是 `greater` |
| `set` | 選裝什麼 | `insert`（不重複、自動由小到大）、`erase`、`clear`、`count()`、`size()`、`empty()` |
| `map` | 選「鍵 → 值」的型別（預設 string → int） | `m[k] = v`、`m[k]`、`erase`、`clear`、`count(k)`、`size()`；讀還沒有的鍵會先放 0（跟 C++ 一樣） |
| `struct` | 先在變數表上面定義 struct（欄位 int / float / string），型別選單直接選 | 初始值可以填每個欄位（點一下展開）；每一種容器都可以裝 struct（`set`、`priority_queue` 除外） |
| `pair` | 型別選單直接選 `pair<int,int>`、`pair<long long,int>`、`pair<int,string>`、`pair<string,int>` | 跟 struct 一樣用 `p.first`、`p.second`；每一種容器都可以裝，例如 `queue<pair<int,int>>` |

勾「全域」的變數宣告在 main 外面，每個模組（函式）都用得到，遞迴的 DFS、合併排序就靠它。全域變數和 main 的變數可以同名：main 用自己的，模組用全域的；main 裡要改被蓋住的全域變數，選單裡選 `::a（全域）`。

### 積木和算式

| 功能 | 寫法 |
| --- | --- |
| 排序 | 計算積木選「排序」：由小到大 / 由大到小；array 可以只排前 n 個；struct 依欄位排，可以一層一層加條件（分數由大到小，同分再依名字） |
| 最大、最小 | `max(a, b)`、`min(a, b)`、`max(a, b, c)`；`max(v)`、`min(v)` 是整個 vector / array 裡最大、最小的 |
| 字串 | `s.length()`、`s.size()`、`s.substr(開始, 幾個字)`、`s[i]`、`stoi(s)`、`to_string(n)`；計算積木選 string 變數再填索引，可以只改其中一個字 `s[i] = 'A'` |
| 字元 | `'a'`（單引號）、`s[i] - '0'`、`'a' + k`、`char(x)`、`isdigit`、`isalpha`、`isupper`、`islower`、`toupper`、`tolower`；跟 C++ 一樣，字元拿來算是數字（`'a' + 1` 是 98） |
| struct、pair 欄位 | `e.from`、`edges[i].w`、`g[u][k].to`、`q.front().w`、`pq.top().second` |
| 一整筆 pair / struct | `{x, y}`：照欄位的順序，例如 `q.push({x, y})`、`pq.push({d, v})`、`p 設為 {1, 2}` |
| 二維 vector 的列 | `g[u].size()`、`g[u].empty()`、「在某一列後面添加」（`g[u].push_back(v)`） |
| 整數除法 | `int / int` 跟 C++ 一樣去掉小數 |

### APCS 實作題能做到哪裡

| 題目程度 | 常見題型 | 現在 |
| --- | --- | --- |
| 第 1、2 題 | 輸入輸出、判斷、迴圈、陣列統計、找最大最小、排序 | 可以 |
| 第 3 題 | 二維陣列、字串、字元、遞迴、struct 排序、二分搜尋、前綴和、簡單 DP | 可以 |
| 第 4 題 | BFS / DFS、最短路徑、貪心、較難的 DP | 可以（BFS 用 `queue<pair<int,int>>`、Dijkstra 用 `priority_queue` 小的先、計數用 `map`），但流程圖會很長 |

氣泡排序、二分搜尋、遞迴 DFS、字元運算、map 計數、set、priority_queue、pair 都實際畫過流程圖跑過，轉出來的 C++ 用 g++ 編譯執行，結果跟流程圖一樣。

### 還不能做、或有限制的

- **`map`、`set` 的走訪**：只能整個輸出（map 一行一個「鍵 值」，set 由小到大），不能用 for 一個一個看；`begin()`、`find()`、`lower_bound()` 這類寫法還沒有。
- **型別轉換** 只有 `char(x)` 這種寫法，沒有 `(char)x`。
- **`set`、`priority_queue`** 不能裝自己定義的 struct（C++ 要另外寫比大小），可以裝 pair。
- **讀到輸入結束**（`while (cin >> x)`）還沒有，題目要先給筆數。
- **`::a`** 只能用在全域的數字、文字變數。
- **struct** 不能當模組的參數或回傳值，不能巢狀（欄位只能是 int / float / string），不能整筆輸出或比大小。
- **模組的參數** 只能是數字、文字；要用陣列、圖，請勾成全域變數。
- **`long long`** 在網頁裡超過約 9×10¹⁵ 時，最後幾位會不準。
- **`to_string`** 有小數的數字寫到小數點後 6 位（跟 C++ 一樣）；剛好是整數的 float 會少寫 `.000000`。
- **測資大小**：流程圖是在網頁裡一步一步執行，適合上課用的小測資；APCS 正式的大測資要用真的 C++ 跑。
- **流程圖大小**：第 4 題畫成流程圖會很長，比較適合上課帶學生走一次原理。

## 存檔（尚未完成的作品）

學習單右上角「檔案」選單：

- **匯出尚未完成的作品**：下載一個 `.json`，內容是班級座號姓名、第一步的三個問題、第二步的測資、第三步的變數表（含 struct 定義、全域、array 大小、欄位初始值）與流程圖（含箭頭標籤、直角箭頭的折點）、模組，以及存檔時在第幾步。
- **匯入作品資料**：選之前匯出的 `.json`，回到存檔時的狀態。如果檔案是別題的作品，會問要不要切換到那一題。
- **下載 PDF（交作業）**：要先填班級、座號。直接產生 PDF 檔（不用經過列印視窗），題目也一起印進去；流程圖照原本的大小，可以跨好幾頁，只在兩個積木中間換頁。
- **列印**：用瀏覽器的列印視窗。

存檔格式寫在 [src/workFile.ts](src/workFile.ts)。

## 開發

```bash
npm install
npm run dev        # http://localhost:5173/?w=114&h=3
npm run build      # 輸出到 dist/，整個資料夾放到任何靜態網站即可（路徑是相對的）
```

## 發布到 GitHub Pages

推上 `main` 分支後，GitHub Actions 會自動打包並發布（設定在 [.github/workflows/deploy.yml](.github/workflows/deploy.yml)）。
第一次要到 GitHub 專案的 **Settings → Pages**，把 **Source** 選成 **GitHub Actions**。
網址：https://franktang0512.github.io/flowchart/

## 網址

| 網址 | 頁面 |
| --- | --- |
| `./` | 選擇課程 |
| `?course=114` | 這門課的題目（依單元分組） |
| `?w=114&h=3` | 學習單，載入 `src/questions/114/3.json`（跟舊版網址相同） |
| `?w=114&h=3&target=cpp` | 直接指定學習目標（`scratch` / `blockly` / `cpp`），學生就不用選 |

## 課程

課程名稱、單元、題目順序都寫在 [src/courses.ts](src/courses.ts)。題目寫成 `"資料夾/檔名"`；不想讓學生看到的題目，從清單拿掉就好（直接打網址還是進得去）。

## 題目

新增題目只要加一個 JSON 檔，再把它加到 `src/courses.ts` 的某個單元裡：

```json
{
  "title": "郵資",
  "question": "題目敘述（純文字，\n 換行）",
  "array": [["重量限制", "郵資費用"], ["不逾5公斤", "70"]],
  "test_case": [
    { "input": "3\n2 3 5", "output": "210", "note": "說明" }
  ]
}
```

`array`（題目附表）與 `test_case` 的內容可以用 HTML（例如 `<br>`）。

C++ 的題目可以加 `var_types`，限制變數表能選哪些容器（數字、文字一定可以選）。例如「用 array 自己做 stack」的題目：

```json
"var_types": ["array"]
```

可以寫 `vector`、`2d_vector`、`array`、`stack`、`queue`、`priority_queue`、`priority_queue_min`（小的先）、`set`、`map`、`struct`（含 pair）；沒寫就是都可以。

## 程式結構

| 位置 | 內容 |
| --- | --- |
| `src/App.tsx` | 學習單畫面：四個步驟的切換、變數、測資、交作業 |
| `src/pages/Home.tsx` | 首頁：選課程、題目清單 |
| `src/style.css` | 所有樣式 |
| `src/components/` | 題目區、變數表、struct 定義（`StructTable.tsx`）、對話框、逐步執行區、列印畫面 |
| `src/engine/diagram.ts` | 流程圖畫布（積木、箭頭、滑鼠操作） |
| `src/engine/routing.ts` | 直角箭頭的路徑計算（從舊版原樣搬過來，請勿手動重排） |
| `src/engine/decoder.ts` | 檢查學生寫的運算式、把流程圖轉成程式並逐步執行 |
| `src/engine/structure.ts` | 流程圖、運算式整理成結構（看程式、轉 C++ 用） |
| `src/engine/toCpp.ts` | 流程圖轉成 C++ |
| `src/engine/structs.ts` | struct 的定義、內建的 pair |
| `src/pdf.ts` | 交作業：列印畫面直接存成 PDF |
| `src/nodeActions.ts` | 對話框按「確認」後新增或修改積木 |
| `src/workFile.ts` | 尚未完成作品的存檔格式、匯出、匯入 |
