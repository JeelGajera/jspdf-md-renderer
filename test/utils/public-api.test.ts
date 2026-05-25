import { describe, expect, it } from 'vitest';
import * as api from '../../src/index';

describe('public api', () => {
    it('exports SecurityViolationError as a runtime value', () => {
        expect(typeof api.SecurityViolationError).toBe('function');
    });
});
