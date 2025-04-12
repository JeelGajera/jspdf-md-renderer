import jsPDF from 'jspdf';
import { WordInfo } from '../types/wordInfo';
import { Cursor } from '../types';

// -------- Handle Justify Content for Custome Fonts
export const writeLineJustify = (
    pdfGen: jsPDF,
    wordsInfo: WordInfo[],
    lineLength: number,
    lineNumber: number,
    xStart: number,
    yStart: number,
    lineHeight: number,
    textWidth: number,
    defaultLineHeightFactor: number,
) => {
    const wordSpacing = (textWidth - lineLength) / (wordsInfo.length - 1);
    let x = xStart;
    const y = yStart + lineNumber * lineHeight;
    for (const wordInfo of wordsInfo) {
        pdfGen.text(wordInfo.text, x, y, {
            align: 'justify',
            lineHeightFactor: defaultLineHeightFactor,
            maxWidth: textWidth,
        });
        x += wordInfo.wordLength + wordSpacing;
    }
};

export const writeLastLineJustify = (
    wordsInfo: WordInfo[],
    pdfGen: jsPDF,
    xStart: number,
    yStart: number,
    lineNumber: number,
    lineHeight: number,
    textWidth: number,
    defaultLineHeightFactor: number,
) => {
    const line = wordsInfo.map((x) => x.text).join(' ');
    pdfGen.text(line, xStart, yStart + lineNumber * lineHeight, {
        align: 'justify',
        lineHeightFactor: defaultLineHeightFactor,
        maxWidth: textWidth,
    });
};
/**
 *
 * @param pdfGen jsPDF default Object reference
 * @param text string text data
 * @param xStart x point where to render
 * @param yStart y point where to render
 * @param textWidth text render area width
 * @param defaultLineHeightFactor line height factor
 * @returns end of y cursor point of justified render text data
 */
export const justifyText = (
    pdfGen: jsPDF,
    text: string,
    xStart: number,
    yStart: number,
    textWidth: number,
    defaultLineHeightFactor: number,
): Cursor => {
    const cursor: Cursor = {
        x: xStart,
        y: yStart,
    };
    const lineHeight =
        pdfGen.getTextDimensions('A').h * defaultLineHeightFactor;
    const words = text.split(' ');
    let lineNumber = 0;
    let wordsInfo: WordInfo[] = [];
    let lineLength = 0;
    for (const word of words) {
        const wordLength = pdfGen.getTextWidth(word + 'a');
        if (wordLength + lineLength >= textWidth) {
            writeLineJustify(
                pdfGen,
                wordsInfo,
                lineLength,
                lineNumber++,
                xStart,
                yStart,
                lineHeight,
                textWidth,
                defaultLineHeightFactor,
            );
            wordsInfo = [];
            lineLength = 0;
        }
        wordsInfo.push({ text: word, wordLength });
        lineLength += wordLength;
    }
    if (wordsInfo.length > 0) {
        writeLastLineJustify(
            wordsInfo,
            pdfGen,
            xStart,
            yStart,
            lineNumber,
            lineHeight,
            textWidth,
            defaultLineHeightFactor,
        );
    }
    cursor.y = yStart + lineNumber * lineHeight;
    cursor.x = pdfGen.getTextWidth(text) + xStart;
    return cursor;
};
