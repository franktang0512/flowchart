// 交作業時的列印畫面（瀏覽器列印存成 PDF）
export interface PrintData {
  className: string;
  number: string;
  name: string;
  questionName: string;
  questionNote: string;
  /** [名稱, 型別, 初始值, 說明] */
  vars: string[][];
  /** [輸入, 輸出, 測試重點] */
  cases: string[][];
}

import { t, useLang } from '../i18n';

const typeName = (type: string) => (type == '文字' ? t('文字', 'Text') : type == '清單' ? t('清單', 'List') : t('數字', 'Number'));

export function PrintView({ visible, data, imgSrc }: { visible: boolean; data: PrintData | null; imgSrc: string | undefined }) {
  useLang();
  return (
    <div id="print" style={{ display: visible ? 'block' : 'none' }}>
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
                      <td style={{ width: '20%' }}>{typeName(v[1])}</td>
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
            <td id="print_img">{imgSrc && <img id="flow_chart" src={imgSrc} />}</td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}
