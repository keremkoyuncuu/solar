import { supabase } from './supabaseClient';

/**
 * Fetches the current user's role from the profiles table.
 * Returns 'b2b' or 'b2c' (default 'b2c' if null/guest).
 */
export const fetchUserRole = async (): Promise<string> => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return 'b2c';

    const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', session.user.id)
        .maybeSingle();

    return profile?.role || 'b2c';
};

/**
 * Global B2B iskonto oranını app_settings'den çeker.
 * Sonuç cache'lenir (sayfa içi).
 */
let _cachedB2BDiscount: number | null = null;
export const fetchB2BDiscount = async (): Promise<number> => {
    if (_cachedB2BDiscount !== null) return _cachedB2BDiscount;

    const { data } = await supabase
        .from('app_settings')
        .select('value')
        .eq('key', 'b2b_discount_percentage')
        .maybeSingle();

    const percentage: number = data?.value?.percentage ?? 0;
    _cachedB2BDiscount = percentage;
    return percentage;
};

/**
 * İndirim bilgisi interface'i
 */
export interface PriceResult {
    finalPrice: number;
    originalPrice: number;
    hasDiscount: boolean;
    discountPercentage: number;
}

/**
 * İndirimin aktif olup olmadığını kontrol eder
 */
export const isDiscountActive = (
    discountPercentage: number,
    startDate?: string | null,
    endDate?: string | null
): boolean => {
    if (!discountPercentage || discountPercentage <= 0) return false;

    const now = new Date();

    if (startDate && new Date(startDate) > now) return false;
    if (endDate && new Date(endDate) < now) return false;

    return true;
};

/**
 * İndirimli fiyat hesaplar
 */
export const applyDiscount = (
    price: number,
    discountPercentage: number
): number => {
    if (discountPercentage <= 0 || discountPercentage > 100) return price;
    return price * (1 - discountPercentage / 100);
};

/**
 * Calculates the selling price for a variant based on the user's role and discount.
 * 
 * Logic:
 * 1. If role is NOT 'b2b', use basePrice + campaign discount.
 * 2. If role IS 'b2b', calculate: basePrice × (1 - b2bDiscount/100). No campaign discount.
 */
export const calculateVariantPrice = async (
    _variantId: string,
    basePrice: number,
    userRole: string,
    discountPercentage: number = 0,
    discountStartDate?: string | null,
    discountEndDate?: string | null
): Promise<number> => {
    let price = basePrice;

    if (userRole === 'b2b') {
        // B2B: sadece global iskonto uygulanır, kampanya indirimi YOK
        const b2bDiscount = await fetchB2BDiscount();
        price = basePrice * (1 - b2bDiscount / 100);
    } else {
        // B2C: kampanya indirimi uygula
        if (isDiscountActive(discountPercentage, discountStartDate, discountEndDate)) {
            price = applyDiscount(price, discountPercentage);
        }
    }

    return price;
};

/**
 * Varyant için tam fiyat bilgisi döndürür (indirim detayları dahil)
 */
export const calculateVariantPriceWithDetails = async (
    _variantId: string,
    basePrice: number,
    userRole: string,
    discountPercentage: number = 0,
    discountStartDate?: string | null,
    discountEndDate?: string | null
): Promise<PriceResult> => {
    if (userRole === 'b2b') {
        // B2B: sadece global iskonto — ana fiyatı üstü çizili göster
        const b2bDiscount = await fetchB2BDiscount();
        const b2bPrice = basePrice * (1 - b2bDiscount / 100);
        return {
            finalPrice: b2bPrice,
            originalPrice: basePrice,
            hasDiscount: b2bDiscount > 0,
            discountPercentage: b2bDiscount
        };
    }

    // B2C: kampanya indirimi uygula
    const hasDiscount = isDiscountActive(discountPercentage, discountStartDate, discountEndDate);
    const finalPrice = hasDiscount ? applyDiscount(basePrice, discountPercentage) : basePrice;

    return {
        finalPrice,
        originalPrice: basePrice,
        hasDiscount,
        discountPercentage: hasDiscount ? discountPercentage : 0
    };
};
