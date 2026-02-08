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
    ? "https://sanalposprov.garanti.com.tr/servlet/gt3dengine"
    : "https://sanalposprovtest.garanti.com.tr/servlet/gt3dengine";

const SUCCESS_URL = Deno.env.get("PAYMENT_SUCCESS_URL") || "https://icelsolarmarket.com/payment/callback";
const FAIL_URL = Deno.env.get("PAYMENT_FAIL_URL") || "https://icelsolarmarket.com/payment/callback";

// Garanti Resmi Dokümantasyonuna Göre Hash Algoritması
// HashedPassword = SHA1(Password + "0" + TerminalID).toUpperCase()
// HashData = SHA512(TerminalID + OrderID + Amount + CurrencyCode + SuccessURL + ErrorURL + Type + InstallmentCount + StoreKey + HashedPassword).toUpperCase()

// SHA1 Hash (HashedPassword için)
async function sha1Hash(text: string): Promise<string> {
    const encoder = new TextEncoder();
    const hashBuffer = await crypto.subtle.digest(
        "SHA-1",
        encoder.encode(text)
    );

    return Array.from(new Uint8Array(hashBuffer))
        .map(b => b.toString(16).padStart(2, '0'))
        .join('')
        .toUpperCase();
}

// SHA512 Hash (Final HashData için)
async function sha512Hash(text: string): Promise<string> {
    const encoder = new TextEncoder();
    const hashBuffer = await crypto.subtle.digest(
        "SHA-512",
        encoder.encode(text)
    );

    return Array.from(new Uint8Array(hashBuffer))
        .map(b => b.toString(16).padStart(2, '0'))
        .join('')
        .toUpperCase();
}

// HashedPassword oluştur - SHA1(Password + "0" + TerminalID)
async function createHashedPassword(password: string, terminalId: string): Promise<string> {
    const data = password + "0" + terminalId;
    console.log("HashedPassword Input:", data);

    const result = await sha1Hash(data);
    console.log("HashedPassword Result (SHA1):", result);
    return result;
}

// Final Hash oluştur - Garanti Format
// SHA512(TerminalID + OrderID + Amount + CurrencyCode + SuccessURL + ErrorURL + Type + InstallmentCount + StoreKey + HashedPassword)
async function createHashData(
    terminalId: string,
    orderId: string,
    amount: string,
    currencyCode: string,
    successUrl: string,
    errorUrl: string,
    txnType: string,
    installmentCount: string,
    storeKey: string,
    hashedPassword: string
): Promise<string> {
    // Garanti Resmi Format: TerminalID + OrderID + Amount + CurrencyCode + SuccessURL + ErrorURL + Type + InstallmentCount + StoreKey + HashedPassword
    const hashString = terminalId + orderId + amount + currencyCode + successUrl + errorUrl +
        txnType + installmentCount + storeKey + hashedPassword;

    console.log("=== HASH DATA DEBUG ===");
    console.log("TerminalID:", terminalId);
    console.log("OrderID:", orderId);
    console.log("Amount:", amount);
    console.log("CurrencyCode:", currencyCode);
    console.log("SuccessURL:", successUrl);
    console.log("ErrorURL:", errorUrl);
    console.log("TxnType:", txnType);
    console.log("InstallmentCount:", installmentCount);
    console.log("StoreKey:", storeKey);
    console.log("StoreKey Length:", storeKey?.length || 0);
    console.log("HashedPassword:", hashedPassword);
    console.log("Full HashData String:", hashString);
    console.log("=== END DEBUG ===");

    const result = await sha512Hash(hashString);
    console.log("HashData Result (SHA512 - UPPERCASE HEX):", result);
    return result;
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

        const { orderId, cardNumber, cardExpiry, cardCvc, cardHolderName, installmentCount, totalAmount } = await req.json();

        if (!orderId || !cardNumber || !cardExpiry || !cardCvc || !cardHolderName) {
            return new Response(
                JSON.stringify({ error: "Eksik bilgi" }),
                { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
        }

        // Taksit sayısı (1 = tek çekim, 2-12 arası taksit)
        const txnInstallmentCount = installmentCount && installmentCount > 1 ? String(installmentCount) : "";

        // DEBUG: Gelen değerleri logla
        console.log("=== INSTALLMENT DEBUG ===");
        console.log("Raw request body - installmentCount:", installmentCount, "type:", typeof installmentCount);
        console.log("Raw request body - totalAmount:", totalAmount, "type:", typeof totalAmount);
        console.log("txnInstallmentCount (to POS):", txnInstallmentCount);

        // Sipariş bilgilerini al
        const { data: order, error: orderError } = await supabaseClient
            .from("orders")
            .select("id, order_no, grand_total, guest_email")
            .eq("id", orderId)
            .single();

        if (orderError || !order) {
            return new Response(
                JSON.stringify({ error: "Sipariş bulunamadı" }),
                { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
        }

        // Tutar (kurus cinsinden, tam sayı) - Frontend'den gelen totalAmount kullan (taksit komisyonu dahil)
        // totalAmount undefined veya 0 ise order.grand_total kullan
        const rawTotalAmount = totalAmount !== undefined && totalAmount !== null ? Number(totalAmount) : null;
        const finalAmount = rawTotalAmount && rawTotalAmount > 0 ? rawTotalAmount : order.grand_total;
        const amount = Math.round(finalAmount * 100).toString();

        console.log("order.grand_total:", order.grand_total);
        console.log("rawTotalAmount (from request):", rawTotalAmount);
        console.log("finalAmount (USED FOR PAYMENT):", finalAmount);
        console.log("amount (in kurus, sent to bank):", amount);
        console.log("=== END DEBUG ===");

        // Kart bilgilerini parse et
        const [expMonth, expYear] = cardExpiry.split("/");
        const cardNumberClean = cardNumber.replace(/\s/g, "");
        const cardLast4 = cardNumberClean.slice(-4);

        // Transaction ID için geçici değer (henüz oluşturulmadı)
        const tempTxId = crypto.randomUUID();

        // URL'ler - hem hash hem form için AYNI (Garanti eşleşme bekler)
        const successUrl = SUCCESS_URL + `?txid=${tempTxId}`;
        const errorUrl = FAIL_URL + `?txid=${tempTxId}`;

        const txnType = "sales";
        const currencyCode = "949"; // TRY

        // HashedPassword oluştur - SHA1(Password + "0" + TerminalID)
        const hashedPassword = await createHashedPassword(PROV_PASSWORD, TERMINAL_ID);

        // HashData oluştur - SHA512 (Garanti Resmi Format)
        // Hash ve Form için AYNI URL'ler kullanılıyor
        const hash = await createHashData(
            TERMINAL_ID,
            order.order_no,
            amount,
            currencyCode,
            successUrl,  // Form ile aynı URL
            errorUrl,    // Form ile aynı URL
            txnType,
            txnInstallmentCount,
            STORE_KEY,
            hashedPassword
        );

        // Payment transaction kaydı oluştur
        const { data: transaction, error: txError } = await supabaseClient
            .from("payment_transactions")
            .insert({
                id: tempTxId,
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

        // 3D Secure form verilerini hazırla - Resmi Garanti Format
        const txnTimestamp = new Date().toISOString(); // UTC zaman

        // IP adresi - x-forwarded-for birden fazla IP içerebilir, sadece ilkini al
        const forwardedFor = req.headers.get("x-forwarded-for") || "";
        const clientIp = forwardedFor.split(",")[0].trim() || "127.0.0.1";
        console.log("Client IP:", clientIp);

        const formData = {
            mode: MODE,
            apiversion: "512",
            terminalprovuserid: PROV_USER_ID,
            terminaluserid: TERMINAL_ID,
            terminalmerchantid: MERCHANT_ID,
            terminalid: TERMINAL_ID,
            orderid: order.order_no,
            successurl: successUrl,
            errorurl: errorUrl,
            customeremailaddress: order.guest_email || "",
            customeripaddress: clientIp,
            companyname: "ICEL SOLAR MARKET", // Eksik olan alan
            lang: "tr", // Eksik olan alan
            txntimestamp: txnTimestamp, // Eksik olan alan
            refreshtime: "1", // Eksik olan alan
            secure3dsecuritylevel: "3D_PAY",
            secure3dhash: hash,
            txnamount: amount,
            txntype: txnType,
            txncurrencycode: "949", // TRY
            txninstallmentcount: txnInstallmentCount,
            cardholdername: cardHolderName, // Eksik olan alan
            cardnumber: cardNumberClean,
            cardexpiredatemonth: expMonth.padStart(2, "0"),
            cardexpiredateyear: expYear.length === 2 ? expYear : expYear.slice(-2), // Son 2 haneli yıl
            cardcvv2: cardCvc
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
