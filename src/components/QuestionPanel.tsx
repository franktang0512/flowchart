// 題目卡片（第一～三步都看得到）
import { t, useLang } from '../i18n';
import { questionIn, type Question } from '../questions';

// 題目表格與範例的內容是老師寫的 HTML（有些題目用 <br> 換行），跟舊版一樣直接當 HTML 顯示
const html = (s: string) => ({ dangerouslySetInnerHTML: { __html: s } });

export function QuestionPanel({ question }: { question: Question }) {
  const q = questionIn(question, useLang());
  return (
    <div id="step0" className="card">
      <h5 id="question_name">{t('題目名稱：', 'Problem: ')}{q.title}</h5>
      <div id="question_info">{q.question.trimEnd()}</div>
      {q.array.length > 0 && (
        <table id="array" className="data_table">
          <tbody>
            {q.array.map((row, i) => (
              <tr key={i}>
                {row.map((cell, j) => <td key={j} {...html(cell)} />)}
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {q.test_case.length > 0 && (
        <>
          <p className="section_label">{t('範例輸入：', 'Examples:')}</p>
          <table id="example_testcase" className="data_table">
            <tbody>
              <tr>
                <th style={{ width: '25%' }}>{t('輸入', 'Input')}</th>
                <th style={{ width: '25%' }}>{t('輸出', 'Output')}</th>
                <th>{t('說明', 'Why')}</th>
              </tr>
              {q.test_case.map((tc, i) => (
                <tr key={i}>
                  <td {...html(tc.input.replaceAll('\n', '<br>'))} />
                  <td {...html(tc.output)} />
                  <td {...html(tc.note)} />
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
    </div>
  );
}
