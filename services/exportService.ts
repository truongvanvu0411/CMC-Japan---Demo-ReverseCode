import { AnalysisResult, ArchitectureSuggestion, ComponentInfo, ScreenDescription, TechnologyInfo } from '../types';

const ExcelJS = (window as any).ExcelJS;
const saveAs = (window as any).saveAs;

// --- STYLES ---
const titleStyle = {
    font: { name: 'Calibri', size: 18, bold: true, color: { argb: 'FF0891B2' } },
    alignment: { vertical: 'middle', horizontal: 'left' }
};
const headerStyle = {
    font: { name: 'Calibri', size: 11, bold: true, color: { argb: 'FFFFFFFF' } },
    fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0E7490' } },
    border: {
        top: { style: 'thin', color: { argb: 'FF064E63' } },
        left: { style: 'thin', color: { argb: 'FF064E63' } },
        bottom: { style: 'thin', color: { argb: 'FF064E63' } },
        right: { style: 'thin', color: { argb: 'FF064E63' } }
    }
};
const subHeaderStyle = {
    font: { name: 'Calibri', size: 14, bold: true, color: { argb: 'FF67E8F9' } },
};
const bodyStyle = {
    font: { name: 'Calibri', size: 11 },
    alignment: { wrapText: true, vertical: 'top' }
};

/**
 * Gets the dimensions of a base64 encoded image.
 * @param base64Image The base64 data URL.
 * @returns A promise that resolves to the image's width and height.
 */
async function getImageDimensions(base64Image: string): Promise<{ width: number, height: number }> {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => {
            resolve({ width: img.naturalWidth, height: img.naturalHeight });
        };
        img.onerror = (e) => {
            reject(new Error("Could not load image to get dimensions."));
        };
        img.src = base64Image;
    });
}

/**
 * Converts an SVG string to a high-resolution, high-contrast PNG data URL.
 * This function intelligently parses the SVG's viewBox to ensure the entire diagram is captured, preventing cropping.
 * @param svgText The raw SVG string.
 * @returns A promise that resolves to a base64 encoded PNG data URL.
 */
async function svgToPng(svgText: string): Promise<string> {
    return new Promise((resolve, reject) => {
        const img = new Image();
        const svgDataUrl = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svgText)));

        img.onload = () => {
            const canvas = document.createElement('canvas');
            const padding = 20; // Add some padding around the diagram
            const scale = 2;    // Render at 2x resolution for sharpness

            let diagramWidth = img.width;
            let diagramHeight = img.height;

            // MermaidJS SVGs use a viewBox. This is the most reliable source for the actual diagram dimensions,
            // as the width/height attributes on the <svg> tag can sometimes be misleading (e.g., set to 100%).
            // We parse the SVG text to find the viewBox and use its dimensions to correctly size the canvas.
            try {
                const parser = new DOMParser();
                const svgDoc = parser.parseFromString(svgText, "image/svg+xml");
                const svgElement = svgDoc.querySelector('svg');
                const viewBox = svgElement?.getAttribute('viewBox');
                if (viewBox) {
                    const parts = viewBox.split(' ').map(parseFloat);
                    if (parts.length === 4) {
                        // viewBox is "min-x min-y width height"
                        diagramWidth = parts[2];
                        diagramHeight = parts[3];
                    }
                }
            } catch (e) {
                console.warn("Could not parse SVG viewBox, falling back to image dimensions.", e);
            }
            
            if (diagramWidth === 0 || diagramHeight === 0) {
              return reject(new Error("Could not determine valid diagram dimensions."));
            }

            canvas.width = (diagramWidth + padding * 2) * scale;
            canvas.height = (diagramHeight + padding * 2) * scale;
            
            const ctx = canvas.getContext('2d');
            if (!ctx) {
                reject(new Error("Could not get canvas context"));
                return;
            }
            
            ctx.scale(scale, scale);

            // Set a white background to ensure diagrams with dark themes are visible and have contrast.
            ctx.fillStyle = '#FFFFFF';
            ctx.fillRect(0, 0, canvas.width / scale, canvas.height / scale);
            
            // Draw the SVG image onto the canvas, centered with padding, and scaled to the correct dimensions.
            ctx.drawImage(img, padding, padding, diagramWidth, diagramHeight);

            const pngDataUrl = canvas.toDataURL('image/png');
            resolve(pngDataUrl);
        };
        img.onerror = (e) => {
            reject(new Error("Failed to load SVG image for conversion."));
        };
        img.src = svgDataUrl;
    });
}


/**
 * Adds an image from the DOM to the worksheet, preserving aspect ratio.
 * @param workbook The ExcelJS workbook instance.
 * @param worksheet The worksheet to add the image to.
 * @param elementId The ID of the DOM element containing the image or SVG.
 * @param tlCell The top-left cell for the image (e.g., 'A5').
 * @param desiredWidth The desired width of the image in pixels.
 */
async function addImageToSheet(workbook: any, worksheet: any, elementId: string, tlCell: string, desiredWidth: number) {
    const element = document.getElementById(elementId);
    if (!element) return;

    let base64Image: string | null = null;

    if (element.tagName.toLowerCase() === 'img') {
        const imgElement = element as HTMLImageElement;
        base64Image = imgElement.src;
    } else {
        const svgElement = element.querySelector('svg');
        if (svgElement) {
            try {
                const svgText = svgElement.outerHTML;
                base64Image = await svgToPng(svgText);
            } catch (e) {
                console.error(`Failed to convert SVG to PNG for element ${elementId}`, e);
                return;
            }
        }
    }

    if (base64Image) {
        try {
            const dimensions = await getImageDimensions(base64Image);
            if (dimensions.width === 0 || dimensions.height === 0) return; // Avoid division by zero
            
            const aspectRatio = dimensions.width / dimensions.height;
            const desiredHeight = desiredWidth / aspectRatio;

            const imageId = workbook.addImage({
                base64: base64Image,
                extension: 'png',
            });
            
            worksheet.addImage(imageId, {
                tl: { col: worksheet.getCell(tlCell).col - 1, row: worksheet.getCell(tlCell).row - 1 },
                ext: { width: desiredWidth, height: desiredHeight }
            });

        } catch (e) {
            console.error(`Failed to add image for element ${elementId} to sheet`, e);
        }
    }
}


// --- SHEET CREATION FUNCTIONS ---

function createSheet(workbook: any, name: string, language: string) {
    const sheet = workbook.addWorksheet(name);
    sheet.views = [{ state: 'normal', rightToLeft: false }];
    return sheet;
}

function createOverviewSheet(workbook: any, result: AnalysisResult, language: string) {
    const sheet = createSheet(workbook, '1. Overview', language);
    sheet.getCell('A1').value = 'Project Overview';
    sheet.getCell('A1').style = titleStyle;
    sheet.mergeCells('A1:E1');
    sheet.getCell('A3').value = result.overview;
    sheet.getCell('A3').style = bodyStyle;
    sheet.mergeCells('A3:J20');
    sheet.columns = [{ width: 15 }, { width: 15 }, { width: 15 }, { width: 15 }, { width: 15 }, { width: 15 }, { width: 15 }, { width: 15 }, { width: 15 }, { width: 15 }];
}

function createCodeQualitySheet(workbook: any, result: AnalysisResult, language: string) {
    const sheet = createSheet(workbook, '2. Code Quality', language);
    sheet.getCell('A1').value = 'Code Quality Analysis';
    sheet.getCell('A1').style = titleStyle;
    sheet.mergeCells('A1:E1');
    
    sheet.getCell('A3').value = 'Readability';
    sheet.getCell('A3').style = subHeaderStyle;
    sheet.getCell('A4').value = result.codeQualityAnalysis.readability;
    sheet.getCell('A4').style = bodyStyle;
    sheet.mergeCells('A4:J10');

    sheet.getCell('A12').value = 'Extensibility';
    sheet.getCell('A12').style = subHeaderStyle;
    sheet.getCell('A13').value = result.codeQualityAnalysis.extensibility;
    sheet.getCell('A13').style = bodyStyle;
    sheet.mergeCells('A13:J19');

    sheet.getCell('A21').value = 'Security';
    sheet.getCell('A21').style = subHeaderStyle;
    sheet.getCell('A22').value = result.codeQualityAnalysis.security;
    sheet.getCell('A22').style = bodyStyle;
    sheet.mergeCells('A22:J28');
    
    sheet.columns = [{ width: 20 }, { width: 20 }, { width: 20 }, { width: 20 }, { width: 20 }, { width: 20 }];
}

function createComponentsSheet(workbook: any, result: AnalysisResult, language: string) {
    const sheet = createSheet(workbook, '3. Components', language);
    sheet.getCell('A1').value = 'Identified Components';
    sheet.getCell('A1').style = titleStyle;
    sheet.mergeCells('A1:C1');

    sheet.getRow(3).values = ['Name', 'Path', 'Description'];
    sheet.getRow(3).style = headerStyle;

    result.components.forEach((comp, index) => {
        const row = sheet.addRow([comp.name, comp.path, comp.description]);
        row.getCell(3).alignment = { wrapText: true, vertical: 'top' };
    });
    sheet.columns = [{ width: 30 }, { width: 50 }, { width: 70 }];
}

function createTechnologiesSheet(workbook: any, result: AnalysisResult, language: string) {
    const sheet = createSheet(workbook, '4. Technologies', language);
    sheet.getCell('A1').value = 'Technologies & Libraries';
    sheet.getCell('A1').style = titleStyle;
    sheet.mergeCells('A1:C1');
    
    sheet.getRow(3).values = ['Name', 'Category', 'Description'];
    sheet.getRow(3).style = headerStyle;

    result.technologies.forEach((tech, index) => {
        sheet.addRow([tech.name, tech.category, tech.description]);
    });
    sheet.columns = [{ width: 30 }, { width: 30 }, { width: 70 }];
}

async function createDiagramSheet(workbook: any, title: string, elementId: string, sheetName: string, language: string) {
    const sheet = createSheet(workbook, sheetName, language);
    sheet.getCell('A1').value = title;
    sheet.getCell('A1').style = titleStyle;
    sheet.mergeCells('A1:E1');
    await addImageToSheet(workbook, sheet, elementId, 'A3', 700);
}

async function createScreensSheet(workbook: any, screens: ScreenDescription[], language: string) {
    const sheet = createSheet(workbook, '9. Screens', language);
    sheet.getCell('A1').value = 'Screen Descriptions & Mockups';
    sheet.getCell('A1').style = titleStyle;
    sheet.mergeCells('A1:E1');
    
    let currentRow = 3;
    for (const screen of screens) {
        sheet.getCell(`A${currentRow}`).value = screen.screenName;
        sheet.getCell(`A${currentRow}`).style = subHeaderStyle;
        sheet.mergeCells(`A${currentRow}:J${currentRow}`);
        currentRow++;
        
        sheet.getCell(`A${currentRow}`).value = screen.description;
        sheet.getCell(`A${currentRow}`).style = bodyStyle;
        sheet.mergeCells(`A${currentRow}:J${currentRow + 2}`);
        currentRow += 3;

        const imageId = `mockup-image-${screen.screenName.replace(/[^a-zA-Z0-9]/g, '-')}`;
        const imageStartRow = currentRow;
        await addImageToSheet(workbook, sheet, imageId, `A${imageStartRow}`, 450);
        
        sheet.getCell(`H${imageStartRow}`).value = "UI Elements";
        sheet.getCell(`H${imageStartRow}`).font = { bold: true };
        let uiRow = imageStartRow;
        screen.uiElements.forEach(item => { uiRow++; sheet.getCell(`H${uiRow}`).value = item; });

        let eventRow = imageStartRow;
        sheet.getCell(`I${eventRow}`).value = "Events";
        sheet.getCell(`I${eventRow}`).font = { bold: true };
        screen.events.forEach(item => { eventRow++; sheet.getCell(`I${eventRow}`).value = item; });
        
        let valRow = imageStartRow;
        sheet.getCell(`J${valRow}`).value = "Validations";
        sheet.getCell(`J${valRow}`).font = { bold: true };
        screen.validations.forEach(item => { valRow++; sheet.getCell(`J${valRow}`).value = item; });

        currentRow += 30; // Spacing for next screen
    }
    sheet.columns = [{ width: 20 }, { width: 20 }, { width: 20 }, { width: 20 }, { width: 20 }, { width: 20 }, { width: 20 }, { width: 20 }, { width: 20 }, { width: 20 }];
}

async function createArchitectureSuggestionSheet(workbook: any, suggestion: ArchitectureSuggestion, language: string) {
    const sheet = createSheet(workbook, '10. Architecture Suggestion', language);
    sheet.getCell('A1').value = 'Architecture Improvement Suggestion';
    sheet.getCell('A1').style = titleStyle;
    sheet.mergeCells('A1:J1');

    // Business Process
    sheet.getCell('A3').value = '1. Business Process Improvement';
    sheet.getCell('A3').style = subHeaderStyle;
    sheet.mergeCells('A3:J3');
    await addImageToSheet(workbook, sheet, 'business-improve-diagram', 'A4', 800);
    sheet.getCell('A32').value = suggestion.businessProcess.explanation;
    sheet.getCell('A32').style = bodyStyle;
    sheet.mergeCells('A32:L36');

    // Overall Architecture
    sheet.getCell('A38').value = '2. Overall Architecture Improvement';
    sheet.getCell('A38').style = subHeaderStyle;
    sheet.mergeCells('A38:L38');
    await addImageToSheet(workbook, sheet, 'arch-asis-diagram', 'A39', 500);
    await addImageToSheet(workbook, sheet, 'arch-tobe-diagram', 'G39', 500);
    sheet.getCell('A62').value = suggestion.overallArchitecture.explanation;
    sheet.getCell('A62').style = bodyStyle;
    sheet.mergeCells('A62:L66');

    // Specific Points
    sheet.getCell('A68').value = '3. Specific Improvement Points';
    sheet.getCell('A68').style = subHeaderStyle;
    sheet.mergeCells('A68:L68');
    sheet.getCell('A69').value = 'As-Is (Problem)';
    sheet.getCell('A69').font = { bold: true };
    sheet.getCell('A70').value = suggestion.specificPoints.asIs;
    sheet.getCell('A70').style = bodyStyle;
    sheet.mergeCells('A70:F74');
    
    sheet.getCell('G69').value = 'To-Be (Solution)';
    sheet.getCell('G69').font = { bold: true };
    sheet.getCell('G70').value = suggestion.specificPoints.toBe;
    sheet.getCell('G70').style = bodyStyle;
    sheet.mergeCells('G70:L74');
    
    sheet.getCell('A76').value = 'Explanation & Benefits';
    sheet.getCell('A76').font = { bold: true };
    sheet.getCell('A77').value = suggestion.specificPoints.explanation;
    sheet.getCell('A77').style = bodyStyle;
    sheet.mergeCells('A77:L81');

    sheet.columns = [{ width: 15 }, { width: 15 }, { width: 15 }, { width: 15 }, { width: 15 }, { width: 15 }, { width: 15 }, { width: 15 }, { width: 15 }, { width: 15 }, { width: 15 }, { width: 15 }];
}

// --- MAIN EXPORT FUNCTION ---

export const exportToExcel = async (
    result: AnalysisResult,
    architectureSuggestion: ArchitectureSuggestion | null,
    language: string
) => {
    if (!ExcelJS || !saveAs) {
        throw new Error('Excel export libraries not loaded. Please refresh the page.');
    }
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'CMC-Japan AI';
    workbook.created = new Date();

    // Create sheets
    createOverviewSheet(workbook, result, language);
    createCodeQualitySheet(workbook, result, language);
    createComponentsSheet(workbook, result, language);
    createTechnologiesSheet(workbook, result, language);
    await createDiagramSheet(workbook, 'Business Flow Diagram', 'business-flow-diagram', '5. Business Flow', language);
    await createDiagramSheet(workbook, 'Sequence Diagram', 'sequence-diagram', '6. Sequence Diagram', language);
    await createDiagramSheet(workbook, 'Screen Transition Diagram', 'screen-transition-diagram', '7. Screen Transition', language);
    await createDiagramSheet(workbook, 'Database ERD', 'database-erd-diagram', '8. Database ERD', language);
    await createScreensSheet(workbook, result.screenDescriptions, language);

    if (architectureSuggestion) {
        await createArchitectureSuggestionSheet(workbook, architectureSuggestion, language);
    }

    // Write buffer and save
    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    saveAs(blob, `Project_Deconstruction_Analysis_${new Date().toISOString().split('T')[0]}.xlsx`);
};
