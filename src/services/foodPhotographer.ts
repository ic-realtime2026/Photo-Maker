import { GoogleGenAI, GenerateContentResponse } from "@google/genai";

export interface Dish {
  id: string;
  name: string;
  description: string;
  suggestedTemplateId?: string;
}

export type BaseStyle = 'Rustic/Dark' | 'Bright/Modern' | 'Social Media' | 'Custom';
export type Lighting = 'Natural' | 'Studio' | 'Moody' | 'Soft' | 'Hard';
export type Composition = 'Close-up' | 'Top-down' | 'Angle' | 'Macro' | 'Wide';
export type ColorTemp = 'Warm' | 'Cool' | 'Neutral' | 'Vibrant';

export interface StyleSettings {
  id: string;
  name: string;
  baseStyle: BaseStyle;
  lighting: Lighting;
  composition: Composition;
  colorTemp: ColorTemp;
  isCustom?: boolean;
}

export interface PhotoTemplate extends StyleSettings {
  aspectRatio: ImageAspectRatio;
  size: ImageSize;
  layout?: string; // For future layout elements
}

export type ImageSize = '1K' | '2K' | '4K';
export type ImageAspectRatio = '1:1' | '4:3' | '3:4' | '16:9' | '9:16';

export const DEFAULT_TEMPLATES: PhotoTemplate[] = [
  {
    id: 'rustic-dark',
    name: 'Rustic/Dark',
    baseStyle: 'Rustic/Dark',
    lighting: 'Moody',
    composition: 'Angle',
    colorTemp: 'Warm',
    aspectRatio: '1:1',
    size: '1K'
  },
  {
    id: 'bright-modern',
    name: 'Bright/Modern',
    baseStyle: 'Bright/Modern',
    lighting: 'Natural',
    composition: 'Close-up',
    colorTemp: 'Neutral',
    aspectRatio: '4:3',
    size: '1K'
  },
  {
    id: 'social-media',
    name: 'Social Media',
    baseStyle: 'Social Media',
    lighting: 'Soft',
    composition: 'Top-down',
    colorTemp: 'Vibrant',
    aspectRatio: '9:16',
    size: '1K'
  },
  {
    id: 'tiktok-style',
    name: 'TikTok Style',
    baseStyle: 'Social Media',
    lighting: 'Hard',
    composition: 'Angle',
    colorTemp: 'Vibrant',
    aspectRatio: '9:16',
    size: '1K'
  },
  {
    id: 'editorial-magazine',
    name: 'Editorial/Magazine',
    baseStyle: 'Bright/Modern',
    lighting: 'Studio',
    composition: 'Wide',
    colorTemp: 'Neutral',
    aspectRatio: '3:4',
    size: '1K'
  },
];

export const DEFAULT_STYLES: StyleSettings[] = DEFAULT_TEMPLATES.map(({ aspectRatio, size, layout, ...style }) => style);

export class FoodPhotographerService {
  private ai: GoogleGenAI;

  constructor(apiKey: string) {
    this.ai = new GoogleGenAI({ apiKey });
  }

  async parseMenu(menuText: string): Promise<Dish[]> {
    const response = await this.ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `Extract a list of dishes and their descriptions from the following menu text. 
      For each dish, perform a deep analysis of the keywords, ingredients, and overall sentiment within the description to accurately suggest the most suitable photo template ID from the following list:

      - 'rustic-dark': Best for traditional, hearty, or slow-cooked dishes that evoke a sense of warmth and comfort.
        Keywords: 'hearty', 'slow-cooked', 'stew', 'roast', 'braised', 'artisanal', 'wood-fired', 'comfort food', 'earthy', 'rich', 'smoked', 'traditional', 'oven-baked', 'rustic', 'homestyle', 'slow-roasted', 'charred', 'caramelized', 'savory', 'bold', 'dark chocolate', 'red wine', 'stout'.
        Sentiment: Warm, comforting, traditional, grounded, rustic, cozy, rich, deep.

      - 'bright-modern': Best for health-focused, fresh, or minimalist dishes that feel light and airy.
        Keywords: 'fresh herbs', 'light vinaigrette', 'citrus', 'crisp', 'raw', 'steamed', 'organic', 'minimalist', 'clean', 'vibrant', 'zesty', 'healthy', 'spring', 'summer', 'garden', 'farm-to-table', 'organic greens', 'microgreens', 'edible flowers', 'poached', 'seared', 'minimal', 'puree', 'reduction'.
        Sentiment: Light, airy, clean, healthy, fresh, modern, sophisticated, crisp, bright.

      - 'social-media': Best for trendy, colorful, or "Instagrammable" dishes that are bold and visually striking.
        Keywords: 'loaded', 'dripping', 'vibrant colors', 'fusion', 'extravagant', 'tower', 'sparkling', 'neon', 'trendy', 'pop', 'decadent', 'colorful', 'Instagrammable', 'street food', 'over-the-top', 'viral', 'cheese pull', 'rainbow', 'glitter', 'gold leaf', 'extreme', 'monster', 'freakshake', 'colorful sprinkles'.
        Sentiment: Energetic, fun, bold, visually striking, trendy, playful, indulgent, exciting, loud.

      - 'tiktok-style': Best for high-energy, dynamic, or "viral" food trends.
        Keywords: 'cheesy', 'melting', 'dripping', 'extreme', 'fast food', 'snack', 'cheese pull', 'crispy', 'crunchy', 'ASMR', 'satisfying'.
        Sentiment: High-energy, satisfying, indulgent, fast-paced, viral.

      - 'editorial-magazine': Best for high-end, elegant, or sophisticated plated dishes.
        Keywords: 'gourmet', 'fine dining', 'elegant', 'minimalist plating', 'artistic', 'refined', 'delicate', 'premium', 'luxury', 'chef-curated'.
        Sentiment: Sophisticated, elegant, refined, artistic, premium, high-end.

      Return the result as a JSON array of objects with "name", "description", and "suggestedTemplateId" keys. Ensure the description is concise but preserves the key ingredients and style.
      
      Menu Text:
      ${menuText}`,
      config: {
        responseMimeType: "application/json",
      }
    });

    try {
      const dishes = JSON.parse(response.text || '[]');
      return (dishes as any[]).map((d, i) => ({
        ...d,
        id: d.id || `dish-${Date.now()}-${i}`
      }));
    } catch (e) {
      console.error("Failed to parse menu JSON", e);
      return [];
    }
  }

  async generateDishPhoto(dish: Dish, style: StyleSettings, size: ImageSize, aspectRatio: ImageAspectRatio = '1:1', referenceImage?: string): Promise<string | null> {
    const lightingPrompt = {
      Natural: 'soft natural daylight',
      Studio: 'professional studio lighting',
      Moody: 'dramatic moody lighting with deep shadows',
      Soft: 'soft diffused lighting',
      Hard: 'hard direct lighting with sharp shadows'
    }[style.lighting];

    const compositionPrompt = {
      'Close-up': 'close-up shot focusing on textures',
      'Top-down': 'top-down flat lay view',
      Angle: '45-degree professional angle shot',
      Macro: 'extreme macro photography of food details',
      Wide: 'wide shot showing the plate and table setting'
    }[style.composition];

    const colorTempPrompt = {
      Warm: 'warm golden tones',
      Cool: 'cool clean tones',
      Neutral: 'natural neutral color balance',
      Vibrant: 'highly vibrant and saturated colors'
    }[style.colorTemp];

    const basePrompt = {
      'Rustic/Dark': 'Rustic, artisanal feel with natural wood textures.',
      'Bright/Modern': 'Minimalist, clean, and modern aesthetic.',
      'Social Media': 'Trendy social media aesthetic, Instagram-ready.',
      'Custom': 'Custom professional food photography style.'
    }[style.baseStyle];

    const prompt = `Professional food photography of ${dish.name}. ${dish.description}. ${basePrompt} ${lightingPrompt}, ${compositionPrompt}, ${colorTempPrompt}. Extremely detailed, 8k resolution, appetizing, commercial quality.`;

    const parts: any[] = [{ text: prompt }];
    if (referenceImage) {
      const base64Data = referenceImage.split(',')[1];
      const mimeType = referenceImage.split(';')[0].split(':')[1];
      parts.unshift({
        inlineData: {
          data: base64Data,
          mimeType: mimeType
        }
      });
    }

    const response = await this.ai.models.generateContent({
      model: 'gemini-3-pro-image-preview',
      contents: {
        parts: parts,
      },
      config: {
        imageConfig: {
          aspectRatio: aspectRatio,
          imageSize: size
        }
      },
    });

    for (const part of response.candidates?.[0]?.content?.parts || []) {
      if (part.inlineData) {
        return `data:image/png;base64,${part.inlineData.data}`;
      }
    }

    return null;
  }

  async removeBackground(imageUrl: string): Promise<string | null> {
    const base64Data = imageUrl.split(',')[1];
    const mimeType = imageUrl.split(';')[0].split(':')[1];

    const response = await this.ai.models.generateContent({
      model: 'gemini-2.5-flash-image',
      contents: {
        parts: [
          {
            inlineData: {
              data: base64Data,
              mimeType: mimeType
            }
          },
          {
            text: 'Remove the background from this food image. Isolate the food item and return it on a pure transparent background. The result should be only the food item.'
          }
        ]
      }
    });

    for (const part of response.candidates?.[0]?.content?.parts || []) {
      if (part.inlineData) {
        return `data:image/png;base64,${part.inlineData.data}`;
      }
    }

    return null;
  }

  async generateIngredientCard(dish: Dish, size: ImageSize, aspectRatio: ImageAspectRatio = '1:1'): Promise<string | null> {
    const prompt = `Professional food photography of the raw ingredients for ${dish.name}. The ingredients are: ${dish.description}. Minimalist, clean, top-down flat lay on a neutral background. Artistic arrangement of fresh ingredients. Extremely detailed, 8k resolution, commercial quality.`;

    const response = await this.ai.models.generateContent({
      model: 'gemini-3-pro-image-preview',
      contents: {
        parts: [{ text: prompt }],
      },
      config: {
        imageConfig: {
          aspectRatio: aspectRatio,
          imageSize: size
        }
      },
    });

    for (const part of response.candidates?.[0]?.content?.parts || []) {
      if (part.inlineData) {
        return `data:image/png;base64,${part.inlineData.data}`;
      }
    }

    return null;
  }
}
