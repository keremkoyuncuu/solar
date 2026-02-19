// PayTR iFrame API - Token Alma
// Supabase Edge Function

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { encode as base64Encode } from "https://deno.land/std@0.168.0/encoding/base64.ts";

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// PayTR Credentials
const MERCHANT_ID = Deno.env.get("PAYTR_MERCHANT_ID") || "";
const MERCHANT_KEY = Deno.env.get("PAYTR_MERCHANT_KEY") || "";
const MERCHANT_SALT = Deno.env.get("PAYTR_MERCHANT_SALT") || "";

// URLs
const MERCHANT_OK_URL = Deno.env.get("PAYTR_OK_URL") || "https://icelsolarmarket.com/payment/paytr-success";
const MERCHANT_FAIL_URL = Deno.env.get("PAYTR_FAIL_URL") || "https://icelsolarmarket.com/payment/paytr-fail";

// HMAC SHA256 oluştur
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

// Türkçe karakterleri ASCII'ye çevir
function sanitizeTurkish(text: string): string {
    const map: Record<string, string> = {
        'ç': 'c', 'Ç': 'C', 'ğ': 'g', 'Ğ': 'G',
        'ı': 'i', 'İ': 'I', 'ö': 'o', 'Ö': 'O',
        'ş': 's', 'Ş': 'S', 'ü': 'u', 'Ü': 'U'
    };
    return text.replace(/[çÇğĞıİöÖşŞüÜ]/g, (char) => map[char] || char);
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

        const { orderId } = await req.json();

        if (!orderId) {
            return new Response(
                JSON.stringify({ error: "Sipariş ID gerekli" }),
                { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
        }

        // Sipariş bilgilerini al
        const { data: order, error: orderError } = await supabaseClient
            .from("orders")
            .select("id, order_no, grand_total, guest_email, guest_name, guest_phone, shipping_address")
            .eq("id", orderId)
            .single();

        if (orderError || !order) {
            return new Response(
                JSON.stringify({ error: "Sipariş bulunamadı" }),
                { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
        }

        // Sipariş ürünlerini al
        const { data: orderItems } = await supabaseClient
            .from("order_items")
            .select("product_name, quantity, unit_price")
            .eq("order_id", orderId);

        // User basket JSON oluştur (PayTR formatı)
        // PayTR PHP örneği: [["Ürün adı", "18.00", 1]] — fiyat string, adet number
        const userBasket = (orderItems || []).map(item => [
            sanitizeTurkish(item.product_name || "Urun"),
            (item.unit_price || 0).toFixed(2),
            item.quantity || 1
        ]);
        const userBasketJson = JSON.stringify(userBasket);
        const userBasketStr = btoa(unescape(encodeURIComponent(userBasketJson)));

        // IP adresi
        const forwardedFor = req.headers.get("x-forwarded-for") || "";
        const userIp = forwardedFor.split(",")[0].trim() || "127.0.0.1";

        // Ödeme tutarı (kuruş cinsinden)
        const paymentAmount = Math.round(order.grand_total * 100).toString();

        // Benzersiz sipariş no (PayTR için - sadece alfanümerik olmalı)
        const merchantOid = order.order_no.replace(/[^a-zA-Z0-9]/g, '');

        // Kullanıcı bilgileri
        const email = order.guest_email || "musteri@icelsolarmarket.com";
        const userName = sanitizeTurkish(order.guest_name || "Misafir");
        const userPhone = order.guest_phone || "05000000000";
        const userAddress = sanitizeTurkish(
            order.shipping_address
                ? `${order.shipping_address.address || ""} ${order.shipping_address.city || ""}`
                : "Adres bilgisi yok"
        );

        // PayTR parametreleri
        const noInstallment = "1"; // Taksit yok
        const maxInstallment = "0"; // Maksimum taksit sayısı (0 = tek çekim)
        const currency = "TL";
        const testMode = "1"; // TEST MODU AÇIK
        const debugOn = "1"; // Debug açık (test süresince)
        const timeoutLimit = "30"; // 30 dakika timeout
        const lang = "tr";

        // PayTR Token Hash oluştur
        // Hash = HMAC_SHA256(merchant_key, concat_str + merchant_salt)
        // concat_str = merchant_id + user_ip + merchant_oid + email + payment_amount + user_basket + no_installment + max_installment + currency + test_mode
        const hashStr = MERCHANT_ID + userIp + merchantOid + email + paymentAmount +
            userBasketStr + noInstallment + maxInstallment + currency + testMode;

        const paytrToken = await hmacSha256(MERCHANT_KEY, hashStr + MERCHANT_SALT);

        console.log("=== PAYTR TOKEN REQUEST ===");
        console.log("merchant_id:", MERCHANT_ID);
        console.log("merchant_oid:", merchantOid);
        console.log("payment_amount:", paymentAmount);
        console.log("user_ip:", userIp);
        console.log("email:", email);
        console.log("test_mode:", testMode);
        console.log("=== END DEBUG ===");

        // PayTR API'ye token isteği
        const formBody = new URLSearchParams({
            merchant_id: MERCHANT_ID,
            user_ip: userIp,
            merchant_oid: merchantOid,
            email: email,
            payment_amount: paymentAmount,
            paytr_token: paytrToken,
            user_basket: userBasketStr,
            debug_on: debugOn,
            no_installment: noInstallment,
            max_installment: maxInstallment,
            user_name: userName,
            user_address: userAddress,
            user_phone: userPhone,
            merchant_ok_url: `https://icelsolarmarket.com/payment/success/${merchantOid}`,
            merchant_fail_url: MERCHANT_FAIL_URL,
            timeout_limit: timeoutLimit,
            currency: currency,
            test_mode: testMode,
            lang: lang,
        });

        const paytrResponse = await fetch("https://www.paytr.com/odeme/api/get-token", {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: formBody.toString()
        });

        const paytrResult = await paytrResponse.json();

        console.log("PayTR Response:", JSON.stringify(paytrResult));

        if (paytrResult.status !== "success") {
            console.error("PayTR token error:", paytrResult.reason);
            return new Response(
                JSON.stringify({
                    error: "PayTR token alınamadı",
                    details: paytrResult.reason || "Bilinmeyen hata"
                }),
                { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
        }

        // Payment transaction kaydı oluştur
        const txId = crypto.randomUUID();
        await supabaseClient
            .from("payment_transactions")
            .insert({
                id: txId,
                order_id: orderId,
                amount: order.grand_total,
                currency: "TRY",
                status: "pending",
                is_3d_secure: true,
                raw_request: {
                    merchant_oid: merchantOid,
                    payment_amount: paymentAmount,
                    provider: "paytr"
                }
            });

        // Sipariş durumunu güncelle
        await supabaseClient
            .from("orders")
            .update({ payment_method: "paytr" })
            .eq("id", orderId);

        return new Response(
            JSON.stringify({
                success: true,
                token: paytrResult.token,
                iframeUrl: `https://www.paytr.com/odeme/guvenli/${paytrResult.token}`
            }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );

    } catch (error) {
        console.error("PayTR initiate error:", error);
        return new Response(
            JSON.stringify({ error: "PayTR ödeme başlatılamadı", details: error.message }),
            { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
    }
});
