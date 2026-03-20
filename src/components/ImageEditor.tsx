import React, { useState, useCallback, useEffect } from 'react';
import Cropper, { Point, Area } from 'react-easy-crop';
import { X, Check, Sun, Contrast, Palette, RotateCcw, Scissors, Loader2, Undo2, Redo2, Droplets, Wind, Edit2, Type, Box } from 'lucide-react';
import PerspT from 'perspective-transform';

interface ImageEditorProps {
  imageUrl: string;
  aspectRatio: number;
  onSave: (editedImageUrl: string) => void;
  onClose: () => void;
  onRemoveBackground: (url: string) => Promise<string | null>;
}

interface EditorHistoryState {
  imageUrl: string;
  brightness: number;
  contrast: number;
  saturation: number;
  hue: number;
  filterName: string;
  zoom: number;
  rotation: number;
  aspect: number | undefined;
  overlayText: string;
  textPosition: string;
  textColor: string;
  fontSize: number;
  perspectivePoints: { x: number; y: number }[] | null;
}

const FILTERS = [
  { name: 'Original', filter: 'none' },
  { name: 'Vivid', filter: 'saturate(1.5) contrast(1.1)' },
  { name: 'Warm', filter: 'sepia(0.2) saturate(1.2) hue-rotate(-10deg)' },
  { name: 'Cool', filter: 'saturate(1.1) hue-rotate(10deg) brightness(1.1)' },
  { name: 'B&W', filter: 'grayscale(1)' },
  { name: 'Vintage', filter: 'sepia(0.5) contrast(0.9) brightness(1.1)' },
];

export const ImageEditor: React.FC<ImageEditorProps> = ({ imageUrl, aspectRatio, onSave, onClose, onRemoveBackground }) => {
  const [currentImageUrl, setCurrentImageUrl] = useState(imageUrl);
  const [crop, setCrop] = useState<Point>({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [aspect, setAspect] = useState<number | undefined>(aspectRatio);
  const [brightness, setBrightness] = useState(100);
  const [contrast, setContrast] = useState(100);
  const [saturation, setSaturation] = useState(100);
  const [hue, setHue] = useState(0);
  const [selectedFilter, setSelectedFilter] = useState(FILTERS[0]);
  const [croppedArea, setCroppedArea] = useState<Area | null>(null);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null);
  const [isRemovingBackground, setIsRemovingBackground] = useState(false);
  const [exportFormat, setExportFormat] = useState<'png' | 'jpg'>('png');
  const [jpgQuality, setJpgQuality] = useState(90);

  // Text Overlay State
  const [overlayText, setOverlayText] = useState('');
  const [textPosition, setTextPosition] = useState<'top' | 'middle' | 'bottom'>('bottom');
  const [textColor, setTextColor] = useState('#ffffff');
  const [fontSize, setFontSize] = useState(40);
  const [showTextControls, setShowTextControls] = useState(false);

  // Perspective State
  const [showPerspectiveControls, setShowPerspectiveControls] = useState(false);
  const [perspectivePoints, setPerspectivePoints] = useState<{ x: number; y: number }[] | null>(null);
  const [perspectiveBaseUrl, setPerspectiveBaseUrl] = useState<string | null>(null);

  // History state
  const [history, setHistory] = useState<EditorHistoryState[]>([]);
  const [redoStack, setRedoStack] = useState<EditorHistoryState[]>([]);

  const getCurrentState = (): EditorHistoryState => ({
    imageUrl: currentImageUrl,
    brightness,
    contrast,
    saturation,
    hue,
    filterName: selectedFilter.name,
    zoom,
    rotation,
    aspect,
    overlayText,
    textPosition,
    textColor,
    fontSize,
    perspectivePoints,
  });

  const pushToHistory = () => {
    const currentState = getCurrentState();
    setHistory(prev => [...prev, currentState]);
    setRedoStack([]); // Clear redo stack on new action
  };

  const undo = () => {
    if (history.length === 0) return;

    const currentState = getCurrentState();
    const previousState = history[history.length - 1];
    
    setRedoStack(prev => [...prev, currentState]);
    setHistory(prev => prev.slice(0, -1));

    applyState(previousState);
  };

  const redo = () => {
    if (redoStack.length === 0) return;

    const currentState = getCurrentState();
    const nextState = redoStack[redoStack.length - 1];

    setHistory(prev => [...prev, currentState]);
    setRedoStack(prev => prev.slice(0, -1));

    applyState(nextState);
  };

  const applyState = (state: EditorHistoryState) => {
    setCurrentImageUrl(state.imageUrl);
    setBrightness(state.brightness);
    setContrast(state.contrast);
    setSaturation(state.saturation);
    setHue(state.hue);
    setZoom(state.zoom);
    setRotation(state.rotation);
    setAspect(state.aspect);
    setOverlayText(state.overlayText);
    setTextPosition(state.textPosition as any);
    setTextColor(state.textColor);
    setFontSize(state.fontSize);
    setPerspectivePoints(state.perspectivePoints);
    const filter = FILTERS.find(f => f.name === state.filterName) || FILTERS[0];
    setSelectedFilter(filter);
  };

  const onCropComplete = useCallback((croppedArea: Area, croppedAreaPixels: Area) => {
    setCroppedArea(croppedArea);
    setCroppedAreaPixels(croppedAreaPixels);
  }, []);

  const createImage = (url: string): Promise<HTMLImageElement> =>
    new Promise((resolve, reject) => {
      const image = new Image();
      image.addEventListener('load', () => resolve(image));
      image.addEventListener('error', (error) => reject(error));
      image.setAttribute('crossOrigin', 'anonymous');
      image.src = url;
    });

  const getEditedImage = async () => {
    if (!croppedAreaPixels) return null;

    const image = await createImage(currentImageUrl);
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    const rotRad = (rotation * Math.PI) / 180;
    const { width: bWidth, height: bHeight } = {
      width: Math.abs(Math.cos(rotRad) * image.width) + Math.abs(Math.sin(rotRad) * image.height),
      height: Math.abs(Math.sin(rotRad) * image.width) + Math.abs(Math.cos(rotRad) * image.height),
    };

    canvas.width = bWidth;
    canvas.height = bHeight;
    ctx.translate(bWidth / 2, bHeight / 2);
    ctx.rotate(rotRad);
    ctx.translate(-image.width / 2, -image.height / 2);
    ctx.drawImage(image, 0, 0);

    const croppedCanvas = document.createElement('canvas');
    const croppedCtx = croppedCanvas.getContext('2d');
    if (!croppedCtx) return null;

    croppedCanvas.width = croppedAreaPixels.width;
    croppedCanvas.height = croppedAreaPixels.height;
    croppedCtx.filter = `brightness(${brightness}%) contrast(${contrast}%) saturate(${saturation}%) hue-rotate(${hue}deg) ${selectedFilter.filter}`;
    croppedCtx.drawImage(
      canvas,
      croppedAreaPixels.x,
      croppedAreaPixels.y,
      croppedAreaPixels.width,
      croppedAreaPixels.height,
      0,
      0,
      croppedAreaPixels.width,
      croppedAreaPixels.height
    );

    if (overlayText) {
      croppedCtx.filter = 'none';
      croppedCtx.fillStyle = textColor;
      croppedCtx.font = `bold ${fontSize}px Inter, sans-serif`;
      croppedCtx.textAlign = 'center';
      croppedCtx.textBaseline = 'middle';
      croppedCtx.shadowColor = 'rgba(0, 0, 0, 0.5)';
      croppedCtx.shadowBlur = 10;
      croppedCtx.shadowOffsetX = 2;
      croppedCtx.shadowOffsetY = 2;

      const x = croppedCanvas.width / 2;
      let y = croppedCanvas.height / 2;
      if (textPosition === 'top') y = croppedCanvas.height * 0.10;
      if (textPosition === 'bottom') y = croppedCanvas.height * 0.90;

      const lines = overlayText.split('\n');
      const lineHeight = fontSize * 1.2;
      const totalHeight = lines.length * lineHeight;
      const startY = y - (totalHeight / 2) + (lineHeight / 2);

      lines.forEach((line, i) => {
        croppedCtx.fillText(line, x, startY + (i * lineHeight));
      });
    }

    return croppedCanvas.toDataURL('image/png');
  };

  const handleApplyPerspective = async () => {
    if (!perspectivePoints || !perspectiveBaseUrl) return;

    const image = await createImage(perspectiveBaseUrl);
    const canvas = document.createElement('canvas');
    canvas.width = image.width;
    canvas.height = image.height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const src = [0, 0, image.width, 0, image.width, image.height, 0, image.height];
    const dst = [
      perspectivePoints[0].x * image.width, perspectivePoints[0].y * image.height,
      perspectivePoints[1].x * image.width, perspectivePoints[1].y * image.height,
      perspectivePoints[2].x * image.width, perspectivePoints[2].y * image.height,
      perspectivePoints[3].x * image.width, perspectivePoints[3].y * image.height,
    ];

    try {
      const perspT = PerspT(src, dst);
      const inverse = perspT.inverse();
      ctx.drawImage(image, 0, 0);
      const srcData = ctx.getImageData(0, 0, image.width, image.height);
      
      const destCanvas = document.createElement('canvas');
      destCanvas.width = image.width;
      destCanvas.height = image.height;
      const destCtx = destCanvas.getContext('2d');
      if (!destCtx) return;
      const destData = destCtx.createImageData(image.width, image.height);
      
      const srcPixels = srcData.data;
      const destPixels = destData.data;
      const w = image.width;
      const h = image.height;

      for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
          const [sx, sy] = inverse.transform(x, y);
          if (sx >= 0 && sx < w && sy >= 0 && sy < h) {
            const ix = Math.floor(sx);
            const iy = Math.floor(sy);
            const dIdx = (y * w + x) * 4;
            const sIdx = (iy * w + ix) * 4;
            destPixels[dIdx] = srcPixels[sIdx];
            destPixels[dIdx + 1] = srcPixels[sIdx + 1];
            destPixels[dIdx + 2] = srcPixels[sIdx + 2];
            destPixels[dIdx + 3] = srcPixels[sIdx + 3];
          }
        }
      }
      destCtx.putImageData(destData, 0, 0);
      
      pushToHistory();
      setCurrentImageUrl(destCanvas.toDataURL('image/png'));
      // Reset other adjustments since they are now baked in
      setBrightness(100);
      setContrast(100);
      setSaturation(100);
      setHue(0);
      setSelectedFilter(FILTERS[0]);
      setRotation(0);
      setZoom(1);
      setOverlayText('');
      
      setPerspectiveBaseUrl(null);
      setPerspectivePoints(null);
      setShowPerspectiveControls(false);
    } catch (err) {
      console.error('Perspective transform failed:', err);
    }
  };

  const handleSave = async () => {
    if (!croppedAreaPixels) return;

    try {
      const image = await createImage(currentImageUrl);
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');

      if (!ctx) return;

      const rotRad = (rotation * Math.PI) / 180;
      
      // Calculate bounding box of the rotated image
      const { width: bWidth, height: bHeight } = {
        width: Math.abs(Math.cos(rotRad) * image.width) + Math.abs(Math.sin(rotRad) * image.height),
        height: Math.abs(Math.sin(rotRad) * image.width) + Math.abs(Math.cos(rotRad) * image.height),
      };

      canvas.width = bWidth;
      canvas.height = bHeight;

      ctx.translate(bWidth / 2, bHeight / 2);
      ctx.rotate(rotRad);
      ctx.translate(-image.width / 2, -image.height / 2);
      ctx.drawImage(image, 0, 0);

      const croppedCanvas = document.createElement('canvas');
      const croppedCtx = croppedCanvas.getContext('2d');

      if (!croppedCtx) return;

      croppedCanvas.width = croppedAreaPixels.width;
      croppedCanvas.height = croppedAreaPixels.height;

      // Apply adjustments and filters to the cropped canvas
      croppedCtx.filter = `brightness(${brightness}%) contrast(${contrast}%) saturate(${saturation}%) hue-rotate(${hue}deg) ${selectedFilter.filter}`;

      croppedCtx.drawImage(
        canvas,
        croppedAreaPixels.x,
        croppedAreaPixels.y,
        croppedAreaPixels.width,
        croppedAreaPixels.height,
        0,
        0,
        croppedAreaPixels.width,
        croppedAreaPixels.height
      );

      // Draw Text Overlay
      if (overlayText) {
        croppedCtx.filter = 'none'; // Reset filter for text
        croppedCtx.fillStyle = textColor;
        croppedCtx.font = `bold ${fontSize}px Inter, sans-serif`;
        croppedCtx.textAlign = 'center';
        croppedCtx.textBaseline = 'middle';
        
        // Add text shadow for better legibility
        croppedCtx.shadowColor = 'rgba(0, 0, 0, 0.5)';
        croppedCtx.shadowBlur = 10;
        croppedCtx.shadowOffsetX = 2;
        croppedCtx.shadowOffsetY = 2;

        const x = croppedCanvas.width / 2;
        let y = croppedCanvas.height / 2;
        if (textPosition === 'top') y = croppedCanvas.height * 0.10;
        if (textPosition === 'bottom') y = croppedCanvas.height * 0.90;

        // Handle multi-line text
        const lines = overlayText.split('\n');
        const lineHeight = fontSize * 1.2;
        const totalHeight = lines.length * lineHeight;
        const startY = y - (totalHeight / 2) + (lineHeight / 2);

        lines.forEach((line, i) => {
          croppedCtx.fillText(line, x, startY + (i * lineHeight));
        });
      }

      const editedUrl = croppedCanvas.toDataURL(
        exportFormat === 'png' ? 'image/png' : 'image/jpeg',
        exportFormat === 'jpg' ? jpgQuality / 100 : undefined
      );
      onSave(editedUrl);
    } catch (e) {
      console.error('Error saving edited image:', e);
    }
  };

  const handleRemoveBackground = async () => {
    pushToHistory();
    setIsRemovingBackground(true);
    try {
      const result = await onRemoveBackground(currentImageUrl);
      if (result) {
        setCurrentImageUrl(result);
      }
    } catch (e) {
      console.error('Failed to remove background:', e);
    } finally {
      setIsRemovingBackground(false);
    }
  };

  const reset = () => {
    pushToHistory();
    setBrightness(100);
    setContrast(100);
    setSaturation(100);
    setHue(0);
    setSelectedFilter(FILTERS[0]);
    setZoom(1);
    setRotation(0);
    setAspect(aspectRatio);
    setOverlayText('');
    setTextPosition('bottom');
    setTextColor('#ffffff');
    setFontSize(40);
    setPerspectivePoints(null);
  };

  const getPerspectiveStyle = () => {
    if (!perspectivePoints) return {};
    
    // Source points (corners of the container)
    const src = [0, 0, 100, 0, 100, 100, 0, 100];
    // Destination points (the handles)
    const dst = [
      perspectivePoints[0].x * 100, perspectivePoints[0].y * 100,
      perspectivePoints[1].x * 100, perspectivePoints[1].y * 100,
      perspectivePoints[2].x * 100, perspectivePoints[2].y * 100,
      perspectivePoints[3].x * 100, perspectivePoints[3].y * 100,
    ];

    try {
      const perspT = PerspT(src, dst);
      const m = perspT.coeffs;
      // Homography 3x3 to CSS matrix3d 4x4
      // m = [a, b, c, d, e, f, g, h] where i=1
      // matrix3d(a, d, 0, g, b, e, 0, h, 0, 0, 1, 0, c, f, 0, 1)
      const matrix3d = `matrix3d(${m[0]}, ${m[3]}, 0, ${m[6]}, ${m[1]}, ${m[4]}, 0, ${m[7]}, 0, 0, 1, 0, ${m[2]}, ${m[5]}, 0, 1)`;
      return { transform: matrix3d, transformOrigin: '0 0' };
    } catch (e) {
      return {};
    }
  };

  return (
    <div className="fixed inset-0 z-[110] bg-black/95 backdrop-blur-md flex flex-col md:flex-row overflow-hidden">
      {/* Header (Mobile) */}
      <div className="md:hidden flex items-center justify-between p-4 border-b border-zinc-800">
        <div className="flex items-center gap-2">
          <button onClick={onClose} className="text-zinc-400 hover:text-white" disabled={showPerspectiveControls}>
            <X className="w-6 h-6" />
          </button>
          <div className="flex gap-1">
            <button 
              onClick={undo} 
              disabled={history.length === 0 || showPerspectiveControls}
              className="p-2 text-zinc-400 hover:text-white transition-colors disabled:opacity-20"
            >
              <Undo2 className="w-5 h-5" />
            </button>
            <button 
              onClick={redo} 
              disabled={redoStack.length === 0 || showPerspectiveControls}
              className="p-2 text-zinc-400 hover:text-white transition-colors disabled:opacity-20"
            >
              <Redo2 className="w-5 h-5" />
            </button>
          </div>
        </div>
        <h2 className="text-xs font-bold uppercase tracking-widest">Edit Shot</h2>
        <button 
          onClick={handleSave} 
          disabled={showPerspectiveControls}
          className="text-white bg-emerald-600 px-4 py-1 rounded-full text-xs font-bold disabled:opacity-50"
        >
          Save
        </button>
      </div>

      {/* Main Cropper Area */}
      <div className="relative flex-1 bg-zinc-950">
        {!showPerspectiveControls ? (
          <>
            <Cropper
              image={currentImageUrl}
              crop={crop}
              zoom={zoom}
              rotation={rotation}
              aspect={aspect}
              onCropChange={setCrop}
              onRotationChange={setRotation}
              onCropComplete={onCropComplete}
              onZoomChange={setZoom}
              style={{
                containerStyle: {
                  filter: `brightness(${brightness}%) contrast(${contrast}%) saturate(${saturation}%) hue-rotate(${hue}deg) ${selectedFilter.filter}`,
                },
              }}
            />
            
            {/* Text Overlay Preview */}
            {overlayText && croppedArea && (
              <div 
                className="absolute pointer-events-none flex flex-col items-center justify-center text-center overflow-hidden"
                style={{
                  left: `${croppedArea.x}%`,
                  top: `${croppedArea.y}%`,
                  width: `${croppedArea.width}%`,
                  height: `${croppedArea.height}%`,
                  zIndex: 5,
                }}
              >
                <div 
                  className="w-full px-4"
                  style={{
                    color: textColor,
                    fontSize: `${Math.max(12, fontSize * (croppedArea.width / 100) * 0.5)}px`,
                    fontWeight: 'bold',
                    textShadow: '2px 2px 4px rgba(0,0,0,0.8)',
                    position: 'absolute',
                    ...(textPosition === 'top' ? { top: '10%' } : 
                       textPosition === 'bottom' ? { bottom: '10%' } : 
                       { top: '50%', transform: 'translateY(-50%)' })
                  }}
                >
                  {overlayText.split('\n').map((line, i) => (
                    <div key={i}>{line}</div>
                  ))}
                </div>
              </div>
            )}
            {isRemovingBackground && (
              <div className="absolute inset-0 z-10 bg-black/60 backdrop-blur-sm flex flex-col items-center justify-center text-center p-6">
                <Loader2 className="w-10 h-10 text-white animate-spin mb-4" />
                <p className="text-sm font-bold uppercase tracking-widest">Isolating Dish...</p>
              </div>
            )}
          </>
        ) : (
          <div className="absolute inset-0 flex items-center justify-center p-8">
            <div className="relative max-w-full max-h-full shadow-2xl">
              {perspectiveBaseUrl && (
                <img 
                  src={perspectiveBaseUrl} 
                  alt="Perspective Base" 
                  className="max-w-full max-h-[70vh] object-contain"
                  style={getPerspectiveStyle()}
                />
              )}
              
              {/* Perspective Handles */}
              {perspectivePoints && (
                <div className="absolute inset-0 pointer-events-none">
                  <div className="relative w-full h-full">
                    {perspectivePoints.map((p, i) => (
                      <div
                        key={i}
                        className="absolute w-6 h-6 bg-white border-2 border-emerald-500 rounded-full cursor-move pointer-events-auto transform -translate-x-1/2 -translate-y-1/2 shadow-lg flex items-center justify-center z-30"
                        style={{ left: `${p.x * 100}%`, top: `${p.y * 100}%` }}
                        onMouseDown={(e) => {
                          const startX = e.clientX;
                          const startY = e.clientY;
                          const initialP = { ...p };
                          const container = e.currentTarget.parentElement;
                          if (!container) return;
                          const rect = container.getBoundingClientRect();

                          const onMouseMove = (moveE: MouseEvent) => {
                            const dx = (moveE.clientX - startX) / rect.width;
                            const dy = (moveE.clientY - startY) / rect.height;
                            const newPoints = [...perspectivePoints];
                            newPoints[i] = {
                              x: Math.max(0, Math.min(1, initialP.x + dx)),
                              y: Math.max(0, Math.min(1, initialP.y + dy)),
                            };
                            setPerspectivePoints(newPoints);
                          };

                          const onMouseUp = () => {
                            window.removeEventListener('mousemove', onMouseMove);
                            window.removeEventListener('mouseup', onMouseUp);
                          };

                          window.addEventListener('mousemove', onMouseMove);
                          window.addEventListener('mouseup', onMouseUp);
                        }}
                      />
                    ))}
                    <svg className="absolute inset-0 w-full h-full pointer-events-none overflow-visible">
                      <polygon
                        points={perspectivePoints.map(p => `${p.x * 100},${p.y * 100}`).join(' ')}
                        fill="rgba(16, 185, 129, 0.1)"
                        stroke="rgba(16, 185, 129, 0.5)"
                        strokeWidth="2"
                        strokeDasharray="4"
                      />
                    </svg>
                  </div>
                </div>
              )}
            </div>
            
            {/* Perspective Actions */}
            <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex gap-4">
              <button
                onClick={() => {
                  setShowPerspectiveControls(false);
                  setPerspectiveBaseUrl(null);
                  setPerspectivePoints(null);
                }}
                className="px-6 py-2 bg-zinc-900 text-white rounded-full text-xs font-bold uppercase tracking-widest border border-zinc-800 hover:bg-zinc-800 transition-all"
              >
                Cancel
              </button>
              <button
                onClick={handleApplyPerspective}
                className="px-6 py-2 bg-emerald-600 text-white rounded-full text-xs font-bold uppercase tracking-widest hover:bg-emerald-500 transition-all shadow-lg shadow-emerald-900/20"
              >
                Apply Transform
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Sidebar Controls */}
      <div className="w-full md:w-80 bg-zinc-900 border-l border-zinc-800 flex flex-col overflow-y-auto">
        <div className="hidden md:flex items-center justify-between p-6 border-b border-zinc-800">
          <h2 className="text-sm font-bold uppercase tracking-widest">Edit Shot</h2>
          <div className="flex gap-2">
            <button 
              onClick={undo} 
              disabled={history.length === 0 || showPerspectiveControls}
              className="p-2 text-zinc-400 hover:text-white transition-colors disabled:opacity-20"
              title="Undo"
            >
              <Undo2 className="w-5 h-5" />
            </button>
            <button 
              onClick={redo} 
              disabled={redoStack.length === 0 || showPerspectiveControls}
              className="p-2 text-zinc-400 hover:text-white transition-colors disabled:opacity-20"
              title="Redo"
            >
              <Redo2 className="w-5 h-5" />
            </button>
            <button 
              onClick={onClose} 
              disabled={showPerspectiveControls}
              className="p-2 text-zinc-400 hover:text-white transition-colors disabled:opacity-20"
            >
              <X className="w-5 h-5" />
            </button>
            <button 
              onClick={handleSave} 
              disabled={showPerspectiveControls}
              className="p-2 text-emerald-500 hover:text-emerald-400 transition-colors disabled:opacity-20"
            >
              <Check className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className={`p-6 space-y-8 transition-opacity ${showPerspectiveControls ? 'opacity-30 pointer-events-none' : ''}`}>
          {/* Crop Aspect Ratio */}
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <Scissors className="w-3 h-3 text-zinc-500" />
              <label className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest">Crop Aspect Ratio</label>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {[
                { label: 'Free', value: undefined },
                { label: '1:1', value: 1 },
                { label: '4:3', value: 4/3 },
                { label: '16:9', value: 16/9 },
                { label: '3:2', value: 3/2 },
                { label: 'Original', value: aspectRatio },
              ].map((ratio) => (
                <button
                  key={ratio.label}
                  onClick={() => {
                    pushToHistory();
                    setAspect(ratio.value);
                  }}
                  className={`py-2 rounded-lg text-[10px] font-bold transition-all border ${
                    aspect === ratio.value
                      ? 'bg-white text-black border-white'
                      : 'bg-zinc-950 text-zinc-400 border-zinc-800 hover:border-zinc-700'
                  }`}
                >
                  {ratio.label}
                </button>
              ))}
            </div>
          </div>

          {/* Zoom & Rotate */}
          <div className="space-y-6">
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <label className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest">Zoom</label>
                <span className="text-[10px] text-zinc-400">{Math.round(zoom * 100)}%</span>
              </div>
              <input
                type="range"
                min={1}
                max={3}
                step={0.1}
                value={zoom}
                onMouseDown={pushToHistory}
                onTouchStart={pushToHistory}
                onChange={(e) => setZoom(Number(e.target.value))}
                className="w-full h-1 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-white"
              />
            </div>

            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <label className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest">Rotation</label>
                <span className="text-[10px] text-zinc-400">{rotation}°</span>
              </div>
              <input
                type="range"
                min={0}
                max={360}
                step={1}
                value={rotation}
                onMouseDown={pushToHistory}
                onTouchStart={pushToHistory}
                onChange={(e) => setRotation(Number(e.target.value))}
                className="w-full h-1 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-white"
              />
            </div>
          </div>

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
              onMouseDown={pushToHistory}
              onTouchStart={pushToHistory}
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
              onMouseDown={pushToHistory}
              onTouchStart={pushToHistory}
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
              onMouseDown={pushToHistory}
              onTouchStart={pushToHistory}
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
              onMouseDown={pushToHistory}
              onTouchStart={pushToHistory}
              onChange={(e) => setHue(Number(e.target.value))}
              className="w-full h-1 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-white"
            />
          </div>

          {/* AI Tools */}
          <div className="space-y-4">
            <label className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest">AI Studio Tools</label>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={handleRemoveBackground}
                disabled={isRemovingBackground}
                className="py-3 bg-zinc-950 border border-zinc-800 rounded-xl text-[10px] font-bold text-white hover:border-zinc-600 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {isRemovingBackground ? (
                  <Loader2 className="w-3 h-3 animate-spin" />
                ) : (
                  <Scissors className="w-3 h-3" />
                )}
                Remove BG
              </button>
              <button
                onClick={() => setShowTextControls(!showTextControls)}
                className={`py-3 border rounded-xl text-[10px] font-bold transition-all flex items-center justify-center gap-2 ${
                  showTextControls ? 'bg-white text-black border-white' : 'bg-zinc-950 text-zinc-400 border-zinc-800 hover:border-zinc-700'
                }`}
              >
                <Type className="w-3 h-3" />
                Text Overlay
              </button>
              <div className="flex flex-col gap-2">
                <button
                  onClick={async () => {
                    if (!showPerspectiveControls) {
                      const baked = await getEditedImage();
                      if (baked) {
                        setPerspectiveBaseUrl(baked);
                        setPerspectivePoints([
                          { x: 0.1, y: 0.1 },
                          { x: 0.9, y: 0.1 },
                          { x: 0.9, y: 0.9 },
                          { x: 0.1, y: 0.9 },
                        ]);
                        setShowPerspectiveControls(true);
                      }
                    } else {
                      setShowPerspectiveControls(false);
                      setPerspectiveBaseUrl(null);
                      setPerspectivePoints(null);
                    }
                  }}
                  className={`py-3 border rounded-xl text-[10px] font-bold transition-all flex items-center justify-center gap-2 ${
                    showPerspectiveControls ? 'bg-white text-black border-white' : 'bg-zinc-950 text-zinc-400 border-zinc-800 hover:border-zinc-700'
                  }`}
                >
                  <Box className="w-3 h-3" />
                  Perspective
                </button>
                {showPerspectiveControls && (
                  <button
                    onClick={() => {
                      setPerspectivePoints([
                        { x: 0.1, y: 0.1 },
                        { x: 0.9, y: 0.1 },
                        { x: 0.9, y: 0.9 },
                        { x: 0.1, y: 0.9 },
                      ]);
                    }}
                    className="py-2 bg-zinc-900 border border-zinc-800 rounded-lg text-[9px] font-bold text-zinc-400 hover:text-white uppercase tracking-widest transition-all"
                  >
                    Reset Perspective
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Text Controls */}
          {showTextControls && (
            <div className="space-y-6 p-4 bg-zinc-950 rounded-2xl border border-zinc-800">
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <label className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest">Text Content</label>
                  <button 
                    onClick={() => {
                      pushToHistory();
                      setOverlayText('');
                    }}
                    className="text-[9px] text-zinc-500 hover:text-white uppercase font-bold"
                  >
                    Clear
                  </button>
                </div>
                <textarea
                  value={overlayText}
                  onChange={(e) => {
                    pushToHistory();
                    setOverlayText(e.target.value);
                  }}
                  placeholder="Enter text..."
                  className="w-full bg-zinc-900 border border-zinc-800 rounded-lg p-2 text-xs text-white focus:outline-none focus:border-zinc-600 min-h-[60px]"
                />
              </div>

              <div className="space-y-2">
                <label className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest">Position</label>
                <div className="grid grid-cols-3 gap-1">
                  {(['top', 'middle', 'bottom'] as const).map(pos => (
                    <button
                      key={pos}
                      onClick={() => {
                        pushToHistory();
                        setTextPosition(pos);
                      }}
                      className={`py-1.5 rounded-md text-[9px] font-bold uppercase transition-all border ${
                        textPosition === pos ? 'bg-white text-black border-white' : 'bg-zinc-900 text-zinc-500 border-zinc-800'
                      }`}
                    >
                      {pos}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest">Size</label>
                  <input
                    type="number"
                    value={fontSize}
                    onChange={(e) => {
                      pushToHistory();
                      setFontSize(Number(e.target.value));
                    }}
                    className="w-full bg-zinc-900 border border-zinc-800 rounded-lg p-2 text-xs text-white focus:outline-none"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest">Color</label>
                  <input
                    type="color"
                    value={textColor}
                    onChange={(e) => {
                      pushToHistory();
                      setTextColor(e.target.value);
                    }}
                    className="w-full h-8 bg-zinc-900 border border-zinc-800 rounded-lg cursor-pointer"
                  />
                </div>
              </div>
            </div>
          )}

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
                  onClick={() => {
                    pushToHistory();
                    setSelectedFilter(f);
                  }}
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
            className="w-full py-4 bg-white text-black rounded-2xl text-sm font-bold hover:bg-zinc-200 transition-all"
          >
            Apply Changes
          </button>
        </div>
      </div>
    </div>
  );
};
