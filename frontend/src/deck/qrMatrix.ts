/**
 * Matriz QR (true = negro) con el encoder uqr, corrección M.
 * QrMark añade la zona de silencio.
 */
import { encode } from './uqr';

export function qrMatrix(text: string): boolean[][] {
  return encode(text, { ecc: 'M', border: 0 }).data;
}
