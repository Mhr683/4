import React, { useState, useRef, useEffect } from 'react';
import { 
  X, 
  Upload, 
  Download, 
  FileText, 
  CheckCircle2, 
  AlertCircle, 
  Table, 
  Plus, 
  Sparkles,
  Info,
  Camera,
  Video,
  ShieldCheck,
  Check,
  RefreshCw,
  Loader2,
  Zap,
  Eye
} from 'lucide-react';
import { Product, CurrencyCode } from '../types/dropship';
import { SUPPLIERS } from '../data/mockProducts';
import { pkrToUsd, formatPKR } from '../utils/currency';
import { 
  getAiPhotosForProduct, 
  AI_STUDIO_GENERATED_PHOTOS, 
  generateAiStudioShotForProduct 
} from '../utils/aiMediaGenerator';

interface CsvProductManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
  products: Product[];
  currency: CurrencyCode;
  onBulkImport: (newProducts: Product[]) => void;
  onOpenAiStudioForProduct?: (product: Product) => void;
}

interface ParsedCsvRow {
  title: string;
  category: string;
  wholesalePricePKR: number;
  customerPricePKR: number;
  profitPKR: number;
  stock: number;
  image: string;
  isAiGeneratedPhoto: boolean;
  isEnrichedByAiService?: boolean;
  isValidatingImage?: boolean;
  aiAngleName?: string;
  originalRawImage?: string;
  description: string;
  variants: string;
  isValid: boolean;
  errorMessage?: string;
}

export const CsvProductManagerModal: React.FC<CsvProductManagerModalProps> = ({
  isOpen,
  onClose,
  products,
  currency,
  onBulkImport,
  onOpenAiStudioForProduct,
}) => {
  if (!isOpen) return null;

  const [csvText, setCsvText] = useState('');
  const [parsedRows, setParsedRows] = useState<ParsedCsvRow[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [activeTab, setActiveTab] = useState<'upload' | 'preview'>('upload');
  const [aiGenerateAllSuccess, setAiGenerateAllSuccess] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Background Media Validation & AI Studio Generation State
  const [isValidatingBackground, setIsValidatingBackground] = useState<boolean>(false);
  const [validationStats, setValidationStats] = useState<{
    totalScanned: number;
    missingDetected: number;
    generatedCount: number;
    lastCompletedAt?: string;
  }>({
    totalScanned: 0,
    missingDetected: 0,
    generatedCount: 0,
  });

  const sampleCsvData = `title,category,wholesalePricePKR,customerPricePKR,stock,image,description,variants
"Wireless Bluetooth Neckband Pro","Electronics",1100,1300,50,"","Deep bass magnetic earphones with 30H battery (No supplier photo - Auto AI Generated)","Black, Blue"
"LED Crystal Touch Table Lamp","Home & Living",1400,1600,35,"","Diamond ambient crystal night lamp with 3 light modes","Warm Yellow, White, Dual"
"Heavy Grip Metal Hand Exerciser","Fitness & Gadgets",650,850,80,"","Non-slip aluminum hand gripper for forearm strength","100 LB, 150 LB, 200 LB"
"Portable Mini USB Fruit Blender","Home & Living",1800,2000,45,"","Rechargeable smoothie maker with 6 stainless steel blades","Pink, Green, White"`;

  /**
   * Background Media Validation Function
   * Detects if a product in the CSV lacks an image URL.
   * If detected, automatically triggers the AI Media Studio image generation service
   * for that specific product entry to create a high-quality, copyright-free studio shot.
   */
  const triggerBackgroundMediaValidation = async (targetRows: ParsedCsvRow[]) => {
    if (!targetRows || targetRows.length === 0) return;

    // Detect entries that lack a valid image URL (empty string, empty quotes, null, or non-URI)
    const missingIndices: number[] = [];
    targetRows.forEach((row, idx) => {
      const lacksImage = 
        !row.image || 
        row.image.trim() === '' || 
        row.image === '""' || 
        row.image === 'null' ||
        row.image === 'undefined' ||
        row.isAiGeneratedPhoto && !row.isEnrichedByAiService ||
        (!row.image.startsWith('http://') && 
         !row.image.startsWith('https://') && 
         !row.image.startsWith('/src') && 
         !row.image.startsWith('data:image'));

      if (lacksImage) {
        missingIndices.push(idx);
      }
    });

    if (missingIndices.length === 0) {
      setValidationStats({
        totalScanned: targetRows.length,
        missingDetected: 0,
        generatedCount: 0,
        lastCompletedAt: new Date().toLocaleTimeString(),
      });
      return;
    }

    setIsValidatingBackground(true);
    setValidationStats({
      totalScanned: targetRows.length,
      missingDetected: missingIndices.length,
      generatedCount: 0,
    });

    // Mark missing product entries as currently generating in background
    setParsedRows((prev) =>
      prev.map((r, i) =>
        missingIndices.includes(i) ? { ...r, isValidatingImage: true } : r
      )
    );

    let completedCount = 0;

    // Process each missing product entry through AI Media Studio image generation service
    for (const idx of missingIndices) {
      const entry = targetRows[idx];
      if (!entry) continue;

      try {
        // Automatically trigger AI Media Studio image generation service for this specific product entry
        const studioResult = await generateAiStudioShotForProduct(
          entry.title,
          entry.category,
          'studio-white'
        );

        completedCount++;

        // Update the specific product entry with the generated high-quality, copyright-free studio shot
        setParsedRows((prev) => {
          const updated = [...prev];
          if (updated[idx]) {
            updated[idx] = {
              ...updated[idx],
              image: studioResult.url,
              isAiGeneratedPhoto: true,
              isEnrichedByAiService: true,
              isValidatingImage: false,
              aiAngleName: studioResult.angleName,
            };
          }
          return updated;
        });

        setValidationStats((prev) => ({
          ...prev,
          generatedCount: completedCount,
        }));
      } catch (err) {
        console.error('AI Media Studio image generation failed for entry:', entry.title, err);
        setParsedRows((prev) => {
          const updated = [...prev];
          if (updated[idx]) {
            updated[idx] = { ...updated[idx], isValidatingImage: false };
          }
          return updated;
        });
      }
    }

    setIsValidatingBackground(false);
    setValidationStats((prev) => ({
      ...prev,
      lastCompletedAt: new Date().toLocaleTimeString(),
    }));
  };

/**
 * RFC 4180 compliant CSV tokenizer
 * Accurately parses multiline quoted fields (e.g. HTML product descriptions, quotes, commas)
 * without incorrectly breaking rows.
 */
function parseRFC4180Csv(text: string): string[][] {
  const records: string[][] = [];
  let currentRecord: string[] = [];
  let currentField = '';
  let inQuotes = false;
  let i = 0;
  const len = text.length;

  while (i < len) {
    const char = text[i];
    const nextChar = i + 1 < len ? text[i + 1] : '';

    if (inQuotes) {
      if (char === '"') {
        if (nextChar === '"') {
          currentField += '"';
          i += 2;
          continue;
        } else {
          inQuotes = false;
          i++;
          continue;
        }
      } else {
        currentField += char;
        i++;
        continue;
      }
    } else {
      if (char === '"') {
        inQuotes = true;
        i++;
        continue;
      } else if (char === ',') {
        currentRecord.push(currentField.trim());
        currentField = '';
        i++;
        continue;
      } else if (char === '\r') {
        if (nextChar === '\n') {
          i += 2;
        } else {
          i++;
        }
        currentRecord.push(currentField.trim());
        currentField = '';
        if (currentRecord.some((c) => c.length > 0)) {
          records.push(currentRecord);
        }
        currentRecord = [];
        continue;
      } else if (char === '\n') {
        i++;
        currentRecord.push(currentField.trim());
        currentField = '';
        if (currentRecord.some((c) => c.length > 0)) {
          records.push(currentRecord);
        }
        currentRecord = [];
        continue;
      } else {
        currentField += char;
        i++;
        continue;
      }
    }
  }

  if (currentField.length > 0 || currentRecord.length > 0) {
    currentRecord.push(currentField.trim());
    if (currentRecord.some((c) => c.length > 0)) {
      records.push(currentRecord);
    }
  }

  return records;
}

const parsePriceNumber = (val: string | undefined): number => {
  if (!val) return 0;
  const cleaned = val.replace(/[^0-9.]/g, '');
  const num = parseFloat(cleaned);
  return isNaN(num) ? 0 : num;
};

  const parseCsv = (text: string) => {
    if (!text || text.trim().length === 0) {
      alert('Please provide CSV data or upload a valid CSV file.');
      return;
    }

    const records = parseRFC4180Csv(text.trim());
    if (records.length < 2) {
      alert('CSV must contain a header row and at least 1 product row.');
      return;
    }

    const headerRow = records[0] || [];
    const normalizedHeaders = headerRow.map((h) => h.toLowerCase().replace(/[^a-z0-9]/g, ''));

    const findCol = (aliases: string[]): number => {
      for (const alias of aliases) {
        const idx = normalizedHeaders.findIndex((h) => h === alias || h.includes(alias));
        if (idx !== -1) return idx;
      }
      return -1;
    };

    // Smart Column Header Mapping (Supports Shopify, WooCommerce, Daraz, & Supplier formats)
    let titleIdx = findCol(['title', 'productname', 'itemname', 'producttitle', 'name', 'item']);
    if (titleIdx === -1) {
      titleIdx = findCol(['handle']);
    }
    let categoryIdx = findCol(['category', 'type', 'producttype', 'categories', 'department', 'collection']);
    let wholesaleIdx = findCol(['wholesalepricepkr', 'wholesale', 'wholesaleprice', 'suppliercost', 'cost', 'costprice', 'purchaseprice', 'buyprice', 'variantprice', 'price', 'regularprice']);
    let customerIdx = findCol(['customerpricepkr', 'customerprice', 'retailprice', 'retail', 'variantcompareatprice', 'compareatprice', 'msrp', 'saleprice']);
    let imageIdx = findCol(['imagesrc', 'imageurl', 'image', 'photo', 'picture', 'images', 'thumbnail', 'img', 'productimage']);
    let stockIdx = findCol(['stock', 'inventory', 'variantinventoryqty', 'quantity', 'qty', 'instock']);
    let descIdx = findCol(['bodyhtml', 'body', 'description', 'details', 'productdescription', 'desc']);
    let variantsIdx = findCol(['variants', 'variant', 'options', 'option1value', 'optionsvalues']);
    const handleIdx = findCol(['handle']);

    // Standard position fallbacks if no header names matched
    if (titleIdx === -1) titleIdx = 0;
    if (categoryIdx === -1) categoryIdx = 1;
    if (wholesaleIdx === -1) wholesaleIdx = 2;
    if (customerIdx === -1) customerIdx = 3;
    if (stockIdx === -1) stockIdx = 4;
    if (imageIdx === -1) imageIdx = 5;
    if (descIdx === -1) descIdx = 6;
    if (variantsIdx === -1) variantsIdx = 7;

    const rows: ParsedCsvRow[] = [];
    let lastAddedRow: ParsedCsvRow | null = null;
    let lastHandle = '';

    for (let i = 1; i < records.length; i++) {
      const columns = records[i];
      if (!columns || columns.length === 0) continue;

      const rawTitle = columns[titleIdx]?.trim() || '';
      const currentHandle = handleIdx !== -1 ? (columns[handleIdx]?.trim() || '') : '';
      const rawImage = columns[imageIdx]?.trim() || '';
      const rawVariant = columns[variantsIdx]?.trim() || '';

      // Clean HTML tags from title
      const cleanTitle = rawTitle.replace(/<[^>]*>/g, '').trim();

      // Shopify Multi-row Merging:
      // If this row has the same Handle or has an empty Title, it belongs to the previous product
      const isShopifyContinuation = 
        lastAddedRow && 
        ((currentHandle && currentHandle === lastHandle) || (!cleanTitle && (rawImage || rawVariant)));

      if (isShopifyContinuation && lastAddedRow) {
        if (rawVariant && !lastAddedRow.variants.includes(rawVariant)) {
          lastAddedRow.variants = lastAddedRow.variants ? `${lastAddedRow.variants}, ${rawVariant}` : rawVariant;
        }
        if ((!lastAddedRow.image || lastAddedRow.isAiGeneratedPhoto) && rawImage && rawImage.startsWith('http')) {
          lastAddedRow.image = rawImage;
          lastAddedRow.isAiGeneratedPhoto = false;
          lastAddedRow.isValidatingImage = false;
          lastAddedRow.originalRawImage = rawImage;
        }
        continue;
      }

      // Ignore stray fragments or empty lines
      if (!cleanTitle || cleanTitle.length < 2) continue;

      const category = columns[categoryIdx]?.trim() || 'Trending Deals';
      let wholesalePKR = parsePriceNumber(columns[wholesaleIdx]);
      let customerPKR = parsePriceNumber(columns[customerIdx]);

      // Smart PKR Margin Calculation
      if (wholesalePKR <= 0 && customerPKR > 0) {
        wholesalePKR = Math.max(150, Math.round(customerPKR * 0.75));
      } else if (wholesalePKR > 0 && customerPKR <= wholesalePKR) {
        customerPKR = wholesalePKR + 250;
      } else if (wholesalePKR <= 0 && customerPKR <= 0) {
        wholesalePKR = 1200;
        customerPKR = 1450;
      }

      const profitPKR = Math.max(150, customerPKR - wholesalePKR);
      const stock = parseInt(columns[stockIdx]?.replace(/[^0-9]/g, '') || '50') || 50;

      const lacksImage = !rawImage || rawImage === '' || rawImage === '""' || rawImage === 'null' || !rawImage.startsWith('http');
      let image = rawImage;
      let isAiGeneratedPhoto = false;

      if (lacksImage) {
        const aiPhotos = getAiPhotosForProduct(cleanTitle, category);
        image = aiPhotos[0]?.url || AI_STUDIO_GENERATED_PHOTOS.earbuds;
        isAiGeneratedPhoto = true;
      }

      let description = columns[descIdx]?.trim() || 'Premium verified product for wholesale dropshipping & reselling.';
      if (description.startsWith('"') && description.endsWith('"')) {
        description = description.slice(1, -1);
      }

      const variants = rawVariant || 'Standard';
      const isValid = Boolean(cleanTitle.length >= 2 && wholesalePKR > 0);

      const newRow: ParsedCsvRow = {
        title: cleanTitle,
        category,
        wholesalePricePKR: wholesalePKR,
        customerPricePKR: customerPKR,
        profitPKR,
        stock,
        image,
        isAiGeneratedPhoto,
        isEnrichedByAiService: false,
        isValidatingImage: lacksImage,
        originalRawImage: rawImage,
        description,
        variants,
        isValid,
        errorMessage: !isValid ? 'Title must be 2+ characters and Wholesale Price > 0' : undefined,
      };

      rows.push(newRow);
      lastAddedRow = newRow;
      lastHandle = currentHandle;
    }

    setParsedRows(rows);
    if (rows.length > 0) {
      setActiveTab('preview');
      triggerBackgroundMediaValidation(rows);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      setCsvText(content);
      parseCsv(content);
    };
    reader.readAsText(file);
  };

  const handleDownloadSample = () => {
    const blob = new Blob([sampleCsvData], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', 'apna_store_reseller_products_sample.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleExportExistingProducts = () => {
    const header = 'title,category,wholesalePricePKR,customerPricePKR,stock,image,description,variants\n';
    const rows = products.map((p) => {
      const wholesalePKR = Math.round(p.supplierCost * 280);
      const customerPKR = Math.round(p.retailPrice * 280);
      const variantsList = p.variants.options.map(o => o.name).join('; ');
      return `"${p.title.replace(/"/g, '""')}","${p.category}",${wholesalePKR},${customerPKR},${p.stock},"${p.images[0]}","${p.description.replace(/"/g, '""')}","${variantsList}"`;
    }).join('\n');

    const fullCsv = header + rows;
    const blob = new Blob([fullCsv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `apna_store_catalog_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleCycleRowPhoto = (rowIndex: number) => {
    setParsedRows((prev) => {
      const copy = [...prev];
      const target = copy[rowIndex];
      if (!target) return prev;
      const angles = getAiPhotosForProduct(target.title, target.category);
      const currentIndex = angles.findIndex((a) => a.url === target.image);
      const nextIndex = (currentIndex + 1) % angles.length;
      copy[rowIndex] = {
        ...target,
        image: angles[nextIndex].url,
        isAiGeneratedPhoto: true,
        isEnrichedByAiService: true,
        aiAngleName: angles[nextIndex].name,
      };
      return copy;
    });
  };

  const handleConfirmImport = () => {
    const validRows = parsedRows.filter(r => r.isValid);
    if (validRows.length === 0) {
      alert('No valid rows found to import.');
      return;
    }

    setIsProcessing(true);

    const convertedProducts: Product[] = validRows.map((row, idx) => {
      const rawVariants = row.variants.split(/[,;]/).map(v => v.trim()).filter(Boolean);
      const options = rawVariants.map((vName, vIdx) => ({
        id: `var-${Date.now()}-${idx}-${vIdx}`,
        name: vName,
        sku: `${row.title.substring(0, 3).toUpperCase()}-${vIdx + 1}`,
        inStock: true,
      }));

      // Gather additional angles so the product has multiple studio angles
      const categoryAngles = getAiPhotosForProduct(row.title, row.category);
      const allImages = Array.from(new Set([row.image, ...categoryAngles.map((a) => a.url)]));

      return {
        id: `csv-prod-${Date.now()}-${idx}`,
        sku: `CSV-${(row.category || 'GEN').substring(0, 3).toUpperCase()}-${Math.floor(1000 + Math.random() * 9000)}`,
        title: row.title,
        tagline: 'Wholesale Verified Reseller Product',
        description: row.description,
        category: (row.category as any) || 'Trending Deals',
        retailPrice: pkrToUsd(row.customerPricePKR),
        originalPrice: pkrToUsd(row.customerPricePKR * 1.5),
        supplierCost: pkrToUsd(row.wholesalePricePKR),
        images: allImages,
        rating: 4.9,
        reviewsCount: 1,
        stock: row.stock,
        tags: [
          'CSV Imported', 
          'Reseller Ready', 
          '+Rs. 200 Profit',
          row.isAiGeneratedPhoto ? 'AI Studio Photos' : 'Supplier Photos',
          'AI Video Ad Ready'
        ],
        importedToStore: true,
        supplier: SUPPLIERS[2], // Apna Local Hub
        variants: {
          type: 'Option',
          options: options.length > 0 ? options : [{ id: 'opt-1', name: 'Standard', sku: 'STD', inStock: true }],
        },
        features: [
          'Direct Wholesale Sourcing Price',
          '100% Copyright-Free AI Studio Photos & Video Ad',
          'Cash on Delivery (COD) Enabled',
          'Standard Quality Sealed Packaging',
        ],
        reviews: [],
      };
    });

    setTimeout(() => {
      onBulkImport(convertedProducts);
      setIsProcessing(false);
      onClose();
    }, 600);
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5 animate-in fade-in duration-200">
      <div className="relative bg-white w-full max-w-4xl rounded-2xl shadow-2xl border border-slate-200 overflow-hidden my-auto max-h-[92vh] flex flex-col">
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-900 text-white">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-emerald-500 text-slate-950 rounded-xl">
              <Table className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-extrabold text-base flex items-center gap-2">
                <span>CSV Bulk Product Importer & Sourcing Manager</span>
                <span className="bg-emerald-500/20 text-emerald-300 text-[10px] font-bold px-2 py-0.5 rounded border border-emerald-500/30 uppercase">
                  PKR Wholesale
                </span>
              </h2>
              <p className="text-xs text-slate-400">
                Upload CSV files to list products in seconds. Background AI Media Studio auto-generates studio shots for missing photos.
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 text-slate-400 hover:text-white rounded-lg cursor-pointer">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Action Bar & Mode Switcher */}
        <div className="px-5 py-3 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setActiveTab('upload')}
              className={`px-3 py-1.5 rounded-lg font-bold transition-colors cursor-pointer ${
                activeTab === 'upload' ? 'bg-slate-900 text-white' : 'bg-white border text-slate-700 hover:bg-slate-100'
              }`}
            >
              Upload / Paste CSV
            </button>
            <button
              onClick={() => setActiveTab('preview')}
              disabled={parsedRows.length === 0}
              className={`px-3 py-1.5 rounded-lg font-bold transition-colors cursor-pointer flex items-center gap-1.5 ${
                activeTab === 'preview'
                  ? 'bg-emerald-700 text-white'
                  : 'bg-white border text-slate-400 hover:text-slate-700 disabled:opacity-50'
              }`}
            >
              <span>Preview Rows ({parsedRows.length})</span>
              {isValidatingBackground && (
                <Loader2 className="w-3 h-3 animate-spin text-amber-300" />
              )}
            </button>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleDownloadSample}
              className="px-3 py-1.5 bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 rounded-lg font-semibold flex items-center gap-1.5 cursor-pointer shadow-2xs"
            >
              <Download className="w-3.5 h-3.5 text-amber-600" />
              <span>Sample CSV Template</span>
            </button>

            <button
              onClick={handleExportExistingProducts}
              className="px-3 py-1.5 bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 rounded-lg font-semibold flex items-center gap-1.5 cursor-pointer shadow-2xs"
            >
              <FileText className="w-3.5 h-3.5 text-blue-600" />
              <span>Export Catalog ({products.length})</span>
            </button>
          </div>
        </div>

        {/* Body Content */}
        <div className="overflow-y-auto p-5 sm:p-6 space-y-4 flex-1">
          {activeTab === 'upload' && (
            <div className="space-y-4">
              {/* File Dropzone */}
              <div 
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-slate-300 hover:border-emerald-500 bg-slate-50/70 hover:bg-emerald-50/30 rounded-2xl p-8 text-center transition-all cursor-pointer group"
              >
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileUpload}
                  accept=".csv,text/csv"
                  className="hidden"
                />
                <div className="w-12 h-12 rounded-full bg-emerald-100 text-emerald-700 mx-auto flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                  <Upload className="w-6 h-6" />
                </div>
                <h4 className="font-extrabold text-sm text-slate-800">
                  Click to Browse & Upload CSV File
                </h4>
                <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
                  Supports Excel export, Google Sheets CSV, or custom supplier feeds. Wholesale and customer prices are automatically formatted in Pakistani Rupees (PKR).
                </p>
                <span className="inline-block mt-3 text-[11px] font-bold text-emerald-800 bg-emerald-100 px-2.5 py-1 rounded-full">
                  ⚡ Auto Background AI Media Validator: Lacks photo? Creates 100% Copyright-Free Studio Shots automatically.
                </span>
              </div>

              {/* Paste CSV raw text */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-bold text-slate-800">
                    Or Paste CSV Data Directly Below:
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      setCsvText(sampleCsvData);
                      parseCsv(sampleCsvData);
                    }}
                    className="text-xs text-emerald-700 font-bold hover:underline cursor-pointer"
                  >
                    Load Sample Products (Without Photos)
                  </button>
                </div>
                <textarea
                  rows={6}
                  value={csvText}
                  onChange={(e) => setCsvText(e.target.value)}
                  placeholder={`title,category,wholesalePricePKR,customerPricePKR,stock,image,description,variants\n"Bluetooth Earbuds",Electronics,1200,1400,50,"", "Description", "Black, White"`}
                  className="w-full p-3 font-mono text-xs border border-slate-300 rounded-xl focus:border-emerald-500 outline-hidden bg-slate-50/50"
                />
              </div>

              <div className="flex justify-end">
                <button
                  onClick={() => parseCsv(csvText)}
                  disabled={!csvText.trim()}
                  className="px-5 py-2.5 bg-slate-900 hover:bg-emerald-600 text-white rounded-xl text-xs font-bold transition-all disabled:opacity-50 cursor-pointer flex items-center gap-1.5 shadow-xs"
                >
                  <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Parse CSV & Run Background AI Validation</span>
                </button>
              </div>
            </div>
          )}

          {activeTab === 'preview' && (
            <div className="space-y-4">
              {/* Background Media Validation Live Status Banner */}
              <div className={`p-3.5 rounded-xl border text-xs transition-all shadow-2xs ${
                isValidatingBackground 
                  ? 'bg-amber-50/90 border-amber-300 text-amber-950'
                  : validationStats.missingDetected > 0 
                  ? 'bg-emerald-50/90 border-emerald-300 text-emerald-950'
                  : 'bg-slate-50 border-slate-200 text-slate-800'
              }`}>
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-lg shrink-0 ${
                      isValidatingBackground 
                        ? 'bg-amber-500 text-slate-950 animate-pulse'
                        : 'bg-emerald-600 text-white'
                    }`}>
                      {isValidatingBackground ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <ShieldCheck className="w-4 h-4" />
                      )}
                    </div>
                    <div>
                      <div className="font-extrabold flex items-center gap-2 flex-wrap">
                        <span>
                          {isValidatingBackground 
                            ? 'Background AI Media Validation Service ACTIVE' 
                            : 'AI Media Studio Background Validation Complete'}
                        </span>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase ${
                          isValidatingBackground
                            ? 'bg-amber-200 text-amber-900 animate-pulse'
                            : 'bg-emerald-600 text-white'
                        }`}>
                          {isValidatingBackground ? 'Generating Studio Shots' : '100% Copyright-Free'}
                        </span>
                      </div>
                      <p className="text-[11px] mt-0.5 opacity-90">
                        {isValidatingBackground 
                          ? `Scanning product entries lacking image URLs... Generated ${validationStats.generatedCount} of ${validationStats.missingDetected} commercial studio shots.`
                          : validationStats.missingDetected > 0
                          ? `Detected ${validationStats.missingDetected} product(s) without supplier photos. AI Media Studio service auto-generated ${validationStats.generatedCount} high-resolution studio shots with commercial copyright-free protection!`
                          : `All ${parsedRows.length} product entries validated. High-quality media and video ad storyboards ready.`}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={() => triggerBackgroundMediaValidation(parsedRows)}
                      disabled={isValidatingBackground}
                      className="px-3 py-1.5 bg-white border border-slate-300 hover:bg-slate-50 text-slate-800 font-bold rounded-lg flex items-center gap-1.5 transition-colors cursor-pointer text-xs disabled:opacity-50"
                      title="Re-run background image validation"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 ${isValidatingBackground ? 'animate-spin text-amber-600' : 'text-emerald-600'}`} />
                      <span>Re-Scan & Validate</span>
                    </button>

                    <button
                      onClick={() => setActiveTab('upload')}
                      className="px-3 py-1.5 bg-slate-900 text-white hover:bg-slate-800 font-bold rounded-lg text-xs cursor-pointer"
                    >
                      Edit CSV
                    </button>
                  </div>
                </div>

                {/* Progress bar when background validation is running */}
                {isValidatingBackground && validationStats.missingDetected > 0 && (
                  <div className="w-full bg-amber-200/60 h-1.5 rounded-full mt-2.5 overflow-hidden">
                    <div
                      className="bg-amber-600 h-full transition-all duration-300"
                      style={{
                        width: `${Math.round((validationStats.generatedCount / validationStats.missingDetected) * 100)}%`
                      }}
                    />
                  </div>
                )}
              </div>

              {/* Table Preview */}
              <div className="overflow-x-auto border border-slate-200 rounded-xl">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-100 text-slate-600 font-bold uppercase text-[10px] tracking-wider">
                    <tr>
                      <th className="py-2.5 px-3">Status</th>
                      <th className="py-2.5 px-3">AI Studio Shot (No Copyright)</th>
                      <th className="py-2.5 px-3">Product Title</th>
                      <th className="py-2.5 px-3">Category</th>
                      <th className="py-2.5 px-3">Wholesale (PKR)</th>
                      <th className="py-2.5 px-3">Customer Price</th>
                      <th className="py-2.5 px-3">Your Profit</th>
                      <th className="py-2.5 px-3">AI Video Ad</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {parsedRows.map((row, idx) => (
                      <tr key={idx} className={row.isValid ? 'hover:bg-slate-50' : 'bg-rose-50/50'}>
                        <td className="py-2.5 px-3">
                          {row.isValid ? (
                            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                          ) : (
                            <span title={row.errorMessage}>
                              <AlertCircle className="w-4 h-4 text-rose-500" />
                            </span>
                          )}
                        </td>
                        <td className="py-2.5 px-3">
                          <div className="flex items-center gap-2">
                            <div className="relative w-12 h-12 rounded-lg overflow-hidden bg-slate-100 border border-slate-200 shrink-0">
                              <img
                                src={row.image}
                                alt={row.title}
                                className="w-full h-full object-cover"
                                onError={(e) => {
                                  (e.target as HTMLImageElement).src = AI_STUDIO_GENERATED_PHOTOS.earbuds;
                                }}
                              />
                              {row.isValidatingImage ? (
                                <div className="absolute inset-0 bg-slate-950/70 flex items-center justify-center">
                                  <Loader2 className="w-4 h-4 text-amber-400 animate-spin" />
                                </div>
                              ) : (
                                <span className="absolute bottom-0 inset-x-0 bg-slate-900/80 text-[8px] text-emerald-300 font-bold text-center py-0.5 truncate">
                                  {row.isAiGeneratedPhoto ? 'AI Studio' : 'Supplier'}
                                </span>
                              )}
                            </div>
                            <div className="space-y-0.5">
                              {row.isValidatingImage ? (
                                <span className="text-[10px] text-amber-700 font-bold flex items-center gap-1 animate-pulse">
                                  <Loader2 className="w-2.5 h-2.5 animate-spin" />
                                  <span>Generating...</span>
                                </span>
                              ) : row.isEnrichedByAiService ? (
                                <div>
                                  <span className="inline-block text-[9px] font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.2 rounded border border-emerald-200">
                                    {row.aiAngleName || 'Studio Shot'}
                                  </span>
                                  <button
                                    type="button"
                                    onClick={() => handleCycleRowPhoto(idx)}
                                    className="text-[10px] text-slate-500 hover:text-emerald-700 font-bold underline block mt-0.5 cursor-pointer"
                                    title="Click to cycle studio angles (White, In-Use, Luxury)"
                                  >
                                    Swap Angle 🔄
                                  </button>
                                </div>
                              ) : (
                                <div>
                                  <span className="inline-block text-[9px] font-bold text-slate-600 bg-slate-100 px-1.5 py-0.2 rounded">
                                    Supplier Photo
                                  </span>
                                  <button
                                    type="button"
                                    onClick={() => handleCycleRowPhoto(idx)}
                                    className="text-[10px] text-emerald-700 hover:text-emerald-800 font-bold underline block mt-0.5 cursor-pointer"
                                  >
                                    Swap to AI 📸
                                  </button>
                                </div>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="py-2.5 px-3 font-bold text-slate-900 max-w-[180px] truncate">
                          {row.title}
                        </td>
                        <td className="py-2.5 px-3 text-slate-500">
                          {row.category}
                        </td>
                        <td className="py-2.5 px-3 font-semibold text-slate-800">
                          {formatPKR(row.wholesalePricePKR)}
                        </td>
                        <td className="py-2.5 px-3 font-black text-slate-900">
                          {formatPKR(row.customerPricePKR)}
                        </td>
                        <td className="py-2.5 px-3 font-bold text-emerald-700">
                          +{formatPKR(row.profitPKR)}
                        </td>
                        <td className="py-2.5 px-3">
                          <span className="inline-flex items-center gap-1 bg-amber-50 text-amber-800 border border-amber-200 text-[10px] font-bold px-2 py-0.5 rounded-md">
                            <Video className="w-3 h-3 text-amber-600" />
                            <span>Auto Video Ad Ready</span>
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Action */}
              <div className="flex items-center justify-between pt-2">
                <span className="text-xs text-slate-500">
                  Products will be immediately available on your storefront with Cash on Delivery (COD).
                </span>
                <button
                  onClick={handleConfirmImport}
                  disabled={isProcessing || parsedRows.filter(r => r.isValid).length === 0}
                  className="px-6 py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black transition-all shadow-md flex items-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  {isProcessing ? (
                    <span>Importing Products...</span>
                  ) : (
                    <>
                      <Plus className="w-4 h-4" />
                      <span>Import {parsedRows.filter(r => r.isValid).length} Products to Store</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
