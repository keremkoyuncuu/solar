// Garanti BBVA Sanal POS - 3D Secure Callback Handler
// Supabase Edge Function

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Frontend URLs
const FRONTEND_SUCCESS_URL = Deno.env.get("FRONTEND_SUCCESS_URL") || "https://icelsolarmarket.com/payment/success";
const FRONTEND_FAIL_URL = Deno.env.get("FRONTEND_FAIL_URL") || "https://icelsolarmarket.com/payment/fail";

serve(async (req) => {
    if (req.method === "OPTIONS") {
        return new Response("ok", { headers: corsHeaders });
    }

    try {
        const supabaseClient = createClient(
            Deno.env.get("SUPABASE_URL") ?? "",
            Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
        );

        // Form data'yı parse et (Garanti POST ile gönderir)
        const formData = await req.formData();
        const callbackData: Record<string, string> = {};

        for (const [key, value] of formData.entries()) {
            callbackData[key] = value.toString();
        }

        // URL'den transaction ID al
        const url = new URL(req.url);
        const transactionId = url.searchParams.get("txid");

        if (!transactionId) {
            return Response.redirect(FRONTEND_FAIL_URL + "?error=missing_txid", 302);
        }

        // Garanti response değerlerini al
        const mdStatus = callbackData.mdstatus || "";
        const responseCode = callbackData.procreturncode || "";
        const responseMessage = callbackData.errmsg || callbackData.response || "";
        const authCode = callbackData.authcode || "";
        const hostRefNum = callbackData.hostrefnum || "";
        const transId = callbackData.transid || "";
        const eci = callbackData.eci || "";
        const cavv = callbackData.cavv || "";
        const orderId = callbackData.oid || "";

        // MD Status kontrolü
        // 1, 2, 3, 4 = Başarılı 3D doğrulama
        // 0, 5, 6, 7, 8, 9 = Başarısız
        const is3DSuccess = ["1", "2", "3", "4"].includes(mdStatus);
        const isPaymentSuccess = responseCode === "00" && is3DSuccess;

        // Transaction'ı güncelle
        const { error: updateError } = await supabaseClient
            .from("payment_transactions")
            .update({
                status: isPaymentSuccess ? "success" : "failed",
                md_status: mdStatus,
                bank_response_code: responseCode,
                bank_response_message: responseMessage,
                bank_auth_code: authCode,
                bank_host_ref_num: hostRefNum,
                bank_transaction_id: transId,
                bank_eci: eci,
                bank_cavv: cavv,
                error_code: isPaymentSuccess ? null : responseCode,
                error_message: isPaymentSuccess ? null : responseMessage,
                raw_response: callbackData,
                updated_at: new Date().toISOString()
            })
            .eq("id", transactionId);

        if (updateError) {
            console.error("Transaction update error:", updateError);
        }

        // Transaction'dan order_id al
        const { data: transaction } = await supabaseClient
            .from("payment_transactions")
            .select("order_id")
            .eq("id", transactionId)
            .single();

        if (transaction?.order_id) {
            // Sipariş durumunu güncelle
            const { data: orderData } = await supabaseClient
                .from("orders")
                .select("order_no")
                .eq("id", transaction.order_id)
                .single();

            await supabaseClient
                .from("orders")
                .update({
                    status: isPaymentSuccess ? "approved" : "payment_failed",
                    payment_status: isPaymentSuccess ? "paid" : "failed",
                    payment_transaction_id: transactionId
                })
                .eq("id", transaction.order_id);

            // Başarılı ise success sayfasına, değilse fail sayfasına yönlendir
            if (isPaymentSuccess && orderData?.order_no) {
                return Response.redirect(
                    FRONTEND_SUCCESS_URL + `/${orderData.order_no}`,
                    302
                );
            }
        }

        // Başarısız durumda
        return Response.redirect(
            FRONTEND_FAIL_URL + `?txid=${transactionId}&code=${responseCode}&msg=${encodeURIComponent(responseMessage)}`,
            302
        );

    } catch (error) {
        console.error("Callback error:", error);
        return Response.redirect(FRONTEND_FAIL_URL + "?error=server_error", 302);
    }
});
