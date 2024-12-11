/* eslint-disable @typescript-eslint/no-explicit-any */
export type ParsedElement = {
    type: string;
    content?: string;
    depth?: number;
    items?: ParsedElement[];
    lang?: string;
    code?: string;
    src?: string;
    alt?: string;
    href?: string;
    text?: string;
    header?: {type?: string, content?: any};
    rows?: {type?: string, content?: any};
};
