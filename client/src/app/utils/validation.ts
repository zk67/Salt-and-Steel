export const MAX_NAME_LENGTH = 30;
export const MAX_DESCRIPTION_LENGTH = 100;
export const MIN_NAME_LENGTH = 3;
const UUID_RADIX = 16;
const UUID_MASK = 0x3;
const UUID_VARIANT = 0x8;

export function isStringValid(s: string, minLength: number = MIN_NAME_LENGTH, maxLength: number = MAX_NAME_LENGTH): boolean {
    s = s.trim();

    if (s.length < minLength || s.length > maxLength) return false;

    // permet les lettres (y compris accentuées), chiffres, espaces, tirets, underscores et apostrophes
    if (!/^[\p{L}\d\-_ '\u2019]+$/u.test(s)) return false;

    return true;
}

export function generateUUID(): string {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = Math.floor(Math.random() * UUID_RADIX);
      const v = c === 'x'
        ? r
        : UUID_VARIANT + (r % (UUID_MASK + 1)); // (r & 0x3) | 0x8 sans bitwise
      return v.toString(UUID_RADIX);
    });
  }