/** 현재 시각을 KST(UTC+9) 기준 "YYYY-MM-DD HH:mm" 문자열로 반환 */
export function nowKST(): string {
  const now = new Date();
  // KST = UTC + 9h
  const kst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  return kst.toISOString().slice(0, 16).replace('T', ' ');
}
