import { createRoot } from 'react-dom/client';
import { App } from './App';
import { CourseList, QuestionList } from './pages/Home';
import 'bootstrap/dist/css/bootstrap.min.css';
import './style.css';

// 網址決定顯示哪一頁：
//   ?w=114&h=3     學習單（跟舊版網址相同）
//   ?course=114    這門課的題目清單
//   （沒有參數）    選擇課程
const params = new URLSearchParams(window.location.search);
const course = params.get('course');
const page = params.get('w') && params.get('h')
  ? <App />
  : course != null ? <QuestionList courseId={course} /> : <CourseList />;

createRoot(document.getElementById('root')!).render(page);
