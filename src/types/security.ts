export type ViolationMode = 'skip' | 'throw' | 'placeholder';
export type ViolationAction = 'skip' | 'placeholder';

export type SecurityViolationType = 'link' | 'image' | 'markdown' | 'render';

export type SecurityViolationCode =
    | 'MARKDOWN_TOO_LARGE'
    | 'MAX_NESTED_DEPTH_EXCEEDED'
    | 'MAX_IMAGE_COUNT_EXCEEDED'
    | 'RENDER_TIMEOUT_EXCEEDED'
    | 'INVALID_URL'
    | 'LINK_PROTOCOL_BLOCKED'
    | 'IMAGE_PROTOCOL_BLOCKED'
    | 'IMAGE_DOMAIN_BLOCKED'
    | 'DATA_URL_BLOCKED'
    | 'SVG_BLOCKED'
    | 'LOCALHOST_BLOCKED'
    | 'PRIVATE_IP_BLOCKED'
    | 'LINK_LOCAL_IP_BLOCKED'
    | 'METADATA_IP_BLOCKED'
    | 'IMAGE_SIZE_EXCEEDED'
    | 'CUSTOM_VALIDATOR_BLOCKED';

export interface SecurityViolation {
    /** Machine-readable violation code. */
    code: SecurityViolationCode;
    /** High-level category of the violating input. */
    type: SecurityViolationType;
    /** Human-readable explanation of the violation. */
    message: string;
    /** Raw value that triggered the violation (URL, length, etc.). */
    value?: string;
    /** Optional execution context to help debugging (e.g. 'markdown-link'). */
    context?: string;
    /** ISO timestamp when the violation was recorded. */
    timestamp: string;
}

export class SecurityViolationError extends Error {
    /** Structured violation payload used to construct this error. */
    public readonly violation: SecurityViolation;

    constructor(violation: SecurityViolation) {
        super(violation.message);
        this.name = 'SecurityViolationError';
        this.violation = violation;
    }
}

export interface RenderSecurityOptions {
    /** Enables all built-in security checks. Default: false (opt-in). */
    enabled?: boolean;
    /** Allowed URI protocols for markdown links. Example: ['https:', 'mailto:']. */
    allowedLinkProtocols?: string[];
    /** If true, link text is rendered but PDF link actions are disabled. */
    disablePdfLinks?: boolean;
    /** Whether remote image fetching is allowed (http/https). */
    allowRemoteImages?: boolean;
    /** Allowed protocols for image URLs. Example: ['https:', 'http:']. */
    allowedImageProtocols?: string[];
    /**
     * Optional domain allowlist for remote image hosts.
     * - `undefined` (default): all domains are allowed.
     * - `[]` (empty array): no domains are allowed.
     * - `['example.com']`: only `example.com` and its subdomains are allowed.
     */
    allowedImageDomains?: string[];
    /** Whether inline data: image URLs are allowed. */
    allowDataUrls?: boolean;
    /** Whether SVG images are allowed. */
    allowSvgImages?: boolean;
    /** Blocks localhost image/link destinations when true. */
    blockLocalhost?: boolean;
    /**
     * Blocks private IPv4 ranges (10/8, 172.16/12, 192.168/16) when true.
     * NOTE: In browser environments, IP-based checks cannot be enforced due to
     * lack of DNS resolution APIs. Use a trusted server-side proxy for strict enforcement.
     */
    blockPrivateIPs?: boolean;
    /**
     * Blocks link-local IPv4 ranges (169.254/16) when true.
     * NOTE: In browser environments, IP-based checks cannot be enforced due to
     * lack of DNS resolution APIs. Use a trusted server-side proxy for strict enforcement.
     */
    blockLinkLocalIPs?: boolean;
    /**
     * Blocks known cloud metadata endpoints when true.
     * NOTE: In browser environments, IP-based checks cannot be enforced due to
     * lack of DNS resolution APIs. Use a trusted server-side proxy for strict enforcement.
     */
    blockMetadataIPs?: boolean;
    /** Maximum markdown input length in characters. */
    maxMarkdownLength?: number;
    /** Maximum number of markdown images allowed per render. */
    maxImageCount?: number;
    /** Maximum image payload size in bytes (fetched blob size or decoded data URL bytes). */
    maxImageSizeBytes?: number;
    /** Maximum supported markdown nesting depth. */
    maxNestedDepth?: number;
    /** Maximum total render time in milliseconds. */
    renderTimeoutMs?: number;
    /** Action taken when a violation occurs. */
    violationMode?: ViolationMode;
    /** Placeholder text used for blocked text-like content in placeholder mode. */
    placeholderText?: string;
    /** Placeholder text used for blocked images in placeholder mode. */
    placeholderImageText?: string;
    /** Optional custom URL validator. Return false to reject the URL. */
    validateUrl?: (
        url: URL,
        type: 'link' | 'image',
    ) => boolean | Promise<boolean>;
    /** Callback fired for every security violation, regardless of mode. */
    onSecurityViolation?: (violation: SecurityViolation) => void;
}
