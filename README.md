# 電子式學習單（流程圖）

學生用流程圖解題，依四個步驟完成一題，最後下載成 PDF 交作業：

1. **看題目**：讀題目、回答三個問題
2. **想測資**：自己寫幾組輸入和預期的輸出
3. **設計**：定義變數、畫流程圖（可以按「看程式」看流程圖變成的積木或程式）
4. **測試執行並除錯**：用自己的測資一步一步執行，看每個變數怎麼變

第一步和第二步在同一個畫面，還不能做的那一塊會用半透明灰色蓋住。

網址：https://franktang0512.github.io/flowchart/

## 目錄

- [學習目標](#學習目標)
- [課程](#課程)
- [操作](#操作)
- [C++ 可以用的功能](#c-可以用的功能)
- [Python 可以用的功能](#python-可以用的功能)
- [APCS 實作題](#apcs-實作題)
- [出題](#出題)
- [解答](#解答)
- [開發](#開發)

## 學習目標

首頁先選學習目標（或網址加 `?target=scratch`、`blockly`、`cpp`、`python`，見[網址](#網址)）。四種的積木操作一樣，可以用的型別和寫法照那個語言的規則：

| | Scratch | Blockly | C++ | Python |
| --- | --- | --- | --- | --- |
| 清單從哪裡開始 | 第 1 項 | 第 1 項 | 索引 0 | 索引 0 |
| 變數型別 | 數字、文字、清單 | 數字、文字、清單 | int、float、string、vector、stack… | int、float、str、list、deque… |
| 看程式 | Scratch 積木 | Blockly 積木 | C++ 程式碼 | Python 程式碼 |
| 模組 | 自訂積木，不能回傳 | 函式，可以回傳 | 函式，可以回傳 | 函式，可以回傳 |
| 模組在畫面上叫 | 模組 | 模組 | 模組/函式 | 模組/函式 |
| 輸入 | 一次讀一個值 | 一次讀一個值 | 一次讀一個值 | 一次讀一整行 |
| 輸入到檔案結束 | 沒有 | 沒有 | `while (cin >> a)` | `for line in sys.stdin:` |

題目和單元名稱也會照學習目標換說法：積木說「清單」、C++ 說「陣列」「vector」、Python 說「list」。

## 課程

課程、單元、題目順序寫在 [src/courses.ts](src/courses.ts)。

| 課程 | 學習目標 | 內容 |
| --- | --- | --- |
| 生活中的解題 | 都可以 | 輸入輸出、判斷、迴圈、清單、排序、搜尋 |
| 生活中的演算法 | C++ | 輸入到檔案結束（EOF）、stack、queue、排序、搜尋、窮舉、貪心、動態規劃、樹、圖 |
| 生活中的演算法（Python） | Python | 同上，題目改成 Python 的說法、輸入照行排 |
| 清單 | Scratch、Blockly | 清單的操作、清單搭配迴圈、插入刪除、文字 |
| 信義國中 114 上學期、暖暖高中、113 上學期、題庫 | 都可以 | 各學校的課程題目 |

每個單元先放「基本操作｜」的題目（看標題就知道在練什麼），後面才是有情境的題目；基本操作先用原生的做法（例如用 list 自己做 queue），再用函式庫。

## 操作

- **畫積木**：點工具再點畫布，或直接從左邊的工具列拖進畫布。
- **變數加減**：計算積木選「變數」→「改變（加多少）」，填 1 就是加 1、填 -1 就是減 1（Scratch 的「變數改變」、Blockly 的「將變數的值加」）。
- **一直輸入到沒有資料**（C++、Python）：迴圈積木選「一直輸入到沒有資料」，每一輪先讀一筆存進變數（可以一次讀好幾個），測資讀完就離開迴圈；積木上顯示「輸入 a（沒有資料了？）」，「真」離開、「假」進到迴圈裡。題目沒先給筆數、要讀到檔案結束時用。
- **縮放**：第三步、第四步的畫布右下角有「－ / 比例 / ＋」（30%～200%）；第三步也可以按住 Ctrl 滾動滑鼠滾輪。
- **第四步**：只能看、不能改，可以拖曳畫布；正在執行的積木跑出畫面會自動移過去。
- **執行時的檢查**：型別不對、清單超出範圍等錯誤會說明原因並標出積木；出錯前的每一步都還看得到。
- **執行的上限**：所有迴圈加起來最多跑 100 萬次（超過就當成停不下來）；第四步最多記錄 3000 步加上最後一步。
- **右上角「檔案」選單**：
  - **匯出尚未完成的作品**：下載 `.json`，包含班級座號姓名、三個問題、測資、變數表、流程圖、模組和目前在第幾步（格式見 [src/workFile.ts](src/workFile.ts)）。
  - **匯入作品資料**：選之前匯出的 `.json` 回到當時的狀態；是別題的作品時，會問要不要切換題目。
  - **下載 PDF（交作業）**：要先填班級、座號；題目一起印進去，流程圖照原本的大小，可以跨好幾頁。
  - **列印**：用瀏覽器的列印視窗。

## C++ 可以用的功能

學生大多用點的選：對話框選型別、選動作；算式欄位下面有「點一下填入」，選一個變數就列出 `s.top()`、`v.size()`、`e.from` 這些寫法。「看程式」只有用到才 `#include`。

### 型別

| 型別 | 說明 |
| --- | --- |
| `int`、`long long`、`float`、`string` | `int` 跟 C++ 一樣會溢位（超過約 21 億變成負的），`long long` 不會 |
| `array` | 大小固定（變數表填，或在流程圖中「建立」）；一開始每格是 0，不能加入、刪除 |
| `vector` | 添加、插入、替換、刪除、排序 |
| 二維 `vector` | 「建立 n 列 m 行」；「建立 n 列 0 行」再往某一列 `push_back`（鄰接串列） |
| `stack`、`queue` | `push`、`pop`、`top()`、`front()`、`back()`、`size()`、`empty()` |
| `priority_queue` | 選「大的先」或「小的先」（轉成 C++ 是 `greater`）；`push`、`pop`、`top()` |
| `set` | `insert`（不重複、自動由小到大）、`erase`、`clear`、`count()`、`size()` |
| `map` | 選「鍵 → 值」的型別；`m[k] = v`、`m[k]`、`erase`、`clear`、`count(k)`；讀還沒有的鍵會先放 0 |
| `struct` | 在變數表上面定義（欄位 int / float / string）；初始值可以填每個欄位；容器都可以裝（`set`、`priority_queue` 除外） |
| `pair` | `pair<int,int>`、`pair<long long,int>`、`pair<int,string>`、`pair<string,int>`、`pair<float,int>`；用 `p.first`、`p.second` |

勾「全域」的變數宣告在 main 外面，每個模組都用得到（遞迴的 DFS 靠它）。全域變數可以跟 main 的變數同名：main 用自己的，模組用全域的；main 裡要改被蓋住的全域變數，選 `::a（全域）`。

### 寫法

| 功能 | 寫法 |
| --- | --- |
| 排序 | 由小到大 / 由大到小；array 可以只排前 n 個；struct 依欄位排，可以一層一層加條件 |
| 最大、最小 | `max(a, b)`、`max(a, b, c)`；`max(v)` 是整個 vector / array 裡最大的 |
| 字串 | `s.length()`、`s.size()`、`s.substr(開始, 幾個字)`、`s[i]`、`stoi(s)`、`to_string(n)`；可以只改其中一個字 `s[i] = 'A'` |
| 字元 | `'a'`、`s[i] - '0'`、`'a' + k`、`char(x)`、`isdigit`、`isalpha`、`isupper`、`islower`、`toupper`、`tolower` |
| struct、pair | `e.from`、`edges[i].w`、`q.front().w`、`pq.top().second`；一整筆寫成 `{x, y}`，例如 `q.push({x, y})` |
| 二維 vector 的列 | `g[u].size()`、`g[u].empty()`、`g[u].push_back(v)` |
| 整數除法 | `int / int` 跟 C++ 一樣去掉小數 |
| 輸入到檔案結束 | `while (cin >> a)`、`while (cin >> a >> b)`：讀到一半沒資料了也是離開 |
| 判斷接判斷 | 「否則」裡面只有另一個判斷時，寫成 `else if` |

### 限制

- `map`、`set` 只能整個輸出，不能用 for 一個一個看；沒有 `begin()`、`find()`、`lower_bound()`。
- 型別轉換只有 `char(x)`，沒有 `(char)x`。
- `set`、`priority_queue` 不能裝自己定義的 struct（可以裝 pair）。
- 「一直輸入到沒有資料」只能讀進數字、文字變數；要存進 vector，迴圈裡再 `push_back`（`while (cin >> a[i])` 用 for 就好，不做）。
- `::a` 只能用在全域的數字、文字變數。
- struct 不能當模組的參數或回傳值、不能巢狀、不能整筆輸出或比大小。
- 模組的參數只能是數字、文字；要用陣列、圖，請勾成全域變數。
- `long long` 超過約 9×10¹⁵ 時，最後幾位會不準。
- `to_string` 有小數的寫到小數點後 6 位；剛好是整數的 float 會少寫 `.000000`。

## Python 可以用的功能

跟 C++ 一樣索引從 0 開始、變數表要選型別（Python 不用宣告型別，但選了型別，執行時才能檢查，轉程式時才知道一開始要寫 `a = []` 還是 `d = {}`）。積木裡的算式照 Python 的寫法。

### 型別

| 型別 | 對應 C++ | 說明 |
| --- | --- | --- |
| `int`、`float`、`str` | int、float、string | 整數不會溢位，所以沒有 long long |
| `list` | vector、array、stack | `append`、`insert`、`a[i] = …`、`pop(i)`、`pop()`、`clear()`、`sort()`、建立 n 格、整個換掉（`a = [1, -1, 0, 0]`）；`a[-1]` 是最後一個 |
| 二維 `list` | 二維 vector | 建立幾列幾行、改一格、某一列 `append`（鄰接串列） |
| `deque` | queue | `append`、`popleft()`、`q[0]`、`q[-1]` |
| `heapq` | priority_queue（小的先） | `heappush`、`heappop`、`h[0]`（只能看最小的）；要大的先就放 `-x` |
| `set` | set | `add`、`discard`、`clear()`、`x in s` |
| `dict` | map | `d[k] = v`、`del d[k]`、`d.get(k, 0)`、`k in d`；讀還沒有的鍵會出錯（KeyError）；照放進去的順序 |
| `tuple` | pair | `(a, b)`、`t[0]`、`t[1]`；比大小先比第一個；不能只改其中一個值 |

變數名稱可以用中文，第三步會提醒官方風格指南（PEP 8）建議用英文小寫加底線。struct 先不做（用 tuple 就夠）。

### 寫法

| 功能 | 寫法 |
| --- | --- |
| 運算 | `/` 一定算出小數（`6 / 2` 是 `3.0`），存進 int 會提醒改用 `//`；`//`、`%` 往小的方向（`-7 // 2` 是 -4）；`**` 次方 |
| 判斷 | `and`、`or`、`not`、`True`、`False`；`0 <= x < 10` 可以連著比；`x in a`、`x not in a` |
| list | `[1, 2, 3]`、`[0] * n`、`a + b` |
| 函式 | `len`、`int`、`str`、`float`、`max`、`min`、`sum`、`abs`、`ord`、`chr`、`round`（剛好一半取偶數） |
| 字串 | `s[i]`、`s[-1]`、`s[a:b]`、`s[::-1]`、`upper`、`lower`、`strip`、`replace`、`split`、`find`、`count`、`isdigit`、`isalpha`、`startswith`…、`"-" * 10`；文字和數字不能直接 `+`（要先 `str( )`） |
| for 迴圈 | `for i in range(n)`、`range(a, b)`、`range(a, b, -1)`、`for x in a`（list、字串、set、dict 的鍵） |
| 輸入 | 一個輸入積木讀一整行：變數（`int(input())`）、一行讀好幾個變數（`a, b = map(int, input().split())`）、一行照空白切開存進 list、二維 list 加一列、list / dict 的一格 |
| 輸入到檔案結束 | `for line in sys.stdin:`，下一行是 `a = int(line)`；一行好幾個是 `a, b = map(int, line.split())`；測資完全空白時一圈都不跑 |
| 判斷接判斷 | 「否則」裡面只有另一個判斷時，寫成 `elif` |
| 輸出 | 「輸出 a, b」用空白隔開；整個 list 是 `print(*a)`；勾「不換行」是 `print(..., end=" ")`；什麼都不填是 `print()` |
| 排序 | `a.sort()`、`reverse=True`；可以填 key：`a.sort(key=lambda x: len(x))` |
| 模組 | 寫成 `def`；看得到主流程的變數，改到時會寫 `global`；有遞迴時自動加 `sys.setrecursionlimit`（流程圖最多 3000 層） |
| 大測資 | 「看程式」勾「大測資用快速讀取」，改用 `sys.stdin` 讀 |

錯誤訊息照 Python 的說法（IndexError、KeyError、ZeroDivisionError、ValueError、EOFError），並說明怎麼改。

### 限制

- 沒有 f-string、list comprehension（`[x * 2 for x in a]`）、排序以外的 lambda。
- tuple 不能只改其中一個值（Python 本來就不行），要整個換掉。
- 超過約 9×10¹⁵ 的整數，網頁裡算不準，執行到這裡會停下來說明（真的 Python 可以）。
- for 的變數在迴圈裡不能改，迴圈結束後就沒有了（真的 Python 還留著最後的值）。

## APCS 實作題

學生可以先用流程圖規劃、一步一步看變數怎麼變，再用「看程式」轉成 C++ 或 Python。

| 題目程度 | 常見題型 | 現在 |
| --- | --- | --- |
| 第 1、2 題 | 輸入輸出、判斷、迴圈、陣列統計、找最大最小、排序、讀到檔案結束 | 可以 |
| 第 3 題 | 二維陣列、字串、字元、遞迴、排序、二分搜尋、前綴和、簡單 DP | 可以 |
| 第 4 題 | BFS / DFS、最短路徑、貪心、較難的 DP | 可以，但流程圖會很長，比較適合上課帶學生走一次原理 |

氣泡排序、二分搜尋、遞迴 DFS、迷宮 BFS、字元運算、計數、優先佇列都實際畫過流程圖跑過，轉出來的 C++（g++）和 Python 執行結果都跟流程圖一樣。流程圖適合上課用的小測資，APCS 正式的大測資要用真的 C++ 或 Python 跑。

## 出題

新增一題：在 `src/questions/資料夾/` 加一個 JSON 檔，再把 `"資料夾/檔名"` 加到 [src/courses.ts](src/courses.ts) 的某個單元。不想讓學生看到的題目，從課程拿掉就好（直接打網址還是進得去）。

```json
{
  "title": "郵資",
  "question": "題目敘述（純文字，\n 換行）",
  "array": [["重量限制", "郵資費用"], ["不逾5公斤", "70"]],
  "test_case": [
    { "input": "3\n2 3 5", "output": "210", "note": "說明" }
  ],
  "en": { "title": "…", "question": "…", "array": [], "test_case": [] }
}
```

- `array`（題目附表）與 `test_case` 的內容可以用 HTML（例如 `<br>`）；`en` 是英文版，沒有就顯示中文。
- **照學習目標換說法**：`cpp_title`、`cpp_question` 是 C++ 看的，`py_title`、`py_question` 是 Python 看的（`en` 裡也可以加）；沒寫就用 `title`、`question`。這樣積木、C++、Python 各自只看到自己的說法。
- **Python 的輸入**：Python 一次讀一整行，輸入要照行排時（例如一行一個），在測資加 `py_input`。
- **限制可以選的容器**：加 `var_types`，例如「用 array 自己做 stack」寫 `"var_types": ["array"]`（數字、文字一定可以選）。
  - C++：`vector`、`2d_vector`、`array`、`stack`、`queue`、`priority_queue`、`priority_queue_min`（小的先）、`set`、`map`、`struct`（含 pair）
  - Python：`list`、`2d_list`、`deque`、`heapq`、`set`、`dict`、`tuple`
- **單元名稱照學習目標換**：在 `courses.ts` 的單元加 `byTarget`，例如 `byTarget: { cpp: { name: '陣列與 vector', nameEn: 'Arrays and vectors' } }`。

## 解答

老師用的參考解答放在 [solutions/](solutions/)，都是作品檔（`.json`），「檔案 → 匯入作品資料」就能看，第四步可以直接跑測資。目錄和每一題的解法見 [solutions/README.md](solutions/README.md)。

```
solutions/
  課程代號/            跟網址 ?course= 一樣，例如 life、adv
    學習目標/          cpp、python、scratch、blockly
      序號_題目名稱.json  序號是題目在課程裡的順序
```

目前有「生活中的解題」和「生活中的演算法」的 C++ 解答。**repo 是公開的話，學生在 GitHub 上看得到這個資料夾**（網站本身不會放這些檔案）。

## 開發

```bash
npm install
npm run dev        # http://localhost:5173/?w=114&h=3
npm run build      # 輸出到 dist/，整個資料夾放到任何靜態網站即可（路徑是相對的）
```

推上 `main` 分支後，GitHub Actions 會自動打包並發布到 GitHub Pages（設定在 [.github/workflows/deploy.yml](.github/workflows/deploy.yml)）。第一次要到 GitHub 專案的 **Settings → Pages**，把 **Source** 選成 **GitHub Actions**。

### 網址

| 網址 | 頁面 |
| --- | --- |
| `./` | 選擇課程 |
| `?course=114` | 這門課的題目（依單元分組） |
| `?w=114&h=3` | 學習單，載入 `src/questions/114/3.json` |
| `?w=114&h=3&target=cpp` | 直接指定學習目標（`scratch`、`blockly`、`cpp`、`python`），學生就不用選 |
| `?course=adv&target=cpp` | 題目清單也可以加 `target`，學生從清單點進每一題都是 C++ |
| `?course=adv&target=cpp&lang=en` | 再加 `lang=en`：介面和題目用英文 |

給學生的連結加 `target` 就好：打開後同一個分頁會記住學習目標，在課程之間切換不用再選；開新分頁（例如 Ctrl + 點連結）會再問一次。

上課用的例子：

| 給學生的網址後面加 | 打開的是 |
| --- | --- |
| `?course=adv&target=cpp` | 「生活中的演算法」題目清單（C++） |
| `?course=py&target=python` | 「生活中的演算法（Python）」題目清單 |
| `?w=adv&h=eof1&target=cpp` | 直接打開「便利商店結帳」（C++） |
| `?w=life&h=w1&target=scratch` | 直接打開「存錢買遊戲機」（Scratch） |

### 程式結構

| 位置 | 內容 |
| --- | --- |
| `src/App.tsx` | 學習單畫面：四個步驟的切換、變數、測資、交作業 |
| `src/pages/Home.tsx` | 首頁：選學習目標、課程、題目清單 |
| `src/courses.ts` | 課程、單元、題目順序 |
| `src/questions.ts` | 載入題目、照學習目標換說法 |
| `src/target.ts` | 學習目標（Scratch、Blockly、C++、Python） |
| `src/style.css` | 所有樣式 |
| `src/components/` | 題目區、變數表、struct 定義、對話框、逐步執行區、看程式、列印畫面 |
| `src/nodeActions.ts` | 對話框按「確認」後新增或修改積木 |
| `src/engine/diagram.ts` | 流程圖畫布（積木、箭頭、滑鼠操作） |
| `src/engine/routing.ts` | 直角箭頭的路徑計算（從舊版原樣搬過來，請勿手動重排） |
| `src/engine/labels.ts` | 積木上顯示的字（照學習目標的寫法） |
| `src/engine/decoder.ts` | 檢查學生寫的運算式、把流程圖轉成程式並逐步執行 |
| `src/engine/structure.ts` | 流程圖、運算式整理成結構（看程式用） |
| `src/engine/toBlockly.ts` | 流程圖轉成 Scratch / Blockly 積木 |
| `src/engine/toCpp.ts` | 流程圖轉成 C++ |
| `src/engine/toPython.ts` | 流程圖轉成 Python |
| `src/engine/structs.ts` | struct 的定義、內建的 pair |
| `src/pdf.ts` | 交作業：列印畫面直接存成 PDF |
| `src/workFile.ts` | 尚未完成作品的存檔格式、匯出、匯入 |
| `src/engine/toFlowchart.ts` | 「看程式」的編輯模式：改過的積木畫回流程圖（自動排版） |
| `solutions/` | 老師用的參考解答（見[解答](#解答)） |
