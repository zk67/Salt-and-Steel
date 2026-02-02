const MAX_NAME_LENGTH = 20;
const MIN_NAME_LENGTH = 3;

export function isStringValid(s: string): boolean {
    if (s.length < MIN_NAME_LENGTH || s.length > MAX_NAME_LENGTH) return false;

    // permet seulement les lettres, chiffres, espaces, tirets et underscores
    if (!/^[\w\- ]+$/u.test(s)) return false;

    return true;
}
