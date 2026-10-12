"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, ArrowUpRight, ChevronDown, Menu, Orbit, ShoppingCart, Sparkles, UserRound, X } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { useCart } from "@/context/CartContext";
import styles from "@/styles/GalaxyHome.module.css";

const destinations = [
  { href: "#calculator", label: "Báo giá mua hộ", detail: "Ước tính chi phí đơn hàng" },
  { href: "#categories", label: "Khám phá danh mục", detail: "Tìm nhóm hàng phù hợp" },
  { href: "#products", label: "Sản phẩm nổi bật", detail: "Hàng đang có tại kho" },
  { href: "#benefits", label: "Dịch vụ ChillBanana", detail: "Cách chúng tôi hỗ trợ bạn" },
];

export default function GalaxyHeader() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const { totalItems, openCart } = useCart();
  const { customer, openAuthModal } = useAuth();

  useEffect(() => {
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setMenuOpen(false);
        setMobileOpen(false);
      }
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, []);

  const closeMenus = () => {
    setMenuOpen(false);
    setMobileOpen(false);
  };

  return (
    <header className={styles.header}>
      <div className={styles.headerInner}>
        <button
          type="button"
          className={styles.brandButton}
          aria-expanded={menuOpen}
          aria-controls="galaxy-navigation"
          onClick={() => setMenuOpen((open) => !open)}
        >
          <span className={styles.brandSun}><span>🍌</span></span>
          <span className={styles.brandCopy}>
            <span className={styles.brandName}>Chill<span>Banana</span></span>
            <span className={styles.brandTagline}>BANANA GALAXY</span>
          </span>
          <ChevronDown className={`${styles.brandChevron} ${menuOpen ? styles.chevronOpen : ""}`} size={16} />
        </button>

        <nav className={styles.desktopNav} aria-label="Điều hướng Banana Galaxy">
          {destinations.slice(0, 3).map((item) => (
            <a key={item.href} href={item.href} className={styles.navLink}>{item.label}</a>
          ))}
        </nav>

        <div className={styles.headerActions}>
          <button type="button" onClick={openCart} className={styles.iconButton} aria-label={`Mở giỏ hàng${totalItems ? `, ${totalItems} sản phẩm` : ""}`}>
            <ShoppingCart size={17} />
            <span className={styles.cartLabel}>Giỏ hàng</span>
            {totalItems > 0 && <span className={styles.cartCount}>{totalItems > 99 ? "99+" : totalItems}</span>}
          </button>
          {customer ? (
            <Link href="/profile" className={`${styles.iconButton} ${styles.accountButton}`}>
              <UserRound size={17} />
              <span>{customer.name.split(" ")[0]}</span>
            </Link>
          ) : (
            <button type="button" onClick={() => openAuthModal("login")} className={`${styles.iconButton} ${styles.accountButton}`}>
              <UserRound size={17} />
              <span>Tài khoản</span>
            </button>
          )}
          <Link href="/" className={styles.oldSiteButton} onClick={closeMenus}>
            <ArrowLeft size={15} />
            <span>Giao diện cũ</span>
          </Link>
          <button
            type="button"
            className={styles.mobileMenuButton}
            aria-label={mobileOpen ? "Đóng menu" : "Mở menu"}
            aria-expanded={mobileOpen}
            onClick={() => setMobileOpen((open) => !open)}
          >
            {mobileOpen ? <X size={21} /> : <Menu size={21} />}
          </button>
        </div>
      </div>

      {menuOpen && (
        <div id="galaxy-navigation" className={styles.planetMenu}>
          <div className={styles.menuSun}><Orbit size={20} /><span>Điều hướng</span></div>
          <div className={styles.planetLinks}>
            {destinations.map((item, index) => (
              <a key={item.href} href={item.href} className={styles.planetLink} onClick={closeMenus}>
                <span className={`${styles.planetIcon} ${styles[`planet${index + 1}`]}`}><Sparkles size={15} /></span>
                <span><strong>{item.label}</strong><small>{item.detail}</small></span>
                <ArrowUpRight size={15} className={styles.planetArrow} />
              </a>
            ))}
          </div>
          <Link href="/" className={styles.menuOldLink} onClick={closeMenus}>Quay về giao diện cũ <ArrowLeft size={14} /></Link>
        </div>
      )}

      {mobileOpen && (
        <nav className={styles.mobileNav} aria-label="Điều hướng di động">
          {destinations.map((item) => (
            <a key={item.href} href={item.href} onClick={closeMenus}>{item.label}<ArrowUpRight size={15} /></a>
          ))}
          <button type="button" onClick={() => { closeMenus(); openCart(); }}><ShoppingCart size={16} />Giỏ hàng{totalItems > 0 ? ` (${totalItems})` : ""}</button>
          <Link href="/" onClick={closeMenus}><ArrowLeft size={16} />Quay về giao diện cũ</Link>
        </nav>
      )}
    </header>
  );
}
