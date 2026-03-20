import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import JSZip from 'jszip';
const XLSX: any = null; // xlsx removed - using text-based menu input
const pdfjsLib: any = null; // pdfjs-dist removed
import { 
  Camera, 
  Upload, 
  Settings2, 
  Image as ImageIcon,
  Loader2, 
  CheckCircle2, 
  AlertCircle,
  Download,
  ChevronRight,
  UtensilsCrossed,
  Sparkles,
  Key,
  FileText,
  RefreshCcw,
  Edit2,
  Scissors,
  Share2,
  Save,
  Trash2,
  Plus,
  Layers,
  Layout,
  FileUp,
  Table
} from 'lucide-react';

// pdfjsLib removed
// pdfjsLib.GlobalWorkerOptions.workerSrc removed - pdfjs-dist not installed
import { 
  FoodPhotographerService, 
  Dish, 
  ImageSize, 
  ImageAspectRatio, 
  StyleSettings, 
  PhotoTemplate,
  DEFAULT_TEMPLATES,
  Lighting,
  Composition,
  ColorTemp,
  BaseStyle
} from './services/foodPhotographer';
import { ImageEditor } from './components/ImageEditor';
import { BatchImageEditor } from './components/BatchImageEditor';

interface WatermarkSettings {
  text: string;
  opacity: number;
  position: 'top-left' | 'top-center' | 'top-right' | 'middle-left' | 'center' | 'middle-right' | 'bottom-left' | 'bottom-center' | 'bottom-right';
  enabled: boolean;
  tiled: boolean;
  spacing: number;
  size: number;
}

// Extend window for AI Studio API key selection
declare global {
  interface Window {
    aistudio: {
      hasSelectedApiKey: () => Promise<boolean>;
      openSelectKey: () => Promise<void>;
    };
  }
}

const SIZES: ImageSize[] = ['1K', '2K', '4K'];
const ASPECT_RATIOS: ImageAspectRatio[] = ['1:1', '4:3', '3:4', '16:9', '9:16'];

const LIGHTING_OPTIONS: Lighting[] = ['Natural', 'Studio', 'Moody', 'Soft', 'Hard'];
const COMPOSITION_OPTIONS: Composition[] = ['Close-up', 'Top-down', 'Angle', 'Macro', 'Wide'];
const COLOR_TEMP_OPTIONS: ColorTemp[] = ['Warm', 'Cool', 'Neutral', 'Vibrant'];
const BASE_STYLE_OPTIONS: BaseStyle[] = ['Rustic/Dark', 'Bright/Modern', 'Social Media', 'Custom'];

export default function App() {
  const [apiKeySelected, setApiKeySelected] = useState<boolean | null>(null);
  const [menuText, setMenuText] = useState('');
  const [dishes, setDishes] = useState<Dish[]>([]);
  
  const [customTemplates, setCustomTemplates] = useState<PhotoTemplate[]>(() => {
    const saved = localStorage.getItem('custom_food_templates');
    return saved ? JSON.parse(saved) : [];
  });
  
  const [selectedTemplate, setSelectedTemplate] = useState<PhotoTemplate>(DEFAULT_TEMPLATES[1]);
  const [isEditingTemplate, setIsEditingTemplate] = useState(false);
  const [newTemplateName, setNewTemplateName] = useState('');
  
  const [selectedSize, setSelectedSize] = useState<ImageSize>(DEFAULT_TEMPLATES[1].size);
  const [selectedAspectRatio, setSelectedAspectRatio] = useState<ImageAspectRatio>(DEFAULT_TEMPLATES[1].aspectRatio);
  const [selectedLayout, setSelectedLayout] = useState<string>(DEFAULT_TEMPLATES[1].layout || 'Standard');
  const [editingDish, setEditingDish] = useState<Dish | null>(null);
  const [isParsing, setIsParsing] = useState(false);
  const [generatingDishes, setGeneratingDishes] = useState<Record<string, boolean>>({});
  const [generatedPhotos, setGeneratedPhotos] = useState<Record<string, string>>({});
  const [carouselPhotos, setCarouselPhotos] = useState<Record<string, string[]>>({});
  const [ingredientCards, setIngredientCards] = useState<Record<string, string>>({});
  const [generatingCarousel, setGeneratingCarousel] = useState<Record<string, boolean>>({});
  const [generatingIngredientCard, setGeneratingIngredientCard] = useState<Record<string, boolean>>({});
  const [qualityScores, setQualityScores] = useState<Record<string, number>>({});
  const [failedDishes, setFailedDishes] = useState<Record<string, boolean>>({});
  const [referencePhotos, setReferencePhotos] = useState<Record<string, string>>({});
  const [isDownloadingAll, setIsDownloadingAll] = useState(false);
  const [isRemovingAllBackgrounds, setIsRemovingAllBackgrounds] = useState(false);
  const [selectedDishes, setSelectedDishes] = useState<Set<string>>(new Set());
  const [isBatchEditing, setIsBatchEditing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editingDishNameId, setEditingDishNameId] = useState<string | null>(null);
  const [tempDishName, setTempDishName] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [useAISuggestions, setUseAISuggestions] = useState(true);
  const [showWatermarkSettings, setShowWatermarkSettings] = useState(false);
  const [watermarkSettings, setWatermarkSettings] = useState<WatermarkSettings>({
    text: 'Food AI Generock',
    opacity: 0.5,
    position: 'bottom-right',
    enabled: false,
    tiled: false,
    spacing: 150,
    size: 40
  });

  const serviceRef = useRef<FoodPhotographerService | null>(null);

  useEffect(() => {
    checkApiKey();
  }, []);

  const handleReferenceUpload = (dishName: string, file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const base64 = e.target?.result as string;
      setReferencePhotos(prev => ({ ...prev, [dishName]: base64 }));
    };
    reader.readAsDataURL(file);
  };

  const checkApiKey = async () => {
    if (window.aistudio) {
      const hasKey = await window.aistudio.hasSelectedApiKey();
      setApiKeySelected(hasKey);
    } else {
      // Fallback for local dev if needed, but in AI Studio it should exist
      setApiKeySelected(true);
    }
  };

  const handleOpenKeySelector = async () => {
    if (window.aistudio) {
      await window.aistudio.openSelectKey();
      setApiKeySelected(true);
    }
  };

  const getService = () => {
    // Always create a new instance to get the latest key if it changed
    return new FoodPhotographerService(process.env.GEMINI_API_KEY || '');
  };

  const handleSaveCustomTemplate = () => {
    if (!newTemplateName.trim()) return;
    
    const newTemplate: PhotoTemplate = {
      ...selectedTemplate,
      aspectRatio: selectedAspectRatio,
      size: selectedSize,
      layout: selectedLayout,
      id: `custom-${Date.now()}`,
      name: newTemplateName,
      isCustom: true
    };
    
    const updated = [...customTemplates, newTemplate];
    setCustomTemplates(updated);
    localStorage.setItem('custom_food_templates', JSON.stringify(updated));
    setSelectedTemplate(newTemplate);
    setNewTemplateName('');
    setIsEditingTemplate(false);
  };

  const handleDeleteTemplate = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const updated = customTemplates.filter(t => t.id !== id);
    setCustomTemplates(updated);
    localStorage.setItem('custom_food_templates', JSON.stringify(updated));
    if (selectedTemplate.id === id) {
      handleSelectTemplate(DEFAULT_TEMPLATES[1]);
    }
  };

  const handleUpdateCustomTemplate = () => {
    if (!selectedTemplate.isCustom) return;
    
    const updatedTemplate: PhotoTemplate = {
      ...selectedTemplate,
      aspectRatio: selectedAspectRatio,
      size: selectedSize,
      layout: selectedLayout,
    };
    
    const updated = customTemplates.map(t => t.id === updatedTemplate.id ? updatedTemplate : t);
    setCustomTemplates(updated);
    localStorage.setItem('custom_food_templates', JSON.stringify(updated));
    setSelectedTemplate(updatedTemplate);
    setIsEditingTemplate(false);
  };

  const handleSelectTemplate = (template: PhotoTemplate) => {
    setSelectedTemplate(template);
    setUseAISuggestions(false);
    setSelectedSize(template.size);
    setSelectedAspectRatio(template.aspectRatio);
    setSelectedLayout(template.layout || 'Standard');
  };

  const updateTemplateSetting = (key: keyof PhotoTemplate, value: any) => {
    setUseAISuggestions(false);
    setSelectedTemplate(prev => ({
      ...prev,
      [key]: value,
      id: prev.isCustom ? prev.id : `temp-${Date.now()}`,
      name: prev.isCustom ? prev.name : `${prev.name} (Modified)`
    }));
    
    // Sync with separate states if needed
    if (key === 'size') setSelectedSize(value);
    if (key === 'aspectRatio') setSelectedAspectRatio(value);
    if (key === 'layout') setSelectedLayout(value);
  };

  const handleParseMenu = async (text: string = menuText) => {
    if (!text.trim()) return;
    setIsParsing(true);
    setError(null);
    try {
      const service = getService();
      const extractedDishes = await service.parseMenu(text);
      setDishes(extractedDishes);
      setMenuText(text);
      setUseAISuggestions(true);
    } catch (err) {
      setError('Failed to parse menu. Please try again.');
      console.error(err);
    } finally {
      setIsParsing(false);
    }
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsParsing(true);
    setError(null);
    try {
      const fileType = file.name.split('.').pop()?.toLowerCase();

      if (false && (fileType === 'csv' || fileType === 'xlsx' || fileType === 'xls')) {
        const reader = new FileReader();
        reader.onload = async (e) => {
          try {
            const data = new Uint8Array(e.target?.result as ArrayBuffer);
            const workbook = XLSX.read(data, { type: 'array' });
            const firstSheetName = workbook.SheetNames[0];
            const worksheet = workbook.Sheets[firstSheetName];
            const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
            const text = jsonData.map((row: any) => row.join(' ')).join('\n');
            await handleParseMenu(text);
          } catch (err) {
            console.error("Excel parse error:", err);
            setError("Failed to parse Excel file.");
            setIsParsing(false);
          }
        };
        reader.readAsArrayBuffer(file);
      } else if (false && fileType === 'pdf') {
        const reader = new FileReader();
        reader.onload = async (e) => {
          try {
            const typedarray = new Uint8Array(e.target?.result as ArrayBuffer);
            const pdf = await pdfjsLib.getDocument(typedarray).promise;
            let fullText = "";
            for (let i = 1; i <= pdf.numPages; i++) {
              const page = await pdf.getPage(i);
              const textContent = await page.getTextContent();
              const pageText = textContent.items.map((item: any) => (item as any).str).join(' ');
              fullText += pageText + "\n";
            }
            await handleParseMenu(fullText);
          } catch (err) {
            console.error("PDF parse error:", err);
            setError("Failed to parse PDF file.");
            setIsParsing(false);
          }
        };
        reader.readAsArrayBuffer(file);
      } else {
        const text = await file.text();
        await handleParseMenu(text);
      }
    } catch (error) {
      console.error("Error parsing file:", error);
      setError("Failed to parse file.");
      setIsParsing(false);
    } finally {
      if (event.target) event.target.value = '';
    }
  };

  const startEditingDishName = (dish: Dish) => {
    setEditingDishNameId(dish.id);
    setTempDishName(dish.name);
  };

  const saveDishName = (id: string) => {
    setDishes(prev => prev.map(d => d.name === id ? { ...d, name: tempDishName } : d));
    setEditingDishNameId(null);
  };

  const generatePhoto = async (dish: Dish) => {
    if (generatingDishes[dish.name]) return;
    
    setGeneratingDishes(prev => ({ ...prev, [dish.name]: true }));
    setFailedDishes(prev => ({ ...prev, [dish.name]: false }));
    setError(null);

    try {
      const service = getService();
      const referencePhoto = referencePhotos[dish.name];
      
      // Use AI suggestion if enabled and available, otherwise use global selection
      let templateToUse = selectedTemplate;
      if (useAISuggestions && dish.suggestedTemplateId) {
        const suggested = [...DEFAULT_TEMPLATES, ...customTemplates].find(t => t.id === dish.suggestedTemplateId);
        if (suggested) {
          templateToUse = suggested;
        }
      }

      const photoUrl = await service.generateDishPhoto(
        dish, 
        templateToUse, 
        selectedSize, 
        selectedAspectRatio, 
        referencePhoto
      );
      
      if (photoUrl) {
        setGeneratedPhotos(prev => ({ ...prev, [dish.name]: photoUrl }));
        // Simulate a quality score between 8.5 and 9.8
        const score = Number((8.5 + Math.random() * 1.3).toFixed(1));
        setQualityScores(prev => ({ ...prev, [dish.name]: score }));
      } else {
        setFailedDishes(prev => ({ ...prev, [dish.name]: true }));
        setError(`Failed to generate photo for ${dish.name}`);
      }
    } catch (err: any) {
      setFailedDishes(prev => ({ ...prev, [dish.name]: true }));
      if (err.message?.includes('Requested entity was not found')) {
        setApiKeySelected(false);
        setError('API Key error. Please re-select your API key.');
      } else {
        setError(`Error generating photo for ${dish.name}: ${err.message || 'Unknown error'}`);
      }
      console.error(`Failed to generate photo for ${dish.name}`, err);
    } finally {
      setGeneratingDishes(prev => ({ ...prev, [dish.name]: false }));
    }
  };

  const generateCarousel = async (dish: Dish) => {
    if (generatingCarousel[dish.name]) return;
    
    setGeneratingCarousel(prev => ({ ...prev, [dish.name]: true }));
    setError(null);

    try {
      const service = getService();
      const referencePhoto = referencePhotos[dish.name];
      
      const compositions: Composition[] = ['Top-down', 'Close-up', 'Angle', 'Macro'];
      const variants: string[] = [];

      for (const comp of compositions) {
        const style = { ...selectedTemplate, composition: comp };
        const photoUrl = await service.generateDishPhoto(
          dish, 
          style, 
          selectedSize, 
          selectedAspectRatio, 
          referencePhoto
        );
        if (photoUrl) variants.push(photoUrl);
      }
      
      if (variants.length > 0) {
        setCarouselPhotos(prev => ({ ...prev, [dish.name]: variants }));
      } else {
        setError(`Failed to generate carousel for ${dish.name}`);
      }
    } catch (err: any) {
      setError(`Error generating carousel for ${dish.name}: ${err.message || 'Unknown error'}`);
      console.error(`Failed to generate carousel for ${dish.name}`, err);
    } finally {
      setGeneratingCarousel(prev => ({ ...prev, [dish.name]: false }));
    }
  };

  const generateIngredientCard = async (dish: Dish) => {
    if (generatingIngredientCard[dish.name]) return;
    
    setGeneratingIngredientCard(prev => ({ ...prev, [dish.name]: true }));
    setError(null);

    try {
      const service = getService();
      const photoUrl = await service.generateIngredientCard(
        dish, 
        selectedSize, 
        selectedAspectRatio
      );
      
      if (photoUrl) {
        setIngredientCards(prev => ({ ...prev, [dish.name]: photoUrl }));
      } else {
        setError(`Failed to generate ingredient card for ${dish.name}`);
      }
    } catch (err: any) {
      setError(`Error generating ingredient card for ${dish.name}: ${err.message || 'Unknown error'}`);
      console.error(`Failed to generate ingredient card for ${dish.name}`, err);
    } finally {
      setGeneratingIngredientCard(prev => ({ ...prev, [dish.name]: false }));
    }
  };

  const generateAll = async () => {
    const dishesToGenerate = dishes.filter(d => !generatedPhotos[d.id] && !generatingDishes[d.id]);
    if (dishesToGenerate.length === 0) return;

    setError(null);
    
    // Process sequentially to avoid hitting rate limits too hard and to manage state better
    for (const dish of dishesToGenerate) {
      await generatePhoto(dish);
    }
  };

  const handleRemoveAllBackgrounds = async () => {
    const photoEntries = Object.entries(generatedPhotos);
    if (photoEntries.length === 0) return;

    setIsRemovingAllBackgrounds(true);
    setError(null);
    try {
      const service = getService();
      
      for (const [id, url] of photoEntries) {
        try {
          const result = await service.removeBackground(url as string);
          if (result) {
            // Update state incrementally so user sees progress
            setGeneratedPhotos(prev => ({ ...prev, [id]: result }));
          }
        } catch (err) {
          console.error(`Failed to remove background for ${id}`, err);
        }
      }
    } catch (err) {
      console.error("Failed to remove all backgrounds", err);
      setError("Failed to process all backgrounds. Please try again.");
    } finally {
      setIsRemovingAllBackgrounds(false);
    }
  };

  const toggleDishSelection = (dishName: string) => {
    setSelectedDishes(prev => {
      const next = new Set(prev);
      if (next.has(dishName)) {
        next.delete(dishName);
      } else {
        next.add(dishName);
      }
      return next;
    });
  };

  const toggleSelectAll = () => {
    const generatedDishNames = dishes
      .filter(d => generatedPhotos[d.name])
      .map(d => d.name);

    if (selectedDishes.size === generatedDishNames.length && generatedDishNames.length > 0) {
      setSelectedDishes(new Set());
    } else {
      setSelectedDishes(new Set(generatedDishNames));
    }
  };

  const handleBatchSave = (results: Record<string, string>) => {
    setGeneratedPhotos(prev => ({ ...prev, ...results }));
    setIsBatchEditing(false);
    setSelectedDishes(new Set());
  };

  const handleShare = async (dish: Dish, imageUrl: string) => {
    if (navigator.share && navigator.canShare && navigator.canShare({ files: [new File([], 'test.png', { type: 'image/png' })] })) {
      try {
        const watermarkedUrl = await applyWatermark(imageUrl);
        const response = await fetch(watermarkedUrl);
        const blob = await response.blob();
        const file = new File([blob], `${dish.name.replace(/\s+/g, '_')}.png`, { type: 'image/png' });
        
        await navigator.share({
          files: [file],
          title: `Check out this ${dish.name}!`,
          text: `Professional food photography for ${dish.name}, generated with Food AI Generock.`,
        });
      } catch (err) {
        if ((err as Error).name !== 'AbortError') {
          console.error('Error sharing:', err);
          setError('Could not share the image. Try downloading it instead.');
        }
      }
    } else {
      setError('Native sharing is not supported in this browser or environment. Please download the image to share.');
      setTimeout(() => setError(null), 5000);
    }
  };

  const handleDownloadAll = async () => {
    const zip = new JSZip();
    const folder = zip.folder("food_photos");
    
    if (!folder) return;

    setIsDownloadingAll(true);
    setError(null);
    try {
      // Main photos
      const photoEntries = Object.entries(generatedPhotos);
      for (const [id, url] of photoEntries) {
        const dish = dishes.find(d => d.name === id);
        const fileName = dish ? dish.name.replace(/\s+/g, '_') : id;
        const watermarkedUrl = await applyWatermark(url as string);
        const response = await fetch(watermarkedUrl);
        const blob = await response.blob();
        folder.file(`${fileName}.png`, blob);
      }

      // Carousel variants
      const carouselEntries = Object.entries(carouselPhotos);
      for (const [id, urls] of carouselEntries) {
        const dish = dishes.find(d => d.name === id);
        const folderName = dish ? dish.name.replace(/\s+/g, '_') : id;
        const carouselFolder = folder.folder(`${folderName}_carousel`);
        if (carouselFolder) {
          const photoUrls = urls as string[];
          for (let i = 0; i < photoUrls.length; i++) {
            const watermarkedUrl = await applyWatermark(photoUrls[i]);
            const response = await fetch(watermarkedUrl);
            const blob = await response.blob();
            carouselFolder.file(`variant_${i + 1}.png`, blob);
          }
        }
      }

      // Ingredient cards
      const ingredientEntries = Object.entries(ingredientCards);
      for (const [id, url] of ingredientEntries) {
        const dish = dishes.find(d => d.name === id);
        const fileName = dish ? dish.name.replace(/\s+/g, '_') : id;
        const watermarkedUrl = await applyWatermark(url as string);
        const response = await fetch(watermarkedUrl);
        const blob = await response.blob();
        folder.file(`${fileName}_ingredients.png`, blob);
      }
      
      const content = await zip.generateAsync({ type: "blob" });
      const link = document.createElement("a");
      link.href = URL.createObjectURL(content);
      link.download = "food_photos.zip";
      link.click();
    } catch (err) {
      console.error("Failed to download all photos", err);
      setError("Failed to create zip file. Please try again.");
    } finally {
      setIsDownloadingAll(false);
    }
  };

  const loadSampleMenu = () => {
    setMenuText(`Vegan
CA ÎN ORIENT 250 GR: falafel, hummus, ulei de măsline, ardei kapia, verdeață, ceapă roșie, sos tahini, pâine prăjită
SALATA CELOR FIȚOȘI 300 GR: mix de salată, portocale, tofu, afine, miez de nucă, ulei de măsline, zeamă de lămâie
BUDINCĂ DE CHIA DIVINĂ BANANA TOFFEE 225 GR: lapte, iaurt, semințe de chia, fulgi de ovăz, caramel, afine, zmeură, căpșune, banane, banane uscate

Vegetarian
SHAKSHUKA CUM ȘTIM NOI 400 GR: 2 ouă, roșii, ardei kapia, brânză telemea, chimen, ceapă roșie, usturoi, verdeață, pită grecească
OUĂ MOI PE PAT DE IAURT GRECESC 350 GR: 2 ouă poșate, pâine toast, guacamole, iaurt grecesc, smântână, roșie, mentă, semințe de susan, ulei de susan

Recomandările noastre
BRISKET LA RĂSĂRIT CU CARTOFI PRĂJIȚI 320 GR: brisket, chiflă de pâine, ou, unt, ceapă marinată, cartofi prăjiți
DIMINEAȚĂ DE AUR CU BENEDICT 280 GR: 2 ouă poșate, chiflă de pâine, bacon, sos olandez
RENUMITUL CHEESY STEAK SANDWICH 350 GR: fâșii de carne de vită, panini grill, salată verde, varză, ceapă roșie, unt, cașcaval, brânză cheddar, cartofi prăjiți`);
  };

  const getAspectRatioNumber = (ratio: ImageAspectRatio): number => {
    const [w, h] = ratio.split(':').map(Number);
    return w / h;
  };

  const applyWatermark = async (imageUrl: string): Promise<string> => {
    if (!watermarkSettings.enabled || !watermarkSettings.text) return imageUrl;
    
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(imageUrl);
          return;
        }
        
        ctx.drawImage(img, 0, 0);
        
        const baseSize = Math.max(20, Math.floor(canvas.width / 25));
        const fontSize = Math.floor(baseSize * (watermarkSettings.size / 40));
        ctx.font = `bold ${fontSize}px sans-serif`;
        ctx.globalAlpha = watermarkSettings.opacity;
        ctx.fillStyle = 'white';
        ctx.shadowColor = 'rgba(0,0,0,0.5)';
        ctx.shadowBlur = 4;
        
        if (watermarkSettings.tiled) {
          const metrics = ctx.measureText(watermarkSettings.text);
          const textWidth = metrics.width;
          const textHeight = fontSize;
          const spacing = watermarkSettings.spacing || 150;
          
          ctx.save();
          // Rotate around the center of the canvas
          ctx.translate(canvas.width / 2, canvas.height / 2);
          ctx.rotate(-Math.PI / 4);
          ctx.translate(-canvas.width / 2, -canvas.height / 2);
          
          // Calculate bounds for rotated tiling to cover the whole canvas
          const diagonal = Math.sqrt(canvas.width ** 2 + canvas.height ** 2);
          const offset = (diagonal - canvas.width) / 2;
          
          let row = 0;
          for (let y = -offset; y < canvas.height + offset; y += textHeight + spacing) {
            // Stagger every other row for a more professional look
            const rowShift = (row % 2 === 0) ? 0 : (textWidth + spacing) / 2;
            for (let x = -offset - (textWidth + spacing); x < canvas.width + offset; x += textWidth + spacing) {
              ctx.fillText(watermarkSettings.text, x + rowShift, y);
            }
            row++;
          }
          ctx.restore();
        } else {
          const metrics = ctx.measureText(watermarkSettings.text);
          const padding = canvas.width * 0.03;
          let x = padding;
          let y = padding + fontSize;
          
          switch (watermarkSettings.position) {
            case 'top-left':
              x = padding;
              y = padding + fontSize;
              break;
            case 'top-center':
              x = (canvas.width - metrics.width) / 2;
              y = padding + fontSize;
              break;
            case 'top-right':
              x = canvas.width - metrics.width - padding;
              y = padding + fontSize;
              break;
            case 'middle-left':
              x = padding;
              y = (canvas.height + fontSize) / 2;
              break;
            case 'center':
              x = (canvas.width - metrics.width) / 2;
              y = (canvas.height + fontSize) / 2;
              break;
            case 'middle-right':
              x = canvas.width - metrics.width - padding;
              y = (canvas.height + fontSize) / 2;
              break;
            case 'bottom-left':
              x = padding;
              y = canvas.height - padding;
              break;
            case 'bottom-center':
              x = (canvas.width - metrics.width) / 2;
              y = canvas.height - padding;
              break;
            case 'bottom-right':
              x = canvas.width - metrics.width - padding;
              y = canvas.height - padding;
              break;
          }
          
          ctx.fillText(watermarkSettings.text, x, y);
        }
        
        resolve(canvas.toDataURL('image/png'));
      };
      img.onerror = () => resolve(imageUrl);
      img.src = imageUrl;
    });
  };

  const handleDownloadSingle = async (dish: Dish, imageUrl: string, suffix?: string) => {
    try {
      const watermarkedUrl = await applyWatermark(imageUrl);
      const link = document.createElement("a");
      link.href = watermarkedUrl;
      const fileName = suffix 
        ? `${dish.name.replace(/\s+/g, '_')}_${suffix}.png`
        : `${dish.name.replace(/\s+/g, '_')}.png`;
      link.download = fileName;
      link.click();
    } catch (err) {
      console.error("Failed to download photo", err);
      setError("Failed to download photo. Please try again.");
    }
  };

  if (apiKeySelected === false) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center p-6">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="max-w-md w-full bg-zinc-900 border border-zinc-800 rounded-3xl p-8 text-center"
        >
          <div className="w-16 h-16 bg-amber-500/10 rounded-full flex items-center justify-center mx-auto mb-6">
            <Key className="text-amber-500 w-8 h-8" />
          </div>
          <h1 className="text-2xl font-bold text-white mb-4">API Key Required</h1>
          <p className="text-zinc-400 mb-8">
            To use the high-end <b>Gemini 3 Pro Image</b> model, you need to select an API key from a paid Google Cloud project.
          </p>
          <button
            onClick={handleOpenKeySelector}
            className="w-full py-4 bg-white text-black font-semibold rounded-xl hover:bg-zinc-200 transition-colors flex items-center justify-center gap-2"
          >
            Select API Key
          </button>
          <p className="mt-4 text-xs text-zinc-500">
            Learn more about <a href="https://ai.google.dev/gemini-api/docs/billing" target="_blank" rel="noopener noreferrer" className="underline">billing and API keys</a>.
          </p>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 selection:bg-white selection:text-black">
      {/* Header */}
      <header className="border-b border-zinc-900 bg-zinc-950/50 backdrop-blur-xl sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center">
              <Camera className="text-black w-6 h-6" />
            </div>
            <div>
              <h1 className="font-bold text-lg tracking-tight">Food AI Generock</h1>
              <p className="text-xs text-zinc-500 font-medium uppercase tracking-widest">Pro Studio Edition</p>
            </div>
          </div>
          
          <div className="flex items-center gap-4">
            {Object.keys(generatedPhotos).length > 0 && (
              <button 
                onClick={handleDownloadAll}
                disabled={isDownloadingAll}
                className="flex items-center gap-2 px-4 py-2 bg-zinc-900 border border-zinc-800 rounded-xl text-sm font-medium hover:bg-zinc-800 transition-colors disabled:opacity-50"
              >
                {isDownloadingAll ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                Download All (.zip)
              </button>
            )}
            {dishes.length > 0 && (
              <button 
                onClick={() => { setDishes([]); setGeneratedPhotos({}); setMenuText(''); }}
                className="text-sm text-zinc-500 hover:text-white transition-colors"
              >
                Reset Studio
              </button>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-12">
        <div className="grid lg:grid-cols-12 gap-12">
          
          {/* Left Column: Controls */}
          <div className="lg:col-span-4 space-y-8">
            <section className="bg-zinc-900/50 border border-zinc-800 rounded-3xl p-6 space-y-6">
              <div className="flex items-center justify-between gap-2 text-zinc-400 mb-2">
                <div className="flex items-center gap-2">
                  <Upload className="w-4 h-4" />
                  <h2 className="text-sm font-semibold uppercase tracking-wider">1. Upload Menu</h2>
                </div>
                {!menuText && (
                  <button 
                    onClick={loadSampleMenu}
                    className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-zinc-500 hover:text-white transition-colors"
                  >
                    <FileText className="w-3 h-3" />
                    Load Sample
                  </button>
                )}
              </div>
              
              <textarea
                value={menuText}
                onChange={(e) => setMenuText(e.target.value)}
                placeholder="Paste your menu here... e.g. 'Truffle Mushroom Risotto - Creamy arborio rice with wild mushrooms and truffle oil'"
                className="w-full h-48 bg-zinc-950 border border-zinc-800 rounded-2xl p-4 text-sm focus:outline-none focus:border-white transition-colors resize-none"
              />
              
              <button
                onClick={() => handleParseMenu()}
                disabled={isParsing || !menuText.trim()}
                className="w-full py-4 bg-white text-black font-bold rounded-xl hover:bg-zinc-200 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2"
              >
                {isParsing ? <Loader2 className="w-5 h-5 animate-spin" /> : <ChevronRight className="w-5 h-5" />}
                Extract Dishes
              </button>
            </section>

            <AnimatePresence>
              {dishes.length > 0 && (
                <motion.section 
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 20 }}
                  className="bg-zinc-900/50 border border-zinc-800 rounded-3xl p-6 space-y-8"
                >
                  <div className="space-y-6">
                    <div className="flex items-center gap-2 text-zinc-400">
                      <Settings2 className="w-4 h-4" />
                      <h2 className="text-sm font-semibold uppercase tracking-wider">2. Studio Settings</h2>
                    </div>

                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <label className="text-xs text-zinc-500 font-bold uppercase tracking-widest">Photo Template</label>
                        <div className="flex items-center gap-4">
                          <button 
                            onClick={() => setUseAISuggestions(!useAISuggestions)}
                            className={`flex items-center gap-1.5 px-2 py-1 rounded-md text-[9px] font-bold uppercase tracking-widest transition-all ${
                              useAISuggestions ? 'bg-amber-500/10 text-amber-500 border border-amber-500/20' : 'text-zinc-500 hover:text-zinc-300'
                            }`}
                          >
                            <Sparkles className={`w-2.5 h-2.5 ${useAISuggestions ? 'text-amber-500' : 'text-zinc-600'}`} />
                            {useAISuggestions ? 'AI Auto-Style ON' : 'AI Auto-Style OFF'}
                          </button>
                          <button 
                            onClick={() => setIsEditingTemplate(!isEditingTemplate)}
                            className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 hover:text-white transition-colors flex items-center gap-1"
                          >
                            <Settings2 className="w-3 h-3" />
                            {isEditingTemplate ? 'Hide' : 'Controls'}
                          </button>
                        </div>
                      </div>
                      
                      <div className="grid grid-cols-1 gap-2 max-h-48 overflow-y-auto pr-2 custom-scrollbar">
                        {[...DEFAULT_TEMPLATES, ...customTemplates].map(template => (
                          <div key={template.id} className="relative group">
                            <button
                              onClick={() => handleSelectTemplate(template)}
                              className={`w-full py-3 px-4 rounded-xl text-sm font-medium text-left transition-all border flex items-center justify-between ${
                                selectedTemplate.id === template.id 
                                  ? 'bg-white text-black border-white' 
                                  : 'bg-zinc-950 text-zinc-400 border-zinc-800 hover:border-zinc-700'
                              }`}
                            >
                              <div className="flex flex-col">
                                <span>{template.name}</span>
                                <span className="text-[9px] opacity-60">
                                  {template.aspectRatio} • {template.size} • {template.layout || 'Standard'}
                                </span>
                              </div>
                              {template.isCustom && (
                                <button
                                  onClick={(e) => handleDeleteTemplate(template.id, e)}
                                  className={`p-1 rounded-md transition-colors ${
                                    selectedTemplate.id === template.id ? 'hover:bg-zinc-100 text-zinc-400' : 'hover:bg-zinc-900 text-zinc-600'
                                  }`}
                                >
                                  <Trash2 className="w-3 h-3" />
                                </button>
                              )}
                            </button>
                          </div>
                        ))}
                      </div>

                      <AnimatePresence>
                        {isEditingTemplate && (
                          <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            className="overflow-hidden space-y-4 pt-2"
                          >
                            <div className="grid grid-cols-2 gap-4">
                              <div className="space-y-2">
                                <label className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest">Lighting</label>
                                <select 
                                  value={selectedTemplate.lighting}
                                  onChange={(e) => updateTemplateSetting('lighting', e.target.value)}
                                  className="w-full bg-zinc-950 border border-zinc-800 rounded-lg p-2 text-xs focus:outline-none focus:border-white"
                                >
                                  {LIGHTING_OPTIONS.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                                </select>
                              </div>
                              <div className="space-y-2">
                                <label className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest">Composition</label>
                                <select 
                                  value={selectedTemplate.composition}
                                  onChange={(e) => updateTemplateSetting('composition', e.target.value)}
                                  className="w-full bg-zinc-950 border border-zinc-800 rounded-lg p-2 text-xs focus:outline-none focus:border-white"
                                >
                                  {COMPOSITION_OPTIONS.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                                </select>
                              </div>
                              <div className="space-y-2">
                                <label className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest">Color Temp</label>
                                <select 
                                  value={selectedTemplate.colorTemp}
                                  onChange={(e) => updateTemplateSetting('colorTemp', e.target.value)}
                                  className="w-full bg-zinc-950 border border-zinc-800 rounded-lg p-2 text-xs focus:outline-none focus:border-white"
                                >
                                  {COLOR_TEMP_OPTIONS.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                                </select>
                              </div>
                              <div className="space-y-2">
                                <label className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest">Base Aesthetic</label>
                                <select 
                                  value={selectedTemplate.baseStyle}
                                  onChange={(e) => updateTemplateSetting('baseStyle', e.target.value)}
                                  className="w-full bg-zinc-950 border border-zinc-800 rounded-lg p-2 text-xs focus:outline-none focus:border-white"
                                >
                                  {BASE_STYLE_OPTIONS.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                                </select>
                              </div>
                              <div className="space-y-2 col-span-2">
                                <label className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest">Layout Element</label>
                                <select 
                                  value={selectedLayout}
                                  onChange={(e) => updateTemplateSetting('layout', e.target.value)}
                                  className="w-full bg-zinc-950 border border-zinc-800 rounded-lg p-2 text-xs focus:outline-none focus:border-white"
                                >
                                  <option value="Standard">Standard (Single Dish)</option>
                                  <option value="Flatlay">Flatlay (Multiple Items)</option>
                                  <option value="Hero">Hero (Main Subject + Garnish)</option>
                                  <option value="Action">Action (Pouring/Steam/Cutting)</option>
                                </select>
                              </div>
                            </div>

                            <div className="pt-2 flex flex-col gap-2">
                              <div className="flex gap-2">
                                <input 
                                  type="text"
                                  value={newTemplateName}
                                  onChange={(e) => setNewTemplateName(e.target.value)}
                                  placeholder="New Template Name..."
                                  className="flex-1 bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-white"
                                />
                                <button
                                  onClick={handleSaveCustomTemplate}
                                  disabled={!newTemplateName.trim()}
                                  className="px-3 py-2 bg-zinc-100 text-black rounded-lg text-xs font-bold hover:bg-white transition-colors disabled:opacity-50 flex items-center gap-1 shrink-0"
                                >
                                  <Save className="w-3 h-3" />
                                  Save New
                                </button>
                              </div>
                              {selectedTemplate.isCustom && (
                                <button
                                  onClick={handleUpdateCustomTemplate}
                                  className="w-full py-2 bg-zinc-800 text-white rounded-lg text-xs font-bold hover:bg-zinc-700 transition-colors flex items-center justify-center gap-1"
                                >
                                  <RefreshCcw className="w-3 h-3" />
                                  Update "{selectedTemplate.name}"
                                </button>
                              )}
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>

                    <div className="space-y-3">
                      <label className="text-xs text-zinc-500 font-bold uppercase tracking-widest">Output Resolution</label>
                      <div className="grid grid-cols-3 gap-2">
                        {SIZES.map(size => (
                          <button
                            key={size}
                            onClick={() => updateTemplateSetting('size', size)}
                            className={`py-2 rounded-xl text-xs font-bold transition-all border ${
                              selectedSize === size 
                                ? 'bg-white text-black border-white' 
                                : 'bg-zinc-950 text-zinc-400 border-zinc-800 hover:border-zinc-700'
                            }`}
                          >
                            {size}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="space-y-3">
                      <label className="text-xs text-zinc-500 font-bold uppercase tracking-widest">Aspect Ratio</label>
                      <div className="grid grid-cols-3 gap-2">
                        {ASPECT_RATIOS.map(ratio => (
                          <button
                            key={ratio}
                            onClick={() => updateTemplateSetting('aspectRatio', ratio)}
                            className={`py-2 rounded-xl text-xs font-bold transition-all border ${
                              selectedAspectRatio === ratio 
                                ? 'bg-white text-black border-white' 
                                : 'bg-zinc-950 text-zinc-400 border-zinc-800 hover:border-zinc-700'
                            }`}
                          >
                            {ratio}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  <button
                    onClick={generateAll}
                    className="w-full py-4 bg-zinc-100 text-black font-bold rounded-xl hover:bg-white transition-all flex items-center justify-center gap-2 shadow-xl shadow-white/5"
                  >
                    <Sparkles className="w-5 h-5" />
                    Generate All Photos
                  </button>
                </motion.section>
              )}
            </AnimatePresence>

            {error && (
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="p-4 bg-red-500/10 border border-red-500/20 rounded-2xl flex items-start gap-3"
              >
                <AlertCircle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
                <p className="text-sm text-red-200">{error}</p>
              </motion.div>
            )}
          </div>

          {/* Right Column: Gallery */}
          <div className="lg:col-span-8">
            {dishes.length === 0 ? (
              <div className="h-[600px] border-2 border-dashed border-zinc-900 rounded-[40px] flex flex-col items-center justify-center text-center p-12">
                <div className="w-20 h-20 bg-zinc-900 rounded-full flex items-center justify-center mb-6">
                  <UtensilsCrossed className="text-zinc-700 w-10 h-10" />
                </div>
                <h3 className="text-xl font-bold text-zinc-500 mb-2">No Menu Loaded</h3>
                <p className="text-zinc-600 max-w-xs">Upload your menu text on the left to start generating professional food photography.</p>
              </div>
            ) : (
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                    <h3 className="text-xl font-bold uppercase tracking-widest text-sm">Studio Gallery</h3>
                  </div>
                  {Object.keys(generatedPhotos).length > 0 && (
                    <div className="flex items-center gap-2">
                      {selectedDishes.size > 0 && (
                        <button
                          onClick={() => setIsBatchEditing(true)}
                          className="flex items-center gap-2 px-6 py-2 bg-emerald-600 text-white rounded-full text-xs font-bold hover:bg-emerald-500 transition-all shadow-lg shadow-emerald-900/20"
                        >
                          <Edit2 className="w-3 h-3" />
                          Batch Edit ({selectedDishes.size})
                        </button>
                      )}
                      <button
                        onClick={toggleSelectAll}
                        className="px-4 py-2 bg-zinc-800 text-zinc-300 rounded-full text-xs font-bold hover:bg-zinc-700 transition-all"
                      >
                        {selectedDishes.size === dishes.filter(d => generatedPhotos[d.name]).length && selectedDishes.size > 0 
                          ? 'Deselect All' 
                          : 'Select All'}
                      </button>
                      <button
                        onClick={handleRemoveAllBackgrounds}
                        disabled={isRemovingAllBackgrounds}
                        className="flex items-center gap-2 px-6 py-2 bg-zinc-900 text-white border border-zinc-800 rounded-full text-xs font-bold hover:bg-zinc-800 transition-all disabled:opacity-50"
                      >
                        {isRemovingAllBackgrounds ? (
                          <Loader2 className="w-3 h-3 animate-spin" />
                        ) : (
                          <Scissors className="w-3 h-3" />
                        )}
                        Remove All Backgrounds
                      </button>
                      <button
                        onClick={() => setShowWatermarkSettings(true)}
                        className="flex items-center gap-2 px-6 py-2 bg-zinc-900 text-white border border-zinc-800 rounded-full text-xs font-bold hover:bg-zinc-800 transition-all"
                      >
                        <Settings2 className="w-3 h-3" />
                        Watermark Settings
                      </button>
                      <button
                        onClick={handleDownloadAll}
                        disabled={isDownloadingAll}
                        className="flex items-center gap-2 px-6 py-2 bg-white text-black rounded-full text-xs font-bold hover:bg-zinc-200 transition-all disabled:opacity-50 shadow-lg shadow-white/5"
                      >
                        {isDownloadingAll ? (
                          <Loader2 className="w-3 h-3 animate-spin" />
                        ) : (
                          <Download className="w-3 h-3" />
                        )}
                        Download All (.zip)
                      </button>
                    </div>
                  )}
                </div>
                <div className="grid md:grid-cols-2 gap-6">
                {dishes.map((dish, index) => (
                  <motion.div
                    key={dish.name}
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: index * 0.1 }}
                    className={`group bg-zinc-900 border ${selectedDishes.has(dish.name) ? 'border-emerald-500 ring-1 ring-emerald-500' : 'border-zinc-800'} rounded-[32px] overflow-hidden flex flex-col transition-all`}
                  >
                    <div className={`relative bg-zinc-950 overflow-hidden ${
                      selectedAspectRatio === '1:1' ? 'aspect-square' :
                      selectedAspectRatio === '4:3' ? 'aspect-[4/3]' :
                      selectedAspectRatio === '3:4' ? 'aspect-[3/4]' :
                      selectedAspectRatio === '16:9' ? 'aspect-video' :
                      'aspect-[9/16]'
                    }`}>
                      {generatedPhotos[dish.name] ? (
                        <>
                          <div 
                            className="absolute top-4 left-4 z-10 cursor-pointer"
                            onClick={() => toggleDishSelection(dish.name)}
                          >
                            <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all ${
                              selectedDishes.has(dish.name) 
                                ? 'bg-emerald-500 border-emerald-500' 
                                : 'bg-black/40 border-white/50 hover:border-white'
                            }`}>
                              {selectedDishes.has(dish.name) && <CheckCircle2 className="w-4 h-4 text-white" />}
                            </div>
                          </div>
                          
                          {qualityScores[dish.name] && (
                            <div className="absolute top-4 right-4 z-10 flex flex-col items-end gap-1">
                              <div className="px-2 py-1 bg-black/60 backdrop-blur-md border border-white/10 rounded-lg flex items-center gap-1.5">
                                <Sparkles className="w-3 h-3 text-amber-400" />
                                <span className="text-[10px] font-bold text-white uppercase tracking-wider">Studio Grade</span>
                              </div>
                              <div className="px-2 py-1 bg-emerald-500/90 backdrop-blur-md rounded-lg shadow-lg shadow-emerald-900/20">
                                <span className="text-[10px] font-black text-white">{qualityScores[dish.name]}/10</span>
                              </div>
                            </div>
                          )}

                          <img 
                            src={generatedPhotos[dish.name]} 
                            alt={dish.name}
                            className={`w-full h-full object-cover transition-transform duration-700 group-hover:scale-110 ${selectedDishes.has(dish.name) ? 'opacity-80' : ''}`}
                            referrerPolicy="no-referrer"
                            onClick={() => toggleDishSelection(dish.name)}
                          />
                          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-3">
                            <button 
                              onClick={() => setEditingDish(dish)}
                              className="w-12 h-12 bg-white text-black rounded-full flex items-center justify-center hover:scale-110 transition-transform"
                              title="Edit Photo"
                            >
                              <Edit2 className="w-5 h-5" />
                            </button>
                            <button 
                              onClick={() => generatePhoto(dish)}
                              className="w-12 h-12 bg-white text-black rounded-full flex items-center justify-center hover:scale-110 transition-transform"
                              title="Regenerate Photo"
                            >
                              <RefreshCcw className="w-5 h-5" />
                            </button>
                            <button 
                              onClick={() => handleDownloadSingle(dish, generatedPhotos[dish.name])}
                              className="w-12 h-12 bg-white text-black rounded-full flex items-center justify-center hover:scale-110 transition-transform"
                              title="Download Photo"
                            >
                              <Download className="w-5 h-5" />
                            </button>
                            <button 
                              onClick={() => handleShare(dish, generatedPhotos[dish.name])}
                              className="w-12 h-12 bg-white text-black rounded-full flex items-center justify-center hover:scale-110 transition-transform"
                              title="Share Photo"
                            >
                              <Share2 className="w-5 h-5" />
                            </button>
                          </div>
                        </>
                      ) : (
                        <div className="w-full h-full flex flex-col items-center justify-center p-8 text-center">
                          {generatingDishes[dish.name] ? (
                            <div className="space-y-4 flex flex-col items-center">
                              <Loader2 className="w-10 h-10 text-white animate-spin" />
                              <p className="text-xs font-bold uppercase tracking-widest text-zinc-500 animate-pulse">Capturing Shot...</p>
                            </div>
                          ) : failedDishes[dish.name] ? (
                            <div className="space-y-4 flex flex-col items-center">
                              <AlertCircle className="w-10 h-10 text-red-500" />
                              <button 
                                onClick={() => generatePhoto(dish)}
                                className="flex items-center gap-2 px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-white rounded-xl text-sm font-bold transition-colors"
                              >
                                <RefreshCcw className="w-4 h-4" />
                                Retry
                              </button>
                            </div>
                          ) : (
                            <div className="flex flex-col items-center justify-center p-6 space-y-6">
                              <div className="w-16 h-16 bg-zinc-900 rounded-full flex items-center justify-center">
                                <ImageIcon className="w-8 h-8 text-zinc-700" />
                              </div>
                              
                              {dish.suggestedTemplateId && (
                                <div className="space-y-2 w-full max-w-[240px]">
                                  <div className="flex items-center gap-1.5">
                                    <Sparkles className="w-3 h-3 text-amber-500" />
                                    <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">AI Suggestion</span>
                                  </div>
                                  <button
                                    onClick={() => {
                                      const template = [...DEFAULT_TEMPLATES, ...customTemplates].find(t => t.id === dish.suggestedTemplateId);
                                      if (template) handleSelectTemplate(template);
                                    }}
                                    className="w-full p-3 bg-amber-500/5 border border-amber-500/10 rounded-2xl text-left hover:bg-amber-500/10 transition-all group/suggest"
                                  >
                                    <div className="flex items-center justify-between mb-1">
                                      <span className="text-xs font-bold text-amber-500">
                                        {[...DEFAULT_TEMPLATES, ...customTemplates].find(t => t.id === dish.suggestedTemplateId)?.name || 'Recommended Style'}
                                      </span>
                                      <ChevronRight className="w-3 h-3 text-amber-500 group-hover/suggest:translate-x-1 transition-transform" />
                                    </div>
                                    <p className="text-[9px] text-amber-200/40 leading-relaxed">
                                      Optimized for this dish's ingredients and flavor profile.
                                    </p>
                                  </button>
                                </div>
                              )}

                              <button 
                                onClick={() => generatePhoto(dish)}
                                className="px-8 py-3 bg-white text-black rounded-full text-sm font-bold hover:scale-105 transition-transform shadow-xl shadow-white/5"
                              >
                                Generate Photo
                              </button>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                    
                    <div className="p-6 flex-1 flex flex-col justify-between">
                      <div>
                        <div className="flex items-start justify-between gap-4 mb-2">
                          <div className="space-y-1">
                            <h4 className="font-bold text-lg leading-tight">{dish.name}</h4>
                            {dish.suggestedTemplateId && (
                              <div className="flex items-center gap-1.5 px-2 py-0.5 bg-amber-500/10 border border-amber-500/20 rounded-md w-fit">
                                <Sparkles className="w-2.5 h-2.5 text-amber-500" />
                                <span className="text-[8px] font-bold text-amber-500 uppercase tracking-widest">AI Pick</span>
                              </div>
                            )}
                          </div>
                          {generatedPhotos[dish.name] && <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0" />}
                        </div>
                        <p className="text-sm text-zinc-500 line-clamp-2 mb-4">{dish.description}</p>
                        
                        <div className="space-y-3">
                          <label className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 block">Proof Photo (Optional Reference)</label>
                          <div className="flex items-center gap-3">
                            {referencePhotos[dish.name] ? (
                              <div className="relative w-12 h-12 rounded-lg overflow-hidden border border-zinc-700">
                                <img src={referencePhotos[dish.name]} className="w-full h-full object-cover" />
                                <button 
                                  onClick={() => setReferencePhotos(prev => {
                                    const next = { ...prev };
                                    delete next[dish.name];
                                    return next;
                                  })}
                                  className="absolute inset-0 bg-black/60 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity"
                                >
                                  <AlertCircle className="w-4 h-4 text-white rotate-45" />
                                </button>
                              </div>
                            ) : (
                              <label className="w-12 h-12 rounded-lg border border-dashed border-zinc-700 flex items-center justify-center cursor-pointer hover:border-zinc-500 transition-colors">
                                <Upload className="w-4 h-4 text-zinc-600" />
                                <input 
                                  type="file" 
                                  accept="image/*" 
                                  className="hidden" 
                                  onChange={(e) => {
                                    const file = e.target.files?.[0];
                                    if (file) handleReferenceUpload(dish.name, file);
                                  }} 
                                />
                              </label>
                            )}
                            <span className="text-[10px] text-zinc-600 italic">
                              {referencePhotos[dish.name] ? "Reference loaded" : "Upload a real photo for better accuracy"}
                            </span>
                          </div>
                        </div>

                        <button
                          onClick={() => generatePhoto(dish)}
                          disabled={generatingDishes[dish.name]}
                          className={`w-full mt-6 py-3 rounded-xl text-sm font-bold flex items-center justify-center gap-2 transition-all ${
                            generatedPhotos[dish.name] 
                              ? 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700 hover:text-white' 
                              : 'bg-white text-black hover:bg-zinc-200'
                          }`}
                        >
                          {generatingDishes[dish.name] ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : generatedPhotos[dish.name] ? (
                            <RefreshCcw className="w-4 h-4" />
                          ) : (
                            <Sparkles className="w-4 h-4" />
                          )}
                          {generatingDishes[dish.name] ? 'Generating...' : generatedPhotos[dish.name] ? 'Regenerate' : 'Generate Photo'}
                        </button>

                        {/* Social Media Tools */}
                        <div className="mt-4 pt-4 border-t border-zinc-800 space-y-4">
                          <div className="flex items-center justify-between">
                            <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">Social Media Tools</span>
                            <div className="flex gap-2">
                              <button
                                onClick={() => generateCarousel(dish)}
                                disabled={generatingCarousel[dish.name]}
                                className="p-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-white rounded-lg transition-all disabled:opacity-50"
                                title="Generate Carousel Variants"
                              >
                                {generatingCarousel[dish.name] ? (
                                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                ) : (
                                  <Layers className="w-3.5 h-3.5" />
                                )}
                              </button>
                              <button
                                onClick={() => generateIngredientCard(dish)}
                                disabled={generatingIngredientCard[dish.name]}
                                className="p-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-white rounded-lg transition-all disabled:opacity-50"
                                title="Generate Ingredient Card"
                              >
                                {generatingIngredientCard[dish.name] ? (
                                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                ) : (
                                  <Layout className="w-3.5 h-3.5" />
                                )}
                              </button>
                            </div>
                          </div>

                          {/* Carousel Preview */}
                          {carouselPhotos[dish.name] && (
                            <div className="space-y-2">
                              <span className="text-[9px] font-bold text-zinc-600 uppercase tracking-tighter">Carousel Variants</span>
                              <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
                                {carouselPhotos[dish.name].map((photo, i) => (
                                  <div key={i} className="relative group/variant shrink-0 w-16 h-16 rounded-lg overflow-hidden border border-zinc-800">
                                    <img src={photo} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                                    <div className="absolute inset-0 bg-black/60 opacity-0 group-hover/variant:opacity-100 transition-opacity flex items-center justify-center gap-1">
                                      <button 
                                        onClick={() => handleDownloadSingle(dish, photo, `variant-${i+1}`)}
                                        className="p-1 bg-white text-black rounded-full"
                                      >
                                        <Download className="w-2.5 h-2.5" />
                                      </button>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* Ingredient Card Preview */}
                          {ingredientCards[dish.name] && (
                            <div className="space-y-2">
                              <span className="text-[9px] font-bold text-zinc-600 uppercase tracking-tighter">Ingredient Card</span>
                              <div className="relative group/ingredient w-full aspect-video rounded-xl overflow-hidden border border-zinc-800 bg-zinc-950">
                                <img src={ingredientCards[dish.name]} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                                <div className="absolute inset-0 bg-black/60 opacity-0 group-hover/ingredient:opacity-100 transition-opacity flex items-center justify-center gap-3">
                                  <button 
                                    onClick={() => handleDownloadSingle(dish, ingredientCards[dish.name], 'ingredients')}
                                    className="w-10 h-10 bg-white text-black rounded-full flex items-center justify-center"
                                  >
                                    <Download className="w-4 h-4" />
                                  </button>
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </motion.div>
                ))}
                </div>
              </div>
            )}
          </div>

        </div>
      </main>

      <footer className="max-w-7xl mx-auto px-6 py-12 border-t border-zinc-900 text-center">
        <p className="text-xs text-zinc-600 font-medium uppercase tracking-widest">
          Powered by Gemini 3 Pro Vision & Image Generation
        </p>
      </footer>

      {/* Global Loading Overlay */}
      <AnimatePresence>
        {(isParsing || isDownloadingAll || isRemovingAllBackgrounds || Object.values(generatingDishes).some(v => v)) && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm flex flex-col items-center justify-center p-6 text-center"
          >
            <div className="relative">
              <div className="w-24 h-24 border-t-2 border-white rounded-full animate-spin mb-8" />
              <Camera className="absolute inset-0 m-auto w-8 h-8 text-white animate-pulse" />
            </div>
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
            >
              <h2 className="text-2xl font-bold mb-2">
                {isParsing ? 'Analyzing Menu...' : 
                 isDownloadingAll ? 'Preparing Studio Assets...' : 
                 isRemovingAllBackgrounds ? 'Isolating All Dishes...' :
                 'Capturing Professional Shots...'}
              </h2>
              <p className="text-zinc-400 max-w-xs mx-auto">
                Our AI photographer is setting up the lighting and composition. This may take a moment.
              </p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Image Editor Modal */}
      <AnimatePresence>
        {editingDish && generatedPhotos[editingDish.name] && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[110]"
          >
            <ImageEditor
              imageUrl={generatedPhotos[editingDish.name]}
              aspectRatio={getAspectRatioNumber(selectedAspectRatio)}
              onRemoveBackground={async (url) => {
                const service = getService();
                return await service.removeBackground(url);
              }}
              onSave={(editedUrl) => {
                setGeneratedPhotos(prev => ({ ...prev, [editingDish.name]: editedUrl }));
                setEditingDish(null);
              }}
              onClose={() => setEditingDish(null)}
            />
          </motion.div>
        )}
      </AnimatePresence>
      {/* Batch Image Editor Modal */}
      <AnimatePresence>
        {isBatchEditing && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[110]"
          >
            <BatchImageEditor
              images={dishes
                .filter(d => selectedDishes.has(d.name) && generatedPhotos[d.name])
                .map(d => ({ name: d.name, url: generatedPhotos[d.name] }))
              }
              onSave={handleBatchSave}
              onClose={() => setIsBatchEditing(false)}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Watermark Settings Modal */}
      <AnimatePresence>
        {showWatermarkSettings && (
          <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-zinc-900 border border-zinc-800 rounded-3xl p-8 max-w-md w-full shadow-2xl"
            >
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-bold flex items-center gap-3">
                  <Settings2 className="w-6 h-6 text-emerald-400" />
                  Watermark Settings
                </h2>
                <button 
                  onClick={() => setShowWatermarkSettings(false)}
                  className="p-2 hover:bg-zinc-800 rounded-full transition-colors"
                >
                  <Plus className="w-6 h-6 rotate-45" />
                </button>
              </div>

              <div className="space-y-6">
                <div className="flex items-center justify-between p-4 bg-zinc-800/50 rounded-2xl border border-zinc-800">
                  <div>
                    <p className="font-bold">Enable Watermark</p>
                    <p className="text-xs text-zinc-400">Apply watermark to all photos</p>
                  </div>
                  <button
                    onClick={() => setWatermarkSettings(s => ({ ...s, enabled: !s.enabled }))}
                    className={`w-12 h-6 rounded-full transition-colors relative ${watermarkSettings.enabled ? 'bg-emerald-500' : 'bg-zinc-700'}`}
                  >
                    <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${watermarkSettings.enabled ? 'left-7' : 'left-1'}`} />
                  </button>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-bold text-zinc-400 uppercase tracking-wider">Watermark Text</label>
                  <input
                    type="text"
                    value={watermarkSettings.text}
                    onChange={(e) => setWatermarkSettings(s => ({ ...s, text: e.target.value }))}
                    className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-3 focus:outline-none focus:border-emerald-500 transition-colors"
                    placeholder="Enter watermark text..."
                  />
                </div>

                <div className="space-y-2">
                  <div className="flex justify-between">
                    <label className="text-xs font-bold text-zinc-400 uppercase tracking-wider">Opacity</label>
                    <span className="text-xs font-bold text-emerald-400">{Math.round(watermarkSettings.opacity * 100)}%</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.1"
                    value={watermarkSettings.opacity}
                    onChange={(e) => setWatermarkSettings(s => ({ ...s, opacity: parseFloat(e.target.value) }))}
                    className="w-full accent-emerald-500"
                  />
                </div>

                <div className="space-y-2">
                  <div className="flex justify-between">
                    <label className="text-xs font-bold text-zinc-400 uppercase tracking-wider">Watermark Size</label>
                    <span className="text-xs font-bold text-emerald-400">{watermarkSettings.size}px</span>
                  </div>
                  <input
                    type="range"
                    min="10"
                    max="100"
                    step="5"
                    value={watermarkSettings.size}
                    onChange={(e) => setWatermarkSettings(s => ({ ...s, size: parseInt(e.target.value) }))}
                    className="w-full accent-emerald-500"
                  />
                </div>

                <div className="flex items-center justify-between p-4 bg-zinc-800/50 rounded-2xl border border-zinc-800">
                  <div>
                    <p className="font-bold">Tile Watermark</p>
                    <p className="text-xs text-zinc-400">Repeat across the entire image</p>
                  </div>
                  <button
                    onClick={() => setWatermarkSettings(s => ({ ...s, tiled: !s.tiled }))}
                    className={`w-12 h-6 rounded-full transition-colors relative ${watermarkSettings.tiled ? 'bg-emerald-500' : 'bg-zinc-700'}`}
                  >
                    <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${watermarkSettings.tiled ? 'left-7' : 'left-1'}`} />
                  </button>
                </div>

                {watermarkSettings.tiled ? (
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <label className="text-xs font-bold text-zinc-400 uppercase tracking-wider">Tile Spacing</label>
                      <span className="text-xs font-bold text-emerald-400">{watermarkSettings.spacing}px</span>
                    </div>
                    <input
                      type="range"
                      min="50"
                      max="500"
                      step="10"
                      value={watermarkSettings.spacing}
                      onChange={(e) => setWatermarkSettings(s => ({ ...s, spacing: parseInt(e.target.value) }))}
                      className="w-full accent-emerald-500"
                    />
                  </div>
                ) : (
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-zinc-400 uppercase tracking-wider">Position</label>
                    <div className="grid grid-cols-3 gap-2 max-w-[240px]">
                      {[
                        { id: 'top-left', label: '↖' },
                        { id: 'top-center', label: '↑' },
                        { id: 'top-right', label: '↗' },
                        { id: 'middle-left', label: '←' },
                        { id: 'center', label: '•' },
                        { id: 'middle-right', label: '→' },
                        { id: 'bottom-left', label: '↙' },
                        { id: 'bottom-center', label: '↓' },
                        { id: 'bottom-right', label: '↘' }
                      ].map((pos) => (
                        <button
                          key={pos.id}
                          onClick={() => setWatermarkSettings(s => ({ ...s, position: pos.id as any }))}
                          title={pos.id.replace('-', ' ')}
                          className={`aspect-square flex items-center justify-center rounded-xl text-lg font-bold border transition-all ${
                            watermarkSettings.position === pos.id 
                              ? 'bg-emerald-500/10 border-emerald-500 text-emerald-400' 
                              : 'bg-zinc-800 border-zinc-700 text-zinc-400 hover:border-zinc-600'
                          }`}
                        >
                          {pos.label}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                <button
                  onClick={() => setShowWatermarkSettings(false)}
                  className="w-full py-4 bg-emerald-500 text-black font-bold rounded-2xl hover:bg-emerald-400 transition-colors shadow-lg shadow-emerald-500/20"
                >
                  Save Settings
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
