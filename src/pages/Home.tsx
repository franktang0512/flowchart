// 首頁：選課程 → 看這門課的題目 → 點題目進入學習單
import { useEffect, useState } from 'react';
import { LangToggle } from '../components/LangToggle';
import { COURSES, questionHref, type Course } from '../courses';
import { t, useLang } from '../i18n';
import { loadQuestionByPath, questionIn, type Question } from '../questions';

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="app app_scroll">
      <div id="header">
        <div className="header_left">
          <a className="logo" href="./">
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

export function CourseList() {
  const lang = useLang();
  useEffect(() => { document.title = t('電子式學習單', 'Flowchart Worksheet'); }, [lang]);
  return (
    <Shell>
      <h4 className="home_heading">{t('選擇課程', 'Choose a course')}</h4>
      <div className="home_courses">
        {COURSES.map(c => (
          <a key={c.id} className="home_card" href={`?course=${encodeURIComponent(c.id)}`}>
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
        <p className="home_breadcrumb"><a href="./">{t('課程', 'Courses')}</a></p>
        <p>{t('找不到這門課程。', 'This course is not found.')}</p>
      </Shell>
    );
  }

  let no = 0;
  return (
    <Shell>
      <p className="home_breadcrumb"><a href="./">{t('課程', 'Courses')}</a> › {courseName(course)}</p>
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
