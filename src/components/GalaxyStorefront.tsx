import Link from "next/link";
import { ArrowDown, ArrowRight, ArrowUpRight, Check, Compass, Orbit, PackageCheck, Sparkles, Zap } from "lucide-react";
import GalaxyHeader from "@/components/GalaxyHeader";
import OrderCalculator from "@/components/OrderCalculator";
import FeaturedCategories from "@/components/FeaturedCategories";
import CuratedProducts from "@/components/CuratedProducts";
import WhyChooseUs from "@/components/WhyChooseUs";
import NewsCorner from "@/components/NewsCorner";
import styles from "@/styles/GalaxyHome.module.css";

const serviceNotes = ["Tính giá trước khi gửi yêu cầu", "Theo dõi tiến độ đơn hàng", "Trợ lý Neo luôn sẵn sàng"];

export default function GalaxyStorefront() {
  return (
    <div className={styles.page}>
      <GalaxyHeader />

      <main>
        <section className={styles.hero} aria-labelledby="galaxy-title">
          <div className={styles.starField} aria-hidden="true" />
          <div className={styles.heroGrid}>
            <div className={styles.heroCopy}>
              <div className={styles.eyebrow}><span className={styles.liveDot} /> HÀNH TRÌNH NHẬT BẢN · VIỆT NAM</div>
              <h1 id="galaxy-title">Món hàng Nhật bạn tìm.<br /><span>Hành trình nhẹ nhàng hơn.</span></h1>
              <p className={styles.heroDescription}>
                Dán link sản phẩm để xem giá dự kiến, khám phá hàng có sẵn và nhận hỗ trợ ngay trên một giao diện mới.
              </p>
              <div className={styles.heroActions}>
                <a href="#calculator" className={styles.primaryButton}>Tính giá đơn hàng <ArrowRight size={17} /></a>
                <a href="#categories" className={styles.secondaryButton}><Compass size={17} /> Khám phá danh mục</a>
              </div>
              <div className={styles.serviceNotes}>
                {serviceNotes.map((note) => <span key={note}><Check size={14} />{note}</span>)}
              </div>
            </div>

            <div className={styles.cosmos} aria-label="Hình minh họa hệ hành tinh Banana Galaxy">
              <div className={`${styles.orbitRing} ${styles.orbitOne}`} />
              <div className={`${styles.orbitRing} ${styles.orbitTwo}`} />
              <div className={`${styles.orbitRing} ${styles.orbitThree}`} />
              <div className={styles.sunCore}><span>🍌</span></div>
              <div className={`${styles.planet} ${styles.planetGold}`}><PackageCheck size={17} /></div>
              <div className={`${styles.planet} ${styles.planetBlue}`}><Compass size={17} /></div>
              <div className={`${styles.planet} ${styles.planetViolet}`}><Sparkles size={17} /></div>
              <div className={styles.cosmosCaption}><Orbit size={15} /> Chọn quỹ đạo mua sắm của bạn</div>
              <div className={styles.floatCard}><span><Zap size={14} /></span><div><strong>Tìm hàng Nhật</strong><small>Từ link hoặc danh mục</small></div></div>
            </div>
          </div>
          <a href="#calculator" className={styles.scrollCue}><span>Khám phá dịch vụ</span><ArrowDown size={15} /></a>
        </section>

        <section className={styles.quickFacts} aria-label="Các điểm nổi bật">
          <div><span className={styles.factIcon}><Zap size={17} /></span><p><strong>Báo giá rõ ràng</strong><small>Xem ước tính trước khi gửi yêu cầu</small></p></div>
          <div><span className={styles.factIcon}><PackageCheck size={17} /></span><p><strong>Theo dõi đơn hàng</strong><small>Tra cứu tiến độ theo mã đơn</small></p></div>
          <div><span className={styles.factIcon}><Sparkles size={17} /></span><p><strong>Hỏi Neo khi cần</strong><small>Hỗ trợ tìm hàng và giải đáp</small></p></div>
        </section>

        <section className={styles.quoteStage} aria-labelledby="quote-heading">
          <div className={styles.sectionIntro}>
            <span className={styles.sectionKicker}>BẮT ĐẦU TỪ ĐÂY</span>
            <h2 id="quote-heading">Từ một đường link đến báo giá dự kiến</h2>
            <p>Nhập đường dẫn sản phẩm và thông tin cần thiết trong công cụ báo giá hiện có.</p>
          </div>
          <OrderCalculator />
        </section>

        <section className={styles.catalogStage}>
          <FeaturedCategories />
          <div id="products" className={styles.anchorTarget} />
          <CuratedProducts />
        </section>

        <div id="benefits" className={styles.benefitsStage}>
          <WhyChooseUs />
        </div>

        <section className={styles.catalogStage}>
          <NewsCorner />
        </section>

        <section className={styles.closingCta}>
          <div className={styles.closingGlow} aria-hidden="true" />
          <span className={styles.sectionKicker}>CHILLBANANA · MUA HÀNG NHẬT THƯ THÁI</span>
          <h2>Sẵn sàng bắt đầu chuyến đi?</h2>
          <p>Dán link cần mua hoặc quay lại giao diện quen thuộc bất cứ lúc nào.</p>
          <div className={styles.closingActions}>
            <a href="#calculator" className={styles.primaryButton}>Tạo báo giá <ArrowUpRight size={17} /></a>
            <Link href="/" className={styles.secondaryButton}>Về giao diện cũ <ArrowRight size={16} /></Link>
          </div>
        </section>
      </main>

      <footer className={styles.footer}>
        <Link href="/" className={styles.footerBrand}><span className={styles.footerSun}>🍌</span> Chill<span>Banana</span></Link>
        <span>Giao diện Banana Galaxy · Bản thử nghiệm song song</span>
        <Link href="/" className={styles.footerBack}>Giao diện cũ <ArrowRight size={14} /></Link>
      </footer>
    </div>
  );
}
