"use client";

import { useState } from "react";
import { Cpu, Gamepad2, HeartPulse, Orbit, Sparkles } from "lucide-react";
import { CATEGORIES } from "@/lib/data";
import styles from "@/styles/GalaxyHome.module.css";

const categoryIcons = {
  cosmetics: Sparkles,
  health: HeartPulse,
  gadgets: Cpu,
  anime: Gamepad2,
} as const;

const categoryColors = [styles.categoryGold, styles.categoryBlue, styles.categoryGreen, styles.categoryViolet];
const categoryPositions = [styles.categoryPositionOne, styles.categoryPositionTwo, styles.categoryPositionThree, styles.categoryPositionFour];

export default function GalaxyCategoryField() {
  const [activeCategory, setActiveCategory] = useState<string>("all");

  const chooseCategory = (category: string) => {
    setActiveCategory(category);
    window.dispatchEvent(new CustomEvent("chillbanana:filter_products", { detail: { category } }));
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    document.getElementById("products")?.scrollIntoView({ behavior: reducedMotion ? "auto" : "smooth", block: "start" });
  };

  const activeName = CATEGORIES.find((category) => category.id === activeCategory)?.name;

  return (
    <section id="categories" className={styles.categorySection} aria-labelledby="category-heading">
      <div className={styles.categoryIntro}>
        <span className={styles.sectionKicker}><Orbit size={14} /> CÁC QUỸ ĐẠO HÀNG NHẬT</span>
        <h2 id="category-heading">Chọn nhóm hàng bạn đang tìm</h2>
        <p>Chạm vào một hành tinh để xem sản phẩm thuộc danh mục đó.</p>
      </div>

      <div className={styles.categoryScene} aria-label="Danh mục sản phẩm dạng hệ hành tinh">
        <div className={`${styles.categoryOrbit} ${styles.categoryOrbitOne}`} aria-hidden="true" />
        <div className={`${styles.categoryOrbit} ${styles.categoryOrbitTwo}`} aria-hidden="true" />
        <div className={styles.categorySun} aria-hidden="true"><span>🍌</span></div>
        {CATEGORIES.map((category, index) => {
          const Icon = categoryIcons[category.id as keyof typeof categoryIcons] ?? Sparkles;
          return (
            <button
              key={category.id}
              type="button"
              className={`${styles.categoryPlanet} ${categoryColors[index % categoryColors.length]} ${categoryPositions[index % categoryPositions.length]} ${activeCategory === category.id ? styles.categoryPlanetActive : ""}`}
              onClick={() => chooseCategory(category.id)}
              aria-pressed={activeCategory === category.id}
              aria-label={`Xem danh mục ${category.name}`}
            >
              <span className={styles.categoryPlanetIcon}><Icon size={18} /></span>
              <span className={styles.categoryPlanetCopy}>
                <strong>{category.name}</strong>
                <small>{category.badge}</small>
              </span>
            </button>
          );
        })}
        <p className={styles.categoryHint} aria-live="polite">
          {activeName ? `Đang xem: ${activeName}` : "Chọn một quỹ đạo để lọc sản phẩm"}
        </p>
      </div>

      <button type="button" className={styles.allCategoriesButton} onClick={() => chooseCategory("all")} aria-pressed={activeCategory === "all"}>
        Xem tất cả sản phẩm
      </button>
    </section>
  );
}
