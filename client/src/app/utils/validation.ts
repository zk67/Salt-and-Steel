export const MAX_NAME_LENGTH = 20;
export const MAX_DESCRIPTION_LENGTH = 100;
export const MIN_NAME_LENGTH = 3;

export function isStringValid(s: string, minLength: number = MIN_NAME_LENGTH, maxLength: number = MAX_NAME_LENGTH): boolean {
    s = s.trim();

    if (s.length < minLength || s.length > maxLength) return false;

    // permet seulement les lettres, chiffres, espaces, tirets et underscores
    if (!/^[\w\- ]+$/u.test(s)) return false;

    return true;
}
