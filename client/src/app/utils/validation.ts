export const MAX_NAME_LENGTH = 30;
export const MAX_DESCRIPTION_LENGTH = 100;
export const MIN_NAME_LENGTH = 3;

export function isStringValid(input: string, minLength: number = MIN_NAME_LENGTH, maxLength: number = MAX_NAME_LENGTH): boolean {
  input = input.trim();

  if (input.length < minLength || input.length > maxLength) return false;

  // permet les lettres (y compris accentuées), chiffres, espaces, tirets, underscores et apostrophes
  if (!/^[\p{L}\d\-_ '\u2019]+$/u.test(input)) return false;

  return true;
}