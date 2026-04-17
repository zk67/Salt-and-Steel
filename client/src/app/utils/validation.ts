import { MAX_NAME_LENGTH, MIN_NAME_LENGTH } from '@common/types/menu-page.constants';

export function isStringValid(input: string, minLength: number = MIN_NAME_LENGTH, maxLength: number = MAX_NAME_LENGTH): boolean {
  input = input.trim();

  if (input.length < minLength || input.length > maxLength) return false;

  // permet les lettres (y compris accentuées), chiffres, espaces, tirets, underscores et apostrophes
  if (!/^[\p{L}\d\-_ '\u2019]+$/u.test(input)) return false;

  return true;
}