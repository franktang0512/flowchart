// 交作業時的列印畫面（瀏覽器列印存成 PDF）
export interface PrintData {
  className: string;
  number: string;
  name: string;
  questionName: string;
  questionNote: string;
  /** [名稱, 型別, 初始值, 說明] */
  /** [名稱, 型別（已經寫成給學生看的名稱）, 初始值, 說明] */
  vars: string[][];
  /** [輸入, 輸出, 測試重點] */
  cases: string[][];
  /** 題目內容（敘述、附表、範例），跟題目區一樣（照現在的語言） */
  question?: QuestionText;
}

import { t, useLang } from '../i18n';
import type { QuestionText } from '../questions';

// 題目附表與範例的內容是老師寫的 HTML（有些題目用 <br> 換行），跟題目區一樣直接當 HTML 顯示
const html = (s: string) => ({ dangerouslySetInnerHTML: { __html: s } });


/** capture：產生 PDF 用，畫在畫面外面、固定寬度（學生看不到，產生完就收起來） */
/** 流程圖圖片：data-cuts 是可以切開換頁的位置（兩個積木中間），下載 PDF 時用 */
type FlowImage = { src: string; cuts: number[] };

export function PrintView({ visible, capture = false, data, imgSrc, modules }: { visible: boolean; capture?: boolean; data: PrintData | null; imgSrc: FlowImage | undefined; modules: ({ title: string } & FlowImage)[] }) {
  useLang();
  return (
    <div id="print" className={capture ? 'pdf_capture' : undefined} style={{ display: visible ? 'block' : 'none' }}>
      <div className="print_head">
        {t('班級：', 'Class: ')}<span id="print_class">{data?.className}</span>
        {t('座號：', 'No.: ')}<span id="print_number">{data?.number}</span>
        {t('姓名：', 'Name: ')}<span id="print_name">{data?.name}</span>
      </div>
      <table className="my_table" rules="all">
        <tbody>
          <tr>
            <th>{t('題目名稱', 'Problem')}</th>
            <td id="print_question_name">{data?.questionName}</td>
          </tr>
          {data?.question && (
            <tr>
              <th>{t('題目內容', 'Problem')}</th>
              <td>
                <div className="print_question">{data.question.question.trimEnd()}</div>
                {data.question.array.length > 0 && (
                  <table className="print_table" rules="all">
                    <tbody>
                      {data.question.array.map((row, i) => (
                        <tr key={i}>{row.map((cell, j) => <td key={j} {...html(cell)} />)}</tr>
                      ))}
                    </tbody>
                  </table>
                )}
                {data.question.test_case.length > 0 && (
                  <table className="print_table" rules="all">
                    <tbody>
                      <tr>
                        <th style={{ width: '30%' }}>{t('範例輸入', 'Example input')}</th>
                        <th style={{ width: '30%' }}>{t('範例輸出', 'Example output')}</th>
                        <th>{t('說明', 'Why')}</th>
                      </tr>
                      {data.question.test_case.map((tc, i) => (
                        <tr key={i}>
                          <td {...html(tc.input.replaceAll('\n', '<br>'))} />
                          <td {...html(tc.output)} />
                          <td {...html(tc.note)} />
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </td>
            </tr>
          )}
          <tr>
            <th>{t('題目重點', 'Main idea')}</th>
            <td id="print_question_note">{data?.questionNote}</td>
          </tr>
          <tr>
            <th>{t('變數', 'Variables')}</th>
            <td>
              <table id="print_var_table" className="print_table" rules="all">
                <tbody>
                  <tr>
                    <th style={{ width: '20%' }}>{t('名稱', 'Name')}</th>
                    <th style={{ width: '20%' }}>{t('型別', 'Type')}</th>
                    <th style={{ width: '20%' }}>{t('初始值', 'Start value')}</th>
                    <th style={{ width: '30%' }}>{t('說明', 'Note')}</th>
                  </tr>
                  {data?.vars.map((v, i) => (
                    <tr key={i}>
                      <td style={{ width: '20%' }}>{v[0]}</td>
                      <td style={{ width: '20%' }}>{v[1]}</td>
                      <td style={{ width: '20%' }}>{v[2]}</td>
                      <td style={{ width: '50%' }}>{v[3]}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </td>
          </tr>
          <tr>
            <th>{t('測試資料', 'Test data')}</th>
            <td>
              <table id="print_case_table" className="print_table" rules="all">
                <tbody>
                  <tr>
                    <th style={{ width: '30%' }}>{t('輸入', 'Input')}</th>
                    <th style={{ width: '20%' }}>{t('輸出', 'Output')}</th>
                    <th style={{ width: '40%' }}>{t('測試重點', 'What it tests')}</th>
                  </tr>
                  {data?.cases.map((c, i) => (
                    <tr key={i}>
                      <td style={{ width: '30%' }}>{c[0]}</td>
                      <td style={{ width: '20%' }}>{c[1]}</td>
                      <td style={{ width: '40%' }}>{c[2]}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </td>
          </tr>
          <tr>
            <th>{t('流程圖', 'Flowchart')}</th>
            <td id="print_img">{imgSrc && <img id="flow_chart" src={imgSrc.src} data-cuts={imgSrc.cuts.join(',')} />}</td>
          </tr>
          {modules.map(m => (
            <tr key={m.title}>
              <th>{t('模組', 'Module')}<br />{m.title}</th>
              <td><img className="flow_chart_module" src={m.src} data-cuts={m.cuts.join(',')} /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
