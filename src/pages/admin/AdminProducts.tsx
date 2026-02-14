import React, { useEffect, useState, useMemo } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { Search } from 'lucide-react';
import { Link } from 'react-router-dom';
import ProductModal from '../../components/admin/ProductModal';
import ExcelImportModal from '../../components/admin/ExcelImportModal';

interface ProductSummary {
    id: string;
    name: string;
    brand: string;
    is_active: boolean;
    is_featured: boolean;
    total_variant_count: number;
    active_variant_count: number;
    category_count: number;
    category_names: string[];
    description?: string;
    slug?: string;
}

const AdminProducts: React.FC = () => {
    const [products, setProducts] = useState<ProductSummary[]>([]);
    const [loading, setLoading] = useState<boolean>(true);

    // Search State
    const [searchQuery, setSearchQuery] = useState('');

    // Modal State
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isImportModalOpen, setIsImportModalOpen] = useState(false);
    const [editingProduct, setEditingProduct] = useState<any | null>(null);

    const fetchProducts = async () => {
        setLoading(true);
        try {
            // 1. Ürünleri Çek (Marka ve varyantlar dahil, Kategori ilişkisi çıkarıldı)
            const { data: productsData, error } = await supabase
                .from('products')
                .select(`
                    id, name, slug, brand, description, is_active, is_featured, created_at,
                    product_variants(is_active)
                `)
                .order('created_at', { ascending: false });

            if (error) throw error;

            // 2. Kategori İlişkilerini ve İsimlerini Çek
            let categoryData: Record<string, { count: number; names: string[] }> = {};
            if (productsData && productsData.length > 0) {
                const productIds = productsData.map(p => p.id);
                const { data: catData } = await supabase
                    .from('product_categories')
                    .select('product_id, categories(name)')
                    .in('product_id', productIds);

                // Grupla ve İsimleri Topla
                if (catData) {
                    catData.forEach((item: any) => {
                        if (!categoryData[item.product_id]) {
                            categoryData[item.product_id] = { count: 0, names: [] };
                        }
                        categoryData[item.product_id].count++;
                        if (item.categories?.name) {
                            categoryData[item.product_id].names.push(item.categories.name);
                        }
                    });
                }
            }

            // 3. Verileri Birleştir
            const formattedData: ProductSummary[] = (productsData || []).map((p: any) => ({
                id: p.id,
                name: p.name,
                slug: p.slug,
                brand: p.brand || '-',
                description: p.description,
                is_active: p.is_active,
                is_featured: p.is_featured,
                total_variant_count: p.product_variants?.length || 0,
                active_variant_count: p.product_variants?.filter((v: any) => v.is_active).length || 0,
                category_count: categoryData[p.id]?.count || 0,
                category_names: categoryData[p.id]?.names || []
            }));

            setProducts(formattedData);
        } catch (err) {
            console.error("Error fetching products:", err);
            alert("Ürünler yüklenirken hata oluştu.");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchProducts();
    }, []);

    // Filtered products based on search
    const filteredProducts = useMemo(() => {
        if (!searchQuery.trim()) return products;
        const query = searchQuery.toLowerCase();
        return products.filter(p =>
            p.name.toLowerCase().includes(query) ||
            p.brand.toLowerCase().includes(query) ||
            p.slug?.toLowerCase().includes(query)
        );
    }, [products, searchQuery]);

    const handleStatusToggle = async (id: string, currentStatus: boolean) => {
        if (!window.confirm(`Ürünü ${currentStatus ? 'pasif' : 'aktif'} yapmak istediğinize emin misiniz?`)) return;

        try {
            const { error } = await supabase.from('products').update({ is_active: !currentStatus }).eq('id', id);
            if (error) throw error;
            fetchProducts();
        } catch (e) {
            console.error(e);
            alert("Durum güncellenemedi.");
        }
    };

    const handleDeleteProduct = async (id: string, name: string) => {
        if (!window.confirm(`"${name}" ürününü silmek istediğinize emin misiniz? \n\nUYARI: Bu işlem ürüne ait TÜM VARYANTLARI ve FİYATLARI da kalıcı olarak silecektir!`)) return;

        setLoading(true);
        try {
            // 1. Önce varyantların fiyatlarını sil
            // Varyant ID'lerini bul
            const { data: variants } = await supabase.from('product_variants').select('id').eq('product_id', id);
            const variantIds = variants?.map(v => v.id) || [];

            if (variantIds.length > 0) {
                // 1. Sepet öğelerini sil (FK Constraint)
                const { error: ciError } = await supabase.from('cart_items').delete().in('variant_id', variantIds);
                if (ciError) throw ciError;

                // 2. Varyant fiyatlarını sil
                const { error: vpError } = await supabase.from('variant_prices').delete().in('variant_id', variantIds);
                if (vpError) throw vpError;
            }

            // 3. Varyantları sil
            const { error: vError } = await supabase.from('product_variants').delete().eq('product_id', id);
            if (vError) throw vError;

            // 4. Kategori ilişkilerini sil
            const { error: cError } = await supabase.from('product_categories').delete().eq('product_id', id);
            if (cError) throw cError;

            // 5. Ürünü sil
            const { error: pError } = await supabase.from('products').delete().eq('id', id);
            if (pError) throw pError;

            alert("Ürün ve ilişkili tüm veriler başarıyla silindi.");
            fetchProducts();

        } catch (error: any) {
            console.error("Delete error:", error);
            if (error?.code === '23503') {
                alert("Bu ürün geçmiş siparişlerde yer aldığı için SİLİNEMEZ.\n\nVeri bütünlüğünü korumak adına, lütfen ürünü silmek yerine durumunu 'Pasif' olarak güncelleyerek gizleyin.");
            } else {
                alert("Ürün silinirken bir hata oluştu: " + (error?.message || "Bilinmeyen hata"));
            }
        } finally {
            setLoading(false);
        }
    };

    if (loading && products.length === 0) {
        return (
            <div className="min-h-screen bg-gray-50 p-8 flex justify-center">
                <div className="animate-spin rounded-full h-8 w-8 border-4 border-gray-900 border-t-transparent"></div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-50 p-8">
            <div className="max-w-7xl mx-auto">
                <div className="flex justify-between items-center mb-6">
                    <div>
                        <h1 className="text-3xl font-bold text-gray-900">Ürün Yönetimi</h1>
                        <p className="text-gray-500 text-sm mt-1">
                            {searchQuery ? `${filteredProducts.length} / ${products.length} ürün` : `Toplam ${products.length} ürün`}
                        </p>
                    </div>
                    <div className="flex gap-3">
                        <button
                            onClick={() => setIsImportModalOpen(true)}
                            className="bg-green-600 hover:bg-green-700 text-white font-semibold py-2 px-4 rounded-lg shadow-sm transition-colors flex items-center gap-2"
                        >
                            <span className="text-xl leading-none font-bold">⇪</span> Excel Yükle
                        </button>
                        <button
                            onClick={() => {
                                setEditingProduct(null);
                                setIsModalOpen(true);
                            }}
                            className="bg-[#f0c961] hover:bg-[#e0b850] text-black font-semibold py-2 px-4 rounded-lg shadow-sm transition-colors flex items-center gap-2"
                        >
                            <span className="text-xl leading-none font-bold">+</span> Yeni Ürün
                        </button>
                    </div>
                </div>

                {/* Search Box */}
                <div className="mb-6">
                    <div className="relative max-w-md">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                        <input
                            type="text"
                            placeholder="Ürün adı, marka veya slug ile ara..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#f0c961] focus:border-transparent transition-all"
                        />
                        {searchQuery && (
                            <button
                                onClick={() => setSearchQuery('')}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                            >
                                ✕
                            </button>
                        )}
                    </div>
                </div>

                <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                    <table className="w-full text-left border-collapse">
                        <thead className="bg-gray-100 border-b border-gray-200">
                            <tr>
                                <th className="p-4 font-semibold text-gray-600 text-sm w-64">Ürün Adı</th>
                                <th className="p-4 font-semibold text-gray-600 text-sm w-32">Marka</th>
                                <th className="p-4 font-semibold text-gray-600 text-sm text-center w-24">Durum</th>
                                <th className="p-4 font-semibold text-gray-600 text-sm text-center">Kategori</th>
                                <th className="p-4 font-semibold text-gray-600 text-sm text-center">Varyant</th>
                                <th className="p-4 font-semibold text-gray-600 text-sm text-right">İşlemler</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {filteredProducts.length === 0 ? (
                                <tr>
                                    <td colSpan={6} className="p-12 text-center text-gray-500 italic">
                                        {searchQuery ? `"${searchQuery}" için sonuç bulunamadı.` : 'Henüz bir ürün eklenmemiş. Yeni ürün ekleyerek başlayın.'}
                                    </td>
                                </tr>
                            ) : (
                                filteredProducts.map((product) => (
                                    <tr key={product.id} className="hover:bg-gray-50 transition-colors group">
                                        <td className="p-4 font-medium text-gray-900">
                                            <div className="flex items-center gap-2">
                                                <span>{product.name}</span>
                                                {product.is_featured && <span title="Vitrin Ürünü">⭐</span>}
                                            </div>
                                            <div className="text-[10px] text-gray-400 font-mono mt-0.5 truncate max-w-[200px]">{product.slug}</div>
                                        </td>
                                        <td className="p-4 text-gray-600 text-sm">{product.brand}</td>
                                        <td className="p-4 text-center">
                                            <button
                                                onClick={() => handleStatusToggle(product.id, product.is_active)}
                                                className={`inline-flex items-center px-2 py-1 rounded-md text-xs font-medium ring-1 ring-inset cursor-pointer transition-all hover:opacity-80 ${product.is_active
                                                    ? 'bg-green-50 text-green-700 ring-green-600/20'
                                                    : 'bg-red-50 text-red-700 ring-red-600/20'
                                                    }`}
                                            >
                                                {product.is_active ? 'Aktif' : 'Pasif'}
                                            </button>
                                        </td>
                                        <td className="p-4 text-center">
                                            {product.category_count === 0 ? (
                                                <span className="bg-red-100 text-red-600 px-2 py-1 rounded-full text-xs font-semibold">
                                                    Kategorisiz
                                                </span>
                                            ) : (
                                                <div className="flex flex-wrap justify-center gap-1">
                                                    {product.category_names.slice(0, 2).map((name, idx) => (
                                                        <span key={idx} className="bg-blue-50 text-blue-700 px-2 py-0.5 rounded text-xs font-medium">
                                                            {name}
                                                        </span>
                                                    ))}
                                                    {product.category_names.length > 2 && (
                                                        <span className="bg-gray-100 text-gray-600 px-2 py-0.5 rounded text-xs font-medium">
                                                            +{product.category_names.length - 2}
                                                        </span>
                                                    )}
                                                </div>
                                            )}
                                        </td>
                                        <td className="p-4 text-center">
                                            <div className="flex flex-col items-center gap-1">
                                                <span className="text-xs text-gray-500">{product.total_variant_count} Toplam</span>
                                                {product.active_variant_count > 0 && (
                                                    <span className="text-[10px] text-green-600 bg-green-50 px-1.5 rounded">{product.active_variant_count} Aktif</span>
                                                )}
                                            </div>
                                        </td>
                                        <td className="p-4 text-right">
                                            <div className="flex items-center justify-end gap-2 opacity-100 group-hover:opacity-100 transition-opacity">
                                                <Link
                                                    to={`/admin/products/${product.id}`}
                                                    className="inline-flex items-center px-3 py-1.5 bg-gray-100 text-gray-700 text-xs font-medium rounded hover:bg-gray-200 transition-colors"
                                                    title="Varyantları Yönet"
                                                >
                                                    Varyantlar
                                                </Link>
                                                <button
                                                    onClick={() => {
                                                        setEditingProduct(product);
                                                        setIsModalOpen(true);
                                                    }}
                                                    className="inline-flex items-center px-3 py-1.5 bg-yellow-50 text-yellow-700 text-xs font-medium rounded hover:bg-yellow-100 transition-colors"
                                                >
                                                    Düzenle
                                                </button>
                                                <button
                                                    onClick={() => handleDeleteProduct(product.id, product.name)}
                                                    className="inline-flex items-center px-3 py-1.5 bg-red-50 text-red-700 text-xs font-medium rounded hover:bg-red-100 transition-colors"
                                                >
                                                    Sil
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            <ProductModal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                onSave={fetchProducts}
                editProduct={editingProduct}
            />

            <ExcelImportModal
                isOpen={isImportModalOpen}
                onClose={() => setIsImportModalOpen(false)}
                onSave={() => {
                    setIsImportModalOpen(false);
                    fetchProducts();
                }}
            />
        </div>
    );
};

export default AdminProducts;
