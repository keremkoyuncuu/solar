import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import { Link } from 'react-router-dom';
import { fetchUserRole, calculateVariantPrice } from '../lib/pricing';
import { useCurrency } from '../hooks/useCurrency';
import { Truck, Trash2, Lock, ShieldCheck, ShoppingBag, ArrowLeft, ArrowRight } from 'lucide-react';

interface CartItem {
    id: string;
    quantity: number;
    product_variants: {
        id: string;
        name: string;
        base_price: number;
        stock: number;
        sku?: string;
    };
    unitPrice?: number;
    originalPrice?: number;
    hasDiscount?: boolean;
    discountPercentage?: number;
    lineTotal?: number;
}

const CartPage: React.FC = () => {
    const { formatPrice } = useCurrency();
    const [cartItems, setCartItems] = useState<CartItem[]>([]);
    const [cartTotal, setCartTotal] = useState<number>(0);
    const [loading, setLoading] = useState<boolean>(true);
    const [error, setError] = useState<string | null>(null);
    const [updating, setUpdating] = useState<string | null>(null);

    const fetchCart = async () => {
        if (cartItems.length === 0) setLoading(true);

        try {
            const { data: { user } } = await supabase.auth.getUser();

            let cartData;

            if (user) {
                // Logged in user - fetch by user_id
                const { data } = await supabase
                    .from('carts')
                    .select('id')
                    .eq('profile_id', user.id)
                    .eq('status', 'active')
                    .maybeSingle();
                cartData = data;
            } else {
                // Guest user - fetch by session_id
                const sessionId = localStorage.getItem('guest_session_id');
                if (!sessionId) {
                    setCartItems([]);
                    setCartTotal(0);
                    setLoading(false);
                    return;
                }

                const { data } = await supabase
                    .from('carts')
                    .select('id')
                    .eq('session_id', sessionId)
                    .eq('status', 'active')
                    .maybeSingle();
                cartData = data;
            }

            if (!cartData) { setCartItems([]); setCartTotal(0); setLoading(false); return; }

            const { data: itemsData } = await supabase
                .from('cart_items')
                .select(`
                    id, 
                    quantity, 
                    product_variants (
                        id, 
                        name, 
                        base_price,
                        discount_percentage,
                        discount_start_date,
                        discount_end_date,
                        products (
                            name, 
                            slug,
                            product_images (
                                url,
                                is_primary
                            )
                        ),
                        stock
                    )
                `)
                .eq('cart_id', cartData.id)
                .order('id', { ascending: true });

            if (itemsData) {
                // Rol Çekme ve Fiyat Hesaplama
                const userRole = await fetchUserRole();
                const now = new Date();

                const itemsWithPrices = await Promise.all(
                    itemsData.map(async (item: any) => {
                        const variant = item.product_variants;

                        // Önce B2B fiyatını hesapla
                        let basePrice = await calculateVariantPrice(variant.id, variant.base_price, userRole);

                        // İndirim aktif mi kontrol et
                        const discountActive = (variant.discount_percentage || 0) > 0 &&
                            (!variant.discount_start_date || new Date(variant.discount_start_date) <= now) &&
                            (!variant.discount_end_date || new Date(variant.discount_end_date) >= now);

                        // İndirimli fiyatı hesapla
                        const unitPrice = discountActive
                            ? basePrice * (1 - variant.discount_percentage / 100)
                            : basePrice;

                        return {
                            ...item,
                            unitPrice,
                            originalPrice: discountActive ? basePrice : undefined,
                            hasDiscount: discountActive,
                            discountPercentage: discountActive ? variant.discount_percentage : 0,
                            lineTotal: unitPrice * item.quantity
                        } as CartItem;
                    })
                );

                setCartItems(itemsWithPrices);
                setCartTotal(itemsWithPrices.reduce((sum: number, item: CartItem) => sum + (item.lineTotal || 0), 0));
            }
        } catch (err) {
            console.error("Beklenmeyen hata:", err);
            setError("Bir hata oluştu.");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { fetchCart(); }, []);

    const handleUpdateQuantity = async (item: CartItem, change: number) => {
        setUpdating(item.id);
        try {
            if (change === 1) {
                if (item.quantity >= item.product_variants.stock) {
                    alert(`Bu üründen stokta sadece ${item.product_variants.stock} adet bulunmaktadır.`);
                    return;
                }
                await supabase.from('cart_items').update({ quantity: item.quantity + 1 }).eq('id', item.id);
            } else if (change === -1) {
                if (item.quantity > 1) {
                    await supabase.from('cart_items').update({ quantity: item.quantity - 1 }).eq('id', item.id);
                } else {
                    if (window.confirm("Bu ürünü silmek istediğinize emin misiniz?")) {
                        await supabase.from('cart_items').delete().eq('id', item.id);
                    } else {
                        setUpdating(null);
                        return;
                    }
                }
            }
            await fetchCart();
        } catch (error) { console.error(error); alert("Hata oluştu."); } finally { setUpdating(null); }
    };

    const handleRemoveItem = async (itemId: string) => {
        if (!window.confirm("Bu ürünü silmek istediğinize emin misiniz?")) return;
        setUpdating(itemId);
        try {
            await supabase.from('cart_items').delete().eq('id', itemId);
            await fetchCart();
        } catch (error) { console.error(error); alert("Hata oluştu."); } finally { setUpdating(null); }
    };

    const handleEmptyCart = async () => {
        if (!window.confirm("Sepetteki tüm ürünleri silmek istediğinize emin misiniz?")) return;
        setLoading(true);
        try {
            // Find current cart id - both for users and guests
            const { data: { user } } = await supabase.auth.getUser();

            let cartData;
            if (user) {
                // Logged in user
                const { data } = await supabase.from('carts').select('id').eq('profile_id', user.id).eq('status', 'active').maybeSingle();
                cartData = data;
            } else {
                // Guest user
                const sessionId = localStorage.getItem('guest_session_id');
                if (sessionId) {
                    const { data } = await supabase.from('carts').select('id').eq('session_id', sessionId).eq('status', 'active').maybeSingle();
                    cartData = data;
                }
            }

            if (cartData) {
                await supabase.from('cart_items').delete().eq('cart_id', cartData.id);
                // Header'daki sepet sayısını güncelle
                window.dispatchEvent(new CustomEvent('cartUpdated'));
                fetchCart();
            }
        } catch (error) {
            console.error(error);
            alert('Sepet boşaltılırken bir hata oluştu.');
        } finally {
            setLoading(false);
        }
    };

    // --- Calculations ---
    // Prices are VAT-INCLUSIVE
    const grossTotal = cartTotal;

    if (loading && cartItems.length === 0) return <div className="p-8 flex justify-center bg-[#fefcf5] min-h-screen"><div className="animate-spin h-12 w-12 border-4 border-[#6D4C41] rounded-full border-t-transparent"></div></div>;

    if (error) return (
        <div className="min-h-screen bg-[#fefcf5] flex items-center justify-center p-4">
            <div className="bg-white border border-gray-200 p-12 rounded-2xl shadow-lg text-center max-w-lg w-full">
                <div className="text-red-500 text-6xl mb-6 mx-auto">⚠️</div>
                <h2 className="text-2xl font-black mb-4 text-[#1a1a1a]">{error}</h2>
                <Link to="/login" className="bg-[#6D4C41] text-white font-bold py-3 px-8 rounded-full shadow-lg hover:bg-[#5D4037] transition-colors inline-block uppercase tracking-wide">Giriş Yap</Link>
            </div>
        </div>
    );

    return (
        <div className="min-h-screen bg-[#f8f9fa] pb-20">
            {/* Shipping Bar */}
            {/* Shipping Bar (Informational) */}
            {cartItems.length > 0 && (
                <div className="bg-[#FFF3E0] border-b border-[#FFE0B2] py-3 px-4">
                    <div className="container mx-auto max-w-7xl flex items-center justify-center text-sm font-medium text-[#E65100]">
                        <Truck className="w-5 h-5 mr-2" />
                        <span>Kargo ücreti <span className="font-bold">alıcıya aittir</span> ve teslimat sırasında ödenecektir.</span>
                    </div>
                </div>
            )}

            <div className="container mx-auto px-4 max-w-7xl mt-8">
                {cartItems.length === 0 ? (
                    <div className="text-center py-24 bg-white border border-gray-100 rounded-2xl shadow-sm flex flex-col items-center justify-center">
                        <div className="w-40 h-40 bg-gray-50 rounded-full flex items-center justify-center mb-6">
                            <ShoppingBag className="w-20 h-20 text-gray-300" />
                        </div>
                        <h2 className="text-2xl font-bold text-gray-900 mb-2">Sepetiniz Boş</h2>
                        <p className="text-gray-500 mb-8 max-w-md">Henüz sepetinize ürün eklemediniz.</p>
                        <Link to="/products" className="bg-[#6D4C41] hover:bg-[#5D4037] text-white font-bold py-4 px-12 rounded-lg shadow-lg transition-all uppercase tracking-wide flex items-center gap-3">
                            <ArrowLeft className="w-5 h-5" />
                            Alışverişe Başla
                        </Link>
                    </div>
                ) : (
                    <div className="flex flex-col lg:flex-row gap-8">
                        {/* LEFT COLUMN: Cart Items */}
                        <div className="lg:w-[70%] space-y-6">
                            <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
                                <div className="px-6 py-4 border-b border-gray-100 bg-gray-50">
                                    <h2 className="text-lg font-bold text-[#6D4C41] flex items-center gap-2">
                                        SEPET DETAYI <span className="text-sm font-normal text-gray-500">({cartItems.length} Ürün)</span>
                                    </h2>
                                </div>

                                <div className="divide-y divide-gray-100">
                                    {cartItems.map((item) => {
                                        // @ts-ignore
                                        const product = item.product_variants?.products;
                                        // @ts-ignore
                                        const images = product?.product_images || [];
                                        const primaryImage = images.find((img: any) => img.is_primary)?.url || images[0]?.url;

                                        return (
                                            <div key={item.id} className="p-6 flex flex-col sm:flex-row gap-6 items-center sm:items-start group transition-colors hover:bg-gray-50/50">
                                                {/* Image */}
                                                <div className="w-24 h-24 bg-white rounded border border-gray-200 flex-shrink-0 flex items-center justify-center p-2">
                                                    {primaryImage ? (
                                                        <img
                                                            src={primaryImage}
                                                            alt={product?.name}
                                                            loading="lazy"
                                                            width={96}
                                                            height={96}
                                                            className="w-full h-full object-cover"
                                                        />
                                                    ) : (
                                                        <ShoppingBag className="w-10 h-10 text-gray-300" />
                                                    )}
                                                </div>

                                                {/* Details */}
                                                <div className="flex-1 space-y-1 text-center sm:text-left w-full">
                                                    <h3 className="font-bold text-gray-900 text-lg leading-tight">
                                                        {product?.name || item.product_variants.name}
                                                    </h3>
                                                    {item.product_variants.name !== product?.name && (
                                                        <div className="text-sm text-gray-500">{item.product_variants.name}</div>
                                                    )}
                                                    <div className="text-xs text-gray-400 font-mono">
                                                        Kod: ORB-{item.product_variants.id.slice(0, 4)}
                                                    </div>
                                                </div>

                                                {/* Quantity */}
                                                <div className="flex items-center border border-gray-300 rounded overflow-hidden h-9 bg-white shadow-sm">
                                                    <button
                                                        onClick={() => handleUpdateQuantity(item, -1)}
                                                        disabled={updating === item.id}
                                                        className="w-9 h-full flex items-center justify-center text-gray-600 hover:bg-gray-100 font-bold transition-colors disabled:opacity-50"
                                                    >
                                                        -
                                                    </button>
                                                    <div className="w-12 h-full flex items-center justify-center font-bold text-gray-900 border-l border-r border-gray-300 text-sm">
                                                        {item.quantity}
                                                    </div>
                                                    <button
                                                        onClick={() => handleUpdateQuantity(item, 1)}
                                                        disabled={updating === item.id}
                                                        className="w-9 h-full flex items-center justify-center text-gray-600 hover:bg-gray-100 font-bold transition-colors disabled:opacity-50"
                                                    >
                                                        +
                                                    </button>
                                                </div>

                                                {/* Price */}
                                                <div className="text-center sm:text-right min-w-[120px]">
                                                    {item.hasDiscount && item.originalPrice && (
                                                        <div className="flex items-center justify-end gap-2 mb-1">
                                                            <span className="bg-red-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded">
                                                                %{item.discountPercentage}
                                                            </span>
                                                            <span className="text-sm text-gray-400 line-through decoration-red-500">
                                                                {formatPrice(item.originalPrice * item.quantity)}
                                                            </span>
                                                        </div>
                                                    )}
                                                    <div className={`font-bold text-xl ${item.hasDiscount ? 'text-red-600' : 'text-[#1a1a1a]'}`}>
                                                        {formatPrice(item.lineTotal || 0)}
                                                    </div>
                                                </div>

                                                {/* Delete */}
                                                <button
                                                    onClick={() => handleRemoveItem(item.id)}
                                                    className="p-2 text-gray-400 hover:text-red-600 transition-colors rounded-full hover:bg-red-50"
                                                    title="Sepetten Sil"
                                                >
                                                    <Trash2 className="w-5 h-5" />
                                                </button>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>

                            <div className="flex justify-between items-center pt-2">
                                <Link to="/products" className="inline-flex items-center gap-2 text-gray-600 font-medium hover:text-[#6D4C41] transition-colors py-3 px-6 bg-white border border-gray-300 rounded-lg shadow-sm hover:shadow-md">
                                    <ArrowLeft className="w-4 h-4" />
                                    Alışverişe Devam Et
                                </Link>

                                <button
                                    onClick={handleEmptyCart}
                                    className="inline-flex items-center gap-2 text-red-600 font-medium hover:text-red-700 hover:bg-red-50 py-3 px-6 rounded-lg transition-colors"
                                >
                                    <Trash2 className="w-4 h-4" />
                                    Sepeti Boşalt
                                </button>
                            </div>
                        </div>

                        {/* RIGHT COLUMN: Summary */}
                        <div className="lg:w-[30%]">
                            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 sticky top-4">
                                <h3 className="text-lg font-bold text-[#1a1a1a] mb-6 pb-4 border-b border-gray-100 uppercase tracking-wide">
                                    Sepet Özeti
                                </h3>

                                <div className="space-y-4 mb-8 text-sm">
                                    <div className="flex justify-between text-gray-600">
                                        <span>Ara Toplam</span>
                                        <span className="font-medium">{formatPrice(grossTotal)}</span>
                                    </div>


                                    <div className="flex justify-between items-center text-gray-600 pt-2 pb-2">
                                        <span>Kargo Ücreti</span>
                                        <span className="text-gray-900 font-medium text-xs">Alıcı Ödemeli</span>
                                    </div>
                                </div>

                                <div className="flex justify-between items-end mb-8 pt-6 border-t border-gray-200">
                                    <span className="text-base font-bold text-gray-800 uppercase">Genel Toplam</span>
                                    <div className="text-right">
                                        <span className="block text-2xl font-black text-[#6D4C41] leading-none">
                                            {formatPrice(grossTotal)}
                                        </span>
                                        {/* <span className="text-[10px] text-gray-400 mt-1 block">KDV Dahil, Kargo Hariç</span> */}
                                    </div>
                                </div>

                                <Link to="/checkout" className="w-full bg-[#6D4C41] text-white font-bold py-4 rounded-lg shadow-md hover:shadow-lg hover:bg-[#5D4037] transition-all flex items-center justify-center gap-2 uppercase tracking-wider text-sm mb-6">
                                    Alışverişi Tamamla
                                    <ArrowRight className="w-5 h-5" />
                                </Link>

                                <div className="flex flex-col gap-3">
                                    <div className="flex items-center gap-3 text-xs text-gray-500 bg-gray-50 p-3 rounded border border-gray-100">
                                        <Lock className="w-4 h-4 text-gray-400" />
                                        <span>256 Bit SSL ile güvenli ödeme.</span>
                                    </div>
                                    <div className="flex items-center gap-3 text-xs text-gray-500 bg-gray-50 p-3 rounded border border-gray-100">
                                        <ShieldCheck className="w-4 h-4 text-gray-400" />
                                        <span>%100 Orijinal Ürün Garantisi.</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default CartPage;
