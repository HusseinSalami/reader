import Anthropic from '@anthropic-ai/sdk';
import { ExtractedData, ProcessingResult, DocumentType } from '../types/index.js';

const anthropic = new Anthropic();

const EXTRACTION_PROMPT = `You are a document data extraction system for an ERP. Extract all structured data from this document image.

Return ONLY valid JSON with this structure (omit fields that aren't present):
{
  "document_type": "invoice|receipt|credit_note|purchase_order|delivery_note|bank_statement|expense_report|contract|other",
  "vendor": { "name": "", "address": "", "tax_id": "", "email": "", "phone": "" },
  "document_number": "",
  "date": "YYYY-MM-DD",
  "due_date": "YYYY-MM-DD",
  "currency": "USD|EUR|GBP|...",
  "subtotal": 0.00,
  "tax_amount": 0.00,
  "tax_rate": 0.00,
  "total": 0.00,
  "line_items": [
    { "description": "", "quantity": 1, "unit_price": 0.00, "amount": 0.00, "tax_rate": 0.00, "code": "" }
  ],
  "payment_terms": "",
  "notes": ""
}

Rules:
- All monetary values as numbers (not strings)
- Dates in ISO format (YYYY-MM-DD)
- If a value is unclear, include your best guess but note uncertainty
- Detect the document language and return numbers in standard format (no locale-specific thousands separators)
- For multi-page documents, consolidate all data into one response`;

const CONFIDENCE_PROMPT = `Rate your confidence in the extraction accuracy from 0 to 1. Consider:
- Image quality and readability
- How clearly fields were identified
- Whether any values required guessing
Return just a number between 0 and 1.`;

export async function extractDocument(
  imageBase64: string,
  mediaType: 'image/jpeg' | 'image/png' | 'image/webp' | 'image/gif',
  model: 'haiku' | 'sonnet' = 'haiku'
): Promise<ProcessingResult> {
  const startTime = Date.now();
  const modelId = model === 'haiku'
    ? 'claude-haiku-4-5-20251001'
    : 'claude-sonnet-5-20250514';

  try {
    const response = await anthropic.messages.create({
      model: modelId,
      max_tokens: 4096,
      messages: [{
        role: 'user',
        content: [
          { type: 'image', source: { type: 'base64', media_type: mediaType, data: imageBase64 } },
          { type: 'text', text: EXTRACTION_PROMPT }
        ]
      }]
    });

    const text = response.content[0].type === 'text' ? response.content[0].text : '';
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('No JSON found in response');
    }

    const extracted: ExtractedData & { document_type?: DocumentType } = JSON.parse(jsonMatch[0]);
    const detectedType = extracted.document_type;
    delete (extracted as any).document_type;

    const confidenceResponse = await anthropic.messages.create({
      model: modelId,
      max_tokens: 10,
      messages: [{
        role: 'user',
        content: [
          { type: 'image', source: { type: 'base64', media_type: mediaType, data: imageBase64 } },
          { type: 'text', text: `You previously extracted this data from the document:\n${JSON.stringify(extracted, null, 2)}\n\n${CONFIDENCE_PROMPT}` }
        ]
      }]
    });

    const confidenceText = confidenceResponse.content[0].type === 'text' ? confidenceResponse.content[0].text : '0.5';
    const confidence = Math.min(1, Math.max(0, parseFloat(confidenceText) || 0.5));

    const inputTokens = (response.usage?.input_tokens || 0) + (confidenceResponse.usage?.input_tokens || 0);
    const outputTokens = (response.usage?.output_tokens || 0) + (confidenceResponse.usage?.output_tokens || 0);

    const costPerInputToken = model === 'haiku' ? 0.80 / 1_000_000 : 3.0 / 1_000_000;
    const costPerOutputToken = model === 'haiku' ? 4.0 / 1_000_000 : 15.0 / 1_000_000;
    const cost = (inputTokens * costPerInputToken) + (outputTokens * costPerOutputToken);

    return {
      success: true,
      document_id: '',
      extracted_data: extracted,
      confidence,
      processing_time_ms: Date.now() - startTime,
      tokens_used: { input: inputTokens, output: outputTokens },
      cost,
      ...(detectedType && { detected_type: detectedType } as any),
    };
  } catch (error: any) {
    return {
      success: false,
      document_id: '',
      extracted_data: null,
      confidence: 0,
      processing_time_ms: Date.now() - startTime,
      tokens_used: { input: 0, output: 0 },
      cost: 0,
      error: error.message,
    };
  }
}
