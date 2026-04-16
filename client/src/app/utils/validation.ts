export const MAX_NAME_LENGTH = 30;
export const MAX_DESCRIPTION_LENGTH = 100;
export const MIN_NAME_LENGTH = 3;
const UUID_RADIX = 16;
const UUID_MASK = 0x3;
const UUID_VARIANT = 0x8;

export function isStringValid(input: string, minLength: number = MIN_NAME_LENGTH, maxLength: number = MAX_NAME_LENGTH): boolean {
  input = input.trim();

  if (input.length < minLength || input.length > maxLength) return false;

  // permet les lettres (y compris accentuées), chiffres, espaces, tirets, underscores et apostrophes
  if (!/^[\p{L}\d\-_ '\u2019]+$/u.test(input)) return false;

  return true;
}

export function generateUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (placeholderValue) => {
    const randomValue = Math.floor(Math.random() * UUID_RADIX);
    const computedValue = placeholderValue === 'x'
      ? randomValue
      : UUID_VARIANT + (randomValue % (UUID_MASK + 1)); // (r & 0x3) | 0x8 sans bitwise
    return computedValue.toString(UUID_RADIX);
  });
}