// 左上角的中／英切換
import { setLang, useLang } from '../i18n';

export function LangToggle() {
  const lang = useLang();
  return (
    <div className="lang_toggle" role="group" aria-label="Language">
      <button className={lang == 'zh' ? 'selected' : ''} aria-pressed={lang == 'zh'} onClick={() => setLang('zh')}>中文</button>
      <button className={lang == 'en' ? 'selected' : ''} aria-pressed={lang == 'en'} onClick={() => setLang('en')}>English</button>
    </div>
  );
}
