export interface ImageCatalogCandidate {
  name: string;
  categoryName: string;
  priceJpy: number;
  description: string;
}

export interface ImageCatalogAnalysis {
  nameVi?: string | null;
  nameJp?: string | null;
  searchKeywords?: string[];
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
    .filter((value) => value.length >= 3 && value.split(" ").some((token) => token.length >= 2 && !STOP_WORDS.has(token)));
}

export function getImageCatalogSearchTerms(analysis: ImageCatalogAnalysis): string[] {
  const phrases = getPhrases(analysis);
  const tokens = phrases.flatMap((phrase) => phrase.split(" "))
    .filter((token) => token.length >= 2 && !STOP_WORDS.has(token));
  return [...new Set([...phrases, ...tokens])].slice(0, 12);
}

export function rankImageCatalogCandidates<T extends ImageCatalogCandidate>(
  candidates: T[],
  analysis: ImageCatalogAnalysis,
  limit = 3
): T[] {
  const phrases = getPhrases(analysis);
  const tokens = [...new Set(phrases.flatMap((phrase) => phrase.split(" ")))]
    .filter((token) => token.length >= 2 && !STOP_WORDS.has(token));
  if (!tokens.length || limit < 1) return [];

  return candidates
    .map((candidate) => {
      const searchableText = normalizeImageCatalogText(
        `${candidate.name} ${candidate.description} ${candidate.categoryName}`
      );
      const phraseMatches = phrases.filter((phrase) => phrase.includes(" ") && searchableText.includes(phrase));
      const tokenMatches = tokens.filter((token) => searchableText.split(" ").includes(token));
      return { candidate, score: phraseMatches.length * 4 + tokenMatches.length };
    })
    .filter(({ score }) => score > 0)
    .sort((left, right) => right.score - left.score || left.candidate.name.localeCompare(right.candidate.name))
    .slice(0, Math.min(3, Math.max(0, limit)))
    .map(({ candidate }) => candidate);
}
