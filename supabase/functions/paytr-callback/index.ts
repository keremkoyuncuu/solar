// PayTR iFrame API - Ödeme Callback Handler
// Supabase Edge Function
// PayTR ödeme sonucunu bu endpoint'e POST olarak bildirir

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { encode as base64Encode } from "https://deno.land/std@0.168.0/encoding/base64.ts";

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// PayTR Credentials
const MERCHANT_KEY = Deno.env.get("PAYTR_MERCHANT_KEY") || "";
const MERCHANT_SALT = Deno.env.get("PAYTR_MERCHANT_SALT") || "";

// HMAC SHA256 doğrulama
async function hmacSha256(key: string, data: string): Promise<string> {
    const encoder = new TextEncoder();
    const cryptoKey = await crypto.subtle.importKey(
        "raw",
        encoder.encode(key),
        { name: "HMAC", hash: "SHA-256" },
        false,
        ["sign"]
    );
    const signature = await crypto.subtle.sign("HMAC", cryptoKey, encoder.encode(data));
    return base64Encode(new Uint8Array(signature));
}

serve(async (req) => {
    // CORS preflight
    if (req.method === "OPTIONS") {
        return new Response("ok", { headers: corsHeaders });
    }

    try {
        const supabaseClient = createClient(
            Deno.env.get("SUPABASE_URL") ?? "",
            Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
        );

        // PayTR POST olarak form data gönderir
        const formData = await req.formData();
        const callbackData: Record<string, string> = {};

        for (const [key, value] of formData.entries()) {
            callbackData[key] = value.toString();
        }

        console.log("=== PAYTR CALLBACK ===");
        console.log("Callback data:", JSON.stringify(callbackData));

        const merchantOid = callbackData.merchant_oid || "";
        const status = callbackData.status || "";
        const totalAmount = callbackData.total_amount || "";
        const hash = callbackData.hash || "";
        const failedReasonCode = callbackData.failed_reason_code || "";
        const failedReasonMsg = callbackData.failed_reason_msg || "";
        const testMode = callbackData.test_mode || "";
        const paymentType = callbackData.payment_type || "";

        // Hash doğrulama
        // hash = HMAC_SHA256(merchant_key, merchant_oid + merchant_salt + status + total_amount)
        const hashStr = merchantOid + MERCHANT_SALT + status + totalAmount;
        const expectedHash = await hmacSha256(MERCHANT_KEY, hashStr);

        if (hash !== expectedHash) {
            console.error("PAYTR Hash mismatch! Expected:", expectedHash, "Got:", hash);
            return new Response("PAYTR notification failed: bad hash", {
                status: 200, // PayTR her zaman 200 bekler
                headers: { "Content-Type": "text/plain" }
            });
        }

        console.log("Hash doğrulandı ✓");
        console.log("Sipariş No:", merchantOid);
        console.log("Durum:", status);
        console.log("Tutar:", totalAmount);

        const isSuccess = status === "success";

        // Siparişi bul (merchant_oid alfanümerik olarak gelir, orijinal order_no'yu yeniden oluştur)
        // ORB20261234 → ORB-20261234
        const originalOrderNo = merchantOid.startsWith("ORB")
            ? "ORB-" + merchantOid.slice(3)
            : merchantOid;

        const { data: order, error: orderError } = await supabaseClient
            .from("orders")
            .select("id, order_no")
            .eq("order_no", originalOrderNo)
            .single();

        if (orderError || !order) {
            console.error("Order not found for merchant_oid:", merchantOid);
            return new Response("OK", {
                status: 200,
                headers: { "Content-Type": "text/plain" }
            });
        }

        // Payment transaction güncelle (paytr provider olanı bul)
        const { data: transaction } = await supabaseClient
            .from("payment_transactions")
            .select("id")
            .eq("order_id", order.id)
            .order("created_at", { ascending: false })
            .limit(1)
            .single();

        if (transaction) {
            await supabaseClient
                .from("payment_transactions")
                .update({
                    status: isSuccess ? "success" : "failed",
                    bank_response_code: isSuccess ? "00" : failedReasonCode,
                    bank_response_message: isSuccess ? "Basarili" : failedReasonMsg,
                    error_code: isSuccess ? null : failedReasonCode,
                    error_message: isSuccess ? null : failedReasonMsg,
                    raw_response: callbackData,
                    updated_at: new Date().toISOString()
                })
                .eq("id", transaction.id);
        }

        // Sipariş durumunu güncelle
        await supabaseClient
            .from("orders")
            .update({
                status: isSuccess ? "paid" : "pending_payment",
                payment_status: isSuccess ? "paid" : "failed",
                payment_transaction_id: transaction?.id || null
            })
            .eq("id", order.id);

        // STOK DÜŞÜMÜ - Sadece ödeme başarılı olduğunda!
        if (isSuccess) {
            const { data: orderItems } = await supabaseClient
                .from("order_items")
                .select("variant_id, quantity")
                .eq("order_id", order.id);

            if (orderItems && orderItems.length > 0) {
                for (const item of orderItems) {
                    if (item.variant_id) {
                        await supabaseClient.rpc('decrement_variant_stock', {
                            p_variant_id: item.variant_id,
                            p_quantity: item.quantity
                        });
                    }
                }
                console.log("Stock decremented for PayTR order:", order.id);
            }
        }

        console.log("PayTR callback processed successfully");

        // PayTR "OK" yanıtı bekler
        return new Response("OK", {
            status: 200,
            headers: { "Content-Type": "text/plain" }
        });

    } catch (error) {
        console.error("PayTR callback error:", error);
        // PayTR hata durumunda bile 200 bekler
        return new Response("OK", {
            status: 200,
            headers: { "Content-Type": "text/plain" }
        });
    }
});
