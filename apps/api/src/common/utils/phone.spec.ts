import { normalizeTrMobile } from './phone.js';

describe('normalizeTrMobile', () => {
  it.each([
    ['05321234567', '+905321234567'],
    ['5321234567', '+905321234567'],
    ['+90 532 123 45 67', '+905321234567'],
    ['0 (532) 123-45-67', '+905321234567'],
  ])('%s → %s', (input, expected) => {
    expect(normalizeTrMobile(input)).toBe(expected);
  });

  it.each(['02121234567', '053212345', '12345', ''])('%s geçersiz', (input) => {
    expect(normalizeTrMobile(input)).toBeNull();
  });
});
