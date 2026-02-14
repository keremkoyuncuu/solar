import React, { useState, useRef } from 'react';
import * as XLSX from 'xlsx';
import { Upload, X, FileSpreadsheet, Check, AlertCircle, Loader2 } from 'lucide-react';
import { supabase } from '../../lib/supabaseClient';

interface ExcelImportModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: () => void;
}

const ExcelImportModal: React.FC<ExcelImportModalProps> = ({ isOpen, onClose, onSave }) => {
    const [file, setFile] = useState<File | null>(null);
    const [previewData, setPreviewData] = useState<any[]>([]);
    const [allData, setAllData] = useState<any[]>([]);
    const [columns, setColumns] = useState<string[]>([]);
    const [loading, setLoading] = useState(false);
    const [progress, setProgress] = useState<{ current: number; total: number; message: string }>({ current: 0, total: 0, message: '' });
    const [error, setError] = useState<string | null>(null);
    const [resultStats, setResultStats] = useState<{ success: number; updated: number; failed: number; errors: string[] } | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const selectedFile = e.target.files?.[0];
        if (!selectedFile) return;

        const fileExtension = selectedFile.name.split('.').pop()?.toLowerCase();
        if (fileExtension !== 'xlsx' && fileExtension !== 'xls' && fileExtension !== 'csv') {
            setError('Lütfen sadece .xlsx, .xls veya .csv formatında dosya yükleyin.');
            return;
        }

        setFile(selectedFile);
        setError(null);
        setResultStats(null);
        readExcel(selectedFile);
    };

    const normalizeHeaders = (data: any[]) => {
        if (data.length === 0) return [];

        // İlk satırdaki (veya sheet_to_json ile gelen objelerin keylerindeki) başlıkları normalize et
        return data.map(row => {
            const newRow: any = {};
            Object.keys(row).forEach(key => {
                const normalizedKey = key.toString().toLowerCase()
                    .trim()
                    .replace(/ü/g, 'u')
                    .replace(/ı/g, 'i')
                    .replace(/ö/g, 'o')
                    .replace(/ş/g, 's')
                    .replace(/ğ/g, 'g')
                    .replace(/ç/g, 'c')
                    .replace(/\s+/g, '_'); // Boşlukları alt tire yap

                // Özel Eşleştirmeler (Kullanıcının yazdığı -> Bizim beklediğimiz)
                if (normalizedKey.includes('urun_adi') || normalizedKey === 'urun' || normalizedKey === 'ad') newRow['urun_adi'] = row[key];
                else if (normalizedKey === 'fiyat' || normalizedKey === 'satis_fiyati') newRow['fiyat'] = row[key];
                else if (normalizedKey === 'stok' || normalizedKey === 'adet' || normalizedKey === 'miktar') newRow['stok'] = row[key];
                else if (normalizedKey === 'kategori' || normalizedKey === 'tur') newRow['kategori'] = row[key];
                else if (normalizedKey === 'marka') newRow['marka'] = row[key];
                else if (normalizedKey === 'aciklama' || normalizedKey === 'detay') newRow['aciklama'] = row[key];
                else if (normalizedKey === 'sku' || normalizedKey === 'stok_kodu' || normalizedKey === 'urunkodu') newRow['sku'] = row[key];
                else if (normalizedKey === 'varyant_adi' || normalizedKey === 'varyant' || normalizedKey === 'secenek') newRow['varyant_adi'] = row[key];
                else if (normalizedKey === 'varyant_degeri' || normalizedKey === 'deger') newRow['varyant_degeri'] = row[key];
                else {
                    // Eşleşmeyenleri olduğu gibi bırak (belki lazım olur)
                    newRow[normalizedKey] = row[key];
                }
            });
            return newRow;
        });
    };

    const readExcel = (file: File) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const data = e.target?.result;
                const workbook = XLSX.read(data, { type: 'binary' });
                const sheetName = workbook.SheetNames[0];
                const sheet = workbook.Sheets[sheetName];
                let jsonData = XLSX.utils.sheet_to_json(sheet);

                if (jsonData.length > 0) {
                    // Normalizasyon işlemi
                    jsonData = normalizeHeaders(jsonData);

                    const headers = Object.keys(jsonData[0] as object);
                    setColumns(headers);
                    setPreviewData(jsonData.slice(0, 10));
                    setAllData(jsonData);
                }
            } catch (err) {
                console.error("Excel okuma hatası:", err);
                setError("Dosya okunurken bir hata oluştu. Lütfen dosya formatını kontrol edin.");
            }
        };
        reader.readAsBinaryString(file);
    };

    const slugify = (text: string) => {
        return text.toString().toLowerCase()
            .replace(/\s+/g, '-')           // Boşlukları tireyle değiştir
            .replace(/[^\w\-]+/g, '')       // Alfanümerik olmayan karakterleri sil
            .replace(/\-\-+/g, '-')         // Birden fazla tireyi tek tireye indir
            .replace(/^-+/, '')             // Baştaki tireleri sil
            .replace(/-+$/, '');            // Sondaki tireleri sil
    };

    const handleUpload = async () => {
        if (!allData.length) return;
        setLoading(true);
        setError(null);
        setResultStats({ success: 0, updated: 0, failed: 0, errors: [] });

        let successCount = 0;
        let updatedCount = 0;
        let failedCount = 0;
        let errorMessages: string[] = [];

        try {
            const total = allData.length;

            for (let i = 0; i < total; i++) {
                const row = allData[i];
                setProgress({ current: i + 1, total, message: `İşleniyor: ${row.urun_adi || 'Bilinmeyen Ürün'}` });

                // Zorunlu alan kontrolü
                if (!row.urun_adi || !row.fiyat || !row.kategori) {
                    failedCount++;
                    errorMessages.push(`Satır ${i + 2}: Ürün adı, fiyat veya kategori eksik.`);
                    continue;
                }

                try {
                    // 1. KATEGORİ İŞLEMLERİ
                    let categoryId = null;
                    const categorySlug = slugify(row.kategori);

                    // Kategoriyi bulmaya çalış
                    const { data: existingCat } = await supabase
                        .from('categories')
                        .select('id')
                        .ilike('name', row.kategori) // Case-insensitive arama
                        .maybeSingle();

                    if (existingCat) {
                        categoryId = existingCat.id;
                    } else {
                        // Kategori yoksa HATA VER (Kullanıcı isteği: Yeni kategori oluşturmasın)
                        throw new Error(`Kategori bulunamadı: "${row.kategori}". Lütfen önce paneldan bu kategoriyi oluşturun.`);
                    }

                    // 2. ÜRÜN KONTROLÜ (DUPLICATE CHECK)
                    let productId = null;
                    let isUpdate = false;

                    // Önce SKU ile varyantlardan ürünü bulmaya çalış (Eğer sku verilmişse)
                    if (row.sku) {
                        const { data: existingVariant } = await supabase
                            .from('product_variants')
                            .select('product_id')
                            .eq('sku', row.sku)
                            .maybeSingle();

                        if (existingVariant) {
                            productId = existingVariant.product_id;
                            isUpdate = true;
                        }
                    }

                    // SKU ile bulunamadıysa İsim ile ara
                    if (!productId) {
                        const { data: existingProduct } = await supabase
                            .from('products')
                            .select('id')
                            .ilike('name', row.urun_adi)
                            .maybeSingle();

                        if (existingProduct) {
                            productId = existingProduct.id;
                            // Sadece güncelleme olarak işaretlemiyoruz, çünkü isim aynı olsa bile belki yeni bir varyant ekleniyor olabilir.
                            // Ancak bizim senaryomuzda "Tek satır = Tek varyant" olduğu için update kabul edebiliriz.
                            isUpdate = true;
                        }
                    }

                    const productSlug = slugify(row.urun_adi);

                    // 3. ÜRÜN ERİŞİMİ / OLUŞTURMA
                    if (productId) {
                        // Mevcut ürünü güncelle (Sadece temel bilgiler)
                        await supabase
                            .from('products')
                            .update({
                                description: row.aciklama || undefined,
                                brand: row.marka || undefined,
                                updated_at: new Date().toISOString()
                            })
                            .eq('id', productId);
                        updatedCount++;
                    } else {
                        // Yeni ürün oluştur
                        const { data: newProduct, error: prodError } = await supabase
                            .from('products')
                            .insert({
                                name: row.urun_adi,
                                slug: productSlug,
                                description: row.aciklama || '',
                                brand: row.marka || '',
                                is_active: true,
                                is_featured: false
                            })
                            .select('id')
                            .single();

                        if (prodError) throw new Error(`Ürün oluşturulamadı: ${prodError.message}`);
                        productId = newProduct.id;
                        successCount++;
                    }

                    // 4. KATEGORİ İLİŞKİSİ
                    // İlişki var mı kontrol et, yoksa ekle
                    const { data: existingRel } = await supabase
                        .from('product_categories')
                        .select('*')
                        .eq('product_id', productId)
                        .eq('category_id', categoryId)
                        .maybeSingle();

                    if (!existingRel) {
                        await supabase.from('product_categories').insert({
                            product_id: productId,
                            category_id: categoryId
                        });
                    }

                    // 5. VARYANT OLUŞTURMA / GÜNCELLEME
                    // Bu ürün için bir varyant var mı? (Şimdilik her ürünün tek varyantı varmış gibi veya ilk bulduğu varyantı güncelleyecek şekilde basit tutuyoruz)
                    // Excel'de varyant adı varsa onu kullan, yoksa ürün adını kullan
                    const variantName = row.varyant_adi ? `${row.varyant_adi} ${row.varyant_degeri || ''}`.trim() : row.urun_adi;
                    const variantSku = row.sku || `${productSlug}-VAR`; // SKU yoksa geçici SKU

                    // Varyantı SKU ile veya Product ID ile ara
                    // Eğer SKU varsa zaten productId bulurken bulmuştuk ama ID'sini almadık. Tekrar kontrol edelim.
                    let variantId = null;

                    if (row.sku) {
                        const { data: existingVariantBySku } = await supabase
                            .from('product_variants')
                            .select('id')
                            .eq('sku', row.sku)
                            .maybeSingle();

                        if (existingVariantBySku) {
                            variantId = existingVariantBySku.id;
                        }
                    }

                    // Eğer SKU ile bulamadıysak (veya SKU yoksa), ürünün İLK varyantını alalım (Update için)
                    // Ancak bu riskli olabilir, farklı varyantı ezebilir.
                    // Kural: Excel importunda eğer SKU yoksa, ürünün varyantını güncellemek yerine yeni varyant mı eklesin?
                    // Basitlik için: Ürün yeni ise yeni varyant. Ürün eskiyse ve SKU yoksa, ürün ID'sine bağlı ilk varyantı güncelle.
                    if (!variantId && productId) {
                        const { data: firstVariant } = await supabase
                            .from('product_variants')
                            .select('id')
                            .eq('product_id', productId)
                            .limit(1)
                            .maybeSingle();

                        if (firstVariant) {
                            variantId = firstVariant.id;
                        }
                    }

                    if (variantId) {
                        // Varyantı güncelle
                        const { error: vUpdateError } = await supabase
                            .from('product_variants')
                            .update({
                                stock: Number(row.stok) || 0,
                                name: variantName,
                                base_price: Number(row.fiyat) || 0
                                // SKU'yu değiştirmiyoruz eğer varsa
                            })
                            .eq('id', variantId);

                        if (vUpdateError) throw vUpdateError;
                    } else {
                        // Yeni Varyant Ekle
                        const { data: newVariant, error: vError } = await supabase
                            .from('product_variants')
                            .insert({
                                product_id: productId,
                                name: variantName,
                                sku: variantSku,
                                stock: Number(row.stok) || 0,
                                base_price: Number(row.fiyat) || 0,
                                is_active: true
                            })
                            .select('id')
                            .single();

                        if (vError) throw new Error(`Varyant hatası: ${vError.message}`);
                        variantId = newVariant.id;
                    }

                    // 6. FİYAT GÜNCELLEME
                    // Varyantın fiyatını güncelle veya ekle
                    const { data: existingPrice } = await supabase
                        .from('variant_prices')
                        .select('id')
                        .eq('variant_id', variantId)
                        .maybeSingle();

                    if (existingPrice) {
                        await supabase
                            .from('variant_prices')
                            .update({
                                price: Number(row.fiyat) || 0
                            })
                            .eq('id', existingPrice.id);
                    } else {
                        await supabase.from('variant_prices').insert({
                            variant_id: variantId,
                            price: Number(row.fiyat) || 0,
                            currency: 'TRY',
                            is_active: true
                        });
                    }



                } catch (rowErr: any) {
                    failedCount++;
                    errorMessages.push(`Satır ${i + 2} (${row.urun_adi}): ${rowErr.message}`);
                    console.error(rowErr);
                }
            }

            setResultStats({
                success: successCount,
                updated: updatedCount,
                failed: failedCount,
                errors: errorMessages
            });

        } catch (err: any) {
            console.error("Genel Hata:", err);
            setError("İşlem sırasında beklenmedik bir hata oluştu: " + err.message);
        } finally {
            setLoading(false);
            setProgress({ current: 0, total: 0, message: '' });
        }
    };

    const handleClose = () => {
        if (loading) return;
        setFile(null);
        setPreviewData([]);
        setAllData([]);
        setColumns([]);
        setError(null);
        setResultStats(null);
        onClose();
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 overflow-y-auto">
            <div className="flex items-center justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
                <div className="fixed inset-0 transition-opacity" aria-hidden="true">
                    <div className="absolute inset-0 bg-gray-500 opacity-75" onClick={handleClose}></div>
                </div>

                <span className="hidden sm:inline-block sm:align-middle sm:h-screen" aria-hidden="true">&#8203;</span>

                <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-4xl sm:w-full">
                    {/* Header */}
                    <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4 border-b border-gray-100">
                        <div className="flex justify-between items-center">
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-green-100 rounded-lg">
                                    <FileSpreadsheet className="w-6 h-6 text-green-600" />
                                </div>
                                <h3 className="text-lg leading-6 font-medium text-gray-900">
                                    Excel ile Toplu Ürün Yükleme
                                </h3>
                            </div>
                            <button onClick={handleClose} className="text-gray-400 hover:text-gray-500 focus:outline-none">
                                <X className="w-6 h-6" />
                            </button>
                        </div>
                    </div>

                    {/* Body */}
                    <div className="px-4 py-5 sm:p-6">
                        {/* SONUÇ EKRANI */}
                        {resultStats ? (
                            <div className="text-center py-8">
                                <div className="mx-auto flex items-center justify-center h-16 w-16 rounded-full bg-green-100 mb-6">
                                    <Check className="h-8 w-8 text-green-600" />
                                </div>
                                <h3 className="text-2xl font-bold text-gray-900 mb-2">İşlem Tamamlandı</h3>
                                <p className="text-gray-500 mb-8">Excel dosyanız başarıyla işlendi.</p>

                                <div className="grid grid-cols-3 gap-4 mb-8 max-w-lg mx-auto">
                                    <div className="bg-green-50 p-4 rounded-lg border border-green-100">
                                        <div className="text-2xl font-bold text-green-700">{resultStats.success}</div>
                                        <div className="text-xs text-green-600 font-medium uppercase tracking-wide">Yeni Eklenen</div>
                                    </div>
                                    <div className="bg-blue-50 p-4 rounded-lg border border-blue-100">
                                        <div className="text-2xl font-bold text-blue-700">{resultStats.updated}</div>
                                        <div className="text-xs text-blue-600 font-medium uppercase tracking-wide">Güncellenen</div>
                                    </div>
                                    <div className="bg-red-50 p-4 rounded-lg border border-red-100">
                                        <div className="text-2xl font-bold text-red-700">{resultStats.failed}</div>
                                        <div className="text-xs text-red-600 font-medium uppercase tracking-wide">Başarısız</div>
                                    </div>
                                </div>

                                {resultStats.errors.length > 0 && (
                                    <div className="text-left bg-gray-50 p-4 rounded-lg border border-gray-200 max-h-48 overflow-y-auto mb-6">
                                        <p className="text-xs font-bold text-gray-500 mb-2 uppercase">Hata Raporu:</p>
                                        <ul className="list-disc pl-5 space-y-1">
                                            {resultStats.errors.map((err, idx) => (
                                                <li key={idx} className="text-xs text-red-600">{err}</li>
                                            ))}
                                        </ul>
                                    </div>
                                )}

                                <button
                                    onClick={() => {
                                        onSave(); // Listeyi yenilemesi için
                                        handleClose();
                                    }}
                                    className="inline-flex justify-center px-6 py-3 border border-transparent text-base font-medium rounded-md text-white bg-green-600 hover:bg-green-700 shadow-sm transition-colors"
                                >
                                    Tamam ve Kapat
                                </button>
                            </div>
                        ) : !file ? (
                            // DOSYA YÜKLEME EKRANI
                            <div
                                className="border-2 border-dashed border-gray-300 rounded-lg p-12 text-center hover:border-green-500 transition-colors cursor-pointer"
                                onClick={() => fileInputRef.current?.click()}
                            >
                                <Upload className="mx-auto h-12 w-12 text-gray-400" />
                                <div className="mt-4 flex text-sm text-gray-600 justify-center">
                                    <label htmlFor="file-upload" className="relative cursor-pointer bg-white rounded-md font-medium text-green-600 hover:text-green-500 focus-within:outline-none">
                                        <span>Dosya Seç</span>
                                        <input
                                            ref={fileInputRef}
                                            id="file-upload"
                                            name="file-upload"
                                            type="file"
                                            className="sr-only"
                                            accept=".xlsx, .xls, .csv"
                                            onChange={handleFileChange}
                                        />
                                    </label>
                                    <p className="pl-1">veya sürükleyip bırakın</p>
                                </div>
                                <p className="text-xs text-gray-500 mt-2">
                                    .xlsx, .xls veya .csv (Maks. 10MB)
                                </p>
                                <div className="mt-6">
                                    <a href="#" className="text-xs font-medium text-green-600 hover:text-green-500 underline">
                                        Örnek Şablonu İndir
                                    </a>
                                </div>
                            </div>
                        ) : (
                            // ÖNİZLEME VE YÜKLEME DURUMU
                            <div className="space-y-6">
                                {/* Dosya Bilgisi */}
                                <div className="flex items-center justify-between bg-gray-50 p-4 rounded-lg border border-gray-200">
                                    <div className="flex items-center gap-3">
                                        <FileSpreadsheet className="w-8 h-8 text-green-600" />
                                        <div>
                                            <p className="font-medium text-gray-900">{file.name}</p>
                                            <p className="text-xs text-gray-500">{(file.size / 1024).toFixed(2)} KB • {allData.length} Satır</p>
                                        </div>
                                    </div>
                                    {!loading && (
                                        <button onClick={() => setFile(null)} className="text-sm text-red-600 hover:text-red-800 font-medium">
                                            Değiştir
                                        </button>
                                    )}
                                </div>

                                {/* Yükleme İlerleme Çubuğu */}
                                {loading && (
                                    <div className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm">
                                        <div className="flex items-center justify-between mb-2">
                                            <span className="text-sm font-medium text-gray-700">Yükleniyor...</span>
                                            <span className="text-sm font-medium text-green-600">
                                                {Math.round((progress.current / progress.total) * 100)}%
                                            </span>
                                        </div>
                                        <div className="w-full bg-gray-200 rounded-full h-2.5 mb-2">
                                            <div
                                                className="bg-green-600 h-2.5 rounded-full transition-all duration-300"
                                                style={{ width: `${(progress.current / progress.total) * 100}%` }}
                                            ></div>
                                        </div>
                                        <p className="text-xs text-gray-500 truncate">{progress.message}</p>
                                    </div>
                                )}

                                {/* Hata Mesajı (Genel) */}
                                {error && (
                                    <div className="bg-red-50 border-l-4 border-red-400 p-4">
                                        <div className="flex">
                                            <div className="flex-shrink-0">
                                                <AlertCircle className="h-5 w-5 text-red-400" />
                                            </div>
                                            <div className="ml-3">
                                                <p className="text-sm text-red-700">{error}</p>
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {/* Önizleme Tablosu */}
                                {previewData.length > 0 && !loading && (
                                    <div className="border border-gray-200 rounded-lg overflow-hidden">
                                        <div className="bg-gray-100 px-4 py-2 border-b border-gray-200 flex justify-between items-center">
                                            <h4 className="text-sm font-bold text-gray-700">Veri Önizleme (İlk 10 Satır)</h4>
                                            <span className="text-xs text-gray-500">Toplam {allData.length} kayıt</span>
                                        </div>
                                        <div className="overflow-x-auto max-h-64">
                                            <table className="min-w-full divide-y divide-gray-200">
                                                <thead className="bg-gray-50">
                                                    <tr>
                                                        {columns.map((col, idx) => (
                                                            <th key={idx} className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">
                                                                {col}
                                                            </th>
                                                        ))}
                                                    </tr>
                                                </thead>
                                                <tbody className="bg-white divide-y divide-gray-200">
                                                    {previewData.map((row: any, rIdx) => (
                                                        <tr key={rIdx}>
                                                            {columns.map((col, cIdx) => (
                                                                <td key={cIdx} className="px-6 py-4 whitespace-nowrap text-xs text-gray-900">
                                                                    {row[col]}
                                                                </td>
                                                            ))}
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>

                    {/* Footer - Sadece dosya seçiliyken ve işlem bitmemişken göster */}
                    {file && !resultStats && (
                        <div className="bg-gray-50 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse">
                            <button
                                type="button"
                                onClick={handleUpload}
                                disabled={loading}
                                className={`w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-green-600 text-base font-medium text-white hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 sm:ml-3 sm:w-auto sm:text-sm ${loading ? 'opacity-70 cursor-not-allowed' : ''}`}
                            >
                                {loading ? (
                                    <>
                                        <Loader2 className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" />
                                        İşleniyor...
                                    </>
                                ) : (
                                    `Onayla ve Yükle (${allData.length} Ürün)`
                                )}
                            </button>
                            <button
                                type="button"
                                onClick={handleClose}
                                disabled={loading}
                                className="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 sm:mt-0 sm:ml-3 sm:w-auto sm:text-sm"
                            >
                                İptal
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default ExcelImportModal;
