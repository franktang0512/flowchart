// 對話框按「確認」之後：新增或修改積木。檢查條件的順序與舊版相同（會影響跳出哪個提示）。
import type { DialogForm, DialogKind } from './components/NodeDialog';
import { createConnectors } from './engine/connector';
import { checkCall, checkMapKey, checkValueType, checkVar, getCodeVar, ptrDeleteOk, ptrTarget, ptrTargetOk, scopedName, splitField, type VarStore } from './engine/decoder';
import { eofText, eofVar, NO_NEWLINE, parseSortKeys, sortKeyExpr, sortKeysText, splitOutput, splitRectangle, splitTarget } from './engine/labels';
import { callText, newExprText, parseCall, splitNew, type ModuleInfo } from './engine/modules';
import { forInit, forUpdate, parseExpr, pyFor, splitFor } from './engine/structure';
import { getTarget, isPython } from './target';
import { splitArgs } from './engine/modules';
import type { Diagram } from './engine/diagram';
import type { FlowNode } from './engine/node';
import { isWhileMode } from './engine/loops';
import { t } from './i18n';
import { findStruct, getStructs } from './engine/structs';

const ROUNDING_TEXT: Record<string, string> = {
  'Math.round': '(取四捨五入)',
  'Math.ceil': '(取無條件進位)',
  'Math.floor': '(取無條件捨去)',
};

const sharedConnectors = createConnectors();

/** 「建立新的一筆」建立哪一種 struct：選過的；沒選就照存到的指標（跟對話框一樣），只有一種 struct 就是那一種 */
function newStruct(vars: VarStore, f: DialogForm): string {
  if (f.ptrStruct) return f.ptrStruct;
  const pt = ptrTarget(vars, f.ptrTarget);
  if (pt && 'ptr' in pt && pt.ptr.level == 1 && findStruct(pt.ptr.s)) return pt.ptr.s;
  const all = getStructs();
  return all.length == 1 ? all[0].name : '';
}

/**
 * 「建立新的一筆」：要選 struct，存到的地方要是指到這種 struct 的指標，每個填了的欄位型別要對
 * （沒填的欄位放預設值，之後可以再用「存一個值」改，例如 p->val 設為 x）
 */
function newNodeOk(vars: VarStore, modules: ModuleInfo[], f: DialogForm): boolean {
  const s = findStruct(newStruct(vars, f));
  const target = f.ptrTarget.trim();
  if (!s) {
    alert(t('請選要建立哪一種 struct。', 'Choose which struct to make.'));
    return false;
  }
  const pt = ptrTarget(vars, target);
  if (!pt || !('ptr' in pt) || pt.ptr.level != 1 || pt.ptr.s != s.name) {
    const kind = pt && 'ptr' in pt ? `${pt.ptr.s}${'*'.repeat(pt.ptr.level)}` : null;
    alert(t(`新的一筆 ${s.name} 要用 ${s.name}* 的指標記住，「${target}」${kind ? `是 ${kind}` : '不是指標'}。`, `A new ${s.name} must be kept in a ${s.name}* pointer. "${target}" ${kind ? `is a ${kind}` : 'is not a pointer'}.`));
    return false;
  }
  // 每個欄位：當成存到「target->欄位」來檢查（*pp 要加括號：(*pp)->val）
  const base = /^[\p{L}_][\p{L}\p{N}_]*$/u.test(target) ? target : `(${target})`;
  return s.fields.every((field, k) => {
    const v = f.ptrFields[k]?.trim() ?? '';
    return !v || (checkVar(vars, v, true) && checkValueType(vars, modules, `${base}->${field.name}`, v, 'var'));
  });
}

/** 計算積木的文字（格式見 splitRectangle）以及它用到的變數 */
function rectangleText(vars: VarStore, f: DialogForm) {
  const target = f.varSelect ? ' ' + f.varSelect : '';
  // 二維清單的一格：表[列][行]
  const cell = vars.type_var_list.grid.includes(f.varSelect.trim()) ? `[${f.rectIndex.trim()}][${f.rectIndex2.trim()}]` : `[${f.rectIndex}]`;
  // struct 的欄位：「 e.from 設為 x」「 edges[i].w 設為 x」（替換一格的某個欄位）
  const field = fieldTarget(f);
  // 二維 vector 的某一列後面添加：「 g[u] 加入 v」
  const rowPush = f.rectKind == '二維清單' && f.rectAction == '加入';
  let text = f.rectAction == '跳出' ? ' break' : f.rectAction == '下一輪' ? ' continue'
    // C++ 的指標：「 p->next 設為 head」「 *pp 設為 p->next」「 delete p」
    // 建立新的一筆：「 p 設為 new Node{x, nullptr}」（沒填的欄位放 0、""、nullptr）
    : f.rectKind == '指標' ? (f.rectAction == '釋放' ? ` delete ${f.ptrTarget.trim()}`
      : f.rectAction == '建立' ? ` ${f.ptrTarget.trim()} 設為 ${newExprText(newStruct(vars, f), f.ptrFields)}`
      : ` ${f.ptrTarget.trim()} 設為 ${f.code}`)
    : field ? ` ${field} 設為 ${f.code}`
    // C++ 的 string 只改其中一個字：「 s[i] 設為 'a'」
    : letterTarget(vars, f) ? ` ${letterTarget(vars, f)} 設為 ${f.code}`
    : rowPush ? `${target}[${f.rectIndex.trim()}] 加入 ${f.code}`
    // 排序：「 a 排序 前 n 個 依 w 由小到大」（前幾個、依欄位都可以沒有）
    // Python 的 key：「 a 排序 依 key: len(x) 由大到小」
    : f.rectAction == '排序' && isPython() && f.sortKey.trim() ? `${target} 排序${f.rectIndex.trim() ? ` 前 ${f.rectIndex.trim()} 個` : ''} 依 key: ${f.sortKey.trim()} ${f.sortDesc ? '由大到小' : '由小到大'}`
    : f.rectAction == '排序' ? `${target} 排序${f.rectIndex.trim() ? ` 前 ${f.rectIndex.trim()} 個` : ''}${sortKeysOf(vars, f).length ? ` 依 ${sortKeysText(sortKeysOf(vars, f))}` : ` ${f.sortDesc ? '由大到小' : '由小到大'}`}`
    : f.rectAction == '插入' ? `${target} 在第 ${f.rectIndex} 項插入 ${f.code}`
    : f.rectAction == '替換' ? `${target}${cell} 設為 ${f.code}`
    : f.rectAction == '刪除' ? `${target} 刪除第 ${f.rectIndex} 項`
    : f.rectAction == '清空' ? `${target} 刪除所有項目`
    : f.rectAction == '取出' ? `${target} 取出`
    // array 在流程圖中建立、Python 的 list 建立 n 格：「 a 建立大小 n」
    : f.rectAction == '建立' && (f.rectKind == '陣列' || f.rectKind == '清單') ? `${target} 建立大小 ${f.rectIndex.trim()}`
    : f.rectAction == '建立' ? `${target} 建立 ${f.rectIndex.trim()} 列 ${f.rectIndex2.trim()} 行`
    : f.rectAction == '回傳' ? ` 回傳 ${f.code}`
    : `${target} ${f.rectAction} ${f.code}`;
  const nodeVar = getCodeVar(vars, text);
  if (!nodeVar.includes(f.varSelect || '')) nodeVar.push(f.varSelect || '');
  // 刪除沒有值，不用捨去進位
  if (hasValue(f)) text += ROUNDING_TEXT[f.radio] ?? '';
  return { text, nodeVar };
}

/** C++ 的 string 只改其中一個字：s[i]；不是的話 null */
function letterTarget(vars: VarStore, f: DialogForm): string | null {
  const name = f.varSelect.trim();
  if (f.rectKind != '變數' || f.varChange || !f.rectIndex.trim() || !vars.type_var_list.text.includes(name)) return null;
  return `${name}[${f.rectIndex.trim()}]`;
}

/** 計算積木改的是 struct 的欄位：e.from 或 edges[i].w；不是的話 null */
function fieldTarget(f: DialogForm): string | null {
  if (!f.rectField) return null;
  if (f.rectKind == '結構') return `${f.varSelect.trim()}.${f.rectField}`;
  if ((f.rectKind == '清單' || f.rectKind == '陣列') && f.rectAction == '替換') return `${f.varSelect.trim()}[${f.rectIndex.trim()}].${f.rectField}`;
  // 二維 vector 的一格：g[u][k].w
  if (f.rectKind == '二維清單' && f.rectAction == '替換') return `${f.varSelect.trim()}[${f.rectIndex.trim()}][${f.rectIndex2.trim()}].${f.rectField}`;
  return null;
}

/** 排序的條件：裝 struct 的才有（依哪些欄位）；沒選欄位的那一列不算 */
function sortKeysOf(vars: VarStore, f: DialogForm) {
  // Python 用 key（lambda x: …），不用一個一個選欄位
  if (isPython()) return [];
  return isStructContainer(vars, f.varSelect.trim()) ? f.sortKeys.filter(k => k.field) : [];
}

/** 接收模組回傳值：變成一般的計算積木「a 設為 aaa(x)」（不捨去進位） */
function receiveForm(f: DialogForm, modules: ModuleInfo[]): DialogForm {
  if (f.rectKind != '接收') return f;
  const m = modules.find(x => x.name == f.moduleName);
  const args = m ? m.params.map((_, k) => (f.moduleArgs[k] ?? '').trim()) : [];
  return { ...f, rectAction: '設為', radio: '', code: callText(f.moduleName, args) };
}

/** 變數「改變」：變成「x 設為 x + 多少」（不捨去進位）；多少是算式時加括號，看程式時轉回「改變」積木 */
function changeForm(f: DialogForm): DialogForm {
  if (f.rectKind != '變數' || !f.varChange) return f;
  const by = f.code.trim();
  const simple = parseExpr(by).t != 'bin';
  return { ...f, rectAction: '設為', radio: '', code: `${f.varSelect.trim()} + ${simple ? by : `(${by})`}` };
}

/** 刪除第幾項、刪除所有項目、建立二維清單、pop、排序不用填值 */
const hasValue = (f: DialogForm) => !['刪除', '清空', '建立', '取出', '排序', '跳出', '下一輪', '釋放'].includes(f.rectAction) && f.rectKind != '指標';

function rectangleValid(vars: VarStore, f: DialogForm, modules: ModuleInfo[]) {
  if (!f.rectKind) {
    alert(t('請先選要改什麼：變數還是清單。', 'First choose what to change: a variable or a list.'));
    return false;
  }
  // 接收模組回傳值：模組、參數照「執行模組」的檢查，回傳值的型別要跟變數一樣
  if (f.rectKind == '接收') {
    const m = modules.find(x => x.name == f.moduleName && x.returns);
    if (!m) {
      alert(t('請選一個有回傳值的模組。', 'Choose a module that returns a value.'));
      return false;
    }
    const args = m.params.map((_, k) => (f.moduleArgs[k] ?? '').trim());
    if (!checkCall(vars, modules, m.name, args)) return false;
    if (!f.varSelect.trim()) {
      alert(t('請選回傳值要存到哪個變數。', 'Choose the variable to save the value in.'));
      return false;
    }
    return checkVar(vars, f.varSelect, false) && checkValueType(vars, modules, f.varSelect.trim(), callText(m.name, args), 'var');
  }
  if (f.rectKind == '變數' && f.varChange) {
    const name = f.varSelect.trim();
    if (!checkVar(vars, f.varSelect, false)) return false;
    if (!isNumberVar(vars, name)) {
      alert(t(`「${name}」不是數字變數：只有數字變數可以「改變」。`, `"${name}" is not a number variable. Only number variables can change by an amount.`));
      return false;
    }
    if (!f.code.trim()) {
      alert(t('請填要加多少。', 'Enter how much to add.'));
      return false;
    }
    return checkVar(vars, f.code, true) && checkValueType(vars, modules, name, f.code, 'var');
  }
  // break / continue：不用填什麼（只能用在迴圈裡，執行時檢查）
  if (f.rectKind == '迴圈控制') return true;
  // C++ 的指標：存到 p、p->next、p->val、*pp；delete p
  if (f.rectKind == '指標') {
    if (f.rectAction == '釋放') return ptrDeleteOk(vars, f.ptrTarget);
    if (!ptrTargetOk(vars, f.ptrTarget)) return false;
    if (f.rectAction == '建立') return newNodeOk(vars, modules, f);
    if (!f.code.trim()) {
      alert(t('請填要放什麼，例如 new Node{x, nullptr}、head、p->next、nullptr。', 'Enter what to store, like new Node{x, nullptr}, head, p->next or nullptr.'));
      return false;
    }
    return checkVar(vars, f.code, true) && checkValueType(vars, modules, f.ptrTarget.trim(), f.code, 'var');
  }
  // struct 的欄位：要先選變數和欄位（容器還要填索引），值的型別要跟欄位一樣
  if (f.rectKind == '結構' && !f.rectField) {
    alert(t('請選要改哪個欄位。', 'Choose a field.'));
    return false;
  }
  const field = fieldTarget(f);
  if (field) {
    if (!f.varSelect.trim()) {
      alert(t('請先選一個變數。', 'Choose a variable first.'));
      return false;
    }
    return checkVar(vars, field, false) && checkVar(vars, f.code, true) && checkValueType(vars, modules, field, f.code, 'var');
  }
  const letter = letterTarget(vars, f);
  if (letter) return checkVar(vars, letter, false) && checkVar(vars, f.code, true) && checkValueType(vars, modules, letter, f.code, 'var');
  // Python 的 list：整個換掉（例如 [1, 2, 3]），要放一個 list
  if (f.rectAction == '設為' && isPython() && f.rectKind == '清單') {
    if (!checkVar(vars, f.varSelect, false) || !checkVar(vars, f.code, true)) return false;
    return checkValueType(vars, modules, f.varSelect.trim(), f.code, 'var');
  }
  // Python 的 tuple 變數：整個換掉，要放同一種 tuple
  if (f.rectAction == '設為' && isPython() && vars.type_var_list.record.includes(f.varSelect.trim())) {
    return checkVar(vars, f.code, true) && checkValueType(vars, modules, f.varSelect.trim(), f.code, 'item');
  }
  if (f.rectAction == '設為') return checkVar(vars, f.code, true) && checkVar(vars, f.varSelect, false) && checkValueType(vars, modules, f.varSelect.trim(), f.code, 'var');
  if (f.rectAction == '回傳') return checkVar(vars, f.code, true);
  const list = f.varSelect.trim();
  // 排序：vector 或 array；裝 struct 的要選依哪個欄位；array 可以只排前幾個
  if (f.rectAction == '排序') {
    if (!vars.type_var_list.array.includes(list)) {
      alert(t('請選一個 vector 或 array。', 'Choose a vector or an array.'));
      return false;
    }
    // Python 的 key：x 是每一項
    if (isPython() && f.sortKey.trim()) {
      return checkVar({ ...vars, loopVars: [...(vars.loopVars ?? []), 'x'] }, f.sortKey, true) && (!f.rectIndex.trim() || checkVar(vars, f.rectIndex, true));
    }
    if (isStructContainer(vars, list)) {
      const fields = sortKeysOf(vars, f).map(k => k.field);
      // Python 的 tuple 沒選欄位：整個 tuple 比（先比第一個，一樣再比第二個）
      if (!fields.length && isPython()) return !f.rectIndex.trim() || checkVar(vars, f.rectIndex, true);
      if (!fields.length) {
        alert(t('裡面裝的是 struct：請選要依哪個欄位排序。', 'It holds structs. Choose the field to sort by.'));
        return false;
      }
      const twice = fields.find((x, k) => fields.indexOf(x) != k);
      if (twice) {
        alert(t(`「${twice}」選了兩次：每個欄位只要排一次。`, `"${twice}" is chosen twice. Use each field once.`));
        return false;
      }
    }
    return !f.rectIndex.trim() || checkVar(vars, f.rectIndex, true);
  }
  // 二維 vector 的某一列後面添加（鄰接串列）
  if (vars.type_var_list.grid.includes(list) && f.rectAction == '加入') {
    const row = `${list}[${f.rectIndex.trim()}]`;
    return checkVar(vars, f.rectIndex, true) && checkVar(vars, f.code, true) && checkValueType(vars, modules, row, f.code, 'item');
  }
  // 二維清單：建立（幾列幾行）、替換一格（第幾列第幾行）
  if (vars.type_var_list.grid.includes(list) && (f.rectAction == '建立' || f.rectAction == '替換')) {
    if (!checkVar(vars, f.rectIndex, true) || !checkVar(vars, f.rectIndex2, true)) return false;
    return !hasValue(f) || (checkVar(vars, f.code, true) && checkValueType(vars, modules, list, f.code, 'item'));
  }
  // Python：list 建立 n 格（a = [0] * n）
  if (f.rectAction == '建立' && f.rectKind == '清單' && isPython()) {
    if (!vars.type_var_list.array.includes(list)) {
      alert(t('請選一個 list。', 'Choose a list.'));
      return false;
    }
    if (!f.rectIndex.trim()) {
      alert(t('請填要建立幾格。', 'Enter how many items.'));
      return false;
    }
    return checkVar(vars, f.rectIndex, true);
  }
  if (f.rectAction == '建立' && f.rectKind != '陣列') {
    alert(t('請選一個二維清單。', 'Choose a 2D list.'));
    return false;
  }
  // stack、queue：push 要填值（型別要跟裡面裝的一樣），pop 不用
  if (f.rectKind == '堆疊' || f.rectKind == '佇列') {
    const kind = f.rectKind == '堆疊' ? 'stack' : 'queue';
    if (!vars.type_var_list[kind].includes(list)) {
      const name = isPython() ? 'deque' : kind;
      alert(t(`請選一個 ${name}。`, `Choose a ${name}.`));
      return false;
    }
    return !hasValue(f) || (checkVar(vars, f.code, true) && checkValueType(vars, modules, list, f.code, 'item'));
  }
  // set：insert、erase、clear；priority_queue：push、pop；map：m[鍵] = 值、erase、clear
  if (f.rectKind == '集合' || f.rectKind == '優先佇列' || f.rectKind == '對應表') {
    const kind = f.rectKind == '集合' ? 'set' : f.rectKind == '優先佇列' ? 'pq' : 'map';
    if (!vars.type_var_list[kind].includes(list)) {
      const name = isPython() ? ({ pq: 'heapq', map: 'dict', set: 'set' } as const)[kind] : kind == 'pq' ? 'priority_queue' : kind;
      alert(t(`請選一個 ${name}。`, `Choose a ${name}.`));
      return false;
    }
    if (f.rectAction == '清空' || f.rectAction == '取出') return true;
    if (kind == 'map') {
      if (!checkVar(vars, f.rectIndex, true) || !checkMapKey(vars, modules, list, f.rectIndex)) return false;
      return f.rectAction == '刪除' || (checkVar(vars, f.code, true) && checkValueType(vars, modules, list, f.code, 'item'));
    }
    const value = f.rectAction == '刪除' ? f.rectIndex : f.code;
    return checkVar(vars, value, true) && checkValueType(vars, modules, list, value, 'item');
  }
  // array：只能替換某一格（大小固定）
  if (f.rectKind == '陣列') {
    if (!vars.type_var_list.fixed.includes(list)) {
      alert(t('請選一個 array。', 'Choose an array.'));
      return false;
    }
    // 在流程圖中建立：變數表的大小要選「流程圖中建立」
    if (f.rectAction == '建立') {
      if (!vars.flowSized?.includes(list)) {
        alert(t(`「${list}」的大小在變數表已經固定了：要在流程圖中建立，請到變數表把大小改成「流程圖中建立」。`, `The size of "${list}" is already fixed in the table. To make it in the flowchart, change its size to "made in flowchart".`));
        return false;
      }
      return checkVar(vars, f.rectIndex, true);
    }
    return checkVar(vars, f.rectIndex, true) && checkVar(vars, f.code, true) && checkValueType(vars, modules, list, f.code, 'item');
  }
  if (!vars.type_var_list.array.includes(list)) {
    alert(t(`「${list}」不是清單：只有型別是「清單」的變數才能添加、插入、替換或刪除。`, `"${list}" is not a list. Only list variables can add, insert, replace or delete.`));
    return false;
  }
  const needIndex = f.rectAction == '插入' || f.rectAction == '替換' || f.rectAction == '刪除';
  if (needIndex && !checkVar(vars, f.rectIndex, true)) return false;
  return !hasValue(f) || (checkVar(vars, f.code, true) && checkValueType(vars, modules, list, f.code, 'item'));
}

/**
 * 輸入/輸出積木：回傳積木文字，檢查沒過回傳 null。輸入到清單的寫法：
 *   「輸入 清單」添加到最後、「輸入 清單 插入第 k 項」、「輸入 清單[k]」替換第 k 項
 */
function ioText(vars: VarStore, f: DialogForm, modules: ModuleInfo[] = []): string | null {
  if (f.radio == '輸入') {
    // Python：一行讀好幾個變數「輸入 a, b」
    if (f.ioTarget == '多個') {
      const names = f.ioMany.map(n => n.trim()).filter(Boolean);
      if (names.length < 2) {
        alert(t('一行讀好幾個：請至少選兩個變數。', 'Choose at least two variables.'));
        return null;
      }
      const twice = names.find((n, k) => names.indexOf(n) != k);
      if (twice) {
        alert(t(`「${twice}」選了兩次：每個變數只能選一次。`, `"${twice}" is chosen twice.`));
        return null;
      }
      return names.every(n => checkVar(vars, n, false)) ? '輸入 ' + names.join(', ') : null;
    }
    // Python：二維 list 讀一整行變成新的一列「輸入 g」
    if (f.ioTarget == '二維清單' && isPython() && f.ioPlace == '加入') {
      return checkVar(vars, f.varSelect, false) ? '輸入 ' + f.varSelect.trim() : null;
    }
    // 二維清單的一格：輸入 表[列][行]；裝 struct 的要選欄位：輸入 g[u][k].w
    if (f.ioTarget == '二維清單') {
      const holds = vars.var_list.value[vars.var_list.name.indexOf(f.varSelect.trim())];
      if (findStruct(holds) && !f.rectField) {
        alert(t('請選要輸入到哪個欄位。', 'Choose the field to input into.'));
        return null;
      }
      const text = `${f.varSelect.trim()}[${f.rectIndex.trim()}][${f.rectIndex2.trim()}]${findStruct(holds) ? `.${f.rectField}` : ''}`;
      return checkVar(vars, text, false) ? '輸入 ' + text : null;
    }
    // map 的一格：輸入 m[鍵]
    if (f.ioTarget == '對應表') {
      const name = f.varSelect.trim();
      if (!checkVar(vars, f.varSelect, false)) return null;
      return checkVar(vars, f.rectIndex, true) && checkMapKey(vars, modules, name, f.rectIndex) ? `輸入 ${name}[${f.rectIndex.trim()}]` : null;
    }
    // 裝 struct 的 stack、queue：不能一次輸入一整筆
    if ((f.ioTarget == '堆疊' || f.ioTarget == '佇列' || f.ioTarget == '集合' || f.ioTarget == '優先佇列') && findStruct(vars.var_list.value[vars.var_list.name.indexOf(f.varSelect.trim())])) {
      alert(t('裡面裝的是 struct，不能一次輸入一整筆：請先輸入到 struct 變數的欄位，再用計算積木 push 進去。', 'It holds structs, so you cannot input a whole one. Input into a struct variable\'s fields first, then push it with a Math block.'));
      return null;
    }
    if (!checkVar(vars, f.varSelect, false)) return null;
    // struct 的欄位：輸入 e.from；裝 struct 的容器一格的欄位：輸入 edges[i].w（一次只能輸入一個欄位）
    const holdsStruct = vars.type_var_list.record.includes(f.varSelect.trim()) || (f.ioTarget != '結構' && f.rectField != '') || isStructContainer(vars, f.varSelect.trim());
    if (holdsStruct) {
      if (!f.rectField) {
        alert(t('請選要輸入到哪個欄位。', 'Choose the field to input into.'));
        return null;
      }
      const text = f.ioTarget == '結構' ? `${f.varSelect.trim()}.${f.rectField}` : `${f.varSelect.trim()}[${f.rectIndex.trim()}].${f.rectField}`;
      return checkVar(vars, text, false) ? '輸入 ' + text : null;
    }
    // array：存到某一格（大小固定，不能加到最後）
    if (f.ioTarget == '陣列') return checkVar(vars, f.rectIndex, true) ? `輸入 ${f.varSelect}[${f.rectIndex.trim()}]` : null;
    // stack、queue：push 進去
    if (f.ioTarget != '清單' || f.ioPlace == '加入') return '輸入 ' + f.varSelect;
    if (!checkVar(vars, f.rectIndex, true)) return null;
    const k = f.rectIndex.trim();
    return f.ioPlace == '插入' ? `輸入 ${f.varSelect} 插入第 ${k} 項` : `輸入 ${f.varSelect}[${k}]`;
  }
  // 輸出模組回傳值：模組、參數照「執行模組」的檢查
  if (f.outputKind == '回傳') {
    const m = modules.find(x => x.name == f.moduleName && x.returns);
    if (!m) {
      alert(t('請選一個有回傳值的模組。', 'Choose a module that returns a value.'));
      return null;
    }
    const args = m.params.map((_, k) => (f.moduleArgs[k] ?? '').trim());
    return checkCall(vars, modules, m.name, args) ? '輸出 ' + callText(m.name, args) : null;
  }
  // Python：什麼都不填就是 print()（只換行）；不換行在後面加「(不換行)」
  if (isPython() && !f.varSelectOutput.trim()) {
    if (f.noNewline) {
      alert(t('不換行的話，要填要印什麼。', 'For no new line, enter what to print.'));
      return null;
    }
    return '輸出';
  }
  if (checkVar(vars, f.varSelectOutput, true)) {
    return f.radio + (f.varSelectOutput ? ' ' + f.varSelectOutput : '') + (isPython() && f.noNewline ? NO_NEWLINE : '');
  }
  return null;
}

/** 數字變數（包括 ::a：全域的數字變數 a） */
function isNumberVar(vars: VarStore, name: string) {
  const scoped = scopedName(name);
  return scoped != null ? !!vars.globalVars?.type_var_list.number.includes(scoped) : vars.type_var_list.number.includes(name);
}

/** 裝 struct 的 vector、array */
function isStructContainer(vars: VarStore, name: string) {
  const holds = vars.var_list.value[vars.var_list.name.indexOf(name)];
  return vars.type_var_list.array.includes(name) && findStruct(holds) != null;
}

/**
 * C++ 的 for 迴圈積木的字「for (int i = 0; i < n; i++)」；檢查沒過回傳 null。
 * 計數變數不用宣告，但不能跟變數表（參數、區域變數）同名
 */
function forText(vars: VarStore, f: DialogForm): string | null {
  const [a, b, c] = [f.forInit.trim(), f.forCond.trim(), f.forUpdate.trim()];
  if (!a || !b || !c) {
    alert(t('for 的三段都要填：點每一段右邊的寫法補上，再改成你要的。', 'Fill in all three parts of the for loop. Pick a pattern on the right, then change it.'));
    return null;
  }
  const init = forInit(a);
  if (!init) {
    alert(t('第一段要寫成「int i = 0」這樣（int、變數名稱、= 起始值）。', 'The first part must look like "int i = 0".'));
    return null;
  }
  const name = init.name;
  if (vars.var_list.name.includes(name)) {
    alert(t(`變數表（或參數、區域變數）已經有「${name}」了：for 的計數變數不用在變數表宣告，請換一個名字，或刪掉變數表裡的「${name}」。`, `"${name}" is already in the variable table (or a parameter). A for counter needs no declaration. Rename it, or delete "${name}" from the table.`));
    return null;
  }
  const next = forUpdate(c, name);
  if (next == null) {
    alert(t(`第三段要改「${name}」，例如 ${name}++、${name}--、${name} = ${name} + 1、${name} += 2。`, `The third part must change "${name}", like ${name}++, ${name}--, ${name} = ${name} + 1 or ${name} += 2.`));
    return null;
  }
  // 第二、三段可以用計數變數
  const inLoop: VarStore = { ...vars, loopVars: [...(vars.loopVars ?? []), name] };
  if (!checkVar(vars, init.start, true) || !checkVar(inLoop, b, true) || !checkVar(inLoop, next, true)) return null;
  return `for (${a}; ${b}; ${c})`;
}

/** Python 的 for 迴圈積木的字「for i in range(n)」「for x in a」；檢查沒過回傳 null */
function pyForText(vars: VarStore, f: DialogForm): string | null {
  const text = f.pyFor.trim().replace(/:\s*$/, '');
  const py = pyFor(text);
  if (!py) {
    alert(t('for 迴圈要寫成「for i in range(n)」「for i in range(1, n + 1)」或「for x in a」：點下面的寫法，再改成你要的。', 'Write the loop like "for i in range(n)", "for i in range(1, n + 1)" or "for x in a". Pick one below and change it.'));
    return null;
  }
  if (vars.var_list.name.includes(py.name)) {
    alert(t(`變數表（或參數、區域變數）已經有「${py.name}」了：for 的變數不用在變數表宣告，請換一個名字，或刪掉變數表裡的「${py.name}」。`, `"${py.name}" is already in the variable table. A for variable needs no declaration. Rename it, or delete "${py.name}" from the table.`));
    return null;
  }
  const parts = py.range ? [py.range.start, py.range.stop, py.range.step] : [py.iter!];
  return parts.every(p => checkVar(vars, p, true)) ? text : null;
}

/** 執行模組積木的文字「模組名稱(引數, …)」；檢查沒過回傳 null */
function callNodeText(vars: VarStore, modules: ModuleInfo[], f: DialogForm): string | null {
  const m = modules.find(x => x.name == f.moduleName);
  const args = m ? m.params.map((_, k) => (f.moduleArgs[k] ?? '').trim()) : [];
  return checkCall(vars, modules, f.moduleName, args) ? callText(f.moduleName, args) : null;
}

/** 在 (x, y) 新增積木 */
export function addMainNode(tool: string, d: Diagram, vars: VarStore, f: DialogForm, x: number, y: number, modules: ModuleInfo[] = []): boolean {
  const add = (text: string, figure: FlowNode['figure'], nodeVars?: string[], data?: string) => {
    const node = d.newNode(x, y, 120, 80, sharedConnectors, text, figure, nodeVars, data);
    d.addNode(node);
    d.fitNode(node);
    d.pause = false;
    d.draw();
    return true;
  };
  switch (tool) {
    case 'Circle':
      return add(f.radio, 'Circle');
    case 'Parallelogram': {
      const text = ioText(vars, f, modules);
      return text != null && add(text, 'Parallelogram', getCodeVar(vars, text));
    }
    case 'Diamond':
      return checkVar(vars, f.code, true) && add(f.code, 'Diamond', getCodeVar(vars, f.code));
    case 'Loop':
      if (f.radio == 'eof') {
        const text = eofLoopText(f);
        return text != null && add(text, 'While_Loop', getCodeVar(vars, text));
      }
      if (f.radio == 'cfor' || f.radio == 'pyfor') {
        const text = f.radio == 'pyfor' ? pyForText(vars, f) : forText(vars, f);
        return text != null && add(text, 'For_Loop', getCodeVar(vars, text));
      }
      if (checkVar(vars, f.forNumber, true) || checkVar(vars, f.code, true)) {
        const text = isCondLoop(f) ? f.code : f.forNumber + '次';
        return add(text, f.radio == 'for' ? 'For_Loop' : 'While_Loop', getCodeVar(vars, text), f.radio == 'whiletrue' ? 'while' : undefined);
      }
      return false;
    case 'Rectangle':
      if (rectangleValid(vars, f, modules)) {
        const g = changeForm(receiveForm(f, modules));
        const { text, nodeVar } = rectangleText(vars, g);
        return add(text, 'Rectangle', nodeVar, g.radio);
      }
      return false;
    case 'Function': {
      const text = callNodeText(vars, modules, f);
      return text != null && add(text, 'Function', getCodeVar(vars, text));
    }
    default:
      return false;
  }
}

/** 條件迴圈（條件成立才執行、達成條件就離開） */
const isCondLoop = (f: DialogForm) => f.radio == 'while' || f.radio == 'whiletrue';

/** 一直輸入到沒有資料的迴圈：「輸入 a 讀不到」；還沒選變數時提醒，回傳 null */
function eofLoopText(f: DialogForm): string | null {
  if (f.ioTarget == '多個') {
    const names = f.ioMany.map(n => n.trim());
    if (names.some(n => !n)) {
      alert(t('每一格都要選一個變數（用不到的格子按 ✕ 拿掉）。', 'Choose a variable in every box (remove unused ones with ✕).'));
      return null;
    }
    if (new Set(names).size != names.length) {
      alert(t('同一個變數選了兩次：每一格要選不同的變數。', 'The same variable is chosen twice. Choose different variables.'));
      return null;
    }
    return eofText(names.join(', '));
  }
  if (!f.varSelect) {
    alert(t('請選每一輪要輸入到哪個變數。', 'Choose the variable to input into each round.'));
    return null;
  }
  return eofText(f.varSelect);
}

/** 雙擊後修改積木 */
export function editMainNode(node: FlowNode, d: Diagram, vars: VarStore, f: DialogForm, modules: ModuleInfo[] = []): boolean {
  const done = () => {
    d.fitNode(node);
    d.pause = false;
    d.draw();
    return true;
  };
  switch (node.figure) {
    case 'Circle':
      node.text = f.radio;
      return done();
    case 'Parallelogram': {
      const text = ioText(vars, f, modules);
      if (text == null) return false;
      node.text = text;
      node.variables = getCodeVar(vars, text);
      return done();
    }
    case 'Diamond':
      if (!checkVar(vars, f.code, true)) return false;
      node.text = f.code;
      node.variables = getCodeVar(vars, f.code);
      return done();
    case 'For_Loop':
    case 'While_Loop': {
      if (f.radio == 'eof') {
        const text = eofLoopText(f);
        if (text == null) return false;
        node.figure = 'While_Loop';
        node.text = text;
        node.data = undefined;
        node.variables = getCodeVar(vars, text);
        return done();
      }
      if (f.radio == 'cfor' || f.radio == 'pyfor') {
        const text = f.radio == 'pyfor' ? pyForText(vars, f) : forText(vars, f);
        if (text == null) return false;
        node.figure = 'For_Loop';
        node.data = undefined;
        node.text = text;
        node.variables = getCodeVar(vars, text);
        return done();
      }
      const text = isCondLoop(f) ? f.code : f.forNumber + '次';
      node.figure = f.radio == 'for' ? 'For_Loop' : 'While_Loop';
      node.text = text;
      // 換成另一種條件迴圈時箭頭不動：通常是箭頭照心裡想的接好了、只是選錯種類（例如 while 卻選了重複直到）
      node.data = f.radio == 'whiletrue' ? 'while' : undefined;
      node.variables = getCodeVar(vars, text);
      return done();
    }
    case 'Rectangle': {
      if (!rectangleValid(vars, f, modules)) return false;
      const g = changeForm(receiveForm(f, modules));
      const { text, nodeVar } = rectangleText(vars, g);
      node.text = text;
      node.data = g.radio;
      node.variables = nodeVar;
      return done();
    }
    case 'Function': {
      const text = callNodeText(vars, modules, f);
      if (text == null) return false;
      node.text = text;
      node.variables = getCodeVar(vars, text);
      return done();
    }
    default:
      return false;
  }
}

/** 「x + 多少」：回傳多少（外面的括號拿掉）；不是這種寫法回傳 null */
function changeAmount(target: string, expr: string): string | null {
  const e = parseExpr(expr);
  if (e.t != 'bin' || e.op != '+' || e.a.t != 'var' || e.a.name != target) return null;
  const m = new RegExp('^\\s*' + target.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\s*\\+\\s*(.*)$', 's').exec(expr);
  if (!m) return null;
  const by = m[1].trim();
  return /^\(.*\)$/s.test(by) && parseExpr(by.slice(1, -1)).t == 'bin' ? by.slice(1, -1).trim() : by;
}

/** 整個算式就是執行一個有回傳值的模組（例如 aaa(x)）：回傳模組名稱和參數；不是的話 null */
function returningCall(expr: string, modules: ModuleInfo[]) {
  const call = parseCall(expr);
  if (!call || !modules.some(m => m.name == call.name && m.returns)) return null;
  if (call.args.some(a => parseExpr(a).t == 'raw')) return null;
  return callText(call.name, call.args).replace(/\s/g, '') == expr.replace(/\s/g, '') ? call : null;
}

/** 雙擊積木時：對話框種類與預先填好的內容 */
export function editDialogFor(node: FlowNode, modules: ModuleInfo[] = [], vars?: VarStore): { kind: DialogKind; initial: Partial<DialogForm> } {
  const text = node.text ?? '';
  switch (node.figure) {
    case 'Parallelogram': {
      const radio = text.substring(0, 2);
      const rest = text.substring(3);
      if (radio == '輸出') {
        // Python 的不換行：「輸出 x (不換行)」
        if (isPython() && splitOutput(rest).noNewline) {
          return { kind: 'Parallelogram', initial: { radio, ioText: '變數或字串：', varSelectOutput: splitOutput(rest).what, noNewline: true, varSelectOutputDisplay: 'inline-block', varSelectDisplay: 'none' } };
        }
        const call = returningCall(rest, modules);
        if (call) return { kind: 'Parallelogram', initial: { radio, ioText: '變數或字串：', outputKind: '回傳', moduleName: call.name, moduleArgs: call.args, varSelectOutputDisplay: 'inline-block', varSelectDisplay: 'none' } };
        return {
          kind: 'Parallelogram',
          initial: rest
            ? { radio, ioText: '變數或字串：', varSelectOutput: rest, varSelectOutputDisplay: 'inline-block', varSelectDisplay: 'none' }
            : { radio, ioText: '變數或字串：' },
        };
      }
      // Python：一行讀好幾個「輸入 a, b」
      const many = isPython() ? splitArgs(rest) : [];
      if (many.length > 1) return { kind: 'Parallelogram', initial: { radio, ioTarget: '多個', ioMany: many, varSelectDisplay: 'inline-block', varSelectOutputDisplay: 'none' } };
      // 輸入到清單的某一項：拆出清單和第幾項（存到變數還是清單，對話框再依變數表判斷）
      const insert = /^(.*?) 插入第 (.*) 項$/s.exec(rest);
      const item = splitTarget(rest);
      // 輸入到 struct 的欄位：e.from、edges[i].w
      const field = splitField(rest);
      const fieldItem = field && splitTarget(field.base);
      const place: Partial<DialogForm> = field ? (fieldItem?.indexes.length == 2
          ? { varSelect: fieldItem.name, ioTarget: '二維清單', rectIndex: fieldItem.indexes[0], rectIndex2: fieldItem.indexes[1], rectField: field.field }
          : fieldItem
          ? { varSelect: fieldItem.name, ioTarget: vars?.type_var_list.fixed.includes(fieldItem.name) ? '陣列' : '清單', ioPlace: '替換', rectIndex: fieldItem.indexes[0], rectField: field.field }
          : { varSelect: field.base.trim(), ioTarget: '結構', rectField: field.field })
        : insert ? { varSelect: insert[1].trim(), ioPlace: '插入', rectIndex: insert[2].trim() }
        : item?.indexes.length == 2 ? { varSelect: item.name, ioTarget: '二維清單', ioPlace: '替換', rectIndex: item.indexes[0], rectIndex2: item.indexes[1] }
        : item ? { varSelect: item.name, ioPlace: '替換', rectIndex: item.indexes[0] }
        : { varSelect: rest };
      return {
        kind: 'Parallelogram',
        initial: rest ? { radio, ...place, varSelectDisplay: 'inline-block', varSelectOutputDisplay: 'none' } : { radio },
      };
    }
    case 'Diamond':
      return { kind: 'Diamond', initial: { code: text } };
    case 'Function': {
      const call = parseCall(text);
      return { kind: 'Function', initial: call ? { moduleName: call.name, moduleArgs: call.args } : {} };
    }
    case 'For_Loop': {
      // Python 的 for i in range(n)、for x in a
      if (isPython() && pyFor(text)) return { kind: 'For_Loop', initial: { radio: 'pyfor', pyFor: text, showWhile: false } };
      // C++ 的 for (int i = 0; i < n; i++)
      const h = splitFor(text);
      if (h) return { kind: 'For_Loop', initial: { radio: 'cfor', forInit: h.init, forCond: h.cond, forUpdate: h.update, showWhile: false } };
      return { kind: 'For_Loop', initial: { radio: 'for', forNumber: text.substring(0, text.length - 1), showWhile: false } };
    }
    case 'While_Loop': {
      const ev = eofVar(text);
      if (ev != null) {
        const many = splitArgs(ev);
        return { kind: 'While_Loop', initial: many.length > 1 ? { radio: 'eof', ioTarget: '多個', ioMany: many, showWhile: false } : { radio: 'eof', ioTarget: '變數', varSelect: ev, showWhile: false } };
      }
      return { kind: 'While_Loop', initial: { radio: isWhileMode(node) ? 'whiletrue' : 'while', code: text, showWhile: true } };
    }
    case 'Rectangle': {
      const { target, action, index, index2, expr } = splitRectangle(text);
      if (action == '跳出' || action == '下一輪') return { kind: 'Rectangle', initial: { rectKind: '迴圈控制', rectAction: action } };
      // C++ 的指標：delete p、存到 p、*pp、p->next、p->val
      if (action == '釋放') return { kind: 'Rectangle', initial: { rectKind: '指標', rectAction: '釋放', ptrTarget: target } };
      if (action == '設為' && vars && getTarget() == 'cpp' && ptrTarget(vars, target)) {
        // new Node{…}：打開「建立新的一筆」，每個欄位放回它的格子
        const made = splitNew(expr);
        if (made && findStruct(made.sname)) return { kind: 'Rectangle', initial: { rectKind: '指標', rectAction: '建立', ptrTarget: target, ptrStruct: made.sname, ptrFields: made.values } };
        return { kind: 'Rectangle', initial: { rectKind: '指標', rectAction: '設為', ptrTarget: target, code: expr } };
      }
      // struct 的欄位：「 e.from 設為 x」「 edges[i].w 設為 x」
      const field = action == '設為' ? splitField(target) : null;
      if (field) {
        const item = splitTarget(field.base);
        return {
          kind: 'Rectangle',
          initial: {
            ...(node.data != null ? { radio: node.data } : {}),
            code: expr.split('(取')[0],
            rectField: field.field,
            ...(item?.indexes.length == 2
              ? { rectKind: '二維清單', rectAction: '替換', varSelect: item.name, rectIndex: item.indexes[0], rectIndex2: item.indexes[1] }
              : item
              ? { rectKind: vars?.type_var_list.fixed.includes(item.name) ? '陣列' : '清單', rectAction: '替換', varSelect: item.name, rectIndex: item.indexes[0] }
              : { rectKind: '結構', rectAction: '設為', varSelect: field.base.trim() }),
          },
        };
      }
      // 「a 設為 aaa(x)」：整個值就是執行一個有回傳值的模組（沒有捨去進位）→ 接收模組回傳值
      const call = action == '設為' && !node.data && !expr.includes('(取') ? returningCall(expr, modules) : null;
      // 「x 設為 x + 多少」（數字變數、沒有捨去進位）→ 變數「改變」
      const by = action == '設為' && !node.data && !expr.includes('(取') ? changeAmount(target, expr) : null;
      if (by != null && vars && isNumberVar(vars, target)) {
        return { kind: 'Rectangle', initial: { rectKind: '變數', rectAction: '設為', varChange: true, varSelect: target, code: by } };
      }
      if (call) {
        return { kind: 'Rectangle', initial: { rectKind: '接收', rectAction: '設為', varSelect: target, moduleName: call.name, moduleArgs: call.args } };
      }
      // C++ 的 string 只改其中一個字：「 s[i] 設為 'a'」
      if (action == '替換' && !index2 && vars?.type_var_list.text.includes(target)) {
        return { kind: 'Rectangle', initial: { ...(node.data != null ? { radio: node.data } : {}), rectKind: '變數', rectAction: '設為', varSelect: target, rectIndex: index, code: expr.split('(取')[0] } };
      }
      return {
        kind: 'Rectangle',
        initial: {
          // 舊資料沒有取整方式時，維持預設的「不需要」
          ...(node.data != null ? { radio: node.data } : {}),
          rectAction: action,
          ...(action == '排序' ? { sortKeys: index2 ? parseSortKeys(index2) : [], sortKey: (index2 && sortKeyExpr(index2)) ?? '', sortDesc: expr == '由大到小' } : {}),
          // 先選的那一層：變數、清單、二維清單（建立，或替換一格 表[列][行]）、回傳、array、stack、queue
          rectKind: vars?.type_var_list.map.includes(target) ? '對應表' : vars?.type_var_list.set.includes(target) ? '集合' : vars?.type_var_list.pq.includes(target) ? '優先佇列'
            // Python 的 list 整個換掉：「 a 設為 [1, 2, 3]」
            : action == '設為' && isPython() && vars?.type_var_list.array.includes(target) ? '清單'
            : action == '設為' ? '變數' : action == '回傳' ? '回傳'
            // Python 的 list 建立 n 格、pop()
            : (action == '建立' || action == '取出') && !index2 && isPython() && vars?.type_var_list.array.includes(target) ? '清單'
            : action == '建立' && !index2 ? '陣列' : action == '建立' || (action == '替換' && index2) ? '二維清單'
            : action == '放入' || action == '取出' ? (vars?.type_var_list.queue.includes(target) ? '佇列' : '堆疊')
            // 二維 vector 某一列 push_back：「 g[u] 加入 v」
            : action == '加入' && splitTarget(target) ? '二維清單'
            : vars?.type_var_list.fixed.includes(target) ? '陣列' : '清單',
          rectIndex: action == '加入' && splitTarget(target) ? splitTarget(target)!.indexes[0] : index,
          rectIndex2: action == '排序' ? '' : index2,
          varSelect: action == '加入' && splitTarget(target) ? splitTarget(target)!.name : target,
          code: expr.split('(取')[0],
        },
      };
    }
    default:
      return { kind: 'Circle', initial: { radio: text.substring(0, 2) } };
  }
}
