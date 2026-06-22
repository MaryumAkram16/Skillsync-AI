import * as pdfjsLib from 'pdfjs-dist';
import mammoth from 'mammoth';
import Tesseract from 'tesseract.js';

// Initialize PDF.js worker using a more reliable CDN path for version 5.x
// and ensuring it's loaded as an ESM worker if needed.
pdfjsLib.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`;

console.log(`[FileExtractor] Initialized PDF.js with version ${pdfjsLib.version}`);

const cleanExtractedText = (text: string): string => {
  return text
    .replace(/\r\n/g, '\n') // Normalize Windows newlines
    .replace(/\n{3,}/g, '\n\n') // Replace 3 or more newlines with 2
    .replace(/[^\x20-\x7E\n]/g, '') // Remove non-printable ASCII characters EXCEPT newline
    .trim();
};

export const extractTextFromFile = async (file: File, onProgress?: (percent: number) => void): Promise<string> => {
  const fileType = file.type;
  const fileName = file.name.toLowerCase();
  const startTime = performance.now();

  console.log(`[FileExtractor] Starting extraction for ${fileName} (${fileType})`);
  if (onProgress) onProgress(5);

  try {
    let extractedText = '';
    if (fileType === 'application/pdf' || fileName.endsWith('.pdf')) {
      console.log("[FileExtractor] Using PDF.js for extraction");
      extractedText = await extractTextFromPDF(file, (p) => onProgress?.(5 + p * 0.9));
    } else if (
      fileType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
      fileName.endsWith('.docx')
    ) {
      console.log("[FileExtractor] Using Mammoth for DOCX extraction");
      extractedText = await extractTextFromDOCX(file);
      if (onProgress) onProgress(95);
    } else if (fileType === 'text/plain' || fileName.endsWith('.txt')) {
      console.log("[FileExtractor] Reading as plain text");
      extractedText = await extractTextFromTXT(file);
      if (onProgress) onProgress(95);
    } else if (fileType.startsWith('image/') || fileName.match(/\.(jpg|jpeg|png)$/)) {
      console.log("[FileExtractor] Using Tesseract for OCR (this may take a while)");
      extractedText = await extractTextFromImage(file);
      if (onProgress) onProgress(95);
    } else {
      throw new Error('Unsupported file format. Please upload PDF, DOCX, TXT, or an Image.');
    }
    
    const endTime = performance.now();
    console.log(`[FileExtractor] Extraction complete in ${((endTime - startTime) / 1000).toFixed(2)}s`);
    
    return cleanExtractedText(extractedText);
  } catch (error) {
    console.error('Error extracting text:', error);
    throw new Error(`Failed to extract text from ${file.name}: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
};

const extractTextFromPDF = async (file: File, onProgress?: (p: number) => void): Promise<string> => {
  const arrayBuffer = await file.arrayBuffer();
  const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
  
  const pdf = await loadingTask.promise;
  let fullText = '';
  const numPages = pdf.numPages;
  
  console.log(`[FileExtractor] PDF has ${numPages} pages`);

  for (let i = 1; i <= numPages; i++) {
    const page = await pdf.getPage(i);
    const textContent = await page.getTextContent();
    const pageText = textContent.items.map((item: any) => item.str).join(' ');
    fullText += pageText + '\n';
    
    if (onProgress) onProgress((i / numPages) * 100);
  }
  
  if (fullText.trim().length < 50 && numPages > 0) {
    console.warn(`[FileExtractor] Warning: Only ${fullText.trim().length} characters extracted from ${numPages} pages. This PDF might be scanned or image-based.`);
  }
  
  return fullText;
};

const extractTextFromDOCX = async (file: File): Promise<string> => {
  const arrayBuffer = await file.arrayBuffer();
  const result = await mammoth.extractRawText({ arrayBuffer });
  return result.value;
};

const extractTextFromTXT = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => resolve(e.target?.result as string);
    reader.onerror = (e) => reject(e);
    reader.readAsText(file);
  });
};

const extractTextFromImage = async (file: File): Promise<string> => {
  const result = await Tesseract.recognize(file, 'eng');
  return result.data.text;
};
