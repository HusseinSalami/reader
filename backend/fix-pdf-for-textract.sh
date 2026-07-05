#!/bin/bash

# Fix PDF for Textract compatibility
# This script uses Ghostscript to re-process PDFs to make them Textract-compatible

echo "🔧 Fixing PDF for Textract Compatibility"
echo "========================================"

INPUT_PDF="$1"

if [ -z "$INPUT_PDF" ]; then
  echo "Usage: ./fix-pdf-for-textract.sh <input-pdf>"
  echo ""
  echo "Example:"
  echo "  ./fix-pdf-for-textract.sh 'examples/Grade 11 -Mid year exam Jan.2026-questions.pdf'"
  exit 1
fi

if [ ! -f "$INPUT_PDF" ]; then
  echo "❌ File not found: $INPUT_PDF"
  exit 1
fi

# Create output filename
OUTPUT_PDF="${INPUT_PDF%.pdf}-fixed.pdf"

echo "Input:  $INPUT_PDF"
echo "Output: $OUTPUT_PDF"
echo ""

# Check if Ghostscript is installed
if ! command -v gs &> /dev/null; then
  echo "❌ Ghostscript (gs) is not installed"
  echo ""
  echo "Install with:"
  echo "  brew install ghostscript"
  exit 1
fi

echo "📄 Re-processing PDF with Ghostscript..."

# Re-process PDF to make it compatible with Textract
# This removes encryption, flattens layers, and ensures compatibility
gs -sDEVICE=pdfwrite \
   -dCompatibilityLevel=1.4 \
   -dPDFSETTINGS=/prepress \
   -dNOPAUSE \
   -dQUIET \
   -dBATCH \
   -sOutputFile="$OUTPUT_PDF" \
   "$INPUT_PDF"

if [ $? -eq 0 ]; then
  echo "✓ PDF fixed successfully!"
  echo ""
  echo "Original size: $(du -h "$INPUT_PDF" | cut -f1)"
  echo "Fixed size:    $(du -h "$OUTPUT_PDF" | cut -f1)"
  echo ""
  echo "You can now use: $OUTPUT_PDF"
else
  echo "❌ Failed to fix PDF"
  exit 1
fi
