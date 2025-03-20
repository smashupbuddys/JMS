// pdfService.ts
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';

export interface PDFOptions {
  title: string;
  filename: string;
  contentId: string;
}

export class PDFService {
  static async generatePDF(options: PDFOptions): Promise<Blob> {
    try {
      const content = document.getElementById(options.contentId);
      if (!content) {
        throw new Error('Content element not found');
      }

      const isThermal = content.classList.contains('thermal-receipt');
      
      // Create canvas with better quality
      const canvas = await html2canvas(content, {
        scale: 2,
        useCORS: true,
        logging: false,
        allowTaint: true,
        backgroundColor: '#ffffff',
        windowWidth: isThermal ? 302 : content.scrollWidth, // 302px = 80mm at 96dpi
        windowHeight: content.scrollHeight
      });

      // Create PDF with appropriate dimensions
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: isThermal ? [80, Math.min(content.scrollHeight * (80/302), 297)] : 'a4'
      });

      // Calculate dimensions
      const imgWidth = isThermal ? 80 : 210; // A4 width in mm
      const imgHeight = (canvas.height * imgWidth) / canvas.width;

      // Add metadata
      pdf.setProperties({
        title: options.title,
        subject: options.title,
        creator: 'Jewelry Management System',
        author: 'JMS'
      });

      // Add the image to PDF
      const imgData = canvas.toDataURL('image/jpeg', 1.0);
      pdf.addImage(imgData, 'JPEG', 0, 0, imgWidth, imgHeight);

      return pdf.output('blob');
    } catch (error) {
      console.error('Error generating PDF:', error);
      throw error;
    }
  }

  private static async prepareIframe(content: HTMLElement, options: PDFOptions): Promise<HTMLIFrameElement> {
    // Create a hidden iframe
    const iframe = document.createElement('iframe');
    iframe.style.display = 'none';
    document.body.appendChild(iframe);

    const isThermal = content.classList.contains('thermal-receipt');
    const doc = iframe.contentWindow?.document;
    
    if (!doc) {
      throw new Error('Could not access iframe document');
    }

    // Get computed styles for the content element
    const computedStyle = window.getComputedStyle(content);
    
    // Extract and process all stylesheets
    const processedStyles = await PDFService.extractStyles();

    // Write the document with enhanced styling
    doc.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>${options.title}</title>
          <style>
            ${processedStyles}
            @page {
              size: ${isThermal ? '80mm auto' : 'auto'};
              margin: ${isThermal ? '0mm' : '10mm'};
            }
            body {
              margin: 0;
              padding: ${isThermal ? '2mm' : '0'};
              width: ${isThermal ? '76mm' : 'auto'};
              background: white !important;
              color: black !important;
              font-family: ${isThermal ? '"Courier New", monospace' : computedStyle.fontFamily};
              -webkit-print-color-adjust: exact !important;
              print-color-adjust: exact !important;
              color-adjust: exact !important;
            }
            img {
              max-width: 100%;
              height: auto;
            }
            @media print {
              html, body {
                width: 100%;
                height: 100%;
                margin: 0;
                padding: 0;
              }
              .no-print, .no-print * {
                display: none !important;
              }
              * {
                -webkit-print-color-adjust: exact !important;
                print-color-adjust: exact !important;
                color-adjust: exact !important;
              }
            }
          </style>
          <script>
            function onIframeLoad() {
              const images = document.getElementsByTagName('img');
              let loadedImages = 0;
              const totalImages = images.length;
              
              function tryPrint() {
                if (loadedImages === totalImages) {
                  window.parent.postMessage('ready-to-print', '*');
                }
              }

              if (totalImages === 0) {
                tryPrint();
              } else {
                for (let img of images) {
                  if (img.complete) {
                    loadedImages++;
                  } else {
                    img.onload = () => {
                      loadedImages++;
                      tryPrint();
                    };
                    img.onerror = () => {
                      loadedImages++;
                      tryPrint();
                    };
                  }
                }
              }
              tryPrint();
            }
          </script>
        </head>
        <body onload="onIframeLoad()">${content.outerHTML}</body>
      </html>
    `);
    doc.close();

    return iframe;
  }

  private static async extractStyles(): Promise<string> {
    const stylePromises = Array.from(document.styleSheets).map(async (sheet) => {
      try {
        // Handle both same-origin and cross-origin stylesheets
        if (sheet.href) {
          try {
            const response = await fetch(sheet.href);
            return await response.text();
          } catch (e) {
            console.warn('Could not fetch external stylesheet:', e);
            return '';
          }
        }
        return Array.from(sheet.cssRules)
          .map(rule => rule.cssText)
          .join('\n');
      } catch (e) {
        console.warn('Could not process stylesheet:', e);
        return '';
      }
    });

    const styles = await Promise.all(stylePromises);
    return styles.join('\n');
  }

  static async printContent(options: PDFOptions): Promise<void> {
    let iframe: HTMLIFrameElement | null = null;
    
    try {
      const content = document.getElementById(options.contentId);
      if (!content) {
        throw new Error('Content element not found');
      }

      iframe = await PDFService.prepareIframe(content, options);

      return new Promise((resolve, reject) => {
        // Listen for the ready-to-print message
        const messageHandler = (event: MessageEvent) => {
          if (event.data === 'ready-to-print') {
            window.removeEventListener('message', messageHandler);
            
            try {
              iframe?.contentWindow?.print();
              // Remove iframe after printing
              setTimeout(() => {
                if (iframe && document.body.contains(iframe)) {
                  document.body.removeChild(iframe);
                }
                resolve();
              }, 1000);
            } catch (error) {
              reject(error);
            }
          }
        };

        window.addEventListener('message', messageHandler);

        // Timeout safety
        setTimeout(() => {
          window.removeEventListener('message', messageHandler);
          reject(new Error('Print preparation timed out'));
        }, 5000);
      });

    } catch (error) {
      // Cleanup iframe in case of error
      if (iframe && document.body.contains(iframe)) {
        document.body.removeChild(iframe);
      }
      console.error('Error printing:', error);
      throw error;
    }
  }

  static async sharePDF(options: PDFOptions): Promise<void> {
    try {
      const pdfBlob = await this.generatePDF(options);
      const file = new File([pdfBlob], options.filename, { type: 'application/pdf' });

      // Try Web Share API first
      if (navigator.share && navigator.canShare({ files: [file] })) {
        try {
          await navigator.share({
            files: [file],
            title: options.title
          });
          return;
        } catch (error) {
          if (error instanceof Error && error.name === 'AbortError') {
            return; // User cancelled sharing
          }
          // Fall back to download
          console.warn('Share failed, falling back to download:', error);
        }
      }

      // Download fallback
      const url = URL.createObjectURL(pdfBlob);
      const link = document.createElement('a');
      link.href = url;
      link.download = options.filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error sharing PDF:', error);
      throw error;
    }
  }
}
