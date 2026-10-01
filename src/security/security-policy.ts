import {
    RenderSecurityOptions,
    SecurityViolation,
    SecurityViolationCode,
    SecurityViolationError,
    ViolationAction,
    ViolationMode,
} from '../types/security';
import { RenderWarning, RenderWarnings } from '../store/renderWarnings';

/**
 * Warning collector for the render a normalized security config belongs to.
 *
 * The security helpers are called from a dozen places that have no reason to
 * carry a collector around, and threading one through all of them would put
 * render bookkeeping into every signature. `normalizeSecurityOptions` produces
 * a fresh object per render, so keying off that object identity gives each
 * render its own collector without changing any public shape. A WeakMap keeps
 * it out of the object itself, so nothing leaks into what a caller can see.
 */
const renderWarningsBySecurity = new WeakMap<
    RenderSecurityOptions,
    RenderWarnings
>();

/** Associates a render's warning collector with its security config. */
export const attachRenderWarnings = (
    security: RenderSecurityOptions,
    warnings: RenderWarnings,
): void => {
    renderWarningsBySecurity.set(security, warnings);
};

/**
 * Reports a problem the security layer hit, through the render's collector
 * when there is one so `silent` and `onWarning` apply to it as well.
 */
const warnSecurity = (
    security: RenderSecurityOptions,
    warning: RenderWarning,
): void => {
    const warnings = renderWarningsBySecurity.get(security);
    if (warnings) {
        warnings.warn(warning);
        return;
    }
    // Called outside a render (the helpers are exported), so there is nowhere
    // to collect it.
    console.warn(`[jspdf-md-renderer] ${warning.code}: ${warning.message}`);
};

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
    imageFetchTimeoutMs: 10_000,
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
        'imageFetchTimeoutMs',
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
    merged.imageFetchTimeoutMs = clampInteger(
        merged.imageFetchTimeoutMs ?? 0,
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

const isLocalhostHost = (host: string): boolean =>
    host === 'localhost' ||
    // Reserved for loopback (RFC 6761), and resolved there by browsers.
    host.endsWith('.localhost') ||
    host === '127.0.0.1' ||
    host === '::1' || // IPv6 loopback
    host === '[::1]'; // bracketed IPv6 loopback

/**
 * The kinds of non-public address the `block*` options refer to. An address
 * can be several at once — 169.254.169.254 is both link-local and metadata.
 */
type AddressClass = 'localhost' | 'private' | 'linkLocal' | 'metadata';

/** Parses a dotted-quad IPv4 address into its 32-bit value. */
const parseIPv4 = (ip: string): number | null => {
    const parts = ip.split('.');
    if (parts.length !== 4) return null;
    let value = 0;
    for (const part of parts) {
        if (!/^\d{1,3}$/.test(part) || Number(part) > 255) return null;
        value = value * 256 + Number(part);
    }
    return value;
};

const inIPv4Range = (ip: number, base: number, bits: number): boolean => {
    const size = 2 ** (32 - bits);
    return Math.floor(ip / size) === Math.floor(base / size);
};

const ipv4 = (a: number, b: number, c: number, d: number): number =>
    ((a * 256 + b) * 256 + c) * 256 + d;

/**
 * Classifies an IPv4 address.
 *
 * Loopback is the whole of 127.0.0.0/8, and 0.0.0.0/8 ("this host") is treated
 * as local too: connecting to 0.0.0.0 reaches services listening only on
 * 127.0.0.1. Checking for the single string '127.0.0.1' let every other
 * spelling of the local host through `blockLocalhost`.
 */
const ipv4Classes = (ip: number): AddressClass[] => {
    const classes: AddressClass[] = [];
    if (
        inIPv4Range(ip, ipv4(127, 0, 0, 0), 8) ||
        inIPv4Range(ip, ipv4(0, 0, 0, 0), 8)
    ) {
        classes.push('localhost');
    }
    if (
        inIPv4Range(ip, ipv4(10, 0, 0, 0), 8) ||
        inIPv4Range(ip, ipv4(172, 16, 0, 0), 12) ||
        inIPv4Range(ip, ipv4(192, 168, 0, 0), 16)
    ) {
        classes.push('private');
    }
    if (inIPv4Range(ip, ipv4(169, 254, 0, 0), 16)) classes.push('linkLocal');
    if (ip === ipv4(169, 254, 169, 254) || ip === ipv4(100, 100, 100, 200)) {
        classes.push('metadata');
    }
    return classes;
};

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

const inIPv6Range = (ip: bigint, prefix: bigint, bits: number): boolean =>
    ip >> BigInt(128 - bits) === prefix >> BigInt(128 - bits);

/** fd00:ec2::254, the IPv6 address of the AWS instance metadata service. */
const AWS_METADATA_IPV6 = (0xfd00_0ec2n << 96n) | 0x254n;

/**
 * The IPv4 address an IPv6 address carries, for the forms that route to it.
 *
 * Each of these reaches the embedded IPv4 host, so it must be held to the IPv4
 * rules — otherwise `[::ffff:127.0.0.1]` is simply another way to write
 * localhost.
 */
const embeddedIPv4 = (ip: bigint): number | null => {
    const low32 = Number(ip & 0xffff_ffffn);
    const high96 = ip >> 32n;
    // ::ffff:a.b.c.d (IPv4-mapped) and ::a.b.c.d (IPv4-compatible)
    if (high96 === 0xffffn || high96 === 0n) return low32;
    // 64:ff9b::a.b.c.d (NAT64 well-known prefix)
    if (high96 === 0x0064_ff9b_0000_0000_0000_0000n) return low32;
    // 2002:aabb:ccdd::/48 (6to4)
    if (ip >> 112n === 0x2002n) return Number((ip >> 80n) & 0xffff_ffffn);
    return null;
};

const ipv6Classes = (ip: bigint): AddressClass[] => {
    const classes: AddressClass[] = [];
    // ::1 (loopback) and :: (unspecified, which reaches the local host)
    if (ip === 1n || ip === 0n) classes.push('localhost');
    if (inIPv6Range(ip, 0xfc00n << 112n, 7)) classes.push('private');
    if (inIPv6Range(ip, 0xfe80n << 112n, 10)) classes.push('linkLocal');
    if (ip === AWS_METADATA_IPV6) classes.push('metadata');

    const embedded = embeddedIPv4(ip);
    if (embedded !== null) classes.push(...ipv4Classes(embedded));
    return classes;
};

/** Classifies an IP address literal; anything that is not one has no class. */
const addressClasses = (address: string): AddressClass[] => {
    const stripped = address.replace(/^\[|\]$/g, '');
    const v4 = parseIPv4(stripped);
    if (v4 !== null) return ipv4Classes(v4);
    const v6 = stripped.includes(':') ? parseIPv6ToBigInt(stripped) : null;
    return v6 === null ? [] : ipv6Classes(v6);
};

/**
 * Which option blocks which class, in the order they are checked. The order
 * decides the violation code when an address belongs to several classes.
 */
const ADDRESS_RULES: ReadonlyArray<{
    addressClass: AddressClass;
    option: keyof Pick<
        RenderSecurityOptions,
        | 'blockLocalhost'
        | 'blockPrivateIPs'
        | 'blockLinkLocalIPs'
        | 'blockMetadataIPs'
    >;
    code: SecurityViolationCode;
    message: string;
}> = [
    {
        addressClass: 'localhost',
        option: 'blockLocalhost',
        code: 'LOCALHOST_BLOCKED',
        message: 'Localhost IP is blocked',
    },
    {
        addressClass: 'private',
        option: 'blockPrivateIPs',
        code: 'PRIVATE_IP_BLOCKED',
        message: 'Private IP is blocked',
    },
    {
        addressClass: 'linkLocal',
        option: 'blockLinkLocalIPs',
        code: 'LINK_LOCAL_IP_BLOCKED',
        message: 'Link-local IP is blocked',
    },
    {
        addressClass: 'metadata',
        option: 'blockMetadataIPs',
        code: 'METADATA_IP_BLOCKED',
        message: 'Metadata IP is blocked',
    },
];

/** The host itself when it is an IP literal, otherwise nothing. */
const literalAddresses = (host: string): string[] => {
    const stripped = host.replace(/^\[|\]$/g, '');
    const isLiteralV4 = /^\d{1,3}(\.\d{1,3}){3}$/.test(stripped);
    return isLiteralV4 || stripped.includes(':') ? [stripped] : [];
};

/**
 * Resolves a hostname to IP addresses.
 * Returns null when resolution is unavailable (browser runtime).
 */
const resolveHostToIPs = async (host: string): Promise<string[] | null> => {
    const literal = literalAddresses(host);
    if (literal.length > 0) return literal;
    const stripped = host.replace(/^\[|\]$/g, '');

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
        warnSecurity(security, {
            code: 'SECURITY_CALLBACK_FAILED',
            message:
                `The security.onSecurityViolation callback threw: ${String(error)}. ` +
                'The violation was still handled according to violationMode.',
            context: violation.code,
        });
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
                relativeUrl = new URL(
                    normalizedValue,
                    'https://relative.local',
                );
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
    // A trailing dot names the same host — `localhost.` is `localhost` — so
    // the name checks ignore it. Resolution below keeps the exact hostname,
    // so it looks up what fetch will connect to.
    const hostName = host.replace(/\.$/, '');
    if (security.blockLocalhost && isLocalhostHost(hostName)) {
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
    if (security.blockMetadataIPs && metadataHosts.has(hostName)) {
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

    // A link is never fetched by the renderer: whoever opens the PDF follows
    // it, from their own network, so the renderer's DNS says nothing about
    // where it leads. Resolving every link only slowed renders and let a
    // document make the server look up hostnames of its choosing. Addresses
    // written into the link itself are still checked.
    const ips =
        type === 'link' ? literalAddresses(host) : await resolveHostToIPs(host);
    if (ips === null) {
        if (type === 'image') {
            warnSecurity(security, {
                code: 'SSRF_CHECKS_UNAVAILABLE',
                message:
                    'IP-based SSRF checks (blockPrivateIPs, blockLinkLocalIPs, ' +
                    'blockMetadataIPs) cannot be enforced without DNS resolution, ' +
                    'which is unavailable in browser environments. Route image ' +
                    'fetching through a trusted server-side proxy for strict ' +
                    'enforcement.',
                context: host,
            });
        }
    } else {
        for (const ip of ips) {
            const classes = addressClasses(ip);
            for (const rule of ADDRESS_RULES) {
                if (
                    security[rule.option] &&
                    classes.includes(rule.addressClass)
                ) {
                    handleSecurityViolation(
                        security,
                        createViolation(
                            rule.code,
                            type,
                            rule.message,
                            rawValue,
                            context,
                        ),
                    );
                    return false;
                }
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
