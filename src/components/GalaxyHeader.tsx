"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  ArrowUpRight,
  Calculator,
  ChevronDown,
  Compass,
  Menu,
  PackageSearch,
  ShoppingCart,
  Sparkles,
  UserRound,
  X,
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { useCart } from "@/context/CartContext";
import styles from "@/styles/GalaxyHome.module.css";

const destinations = [
  { id: "quote", href: "#calculator", label: "Báo giá mua hộ", detail: "Ước tính chi phí từ link", icon: Calculator },
  { id: "categories", href: "#categories", label: "Khám phá danh mục", detail: "Tìm nhóm hàng phù hợp", icon: Compass },
  { id: "products", href: "#products", label: "Sản phẩm tại kho", detail: "Xem hàng đang được đăng", icon: Sparkles },
  { id: "tracking", href: "/tracking", label: "Tra cứu đơn hàng", detail: "Kiểm tra trạng thái đơn", icon: PackageSearch },
] as const;

const openNeo = () => {
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
  }
};

export default function GalaxyHeader() {
  const [menuOpen, setMenuOpen] = useState(false);
  const headerRef = useRef<HTMLElement>(null);
  const brandButtonRef = useRef<HTMLButtonElement>(null);
  const { totalItems, openCart } = useCart();
  const { customer, openAuthModal } = useAuth();

  useEffect(() => {
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape" && menuOpen) {
        setMenuOpen(false);
        brandButtonRef.current?.focus();
      }
    };
    const closeOnOutsidePress = (event: PointerEvent) => {
      if (event.target instanceof Node && !headerRef.current?.contains(event.target)) setMenuOpen(false);
    };

    window.addEventListener("keydown", closeOnEscape);
    document.addEventListener("pointerdown", closeOnOutsidePress);
    return () => {
      window.removeEventListener("keydown", closeOnEscape);
      document.removeEventListener("pointerdown", closeOnOutsidePress);
    };
  }, [menuOpen]);

  const closeMenu = () => setMenuOpen(false);
  const goToNeo = () => {
    closeMenu();
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    document.getElementById("assistant")?.scrollIntoView({ behavior: reducedMotion ? "auto" : "smooth", block: "center" });
    openNeo();
  };

  return (
    <header ref={headerRef} className={styles.header}>
      <div className={styles.headerInner}>
        <button
          ref={brandButtonRef}
          type="button"
          className={styles.brandButton}
          aria-expanded={menuOpen}
          aria-controls="galaxy-navigation"
          aria-label={`${menuOpen ? "Đóng" : "Mở"} điều hướng Banana Galaxy`}
          onClick={() => setMenuOpen((open) => !open)}
        >
          <span className={styles.brandSun} aria-hidden="true"><span>🍌</span></span>
          <span className={styles.brandCopy}>
            <span className={styles.brandName}>Chill<span>Banana</span></span>
            <span className={styles.brandTagline}>BANANA GALAXY</span>
          </span>
          <ChevronDown className={`${styles.brandChevron} ${menuOpen ? styles.chevronOpen : ""}`} size={16} aria-hidden="true" />
        </button>

        <nav className={styles.desktopNav} aria-label="Điều hướng nhanh">
          <a href="#calculator" className={styles.navLink}>Báo giá</a>
          <a href="#categories" className={styles.navLink}>Danh mục</a>
          <Link href="/tracking" className={styles.navLink}>Tra cứu đơn hàng</Link>
        </nav>

        <div className={styles.headerActions}>
          <button type="button" onClick={openCart} className={styles.iconButton} aria-label={`Mở giỏ hàng${totalItems ? `, ${totalItems} sản phẩm` : ""}`}>
            <ShoppingCart size={17} aria-hidden="true" />
            <span className={styles.cartLabel}>Giỏ hàng</span>
            {totalItems > 0 && <span className={styles.cartCount}>{totalItems > 99 ? "99+" : totalItems}</span>}
          </button>
          {customer ? (
            <Link href="/profile" className={`${styles.iconButton} ${styles.accountButton}`} aria-label={`Hồ sơ của ${customer.name}`}>
              <UserRound size={17} aria-hidden="true" />
              <span>{customer.name.split(" ")[0]}</span>
            </Link>
          ) : (
            <button type="button" onClick={() => openAuthModal("login")} className={`${styles.iconButton} ${styles.accountButton}`}>
              <UserRound size={17} aria-hidden="true" />
              <span>Tài khoản</span>
            </button>
          )}
          <Link href="/" className={styles.oldSiteButton} onClick={closeMenu}>
            <ArrowLeft size={15} aria-hidden="true" />
            <span>Giao diện cũ</span>
          </Link>
          <button
            type="button"
            className={styles.mobileMenuButton}
            aria-label={menuOpen ? "Đóng điều hướng" : "Mở điều hướng"}
            aria-expanded={menuOpen}
            aria-controls="galaxy-navigation"
            onClick={() => setMenuOpen((open) => !open)}
          >
            {menuOpen ? <X size={21} aria-hidden="true" /> : <Menu size={21} aria-hidden="true" />}
          </button>
        </div>
      </div>

      {menuOpen && (
        <div id="galaxy-navigation" className={styles.planetMenu} role="region" aria-label="Điều hướng hệ hành tinh">
          <div className={styles.menuHeading}>
            <div><span className={styles.menuEyebrow}>SOLAR SYSTEM NAVIGATION</span><strong>Chọn điểm đến của bạn</strong></div>
            <button type="button" className={styles.closeMenuButton} onClick={closeMenu} aria-label="Đóng menu điều hướng"><X size={17} /></button>
          </div>
          <div className={styles.solarMap}>
            <span className={`${styles.solarOrbit} ${styles.solarOrbitOne}`} aria-hidden="true" />
            <span className={`${styles.solarOrbit} ${styles.solarOrbitTwo}`} aria-hidden="true" />
            <span className={`${styles.solarOrbit} ${styles.solarOrbitThree}`} aria-hidden="true" />
            <a href="#top" className={styles.solarSun} onClick={closeMenu} aria-label="Về đầu trang ChillBanana"><span>🍌</span></a>
            {destinations.map((item, index) => {
              const Icon = item.icon;
              const className = `${styles.planetLink} ${styles[`planetPosition${index + 1}`]}`;
              return (
                <Link key={item.id} href={item.href} className={className} onClick={closeMenu}>
                  <span className={`${styles.planetIcon} ${styles[`planet${index + 1}`]}`}><Icon size={15} aria-hidden="true" /></span>
                  <span className={styles.planetText}><strong>{item.label}</strong><small>{item.detail}</small></span>
                  <ArrowUpRight size={14} className={styles.planetArrow} aria-hidden="true" />
                </Link>
              );
            })}
            <button type="button" className={`${styles.planetLink} ${styles.planetAssistant}`} onClick={goToNeo}>
              <span className={`${styles.planetIcon} ${styles.planet5}`}><Sparkles size={15} aria-hidden="true" /></span>
              <span className={styles.planetText}><strong>Trò chuyện với Neo</strong><small>Hỏi về sản phẩm và quy trình</small></span>
              <ArrowUpRight size={14} className={styles.planetArrow} aria-hidden="true" />
            </button>
          </div>
          <div className={styles.menuFooter}><span>Vẫn có thể quay lại giao diện quen thuộc</span><Link href="/" onClick={closeMenu}>Giao diện cũ <ArrowLeft size={13} /></Link></div>
        </div>
      )}
    </header>
  );
}
