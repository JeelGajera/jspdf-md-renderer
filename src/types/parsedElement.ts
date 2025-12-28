export type ParsedElement = {
    type: string;
    content?: string;
    depth?: number;
    items?: ParsedElement[];
    ordered?: boolean;
    start?: number;
    lang?: string;
    code?: string;
    src?: string;
    alt?: string;
    href?: string;
    text?: string;
    header?: ParsedElement[];
    rows?: ParsedElement[][];
    data?: string;
};
