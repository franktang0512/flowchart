// 首頁：選學習目標（積木或 C++）→ 選課程 → 看這門課的題目 → 點題目進入學習單
import { useEffect, useState } from 'react';
import { LangToggle } from '../components/LangToggle';
import { COURSES, courseFits, questionHref, type Course } from '../courses';
import { link, t, useLang } from '../i18n';
import { loadQuestionByPath, questionIn, type Question } from '../questions';
import { setTarget, targetName, useTarget, type Target } from '../target';

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="app app_scroll">
      <div id="header">
        <div className="header_left">
          <a className="logo" href={link('./')}>
            <img src="./libs/logo.png" alt="" />
            {t('電子式學習單', 'Flowchart Worksheet')}
          </a>
          <LangToggle />
          <TargetToggle />
        </div>
      </div>
      <div className="home_main">{children}</div>
      <div id="footer">
        <div className="contact">
          <p>{t('聯絡我們：', 'Contact: ')}<a href="mailto:785@syijh.tp.edu.tw">785@syijh.tp.edu.tw</a></p>
        </div>
        <div className="copyright">
          <p>&copy; 2023 張煜. All rights reserved.</p>
        </div>
      </div>
    </div>
  );
}

const questionCount = (c: Course) => c.units.reduce((n, u) => n + u.questions.length, 0);
const courseName = (c: { name: string; nameEn: string }) => t(c.name, c.nameEn);

/** 學習目標的選項：名稱、說明、清單從哪裡開始；沒有 target 的是還在準備、先不能選的 */
// 還不能選的（Python）放最後
const TARGET_CHOICES: { key: string; target?: Target; name: () => string; desc: () => string; index: () => string }[] = [
  {
    key: 'scratch',
    target: 'scratch',
    name: () => targetName('scratch'),
    desc: () => t('Scratch 積木：自訂積木沒有回傳值', 'Scratch blocks: My Blocks have no return value'),
    index: () => t('清單從第 1 項開始', 'Lists start at item 1'),
  },
  {
    key: 'blockly',
    target: 'blockly',
    name: () => targetName('blockly'),
    desc: () => t('Blockly 積木：函式可以回傳值', 'Blockly blocks: functions can return a value'),
    index: () => t('清單從第 1 項開始', 'Lists start at item 1'),
  },
  {
    key: 'cpp',
    target: 'cpp',
    name: () => targetName('cpp'),
    desc: () => t('陣列、vector 等 C++ 寫法', 'C++ arrays and vectors'),
    index: () => t('索引從 0 開始', 'Index starts at 0'),
  },
  {
    key: 'python',
    name: () => 'Python',
    desc: () => t('串列（list）等 Python 寫法', 'Python lists'),
    index: () => t('準備中', 'Coming soon'),
  },
];

/** 左上角的「積木 / Python / C++」切換（跟中英切換放在一起，隨時可以換）；還沒選過時不顯示，等學生先選 */
function TargetToggle() {
  const target = useTarget();
  if (!target) return null;
  return (
    <div className="lang_toggle" role="group" aria-label={t('學習目標', 'Learning')}>
      {TARGET_CHOICES.map(c => (
        <button
          key={c.key} className={target == c.target ? 'selected' : ''} aria-pressed={target == c.target}
          disabled={!c.target} title={c.index()} onClick={() => c.target && setTarget(c.target)}
        >
          {c.name()}
        </button>
      ))}
    </div>
  );
}

/** 進入課程前先選要學哪一種程式 */
function TargetChooser() {
  return (
    <>
      <h4 className="home_heading">{t('你要學哪一種程式？', 'What do you want to learn?')}</h4>
      <div className="home_courses">
        {TARGET_CHOICES.map(c => (
          <button key={c.key} className="home_card target_card" disabled={!c.target} onClick={() => c.target && setTarget(c.target)}>
            <div className="home_card_title">{c.name()}</div>
            <div className="home_card_desc">{c.desc()}</div>
            <div className="home_card_meta">{c.index()}</div>
          </button>
        ))}
      </div>
    </>
  );
}

export function CourseList() {
  const lang = useLang();
  const target = useTarget();
  useEffect(() => { document.title = t('電子式學習單', 'Flowchart Worksheet'); }, [lang]);
  if (!target) return <Shell><TargetChooser /></Shell>;
  return (
    <Shell>
      <h4 className="home_heading">
        {t('選擇課程', 'Choose a course')}
        <span className="muted target_hint">（{targetName(target)}：{TARGET_CHOICES.find(c => c.target == target)!.index()}）</span>
      </h4>
      <div className="home_courses">
        {COURSES.filter(c => courseFits(c, target)).map(c => (
          <a key={c.id} className="home_card" href={link(`?course=${encodeURIComponent(c.id)}`)}>
            <div className="home_card_title">{courseName(c)}</div>
            {c.description && <div className="home_card_desc">{c.description}</div>}
            <div className="home_card_meta">
              {t(`${c.units.length} 個單元・${questionCount(c)} 題`, `${c.units.length} units · ${questionCount(c)} problems`)}
            </div>
          </a>
        ))}
      </div>
    </Shell>
  );
}

export function QuestionList({ courseId }: { courseId: string }) {
  const lang = useLang();
  const course = COURSES.find(c => c.id == courseId);
  const [questions, setQuestions] = useState<Record<string, Question>>({});

  useEffect(() => {
    if (!course) return;
    const paths = course.units.flatMap(u => u.questions);
    Promise.all(paths.map(p => loadQuestionByPath(p).then(q => [p, q] as const)))
      .then(entries => setQuestions(Object.fromEntries(entries)));
  }, [courseId]);

  useEffect(() => {
    document.title = course ? courseName(course) : t('電子式學習單', 'Flowchart Worksheet');
  }, [courseId, lang]);

  if (!course) {
    return (
      <Shell>
        <p className="home_breadcrumb"><a href={link('./')}>{t('課程', 'Courses')}</a></p>
        <p>{t('找不到這門課程。', 'This course is not found.')}</p>
      </Shell>
    );
  }

  let no = 0;
  return (
    <Shell>
      <p className="home_breadcrumb"><a href={link('./')}>{t('課程', 'Courses')}</a> › {courseName(course)}</p>
      <h4 className="home_heading">{courseName(course)}</h4>
      {course.units.map(unit => (
        <div key={unit.name} className="home_unit">
          <h5>{courseName(unit)}</h5>
          <ol className="home_questions">
            {unit.questions.map(p => {
              no++;
              const q = questions[p];
              const title = q ? questionIn(q, lang).title : '';
              return (
                <li key={p}>
                  <a href={questionHref(p)} title={title}>
                    <span className="home_no">{no}</span>
                    <span className="home_title">{title || t('載入中…', 'Loading…')}</span>
                  </a>
                </li>
              );
            })}
          </ol>
        </div>
      ))}
    </Shell>
  );
}
