import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';

import SimilarProducts from '../components/SimilarProducts';
import { supabase } from '../lib/supabaseClient';
import { getOrCreateActiveCart, dispatchCartUpdate } from '../lib/cart';
import { fetchUserRole, calculateVariantPrice } from '../lib/pricing';
import { useCurrency } from '../hooks/useCurrency';
import { Star } from 'lucide-react'; // Added import

// --- Types ---
interface Product {
    id: string;
    name: string;
    description: string | null;
    brand: string | null;
    slug: string;
    is_active: boolean;
    product_images?: { url: string; is_primary: boolean }[];
    product_categories?: { category_id: string }[];
}

interface Variant {
    id: string;
    product_id: string;
    name: string;
    sku: string;
    base_price: number;
    price: number;
    originalPrice: number;
    stock: number;
    is_active: boolean;
    discount_percentage: number;
    discount_start_date: string | null;
    discount_end_date: string | null;
    hasDiscount: boolean;
}

const ProductDetail: React.FC = () => {
    const { formatPrice } = useCurrency();
    const { slug } = useParams<{ slug: string }>();

    // --- State ---
    const [product, setProduct] = useState<Product | null>(null);
    const [variants, setVariants] = useState<Variant[]>([]);
    const [selectedVariant, setSelectedVariant] = useState<Variant | null>(null);
    const [quantity, setQuantity] = useState<number>(1);
    const [activeImage, setActiveImage] = useState<string | null>(null);
    const [reviewStats, setReviewStats] = useState<{ average: number; count: number }>({ average: 0, count: 0 });

    // Reset quantity when variant changes
    useEffect(() => {
        setQuantity(1);
    }, [selectedVariant]);

    const handleQuantityChange = (type: 'increase' | 'decrease') => {
        if (!selectedVariant) return;

        if (type === 'increase') {
            if (quantity < selectedVariant.stock) {
                setQuantity(prev => prev + 1);
            }
        } else {
            if (quantity > 1) {
                setQuantity(prev => prev - 1);
            }
        }
    };

    const [loading, setLoading] = useState<boolean>(true);
    const [error, setError] = useState<string | null>(null);
    const [addingToCart, setAddingToCart] = useState<boolean>(false);
    const [cartMessage, setCartMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

    // --- Fetch Data ---
    useEffect(() => {
        const fetchProductAndVariants = async () => {
            if (!slug) return;
            setLoading(true);
            setError(null);

            try {
                // 1. Ürünü Slug veya ID ile Çek
                const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(slug);
                const queryColumn = isUuid ? 'id' : 'slug';

                const { data: productData, error: productError } = await supabase
                    .from('products')
                    .select('id, name, description, brand, slug, is_active, product_images(url, is_primary), product_categories(category_id)')
                    .eq(queryColumn, slug)
                    .single();

                if (productError) throw productError;

                if (!productData) {
                    setError('Ürün bulunamadı.');
                    setLoading(false);
                    return;
                }

                if (!productData.is_active) {
                    setError('Bu ürün şu anda satışa kapalıdır.');
                    setLoading(false);
                    return;
                }

                setProduct(productData);

                // DEBUG: Kategori kontrolü
                console.log('Ürün kategorileri:', productData.product_categories);

                // Set Initial Active Image
                if (productData.product_images && productData.product_images.length > 0) {
                    const primary = productData.product_images.find((i: any) => i.is_primary);
                    setActiveImage(primary ? primary.url : productData.product_images[0].url);
                }

                // 2. Varyantları Çek (Active Only) - indirim bilgileri dahil
                const { data: variantsData, error: variantsError } = await supabase
                    .from('product_variants')
                    .select('id, product_id, name, sku, base_price, stock, is_active, discount_percentage, discount_start_date, discount_end_date')
                    .eq('product_id', productData.id)
                    .eq('is_active', true)
                    .order('base_price', { ascending: true });

                if (variantsError) throw variantsError;

                // 3. Kullanıcı Rolü ve Fiyat Hesaplama (Merkezi Logic)
                const userRole = await fetchUserRole();

                const variantsWithPrices = await Promise.all((variantsData || []).map(async (v) => {
                    const finalPrice = await calculateVariantPrice(
                        v.id,
                        v.base_price,
                        userRole,
                        v.discount_percentage || 0,
                        v.discount_start_date,
                        v.discount_end_date
                    );

                    // İndirim aktif mi kontrol et
                    const now = new Date();
                    const discountActive = (v.discount_percentage || 0) > 0 &&
                        (!v.discount_start_date || new Date(v.discount_start_date) <= now) &&
                        (!v.discount_end_date || new Date(v.discount_end_date) >= now);

                    return {
                        ...v,
                        price: finalPrice,
                        originalPrice: v.base_price,
                        hasDiscount: discountActive,
                        discount_percentage: v.discount_percentage || 0
                    };
                }));

                setVariants(variantsWithPrices);

                // Automatically select the first available variant
                const firstAvailableVariant = variantsWithPrices.find(v => v.stock > 0);
                if (firstAvailableVariant) {
                    setSelectedVariant(firstAvailableVariant);
                }

                // 4. Review Stats (Count & Average)
                const { data: reviewsData } = await supabase
                    .from('product_reviews')
                    .select('rating')
                    .eq('product_id', productData.id)
                    .eq('is_approved', true);

                if (reviewsData) {
                    const total = reviewsData.reduce((acc: any, r: any) => acc + r.rating, 0);
                    const count = reviewsData.length;
                    const average = count > 0 ? total / count : 0;
                    setReviewStats({ average, count });
                }

            } catch (err: any) {
                console.error('Veri çekme hatası:', err);
                setError('Ürün bilgileri yüklenirken bir hata oluştu.');
            } finally {
                setLoading(false);
            }
        };

        fetchProductAndVariants();
    }, [slug]);

    // --- Add to Cart ---
    const handleAddToCart = async () => {
        if (!selectedVariant) return;
        if (selectedVariant.stock <= 0) return;

        setAddingToCart(true);
        setCartMessage(null);

        try {
            // Check if user is logged in (optional - guests can also add to cart)
            const { data: { session } } = await supabase.auth.getSession();
            const userId = session?.user?.id; // undefined if not logged in (guest)

            // Get/Create Cart (works for both users and guests)
            const cartId = await getOrCreateActiveCart(userId);

            if (!cartId) {
                setCartMessage({ type: 'error', text: 'Sepet oluşturulamadı. Lütfen tekrar deneyin.' });
                setAddingToCart(false);
                return;
            }

            // Ürün Zaten Sepette Var mı?
            const { data: existingItem, error: fetchItemError } = await supabase
                .from('cart_items')
                .select('id, quantity')
                .eq('cart_id', cartId)
                .eq('variant_id', selectedVariant.id)
                .maybeSingle();

            if (fetchItemError) throw fetchItemError;

            if (existingItem) {
                // Güncelle
                const { error: updateError } = await supabase
                    .from('cart_items')
                    .update({ quantity: existingItem.quantity + quantity })
                    .eq('id', existingItem.id);

                if (updateError) throw updateError;
            } else {
                // Yeni Ekle
                const { error: insertError } = await supabase
                    .from('cart_items')
                    .insert({
                        cart_id: cartId,
                        variant_id: selectedVariant.id,
                        quantity: quantity
                    });

                if (insertError) throw insertError;
            }

            dispatchCartUpdate(); // Header'daki sepet sayısını güncelle
            setCartMessage({ type: 'success', text: 'Ürün başarıyla sepete eklendi!' });

        } catch (err: any) {
            console.error('Sepet hatası:', err);
            setCartMessage({ type: 'error', text: 'Sepete eklenirken bir hata oluştu.' });
        } finally {
            setAddingToCart(false);
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-[#fffaf4]">
                <div className="animate-spin rounded-full h-12 w-12 border-4 border-[#f0c961] border-t-transparent"></div>
            </div>
        );
    }

    if (error || !product) {
        return (
            <div className="min-h-screen flex flex-col items-center justify-center bg-[#fffaf4] px-4">
                <div className="bg-white p-8 rounded-2xl shadow-lg text-center max-w-md w-full border border-gray-100">
                    <div className="text-red-500 mb-4">
                        <svg className="w-16 h-16 mx-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                    </div>
                    <h2 className="text-xl font-bold text-gray-800 mb-2">Bir Sorun Oluştu</h2>
                    <p className="text-gray-600 mb-6">{error || 'Ürün bulunamadı.'}</p>
                    <Link to="/products" className="inline-block bg-[#f0c961] text-[#1a1a1a] font-bold px-6 py-3 rounded-xl hover:bg-[#e0b950] transition-colors">
                        Ürünlere Dön
                    </Link>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-[#fffaf4] py-8 px-4">
            <div className="container mx-auto max-w-6xl">

                {/* Tek Kart - Tüm Ürün Bilgileri */}
                <div className="bg-white rounded-3xl p-6 md:p-10 shadow-lg border border-gray-100 mb-8">
                    <div className="flex flex-col lg:flex-row gap-8">

                        {/* Sol: Ürün Görseli */}
                        <div className="w-full lg:w-2/5 flex flex-col gap-4">
                            {/* Zoom Container */}
                            <div
                                className="w-full bg-[#fdfcf8] rounded-2xl aspect-square flex items-center justify-center border border-gray-100 overflow-hidden shadow-sm relative group cursor-zoom-in"
                                onMouseMove={(e) => {
                                    const rect = e.currentTarget.getBoundingClientRect();
                                    const x = ((e.clientX - rect.left) / rect.width) * 100;
                                    const y = ((e.clientY - rect.top) / rect.height) * 100;
                                    const img = e.currentTarget.querySelector('img');
                                    if (img) {
                                        img.style.transformOrigin = `${x}% ${y}%`;
                                    }
                                }}
                                onMouseEnter={(e) => {
                                    const img = e.currentTarget.querySelector('img');
                                    if (img) img.style.transform = 'scale(2)';
                                }}
                                onMouseLeave={(e) => {
                                    const img = e.currentTarget.querySelector('img');
                                    if (img) {
                                        img.style.transform = 'scale(1)';
                                        img.style.transformOrigin = 'center center';
                                    }
                                }}
                            >
                                {activeImage ? (
                                    <img
                                        src={activeImage}
                                        alt={product.name}
                                        width={600}
                                        height={600}
                                        className="w-full h-full object-cover transition-transform duration-200 ease-out"
                                    />
                                ) : (
                                    <span className="text-9xl drop-shadow-xl filter grayscale opacity-80">📦</span>
                                )}
                                {/* Zoom Hint */}
                                <div className="absolute bottom-3 right-3 bg-black/50 text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                                    🔍 Yakınlaştırmak için fareyi hareket ettirin
                                </div>
                            </div>

                            {/* Thumbnail Gallery */}
                            {product.product_images && product.product_images.length > 1 && (
                                <div className="grid grid-cols-4 gap-2">
                                    {product.product_images.map((img, idx) => (
                                        <button
                                            key={idx}
                                            onClick={() => setActiveImage(img.url)}
                                            className={`
                                                relative aspect-square rounded-lg overflow-hidden border-2 transition-all
                                                ${activeImage === img.url
                                                    ? 'border-[#f0c961] ring-1 ring-[#f0c961] opacity-100'
                                                    : 'border-transparent hover:border-gray-200 opacity-70 hover:opacity-100'}
                                            `}
                                        >
                                            <img
                                                src={img.url}
                                                alt={`${product.name} ${idx + 1}`}
                                                loading="lazy"
                                                width={100}
                                                height={100}
                                                className="w-full h-full object-cover"
                                            />
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Sağ: Ürün Detayları, Varyantlar, Sepet */}
                        <div className="flex-1 flex flex-col">

                            {/* Marka & Durum */}
                            <div className="flex items-center gap-3 mb-3">
                                <span className="px-3 py-1 bg-gray-100 text-gray-600 text-xs font-bold uppercase tracking-wider rounded-full">
                                    {product.brand || 'İçel Solar Market'}
                                </span>
                                {product.is_active && (
                                    <span className="flex items-center gap-1 text-green-600 text-xs font-bold uppercase tracking-wider">
                                        <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
                                        Stokta
                                    </span>
                                )}
                            </div>

                            {/* Ürün Adı */}
                            <h1 className="text-2xl md:text-4xl font-black text-[#1a1a1a] mb-2 leading-tight">
                                {product.name}
                            </h1>

                            {/* Review Stars & Count */}
                            <div className="flex items-center gap-2 mb-6">
                                <div className="flex">
                                    {[1, 2, 3, 4, 5].map((star) => (
                                        <Star
                                            key={star}
                                            className={`w-4 h-4 ${star <= Math.round(reviewStats.average) ? 'text-[#f0c961] fill-[#f0c961]' : 'text-gray-200 fill-gray-100'}`}
                                        />
                                    ))}
                                </div>
                                <span className="text-sm text-gray-500 font-medium">
                                    {reviewStats.count} yorum
                                </span>
                            </div>

                            {/* Varyant Seçimi */}
                            {variants.length > 0 && (
                                <div className="mb-6">
                                    <label className="text-xs font-bold text-gray-500 uppercase tracking-wider block mb-3">
                                        Seçenek
                                    </label>
                                    <div className="flex flex-wrap gap-2">
                                        {variants.map((v) => {
                                            const isSelected = selectedVariant?.id === v.id;
                                            const hasStock = v.stock > 0;

                                            return (
                                                <button
                                                    key={v.id}
                                                    onClick={() => hasStock && setSelectedVariant(v)}
                                                    disabled={!hasStock}
                                                    className={`
                                                        px-4 py-2 rounded-lg border-2 font-semibold text-sm transition-all
                                                        ${isSelected
                                                            ? 'border-[#f0c961] bg-[#fffaf4] text-[#1a1a1a]'
                                                            : 'border-gray-200 bg-white text-gray-700 hover:border-[#f0c961]/50'}
                                                        ${!hasStock ? 'opacity-40 cursor-not-allowed line-through' : 'cursor-pointer'}
                                                    `}
                                                >
                                                    {v.name}
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>
                            )}

                            {/* Fiyat Bilgileri - İndirim desteği ile */}
                            {selectedVariant && (
                                <div className="mb-6">
                                    {/* İndirim Rozeti */}
                                    {selectedVariant.hasDiscount && (
                                        <div className="inline-flex items-center gap-2 mb-2">
                                            <span className="bg-red-500 text-white text-xs font-bold px-3 py-1 rounded-full animate-pulse">
                                                %{selectedVariant.discount_percentage} İNDİRİM
                                            </span>
                                        </div>
                                    )}

                                    {/* Büyük Toplam Fiyat */}
                                    <div className="flex items-baseline gap-3 mb-4">
                                        <span className={`text-3xl md:text-4xl font-black ${selectedVariant.hasDiscount ? 'text-red-600' : 'text-[#2d5a27]'}`}>
                                            {formatPrice(selectedVariant.price)}
                                        </span>
                                        {selectedVariant.hasDiscount && (
                                            <span className="text-xl text-gray-500 line-through decoration-red-500 decoration-2">
                                                {formatPrice(selectedVariant.originalPrice)}
                                            </span>
                                        )}
                                    </div>

                                    {/* Ürün Bilgi Tablosu */}
                                    <div className="space-y-2 text-sm">
                                        <div className="flex">
                                            <span className="text-gray-600 w-24">Marka</span>
                                            <span className="text-gray-400 mr-2">:</span>
                                            <span className="text-gray-800 font-medium">{product.brand || 'İçel Solar'}</span>
                                        </div>
                                        <div className="flex">
                                            <span className="text-gray-600 w-24">Stok Kodu</span>
                                            <span className="text-gray-400 mr-2">:</span>
                                            <span className="text-gray-800 font-medium">{selectedVariant.sku}</span>
                                        </div>
                                        <div className="flex">
                                            <span className="text-gray-600 w-24">Fiyat</span>
                                            <span className="text-gray-400 mr-2">:</span>
                                            <span className="text-gray-800 font-medium">
                                                {formatPrice(selectedVariant.price / 1.20)} + KDV
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {variants.length === 0 && (
                                <div className="p-4 bg-yellow-50 text-yellow-800 rounded-xl border border-yellow-200 text-center mb-6">
                                    Bu ürün için şu anda satışa açık seçenek bulunmamaktadır.
                                </div>
                            )}

                            {/* Miktar & Sepete Ekle */}
                            {selectedVariant && (
                                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4 mt-auto">
                                    {/* Miktar */}
                                    <div className="flex items-center gap-3 bg-gray-50 rounded-xl p-2 border border-gray-200">
                                        <button
                                            onClick={() => handleQuantityChange('decrease')}
                                            disabled={quantity <= 1}
                                            className="w-10 h-10 flex items-center justify-center bg-white rounded-lg shadow-sm font-bold text-gray-600 hover:text-[#f0c961] disabled:opacity-50 transition-colors"
                                        >
                                            -
                                        </button>
                                        <span className="text-xl font-bold text-[#1a1a1a] w-8 text-center">{quantity}</span>
                                        <button
                                            onClick={() => handleQuantityChange('increase')}
                                            disabled={quantity >= selectedVariant.stock}
                                            className="w-10 h-10 flex items-center justify-center bg-white rounded-lg shadow-sm font-bold text-gray-600 hover:text-[#f0c961] disabled:opacity-50 transition-colors"
                                        >
                                            +
                                        </button>
                                    </div>

                                    {/* Sepete Ekle Butonu */}
                                    <button
                                        onClick={handleAddToCart}
                                        disabled={addingToCart || selectedVariant.stock <= 0}
                                        className={`
                                            flex-1 py-4 px-8 rounded-xl font-black uppercase tracking-wider transition-all transform active:scale-95 flex items-center justify-center gap-3 shadow-lg
                                            ${selectedVariant.stock <= 0
                                                ? 'bg-gray-200 text-gray-500 cursor-not-allowed shadow-none'
                                                : 'bg-[#1a1a1a] text-[#f0c961] hover:bg-[#333] hover:shadow-xl'}
                                        `}
                                    >
                                        {addingToCart ? 'EKLENİYOR...' : (selectedVariant.stock <= 0 ? 'TÜKENDİ' : 'SEPETE EKLE')}
                                    </button>
                                </div>
                            )}

                            {/* Stok Bilgisi */}
                            {selectedVariant && (
                                <div className="text-xs text-gray-400 mt-3 font-medium">
                                    Stok: {selectedVariant.stock} Adet
                                </div>
                            )}

                            {/* Sepet Mesajı */}
                            {cartMessage && (
                                <div className={`mt-4 p-4 rounded-xl text-sm font-bold text-center ${cartMessage.type === 'success' ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
                                    {cartMessage.text}
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Ürün Bilgisi Bölümü */}
                {product.description && (
                    <div className="mt-12 mb-8">
                        {/* Tab Header */}
                        <div className="flex border-b border-gray-200">
                            <div className="px-6 py-3 bg-[#f0c961] text-[#1a1a1a] font-bold text-sm uppercase tracking-wider rounded-t-lg">
                                Ürün Bilgisi
                            </div>
                        </div>
                        {/* Content */}
                        <div className="bg-white border border-t-0 border-gray-200 rounded-b-lg p-6 md:p-8">
                            <p className="text-gray-700 text-base leading-relaxed whitespace-pre-line">
                                {product.description}
                            </p>
                        </div>
                    </div>
                )}

                {/* Yorumlar Butonu */}
                <div className="mt-8 mb-12 flex justify-center">
                    <Link
                        to={`/products/${product.slug}/reviews`}
                        className="bg-white border-2 border-gray-100 text-gray-800 font-bold py-4 px-8 rounded-2xl hover:border-[#f0c961] hover:bg-[#fffaf4] transition-all flex items-center gap-3 shadow-sm hover:shadow-md group"
                    >
                        <Star className="w-6 h-6 text-[#f0c961] fill-[#f0c961]" />
                        <span className="text-lg">Ürün Değerlendirmeleri ({reviewStats.count})</span>
                        <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center group-hover:bg-[#f0c961] transition-colors">
                            <span className="text-gray-600 group-hover:text-white font-bold">&rarr;</span>
                        </div>
                    </Link>


                </div>

                {/* Benzer Ürünler */}
                {product && product.product_categories && product.product_categories.length > 0 && (
                    <SimilarProducts
                        currentProductId={product.id}
                        categoryId={product.product_categories[0].category_id}
                    />
                )}

            </div>
        </div>
    );
};

export default ProductDetail;
