// 頁尾（首頁、學習單頁共用）：原作的論文、擴充的人和實驗室
import { t, useLang } from '../i18n';

export function Footer() {
  useLang();
  return (
    <div id="footer">
      <p>
        {t('原作：張煜〈運算思維視覺化對國中生程式學習的影響〉（2025，國立臺灣師範大學資訊工程學系碩士論文）',
          'Original: Chang Yu, "The Influence of Computational Thinking Visualization on Programming Learning in Junior High School Students" (Master\'s thesis, National Taiwan Normal University, 2025)')}
        <span className="footer_sep">｜</span>
        {t('擴充：唐中凡 · VIPLab', 'Extended by Frank Tang · VIPLab')}
      </p>
    </div>
  );
}
