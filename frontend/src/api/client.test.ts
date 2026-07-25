import { apiError } from './client';

describe('apiError', () => {
  it('prefers the backend error message when present', () => {
    const err = { response: { data: { error: 'Invalid email or password' } } };
    expect(apiError(err)).toBe('Invalid email or password');
  });

  it('falls back to the generic axios message when no backend error body', () => {
    const err = { message: 'Network Error' };
    expect(apiError(err)).toBe('Network Error');
  });

  it('falls back to a default string when nothing usable is present', () => {
    expect(apiError({})).toBe('Request failed');
    expect(apiError(null)).toBe('Request failed');
  });
});
