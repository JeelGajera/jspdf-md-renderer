import { Cursor, RenderOption } from '../types';

export class RenderStore {
    private cursor: Cursor = { x: 0, y: 0 };
    private lastContentY_: number = 0;
    private options_: RenderOption;
    private inlineLock: boolean = false;

    constructor(options: RenderOption) {
        this.options_ = options;
        this.cursor = { x: options.cursor.x, y: options.cursor.y };
        this.lastContentY_ = options.cursor.y;
    }

    public getCursor(): Cursor {
        return this.cursor;
    }

    public setCursor(newCursor: Cursor) {
        this.cursor = newCursor;
    }

    public get options(): RenderOption {
        return this.options_;
    }

    public get isInlineLockActive(): boolean {
        return this.inlineLock;
    }

    public activateInlineLock() {
        this.inlineLock = true;
    }

    public deactivateInlineLock() {
        this.inlineLock = false;
    }

    /**
     * Updates the x pointer of the cursor.
     * @param value The value to set or add.
     * @param operation 'set' to assign a new value, 'add' to increment the current value.
     * @default operation = 'set'
     */
    public updateX(value: number, operation: 'set' | 'add' = 'set') {
        if (operation === 'set') {
            this.cursor.x = value;
        } else if (operation === 'add') {
            this.cursor.x += value;
        }
    }

    /**
     * Updates the y pointer of the cursor.
     * @param value The value to set or add.
     * @param operation 'set' to assign a new value, 'add' to increment the current value.
     * @default operation = 'set'
     */
    public updateY(value: number, operation: 'set' | 'add' = 'set') {
        if (operation === 'set') {
            this.cursor.y = value;
        } else if (operation === 'add') {
            this.cursor.y += value;
        }
    }

    /**
     * Records a Y position as the bottom of rendered content.
     * This is useful for container components (like blockquotes) to know
     * where their actual text content ends, ignoring any trailing margins.
     * @param specificY Optional Y value to record. Defaults to current cursor Y.
     */
    public recordContentY(specificY?: number) {
        this.lastContentY_ =
            specificY !== undefined ? specificY : this.cursor.y;
    }

    /**
     * Gets the last Y position recorded as content bottom.
     */
    public get lastContentY(): number {
        return this.lastContentY_;
    }

    // Convenience methods to get individual x and y values
    public get X(): number {
        return this.cursor.x;
    }

    public get Y(): number {
        return this.cursor.y;
    }
}
