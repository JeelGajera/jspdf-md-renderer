/**
 * Collects the things a render decided not to draw.
 *
 * Failures in this library have historically been silent: token conversion
 * errors were logged and the content dropped, image failures warned,
 * unsupported element types warned, depth violations discarded whole subtrees.
 * A caller had no way to learn that the PDF they just produced was missing
 * content — and a render that quietly omits a clause from a contract is worse
 * than one that throws.
 *
 * Every such site now records a structured warning here, which surfaces on the
 * object `MdTextRender` returns.
 */

export type RenderWarningCode =
    | 'TOKEN_CONVERSION_FAILED'
    | 'UNSUPPORTED_ELEMENT'
    | 'IMAGE_LOAD_FAILED'
    | 'IMAGE_RENDER_FAILED'
    | 'IMAGE_ATTRS_IGNORED'
    | 'IMAGE_SIZE_UNKNOWN'
    | 'TABLE_SKIPPED'
    | 'TABLE_CALLBACK_FAILED'
    | 'TABLE_POSITION_UNKNOWN'
    | 'CODE_BLOCK_OVERFLOW'
    | 'CONTENT_DROPPED'
    | 'COMPONENT_OVERRIDE_FAILED'
    | 'SECURITY_CALLBACK_FAILED'
    | 'SSRF_CHECKS_UNAVAILABLE';

export interface RenderWarning {
    /** Machine-readable identifier for the kind of problem. */
    code: RenderWarningCode;
    /** Human-readable explanation. */
    message: string;
    /** Where it happened — an element type, a URL, a font family. */
    context?: string;
    /** How many nodes were discarded, when the warning is about lost content. */
    droppedNodes?: number;
}

/** Receives each warning as it is recorded. */
export type WarningListener = (warning: RenderWarning) => void;

/**
 * Anything a warning can be reported to. Both `RenderWarnings` and the render
 * store satisfy it, so a helper can accept whichever its caller has to hand.
 */
export interface WarningSink {
    warn(warning: RenderWarning): void;
}

export class RenderWarnings {
    private readonly warnings: RenderWarning[] = [];
    private readonly listener?: WarningListener;
    private readonly logToConsole: boolean;

    constructor(options: {
        listener?: WarningListener;
        logToConsole?: boolean;
    } = {}) {
        this.listener = options.listener;
        // Logging stays on by default so existing debugging workflows keep
        // working; `silent` turns it off for callers that read `warnings`.
        this.logToConsole = options.logToConsole ?? true;
    }

    public warn(warning: RenderWarning): void {
        this.warnings.push(warning);

        if (this.logToConsole) {
            console.warn(
                `[jspdf-md-renderer] ${warning.code}: ${warning.message}` +
                    (warning.context ? ` (${warning.context})` : ''),
            );
        }

        try {
            this.listener?.(warning);
        } catch (error) {
            // A caller's own listener must never take the render down.
            if (this.logToConsole) {
                console.warn(
                    '[jspdf-md-renderer] onWarning listener threw:',
                    error,
                );
            }
        }
    }

    /** Total nodes reported as dropped across every warning. */
    public get droppedNodes(): number {
        return this.warnings.reduce((n, w) => n + (w.droppedNodes ?? 0), 0);
    }

    public list(): RenderWarning[] {
        return [...this.warnings];
    }
}
