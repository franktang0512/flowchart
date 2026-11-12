// Scratch「建立函式」的視窗：照練習網頁（individual_demo）的「建立一個積木」——
// 上面填積木名稱，中間看得到積木長什麼樣子，下面按「添加輸入方塊」加參數；
// 加參數時先跳出型別選擇（數字或文字），再填參數名稱。點參數可以刪掉。
import { useEffect, useRef, useState } from 'react';
import { isName, type ParamInfo } from '../engine/modules';
import { t, useLang } from '../i18n';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type BlocklyModule = any;

interface Props {
  Blockly: BlocklyModule;
  theme: BlocklyModule;
  /** 已經有的函式名稱（不能重複） */
  existing: string[];
  onConfirm: (name: string, params: ParamInfo[]) => void;
  onCancel: () => void;
}

export function ScratchProcDialog({ Blockly, theme, existing, onConfirm, onCancel }: Props) {
  useLang();
  const [name, setName] = useState(t('新積木', 'new block'));
  const [params, setParams] = useState<ParamInfo[]>([]);
  /** 正在加參數：先選型別，再填名稱 */
  const [adding, setAdding] = useState<{ type: ParamInfo['type'] | null; name: string } | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const previewRef = useRef<HTMLDivElement>(null);
  const ws = useRef<BlocklyModule>(null);

  // 預覽：一塊「定義」積木，名稱、參數改了就重畫
  useEffect(() => {
    if (!previewRef.current) return;
    ws.current = Blockly.inject(previewRef.current, { readOnly: true, renderer: 'zelos', theme, move: { scrollbars: false, drag: false, wheel: false } });
    return () => {
      ws.current?.dispose();
      ws.current = null;
    };
  }, []);
  useEffect(() => {
    const w = ws.current;
    if (!w) return;
    w.clear();
    Blockly.serialization.blocks.append({ type: 'scratch_proc_def', extraState: { name: name.trim() || ' ', params }, x: 20, y: 30 }, w);
    w.scrollCenter();
  }, [name, params]);

  const nameError = (s: string, what: string) => (!s ? t(`請填${what}。`, `Fill in the ${what}.`)
    : !isName(s) ? t(`「${s}」不能當名稱：只能用中英文、數字和底線，不能有空白，也不能用數字開頭。`, `"${s}" cannot be a name. Use letters, numbers and _ only, with no spaces, and do not start with a number.`)
    : null);

  const addParam = () => {
    if (!adding?.type) return;
    const p = adding.name.trim();
    const why = nameError(p, t('參數名稱', 'parameter name'))
      ?? (params.some(x => x.name == p) ? t('參數名稱重複了。', 'Two parameters have the same name.') : null)
      ?? (p == name.trim() ? t('參數名稱不能跟積木名稱一樣。', 'A parameter cannot have the same name as the block.') : null);
    if (why) {
      setProblem(why);
      return;
    }
    setParams([...params, { name: p, type: adding.type }]);
    setAdding(null);
    setProblem(null);
  };

  const confirm = () => {
    const n = name.trim();
    const why = nameError(n, t('積木名稱', 'block name'))
      ?? (existing.includes(n) ? t(`已經有「${n}」這個積木了。`, `There is already a block called "${n}".`) : null)
      ?? (params.some(p => p.name == n) ? t('參數名稱不能跟積木名稱一樣。', 'A parameter cannot have the same name as the block.') : null);
    if (why) {
      setProblem(why);
      return;
    }
    onConfirm(n, params);
  };

  return (
    <div className="proc_overlay">
      <div className="proc_dialog" role="dialog" aria-label={t('建立一個積木', 'Make a block')}>
        <h5 className="proc_title">{t('建立一個積木', 'Make a block')}</h5>
        <label className="proc_label" htmlFor="proc_name">{t('積木名稱', 'Block name')}</label>
        <input id="proc_name" className="proc_name" value={name} onChange={e => setName(e.target.value)} autoFocus />

        <p className="proc_label">{t('參數列表（點一下可以刪掉）', 'Parameters (click to remove)')}</p>
        <ul className="proc_chips">
          {params.length == 0 && <li className="muted">{t('還沒有參數', 'No parameters yet')}</li>}
          {params.map(p => (
            <li key={p.name}>
              <button className="proc_chip" title={t('刪掉這個參數', 'Remove this parameter')} onClick={() => setParams(params.filter(x => x != p))}>
                {p.name}<span className="proc_chip_type">{p.type == '文字' ? t('文字', 'text') : t('數字', 'number')}</span> ×
              </button>
            </li>
          ))}
        </ul>

        <div className="proc_preview" ref={previewRef} />

        {adding
          ? (
            // 加參數：先選型別（跳出來的選擇），再填名稱
            <div className="proc_adding">
              {!adding.type
                ? (
                  <>
                    <p className="proc_label">{t('這個參數是什麼型別？', 'What type is this parameter?')}</p>
                    <div className="proc_types">
                      <button className="proc_big" onClick={() => setAdding({ ...adding, type: '數字' })}>
                        <span className="proc_big_main">{t('數字', 'Number')}</span>
                        <span className="proc_big_sub">{t('例如 次數、分數', 'like a count or a score')}</span>
                      </button>
                      <button className="proc_big" onClick={() => setAdding({ ...adding, type: '文字' })}>
                        <span className="proc_big_main">{t('文字', 'Text')}</span>
                        <span className="proc_big_sub">{t('例如 名字、一句話', 'like a name or a sentence')}</span>
                      </button>
                    </div>
                  </>
                )
                : (
                  <p className="proc_param_row">
                    <span className="proc_type_tag">{adding.type == '文字' ? t('文字', 'Text') : t('數字', 'Number')}</span>
                    <input
                      className="proc_param_name" placeholder={t('參數名稱', 'parameter name')} value={adding.name} autoFocus
                      onChange={e => setAdding({ ...adding, name: e.target.value })}
                      onKeyDown={e => { if (e.key == 'Enter') addParam(); }}
                    />
                    <button onClick={addParam}>{t('加入', 'Add')}</button>
                  </p>
                )}
              <button className="proc_cancel_add" onClick={() => { setAdding(null); setProblem(null); }}>{t('不加了', 'Never mind')}</button>
            </div>
          )
          : (
            <button className="proc_big proc_add" onClick={() => { setAdding({ type: null, name: '' }); setProblem(null); }}>
              <span className="proc_big_main">{t('添加輸入方塊', 'Add an input')}</span>
              <span className="proc_big_sub">{t('（參數）', '(parameter)')}</span>
            </button>
          )}

        {problem && <p className="run_error">{problem}</p>}
        <p className="proc_buttons">
          <button className="proc_cancel" onClick={onCancel}>{t('取消', 'Cancel')}</button>
          <button className="proc_ok" onClick={confirm}>{t('確定', 'OK')}</button>
        </p>
      </div>
    </div>
  );
}
