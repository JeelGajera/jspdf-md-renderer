import { MdTokenType } from '../enums/mdTokenType';
import { ParsedElement } from '../types';

/**
 * Recursively traverses parsed elements and loads image data for Image tokens.
 * @param elements - The parsed elements to process.
 */
export const prefetchImages = async (
    elements: ParsedElement[],
): Promise<void> => {
    for (const element of elements) {
        if (element.type === MdTokenType.Image && element.src) {
            try {
                // If the src is already a data URI, we treat it as loaded (or just store it as data)
                if (element.src.startsWith('data:')) {
                    element.data = element.src;
                } else {
                    // Try to fetch the image
                    const response = await fetch(element.src);
                    if (!response.ok) {
                        throw new Error(
                            `Failed to fetch image: ${response.statusText}`,
                        );
                    }
                    const blob = await response.blob();

                    // Convert blob to base64
                    const base64 = await new Promise<string>(
                        (resolve, reject) => {
                            const reader = new FileReader();
                            reader.onloadend = () => {
                                if (typeof reader.result === 'string') {
                                    resolve(reader.result);
                                } else {
                                    reject(
                                        new Error(
                                            'Failed to convert image to base64 string',
                                        ),
                                    );
                                }
                            };
                            reader.onerror = reject;
                            reader.readAsDataURL(blob);
                        },
                    );

                    element.data = base64;
                }
            } catch (error) {
                console.warn(
                    `[jspdf-md-renderer] Warning: Failed to load image at ${element.src}. It will be skipped.`,
                    error,
                );
            }
        }

        if (element.items && element.items.length > 0) {
            await prefetchImages(element.items);
        }
    }
};
