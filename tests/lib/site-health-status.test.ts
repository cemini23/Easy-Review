import { describe, it, expect } from 'vitest';
import {
  statusBool,
  ratingStatus,
  titleStatus,
  descStatus,
  scoreStatus,
  lcpStatus,
  clsStatus,
} from '@/lib/site-health-status';

describe('statusBool', () => {
  it('returns ok for true', () => {
    expect(statusBool(true)).toBe('ok');
  });
  it('returns warn for false', () => {
    expect(statusBool(false)).toBe('warn');
  });
  it('returns info for null', () => {
    expect(statusBool(null)).toBe('info');
  });
  it('returns info for undefined', () => {
    expect(statusBool(undefined)).toBe('info');
  });
});

describe('ratingStatus', () => {
  it('returns info for null', () => {
    expect(ratingStatus(null)).toBe('info');
  });
  it('returns info for undefined', () => {
    expect(ratingStatus(undefined)).toBe('info');
  });
  it('returns ok at 4.5 (lower boundary of ok)', () => {
    expect(ratingStatus(4.5)).toBe('ok');
  });
  it('returns warn just below ok (4.49)', () => {
    expect(ratingStatus(4.49)).toBe('warn');
  });
  it('returns warn at 4.0 (lower boundary of warn)', () => {
    expect(ratingStatus(4.0)).toBe('warn');
  });
  it('returns fail just below warn (3.99)', () => {
    expect(ratingStatus(3.99)).toBe('fail');
  });
});

describe('titleStatus', () => {
  it('returns info for null', () => {
    expect(titleStatus(null)).toBe('info');
  });
  it('returns ok at 30 (low boundary)', () => {
    expect(titleStatus(30)).toBe('ok');
  });
  it('returns ok at 60 (high boundary)', () => {
    expect(titleStatus(60)).toBe('ok');
  });
  it('returns warn at 29 (just below low boundary)', () => {
    expect(titleStatus(29)).toBe('warn');
  });
  it('returns warn at 61 (just above high boundary)', () => {
    expect(titleStatus(61)).toBe('warn');
  });
});

describe('descStatus', () => {
  it('returns info for null', () => {
    expect(descStatus(null)).toBe('info');
  });
  it('returns ok at 70 (low boundary)', () => {
    expect(descStatus(70)).toBe('ok');
  });
  it('returns ok at 160 (high boundary)', () => {
    expect(descStatus(160)).toBe('ok');
  });
  it('returns warn at 69 (just below low boundary)', () => {
    expect(descStatus(69)).toBe('warn');
  });
  it('returns warn at 161 (just above high boundary)', () => {
    expect(descStatus(161)).toBe('warn');
  });
});

describe('scoreStatus', () => {
  it('returns info for null', () => {
    expect(scoreStatus(null)).toBe('info');
  });
  it('returns ok at 90 (lower boundary of ok)', () => {
    expect(scoreStatus(90)).toBe('ok');
  });
  it('returns warn at 89 (just below ok)', () => {
    expect(scoreStatus(89)).toBe('warn');
  });
  it('returns warn at 50 (lower boundary of warn)', () => {
    expect(scoreStatus(50)).toBe('warn');
  });
  it('returns fail at 49 (just below warn)', () => {
    expect(scoreStatus(49)).toBe('fail');
  });
});

describe('lcpStatus', () => {
  it('returns info for null', () => {
    expect(lcpStatus(null)).toBe('info');
  });
  it('returns ok at 2500ms (upper boundary of ok)', () => {
    expect(lcpStatus(2500)).toBe('ok');
  });
  it('returns warn at 2501ms (just above ok)', () => {
    expect(lcpStatus(2501)).toBe('warn');
  });
  it('returns warn at 4000ms (upper boundary of warn)', () => {
    expect(lcpStatus(4000)).toBe('warn');
  });
  it('returns fail at 4001ms (just above warn)', () => {
    expect(lcpStatus(4001)).toBe('fail');
  });
});

describe('clsStatus', () => {
  it('returns info for null', () => {
    expect(clsStatus(null)).toBe('info');
  });
  it('returns ok at 0.1 (upper boundary of ok)', () => {
    expect(clsStatus(0.1)).toBe('ok');
  });
  it('returns warn at 0.11 (just above ok)', () => {
    expect(clsStatus(0.11)).toBe('warn');
  });
  it('returns warn at 0.25 (upper boundary of warn)', () => {
    expect(clsStatus(0.25)).toBe('warn');
  });
  it('returns fail at 0.26 (just above warn)', () => {
    expect(clsStatus(0.26)).toBe('fail');
  });
});
