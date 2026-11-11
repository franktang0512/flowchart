// 首頁：選學習目標（積木或 C++）→ 選課程 → 看這門課的題目 → 點題目進入學習單
import { useEffect, useState } from 'react';
import { LangToggle } from '../components/LangToggle';
import { COURSES, questionHref, type Course } from '../courses';
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

/** 學習目標的選項：名稱、說明、清單從哪裡開始 */
const TARGET_CHOICES: { target: Target; desc: () => string; index: () => string }[] = [
  {
    target: 'blocks',
    desc: () => t('Scratch、Blockly 這類積木程式', 'Block coding, like Scratch and Blockly'),
    index: () => t('清單從第 1 項開始', 'Lists start at item 1'),
  },
  {
    target: 'cpp',
    desc: () => t('陣列、vector 等 C++ 寫法', 'C++ arrays and vectors'),
    index: () => t('索引從 0 開始', 'Index starts at 0'),
  },
];

/** 進入課程前先選要學哪一種程式 */
function TargetChooser() {
  return (
    <>
      <h4 className="home_heading">{t('你要學哪一種程式？', 'What do you want to learn?')}</h4>
      <div className="home_courses">
        {TARGET_CHOICES.map(c => (
          <button key={c.target} className="home_card target_card" onClick={() => setTarget(c.target)}>
            <div className="home_card_title">{targetName(c.target)}</div>
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
      <p className="target_now">
        {t('學習目標：', 'Learning: ')}<strong>{targetName(target)}</strong>
        <span className="muted">（{TARGET_CHOICES.find(c => c.target == target)!.index()}）</span>
        <button className="link_button" onClick={() => setTarget(target == 'cpp' ? 'blocks' : 'cpp')}>
          {t(`改成${targetName(target == 'cpp' ? 'blocks' : 'cpp')}`, `Switch to ${targetName(target == 'cpp' ? 'blocks' : 'cpp')}`)}
        </button>
      </p>
      <h4 className="home_heading">{t('選擇課程', 'Choose a course')}</h4>
      <div className="home_courses">
        {COURSES.filter(c => !c.target || c.target == target).map(c => (
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
