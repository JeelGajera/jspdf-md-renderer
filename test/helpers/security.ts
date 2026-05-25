import { normalizeSecurityOptions } from '../../src/security/security-policy';
import { RenderSecurityOptions } from '../../src/types/security';

export const createSecurity = (
    overrides: RenderSecurityOptions = {},
): RenderSecurityOptions =>
    normalizeSecurityOptions({
        enabled: true,
        ...overrides,
    });
