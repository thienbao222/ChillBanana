// FILE: src/features/ai/customer/image-catalog-matcher.ts

export interface ImageCatalogCandidate {
  id?: string;
  name: string;
  category?: string;
  categoryName: string;
  priceJpy: number;
  description: string;
  imageUrl?: string;
  originalStore?: string;
}

export interface ImageCatalogAnalysis {
  nameVi?: string | null;
  nameJp?: string | null;
  category?: string | null;
  searchKeywords?: string[];
  matchedCatalogIds?: string[];
}

const STOP_WORDS = new Set([
  "anh", "ban", "hang", "hanghoa", "hangnhat", "nhat", "nhatban", "san", "pham", "sanpham",
  "tim", "kiem", "goi", "y", "tu", "khoa", "sanphamnhat", "mua", "shop", "chillbanana",
  "popular", "product", "products", "japan", "japanese", "official", "new", "used", "search",
  "item", "goods", "商品", "製品", "日本", "人気", "公式", "新品", "中古", "検索",
]);

export function normalizeImageCatalogText(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/gi, "d")
    .toLocaleLowerCase("ja-JP")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

function getPhrases(analysis: ImageCatalogAnalysis): string[] {
  return [analysis.nameVi, analysis.nameJp, ...(analysis.searchKeywords ?? [])]
    .filter((value): value is string => typeof value === "string")
    .map((value) => normalizeImageCatalogText(value.slice(0, 120)))
    .filter((value) => value.length >= 2 && value.split(" ").some((token) => token.length >= 2 && !STOP_WORDS.has(token)));
}

export function getImageCatalogSearchTerms(analysis: ImageCatalogAnalysis): string[] {
  const phrases = getPhrases(analysis);
  const tokens = phrases
    .flatMap((phrase) => phrase.split(" "))
    .filter((token) => token.length >= 2 && !STOP_WORDS.has(token));
  return [...new Set([...phrases, ...tokens])].slice(0, 12);
}

export function rankImageCatalogCandidates<T extends ImageCatalogCandidate>(
  candidates: T[],
  analysis: ImageCatalogAnalysis,
  limit = 3
): T[] {
  if (!candidates.length || limit < 1) return [];

  const matchedIds = new Set(
    (analysis.matchedCatalogIds ?? []).map((id) => String(id).trim()).filter(Boolean)
  );
  const phrases = getPhrases(analysis);
  const tokens = [...new Set(phrases.flatMap((phrase) => phrase.split(" ")))]
    .filter((token) => token.length >= 2 && !STOP_WORDS.has(token));

  if (!tokens.length && matchedIds.size === 0) return [];

  const scored = candidates
    .map((candidate) => {
      let score = 0;

      // 1. Nếu Gemini Vision đã đối chiếu trực tiếp với danh sách sản phẩm trong kho -> Ưu tiên số 1 (+100 điểm)
      if (candidate.id && matchedIds.has(candidate.id)) {
        score += 100;
      }

      const searchableText = normalizeImageCatalogText(
        `${candidate.name} ${candidate.description} ${candidate.categoryName}`
      );
      const candidateWords = searchableText.split(" ").filter(Boolean);

      // 2. Khớp cụm từ (Phrase match)
      const phraseMatches = phrases.filter((phrase) => phrase.includes(" ") && searchableText.includes(phrase));
      score += phraseMatches.length * 6;

      // 3. Khớp từ đơn & khớp chuỗi con (Substring / Fuzzy match cho các từ ghép như "errormusk", "musk", "tranh", "nendoroid", "gundam")
      for (const token of tokens) {
        if (candidateWords.includes(token)) {
          score += 3;
        } else if (token.length >= 3 && candidateWords.some((w) => w.includes(token) || token.includes(w))) {
          score += 2;
        }
      }

      // 4. Điểm cộng nếu cùng danh mục
      if (analysis.category && candidate.category && analysis.category === candidate.category && score > 0) {
        score += 2;
      }

      return { candidate, score };
    })
    .filter(({ score }) => score > 0)
    .sort((left, right) => right.score - left.score);

  return scored.slice(0, Math.min(3, Math.max(0, limit))).map(({ candidate }) => candidate);
}
