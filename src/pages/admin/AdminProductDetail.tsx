import React, { useEffect, useState, useCallback } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { useParams, Link } from 'react-router-dom';
import VariantModal from '../../components/admin/VariantModal';

interface VariantDisplay {
    id: string;
    product_name: string;
    name: string;
    sku: string;
    stock: number;
    base_price: number;
    is_active: boolean;
    discount_percentage: number;
    discount_start_date: string | null;
    discount_end_date: string | null;
    b2b_discount: number; // B2B iskonto oranı (%)
}

const AdminProductDetail: React.FC = () => {
    const { id } = useParams<{ id: string }>();
    const [variants, setVariants] = useState<VariantDisplay[]>([]);
    const [productName, setProductName] = useState<string>('');
    const [loading, setLoading] = useState<boolean>(true);
    const [isVariantModalOpen, setIsVariantModalOpen] = useState(false);
    const [editingVariant, setEditingVariant] = useState<VariantDisplay | null>(null);

    const handleDeleteVariant = async (variantId: string, name: string) => {
        if (!window.confirm(`"${name}" varyantını silmek istediğinize emin misiniz?`)) return;

        try {
            // 1. Önce sepet öğelerini sil (FK Constraint)
            const { error: ciError } = await supabase.from('cart_items').delete().eq('variant_id', variantId);
            if (ciError) throw ciError;

            // 2. Fiyatlarını sil
            const { error: vpError } = await supabase.from('variant_prices').delete().eq('variant_id', variantId);
            if (vpError) throw vpError;

            // 3. Varyantı sil
            const { error: vError } = await supabase.from('product_variants').delete().eq('id', variantId);
            if (vError) throw vError;

            alert("Varyant ve ilişkili veriler (fiyatlar, sepet) silindi.");
            fetchData();
        } catch (error) {
            console.error(error);
            alert("Silme işlemi başarısız.");
        }
    };

    const fetchData = useCallback(async () => {
        if (!id) return;
        setLoading(true);
        try {
            // 1. B2B İskonto Oranını Çek
            const { data: settingsData } = await supabase
                .from('app_settings')
                .select('value')
                .eq('key', 'b2b_discount_percentage')
                .maybeSingle();
            const globalB2BDiscount = settingsData?.value?.percentage || 0;

            // 2. Ürün Adını Çek
            const { data: productData } = await supabase.from('products').select('name').eq('id', id).single();
            setProductName(productData?.name || '');

            // 3. Varyantları Çek
            const { data: variantsData, error } = await supabase
                .from('product_variants')
                .select(`
id, name, sku, stock, base_price, is_active, discount_percentage, discount_start_date, discount_end_date
        `)
                .eq('product_id', id)
                .order('name');

            if (error) throw error;

            // 4. Veriyi Formatla
            const formatted: VariantDisplay[] = (variantsData || []).map((v: any) => {
                return {
                    id: v.id,
                    product_name: productData?.name || '',
                    name: v.name,
                    sku: v.sku,
                    stock: v.stock,
                    base_price: v.base_price,
                    is_active: v.is_active,
                    discount_percentage: v.discount_percentage || 0,
                    discount_start_date: v.discount_start_date,
                    discount_end_date: v.discount_end_date,
                    b2b_discount: globalB2BDiscount
                };
            });

            setVariants(formatted);

        } catch (err) {
            console.error("Veri hatası:", err);
            alert("Veriler yüklenirken hata oluştu.");
        } finally {
            setLoading(false);
        }
    }, [id]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    // STOK GÜNCELLEME
    const handleStockChange = async (variantId: string, newStock: number) => {
        if (newStock < 0) return;

        try {
            const { error } = await supabase
                .from('product_variants')
                .update({ stock: newStock })
                .eq('id', variantId);

            if (error) throw error;
            // Optimistic update
            setVariants(prev => prev.map(v => v.id === variantId ? { ...v, stock: newStock } : v));
        } catch (e) {
            alert("Stok güncellenemedi.");
        }
    };

    // AKTİFLİK GÜNCELLEME
    const toggleStatus = async (variantId: string, currentStatus: boolean) => {
        try {
            const { error } = await supabase.from('product_variants').update({ is_active: !currentStatus }).eq('id', variantId);
            if (error) throw error;
            setVariants(prev => prev.map(v => v.id === variantId ? { ...v, is_active: !currentStatus } : v));
        } catch (e) {
            alert("Durum güncellenemedi");
        }
    };

    // B2B FİYAT SYNC (Ana Fiyat x (1 - İskonto/100) -> variant_prices'a kaydet)
    const syncB2BPrice = async (variantId: string, basePrice: number, b2bDiscount: number) => {
        const b2bPrice = basePrice * (1 - b2bDiscount / 100);
        try {
            // B2B fiyat listesi ID=1 olarak upsert (mevcut yapı ile uyumlu)
            // pricing.ts en son aktif fiyatı alır, price_list_id filtrelemez
            const { error } = await supabase
                .from('variant_prices')
                .upsert({
                    variant_id: variantId,
                    price_list_id: 1, // B2B fiyat listesi
                    price: Math.round(b2bPrice * 100) / 100,
                    is_active: true
                }, { onConflict: 'variant_id, price_list_id' });

            if (error) throw error;
        } catch (e) {
            console.error('B2B fiyat sync hatası:', e);
        }
    };

    // BASE PRICE GÜNCELLEME + B2B Sync
    const handleBasePriceChange = async (variantId: string, val: number) => {
        if (val < 0) return;
        try {
            const { error } = await supabase.from('product_variants').update({ base_price: val }).eq('id', variantId);
            if (error) throw error;
            const variant = variants.find(v => v.id === variantId);
            setVariants(prev => prev.map(v => v.id === variantId ? { ...v, base_price: val } : v));
            // B2B fiyatını otomatik güncelle
            if (variant) {
                syncB2BPrice(variantId, val, variant.b2b_discount);
            }
        } catch (e) {
            alert("Ana fiyat güncellenemedi");
        }
    };

    // İNDİRİM GÜNCELLEME
    const handleDiscountChange = async (variantId: string, percentage: number) => {
        if (percentage < 0 || percentage > 100) return;
        try {
            const { error } = await supabase
                .from('product_variants')
                .update({ discount_percentage: percentage })
                .eq('id', variantId);
            if (error) throw error;
            setVariants(prev => prev.map(v => v.id === variantId ? { ...v, discount_percentage: percentage } : v));
        } catch (e) {
            alert("İndirim güncellenemedi");
        }
    };

    // İNDİRİM BİTİŞ TARİHİ GÜNCELLEME
    const handleDiscountEndDateChange = async (variantId: string, date: string) => {
        try {
            const { error } = await supabase
                .from('product_variants')
                .update({ discount_end_date: date || null })
                .eq('id', variantId);
            if (error) throw error;
            setVariants(prev => prev.map(v => v.id === variantId ? { ...v, discount_end_date: date || null } : v));
        } catch (e) {
            alert("İndirim bitiş tarihi güncellenemedi");
        }
    };

    if (loading && variants.length === 0) {
        return <div className="p-8 text-center">Yükleniyor...</div>;
    }

    return (
        <div className="min-h-screen bg-gray-50 p-8 text-xs">
            <div className="max-w-[1600px] mx-auto">
                <div className="flex justify-between items-center mb-6">
                    <div>
                        <Link to="/admin/products" className="text-gray-500 hover:text-gray-900 mb-2 inline-block">&larr; Ürünlere Dön</Link>
                        <h1 className="text-2xl font-bold text-gray-900">{productName} - Varyantlar</h1>
                    </div>
                    <button
                        onClick={() => setIsVariantModalOpen(true)}
                        className="bg-[#f0c961] hover:bg-[#e0b850] text-black font-semibold py-2 px-4 rounded-lg shadow-sm flex items-center gap-2"
                    >
                        <span className="text-lg leading-none">+</span> Yeni Varyant
                    </button>
                </div>

                <div className="overflow-x-auto bg-white rounded-xl shadow-sm border border-gray-200">
                    <table className="w-full text-left border-collapse whitespace-nowrap">
                        <thead className="bg-gray-100 border-b border-gray-200">
                            <tr>
                                <th className="p-3 font-bold text-gray-600 w-10 text-center">#</th>
                                <th className="p-3 font-bold text-gray-600 min-w-[150px]">Varyant Adı</th>
                                <th className="p-3 font-bold text-gray-600 w-32">SKU</th>
                                <th className="p-3 font-bold text-gray-600 w-24 text-center">Durum</th>
                                <th className="p-3 font-bold text-gray-600 w-24 text-center">Stok</th>
                                <th className="p-3 font-bold text-gray-900 bg-[#f0c961]/20 border-l border-r border-[#f0c961]/30 w-32 text-center">
                                    Ana Fiyat (TL)
                                </th>
                                <th className="p-3 font-bold text-indigo-700 bg-indigo-50 border-l border-indigo-100 w-28 text-center">
                                    B2B İskonto %
                                </th>
                                <th className="p-3 font-bold text-indigo-700 bg-indigo-50 border-r border-indigo-100 w-32 text-center">
                                    B2B Fiyat (TL)
                                </th>
                                <th className="p-3 font-bold text-red-600 bg-red-50 border-l border-red-100 w-24 text-center">
                                    İndirim %
                                </th>
                                <th className="p-3 font-bold text-red-600 bg-red-50 border-r border-red-100 w-36 text-center">
                                    Bitiş Tarihi
                                </th>
                                <th className="p-3 font-bold text-gray-600 text-right">İşlemler</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {variants.map((v, index) => (
                                <tr key={v.id} className={`hover:bg-gray-50 transition-colors ${!v.is_active ? 'opacity-60 bg-gray-50' : ''}`}>
                                    <td className="p-3 text-center text-gray-400">{index + 1}</td>
                                    <td className="p-3 font-medium text-gray-900">
                                        {v.name}
                                    </td>
                                    <td className="p-3 font-mono text-gray-500">
                                        {v.sku}
                                    </td>
                                    <td className="p-3 text-center">
                                        <button
                                            onClick={() => toggleStatus(v.id, v.is_active)}
                                            className={`w-6 h-6 rounded-full flex items-center justify-center transition-colors ${v.is_active ? 'bg-green-100 text-green-600' : 'bg-gray-200 text-gray-400'}`}
                                            title={v.is_active ? "Aktif (Pasif yap)" : "Pasif (Aktif yap)"}
                                        >
                                            <div className={`w-2.5 h-2.5 rounded-full ${v.is_active ? 'bg-green-500' : 'bg-gray-400'}`}></div>
                                        </button>
                                    </td>
                                    <td className="p-3">
                                        <input
                                            type="number"
                                            value={v.stock}
                                            onChange={(e) => handleStockChange(v.id, Number(e.target.value))}
                                            className="w-20 px-2 py-1 text-center border border-gray-200 rounded focus:ring-1 focus:ring-[#f0c961] focus:border-[#f0c961]"
                                        />
                                    </td>
                                    <td className="p-3 bg-[#f0c961]/5 border-l border-r border-[#f0c961]/10">
                                        <div className="flex items-center justify-center">
                                            <input
                                                type="number"
                                                value={v.base_price}
                                                onChange={(e) => handleBasePriceChange(v.id, Number(e.target.value))}
                                                className="w-24 px-2 py-1 text-center font-bold text-gray-900 bg-white border border-[#f0c961]/50 rounded focus:ring-2 focus:ring-[#f0c961] focus:border-transparent shadow-sm"
                                            />
                                        </div>
                                    </td>

                                    {/* B2B İskonto (read-only, global ayardan gelir) */}
                                    <td className="p-3 bg-indigo-50/30 border-l border-indigo-100/50">
                                        <div className="flex items-center justify-center gap-1">
                                            <span className="w-16 px-2 py-1 text-center font-bold text-indigo-600 bg-indigo-50 border border-indigo-200 rounded inline-block">
                                                {v.b2b_discount}
                                            </span>
                                            <span className="text-indigo-400 text-xs font-bold">%</span>
                                        </div>
                                    </td>

                                    {/* B2B Fiyat (otomatik hesaplanan, read-only) */}
                                    <td className="p-3 bg-indigo-50/30 border-r border-indigo-100/50">
                                        <div className="flex items-center justify-center">
                                            <span className="w-24 px-2 py-1 text-center font-bold text-indigo-700 bg-indigo-50 border border-indigo-200 rounded inline-block">
                                                {(v.base_price * (1 - v.b2b_discount / 100)).toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                            </span>
                                        </div>
                                    </td>

                                    {/* Kampanya İndirim Input */}
                                    <td className="p-3 bg-red-50/30 border-l border-red-100/50">
                                        <div className="flex items-center justify-center gap-1">
                                            <input
                                                type="number"
                                                min="0"
                                                max="100"
                                                step="1"
                                                value={v.discount_percentage || ''}
                                                onChange={(e) => handleDiscountChange(v.id, Number(e.target.value))}
                                                placeholder="0"
                                                className="w-16 px-2 py-1 text-center font-bold text-red-600 bg-white border border-red-200 rounded focus:ring-2 focus:ring-red-400 focus:border-transparent"
                                            />
                                            <span className="text-red-400 text-xs font-bold">%</span>
                                        </div>
                                    </td>

                                    {/* İndirim Bitiş Tarihi */}
                                    <td className="p-3 bg-red-50/30 border-r border-red-100/50">
                                        <input
                                            type="date"
                                            value={v.discount_end_date ? v.discount_end_date.split('T')[0] : ''}
                                            onChange={(e) => handleDiscountEndDateChange(v.id, e.target.value)}
                                            className="w-full px-2 py-1 text-center text-red-600 bg-white border border-red-200 rounded focus:ring-2 focus:ring-red-400 focus:border-transparent text-xs"
                                        />
                                    </td>

                                    <td className="p-3 text-right">
                                        <div className="flex items-center justify-end gap-2">
                                            <button
                                                onClick={() => {
                                                    setEditingVariant(v);
                                                    setIsVariantModalOpen(true);
                                                }}
                                                className="text-xs text-yellow-700 hover:text-yellow-900 bg-yellow-50 px-2 py-1 rounded"
                                            >
                                                Düzenle
                                            </button>
                                            <button
                                                onClick={() => handleDeleteVariant(v.id, v.name)}
                                                className="text-xs text-red-600 hover:text-red-900 bg-red-50 px-2 py-1 rounded"
                                            >
                                                Sil
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {id && (
                <VariantModal
                    isOpen={isVariantModalOpen}
                    onClose={() => {
                        setIsVariantModalOpen(false);
                        setEditingVariant(null); // Reset edit state on close
                    }}
                    onSave={fetchData}
                    productId={id}
                    editVariant={editingVariant}
                />
            )}
        </div>
    );
};

export default AdminProductDetail;
