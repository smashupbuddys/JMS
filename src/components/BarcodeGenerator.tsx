import React, { useEffect, useRef } from 'react';

interface BarcodeGeneratorProps {
  data: string;
  width?: number;
  height?: number;
  showText?: boolean;
  fontSize?: number;
  textMargin?: number;
  margin?: number;
  background?: string;
  lineColor?: string;
  textColor?: string;
  boldPriceSegment?: boolean;
}

// Complete set of Code 128 patterns (for values 0-106)
const CODE128_PATTERNS = [
  '11011001100', '11001101100', '11001100110', '10010011000', // 0-3
  '10010001100', '10001001100', '10011001000', '10011000100', // 4-7
  '10001100100', '11001001000', '11001000100', '11000100100', // 8-11
  '10110011100', '10011011100', '10011001110', '10111001100', // 12-15
  '10011101100', '10011100110', '11001110010', '11001011100', // 16-19
  '11001001110', '11011100100', '11001110100', '11101101110', // 20-23
  '11101001100', '11100101100', '11100100110', '11101100100', // 24-27
  '11100110100', '11100110010', '11011011000', '11011000110', // 28-31
  '11000110110', '10100011000', '10001011000', '10001000110', // 32-35
  '10110001000', '10001101000', '10001100010', '11010001000', // 36-39
  '11000101000', '11000100010', '10110111000', '10110001110', // 40-43
  '10001101110', '10111011000', '10111000110', '10001110110', // 44-47
  '11101110110', '11010001110', '11000101110', '11011101000', // 48-51
  '11011100010', '11011101110', '11101011000', '11101000110', // 52-55
  '11100010110', '11101101000', '11101100010', '11100011010', // 56-59
  '11101111010', '11001000010', '11110001010', '10100110000', // 60-63
  '10100001100', '10010110000', '10010000110', '10000101100', // 64-67
  '10000100110', '10110010000', '10110000100', '10011010000', // 68-71
  '10011000010', '10000110100', '10000110010', '11000010010', // 72-75
  '11001010000', '11110111010', '11000010100', '10001111010', // 76-79
  '10100111100', '10010111100', '10010011110', '10111100100', // 80-83
  '10011110100', '10011110010', '11110100100', '11110010100', // 84-87
  '11110010010', '11011011110', '11011110110', '11110110110', // 88-91
  '10101111000', '10100011110', '10001011110', '10111101000', // 92-95
  '10111100010', '11110101000', '11110100010', '10111011110', // 96-99
  '10111101110', '11101011110', '11110101110', '11010000100', // 100-103
  '11010010000', '11010011100', '11000111010'               // 104-106 (Start A, Start B, Start C, Stop)
];

// Code 128B character set values and patterns
const CODE128B = {
  START: 104, // Start B
  STOP: 106,
  QUIET_ZONE: '0000000000', // 10 modules of quiet zone
  PATTERNS: {
    // Special patterns
    START_B: '11010010000', // Start B pattern (104)
    STOP: '1100011101011', // Stop pattern with termination bar (106)
  }
};

// Initialize CODE128B.PATTERNS with all patterns (0-106)
for (let i = 0; i <= 106; i++) {
  CODE128B.PATTERNS[i] = CODE128_PATTERNS[i];
}

// Now also map character codes to their patterns
for (let i = 0; i <= 94; i++) {
  const charCode = i + 32; // Adjust for Code 128B range (32-126)
  CODE128B.PATTERNS[charCode] = CODE128_PATTERNS[i];
}

const BarcodeGenerator: React.FC<BarcodeGeneratorProps> = ({
  data,
  width = 2,
  height = 100,
  showText = true,
  fontSize = 20,
  textMargin = 5,
  margin = 10,
  background = '#FFFFFF',
  lineColor = '#000000',
  textColor = '#000000',
  boldPriceSegment = true
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!canvasRef.current || !data) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    try {
      // Calculate checksum
      let checksum = CODE128B.START; // Start with value of Start B
      for (let i = 0; i < data.length; i++) {
        const charCode = data.charCodeAt(i) - 32; // Adjust for Code 128B
        if (charCode < 0 || charCode > 94) {
          throw new Error(`Invalid character '${data[i]}' at position ${i}. Only ASCII 32-126 are supported.`);
        }
        checksum += charCode * (i + 1); // Weight is position + 1
      }
      checksum = checksum % 103; // Modulo 103
      
      // Validate checksum has a pattern
      if (checksum < 0 || checksum > 102 || !CODE128B.PATTERNS[checksum]) {
        throw new Error(`Invalid checksum ${checksum} for Code 128B barcode`);
      }

      // Build complete barcode pattern
      let pattern = CODE128B.QUIET_ZONE; // Start with quiet zone
      pattern += CODE128B.PATTERNS.START_B; // Add start character

      // Add data
      for (let i = 0; i < data.length; i++) {
        const charCode = data.charCodeAt(i);
        pattern += CODE128B.PATTERNS[charCode];
      }

      // Add checksum
      pattern += CODE128B.PATTERNS[checksum];

      // Add stop character and termination bar
      pattern += CODE128B.PATTERNS.STOP;
      pattern += CODE128B.QUIET_ZONE; // End with quiet zone

      // Calculate dimensions
      const barcodeWidth = pattern.length * width;
      const totalWidth = barcodeWidth + (margin * 2);
      const totalHeight = height + (showText ? fontSize + textMargin : 0) + (margin * 2);

      // Set canvas size
      canvas.width = totalWidth;
      canvas.height = totalHeight;

      // Draw background
      ctx.fillStyle = background;
      ctx.fillRect(0, 0, totalWidth, totalHeight);

      // Draw barcode
      ctx.fillStyle = lineColor;
      for (let i = 0; i < pattern.length; i++) {
        if (pattern[i] === '1') {
          ctx.fillRect(
            margin + (i * width),
            margin,
            width,
            height
          );
        }
      }

      // Draw text
      if (showText) {
        ctx.fillStyle = textColor;
        ctx.font = `${fontSize}px 'Courier New', monospace`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';

        // Split SKU into parts for highlighting if it contains hyphens
        const parts = data.split('-');
        if (parts.length === 4) { // Expect exactly 4 parts for new format
          const textY = height + margin + textMargin;
          const textX = totalWidth / 2;
          
          // Calculate total width
          const fullText = data;
          const fullWidth = ctx.measureText(fullText).width;
          let currentX = textX - (fullWidth / 2);
          
          // Draw each part
          for (let i = 0; i < parts.length; i++) {
            if (i > 0) {
              ctx.fillText('-', currentX, textY);
              currentX += ctx.measureText('-').width;
            }
            
            // Set font weight and color based on segment
            switch(i) {
              case 0: // Category code
                ctx.font = `bold ${fontSize}px 'Courier New', monospace`;
                break;
              case 1: // Manufacturer code
                ctx.font = `${fontSize}px 'Courier New', monospace`;
                break;
              case 2: // Price code
                ctx.font = `bold ${fontSize}px 'Courier New', monospace`;
                break;
              case 3: // Random code
                ctx.font = `${fontSize}px 'Courier New', monospace`;
                break;
            }
            
            ctx.fillText(parts[i], currentX + (ctx.measureText(parts[i]).width / 2), textY);
            currentX += ctx.measureText(parts[i]).width;
          }
        } else {
          // No hyphens, draw as single text
          ctx.fillText(data, totalWidth / 2, height + margin + textMargin);
        }
      }
    } catch (error) {
      console.error('Error generating barcode:', error);
      
      // Draw error message on canvas
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = '#FFEEEE';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = '#FF0000';
      ctx.font = '14px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('Error generating barcode', canvas.width / 2, canvas.height / 2);
    }
  }, [data, width, height, showText, fontSize, textMargin, margin, background, lineColor, textColor, boldPriceSegment]);

  return <canvas ref={canvasRef} className="max-w-full h-auto" />;
};

export default BarcodeGenerator;
