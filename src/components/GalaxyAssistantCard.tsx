"use client";

import { useState } from "react";
import { ArrowUpRight, MessageCircle, ShieldCheck, Sparkles } from "lucide-react";
import styles from "@/styles/GalaxyHome.module.css";

export default function GalaxyAssistantCard() {
  const [notice, setNotice] = useState("");

  const openNeo = () => {
    setNotice("");
    const toggle = document.getElementById("ai-chat-toggle-btn");
    if (toggle instanceof HTMLButtonElement) {
      toggle.click();
      return;
    }

    const showNeo = Array.from(document.querySelectorAll("button")).find(
      (button) => button.getAttribute("aria-label") === "Hiện lại Neo Universe",
    );
    if (showNeo instanceof HTMLButtonElement) {
      showNeo.click();
      window.requestAnimationFrame(() => document.getElementById("ai-chat-toggle-btn")?.click());
      return;
    }

    const chatAlreadyOpen = document.querySelector('[role="dialog"][aria-label="Trò chuyện trực tiếp với Neo Universe"]');
    if (!chatAlreadyOpen) setNotice("Neo đang mở trong khung tư vấn hoặc chưa sẵn sàng. Bạn có thể dùng nhân vật nổi ở góc trang để mở chat.");
  };

  return (
    <section id="assistant" className={styles.assistantStage} aria-labelledby="assistant-heading">
      <div className={styles.assistantCard}>
        <div className={styles.assistantVisual} aria-hidden="true">
          <span className={styles.assistantHalo} />
          <span className={styles.assistantOrb}><Sparkles size={30} /></span>
          <span className={styles.assistantStatus} />
        </div>
        <div className={styles.assistantCopy}>
          <span className={styles.sectionKicker}><Sparkles size={14} /> BANANA COSMIC ASSISTANT</span>
          <h2 id="assistant-heading">Cần một người dẫn đường?</h2>
          <p>Neo có thể giúp bạn tìm hiểu sản phẩm, danh mục, cách tính chi phí và các bước mua hộ. Giá cuối cùng, tình trạng hàng và thông tin đơn cần được xác nhận trong quy trình đặt hàng.</p>
          <div className={styles.assistantActions}>
            <button type="button" className={styles.primaryButton} onClick={openNeo}>Trò chuyện với Neo <MessageCircle size={16} /></button>
            <span className={styles.assistantPrivacy}><ShieldCheck size={14} /> Không tự xác nhận tồn kho hay giá cuối</span>
          </div>
          {notice && <p className={styles.assistantNotice} role="status">{notice}</p>}
        </div>
        <span className={styles.assistantArrow} aria-hidden="true"><ArrowUpRight size={20} /></span>
      </div>
    </section>
  );
}
