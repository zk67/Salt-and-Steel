const UUID_RADIX = 16;
const UUID_MASK = 0x3;
const UUID_VARIANT = 0x8;

export function generateUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (placeholderValue) => {
    const randomValue = Math.floor(Math.random() * UUID_RADIX);
    const computedValue = placeholderValue === 'x'
      ? randomValue
      : UUID_VARIANT + (randomValue % (UUID_MASK + 1)); // (r & 0x3) | 0x8 sans bitwise
    return computedValue.toString(UUID_RADIX);
  });
}