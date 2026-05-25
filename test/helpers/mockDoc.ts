type FontState = {
    fontName: string;
    fontStyle: string;
};

export class MockDoc {
    public internal = { scaleFactor: 1 };
    public addPageCalls = 0;
    public textCalls: Array<{ text: string; x: number; y: number }> = [];
    public setFontCalls: Array<{ name: string; style: string }> = [];
    public addImageCalls: Array<{
        data: string;
        format: string;
        x: number;
        y: number;
        w: number;
        h: number;
    }> = [];
    public lineCalls: Array<{ x1: number; y1: number; x2: number; y2: number }> = [];
    public rectCalls: Array<{
        x: number;
        y: number;
        w: number;
        h: number;
        style?: string;
    }> = [];
    public roundedRectCalls: Array<{
        x: number;
        y: number;
        w: number;
        h: number;
        rx: number;
        ry: number;
        style?: string;
    }> = [];
    public setPageCalls: number[] = [];
    public pageWidth = 210;
    public currentPage = 1;
    public charSpace = 0;
    public lineHeightFactor = 1.15;
    public drawColor = '#000000';
    public fillColor = '#FFFFFF';
    public lineWidth = 0.2;
    public lastAutoTable?: { finalY: number };
    public links: Array<{ x: number; y: number; w: number; h: number; url: string }> =
        [];
    public fontSize = 12;
    public textColor = '#000000';
    private font: FontState = { fontName: 'helvetica', fontStyle: 'normal' };

    constructor() {
        this.internal = {
            scaleFactor: 1,
            pageSize: {
                getWidth: () => this.pageWidth,
            },
            getCurrentPageInfo: () => ({
                pageNumber: this.currentPage,
            }),
        };
    }

    setFontSize(size: number): this {
        this.fontSize = size;
        return this;
    }

    getFontSize(): number {
        return this.fontSize;
    }

    setFont(name: string, style: string): this {
        this.font = { fontName: name, fontStyle: style };
        this.setFontCalls.push({ name, style });
        return this;
    }

    getFont(): FontState {
        return this.font;
    }

    getTextColor(): string {
        return this.textColor;
    }

    setTextColor(...color: unknown[]): this {
        if (color.length === 1) {
            this.textColor = String(color[0]);
        } else if (color.length >= 3) {
            this.textColor = `${color[0]},${color[1]},${color[2]}`;
        }
        return this;
    }

    getTextWidth(text: string): number {
        return text.length * 2;
    }

    getTextDimensions(text: string): { w: number; h: number } {
        return { w: this.getTextWidth(text), h: this.fontSize };
    }

    text(text: string, x: number, y: number): this {
        this.textCalls.push({ text, x, y });
        return this;
    }

    splitTextToSize(text: string, maxWidth: number): string[] {
        if (!text) return [];
        const words = text.split(/\s+/).filter(Boolean);
        const lines: string[] = [];
        let current = '';
        for (const word of words) {
            const candidate = current ? `${current} ${word}` : word;
            if (this.getTextWidth(candidate) > maxWidth && current) {
                lines.push(current);
                current = word;
            } else {
                current = candidate;
            }
        }
        if (current) lines.push(current);
        return lines;
    }

    getCharSpace(): number {
        return this.charSpace;
    }

    getLineHeightFactor(): number {
        return this.lineHeightFactor;
    }

    link(x: number, y: number, w: number, h: number, opts: { url: string }): this {
        this.links.push({ x, y, w, h, url: opts.url });
        return this;
    }

    addPage(): this {
        this.addPageCalls += 1;
        this.currentPage += 1;
        return this;
    }

    setPage(page: number): this {
        this.currentPage = page;
        this.setPageCalls.push(page);
        return this;
    }

    addImage(
        data: string,
        format: string,
        x: number,
        y: number,
        w: number,
        h: number,
    ): this {
        this.addImageCalls.push({ data, format, x, y, w, h });
        return this;
    }

    setLineDashPattern(): this {
        return this;
    }

    roundedRect(
        x: number,
        y: number,
        w: number,
        h: number,
        rx: number,
        ry: number,
        style?: string,
    ): this {
        this.roundedRectCalls.push({ x, y, w, h, rx, ry, style });
        return this;
    }

    getDrawColor(): string {
        return this.drawColor;
    }

    setDrawColor(): this {
        this.drawColor = 'updated';
        return this;
    }

    getFillColor(): string {
        return this.fillColor;
    }

    setFillColor(...values: unknown[]): this {
        this.fillColor = values.map(String).join(',');
        return this;
    }

    getLineWidth(): number {
        return this.lineWidth;
    }

    setLineWidth(width?: number): this {
        if (typeof width === 'number') this.lineWidth = width;
        return this;
    }

    rect(x: number, y: number, w: number, h: number, style?: string): this {
        this.rectCalls.push({ x, y, w, h, style });
        return this;
    }

    line(x1: number, y1: number, x2: number, y2: number): this {
        this.lineCalls.push({ x1, y1, x2, y2 });
        return this;
    }
}
