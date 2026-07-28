import {
    RenderSecurityOptions,
    SecurityViolation,
    SecurityViolationCode,
    SecurityViolationError,
    ViolationAction,
    ViolationMode,
} from '../types/security';

const DEFAULT_SECURITY: Required<
    Omit<
        RenderSecurityOptions,
        'validateUrl' | 'onSecurityViolation' | 'allowedImageDomains'
    >
> & {
    allowedImageDomains?: string[];
} = {
    enabled: false,
    allowedLinkProtocols: ['https:', 'http:', 'mailto:', 'tel:'],
    disablePdfLinks: false,
    allowRemoteImages: true,
    allowedImageProtocols: ['https:', 'http:'],
    allowedImageDomains: undefined,
    allowDataUrls: true,
    allowSvgImages: true,
    blockLocalhost: true,
    blockPrivateIPs: true,
    blockLinkLocalIPs: true,
    blockMetadataIPs: true,
    maxMarkdownLength: 500_000,
    maxImageCount: 200,
    maxImageSizeBytes: 10 * 1024 * 1024,
    maxNestedDepth: 20,
    renderTimeoutMs: 30_000,
    violationMode: 'skip',
    placeholderText: '[blocked]',
    placeholderImageText: '[blocked image]',
};

const normalizeProtocol = (v: string): string =>
    `${v.trim().toLowerCase().replace(/:$/, '')}:`;

const normalizeDomain = (v: string): string => v.trim().toLowerCase();

const clampInteger = (value: number, min: number, max: number): number =>
    Math.min(max, Math.max(min, Math.floor(value)));

export const isNodeEnvironment = (): boolean =>
    typeof process !== 'undefined' &&
    process.versions != null &&
    process.versions.node != null;

/**
 * Merges user-provided security config with safe defaults and
 * validates/clamps numeric and enum fields.
 */
export const normalizeSecurityOptions = (
    security?: RenderSecurityOptions,
): RenderSecurityOptions => {
    if (!security) return { ...DEFAULT_SECURITY };

    const merged: RenderSecurityOptions = {
        ...DEFAULT_SECURITY,
        ...security,
        allowedLinkProtocols:
            security.allowedLinkProtocols?.map(normalizeProtocol) ??
            DEFAULT_SECURITY.allowedLinkProtocols,
        allowedImageProtocols:
            security.allowedImageProtocols?.map(normalizeProtocol) ??
            DEFAULT_SECURITY.allowedImageProtocols,
        allowedImageDomains:
            security.allowedImageDomains !== undefined
                ? security.allowedImageDomains.map(normalizeDomain)
                : DEFAULT_SECURITY.allowedImageDomains,
    };

    const validMode: ViolationMode[] = ['skip', 'throw', 'placeholder'];
    if (!validMode.includes(merged.violationMode || 'skip')) {
        throw new Error(
            '[jspdf-md-renderer] security.violationMode must be skip | throw | placeholder',
        );
    }

    const numFields: Array<keyof RenderSecurityOptions> = [
        'maxMarkdownLength',
        'maxImageCount',
        'maxImageSizeBytes',
        'maxNestedDepth',
        'renderTimeoutMs',
    ];
    for (const field of numFields) {
        const value = merged[field] as number;
        if (value !== undefined && (!Number.isFinite(value) || value < 0)) {
            throw new Error(
                `[jspdf-md-renderer] security.${field} must be a non-negative number`,
            );
        }
    }

    merged.maxMarkdownLength = clampInteger(
        merged.maxMarkdownLength || 0,
        0,
        5_000_000,
    );
    merged.maxImageCount = clampInteger(merged.maxImageCount || 0, 0, 10_000);
    merged.maxImageSizeBytes = clampInteger(
        merged.maxImageSizeBytes || 0,
        0,
        100 * 1024 * 1024,
    );
    merged.maxNestedDepth = clampInteger(merged.maxNestedDepth || 0, 0, 100);
    merged.renderTimeoutMs = clampInteger(
        merged.renderTimeoutMs || 0,
        0,
        300_000,
    );

    return merged;
};

const metadataHosts = new Set([
    'metadata.google.internal',
    'metadata',
    'instance-data',
]);

const isIPv4InCidr = (
    ip: string,
    cidrBase: string,
    cidrMask: number,
): boolean => {
    const toNum = (s: string): number =>
        s.split('.').reduce((acc, part) => (acc << 8) + Number(part), 0) >>> 0;
    const ipNum = toNum(ip);
    const baseNum = toNum(cidrBase);
    const mask = cidrMask === 0 ? 0 : (0xffffffff << (32 - cidrMask)) >>> 0;
    return (ipNum & mask) === (baseNum & mask);
};

const isLocalhostHost = (host: string): boolean =>
    host === 'localhost' ||
    host === '127.0.0.1' ||
    host === '::1' || // IPv6 loopback
    host === '[::1]'; // bracketed IPv6 loopback

const isPrivateIPv4 = (ip: string): boolean =>
    isIPv4InCidr(ip, '10.0.0.0', 8) ||
    isIPv4InCidr(ip, '172.16.0.0', 12) ||
    isIPv4InCidr(ip, '192.168.0.0', 16);

const isLinkLocalIPv4 = (ip: string): boolean =>
    isIPv4InCidr(ip, '169.254.0.0', 16);

const isMetadataIP = (ip: string): boolean =>
    ip === '169.254.169.254' || ip === '100.100.100.200';

/**
 * Parses an IPv6 address string into a BigInt for range comparison.
 * Supports compressed and IPv4-mapped forms.
 */
const parseIPv6ToBigInt = (ip: string): bigint | null => {
    let stripped = ip.replace(/^\[|\]$/g, '').toLowerCase();

    if (stripped.includes('.')) {
        const lastColon = stripped.lastIndexOf(':');
        if (lastColon < 0) return null;
        const ipv4Part = stripped.slice(lastColon + 1);
        const prefix = stripped.slice(0, lastColon);
        const parts = ipv4Part.split('.').map(Number);
        if (
            parts.length !== 4 ||
            parts.some((p) => Number.isNaN(p) || p < 0 || p > 255)
        ) {
            return null;
        }
        const hi = ((parts[0] << 8) | parts[1]).toString(16);
        const lo = ((parts[2] << 8) | parts[3]).toString(16);
        stripped = `${prefix}:${hi}:${lo}`;
    }

    let expanded = stripped;
    if (expanded.includes('::')) {
        const parts = expanded.split('::');
        if (parts.length !== 2) return null;
        const leftGroups = parts[0] ? parts[0].split(':') : [];
        const rightGroups = parts[1] ? parts[1].split(':') : [];
        const missing = 8 - leftGroups.length - rightGroups.length;
        if (missing < 0) return null;
        expanded = [
            ...leftGroups,
            ...Array(missing).fill('0'),
            ...rightGroups,
        ].join(':');
    }

    const groups = expanded.split(':');
    if (groups.length !== 8) return null;

    try {
        return groups.reduce((acc, g) => {
            const n = parseInt(g || '0', 16);
            if (Number.isNaN(n)) throw new Error('invalid hex');
            return (acc << 16n) + BigInt(n);
        }, 0n);
    } catch {
        return null;
    }
};

const MAX_IPV6 = (1n << 128n) - 1n;
const isIPv6InRange = (
    ip: string,
    prefixBigInt: bigint,
    prefixLength: number,
): boolean => {
    const ipNum = parseIPv6ToBigInt(ip);
    if (ipNum === null) return false;
    const mask =
        prefixLength === 0
            ? 0n
            : (MAX_IPV6 << BigInt(128 - prefixLength)) & MAX_IPV6;
    return (ipNum & mask) === (prefixBigInt & mask);
};

const isLoopbackIPv6 = (ip: string): boolean => {
    const num = parseIPv6ToBigInt(ip);
    return num === 1n;
};

const isUniqueLocalIPv6 = (ip: string): boolean =>
    isIPv6InRange(ip, 0xfc00n << 112n, 7);

const isLinkLocalIPv6 = (ip: string): boolean =>
    isIPv6InRange(ip, 0xfe80n << 112n, 10);

const extractIPv4Mapped = (ip: string): string | null => {
    const stripped = ip.replace(/^\[|\]$/g, '');

    // Fast path for dotted form (::ffff:169.254.169.254).
    const dottedMatch = stripped.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/i);
    if (dottedMatch) return dottedMatch[1];

    // General path for hex form (::ffff:a9fe:a9fe) and equivalent compressed forms.
    const ipNum = parseIPv6ToBigInt(stripped);
    if (ipNum === null) return null;
    if (ipNum >> 32n !== 0xffffn) return null;

    const low32 = Number(ipNum & 0xffffffffn);
    const octet1 = (low32 >>> 24) & 0xff;
    const octet2 = (low32 >>> 16) & 0xff;
    const octet3 = (low32 >>> 8) & 0xff;
    const octet4 = low32 & 0xff;
    return `${octet1}.${octet2}.${octet3}.${octet4}`;
};

const isIPv4MappedPrivate = (ip: string): boolean => {
    const mapped = extractIPv4Mapped(ip);
    return mapped ? isPrivateIPv4(mapped) : false;
};

const isIPv4MappedLinkLocal = (ip: string): boolean => {
    const mapped = extractIPv4Mapped(ip);
    return mapped ? isLinkLocalIPv4(mapped) : false;
};

const isIPv4MappedMetadata = (ip: string): boolean => {
    const mapped = extractIPv4Mapped(ip);
    return mapped ? isMetadataIP(mapped) : false;
};

/**
 * Resolves a hostname to IP addresses.
 * Returns null when resolution is unavailable (browser runtime).
 */
const resolveHostToIPs = async (host: string): Promise<string[] | null> => {
    const stripped = host.replace(/^\[|\]$/g, '');
    const isLiteralV4 = /^\d{1,3}(\.\d{1,3}){3}$/.test(stripped);
    if (isLiteralV4) return [stripped];
    if (stripped.includes(':')) return [stripped];

    if (!isNodeEnvironment()) {
        return null;
    }

    try {
        const dns = await import('node:dns');
        const entries = await dns.promises.lookup(stripped, { all: true });
        return entries.map((entry) => entry.address);
    } catch {
        return [];
    }
};

/**
 * Returns the action the caller should take for the violating element.
 * Throws SecurityViolationError when violationMode is 'throw'.
 */
export const handleSecurityViolation = (
    security: RenderSecurityOptions,
    violation: Omit<SecurityViolation, 'timestamp'>,
): ViolationAction => {
    const fullViolation: SecurityViolation = {
        ...violation,
        timestamp: new Date().toISOString(),
    };

    try {
        security.onSecurityViolation?.(fullViolation);
    } catch (error) {
        console.warn(
            '[jspdf-md-renderer] security.onSecurityViolation callback failed:',
            error,
        );
    }

    const mode = security.violationMode || 'skip';
    if (mode === 'throw') {
        throw new SecurityViolationError(fullViolation);
    }
    if (mode === 'placeholder') {
        return 'placeholder';
    }
    return 'skip';
};

const createViolation = (
    code: SecurityViolationCode,
    type: SecurityViolation['type'],
    message: string,
    value?: string,
    context?: string,
): Omit<SecurityViolation, 'timestamp'> => ({
    code,
    type,
    message,
    value,
    context,
});

/**
 * Returns true when:
 * - allowedDomains is undefined (feature not configured, allow all), OR
 * - host matches an entry in the allowlist.
 *
 * An explicitly empty allowedDomains array means no domains are permitted.
 */
const isAllowedDomain = (
    host: string,
    allowedDomains: string[] | undefined,
): boolean => {
    if (allowedDomains === undefined) return true;
    if (allowedDomains.length === 0) return false;
    return allowedDomains.some(
        (domain) => host === domain || host.endsWith(`.${domain}`),
    );
};

type UrlClass = 'explicitScheme' | 'protocolRelative' | 'relativePath';

/**
 * Mirrors the WHATWG URL parser's own preprocessing before we make any
 * security decision based on the shape of the string. Two things browsers
 * (and Node's URL/fetch implementation) do that we must match:
 *
 * 1. Strip ASCII tab / newline / CR before parsing.
 * 2. For special schemes (http/https/ws/wss/ftp/file), treat backslashes
 *    the same as forward slashes when resolving a reference.
 *
 * Without this, a string like "\\evil.com/x" is classified as a harmless
 * "relative path" (and thus allowed with zero protocol/domain/SSRF checks),
 * even though it actually resolves to https://evil.com/x once any real URL
 * parser (browser, fetch, PDF viewer) gets hold of it.
 */
const normalizeUrlForClassification = (raw: string): string =>
    raw.replace(/[\t\n\r]/g, '').replace(/\\/g, '/');

const classifyUrl = (raw: string): UrlClass => {
    const normalized = normalizeUrlForClassification(raw);
    if (/^[a-zA-Z][a-zA-Z\d+\-.]*:/.test(normalized)) return 'explicitScheme';
    if (normalized.startsWith('//')) return 'protocolRelative';
    return 'relativePath';
};

/**
 * Validates link/image URLs against protocol/domain/SSRF rules.
 *
 * URL classification:
 * - Protocol-relative (`//host/path`): treated as external absolute and validated.
 * - Explicit scheme (`https://...`): fully validated.
 * - Relative path (`/x`, `./x`, `../x`, `?x`, `#x`): allowed by default.
 */
export const validateResourceUrl = async (
    rawValue: string,
    type: 'link' | 'image',
    security: RenderSecurityOptions,
    context?: string,
): Promise<boolean> => {
    // Classify (and construct any URL object) using the normalized form —
    // never the raw attacker string — so classification and resolution can
    // never disagree with each other.
    const normalizedValue = normalizeUrlForClassification(rawValue);
    const urlClass = classifyUrl(rawValue);

    if (urlClass === 'relativePath') {
        if (security.validateUrl) {
            let relativeUrl: URL;
            try {
                relativeUrl = new URL(normalizedValue, 'https://relative.local');
            } catch {
                handleSecurityViolation(
                    security,
                    createViolation(
                        'INVALID_URL',
                        type,
                        'Invalid relative URL',
                        rawValue,
                        context,
                    ),
                );
                return false;
            }
            const accepted = await security.validateUrl(relativeUrl, type);
            if (!accepted) {
                handleSecurityViolation(
                    security,
                    createViolation(
                        'CUSTOM_VALIDATOR_BLOCKED',
                        type,
                        'Custom URL validator rejected relative URL',
                        rawValue,
                        context,
                    ),
                );
                return false;
            }
        }
        return true;
    }

    let canonicalRaw = normalizedValue;
    if (urlClass === 'protocolRelative') {
        canonicalRaw = `https:${normalizedValue}`;
    }

    let parsed: URL;
    try {
        parsed = new URL(canonicalRaw);
    } catch {
        handleSecurityViolation(
            security,
            createViolation(
                'INVALID_URL',
                type,
                'Invalid URL',
                rawValue,
                context,
            ),
        );
        return false;
    }

    if (urlClass !== 'protocolRelative') {
        const protocol = normalizeProtocol(parsed.protocol);
        const protocolList =
            type === 'link'
                ? security.allowedLinkProtocols ||
                DEFAULT_SECURITY.allowedLinkProtocols
                : security.allowedImageProtocols ||
                DEFAULT_SECURITY.allowedImageProtocols;

        if (!protocolList.includes(protocol)) {
            handleSecurityViolation(
                security,
                createViolation(
                    type === 'link'
                        ? 'LINK_PROTOCOL_BLOCKED'
                        : 'IMAGE_PROTOCOL_BLOCKED',
                    type,
                    `${type} protocol is blocked`,
                    rawValue,
                    context,
                ),
            );
            return false;
        }
    }

    if (
        type === 'image' &&
        !isAllowedDomain(
            parsed.hostname.toLowerCase(),
            security.allowedImageDomains,
        )
    ) {
        handleSecurityViolation(
            security,
            createViolation(
                'IMAGE_DOMAIN_BLOCKED',
                type,
                'Image domain is blocked',
                rawValue,
                context,
            ),
        );
        return false;
    }

    const host = parsed.hostname.toLowerCase();
    if (security.blockLocalhost && isLocalhostHost(host)) {
        handleSecurityViolation(
            security,
            createViolation(
                'LOCALHOST_BLOCKED',
                type,
                'Localhost URL is blocked',
                rawValue,
                context,
            ),
        );
        return false;
    }
    if (security.blockMetadataIPs && metadataHosts.has(host)) {
        handleSecurityViolation(
            security,
            createViolation(
                'METADATA_IP_BLOCKED',
                type,
                'Metadata host is blocked',
                rawValue,
                context,
            ),
        );
        return false;
    }

    const ips = await resolveHostToIPs(host);
    if (ips === null) {
        if (type === 'image') {
            console.warn(
                '[jspdf-md-renderer] Security warning: IP-based SSRF checks ' +
                '(blockPrivateIPs, blockLinkLocalIPs, blockMetadataIPs) ' +
                'cannot be fully enforced in browser environments. Route image ' +
                'fetching through a trusted server-side proxy.',
            );
        }
    } else {
        for (const ip of ips) {
            if (security.blockLocalhost && isLocalhostHost(ip)) {
                handleSecurityViolation(
                    security,
                    createViolation(
                        'LOCALHOST_BLOCKED',
                        type,
                        'Localhost IP is blocked',
                        rawValue,
                        context,
                    ),
                );
                return false;
            }
            if (security.blockPrivateIPs && isPrivateIPv4(ip)) {
                handleSecurityViolation(
                    security,
                    createViolation(
                        'PRIVATE_IP_BLOCKED',
                        type,
                        'Private IP is blocked',
                        rawValue,
                        context,
                    ),
                );
                return false;
            }
            if (security.blockLinkLocalIPs && isLinkLocalIPv4(ip)) {
                handleSecurityViolation(
                    security,
                    createViolation(
                        'LINK_LOCAL_IP_BLOCKED',
                        type,
                        'Link-local IP is blocked',
                        rawValue,
                        context,
                    ),
                );
                return false;
            }
            if (security.blockMetadataIPs && isMetadataIP(ip)) {
                handleSecurityViolation(
                    security,
                    createViolation(
                        'METADATA_IP_BLOCKED',
                        type,
                        'Metadata IP is blocked',
                        rawValue,
                        context,
                    ),
                );
                return false;
            }

            if (security.blockLocalhost && isLoopbackIPv6(ip)) {
                handleSecurityViolation(
                    security,
                    createViolation(
                        'LOCALHOST_BLOCKED',
                        type,
                        'IPv6 loopback is blocked',
                        rawValue,
                        context,
                    ),
                );
                return false;
            }
            if (
                security.blockPrivateIPs &&
                (isUniqueLocalIPv6(ip) || isIPv4MappedPrivate(ip))
            ) {
                handleSecurityViolation(
                    security,
                    createViolation(
                        'PRIVATE_IP_BLOCKED',
                        type,
                        'IPv6 private address is blocked',
                        rawValue,
                        context,
                    ),
                );
                return false;
            }
            if (
                security.blockLinkLocalIPs &&
                (isLinkLocalIPv6(ip) || isIPv4MappedLinkLocal(ip))
            ) {
                handleSecurityViolation(
                    security,
                    createViolation(
                        'LINK_LOCAL_IP_BLOCKED',
                        type,
                        'IPv6 link-local address is blocked',
                        rawValue,
                        context,
                    ),
                );
                return false;
            }
            if (security.blockMetadataIPs && isIPv4MappedMetadata(ip)) {
                handleSecurityViolation(
                    security,
                    createViolation(
                        'METADATA_IP_BLOCKED',
                        type,
                        'IPv4-mapped metadata IP is blocked',
                        rawValue,
                        context,
                    ),
                );
                return false;
            }
        }
    }

    if (security.validateUrl) {
        const accepted = await security.validateUrl(parsed, type);
        if (!accepted) {
            handleSecurityViolation(
                security,
                createViolation(
                    'CUSTOM_VALIDATOR_BLOCKED',
                    type,
                    'Custom URL validator rejected URL',
                    rawValue,
                    context,
                ),
            );
            return false;
        }
    }

    return true;
};

/**
 * Returns true when the value is a `data:` URL.
 */
export const isDataUrl = (value: string): boolean =>
    value.trim().toLowerCase().startsWith('data:');

/**
 * Returns true when the value is an SVG data URL.
 */
export const isSvgDataUrl = (value: string): boolean => {
    const normalized = value.trim().toLowerCase();
    return (
        normalized.startsWith('data:image/svg+xml') ||
        normalized.startsWith('data:image/svg')
    );
};
