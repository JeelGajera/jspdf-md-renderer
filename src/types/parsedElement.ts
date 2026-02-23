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
    // Image sizing attributes (in document units, e.g. mm for A4)
    width?: number;
    height?: number;
    // Image alignment: 'left' | 'center' | 'right'
    align?: 'left' | 'center' | 'right';
    // Intrinsic image dimensions (set during prefetch via getImageProperties)
    naturalWidth?: number;
    naturalHeight?: number;
};
