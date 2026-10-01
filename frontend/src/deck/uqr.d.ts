export function encode(
  data: string,
  options?: { ecc?: 'L' | 'M' | 'Q' | 'H'; border?: number },
): { data: boolean[][]; size: number };
