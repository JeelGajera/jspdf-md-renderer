import { Cursor, RenderOption } from '../types';

export class RenderStore {
    private static cursor: Cursor = { x: 0, y: 0 };
    private static options_: RenderOption;
    private static inlineLock: boolean = false;

    public static initialize(options: RenderOption) {
        this.options_ = options;
        this.cursor = { x: options.cursor.x, y: options.cursor.y };
    }

    public static getCursor(): Cursor {
        return this.cursor;
    }

    public static setCursor(newCursor: Cursor) {
        this.cursor = newCursor;
    }

    public static get options(): RenderOption {
        return this.options_;
    }

    public static get isInlineLockActive(): boolean {
        return this.inlineLock;
    }

    public static activateInlineLock() {
        this.inlineLock = true;
    }

    public static deactivateInlineLock() {
        this.inlineLock = false;
    }

    /**
     * Updates the x pointer of the cursor.
     * @param value The value to set or add.
     * @param operation 'set' to assign a new value, 'add' to increment the current value.
     * @default operation = 'set'
     */
    public static updateX(value: number, operation: 'set' | 'add' = 'set') {
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
    public static updateY(value: number, operation: 'set' | 'add' = 'set') {
        if (operation === 'set') {
            this.cursor.y = value;
        } else if (operation === 'add') {
            this.cursor.y += value;
        }
    }

    // Convenience methods to get individual x and y values
    public static get X(): number {
        return this.cursor.x;
    }

    public static get Y(): number {
        return this.cursor.y;
    }
}
