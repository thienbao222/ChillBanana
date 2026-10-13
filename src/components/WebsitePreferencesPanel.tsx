"use client";

import React, { useEffect, useRef } from "react";
import { RotateCcw, Settings2, X } from "lucide-react";
import { useWebsitePreferences, WebsiteFont, WebsiteLanguage, WebsiteTextSize, WebsiteTheme } from "@/context/WebsitePreferencesContext";

const copy = {
  vi: {
    open: "Tùy chỉnh giao diện", title: "Tùy chỉnh website", subtitle: "Lựa chọn được lưu trên thiết bị này.",
    close: "Đóng bảng tùy chỉnh", appearance: "Giao diện", theme: "Chế độ màu", light: "Sáng", dark: "Tối", system: "Theo thiết bị",
    brightness: "Độ sáng giao diện", effects: "Hiệu ứng chuyển động", effectsHelp: "Tắt mây, lấp lánh và chuyển động trang trí.",
    typography: "Chữ", font: "Kiểu chữ", rounded: "Tròn, thân thiện", systemFont: "Mặc định thiết bị", serif: "Có chân",
    textSize: "Cỡ chữ", small: "Nhỏ", normal: "Vừa", large: "Lớn", language: "Ngôn ngữ", vietnamese: "Tiếng Việt", japanese: "日本語",
    reset: "Khôi phục mặc định", done: "Xong",
  },
  ja: {
    open: "表示設定", title: "ウェブサイトの設定", subtitle: "設定はこの端末に保存されます。",
    close: "設定を閉じる", appearance: "表示", theme: "テーマ", light: "ライト", dark: "ダーク", system: "端末に合わせる",
    brightness: "画面の明るさ", effects: "アニメーション効果", effectsHelp: "雲、きらめき、装飾アニメーションを停止します。",
    typography: "文字", font: "フォント", rounded: "丸みのある書体", systemFont: "端末の標準", serif: "明朝体",
    textSize: "文字サイズ", small: "小", normal: "標準", large: "大", language: "言語", vietnamese: "ベトナム語", japanese: "日本語",
    reset: "初期設定に戻す", done: "完了",
  },
};

export function WebsitePreferencesTrigger({ className = "", onOpen }: { className?: string; onOpen?: () => void }) {
  const { preferences, openPanel } = useWebsitePreferences();
  const t = copy[preferences.language];
  return (
    <button type="button" className={`site-preferences-trigger ${className}`} onClick={() => { openPanel(); onOpen?.(); }} aria-label={t.open} aria-haspopup="dialog">
      <Settings2 aria-hidden="true" />
      <span>{t.open}</span>
    </button>
  );
}

function Choice<T extends string>({ value, selected, label, onSelect }: { value: T; selected: T; label: string; onSelect: (value: T) => void }) {
  return (
    <button type="button" className={`site-pref-choice ${selected === value ? "is-selected" : ""}`} aria-pressed={selected === value} onClick={() => onSelect(value)}>
      {label}
    </button>
  );
}

export default function WebsitePreferencesPanel() {
  const { preferences, updatePreferences, resetPreferences, isPanelOpen, closePanel } = useWebsitePreferences();
  const panelRef = useRef<HTMLElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);
  const t = copy[preferences.language];

  useEffect(() => {
    if (!isPanelOpen) return;
    previousFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        closePanel();
        return;
      }
      if (event.key !== "Tab" || !panelRef.current) return;
      const focusable = Array.from(panelRef.current.querySelectorAll<HTMLElement>(
        'button:not([disabled]):not([tabindex="-1"]), input:not([disabled]), [tabindex]:not([tabindex="-1"])'
      ));
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
      previousFocusRef.current?.focus();
    };
  }, [isPanelOpen, closePanel]);

  if (!isPanelOpen) return null;

  return (
    <div className="site-pref-layer">
      <button className="site-pref-backdrop" type="button" onClick={closePanel} aria-label={t.close} tabIndex={-1} />
      <aside className="site-pref-panel" ref={panelRef} role="dialog" aria-modal="true" aria-labelledby="site-pref-title">
        <header className="site-pref-header">
          <div>
            <p>{t.appearance}</p>
            <h2 id="site-pref-title">{t.title}</h2>
            <span>{t.subtitle}</span>
          </div>
          <button ref={closeRef} type="button" className="site-pref-icon-button" onClick={closePanel} aria-label={t.close}><X /></button>
        </header>

        <div className="site-pref-content">
          <section className="site-pref-section" aria-labelledby="site-pref-theme-label">
            <h3 id="site-pref-theme-label">{t.theme}</h3>
            <div className="site-pref-choices">
              <Choice<WebsiteTheme> value="light" selected={preferences.theme} label={`${t.light}`} onSelect={(theme) => updatePreferences({ theme })} />
              <Choice<WebsiteTheme> value="dark" selected={preferences.theme} label={`${t.dark}`} onSelect={(theme) => updatePreferences({ theme })} />
              <Choice<WebsiteTheme> value="system" selected={preferences.theme} label={`${t.system}`} onSelect={(theme) => updatePreferences({ theme })} />
            </div>
          </section>

          <section className="site-pref-section">
            <div className="site-pref-range-heading">
              <label htmlFor="site-pref-brightness">{t.brightness}</label>
              <output htmlFor="site-pref-brightness">{preferences.brightness}%</output>
            </div>
            <input id="site-pref-brightness" className="site-pref-range" type="range" min="70" max="100" step="5" value={preferences.brightness} aria-valuetext={`${preferences.brightness}%`} onChange={(event) => updatePreferences({ brightness: Number(event.target.value) })} />
          </section>

          <section className="site-pref-section site-pref-switch-row">
            <div><h3>{t.effects}</h3><p>{t.effectsHelp}</p></div>
            <button type="button" role="switch" aria-checked={preferences.effectsEnabled} aria-label={t.effects} className={`site-pref-switch ${preferences.effectsEnabled ? "is-on" : ""}`} onClick={() => updatePreferences({ effectsEnabled: !preferences.effectsEnabled })}><span /></button>
          </section>

          <section className="site-pref-section">
            <h3>{t.font}</h3>
            <div className="site-pref-choices site-pref-choices-stack">
              <Choice<WebsiteFont> value="rounded" selected={preferences.font} label={t.rounded} onSelect={(font) => updatePreferences({ font })} />
              <Choice<WebsiteFont> value="system" selected={preferences.font} label={t.systemFont} onSelect={(font) => updatePreferences({ font })} />
              <Choice<WebsiteFont> value="serif" selected={preferences.font} label={t.serif} onSelect={(font) => updatePreferences({ font })} />
            </div>
          </section>

          <section className="site-pref-section">
            <h3>{t.textSize}</h3>
            <div className="site-pref-choices">
              <Choice<WebsiteTextSize> value="small" selected={preferences.textSize} label={t.small} onSelect={(textSize) => updatePreferences({ textSize })} />
              <Choice<WebsiteTextSize> value="normal" selected={preferences.textSize} label={t.normal} onSelect={(textSize) => updatePreferences({ textSize })} />
              <Choice<WebsiteTextSize> value="large" selected={preferences.textSize} label={t.large} onSelect={(textSize) => updatePreferences({ textSize })} />
            </div>
          </section>

          <section className="site-pref-section">
            <h3>{t.language}</h3>
            <div className="site-pref-choices">
              <Choice<WebsiteLanguage> value="vi" selected={preferences.language} label={t.vietnamese} onSelect={(language) => updatePreferences({ language })} />
              <Choice<WebsiteLanguage> value="ja" selected={preferences.language} label={t.japanese} onSelect={(language) => updatePreferences({ language })} />
            </div>
          </section>
        </div>

        <footer className="site-pref-footer">
          <button type="button" className="site-pref-reset" onClick={resetPreferences}><RotateCcw aria-hidden="true" />{t.reset}</button>
          <button type="button" className="site-pref-done" onClick={closePanel}>{t.done}</button>
        </footer>
      </aside>
    </div>
  );
}
