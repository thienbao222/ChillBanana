import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

export async function POST(req: Request) {
  try {
    const { imageData, sessionId } = await req.json();

    if (!imageData) {
      return NextResponse.json({ success: false, error: 'imageData is required' }, { status: 400 });
    }

    const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ success: false, error: 'API key is missing' }, { status: 500 });
    }

    // Parse imageData
    // Format: data:image/jpeg;base64,....
    const matches = imageData.match(/^data:([a-zA-Z0-9]+\/[a-zA-Z0-9-.+]+);base64,(.+)$/);
    if (!matches || matches.length !== 3) {
      return NextResponse.json({ success: false, error: 'Invalid imageData format' }, { status: 400 });
    }

    const mimeType = matches[1];
    const base64Data = matches[2];

    const prompt = `Analyze this product image and provide the following information in JSON format:
1. Product name in Japanese (Kanji/Katakana) if visible (key: nameJp)
2. Product name in Vietnamese translation (key: nameVi)
3. Estimated price range in JPY if price tag visible (key: estimatedPriceJpy, number or null)
4. Category: 'cosmetics' | 'health' | 'gadgets' | 'anime' | 'other' (key: category)
5. Voltage warning: true if product shows 100V or AC100V, false otherwise (key: voltageWarning)
6. Risk notes: string noting if the image shows signs of counterfeit (blurry labels, no barcode), or empty string if none (key: riskNotes)
7. Search keywords for Amazon JP / Mercari (key: searchKeywords, array of strings)
8. Description of the product (key: description)

Return ONLY a valid JSON object matching this structure. Do not wrap in markdown or include any other text.`;

    const requestBody = {
      contents: [{
        parts: [
          {
            inlineData: {
              mimeType,
              data: base64Data
            }
          },
          {
            text: prompt
          }
        ]
      }],
      generationConfig: {
        temperature: 0.3,
        maxOutputTokens: 2048
      }
    };

    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error('Gemini API error:', errText);
      return NextResponse.json({ success: false, error: 'Failed to analyze image' }, { status: response.status });
    }

    const data = await response.json();
    const textOutput = data.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!textOutput) {
      return NextResponse.json({ success: false, error: 'No output from Gemini' }, { status: 500 });
    }

    let parsedResult;
    try {
      // Remove markdown wrapping if present
      const cleanedText = textOutput.replace(/```(?:json)?\n?|\n?```/g, '').trim();
      parsedResult = JSON.parse(cleanedText);
    } catch (parseError) {
      console.error('Failed to parse Gemini output as JSON:', textOutput);
      return NextResponse.json({ success: false, error: 'Invalid output format from AI' }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      analysis: parsedResult
    });

  } catch (error) {
    console.error('Image analysis error:', error);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
