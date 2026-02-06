// Garanti BBVA Sanal POS - 3D Secure Ödeme Başlatma
// Supabase Edge Function

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { crypto } from "https://deno.land/std@0.168.0/crypto/mod.ts";

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Garanti POS Credentials
const TERMINAL_ID = Deno.env.get("GARANTI_TERMINAL_ID") || "10402281";
const MERCHANT_ID = Deno.env.get("GARANTI_MERCHANT_ID") || "3223981";
const PROV_USER_ID = Deno.env.get("GARANTI_PROV_USER_ID") || "PROVAUT";
const PROV_PASSWORD = Deno.env.get("GARANTI_PROV_PASSWORD") || "";
const STORE_KEY = Deno.env.get("GARANTI_STORE_KEY") || "";
const MODE = Deno.env.get("GARANTI_MODE") || "TEST";

// URLs
const GARANTI_3D_URL = MODE === "PROD"
    ? "https://sanalposprov.garantibbva.com.tr/servlet/gt3dengine"
    : "https://sanalposprovtest.garantibbva.com.tr/servlet/gt3dengine";

const SUCCESS_URL = Deno.env.get("PAYMENT_SUCCESS_URL") || "https://icelsolarmarket.com/payment/callback";
const FAIL_URL = Deno.env.get("PAYMENT_FAIL_URL") || "https://icelsolarmarket.com/payment/callback";

// SHA-512 Hash oluşturma
async function createSecurityHash(
    terminalId: string,
    orderId: string,
    amount: string,
    securityData: string
): Promise<string> {
    // SecurityData = SHA512(Password + "0" + TerminalID)
    const encoder = new TextEncoder();

    // Hash data: TerminalID + OrderID + Amount + SuccessURL + FailURL + ... + SecurityData
    const hashString = terminalId + orderId + amount + SUCCESS_URL + FAIL_URL +
        "" + "" + "" + securityData;

    const hashBuffer = await crypto.subtle.digest(
        "SHA-512",
        encoder.encode(hashString)
    );

    return btoa(String.fromCharCode(...new Uint8Array(hashBuffer)));
}

async function createSecurityData(password: string, terminalId: string): Promise<string> {
    const encoder = new TextEncoder();
    const data = password + "0" + terminalId;

    const hashBuffer = await crypto.subtle.digest(
        "SHA-512",
        encoder.encode(data)
    );

    return Array.from(new Uint8Array(hashBuffer))
        .map(b => b.toString(16).padStart(2, '0'))
        .join('')
        .toUpperCase();
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

        const { orderId, cardNumber, cardExpiry, cardCvc, cardHolderName } = await req.json();

        if (!orderId || !cardNumber || !cardExpiry || !cardCvc || !cardHolderName) {
            return new Response(
                JSON.stringify({ error: "Eksik bilgi" }),
                { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
        }

        // Sipariş bilgilerini al
        const { data: order, error: orderError } = await supabaseClient
            .from("orders")
            .select("id, order_no, grand_total")
            .eq("id", orderId)
            .single();

        if (orderError || !order) {
            return new Response(
                JSON.stringify({ error: "Sipariş bulunamadı" }),
                { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
        }

        // Tutar (kuruş cinsinden, tam sayı)
        const amount = Math.round(order.grand_total * 100).toString();

        // Kart bilgilerini parse et
        const [expMonth, expYear] = cardExpiry.split("/");
        const cardNumberClean = cardNumber.replace(/\s/g, "");
        const cardLast4 = cardNumberClean.slice(-4);

        // Security data oluştur
        const securityData = await createSecurityData(PROV_PASSWORD, TERMINAL_ID);

        // Hash oluştur
        const hash = await createSecurityHash(TERMINAL_ID, order.order_no, amount, securityData);

        // Payment transaction kaydı oluştur
        const { data: transaction, error: txError } = await supabaseClient
            .from("payment_transactions")
            .insert({
                order_id: orderId,
                amount: order.grand_total,
                currency: "TRY",
                status: "pending",
                card_last_four: cardLast4,
                card_holder_name: cardHolderName,
                is_3d_secure: true,
                raw_request: {
                    order_no: order.order_no,
                    amount: amount,
                    terminal_id: TERMINAL_ID,
                    merchant_id: MERCHANT_ID
                }
            })
            .select()
            .single();

        if (txError) {
            console.error("Transaction create error:", txError);
            return new Response(
                JSON.stringify({ error: "İşlem kaydı oluşturulamadı" }),
                { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
        }

        // 3D Secure form verilerini hazırla
        const formData = {
            mode: MODE,
            apiversion: "512",
            terminalprovuserid: PROV_USER_ID,
            terminaluserid: TERMINAL_ID,
            terminalmerchantid: MERCHANT_ID,
            terminalid: TERMINAL_ID,
            txntype: "sales",
            txnamount: amount,
            txncurrencycode: "949", // TRY
            txninstallmentcount: "", // Tek çekim
            orderid: order.order_no,
            customeremailaddress: "",
            customeripaddress: req.headers.get("x-forwarded-for") || "127.0.0.1",
            secure3dsecuritylevel: "3D_PAY",
            cardnumber: cardNumberClean,
            cardexpiredatemonth: expMonth.padStart(2, "0"),
            cardexpiredateyear: expYear.length === 2 ? "20" + expYear : expYear,
            cardcvv2: cardCvc,
            successurl: SUCCESS_URL + `?txid=${transaction.id}`,
            errorurl: FAIL_URL + `?txid=${transaction.id}`,
            secure3dhash: hash,
            storekey: STORE_KEY
        };

        // HTML form döndür (client tarafında auto-submit edilecek)
        const formHtml = `
      <!DOCTYPE html>
      <html>
      <head><title>3D Secure Yönlendirme</title></head>
      <body onload="document.getElementById('paymentForm').submit();">
        <p>3D Secure sayfasına yönlendiriliyorsunuz...</p>
        <form id="paymentForm" method="POST" action="${GARANTI_3D_URL}">
          ${Object.entries(formData).map(([key, value]) =>
            `<input type="hidden" name="${key}" value="${value}" />`
        ).join('\n')}
        </form>
      </body>
      </html>
    `;

        return new Response(
            JSON.stringify({
                success: true,
                transactionId: transaction.id,
                formHtml: formHtml,
                redirectUrl: GARANTI_3D_URL,
                formData: formData
            }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );

    } catch (error) {
        console.error("Payment initiate error:", error);
        return new Response(
            JSON.stringify({ error: "Ödeme başlatılamadı", details: error.message }),
            { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
    }
});
