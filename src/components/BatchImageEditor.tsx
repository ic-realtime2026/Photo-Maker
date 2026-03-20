import React, { useState } from 'react';
import { X, Check, Sun, Contrast, Palette, RotateCcw, Loader2, Droplets, Wind } from 'lucide-react';

interface BatchImageEditorProps {
  images: { name: string; url: string }[];
  onSave: (results: Record<string, string>) => void;
  onClose: () => void;
}

const FILTERS = [
  { name: 'Original', filter: 'none' },
  { name: 'Vivid', filter: 'saturate(1.5) contrast(1.1)' },
  { name: 'Warm', filter: 'sepia(0.2) saturate(1.2) hue-rotate(-10deg)' },
  { name: 'Cool', filter: 'saturate(1.1) hue-rotate(10deg) brightness(1.1)' },
  { name: 'B&W', filter: 'grayscale(1)' },
  { name: 'Vintage', filter: 'sepia(0.5) contrast(0.9) brightness(1.1)' },
];

export const BatchImageEditor: React.FC<BatchImageEditorProps> = ({ images, onSave, onClose }) => {
  const [brightness, setBrightness] = useState(100);
  const [contrast, setContrast] = useState(100);
  const [saturation, setSaturation] = useState(100);
  const [hue, setHue] = useState(0);
  const [selectedFilter, setSelectedFilter] = useState(FILTERS[0]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [exportFormat, setExportFormat] = useState<'png' | 'jpg'>('png');
  const [jpgQuality, setJpgQuality] = useState(90);

  const createImage = (url: string): Promise<HTMLImageElement> =>
    new Promise((resolve, reject) => {
      const image = new Image();
      image.addEventListener('load', () => resolve(image));
      image.addEventListener('error', (error) => reject(error));
      image.setAttribute('crossOrigin', 'anonymous');
      image.src = url;
    });

  const handleSave = async () => {
    setIsProcessing(true);
    try {
      const results: Record<string, string> = {};
      
      for (const imgData of images) {
        const image = await createImage(imgData.url);
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');

        if (!ctx) continue;

        canvas.width = image.width;
        canvas.height = image.height;

        // Apply adjustments and filters
        ctx.filter = `brightness(${brightness}%) contrast(${contrast}%) saturate(${saturation}%) hue-rotate(${hue}deg) ${selectedFilter.filter}`;
        ctx.drawImage(image, 0, 0);

        results[imgData.name] = canvas.toDataURL(
          exportFormat === 'png' ? 'image/png' : 'image/jpeg',
          exportFormat === 'jpg' ? jpgQuality / 100 : undefined
        );
      }
      
      onSave(results);
    } catch (e) {
      console.error('Error batch editing images:', e);
    } finally {
      setIsProcessing(false);
    }
  };

  const reset = () => {
    setBrightness(100);
    setContrast(100);
    setSaturation(100);
    setHue(0);
    setSelectedFilter(FILTERS[0]);
  };

  return (
    <div className="fixed inset-0 z-[110] bg-black/95 backdrop-blur-md flex flex-col md:flex-row overflow-hidden">
      {/* Header (Mobile) */}
      <div className="md:hidden flex items-center justify-between p-4 border-b border-zinc-800">
        <button onClick={onClose} className="text-zinc-400 hover:text-white">
          <X className="w-6 h-6" />
        </button>
        <h2 className="text-sm font-bold uppercase tracking-widest">Batch Edit ({images.length})</h2>
        <button onClick={handleSave} className="text-white bg-emerald-600 px-4 py-1 rounded-full text-xs font-bold">
          Save All
        </button>
      </div>

      {/* Main Preview Area */}
      <div className="flex-1 bg-zinc-950 overflow-y-auto p-8">
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
          {images.map((img) => (
            <div key={img.name} className="relative aspect-square rounded-xl overflow-hidden border border-zinc-800">
              <img
                src={img.url}
                alt={img.name}
                className="w-full h-full object-cover"
                style={{
                  filter: `brightness(${brightness}%) contrast(${contrast}%) saturate(${saturation}%) hue-rotate(${hue}deg) ${selectedFilter.filter}`,
                }}
              />
              <div className="absolute bottom-0 left-0 right-0 p-2 bg-black/60 backdrop-blur-sm">
                <p className="text-[10px] text-white font-bold truncate">{img.name}</p>
              </div>
            </div>
          ))}
        </div>
        {isProcessing && (
          <div className="absolute inset-0 z-10 bg-black/60 backdrop-blur-sm flex flex-col items-center justify-center text-center p-6">
            <Loader2 className="w-10 h-10 text-white animate-spin mb-4" />
            <p className="text-sm font-bold uppercase tracking-widest">Processing {images.length} Images...</p>
          </div>
        )}
      </div>

      {/* Sidebar Controls */}
      <div className="w-full md:w-80 bg-zinc-900 border-l border-zinc-800 flex flex-col overflow-y-auto">
        <div className="hidden md:flex items-center justify-between p-6 border-b border-zinc-800">
          <h2 className="text-sm font-bold uppercase tracking-widest">Batch Adjust</h2>
          <div className="flex gap-2">
            <button onClick={onClose} className="p-2 text-zinc-400 hover:text-white transition-colors">
              <X className="w-5 h-5" />
            </button>
            <button onClick={handleSave} className="p-2 text-emerald-500 hover:text-emerald-400 transition-colors">
              <Check className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="p-6 space-y-8">
          <p className="text-[10px] text-zinc-500 leading-relaxed italic">
            Adjustments will be applied to all {images.length} selected images simultaneously.
          </p>

          {/* Brightness */}
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-2">
                <Sun className="w-3 h-3 text-zinc-500" />
                <label className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest">Brightness</label>
              </div>
              <span className="text-[10px] text-zinc-400">{brightness}%</span>
            </div>
            <input
              type="range"
              min={50}
              max={150}
              value={brightness}
              onChange={(e) => setBrightness(Number(e.target.value))}
              className="w-full h-1 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-white"
            />
          </div>

          {/* Contrast */}
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-2">
                <Contrast className="w-3 h-3 text-zinc-500" />
                <label className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest">Contrast</label>
              </div>
              <span className="text-[10px] text-zinc-400">{contrast}%</span>
            </div>
            <input
              type="range"
              min={50}
              max={150}
              value={contrast}
              onChange={(e) => setContrast(Number(e.target.value))}
              className="w-full h-1 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-white"
            />
          </div>

          {/* Saturation */}
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-2">
                <Droplets className="w-3 h-3 text-zinc-500" />
                <label className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest">Saturation</label>
              </div>
              <span className="text-[10px] text-zinc-400">{saturation}%</span>
            </div>
            <input
              type="range"
              min={0}
              max={200}
              value={saturation}
              onChange={(e) => setSaturation(Number(e.target.value))}
              className="w-full h-1 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-white"
            />
          </div>

          {/* Hue */}
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-2">
                <Wind className="w-3 h-3 text-zinc-500" />
                <label className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest">Hue</label>
              </div>
              <span className="text-[10px] text-zinc-400">{hue}°</span>
            </div>
            <input
              type="range"
              min={-180}
              max={180}
              value={hue}
              onChange={(e) => setHue(Number(e.target.value))}
              className="w-full h-1 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-white"
            />
          </div>

          {/* Filters */}
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <Palette className="w-3 h-3 text-zinc-500" />
              <label className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest">Filters</label>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {FILTERS.map((f) => (
                <button
                  key={f.name}
                  onClick={() => setSelectedFilter(f)}
                  className={`py-2 rounded-lg text-[10px] font-bold transition-all border ${
                    selectedFilter.name === f.name
                      ? 'bg-white text-black border-white'
                      : 'bg-zinc-950 text-zinc-400 border-zinc-800 hover:border-zinc-700'
                  }`}
                >
                  {f.name}
                </button>
              ))}
            </div>
          </div>

          <button
            onClick={reset}
            className="w-full py-3 border border-zinc-800 rounded-xl text-xs font-bold text-zinc-400 hover:text-white hover:border-zinc-700 transition-all flex items-center justify-center gap-2"
          >
            <RotateCcw className="w-3 h-3" />
            Reset Adjustments
          </button>

          {/* Export Settings */}
          <div className="space-y-6 pt-6 border-t border-zinc-800">
            <div className="space-y-4">
              <label className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest">Export Format</label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => setExportFormat('png')}
                  className={`py-2 rounded-lg text-[10px] font-bold transition-all border ${
                    exportFormat === 'png'
                      ? 'bg-white text-black border-white'
                      : 'bg-zinc-950 text-zinc-400 border-zinc-800 hover:border-zinc-700'
                  }`}
                >
                  PNG (Lossless)
                </button>
                <button
                  onClick={() => setExportFormat('jpg')}
                  className={`py-2 rounded-lg text-[10px] font-bold transition-all border ${
                    exportFormat === 'jpg'
                      ? 'bg-white text-black border-white'
                      : 'bg-zinc-950 text-zinc-400 border-zinc-800 hover:border-zinc-700'
                  }`}
                >
                  JPG (Compressed)
                </button>
              </div>
            </div>

            {exportFormat === 'jpg' && (
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <label className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest">JPG Quality</label>
                  <span className="text-[10px] text-zinc-400">{jpgQuality}%</span>
                </div>
                <input
                  type="range"
                  min={1}
                  max={100}
                  value={jpgQuality}
                  onChange={(e) => setJpgQuality(Number(e.target.value))}
                  className="w-full h-1 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-white"
                />
              </div>
            )}
          </div>
        </div>

        <div className="mt-auto p-6 border-t border-zinc-800">
          <button
            onClick={handleSave}
            disabled={isProcessing}
            className="w-full py-4 bg-white text-black rounded-2xl text-sm font-bold hover:bg-zinc-200 transition-all disabled:opacity-50"
          >
            {isProcessing ? 'Processing...' : `Apply to ${images.length} Images`}
          </button>
        </div>
      </div>
    </div>
  );
};
