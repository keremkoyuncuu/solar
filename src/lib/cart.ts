import { supabase } from './supabaseClient';
import { getOrCreateGuestSessionId, clearGuestSession } from './guestSession';

/**
 * Gets the existing active cart or creates a new one.
 * Now supports both registered users and guest users.
 * 
 * @param userId - Optional user ID (if logged in)
 * @returns Cart ID or null if error
 */
export const getOrCreateActiveCart = async (userId?: string): Promise<string | null> => {
    try {
        // ============================================
        // SCENARIO 1: REGISTERED USER (userId provided)
        // ============================================
        if (userId) {
            // Wait for Profile (Retry Mechanism)
            let profileExists = false;
            for (let i = 0; i < 5; i++) {
                const { data } = await supabase.from('profiles').select('id').eq('id', userId).maybeSingle();
                if (data) {
                    profileExists = true;
                    break;
                }
                await new Promise(resolve => setTimeout(resolve, 500));
            }

            if (!profileExists) {
                console.warn("Profile check timed out, attempting cart creation anyway.");
            }

            // Check for existing active cart
            const { data: existingCart } = await supabase
                .from('carts')
                .select('id')
                .eq('profile_id', userId)
                .eq('status', 'active')
                .maybeSingle();

            if (existingCart) {
                return existingCart.id;
            }

            // Try to insert new cart
            const { data: newCart, error: insertError } = await supabase
                .from('carts')
                .insert({ profile_id: userId, status: 'active', is_guest: false })
                .select('id')
                .single();

            if (insertError) {
                // Handle race condition OR existing inactive cart blocking unique constraint
                // Check for formatted 23505 OR generic 409 conflict
                if (insertError.code === '23505' || insertError.code === '409' || insertError.message?.includes('duplicate')) {
                    // 1. Check if active cart exists (race condition)
                    const { data: retryCart } = await supabase
                        .from('carts')
                        .select('id')
                        .eq('profile_id', userId)
                        .eq('status', 'active')
                        .maybeSingle();

                    if (retryCart) return retryCart.id;

                    // 2. If no active cart, but constraint failed, there must be an inactive/converted cart. Delete it.
                    console.log("Collision with inactive cart detected. Cleaning up...");

                    // Find ANY cart for this profile to delete it properly
                    // logic: the error means a cart exists for this profile_id. Find it.
                    const { data: zombieCart } = await supabase
                        .from('carts')
                        .select('id')
                        .eq('profile_id', userId)
                        .maybeSingle(); // unique constraint ensures at most one exists

                    if (zombieCart) {
                        // Delete items first to avoid FK constraint error
                        await supabase.from('cart_items').delete().eq('cart_id', zombieCart.id);
                        // Delete the cart
                        await supabase.from('carts').delete().eq('id', zombieCart.id);
                    } else {
                        // Just in case we can't find it but error persists (weird state), try raw delete by profile
                        await supabase.from('carts').delete().eq('profile_id', userId);
                    }

                    // 3. Retry insert
                    const { data: finalCart, error: finalError } = await supabase
                        .from('carts')
                        .insert({ profile_id: userId, status: 'active', is_guest: false })
                        .select('id')
                        .single();

                    if (finalCart) return finalCart.id;
                    if (finalError) throw finalError;
                }

                console.error("Cart insert error:", insertError);
                throw insertError;
            }

            return newCart.id;
        }
        // ============================================
        // SCENARIO 2: GUEST USER (no userId)
        // ============================================
        else {
            const sessionId = getOrCreateGuestSessionId();

            // Check for existing guest cart
            const { data: existingCart } = await supabase
                .from('carts')
                .select('id')
                .eq('session_id', sessionId)
                .eq('status', 'active')
                .maybeSingle();

            if (existingCart) {
                return existingCart.id;
            }

            // Create new guest cart
            const { data: newCart, error: insertError } = await supabase
                .from('carts')
                .insert({
                    session_id: sessionId,
                    status: 'active',
                    is_guest: true
                })
                .select('id')
                .single();

            if (insertError) {
                console.error("Guest cart insert error:", insertError);
                throw insertError;
            }

            return newCart.id;
        }

    } catch (error) {
        console.error("Error in getOrCreateActiveCart:", error);
        return null;
    }
};

/**
 * Merge guest cart to user cart when user logs in
 * Transfers all cart items from guest session to user account
 * 
 * @param userId - The logged-in user's ID
 */
export const mergeGuestCartToUser = async (userId: string): Promise<void> => {
    try {
        const sessionId = localStorage.getItem('guest_session_id');
        if (!sessionId) return; // No guest session to merge

        // Find guest cart
        const { data: guestCart } = await supabase
            .from('carts')
            .select('id')
            .eq('session_id', sessionId)
            .eq('status', 'active')
            .maybeSingle();

        if (!guestCart) {
            clearGuestSession();
            return;
        }

        // Check if user already has an active cart
        const { data: userCart } = await supabase
            .from('carts')
            .select('id')
            .eq('profile_id', userId)
            .eq('status', 'active')
            .maybeSingle();

        if (userCart) {
            // User has existing cart - merge items
            const { data: guestItems } = await supabase
                .from('cart_items')
                .select('variant_id, quantity')
                .eq('cart_id', guestCart.id);

            if (guestItems && guestItems.length > 0) {
                for (const guestItem of guestItems) {
                    // Check if item exists in user cart
                    const { data: existingItem } = await supabase
                        .from('cart_items')
                        .select('id, quantity')
                        .eq('cart_id', userCart.id)
                        .eq('variant_id', guestItem.variant_id)
                        .maybeSingle();

                    if (existingItem) {
                        // Update quantity
                        await supabase
                            .from('cart_items')
                            .update({ quantity: existingItem.quantity + guestItem.quantity })
                            .eq('id', existingItem.id);
                    } else {
                        // Add new item
                        await supabase
                            .from('cart_items')
                            .insert({
                                cart_id: userCart.id,
                                variant_id: guestItem.variant_id,
                                quantity: guestItem.quantity
                            });
                    }
                }
            }

            // Delete guest cart items and cart
            await supabase.from('cart_items').delete().eq('cart_id', guestCart.id);
            await supabase.from('carts').delete().eq('id', guestCart.id);
        } else {
            // No user cart - convert guest cart to user cart
            const { error: updateError } = await supabase
                .from('carts')
                .update({
                    profile_id: userId,
                    session_id: null,
                    is_guest: false
                })
                .eq('id', guestCart.id);

            if (updateError) {
                // Conflict? User might have a non-active cart that is blocking this update
                console.warn("Error converting guest cart to user cart:", updateError);

                // If conflict, we can't convert. 
                // Strategy: Delete the conflicting user cart (if not active/important) or just delete this guest cart and start fresh?
                // Safer: Delete this guest cart's items and the cart itself, user starts with empty/new cart to avoid error loop.
                console.log("Conflict detected during merge. improved cleanup...");
                await supabase.from('cart_items').delete().eq('cart_id', guestCart.id);
                await supabase.from('carts').delete().eq('id', guestCart.id);
            }
        }

        // Clear guest session
        clearGuestSession();

    } catch (error) {
        console.error('Error merging guest cart:', error);
    }
};

/**
 * Get cart ID for current user (logged in or guest)
 * Helper function to get cart without creating one
 */
export const getCurrentCartId = async (userId?: string): Promise<string | null> => {
    try {
        if (userId) {
            const { data } = await supabase
                .from('carts')
                .select('id')
                .eq('profile_id', userId)
                .eq('status', 'active')
                .maybeSingle();

            return data?.id || null;
        } else {
            const sessionId = localStorage.getItem('guest_session_id');
            if (!sessionId) return null;

            const { data } = await supabase
                .from('carts')
                .select('id')
                .eq('session_id', sessionId)
                .eq('status', 'active')
                .maybeSingle();

            return data?.id || null;
        }
    } catch (error) {
        console.error('Error getting current cart:', error);
        return null;
    }
};

/**
 * Dispatch cart update event to refresh cart count in Header
 * Call this after adding/removing items from cart
 */
export const dispatchCartUpdate = () => {
    window.dispatchEvent(new CustomEvent('cartUpdated'));
};
